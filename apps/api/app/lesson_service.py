import json
import logging
import uuid
from datetime import timedelta
from functools import partial
from io import BytesIO
from typing import Any, cast

from fastapi import UploadFile
from PIL import Image, ImageOps
from redis.asyncio import Redis
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.analysis import validate_sketch
from app.config import Settings
from app.generation_runtime import durable_operation, usage_context
from app.lesson_generation import (
    LessonGenerationRequest,
    OpenAIStudyImageProvider,
    image_generation_available,
    lesson_provider,
)
from app.lesson_response_schemas import ProcessBoardValidation
from app.lesson_schemas import (
    GenerationRunRead,
    LessonAssetRead,
    LessonBriefUpdate,
    LessonContent,
    LessonCreate,
    LessonGenerationBrief,
    LessonRead,
    LessonSave,
    layer_study_phases,
)
from app.models import GenerationUsage, LessonAsset, LessonGenerationRun, PaintingLesson, utc_now
from app.repositories import LearnerProfileRepository
from app.simple_recipe import RECIPE_VERSION, recipe_contract, split_recipe_art
from app.storage import S3ObjectStorage

LESSON_QUEUE = "wanderline:lesson-generation"
logger = logging.getLogger("wanderline.lesson_generation")


class LessonNotFoundError(Exception):
    pass


class LessonConflictError(Exception):
    pass


class LessonValidationError(ValueError):
    pass


class ProcessBoardRejectedError(LessonValidationError):
    pass


def _clean(value: str | None) -> str | None:
    cleaned = value.strip() if value else ""
    return cleaned or None


def _asset_read(asset: LessonAsset, lesson: PaintingLesson) -> LessonAssetRead:
    target_current = asset.id == lesson.approved_target_asset_id
    legacy_target = lesson.approved_target_asset_id is None and asset.role == "study_reference"
    render_current = (
        asset.role in {"stage_image", "process_sheet", "target_reference", "study_reference"}
        and asset.render_set_id is not None
        and asset.render_set_id == lesson.active_render_set_id
    )
    return LessonAssetRead(
        id=asset.id,
        role=asset.role,
        order_index=asset.order_index,
        is_primary=asset.is_primary,
        stage_id=asset.stage_id,
        render_set_id=asset.render_set_id,
        is_current=target_current
        or (
            asset.role == "tracing_outline"
            and asset.stage_id == str(lesson.approved_target_asset_id)
        )
        or legacy_target
        or render_current
        or asset.role == "original_reference",
        original_content_type=asset.original_content_type,
        display_content_type=asset.display_content_type,
        width=asset.width,
        height=asset.height,
        filename=asset.filename,
        alt_text=asset.alt_text,
        image_url=f"/api/v1/lesson-assets/{asset.id}/image",
    )


async def lesson_read(db: AsyncSession, lesson: PaintingLesson, settings: Settings) -> LessonRead:
    assets = list(
        await db.scalars(
            select(LessonAsset)
            .where(LessonAsset.lesson_id == lesson.id)
            .order_by(LessonAsset.created_at, LessonAsset.order_index)
        )
    )
    provider = lesson_provider(settings)
    stored_brief = lesson.generation_brief or {}
    brief_data = stored_brief or {
        "source_mode": lesson.source_mode or "upload",
        "scene_prompt": lesson.scene_prompt,
        "stage_count": min(
            5, max(1, len(lesson.content.get("stages", [])) if lesson.content else 3)
        ),
    }
    brief = LessonGenerationBrief.model_validate(brief_data)
    latest_run = await db.scalar(
        select(LessonGenerationRun)
        .where(LessonGenerationRun.lesson_id == lesson.id)
        .order_by(LessonGenerationRun.created_at.desc())
        .limit(1)
    )
    return LessonRead(
        latest_run_id=latest_run.id if latest_run else None,
        latest_run_scope=latest_run.scope if latest_run else None,
        id=lesson.id,
        schema_version=lesson.schema_version,
        template=lesson.template,
        medium=lesson.medium,
        title=lesson.title,
        subject=lesson.subject,
        artistic_context=lesson.artistic_context,
        difficulty=lesson.difficulty,
        estimated_duration_minutes=lesson.estimated_duration_minutes,
        source_mode=brief.source_mode,
        scene_prompt=brief.scene_prompt,
        generation_brief=brief,
        sequence_style_configured="sequence_style" in stored_brief,
        approved_target_asset_id=lesson.approved_target_asset_id,
        active_render_set_id=lesson.active_render_set_id,
        image_generation_available=image_generation_available(settings),
        content=LessonContent.model_validate(lesson.content) if lesson.content else None,
        revision=lesson.revision,
        saved_at=lesson.saved_at,
        generation_status=lesson.generation_status,
        generation_error=lesson.generation_error,
        provider_mode=provider.name,
        is_demo=provider.is_demo,
        assets=[_asset_read(asset, lesson) for asset in assets],
        created_at=lesson.created_at,
        updated_at=lesson.updated_at,
    )


def make_display_image(rgb: Any, max_edge: int) -> tuple[bytes, int, int]:
    image = Image.fromarray(rgb)
    image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    output = BytesIO()
    image.save(output, format="WEBP", quality=88, method=6)
    return output.getvalue(), image.width, image.height


def detected_source_type(content: bytes) -> str:
    with Image.open(BytesIO(content)) as source:
        detected = Image.MIME.get(source.format or "")
    return "image/jpeg" if detected == "image/mpo" else detected or "application/octet-stream"


def generation_error_details(error: Exception) -> tuple[str, str]:
    error_name = type(error).__name__
    if error_name == "RateLimitError":
        return "provider_rate_limit", "The generation provider is busy. Wait a moment and retry."
    if error_name in {"APIConnectionError", "APITimeoutError"}:
        return (
            "provider_uncertain",
            "OpenAI may still be working on this request. Check AI usage before starting another version.",
        )
    if error_name in {"AuthenticationError", "PermissionDeniedError"}:
        return (
            "provider_configuration",
            "OpenAI credentials were rejected. Check the server configuration, then retry.",
        )
    return error_name, str(error)[:2000] or "Lesson generation failed. Retry this draft."


class LessonService:
    def __init__(
        self,
        settings: Settings,
        storage: S3ObjectStorage,
        db: AsyncSession,
        queue: Redis | None = None,
    ) -> None:
        self.settings = settings
        self.storage = storage
        self.db = db
        self.queue = queue

    async def _enqueue(self, run: LessonGenerationRun, lesson: PaintingLesson) -> GenerationRunRead:
        queue = self.queue or Redis.from_url(self.settings.redis_url)
        try:
            await cast(Any, queue).lpush(LESSON_QUEUE, json.dumps({"run_id": str(run.id)}))
        except Exception:
            logger.exception(
                "lesson_generation_enqueue_failed",
                extra={"run_id": str(run.id), "lesson_id": str(lesson.id)},
            )
            run.status = "failed"
            run.error_code = "queue_unavailable"
            run.error_message = (
                "The lesson queue is unavailable. Your draft is safe; retry shortly."
            )
            run.recoverable = True
            run.completed_at = utc_now()
            lesson.generation_status = "failed"
            lesson.generation_error = {
                "code": run.error_code,
                "message": run.error_message,
            }
            await self.db.commit()
        finally:
            if self.queue is None:
                await queue.aclose()
        return GenerationRunRead.model_validate(run)

    async def _local_lesson(self, lesson_id: uuid.UUID) -> PaintingLesson:
        learner = await LearnerProfileRepository(self.db).get_local()
        lesson = await self.db.scalar(
            select(PaintingLesson)
            .where(PaintingLesson.id == lesson_id, PaintingLesson.learner_id == learner.id)
            .with_for_update()
        )
        if lesson is None:
            raise LessonNotFoundError(str(lesson_id))
        return lesson

    async def _existing_run(
        self, lesson: PaintingLesson, key: str | None
    ) -> LessonGenerationRun | None:
        if key:
            existing = await self.db.scalar(
                select(LessonGenerationRun).where(
                    LessonGenerationRun.lesson_id == lesson.id,
                    LessonGenerationRun.idempotency_key == key,
                )
            )
            if existing:
                return existing
        active = await self.db.scalar(
            select(LessonGenerationRun).where(
                LessonGenerationRun.lesson_id == lesson.id,
                LessonGenerationRun.status.in_(("queued", "running")),
            )
        )
        if active:
            raise LessonValidationError(
                "This session is already being prepared. Resume it from Your sessions."
            )
        return None

    async def _snapshot(self, lesson: PaintingLesson) -> dict[str, Any]:
        assets = list(
            await self.db.scalars(select(LessonAsset.id).where(LessonAsset.lesson_id == lesson.id))
        )
        return {
            "lesson": lesson_snapshot(lesson),
            "asset_ids": [str(asset) for asset in assets],
            "recipe_version": RECIPE_VERSION
            if _brief(lesson).sequence_style == "simple_recipe"
            else None,
            "provider": self.settings.lesson_generation_provider,
            "text_model": self.settings.openai_lesson_model,
            "image_model": self.settings.openai_image_model,
        }

    async def create(self, request: LessonCreate) -> LessonRead:
        learner = await LearnerProfileRepository(self.db).get_local()
        brief = request.generation_brief
        if "sequence_style" not in brief.model_fields_set:
            brief = brief.model_copy(update={"sequence_style": "layer_study"})
        title = _clean(request.title)
        subject = _clean(request.subject)
        if not title and brief.source_mode == "prompt" and brief.scene_prompt:
            title = f"{brief.scene_prompt.strip()[:80]} — watercolor"
        if not subject and brief.source_mode == "prompt" and brief.scene_prompt:
            subject = brief.scene_prompt.strip()[:200]
        lesson = PaintingLesson(
            learner_id=learner.id,
            title=title or "A fresh watercolor session",
            subject=subject,
            artistic_context=_clean(request.artistic_context),
            difficulty=request.difficulty,
            estimated_duration_minutes=request.estimated_duration_minutes,
            source_mode=brief.source_mode,
            scene_prompt=_clean(brief.scene_prompt),
            generation_brief=brief.model_dump(mode="json"),
        )
        self.db.add(lesson)
        await self.db.commit()
        await self.db.refresh(lesson)
        return await lesson_read(self.db, lesson, self.settings)

    async def update_brief(self, lesson_id: uuid.UUID, request: LessonBriefUpdate) -> LessonRead:
        lesson = await self._local_lesson(lesson_id)
        await self._existing_run(lesson, None)
        brief = request.generation_brief
        if brief.source_mode == "prompt" and not _clean(brief.scene_prompt):
            raise LessonValidationError("Describe the image you want Wanderline to create.")
        lesson.source_mode = brief.source_mode
        lesson.scene_prompt = _clean(brief.scene_prompt)
        changed = lesson.generation_brief != brief.model_dump(mode="json")
        lesson.generation_brief = brief.model_dump(mode="json")
        for name in ("title", "artistic_context", "difficulty", "estimated_duration_minutes"):
            if name in request.model_fields_set:
                value = getattr(request, name)
                if name == "title":
                    value = _clean(value) or "A fresh watercolor session"
                changed = changed or getattr(lesson, name) != value
                setattr(lesson, name, value)
        if changed:
            lesson.revision += 1
        await self.db.commit()
        await self.db.refresh(lesson)
        return await lesson_read(self.db, lesson, self.settings)

    async def get(self, lesson_id: uuid.UUID) -> LessonRead:
        return await lesson_read(self.db, await self._local_lesson(lesson_id), self.settings)

    async def list_saved(self, state: str = "saved") -> list[LessonRead]:
        learner = await LearnerProfileRepository(self.db).get_local()
        lessons = list(
            await self.db.scalars(
                select(PaintingLesson)
                .where(
                    PaintingLesson.learner_id == learner.id,
                    PaintingLesson.saved_at.is_not(None)
                    if state == "saved"
                    else PaintingLesson.saved_at.is_(None)
                    if state == "drafts"
                    else PaintingLesson.id.is_not(None),
                )
                .order_by(PaintingLesson.updated_at.desc())
            )
        )
        return [await lesson_read(self.db, lesson, self.settings) for lesson in lessons]

    async def usage_summary(self) -> dict[str, Any]:
        learner = await LearnerProfileRepository(self.db).get_local()
        rows = list(
            await self.db.scalars(
                select(GenerationUsage)
                .join(PaintingLesson)
                .where(PaintingLesson.learner_id == learner.id)
                .order_by(GenerationUsage.created_at.desc())
            )
        )
        runs = list(
            await self.db.scalars(
                select(LessonGenerationRun)
                .join(PaintingLesson)
                .where(
                    PaintingLesson.learner_id == learner.id,
                    LessonGenerationRun.provider == "openai",
                )
            )
        )
        tracked = {row.run_id for row in rows}
        groups: dict[tuple[str, str, str, str], dict[str, Any]] = {}
        for row in rows:
            key = (row.created_at.date().isoformat(), str(row.lesson_id), row.operation, row.model)
            group = groups.setdefault(
                key,
                {
                    "day": key[0],
                    "lesson_id": key[1],
                    "operation": key[2],
                    "model": key[3],
                    "calls": 0,
                    "estimated_cost_usd": 0.0,
                    "unknown_calls": 0,
                    "retry_calls": 0,
                    "tokens": 0,
                    "cached_tokens": 0,
                    "cache_write_tokens": 0,
                    "latency_ms": 0,
                },
            )
            group["calls"] += 1
            group["estimated_cost_usd"] += float(row.estimated_cost_usd or 0)
            group["unknown_calls"] += int(row.estimated_cost_usd is None)
            group["retry_calls"] += int(
                row.attempt > 1 or (row.parameters or {}).get("corrective_retry", False)
            )
            group["latency_ms"] += row.latency_ms or 0
            if row.tokens:
                group["tokens"] += row.tokens.get("input_tokens", 0) + row.tokens.get(
                    "output_tokens", 0
                )
                group["cached_tokens"] += (row.tokens.get("input_tokens_details") or {}).get(
                    "cached_tokens", 0
                )
                group["cache_write_tokens"] += (row.tokens.get("input_tokens_details") or {}).get(
                    "cache_write_tokens", 0
                )
        return {
            "currency": "USD",
            "pricing_version": "openai-2026-09-08",
            "estimated_cost_usd": sum(float(row.estimated_cost_usd or 0) for row in rows),
            "unknown_calls": sum(row.estimated_cost_usd is None for row in rows),
            "untracked_runs": sum(
                run.id not in tracked and run.input_snapshot is None for run in runs
            ),
            "groups": list(groups.values()),
        }

    async def upload_references(
        self, lesson_id: uuid.UUID, uploads: list[UploadFile]
    ) -> LessonRead:
        lesson = await self._local_lesson(lesson_id)
        await self._existing_run(lesson, None)
        if lesson.source_mode != "upload":
            raise LessonValidationError(
                "Prompt-created lessons cannot also include uploaded references."
            )
        existing = list(
            await self.db.scalars(
                select(LessonAsset).where(
                    LessonAsset.lesson_id == lesson.id,
                    LessonAsset.role == "original_reference",
                )
            )
        )
        if not uploads or len(existing) + len(uploads) > self.settings.max_lesson_images:
            raise LessonValidationError(
                f"Add between 1 and {self.settings.max_lesson_images} reference images."
            )
        for offset, upload in enumerate(uploads):
            raw = await upload.read(self.settings.max_upload_bytes + 1)
            if len(raw) > self.settings.max_upload_bytes:
                raise LessonValidationError("An image exceeds the configured 15 MB upload limit.")
            validated = await run_in_threadpool(
                validate_sketch,
                raw,
                upload.content_type or "",
                self.settings.max_image_pixels,
            )
            display, width, height = await run_in_threadpool(
                make_display_image, validated.rgb, self.settings.lesson_display_max_edge
            )
            original_content_type = await run_in_threadpool(detected_source_type, raw)
            asset_id = uuid.uuid4()
            original_key = f"lessons/{lesson.id}/{asset_id}/original"
            display_key = f"lessons/{lesson.id}/{asset_id}/display.webp"
            await run_in_threadpool(self.storage.put, original_key, raw, original_content_type)
            await run_in_threadpool(self.storage.put, display_key, display, "image/webp")
            filename = (upload.filename or "reference image")[:255]
            self.db.add(
                LessonAsset(
                    id=asset_id,
                    lesson_id=lesson.id,
                    role="original_reference",
                    order_index=len(existing) + offset,
                    is_primary=not existing and offset == 0,
                    original_object_key=original_key,
                    display_object_key=display_key,
                    original_content_type=original_content_type,
                    display_content_type="image/webp",
                    width=width,
                    height=height,
                    filename=filename,
                    alt_text=f"Original painting reference: {filename}",
                )
            )
        await self.db.commit()
        await self.db.refresh(lesson)
        return await lesson_read(self.db, lesson, self.settings)

    async def set_primary(self, lesson_id: uuid.UUID, asset_id: uuid.UUID) -> LessonRead:
        lesson = await self._local_lesson(lesson_id)
        await self._existing_run(lesson, None)
        asset = await self.db.scalar(
            select(LessonAsset).where(
                LessonAsset.id == asset_id,
                LessonAsset.lesson_id == lesson.id,
                LessonAsset.role == "original_reference",
            )
        )
        if asset is None:
            raise LessonValidationError("Reference image not found.")
        await self.db.execute(
            update(LessonAsset)
            .where(LessonAsset.lesson_id == lesson.id, LessonAsset.role == "original_reference")
            .values(is_primary=False)
        )
        await self.db.flush()
        asset.is_primary = True
        await self.db.commit()
        return await lesson_read(self.db, lesson, self.settings)

    async def remove_reference(self, lesson_id: uuid.UUID, asset_id: uuid.UUID) -> LessonRead:
        lesson = await self._local_lesson(lesson_id)
        await self._existing_run(lesson, None)
        asset = await self.db.scalar(
            select(LessonAsset).where(
                LessonAsset.id == asset_id,
                LessonAsset.lesson_id == lesson.id,
                LessonAsset.role == "original_reference",
            )
        )
        if asset is None:
            raise LessonValidationError("Reference image not found.")
        was_primary = asset.is_primary
        await self.db.delete(asset)
        await self.db.flush()
        remaining = list(
            await self.db.scalars(
                select(LessonAsset)
                .where(
                    LessonAsset.lesson_id == lesson.id,
                    LessonAsset.role == "original_reference",
                )
                .order_by(LessonAsset.order_index)
            )
        )
        for order_index, reference in enumerate(remaining):
            reference.order_index = order_index
        if was_primary and remaining:
            remaining[0].is_primary = True
        await self.db.commit()
        for key in (asset.original_object_key, asset.display_object_key):
            await run_in_threadpool(self.storage.delete, key)
        return await lesson_read(self.db, lesson, self.settings)

    async def create_generation(
        self,
        lesson_id: uuid.UUID,
        include_study_image: bool,
        section_key: str | None = None,
        current_content: LessonContent | None = None,
        idempotency_key: str | None = None,
    ) -> GenerationRunRead:
        lesson = await self._local_lesson(lesson_id)
        existing = await self._existing_run(lesson, idempotency_key)
        if existing:
            return GenerationRunRead.model_validate(existing)
        source = await self._generation_source(lesson)
        if source is None:
            raise LessonValidationError("Approve a target image before generating the lesson.")
        if section_key and lesson.content is None:
            raise LessonValidationError("Generate the full lesson before regenerating a section.")
        if section_key and lesson.content is not None:
            content = LessonContent.model_validate(lesson.content)
            if section_key.startswith("stages."):
                stage_id = section_key.split(".", 1)[1]
                if not any(stage.id == stage_id for stage in content.stages):
                    raise LessonValidationError("The requested lesson stage does not exist.")
            elif section_key not in LessonContent.model_fields:
                raise LessonValidationError("The requested lesson section does not exist.")
        if section_key in {"user_notes", "stages"}:
            raise LessonValidationError(
                "Personal notes and step structure cannot be rewritten here."
            )
        provider = lesson_provider(self.settings)
        run = LessonGenerationRun(
            lesson_id=lesson.id,
            scope="section" if section_key else "full",
            section_key=section_key,
            include_study_image=include_study_image if not section_key else False,
            provider=provider.name,
            model=provider.model,
            progress={"phase": "queued", "completed": 0, "total": 1, "items": []},
        )
        lesson.generation_status = "queued"
        lesson.generation_error = None
        run.idempotency_key = idempotency_key
        run.input_snapshot = await self._snapshot(lesson)
        if current_content:
            run.input_snapshot = {
                **run.input_snapshot,
                "section_content": current_content.model_dump(mode="json"),
            }
        self.db.add(run)
        await self.db.commit()
        await self.db.refresh(run)
        return await self._enqueue(run, lesson)

    async def _generation_source(self, lesson: PaintingLesson) -> LessonAsset | None:
        if lesson.approved_target_asset_id:
            approved = await self.db.scalar(
                select(LessonAsset).where(
                    LessonAsset.id == lesson.approved_target_asset_id,
                    LessonAsset.lesson_id == lesson.id,
                )
            )
            if approved is not None:
                return approved
        fallback = await self.db.scalar(
            select(LessonAsset).where(
                LessonAsset.lesson_id == lesson.id,
                LessonAsset.role == "original_reference",
                LessonAsset.is_primary.is_(True),
            )
        )
        return fallback

    async def create_target_generation(
        self,
        lesson_id: uuid.UUID,
        adjustment: str | None = None,
        idempotency_key: str | None = None,
    ) -> GenerationRunRead:
        lesson = await self._local_lesson(lesson_id)
        existing = await self._existing_run(lesson, idempotency_key)
        if existing:
            return GenerationRunRead.model_validate(existing)
        brief = LessonGenerationBrief.model_validate(lesson.generation_brief or {})
        primary = await self.db.scalar(
            select(LessonAsset).where(
                LessonAsset.lesson_id == lesson.id,
                LessonAsset.role == "original_reference",
                LessonAsset.is_primary.is_(True),
            )
        )
        if brief.source_mode == "upload" and primary is None:
            raise LessonValidationError("Add at least one reference photograph.")
        if brief.source_mode == "prompt" and not _clean(brief.scene_prompt):
            raise LessonValidationError("Describe the image you want Wanderline to create.")
        if brief.source_mode == "prompt" and not image_generation_available(self.settings):
            raise LessonValidationError(
                "Text-to-image creation needs an OpenAI image provider. Configure it or upload a photo."
            )
        provider = lesson_provider(self.settings)
        run = LessonGenerationRun(
            lesson_id=lesson.id,
            scope="target",
            include_study_image=False,
            provider=provider.name,
            model=self.settings.openai_image_model
            if image_generation_available(self.settings)
            else provider.model,
            adjustment=_clean(adjustment),
            progress={"phase": "target", "completed": 0, "total": 1, "items": []},
        )
        lesson.generation_status = "queued"
        lesson.generation_error = None
        run.idempotency_key = idempotency_key
        run.input_snapshot = await self._snapshot(lesson)
        self.db.add(run)
        await self.db.commit()
        await self.db.refresh(run)
        return await self._enqueue(run, lesson)

    async def approve_target(self, lesson_id: uuid.UUID, asset_id: uuid.UUID) -> LessonRead:
        lesson = await self._local_lesson(lesson_id)
        await self._existing_run(lesson, None)
        asset = await self.db.scalar(
            select(LessonAsset).where(
                LessonAsset.id == asset_id,
                LessonAsset.lesson_id == lesson.id,
                LessonAsset.role.in_(("target_reference", "study_reference", "original_reference")),
            )
        )
        if asset is None:
            raise LessonValidationError("Target image not found.")
        if asset.role == "original_reference" and image_generation_available(self.settings):
            raise LessonValidationError("Approve a generated watercolor target.")
        if _brief(lesson).sequence_style == "simple_recipe" and asset.role != "original_reference":
            outline = await self.db.scalar(
                select(LessonAsset.id).where(
                    LessonAsset.lesson_id == lesson.id,
                    LessonAsset.role == "tracing_outline",
                    LessonAsset.stage_id == str(asset.id),
                )
            )
            if outline is None:
                raise LessonValidationError(
                    "Create a simple preview with a matching outline first."
                )
        if lesson.approved_target_asset_id != asset.id:
            # Older accepted previews did not carry a render-set association.
            # Preserve that association before choosing a replacement preview.
            if lesson.approved_target_asset_id and lesson.active_render_set_id:
                await self.db.execute(
                    update(LessonAsset)
                    .where(LessonAsset.id == lesson.approved_target_asset_id)
                    .values(render_set_id=lesson.active_render_set_id)
                )
            lesson.revision += 1
        lesson.approved_target_asset_id = asset.id
        await self.db.commit()
        await self.db.refresh(lesson)
        return await lesson_read(self.db, lesson, self.settings)

    async def create_stage_generation(
        self,
        lesson_id: uuid.UUID,
        start_stage_id: str,
        adjustment: str | None,
        idempotency_key: str | None = None,
    ) -> GenerationRunRead:
        lesson = await self._local_lesson(lesson_id)
        if _brief(lesson).sequence_style == "simple_recipe":
            raise LessonValidationError(
                "This recipe has no intermediate images. Change the painting preview instead."
            )
        existing = await self._existing_run(lesson, idempotency_key)
        if existing:
            return GenerationRunRead.model_validate(existing)
        if lesson.content is None:
            raise LessonValidationError("Generate the written lesson first.")
        content = LessonContent.model_validate(lesson.content)
        start_index = next(
            (index for index, stage in enumerate(content.stages) if stage.id == start_stage_id),
            None,
        )
        if start_index is None:
            raise LessonValidationError("The requested lesson stage does not exist.")
        if (
            lesson.schema_version == "painting-lesson.v2"
            and lesson.approved_target_asset_id is not None
            and start_index == len(content.stages) - 1
        ):
            raise LessonValidationError(
                "The final checkpoint is the approved target. Adjust the target to change it."
            )
        provider = lesson_provider(self.settings)
        run = LessonGenerationRun(
            lesson_id=lesson.id,
            scope="stage_images",
            section_key=start_stage_id,
            include_study_image=False,
            provider=provider.name,
            model=self.settings.openai_image_model
            if image_generation_available(self.settings)
            else provider.model,
            adjustment=_clean(adjustment),
            progress={
                "phase": "stage_images",
                "completed": 0,
                "total": len(content.stages) - start_index,
                "items": [],
            },
        )
        lesson.generation_status = "queued"
        lesson.generation_error = None
        run.idempotency_key = idempotency_key
        run.input_snapshot = await self._snapshot(lesson)
        self.db.add(run)
        await self.db.commit()
        await self.db.refresh(run)
        return await self._enqueue(run, lesson)

    async def retry(self, run_id: uuid.UUID) -> GenerationRunRead:
        run = await self.get_run_model(run_id)
        if run.error_code in {
            "UncertainGenerationError",
            "provider_uncertain",
            "ProcessBoardRejectedError",
        }:
            raise LessonValidationError(
                "The earlier request may have been charged. Start another version explicitly after checking AI usage."
            )
        if run.status != "failed":
            raise LessonValidationError("Only failed generation runs can be retried.")
        lesson = await self._local_lesson(run.lesson_id)
        await self._existing_run(lesson, None)
        if run.input_snapshot and run.input_snapshot["lesson"]["revision"] != lesson.revision:
            raise LessonValidationError(
                "This session has changed. Start a new version using your current choices."
            )
        run.status = "queued"
        run.error_code = None
        run.error_message = None
        run.recoverable = True
        run.attempts += 1
        run.queued_at = utc_now()
        run.started_at = None
        run.completed_at = None
        lesson = await self._local_lesson(run.lesson_id)
        lesson.generation_status = "queued"
        lesson.generation_error = None
        await self.db.commit()
        return await self._enqueue(run, lesson)

    async def get_run_model(self, run_id: uuid.UUID) -> LessonGenerationRun:
        run = await self.db.scalar(
            select(LessonGenerationRun).where(LessonGenerationRun.id == run_id)
        )
        if run is None:
            raise LessonNotFoundError(str(run_id))
        await self._local_lesson(run.lesson_id)
        return run

    async def get_run(self, run_id: uuid.UUID) -> GenerationRunRead:
        return GenerationRunRead.model_validate(await self.get_run_model(run_id))

    async def latest_generated(self, lesson_id: uuid.UUID, section_key: str) -> GenerationRunRead:
        lesson = await self._local_lesson(lesson_id)
        run = await self.db.scalar(
            select(LessonGenerationRun)
            .where(
                LessonGenerationRun.lesson_id == lesson.id,
                LessonGenerationRun.section_key == section_key,
                LessonGenerationRun.status == "completed",
            )
            .order_by(LessonGenerationRun.updated_at.desc())
        )
        if run is None:
            raise LessonNotFoundError(section_key)
        return GenerationRunRead.model_validate(run)

    async def save(self, lesson_id: uuid.UUID, request: LessonSave) -> LessonRead:
        lesson = await self._local_lesson(lesson_id)
        if lesson.revision != request.expected_revision:
            raise LessonConflictError(
                "This lesson changed in another session. Reload before saving."
            )
        brief = _brief(lesson)
        if brief.sequence_style == "simple_recipe" and len(request.content.stages) > 6:
            raise LessonValidationError("Simple recipes support up to six instructions.")
        if brief.sequence_style == "simple_recipe" and request.content.recipe is not None:
            mixes = list(request.content.palette)
            if request.content.recipe.finishing:
                mixes.append(request.content.recipe.finishing.mix)
            if any(not mix.ingredients or not mix.consistency for mix in mixes):
                raise LessonValidationError(
                    "Each recipe mix needs one or two paints and a consistency cue."
                )
            ids = {mix.id for mix in request.content.palette}
            if len(ids) != len(request.content.palette) or any(
                not set(stage.palette_mix_ids) <= ids for stage in request.content.stages
            ):
                raise LessonValidationError(
                    "Every recipe instruction must reference an existing paint mix."
                )
        if lesson.schema_version == "painting-lesson.v2" and any(
            not (stage.checkpoint_action or "").strip()
            or (brief.sequence_style != "simple_recipe" and not 2 <= len(stage.approach_steps) <= 3)
            for stage in request.content.stages
        ):
            raise LessonValidationError(
                "Every recipe step needs one painting action."
                if brief.sequence_style == "simple_recipe"
                else "Every v2 checkpoint needs one action and two or three approach steps."
            )
        if brief.sequence_style == "layer_study" and [
            stage.process_phase for stage in request.content.stages
        ] != layer_study_phases(len(request.content.stages)):
            raise LessonValidationError(
                "Layer-by-layer checkpoints must keep their drawing-to-finish phase order."
            )
        lesson.title = request.title.strip()
        lesson.subject = _clean(request.subject)
        lesson.artistic_context = _clean(request.artistic_context)
        lesson.difficulty = request.difficulty
        lesson.estimated_duration_minutes = request.estimated_duration_minutes
        lesson.content = request.content.model_dump(mode="json")
        if brief.sequence_style == "simple_recipe":
            lesson.generation_brief = {
                **(lesson.generation_brief or {}),
                "stage_count": len(request.content.stages),
            }
        lesson.revision += 1
        lesson.saved_at = utc_now()
        lesson.generation_status = "completed"
        lesson.generation_error = None
        await self.db.commit()
        await self.db.refresh(lesson)
        return await lesson_read(self.db, lesson, self.settings)


def _brief(lesson: PaintingLesson) -> LessonGenerationBrief:
    return LessonGenerationBrief.model_validate(lesson.generation_brief or {})


def _art_direction(brief: LessonGenerationBrief) -> str:
    return (
        f"Mood: {brief.custom_mood or brief.mood}. "
        f"Background: {brief.custom_background or brief.background}. "
        f"Watercolor treatment: {brief.custom_treatment or brief.treatment}. "
        f"Additional direction: {brief.additional_direction or 'none'}."
    )


async def _store_generated_asset(
    db: AsyncSession,
    storage: S3ObjectStorage,
    lesson: PaintingLesson,
    image: bytes,
    mime: str,
    role: str,
    filename: str,
    alt_text: str,
    stage_id: str | None = None,
    render_set_id: uuid.UUID | None = None,
) -> LessonAsset:
    asset_id = uuid.uuid4()
    suffix = "png" if mime == "image/png" else "img"
    key = f"lessons/{lesson.id}/{asset_id}/{role}.{suffix}"
    await run_in_threadpool(storage.put, key, image, mime)
    with Image.open(BytesIO(image)) as generated:
        width, height = generated.size
    asset = LessonAsset(
        id=asset_id,
        lesson_id=lesson.id,
        role=role,
        order_index=0,
        is_primary=False,
        stage_id=stage_id,
        render_set_id=render_set_id,
        original_object_key=key,
        display_object_key=key,
        original_content_type=mime,
        display_content_type=mime,
        width=width,
        height=height,
        filename=filename,
        alt_text=alt_text,
    )
    db.add(asset)
    return asset


def _stage_image_prompt(
    lesson: PaintingLesson,
    stage: Any,
    index: int,
    count: int,
    adjustment: str | None,
) -> str:
    return (
        "Create a cumulative transparent-watercolor process image for a beginner lesson. "
        "Keep the approved target's exact subject, crop, viewpoint, proportions, palette, and lighting. "
        f"This is stage {index + 1} of {count}: {stage.title}. {stage.instruction} "
        f"Show only the painting progress that should exist after this stage; later-stage detail must be absent. "
        "Use real watercolor behavior and preserve visible paper. The first reference is the finished target; "
        "when a second reference is present it is the immediately previous stage and must advance coherently. "
        f"User adjustment: {adjustment or 'none'}."
    )


def _process_board_prompt(
    lesson: PaintingLesson,
    stages: list[Any],
    start_index: int,
    total_count: int,
    adjustment: str | None,
    validation_feedback: str | None = None,
    has_previous: bool = False,
) -> str:
    panel_count = len(stages)
    layout = (
        "Return one single 3:2 image showing only this one checkpoint, not a collage."
        if panel_count == 1
        else (
            "Return one 2-by-2 process board on a landscape 3:2 canvas. Divide it into four "
            "exact equal quadrants and place the requested checkpoints in row-major reading order "
            "(top-left, top-right, bottom-left, bottom-right). Keep unused quadrants as plain watercolor paper."
        )
    )
    panel_directions = " ".join(
        f"Panel {offset + 1}, checkpoint {start_index + offset + 1} of {total_count}, "
        f"phase {stage.process_phase}: {stage.checkpoint_action or stage.instruction} "
        f"Technique: {stage.instruction}"
        for offset, stage in enumerate(stages)
    )
    return (
        "Create a truthful transparent-watercolor layer study for a learner. The first reference is "
        "the exact finished target. "
        + (
            "The second reference is the accepted immediately previous checkpoint; preserve every mark "
            "already present there and advance from it. "
            if has_previous
            else ""
        )
        + "Every panel must keep the target's exact crop, viewpoint, subject placement, proportions, "
        "reserved shapes, palette, and lighting. Each panel is the same sheet of paper at a later time: "
        "paint coverage and value depth may only increase. Do not move forms, repaint the composition, "
        "erase earlier pigment, or include later-stage detail early. The drawing_map panel must contain "
        "only feather-light graphite contours or a sparse placement/value map on unpainted paper. "
        "Show natural paper texture and physically plausible washes, glazes, lifting, and dry-brush marks. "
        "Do not render captions, numbers, borders, swatches, signatures, or other lettering inside panels. "
        f"{layout} {panel_directions} User adjustment: {adjustment or 'none'}. "
        f"Correction from visual review: {validation_feedback or 'none'}."
    )


def _process_board_validation_prompt(
    stages: list[Any], start_index: int, total_count: int, has_previous: bool
) -> str:
    directions = " ".join(
        f"Panel {offset + 1} is checkpoint {start_index + offset + 1} of {total_count}, "
        f"phase {stage.process_phase}, and must show: {stage.checkpoint_action or stage.instruction}"
        for offset, stage in enumerate(stages)
    )
    return (
        "Audit a generated watercolor process board. The first image is the board; the second is the "
        "approved finished target. "
        + (
            "The third image is the accepted previous checkpoint that the first active panel must preserve. "
            if has_previous
            else ""
        )
        + "Approve only when subject placement and composition are stable, every active panel matches its "
        "assigned phase, coverage and value depth increase monotonically, and later details do not appear "
        "early. For a multi-panel board, each scene must be fully contained within its exact quadrant with no "
        "marks crossing the halfway boundaries. A drawing_map must be predominantly unpainted paper with only light graphite or sparse value "
        "placement. Ignore unused blank quadrants. Reject swapped panels or a first panel that resembles a "
        f"finished painting. {directions} Return concise actionable failures for a retry."
    )


def crop_process_board(image: bytes, panel_count: int) -> list[bytes]:
    if not 1 <= panel_count <= 4:
        raise ValueError("A process board must contain between one and four active panels.")
    with Image.open(BytesIO(image)) as source:
        board = source.convert("RGB")
        if panel_count == 1:
            boxes = [(0, 0, board.width, board.height)]
        else:
            middle_x, middle_y = board.width // 2, board.height // 2
            boxes = [
                (0, 0, middle_x, middle_y),
                (middle_x, 0, board.width, middle_y),
                (0, middle_y, middle_x, board.height),
                (middle_x, middle_y, board.width, board.height),
            ][:panel_count]
        results: list[bytes] = []
        for box in boxes:
            output = BytesIO()
            board.crop(box).save(output, format="PNG", optimize=True)
            results.append(output.getvalue())
        return results


def compose_process_sheet(stage_images: list[bytes]) -> bytes:
    if not stage_images:
        raise ValueError("A process sheet needs at least one checkpoint image.")
    tile_width, tile_height, gutter = 768, 512, 18
    columns = 1 if len(stage_images) == 1 else 2
    rows = (len(stage_images) + columns - 1) // columns
    sheet = Image.new(
        "RGB",
        (
            columns * tile_width + (columns + 1) * gutter,
            rows * tile_height + (rows + 1) * gutter,
        ),
        "#f4f1e9",
    )
    for index, data in enumerate(stage_images):
        with Image.open(BytesIO(data)) as source:
            tile = Image.new("RGB", (tile_width, tile_height), "#f4f1e9")
            fitted = ImageOps.contain(source.convert("RGB"), (tile_width, tile_height))
            tile.paste(
                fitted,
                ((tile_width - fitted.width) // 2, (tile_height - fitted.height) // 2),
            )
        x = gutter + (index % columns) * (tile_width + gutter)
        y = gutter + (index // columns) * (tile_height + gutter)
        sheet.paste(tile, (x, y))
    output = BytesIO()
    sheet.save(output, format="PNG", optimize=True)
    return output.getvalue()


async def _generate_validated_process_board(
    provider: OpenAIStudyImageProvider,
    inputs: list[tuple[bytes, str]],
    lesson: PaintingLesson,
    stages: list[Any],
    start_index: int,
    total_count: int,
    adjustment: str | None,
    run: LessonGenerationRun,
    db: AsyncSession,
    storage: S3ObjectStorage,
) -> list[bytes]:
    feedback: str | None = None
    for attempt in range(2):
        run.progress = {
            "phase": "painting_process_sheet",
            "completed": start_index,
            "total": total_count,
            "items": [
                {"key": stage.id, "status": "running" if offset == 0 else "pending"}
                for offset, stage in enumerate(stages)
            ],
        }
        await db.commit()
        board, mime = await durable_operation(
            run,
            db,
            storage,
            f"board-{start_index}-{attempt}",
            partial(
                provider.generate,
                inputs,
                _process_board_prompt(
                    lesson,
                    stages,
                    start_index,
                    total_count,
                    adjustment,
                    feedback,
                    len(inputs) > 1,
                ),
            ),
        )
        run.progress = {
            "phase": "validating_process_order",
            "completed": start_index,
            "total": total_count,
            "items": [{"key": stage.id, "status": "pending"} for stage in stages],
        }
        await db.commit()
        validation = await durable_operation(
            run,
            db,
            storage,
            f"audit-{start_index}-{attempt}",
            partial(
                provider.validate_process_board,
                [(board, mime), *inputs],
                _process_board_validation_prompt(stages, start_index, total_count, len(inputs) > 1),
            ),
            ProcessBoardValidation,
        )
        if validation.approved:
            return await run_in_threadpool(crop_process_board, board, len(stages))
        feedback = "; ".join(validation.failures) or validation.summary
        logger.warning(
            "lesson_process_board_rejected",
            extra={
                "lesson_id": str(lesson.id),
                "run_id": str(run.id),
                "attempt": attempt + 1,
                "failure_count": len(validation.failures),
            },
        )
    run.progress = {
        "phase": "validating_process_order",
        "completed": start_index,
        "total": total_count,
        "items": [
            {
                "key": stage.id,
                "status": "failed" if offset == 0 else "pending",
                **(
                    {"message": feedback or "The process order could not be validated."}
                    if offset == 0
                    else {}
                ),
            }
            for offset, stage in enumerate(stages)
        ],
    }
    await db.commit()
    raise ProcessBoardRejectedError(
        "The generated layer study did not progress cleanly from drawing to darker paint. "
        "The two saved attempts are available for review. Start another version to try again."
    )


SNAPSHOT_FIELDS = (
    "title",
    "subject",
    "artistic_context",
    "difficulty",
    "estimated_duration_minutes",
    "source_mode",
    "scene_prompt",
    "generation_brief",
    "content",
    "revision",
    "schema_version",
    "template",
    "medium",
    "approved_target_asset_id",
    "active_render_set_id",
)


def lesson_snapshot(lesson: PaintingLesson) -> dict[str, Any]:
    return {
        name: str(value) if isinstance(value := getattr(lesson, name), uuid.UUID) else value
        for name in SNAPSHOT_FIELDS
    }


async def process_generation_run(
    run_id: uuid.UUID, settings: Settings, storage: S3ObjectStorage, db: AsyncSession
) -> None:
    claimed = await db.scalar(
        update(LessonGenerationRun)
        .where(LessonGenerationRun.id == run_id, LessonGenerationRun.status == "queued")
        .values(status="running", heartbeat_at=utc_now())
        .returning(LessonGenerationRun.id)
    )
    await db.commit()
    if not claimed:
        return
    run = await db.get(LessonGenerationRun, run_id, populate_existing=True)
    assert run is not None
    token = usage_context.set((db, run))
    try:
        await _process_claimed_run(run_id, settings, storage, db)
    finally:
        usage_context.reset(token)


async def recover_interrupted_runs(db: AsyncSession) -> None:
    # A worker never silently repeats a request whose completion is unknown.
    stale = list(
        await db.scalars(
            select(LessonGenerationRun).where(
                LessonGenerationRun.status == "running",
                (
                    (LessonGenerationRun.heartbeat_at < utc_now() - timedelta(minutes=15))
                    | (
                        (LessonGenerationRun.heartbeat_at.is_(None))
                        & (LessonGenerationRun.started_at < utc_now() - timedelta(minutes=15))
                    )
                ),
            )
        )
    )
    for run in stale:
        unknown = any(
            item.get("status") in {"started", "unknown"}
            for item in (run.checkpoints or {}).values()
        )
        run.status = "failed"
        run.error_code = "UncertainGenerationError" if unknown else "worker_interrupted"
        run.error_message = (
            "Preparation was interrupted. Check AI usage before starting another version."
            if unknown
            else "Preparation was interrupted. Resume to reuse completed work."
        )
        run.recoverable = not unknown
        lesson = await db.get(PaintingLesson, run.lesson_id)
        if lesson:
            lesson.generation_status = "failed"
            lesson.generation_error = {"code": run.error_code, "message": run.error_message}
    await db.commit()


async def _process_claimed_run(
    run_id: uuid.UUID, settings: Settings, storage: S3ObjectStorage, db: AsyncSession
) -> None:
    run = await db.scalar(select(LessonGenerationRun).where(LessonGenerationRun.id == run_id))
    if run is None:
        return
    lesson = await db.scalar(select(PaintingLesson).where(PaintingLesson.id == run.lesson_id))
    if lesson is None:
        return
    saved_lesson = lesson
    snapshot = run.input_snapshot or {"lesson": lesson_snapshot(lesson)}
    values = dict(snapshot["lesson"])
    for field in ("approved_target_asset_id", "active_render_set_id"):
        if values.get(field):
            values[field] = uuid.UUID(values[field])
    lesson = PaintingLesson(id=saved_lesson.id, learner_id=saved_lesson.learner_id, **values)
    if snapshot.get("section_content"):
        lesson.content = snapshot["section_content"]
    settings = settings.model_copy(
        update={
            "lesson_generation_provider": snapshot.get(
                "provider", settings.lesson_generation_provider
            ),
            "openai_lesson_model": snapshot.get("text_model", settings.openai_lesson_model),
            "openai_image_model": snapshot.get("image_model", settings.openai_image_model),
        }
    )
    run.status = "running"
    run.started_at = utc_now()
    lesson.generation_status = "generating"
    await db.commit()
    logger.info(
        "lesson_generation_running",
        extra={
            "run_id": str(run.id),
            "lesson_id": str(lesson.id),
            "scope": run.scope,
            "section_key": run.section_key,
            "provider": run.provider,
            "model": run.model,
            "attempt": run.attempts,
        },
    )
    try:
        assets = list(
            await db.scalars(
                select(LessonAsset)
                .where(
                    LessonAsset.lesson_id == lesson.id,
                )
                .order_by(LessonAsset.created_at, LessonAsset.order_index)
            )
        )
        if snapshot.get("asset_ids") is not None:
            assets = [asset for asset in assets if str(asset.id) in snapshot["asset_ids"]]
        originals = [asset for asset in assets if asset.role == "original_reference"]
        primary = next((asset for asset in originals if asset.is_primary), None)
        brief = _brief(lesson)
        recipe_prompts = (
            recipe_contract(snapshot.get("recipe_version"))
            if brief.sequence_style == "simple_recipe"
            else None
        )
        if run.scope == "target":
            if not image_generation_available(settings):
                if primary is None:
                    raise LessonValidationError("Image generation is not configured.")
                run.result = {"asset_id": str(primary.id), "demo_fallback": True}
                run.progress = {
                    "phase": "target",
                    "completed": 1,
                    "total": 1,
                    "items": [{"key": "target", "status": "unavailable"}],
                }
            else:
                image_provider = OpenAIStudyImageProvider(settings)
                target_prompt = (
                    "Create a finished, attainable transparent-watercolor painting to use as the target "
                    "for a step-by-step beginner lesson. Preserve a clear focal point, paintable shapes, "
                    "paper texture, and intentional hard, soft, and lost edges. "
                    f"Scene: {brief.scene_prompt or lesson.subject or lesson.title}. "
                    f"{_art_direction(brief)} User adjustment: {run.adjustment or 'none'}."
                )
                if brief.sequence_style == "simple_recipe":
                    target_prompt = (
                        f"{recipe_prompts[0] if recipe_prompts else ''} Subject inspiration: "
                        f"{brief.scene_prompt or lesson.subject or lesson.title}. "
                        f"Mood: {brief.custom_mood or brief.mood}. "
                        f"User suggestion (keep the simple two-panel format): {run.adjustment or 'none'}."
                    )
                if brief.source_mode == "prompt":
                    image, mime = await durable_operation(
                        run,
                        db,
                        storage,
                        "target",
                        lambda: image_provider.generate_from_prompt(target_prompt),
                    )
                else:
                    if primary is None:
                        raise LessonValidationError("Primary reference unavailable.")
                    source_bytes = await run_in_threadpool(storage.get, primary.display_object_key)
                    image, mime = await durable_operation(
                        run,
                        db,
                        storage,
                        "target",
                        lambda: image_provider.generate(
                            [(source_bytes, primary.display_content_type)], target_prompt
                        ),
                    )
                outline = None
                if brief.sequence_style == "simple_recipe":
                    validation = await durable_operation(
                        run,
                        db,
                        storage,
                        "recipe-validation",
                        lambda: image_provider.validate_process_board(
                            [(image, mime)], recipe_prompts[1] if recipe_prompts else ""
                        ),
                        ProcessBoardValidation,
                    )
                    if not validation.approved:
                        raise ProcessBoardRejectedError(
                            "The painting and outline did not match clearly enough. Try another preview. "
                            + validation.summary
                        )
                    image, outline = await run_in_threadpool(split_recipe_art, image)
                    mime = "image/png"
                target = await _store_generated_asset(
                    db,
                    storage,
                    lesson,
                    image,
                    mime,
                    "target_reference",
                    "watercolor-target.png",
                    f"Generated watercolor target for {lesson.title}",
                )
                if outline is not None:
                    await _store_generated_asset(
                        db,
                        storage,
                        lesson,
                        outline,
                        "image/png",
                        "tracing_outline",
                        "tracing-outline.png",
                        f"Tracing outline for {lesson.title}",
                        str(target.id),
                    )
                run.result = {"asset_id": str(target.id)}
                run.progress = {
                    "phase": "target",
                    "completed": 1,
                    "total": 1,
                    "items": [{"key": "target", "status": "completed"}],
                }
            run.status = "completed"
            run.completed_at = utc_now()
            lesson.generation_status = "completed"
            lesson.generation_error = None
            await promote_candidate(db, run, lesson, saved_lesson)
            await db.commit()
            return

        source = next(
            (asset for asset in assets if asset.id == lesson.approved_target_asset_id),
            primary,
        )
        if source is None:
            raise LessonValidationError("Approved target image unavailable.")
        primary_bytes = await run_in_threadpool(storage.get, source.display_object_key)
        secondary = [
            (
                await run_in_threadpool(storage.get, asset.display_object_key),
                asset.display_content_type,
            )
            for asset in originals
            if asset.id != source.id and not asset.is_primary
        ]
        request = LessonGenerationRequest(
            title=lesson.title,
            subject=lesson.subject,
            artistic_context=lesson.artistic_context,
            difficulty=lesson.difficulty,
            estimated_duration_minutes=lesson.estimated_duration_minutes,
            primary_image=primary_bytes,
            primary_content_type=source.display_content_type,
            secondary_images=secondary,
            generation_brief=brief,
            recipe_version=snapshot.get("recipe_version"),
        )
        provider = lesson_provider(settings)
        if run.scope == "full":
            run.progress = {
                "phase": "lesson_text",
                "completed": 0,
                "total": brief.stage_count + 1,
                "items": [{"key": "lesson", "status": "running"}],
            }
            await db.commit()
            content = await durable_operation(
                run, db, storage, "text", lambda: provider.generate(request), LessonContent
            )
            inferred_title = getattr(provider, "inferred_title", None)
            inferred_subject = getattr(provider, "inferred_subject", None)
            content.user_notes = (lesson.content or {}).get("user_notes", "")
            if (
                not lesson.content
                and inferred_title
                and (
                    lesson.title == "A fresh watercolor session"
                    or lesson.title.endswith("— watercolor")
                )
            ):
                lesson.title = inferred_title
            if inferred_subject and not lesson.subject:
                lesson.subject = inferred_subject
            result: object = content.model_dump(mode="json")
            lesson.content = result  # type: ignore[assignment]
            exact_final_target = (
                lesson.schema_version == "painting-lesson.v2"
                and lesson.approved_target_asset_id is not None
                and source.id == lesson.approved_target_asset_id
            )
            # Link the approved target to its step only when the complete candidate is promoted.
            run.progress = {
                "phase": "stage_images",
                "completed": 1,
                "total": len(content.stages) + 1,
                "items": [{"key": "lesson", "status": "completed"}],
            }
            await db.commit()
            if brief.sequence_style == "simple_recipe":
                # Both images were made together before approval. No new image request here.
                lesson.active_render_set_id = None
                lesson.generation_brief = {
                    **(lesson.generation_brief or {}),
                    "stage_count": len(content.stages),
                }
                run.progress = {
                    "phase": "review",
                    "completed": 1,
                    "total": 1,
                    "items": [{"key": "recipe", "status": "completed"}],
                }
            elif image_generation_available(settings):
                render_set_id = uuid.uuid4()
                image_provider = OpenAIStudyImageProvider(settings)
                stage_items: list[dict[str, str]] = []
                generated_stages = content.stages[:-1] if exact_final_target else content.stages
                if brief.sequence_style == "layer_study":
                    if not exact_final_target:
                        raise LessonValidationError(
                            "Layer-by-layer studies require an approved finished target."
                        )
                    stage_images = (
                        await _generate_validated_process_board(
                            image_provider,
                            [(primary_bytes, source.display_content_type)],
                            lesson,
                            generated_stages,
                            0,
                            len(content.stages),
                            None,
                            run,
                            db,
                            storage,
                        )
                        if generated_stages
                        else []
                    )
                    run.progress = {
                        "phase": "preparing_stage_views",
                        "completed": 1,
                        "total": len(content.stages) + 1,
                        "items": [
                            {"key": "lesson", "status": "completed"},
                            *[{"key": stage.id, "status": "pending"} for stage in generated_stages],
                        ],
                    }
                    await db.commit()
                    for index, (stage, image) in enumerate(
                        zip(generated_stages, stage_images, strict=True)
                    ):
                        await _store_generated_asset(
                            db,
                            storage,
                            lesson,
                            image,
                            "image/png",
                            "stage_image",
                            f"stage-{index + 1}.png",
                            f"Checkpoint {index + 1} of {lesson.title}: {stage.title}",
                            stage.id,
                            render_set_id,
                        )
                        stage_items.append({"key": stage.id, "status": "completed"})
                    process_sheet = await run_in_threadpool(
                        compose_process_sheet, [*stage_images, primary_bytes]
                    )
                    await _store_generated_asset(
                        db,
                        storage,
                        lesson,
                        process_sheet,
                        "image/png",
                        "process_sheet",
                        "watercolor-process-sheet.png",
                        f"Layer-by-layer watercolor process sheet for {lesson.title}",
                        render_set_id=render_set_id,
                    )
                else:
                    previous: tuple[bytes, str] | None = None
                    for index, stage in enumerate(generated_stages):
                        stage_items.append({"key": stage.id, "status": "running"})
                        run.progress = {
                            "phase": "stage_images",
                            "completed": index + 1,
                            "total": len(content.stages) + 1,
                            "items": [
                                {"key": "lesson", "status": "completed"},
                                *stage_items,
                            ],
                        }
                        await db.commit()
                        try:
                            inputs = [(primary_bytes, source.display_content_type)]
                            if previous:
                                inputs.append(previous)
                            image, mime = await durable_operation(
                                run,
                                db,
                                storage,
                                f"stage-{stage.id}",
                                partial(
                                    image_provider.generate,
                                    inputs,
                                    _stage_image_prompt(
                                        lesson, stage, index, len(content.stages), None
                                    ),
                                ),
                            )
                            await _store_generated_asset(
                                db,
                                storage,
                                lesson,
                                image,
                                mime,
                                "stage_image",
                                f"stage-{index + 1}.png",
                                f"Stage {index + 1} of {lesson.title}: {stage.title}",
                                stage.id,
                                render_set_id,
                            )
                            previous = (image, mime)
                            stage_items[-1]["status"] = "completed"
                        except Exception as image_error:
                            stage_items[-1]["status"] = "failed"
                            stage_items[-1]["message"] = generation_error_details(image_error)[1]
                            for pending in generated_stages[index + 1 :]:
                                stage_items.append({"key": pending.id, "status": "pending"})
                            logger.exception(
                                "lesson_stage_image_generation_failed",
                                extra={"run_id": str(run.id), "stage_id": stage.id},
                            )
                            raise
                if exact_final_target:
                    stage_items.append(
                        {
                            "key": content.stages[-1].id,
                            "status": "completed",
                            "source": "approved_target",
                        }
                    )
                lesson.active_render_set_id = render_set_id
                run.progress = {
                    "phase": "review",
                    "completed": 1 + sum(item["status"] == "completed" for item in stage_items),
                    "total": len(content.stages) + 1,
                    "items": [{"key": "lesson", "status": "completed"}, *stage_items],
                }
            else:
                unavailable = [
                    {"key": stage.id, "status": "unavailable"}
                    for stage in (content.stages[:-1] if exact_final_target else content.stages)
                ]
                if exact_final_target:
                    unavailable.append(
                        {
                            "key": content.stages[-1].id,
                            "status": "completed",
                            "source": "approved_target",
                        }
                    )
                run.progress = {
                    "phase": "review",
                    "completed": 1 + int(exact_final_target),
                    "total": len(content.stages) + 1,
                    "items": [
                        {"key": "lesson", "status": "completed"},
                        *unavailable,
                    ],
                }
        elif run.scope == "stage_images":
            if not image_generation_available(settings):
                raise LessonValidationError("Stage image generation is not configured.")
            if lesson.content is None or run.section_key is None:
                raise LessonValidationError("The lesson stages are unavailable.")
            content = LessonContent.model_validate(lesson.content)
            start_index = next(
                index for index, stage in enumerate(content.stages) if stage.id == run.section_key
            )
            exact_final_target = (
                lesson.schema_version == "painting-lesson.v2"
                and lesson.approved_target_asset_id is not None
                and source.id == lesson.approved_target_asset_id
            )
            generation_end = len(content.stages) - int(exact_final_target)
            render_set_id = uuid.uuid4()
            cascade_previous: tuple[bytes, str] | None = None
            preserved_images: list[bytes] = []
            current_assets = {
                asset.stage_id: asset
                for asset in assets
                if asset.role == "stage_image"
                and asset.render_set_id == lesson.active_render_set_id
                and asset.stage_id
            }
            for index in range(start_index):
                stage = content.stages[index]
                existing = current_assets.get(stage.id)
                if existing is None:
                    raise LessonValidationError("An earlier stage image is missing.")
                copied = await run_in_threadpool(storage.get, existing.display_object_key)
                await _store_generated_asset(
                    db,
                    storage,
                    lesson,
                    copied,
                    existing.display_content_type,
                    "stage_image",
                    f"stage-{index + 1}.png",
                    existing.alt_text,
                    stage.id,
                    render_set_id,
                )
                cascade_previous = (copied, existing.display_content_type)
                preserved_images.append(copied)
            image_provider = OpenAIStudyImageProvider(settings)
            items: list[dict[str, str]] = []
            if brief.sequence_style == "layer_study":
                if not exact_final_target:
                    raise LessonValidationError(
                        "Layer-by-layer studies require an approved finished target."
                    )
                generated_stages = content.stages[start_index:generation_end]
                inputs = [(primary_bytes, source.display_content_type)]
                if cascade_previous:
                    inputs.append(cascade_previous)
                generated_images = await _generate_validated_process_board(
                    image_provider,
                    inputs,
                    lesson,
                    generated_stages,
                    start_index,
                    len(content.stages),
                    run.adjustment,
                    run,
                    db,
                    storage,
                )
                run.progress = {
                    "phase": "preparing_stage_views",
                    "completed": start_index,
                    "total": len(content.stages) - start_index,
                    "items": [{"key": stage.id, "status": "pending"} for stage in generated_stages],
                }
                await db.commit()
                for index, (stage, image) in enumerate(
                    zip(generated_stages, generated_images, strict=True), start=start_index
                ):
                    await _store_generated_asset(
                        db,
                        storage,
                        lesson,
                        image,
                        "image/png",
                        "stage_image",
                        f"stage-{index + 1}.png",
                        f"Checkpoint {index + 1} of {lesson.title}: {stage.title}",
                        stage.id,
                        render_set_id,
                    )
                    items.append({"key": stage.id, "status": "completed"})
                process_sheet = await run_in_threadpool(
                    compose_process_sheet,
                    [*preserved_images, *generated_images, primary_bytes],
                )
                await _store_generated_asset(
                    db,
                    storage,
                    lesson,
                    process_sheet,
                    "image/png",
                    "process_sheet",
                    "watercolor-process-sheet.png",
                    f"Layer-by-layer watercolor process sheet for {lesson.title}",
                    render_set_id=render_set_id,
                )
            else:
                for index in range(start_index, generation_end):
                    stage = content.stages[index]
                    items.append({"key": stage.id, "status": "running"})
                    run.progress = {
                        "phase": "stage_images",
                        "completed": sum(item["status"] == "completed" for item in items),
                        "total": len(content.stages) - start_index,
                        "items": items,
                    }
                    await db.commit()
                    inputs = [(primary_bytes, source.display_content_type)]
                    if cascade_previous:
                        inputs.append(cascade_previous)
                    try:
                        image, mime = await durable_operation(
                            run,
                            db,
                            storage,
                            f"stage-{stage.id}",
                            partial(
                                image_provider.generate,
                                inputs,
                                _stage_image_prompt(
                                    lesson, stage, index, len(content.stages), run.adjustment
                                ),
                            ),
                        )
                    except Exception as image_error:
                        items[-1]["status"] = "failed"
                        items[-1]["message"] = generation_error_details(image_error)[1]
                        items.extend(
                            {"key": pending.id, "status": "pending"}
                            for pending in content.stages[index + 1 : generation_end]
                        )
                        if exact_final_target:
                            items.append(
                                {
                                    "key": content.stages[-1].id,
                                    "status": "completed",
                                    "source": "approved_target",
                                }
                            )
                        run.progress = {
                            "phase": "stage_images",
                            "completed": sum(item["status"] == "completed" for item in items),
                            "total": len(content.stages) - start_index,
                            "items": items,
                        }
                        await db.commit()
                        raise
                    await _store_generated_asset(
                        db,
                        storage,
                        lesson,
                        image,
                        mime,
                        "stage_image",
                        f"stage-{index + 1}.png",
                        f"Stage {index + 1} of {lesson.title}: {stage.title}",
                        stage.id,
                        render_set_id,
                    )
                    cascade_previous = (image, mime)
                    items[-1]["status"] = "completed"
                    run.progress = {
                        "phase": "stage_images",
                        "completed": len(items),
                        "total": len(content.stages) - start_index,
                        "items": items,
                    }
                    await db.commit()
            if exact_final_target:
                items.append(
                    {
                        "key": content.stages[-1].id,
                        "status": "completed",
                        "source": "approved_target",
                    }
                )
            lesson.active_render_set_id = render_set_id
            result = {"render_set_id": str(render_set_id)}
            run.progress = {
                "phase": "review",
                "completed": len(items),
                "total": len(items),
                "items": items,
            }
        else:
            if lesson.content is None or run.section_key is None:
                raise LessonValidationError("The lesson section is unavailable.")
            result = await durable_operation(
                run,
                db,
                storage,
                "section",
                lambda: provider.regenerate(
                    request, LessonContent.model_validate(lesson.content), run.section_key or ""
                ),
            )
        run.result = result  # type: ignore[assignment]
        run.status = "completed"
        run.completed_at = utc_now()
        lesson.generation_status = "completed"
        lesson.generation_error = None
        await promote_candidate(db, run, lesson, saved_lesson)
        logger.info(
            "lesson_generation_completed",
            extra={
                "run_id": str(run.id),
                "lesson_id": str(lesson.id),
                "scope": run.scope,
                "section_key": run.section_key,
                "attempt": run.attempts,
            },
        )
    except Exception as error:
        run.status = "failed"
        run.error_code, run.error_message = generation_error_details(error)
        run.recoverable = run.error_code not in {
            "UncertainGenerationError",
            "provider_uncertain",
            "ProcessBoardRejectedError",
        }
        run.completed_at = utc_now()
        saved_lesson.generation_status = "failed"
        saved_lesson.generation_error = {"code": run.error_code, "message": run.error_message}
        lesson.generation_status = "failed"
        lesson.generation_error = {"code": run.error_code, "message": run.error_message}
        logger.exception(
            "lesson_generation_failed",
            extra={
                "run_id": str(run.id),
                "lesson_id": str(lesson.id),
                "scope": run.scope,
                "section_key": run.section_key,
                "attempt": run.attempts,
                "error_code": run.error_code,
            },
        )
    await db.commit()


async def promote_candidate(
    db: AsyncSession, run: LessonGenerationRun, candidate: PaintingLesson, saved: PaintingLesson
) -> None:
    values: dict[str, Any] = {"generation_status": "completed", "generation_error": None}
    if run.scope in {"full", "stage_images"}:
        values.update(
            content=candidate.content,
            generation_brief=candidate.generation_brief,
            active_render_set_id=candidate.active_render_set_id,
            title=candidate.title,
            subject=candidate.subject,
            revision=candidate.revision + 1,
        )
    promoted = await db.scalar(
        update(PaintingLesson)
        .where(PaintingLesson.id == saved.id, PaintingLesson.revision == candidate.revision)
        .values(**values)
        .returning(PaintingLesson.id)
    )
    if not promoted:
        raise LessonConflictError(
            "Your session changed while this version was being prepared. The saved version is safe."
        )
    if (
        run.scope in {"full", "stage_images"}
        and candidate.approved_target_asset_id
        and candidate.content
    ):
        await db.execute(
            update(LessonAsset)
            .where(LessonAsset.id == candidate.approved_target_asset_id)
            .values(
                stage_id=candidate.content["stages"][-1]["id"],
                render_set_id=candidate.active_render_set_id,
            )
        )
    await db.refresh(saved)
