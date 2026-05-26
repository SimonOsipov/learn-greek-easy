"""admin2_26_00_merge_heads

Merge the two independent migration heads (78dff0112c97 and exr63) into a
single linear chain before adding ADMIN2-26 migrations.

Revision ID: admin2_26_00
Revises: 78dff0112c97, exr63
Create Date: 2026-05-26 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "admin2_26_00"
down_revision: Union[str, Sequence[str], None] = ("78dff0112c97", "exr63")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
