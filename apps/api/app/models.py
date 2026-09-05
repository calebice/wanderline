import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    skill: Mapped[str] = mapped_column(String(50))
    difficulty: Mapped[int]
    duration_minutes: Mapped[int]
    instructions: Mapped[list[str]] = mapped_column(JSON)
    completion_requirements: Mapped[dict[str, Any]] = mapped_column(JSON)
    reference_mode: Mapped[str] = mapped_column(String(30))
    sequence_index: Mapped[int]
    week_number: Mapped[int]
    objective: Mapped[str] = mapped_column(String(300))
    concept: Mapped[str] = mapped_column(String(1200))
    why_it_matters: Mapped[str] = mapped_column(String(1000))
    common_mistake: Mapped[str] = mapped_column(String(600))
    materials: Mapped[list[str]] = mapped_column(JSON)
    timed_phases: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    visual_kind: Mapped[str] = mapped_column(String(40))
    three_d_config: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    replay_variation: Mapped[str] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class LearnerProfile(Base):
    __tablename__ = "learner_profiles"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    weekly_target: Mapped[int] = mapped_column(default=3)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class PracticeSession(Base):
    __tablename__ = "practice_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    exercise_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exercises.id"))
    learner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("learner_profiles.id"))
    status: Mapped[str] = mapped_column(String(20), default="in_progress")
    difficulty_response: Mapped[str | None] = mapped_column(String(20))
    takeaway: Mapped[str | None] = mapped_column(String(500))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LibraryExercise(Base):
    __tablename__ = "library_exercises"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    track: Mapped[str] = mapped_column(String(40), index=True)
    difficulty: Mapped[int]
    duration_minutes: Mapped[int]
    objective: Mapped[str] = mapped_column(String(400))
    concept: Mapped[str] = mapped_column(String(1200))
    common_mistake: Mapped[str] = mapped_column(String(600))
    materials: Mapped[list[str]] = mapped_column(JSON)
    instructions: Mapped[list[str]] = mapped_column(JSON)
    timed_phases: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    visual_kind: Mapped[str] = mapped_column(String(50))
    visual_config: Mapped[dict[str, Any]] = mapped_column(JSON)
    variation_config: Mapped[dict[str, Any]] = mapped_column(JSON)
    self_checks: Mapped[list[dict[str, str]]] = mapped_column(JSON)
    sequence_index: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class LibraryAttempt(Base):
    __tablename__ = "library_attempts"
    __table_args__ = (
        Index(
            "uq_library_attempt_active",
            "learner_id",
            "exercise_id",
            unique=True,
            postgresql_where=text("status = 'in_progress'"),
            sqlite_where=text("status = 'in_progress'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    learner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("learner_profiles.id"), index=True)
    exercise_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("library_exercises.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="in_progress")
    variant_seed: Mapped[int]
    variant_version: Mapped[str] = mapped_column(String(30), default="library_v1")
    variant_data: Mapped[dict[str, Any]] = mapped_column(JSON)
    self_check_responses: Mapped[dict[str, str] | None] = mapped_column(JSON)
    difficulty_response: Mapped[str | None] = mapped_column(String(20))
    takeaway: Mapped[str | None] = mapped_column(String(500))
    practice_medium: Mapped[str] = mapped_column(
        String(20), default="paper", server_default="paper"
    )
    last_overlay_exported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Sketch(Base):
    __tablename__ = "sketches"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    object_key: Mapped[str] = mapped_column(String(300), unique=True)
    content_type: Mapped[str] = mapped_column(String(30))
    width: Mapped[int]
    height: Mapped[int]
    actual_subject: Mapped[str | None] = mapped_column(String(200))
    purpose: Mapped[str] = mapped_column(
        String(30), default="sketch_critique", server_default="sketch_critique"
    )
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    sketch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sketches.id"), unique=True)
    provider: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20))
    analysis_kind: Mapped[str] = mapped_column(
        String(30), default="sketch_critique", server_default="sketch_critique"
    )
    summary: Mapped[str] = mapped_column(String(1000))
    strengths: Mapped[list[str]] = mapped_column(JSON)
    improvements: Mapped[list[str]] = mapped_column(JSON)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON)
    predicted_subject: Mapped[str | None] = mapped_column(String(200))
    prediction_confidence: Mapped[float]
    confidence: Mapped[float]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
