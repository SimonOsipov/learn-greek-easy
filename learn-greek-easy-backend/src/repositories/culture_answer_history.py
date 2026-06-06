"""CultureAnswerHistory repository for analytics and statistics.

Provides queries for aggregating culture card session statistics
into the dashboard, including:
- Streak contribution (unique dates with answers)
- Study time aggregation
- Accuracy calculation
- Daily stats for trends
"""

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.constants import MAX_ANSWER_TIME_SECONDS
from src.db.models import CultureAnswerHistory, CultureQuestion
from src.repositories.base import BaseRepository


class CultureAnswerHistoryRepository(BaseRepository[CultureAnswerHistory]):
    """Repository for CultureAnswerHistory model with analytics queries.

    Provides methods to aggregate culture card session data for:
    - Dashboard statistics (streak, time, accuracy)
    - Learning trends (daily stats)
    - Achievement tracking
    """

    def __init__(self, db: AsyncSession):
        """Initialize the CultureAnswerHistory repository.

        Args:
            db: Async database session for persistence operations
        """
        super().__init__(CultureAnswerHistory, db)

    async def count_answers_today(self, user_id: UUID) -> int:
        """Count culture answers completed today.

        Args:
            user_id: User UUID

        Returns:
            Number of culture answers today

        Use Case:
            Daily goal tracking - culture answers contribute to combined goal
        """
        today_start = datetime.combine(date.today(), datetime.min.time())
        query = (
            select(func.count())
            .select_from(CultureAnswerHistory)
            .where(CultureAnswerHistory.user_id == user_id)
            .where(CultureAnswerHistory.created_at >= today_start)
        )
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_study_time_today(self, user_id: UUID) -> int:
        """Get total study time in seconds for today from culture answers.

        Args:
            user_id: User UUID

        Returns:
            Total study time in seconds for today (capped per answer)
        """
        today = date.today()
        # Cap each answer's time at MAX_ANSWER_TIME_SECONDS to handle outliers
        capped_time = func.least(CultureAnswerHistory.time_taken_seconds, MAX_ANSWER_TIME_SECONDS)
        query = (
            select(func.coalesce(func.sum(capped_time), 0))
            .where(CultureAnswerHistory.user_id == user_id)
            .where(func.date(CultureAnswerHistory.created_at) == today)
        )
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_study_time_this_week(self, user_id: UUID) -> int:
        """Get culture study time in seconds over the trailing 7 days (rolling).

        Sums ``time_taken_seconds`` from culture *practice* answers created in
        the last 7x24h, capping each answer at ``MAX_ANSWER_TIME_SECONDS``.
        Mock-exam time is excluded by construction: mock answers are written to
        the mock-exam tables, never to ``culture_answer_history``.

        Args:
            user_id: User UUID

        Returns:
            Total study time in seconds for the trailing 7 days (capped per answer)
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        # Cap each answer's time at MAX_ANSWER_TIME_SECONDS to handle outliers
        capped_time = func.least(CultureAnswerHistory.time_taken_seconds, MAX_ANSWER_TIME_SECONDS)
        query = (
            select(func.coalesce(func.sum(capped_time), 0))
            .where(CultureAnswerHistory.user_id == user_id)
            .where(CultureAnswerHistory.created_at >= cutoff)
        )
        result = await self.db.execute(query)
        return int(result.scalar() or 0)

    async def get_study_time_for_deck(self, user_id: UUID, deck_id: UUID) -> int:
        """Total capped study time (seconds) for a user across one deck's questions.

        culture_answer_history has no deck_id, so JOIN to CultureQuestion on
        question_id and filter by CultureQuestion.deck_id. Each answer is capped
        at MAX_ANSWER_TIME_SECONDS. Mock-exam time is excluded by construction
        (it is never written to culture_answer_history).
        """
        capped_time = func.least(CultureAnswerHistory.time_taken_seconds, MAX_ANSWER_TIME_SECONDS)
        query = (
            select(func.coalesce(func.sum(capped_time), 0))
            .select_from(CultureAnswerHistory)
            .join(CultureQuestion, CultureAnswerHistory.question_id == CultureQuestion.id)
            .where(CultureAnswerHistory.user_id == user_id)
            .where(CultureQuestion.deck_id == deck_id)
        )
        result = await self.db.execute(query)
        return int(result.scalar() or 0)

    async def get_total_study_time(self, user_id: UUID) -> int:
        """Get total study time in seconds from all culture answers.

        Args:
            user_id: User UUID

        Returns:
            Total seconds spent on culture cards (capped per answer)
        """
        # Cap each answer's time at MAX_ANSWER_TIME_SECONDS to handle outliers
        capped_time = func.least(CultureAnswerHistory.time_taken_seconds, MAX_ANSWER_TIME_SECONDS)
        query = select(func.coalesce(func.sum(capped_time), 0)).where(
            CultureAnswerHistory.user_id == user_id
        )
        result = await self.db.execute(query)
        return int(result.scalar_one())

    async def get_total_answers(self, user_id: UUID) -> int:
        """Get total number of culture answers for a user.

        Args:
            user_id: User UUID

        Returns:
            Total culture answer count
        """
        query = (
            select(func.count())
            .select_from(CultureAnswerHistory)
            .where(CultureAnswerHistory.user_id == user_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_correct_answers_count(self, user_id: UUID) -> int:
        """Get count of correct culture answers.

        Args:
            user_id: User UUID

        Returns:
            Number of correct answers
        """
        query = (
            select(func.count())
            .select_from(CultureAnswerHistory)
            .where(CultureAnswerHistory.user_id == user_id)
            .where(CultureAnswerHistory.is_correct == True)  # noqa: E712
        )
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_unique_dates(self, user_id: UUID, days: int = 30) -> list[date]:
        """Get unique dates with culture answers in the past N days.

        Args:
            user_id: User UUID
            days: Number of days to look back

        Returns:
            List of dates with at least one culture answer

        Use Case:
            Streak calculation - these dates contribute to study streak
        """
        cutoff = date.today() - timedelta(days=days)
        query = (
            select(func.date(CultureAnswerHistory.created_at).label("answer_date"))
            .where(CultureAnswerHistory.user_id == user_id)
            .where(CultureAnswerHistory.created_at >= cutoff)
            .group_by(func.date(CultureAnswerHistory.created_at))
            .order_by(func.date(CultureAnswerHistory.created_at).desc())
        )
        result = await self.db.execute(query)
        return [row[0] for row in result.all()]

    async def get_all_unique_dates(self, user_id: UUID) -> list[date]:
        """Get all unique dates with culture answers (for longest streak).

        Args:
            user_id: User UUID

        Returns:
            List of all dates with at least one culture answer, ordered ascending

        Use Case:
            Longest streak calculation
        """
        query = (
            select(func.date(CultureAnswerHistory.created_at).label("answer_date"))
            .where(CultureAnswerHistory.user_id == user_id)
            .group_by(func.date(CultureAnswerHistory.created_at))
            .order_by(func.date(CultureAnswerHistory.created_at))
        )
        result = await self.db.execute(query)
        return [row.answer_date for row in result.all()]

    async def get_daily_stats(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """Get aggregated daily statistics for culture answers.

        Args:
            user_id: User ID to filter by
            start_date: Start date (inclusive)
            end_date: End date (inclusive)

        Returns:
            List of dicts with:
            - date: The answer date
            - answers_count: Number of answers
            - correct_count: Number of correct answers
            - total_time_seconds: Sum of time_taken_seconds (capped per answer)
        """
        from sqlalchemy import case, literal

        # Cap each answer's time at MAX_ANSWER_TIME_SECONDS to handle outliers
        capped_time = func.least(CultureAnswerHistory.time_taken_seconds, MAX_ANSWER_TIME_SECONDS)
        query = (
            select(
                func.date(CultureAnswerHistory.created_at).label("answer_date"),
                func.count().label("answers_count"),
                func.sum(
                    case(
                        (CultureAnswerHistory.is_correct == True, literal(1)),  # noqa: E712
                        else_=literal(0),
                    )
                ).label("correct_count"),
                func.coalesce(func.sum(capped_time), 0).label("total_time_seconds"),
            )
            .where(CultureAnswerHistory.user_id == user_id)
            .where(func.date(CultureAnswerHistory.created_at) >= start_date)
            .where(func.date(CultureAnswerHistory.created_at) <= end_date)
            .group_by(func.date(CultureAnswerHistory.created_at))
            .order_by(func.date(CultureAnswerHistory.created_at))
        )
        result = await self.db.execute(query)
        return [
            {
                "date": row[0],
                "answers_count": row[1],
                "correct_count": int(row[2]) if row[2] else 0,
                "total_time_seconds": row[3],
            }
            for row in result.all()
        ]

    async def get_daily_answer_counts(self, user_id: UUID) -> list[tuple[date, int]]:
        """Return per-day culture-answer counts across all time for a user.

        Used for daily-goal-streak metrics.

        Args:
            user_id: User UUID

        Returns:
            List of (date, count) tuples ordered chronologically (ascending).
            Empty list if the user has no answers.
        """
        query = (
            select(
                func.date(CultureAnswerHistory.created_at).label("answer_date"),
                func.count().label("cnt"),
            )
            .where(CultureAnswerHistory.user_id == user_id)
            .group_by(func.date(CultureAnswerHistory.created_at))
            .order_by(func.date(CultureAnswerHistory.created_at).asc())
        )
        result = await self.db.execute(query)
        return [(row.answer_date, int(row.cnt)) for row in result.all()]

    async def get_daily_answer_aggregates(self, user_id: UUID) -> list[tuple[date, int, int]]:
        """Return per-day (total_count, correct_count) for a user across all time.

        SQLCON-04: replaces three separate round-trips on the GamificationProjection
        path (get_total_answers + get_correct_answers_count + get_daily_answer_counts)
        with a single conditional-aggregate GROUP BY query.

        Uses the same ``func.date(created_at)`` bucketing expression as
        ``get_daily_answer_counts`` so day boundaries are byte-identical (AC3).

        Equivalence proof: ``count(*)`` summed over a complete day-partition equals
        ``count(*)`` over the whole set (every row has exactly one date bucket, no
        NULL created_at).  Same for the conditional sum over is_correct.

        Args:
            user_id: User UUID.

        Returns:
            List of ``(answer_date, total_count, correct_count)`` tuples ordered
            chronologically ascending.  Empty list when the user has no answers.
        """
        from sqlalchemy import case, literal  # already imported in get_daily_stats

        correct_expr = func.sum(
            case(
                (CultureAnswerHistory.is_correct == True, literal(1)),  # noqa: E712
                else_=literal(0),
            )
        )
        query = (
            select(
                func.date(CultureAnswerHistory.created_at).label("answer_date"),
                func.count().label("total_cnt"),
                correct_expr.label("correct_cnt"),
            )
            .where(CultureAnswerHistory.user_id == user_id)
            .group_by(func.date(CultureAnswerHistory.created_at))
            .order_by(func.date(CultureAnswerHistory.created_at).asc())
        )
        result = await self.db.execute(query)
        return [(row.answer_date, int(row.total_cnt), int(row.correct_cnt)) for row in result.all()]

    async def get_consecutive_correct_streak(self, user_id: UUID) -> int:
        """Count the current run of correct culture answers from the most recent.

        Walks answers in descending ``created_at`` order and counts until the
        first answer with ``is_correct == False``.

        Args:
            user_id: User UUID.

        Returns:
            Number of consecutive correct answers ending with the most recent
            answer (0 if no answers or the most recent answer is incorrect).
        """
        query = (
            select(CultureAnswerHistory.is_correct)
            .where(CultureAnswerHistory.user_id == user_id)
            .order_by(CultureAnswerHistory.created_at.desc())
        )
        result = await self.db.execute(query)
        streak = 0
        for (is_correct,) in result.all():
            if is_correct:
                streak += 1
            else:
                break
        return streak

    async def count_by_language(self, user_id: UUID, language: str) -> int:
        """Count culture answers for a specific language.

        Args:
            user_id: User UUID.
            language: Language code to filter by (e.g. 'el', 'en').

        Returns:
            Number of answers in the specified language.
        """
        query = (
            select(func.count())
            .select_from(CultureAnswerHistory)
            .where(CultureAnswerHistory.user_id == user_id)
            .where(CultureAnswerHistory.language == language)
        )
        result = await self.db.execute(query)
        return result.scalar_one()

    async def count_distinct_languages(self, user_id: UUID) -> int:
        """Count distinct languages used in culture answers.

        Args:
            user_id: User UUID.

        Returns:
            Number of distinct language codes used by the user.
        """
        query = select(func.count(func.distinct(CultureAnswerHistory.language))).where(
            CultureAnswerHistory.user_id == user_id
        )
        result = await self.db.execute(query)
        return result.scalar_one()

    async def delete_all_by_user_id(self, user_id: UUID) -> int:
        """Delete all culture answer history for a user.

        Args:
            user_id: User UUID

        Returns:
            Number of deleted records
        """
        result = await self.db.execute(
            delete(CultureAnswerHistory).where(CultureAnswerHistory.user_id == user_id)
        )
        return int(result.rowcount) if result.rowcount else 0  # type: ignore[attr-defined]


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["CultureAnswerHistoryRepository"]
