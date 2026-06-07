"""sqlcon_01b add ix_mes_user_started index on mock_exam_sessions

Composite index on (user_id, started_at) to support dashboard and projection
queries that filter by user and order/filter mock exam sessions by start time.
Part of PERF-03 / SQLCON-01 index foundation.

Revision ID: sqlcon_01b
Revises: sqlcon_01a
Create Date: 2026-06-07 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "sqlcon_01b"
down_revision: Union[str, Sequence[str], None] = "sqlcon_01a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_mes_user_started", "mock_exam_sessions", ["user_id", "started_at"])


def downgrade() -> None:
    op.drop_index("ix_mes_user_started", table_name="mock_exam_sessions")
