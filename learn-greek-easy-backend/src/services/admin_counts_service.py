"""Admin tab counts service.

Computes the aggregate badge counts for each /admin section tab via a single
database round-trip using parallel COUNT queries.
"""

import asyncio

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Executable

from src.db.models import (
    AnnouncementCampaign,
    CardErrorReport,
    CardErrorStatus,
    ChangelogEntry,
    CultureDeck,
    Deck,
    Exercise,
    Feedback,
    FeedbackStatus,
    NewsItem,
    Situation,
)
from src.schemas.admin import AdminTabCountsResponse


async def _count_active_decks(db: AsyncSession) -> int:
    """Return total active vocab + culture deck count.

    Extracted from get_admin_stats for reuse. Executes two queries and sums
    them; kept separate so each table uses its own COUNT for correctness.
    """
    vocab_result = await db.execute(select(func.count(Deck.id)).where(Deck.is_active.is_(True)))
    vocab_count = vocab_result.scalar() or 0

    culture_result = await db.execute(
        select(func.count(CultureDeck.id)).where(CultureDeck.is_active.is_(True))
    )
    culture_count = culture_result.scalar() or 0

    return vocab_count + culture_count


class AdminCountsService:
    """Service that gathers all admin tab badge counts in one batch."""

    async def get_tab_counts(self, db: AsyncSession) -> AdminTabCountsResponse:
        """Return aggregate counts for the admin section-tab badges.

        Runs all COUNT queries concurrently via asyncio.gather, except for
        decks which needs two sequential queries (vocab + culture). The inbox
        composite (new_feedback + pending_errors) is derived in Python from
        the gathered results — no extra query.

        Args:
            db: Active async database session.

        Returns:
            AdminTabCountsResponse with all nine badge counts.
        """
        (
            new_feedback,
            total_feedback,
            pending_errors,
            news,
            situations,
            exercises,
            changelog,
            announcements,
        ) = await asyncio.gather(
            _scalar(
                db, select(func.count(Feedback.id)).where(Feedback.status == FeedbackStatus.NEW)
            ),
            _scalar(db, select(func.count(Feedback.id))),
            _scalar(
                db,
                select(func.count(CardErrorReport.id)).where(
                    CardErrorReport.status == CardErrorStatus.PENDING
                ),
            ),
            _scalar(db, select(func.count(NewsItem.id))),
            _scalar(db, select(func.count(Situation.id))),
            _scalar(db, select(func.count(Exercise.id))),
            _scalar(db, select(func.count(ChangelogEntry.id))),
            _scalar(db, select(func.count(AnnouncementCampaign.id))),
        )

        decks = await _count_active_decks(db)

        return AdminTabCountsResponse(
            inbox=new_feedback + pending_errors,
            decks=decks,
            news=news,
            situations=situations,
            exercises=exercises,
            errors=pending_errors,
            feedback=total_feedback,
            changelog=changelog,
            announcements=announcements,
        )


async def _scalar(db: AsyncSession, stmt: Executable) -> int:
    """Execute a scalar COUNT query and return the result as a non-negative int."""
    result = await db.execute(stmt)
    return result.scalar() or 0
