"""ExerciseRecord repository."""

from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatus, ExerciseRecord
from src.repositories.base import BaseRepository


class ExerciseRecordRepository(BaseRepository[ExerciseRecord]):
    """Repository for ExerciseRecord SM-2 state rows."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(ExerciseRecord, db)

    async def get_or_create(self, user_id: UUID, exercise_id: UUID) -> tuple[ExerciseRecord, bool]:
        """Return (record, created). SELECT first; INSERT with SM-2 defaults on miss.

        Handles concurrent UNIQUE(user_id, exercise_id) races via a nested savepoint.
        """
        result = await self.db.execute(
            select(ExerciseRecord).where(
                ExerciseRecord.user_id == user_id,
                ExerciseRecord.exercise_id == exercise_id,
            )
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            return existing, False

        try:
            async with self.db.begin_nested():
                record = ExerciseRecord(
                    user_id=user_id,
                    exercise_id=exercise_id,
                )
                self.db.add(record)
                await self.db.flush()
        except IntegrityError:
            result = await self.db.execute(
                select(ExerciseRecord).where(
                    ExerciseRecord.user_id == user_id,
                    ExerciseRecord.exercise_id == exercise_id,
                )
            )
            return result.scalar_one(), False

        return record, True

    async def update_sm2_data(
        self,
        record_id: UUID,
        easiness_factor: float,
        interval: int,
        repetitions: int,
        next_review_date: date,
        status: CardStatus,
    ) -> ExerciseRecord:
        """Update SM-2 fields on an ExerciseRecord. Raises 404 if not found."""
        record = await self.get_or_404(record_id)
        record.easiness_factor = easiness_factor
        record.interval = interval
        record.repetitions = repetitions
        record.next_review_date = next_review_date
        record.status = status
        self.db.add(record)
        await self.db.flush()
        return record
