"""nadm_07_add_alt_text_photo_credit_to_situation_pictures

Adds alt_text (VARCHAR 280, nullable) and photo_credit (VARCHAR 200, nullable)
columns to situation_pictures. These fields are displayed and edited in the
admin Image tab and are unblocked by NADM-21.

Revision ID: nadm_07
Revises: nadm_06
Create Date: 2026-05-27 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "nadm_07"
down_revision: Union[str, Sequence[str], None] = "nadm_06"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("situation_pictures", sa.Column("alt_text", sa.String(280), nullable=True))
    op.add_column("situation_pictures", sa.Column("photo_credit", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("situation_pictures", "photo_credit")
    op.drop_column("situation_pictures", "alt_text")
