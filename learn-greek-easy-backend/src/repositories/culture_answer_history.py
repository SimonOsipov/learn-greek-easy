"""CultureAnswerHistory repository for analytics and statistics.

Provides queries for aggregating culture card session statistics
into the dashboard, including:
- Streak contribution (unique dates with answers)
- Study time aggregation
- Accuracy calculation
- Daily stats for trends
"""

from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.constants import MAX_ANSWER_TIME_SECONDS
from src.db.models import CultureAnswerHistory
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
