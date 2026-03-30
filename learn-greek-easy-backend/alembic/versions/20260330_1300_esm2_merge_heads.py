"""Merge ESM2-01 and SCA-01 heads.

Revision ID: esm2_merge_heads
Revises: esm2_01, sca_01_select_correct_answer
Create Date: 2026-03-30 13:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "esm2_merge_heads"
down_revision: tuple[str, str] = ("esm2_01", "sca_01_select_correct_answer")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
