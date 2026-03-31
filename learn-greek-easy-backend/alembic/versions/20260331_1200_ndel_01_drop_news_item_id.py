"""ndel_01 drop news_item_id from culture_questions

Revision ID: ndel_01
Revises: cqmig_02
Create Date: 2026-03-31 12:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "ndel_01"
down_revision = "cqmig_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Count and delete news-derived culture questions
    result = conn.execute(
        sa.text("SELECT COUNT(*) FROM culture_questions WHERE news_item_id IS NOT NULL")
    )
    count = result.scalar()
    print(f"[ndel_01] Deleting {count} news-derived culture question rows")
    op.execute("DELETE FROM culture_questions WHERE news_item_id IS NOT NULL")

    # 2. Find and delete the "Cyprus News" culture deck
    result = conn.execute(
        sa.text("SELECT id, name_en FROM culture_decks WHERE name_en ILIKE '%news%'")
    )
    rows = result.fetchall()
    if rows:
        for row in rows:
            print(f"[ndel_01] Deleting culture deck: id={row[0]}, name_en={row[1]!r}")
        op.execute("DELETE FROM culture_decks WHERE name_en ILIKE '%news%'")
    else:
        print("[ndel_01] WARNING: No culture deck with 'news' in name_en found")

    # 3. Drop FK constraint
    op.execute(
        "ALTER TABLE culture_questions DROP CONSTRAINT IF EXISTS "
        "fk_culture_questions_news_item_id_news_items"
    )

    # 4. Drop index
    op.execute("DROP INDEX IF EXISTS ix_culture_questions_news_item_id")

    # 5. Drop column
    op.execute("ALTER TABLE culture_questions DROP COLUMN IF EXISTS news_item_id")


def downgrade() -> None:
    # Restore schema only — data is not restored
    op.execute("ALTER TABLE culture_questions ADD COLUMN IF NOT EXISTS " "news_item_id UUID NULL")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_culture_questions_news_item_id "
        "ON culture_questions (news_item_id)"
    )
    op.execute(
        "ALTER TABLE culture_questions ADD CONSTRAINT "
        "fk_culture_questions_news_item_id_news_items "
        "FOREIGN KEY (news_item_id) REFERENCES news_items(id) ON DELETE SET NULL"
    )
