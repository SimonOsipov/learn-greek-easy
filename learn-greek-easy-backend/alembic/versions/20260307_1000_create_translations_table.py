"""create translations table in reference schema

Revision ID: c9e2f4a7b3d1
Revises: b7d4e9f2a1c8
Create Date: 2026-03-07 10:00:00.000000+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c9e2f4a7b3d1"
down_revision: Union[str, Sequence[str], None] = "b7d4e9f2a1c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create translations table in reference schema."""
    op.create_table(
        "translations",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("lemma", sa.Text, nullable=False),
        sa.Column("language", sa.Text, nullable=False),
        sa.Column("sense_index", sa.Integer, nullable=False),
        sa.Column("translation", sa.Text, nullable=False),
        sa.Column("part_of_speech", sa.Text, nullable=True),
        sa.Column("source", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        schema="reference",
    )

    # Composite index for primary lookup: lemma + language + part_of_speech
    op.create_index(
        "idx_translations_lookup",
        "translations",
        ["lemma", "language", "part_of_speech"],
        schema="reference",
    )

    # Index for lemma + language queries (without POS filter)
    op.create_index(
        "idx_translations_lemma",
        "translations",
        ["lemma", "language"],
        schema="reference",
    )

    # Reverse lookup index: find Greek words from a translation
    op.create_index(
        "idx_translations_reverse",
        "translations",
        ["translation", "language"],
        schema="reference",
    )


def downgrade() -> None:
    """Drop translations table. Do NOT drop reference schema (shared with greek_lexicon)."""
    op.drop_index("idx_translations_reverse", table_name="translations", schema="reference")
    op.drop_index("idx_translations_lemma", table_name="translations", schema="reference")
    op.drop_index("idx_translations_lookup", table_name="translations", schema="reference")
    op.drop_table("translations", schema="reference")
