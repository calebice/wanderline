import re
from typing import Annotated, Any

from pydantic import Field, field_validator, model_validator

from app.lesson_schemas import (
    CommonMistake,
    DetailDecisions,
    EdgeGuidance,
    LessonStage,
    ProcessPhase,
    StrictLessonSchema,
    TeachingSection,
    TimedStudy,
)


class GeneratedPaletteMix(StrictLessonSchema):
    """Palette data required from OpenAI for a newly generated lesson."""

    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=100)
    swatch: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    formula: str = Field(min_length=1, max_length=300)
    dilution: str = Field(min_length=1, max_length=120)
    water_parts: int | None = Field(ge=1, le=20)

    @model_validator(mode="before")
    @classmethod
    def omit_empty_recipe_extensions(cls, value: Any) -> Any:
        if isinstance(value, dict):
            return {
                key: item
                for key, item in value.items()
                if not (key in {"ingredients", "consistency"} and item is None)
            }
        return value


class GeneratedLessonStage(LessonStage):
    """Concise checkpoint guidance required for newly generated v2 lessons."""

    checkpoint_action: str = Field(min_length=1, max_length=180)
    approach_steps: list[Annotated[str, Field(min_length=1, max_length=180)]] = Field(
        min_length=2, max_length=3
    )
    process_phase: ProcessPhase | None

    @field_validator("title")
    @classmethod
    def title_omits_interface_numbering(cls, value: str) -> str:
        if re.match(r"^\s*(stage|step)\s+\d+\b", value, re.IGNORECASE):
            raise ValueError("Stage titles must omit interface numbering.")
        return value


class GeneratedLessonContent(StrictLessonSchema):
    """Strict OpenAI response contract, separate from the persisted lesson model."""

    overview: str
    learning_objective: str
    composition_crop: str
    focal_point: str
    large_value_shapes: str
    palette: list[GeneratedPaletteMix] = Field(min_length=2, max_length=12)
    light_shadow: str
    materials: list[str] = Field(min_length=3, max_length=12)
    underdrawing: str
    wash_control: str
    edges: EdgeGuidance
    details: DetailDecisions
    common_mistakes: list[CommonMistake] = Field(min_length=2, max_length=8)
    stages: list[GeneratedLessonStage] = Field(min_length=1, max_length=5)
    timed_study: TimedStudy
    teaching_guide: list[TeachingSection] = Field(min_length=2, max_length=12)
    reflection_prompts: list[str] = Field(max_length=6)
    completion_notes: str
    user_notes: str

    @model_validator(mode="before")
    @classmethod
    def omit_empty_recipe_metadata(cls, value: Any) -> Any:
        if isinstance(value, dict) and value.get("recipe") is None:
            return {key: item for key, item in value.items() if key != "recipe"}
        return value


class GeneratedLessonResponse(StrictLessonSchema):
    """Metadata inferred from the image plus the complete lesson body."""

    inferred_title: str = Field(min_length=1, max_length=200)
    inferred_subject: str = Field(min_length=1, max_length=200)
    content: GeneratedLessonContent


class ProcessBoardValidation(StrictLessonSchema):
    """Structured visual QA result for a generated layer-study board."""

    approved: bool
    summary: str = Field(min_length=1, max_length=500)
    failures: list[Annotated[str, Field(min_length=1, max_length=240)]] = Field(max_length=5)
