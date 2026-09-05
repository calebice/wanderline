"""Add durable Style Lab recipes and before/after study artifacts."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "style_recipes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("learner_id", sa.Uuid(), sa.ForeignKey("learner_profiles.id"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("dimensions", sa.JSON(), nullable=False),
        sa.Column("favorite", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("source_attempt_id", sa.Uuid(), sa.ForeignKey("library_attempts.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_style_recipes_learner_id", "style_recipes", ["learner_id"])
    op.create_table(
        "style_study_artifacts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("attempt_id", sa.Uuid(), sa.ForeignKey("library_attempts.id"), nullable=False),
        sa.Column("sketch_id", sa.Uuid(), sa.ForeignKey("sketches.id"), nullable=False),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("attempt_id", "role", name="uq_style_artifact_attempt_role"),
    )
    op.create_index("ix_style_artifacts_attempt_id", "style_study_artifacts", ["attempt_id"])


def downgrade() -> None:
    op.drop_index("ix_style_artifacts_attempt_id", table_name="style_study_artifacts")
    op.drop_table("style_study_artifacts")
    op.drop_index("ix_style_recipes_learner_id", table_name="style_recipes")
    op.drop_table("style_recipes")
