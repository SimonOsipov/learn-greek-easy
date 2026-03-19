"""CardRecordReview repository for V2 card system analytics."""

from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardRecordReview
from src.repositories.base import BaseRepository


class CardRecordReviewRepository(BaseRepository[CardRecordReview]):
    """Repository for CardRecordReview model.

    Mirrors ReviewRepository but operates on the V2 card_records system.
    Review creation uses direct model instantiation in the service layer.
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(CardRecordReview, db)

    async def count_reviews_today(self, user_id: UUID) -> int:
        """Count reviews completed today for this user.

        Args:
            user_id: User UUID.

        Returns:
            Number of reviews today.
        """
        today_start = datetime.combine(date.today(), datetime.min.time())
        query = (
            select(func.count())
            .select_from(CardRecordReview)
            .where(CardRecordReview.user_id == user_id)
            .where(CardRecordReview.reviewed_at >= today_start)
        )
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_streak(self, user_id: UUID) -> int:
        """Calculate current consecutive study streak in days.

        Counts consecutive days ending today (or yesterday if no review today)
        that have at least one review. Looks back up to 30 days.

        Args:
            user_id: User UUID.

        Returns:
            Streak length in days (0 if no reviews).
        """
        thirty_days_ago = date.today() - timedelta(days=30)
        query = (
            select(func.date(CardRecordReview.reviewed_at).label("review_date"))
            .where(CardRecordReview.user_id == user_id)
            .where(CardRecordReview.reviewed_at >= thirty_days_ago)
            .group_by(func.date(CardRecordReview.reviewed_at))
            .order_by(func.date(CardRecordReview.reviewed_at).desc())
        )
        result = await self.db.execute(query)
        review_dates = [row[0] for row in result.all()]

        if not review_dates:
            return 0

        streak = 0
        current_date = date.today()

        for review_date in review_dates:
            if review_date == current_date:
                streak += 1
                current_date -= timedelta(days=1)
            else:
                break

        return streak

    async def delete_all_by_user_id(self, user_id: UUID) -> int:
        """Delete all card record reviews for a user.

        Args:
            user_id: User UUID.

        Returns:
            Number of deleted records.
        """
        result = await self.db.execute(
            delete(CardRecordReview).where(CardRecordReview.user_id == user_id)
        )
        return int(result.rowcount) if result.rowcount else 0  # type: ignore[attr-defined]

    async def get_daily_stats(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """Get daily review statistics for a user within a date range.

        Args:
            user_id: User UUID.
            start_date: Start of date range (inclusive).
            end_date: End of date range (inclusive).

        Returns:
            List of dicts with date, reviews_count, avg_quality, total_time.
        """
        query = (
            select(
                func.date(CardRecordReview.reviewed_at).label("date"),
                func.count().label("reviews_count"),
                func.avg(CardRecordReview.quality).label("avg_quality"),
                func.coalesce(func.sum(CardRecordReview.time_taken), 0).label("total_time"),
            )
            .where(
                CardRecordReview.user_id == user_id,
                func.date(CardRecordReview.reviewed_at) >= start_date,
                func.date(CardRecordReview.reviewed_at) <= end_date,
            )
            .group_by(func.date(CardRecordReview.reviewed_at))
            .order_by(func.date(CardRecordReview.reviewed_at))
        )
        result = await self.db.execute(query)
        rows = result.all()
        return [
            {
                "date": row.date,
                "reviews_count": row.reviews_count,
                "avg_quality": float(row.avg_quality) if row.avg_quality is not None else 0.0,
                "total_time": int(row.total_time),
            }
            for row in rows
        ]

    async def get_study_time_today(self, user_id: UUID) -> int:
        """Get total study time in seconds for today.

        Args:
            user_id: User UUID.

        Returns:
            Total time_taken in seconds for today's reviews.
        """
        today_start = datetime.combine(date.today(), datetime.min.time())
        query = select(func.coalesce(func.sum(CardRecordReview.time_taken), 0)).where(
            CardRecordReview.user_id == user_id,
            CardRecordReview.reviewed_at >= today_start,
        )
        result = await self.db.execute(query)
        return int(result.scalar_one())

    async def get_total_reviews(self, user_id: UUID) -> int:
        """Get total number of reviews for a user across all time.

        Args:
            user_id: User UUID.

        Returns:
            Total review count.
        """
        query = (
            select(func.count())
            .select_from(CardRecordReview)
            .where(
                CardRecordReview.user_id == user_id,
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_total_study_time(self, user_id: UUID) -> int:
        """Get total study time in seconds across all time for a user.

        Args:
            user_id: User UUID.

        Returns:
            Total time_taken in seconds.
        """
        query = select(func.coalesce(func.sum(CardRecordReview.time_taken), 0)).where(
            CardRecordReview.user_id == user_id,
        )
        result = await self.db.execute(query)
        return int(result.scalar_one())

    async def get_accuracy_stats(self, user_id: UUID, days: int) -> dict[str, int]:
        """Get correct vs total review counts for a user over a rolling window.

        Args:
            user_id: User UUID.
            days: Number of days to look back.

        Returns:
            Dict with 'correct' and 'total' keys.
        """
        cutoff = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())
        query = select(
            func.count().label("total"),
            func.sum(case((CardRecordReview.quality >= 3, 1), else_=0)).label("correct"),
        ).where(
            CardRecordReview.user_id == user_id,
            CardRecordReview.reviewed_at >= cutoff,
        )
        result = await self.db.execute(query)
        row = result.one()
        return {"correct": int(row.correct or 0), "total": int(row.total or 0)}

    async def get_daily_accuracy_stats(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """Get per-day accuracy stats for a user within a date range.

        Args:
            user_id: User UUID.
            start_date: Start of date range (inclusive).
            end_date: End of date range (inclusive).

        Returns:
            List of dicts with date, correct, total.
        """
        query = (
            select(
                func.date(CardRecordReview.reviewed_at).label("date"),
                func.count().label("total"),
                func.sum(case((CardRecordReview.quality >= 3, 1), else_=0)).label("correct"),
            )
            .where(
                CardRecordReview.user_id == user_id,
                func.date(CardRecordReview.reviewed_at) >= start_date,
                func.date(CardRecordReview.reviewed_at) <= end_date,
            )
            .group_by(func.date(CardRecordReview.reviewed_at))
            .order_by(func.date(CardRecordReview.reviewed_at))
        )
        result = await self.db.execute(query)
        rows = result.all()
        return [
            {
                "date": row.date,
                "correct": int(row.correct or 0),
                "total": int(row.total),
            }
            for row in rows
        ]

    async def get_average_quality(self, user_id: UUID) -> float:
        """Get average review quality across all reviews for a user.

        Args:
            user_id: User UUID.

        Returns:
            Average quality score (0.0 if no reviews).
        """
        query = select(func.avg(CardRecordReview.quality)).where(
            CardRecordReview.user_id == user_id,
        )
        result = await self.db.execute(query)
        val = result.scalar_one()
        return float(val) if val is not None else 0.0

    async def get_unique_dates(self, user_id: UUID, days: int) -> list[date]:
        """Get distinct dates on which the user reviewed cards within a rolling window.

        Args:
            user_id: User UUID.
            days: Number of days to look back.

        Returns:
            List of dates in descending order.
        """
        cutoff = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())
        query = (
            select(func.date(CardRecordReview.reviewed_at).label("review_date"))
            .where(
                CardRecordReview.user_id == user_id,
                CardRecordReview.reviewed_at >= cutoff,
            )
            .group_by(func.date(CardRecordReview.reviewed_at))
            .order_by(func.date(CardRecordReview.reviewed_at).desc())
        )
        result = await self.db.execute(query)
        return [row.review_date for row in result.all()]

    async def get_all_unique_dates(self, user_id: UUID) -> list[date]:
        """Get all distinct dates on which the user reviewed cards, oldest first.

        Args:
            user_id: User UUID.

        Returns:
            List of dates in ascending order.
        """
        query = (
            select(func.date(CardRecordReview.reviewed_at).label("review_date"))
            .where(CardRecordReview.user_id == user_id)
            .group_by(func.date(CardRecordReview.reviewed_at))
            .order_by(func.date(CardRecordReview.reviewed_at).asc())
        )
        result = await self.db.execute(query)
        return [row.review_date for row in result.all()]
