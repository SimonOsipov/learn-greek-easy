"""pmatch_01_add_picture_matching_exercise_types

Revision ID: pmatch_01
Revises: scru_01
Create Date: 2026-05-13 12:00:00.000000+00:00

Adds select_picture_from_description and select_description_from_picture
values to the exercisetype enum for picture-description matching exercises
(SIT-26). No data backfill; schema-only enum expansion.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "pmatch_01"
down_revision: Union[str, Sequence[str], None] = "scru_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE exercisetype ADD VALUE IF NOT EXISTS 'select_picture_from_description'")
    op.execute("ALTER TYPE exercisetype ADD VALUE IF NOT EXISTS 'select_description_from_picture'")


def downgrade() -> None:
    """No-op: PostgreSQL cannot remove enum values safely."""
    pass
