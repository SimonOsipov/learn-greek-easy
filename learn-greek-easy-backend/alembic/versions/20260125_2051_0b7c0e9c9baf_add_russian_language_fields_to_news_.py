"""add russian language fields to news_items

Revision ID: 0b7c0e9c9baf
Revises: 8eb622462a2f
Create Date: 2026-01-25 20:51:33.938003+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0b7c0e9c9baf"
down_revision: Union[str, Sequence[str], None] = "8eb622462a2f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Add Russian language fields (title_ru, description_ru) to news_items table.
    For existing rows, copy English content as initial Russian content.
    """
    # Add columns as nullable first
    op.add_column(
        "news_items",
        sa.Column(
            "title_ru", sa.String(length=500), nullable=True, comment="Article title in Russian"
        ),
    )
    op.add_column(
        "news_items",
        sa.Column(
            "description_ru",
            sa.Text(),
            nullable=True,
            comment="Article description in Russian (max 1000 chars enforced at app level)",
        ),
    )

    # Copy English content to Russian for existing rows
    op.execute(
        """
        UPDATE news_items
        SET title_ru = title_en,
            description_ru = description_en
        WHERE title_ru IS NULL
    """
    )

    # Now make columns non-nullable
    op.alter_column("news_items", "title_ru", nullable=False)
    op.alter_column("news_items", "description_ru", nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("news_items", "description_ru")
    op.drop_column("news_items", "title_ru")
