"""add_phrase_to_partofspeech_enum

Revision ID: 11f5f9165539
Revises: 7e1343e75f74
Create Date: 2026-02-05 12:25:54.373799+00:00

Adds PHRASE value to partofspeech enum to support vocabulary phrase cards.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "11f5f9165539"
down_revision: Union[str, Sequence[str], None] = "7e1343e75f74"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add PHRASE value to partofspeech enum."""
    op.execute("ALTER TYPE partofspeech ADD VALUE IF NOT EXISTS 'PHRASE'")


def downgrade() -> None:
    """No-op: PostgreSQL cannot remove enum values.

    PostgreSQL does not support removing enum values directly.
    Downgrade would require:
    1. Create new enum type without PHRASE
    2. Update all columns using the enum
    3. Drop old enum
    4. Rename new enum

    This is complex and risky. For safety, downgrade is a no-op.
    The PHRASE value will remain but be unused.
    """
    pass
