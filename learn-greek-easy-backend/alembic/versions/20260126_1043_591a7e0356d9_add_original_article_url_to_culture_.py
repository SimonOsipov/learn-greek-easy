"""add_original_article_url_to_culture_questions

Revision ID: 591a7e0356d9
Revises: 0b7c0e9c9baf
Create Date: 2026-01-26 10:43:34.989693+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "591a7e0356d9"
down_revision: Union[str, Sequence[str], None] = "0b7c0e9c9baf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Add nullable column for news article source URL to culture_questions table.
    This field stores the URL of the original news article for questions
    created from news items, enabling a "Read Article" link in the review flow.

    NOTE: This is different from source_article_url which:
    - Has a UNIQUE constraint (used for AI question generation deduplication)
    - Is used internally for preventing duplicate question generation

    original_article_url:
    - Has NO unique constraint (multiple questions can link to same news article)
    - Is displayed to users in the review flow
    """
    # Add nullable column for news article source URL
    op.add_column(
        "culture_questions",
        sa.Column(
            "original_article_url",
            sa.String(length=500),
            nullable=True,
            comment="URL of source news article for cards created from news items",
        ),
    )

    # Add partial index for efficient lookups (only non-null values)
    op.create_index(
        "ix_culture_questions_original_article_url",
        "culture_questions",
        ["original_article_url"],
        postgresql_where=sa.text("original_article_url IS NOT NULL"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop index first, then column
    op.drop_index("ix_culture_questions_original_article_url", table_name="culture_questions")
    op.drop_column("culture_questions", "original_article_url")
