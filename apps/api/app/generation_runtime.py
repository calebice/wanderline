"""Call accounting and restart-safe operation results. No source images enter logs."""

import base64
import json
from collections.abc import Awaitable, Callable
from contextvars import ContextVar
from time import monotonic
from typing import Any

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.models import GenerationUsage, LessonGenerationRun, utc_now
from app.storage import S3ObjectStorage

PRICING_VERSION = "openai-2026-09-08"
operation_context: ContextVar[str | None] = ContextVar("operation_context", default=None)
usage_context: ContextVar[tuple[AsyncSession, LessonGenerationRun] | None] = ContextVar(
    "usage_context", default=None
)


class UncertainGenerationError(RuntimeError):
    """A request might have reached the provider; never silently repeat it."""


def estimated_cost(model: str, tokens: dict[str, Any] | None) -> float | None:
    if not tokens or "input_tokens" not in tokens or "output_tokens" not in tokens:
        return None
    detail = tokens.get("input_tokens_details") or {}
    incoming, outgoing = tokens["input_tokens"], tokens["output_tokens"]
    if model == "gpt-5.6-terra":
        cached, written = detail.get("cached_tokens", 0), detail.get("cache_write_tokens", 0)
        return float(
            (max(0, incoming - cached - written) * 2 + cached * 0.2 + written * 2.5 + outgoing * 12)
            / 1_000_000
        )
    if model == "gpt-image-2" and "text_tokens" in detail and "image_tokens" in detail:
        # Do not guess a modality allocation if only aggregate cached usage is reported.
        cached = detail.get("cached_tokens_details") or {}
        if detail.get("cached_tokens", 0) and not cached:
            return None
        text_read, image_read = cached.get("text_tokens", 0), cached.get("image_tokens", 0)
        return float(
            (
                (detail["text_tokens"] - text_read) * 5
                + text_read * 1.25
                + (detail["image_tokens"] - image_read) * 8
                + image_read * 2
                + outgoing * 30
            )
            / 1_000_000
        )
    return None


async def measured_call(
    model: str, operation: str, parameters: dict[str, Any], call: Callable[[], Awaitable[Any]]
) -> Any:
    context = usage_context.get()
    record = None
    if context:
        db, run = context
        key = operation_context.get()
        parameters = {
            **parameters,
            "operation_key": key,
            "request_type": operation,
            "corrective_retry": bool(
                key and key.startswith(("board-", "audit-")) and key.endswith("-1")
            ),
        }
        if key:
            operation = (
                "preview"
                if key == "target"
                else "guidance"
                if key == "text"
                else "layer_board"
                if key.startswith("board-")
                else "board_validation"
                if key.startswith("audit-")
                else "step_image"
                if key.startswith("stage-")
                else operation
            )
        record = GenerationUsage(
            lesson_id=run.lesson_id,
            run_id=run.id,
            operation=operation,
            attempt=run.attempts,
            model=model,
            parameters=parameters,
            pricing_version=PRICING_VERSION,
        )
        db.add(record)
        run.heartbeat_at = utc_now()
        await db.commit()
    started = monotonic()
    try:
        response = await call()
    except Exception as error:
        if record and context:
            record.outcome = (
                "unknown"
                if type(error).__name__ in {"APITimeoutError", "APIConnectionError"}
                else "failed"
            )
            record.request_id = getattr(error, "request_id", None)
            record.latency_ms = int((monotonic() - started) * 1000)
            await context[0].commit()
        raise
    if record and context:
        usage = getattr(response, "usage", None)
        record.tokens = (
            usage.model_dump(mode="json")
            if isinstance(usage, BaseModel)
            else usage
            if isinstance(usage, dict)
            else None
        )
        record.request_id = getattr(response, "_request_id", None) or getattr(response, "id", None)
        record.outcome = "received"
        record.estimated_cost_usd = estimated_cost(model, record.tokens)
        record.latency_ms = int((monotonic() - started) * 1000)
        await context[0].commit()
    return response


async def durable_operation[T](
    run: LessonGenerationRun,
    db: AsyncSession,
    storage: S3ObjectStorage,
    key: str,
    call: Callable[[], Awaitable[T]],
    schema: type[BaseModel] | None = None,
) -> T:
    checkpoints = dict(run.checkpoints or {})
    saved = checkpoints.get(key)
    object_key = f"lessons/{run.lesson_id}/runs/{run.id}/{key}.json"
    if saved and saved["status"] in {"started", "unknown"}:
        try:
            await run_in_threadpool(storage.get, object_key)
        except Exception:  # noqa: BLE001
            # An unavailable object never permits repeating a possibly paid call.
            saved = checkpoints.get(key)
        else:
            saved = {"status": "completed", "object_key": object_key}
            checkpoints[key] = saved
            run.checkpoints = dict(checkpoints)
            await db.commit()
    if saved and saved["status"] == "completed":
        raw = json.loads(await run_in_threadpool(storage.get, saved["object_key"]))
        if raw["kind"] == "image":
            return (base64.b64decode(raw["data"]), raw["mime"])  # type: ignore[return-value]
        if schema:
            return schema.model_validate(raw["data"])  # type: ignore[return-value]
        return raw["data"]  # type: ignore[no-any-return]
    if saved and saved["status"] in {"started", "unknown"}:
        raise UncertainGenerationError(
            "This request may already have finished at OpenAI. Its result could not be recovered. Check AI usage before explicitly starting another version."
        )
    checkpoints[key] = {"status": "started"}
    run.checkpoints = checkpoints
    run.heartbeat_at = utc_now()
    await db.commit()
    operation_token = operation_context.set(key)
    try:
        result = await call()
    except Exception as error:
        checkpoints[key] = {
            "status": "unknown"
            if type(error).__name__
            in {"APITimeoutError", "APIConnectionError", "UncertainGenerationError"}
            else "failed"
        }
        run.checkpoints = dict(checkpoints)
        await db.commit()
        raise
    finally:
        operation_context.reset(operation_token)
    if isinstance(result, tuple) and isinstance(result[0], bytes):
        value = {"kind": "image", "data": base64.b64encode(result[0]).decode(), "mime": result[1]}
    else:
        value = {
            "kind": "json",
            "data": result.model_dump(mode="json") if isinstance(result, BaseModel) else result,
        }
    object_key = f"lessons/{run.lesson_id}/runs/{run.id}/{key}.json"
    await run_in_threadpool(storage.put, object_key, json.dumps(value).encode(), "application/json")
    checkpoints[key] = {"status": "completed", "object_key": object_key}
    run.checkpoints = dict(checkpoints)
    run.heartbeat_at = utc_now()
    await db.commit()
    return result
