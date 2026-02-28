"""add unaccent functional index on word_entries

Revision ID: 6011531b4324
Revises: 28ddf97adf4d
Create Date: 2026-02-28 11:10:32.152589+00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6011531b4324"
down_revision: Union[str, Sequence[str], None] = "28ddf97adf4d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add functional index for accent-insensitive lemma lookup."""
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_word_entries_unaccent_lemma_pos_active
        ON word_entries (unaccent(lemma), part_of_speech, is_active)
        """
    )


def downgrade() -> None:
    """Remove functional index for accent-insensitive lemma lookup."""
    op.execute("DROP INDEX IF EXISTS ix_word_entries_unaccent_lemma_pos_active")
