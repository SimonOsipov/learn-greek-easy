"""ExerciseRecord repository."""

from datetime import date
from uuid import UUID

from sqlalchemy import not_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import (
    CardStatus,
    DeckLevel,
    DescriptionExercise,
    Exercise,
    ExerciseModality,
    ExerciseRecord,
    ExerciseSourceType,
    Situation,
    SituationDescription,
    SituationStatus,
)
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

    async def get_due_exercises(
        self,
        user_id: UUID,
        *,
        source_type: ExerciseSourceType | None = None,
        modality: ExerciseModality | None = None,
        audio_level: DeckLevel | None = None,
        situation_id: UUID | None = None,
        limit: int = 20,
    ) -> list[ExerciseRecord]:
        """Get exercise records due for review today or earlier."""
        query = (
            select(ExerciseRecord)
            .join(Exercise, ExerciseRecord.exercise_id == Exercise.id)
            .outerjoin(
                DescriptionExercise, Exercise.description_exercise_id == DescriptionExercise.id
            )
            .outerjoin(
                SituationDescription, DescriptionExercise.description_id == SituationDescription.id
            )
            .outerjoin(Situation, SituationDescription.situation_id == Situation.id)
            .where(ExerciseRecord.user_id == user_id)
            .where(ExerciseRecord.next_review_date <= date.today())
            .where(ExerciseRecord.status != CardStatus.NEW)
            .where(
                (Exercise.source_type != ExerciseSourceType.DESCRIPTION)
                | (Situation.status == SituationStatus.READY)
            )
            .options(selectinload(ExerciseRecord.exercise))
            .order_by(
                ExerciseRecord.next_review_date, SituationDescription.situation_id, Exercise.id
            )
            .limit(limit)
        )
        if source_type is not None:
            query = query.where(Exercise.source_type == source_type)
        if modality is not None:
            query = query.where(DescriptionExercise.modality == modality)
        if audio_level is not None:
            query = query.where(DescriptionExercise.audio_level == audio_level)
        if situation_id is not None:
            query = query.where(SituationDescription.situation_id == situation_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_new_exercises(
        self,
        user_id: UUID,
        *,
        source_type: ExerciseSourceType | None = None,
        modality: ExerciseModality | None = None,
        audio_level: DeckLevel | None = None,
        situation_id: UUID | None = None,
        limit: int = 10,
    ) -> list[Exercise]:
        """Get exercises not yet studied by this user."""
        studied_subq = (
            select(ExerciseRecord.exercise_id)
            .where(ExerciseRecord.user_id == user_id)
            .scalar_subquery()
        )
        query = (
            select(Exercise)
            .outerjoin(
                DescriptionExercise, Exercise.description_exercise_id == DescriptionExercise.id
            )
            .outerjoin(
                SituationDescription, DescriptionExercise.description_id == SituationDescription.id
            )
            .outerjoin(Situation, SituationDescription.situation_id == Situation.id)
            .where(not_(Exercise.id.in_(studied_subq)))
            .where(
                (Exercise.source_type != ExerciseSourceType.DESCRIPTION)
                | (Situation.status == SituationStatus.READY)
            )
            .order_by(SituationDescription.situation_id, Exercise.id)
            .limit(limit)
        )
        if source_type is not None:
            query = query.where(Exercise.source_type == source_type)
        if modality is not None:
            query = query.where(DescriptionExercise.modality == modality)
        if audio_level is not None:
            query = query.where(DescriptionExercise.audio_level == audio_level)
        if situation_id is not None:
            query = query.where(SituationDescription.situation_id == situation_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_early_practice_exercises(
        self,
        user_id: UUID,
        *,
        source_type: ExerciseSourceType | None = None,
        modality: ExerciseModality | None = None,
        audio_level: DeckLevel | None = None,
        situation_id: UUID | None = None,
        limit: int = 10,
    ) -> list[ExerciseRecord]:
        """Get exercise records not yet due but eligible for early practice."""
        query = (
            select(ExerciseRecord)
            .join(Exercise, ExerciseRecord.exercise_id == Exercise.id)
            .outerjoin(
                DescriptionExercise, Exercise.description_exercise_id == DescriptionExercise.id
            )
            .outerjoin(
                SituationDescription, DescriptionExercise.description_id == SituationDescription.id
            )
            .outerjoin(Situation, SituationDescription.situation_id == Situation.id)
            .where(ExerciseRecord.user_id == user_id)
            .where(ExerciseRecord.next_review_date > date.today())
            .where(ExerciseRecord.status.in_([CardStatus.LEARNING, CardStatus.REVIEW]))
            .where(
                (Exercise.source_type != ExerciseSourceType.DESCRIPTION)
                | (Situation.status == SituationStatus.READY)
            )
            .options(selectinload(ExerciseRecord.exercise))
            .order_by(
                ExerciseRecord.next_review_date, SituationDescription.situation_id, Exercise.id
            )
            .limit(limit)
        )
        if source_type is not None:
            query = query.where(Exercise.source_type == source_type)
        if modality is not None:
            query = query.where(DescriptionExercise.modality == modality)
        if audio_level is not None:
            query = query.where(DescriptionExercise.audio_level == audio_level)
        if situation_id is not None:
            query = query.where(SituationDescription.situation_id == situation_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())
