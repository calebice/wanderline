"""Durable generation operations and measured API usage."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("lesson_generation_runs") as batch:
        batch.add_column(sa.Column("idempotency_key", sa.String(100)))
        batch.add_column(sa.Column("input_snapshot", sa.JSON()))
        batch.add_column(sa.Column("checkpoints", sa.JSON()))
        batch.add_column(sa.Column("heartbeat_at", sa.DateTime(timezone=True)))
        batch.create_index(
            "uq_generation_idempotency", ["lesson_id", "idempotency_key"], unique=True
        )
    op.create_table(
        "generation_usage",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("lesson_id", sa.Uuid(), sa.ForeignKey("painting_lessons.id"), nullable=False),
        sa.Column("run_id", sa.Uuid(), sa.ForeignKey("lesson_generation_runs.id"), nullable=False),
        sa.Column("operation", sa.String(100), nullable=False),
        sa.Column("attempt", sa.Integer(), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("request_id", sa.String(200)),
        sa.Column("parameters", sa.JSON(), nullable=False),
        sa.Column("tokens", sa.JSON()),
        sa.Column("estimated_cost_usd", sa.Numeric(18, 9)),
        sa.Column("pricing_version", sa.String(40), nullable=False),
        sa.Column("latency_ms", sa.Integer()),
        sa.Column("outcome", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_generation_usage_lesson_id", "generation_usage", ["lesson_id"])
    op.create_index("ix_generation_usage_run_id", "generation_usage", ["run_id"])


def downgrade() -> None:
    op.drop_table("generation_usage")
    with op.batch_alter_table("lesson_generation_runs") as batch:
        batch.drop_index("uq_generation_idempotency")
        for name in ("heartbeat_at", "checkpoints", "input_snapshot", "idempotency_key"):
            batch.drop_column(name)
