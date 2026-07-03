"""Dashboard summary gather + compose service (PERF-15-02 / PERF-15-03).

Gathers the pieces needed for the single-call ``DashboardSummaryResponse``
(see src/schemas/dashboard.py, PERF-15-01) from decks, situations, news, the
exercise queue, and gamification data, reusing the existing services rather
than duplicating their queries (AC-7, behavior-preserving).

The ``_gather_*`` methods (PERF-15-02) each return one piece of raw/slim
data. ``build()`` (PERF-15-03) is the composition seam: it derives
today/streak/week_heat/decks/feed via the PURE helpers in
``src.services.dashboard_compose`` and assembles the final
``DashboardSummaryResponse``.

All gather/compute calls run sequentially against the SAME injected
``AsyncSession`` (an AsyncSession is not safe for concurrent use across
coroutines), and deliberately call the PRIVATE ``_compute_*`` methods on
``ProgressService`` (bypassing its Redis sub-caches) since ``build()``'s own
result is the single cached artifact (PERF-15-04 wires the endpoint-level
cache).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.repositories.deck import DeckRepository
from src.schemas.dashboard import (
    DashboardSummaryResponse,
    SlimNews,
    SlimSituation,
    StreakSummary,
    TodaySummary,
)
from src.services.dashboard_compose import (
    ComposeFeedSignals,
    build_week_heat,
    compose_feed,
    derive_is_new_user,
    map_deck_slice,
)
from src.services.exercise_sm2_service import ExerciseSM2Service
from src.services.learner_situation_service import LearnerSituationService
from src.services.news_item_service import NewsItemService
from src.services.progress_service import ProgressService
from src.services.s3_service import get_s3_service
from src.services.situation_comprehension_service import SituationComprehensionService
from src.utils.deck_cover import deck_cover_url, deck_cover_variants

# Matches the dashboard's canonical queue params, used today across the
# separate /exercises/queue calls the dashboard replaces (exercises.py defaults).
_QUEUE_LIMIT = 20
_QUEUE_NEW_LIMIT = 10

# Matches the dashboard feed's news card count.
_NEWS_PAGE_SIZE = 6

# Matches the dashboard's deck-strip size — generous enough to cover every
# system deck without paginating (there are far fewer than 50 today).
_DECKS_LIMIT = 50

logger = get_logger(__name__)


@dataclass
class _DeckView:
    """Adapts a ``Deck`` ORM row into ``dashboard_compose.DeckLike`` with its
    S3-derived cover fields pre-resolved. ``map_deck_slice`` is a PURE
    function (no I/O), but a bare ``Deck`` row has no ``cover_image_url`` /
    ``cover_image_variants`` attributes — those are computed on the fly via
    ``deck_cover_url``/``deck_cover_variants`` (S3 presigned URLs) at the
    existing deck endpoints. This view resolves them once, here, so the
    pure helper can stay DB/I-O-free.
    """

    id: UUID
    name_el: str | None
    name_en: str | None
    name_ru: str | None
    level: str
    is_premium: bool
    cover_image_url: str | None
    cover_image_variants: dict[int, str] | None


class DashboardSummaryService:
    """Gathers and composes the single-call dashboard summary payload."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _gather_news(self) -> list[SlimNews]:
        """Latest published news items, slim-mapped for the dashboard feed.

        Non-critical feed source: a transient failure here degrades to an
        empty list instead of 500ing the whole consolidated summary — the
        core stats/decks composed in ``build()`` stay hard-failing.
        """
        try:
            # PERF-17-01 (D2): the slim path drops word_timestamps/linked_situation
            # from the DB-read + serialize for these 6 items, which _gather_news
            # discarded anyway. SlimNews.from_full maps the shared card fields, so
            # the /dashboard/summary response stays byte-identical.
            news_response = await NewsItemService(self.db).get_list_slim(page_size=_NEWS_PAGE_SIZE)
            return [SlimNews.from_full(item) for item in news_response.items]
        except Exception:
            logger.opt(exception=True).warning(
                "dashboard summary: news gather failed, degrading to []"
            )
            return []

    async def _gather_situation(self, user_id: UUID) -> SlimSituation | None:
        """Newest READY situation for the learner, or None if there are none.

        Non-critical feed source: degrades to None on failure (see
        ``_gather_news`` docstring for the degradation rationale).
        """
        try:
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
        except Exception:
            logger.opt(exception=True).warning(
                "dashboard summary: situation gather failed, degrading to None",
                user_id=str(user_id),
            )
            return None

    async def _gather_whats_new_count(self) -> int:
        """Account-wide count of READY situations added in the last 7 days.

        Non-critical feed source: degrades to 0 on failure (see
        ``_gather_news`` docstring for the degradation rationale).
        """
        try:
            return await SituationComprehensionService(self.db).count_whats_new()
        except Exception:
            logger.opt(exception=True).warning(
                "dashboard summary: whats_new_count gather failed, degrading to 0"
            )
            return 0

    async def _gather_queue_count(self, user_id: UUID) -> int:
        """Study-queue size using the dashboard's canonical queue params.

        Non-critical feed source: degrades to 0 on failure (see
        ``_gather_news`` docstring for the degradation rationale).
        """
        try:
            queue = await ExerciseSM2Service(self.db).get_study_queue(
                user_id,
                limit=_QUEUE_LIMIT,
                include_new=True,
                new_limit=_QUEUE_NEW_LIMIT,
                include_early_practice=False,
            )
            return queue.total_in_queue
        except Exception:
            logger.opt(exception=True).warning(
                "dashboard summary: queue_count gather failed, degrading to 0",
                user_id=str(user_id),
            )
            return 0

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

    async def build(self, user_id: UUID) -> DashboardSummaryResponse:
        """Compose the single-call ``DashboardSummaryResponse`` for
        ``user_id``: gathers stats/decks/feed sources on the shared
        ``self.db`` session and derives every field via the pure helpers in
        ``dashboard_compose`` (byte-parity with the frontend it replaces).

        Does not cache — PERF-15-04 wraps this at the endpoint/Redis layer.
        """
        progress_service = ProgressService(self.db)

        # ── Stats (today/streak/mastered/week_heat) ────────────────────────
        stats = await progress_service._compute_dashboard_stats(user_id)
        today = TodaySummary(**stats.today.model_dump())
        streak = StreakSummary(
            current_streak=stats.streak.current_streak,
            longest_streak=stats.streak.longest_streak,
        )
        mastered = stats.cards_by_status.get("mastered", 0)
        # UTC, NOT date.today() — the frontend oracle anchors on Date.UTC;
        # using the server's local day here would silently drift bucket
        # boundaries (see dashboard_compose.build_week_heat).
        week_heat = build_week_heat(
            stats.recent_activity, today_utc=datetime.now(timezone.utc).date()
        )

        # ── Decks (system vocabulary decks, newest first) ──────────────────
        deck_repo = DeckRepository(self.db)
        active_decks = await deck_repo.list_active(limit=_DECKS_LIMIT)
        deck_ids = [deck.id for deck in active_decks]
        card_counts = await deck_repo.get_batch_card_counts(deck_ids)
        progress_list = await progress_service._compute_deck_progress_list(
            user_id, page_size=_DECKS_LIMIT
        )
        progress_map = {p.deck_id: p for p in progress_list.decks}

        s3 = get_s3_service()
        deck_slices = [
            map_deck_slice(
                _DeckView(
                    id=deck.id,
                    name_el=deck.name_el,
                    name_en=deck.name_en,
                    name_ru=deck.name_ru,
                    level=(deck.level.value if hasattr(deck.level, "value") else deck.level),
                    is_premium=deck.is_premium,
                    cover_image_url=deck_cover_url(deck, s3),
                    cover_image_variants=deck_cover_variants(deck, s3),
                ),
                progress_map.get(deck.id),
                card_counts.get(deck.id, 0),
            )
            for deck in active_decks
        ]

        # ── Non-critical feed sources (news/situation/whats_new/queue) ─────
        gathered = await self.gather(user_id)

        is_new_user = derive_is_new_user(
            cards_due=today.cards_due,
            current_streak=streak.current_streak,
            mastered=mastered,
            deck_slices=deck_slices,
        )

        feed = compose_feed(
            ComposeFeedSignals(
                deck_slices=deck_slices,
                cards_due=today.cards_due,
                situation=gathered["situation"],
                news=gathered["news"],
                current_streak=streak.current_streak,
                longest_streak=streak.longest_streak,
                queue_count=gathered["queue_count"],
            )
        )

        return DashboardSummaryResponse(
            is_new_user=is_new_user,
            mastered=mastered,
            today=today,
            streak=streak,
            week_heat=week_heat,
            decks=deck_slices,
            feed=feed,
            whats_new_count=gathered["whats_new_count"],
            queue_count=gathered["queue_count"],
            all_time_study_time_seconds=stats.overview.total_study_time_seconds,
        )


__all__ = ["DashboardSummaryService"]
