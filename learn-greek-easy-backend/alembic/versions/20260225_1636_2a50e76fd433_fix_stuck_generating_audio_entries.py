"""fix stuck generating audio entries

Revision ID: 2a50e76fd433
Revises: 3549b976ac14
Create Date: 2026-02-25 16:36:46.355379+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2a50e76fd433"
down_revision: Union[str, Sequence[str], None] = "3549b976ac14"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix any word entries stuck in GENERATING state for more than 10 minutes."""
    op.execute(
        sa.text(
            """
        UPDATE word_entries
        SET audio_status = 'FAILED'::audiostatus,
            audio_generating_since = NULL,
            updated_at = NOW()
        WHERE audio_status = 'GENERATING'::audiostatus
          AND audio_generating_since < NOW() - INTERVAL '10 minutes'
    """
        )
    )

    op.execute(
        sa.text(
            """
        UPDATE word_entries
        SET examples = (
            SELECT coalesce(json_agg(
                CASE
                    WHEN elem->>'audio_status' = 'generating'
                    THEN (elem - 'audio_generating_since') || '{"audio_status": "failed"}'::jsonb
                    ELSE elem
                END
                ORDER BY ordinality
            ), '[]'::json)
            FROM jsonb_array_elements(examples::jsonb)
                WITH ORDINALITY AS arr(elem, ordinality)
        ),
        updated_at = NOW()
        WHERE examples IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(examples::jsonb) AS e
              WHERE e->>'audio_status' = 'generating'
          )
          AND audio_generating_since < NOW() - INTERVAL '10 minutes'
    """
        )
    )


def downgrade() -> None:
    pass
