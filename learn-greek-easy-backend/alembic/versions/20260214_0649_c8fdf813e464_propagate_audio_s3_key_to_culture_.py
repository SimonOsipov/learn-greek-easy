"""propagate audio_s3_key to culture_questions

Revision ID: c8fdf813e464
Revises: aed6e9269356
Create Date: 2026-02-14 06:49:38.871612+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c8fdf813e464"
down_revision: Union[str, Sequence[str], None] = "aed6e9269356"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Propagate audio_s3_key from news_items to linked culture_questions.

    Updates culture_questions with audio_s3_key from their linked news_items
    where the culture question doesn't already have audio but the news item does.
    This is idempotent - only updates rows where audio_s3_key IS NULL.
    """
    op.execute(
        """
        UPDATE culture_questions
        SET audio_s3_key = news_items.audio_s3_key
        FROM news_items
        WHERE culture_questions.news_item_id = news_items.id
          AND culture_questions.audio_s3_key IS NULL
          AND news_items.audio_s3_key IS NOT NULL
        """
    )


def downgrade() -> None:
    """Remove propagated audio_s3_key values from culture_questions.

    Nullifies audio_s3_key on culture_questions that have a news_item_id,
    i.e., rows that were candidates for the propagation.
    """
    op.execute(
        """
        UPDATE culture_questions
        SET audio_s3_key = NULL
        WHERE news_item_id IS NOT NULL
        """
    )
