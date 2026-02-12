"""backfill_culture_question_image_key

Revision ID: c24dff20b712
Revises: d0bf063e5db5
Create Date: 2026-02-12 19:55:00.000000+00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c24dff20b712"
down_revision: Union[str, None] = "d0bf063e5db5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Backfill image_key on news-derived culture questions.

    Copies image_s3_key from matching news_items to culture_questions
    where the question was created from a news item (has original_article_url)
    and doesn't already have an image_key set.
    """
    op.execute(
        """
        UPDATE culture_questions
        SET image_key = news_items.image_s3_key,
            updated_at = NOW()
        FROM news_items
        WHERE culture_questions.original_article_url = news_items.original_article_url
          AND culture_questions.image_key IS NULL
          AND news_items.image_s3_key IS NOT NULL
        """
    )


def downgrade() -> None:
    """Remove backfilled image_key values from news-derived questions.

    Only nullifies image_key on rows that have an original_article_url,
    i.e., rows that were candidates for the backfill. Questions that
    received image_key from other sources are unaffected.
    """
    op.execute(
        """
        UPDATE culture_questions
        SET image_key = NULL,
            updated_at = NOW()
        WHERE original_article_url IS NOT NULL
        """
    )
