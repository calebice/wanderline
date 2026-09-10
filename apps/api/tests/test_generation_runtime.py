import json
from datetime import timedelta
from io import BytesIO
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import app.lesson_service as service_module
from app.config import Settings
from app.generation_runtime import (
    UncertainGenerationError,
    durable_operation,
    estimated_cost,
    measured_call,
    usage_context,
)
from app.lesson_generation import DemoLessonProvider, image_generation_available, lesson_provider
from app.lesson_schemas import LessonCreate, LessonGenerationBrief
from app.lesson_service import LessonService, process_generation_run, recover_interrupted_runs
from app.models import GenerationUsage, LessonGenerationRun, utc_now
from tests.test_lessons import MemoryQueue, MemoryStorage, image_bytes


def test_costs_include_cache_writes_without_double_counting_reasoning() -> None:
    assert estimated_cost(
        "gpt-5.6-terra",
        {
            "input_tokens": 1000,
            "output_tokens": 200,
            "input_tokens_details": {"cached_tokens": 100, "cache_write_tokens": 200},
            "output_tokens_details": {"reasoning_tokens": 100},
        },
    ) == pytest.approx(0.00432)
    assert estimated_cost(
        "gpt-image-2",
        {
            "input_tokens": 150,
            "output_tokens": 1000,
            "input_tokens_details": {"text_tokens": 50, "image_tokens": 100},
        },
    ) == pytest.approx(0.03105)
    assert estimated_cost("gpt-image-2", {"input_tokens": 100, "output_tokens": 1000}) is None
    assert estimated_cost("other", {"input_tokens": 1, "output_tokens": 1}) is None
    assert estimated_cost("gpt-5.6-terra", None) is None


def test_demo_policy_ignores_a_configured_key_and_normalizes_inactive_choices() -> None:
    settings = Settings(lesson_generation_provider="demo", openai_api_key="unused")
    assert not image_generation_available(settings)
    assert isinstance(lesson_provider(settings), DemoLessonProvider)
    brief = LessonGenerationBrief(mood="as_shown", custom_mood="old custom idea")
    assert brief.custom_mood is None


async def prepare(db: AsyncSession) -> tuple[LessonService, MemoryStorage, MemoryQueue, Any]:
    storage, queue = MemoryStorage(), MemoryQueue()
    service = LessonService(Settings(lesson_generation_provider="demo"), storage, db, queue)  # type: ignore[arg-type]
    draft = await service.create(LessonCreate())
    draft = await service.upload_references(
        draft.id,
        [
            UploadFile(
                filename="pear.png",
                file=BytesIO(image_bytes()),
                headers={"content-type": "image/png"},
            )
        ],
    )
    return service, storage, queue, draft


@pytest.mark.asyncio
async def test_idempotent_job_is_discoverable_and_duplicate_delivery_does_no_work(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    service, storage, queue, draft = await prepare(db)
    first = await service.create_generation(draft.id, False, idempotency_key="one-action")
    again = await service.create_generation(draft.id, False, idempotency_key="one-action")
    assert first.id == again.id
    assert len(queue.messages) == 1
    assert await service.list_saved() == []
    assert (await service.list_saved("drafts"))[0].latest_run_id == first.id
    calls = 0

    class CountingProvider(DemoLessonProvider):
        async def generate(self, request: Any) -> Any:
            nonlocal calls
            calls += 1
            return await super().generate(request)

    monkeypatch.setattr(service_module, "lesson_provider", lambda settings: CountingProvider())
    await process_generation_run(first.id, service.settings, storage, db)  # type: ignore[arg-type]
    await process_generation_run(first.id, service.settings, storage, db)  # type: ignore[arg-type]
    assert calls == 1
    assert (
        await service.create_generation(draft.id, False, idempotency_key="one-action")
    ).id == first.id


@pytest.mark.asyncio
async def test_durable_results_survive_restart_and_unknown_requests_are_never_repeated(
    db: AsyncSession,
) -> None:
    service, storage, _, draft = await prepare(db)
    created = await service.create_generation(draft.id, False)
    run = await db.get(LessonGenerationRun, created.id)
    assert run
    calls = 0

    async def generate() -> tuple[bytes, str]:
        nonlocal calls
        calls += 1
        return b"paid-image", "image/png"

    first = await durable_operation(run, db, storage, "board-0-0", generate)  # type: ignore[arg-type]
    run.checkpoints = {**run.checkpoints, "audit-0-0": {"status": "failed"}}  # type: ignore[arg-type]
    await db.commit()
    assert await durable_operation(run, db, storage, "board-0-0", generate) == first  # type: ignore[arg-type]
    assert calls == 1
    run.checkpoints = {"board-0-0": {"status": "started"}}
    await db.commit()
    # Storage completed before a crash interrupted the checkpoint transaction.
    assert await durable_operation(run, db, storage, "board-0-0", generate) == first  # type: ignore[arg-type]
    assert calls == 1
    run.checkpoints = {"target": {"status": "unknown"}}
    await db.commit()
    with pytest.raises(UncertainGenerationError):
        await durable_operation(run, db, storage, "target", generate)  # type: ignore[arg-type]
    assert calls == 1


@pytest.mark.asyncio
async def test_usage_is_saved_before_local_parsing_and_unknown_usage_is_visible(
    db: AsyncSession,
) -> None:
    service, _, _, draft = await prepare(db)
    created = await service.create_generation(draft.id, False)
    run = await db.get(LessonGenerationRun, created.id)
    assert run
    token = usage_context.set((db, run))

    async def malformed() -> Any:
        return SimpleNamespace(
            id="response-1",
            output_text="invalid json",
            usage={"input_tokens": 1000, "output_tokens": 100},
        )

    async def absent() -> Any:
        return SimpleNamespace(id="response-2")

    try:
        result = await measured_call("gpt-5.6-terra", "guidance", {}, malformed)
        with pytest.raises(json.JSONDecodeError):
            json.loads(result.output_text)
        await measured_call("gpt-image-2", "preview", {}, absent)
    finally:
        usage_context.reset(token)
    rows = list(await db.scalars(select(GenerationUsage)))
    assert len(rows) == 2
    assert rows[0].request_id == "response-1"
    assert float(rows[0].estimated_cost_usd or 0) == pytest.approx(0.0032)
    summary = await service.usage_summary()
    assert summary["unknown_calls"] == 1
    assert summary["estimated_cost_usd"] == pytest.approx(0.0032)


@pytest.mark.asyncio
async def test_section_generation_receives_unsaved_editor_snapshot(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    service, storage, _, draft = await prepare(db)
    initial = await service.create_generation(draft.id, False)
    await process_generation_run(initial.id, service.settings, storage, db)  # type: ignore[arg-type]
    current = (await service.get(draft.id)).content
    assert current
    current.overview = "My unsaved idea about evening light."

    class SectionProvider(DemoLessonProvider):
        async def generate(self, request: Any) -> Any:
            raise AssertionError("Section editing must not generate a full session")

        async def regenerate(self, request: Any, content: Any, section_key: str) -> Any:
            assert content.overview == current.overview
            return "A warm evening wash."

    monkeypatch.setattr(service_module, "lesson_provider", lambda settings: SectionProvider())
    section = await service.create_generation(draft.id, False, "overview", current_content=current)
    await process_generation_run(section.id, service.settings, storage, db)  # type: ignore[arg-type]
    assert (await service.get_run(section.id)).result == "A warm evening wash."
    assert (await service.get(draft.id)).content.overview != current.overview  # type: ignore[union-attr]


@pytest.mark.asyncio
async def test_interrupted_worker_exposes_recoverable_completed_work(db: AsyncSession) -> None:
    service, _, _, draft = await prepare(db)
    created = await service.create_generation(draft.id, False)
    run = await db.get(LessonGenerationRun, created.id)
    assert run
    run.status = "running"
    run.heartbeat_at = utc_now() - timedelta(minutes=20)
    run.checkpoints = {"text": {"status": "completed", "object_key": "saved.json"}}
    await db.commit()
    await recover_interrupted_runs(db)
    assert run.status == "failed"
    assert run.recoverable
    assert (await service.get(draft.id)).generation_status == "failed"
