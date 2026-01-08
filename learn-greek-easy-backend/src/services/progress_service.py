"""Progress Service for tracking and analytics.

This service orchestrates data aggregation from multiple repositories
to provide comprehensive progress statistics including:
1. Dashboard overview (total studied, mastered, streaks)
2. Deck progress with pagination
3. Detailed deck statistics
4. Learning trends over time periods

Statistics are aggregated from BOTH vocabulary flashcards (Review table)
and culture card sessions (CultureAnswerHistory table).

Example Usage:
    async with get_db_session() as db:
        service = ProgressService(db)
        stats = await service.get_dashboard_stats(user_id)
        print(f"Cards mastered: {stats.overview.total_cards_mastered}")
"""

import math
from datetime import date, datetime, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import DeckNotFoundException, NotFoundException
from src.core.logging import get_logger
from src.repositories import (
    CardRepository,
    CardStatisticsRepository,
    CultureAnswerHistoryRepository,
    DeckRepository,
    ReviewRepository,
    UserDeckProgressRepository,
)
from src.repositories.culture_deck import CultureDeckRepository
from src.repositories.culture_question_stats import CultureQuestionStatsRepository
from src.schemas.progress import (
    Achievement,
    AchievementsResponse,
    DailyStats,
    DashboardStatsResponse,
    DeckProgressDetailResponse,
    DeckProgressListResponse,
    DeckProgressMetrics,
    DeckProgressSummary,
    DeckStatistics,
    DeckTimeline,
    LearningTrendsResponse,
    NextMilestone,
    OverviewStats,
    RecentActivity,
    StreakStats,
    TodayStats,
    TrendsSummary,
)
from src.services.achievements import ACHIEVEMENTS, AchievementType

logger = get_logger(__name__)


class ProgressService:
    """Service for progress tracking and analytics.

    This service aggregates data from multiple repositories to provide
    comprehensive progress statistics for users.

    Statistics are aggregated from BOTH:
    - Vocabulary flashcards (Review table)
    - Culture card sessions (CultureAnswerHistory table)

    Attributes:
        db: Async database session
        progress_repo: Repository for UserDeckProgress operations
        stats_repo: Repository for CardStatistics operations
        review_repo: Repository for Review operations
        deck_repo: Repository for Deck operations
        card_repo: Repository for Card operations
        culture_answer_repo: Repository for CultureAnswerHistory operations
    """

    # Class constants
    DEFAULT_DAILY_GOAL = 20
    MASTERY_INTERVAL_DAYS = 21
    AVG_TIME_PER_CARD_SECONDS = 15.0

    def __init__(self, db: AsyncSession):
        """Initialize the Progress service.

        Args:
            db: Async database session for persistence operations
        """
        self.db = db
        self.progress_repo = UserDeckProgressRepository(db)
        self.stats_repo = CardStatisticsRepository(db)
        self.review_repo = ReviewRepository(db)
        self.deck_repo = DeckRepository(db)
        self.card_repo = CardRepository(db)
        self.culture_stats_repo = CultureQuestionStatsRepository(db)
        self.culture_answer_repo = CultureAnswerHistoryRepository(db)
        self.culture_deck_repo = CultureDeckRepository(db)

    # =========================================================================
    # Helper Methods
    # =========================================================================

    async def _get_aggregated_streak(self, user_id: UUID) -> int:
        """Calculate current study streak combining vocabulary and culture activity.

        Counts consecutive days where user had at least one review OR
        culture answer, starting from today going backwards.

        Args:
            user_id: User UUID

        Returns:
            Number of consecutive days with study activity
        """
        # Get unique dates from vocabulary reviews (last 30 days)
        review_dates_raw = await self.review_repo.get_user_reviews(user_id, skip=0, limit=1000)
        review_dates = set()
        thirty_days_ago = date.today() - timedelta(days=30)
        for review in review_dates_raw:
            review_date = review.reviewed_at.date()
            if review_date >= thirty_days_ago:
                review_dates.add(review_date)

        # Get unique dates from culture answers (last 30 days)
        culture_dates = await self.culture_answer_repo.get_unique_dates(user_id, days=30)
        culture_dates_set = set(culture_dates)

        # Combine both sets
        all_study_dates = review_dates | culture_dates_set

        if not all_study_dates:
            return 0

        # Count consecutive days starting from today if active today,
        # or from yesterday if active yesterday (streak grace period)
        streak = 0
        today = date.today()
        yesterday = today - timedelta(days=1)

        # Determine starting point: today if active, else yesterday if active
        if today in all_study_dates:
            current_date = today
        elif yesterday in all_study_dates:
            current_date = yesterday
        else:
            # No activity today or yesterday = streak is broken
            return 0

        while current_date in all_study_dates:
            streak += 1
            current_date -= timedelta(days=1)

        return streak

    async def _get_aggregated_longest_streak(self, user_id: UUID) -> int:
        """Calculate longest historical streak combining vocabulary and culture activity.

        Scans full history from both Review and CultureAnswerHistory tables
        to find the longest consecutive day streak.

        Args:
            user_id: User UUID

        Returns:
            Longest streak in days
        """
        # Get all unique dates from vocabulary reviews
        review_dates_raw = await self.review_repo.get_user_reviews(user_id, skip=0, limit=10000)
        review_dates = {review.reviewed_at.date() for review in review_dates_raw}

        # Get all unique dates from culture answers
        culture_dates = await self.culture_answer_repo.get_all_unique_dates(user_id)
        culture_dates_set = set(culture_dates)

        # Combine and sort
        all_dates = sorted(review_dates | culture_dates_set)

        if not all_dates:
            return 0

        longest = 1
        current = 1

        for i in range(1, len(all_dates)):
            if (all_dates[i] - all_dates[i - 1]).days == 1:
                current += 1
                longest = max(longest, current)
            else:
                current = 1

        return longest

    async def _get_aggregated_study_time_today(self, user_id: UUID) -> int:
        """Get combined study time from vocabulary and culture sessions today.

        Args:
            user_id: User UUID

        Returns:
            Total study time in seconds for today
        """
        vocab_time = await self.review_repo.get_study_time_today(user_id)
        culture_time = await self.culture_answer_repo.get_study_time_today(user_id)
        return vocab_time + culture_time

    async def _get_aggregated_reviews_today(self, user_id: UUID) -> int:
        """Get combined review/answer count from vocabulary and culture sessions today.

        Args:
            user_id: User UUID

        Returns:
            Total reviews/answers today
        """
        vocab_reviews = await self.review_repo.count_reviews_today(user_id)
        culture_answers = await self.culture_answer_repo.count_answers_today(user_id)
        return vocab_reviews + culture_answers

    async def _get_aggregated_total_reviews(self, user_id: UUID) -> int:
        """Get total review/answer count combining vocabulary and culture.

        Args:
            user_id: User UUID

        Returns:
            Total reviews + culture answers
        """
        vocab_reviews = await self.review_repo.get_total_reviews(user_id)
        culture_answers = await self.culture_answer_repo.get_total_answers(user_id)
        return vocab_reviews + culture_answers

    async def _get_aggregated_total_study_time(self, user_id: UUID) -> int:
        """Get total study time combining vocabulary and culture sessions.

        Args:
            user_id: User UUID

        Returns:
            Total study time in seconds
        """
        vocab_time = await self.review_repo.get_total_study_time(user_id)
        culture_time = await self.culture_answer_repo.get_total_study_time(user_id)
        return vocab_time + culture_time

    async def _get_recent_activity(
        self,
        user_id: UUID,
        days: int = 7,
    ) -> list[RecentActivity]:
        """Get recent activity for the last N days.

        Args:
            user_id: User UUID
            days: Number of days to look back (default 7)

        Returns:
            List of RecentActivity for each day with reviews
        """
        end_date = date.today()
        start_date = end_date - timedelta(days=days - 1)

        daily_stats = await self.review_repo.get_daily_stats(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
        )

        return [
            RecentActivity(
                date=stat["date"],
                reviews_count=stat["reviews_count"],
                average_quality=stat["average_quality"],
            )
            for stat in daily_stats
        ]

    def _calculate_quality_trend(self, daily_stats: list[dict]) -> str:
        """Calculate quality trend from daily stats.

        Compares average quality of first half vs second half of the period.

        Args:
            daily_stats: List of daily stats dicts with 'average_quality' key

        Returns:
            "improving" if diff > 0.3, "declining" if diff < -0.3, else "stable"
        """
        if len(daily_stats) < 2:
            return "stable"

        mid = len(daily_stats) // 2
        first_half = daily_stats[:mid]
        second_half = daily_stats[mid:]

        if not first_half or not second_half:
            return "stable"

        # Calculate weighted averages (by reviews count)
        first_total_quality = sum(
            s["average_quality"] * s["reviews_count"] for s in first_half if s["reviews_count"] > 0
        )
        first_total_reviews = sum(s["reviews_count"] for s in first_half)

        second_total_quality = sum(
            s["average_quality"] * s["reviews_count"] for s in second_half if s["reviews_count"] > 0
        )
        second_total_reviews = sum(s["reviews_count"] for s in second_half)

        # Avoid division by zero
        if first_total_reviews == 0 or second_total_reviews == 0:
            return "stable"

        first_avg = first_total_quality / first_total_reviews
        second_avg = second_total_quality / second_total_reviews

        diff = second_avg - first_avg

        if diff > 0.3:
            return "improving"
        elif diff < -0.3:
            return "declining"
        return "stable"

    def _estimate_review_time(self, cards_due: int) -> int:
        """Estimate review time in minutes.

        Args:
            cards_due: Number of cards due for review

        Returns:
            Estimated minutes (rounded up)
        """
        seconds = cards_due * self.AVG_TIME_PER_CARD_SECONDS
        return math.ceil(seconds / 60)

    async def _calculate_combined_accuracy(
        self,
        user_id: UUID,
        days: int = 30,
    ) -> float:
        """Calculate combined accuracy percentage from vocab and culture.

        Args:
            user_id: User UUID
            days: Number of days to look back

        Returns:
            Combined accuracy percentage (0.0-100.0)
        """
        # Get vocab accuracy stats
        vocab_stats = await self.review_repo.get_accuracy_stats(user_id, days=days)

        # Get culture accuracy stats
        culture_stats = await self.culture_stats_repo.get_culture_accuracy_stats(user_id, days=days)

        # Combine totals
        total_correct = vocab_stats["correct"] + culture_stats["correct"]
        total_answers = vocab_stats["total"] + culture_stats["total"]

        # Calculate combined accuracy, handle zero division
        if total_answers == 0:
            return 0.0

        return round((total_correct / total_answers) * 100, 1)

    # =========================================================================
    # Dashboard Stats
    # =========================================================================

    async def get_dashboard_stats(self, user_id: UUID) -> DashboardStatsResponse:
        """Get complete dashboard statistics for a user.

        Aggregates data from BOTH vocabulary flashcards (Review) and
        culture card sessions (CultureAnswerHistory):
        - Overview: total studied, mastered (vocab + culture), decks started, accuracy
        - Today: reviews completed (vocab + culture), cards due (vocab + culture), goal progress
        - Streak: combined current streak and longest streak
        - Cards by status: breakdown of card statuses
        - Recent activity: last 7 days of reviews

        Args:
            user_id: User UUID

        Returns:
            DashboardStatsResponse with all nested statistics
        """
        logger.debug(
            "Building dashboard stats",
            extra={"user_id": str(user_id)},
        )

        # Get vocab overview stats
        vocab_studied = await self.progress_repo.get_total_cards_studied(user_id)
        vocab_mastered = await self.progress_repo.get_total_cards_mastered(user_id)
        total_decks = await self.progress_repo.count_user_decks(user_id)

        # Get culture stats for aggregation
        culture_mastered = await self.culture_stats_repo.count_mastered_questions(user_id)
        culture_due = await self.culture_stats_repo.count_due_questions(user_id)

        # Combine vocab + culture totals
        total_mastered = vocab_mastered + culture_mastered

        mastery_percentage = 0.0
        if vocab_studied > 0:
            mastery_percentage = min((total_mastered / vocab_studied) * 100, 100.0)

        # Calculate combined accuracy
        accuracy_percentage = await self._calculate_combined_accuracy(user_id, days=30)

        overview = OverviewStats(
            total_cards_studied=vocab_studied,
            total_cards_mastered=total_mastered,
            total_decks_started=total_decks,
            overall_mastery_percentage=round(mastery_percentage, 1),
            accuracy_percentage=accuracy_percentage,
            culture_questions_mastered=culture_mastered,
        )

        # Get today's stats - AGGREGATED from vocabulary + culture
        reviews_today = await self._get_aggregated_reviews_today(user_id)
        study_time_today = await self._get_aggregated_study_time_today(user_id)
        status_counts = await self.stats_repo.count_by_status(user_id)
        vocab_due = status_counts.get("due", 0)
        cards_due = vocab_due + culture_due

        goal_progress = min((reviews_today / self.DEFAULT_DAILY_GOAL) * 100, 100.0)

        today = TodayStats(
            reviews_completed=reviews_today,
            cards_due=cards_due,
            daily_goal=self.DEFAULT_DAILY_GOAL,
            goal_progress_percentage=round(goal_progress, 1),
            study_time_seconds=study_time_today,
        )

        # Get streak stats - AGGREGATED from vocabulary + culture
        current_streak = await self._get_aggregated_streak(user_id)
        longest_streak = await self._get_aggregated_longest_streak(user_id)

        # Get last study date from progress records
        progress_records = await self.progress_repo.get_user_progress(user_id, skip=0, limit=1)
        last_study_date: Optional[date] = None
        if progress_records and progress_records[0].last_studied_at:
            last_study_date = progress_records[0].last_studied_at.date()

        streak = StreakStats(
            current_streak=current_streak,
            longest_streak=longest_streak,
            last_study_date=last_study_date,
        )

        # Get recent activity
        recent_activity = await self._get_recent_activity(user_id, days=7)

        logger.info(
            "Dashboard stats built successfully",
            extra={
                "user_id": str(user_id),
                "total_studied": vocab_studied,
                "total_mastered": total_mastered,
                "reviews_today": reviews_today,
                "current_streak": current_streak,
            },
        )

        return DashboardStatsResponse(
            overview=overview,
            today=today,
            streak=streak,
            cards_by_status=status_counts,
            recent_activity=recent_activity,
        )

    # =========================================================================
    # Deck Progress List
    # =========================================================================

    async def get_deck_progress_list(
        self,
        user_id: UUID,
        page: int = 1,
        page_size: int = 10,
    ) -> DeckProgressListResponse:
        """Get paginated list of user's deck progress (vocabulary + culture).

        Combines vocabulary flashcard decks and culture exam decks into a single
        list, sorted by last_studied_at descending.

        For each deck, includes:
        - Deck info (name, level/category)
        - Progress metrics (studied, mastered, due)
        - Percentages and estimated review time
        - Deck type (vocabulary or culture)

        Args:
            user_id: User UUID
            page: Page number (1-indexed)
            page_size: Number of items per page

        Returns:
            DeckProgressListResponse with paginated deck progress
        """
        all_deck_summaries: list[DeckProgressSummary] = []

        # =====================================================================
        # 1. Get vocabulary deck progress (existing logic)
        # =====================================================================
        progress_records = await self.progress_repo.get_user_progress(
            user_id, skip=0, limit=1000  # Get all, we'll paginate combined list
        )

        for progress in progress_records:
            deck = progress.deck
            if not deck:
                continue

            # Get total cards in deck
            total_cards = await self.deck_repo.count_cards(deck.id)

            # Get due cards for this deck
            status_counts = await self.stats_repo.count_by_status(user_id, deck_id=deck.id)
            cards_due = status_counts.get("due", 0)

            # Get average EF
            avg_ef = await self.stats_repo.get_average_easiness_factor(user_id, deck_id=deck.id)

            # Calculate percentages
            mastery_pct = 0.0
            if progress.cards_studied > 0:
                mastery_pct = min((progress.cards_mastered / progress.cards_studied) * 100, 100.0)

            completion_pct = 0.0
            if total_cards > 0:
                completion_pct = min((progress.cards_studied / total_cards) * 100, 100.0)

            all_deck_summaries.append(
                DeckProgressSummary(
                    deck_id=deck.id,
                    deck_name=deck.name,
                    deck_level=deck.level.value if deck.level else "A1",
                    total_cards=total_cards,
                    cards_studied=progress.cards_studied,
                    cards_mastered=progress.cards_mastered,
                    cards_due=cards_due,
                    mastery_percentage=round(mastery_pct, 1),
                    completion_percentage=round(completion_pct, 1),
                    last_studied_at=progress.last_studied_at,
                    average_easiness_factor=round(avg_ef, 2) if avg_ef else None,
                    estimated_review_time_minutes=self._estimate_review_time(cards_due),
                    deck_type="vocabulary",
                )
            )

        # =====================================================================
        # 2. Get culture deck progress
        # =====================================================================
        culture_decks = await self.culture_deck_repo.list_active(skip=0, limit=1000)

        for culture_deck in culture_decks:
            # Check if user has started this deck
            has_started = await self.culture_stats_repo.has_user_started_deck(
                user_id, culture_deck.id
            )
            if not has_started:
                continue  # Only include decks user has practiced

            # Get progress stats for this culture deck
            deck_progress = await self.culture_stats_repo.get_deck_progress(
                user_id, culture_deck.id
            )

            # Get last practiced timestamp
            last_practiced = await self.culture_stats_repo.get_last_practiced_at(
                user_id, culture_deck.id
            )

            # Get due questions for this deck
            cards_due = await self.culture_stats_repo.count_due_questions(
                user_id, deck_id=culture_deck.id
            )

            # Map culture deck progress to DeckProgressSummary
            total_cards = deck_progress["questions_total"]
            cards_mastered = deck_progress["questions_mastered"]
            cards_studied = deck_progress["questions_learning"] + cards_mastered

            # Calculate percentages
            mastery_pct = 0.0
            if cards_studied > 0:
                mastery_pct = min((cards_mastered / cards_studied) * 100, 100.0)

            completion_pct = 0.0
            if total_cards > 0:
                completion_pct = min((cards_studied / total_cards) * 100, 100.0)

            all_deck_summaries.append(
                DeckProgressSummary(
                    deck_id=culture_deck.id,
                    deck_name=culture_deck.name,
                    deck_level=culture_deck.category,  # Use category as level
                    total_cards=total_cards,
                    cards_studied=cards_studied,
                    cards_mastered=cards_mastered,
                    cards_due=cards_due,
                    mastery_percentage=round(mastery_pct, 1),
                    completion_percentage=round(completion_pct, 1),
                    last_studied_at=last_practiced,
                    average_easiness_factor=None,  # Not tracked for culture decks
                    estimated_review_time_minutes=self._estimate_review_time(cards_due),
                    deck_type="culture",
                )
            )

        # =====================================================================
        # 3. Sort combined list by last_studied_at descending
        # =====================================================================
        all_deck_summaries.sort(
            key=lambda x: x.last_studied_at or datetime.min,
            reverse=True,
        )

        # =====================================================================
        # 4. Apply pagination to combined list
        # =====================================================================
        total = len(all_deck_summaries)
        skip = (page - 1) * page_size
        paginated_decks = all_deck_summaries[skip : skip + page_size]

        logger.debug(
            "Deck progress list built (vocab + culture)",
            extra={
                "user_id": str(user_id),
                "page": page,
                "total": total,
                "returned": len(paginated_decks),
            },
        )

        return DeckProgressListResponse(
            total=total,
            page=page,
            page_size=page_size,
            decks=paginated_decks,
        )

    # =========================================================================
    # Deck Progress Detail
    # =========================================================================

    async def get_deck_progress_detail(
        self,
        user_id: UUID,
        deck_id: UUID,
    ) -> DeckProgressDetailResponse:
        """Get detailed progress for a specific deck.

        Includes:
        - Deck info (name, level, description)
        - Progress metrics (total, studied, mastered, due, by status)
        - Statistics (reviews, time, quality, EF, interval)
        - Timeline (first/last studied, days active, completion estimate)

        Args:
            user_id: User UUID
            deck_id: Deck UUID

        Returns:
            DeckProgressDetailResponse with comprehensive deck progress

        Raises:
            DeckNotFoundException: If deck doesn't exist or is inactive
            NotFoundException: If user has no progress for this deck
        """
        # Validate deck exists
        deck = await self.deck_repo.get(deck_id)
        if not deck or not deck.is_active:
            raise DeckNotFoundException(deck_id=str(deck_id))

        # Get user's progress for this deck
        progress_records = await self.progress_repo.get_user_progress(user_id)
        user_progress = next((p for p in progress_records if p.deck_id == deck_id), None)

        if not user_progress:
            raise NotFoundException(
                resource="Progress",
                detail=f"No progress found for deck '{deck_id}'",
            )

        # Get total cards and status counts
        total_cards = await self.deck_repo.count_cards(deck_id)
        status_counts = await self.stats_repo.count_by_status(user_id, deck_id=deck_id)

        # Build progress metrics
        cards_new = status_counts.get("new", 0)
        cards_learning = status_counts.get("learning", 0)
        cards_review = status_counts.get("review", 0)
        cards_due = status_counts.get("due", 0)

        mastery_pct = 0.0
        if user_progress.cards_studied > 0:
            mastery_pct = min(
                (user_progress.cards_mastered / user_progress.cards_studied) * 100,
                100.0,
            )

        completion_pct = 0.0
        if total_cards > 0:
            completion_pct = min((user_progress.cards_studied / total_cards) * 100, 100.0)

        progress_metrics = DeckProgressMetrics(
            total_cards=total_cards,
            cards_studied=user_progress.cards_studied,
            cards_mastered=user_progress.cards_mastered,
            cards_due=cards_due,
            cards_new=cards_new,
            cards_learning=cards_learning,
            cards_review=cards_review,
            mastery_percentage=round(mastery_pct, 1),
            completion_percentage=round(completion_pct, 1),
        )

        # Build statistics - AGGREGATED from vocabulary + culture
        total_reviews = await self._get_aggregated_total_reviews(user_id)
        total_study_time = await self._get_aggregated_total_study_time(user_id)
        avg_quality = await self.review_repo.get_average_quality(user_id)
        avg_ef = await self.stats_repo.get_average_easiness_factor(user_id, deck_id=deck_id)
        avg_interval = await self.stats_repo.get_average_interval(user_id, deck_id=deck_id)

        statistics = DeckStatistics(
            total_reviews=total_reviews,
            total_study_time_seconds=total_study_time,
            average_quality=round(avg_quality, 2),
            average_easiness_factor=round(avg_ef, 2),
            average_interval_days=round(avg_interval, 1),
        )

        # Build timeline
        first_studied_at = user_progress.created_at
        last_studied_at = user_progress.last_studied_at

        days_active = 0
        if first_studied_at and last_studied_at:
            delta = last_studied_at - first_studied_at
            days_active = delta.days + 1  # Include both endpoints

        # Estimate completion days
        estimated_completion_days: Optional[int] = None
        cards_remaining = total_cards - user_progress.cards_studied
        if cards_remaining > 0 and days_active > 0:
            daily_rate = user_progress.cards_studied / days_active
            if daily_rate > 0:
                estimated_completion_days = math.ceil(cards_remaining / daily_rate)

        timeline = DeckTimeline(
            first_studied_at=first_studied_at,
            last_studied_at=last_studied_at,
            days_active=days_active,
            estimated_completion_days=estimated_completion_days,
        )

        logger.debug(
            "Deck progress detail built",
            extra={
                "user_id": str(user_id),
                "deck_id": str(deck_id),
                "cards_studied": user_progress.cards_studied,
                "cards_mastered": user_progress.cards_mastered,
            },
        )

        return DeckProgressDetailResponse(
            deck_id=deck.id,
            deck_name=deck.name,
            deck_level=deck.level.value if deck.level else "A1",
            deck_description=deck.description,
            progress=progress_metrics,
            statistics=statistics,
            timeline=timeline,
        )

    # =========================================================================
    # Learning Trends
    # =========================================================================

    async def get_learning_trends(
        self,
        user_id: UUID,
        period: str = "week",
        deck_id: Optional[UUID] = None,
    ) -> LearningTrendsResponse:
        """Get learning trends over a time period.

        Provides:
        - Daily stats (reviews, learned, mastered, time, quality)
        - Summary (total reviews, time, mastered, best day, trend)

        Args:
            user_id: User UUID
            period: Time period ("week", "month", "year")
            deck_id: Optional deck filter

        Returns:
            LearningTrendsResponse with daily stats and summary
        """
        # Calculate date range
        end_date = date.today()
        if period == "week":
            start_date = end_date - timedelta(days=6)
        elif period == "month":
            start_date = end_date - timedelta(days=29)
        elif period == "year":
            start_date = end_date - timedelta(days=364)
        else:
            # Default to week
            start_date = end_date - timedelta(days=6)

        logger.debug(
            "Building learning trends",
            extra={
                "user_id": str(user_id),
                "period": period,
                "start_date": str(start_date),
                "end_date": str(end_date),
                "deck_id": str(deck_id) if deck_id else None,
            },
        )

        # Get daily stats from repository
        raw_daily_stats = await self.review_repo.get_daily_stats(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
        )

        # Get cards by status per day from both vocab and culture
        vocab_status_counts = await self.stats_repo.count_cards_by_status_per_day(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
        )
        culture_status_counts = await self.culture_stats_repo.count_cards_by_status_per_day(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
        )

        # Get daily accuracy stats for vocab and culture
        vocab_accuracy_stats = await self.review_repo.get_daily_accuracy_stats(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
        )
        culture_accuracy_stats = await self.culture_stats_repo.get_daily_culture_accuracy_stats(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
        )

        # Create a map for quick lookup
        stats_map = {stat["date"]: stat for stat in raw_daily_stats}

        # Zero-fill missing days
        daily_stats: list[DailyStats] = []
        current_date = start_date
        while current_date <= end_date:
            # Get combined learning/mastered counts for this day
            vocab_counts = vocab_status_counts.get(current_date, {"learning": 0, "mastered": 0})
            culture_counts = culture_status_counts.get(current_date, {"learning": 0, "mastered": 0})
            cards_learning = vocab_counts["learning"] + culture_counts["learning"]
            cards_mastered = vocab_counts["mastered"] + culture_counts["mastered"]

            # Get accuracy stats for this day
            vocab_acc = vocab_accuracy_stats.get(
                current_date, {"correct_count": 0, "total_count": 0, "accuracy": 0.0}
            )
            culture_acc = culture_accuracy_stats.get(
                current_date, {"correct_count": 0, "total_count": 0, "accuracy": 0.0}
            )

            # Calculate combined accuracy
            total_correct = vocab_acc["correct_count"] + culture_acc["correct_count"]
            total_count = vocab_acc["total_count"] + culture_acc["total_count"]
            combined_accuracy = (total_correct / total_count * 100) if total_count > 0 else 0.0

            if current_date in stats_map:
                stat = stats_map[current_date]
                daily_stats.append(
                    DailyStats(
                        date=current_date,
                        reviews_count=stat["reviews_count"],
                        cards_learned=0,  # Not tracked at review level
                        cards_learning=cards_learning,
                        cards_mastered=cards_mastered,
                        study_time_seconds=stat["total_time_seconds"],
                        average_quality=round(stat["average_quality"], 2),
                        vocab_accuracy=round(vocab_acc["accuracy"], 1),
                        culture_accuracy=round(culture_acc["accuracy"], 1),
                        combined_accuracy=round(combined_accuracy, 1),
                    )
                )
            else:
                daily_stats.append(
                    DailyStats(
                        date=current_date,
                        reviews_count=0,
                        cards_learned=0,
                        cards_learning=cards_learning,
                        cards_mastered=cards_mastered,
                        study_time_seconds=0,
                        average_quality=0.0,
                        vocab_accuracy=round(vocab_acc["accuracy"], 1),
                        culture_accuracy=round(culture_acc["accuracy"], 1),
                        combined_accuracy=round(combined_accuracy, 1),
                    )
                )
            current_date += timedelta(days=1)

        # Build summary
        total_reviews = sum(s.reviews_count for s in daily_stats)
        total_study_time = sum(s.study_time_seconds for s in daily_stats)

        # Get cards mastered in date range
        cards_mastered = await self.stats_repo.count_cards_mastered_in_range(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
        )

        # Find best day
        best_day: Optional[date] = None
        max_reviews = 0
        for day_stat in daily_stats:
            if day_stat.reviews_count > max_reviews:
                max_reviews = day_stat.reviews_count
                best_day = day_stat.date

        # Calculate average daily reviews
        num_days = (end_date - start_date).days + 1
        avg_daily_reviews = total_reviews / num_days if num_days > 0 else 0.0

        # Calculate quality trend
        quality_trend = self._calculate_quality_trend(raw_daily_stats)

        summary = TrendsSummary(
            total_reviews=total_reviews,
            total_study_time_seconds=total_study_time,
            cards_mastered=cards_mastered,
            average_daily_reviews=round(avg_daily_reviews, 1),
            best_day=best_day,
            quality_trend=quality_trend,
        )

        logger.info(
            "Learning trends built successfully",
            extra={
                "user_id": str(user_id),
                "period": period,
                "total_reviews": total_reviews,
                "cards_mastered": cards_mastered,
                "quality_trend": quality_trend,
            },
        )

        return LearningTrendsResponse(
            period=period,
            start_date=start_date,
            end_date=end_date,
            daily_stats=daily_stats,
            summary=summary,
        )

    # =========================================================================
    # Achievements
    # =========================================================================

    def _get_achievement_value(
        self,
        achievement_type: AchievementType,
        stats: dict[str, int],
    ) -> int:
        """Get current value for an achievement type.

        Args:
            achievement_type: Type of achievement to check
            stats: Dict containing user statistics

        Returns:
            Current value for the achievement metric
        """
        type_to_stat: dict[AchievementType, str] = {
            AchievementType.STREAK: "longest_streak",
            AchievementType.MASTERED: "total_mastered",
            AchievementType.REVIEWS: "total_reviews",
            AchievementType.STUDY_TIME: "total_study_time",
            AchievementType.DECKS: "total_decks",
        }
        stat_key = type_to_stat.get(achievement_type, "")
        return stats.get(stat_key, 0)

    async def get_achievements(self, user_id: UUID) -> AchievementsResponse:
        """Get user achievements and progress.

        Calculates achievement progress in real-time based on user statistics.
        Statistics are AGGREGATED from vocabulary flashcards and culture cards.
        Returns all achievements with their unlock status, progress percentage,
        total points earned, and the next milestone to unlock.

        Args:
            user_id: User UUID

        Returns:
            AchievementsResponse with achievements list, total points, and next milestone
        """
        logger.debug(
            "Building achievements",
            extra={"user_id": str(user_id)},
        )

        # Gather user statistics - AGGREGATED from vocabulary + culture
        stats = {
            "longest_streak": await self._get_aggregated_longest_streak(user_id),
            "total_mastered": await self.progress_repo.get_total_cards_mastered(user_id),
            "total_reviews": await self._get_aggregated_total_reviews(user_id),
            "total_study_time": await self._get_aggregated_total_study_time(user_id),
            "total_decks": await self.progress_repo.count_user_decks(user_id),
        }

        achievements: list[Achievement] = []
        total_points = 0
        next_milestone: NextMilestone | None = None
        best_progress_for_next = -1.0  # Track closest to completion

        for definition in ACHIEVEMENTS:
            current_value = self._get_achievement_value(definition.type, stats)
            progress = min((current_value / definition.threshold) * 100, 100.0)
            unlocked = current_value >= definition.threshold

            achievement = Achievement(
                id=definition.id,
                name=definition.name,
                description=definition.description,
                icon=definition.icon,
                unlocked=unlocked,
                unlocked_at=None,  # Would need DB tracking for actual unlock time
                progress=round(progress, 1),
                points=definition.points if unlocked else 0,
            )
            achievements.append(achievement)

            if unlocked:
                total_points += definition.points
            else:
                # Track as potential next milestone (highest progress that's not complete)
                if progress > best_progress_for_next:
                    best_progress_for_next = progress
                    remaining = definition.threshold - current_value
                    next_milestone = NextMilestone(
                        id=definition.id,
                        name=definition.name,
                        progress=round(progress, 1),
                        remaining=remaining,
                    )

        logger.info(
            "Achievements built successfully",
            extra={
                "user_id": str(user_id),
                "total_achievements": len(achievements),
                "unlocked_count": sum(1 for a in achievements if a.unlocked),
                "total_points": total_points,
            },
        )

        return AchievementsResponse(
            achievements=achievements,
            total_points=total_points,
            next_milestone=next_milestone,
        )


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["ProgressService"]
