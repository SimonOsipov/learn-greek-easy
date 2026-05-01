"""GAMIF-03-01: Add projection_version column to user_xp and user_achievements.

Revision ID: gamif_03_01
Revises: ncrud_01
Create Date: 2026-05-01 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "gamif_03_01"
down_revision: str | None = "ncrud_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_xp",
        sa.Column(
            "projection_version",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "user_achievements",
        sa.Column(
            "projection_version",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("user_achievements", "projection_version")
    op.drop_column("user_xp", "projection_version")
