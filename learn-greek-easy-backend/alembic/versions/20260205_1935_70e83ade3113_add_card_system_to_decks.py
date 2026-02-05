"""add_card_system_to_decks

Revision ID: 70e83ade3113
Revises: e21e5b9c27e9
Create Date: 2026-02-05 19:35:00.000000+00:00

Adds card_system column to decks table to distinguish between V1 (classic Card model)
and V2 (WordEntry-based) vocabulary systems.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "70e83ade3113"
down_revision: Union[str, Sequence[str], None] = "e21e5b9c27e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add card_system column to decks table."""
    # Reference existing enum (DO NOT create - it already exists from DUAL-01)
    cardsystemversion_enum = postgresql.ENUM(
        "V1",
        "V2",
        name="cardsystemversion",
        create_type=False,  # Enum already exists from DUAL-01 migration
    )

    op.add_column(
        "decks",
        sa.Column(
            "card_system",
            cardsystemversion_enum,
            nullable=False,
            server_default=sa.text("'V1'"),
            comment="Card system version: V1 (classic Card model) or V2 (WordEntry-based)",
        ),
    )

    # Create index for admin filtering queries
    op.create_index(
        op.f("ix_decks_card_system"),
        "decks",
        ["card_system"],
        unique=False,
    )


def downgrade() -> None:
    """Remove card_system column from decks table.

    NOTE: Do NOT drop cardsystemversion enum - it belongs to DUAL-01 migration.
    """
    op.drop_index(op.f("ix_decks_card_system"), table_name="decks")
    op.drop_column("decks", "card_system")
