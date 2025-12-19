"""add_preferred_language_to_user_settings

Revision ID: 2c5f04bd7dfd
Revises: 75d4214a9e4f
Create Date: 2025-12-19 12:06:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2c5f04bd7dfd"
down_revision: Union[str, Sequence[str], None] = "75d4214a9e4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add preferred_language column to user_settings table."""
    op.add_column(
        "user_settings",
        sa.Column(
            "preferred_language",
            sa.String(length=10),
            nullable=True,
            comment="ISO 639-1 language code (e.g., 'en', 'el')",
        ),
    )


def downgrade() -> None:
    """Remove preferred_language column from user_settings table."""
    op.drop_column("user_settings", "preferred_language")
