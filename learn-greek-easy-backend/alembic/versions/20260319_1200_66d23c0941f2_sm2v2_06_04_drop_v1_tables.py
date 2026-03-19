"""sm2v2_06_04_drop_v1_tables

Revision ID: 66d23c0941f2
Revises: 2b8fa820919d
Create Date: 2026-03-19 12:00:00.000000+00:00

Drop all V1 card system tables (cards, card_statistics, reviews, user_deck_progress),
the card_system column from decks, and the cardsystemversion enum type.

V1 decks are hard-deleted first; CASCADE handles dependent rows in
deck_word_entries, cards, card_statistics, reviews, and user_deck_progress.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "66d23c0941f2"
down_revision: str | None = "2b8fa820919d"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    """Drop V1 tables, card_system column, and cardsystemversion enum.

    Order matters:
    1. DELETE V1 decks — CASCADE cleans deck_word_entries, cards,
       card_statistics, reviews, user_deck_progress rows.
    2. DROP tables in FK-safe order (children before parents).
    3. DROP card_system column from decks (must precede enum drop).
    4. DROP cardsystemversion enum type.
    """
    # 1. Hard-delete V1 decks — CASCADE handles dependent rows
    op.execute(sa.text("DELETE FROM decks WHERE card_system = 'V1'"))

    # 2. Drop tables in FK-safe order
    op.drop_table("card_statistics")
    op.drop_table("reviews")
    op.drop_table("user_deck_progress")
    op.drop_table("cards")

    # 3. Drop card_system column from decks (index first)
    op.drop_index(op.f("ix_decks_card_system"), table_name="decks")
    op.drop_column("decks", "card_system")

    # 4. Drop cardsystemversion enum type
    sa.Enum(name="cardsystemversion").drop(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    """Recreate V1 tables (empty), card_system column, and cardsystemversion enum.

    Note: This is for reference only. V1 data is permanently deleted
    and cannot be restored.
    """
    # 1. Recreate cardsystemversion enum
    cardsystemversion = postgresql.ENUM("V1", "V2", name="cardsystemversion")
    cardsystemversion.create(op.get_bind(), checkfirst=True)

    # 2. Add card_system column back to decks
    op.add_column(
        "decks",
        sa.Column(
            "card_system",
            postgresql.ENUM("V1", "V2", name="cardsystemversion", create_type=False),
            nullable=False,
            server_default=sa.text("'V2'"),
        ),
    )
    op.create_index(op.f("ix_decks_card_system"), "decks", ["card_system"], unique=False)

    # 3. Recreate cards table (final state: after classification + examples + grammar + search fields,
    #    after difficulty/order_index removal)
    op.create_table(
        "cards",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("deck_id", sa.Uuid(), nullable=False),
        sa.Column("front_text", sa.Text(), nullable=False),
        sa.Column("back_text_en", sa.Text(), nullable=False),
        sa.Column("back_text_ru", sa.Text(), nullable=True, comment="Russian translation"),
        sa.Column("example_sentence", sa.Text(), nullable=True),
        sa.Column("pronunciation", sa.String(length=255), nullable=True),
        sa.Column(
            "examples",
            sa.JSON(),
            nullable=True,
            comment="Structured examples: [{greek, english, russian, tense?}, ...]",
        ),
        sa.Column(
            "part_of_speech",
            postgresql.ENUM(
                "NOUN", "VERB", "ADJECTIVE", "ADVERB", name="partofspeech", create_type=False
            ),
            nullable=True,
            comment="Part of speech: noun, verb, adjective, adverb",
        ),
        sa.Column(
            "level",
            postgresql.ENUM(
                "A1", "A2", "B1", "B2", "C1", "C2", name="decklevel", create_type=False
            ),
            nullable=True,
            comment="CEFR level override (A1-C2), defaults to deck level if not set",
        ),
        sa.Column(
            "noun_data", sa.JSON(), nullable=True, comment="Noun grammar: gender + 8 case forms"
        ),
        sa.Column(
            "verb_data",
            sa.JSON(),
            nullable=True,
            comment="Verb grammar: voice + 30 conjugations + 2 imperative",
        ),
        sa.Column(
            "adjective_data",
            sa.JSON(),
            nullable=True,
            comment="Adjective grammar: 24 declensions + 2 comparison forms",
        ),
        sa.Column(
            "adverb_data",
            sa.JSON(),
            nullable=True,
            comment="Adverb grammar: comparative + superlative",
        ),
        sa.Column(
            "searchable_forms",
            postgresql.ARRAY(sa.String()),
            nullable=True,
            comment="All inflected forms for exact matching",
        ),
        sa.Column(
            "searchable_forms_normalized",
            postgresql.ARRAY(sa.String()),
            nullable=True,
            comment="Accent-stripped forms for fuzzy matching",
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
    )
    op.create_index(op.f("ix_cards_deck_id"), "cards", ["deck_id"], unique=False)
    op.create_index(op.f("ix_cards_level"), "cards", ["level"], unique=False)
    op.create_index(op.f("ix_cards_part_of_speech"), "cards", ["part_of_speech"], unique=False)
    op.create_index(
        "ix_cards_searchable_forms", "cards", ["searchable_forms"], postgresql_using="gin"
    )
    op.create_index(
        "ix_cards_searchable_forms_normalized",
        "cards",
        ["searchable_forms_normalized"],
        postgresql_using="gin",
    )

    # 4. Recreate user_deck_progress table
    op.create_table(
        "user_deck_progress",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("deck_id", sa.Uuid(), nullable=False),
        sa.Column("cards_studied", sa.Integer(), nullable=False),
        sa.Column("cards_mastered", sa.Integer(), nullable=False),
        sa.Column("last_studied_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "deck_id", name="uq_user_deck"),
    )
    op.create_index(
        op.f("ix_user_deck_progress_deck_id"), "user_deck_progress", ["deck_id"], unique=False
    )
    op.create_index(
        op.f("ix_user_deck_progress_user_id"), "user_deck_progress", ["user_id"], unique=False
    )

    # 5. Recreate reviews table
    op.create_table(
        "reviews",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("card_id", sa.Uuid(), nullable=False),
        sa.Column("quality", sa.Integer(), nullable=False),
        sa.Column("time_taken", sa.Integer(), nullable=False),
        sa.Column(
            "reviewed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
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
        sa.ForeignKeyConstraint(["card_id"], ["cards.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_reviews_card_id"), "reviews", ["card_id"], unique=False)
    op.create_index(op.f("ix_reviews_reviewed_at"), "reviews", ["reviewed_at"], unique=False)
    op.create_index(op.f("ix_reviews_user_id"), "reviews", ["user_id"], unique=False)

    # 6. Recreate card_statistics table
    op.create_table(
        "card_statistics",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("card_id", sa.Uuid(), nullable=False),
        sa.Column("easiness_factor", sa.Float(), nullable=False),
        sa.Column("interval", sa.Integer(), nullable=False),
        sa.Column("repetitions", sa.Integer(), nullable=False),
        sa.Column(
            "next_review_date", sa.Date(), server_default=sa.text("CURRENT_DATE"), nullable=False
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "NEW", "LEARNING", "REVIEW", "MASTERED", name="cardstatus", create_type=False
            ),
            nullable=False,
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
        sa.ForeignKeyConstraint(["card_id"], ["cards.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "card_id", name="uq_user_card"),
    )
    op.create_index(
        op.f("ix_card_statistics_card_id"), "card_statistics", ["card_id"], unique=False
    )
    op.create_index(
        op.f("ix_card_statistics_next_review_date"),
        "card_statistics",
        ["next_review_date"],
        unique=False,
    )
    op.create_index(op.f("ix_card_statistics_status"), "card_statistics", ["status"], unique=False)
    op.create_index(
        op.f("ix_card_statistics_user_id"), "card_statistics", ["user_id"], unique=False
    )
    op.create_index(
        "ix_card_statistics_user_due_cards",
        "card_statistics",
        ["user_id", "next_review_date", "status"],
        unique=False,
    )
