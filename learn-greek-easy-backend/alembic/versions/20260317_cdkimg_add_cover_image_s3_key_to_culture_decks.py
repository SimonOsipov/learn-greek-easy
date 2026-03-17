"""add_cover_image_s3_key_to_culture_decks

Revision ID: cdkimg_add_culture_cover
Revises: ea11c3b477d2
Create Date: 2026-03-17 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "cdkimg_add_culture_cover"
down_revision: str | None = "ea11c3b477d2"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    """Add cover_image_s3_key column to culture_decks table."""
    op.add_column(
        "culture_decks",
        sa.Column(
            "cover_image_s3_key",
            sa.String(length=500),
            nullable=True,
            comment="S3 key for deck cover image",
        ),
    )


def downgrade() -> None:
    """Remove cover_image_s3_key column from culture_decks table."""
    op.drop_column("culture_decks", "cover_image_s3_key")
