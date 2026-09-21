"""Add versioned color-mixing recipes and learner trials."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "color_mix_recipes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("catalog_version", sa.Integer(), nullable=False),
        sa.Column("palette_id", sa.String(80), nullable=False),
        sa.Column("recipe_slug", sa.String(100), nullable=False),
        sa.Column("family", sa.String(40), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_color_mix_recipes_family", "color_mix_recipes", ["family"])
    op.create_index(
        "uq_color_mix_recipe_version",
        "color_mix_recipes",
        ["catalog_version", "palette_id", "recipe_slug"],
        unique=True,
    )
    op.create_table(
        "color_mix_trials",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("learner_id", sa.Uuid(), sa.ForeignKey("learner_profiles.id"), nullable=False),
        sa.Column("recipe_id", sa.Uuid(), sa.ForeignKey("color_mix_recipes.id"), nullable=False),
        sa.Column("catalog_version", sa.Integer(), nullable=False),
        sa.Column("recipe_snapshot", sa.JSON(), nullable=False),
        sa.Column("adjustments", sa.JSON(), nullable=False),
        sa.Column("notes", sa.String(2000), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_color_mix_trials_learner_id", "color_mix_trials", ["learner_id"])
    op.create_index("ix_color_mix_trials_recipe_id", "color_mix_trials", ["recipe_id"])


def downgrade() -> None:
    op.drop_table("color_mix_trials")
    op.drop_table("color_mix_recipes")
