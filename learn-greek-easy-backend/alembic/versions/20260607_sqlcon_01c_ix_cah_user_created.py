"""sqlcon_01c add ix_cah_user_created index on culture_answer_history

Composite index on (user_id, created_at) to support dashboard and projection
queries that filter by user and order/filter culture answer history by time.
Part of PERF-03 / SQLCON-01 index foundation.

Revision ID: sqlcon_01c
Revises: sqlcon_01b
Create Date: 2026-06-07 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "sqlcon_01c"
down_revision: Union[str, Sequence[str], None] = "sqlcon_01b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_cah_user_created", "culture_answer_history", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_cah_user_created", table_name="culture_answer_history")
