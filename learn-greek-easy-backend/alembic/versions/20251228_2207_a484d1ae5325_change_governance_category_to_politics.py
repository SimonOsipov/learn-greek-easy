"""change governance category to politics

Revision ID: a484d1ae5325
Revises: 9b42371754b7
Create Date: 2025-12-28 22:07:08.671652+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a484d1ae5325"
down_revision: Union[str, Sequence[str], None] = "9b42371754b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Change 'governance' category to 'politics' in culture_decks table
    op.execute("UPDATE culture_decks SET category = 'politics' WHERE category = 'governance'")


def downgrade() -> None:
    """Downgrade schema."""
    # Revert 'politics' back to 'governance' (only for entries that were changed)
    # Note: This is a best-effort downgrade - we can't distinguish original 'politics' entries
    pass
