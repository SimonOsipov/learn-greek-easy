"""add word_timestamps to dialog_lines for karaoke timing

Revision ID: a3b4c5d6e7f8
Revises: 7f8f1765c56f
Create Date: 2026-03-14 12:00:00.000000
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3b4c5d6e7f8"
down_revision: str | None = "7f8f1765c56f"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.add_column(
        "dialog_lines",
        sa.Column("word_timestamps", JSONB, nullable=True, server_default=None),
    )


def downgrade() -> None:
    op.drop_column("dialog_lines", "word_timestamps")
