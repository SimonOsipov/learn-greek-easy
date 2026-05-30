"""ExerciseReview repository."""

from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import ExerciseReview
from src.repositories.base import BaseRepository


class ExerciseReviewRepository(BaseRepository[ExerciseReview]):
    """Repository for ExerciseReview per-review audit log rows."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(ExerciseReview, db)

    async def create_review(
        self,
        exercise_record_id: UUID,
        user_id: UUID,
        quality: int,
        score: int,
        max_score: int,
        easiness_factor_before: float,
        easiness_factor_after: float,
        interval_before: int,
        interval_after: int,
        repetitions_before: int,
        repetitions_after: int,
    ) -> ExerciseReview:
        """Create an immutable review record for an exercise attempt."""
        review = ExerciseReview(
            exercise_record_id=exercise_record_id,
            user_id=user_id,
            quality=quality,
            score=score,
            max_score=max_score,
            easiness_factor_before=easiness_factor_before,
            easiness_factor_after=easiness_factor_after,
            interval_before=interval_before,
            interval_after=interval_after,
            repetitions_before=repetitions_before,
            repetitions_after=repetitions_after,
        )
        self.db.add(review)
        await self.db.flush()
        return review

    async def get_unique_dates(self, user_id: UUID, days: int) -> list[date]:
        """Get distinct dates on which the user attempted exercises within a rolling window.

        Args:
            user_id: User UUID.
            days: Number of days to look back.

        Returns:
            List of dates in descending order.
        """
        cutoff = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())
        query = (
            select(func.date(ExerciseReview.reviewed_at).label("review_date"))
            .where(
                ExerciseReview.user_id == user_id,
                ExerciseReview.reviewed_at >= cutoff,
            )
            .group_by(func.date(ExerciseReview.reviewed_at))
            .order_by(func.date(ExerciseReview.reviewed_at).desc())
        )
        result = await self.db.execute(query)
        return [row.review_date for row in result.all()]

    async def get_all_unique_dates(self, user_id: UUID) -> list[date]:
        """Get all distinct dates on which the user attempted exercises, oldest first.

        Args:
            user_id: User UUID.

        Returns:
            List of dates in ascending order.
        """
        query = (
            select(func.date(ExerciseReview.reviewed_at).label("review_date"))
            .where(ExerciseReview.user_id == user_id)
            .group_by(func.date(ExerciseReview.reviewed_at))
            .order_by(func.date(ExerciseReview.reviewed_at).asc())
        )
        result = await self.db.execute(query)
        return [row.review_date for row in result.all()]
