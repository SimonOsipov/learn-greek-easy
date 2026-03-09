"""add audio_a2_s3_key to culture_questions

Revision ID: d1e2f3a4b5c6
Revises: c9e2f4a7b3d1
Create Date: 2026-03-09 10:00:00.000000+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, Sequence[str], None] = "c9e2f4a7b3d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add audio_a2_s3_key column to culture_questions and backfill from news_items.

    1. Add nullable audio_a2_s3_key column (no table lock — nullable add is safe).
    2. Backfill from linked news_items.audio_a2_s3_key for existing questions.
       Idempotent: only updates rows where audio_a2_s3_key IS NULL.
    """
    op.add_column(
        "culture_questions",
        sa.Column(
            "audio_a2_s3_key",
            sa.String(500),
            nullable=True,
            comment="S3 key for A2-level TTS-generated audio file (e.g., culture/audio/a2/{uuid}.mp3)",
        ),
    )

    # Backfill from linked news_items
    op.execute(
        """
        UPDATE culture_questions
        SET audio_a2_s3_key = news_items.audio_a2_s3_key
        FROM news_items
        WHERE culture_questions.news_item_id = news_items.id
          AND culture_questions.audio_a2_s3_key IS NULL
          AND news_items.audio_a2_s3_key IS NOT NULL
        """
    )


def downgrade() -> None:
    """Remove audio_a2_s3_key column from culture_questions."""
    op.drop_column("culture_questions", "audio_a2_s3_key")
