from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "tnews_01"
down_revision: str = "sitdp_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Add scenario_el_a2 to situations
    op.add_column("situations", sa.Column("scenario_el_a2", sa.Text(), nullable=True))

    # Step 2: Backfill from news_items.title_el_a2 via situation_id FK
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
        UPDATE situations SET scenario_el_a2 = ni.title_el_a2
        FROM news_items ni
        WHERE ni.situation_id = situations.id
    """
        )
    )

    # Step 3: Drop index and 18 content columns from news_items
    op.drop_index(op.f("ix_news_items_country"), table_name="news_items")
    op.drop_column("news_items", "title_el")
    op.drop_column("news_items", "title_en")
    op.drop_column("news_items", "title_ru")
    op.drop_column("news_items", "description_el")
    op.drop_column("news_items", "description_en")
    op.drop_column("news_items", "description_ru")
    op.drop_column("news_items", "image_s3_key")
    op.drop_column("news_items", "audio_s3_key")
    op.drop_column("news_items", "audio_generated_at")
    op.drop_column("news_items", "audio_file_size_bytes")
    op.drop_column("news_items", "audio_duration_seconds")
    op.drop_column("news_items", "title_el_a2")
    op.drop_column("news_items", "description_el_a2")
    op.drop_column("news_items", "audio_a2_s3_key")
    op.drop_column("news_items", "audio_a2_generated_at")
    op.drop_column("news_items", "audio_a2_duration_seconds")
    op.drop_column("news_items", "audio_a2_file_size_bytes")
    op.drop_column("news_items", "country")
    # NOTE: Do NOT drop the newscountry enum — it is shared with situation_descriptions.country


def downgrade() -> None:
    # Re-add 18 columns as nullable (data loss accepted)
    # NOTE: Do NOT re-create newscountry enum — it was never dropped
    op.add_column(
        "news_items",
        sa.Column(
            "country",
            sa.Enum("cyprus", "greece", "world", name="newscountry", create_type=False),
            nullable=True,
        ),
    )
    op.create_index(op.f("ix_news_items_country"), "news_items", ["country"], unique=False)
    op.add_column("news_items", sa.Column("audio_a2_file_size_bytes", sa.Integer(), nullable=True))
    op.add_column("news_items", sa.Column("audio_a2_duration_seconds", sa.Float(), nullable=True))
    op.add_column(
        "news_items", sa.Column("audio_a2_generated_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("news_items", sa.Column("audio_a2_s3_key", sa.String(500), nullable=True))
    op.add_column("news_items", sa.Column("description_el_a2", sa.Text(), nullable=True))
    op.add_column("news_items", sa.Column("title_el_a2", sa.String(500), nullable=True))
    op.add_column("news_items", sa.Column("audio_duration_seconds", sa.Float(), nullable=True))
    op.add_column("news_items", sa.Column("audio_file_size_bytes", sa.Integer(), nullable=True))
    op.add_column(
        "news_items", sa.Column("audio_generated_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("news_items", sa.Column("audio_s3_key", sa.String(500), nullable=True))
    op.add_column("news_items", sa.Column("image_s3_key", sa.String(255), nullable=True))
    op.add_column("news_items", sa.Column("description_ru", sa.Text(), nullable=True))
    op.add_column("news_items", sa.Column("description_en", sa.Text(), nullable=True))
    op.add_column("news_items", sa.Column("description_el", sa.Text(), nullable=True))
    op.add_column("news_items", sa.Column("title_ru", sa.String(500), nullable=True))
    op.add_column("news_items", sa.Column("title_en", sa.String(500), nullable=True))
    op.add_column("news_items", sa.Column("title_el", sa.String(500), nullable=True))

    # Drop the situation column added in upgrade
    op.drop_column("situations", "scenario_el_a2")
