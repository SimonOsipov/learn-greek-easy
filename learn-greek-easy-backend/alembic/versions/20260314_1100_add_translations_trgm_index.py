"""add trigram GIN index on translations for reverse lookup fuzzy search

Revision ID: a1b2c3d4e5f6
Revises: 82897ffb9b43
Create Date: 2026-03-14 11:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "82897ffb9b43"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            """
            CREATE INDEX CONCURRENTLY idx_translations_trgm
            ON reference.translations USING gin (translation gin_trgm_ops)
            """
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS reference.idx_translations_trgm")
