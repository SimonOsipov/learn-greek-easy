"""nadm_25_news_item_status

Adds NewsItemStatus enum type and status column to news_items table (NADM-25).
Backfills all existing rows to 'published' so live content remains visible.

Revision ID: nadm_25
Revises: nadm_07
Create Date: 2026-05-27 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import text

from alembic import op

revision: str = "nadm_25"
down_revision: Union[str, Sequence[str], None] = "nadm_07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create the enum type in the database
    op.execute("CREATE TYPE newsitemstatus AS ENUM ('draft', 'published')")

    # 2. Add the column with server_default='draft' NOT NULL
    op.add_column(
        "news_items",
        sa.Column(
            "status",
            sa.Enum("draft", "published", name="newsitemstatus", create_type=False),
            nullable=False,
            server_default=text("'draft'"),
            comment="Publication status: draft (hidden) or published (visible)",
        ),
    )

    # 3. Backfill all existing rows to 'published' — they are live in production
    op.execute("UPDATE news_items SET status = 'published'")


def downgrade() -> None:
    # Drop the column then drop the enum type
    op.drop_column("news_items", "status")
    op.execute("DROP TYPE newsitemstatus")
