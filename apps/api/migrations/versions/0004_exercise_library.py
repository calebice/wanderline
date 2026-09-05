"""Add the independent selectable exercise library."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
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
        sa.Column("self_check_responses", sa.JSON(), nullable=True),
        sa.Column("difficulty_response", sa.String(20), nullable=True),
        sa.Column("takeaway", sa.String(500), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_library_attempts_learner_id", "library_attempts", ["learner_id"])
    op.create_index("ix_library_attempts_exercise_id", "library_attempts", ["exercise_id"])
    op.create_index(
        "uq_library_attempt_active",
        "library_attempts",
        ["learner_id", "exercise_id"],
        unique=True,
        postgresql_where=sa.text("status = 'in_progress'"),
    )


def downgrade() -> None:
    op.drop_index("uq_library_attempt_active", table_name="library_attempts")
    op.drop_index("ix_library_attempts_exercise_id", table_name="library_attempts")
    op.drop_index("ix_library_attempts_learner_id", table_name="library_attempts")
    op.drop_table("library_attempts")
    op.drop_index("ix_library_exercises_track", table_name="library_exercises")
    op.drop_index("ix_library_exercises_slug", table_name="library_exercises")
    op.drop_table("library_exercises")
