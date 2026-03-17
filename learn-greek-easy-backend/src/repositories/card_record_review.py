"""CardRecordReview repository for V2 card system analytics."""

from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, func, select
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
