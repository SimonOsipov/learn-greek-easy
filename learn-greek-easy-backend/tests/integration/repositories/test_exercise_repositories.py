"""Integration tests for Exercise, ExerciseRecord, and ExerciseReview repositories."""

import uuid
from datetime import date

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CardStatus,
    DialogExercise,
    ExerciseSourceType,
    ExerciseStatus,
    ExerciseType,
)
from src.repositories.exercise import ExerciseRepository
from src.repositories.exercise_record import ExerciseRecordRepository
from src.repositories.exercise_review import ExerciseReviewRepository
from tests.factories import (
    DescriptionExerciseFactory,
    ExerciseFactory,
    ExerciseRecordFactory,
    ListeningDialogFactory,
    UserFactory,
)


@pytest.mark.asyncio
class TestExerciseRepository:
    """Tests for ExerciseRepository."""

    async def test_create_for_dialog_creates_exercise_with_dialog_source_type(
        self, db_session: AsyncSession
    ) -> None:
        """create_for_dialog() creates an Exercise row with source_type == DIALOG."""
        dialog = await ListeningDialogFactory.create(session=db_session)
        dialog_exercise = DialogExercise(
            dialog_id=dialog.id,
            exercise_type=ExerciseType.FILL_GAPS,
            status=ExerciseStatus.DRAFT,
        )
        db_session.add(dialog_exercise)
        await db_session.flush()

        repo = ExerciseRepository(db_session)
        exercise = await repo.create_for_dialog(dialog_exercise.id)

        assert exercise.id is not None
        assert exercise.source_type == ExerciseSourceType.DIALOG
        assert exercise.dialog_exercise_id == dialog_exercise.id
        assert exercise.description_exercise_id is None
        assert exercise.picture_exercise_id is None

    async def test_get_by_source_returns_exercise(self, db_session: AsyncSession) -> None:
        """get_by_source() returns the Exercise for the given source type and ID."""
        desc_exercise = await DescriptionExerciseFactory.create(session=db_session)
        exercise = await ExerciseFactory.create(
            session=db_session, description_exercise_id=desc_exercise.id
        )

        repo = ExerciseRepository(db_session)
        found = await repo.get_by_source(ExerciseSourceType.DESCRIPTION, desc_exercise.id)

        assert found is not None
        assert found.id == exercise.id

    async def test_get_by_source_returns_none_for_unknown(self, db_session: AsyncSession) -> None:
        """get_by_source() returns None when no Exercise exists for the given source ID."""
        repo = ExerciseRepository(db_session)
        result = await repo.get_by_source(ExerciseSourceType.DESCRIPTION, uuid.uuid4())

        assert result is None


@pytest.mark.asyncio
class TestExerciseRecordRepository:
    """Tests for ExerciseRecordRepository."""

    async def test_get_or_create_creates_on_first_call(self, db_session: AsyncSession) -> None:
        """get_or_create() inserts a new ExerciseRecord with SM-2 defaults on first call."""
        user = await UserFactory.create(session=db_session)
        exercise = await ExerciseFactory.create(session=db_session)

        repo = ExerciseRecordRepository(db_session)
        record, created = await repo.get_or_create(user.id, exercise.id)

        assert created is True
        assert record.id is not None
        assert record.user_id == user.id
        assert record.exercise_id == exercise.id
        assert record.status == CardStatus.NEW
        assert record.easiness_factor == 2.5
        assert record.interval == 0
        assert record.repetitions == 0

    async def test_get_or_create_first_call_returns_true_flag(
        self, db_session: AsyncSession
    ) -> None:
        """get_or_create() returns (record, True) on the first call for a new pair."""
        user = await UserFactory.create(session=db_session)
        exercise = await ExerciseFactory.create(session=db_session)

        repo = ExerciseRecordRepository(db_session)
        _, created = await repo.get_or_create(user.id, exercise.id)

        assert created is True

    async def test_get_or_create_returns_false_on_second_call(
        self, db_session: AsyncSession
    ) -> None:
        """get_or_create() returns (existing_record, False) on the second call for the same pair."""
        user = await UserFactory.create(session=db_session)
        exercise = await ExerciseFactory.create(session=db_session)

        repo = ExerciseRecordRepository(db_session)
        record_first, _ = await repo.get_or_create(user.id, exercise.id)
        record_second, created = await repo.get_or_create(user.id, exercise.id)

        assert created is False
        assert record_second.id == record_first.id

    async def test_update_sm2_data_persists_all_fields(self, db_session: AsyncSession) -> None:
        """update_sm2_data() persists all SM-2 fields on the record."""
        user = await UserFactory.create(session=db_session)
        record = await ExerciseRecordFactory.create(session=db_session, user_id=user.id)

        new_ef = 2.8
        new_interval = 15
        new_repetitions = 3
        new_next_review = date(2026, 6, 1)
        new_status = CardStatus.REVIEW

        repo = ExerciseRecordRepository(db_session)
        updated = await repo.update_sm2_data(
            record_id=record.id,
            easiness_factor=new_ef,
            interval=new_interval,
            repetitions=new_repetitions,
            next_review_date=new_next_review,
            status=new_status,
        )

        assert updated.easiness_factor == new_ef
        assert updated.interval == new_interval
        assert updated.repetitions == new_repetitions
        assert updated.next_review_date == new_next_review
        assert updated.status == new_status


@pytest.mark.asyncio
class TestExerciseReviewRepository:
    """Tests for ExerciseReviewRepository."""

    async def test_create_review_persists_all_fields(self, db_session: AsyncSession) -> None:
        """create_review() persists all fields including before/after SM-2 state."""
        user = await UserFactory.create(session=db_session)
        record = await ExerciseRecordFactory.create(session=db_session, user_id=user.id)

        repo = ExerciseReviewRepository(db_session)
        review = await repo.create_review(
            exercise_record_id=record.id,
            user_id=user.id,
            quality=4,
            score=8,
            max_score=10,
            easiness_factor_before=2.5,
            easiness_factor_after=2.5,
            interval_before=0,
            interval_after=1,
            repetitions_before=0,
            repetitions_after=1,
        )

        assert review.id is not None
        assert review.exercise_record_id == record.id
        assert review.user_id == user.id
        assert review.quality == 4
        assert review.score == 8
        assert review.max_score == 10
        assert review.easiness_factor_before == 2.5
        assert review.easiness_factor_after == 2.5
        assert review.interval_before == 0
        assert review.interval_after == 1
        assert review.repetitions_before == 0
        assert review.repetitions_after == 1
        assert review.reviewed_at is not None
