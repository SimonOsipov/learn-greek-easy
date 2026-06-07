"""sqlcon_01a add ix_crs_user_updated index on card_record_statistics

Composite index on (user_id, updated_at) to support dashboard and projection
queries that filter by user and order/filter by recency of vocabulary activity.
Part of PERF-03 / SQLCON-01 index foundation.

Revision ID: sqlcon_01a
Revises: onb_02
Create Date: 2026-06-07 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "sqlcon_01a"
down_revision: Union[str, Sequence[str], None] = "onb_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_crs_user_updated", "card_record_statistics", ["user_id", "updated_at"])


def downgrade() -> None:
    op.drop_index("ix_crs_user_updated", table_name="card_record_statistics")
