"""enable unaccent extension

Revision ID: 28ddf97adf4d
Revises: 897ffd7f7e1e
Create Date: 2026-02-28 10:04:41.627396+00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "28ddf97adf4d"
down_revision: Union[str, Sequence[str], None] = "897ffd7f7e1e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enable the unaccent extension for accent-insensitive Greek matching."""
    op.execute('CREATE EXTENSION IF NOT EXISTS "unaccent"')


def downgrade() -> None:
    """Remove the unaccent extension."""
    op.execute('DROP EXTENSION IF EXISTS "unaccent"')
