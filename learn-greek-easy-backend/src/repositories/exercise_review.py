"""ExerciseReview repository."""

from uuid import UUID

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
