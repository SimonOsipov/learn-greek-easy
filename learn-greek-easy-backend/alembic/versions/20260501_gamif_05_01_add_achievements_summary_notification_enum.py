"""GAMIF-05-01: Add achievements_summary notification enum value.

Revision ID: gamif_05_01
Revises: gamif_03_01
Create Date: 2026-05-01 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "gamif_05_01"
down_revision: str | None = "gamif_03_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'ACHIEVEMENTS_SUMMARY'")


def downgrade() -> None:
    pass  # Postgres cannot drop enum values; matches prior enum migrations
