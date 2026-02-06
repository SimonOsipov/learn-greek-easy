"""change_deck_card_system_default_to_v2

Revision ID: a1b2c3d4e5f6
Revises: 5e205ed1ffec
Create Date: 2026-02-06

Changes the default value of decks.card_system from V1 to V2.
Only affects newly created rows; existing rows retain their current value.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "5e205ed1ffec"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Change decks.card_system default from V1 to V2."""
    op.alter_column(
        "decks",
        "card_system",
        server_default=sa.text("'V2'"),
    )


def downgrade() -> None:
    """Revert decks.card_system default back to V1."""
    op.alter_column(
        "decks",
        "card_system",
        server_default=sa.text("'V1'"),
    )
