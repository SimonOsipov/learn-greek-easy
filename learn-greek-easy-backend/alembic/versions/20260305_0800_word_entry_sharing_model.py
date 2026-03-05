"""word entry sharing model

Revision ID: b7d4e9f2a1c8
Revises: a3f8c2e1d49b
Create Date: 2026-03-05 08:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7d4e9f2a1c8"
down_revision: str = "a3f8c2e1d49b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create visibility enum type
    visibility_enum = sa.Enum("shared", "private", name="visibility")
    visibility_enum.create(op.get_bind(), checkfirst=True)

    # 2. Add owner_id column (nullable, no default needed)
    op.add_column(
        "word_entries",
        sa.Column(
            "owner_id",
            sa.Uuid(),
            nullable=True,
            comment="User who created this entry (NULL for admin/system-created)",
        ),
    )
    op.create_foreign_key(
        "fk_word_entries_owner_id_users",
        "word_entries",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_word_entries_owner_id", "word_entries", ["owner_id"])

    # 3. Add visibility column (with server_default for backfill)
    op.add_column(
        "word_entries",
        sa.Column(
            "visibility",
            sa.Enum("shared", "private", name="visibility", create_type=False),
            nullable=False,
            server_default="shared",
            comment="shared = visible to all users; private = only visible to owner",
        ),
    )
    op.create_index("ix_word_entries_visibility", "word_entries", ["visibility"])

    # 4. Create deck_word_entries junction table
    op.create_table(
        "deck_word_entries",
        sa.Column("deck_id", sa.Uuid(), nullable=False),
        sa.Column("word_entry_id", sa.Uuid(), nullable=False),
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
        sa.ForeignKeyConstraint(["word_entry_id"], ["word_entries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("deck_id", "word_entry_id"),
    )
    op.create_index(
        "ix_deck_word_entries_word_entry_id",
        "deck_word_entries",
        ["word_entry_id"],
    )

    # 5. Populate junction table from existing deck_id
    op.execute(
        """
        INSERT INTO deck_word_entries (deck_id, word_entry_id, created_at, updated_at)
        SELECT deck_id, id, now(), now() FROM word_entries
        WHERE deck_id IS NOT NULL
    """
    )

    # 6. Drop old unique constraint and deck_id index
    op.drop_constraint("uq_word_entry_deck_lemma_pos", "word_entries", type_="unique")
    op.drop_index("ix_word_entries_deck_id", table_name="word_entries")

    # 7. Drop deck_id FK and column
    op.drop_constraint("word_entries_deck_id_fkey", "word_entries", type_="foreignkey")
    op.drop_column("word_entries", "deck_id")

    # 8. Create new unique constraint (nullable-safe)
    op.execute(
        """
        ALTER TABLE word_entries
        ADD CONSTRAINT uq_word_entry_owner_lemma_pos
        UNIQUE NULLS NOT DISTINCT (owner_id, lemma, part_of_speech)
    """
    )

    # 9. Update CardRecord unique constraint
    op.drop_constraint("uq_card_record_entry_type_variant", "card_records", type_="unique")
    op.create_unique_constraint(
        "uq_card_record_deck_entry_type_variant",
        "card_records",
        ["deck_id", "word_entry_id", "card_type", "variant_key"],
    )


def downgrade() -> None:
    # Guard: check no word entry has multiple deck links
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            """
        SELECT word_entry_id, COUNT(*) as cnt
        FROM deck_word_entries
        GROUP BY word_entry_id
        HAVING COUNT(*) > 1
        LIMIT 1
    """
        )
    )
    row = result.first()
    if row:
        raise RuntimeError(
            f"Cannot downgrade: word entry {row.word_entry_id} is linked to "
            f"{row.cnt} decks. Remove extra links first."
        )

    # Also guard: check no word entry has zero junction rows (orphan - can't restore deck_id)
    orphan_result = conn.execute(
        sa.text(
            """
            SELECT id FROM word_entries
            WHERE id NOT IN (SELECT word_entry_id FROM deck_word_entries)
            LIMIT 1
        """
        )
    )
    orphan_row = orphan_result.first()
    if orphan_row:
        raise RuntimeError(
            f"Cannot downgrade: word entry {orphan_row.id} has no deck link. "
            "All word entries must be linked to exactly one deck before downgrading."
        )

    # 1. Restore CardRecord unique constraint
    op.drop_constraint("uq_card_record_deck_entry_type_variant", "card_records", type_="unique")
    op.create_unique_constraint(
        "uq_card_record_entry_type_variant",
        "card_records",
        ["word_entry_id", "card_type", "variant_key"],
    )

    # 2. Drop new unique constraint
    op.execute("ALTER TABLE word_entries DROP CONSTRAINT uq_word_entry_owner_lemma_pos")

    # 3. Re-add deck_id column
    op.add_column("word_entries", sa.Column("deck_id", sa.Uuid(), nullable=True))

    # 4. Populate deck_id from junction table
    op.execute(
        """
        UPDATE word_entries we
        SET deck_id = dwe.deck_id
        FROM deck_word_entries dwe
        WHERE dwe.word_entry_id = we.id
    """
    )

    # 5. Make deck_id NOT NULL, add FK and index
    op.alter_column("word_entries", "deck_id", nullable=False)
    op.create_foreign_key(
        "word_entries_deck_id_fkey",
        "word_entries",
        "decks",
        ["deck_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_word_entries_deck_id", "word_entries", ["deck_id"])

    # 6. Restore old unique constraint
    op.create_unique_constraint(
        "uq_word_entry_deck_lemma_pos",
        "word_entries",
        ["deck_id", "lemma", "part_of_speech"],
    )

    # 7. Drop junction table
    op.drop_index("ix_deck_word_entries_word_entry_id", table_name="deck_word_entries")
    op.drop_table("deck_word_entries")

    # 8. Drop visibility column and index
    op.drop_index("ix_word_entries_visibility", table_name="word_entries")
    op.drop_column("word_entries", "visibility")

    # 9. Drop owner_id column and FK
    op.drop_index("ix_word_entries_owner_id", table_name="word_entries")
    op.drop_constraint("fk_word_entries_owner_id_users", "word_entries", type_="foreignkey")
    op.drop_column("word_entries", "owner_id")

    # 10. Drop visibility enum type
    visibility_enum = sa.Enum("shared", "private", name="visibility")
    visibility_enum.drop(op.get_bind(), checkfirst=True)
