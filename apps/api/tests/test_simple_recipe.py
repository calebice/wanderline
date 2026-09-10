from io import BytesIO

import pytest
from PIL import Image

from app.lesson_generation import DemoLessonProvider, LessonGenerationRequest
from app.lesson_schemas import LessonGenerationBrief
from app.simple_recipe import PaintingRecipe, split_recipe_art


@pytest.mark.asyncio
async def test_openai_recipe_uses_compact_schema_and_bounded_output(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.lesson_generation as generation
    from app.config import Settings

    request = LessonGenerationRequest(
        title="Pear",
        subject="Pear",
        artistic_context=None,
        difficulty="beginner",
        estimated_duration_minutes=30,
        primary_image=b"image",
        primary_content_type="image/png",
        secondary_images=[],
        generation_brief=LessonGenerationBrief(sequence_style="simple_recipe"),
    )
    demo = await DemoLessonProvider().generate(request)
    recipe = PaintingRecipe.model_validate(
        {
            "inferred_title": "Little pear",
            "inferred_subject": "Pear",
            "invitation": "Let a pale wash wander.",
            "materials": demo.materials,
            "palette": [mix.model_dump() for mix in demo.palette],
            "steps": [
                {
                    "title": step.title,
                    "instruction": step.instruction,
                    "paper_state": step.water_state,
                    "dry_before_next": step.move_on,
                    "palette_mix_ids": step.palette_mix_ids,
                }
                for step in demo.stages
            ],
        }
    )
    calls = []

    async def response(*args):  # type: ignore[no-untyped-def]
        calls.append(args)
        return recipe

    monkeypatch.setattr(generation, "structured_response", response)
    provider = generation.OpenAILessonProvider(Settings(openai_api_key="test-only"))
    content = await provider.generate(request)
    assert len(calls) == 1
    assert calls[0][3] is PaintingRecipe
    assert calls[0][4] <= 2400
    assert provider.inferred_title == "Little pear"
    assert [step.id for step in content.stages] == ["recipe-1", "recipe-2", "recipe-3"]
    assert content.user_notes == ""
    for count in [1, 6]:
        extended = recipe.model_dump()
        extended["steps"] = [extended["steps"][0]] * count
        from app.simple_recipe import recipe_content

        result = recipe_content(PaintingRecipe.model_validate(extended), 30)
        assert len(result.stages) == count
        assert result.recipe is not None
    extended["steps"] *= 2
    with pytest.raises(ValueError):
        PaintingRecipe.model_validate(extended)
    broken = recipe.model_dump()
    broken["palette"][0]["ingredients"] = [
        {"color": color, "parts": 1} for color in ["red", "yellow", "blue"]
    ]
    with pytest.raises(ValueError):
        PaintingRecipe.model_validate(broken)
    optional = recipe.model_dump()
    optional["finishing"] = {
        "instruction": "Add a little brown to the shadow.",
        "mix": {**optional["palette"][0], "id": "optional", "name": "Brown"},
    }
    assert PaintingRecipe.model_validate(optional).finishing is not None
    with pytest.raises(ValueError):
        LessonGenerationBrief(sequence_style="layer_study", stage_count=6)


def test_simple_defaults_and_legacy_compatibility() -> None:
    assert LessonGenerationBrief().sequence_style == "illustrative"
    brief = LessonGenerationBrief(
        sequence_style="simple_recipe",
        stage_count=5,
        background="custom",
        custom_background="A busy forest",
    )
    assert brief.stage_count == 5
    assert brief.background == "plain_paper"
    assert brief.custom_background is None


def test_recipe_crops_matching_equal_panels() -> None:
    image = Image.new("RGB", (1536, 1024), "white")
    image.paste("brown", (0, 0, 768, 1024))
    data = BytesIO()
    image.save(data, "PNG")
    painting, outline = split_recipe_art(data.getvalue())
    with Image.open(BytesIO(painting)) as left, Image.open(BytesIO(outline)) as right:
        assert left.size == right.size == (768, 1024)
        assert left.getpixel((0, 0)) == (165, 42, 42)
        assert right.getpixel((0, 0)) == (255, 255, 255)


@pytest.mark.asyncio
async def test_demo_recipe_is_short_and_explicitly_unanalyzed() -> None:
    content = await DemoLessonProvider().generate(
        LessonGenerationRequest(
            title="A pear",
            subject="Pear",
            artistic_context=None,
            difficulty="beginner",
            estimated_duration_minutes=30,
            primary_image=b"",
            primary_content_type="image/png",
            secondary_images=[],
            generation_brief=LessonGenerationBrief(sequence_style="simple_recipe"),
        )
    )
    assert "not a reading" in content.overview
    assert len(content.stages) == 3
    assert all(stage.process_phase is None for stage in content.stages)
    assert all(len(stage.instruction) <= 180 for stage in content.stages)
    assert all("like" in mix.dilution for mix in content.palette)
    payload = {
        "inferred_title": "Pear",
        "inferred_subject": "Pear",
        "invitation": "Paint a pear.",
        "materials": content.materials,
        "palette": [mix.model_dump() for mix in content.palette],
        "steps": [
            {
                "title": stage.title,
                "instruction": stage.instruction,
                "paper_state": stage.water_state,
                "dry_before_next": stage.move_on,
                "palette_mix_ids": ["missing"],
            }
            for stage in content.stages
        ],
    }
    with pytest.raises(ValueError, match="existing palette"):
        PaintingRecipe.model_validate(payload)


def test_version_contract_and_legacy_metadata() -> None:
    from app.lesson_schemas import RecipeMetadata
    from app.simple_recipe import recipe_contract

    assert RecipeMetadata.model_validate({}).version is None
    assert recipe_contract(None) == recipe_contract("simple-recipe.v1")
    with pytest.raises(ValueError, match="Unsupported recipe version"):
        recipe_contract("simple-recipe.v999")


def test_approved_apple_fixture_preserves_legacy_content() -> None:
    import json
    from pathlib import Path

    from app.lesson_schemas import LessonContent

    fixture = Path(__file__).resolve().parents[2] / "web/e2e/fixtures/simple-recipe-v1/apple.json"
    content = LessonContent.model_validate(json.loads(fixture.read_text())["content"])
    assert content.user_notes == ""
    assert content.recipe is None or content.recipe.version is None
    assert all(not stage.approach_steps for stage in content.stages)
