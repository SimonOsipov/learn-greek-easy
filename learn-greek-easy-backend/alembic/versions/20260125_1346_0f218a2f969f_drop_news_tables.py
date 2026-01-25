"""drop_news_tables

Revision ID: 0f218a2f969f
Revises: 78f11edc75df
Create Date: 2026-01-25 13:46:01.500538+00:00

This migration removes the news functionality tables:
- question_generation_logs
- source_fetch_history
- news_sources

This is a cleanup task removing unused news tab functionality.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0f218a2f969f"
down_revision: Union[str, Sequence[str], None] = "78f11edc75df"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop news-related tables.

    Order matters due to foreign key constraints:
    1. question_generation_logs (references source_fetch_history and culture_questions)
    2. source_fetch_history (references news_sources)
    3. news_sources (no dependencies)
    """
    # Drop question_generation_logs table first (has FKs to other tables)
    op.drop_table("question_generation_logs")

    # Drop source_fetch_history table (has FK to news_sources)
    op.drop_table("source_fetch_history")

    # Drop news_sources table
    op.drop_table("news_sources")


def downgrade() -> None:
    """Recreate news-related tables.

    Note: This is for reference only. The news functionality is being removed
    and data loss is acceptable.
    """
    # Recreate news_sources
    op.create_table(
        "news_sources",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("url"),
    )
    op.create_index(op.f("ix_news_sources_is_active"), "news_sources", ["is_active"], unique=False)
    op.create_index(op.f("ix_news_sources_url"), "news_sources", ["url"], unique=False)

    # Recreate source_fetch_history
    op.create_table(
        "source_fetch_history",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("source_id", sa.UUID(), nullable=False),
        sa.Column(
            "fetched_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("html_content", sa.Text(), nullable=True),
        sa.Column("html_size_bytes", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.String(length=500), nullable=True),
        sa.Column("trigger_type", sa.String(length=20), nullable=False),
        sa.Column("final_url", sa.String(length=500), nullable=True),
        sa.Column("analysis_status", sa.String(length=20), nullable=True),
        sa.Column("discovered_articles", postgresql.JSONB(), nullable=True),
        sa.Column("analysis_error", sa.Text(), nullable=True),
        sa.Column("analysis_tokens_used", sa.Integer(), nullable=True),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["source_id"], ["news_sources.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_fetch_history_source_fetched",
        "source_fetch_history",
        ["source_id", sa.text("fetched_at DESC")],
        unique=False,
    )

    # Recreate question_generation_logs
    op.create_table(
        "question_generation_logs",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("source_fetch_history_id", sa.UUID(), nullable=True),
        sa.Column("article_url", sa.String(length=500), nullable=False),
        sa.Column("article_title", sa.String(length=500), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("question_id", sa.UUID(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("tokens_used", sa.Integer(), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["question_id"], ["culture_questions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["source_fetch_history_id"], ["source_fetch_history.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_question_generation_logs_article_url"),
        "question_generation_logs",
        ["article_url"],
        unique=False,
    )
    op.create_index(
        op.f("ix_question_generation_logs_question_id"),
        "question_generation_logs",
        ["question_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_question_generation_logs_source_fetch_history_id"),
        "question_generation_logs",
        ["source_fetch_history_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_question_generation_logs_status"),
        "question_generation_logs",
        ["status"],
        unique=False,
    )
