"""add_composite_index_culture_question_stats

Revision ID: 3b2f0360881c
Revises: 2f4a31fe7bbd
Create Date: 2026-01-23 21:19:21.042775+00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3b2f0360881c"
down_revision: Union[str, Sequence[str], None] = "2f4a31fe7bbd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Composite index for culture_question_stats queries
    # Used by: count_due_questions(), count_all_by_status(), etc.
    # Matches the pattern in card_statistics (ix_card_statistics_user_due_cards)
    op.create_index(
        "ix_culture_question_stats_user_due_questions",
        "culture_question_stats",
        ["user_id", "next_review_date", "status"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        "ix_culture_question_stats_user_due_questions",
        table_name="culture_question_stats",
    )
