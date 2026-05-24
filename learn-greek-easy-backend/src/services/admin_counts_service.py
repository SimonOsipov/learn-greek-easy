"""Admin tab counts service.

Computes the aggregate badge counts for each /admin section tab via a single
database round-trip using sequential COUNT queries on the shared AsyncSession.

Note: SQLAlchemy AsyncSession is not task-safe — concurrent ``db.execute(...)``
on the same session raises ``InterfaceError: another operation is in progress``.
Queries are issued sequentially within a single request handler; they remain
cheap because each is an indexed ``COUNT(*)`` and total round-trip is dominated
by a single connection acquire.
"""

from sqlalchemy import func, or_, select
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


async def count_active_decks(db: AsyncSession) -> tuple[int, int]:
    """Return (active_vocab_decks, active_culture_decks).

    Single source of truth for "active deck count" across `get_admin_stats`
    and `AdminCountsService.get_tab_counts`. Returns the two counts separately
    so callers that need them split (e.g. `get_admin_stats`) can use the same
    helper as callers that only need the sum.
    """
    vocab_result = await db.execute(select(func.count(Deck.id)).where(Deck.is_active.is_(True)))
    culture_result = await db.execute(
        select(func.count(CultureDeck.id)).where(CultureDeck.is_active.is_(True))
    )
    return (vocab_result.scalar() or 0, culture_result.scalar() or 0)


class AdminCountsService:
    """Service that gathers all admin tab badge counts in one batch."""

    async def get_tab_counts(self, db: AsyncSession) -> AdminTabCountsResponse:
        """Return aggregate counts for the admin section-tab badges.

        Issues each COUNT sequentially on the shared AsyncSession (which is
        not task-safe). The inbox composite (new_feedback + pending_errors) is
        derived in Python from the two reused counts — no extra query.

        Args:
            db: Active async database session.

        Returns:
            AdminTabCountsResponse with all nine badge counts.
        """
        new_feedback = await _scalar(
            db, select(func.count(Feedback.id)).where(Feedback.status == FeedbackStatus.NEW)
        )
        total_feedback = await _scalar(db, select(func.count(Feedback.id)))
        # Badge semantic: "open" errors = PENDING ∪ REVIEWED.
        # Matches the `Open` meta-filter in the toolbar (CER-09) — REVIEWED
        # reports still need admin action (status flip to FIXED/DISMISSED).
        open_errors = await _scalar(
            db,
            select(func.count(CardErrorReport.id)).where(
                or_(
                    CardErrorReport.status == CardErrorStatus.PENDING,
                    CardErrorReport.status == CardErrorStatus.REVIEWED,
                )
            ),
        )
        news = await _scalar(db, select(func.count(NewsItem.id)))
        situations = await _scalar(db, select(func.count(Situation.id)))
        exercises = await _scalar(db, select(func.count(Exercise.id)))
        changelog = await _scalar(db, select(func.count(ChangelogEntry.id)))
        announcements = await _scalar(db, select(func.count(AnnouncementCampaign.id)))

        vocab_decks, culture_decks = await count_active_decks(db)
        decks = vocab_decks + culture_decks

        return AdminTabCountsResponse(
            inbox=new_feedback + open_errors,
            decks=decks,
            news=news,
            situations=situations,
            exercises=exercises,
            errors=open_errors,
            feedback=total_feedback,
            changelog=changelog,
            announcements=announcements,
        )


async def _scalar(db: AsyncSession, stmt: Executable) -> int:
    """Execute a scalar COUNT query and return the result as a non-negative int."""
    result = await db.execute(stmt)
    return result.scalar() or 0
