"""onb_02 add proficiency_level and learning_goal to user_settings

Adds two nullable String(10) columns to user_settings to capture onboarding
answers: the user's self-rated Greek proficiency level and their learning goal/
motivation. Both default to NULL (existing rows unaffected).

Revision ID: onb_02
Revises: wexctx_01
Create Date: 2026-06-04 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "onb_02"
down_revision: Union[str, Sequence[str], None] = "wexctx_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column("proficiency_level", sa.String(length=10), nullable=True),
    )
    op.add_column(
        "user_settings",
        sa.Column("learning_goal", sa.String(length=10), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_settings", "learning_goal")
    op.drop_column("user_settings", "proficiency_level")
