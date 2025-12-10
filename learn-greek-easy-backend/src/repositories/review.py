"""Review repository for history and analytics."""

from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Review
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
