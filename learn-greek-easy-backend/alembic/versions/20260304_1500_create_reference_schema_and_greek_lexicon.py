"""create reference schema and greek_lexicon table

Revision ID: a3f8c2e1d49b
Revises: 51b4b6100fa3
Create Date: 2026-03-04 15:00:00.000000+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3f8c2e1d49b"
down_revision: Union[str, Sequence[str], None] = "51b4b6100fa3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create reference schema and greek_lexicon table."""
    # Create the reference schema
    op.execute("CREATE SCHEMA IF NOT EXISTS reference")

    # Create the greek_lexicon table
    op.create_table(
        "greek_lexicon",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("form", sa.Text, nullable=False),
        sa.Column("lemma", sa.Text, nullable=False),
        sa.Column("pos", sa.Text, nullable=False),
        sa.Column("gender", sa.Text, nullable=True),
        sa.Column("ptosi", sa.Text, nullable=True),
        sa.Column("number", sa.Text, nullable=True),
        sa.Column("person", sa.SmallInteger, nullable=True),
        sa.Column("tense", sa.Text, nullable=True),
        sa.Column("aspect", sa.Text, nullable=True),
        sa.Column("mood", sa.Text, nullable=True),
        sa.Column("verbform", sa.Text, nullable=True),
        sa.Column("voice", sa.Text, nullable=True),
        sa.Column("degree", sa.Text, nullable=True),
        schema="reference",
    )

    # Create B-tree indexes for lookup performance
    op.create_index(
        "ix_greek_lexicon_form",
        "greek_lexicon",
        ["form"],
        schema="reference",
    )
    op.create_index(
        "ix_greek_lexicon_lemma",
        "greek_lexicon",
        ["lemma"],
        schema="reference",
    )


def downgrade() -> None:
    """Drop greek_lexicon table and reference schema."""
    op.drop_index("ix_greek_lexicon_lemma", table_name="greek_lexicon", schema="reference")
    op.drop_index("ix_greek_lexicon_form", table_name="greek_lexicon", schema="reference")
    op.drop_table("greek_lexicon", schema="reference")
    op.execute("DROP SCHEMA IF EXISTS reference")
