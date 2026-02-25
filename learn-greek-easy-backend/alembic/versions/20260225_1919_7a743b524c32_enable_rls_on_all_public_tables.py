"""Enable RLS on all public tables to block PostgREST access

Revision ID: 7a743b524c32
Revises: 2a50e76fd433
Create Date: 2026-02-25 19:19:58.131858+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7a743b524c32"
down_revision: Union[str, Sequence[str], None] = "2a50e76fd433"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLES = [
    "achievements",
    "alembic_version",
    "announcement_campaigns",
    "card_error_reports",
    "card_records",
    "card_statistics",
    "cards",
    "changelog_entries",
    "culture_answer_history",
    "culture_decks",
    "culture_question_stats",
    "culture_questions",
    "decks",
    "feedback",
    "feedback_votes",
    "mock_exam_answers",
    "mock_exam_sessions",
    "news_items",
    "notifications",
    "reviews",
    "user_achievements",
    "user_deck_progress",
    "user_settings",
    "user_xp",
    "users",
    "webhook_events",
    "word_entries",
    "xp_transactions",
]


def upgrade() -> None:
    """Enable RLS on all public tables.

    No policies are created — anon/authenticated roles (PostgREST)
    are denied all access by default. The postgres owner role
    (SQLAlchemy backend) bypasses RLS automatically.
    """
    for table in TABLES:
        op.execute(sa.text(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY"))


def downgrade() -> None:
    """Disable RLS on all public tables."""
    for table in TABLES:
        op.execute(sa.text(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY"))
