"""wexctx_01 drop example context from examples column comment

The placeholder example-type tag and the per-example `context` field were
removed end to end (frontend badge, backend ExampleSentence /
ExampleSentenceResponse schemas, and a one-time data cleanup that stripped the
inert `context: null` key from all production example objects). This migration
brings the `word_entries.examples` column comment in line with the model so
`alembic check` passes — it is a metadata-only change (COMMENT ON COLUMN),
no data or structural change.

Revision ID: wexctx_01
Revises: perf_09
Create Date: 2026-06-03 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "wexctx_01"
down_revision: Union[str, Sequence[str], None] = "perf_09"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_COMMENT = "Usage examples: [{id?, greek, english, russian?, context?}, ...]"
_NEW_COMMENT = "Usage examples: [{id?, greek, english, russian?}, ...]"


def upgrade() -> None:
    op.alter_column(
        "word_entries",
        "examples",
        existing_type=sa.JSON(),
        existing_nullable=True,
        existing_server_default=sa.text("'[]'::jsonb"),
        comment=_NEW_COMMENT,
        existing_comment=_OLD_COMMENT,
    )


def downgrade() -> None:
    op.alter_column(
        "word_entries",
        "examples",
        existing_type=sa.JSON(),
        existing_nullable=True,
        existing_server_default=sa.text("'[]'::jsonb"),
        comment=_OLD_COMMENT,
        existing_comment=_NEW_COMMENT,
    )
