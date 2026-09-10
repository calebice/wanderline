"""Add reusable photo-to-lesson persistence."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "painting_lessons",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("learner_id", sa.Uuid(), sa.ForeignKey("learner_profiles.id"), nullable=False),
        sa.Column("schema_version", sa.String(40), nullable=False),
        sa.Column("template", sa.String(40), nullable=False),
        sa.Column("medium", sa.String(40), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("subject", sa.String(200)),
        sa.Column("artistic_context", sa.String(1000)),
        sa.Column("difficulty", sa.String(20), nullable=False),
        sa.Column("estimated_duration_minutes", sa.Integer(), nullable=False),
        sa.Column("content", sa.JSON()),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("saved_at", sa.DateTime(timezone=True)),
        sa.Column("generation_status", sa.String(20), nullable=False),
        sa.Column("generation_error", sa.JSON()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_painting_lessons_learner_id", "painting_lessons", ["learner_id"])
    op.create_table(
        "lesson_assets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "lesson_id",
            sa.Uuid(),
            sa.ForeignKey("painting_lessons.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("original_object_key", sa.String(400), nullable=False, unique=True),
        sa.Column("display_object_key", sa.String(400), nullable=False, unique=True),
        sa.Column("original_content_type", sa.String(50), nullable=False),
        sa.Column("display_content_type", sa.String(50), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("alt_text", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_lesson_assets_lesson_id", "lesson_assets", ["lesson_id"])
    op.create_index(
        "uq_lesson_primary_reference",
        "lesson_assets",
        ["lesson_id"],
        unique=True,
        postgresql_where=sa.text("is_primary = true AND role = 'original_reference'"),
        sqlite_where=sa.text("is_primary = 1 AND role = 'original_reference'"),
    )
    op.create_table(
        "lesson_generation_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "lesson_id",
            sa.Uuid(),
            sa.ForeignKey("painting_lessons.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("scope", sa.String(20), nullable=False),
        sa.Column("section_key", sa.String(100)),
        sa.Column("include_study_image", sa.Boolean(), nullable=False),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("result", sa.JSON()),
        sa.Column("error_code", sa.String(80)),
        sa.Column("error_message", sa.Text()),
        sa.Column("recoverable", sa.Boolean(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("queued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_lesson_generation_runs_lesson_id", "lesson_generation_runs", ["lesson_id"])


def downgrade() -> None:
    op.drop_index("ix_lesson_generation_runs_lesson_id", table_name="lesson_generation_runs")
    op.drop_table("lesson_generation_runs")
    op.drop_index("uq_lesson_primary_reference", table_name="lesson_assets")
    op.drop_index("ix_lesson_assets_lesson_id", table_name="lesson_assets")
    op.drop_table("lesson_assets")
    op.drop_index("ix_painting_lessons_learner_id", table_name="painting_lessons")
    op.drop_table("painting_lessons")
