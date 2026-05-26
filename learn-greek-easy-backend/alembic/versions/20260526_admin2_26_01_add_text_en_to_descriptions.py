"""admin2_26_01_add_text_en_to_descriptions

Adds text_en column to situation_descriptions table (ADMIN2-26 / SAR2-26-20).
Server default is empty string so existing rows are not null.

Revision ID: admin2_26_01
Revises: admin2_26_00
Create Date: 2026-05-26 00:01:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "admin2_26_01"
down_revision: Union[str, Sequence[str], None] = "admin2_26_00"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "situation_descriptions",
        sa.Column("text_en", sa.Text(), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("situation_descriptions", "text_en")
