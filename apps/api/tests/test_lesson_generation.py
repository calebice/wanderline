import base64
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
from openai import AsyncOpenAI as SDKAsyncOpenAI

import app.lesson_generation as generation
from app.config import Settings
from app.lesson_generation import (
    LessonGenerationRequest,
    OpenAILessonProvider,
    OpenAIStudyImageProvider,
    demo_lesson,
)
from app.lesson_response_schemas import (
    GeneratedLessonContent,
    GeneratedLessonResponse,
    ProcessBoardValidation,
)
from app.lesson_schemas import LessonContent, LessonGenerationBrief, layer_study_phases


class FakeResponses:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def create(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        if kwargs["text"]["format"]["name"] == "ProcessBoardValidation":
            return SimpleNamespace(
                status="completed",
                output_text=ProcessBoardValidation(
                    approved=True,
                    summary="The checkpoints advance cleanly.",
                    failures=[],
                ).model_dump_json(),
            )
        lesson = demo_lesson("Pears", "Pear study", 30)
        prompt = kwargs["input"][-1]["content"][0]["text"]
        if "This is a layer-by-layer process study" in prompt:
            for stage, phase in zip(lesson.stages, layer_study_phases(3), strict=True):
                stage.process_phase = phase
        parsed = GeneratedLessonResponse(
            inferred_title="Pear light",
            inferred_subject="Pears on a table",
            content=GeneratedLessonContent.model_validate(lesson.model_dump(mode="json")),
        )
        return SimpleNamespace(status="completed", output_text=parsed.model_dump_json())


class FakeOpenAI:
    def __init__(self, api_key: str | None, **_kwargs: Any) -> None:
        self.api_key = api_key
        self.responses = FakeResponses()
        self.images = FakeImages()


class FakeImages:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def edit(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        return SimpleNamespace(
            data=[SimpleNamespace(b64_json=base64.b64encode(b"generated-image").decode())]
        )

    async def generate(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        return SimpleNamespace(
            data=[SimpleNamespace(b64_json=base64.b64encode(b"generated-image").decode())]
        )


@pytest.mark.asyncio
async def test_openai_text_provider_uses_private_structured_multimage_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clients: list[FakeOpenAI] = []

    def client_factory(api_key: str | None, **_kwargs: Any) -> FakeOpenAI:
        client = FakeOpenAI(api_key)
        clients.append(client)
        return client

    monkeypatch.setattr(generation, "AsyncOpenAI", client_factory)
    provider = OpenAILessonProvider(
        Settings(openai_api_key="server-secret", openai_lesson_model="lesson-model")
    )
    request = LessonGenerationRequest(
        title="Pear study",
        subject="Pears",
        artistic_context="Quiet afternoon light",
        difficulty="beginner",
        estimated_duration_minutes=30,
        primary_image=b"primary",
        primary_content_type="image/webp",
        secondary_images=[(b"secondary", "image/png")],
        generation_brief=LessonGenerationBrief(),
    )

    lesson = await provider.generate(request)

    assert lesson.stages
    assert provider.inferred_title == "Pear light"
    assert provider.inferred_subject == "Pears on a table"
    assert clients[0].api_key == "server-secret"
    call = clients[0].responses.calls[0]
    assert call["model"] == "lesson-model"
    assert call["store"] is False
    assert call["text"]["format"]["name"] == "GeneratedLessonResponse"
    image_items = [item for item in call["input"][-1]["content"] if item["type"] == "input_image"]
    assert [item["detail"] for item in image_items] == ["high", "low"]
    assert image_items[0]["image_url"].startswith("data:image/webp;base64,")
    assert "Return exactly 3 cumulative painting stages" in call["input"][-1]["content"][0]["text"]
    assert "Mood and teaching tone: as_shown" in call["input"][-1]["content"][0]["text"]
    assert "server-secret" not in str(call)


@pytest.mark.asyncio
async def test_openai_text_provider_enforces_layer_study_phase_order(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clients: list[FakeOpenAI] = []

    def client_factory(api_key: str | None, **_kwargs: Any) -> FakeOpenAI:
        client = FakeOpenAI(api_key)
        clients.append(client)
        return client

    monkeypatch.setattr(generation, "AsyncOpenAI", client_factory)
    provider = OpenAILessonProvider(Settings(openai_api_key="server-secret"))
    lesson = await provider.generate(
        LessonGenerationRequest(
            title="Pear study",
            subject="Pears",
            artistic_context=None,
            difficulty="beginner",
            estimated_duration_minutes=30,
            primary_image=b"target",
            primary_content_type="image/png",
            secondary_images=[],
            generation_brief=LessonGenerationBrief(
                source_mode="prompt",
                scene_prompt="Three pears on paper",
                sequence_style="layer_study",
            ),
        )
    )

    assert [stage.process_phase for stage in lesson.stages] == layer_study_phases(3)
    prompt = clients[0].responses.calls[0]["input"][-1]["content"][0]["text"]
    assert "dry-paper, transferable contour drawing" in prompt
    assert "light washes before middle values" in prompt


def test_generated_lesson_schema_requires_every_object_property() -> None:
    def assert_required_matches_properties(value: object) -> None:
        if isinstance(value, dict):
            properties = value.get("properties")
            if isinstance(properties, dict):
                assert set(value.get("required", [])) == set(properties)
            for child in value.values():
                assert_required_matches_properties(child)
        elif isinstance(value, list):
            for child in value:
                assert_required_matches_properties(child)

    schema = GeneratedLessonContent.model_json_schema()

    assert_required_matches_properties(schema)
    palette_schema = schema["$defs"]["GeneratedPaletteMix"]
    assert "water_parts" in palette_schema["required"]


def test_generated_lesson_accepts_nullable_water_and_empty_notes() -> None:
    lesson = demo_lesson("Pears", "Pear study", 30).model_dump(mode="json")
    lesson["palette"][0]["water_parts"] = None
    lesson["reflection_prompts"] = []
    lesson["user_notes"] = ""

    generated = GeneratedLessonContent.model_validate(lesson)

    assert generated.palette[0].water_parts is None
    assert generated.reflection_prompts == []
    assert generated.user_notes == ""


def test_persisted_lesson_remains_backward_compatible_with_omitted_defaults() -> None:
    lesson = demo_lesson("Pears", "Pear study", 30).model_dump(mode="json")
    del lesson["palette"][0]["water_parts"]
    del lesson["reflection_prompts"]
    del lesson["user_notes"]
    for stage in lesson["stages"]:
        del stage["checkpoint_action"]
        del stage["approach_steps"]

    persisted = LessonContent.model_validate(lesson)

    assert persisted.palette[0].water_parts is None
    assert persisted.reflection_prompts == []
    assert persisted.user_notes == ""
    assert persisted.stages[0].checkpoint_action is None
    assert persisted.stages[0].approach_steps == []


@pytest.mark.parametrize(
    ("mutate", "expected_fragment"),
    [
        (lambda stage: stage.pop("checkpoint_action"), "checkpoint_action"),
        (lambda stage: stage.update(approach_steps=["Only one step"]), "approach_steps"),
        (lambda stage: stage.update(checkpoint_action="x" * 181), "checkpoint_action"),
        (lambda stage: stage.update(title="Stage 1: Draw the subject"), "omit interface numbering"),
    ],
)
def test_v2_generated_stage_requires_concise_unnumbered_guidance(
    mutate: Any, expected_fragment: str
) -> None:
    lesson = demo_lesson("Pears", "Pear study", 30).model_dump(mode="json")
    mutate(lesson["stages"][0])

    with pytest.raises(ValueError, match=expected_fragment):
        GeneratedLessonContent.model_validate(lesson)


@pytest.mark.asyncio
async def test_section_regeneration_preserves_existing_stable_ids() -> None:
    current = demo_lesson("Pears", "Pear study", 30)
    current.stages[0].id = "user-stage-id"
    current.palette[0].id = "user-palette-id"
    request = LessonGenerationRequest(
        title="Pear study",
        subject="Pears",
        artistic_context=None,
        difficulty="beginner",
        estimated_duration_minutes=30,
        primary_image=b"image",
        primary_content_type="image/webp",
        secondary_images=[],
        generation_brief=LessonGenerationBrief(),
    )
    provider = generation.DemoLessonProvider()

    stage = await provider.regenerate(request, current, "stages.user-stage-id")
    palette = await provider.regenerate(request, current, "palette")

    assert isinstance(stage, dict) and stage["id"] == "user-stage-id"
    assert isinstance(palette, list) and palette[0]["id"] == "user-palette-id"


@pytest.mark.asyncio
async def test_openai_study_provider_uses_configured_multi_image_edit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clients: list[FakeOpenAI] = []

    def client_factory(api_key: str | None, **_kwargs: Any) -> FakeOpenAI:
        client = FakeOpenAI(api_key)
        clients.append(client)
        return client

    monkeypatch.setattr(generation, "AsyncOpenAI", client_factory)
    provider = OpenAIStudyImageProvider(
        Settings(openai_api_key="server-secret", openai_image_model="image-model")
    )

    result, mime = await provider.generate(
        [(b"source", "image/webp"), (b"continuity", "image/png")],
        "Paint a study",
    )

    assert result == b"generated-image"
    assert mime == "image/png"
    call = clients[0].images.calls[0]
    assert call["model"] == "image-model"
    assert call["prompt"] == "Paint a study"
    assert call["image"] == [
        ("reference-1.webp", b"source", "image/webp"),
        ("reference-2.png", b"continuity", "image/png"),
    ]


@pytest.mark.asyncio
async def test_openai_study_provider_uses_structured_visual_validation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clients: list[FakeOpenAI] = []

    def client_factory(api_key: str | None, **_kwargs: Any) -> FakeOpenAI:
        client = FakeOpenAI(api_key)
        clients.append(client)
        return client

    monkeypatch.setattr(generation, "AsyncOpenAI", client_factory)
    provider = OpenAIStudyImageProvider(
        Settings(
            openai_api_key="server-secret",
            openai_image_model="image-model",
            openai_lesson_model="validation-model",
        )
    )

    validation = await provider.validate_process_board(
        [(b"board", "image/png"), (b"target", "image/webp")],
        "Check the process order",
    )

    assert validation.approved is True
    call = clients[0].responses.calls[0]
    assert call["model"] == "validation-model"
    assert call["store"] is False
    assert call["text"]["format"]["name"] == "ProcessBoardValidation"
    assert "server-secret" not in str(call)


@pytest.mark.asyncio
async def test_openai_study_provider_sets_multipart_content_type(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request_bodies: list[bytes] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        request_bodies.append(await request.aread())
        return httpx.Response(
            200,
            request=request,
            json={
                "created": 0,
                "data": [
                    {
                        "b64_json": base64.b64encode(b"generated-image").decode(),
                    }
                ],
            },
        )

    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

    def client_factory(api_key: str | None, **_kwargs: Any) -> SDKAsyncOpenAI:
        return SDKAsyncOpenAI(api_key=api_key, http_client=http_client)

    monkeypatch.setattr(generation, "AsyncOpenAI", client_factory)
    provider = OpenAIStudyImageProvider(
        Settings(openai_api_key="server-secret", openai_image_model="image-model")
    )

    await provider.generate([(b"source", "image/webp")], "Paint a study")
    await http_client.aclose()

    body = request_bodies[0].decode("latin-1")
    assert 'filename="reference-1.webp"' in body
    assert "Content-Type: image/webp" in body


@pytest.mark.asyncio
async def test_openai_study_provider_rejects_unsupported_content_type(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(generation, "AsyncOpenAI", FakeOpenAI)
    provider = OpenAIStudyImageProvider(
        Settings(openai_api_key="server-secret", openai_image_model="image-model")
    )

    with pytest.raises(ValueError, match="JPEG, PNG, or WebP"):
        await provider.generate([(b"source", "application/octet-stream")], "Paint a study")


@pytest.mark.asyncio
async def test_openai_study_provider_can_generate_target_from_prompt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clients: list[FakeOpenAI] = []

    def client_factory(api_key: str | None, **_kwargs: Any) -> FakeOpenAI:
        client = FakeOpenAI(api_key)
        clients.append(client)
        return client

    monkeypatch.setattr(generation, "AsyncOpenAI", client_factory)
    provider = OpenAIStudyImageProvider(
        Settings(openai_api_key="server-secret", openai_image_model="image-model")
    )

    result, mime = await provider.generate_from_prompt("A rain-lit greenhouse")

    assert result == b"generated-image"
    assert mime == "image/png"
    call = clients[0].images.calls[0]
    assert call["model"] == "image-model"
    assert call["prompt"] == "A rain-lit greenhouse"
    assert "server-secret" not in str(call)
