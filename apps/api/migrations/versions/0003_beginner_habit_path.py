"""Add the beginner curriculum and local learner progress."""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LOCAL_LEARNER_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")


def upgrade() -> None:
    op.create_table(
        "learner_profiles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("weekly_target", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_learner_profiles_slug", "learner_profiles", ["slug"], unique=True)
    learner_profiles = sa.table(
        "learner_profiles",
        sa.column("id", sa.Uuid()),
        sa.column("slug", sa.String()),
        sa.column("display_name", sa.String()),
        sa.column("weekly_target", sa.Integer()),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    op.bulk_insert(
        learner_profiles,
        [
            {
                "id": LOCAL_LEARNER_ID,
                "slug": "local-learner",
                "display_name": "Artist",
                "weekly_target": 3,
                "created_at": datetime.now(UTC),
            }
        ],
    )

    exercise_columns = [
        sa.Column("sequence_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("week_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "objective",
            sa.String(300),
            nullable=False,
            server_default="Practice one drawing fundamental.",
        ),
        sa.Column(
            "concept",
            sa.String(1200),
            nullable=False,
            server_default="Observe, plan, and draw with intention.",
        ),
        sa.Column(
            "why_it_matters",
            sa.String(1000),
            nullable=False,
            server_default="This skill supports clear observational drawing.",
        ),
        sa.Column(
            "common_mistake",
            sa.String(600),
            nullable=False,
            server_default="Rushing into detail before establishing the large idea.",
        ),
        sa.Column(
            "materials", sa.JSON(), nullable=False, server_default='["Paper", "Pencil or pen"]'
        ),
        sa.Column("timed_phases", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("visual_kind", sa.String(40), nullable=False, server_default="lines"),
        sa.Column("three_d_config", sa.JSON(), nullable=True),
        sa.Column(
            "replay_variation",
            sa.String(1000),
            nullable=False,
            server_default="Repeat with a simpler subject.",
        ),
    ]
    for column in exercise_columns:
        op.add_column("exercises", column)

    op.add_column("practice_sessions", sa.Column("learner_id", sa.Uuid(), nullable=True))
    op.add_column(
        "practice_sessions", sa.Column("difficulty_response", sa.String(20), nullable=True)
    )
    op.add_column("practice_sessions", sa.Column("takeaway", sa.String(500), nullable=True))
    op.execute(
        sa.text("UPDATE practice_sessions SET learner_id = :learner_id").bindparams(
            learner_id=LOCAL_LEARNER_ID
        )
    )
    op.alter_column("practice_sessions", "learner_id", nullable=False)
    op.create_foreign_key(
        "fk_practice_sessions_learner_id",
        "practice_sessions",
        "learner_profiles",
        ["learner_id"],
        ["id"],
    )

    for name in (
        "sequence_index",
        "week_number",
        "objective",
        "concept",
        "why_it_matters",
        "common_mistake",
        "materials",
        "timed_phases",
        "visual_kind",
        "replay_variation",
    ):
        op.alter_column("exercises", name, server_default=None)


def downgrade() -> None:
    op.drop_constraint("fk_practice_sessions_learner_id", "practice_sessions", type_="foreignkey")
    op.drop_column("practice_sessions", "takeaway")
    op.drop_column("practice_sessions", "difficulty_response")
    op.drop_column("practice_sessions", "learner_id")
    for name in (
        "replay_variation",
        "three_d_config",
        "visual_kind",
        "timed_phases",
        "materials",
        "common_mistake",
        "why_it_matters",
        "concept",
        "objective",
        "week_number",
        "sequence_index",
    ):
        op.drop_column("exercises", name)
    op.drop_index("ix_learner_profiles_slug", table_name="learner_profiles")
    op.drop_table("learner_profiles")
