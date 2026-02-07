"""rename_card_error_vocabulary_to_word

Revision ID: 663bf29ea685
Revises: db4bb3c354f2
Create Date: 2026-02-07 11:41:33.882042+00:00

Renames the PostgreSQL enum value 'VOCABULARY' to 'WORD' in the
carderrorcardtype enum. Truncates card_error_reports first to avoid
any edge-case issues during the rename.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "663bf29ea685"
down_revision: Union[str, Sequence[str], None] = "db4bb3c354f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Truncate card_error_reports and rename VOCABULARY -> WORD."""
    op.execute("TRUNCATE TABLE card_error_reports")
    op.execute("ALTER TYPE carderrorcardtype RENAME VALUE 'VOCABULARY' TO 'WORD'")


def downgrade() -> None:
    """Truncate card_error_reports and rename WORD -> VOCABULARY."""
    op.execute("TRUNCATE TABLE card_error_reports")
    op.execute("ALTER TYPE carderrorcardtype RENAME VALUE 'WORD' TO 'VOCABULARY'")
