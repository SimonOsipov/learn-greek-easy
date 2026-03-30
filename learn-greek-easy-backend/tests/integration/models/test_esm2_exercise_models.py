"""Integration tests for ESM2 Exercise model constraints and cascade behavior."""

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    DialogExercise,
    Exercise,
    ExerciseRecord,
    ExerciseReview,
    ExerciseSourceType,
    ExerciseStatus,
    ExerciseType,
)
from tests.factories import (
    DescriptionExerciseFactory,
    ExerciseRecordFactory,
    ExerciseReviewFactory,
    ListeningDialogFactory,
    UserFactory,
)


@pytest.mark.asyncio
class TestExerciseCheckConstraint:
    """Tests for ck_exercises_exactly_one_source CHECK constraint."""

    async def test_zero_source_fks_raises_integrity_error(self, db_session: AsyncSession) -> None:
        """Row with all three source FKs null violates the CHECK constraint."""
        exercise = Exercise(
            source_type=ExerciseSourceType.DESCRIPTION,
            description_exercise_id=None,
            dialog_exercise_id=None,
            picture_exercise_id=None,
        )
        db_session.add(exercise)

        with pytest.raises(IntegrityError):
            await db_session.flush()

        await db_session.rollback()

    async def test_two_source_fks_raises_integrity_error(self, db_session: AsyncSession) -> None:
        """Row with two source FKs set simultaneously violates the CHECK constraint."""
        desc_exercise = await DescriptionExerciseFactory.create(session=db_session)
        dialog = await ListeningDialogFactory.create(session=db_session)
        dialog_exercise = DialogExercise(
            dialog_id=dialog.id,
            exercise_type=ExerciseType.FILL_GAPS,
            status=ExerciseStatus.DRAFT,
        )
        db_session.add(dialog_exercise)
        await db_session.flush()

        exercise = Exercise(
            source_type=ExerciseSourceType.DESCRIPTION,
            description_exercise_id=desc_exercise.id,
            dialog_exercise_id=dialog_exercise.id,
            picture_exercise_id=None,
        )
        db_session.add(exercise)

        with pytest.raises(IntegrityError):
            await db_session.flush()

        await db_session.rollback()


@pytest.mark.asyncio
class TestExerciseUniqueConstraint:
    """Tests for partial unique indexes on each source FK column."""

    async def test_duplicate_description_exercise_id_raises_integrity_error(
        self, db_session: AsyncSession
    ) -> None:
        """Two Exercise rows referencing the same description_exercise_id raises IntegrityError."""
        desc_exercise = await DescriptionExerciseFactory.create(session=db_session)

        # First row is fine
        exercise1 = Exercise(
            source_type=ExerciseSourceType.DESCRIPTION,
            description_exercise_id=desc_exercise.id,
        )
        db_session.add(exercise1)
        await db_session.flush()

        # Second row with the same source FK violates the unique index
        exercise2 = Exercise(
            source_type=ExerciseSourceType.DESCRIPTION,
            description_exercise_id=desc_exercise.id,
        )
        db_session.add(exercise2)

        with pytest.raises(IntegrityError):
            await db_session.flush()

        await db_session.rollback()


@pytest.mark.asyncio
class TestExerciseCascadeDelete:
    """Tests for cascade delete behavior on Exercise, ExerciseRecord, and ExerciseReview."""

    async def test_deleting_exercise_deletes_exercise_record(
        self, db_session: AsyncSession
    ) -> None:
        """Deleting an Exercise row cascades to its ExerciseRecord rows."""
        user = await UserFactory.create(session=db_session)
        record = await ExerciseRecordFactory.create(session=db_session, user_id=user.id)
        exercise_id = record.exercise_id
        record_id = record.id

        exercise = await db_session.get(Exercise, exercise_id)
        await db_session.delete(exercise)
        await db_session.flush()

        result = await db_session.execute(
            select(ExerciseRecord).where(ExerciseRecord.id == record_id)
        )
        assert result.scalar_one_or_none() is None

    async def test_deleting_exercise_deletes_exercise_review(
        self, db_session: AsyncSession
    ) -> None:
        """Deleting an Exercise row cascades to ExerciseReview rows via ExerciseRecord."""
        user = await UserFactory.create(session=db_session)
        review = await ExerciseReviewFactory.create(session=db_session, user_id=user.id)
        exercise_record_id = review.exercise_record_id
        review_id = review.id

        record = await db_session.get(ExerciseRecord, exercise_record_id)
        exercise = await db_session.get(Exercise, record.exercise_id)
        await db_session.delete(exercise)
        await db_session.flush()

        result = await db_session.execute(
            select(ExerciseReview).where(ExerciseReview.id == review_id)
        )
        assert result.scalar_one_or_none() is None

    async def test_deleting_user_deletes_exercise_record(self, db_session: AsyncSession) -> None:
        """Deleting a User row cascades to that user's ExerciseRecord rows."""
        user = await UserFactory.create(session=db_session)
        record = await ExerciseRecordFactory.create(session=db_session, user_id=user.id)
        record_id = record.id

        await db_session.delete(user)
        await db_session.flush()

        result = await db_session.execute(
            select(ExerciseRecord).where(ExerciseRecord.id == record_id)
        )
        assert result.scalar_one_or_none() is None

    async def test_deleting_user_deletes_exercise_review(self, db_session: AsyncSession) -> None:
        """Deleting a User row cascades to that user's ExerciseReview rows."""
        user = await UserFactory.create(session=db_session)
        review = await ExerciseReviewFactory.create(session=db_session, user_id=user.id)
        review_id = review.id

        await db_session.delete(user)
        await db_session.flush()

        result = await db_session.execute(
            select(ExerciseReview).where(ExerciseReview.id == review_id)
        )
        assert result.scalar_one_or_none() is None
