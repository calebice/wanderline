import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ExerciseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    skill: str
    difficulty: int
    duration_minutes: int
    instructions: list[str]
    completion_requirements: dict[str, Any]
    reference_mode: str
    sequence_index: int
    week_number: int
    objective: str
    concept: str
    why_it_matters: str
    common_mistake: str
    materials: list[str]
    timed_phases: list[dict[str, Any]]
    visual_kind: str
    three_d_config: dict[str, Any] | None
    replay_variation: str


class PracticeSessionCreate(BaseModel):
    exercise_id: str = Field(min_length=1, max_length=100)


class PracticeSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    exercise_id: str
    status: str
    difficulty_response: str | None
    takeaway: str | None
    started_at: datetime
    completed_at: datetime | None


class PracticeSessionComplete(BaseModel):
    difficulty_response: str = Field(pattern="^(too_easy|just_right|too_hard)$")
    takeaway: str | None = Field(default=None, max_length=500)


class LessonProgressRead(BaseModel):
    exercise: ExerciseRead
    status: str
    active_session_id: uuid.UUID | None
    completed_sessions: int
    last_completed_at: datetime | None


class RecentReflectionRead(BaseModel):
    session_id: uuid.UUID
    exercise_id: str
    exercise_title: str
    difficulty_response: str
    takeaway: str | None
    completed_at: datetime


class MilestoneRead(BaseModel):
    week_number: int
    title: str
    completed_lessons: int
    total_lessons: int
    status: str


class ProgressRead(BaseModel):
    learner_name: str
    weekly_target: int
    weekly_completed: int
    total_completed_lessons: int
    total_lessons: int
    recommended_exercise_id: str
    current_milestone: str
    lessons: list[LessonProgressRead]
    milestones: list[MilestoneRead]
    recent_reflections: list[RecentReflectionRead]


class PracticeCompletionRead(BaseModel):
    session: PracticeSessionRead
    progress: ProgressRead


class LibraryExerciseRead(BaseModel):
    id: str
    title: str
    track: str
    difficulty: int
    duration_minutes: int
    objective: str
    concept: str
    common_mistake: str
    materials: list[str]
    instructions: list[str]
    timed_phases: list[dict[str, Any]]
    visual_kind: str
    visual_config: dict[str, Any]
    self_checks: list[dict[str, str]]
    sequence_index: int
    attempt_count: int = 0
    active_attempt_id: uuid.UUID | None = None
    last_completed_at: datetime | None = None


class LibraryAttemptCreate(BaseModel):
    exercise_slug: str = Field(min_length=1, max_length=100)


class LibraryAttemptRead(BaseModel):
    id: uuid.UUID
    exercise_slug: str
    status: str
    variant_seed: int
    variant_version: str
    variant_data: dict[str, Any]
    self_check_responses: dict[str, str] | None
    difficulty_response: str | None
    takeaway: str | None
    practice_medium: str
    last_overlay_exported_at: datetime | None
    started_at: datetime
    completed_at: datetime | None


class LibraryAttemptComplete(BaseModel):
    self_check_responses: dict[str, str]
    difficulty_response: str = Field(pattern="^(too_easy|just_right|too_hard)$")
    takeaway: str | None = Field(default=None, max_length=500)


class LibraryHistoryItem(BaseModel):
    exercise_slug: str
    title: str
    attempt_count: int
    last_completed_at: datetime | None


class LibraryHistoryRead(BaseModel):
    recent_attempts: list[LibraryAttemptRead]
    exercises: list[LibraryHistoryItem]


class SketchRead(BaseModel):
    id: uuid.UUID
    content_type: str
    width: int
    height: int
    actual_subject: str | None
    uploaded_at: datetime


class SubjectPrediction(BaseModel):
    label: str | None
    confidence: float
    message: str


class AnalysisRead(BaseModel):
    id: uuid.UUID
    provider: str
    status: str
    summary: str
    strengths: list[str]
    improvements: list[str]
    metrics: dict[str, Any]
    confidence: float
    sketch: SketchRead
    subject_prediction: SubjectPrediction


class ImageRead(BaseModel):
    id: uuid.UUID
    content_type: str
    width: int
    height: int
    uploaded_at: datetime


class DecompositionPoint(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class DecompositionRect(BaseModel):
    type: Literal["rect"]
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(ge=0, le=1)
    height: float = Field(ge=0, le=1)


class DecompositionEllipse(BaseModel):
    type: Literal["ellipse"]
    cx: float = Field(ge=0, le=1)
    cy: float = Field(ge=0, le=1)
    rx: float = Field(ge=0, le=1)
    ry: float = Field(ge=0, le=1)
    rotation: float


class DecompositionRotatedRect(BaseModel):
    type: Literal["rotated_rect"]
    cx: float = Field(ge=0, le=1)
    cy: float = Field(ge=0, le=1)
    width: float = Field(ge=0, le=1)
    height: float = Field(ge=0, le=1)
    rotation: float
    points: list[DecompositionPoint]


class DecompositionPolygon(BaseModel):
    type: Literal["polygon"]
    points: list[DecompositionPoint]


class DecompositionLine(BaseModel):
    type: Literal["line"]
    x1: float = Field(ge=0, le=1)
    y1: float = Field(ge=0, le=1)
    x2: float = Field(ge=0, le=1)
    y2: float = Field(ge=0, le=1)


ShapeGeometry = Annotated[
    DecompositionRect | DecompositionEllipse | DecompositionRotatedRect | DecompositionPolygon,
    Field(discriminator="type"),
]
GuideGeometry = Annotated[
    DecompositionRect
    | DecompositionEllipse
    | DecompositionRotatedRect
    | DecompositionPolygon
    | DecompositionLine,
    Field(discriminator="type"),
]


class DecompositionShape(BaseModel):
    id: str
    kind: Literal[
        "rectangle",
        "rotated_rectangle",
        "triangle",
        "circle",
        "ellipse",
        "quadrilateral",
        "polygon",
    ]
    geometry: ShapeGeometry
    color: str
    importance: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    z_index: int = Field(ge=0)
    source: Literal["fitted", "fallback"]


class ConstructionHint(BaseModel):
    id: str
    kind: Literal["box_like", "cylinder_like", "sphere_like", "cone_like"]
    member_shape_ids: list[str]
    confidence: float = Field(ge=0, le=1)
    guides: list[GuideGeometry]


class DecompositionLevels(BaseModel):
    simple: list[str]
    medium: list[str]
    detailed: list[str]


class DrawingStep(BaseModel):
    order: int = Field(ge=1)
    shape_id: str
    instruction: str


class ImageDecompositionRead(BaseModel):
    id: uuid.UUID
    status: str
    provider: str
    algorithm_version: str
    summary: str
    confidence: float = Field(ge=0, le=1)
    image: ImageRead
    shapes: list[DecompositionShape]
    construction_hints: list[ConstructionHint]
    levels: DecompositionLevels
    drawing_steps: list[DrawingStep]
    warnings: list[str]
    limitations: str
