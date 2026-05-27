"""nadm_06_split_situation_title_el

Adds a new nullable `title_el` Text column to the `situations` table,
separating the Greek identity title from the B2 scenario summary stored in
`scenario_el`. Backfills `title_el = scenario_el` for all existing rows so
editors retain their current title text.

Revision ID: nadm_06
Revises: admin2_26_02
Create Date: 2026-05-27 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "nadm_06"
down_revision: Union[str, Sequence[str], None] = "admin2_26_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("situations", sa.Column("title_el", sa.Text(), nullable=True))
    op.execute("UPDATE situations SET title_el = scenario_el WHERE title_el IS NULL")


def downgrade() -> None:
    op.drop_column("situations", "title_el")
