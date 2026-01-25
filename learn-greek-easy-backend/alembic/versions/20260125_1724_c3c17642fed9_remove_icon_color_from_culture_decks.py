"""remove_icon_color_from_culture_decks

Revision ID: c3c17642fed9
Revises: 0f218a2f969f
Create Date: 2026-01-25 17:24:44.186649+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3c17642fed9"
down_revision: Union[str, Sequence[str], None] = "0f218a2f969f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column("culture_decks", "icon")
    op.drop_column("culture_decks", "color_accent")


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        "culture_decks",
        sa.Column("icon", sa.String(50), nullable=False, server_default="book-open"),
    )
    op.add_column(
        "culture_decks",
        sa.Column("color_accent", sa.String(7), nullable=False, server_default="#4F46E5"),
    )
