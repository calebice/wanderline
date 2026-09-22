"""Add the learner-private physical color-swatch library."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "color_swatches",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("learner_id", sa.Uuid(), sa.ForeignKey("learner_profiles.id"), nullable=False),
        sa.Column("schema_version", sa.String(40), nullable=False),
        sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("palette_id", sa.String(80), nullable=False),
        sa.Column("catalog_version", sa.Integer(), nullable=False),
        sa.Column("source_recipe_id", sa.Uuid(), sa.ForeignKey("color_mix_recipes.id")),
        sa.Column("family", sa.String(40)),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("source_snapshot", sa.JSON(), nullable=False),
        sa.Column("ingredients", sa.JSON(), nullable=False),
        sa.Column("paper", sa.JSON(), nullable=False),
        sa.Column("capture", sa.JSON(), nullable=False),
        sa.Column("observations", sa.JSON(), nullable=False),
        sa.Column("notes", sa.String(4000), nullable=False),
        sa.Column("tested_on", sa.Date(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    for column in (
        "learner_id",
        "source_type",
        "palette_id",
        "source_recipe_id",
        "family",
        "tested_on",
    ):
        op.create_index(f"ix_color_swatches_{column}", "color_swatches", [column])
    op.create_table(
        "color_swatch_assets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "swatch_id",
            sa.Uuid(),
            sa.ForeignKey("color_swatches.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("original_object_key", sa.String(400), nullable=False, unique=True),
        sa.Column("display_object_key", sa.String(400), nullable=False, unique=True),
        sa.Column("original_content_type", sa.String(50), nullable=False),
        sa.Column("display_content_type", sa.String(50), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("alt_text", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("swatch_id", name="uq_color_swatch_asset_swatch_id"),
    )
    op.create_index("ix_color_swatch_assets_swatch_id", "color_swatch_assets", ["swatch_id"])


def downgrade() -> None:
    op.drop_table("color_swatch_assets")
    op.drop_table("color_swatches")
