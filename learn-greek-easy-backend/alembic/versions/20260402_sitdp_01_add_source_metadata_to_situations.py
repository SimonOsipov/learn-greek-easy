"""SITDP-01: Add source metadata columns to situations.

Revision ID: sitdp_01
Revises: esq_01
Create Date: 2026-04-02 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "sitdp_01"
down_revision = "esq_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 5 nullable source metadata columns to situations
    op.add_column("situations", sa.Column("source_url", sa.Text(), nullable=True))
    op.add_column("situations", sa.Column("source_image_s3_key", sa.Text(), nullable=True))
    op.add_column("situations", sa.Column("source_title_en", sa.Text(), nullable=True))
    op.add_column("situations", sa.Column("source_title_el", sa.Text(), nullable=True))
    op.add_column("situations", sa.Column("source_title_ru", sa.Text(), nullable=True))

    # Backfill from linked news_items
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE situations SET
              source_url = ni.original_article_url,
              source_image_s3_key = ni.image_s3_key,
              source_title_en = ni.title_en,
              source_title_el = ni.title_el,
              source_title_ru = ni.title_ru
            FROM news_items ni
            WHERE ni.situation_id = situations.id
            """
        )
    )


def downgrade() -> None:
    op.drop_column("situations", "source_title_ru")
    op.drop_column("situations", "source_title_el")
    op.drop_column("situations", "source_title_en")
    op.drop_column("situations", "source_image_s3_key")
    op.drop_column("situations", "source_url")
