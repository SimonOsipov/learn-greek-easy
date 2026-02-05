"""create_word_entries_table

Revision ID: 1d6db2a82df0
Revises: 11f5f9165539
Create Date: 2026-02-05 12:53:27.630459+00:00

Creates the word_entries table for storing vocabulary entries linked to decks.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1d6db2a82df0"
down_revision: Union[str, Sequence[str], None] = "11f5f9165539"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create word_entries table with constraints and indexes."""
    # Reference existing enums (DO NOT create - they already exist)
    partofspeech_enum = postgresql.ENUM(
        "NOUN",
        "VERB",
        "ADJECTIVE",
        "ADVERB",
        "PHRASE",
        name="partofspeech",
        create_type=False,  # Enum already exists from WENTRY-01 migration
    )
    decklevel_enum = postgresql.ENUM(
        "A1",
        "A2",
        "B1",
        "B2",
        "C1",
        "C2",
        name="decklevel",
        create_type=False,  # Enum already exists from initial schema
    )

    op.create_table(
        "word_entries",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column(
            "deck_id",
            sa.Uuid(),
            nullable=False,
            comment="Deck this word entry belongs to",
        ),
        sa.Column(
            "lemma",
            sa.String(length=100),
            nullable=False,
            comment="Dictionary form (base form) of the word in Greek",
        ),
        sa.Column(
            "part_of_speech",
            partofspeech_enum,
            nullable=False,
            comment="Part of speech classification",
        ),
        sa.Column(
            "cefr_level",
            decklevel_enum,
            nullable=True,
            comment="CEFR level (A1-C2), overrides deck level if set",
        ),
        sa.Column(
            "translation_en",
            sa.String(length=500),
            nullable=False,
            comment="English translation(s), comma-separated for multiple meanings",
        ),
        sa.Column(
            "translation_ru",
            sa.String(length=500),
            nullable=True,
            comment="Russian translation(s), comma-separated for multiple meanings",
        ),
        sa.Column(
            "pronunciation",
            sa.String(length=200),
            nullable=True,
            comment="IPA or simplified pronunciation guide",
        ),
        sa.Column(
            "grammar_data",
            sa.JSON(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=True,
            comment="Part-of-speech specific grammar data",
        ),
        sa.Column(
            "examples",
            sa.JSON(),
            server_default=sa.text("'[]'::jsonb"),
            nullable=True,
            comment="Usage examples: [{greek, english, russian?, context?}, ...]",
        ),
        sa.Column(
            "audio_key",
            sa.String(length=500),
            nullable=True,
            comment="S3 key for audio pronunciation file",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
            comment="Soft delete flag - inactive entries are hidden from users",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when record was created",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when record was last updated",
        ),
        sa.ForeignKeyConstraint(["deck_id"], ["decks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "deck_id", "lemma", "part_of_speech", name="uq_word_entry_deck_lemma_pos"
        ),
    )
    op.create_index("ix_word_entries_cefr_level", "word_entries", ["cefr_level"], unique=False)
    op.create_index("ix_word_entries_deck_id", "word_entries", ["deck_id"], unique=False)
    op.create_index("ix_word_entries_is_active", "word_entries", ["is_active"], unique=False)
    op.create_index("ix_word_entries_lemma", "word_entries", ["lemma"], unique=False)


def downgrade() -> None:
    """Drop word_entries table and indexes.

    NOTE: Do NOT drop partofspeech enum - it belongs to WENTRY-01 migration.
    NOTE: Do NOT drop decklevel enum - it's used by other tables.
    """
    op.drop_index("ix_word_entries_lemma", table_name="word_entries")
    op.drop_index("ix_word_entries_is_active", table_name="word_entries")
    op.drop_index("ix_word_entries_deck_id", table_name="word_entries")
    op.drop_index("ix_word_entries_cefr_level", table_name="word_entries")
    op.drop_table("word_entries")
