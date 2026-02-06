"""add_cardsystemversion_enum

Revision ID: e21e5b9c27e9
Revises: 1d6db2a82df0
Create Date: 2026-02-05 18:30:00.000000+00:00

Creates the cardsystemversion PostgreSQL enum type for deck card system versioning.
NOTE: Downgrade this migration before any dependent migrations (DUAL-03).
"""

from typing import Sequence, Union

from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e21e5b9c27e9"
down_revision: Union[str, Sequence[str], None] = "1d6db2a82df0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create cardsystemversion enum type."""
    cardsystemversion_enum = postgresql.ENUM(
        "V1",
        "V2",
        name="cardsystemversion",
        create_type=False,
    )
    cardsystemversion_enum.create(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    """Drop cardsystemversion enum type."""
    cardsystemversion_enum = postgresql.ENUM("V1", "V2", name="cardsystemversion")
    cardsystemversion_enum.drop(op.get_bind(), checkfirst=True)
