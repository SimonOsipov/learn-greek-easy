"""add_classification_fields_to_cards

Revision ID: c14242885019
Revises: 14c4b1b4a7a8
Create Date: 2026-01-29 12:08:24.680950+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c14242885019"
down_revision: Union[str, Sequence[str], None] = "14c4b1b4a7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create the PartOfSpeech enum type (if not exists)
    partofspeech = sa.Enum("NOUN", "VERB", "ADJECTIVE", "ADVERB", name="partofspeech")
    partofspeech.create(op.get_bind(), checkfirst=True)

    # Step 1: Add new columns (back_text_en as nullable initially)
    op.add_column("cards", sa.Column("back_text_en", sa.Text(), nullable=True))
    op.add_column(
        "cards", sa.Column("back_text_ru", sa.Text(), nullable=True, comment="Russian translation")
    )
    op.add_column(
        "cards",
        sa.Column(
            "part_of_speech",
            partofspeech,
            nullable=True,
            comment="Part of speech: noun, verb, adjective, adverb",
        ),
    )
    # decklevel enum already exists from decks table, reuse it
    op.add_column(
        "cards",
        sa.Column(
            "level",
            sa.Enum("A1", "A2", "B1", "B2", "C1", "C2", name="decklevel", create_type=False),
            nullable=True,
            comment="CEFR level override (A1-C2), defaults to deck level if not set",
        ),
    )

    # Step 2: Copy data from back_text to back_text_en
    op.execute("UPDATE cards SET back_text_en = back_text WHERE back_text_en IS NULL")

    # Step 3: Make back_text_en NOT NULL
    op.alter_column("cards", "back_text_en", nullable=False)

    # Step 4: Create indexes
    op.create_index(op.f("ix_cards_level"), "cards", ["level"], unique=False)
    op.create_index(op.f("ix_cards_part_of_speech"), "cards", ["part_of_speech"], unique=False)

    # Step 5: Drop old column
    op.drop_column("cards", "back_text")


def downgrade() -> None:
    """Downgrade schema."""
    # Step 1: Add back_text column (nullable initially)
    op.add_column("cards", sa.Column("back_text", sa.TEXT(), autoincrement=False, nullable=True))

    # Step 2: Copy data from back_text_en to back_text
    op.execute("UPDATE cards SET back_text = back_text_en WHERE back_text IS NULL")

    # Step 3: Make back_text NOT NULL
    op.alter_column("cards", "back_text", nullable=False)

    # Step 4: Drop indexes
    op.drop_index(op.f("ix_cards_part_of_speech"), table_name="cards")
    op.drop_index(op.f("ix_cards_level"), table_name="cards")

    # Step 5: Drop new columns
    op.drop_column("cards", "level")
    op.drop_column("cards", "part_of_speech")
    op.drop_column("cards", "back_text_ru")
    op.drop_column("cards", "back_text_en")

    # Drop the PartOfSpeech enum type
    partofspeech = sa.Enum("NOUN", "VERB", "ADJECTIVE", "ADVERB", name="partofspeech")
    partofspeech.drop(op.get_bind(), checkfirst=True)
