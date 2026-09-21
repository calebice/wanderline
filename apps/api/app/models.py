import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Index, Numeric, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class LearnerProfile(Base):
    __tablename__ = "learner_profiles"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    weekly_target: Mapped[int] = mapped_column(default=3)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class PaintingLesson(Base):
    __tablename__ = "painting_lessons"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    learner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("learner_profiles.id"), index=True)
    schema_version: Mapped[str] = mapped_column(String(40), default="painting-lesson.v2")
    template: Mapped[str] = mapped_column(String(40), default="watercolor")
    medium: Mapped[str] = mapped_column(String(40), default="watercolor")
    title: Mapped[str] = mapped_column(String(200), default="Untitled watercolor lesson")
    subject: Mapped[str | None] = mapped_column(String(200))
    artistic_context: Mapped[str | None] = mapped_column(String(1000))
    difficulty: Mapped[str] = mapped_column(String(20), default="beginner")
    estimated_duration_minutes: Mapped[int] = mapped_column(default=30)
    source_mode: Mapped[str] = mapped_column(String(20), default="upload")
    scene_prompt: Mapped[str | None] = mapped_column(String(2000))
    generation_brief: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    approved_target_asset_id: Mapped[uuid.UUID | None] = mapped_column()
    active_render_set_id: Mapped[uuid.UUID | None] = mapped_column()
    content: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    revision: Mapped[int] = mapped_column(default=1)
    saved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    discarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    generation_status: Mapped[str] = mapped_column(String(20), default="idle")
    generation_error: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class LessonAsset(Base):
    __tablename__ = "lesson_assets"
    __table_args__ = (
        Index(
            "uq_lesson_primary_reference",
            "lesson_id",
            unique=True,
            postgresql_where=text("is_primary = true AND role = 'original_reference'"),
            sqlite_where=text("is_primary = 1 AND role = 'original_reference'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("painting_lessons.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(30))
    order_index: Mapped[int] = mapped_column(default=0)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    stage_id: Mapped[str | None] = mapped_column(String(80), index=True)
    render_set_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    original_object_key: Mapped[str] = mapped_column(String(400), unique=True)
    display_object_key: Mapped[str] = mapped_column(String(400), unique=True)
    original_content_type: Mapped[str] = mapped_column(String(50))
    display_content_type: Mapped[str] = mapped_column(String(50))
    width: Mapped[int]
    height: Mapped[int]
    filename: Mapped[str] = mapped_column(String(255))
    alt_text: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class LessonGenerationRun(Base):
    __tablename__ = "lesson_generation_runs"
    __table_args__ = (
        Index("uq_generation_idempotency", "lesson_id", "idempotency_key", unique=True),
    )

    idempotency_key: Mapped[str | None] = mapped_column(String(100))
    input_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    checkpoints: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("painting_lessons.id", ondelete="CASCADE"), index=True
    )
    scope: Mapped[str] = mapped_column(String(20), default="full")
    section_key: Mapped[str | None] = mapped_column(String(100))
    include_study_image: Mapped[bool] = mapped_column(Boolean, default=False)
    provider: Mapped[str] = mapped_column(String(30))
    model: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="queued")
    result: Mapped[dict[str, Any] | list[Any] | str | None] = mapped_column(JSON)
    progress: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    adjustment: Mapped[str | None] = mapped_column(String(1000))
    error_code: Mapped[str | None] = mapped_column(String(80))
    error_message: Mapped[str | None] = mapped_column(Text)
    recoverable: Mapped[bool] = mapped_column(Boolean, default=True)
    attempts: Mapped[int] = mapped_column(default=1)
    queued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class GenerationUsage(Base):
    __tablename__ = "generation_usage"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lesson_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("painting_lessons.id"), index=True)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lesson_generation_runs.id"), index=True)
    operation: Mapped[str] = mapped_column(String(100))
    attempt: Mapped[int]
    model: Mapped[str] = mapped_column(String(100))
    request_id: Mapped[str | None] = mapped_column(String(200))
    parameters: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    tokens: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    estimated_cost_usd: Mapped[float | None] = mapped_column(Numeric(18, 9))
    pricing_version: Mapped[str] = mapped_column(String(40))
    latency_ms: Mapped[int | None]
    outcome: Mapped[str] = mapped_column(String(30), default="started")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ColorMixRecipe(Base):
    __tablename__ = "color_mix_recipes"
    __table_args__ = (
        Index(
            "uq_color_mix_recipe_version",
            "catalog_version",
            "palette_id",
            "recipe_slug",
            unique=True,
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    catalog_version: Mapped[int]
    palette_id: Mapped[str] = mapped_column(String(80))
    recipe_slug: Mapped[str] = mapped_column(String(100))
    family: Mapped[str] = mapped_column(String(40), index=True)
    name: Mapped[str] = mapped_column(String(120))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ColorMixTrial(Base):
    __tablename__ = "color_mix_trials"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    learner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("learner_profiles.id"), index=True)
    recipe_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("color_mix_recipes.id"), index=True)
    catalog_version: Mapped[int]
    recipe_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    adjustments: Mapped[list[str]] = mapped_column(JSON, default=list)
    notes: Mapped[str] = mapped_column(String(2000), default="")
    revision: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class ColorSwatch(Base):
    __tablename__ = "color_swatches"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    learner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("learner_profiles.id"), index=True)
    schema_version: Mapped[str] = mapped_column(String(40), default="color-swatch.v1")
    source_type: Mapped[str] = mapped_column(String(30), index=True)
    palette_id: Mapped[str] = mapped_column(String(80), index=True)
    catalog_version: Mapped[int]
    source_recipe_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("color_mix_recipes.id"), index=True
    )
    family: Mapped[str | None] = mapped_column(String(40), index=True)
    name: Mapped[str] = mapped_column(String(160))
    source_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    ingredients: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    paper: Mapped[dict[str, Any]] = mapped_column(JSON)
    capture: Mapped[dict[str, Any]] = mapped_column(JSON)
    observations: Mapped[dict[str, Any]] = mapped_column(JSON)
    notes: Mapped[str] = mapped_column(String(4000), default="")
    tested_on: Mapped[date] = mapped_column(Date, index=True)
    revision: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class ColorSwatchAsset(Base):
    __tablename__ = "color_swatch_assets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    swatch_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("color_swatches.id", ondelete="CASCADE"), unique=True, index=True
    )
    original_object_key: Mapped[str] = mapped_column(String(400), unique=True)
    display_object_key: Mapped[str] = mapped_column(String(400), unique=True)
    original_content_type: Mapped[str] = mapped_column(String(50))
    display_content_type: Mapped[str] = mapped_column(String(50))
    width: Mapped[int]
    height: Mapped[int]
    filename: Mapped[str] = mapped_column(String(255))
    alt_text: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
