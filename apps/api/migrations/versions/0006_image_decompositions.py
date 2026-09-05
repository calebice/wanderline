"""Distinguish sketch critique from reference-image decomposition."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "sketches",
        sa.Column("purpose", sa.String(30), nullable=False, server_default="sketch_critique"),
    )
    op.add_column(
        "analyses",
        sa.Column("analysis_kind", sa.String(30), nullable=False, server_default="sketch_critique"),
    )


def downgrade() -> None:
    op.drop_column("analyses", "analysis_kind")
    op.drop_column("sketches", "purpose")
