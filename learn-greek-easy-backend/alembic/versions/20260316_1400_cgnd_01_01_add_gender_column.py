"""cgnd_01_01 add gender column to word_entries

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-03-16 14:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "d2e3f4a5b6c7"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add gender column (nullable)
    op.add_column(
        "word_entries",
        sa.Column(
            "gender",
            sa.String(20),
            nullable=True,
            comment="Grammatical gender: masculine, feminine, neuter (NULL for non-nouns / legacy)",
        ),
    )

    # 2. Backfill gender from grammar_data for existing NOUN rows
    op.execute(
        """
        UPDATE word_entries
        SET gender = grammar_data->>'gender'
        WHERE part_of_speech = 'NOUN'
          AND grammar_data->>'gender' IS NOT NULL
    """
    )

    # 3. Drop old unique constraint
    op.drop_constraint("uq_word_entry_owner_lemma_pos", "word_entries", type_="unique")

    # 4. Create new unique constraint with gender
    op.create_unique_constraint(
        "uq_word_entry_owner_lemma_pos_gender",
        "word_entries",
        ["owner_id", "lemma", "part_of_speech", "gender"],
        postgresql_nulls_not_distinct=True,
    )


def downgrade() -> None:
    # Reverse order
    op.drop_constraint("uq_word_entry_owner_lemma_pos_gender", "word_entries", type_="unique")
    op.create_unique_constraint(
        "uq_word_entry_owner_lemma_pos",
        "word_entries",
        ["owner_id", "lemma", "part_of_speech"],
        postgresql_nulls_not_distinct=True,
    )
    op.drop_column("word_entries", "gender")
