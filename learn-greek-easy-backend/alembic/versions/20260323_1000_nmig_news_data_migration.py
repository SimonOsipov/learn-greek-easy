"""NMIG: news-to-situation data migration

Revision ID: nmig_news_data_migration
Revises: sit_04_drop_created_by
Create Date: 2026-03-23 10:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "nmig_news_data_migration"
down_revision = "sit_04_drop_created_by"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Step 0: Drop cefr_level from situations (NOT NULL, no default — must go before data INSERT)
    op.drop_column("situations", "cefr_level")

    # Step 1: Add text_el_a2 to situation_descriptions
    op.add_column("situation_descriptions", sa.Column("text_el_a2", sa.Text(), nullable=True))

    # Step 2: Add situation_id FK to news_items
    op.add_column(
        "news_items",
        sa.Column("situation_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        None,
        "news_items",
        "situations",
        ["situation_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_news_items_situation_id"), "news_items", ["situation_id"])

    # Step 3: Drop legacy columns from situation_descriptions
    op.drop_column("situation_descriptions", "full_article_text")
    op.drop_column("situation_descriptions", "news_date")
    op.drop_column("situation_descriptions", "original_language")

    # Step 4: Data migration via temp table
    conn.execute(
        sa.text(
            """
        CREATE TEMP TABLE _nmig_mapping AS
        SELECT
            ni.id AS news_item_id,
            gen_random_uuid() AS situation_id
        FROM news_items ni
    """
        )
    )

    conn.execute(
        sa.text(
            """
        INSERT INTO situations (id, scenario_el, scenario_en, scenario_ru, status, created_at, updated_at)
        SELECT
            m.situation_id,
            ni.title_el,
            ni.title_en,
            ni.title_ru,
            'draft'::situationstatus,
            NOW(),
            NOW()
        FROM _nmig_mapping m
        JOIN news_items ni ON ni.id = m.news_item_id
    """
        )
    )

    conn.execute(
        sa.text(
            """
        INSERT INTO situation_descriptions (
            id, situation_id, text_el, text_el_a2,
            source_type, audio_s3_key, audio_a2_s3_key,
            audio_duration_seconds, audio_a2_duration_seconds,
            source_url, country, status,
            created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            m.situation_id,
            ni.description_el,
            ni.description_el_a2,
            'news'::descriptionsourcetype,
            ni.audio_s3_key,
            ni.audio_a2_s3_key,
            ni.audio_duration_seconds,
            ni.audio_a2_duration_seconds,
            ni.original_article_url,
            ni.country,
            'draft'::descriptionstatus,
            NOW(),
            NOW()
        FROM _nmig_mapping m
        JOIN news_items ni ON ni.id = m.news_item_id
    """
        )
    )

    conn.execute(
        sa.text(
            """
        UPDATE news_items
        SET situation_id = m.situation_id
        FROM _nmig_mapping m
        WHERE news_items.id = m.news_item_id
    """
        )
    )

    conn.execute(sa.text("DROP TABLE _nmig_mapping"))

    # Step 5: Validation (use news-specific count — pre-existing dialog situations may exist)
    new_sit_count = conn.execute(
        sa.text(
            """
        SELECT count(*) FROM situations s
        JOIN situation_descriptions sd ON sd.situation_id = s.id
        WHERE sd.source_type = 'news'
    """
        )
    ).scalar()
    news_count = conn.execute(sa.text("SELECT count(*) FROM news_items")).scalar()
    if new_sit_count != news_count:
        raise RuntimeError(
            f"Migration validation failed: news situations ({new_sit_count}) != news_items ({news_count})"
        )

    null_sit_count = conn.execute(
        sa.text("SELECT count(*) FROM news_items WHERE situation_id IS NULL")
    ).scalar()
    if null_sit_count > 0:
        raise RuntimeError(
            f"Migration validation failed: {null_sit_count} news_items have NULL situation_id"
        )


def downgrade() -> None:
    conn = op.get_bind()

    # 1. Delete news-sourced situations (CASCADE removes their descriptions)
    conn.execute(
        sa.text(
            """
        DELETE FROM situations
        WHERE id IN (
            SELECT situation_id FROM situation_descriptions
            WHERE source_type = 'news'
        )
    """
        )
    )

    # 2. Drop situation_id from news_items (FK constraint dropped automatically with column)
    op.drop_index(op.f("ix_news_items_situation_id"), table_name="news_items")
    op.drop_column("news_items", "situation_id")

    # 3. Re-add legacy columns to situation_descriptions
    op.add_column(
        "situation_descriptions", sa.Column("full_article_text", sa.Text(), nullable=True)
    )
    op.add_column("situation_descriptions", sa.Column("news_date", sa.Date(), nullable=True))
    op.add_column(
        "situation_descriptions", sa.Column("original_language", sa.Text(), nullable=True)
    )

    # 4. Drop text_el_a2 from situation_descriptions
    op.drop_column("situation_descriptions", "text_el_a2")

    # 5. Re-add cefr_level to situations (restored nullable since data is lost)
    op.add_column(
        "situations",
        sa.Column("cefr_level", sa.Text(), nullable=True),
    )
