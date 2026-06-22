"""lexgen09_generated_content add generated_content to word_proposal

Add a nullable JSONB column ``generated_content`` to ``public.word_proposal``.

This column stores the RAG generator output (LEXGEN-09): the four lexical-content
fields that the LLM authors or selects — ``gloss_en``, ``gloss_ru``,
``example_greek``, ``example_translation``. It is the write target for
``LexgenGeneratorService.generate()`` and is kept separate from
``generated_fields`` (reconciler-owned, overwritten by LEXGEN-08) — see
LEXGEN-09 Decision Record D2 for the clobber rationale.

The column is nullable: it stays NULL until the generator step populates it.
On hard-reject (3 failed LLM attempts) it remains NULL.

Migration lesson (LEXGEN-05): this migration's round-trip test pins to
``revision="lexgen09_generated_content"`` (NOT to "head") so that future
successor migrations cannot break the downgrade -1 assertion.

Revision ID: lexgen09_generated_content
Revises: rls_word_proposal
Create Date: 2026-06-22 09:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "lexgen09_generated_content"
down_revision: Union[str, Sequence[str], None] = "rls_word_proposal"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add nullable JSONB column generated_content to word_proposal."""
    op.add_column(
        "word_proposal",
        sa.Column(
            "generated_content",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment=(
                "RAG generator output (LEXGEN-09): gloss_en, gloss_ru, example_greek, "
                "example_translation. Separate from generated_fields (reconciler-owned, "
                "overwritten) — see LEXGEN-09 D2."
            ),
        ),
    )


def downgrade() -> None:
    """Remove generated_content column from word_proposal."""
    op.drop_column("word_proposal", "generated_content")
