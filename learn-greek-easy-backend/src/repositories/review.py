"""Review repository for history and analytics."""

from datetime import date, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Card, Review
from src.repositories.base import BaseRepository


class ReviewRepository(BaseRepository[Review]):
    """Repository for Review model with analytics queries."""

    def __init__(self, db: AsyncSession):
        super().__init__(Review, db)

    async def get_user_reviews(
        self,
        user_id: UUID,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Review]:
        """Get user's review history with optional date filter.

        Args:
            user_id: User UUID
            start_date: Optional start date filter
            end_date: Optional end date filter
            skip: Pagination offset
            limit: Max results

        Returns:
            List of reviews ordered by most recent

        Use Case:
            Review history page, analytics dashboard
        """
        query = select(Review).where(Review.user_id == user_id).order_by(Review.reviewed_at.desc())

        if start_date is not None:
            query = query.where(Review.reviewed_at >= start_date)

        if end_date is not None:
            # Include entire end_date
            end_datetime = datetime.combine(end_date, datetime.max.time())
            query = query.where(Review.reviewed_at <= end_datetime)

        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_reviews_today(self, user_id: UUID) -> int:
        """Count reviews completed today.

        Args:
            user_id: User UUID

        Returns:
            Number of reviews today

        Use Case:
            Daily goal tracking
        """
        today_start = datetime.combine(date.today(), datetime.min.time())
        query = (
            select(func.count())
            .select_from(Review)
            .where(Review.user_id == user_id)
            .where(Review.reviewed_at >= today_start)
        )
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_streak(self, user_id: UUID) -> int:
        """Calculate current study streak (consecutive days).

        Args:
            user_id: User UUID

        Returns:
            Number of consecutive days with at least one review

        Use Case:
            Gamification, dashboard statistics

        Note:
            This is a simplified version. Production might use
            a more efficient materialized view approach.
        """
        # Get unique dates with reviews in past 30 days
        thirty_days_ago = date.today() - timedelta(days=30)
        query = (
            select(func.date(Review.reviewed_at).label("review_date"))
            .where(Review.user_id == user_id)
            .where(Review.reviewed_at >= thirty_days_ago)
            .group_by(func.date(Review.reviewed_at))
            .order_by(func.date(Review.reviewed_at).desc())
        )
        result = await self.db.execute(query)
        review_dates = [row[0] for row in result.all()]

        if not review_dates:
            return 0

        # Count consecutive days
        streak = 0
        current_date = date.today()

        for review_date in review_dates:
            if review_date == current_date:
                streak += 1
                current_date -= timedelta(days=1)
            else:
                break

        return streak

    async def get_average_quality(
        self,
        user_id: UUID,
        days: int = 7,
    ) -> float:
        """Calculate average review quality rating.

        Args:
            user_id: User UUID
            days: Number of days to include in calculation

        Returns:
            Average quality rating (0.0-5.0)

        Use Case:
            Performance analytics
        """
        cutoff = datetime.now() - timedelta(days=days)
        query = (
            select(func.avg(Review.quality))
            .where(Review.user_id == user_id)
            .where(Review.reviewed_at >= cutoff)
        )
        result = await self.db.execute(query)
        avg = result.scalar_one_or_none()
        return float(avg) if avg is not None else 0.0

    async def get_total_reviews(self, user_id: UUID) -> int:
        """Get total number of reviews for a user.

        Args:
            user_id: User UUID

        Returns:
            Total review count
        """
        query = select(func.count()).select_from(Review).where(Review.user_id == user_id)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_total_study_time(self, user_id: UUID) -> int:
        """Get total study time in seconds.

        Args:
            user_id: User UUID

        Returns:
            Total seconds spent studying
        """
        query = select(func.coalesce(func.sum(Review.time_taken), 0)).where(
            Review.user_id == user_id
        )
        result = await self.db.execute(query)
        return result.scalar_one()

    async def count_user_reviews(
        self,
        user_id: UUID,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> int:
        """Count user's reviews with optional date filter.

        This method counts reviews matching the same filter criteria as
        get_user_reviews(), making it suitable for pagination total counts.

        Args:
            user_id: User UUID
            start_date: Optional start date filter (inclusive)
            end_date: Optional end date filter (inclusive)

        Returns:
            Total count of reviews matching criteria

        Use Case:
            Pagination - get total count for review history endpoint
        """
        query = select(func.count()).select_from(Review).where(Review.user_id == user_id)

        if start_date is not None:
            query = query.where(Review.reviewed_at >= start_date)

        if end_date is not None:
            # Include entire end_date
            end_datetime = datetime.combine(end_date, datetime.max.time())
            query = query.where(Review.reviewed_at <= end_datetime)

        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_reviews_by_date_range(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
        deck_id: UUID | None = None,
    ) -> list[Review]:
        """Get reviews within a date range for trends.

        Args:
            user_id: User ID to filter by
            start_date: Start date (inclusive)
            end_date: End date (inclusive)
            deck_id: Optional deck filter

        Returns:
            List of Review objects within the date range
        """
        query = (
            select(Review)
            .where(Review.user_id == user_id)
            .where(func.date(Review.reviewed_at) >= start_date)
            .where(func.date(Review.reviewed_at) <= end_date)
        )
        if deck_id:
            query = query.join(Card).where(Card.deck_id == deck_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_daily_review_counts(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
    ) -> list[tuple[Any, int]]:
        """Get review counts grouped by date.

        Args:
            user_id: User ID to filter by
            start_date: Start date (inclusive)
            end_date: End date (inclusive)

        Returns:
            List of (date, count) tuples ordered by date ascending
        """
        query = (
            select(
                func.date(Review.reviewed_at).label("review_date"),
                func.count().label("count"),
            )
            .where(Review.user_id == user_id)
            .where(func.date(Review.reviewed_at) >= start_date)
            .where(func.date(Review.reviewed_at) <= end_date)
            .group_by(func.date(Review.reviewed_at))
            .order_by(func.date(Review.reviewed_at))
        )
        result = await self.db.execute(query)
        return [(row[0], row[1]) for row in result.all()]

    async def get_daily_stats(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """Get aggregated daily statistics for trends.

        Args:
            user_id: User ID to filter by
            start_date: Start date (inclusive)
            end_date: End date (inclusive)

        Returns:
            List of dicts with:
            - date: The review date
            - reviews_count: Number of reviews
            - total_time_seconds: Sum of time_taken
            - average_quality: Average quality rating (0-5)
        """
        query = (
            select(
                func.date(Review.reviewed_at).label("review_date"),
                func.count().label("reviews_count"),
                func.coalesce(func.sum(Review.time_taken), 0).label("total_time_seconds"),
                func.avg(Review.quality).label("average_quality"),
            )
            .where(Review.user_id == user_id)
            .where(func.date(Review.reviewed_at) >= start_date)
            .where(func.date(Review.reviewed_at) <= end_date)
            .group_by(func.date(Review.reviewed_at))
            .order_by(func.date(Review.reviewed_at))
        )
        result = await self.db.execute(query)
        return [
            {
                "date": row[0],
                "reviews_count": row[1],
                "total_time_seconds": row[2],
                "average_quality": float(row[3]) if row[3] else 0.0,
            }
            for row in result.all()
        ]

    async def get_study_time_today(self, user_id: UUID) -> int:
        """Get total study time in seconds for today.

        Args:
            user_id: User UUID

        Returns:
            Total study time in seconds for today
        """
        today = date.today()
        query = (
            select(func.coalesce(func.sum(Review.time_taken), 0))
            .where(Review.user_id == user_id)
            .where(func.date(Review.reviewed_at) == today)
        )
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_longest_streak(self, user_id: UUID) -> int:
        """Calculate longest historical streak.

        Scans full review history to find the longest consecutive
        day streak where user had at least one review.

        Args:
            user_id: User UUID

        Returns:
            Longest streak in days

        Note:
            For production, consider caching this value or using
            a materialized approach for users with extensive history.
        """
        # Get all unique dates with reviews, ordered
        query = (
            select(func.date(Review.reviewed_at).label("review_date"))
            .where(Review.user_id == user_id)
            .group_by(func.date(Review.reviewed_at))
            .order_by(func.date(Review.reviewed_at))
        )
        result = await self.db.execute(query)
        dates = [row.review_date for row in result.all()]

        if not dates:
            return 0

        longest = 1
        current = 1

        for i in range(1, len(dates)):
            if (dates[i] - dates[i - 1]).days == 1:
                current += 1
                longest = max(longest, current)
            else:
                current = 1

        return longest

    async def get_accuracy_stats(
        self,
        user_id: UUID,
        days: int = 30,
    ) -> dict[str, int]:
        """Get correct/total for accuracy calculation.

        Reviews with quality >= 3 are considered correct (SM-2 convention).

        Args:
            user_id: User UUID
            days: Number of days to look back

        Returns:
            Dict with 'correct' and 'total' counts

        Use Case:
            Dashboard stats - combined accuracy percentage
        """
        cutoff = datetime.now() - timedelta(days=days)

        # Count total reviews in period
        total_query = (
            select(func.count())
            .select_from(Review)
            .where(Review.user_id == user_id)
            .where(Review.reviewed_at >= cutoff)
        )
        total_result = await self.db.execute(total_query)
        total = total_result.scalar_one()

        # Count correct reviews (quality >= 3)
        correct_query = (
            select(func.count())
            .select_from(Review)
            .where(Review.user_id == user_id)
            .where(Review.reviewed_at >= cutoff)
            .where(Review.quality >= 3)
        )
        correct_result = await self.db.execute(correct_query)
        correct = correct_result.scalar_one()

        return {"correct": correct, "total": total}

    async def get_dates_with_vocab_activity(
        self,
        user_id: UUID,
        days: int = 30,
    ) -> list[date]:
        """Get unique dates with vocab activity for streak calculation.

        Args:
            user_id: User UUID
            days: Number of days to look back

        Returns:
            List of dates with vocab activity, ordered descending

        Use Case:
            Dashboard stats - combined streak calculation
        """
        cutoff = datetime.now() - timedelta(days=days)

        query = (
            select(func.date(Review.reviewed_at).label("review_date"))
            .where(Review.user_id == user_id)
            .where(Review.reviewed_at >= cutoff)
            .group_by(func.date(Review.reviewed_at))
            .order_by(func.date(Review.reviewed_at).desc())
        )

        result = await self.db.execute(query)
        return [row[0] for row in result.all()]
