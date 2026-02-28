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
    """Add immutable unaccent wrapper and functional index for accent-insensitive lemma lookup."""
    # unaccent() is STABLE, not IMMUTABLE, so it cannot be used directly in an
    # expression index. Create an IMMUTABLE wrapper that pins the unaccent dictionary.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION immutable_unaccent(text)
        RETURNS text LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE AS
        $$ SELECT public.unaccent('public.unaccent', $1) $$
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_word_entries_unaccent_lemma_pos_active
        ON word_entries (immutable_unaccent(lemma), part_of_speech, is_active)
        """
    )


def downgrade() -> None:
    """Remove functional index and immutable unaccent wrapper."""
    op.execute("DROP INDEX IF EXISTS ix_word_entries_unaccent_lemma_pos_active")
    op.execute("DROP FUNCTION IF EXISTS immutable_unaccent(text)")
