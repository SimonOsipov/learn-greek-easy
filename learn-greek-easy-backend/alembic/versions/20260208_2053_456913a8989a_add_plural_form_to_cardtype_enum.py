"""add_plural_form_to_cardtype_enum

Revision ID: 456913a8989a
Revises: 5852b50707a2
Create Date: 2026-02-08 20:53:28.549352+00:00

Adds PLURAL_FORM value to cardtype PostgreSQL enum for plural form flashcards.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "456913a8989a"
down_revision: Union[str, Sequence[str], None] = "5852b50707a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add plural_form value to cardtype enum."""
    op.execute("ALTER TYPE cardtype ADD VALUE IF NOT EXISTS 'plural_form'")


def downgrade() -> None:
    """No-op: PostgreSQL cannot remove enum values.

    PostgreSQL does not support removing individual enum values.
    The plural_form value will remain but be unused after downgrade.
    """
    pass
