"""sca_01_select_correct_answer

Revision ID: sca_01_select_correct_answer
Revises: sit_07_02_word_timestamps
Create Date: 2026-03-30 12:00:00.000000+00:00

Adds select_correct_answer value to exercisetype enum for comprehension
questions matching the Ellinomatheia citizenship exam format.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "sca_01_select_correct_answer"
down_revision: Union[str, Sequence[str], None] = "sit_07_02_word_timestamps"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add select_correct_answer value to exercisetype enum."""
    op.execute("ALTER TYPE exercisetype ADD VALUE IF NOT EXISTS 'select_correct_answer'")


def downgrade() -> None:
    """No-op: PostgreSQL cannot remove enum values.

    PostgreSQL does not support removing enum values directly.
    Downgrade would require:
    1. Create new enum type without select_correct_answer
    2. Update all columns using the enum
    3. Drop old enum
    4. Rename new enum

    This is complex and risky. For safety, downgrade is a no-op.
    The select_correct_answer value will remain but be unused.
    """
    pass
