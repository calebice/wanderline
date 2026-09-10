"""Add image-first lesson generation state."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("painting_lessons") as batch:
        batch.add_column(
            sa.Column("source_mode", sa.String(20), nullable=False, server_default="upload")
        )
        batch.add_column(sa.Column("scene_prompt", sa.String(2000)))
        batch.add_column(
            sa.Column("generation_brief", sa.JSON(), nullable=False, server_default="{}")
        )
        batch.add_column(sa.Column("approved_target_asset_id", sa.Uuid()))
        batch.add_column(sa.Column("active_render_set_id", sa.Uuid()))
    with op.batch_alter_table("lesson_assets") as batch:
        batch.add_column(sa.Column("stage_id", sa.String(80)))
        batch.add_column(sa.Column("render_set_id", sa.Uuid()))
        batch.create_index("ix_lesson_assets_stage_id", ["stage_id"])
        batch.create_index("ix_lesson_assets_render_set_id", ["render_set_id"])
    with op.batch_alter_table("lesson_generation_runs") as batch:
        batch.add_column(sa.Column("progress", sa.JSON()))
        batch.add_column(sa.Column("adjustment", sa.String(1000)))


def downgrade() -> None:
    with op.batch_alter_table("lesson_generation_runs") as batch:
        batch.drop_column("adjustment")
        batch.drop_column("progress")
    with op.batch_alter_table("lesson_assets") as batch:
        batch.drop_index("ix_lesson_assets_render_set_id")
        batch.drop_index("ix_lesson_assets_stage_id")
        batch.drop_column("render_set_id")
        batch.drop_column("stage_id")
    with op.batch_alter_table("painting_lessons") as batch:
        batch.drop_column("active_render_set_id")
        batch.drop_column("approved_target_asset_id")
        batch.drop_column("generation_brief")
        batch.drop_column("scene_prompt")
        batch.drop_column("source_mode")
