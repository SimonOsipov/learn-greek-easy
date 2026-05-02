"""Integration tests for Exercise, ExerciseRecord, and ExerciseReview repositories."""

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CardStatus,
    DialogExercise,
    ExerciseModality,
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
    SituationDescriptionFactory,
    SituationFactory,
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


async def _make_exercise_for_situation(db_session, situation):
    """Create SituationDescription → DescriptionExercise → Exercise chain for a given situation."""
    desc = await SituationDescriptionFactory.create(session=db_session, situation_id=situation.id)
    de = await DescriptionExerciseFactory.create(session=db_session, description_id=desc.id)
    exercise = await ExerciseFactory.create(session=db_session, description_exercise_id=de.id)
    return exercise


@pytest.mark.asyncio
class TestExerciseQueueDraftFiltering:
    """Tests that get_new_exercises, get_due_exercises, and get_early_practice_exercises
    exclude exercises linked to draft situations."""

    async def test_get_new_exercises_excludes_draft_situations(
        self, db_session: AsyncSession
    ) -> None:
        user = await UserFactory.create(session=db_session)
        ready_situation = await SituationFactory.create(session=db_session, ready=True)
        draft_situation = await SituationFactory.create(session=db_session)

        ready_exercise = await _make_exercise_for_situation(db_session, ready_situation)
        await _make_exercise_for_situation(db_session, draft_situation)

        repo = ExerciseRecordRepository(db_session)
        exercises = await repo.get_new_exercises(user.id)

        returned_ids = {e.id for e in exercises}
        assert ready_exercise.id in returned_ids
        assert all(
            e.id == ready_exercise.id or e.source_type != ExerciseSourceType.DESCRIPTION
            for e in exercises
        )

    async def test_get_new_exercises_groups_by_situation(self, db_session: AsyncSession) -> None:
        user = await UserFactory.create(session=db_session)
        sit_a = await SituationFactory.create(session=db_session, ready=True)
        sit_b = await SituationFactory.create(session=db_session, ready=True)

        desc_a = await SituationDescriptionFactory.create(session=db_session, situation_id=sit_a.id)
        desc_b = await SituationDescriptionFactory.create(session=db_session, situation_id=sit_b.id)

        de_a1 = await DescriptionExerciseFactory.create(
            session=db_session, description_id=desc_a.id, modality=ExerciseModality.LISTENING
        )
        de_a2 = await DescriptionExerciseFactory.create(
            session=db_session, description_id=desc_a.id, modality=ExerciseModality.READING
        )
        de_b1 = await DescriptionExerciseFactory.create(
            session=db_session, description_id=desc_b.id, modality=ExerciseModality.LISTENING
        )
        de_b2 = await DescriptionExerciseFactory.create(
            session=db_session, description_id=desc_b.id, modality=ExerciseModality.READING
        )

        ex_a1 = await ExerciseFactory.create(session=db_session, description_exercise_id=de_a1.id)
        ex_a2 = await ExerciseFactory.create(session=db_session, description_exercise_id=de_a2.id)
        ex_b1 = await ExerciseFactory.create(session=db_session, description_exercise_id=de_b1.id)
        ex_b2 = await ExerciseFactory.create(session=db_session, description_exercise_id=de_b2.id)

        repo = ExerciseRecordRepository(db_session)
        exercises = await repo.get_new_exercises(user.id, limit=10)

        returned_ids = [e.id for e in exercises]
        assert {ex_a1.id, ex_a2.id, ex_b1.id, ex_b2.id}.issubset(set(returned_ids))

        # Verify contiguous grouping: all exercises of sit_a appear before or after all of sit_b
        sit_a_positions = [i for i, e in enumerate(exercises) if e.id in {ex_a1.id, ex_a2.id}]
        sit_b_positions = [i for i, e in enumerate(exercises) if e.id in {ex_b1.id, ex_b2.id}]
        assert max(sit_a_positions) < min(sit_b_positions) or max(sit_b_positions) < min(
            sit_a_positions
        )

    async def test_get_due_exercises_excludes_draft_situations(
        self, db_session: AsyncSession
    ) -> None:
        user = await UserFactory.create(session=db_session)
        ready_situation = await SituationFactory.create(session=db_session, ready=True)
        draft_situation = await SituationFactory.create(session=db_session)

        ready_exercise = await _make_exercise_for_situation(db_session, ready_situation)
        draft_exercise = await _make_exercise_for_situation(db_session, draft_situation)

        # Create records in LEARNING state (due today)
        ready_record = await ExerciseRecordFactory.create(
            session=db_session,
            user_id=user.id,
            exercise_id=ready_exercise.id,
            status=CardStatus.LEARNING,
            next_review_date=date.today(),
        )
        await ExerciseRecordFactory.create(
            session=db_session,
            user_id=user.id,
            exercise_id=draft_exercise.id,
            status=CardStatus.LEARNING,
            next_review_date=date.today(),
        )

        repo = ExerciseRecordRepository(db_session)
        records = await repo.get_due_exercises(user.id)

        returned_exercise_ids = {r.exercise_id for r in records}
        assert ready_record.exercise_id in returned_exercise_ids
        assert draft_exercise.id not in returned_exercise_ids

    async def test_get_early_practice_exercises_excludes_draft_situations(
        self, db_session: AsyncSession
    ) -> None:
        user = await UserFactory.create(session=db_session)
        ready_situation = await SituationFactory.create(session=db_session, ready=True)
        draft_situation = await SituationFactory.create(session=db_session)

        ready_exercise = await _make_exercise_for_situation(db_session, ready_situation)
        draft_exercise = await _make_exercise_for_situation(db_session, draft_situation)

        future_date = date.today() + timedelta(days=3)

        ready_record = await ExerciseRecordFactory.create(
            session=db_session,
            user_id=user.id,
            exercise_id=ready_exercise.id,
            status=CardStatus.LEARNING,
            next_review_date=future_date,
        )
        await ExerciseRecordFactory.create(
            session=db_session,
            user_id=user.id,
            exercise_id=draft_exercise.id,
            status=CardStatus.LEARNING,
            next_review_date=future_date,
        )

        repo = ExerciseRecordRepository(db_session)
        records = await repo.get_early_practice_exercises(user.id)

        returned_exercise_ids = {r.exercise_id for r in records}
        assert ready_record.exercise_id in returned_exercise_ids
        assert draft_exercise.id not in returned_exercise_ids
