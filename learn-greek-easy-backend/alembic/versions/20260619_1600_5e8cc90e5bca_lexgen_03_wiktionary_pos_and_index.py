"""lexgen-03 wiktionary_morphology pos column + (lemma, pos, gender) index

Revision ID: 5e8cc90e5bca
Revises: 1536eb298412
Create Date: 2026-06-19 16:00:00.000000+00:00

DDL only (LEXGEN-03-01): add a ``pos`` column to
``reference.wiktionary_morphology`` and replace the ``(lemma, gender)`` unique
index with ``(lemma, pos, gender)``. The ``forms`` JSONB *values* are
transformed from flat keys to feature bundles in a separate later subtask
(LEXGEN-03-02) — this migration does NOT touch row data beyond the
``server_default 'noun'`` backfill that ``ADD COLUMN`` performs automatically.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5e8cc90e5bca"
down_revision: Union[str, Sequence[str], None] = "1536eb298412"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the ``pos`` column, then swap the unique index to (lemma, pos, gender).

    Order matters: ADD COLUMN first so the ``server_default 'noun'`` backfills
    every existing (noun-only) row before the new unique index is built over a
    fully-populated ``pos``.
    """
    op.add_column(
        "wiktionary_morphology",
        sa.Column(
            "pos",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'noun'"),
            comment="Part of speech as free-text (POS-neutral — no enum; existing rows backfill to 'noun')",
        ),
        schema="reference",
    )
    op.drop_index(
        "uq_wiktionary_morphology_lemma_gender",
        table_name="wiktionary_morphology",
        schema="reference",
    )
    op.create_index(
        "uq_wiktionary_morphology_lemma_pos_gender",
        "wiktionary_morphology",
        ["lemma", "pos", "gender"],
        unique=True,
        schema="reference",
    )


def downgrade() -> None:
    """Reverse exactly: drop the 3-col unique index, drop ``pos``, restore the
    original ``(lemma, gender)`` unique index."""
    op.drop_index(
        "uq_wiktionary_morphology_lemma_pos_gender",
        table_name="wiktionary_morphology",
        schema="reference",
    )
    op.drop_column("wiktionary_morphology", "pos", schema="reference")
    op.create_index(
        "uq_wiktionary_morphology_lemma_gender",
        "wiktionary_morphology",
        ["lemma", "gender"],
        unique=True,
        schema="reference",
    )
