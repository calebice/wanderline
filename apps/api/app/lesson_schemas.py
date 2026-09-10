import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictLessonSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


type ProcessPhase = Literal[
    "drawing_map",
    "light_wash",
    "light_and_middle_washes",
    "middle_values",
    "dark_forms",
    "finished_target",
]


def layer_study_phases(stage_count: int) -> list[ProcessPhase]:
    phases: dict[int, list[ProcessPhase]] = {
        1: ["finished_target"],
        2: ["drawing_map", "finished_target"],
        3: ["drawing_map", "light_and_middle_washes", "finished_target"],
        4: ["drawing_map", "light_wash", "middle_values", "finished_target"],
        5: [
            "drawing_map",
            "light_wash",
            "middle_values",
            "dark_forms",
            "finished_target",
        ],
    }
    return phases[stage_count]


class PaintIngredient(StrictLessonSchema):
    color: Literal[
        "red",
        "orange",
        "yellow",
        "green",
        "blue",
        "purple",
        "pink",
        "brown",
        "gray",
        "black",
        "white",
    ]
    parts: float = Field(gt=0, le=20)


class PaletteMix(StrictLessonSchema):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=100)
    swatch: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    formula: str = Field(min_length=1, max_length=300)
    dilution: str = Field(min_length=1, max_length=120)
    water_parts: int | None = Field(default=None, ge=1, le=20)
    ingredients: list[PaintIngredient] | None = Field(default=None, min_length=1, max_length=2)
    consistency: Literal["very watery", "watery", "less water", "lightly creamy"] | None = None


class RecipeFinishing(StrictLessonSchema):
    instruction: str = Field(min_length=1, max_length=180)
    mix: PaletteMix


class RecipeMetadata(StrictLessonSchema):
    version: str | None = None
    finishing: RecipeFinishing | None = None


class LessonStage(StrictLessonSchema):
    id: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    short_title: str = Field(min_length=1, max_length=60)
    time: str = Field(min_length=1, max_length=60)
    water_state: str = Field(min_length=1, max_length=100)
    principle: str = Field(min_length=1, max_length=600)
    instruction: str = Field(min_length=1, max_length=1200)
    checkpoint_action: str | None = Field(default=None, min_length=1, max_length=180)
    approach_steps: list[Annotated[str, Field(min_length=1, max_length=180)]] = Field(
        default_factory=list, max_length=3
    )
    process_phase: ProcessPhase | None = None
    look_for: str = Field(min_length=1, max_length=1000)
    move_on: str = Field(min_length=1, max_length=800)
    palette_mix_ids: list[str] = Field(min_length=1, max_length=8)


class CommonMistake(StrictLessonSchema):
    id: str
    mistake: str
    correction: str


class TeachingSection(StrictLessonSchema):
    id: str
    title: str
    body: str


class EdgeGuidance(StrictLessonSchema):
    hard: str
    soft: str
    lost: str


class DetailDecisions(StrictLessonSchema):
    preserve: list[str]
    simplify: list[str]
    exaggerate: list[str]
    omit: list[str]


class TimedStudy(StrictLessonSchema):
    duration_minutes: int = Field(ge=1, le=60)
    notice: str
    start: str
    check: str


class LessonContent(StrictLessonSchema):
    recipe: RecipeMetadata | None = None
    overview: str
    learning_objective: str
    composition_crop: str
    focal_point: str
    large_value_shapes: str
    palette: list[PaletteMix] = Field(min_length=1, max_length=12)
    light_shadow: str
    materials: list[str] = Field(min_length=3, max_length=12)
    underdrawing: str
    wash_control: str
    edges: EdgeGuidance
    details: DetailDecisions
    common_mistakes: list[CommonMistake] = Field(min_length=2, max_length=8)
    stages: list[LessonStage] = Field(min_length=1, max_length=8)
    timed_study: TimedStudy
    teaching_guide: list[TeachingSection] = Field(min_length=2, max_length=12)
    reflection_prompts: list[str] = Field(default_factory=list, max_length=6)
    completion_notes: str
    user_notes: str = ""


class LessonGenerationBrief(StrictLessonSchema):
    source_mode: Literal["upload", "prompt"] = "upload"
    sequence_style: Literal["layer_study", "illustrative", "simple_recipe"] = "illustrative"
    scene_prompt: str | None = Field(default=None, max_length=2000)
    stage_count: int = Field(default=3, ge=1, le=6)
    mood: Literal["as_shown", "joyous", "calm", "pensive", "dramatic", "custom"] = "as_shown"
    background: Literal[
        "as_shown", "monochrome", "gradient", "complementary", "plain_paper", "custom"
    ] = "as_shown"
    treatment: Literal["natural", "loose", "luminous", "graphic", "atmospheric", "custom"] = (
        "natural"
    )
    custom_mood: str | None = Field(default=None, max_length=300)
    custom_background: str | None = Field(default=None, max_length=300)
    custom_treatment: str | None = Field(default=None, max_length=300)
    additional_direction: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def validate_source_and_custom_choices(self) -> "LessonGenerationBrief":
        if self.sequence_style == "simple_recipe":
            self.background = "plain_paper"
            self.treatment = "natural"
        elif self.stage_count > 5:
            raise ValueError("Layer and individual-image sessions support up to five steps.")
        if self.source_mode == "prompt" and not (self.scene_prompt or "").strip():
            raise ValueError("Describe the image you want Wanderline to create.")
        if self.source_mode == "upload" and (self.scene_prompt or "").strip():
            raise ValueError("Upload lessons cannot also include a scene prompt.")
        custom_values = (
            (self.mood, self.custom_mood, "mood"),
            (self.background, self.custom_background, "background"),
            (self.treatment, self.custom_treatment, "watercolor treatment"),
        )
        for selected, custom, label in custom_values:
            if selected == "custom" and not (custom or "").strip():
                raise ValueError(f"Describe the custom {label}.")
        for choice, field in (
            (self.mood, "custom_mood"),
            (self.background, "custom_background"),
            (self.treatment, "custom_treatment"),
        ):
            if choice != "custom":
                setattr(self, field, None)
        return self


class LessonCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    subject: str | None = Field(default=None, max_length=200)
    artistic_context: str | None = Field(default=None, max_length=1000)
    difficulty: Literal["beginner", "intermediate", "advanced"] = "beginner"
    estimated_duration_minutes: int = Field(default=30, ge=10, le=180)
    generation_brief: LessonGenerationBrief = Field(
        default_factory=lambda: LessonGenerationBrief(sequence_style="layer_study")
    )


class LessonBriefUpdate(BaseModel):
    generation_brief: LessonGenerationBrief
    title: str | None = Field(default=None, max_length=200)
    artistic_context: str | None = Field(default=None, max_length=1000)
    difficulty: Literal["beginner", "intermediate", "advanced"] | None = None
    estimated_duration_minutes: int | None = Field(default=None, ge=10, le=180)


class LessonAssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    order_index: int
    is_primary: bool
    stage_id: str | None
    render_set_id: uuid.UUID | None
    is_current: bool
    original_content_type: str
    display_content_type: str
    width: int
    height: int
    filename: str
    alt_text: str
    image_url: str


class LessonRead(BaseModel):
    id: uuid.UUID
    schema_version: str
    template: str
    medium: str
    title: str
    subject: str | None
    artistic_context: str | None
    difficulty: str
    estimated_duration_minutes: int
    source_mode: str
    scene_prompt: str | None
    generation_brief: LessonGenerationBrief
    latest_run_id: uuid.UUID | None = None
    latest_run_scope: str | None = None
    sequence_style_configured: bool
    approved_target_asset_id: uuid.UUID | None
    active_render_set_id: uuid.UUID | None
    image_generation_available: bool
    content: LessonContent | None
    revision: int
    saved_at: datetime | None
    generation_status: str
    generation_error: dict[str, Any] | None
    provider_mode: str
    is_demo: bool
    assets: list[LessonAssetRead]
    created_at: datetime
    updated_at: datetime


class LessonSave(BaseModel):
    expected_revision: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=200)
    artistic_context: str | None = Field(default=None, max_length=1000)
    difficulty: Literal["beginner", "intermediate", "advanced"]
    estimated_duration_minutes: int = Field(ge=10, le=180)
    content: LessonContent


class GenerationCreate(BaseModel):
    idempotency_key: str | None = Field(default=None, max_length=100)
    include_study_image: bool = False


class TargetGenerationCreate(BaseModel):
    idempotency_key: str | None = Field(default=None, max_length=100)
    adjustment: str | None = Field(default=None, max_length=1000)


class TargetApprove(BaseModel):
    asset_id: uuid.UUID


class StageGenerationCreate(BaseModel):
    idempotency_key: str | None = Field(default=None, max_length=100)
    start_stage_id: str
    adjustment: str | None = Field(default=None, max_length=1000)


class LessonCapabilities(BaseModel):
    image_generation_available: bool


class SectionGenerationCreate(BaseModel):
    idempotency_key: str | None = Field(default=None, max_length=100)
    current_content: LessonContent


class GenerationRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lesson_id: uuid.UUID
    scope: str
    section_key: str | None
    include_study_image: bool
    provider: str
    model: str
    status: str
    result: dict[str, Any] | list[Any] | str | None
    progress: dict[str, Any] | None
    adjustment: str | None
    error_code: str | None
    error_message: str | None
    recoverable: bool
    attempts: int
    queued_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
