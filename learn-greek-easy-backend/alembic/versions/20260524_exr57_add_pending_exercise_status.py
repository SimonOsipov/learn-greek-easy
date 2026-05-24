"""exr57_add_pending_exercise_status

Adds 'pending' value to the exercisestatus enum so exercises can be queued
for review before approval (EXR-57).

Revision ID: exr57
Revises: clte_00
Create Date: 2026-05-24 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "exr57"
down_revision: Union[str, Sequence[str], None] = "clte_00"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE exercisestatus ADD VALUE IF NOT EXISTS 'pending'")


def downgrade() -> None:
    pass  # PostgreSQL cannot remove enum values
