"""Dashboard summary gather-layer service (PERF-15-02).

Gathers the pieces needed for the single-call ``DashboardSummaryResponse``
(see src/schemas/dashboard.py, PERF-15-01) from decks, situations, news, the
exercise queue, and gamification data, reusing the existing services rather
than duplicating their queries (AC-7, behavior-preserving).

This module builds only the GATHER half: each ``_gather_*`` method returns
one piece of raw/slim data. Deriving today/streak/week_heat/decks/feed and
composing the final ``DashboardSummaryResponse`` (``build()``) is PERF-15-03
— the ``_gather_*`` methods are the seams that story composes over.

All gather calls run sequentially against the SAME injected ``AsyncSession``
(an AsyncSession is not safe for concurrent use across coroutines).
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.schemas.dashboard import SlimNews, SlimSituation
from src.services.exercise_sm2_service import ExerciseSM2Service
from src.services.learner_situation_service import LearnerSituationService
from src.services.news_item_service import NewsItemService
from src.services.situation_comprehension_service import SituationComprehensionService

# Matches the dashboard's canonical queue params, used today across the
# separate /exercises/queue calls the dashboard replaces (exercises.py defaults).
_QUEUE_LIMIT = 20
_QUEUE_NEW_LIMIT = 10

# Matches the dashboard feed's news card count.
_NEWS_PAGE_SIZE = 6


class DashboardSummaryService:
    """Gathers and composes the single-call dashboard summary payload."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _gather_news(self) -> list[SlimNews]:
        """Latest published news items, slim-mapped for the dashboard feed."""
        news_response = await NewsItemService(self.db).get_list(page_size=_NEWS_PAGE_SIZE)
        return [SlimNews.from_full(item) for item in news_response.items]

    async def _gather_situation(self, user_id: UUID) -> SlimSituation | None:
        """Newest READY situation for the learner, or None if there are none."""
        result = await LearnerSituationService(self.db).list_for_learner(
            user_id, page=1, page_size=1
        )
        if not result.items:
            return None
        item = result.items[0]
        return SlimSituation(
            id=item.id,
            scenario_el=item.scenario_el,
            scenario_en=item.scenario_en,
            scenario_ru=item.scenario_ru,
            status=item.status.value,
            has_audio=item.has_audio,
            has_dialog=item.has_dialog,
            exercise_total=item.exercise_total,
            exercise_completed=item.exercise_completed,
            source_image_url=item.source_image_url,
            domain=item.domain,
            description_source_type=item.description_source_type,
        )

    async def _gather_whats_new_count(self) -> int:
        """Account-wide count of READY situations added in the last 7 days."""
        return await SituationComprehensionService(self.db).count_whats_new()

    async def _gather_queue_count(self, user_id: UUID) -> int:
        """Study-queue size using the dashboard's canonical queue params."""
        queue = await ExerciseSM2Service(self.db).get_study_queue(
            user_id,
            limit=_QUEUE_LIMIT,
            include_new=True,
            new_limit=_QUEUE_NEW_LIMIT,
            include_early_practice=False,
        )
        return queue.total_in_queue

    async def gather(self, user_id: UUID) -> dict:
        """Gather all dashboard-summary source data for ``user_id``.

        Returns a dict keyed by the raw gathered pieces (news/situation/
        whats_new_count/queue_count) — PERF-15-03 composes these (plus
        decks/gamification data) into the final DashboardSummaryResponse.
        """
        news = await self._gather_news()
        situation = await self._gather_situation(user_id)
        whats_new_count = await self._gather_whats_new_count()
        queue_count = await self._gather_queue_count(user_id)

        return {
            "news": news,
            "situation": situation,
            "whats_new_count": whats_new_count,
            "queue_count": queue_count,
        }


__all__ = ["DashboardSummaryService"]
