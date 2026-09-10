import json
import uuid
from io import BytesIO
from typing import Any

import pytest
from fastapi import UploadFile
from httpx import AsyncClient
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.datastructures import Headers

import app.lesson_service as lesson_service_module
from app.config import Settings
from app.dependencies import get_lesson_service, get_storage
from app.lesson_generation import demo_lesson
from app.lesson_response_schemas import ProcessBoardValidation
from app.lesson_schemas import (
    LessonContent,
    LessonCreate,
    LessonGenerationBrief,
    LessonSave,
    layer_study_phases,
)
from app.lesson_service import (
    LessonService,
    compose_process_sheet,
    crop_process_board,
    process_generation_run,
)
from app.main import app


class MemoryStorage:
    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}

    def put(self, key: str, value: bytes, content_type: str) -> None:
        self.objects[key] = (value, content_type)

    def get(self, key: str) -> bytes:
        return self.objects[key][0]

    def delete(self, key: str) -> None:
        self.objects.pop(key, None)


class MemoryQueue:
    def __init__(self) -> None:
        self.messages: list[tuple[str, str]] = []

    async def lpush(self, queue: str, message: str) -> int:
        self.messages.append((queue, message))
        return len(self.messages)


class FailingQueue:
    async def lpush(self, queue: str, message: str) -> int:
        raise ConnectionError("redis unavailable")


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["prompt", "upload"])
async def test_simple_recipe_generates_one_pair_and_reuses_it(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    mode: str,
) -> None:
    from app.lesson_generation import DemoLessonProvider
    from app.lesson_service import LessonValidationError
    from app.models import LessonGenerationRun

    settings = Settings(lesson_generation_provider="auto", openai_api_key="test-only")
    storage = MemoryStorage()
    service = LessonService(settings, storage, db, MemoryQueue())  # type: ignore[arg-type]
    brief = LessonGenerationBrief.model_validate(
        {
            "source_mode": mode,
            "scene_prompt": "A little pear" if mode == "prompt" else None,
            "sequence_style": "simple_recipe",
        }
    )
    draft = await service.create(LessonCreate(generation_brief=brief))
    if mode == "upload":
        await service.upload_references(
            draft.id,
            [
                UploadFile(
                    filename="pear.png",
                    file=BytesIO(image_bytes()),
                    headers=Headers({"content-type": "image/png"}),
                )
            ],
        )
    calls: list[str] = []
    validation_approved = True

    class Images:
        def __init__(self, _settings: Settings) -> None:
            pass

        async def generate_from_prompt(self, prompt: str) -> tuple[bytes, str]:
            calls.append("image")
            assert "TWO equal panels" in prompt
            return image_bytes(size=(1536, 1024)), "image/png"

        async def generate(self, images: Any, prompt: str) -> tuple[bytes, str]:
            return await self.generate_from_prompt(prompt)

        async def validate_process_board(self, images: Any, prompt: str) -> ProcessBoardValidation:
            calls.append("validation")
            return ProcessBoardValidation(
                approved=validation_approved, summary="Pair checked.", failures=[]
            )

    monkeypatch.setattr(lesson_service_module, "OpenAIStudyImageProvider", Images)
    monkeypatch.setattr(lesson_service_module, "lesson_provider", lambda _: DemoLessonProvider())
    run = await service.create_target_generation(draft.id, idempotency_key="same-preview")
    assert (
        await service.create_target_generation(draft.id, idempotency_key="same-preview")
    ).id == run.id
    stored = await db.get(LessonGenerationRun, run.id)
    assert stored and stored.input_snapshot
    assert stored.input_snapshot["recipe_version"] == "simple-recipe.v1"
    monkeypatch.setattr(lesson_service_module, "RECIPE_VERSION", "future-version")
    await process_generation_run(run.id, settings, storage, db)  # type: ignore[arg-type]
    monkeypatch.setattr(lesson_service_module, "RECIPE_VERSION", "simple-recipe.v1")
    await process_generation_run(run.id, settings, storage, db)  # type: ignore[arg-type]
    result = (await service.get_run(run.id)).result
    assert isinstance(result, dict), (await service.get_run(run.id)).error_message
    target_id = uuid.UUID(result["asset_id"])
    await service.approve_target(draft.id, target_id)
    full = await service.create_generation(draft.id, False)
    await process_generation_run(full.id, settings, storage, db)  # type: ignore[arg-type]
    lesson = await service.get(draft.id)
    assert lesson.generation_status == "completed", lesson.generation_error
    assert lesson.content and lesson.content.recipe
    assert lesson.content.recipe.version == "simple-recipe.v1"
    assert lesson.content and len(lesson.content.stages) == 3
    assert calls == ["image", "validation"]
    outline = next(asset for asset in lesson.assets if asset.role == "tracing_outline")
    assert outline.stage_id == str(target_id) and outline.is_current
    assert (outline.width, outline.height) == (768, 1024)
    assert not any(asset.role in {"stage_image", "process_sheet"} for asset in lesson.assets)
    assert all(stage.approach_steps == [] for stage in lesson.content.stages)
    save_request = LessonSave.model_validate(
        {
            **lesson.model_dump(),
            "expected_revision": lesson.revision,
        }
    )
    invalid = save_request.model_copy(deep=True)
    invalid.content.stages[0].checkpoint_action = " "
    with pytest.raises(LessonValidationError, match="one painting action"):
        await service.save(draft.id, invalid)
    lesson = await service.save(draft.id, save_request)
    assert lesson.saved_at is not None
    assert lesson.content and all(stage.approach_steps == [] for stage in lesson.content.stages)
    assert calls == ["image", "validation"]
    with pytest.raises(LessonValidationError, match="no intermediate"):
        await service.create_stage_generation(draft.id, lesson.content.stages[0].id, None)
    validation_approved = False
    replacement = await service.create_target_generation(draft.id)
    await process_generation_run(replacement.id, settings, storage, db)  # type: ignore[arg-type]
    rejected = await service.get_run(replacement.id)
    assert rejected.status == "failed" and rejected.recoverable is False
    reopened = await service.get(draft.id)
    assert reopened.approved_target_asset_id == target_id
    assert reopened.content == lesson.content
    assert len(reopened.assets) == len(lesson.assets)
    assert calls == ["image", "validation", "image", "validation"]


def image_bytes(format_name: str = "PNG", size: tuple[int, int] = (180, 120)) -> bytes:
    image = Image.new("RGB", size, "#e4c46d")
    output = BytesIO()
    image.save(output, format=format_name)
    return output.getvalue()


def process_board_bytes() -> bytes:
    image = Image.new("RGB", (1536, 1024))
    for box, color in zip(
        [
            (0, 0, 768, 512),
            (768, 0, 1536, 512),
            (0, 512, 768, 1024),
            (768, 512, 1536, 1024),
        ],
        ["#f8f4e9", "#ead79f", "#9b856f", "#3f3745"],
        strict=True,
    ):
        image.paste(color, box)
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


@pytest.mark.asyncio
async def test_draft_references_generation_save_conflict_and_private_stream(
    client: AsyncClient, db: AsyncSession
) -> None:
    settings = Settings(lesson_generation_provider="demo", openai_api_key=None)
    storage = MemoryStorage()
    queue = MemoryQueue()
    service = LessonService(settings, storage, db, queue)  # type: ignore[arg-type]
    app.dependency_overrides[get_lesson_service] = lambda: service
    app.dependency_overrides[get_storage] = lambda: storage

    created = await client.post(
        "/api/v1/painting-lessons",
        json={"title": "Orchard light", "subject": "Pear tree", "difficulty": "beginner"},
    )
    assert created.status_code == 201
    assert created.json()["schema_version"] == "painting-lesson.v2"
    assert created.json()["sequence_style_configured"] is True
    lesson_id = created.json()["id"]
    assert (await client.get("/api/v1/painting-lessons")).json() == []

    uploaded = await client.post(
        f"/api/v1/painting-lessons/{lesson_id}/references",
        files=[
            ("images", ("first.webp", image_bytes("WEBP"), "image/webp")),
            ("images", ("second.png", image_bytes(), "image/png")),
        ],
    )
    assert uploaded.status_code == 200
    references = uploaded.json()["assets"]
    assert references[0]["is_primary"] is True
    assert references[0]["display_content_type"] == "image/webp"
    assert any(value[1] == "image/webp" for value in storage.objects.values())

    switched = await client.patch(
        f"/api/v1/painting-lessons/{lesson_id}/references/{references[1]['id']}/primary"
    )
    assert [asset["is_primary"] for asset in switched.json()["assets"]] == [False, True]

    generated = await client.post(
        f"/api/v1/painting-lessons/{lesson_id}/generations",
        json={"include_study_image": False},
    )
    assert generated.status_code == 202
    run_id = generated.json()["id"]
    assert json.loads(queue.messages[-1][1]) == {"run_id": run_id}
    await process_generation_run(uuid.UUID(generated.json()["id"]), settings, storage, db)  # type: ignore[arg-type]

    reopened = await client.get(f"/api/v1/painting-lessons/{lesson_id}")
    assert reopened.json()["generation_status"] == "completed"
    assert reopened.json()["is_demo"] is True
    assert "did not visually analyze" not in reopened.json()["content"]["overview"]
    assert "not a visual reading" in reopened.json()["content"]["overview"]
    content = LessonContent.model_validate(reopened.json()["content"])

    save_payload: dict[str, Any] = {
        "expected_revision": reopened.json()["revision"],
        "title": "Orchard light, edited",
        "subject": "Pear tree",
        "artistic_context": None,
        "difficulty": "beginner",
        "estimated_duration_minutes": 30,
        "content": content.model_dump(mode="json"),
    }
    saved = await client.put(f"/api/v1/painting-lessons/{lesson_id}", json=save_payload)
    assert saved.status_code == 200
    assert saved.json()["revision"] == reopened.json()["revision"] + 1
    assert [lesson["id"] for lesson in (await client.get("/api/v1/painting-lessons")).json()] == [
        lesson_id
    ]
    conflict = await client.put(f"/api/v1/painting-lessons/{lesson_id}", json=save_payload)
    assert conflict.status_code == 409

    streamed = await client.get(f"/api/v1/lesson-assets/{references[0]['id']}/image")
    assert streamed.status_code == 200
    assert streamed.headers["cache-control"] == "private, max-age=3600"
    assert streamed.headers["x-content-type-options"] == "nosniff"


@pytest.mark.asyncio
async def test_primary_removal_promotes_first_remaining_and_section_is_provisional(
    db: AsyncSession,
) -> None:
    settings = Settings(lesson_generation_provider="demo")
    storage = MemoryStorage()
    queue = MemoryQueue()
    service = LessonService(settings, storage, db, queue)  # type: ignore[arg-type]
    draft = await service.create(LessonCreate(title="Harbor", subject="Boats"))
    draft = await service.upload_references(
        draft.id,
        [
            UploadFile(
                filename="one.png",
                file=BytesIO(image_bytes()),
                headers={"content-type": "image/png"},
            ),
            UploadFile(
                filename="two.png",
                file=BytesIO(image_bytes()),
                headers={"content-type": "image/png"},
            ),
        ],
    )
    await service.remove_reference(draft.id, draft.assets[0].id)
    remaining = await service.get(draft.id)
    assert len(remaining.assets) == 1
    assert remaining.assets[0].is_primary is True

    full = await service.create_generation(draft.id, include_study_image=False)
    await process_generation_run(full.id, settings, storage, db)  # type: ignore[arg-type]
    generated_lesson = await service.get(draft.id)
    original_overview = generated_lesson.content.overview  # type: ignore[union-attr]
    section = await service.create_generation(draft.id, False, "overview")
    await process_generation_run(section.id, settings, storage, db)  # type: ignore[arg-type]
    finished = await service.get_run(section.id)

    assert finished.result
    assert (await service.get(draft.id)).content.overview == original_overview  # type: ignore[union-attr]
    assert (await service.latest_generated(draft.id, "overview")).id == section.id


def test_lesson_schema_rejects_unstable_stage_shape() -> None:
    content = LessonContent.model_validate(
        __import__("app.lesson_generation", fromlist=["demo_lesson"])
        .demo_lesson("Garden", "Garden", 30)
        .model_dump()
    )
    invalid = content.model_dump()
    invalid["stages"][0]["id"] = ""
    with pytest.raises(ValueError):
        LessonContent.model_validate(invalid)


def test_layer_study_brief_is_backward_compatible_and_accepts_photos() -> None:
    assert LessonGenerationBrief().sequence_style == "illustrative"
    brief = LessonGenerationBrief(
        source_mode="prompt",
        scene_prompt="A single pear",
        sequence_style="layer_study",
    )
    assert brief.sequence_style == "layer_study"
    assert (
        LessonGenerationBrief(source_mode="upload", sequence_style="layer_study").sequence_style
        == "layer_study"
    )
    assert LessonCreate().generation_brief.sequence_style == "layer_study"


def test_process_board_crops_in_reading_order_and_composes_all_checkpoints() -> None:
    crops = crop_process_board(process_board_bytes(), 4)

    assert len(crops) == 4
    with Image.open(BytesIO(crops[0])) as first:
        assert first.size == (768, 512)
        assert first.getpixel((10, 10)) == (248, 244, 233)
    with Image.open(BytesIO(crops[-1])) as last:
        assert last.getpixel((10, 10)) == (63, 55, 69)

    sheet = compose_process_sheet([*crops, image_bytes(size=(1536, 1024))])
    with Image.open(BytesIO(sheet)) as composed:
        assert composed.size == (1590, 1608)


@pytest.mark.asyncio
async def test_provider_failure_is_recoverable_and_retry_requeues(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = Settings(lesson_generation_provider="demo")
    storage = MemoryStorage()
    queue = MemoryQueue()
    service = LessonService(settings, storage, db, queue)  # type: ignore[arg-type]
    draft = await service.create(LessonCreate(title="Storm study"))
    await service.upload_references(
        draft.id,
        [
            UploadFile(
                filename="storm.png",
                file=BytesIO(image_bytes()),
                headers={"content-type": "image/png"},
            )
        ],
    )

    class FailingProvider:
        name = "fake"
        model = "fake-v1"
        is_demo = False

        async def generate(self, request: Any) -> LessonContent:
            raise RuntimeError("Provider rate limit; retry shortly.")

        async def regenerate(
            self, request: Any, content: LessonContent, section_key: str
        ) -> object:
            raise RuntimeError("Provider rate limit; retry shortly.")

    monkeypatch.setattr(
        lesson_service_module, "lesson_provider", lambda _settings: FailingProvider()
    )
    run = await service.create_generation(draft.id, False)
    await process_generation_run(run.id, settings, storage, db)  # type: ignore[arg-type]

    failed = await service.get_run(run.id)
    assert failed.status == "failed"
    assert failed.error_message == "Provider rate limit; retry shortly."
    retried = await service.retry(run.id)
    assert retried.status == "queued"
    assert retried.attempts == 2
    assert json.loads(queue.messages[-1][1]) == {"run_id": str(run.id)}


@pytest.mark.asyncio
@pytest.mark.parametrize("include_study", [False, True])
async def test_stage_images_are_generated_for_each_requested_stage(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    include_study: bool,
) -> None:
    settings = Settings(lesson_generation_provider="auto", openai_api_key="server-only")
    storage = MemoryStorage()
    queue = MemoryQueue()
    service = LessonService(settings, storage, db, queue)  # type: ignore[arg-type]
    draft = await service.create(
        LessonCreate(
            title="Cloud study",
            generation_brief=LessonGenerationBrief(sequence_style="illustrative"),
        )
    )
    await service.upload_references(
        draft.id,
        [
            UploadFile(
                filename="cloud.webp",
                file=BytesIO(image_bytes("WEBP")),
                headers={"content-type": "image/webp"},
            )
        ],
    )

    class FakeTextProvider:
        name = "openai"
        model = "text-model"
        is_demo = False

        async def generate(self, request: Any) -> LessonContent:
            return demo_lesson(
                request.subject,
                request.title,
                request.estimated_duration_minutes,
                request.generation_brief.stage_count,
            )

        async def regenerate(
            self, request: Any, content: LessonContent, section_key: str
        ) -> object:
            return content.overview

    image_calls: list[tuple[list[str], str]] = []

    class FakeStudyProvider:
        def __init__(self, _settings: Settings) -> None:
            pass

        async def generate(self, images: list[tuple[bytes, str]], prompt: str) -> tuple[bytes, str]:
            image_calls.append(([mime for _, mime in images], prompt))
            return image_bytes(), "image/png"

        async def generate_from_prompt(self, prompt: str) -> tuple[bytes, str]:
            return image_bytes(), "image/png"

    monkeypatch.setattr(
        lesson_service_module, "lesson_provider", lambda _settings: FakeTextProvider()
    )
    monkeypatch.setattr(lesson_service_module, "OpenAIStudyImageProvider", FakeStudyProvider)
    run = await service.create_generation(draft.id, include_study)
    await process_generation_run(run.id, settings, storage, db)  # type: ignore[arg-type]

    assert (await service.get_run(run.id)).status == "completed"
    assert len(image_calls) == 3
    assert image_calls[0][0] == ["image/webp"]
    assert image_calls[1][0] == ["image/webp", "image/png"]
    assert (
        len(
            [asset for asset in (await service.get(draft.id)).assets if asset.role == "stage_image"]
        )
        == 3
    )


@pytest.mark.asyncio
async def test_image_failure_preserves_text_checkpoint_without_publishing_partial_session(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = Settings(lesson_generation_provider="auto", openai_api_key="server-only")
    storage = MemoryStorage()
    service = LessonService(settings, storage, db, MemoryQueue())  # type: ignore[arg-type]
    draft = await service.create(
        LessonCreate(
            title="Cloud study",
            generation_brief=LessonGenerationBrief(sequence_style="illustrative"),
        )
    )
    await service.upload_references(
        draft.id,
        [
            UploadFile(
                filename="cloud.webp",
                file=BytesIO(image_bytes("WEBP")),
                headers={"content-type": "image/webp"},
            )
        ],
    )

    class FakeTextProvider:
        name = "openai"
        model = "text-model"
        is_demo = False

        async def generate(self, request: Any) -> LessonContent:
            return demo_lesson(
                request.subject,
                request.title,
                request.estimated_duration_minutes,
                request.generation_brief.stage_count,
            )

        async def regenerate(
            self, request: Any, content: LessonContent, section_key: str
        ) -> object:
            return content.overview

    class FailingStudyProvider:
        def __init__(self, _settings: Settings) -> None:
            pass

        async def generate(self, images: list[tuple[bytes, str]], prompt: str) -> tuple[bytes, str]:
            raise RuntimeError("Study image unavailable")

        async def generate_from_prompt(self, prompt: str) -> tuple[bytes, str]:
            raise RuntimeError("Study image unavailable")

    monkeypatch.setattr(
        lesson_service_module, "lesson_provider", lambda _settings: FakeTextProvider()
    )
    monkeypatch.setattr(lesson_service_module, "OpenAIStudyImageProvider", FailingStudyProvider)
    run = await service.create_generation(draft.id, include_study_image=True)

    await process_generation_run(run.id, settings, storage, db)  # type: ignore[arg-type]

    finished = await service.get_run(run.id)
    lesson = await service.get(draft.id)
    assert finished.status == "failed"
    assert lesson.content is None
    assert lesson.generation_status == "failed"
    assert any(key.endswith("text.json") for key in storage.objects)
    assert not any(asset.role == "stage_image" for asset in lesson.assets)
    assert finished.progress is not None
    assert finished.progress["items"][1]["status"] == "failed"
    assert all(item["status"] == "pending" for item in finished.progress["items"][2:])


@pytest.mark.asyncio
async def test_queue_failure_preserves_draft_and_returns_retryable_run(db: AsyncSession) -> None:
    settings = Settings(lesson_generation_provider="demo")
    storage = MemoryStorage()
    service = LessonService(settings, storage, db, FailingQueue())  # type: ignore[arg-type]
    draft = await service.create(LessonCreate(title="Safe draft"))
    await service.upload_references(
        draft.id,
        [
            UploadFile(
                filename="safe.png",
                file=BytesIO(image_bytes()),
                headers={"content-type": "image/png"},
            )
        ],
    )

    failed = await service.create_generation(draft.id, False)

    assert failed.status == "failed"
    assert failed.recoverable is True
    assert failed.error_code == "queue_unavailable"
    assert (await service.get(draft.id)).assets
    replacement_queue = MemoryQueue()
    service.queue = replacement_queue  # type: ignore[assignment]
    retried = await service.retry(failed.id)
    assert retried.status == "queued"
    assert replacement_queue.messages


@pytest.mark.asyncio
@pytest.mark.parametrize("stage_count", [1, 3, 5])
async def test_demo_generation_returns_exact_requested_stage_count(
    db: AsyncSession, stage_count: int
) -> None:
    settings = Settings(lesson_generation_provider="demo")
    storage = MemoryStorage()
    service = LessonService(settings, storage, db, MemoryQueue())  # type: ignore[arg-type]
    draft = await service.create(
        LessonCreate(
            title=f"{stage_count}-stage study",
            generation_brief=LessonGenerationBrief(
                stage_count=stage_count, sequence_style="illustrative"
            ),
        )
    )
    await service.upload_references(
        draft.id,
        [
            UploadFile(
                filename="study.png",
                file=BytesIO(image_bytes()),
                headers={"content-type": "image/png"},
            )
        ],
    )
    run = await service.create_generation(draft.id, False)

    await process_generation_run(run.id, settings, storage, db)  # type: ignore[arg-type]

    generated = await service.get(draft.id)
    assert generated.content is not None
    assert len(generated.content.stages) == stage_count
    assert generated.generation_brief.stage_count == stage_count


@pytest.mark.asyncio
@pytest.mark.parametrize("stage_count", [1, 3, 5])
async def test_v2_reuses_approved_target_as_exact_final_checkpoint(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    stage_count: int,
) -> None:
    settings = Settings(lesson_generation_provider="auto", openai_api_key="server-only")
    storage = MemoryStorage()
    service = LessonService(settings, storage, db, MemoryQueue())  # type: ignore[arg-type]
    draft = await service.create(
        LessonCreate(
            title="Sunflower study",
            generation_brief=LessonGenerationBrief(
                stage_count=stage_count, sequence_style="illustrative"
            ),
        )
    )
    await service.upload_references(
        draft.id,
        [
            UploadFile(
                filename="sunflower.png",
                file=BytesIO(image_bytes()),
                headers={"content-type": "image/png"},
            )
        ],
    )

    class FakeTextProvider:
        name = "openai"
        model = "text-model"
        is_demo = False

        async def generate(self, request: Any) -> LessonContent:
            return demo_lesson(
                request.subject,
                request.title,
                request.estimated_duration_minutes,
                request.generation_brief.stage_count,
            )

        async def regenerate(
            self, request: Any, content: LessonContent, section_key: str
        ) -> object:
            return content.overview

    image_calls: list[list[tuple[bytes, str]]] = []
    target_bytes = image_bytes(size=(240, 160))

    class FakeImages:
        def __init__(self, _settings: Settings) -> None:
            pass

        async def generate(self, images: list[tuple[bytes, str]], prompt: str) -> tuple[bytes, str]:
            image_calls.append(images)
            return target_bytes, "image/png"

        async def generate_from_prompt(self, prompt: str) -> tuple[bytes, str]:
            return target_bytes, "image/png"

    monkeypatch.setattr(
        lesson_service_module, "lesson_provider", lambda _settings: FakeTextProvider()
    )
    monkeypatch.setattr(lesson_service_module, "OpenAIStudyImageProvider", FakeImages)

    target_run = await service.create_target_generation(draft.id)
    await process_generation_run(target_run.id, settings, storage, db)  # type: ignore[arg-type]
    target_result = (await service.get_run(target_run.id)).result
    assert target_result is not None
    target_id = uuid.UUID(target_result["asset_id"])
    await service.approve_target(draft.id, target_id)
    image_calls.clear()

    lesson_run = await service.create_generation(draft.id, False)
    await process_generation_run(lesson_run.id, settings, storage, db)  # type: ignore[arg-type]

    generated = await service.get(draft.id)
    assert generated.content is not None
    assert len(image_calls) == stage_count - 1
    assert (
        len([asset for asset in generated.assets if asset.role == "stage_image"]) == stage_count - 1
    )
    final_stage = generated.content.stages[-1]
    final_asset = next(asset for asset in generated.assets if asset.id == target_id)
    assert final_asset.role == "target_reference"
    assert final_asset.stage_id == final_stage.id
    assert storage.get(f"lessons/{draft.id}/{target_id}/target_reference.png") == target_bytes
    progress = (await service.get_run(lesson_run.id)).progress
    assert progress is not None
    assert progress["items"][-1] == {
        "key": final_stage.id,
        "status": "completed",
        "source": "approved_target",
    }

    with pytest.raises(ValueError, match="approved target"):
        await service.create_stage_generation(draft.id, final_stage.id, "More contrast")


@pytest.mark.asyncio
@pytest.mark.parametrize("stage_count", [1, 3, 5])
async def test_layer_study_uses_one_validated_board_and_builds_process_sheet(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    stage_count: int,
) -> None:
    settings = Settings(lesson_generation_provider="auto", openai_api_key="server-only")
    storage = MemoryStorage()
    service = LessonService(settings, storage, db, MemoryQueue())  # type: ignore[arg-type]
    brief = LessonGenerationBrief(
        source_mode="prompt",
        scene_prompt="An astronaut watching a luminous burst",
        sequence_style="layer_study",
        stage_count=stage_count,
    )
    draft = await service.create(LessonCreate(generation_brief=brief))

    class FakeTextProvider:
        name = "openai"
        model = "text-model"
        is_demo = False

        async def generate(self, request: Any) -> LessonContent:
            content = demo_lesson(
                request.subject,
                request.title,
                request.estimated_duration_minutes,
                request.generation_brief.stage_count,
            )
            for stage, phase in zip(content.stages, layer_study_phases(stage_count), strict=True):
                stage.process_phase = phase
            return content

        async def regenerate(
            self, request: Any, content: LessonContent, section_key: str
        ) -> object:
            return content.overview

    target_bytes = image_bytes(size=(1536, 1024))
    board_calls: list[tuple[list[tuple[bytes, str]], str]] = []
    validations: list[tuple[list[tuple[bytes, str]], str]] = []

    class FakeImages:
        def __init__(self, _settings: Settings) -> None:
            pass

        async def generate(self, images: list[tuple[bytes, str]], prompt: str) -> tuple[bytes, str]:
            board_calls.append((images, prompt))
            return process_board_bytes(), "image/png"

        async def generate_from_prompt(self, prompt: str) -> tuple[bytes, str]:
            return target_bytes, "image/png"

        async def validate_process_board(
            self, images: list[tuple[bytes, str]], prompt: str
        ) -> ProcessBoardValidation:
            validations.append((images, prompt))
            return ProcessBoardValidation(
                approved=True,
                summary="The drawing and washes advance in order.",
                failures=[],
            )

    monkeypatch.setattr(
        lesson_service_module, "lesson_provider", lambda _settings: FakeTextProvider()
    )
    monkeypatch.setattr(lesson_service_module, "OpenAIStudyImageProvider", FakeImages)

    target_run = await service.create_target_generation(draft.id)
    await process_generation_run(target_run.id, settings, storage, db)  # type: ignore[arg-type]
    target_result = (await service.get_run(target_run.id)).result
    assert isinstance(target_result, dict)
    target_id = uuid.UUID(target_result["asset_id"])
    await service.approve_target(draft.id, target_id)

    full_run = await service.create_generation(draft.id, False)
    await process_generation_run(full_run.id, settings, storage, db)  # type: ignore[arg-type]

    lesson = await service.get(draft.id)
    assert lesson.content is not None
    assert [stage.process_phase for stage in lesson.content.stages] == layer_study_phases(
        stage_count
    )
    assert len(board_calls) == int(stage_count > 1)
    assert len(validations) == int(stage_count > 1)
    assert len([asset for asset in lesson.assets if asset.role == "stage_image"]) == max(
        0, stage_count - 1
    )
    process_sheet = next(asset for asset in lesson.assets if asset.role == "process_sheet")
    assert process_sheet.is_current is True
    final_stage = lesson.content.stages[-1]
    final_target = next(asset for asset in lesson.assets if asset.id == target_id)
    assert final_target.stage_id == final_stage.id
    assert storage.get(f"lessons/{draft.id}/{target_id}/target_reference.png") == target_bytes
    if stage_count > 1:
        assert "2-by-2 process board" in board_calls[0][1] or stage_count == 2
        assert "Reject swapped panels" in validations[0][1]


@pytest.mark.asyncio
async def test_rejected_layer_study_never_promotes_candidate_assets(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = Settings(lesson_generation_provider="auto", openai_api_key="server-only")
    storage = MemoryStorage()
    service = LessonService(settings, storage, db, MemoryQueue())  # type: ignore[arg-type]
    draft = await service.create(
        LessonCreate(
            generation_brief=LessonGenerationBrief(
                source_mode="prompt",
                scene_prompt="A single tree",
                sequence_style="layer_study",
                stage_count=3,
            )
        )
    )

    class FakeTextProvider:
        name = "openai"
        model = "text-model"
        is_demo = False

        async def generate(self, request: Any) -> LessonContent:
            content = demo_lesson("Tree", "Tree study", 30, 3)
            for stage, phase in zip(content.stages, layer_study_phases(3), strict=True):
                stage.process_phase = phase
            return content

        async def regenerate(
            self, request: Any, content: LessonContent, section_key: str
        ) -> object:
            return content.overview

    image_generations = 0

    class RejectingImages:
        def __init__(self, _settings: Settings) -> None:
            pass

        async def generate(self, images: list[tuple[bytes, str]], prompt: str) -> tuple[bytes, str]:
            nonlocal image_generations
            image_generations += 1
            return process_board_bytes(), "image/png"

        async def generate_from_prompt(self, prompt: str) -> tuple[bytes, str]:
            return image_bytes(size=(1536, 1024)), "image/png"

        async def validate_process_board(
            self, images: list[tuple[bytes, str]], prompt: str
        ) -> ProcessBoardValidation:
            return ProcessBoardValidation(
                approved=False,
                summary="The first two panels are reversed.",
                failures=["Panel one is more finished than panel two."],
            )

    monkeypatch.setattr(
        lesson_service_module, "lesson_provider", lambda _settings: FakeTextProvider()
    )
    monkeypatch.setattr(lesson_service_module, "OpenAIStudyImageProvider", RejectingImages)
    target_run = await service.create_target_generation(draft.id)
    await process_generation_run(target_run.id, settings, storage, db)  # type: ignore[arg-type]
    result = (await service.get_run(target_run.id)).result
    assert isinstance(result, dict)
    await service.approve_target(draft.id, uuid.UUID(result["asset_id"]))

    full_run = await service.create_generation(draft.id, False)
    await process_generation_run(full_run.id, settings, storage, db)  # type: ignore[arg-type]

    failed = await service.get_run(full_run.id)
    lesson = await service.get(draft.id)
    assert failed.status == "failed"
    assert failed.progress is not None
    assert [item["status"] for item in failed.progress["items"]] == [
        "failed",
        "pending",
    ]
    assert image_generations == 2
    assert lesson.content is None
    assert any(key.endswith("text.json") for key in storage.objects)
    assert lesson.active_render_set_id is None
    assert not any(asset.role in {"stage_image", "process_sheet"} for asset in lesson.assets)


@pytest.mark.asyncio
async def test_persisted_lesson_can_still_read_eight_legacy_stages(
    db: AsyncSession,
) -> None:
    content = demo_lesson("Harbor", "Harbor study", 30, 5)
    content.stages.extend(
        [
            content.stages[-1].model_copy(update={"id": "legacy-stage-6"}),
            content.stages[-1].model_copy(update={"id": "legacy-stage-7"}),
            content.stages[-1].model_copy(update={"id": "legacy-stage-8"}),
        ]
    )

    restored = LessonContent.model_validate(content.model_dump(mode="json"))
    service = LessonService(
        Settings(lesson_generation_provider="demo", openai_api_key=None),
        MemoryStorage(),
        db,
        MemoryQueue(),  # type: ignore[arg-type]
    )
    created = await service.create(LessonCreate(title="Legacy harbor"))
    model = await service._local_lesson(created.id)
    model.schema_version = "painting-lesson.v1"
    model.generation_brief = {}
    model.content = restored.model_dump(mode="json")
    await db.commit()
    reopened = await service.get(created.id)

    assert len(restored.stages) == 8
    assert reopened.content is not None
    assert len(reopened.content.stages) == 8
    assert reopened.generation_brief.stage_count == 5
    assert reopened.sequence_style_configured is False


@pytest.mark.asyncio
async def test_source_modes_are_exclusive_and_demo_target_can_be_approved(
    client: AsyncClient, db: AsyncSession
) -> None:
    settings = Settings(lesson_generation_provider="demo", openai_api_key=None)
    storage = MemoryStorage()
    queue = MemoryQueue()
    service = LessonService(settings, storage, db, queue)  # type: ignore[arg-type]
    app.dependency_overrides[get_lesson_service] = lambda: service
    app.dependency_overrides[get_storage] = lambda: storage

    missing_prompt = await client.post(
        "/api/v1/painting-lessons",
        json={"generation_brief": {"source_mode": "prompt", "stage_count": 3}},
    )
    assert missing_prompt.status_code == 422

    prompt_lesson = await client.post(
        "/api/v1/painting-lessons",
        json={
            "generation_brief": {
                "source_mode": "prompt",
                "scene_prompt": "A rain-lit greenhouse",
                "stage_count": 3,
            }
        },
    )
    prompt_upload = await client.post(
        f"/api/v1/painting-lessons/{prompt_lesson.json()['id']}/references",
        files=[("images", ("mixed.png", image_bytes(), "image/png"))],
    )
    assert prompt_upload.status_code == 422

    created = await client.post(
        "/api/v1/painting-lessons",
        json={"generation_brief": {"source_mode": "upload", "stage_count": 3}},
    )
    lesson_id = created.json()["id"]
    uploaded = await client.post(
        f"/api/v1/painting-lessons/{lesson_id}/references",
        files=[("images", ("source.png", image_bytes(), "image/png"))],
    )
    target_run = await client.post(
        f"/api/v1/painting-lessons/{lesson_id}/target-generations",
        json={"adjustment": None},
    )
    await process_generation_run(
        uuid.UUID(target_run.json()["id"]),
        settings,
        storage,
        db,  # type: ignore[arg-type]
    )
    finished = await client.get(f"/api/v1/lesson-generations/{target_run.json()['id']}")
    assert finished.json()["progress"]["items"][0]["status"] == "unavailable"

    approved = await client.post(
        f"/api/v1/painting-lessons/{lesson_id}/target",
        json={"asset_id": uploaded.json()["assets"][0]["id"]},
    )
    assert approved.status_code == 200
    assert approved.json()["approved_target_asset_id"] == uploaded.json()["assets"][0]["id"]


@pytest.mark.asyncio
async def test_failed_stage_cascade_does_not_promote_candidate_render_set(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = Settings(lesson_generation_provider="auto", openai_api_key="server-only")
    storage = MemoryStorage()
    service = LessonService(settings, storage, db, MemoryQueue())  # type: ignore[arg-type]
    draft = await service.create(
        LessonCreate(
            title="Safe progression",
            generation_brief=LessonGenerationBrief(sequence_style="illustrative"),
        )
    )
    await service.upload_references(
        draft.id,
        [
            UploadFile(
                filename="source.png",
                file=BytesIO(image_bytes()),
                headers={"content-type": "image/png"},
            )
        ],
    )

    class FakeTextProvider:
        name = "openai"
        model = "text-model"
        is_demo = False

        async def generate(self, request: Any) -> LessonContent:
            return demo_lesson(
                request.subject,
                request.title,
                request.estimated_duration_minutes,
                request.generation_brief.stage_count,
            )

        async def regenerate(
            self, request: Any, content: LessonContent, section_key: str
        ) -> object:
            return content.overview

    class SuccessfulImages:
        def __init__(self, _settings: Settings) -> None:
            pass

        async def generate(self, images: list[tuple[bytes, str]], prompt: str) -> tuple[bytes, str]:
            return image_bytes(), "image/png"

        async def generate_from_prompt(self, prompt: str) -> tuple[bytes, str]:
            return image_bytes(), "image/png"

    monkeypatch.setattr(
        lesson_service_module, "lesson_provider", lambda _settings: FakeTextProvider()
    )
    monkeypatch.setattr(lesson_service_module, "OpenAIStudyImageProvider", SuccessfulImages)
    initial = await service.create_generation(draft.id, False)
    await process_generation_run(initial.id, settings, storage, db)  # type: ignore[arg-type]
    accepted = await service.get(draft.id)
    accepted_render_set = accepted.active_render_set_id
    assert accepted_render_set is not None
    assert accepted.content is not None

    class FailingImages(SuccessfulImages):
        async def generate(self, images: list[tuple[bytes, str]], prompt: str) -> tuple[bytes, str]:
            raise RuntimeError("Candidate image unavailable")

    monkeypatch.setattr(lesson_service_module, "OpenAIStudyImageProvider", FailingImages)
    cascade = await service.create_stage_generation(
        draft.id, accepted.content.stages[1].id, "Lighter wash"
    )
    await process_generation_run(cascade.id, settings, storage, db)  # type: ignore[arg-type]

    failed = await service.get_run(cascade.id)
    current = await service.get(draft.id)
    assert failed.status == "failed"
    assert failed.progress is not None
    assert failed.progress["items"][0]["status"] == "failed"
    assert failed.progress["items"][1]["status"] == "pending"
    assert current.active_render_set_id == accepted_render_set
    assert (
        len([asset for asset in current.assets if asset.role == "stage_image" and asset.is_current])
        == 3
    )
