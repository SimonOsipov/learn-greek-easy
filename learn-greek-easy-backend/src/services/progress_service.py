"""ProgressService: V2 stats and progress endpoints."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy import and_, func, literal, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings  # noqa: F401 (may already be imported transitively)
from src.core.cache import get_cache
from src.db.models import (
    CardRecord,
    CardRecordReview,
    CardRecordStatistics,
    CardStatus,
    CultureAnswerHistory,
    CultureDeck,
    CultureQuestion,
    CultureQuestionStats,
    Deck,
    ExerciseReview,
    MockExamSession,
)
from src.repositories.card_record import CardRecordRepository
from src.repositories.card_record_review import CardRecordReviewRepository
from src.repositories.card_record_statistics import CardRecordStatisticsRepository
from src.repositories.culture_answer_history import CultureAnswerHistoryRepository
from src.repositories.culture_deck import CultureDeckRepository
from src.repositories.culture_question_stats import CultureQuestionStatsRepository
from src.repositories.deck import DeckRepository
from src.repositories.exercise_review import ExerciseReviewRepository
from src.repositories.mock_exam import MockExamRepository
from src.schemas.progress import (
    DailyStats,
    DashboardStatsResponse,
    DeckProgressDetailResponse,
    DeckProgressListResponse,
    DeckProgressMetrics,
    DeckProgressSummary,
    DeckStatistics,
    DeckTimeline,
    LearningTrendsResponse,
    OverviewStats,
    RecentActivity,
    StreakStats,
    TodayStats,
    TrendsSummary,
)
from src.services.gamification.streak import (  # noqa: F401
    MAX_STREAK_LOOKBACK_DAYS,
    _compute_streak_from_dates,
    _longest_streak_from_dates,
    compute_aggregated_streak,
    compute_culture_streak,
    compute_exercise_streak,
    compute_vocabulary_streak,
)
from src.utils.heatmap import bucket_heatmap_intensity


class ProgressService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.card_stats_repo = CardRecordStatisticsRepository(db)
        self.card_review_repo = CardRecordReviewRepository(db)
        self.card_record_repo = CardRecordRepository(db)
        self.deck_repo = DeckRepository(db)
        self.culture_stats_repo = CultureQuestionStatsRepository(db)
        self.culture_answer_repo = CultureAnswerHistoryRepository(db)
        self.culture_deck_repo = CultureDeckRepository(db)
        self.mock_exam_repo = MockExamRepository(db)
        self.exercise_review_repo = ExerciseReviewRepository(db)

    # ── Dashboard ──────────────────────────────────────────────────────────

    async def get_dashboard_stats(self, user_id: UUID) -> DashboardStatsResponse:
        cache = get_cache()
        key = f"progress:user:{user_id}:dashboard"

        async def _factory() -> dict:
            return (await self._compute_dashboard_stats(user_id)).model_dump(mode="json")

        cached = await cache.get_or_set(key, _factory, ttl=settings.cache_user_progress_ttl)  # type: ignore[arg-type]
        if cached is not None:
            try:
                return DashboardStatsResponse.model_validate(cached)
            except ValidationError:
                pass
        return await self._compute_dashboard_stats(user_id)

    async def _compute_dashboard_stats(self, user_id: UUID) -> DashboardStatsResponse:
        # Group 1: status counts and overview metrics
        # Sequential on the shared AsyncSession (INFRA-01) — see module note below.
        vocab_status: dict[str, int] = await self.card_stats_repo.count_by_status(user_id)
        culture_status: dict[str, int] = await self.culture_stats_repo.count_all_by_status(user_id)

        # PERF-10-02: per-table consolidation. Three new aggregate repo methods
        # fold the dashboard's vocab-review (5→1), culture-answer (4→1), and
        # mock-exam (2→1) scalar reads into one round-trip each. Every FILTER
        # predicate is copied verbatim from the method it replaces, so each
        # value feeds the SAME downstream arithmetic as before (byte-identical
        # DashboardStatsResponse). All on the single shared self.db, sequential.
        review_agg = await self.card_review_repo.get_dashboard_review_aggregates(user_id)
        culture_answer_agg = await self.culture_answer_repo.get_dashboard_answer_aggregates(user_id)
        mock_agg = await self.mock_exam_repo.get_dashboard_mock_aggregates(user_id)

        accuracy_stats: dict[str, int] = {
            "correct": review_agg["correct_30d"],
            "total": review_agg["total_30d"],
        }

        # Group 2: counts and study times
        culture_mastered = await self.culture_stats_repo.count_mastered_questions(user_id)
        distinct_decks = await self.card_stats_repo.count_distinct_decks(user_id)
        last_reviewed_at = review_agg["last_reviewed_at"]
        last_review_date = last_reviewed_at.date() if last_reviewed_at is not None else None
        culture_mastered_int: int = culture_mastered
        distinct_decks_int: int = distinct_decks
        total_study_time_vocab_int: int = review_agg["total_study_time"]
        total_study_time_culture_int: int = culture_answer_agg["total_study_time"]
        total_study_time_mock_int: int = mock_agg["total_study_time"]
        weekly_study_time_culture_int: int = culture_answer_agg["study_time_week"]

        # Group 3: today stats
        reviews_today: int = review_agg["reviews_today"]
        culture_answers_today: int = culture_answer_agg["answers_today"]
        study_time_today_vocab: int = review_agg["study_time_today"]
        study_time_today_culture: int = culture_answer_agg["study_time_today"]
        study_time_today_mock: int = mock_agg["study_time_today"]

        # Overview
        vocab_studied = sum(v for k, v in vocab_status.items() if k not in ("new", "due"))
        culture_studied = sum(v for k, v in culture_status.items() if k not in ("new", "due"))
        vocab_mastered = vocab_status.get("mastered", 0)
        total_mastered = vocab_mastered + culture_mastered_int
        total_studied = vocab_studied + culture_studied
        mastery_pct = (total_mastered / total_studied * 100) if total_studied > 0 else 0.0
        accuracy_pct = (
            (accuracy_stats["correct"] / accuracy_stats["total"] * 100)
            if accuracy_stats["total"] > 0
            else 0.0
        )

        overview = OverviewStats(
            total_cards_studied=total_studied,
            total_cards_mastered=total_mastered,
            total_decks_started=distinct_decks_int,
            overall_mastery_percentage=round(mastery_pct, 1),
            accuracy_percentage=round(accuracy_pct, 1),
            culture_questions_mastered=culture_mastered_int,
            total_study_time_seconds=(
                total_study_time_vocab_int
                + total_study_time_culture_int
                + total_study_time_mock_int
            ),
            culture_weekly_study_time_seconds=weekly_study_time_culture_int,
        )

        # Today
        cards_due = vocab_status.get("due", 0) + culture_status.get("due", 0)
        daily_goal = 20
        reviews_total_today = reviews_today + culture_answers_today
        goal_pct = min((reviews_total_today / daily_goal * 100), 100.0) if daily_goal > 0 else 0.0

        today_stats = TodayStats(
            reviews_completed=reviews_total_today,
            cards_due=cards_due,
            daily_goal=daily_goal,
            goal_progress_percentage=round(goal_pct, 1),
            study_time_seconds=(
                study_time_today_vocab + study_time_today_culture + study_time_today_mock
            ),
        )

        # Streak — SQLCON-06: replaced 8 sequential awaits (~14 SELECTs) with
        # 2 tagged UNION ALL queries.  Query A covers the rolling 366-day window
        # for all current-streak values; Query B covers all-time for longest.
        # Each query's rows are bucketed into per-source Python sets, then the
        # pure math helpers (_compute_streak_from_dates / _longest_streak_from_dates)
        # compute all 8 values.  No delegation to compute_*_streak functions.
        rolling_rows, all_time_rows = await self._fetch_streak_union_rows(user_id)

        vocab_set_cur, culture_set_cur, mock_set_cur, exercise_set_cur = self._bucket_streak_rows(
            rolling_rows
        )
        vocab_set_all, culture_set_all, mock_set_all, exercise_set_all = self._bucket_streak_rows(
            all_time_rows
        )

        # Current streaks (rolling window, descending sort)
        current_streak = _compute_streak_from_dates(
            sorted(vocab_set_cur | culture_set_cur | mock_set_cur, reverse=True)
        )
        vocab_current = _compute_streak_from_dates(sorted(vocab_set_cur, reverse=True))
        culture_current = _compute_streak_from_dates(
            sorted(culture_set_cur | mock_set_cur, reverse=True)
        )
        exercise_current = _compute_streak_from_dates(sorted(exercise_set_cur, reverse=True))

        # Longest streaks (all-time window, ascending sort)
        longest_streak = _longest_streak_from_dates(
            sorted(vocab_set_all | culture_set_all | mock_set_all)
        )
        vocab_longest = _longest_streak_from_dates(sorted(vocab_set_all))
        culture_longest = _longest_streak_from_dates(sorted(culture_set_all | mock_set_all))
        exercise_longest = _longest_streak_from_dates(sorted(exercise_set_all))

        streak = StreakStats(
            current_streak=current_streak,
            longest_streak=longest_streak,
            last_study_date=last_review_date,
            vocabulary_current_streak=vocab_current,
            vocabulary_longest_streak=vocab_longest,
            culture_current_streak=culture_current,
            culture_longest_streak=culture_longest,
            exercise_current_streak=exercise_current,
            exercise_longest_streak=exercise_longest,
        )

        # cards_by_status: merge vocab + culture
        merged_status: dict[str, int] = {}
        for status_dict in (vocab_status, culture_status):
            for k, v in status_dict.items():
                merged_status[k] = merged_status.get(k, 0) + v

        # Recent activity (last 7 days)
        end_date = date.today()
        start_date = end_date - timedelta(days=6)
        daily_stats_raw = await self.card_review_repo.get_daily_stats(user_id, start_date, end_date)
        recent_activity = [
            RecentActivity(
                date=row["date"],
                reviews_count=row["reviews_count"],
                average_quality=round(row["avg_quality"], 2),
            )
            for row in daily_stats_raw
        ]

        return DashboardStatsResponse(
            overview=overview,
            today=today_stats,
            streak=streak,
            cards_by_status=merged_status,
            recent_activity=recent_activity,
        )

    @staticmethod
    def _build_vocab_status_map(
        vocab_status_per_day: list[dict],
    ) -> dict[date, dict[str, int]]:
        result: dict[date, dict[str, int]] = {}
        for row in vocab_status_per_day:
            d = row["date"]
            if d not in result:
                result[d] = {"learning": 0, "mastered": 0}
            s = row["status"]
            if s in ("learning", "review"):
                result[d]["learning"] += row["count"]
            elif s == "mastered":
                result[d]["mastered"] += row["count"]
        return result

    @staticmethod
    def _compute_quality_trend(daily_stats: list[DailyStats]) -> str:
        half = len(daily_stats) // 2
        if half == 0:
            return "stable"
        first_half_q = [s.average_quality for s in daily_stats[:half] if s.reviews_count > 0]
        second_half_q = [s.average_quality for s in daily_stats[half:] if s.reviews_count > 0]
        if not first_half_q or not second_half_q:
            return "stable"
        first_avg = sum(first_half_q) / len(first_half_q)
        second_avg = sum(second_half_q) / len(second_half_q)
        if second_avg > first_avg + 0.2:
            return "improving"
        if second_avg < first_avg - 0.2:
            return "declining"
        return "stable"

    def _build_daily_stats_entry(
        self,
        d: date,
        vocab_daily_map: dict,
        vocab_status_map: dict,
        culture_status_per_day: dict,
        vocab_accuracy_map: dict,
        culture_accuracy_per_day: dict,
    ) -> DailyStats:
        vocab_row = vocab_daily_map.get(d)
        vocab_s = vocab_status_map.get(d, {})
        culture_s = culture_status_per_day.get(d, {})
        vocab_acc = vocab_accuracy_map.get(d)
        culture_acc = culture_accuracy_per_day.get(d)

        reviews_count = vocab_row["reviews_count"] if vocab_row else 0
        study_time = int(vocab_row["total_time"]) if vocab_row else 0
        avg_quality = float(vocab_row["avg_quality"]) if vocab_row else 0.0
        cards_learning = vocab_s.get("learning", 0) + culture_s.get("learning", 0)
        cards_mastered_day = vocab_s.get("mastered", 0) + culture_s.get("mastered", 0)

        vocab_acc_pct = 0.0
        vocab_total = vocab_acc["total"] if vocab_acc else 0
        vocab_correct = vocab_acc["correct"] if vocab_acc else 0
        if vocab_total > 0:
            vocab_acc_pct = round(vocab_correct / vocab_total * 100, 1)

        culture_total_count = culture_acc.get("total_count", 0) if culture_acc else 0
        culture_correct_count = culture_acc.get("correct_count", 0) if culture_acc else 0
        culture_acc_pct = 0.0
        if culture_total_count > 0:
            culture_acc_pct = round(culture_correct_count / culture_total_count * 100, 1)

        combined_total = vocab_total + culture_total_count
        combined_correct = vocab_correct + culture_correct_count
        combined_acc = (
            round(combined_correct / combined_total * 100, 1) if combined_total > 0 else 0.0
        )

        return DailyStats(
            date=d,
            reviews_count=reviews_count,
            cards_learned=cards_mastered_day,
            cards_learning=cards_learning,
            cards_mastered=cards_mastered_day,
            study_time_seconds=study_time,
            average_quality=round(avg_quality, 2),
            vocab_accuracy=vocab_acc_pct,
            culture_accuracy=culture_acc_pct,
            combined_accuracy=combined_acc,
        )

    @staticmethod
    def _bucket_streak_rows(rows: list) -> tuple[set, set, set, set]:
        """Partition UNION ALL rows into (vocab, culture, mock, exercise) date sets.

        Each row must have attributes ``source`` (str) and ``d`` (date).  Rows
        with unknown source tags are silently ignored.

        Returns:
            Tuple of (vocab_set, culture_set, mock_set, exercise_set) where each
            element is a ``set[date]``.
        """
        vocab: set[date] = set()
        culture: set[date] = set()
        mock: set[date] = set()
        exercise: set[date] = set()
        _buckets = {"vocab": vocab, "culture": culture, "mock": mock, "exercise": exercise}
        for row in rows:
            bucket = _buckets.get(row.source)
            if bucket is not None:
                bucket.add(row.d)
        return vocab, culture, mock, exercise

    async def _fetch_streak_union_rows(self, user_id: UUID) -> tuple[list[Any], list[Any]]:
        """Issue two tagged UNION ALL queries for the streak fan-out.

        Returns (rolling_rows, all_time_rows) where each row has attributes
        ``source`` (str tag: "vocab" | "culture" | "mock" | "exercise") and
        ``d`` (date).

        Query A — rolling 366-day window (current-streak inputs):
            Four branches, each guarded by ``ts >= cutoff``.
        Query B — all-time window (longest-streak inputs):
            Same four branches WITHOUT the cutoff predicate.

        Both windows use ``func.date(<ts>)`` for consistent UTC bucketing,
        matching the existing streak.py branches exactly.

        SQLCON-06: replaces 8 sequential awaits (~14 SELECTs) with exactly
        2 db.execute calls.
        """
        cutoff = datetime.combine(
            date.today() - timedelta(days=MAX_STREAK_LOOKBACK_DAYS),
            datetime.min.time(),
        )

        def _rolling_branch(model: Any, ts_col: Any, source: str) -> Any:
            return (
                select(
                    func.date(ts_col).label("d"),
                    literal(source).label("source"),
                )
                .where(model.user_id == user_id, ts_col >= cutoff)
                .group_by(func.date(ts_col))
            )

        def _all_time_branch(model: Any, ts_col: Any, source: str) -> Any:
            return (
                select(
                    func.date(ts_col).label("d"),
                    literal(source).label("source"),
                )
                .where(model.user_id == user_id)
                .group_by(func.date(ts_col))
            )

        # Query A: rolling 366-day window — 1 db.execute
        rolling_union = union_all(
            _rolling_branch(CardRecordReview, CardRecordReview.reviewed_at, "vocab"),
            _rolling_branch(CultureAnswerHistory, CultureAnswerHistory.created_at, "culture"),
            _rolling_branch(MockExamSession, MockExamSession.started_at, "mock"),
            _rolling_branch(ExerciseReview, ExerciseReview.reviewed_at, "exercise"),
        )
        rolling_result = await self.db.execute(rolling_union)
        rolling_rows: list[Any] = list(rolling_result.all())

        # Query B: all-time window — 1 db.execute
        all_time_union = union_all(
            _all_time_branch(CardRecordReview, CardRecordReview.reviewed_at, "vocab"),
            _all_time_branch(CultureAnswerHistory, CultureAnswerHistory.created_at, "culture"),
            _all_time_branch(MockExamSession, MockExamSession.started_at, "mock"),
            _all_time_branch(ExerciseReview, ExerciseReview.reviewed_at, "exercise"),
        )
        all_time_result = await self.db.execute(all_time_union)
        all_time_rows: list[Any] = list(all_time_result.all())

        return rolling_rows, all_time_rows

    async def _get_aggregated_longest_streak(self, user_id: UUID) -> int:
        # Sequential on the shared AsyncSession (INFRA-01).
        vocab_dates = await self.card_review_repo.get_all_unique_dates(user_id)
        culture_dates = await self.culture_answer_repo.get_all_unique_dates(user_id)
        mock_dates = await self.mock_exam_repo.get_all_unique_dates(user_id)
        all_dates = sorted(set(vocab_dates) | set(culture_dates) | set(mock_dates))
        return _longest_streak_from_dates(all_dates)

    # ── Trends ────────────────────────────────────────────────────────────

    async def get_learning_trends(
        self,
        user_id: UUID,
        period: str = "week",
        deck_id: UUID | None = None,
    ) -> LearningTrendsResponse:
        days_map = {"week": 7, "month": 30, "quarter": 90}
        days = days_map.get(period, 7)
        end_date = date.today()
        start_date = end_date - timedelta(days=days - 1)

        # Sequential on the shared AsyncSession (INFRA-01).
        # SQLCON-02 Merge A: one combined query replaces get_daily_stats +
        # get_daily_accuracy_stats.  The combined rows serve both vocab_daily_map
        # and vocab_accuracy_map — they carry all required keys.
        vocab_combined = await self.card_review_repo.get_daily_vocab_combined_stats(
            user_id, start_date, end_date
        )
        vocab_status_per_day = await self.card_stats_repo.count_cards_by_status_per_day(
            user_id, start_date, end_date
        )
        culture_status_per_day = await self.culture_stats_repo.count_cards_by_status_per_day(
            user_id, start_date, end_date
        )
        culture_accuracy_per_day = await self.culture_stats_repo.get_daily_culture_accuracy_stats(
            user_id, start_date, end_date
        )
        # SQLCON-02 Merge B: drop count_cards_mastered_in_range round-trip;
        # derive the scalar from vocab_status_per_day (already fetched above).
        cards_mastered_in_range: int = sum(
            row["count"]
            for row in vocab_status_per_day
            if row["status"] == CardStatus.MASTERED.value
        )

        vocab_daily_map = {row["date"]: row for row in vocab_combined}
        vocab_status_map = self._build_vocab_status_map(vocab_status_per_day)
        vocab_accuracy_map = {row["date"]: row for row in vocab_combined}

        daily_stats = []
        best_day: date | None = None
        best_day_reviews = 0
        for i in range(days):
            d = start_date + timedelta(days=i)
            entry = self._build_daily_stats_entry(
                d,
                vocab_daily_map,
                vocab_status_map,
                culture_status_per_day,
                vocab_accuracy_map,
                culture_accuracy_per_day,
            )
            daily_stats.append(entry)
            if entry.reviews_count > best_day_reviews:
                best_day_reviews = entry.reviews_count
                best_day = d

        total_reviews = sum(s.reviews_count for s in daily_stats)
        total_study_time = sum(s.study_time_seconds for s in daily_stats)
        avg_daily = round(total_reviews / days, 1) if days > 0 else 0.0
        quality_trend = self._compute_quality_trend(daily_stats)

        summary = TrendsSummary(
            total_reviews=total_reviews,
            total_study_time_seconds=total_study_time,
            cards_mastered=cards_mastered_in_range,
            average_daily_reviews=avg_daily,
            best_day=best_day if best_day_reviews > 0 else None,
            quality_trend=quality_trend,
        )

        return LearningTrendsResponse(
            period=period,
            start_date=start_date,
            end_date=end_date,
            daily_stats=daily_stats,
            summary=summary,
        )

    # ── Deck List ─────────────────────────────────────────────────────────

    async def get_deck_progress_list(
        self,
        user_id: UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> DeckProgressListResponse:
        cache = get_cache()
        key = f"progress:user:{user_id}:decks:{page}:{page_size}"

        async def _factory() -> dict:
            return (await self._compute_deck_progress_list(user_id, page, page_size)).model_dump(
                mode="json"
            )

        cached = await cache.get_or_set(key, _factory, ttl=settings.cache_user_progress_ttl)  # type: ignore[arg-type]
        if cached is not None:
            try:
                return DeckProgressListResponse.model_validate(cached)
            except ValidationError:
                pass
        return await self._compute_deck_progress_list(user_id, page, page_size)

    async def _compute_deck_progress_list(
        self,
        user_id: UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> DeckProgressListResponse:
        # Two-phase SQL design (PERF-18-01): Phase A runs one deterministic
        # UNION ALL ordering query (vocab ∪ capped culture) + a COUNT, both
        # paginated in SQL; Phase B hydrates ONLY the returned page ids via the
        # existing batch aggregates plus additive batched repo methods. This
        # replaces the former per-vocab-deck count_by_deck N+1 loop and the
        # Python sort/slice, keeping DTO output byte-identical to before.
        skip = (page - 1) * page_size

        # ── Phase A — ordering query (scalar columns only; lazy="raise" safe) ─
        # Vocab branch: distinct active decks the user has studied (active
        # cards), mirroring get_deck_progress_summaries ∩ get_by_ids(active).
        studied_vocab_decks = (
            select(CardRecord.deck_id.label("deck_id"))
            .join(CardRecordStatistics, CardRecordStatistics.card_record_id == CardRecord.id)
            .where(
                CardRecordStatistics.user_id == user_id,
                CardRecord.is_active.is_(True),
            )
            .distinct()
            .subquery("studied_vocab_decks")
        )
        vocab_last_review = (
            select(
                CardRecord.deck_id.label("deck_id"),
                func.max(CardRecordReview.reviewed_at).label("last_studied"),
            )
            .join(CardRecordReview, CardRecordReview.card_record_id == CardRecord.id)
            .where(CardRecordReview.user_id == user_id)
            .group_by(CardRecord.deck_id)
            .subquery("vocab_last_review")
        )
        vocab_branch = (
            select(
                studied_vocab_decks.c.deck_id.label("deck_id"),
                literal("vocabulary").label("deck_type"),
                vocab_last_review.c.last_studied.label("last_studied"),
            )
            .select_from(studied_vocab_decks)
            .join(
                Deck,
                and_(Deck.id == studied_vocab_decks.c.deck_id, Deck.is_active.is_(True)),
            )
            .join(
                vocab_last_review,
                vocab_last_review.c.deck_id == studied_vocab_decks.c.deck_id,
                isouter=True,
            )
        )

        # Culture branch: newest 100 active decks by created_at DESC — reproduces
        # list_active()'s default limit=100 (culture_deck.py) BEFORE the sort (D13).
        capped_culture = (
            select(CultureDeck.id.label("deck_id"))
            .where(CultureDeck.is_active.is_(True))
            .order_by(CultureDeck.created_at.desc())
            .limit(100)
            .subquery("capped_culture")
        )
        culture_last_practiced = (
            select(
                CultureQuestion.deck_id.label("deck_id"),
                func.max(CultureQuestionStats.updated_at).label("last_studied"),
            )
            .join(CultureQuestion, CultureQuestion.id == CultureQuestionStats.question_id)
            .where(CultureQuestionStats.user_id == user_id)
            .group_by(CultureQuestion.deck_id)
            .subquery("culture_last_practiced")
        )
        culture_branch = (
            select(
                capped_culture.c.deck_id.label("deck_id"),
                literal("culture").label("deck_type"),
                culture_last_practiced.c.last_studied.label("last_studied"),
            )
            .select_from(capped_culture)
            .join(
                culture_last_practiced,
                culture_last_practiced.c.deck_id == capped_culture.c.deck_id,
                isouter=True,
            )
        )

        candidates = union_all(vocab_branch, culture_branch).subquery("deck_candidates")

        # Deterministic order (D1): NULLS LAST reproduces the former
        # `... or _DATETIME_MIN_UTC`; deck_id ASC is the unique tiebreaker.
        ordering_query = (
            select(
                candidates.c.deck_id,
                candidates.c.deck_type,
                candidates.c.last_studied,
            )
            .order_by(
                candidates.c.last_studied.desc().nullslast(),
                candidates.c.deck_id.asc(),
            )
            .limit(page_size)
            .offset(skip)
        )
        page_rows = (await self.db.execute(ordering_query)).all()

        # Total over the same capped union (culture ≤ 100 ⇒ matches former len()).
        count_query = select(func.count()).select_from(candidates)
        total = (await self.db.execute(count_query)).scalar_one()

        # last_studied is carried straight from Phase A — identical by
        # construction to get_last_review_by_deck (vocab) / get_batch_deck_stats
        # last_practiced (culture), so no re-query is needed.
        last_studied_by_deck = {row.deck_id: row.last_studied for row in page_rows}
        vocab_page_ids = [row.deck_id for row in page_rows if row.deck_type == "vocabulary"]
        culture_page_ids = [row.deck_id for row in page_rows if row.deck_type == "culture"]

        # ── Phase B — hydrate ONLY the page ids ──────────────────────────────
        vocab_summary_by_id: dict[UUID, DeckProgressSummary] = {}
        if vocab_page_ids:
            page_id_set = set(vocab_page_ids)
            vocab_summaries = await self.card_stats_repo.get_deck_progress_summaries(user_id)
            deck_info_map = {
                deck.id: deck for deck in await self.deck_repo.get_by_ids(vocab_page_ids)
            }
            total_cards_by_deck = await self.card_record_repo.count_active_by_decks(vocab_page_ids)
            for s in vocab_summaries:
                deck_id = s["deck_id"]
                if deck_id not in page_id_set:
                    continue
                deck = deck_info_map.get(deck_id)
                if deck is None:
                    continue
                total_cards = total_cards_by_deck.get(deck_id, 0)
                cards_mastered = s["cards_mastered"]
                cards_studied = s["cards_studied"]
                mastery_pct = (
                    round(cards_mastered / total_cards * 100, 1) if total_cards > 0 else 0.0
                )
                completion_pct = (
                    round(cards_studied / total_cards * 100, 1) if total_cards > 0 else 0.0
                )
                deck_level = deck.level.value if hasattr(deck.level, "value") else str(deck.level)
                vocab_summary_by_id[deck_id] = DeckProgressSummary(
                    deck_id=deck_id,
                    deck_name=deck.name_en,
                    deck_level=deck_level,
                    total_cards=total_cards,
                    cards_studied=cards_studied,
                    cards_mastered=cards_mastered,
                    cards_due=s["cards_due"],
                    mastery_percentage=mastery_pct,
                    completion_percentage=completion_pct,
                    last_studied_at=last_studied_by_deck.get(deck_id),
                    average_easiness_factor=s["avg_ef"],
                    estimated_review_time_minutes=max(1, s["cards_due"] * 2 // 60),
                    deck_type="vocabulary",
                )

        culture_summary_by_id: dict[UUID, DeckProgressSummary] = {}
        if culture_page_ids:
            # Sequential on the shared AsyncSession (INFRA-01).
            culture_stats_batch = await self.culture_stats_repo.get_batch_deck_stats(
                user_id, culture_page_ids
            )
            culture_question_counts = await self.culture_deck_repo.get_batch_question_counts(
                culture_page_ids
            )
            culture_deck_map = {
                cdeck.id: cdeck
                for cdeck in await self.culture_deck_repo.get_by_ids(culture_page_ids)
            }
            for deck_id in culture_page_ids:
                cdeck = culture_deck_map.get(deck_id)
                if cdeck is None:
                    continue
                stats = culture_stats_batch.get(deck_id, {})
                total_cards = culture_question_counts.get(deck_id, 0)
                mastered = stats.get("mastered", 0)
                studied = mastered + stats.get("learning", 0)
                due = stats.get("due_count", 0)
                mastery_pct = round(mastered / total_cards * 100, 1) if total_cards > 0 else 0.0
                completion_pct = round(studied / total_cards * 100, 1) if total_cards > 0 else 0.0
                culture_summary_by_id[deck_id] = DeckProgressSummary(
                    deck_id=deck_id,
                    deck_name=cdeck.name_en,
                    deck_level=cdeck.category,
                    total_cards=total_cards,
                    cards_studied=studied,
                    cards_mastered=mastered,
                    cards_due=due,
                    mastery_percentage=mastery_pct,
                    completion_percentage=completion_pct,
                    last_studied_at=last_studied_by_deck.get(deck_id),
                    average_easiness_factor=None,
                    estimated_review_time_minutes=max(1, due * 2 // 60),
                    deck_type="culture",
                )

        # Reassemble the page in Phase A's exact order.
        decks: list[DeckProgressSummary] = []
        for row in page_rows:
            summary = (
                vocab_summary_by_id.get(row.deck_id)
                if row.deck_type == "vocabulary"
                else culture_summary_by_id.get(row.deck_id)
            )
            if summary is not None:
                decks.append(summary)

        return DeckProgressListResponse(
            total=total,
            page=page,
            page_size=page_size,
            decks=decks,
        )

    # ── Deck Detail ───────────────────────────────────────────────────────

    async def get_deck_progress_detail(
        self,
        user_id: UUID,
        deck_id: UUID,
    ) -> DeckProgressDetailResponse:
        from src.core.exceptions import DeckNotFoundException, ForbiddenException

        deck = await self.deck_repo.get(deck_id)
        if deck is None or not deck.is_active:
            raise DeckNotFoundException()
        if deck.owner_id is not None and deck.owner_id != user_id:
            raise ForbiddenException()

        today = datetime.now(timezone.utc).date()
        # Rolling 7-day window (today inclusive, oldest first) — consistent with the
        # per-word heatmap and dashboard recent_activity. Index 6 is always today.
        week_start = today - timedelta(days=6)
        week_end = today

        # Sequential on the shared AsyncSession (INFRA-01).
        # SQLCON-07: avg_ef + avg_interval collapsed from 2 round-trips → 1.
        vocab_status = await self.card_stats_repo.count_by_status(user_id, deck_id)
        review_stats = await self.card_review_repo.get_deck_review_stats(user_id, deck_id)
        avg_ef, avg_interval = await self.card_stats_repo.get_average_ef_and_interval(
            user_id, deck_id
        )
        total_cards = await self.card_record_repo.count_by_deck(deck_id, is_active=True)
        deck_dates_desc = await self.card_review_repo.get_deck_study_days(user_id, deck_id)
        weekly_counts = await self.card_review_repo.get_deck_weekly_activity(
            user_id, deck_id, week_start, week_end
        )

        weekly_activity = [
            bucket_heatmap_intensity(weekly_counts.get(week_start + timedelta(days=i), 0))
            for i in range(7)
        ]
        deck_streak_current = _compute_streak_from_dates(deck_dates_desc)
        deck_streak_longest = _longest_streak_from_dates(sorted(deck_dates_desc))

        cards_mastered = vocab_status.get("mastered", 0)
        cards_new = vocab_status.get("new", 0)
        cards_learning = vocab_status.get("learning", 0)
        cards_review = vocab_status.get("review", 0)
        cards_due = vocab_status.get("due", 0)
        cards_studied = cards_learning + cards_review + cards_mastered
        mastery_pct = round(cards_mastered / total_cards * 100, 1) if total_cards > 0 else 0.0
        completion_pct = round(cards_studied / total_cards * 100, 1) if total_cards > 0 else 0.0

        progress = DeckProgressMetrics(
            total_cards=total_cards,
            cards_studied=cards_studied,
            cards_mastered=cards_mastered,
            cards_due=cards_due,
            cards_new=cards_new,
            cards_learning=cards_learning,
            cards_review=cards_review,
            mastery_percentage=mastery_pct,
            completion_percentage=completion_pct,
        )

        statistics = DeckStatistics(
            total_reviews=review_stats["total_reviews"],
            total_study_time_seconds=review_stats["total_study_time_seconds"],
            average_quality=round(review_stats["average_quality"], 2),
            average_easiness_factor=round(avg_ef, 2),
            average_interval_days=round(avg_interval, 1),
            deck_streak_current=deck_streak_current,
            deck_streak_longest=deck_streak_longest,
            weekly_activity=weekly_activity,
        )

        first_at = review_stats.get("first_reviewed_at")
        last_at = review_stats.get("last_reviewed_at")
        days_active = 0
        if first_at and last_at:
            days_active = (last_at.date() - first_at.date()).days + 1

        estimated_completion = None
        remaining = total_cards - cards_mastered
        if remaining > 0 and cards_mastered > 0 and days_active > 0:
            daily_rate = cards_mastered / days_active
            if daily_rate > 0:
                estimated_completion = int(remaining / daily_rate)

        timeline = DeckTimeline(
            first_studied_at=first_at,
            last_studied_at=last_at,
            days_active=days_active,
            estimated_completion_days=estimated_completion,
        )

        deck_level = (
            deck.level.value
            if deck and hasattr(deck.level, "value")
            else (str(deck.level) if deck else "A1")
        )
        return DeckProgressDetailResponse(
            deck_id=deck_id,
            deck_name=deck.name_en if deck else "Unknown",
            deck_level=deck_level,
            deck_description=deck.description_en if deck else None,
            progress=progress,
            statistics=statistics,
            timeline=timeline,
        )
