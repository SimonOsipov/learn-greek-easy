"""add_article_to_cardtype_enum

Revision ID: d8c84a489918
Revises: cb083902fa3c
Create Date: 2026-02-09 07:24:58.692143+00:00

Adds ARTICLE value to cardtype PostgreSQL enum for article flashcards.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d8c84a489918"
down_revision: Union[str, Sequence[str], None] = "cb083902fa3c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add article value to cardtype enum."""
    op.execute("ALTER TYPE cardtype ADD VALUE IF NOT EXISTS 'article'")


def downgrade() -> None:
    """No-op: PostgreSQL cannot remove enum values.

    PostgreSQL does not support removing individual enum values.
    The article value will remain but be unused after downgrade.
    """
    pass
