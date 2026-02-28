"""add immutable_unaccent function for accent-insensitive queries

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
    """Create IMMUTABLE wrapper around unaccent() for use in queries and future indexes.

    unaccent() is STABLE (not IMMUTABLE), which prevents its use in expression
    indexes. This wrapper pins the unaccent dictionary explicitly, making it
    IMMUTABLE and safe for use in both queries and expression indexes.
    """
    op.execute(
        """
        CREATE OR REPLACE FUNCTION immutable_unaccent(text)
        RETURNS text LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE AS
        $$ SELECT public.unaccent('public.unaccent', $1) $$
        """
    )


def downgrade() -> None:
    """Remove the immutable_unaccent wrapper function."""
    op.execute("DROP FUNCTION IF EXISTS immutable_unaccent(text)")
