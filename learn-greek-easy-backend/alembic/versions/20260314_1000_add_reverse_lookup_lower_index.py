"""add reverse lookup lower index on translations

Revision ID: 82897ffb9b43
Revises: 7e807dbfe015
Create Date: 2026-03-14 10:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "82897ffb9b43"
down_revision: str | None = "7e807dbfe015"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE INDEX idx_translations_reverse_lower
        ON reference.translations (lower(translation), language)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS reference.idx_translations_reverse_lower")
