"""Remove exported drawing-era tables."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_table("analyses")
    op.drop_table("library_attempts")
    op.drop_table("practice_sessions")
    op.drop_table("sketches")
    op.drop_table("library_exercises")
    op.drop_table("exercises")


def downgrade() -> None:
    op.create_table(
        "exercises",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("skill", sa.String(50), nullable=False),
        sa.Column("difficulty", sa.Integer(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("instructions", sa.JSON(), nullable=False),
        sa.Column("completion_requirements", sa.JSON(), nullable=False),
        sa.Column("reference_mode", sa.String(30), nullable=False),
        sa.Column("sequence_index", sa.Integer(), nullable=False),
        sa.Column("week_number", sa.Integer(), nullable=False),
        sa.Column("objective", sa.String(300), nullable=False),
        sa.Column("concept", sa.String(1200), nullable=False),
        sa.Column("why_it_matters", sa.String(1000), nullable=False),
        sa.Column("common_mistake", sa.String(600), nullable=False),
        sa.Column("materials", sa.JSON(), nullable=False),
        sa.Column("timed_phases", sa.JSON(), nullable=False),
        sa.Column("visual_kind", sa.String(40), nullable=False),
        sa.Column("three_d_config", sa.JSON()),
        sa.Column("replay_variation", sa.String(1000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_exercises_slug", "exercises", ["slug"], unique=True)
    op.create_table(
        "practice_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("exercise_id", sa.Uuid(), sa.ForeignKey("exercises.id"), nullable=False),
        sa.Column("learner_id", sa.Uuid(), sa.ForeignKey("learner_profiles.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("difficulty_response", sa.String(20)),
        sa.Column("takeaway", sa.String(500)),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "library_exercises",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("track", sa.String(40), nullable=False),
        sa.Column("difficulty", sa.Integer(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("objective", sa.String(400), nullable=False),
        sa.Column("concept", sa.String(1200), nullable=False),
        sa.Column("common_mistake", sa.String(600), nullable=False),
        sa.Column("materials", sa.JSON(), nullable=False),
        sa.Column("instructions", sa.JSON(), nullable=False),
        sa.Column("timed_phases", sa.JSON(), nullable=False),
        sa.Column("visual_kind", sa.String(50), nullable=False),
        sa.Column("visual_config", sa.JSON(), nullable=False),
        sa.Column("variation_config", sa.JSON(), nullable=False),
        sa.Column("self_checks", sa.JSON(), nullable=False),
        sa.Column("sequence_index", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_library_exercises_slug", "library_exercises", ["slug"], unique=True)
    op.create_index("ix_library_exercises_track", "library_exercises", ["track"])
    op.create_table(
        "library_attempts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("learner_id", sa.Uuid(), sa.ForeignKey("learner_profiles.id"), nullable=False),
        sa.Column("exercise_id", sa.Uuid(), sa.ForeignKey("library_exercises.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("variant_seed", sa.Integer(), nullable=False),
        sa.Column("variant_version", sa.String(30), nullable=False),
        sa.Column("variant_data", sa.JSON(), nullable=False),
        sa.Column("self_check_responses", sa.JSON()),
        sa.Column("difficulty_response", sa.String(20)),
        sa.Column("takeaway", sa.String(500)),
        sa.Column("practice_medium", sa.String(20), nullable=False),
        sa.Column("last_overlay_exported_at", sa.DateTime(timezone=True)),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_library_attempts_learner_id", "library_attempts", ["learner_id"])
    op.create_index("ix_library_attempts_exercise_id", "library_attempts", ["exercise_id"])
    op.create_index(
        "uq_library_attempt_active",
        "library_attempts",
        ["learner_id", "exercise_id"],
        unique=True,
        postgresql_where=sa.text("status = 'in_progress'"),
        sqlite_where=sa.text("status = 'in_progress'"),
    )
    op.create_table(
        "sketches",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("object_key", sa.String(300), nullable=False, unique=True),
        sa.Column("content_type", sa.String(30), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("actual_subject", sa.String(200)),
        sa.Column("purpose", sa.String(30), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "analyses",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("sketch_id", sa.Uuid(), sa.ForeignKey("sketches.id"), nullable=False),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("analysis_kind", sa.String(30), nullable=False),
        sa.Column("summary", sa.String(1000), nullable=False),
        sa.Column("strengths", sa.JSON(), nullable=False),
        sa.Column("improvements", sa.JSON(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("predicted_subject", sa.String(200)),
        sa.Column("prediction_confidence", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("sketch_id"),
    )
