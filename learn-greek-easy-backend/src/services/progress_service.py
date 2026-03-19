"""ProgressService: V2 stats and progress endpoints."""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.repositories.card_record import CardRecordRepository
from src.repositories.card_record_review import CardRecordReviewRepository
from src.repositories.card_record_statistics import CardRecordStatisticsRepository
from src.repositories.culture_answer_history import CultureAnswerHistoryRepository
from src.repositories.culture_deck import CultureDeckRepository
from src.repositories.culture_question_stats import CultureQuestionStatsRepository
from src.repositories.deck import DeckRepository
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

    # ── Dashboard ──────────────────────────────────────────────────────────

    async def get_dashboard_stats(self, user_id: UUID) -> DashboardStatsResponse:
        # Group 1: status counts and overview metrics
        vocab_status: dict[str, int]
        culture_status: dict[str, int]
        accuracy_stats: dict[str, int]
        vocab_status, culture_status, accuracy_stats = await asyncio.gather(
            self.card_stats_repo.count_by_status(user_id),
            self.culture_stats_repo.count_all_by_status(user_id),
            self.card_review_repo.get_accuracy_stats(user_id, days=30),
        )

        # Group 2: counts and study times
        (
            culture_mastered,
            distinct_decks,
            last_review_date,
            total_study_time_vocab,
            total_study_time_culture,
            total_study_time_mock,
        ) = await asyncio.gather(
            self.culture_stats_repo.count_mastered_questions(user_id),
            self.card_stats_repo.count_distinct_decks(user_id),
            self.card_review_repo.get_last_review_date(user_id),
            self.card_review_repo.get_total_study_time(user_id),
            self.culture_answer_repo.get_total_study_time(user_id),
            self.mock_exam_repo.get_total_study_time(user_id),
        )
        culture_mastered_int: int = culture_mastered
        distinct_decks_int: int = distinct_decks
        total_study_time_vocab_int: int = total_study_time_vocab
        total_study_time_culture_int: int = total_study_time_culture
        total_study_time_mock_int: int = total_study_time_mock

        # Group 3: today stats
        reviews_today: int
        culture_answers_today: int
        study_time_today_vocab: int
        study_time_today_culture: int
        study_time_today_mock: int
        (
            reviews_today,
            culture_answers_today,
            study_time_today_vocab,
            study_time_today_culture,
            study_time_today_mock,
        ) = await asyncio.gather(
            self.card_review_repo.count_reviews_today(user_id),
            self.culture_answer_repo.count_answers_today(user_id),
            self.card_review_repo.get_study_time_today(user_id),
            self.culture_answer_repo.get_study_time_today(user_id),
            self.mock_exam_repo.get_study_time_today(user_id),
        )

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

        # Streak
        current_streak = await self._get_aggregated_streak(user_id)
        longest_streak = await self._get_aggregated_longest_streak(user_id)
        streak = StreakStats(
            current_streak=current_streak,
            longest_streak=longest_streak,
            last_study_date=last_review_date,
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
    def _build_vocab_status_map(vocab_status_per_day: list[dict]) -> dict[date, dict[str, int]]:
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

    async def _get_aggregated_streak(self, user_id: UUID) -> int:
        vocab_dates, culture_dates, mock_dates = await asyncio.gather(
            self.card_review_repo.get_unique_dates(user_id, days=30),
            self.culture_answer_repo.get_unique_dates(user_id, days=30),
            self.mock_exam_repo.get_unique_dates(user_id, days=30),
        )
        all_dates = sorted(
            set(vocab_dates) | set(culture_dates) | set(mock_dates),
            reverse=True,
        )
        if not all_dates:
            return 0
        today = date.today()
        # Grace period: start from today or yesterday (whichever has activity)
        start = today if all_dates[0] == today else today - timedelta(days=1)
        if all_dates[0] > start:
            return 0
        streak = 0
        expected = start
        for d in all_dates:
            if d == expected:
                streak += 1
                expected = d - timedelta(days=1)
            elif d < expected:
                break
        return streak

    async def _get_aggregated_longest_streak(self, user_id: UUID) -> int:
        vocab_dates, culture_dates, mock_dates = await asyncio.gather(
            self.card_review_repo.get_all_unique_dates(user_id),
            self.culture_answer_repo.get_all_unique_dates(user_id),
            self.mock_exam_repo.get_all_unique_dates(user_id),
        )
        all_dates = sorted(set(vocab_dates) | set(culture_dates) | set(mock_dates))
        if not all_dates:
            return 0
        longest = 1
        current = 1
        for i in range(1, len(all_dates)):
            if all_dates[i] == all_dates[i - 1] + timedelta(days=1):
                current += 1
                longest = max(longest, current)
            else:
                current = 1
        return longest

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

        (
            vocab_daily,
            vocab_status_per_day,
            vocab_accuracy_per_day,
            culture_status_per_day,
            culture_accuracy_per_day,
            cards_mastered_in_range,
        ) = await asyncio.gather(
            self.card_review_repo.get_daily_stats(user_id, start_date, end_date),
            self.card_stats_repo.count_cards_by_status_per_day(user_id, start_date, end_date),
            self.card_review_repo.get_daily_accuracy_stats(user_id, start_date, end_date),
            self.culture_stats_repo.count_cards_by_status_per_day(user_id, start_date, end_date),
            self.culture_stats_repo.get_daily_culture_accuracy_stats(user_id, start_date, end_date),
            self.card_stats_repo.count_cards_mastered_in_range(user_id, start_date, end_date),
        )

        vocab_daily_map = {row["date"]: row for row in vocab_daily}
        vocab_status_map = self._build_vocab_status_map(vocab_status_per_day)
        vocab_accuracy_map = {row["date"]: row for row in vocab_accuracy_per_day}

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
        # Fetch vocab deck summaries from stats
        vocab_summaries = await self.card_stats_repo.get_deck_progress_summaries(user_id)
        vocab_deck_ids = [s["deck_id"] for s in vocab_summaries]

        # Batch fetch: last review per deck and deck info
        last_review_by_deck = await self.card_review_repo.get_last_review_by_deck(user_id)
        decks_info = await self.deck_repo.get_by_ids(vocab_deck_ids) if vocab_deck_ids else []

        # Build deck info lookup (id -> Deck)
        deck_info_map = {deck.id: deck for deck in decks_info}

        # Build vocab deck summaries
        vocab_deck_summaries = []
        for s in vocab_summaries:
            deck_id = s["deck_id"]
            deck = deck_info_map.get(deck_id)
            if deck is None:
                continue
            total_cards = await self.card_record_repo.count_by_deck(deck_id, is_active=True)
            cards_mastered = s["cards_mastered"]
            cards_studied = s["cards_studied"]
            mastery_pct = round(cards_mastered / total_cards * 100, 1) if total_cards > 0 else 0.0
            completion_pct = round(cards_studied / total_cards * 100, 1) if total_cards > 0 else 0.0
            deck_level = deck.level.value if hasattr(deck.level, "value") else str(deck.level)
            vocab_deck_summaries.append(
                DeckProgressSummary(
                    deck_id=deck_id,
                    deck_name=deck.name_en,
                    deck_level=deck_level,
                    total_cards=total_cards,
                    cards_studied=cards_studied,
                    cards_mastered=cards_mastered,
                    cards_due=s["cards_due"],
                    mastery_percentage=mastery_pct,
                    completion_percentage=completion_pct,
                    last_studied_at=last_review_by_deck.get(deck_id),
                    average_easiness_factor=s["avg_ef"],
                    estimated_review_time_minutes=max(1, s["cards_due"] * 2 // 60),
                    deck_type="vocabulary",
                )
            )

        # Culture decks
        culture_decks = await self.culture_deck_repo.list_active()
        culture_deck_ids = [d.id for d in culture_decks]
        if culture_deck_ids:
            culture_stats_batch, culture_question_counts = await asyncio.gather(
                self.culture_stats_repo.get_batch_deck_stats(user_id, culture_deck_ids),
                self.culture_deck_repo.get_batch_question_counts(culture_deck_ids),
            )
        else:
            culture_stats_batch = {}
            culture_question_counts = {}

        culture_deck_summaries = []
        for cdeck in culture_decks:
            stats = culture_stats_batch.get(cdeck.id, {})
            total_cards = culture_question_counts.get(cdeck.id, 0)
            mastered = stats.get("mastered", 0)
            studied = mastered + stats.get("learning", 0)
            due = stats.get("due_count", 0)
            mastery_pct = round(mastered / total_cards * 100, 1) if total_cards > 0 else 0.0
            completion_pct = round(studied / total_cards * 100, 1) if total_cards > 0 else 0.0
            culture_deck_summaries.append(
                DeckProgressSummary(
                    deck_id=cdeck.id,
                    deck_name=cdeck.name_en,
                    deck_level=cdeck.category,
                    total_cards=total_cards,
                    cards_studied=studied,
                    cards_mastered=mastered,
                    cards_due=due,
                    mastery_percentage=mastery_pct,
                    completion_percentage=completion_pct,
                    last_studied_at=stats.get("last_practiced"),
                    average_easiness_factor=None,
                    estimated_review_time_minutes=max(1, due * 2 // 60),
                    deck_type="culture",
                )
            )

        all_decks = sorted(
            vocab_deck_summaries + culture_deck_summaries,
            key=lambda x: x.last_studied_at or datetime.min,
            reverse=True,
        )
        total = len(all_decks)
        skip = (page - 1) * page_size
        paginated = all_decks[skip : skip + page_size]

        return DeckProgressListResponse(
            total=total,
            page=page,
            page_size=page_size,
            decks=paginated,
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

        vocab_status, review_stats, avg_ef, avg_interval, total_cards = await asyncio.gather(
            self.card_stats_repo.count_by_status(user_id, deck_id),
            self.card_review_repo.get_deck_review_stats(user_id, deck_id),
            self.card_stats_repo.get_average_easiness_factor(user_id, deck_id),
            self.card_stats_repo.get_average_interval(user_id, deck_id),
            self.card_record_repo.count_by_deck(deck_id, is_active=True),
        )

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
