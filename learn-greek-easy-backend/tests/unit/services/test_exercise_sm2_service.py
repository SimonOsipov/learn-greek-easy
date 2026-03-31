"""Unit tests for ExerciseSM2Service PostHog event firing."""

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.db.models import CardStatus, ExerciseSourceType
from src.services.exercise_sm2_service import ExerciseSM2Service


def _make_mock_exercise(
    source_type: ExerciseSourceType = ExerciseSourceType.DESCRIPTION,
) -> MagicMock:
    exercise = MagicMock()
    exercise.id = uuid4()
    exercise.source_type = source_type
    return exercise


def _make_mock_record(status: CardStatus = CardStatus.NEW) -> MagicMock:
    record = MagicMock()
    record.id = uuid4()
    record.status = status
    record.easiness_factor = 2.5
    record.interval = 0
    record.repetitions = 0
    record.created_at = None
    return record


def _make_mock_record_updated(
    status: CardStatus = CardStatus.LEARNING,
    easiness_factor: float = 2.5,
    interval: int = 1,
    repetitions: int = 1,
) -> MagicMock:
    record = MagicMock()
    record.id = uuid4()
    record.status = status
    record.easiness_factor = easiness_factor
    record.interval = interval
    record.repetitions = repetitions
    return record


def _make_sm2_result(new_status: CardStatus = CardStatus.LEARNING) -> MagicMock:
    result = MagicMock()
    result.new_easiness_factor = 2.5
    result.new_interval = 1
    result.new_repetitions = 1
    result.new_status = new_status
    return result


@pytest.mark.unit
class TestExerciseSM2ServicePostHogEvents:
    """Tests that verify PostHog capture_event is fired (or not) based on mastery transitions."""

    @pytest.mark.asyncio
    async def test_mastery_transition_fires_exercise_mastered_event(self, mock_db_session):
        """REVIEW → MASTERED transition should fire exercise_mastered event."""
        mock_exercise = _make_mock_exercise()
        mock_record = _make_mock_record(status=CardStatus.REVIEW)
        mock_record_updated = _make_mock_record_updated(status=CardStatus.MASTERED)
        sm2_result = _make_sm2_result(new_status=CardStatus.MASTERED)
        user_id = uuid4()
        exercise_id = mock_exercise.id

        service = ExerciseSM2Service(mock_db_session)
        service.record_repo.get_or_create = AsyncMock(return_value=(mock_record, False))
        service.record_repo.update_sm2_data = AsyncMock(return_value=mock_record_updated)
        service.review_repo.create_review = AsyncMock(return_value=MagicMock())

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_exercise
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        with (
            patch("src.services.exercise_sm2_service.calculate_sm2", return_value=sm2_result),
            patch(
                "src.services.exercise_sm2_service.calculate_next_review_date",
                return_value=date.today(),
            ),
            patch("src.services.exercise_sm2_service.capture_event") as mock_capture,
        ):
            await service.process_review(
                user_id=user_id,
                exercise_id=exercise_id,
                score=5,
                max_score=5,
            )

        mock_capture.assert_called_once()
        call_kwargs = mock_capture.call_args.kwargs
        assert call_kwargs["event"] == "exercise_mastered"
        assert call_kwargs["distinct_id"] == str(user_id)
        assert call_kwargs["properties"]["exercise_id"] == str(exercise_id)
        assert call_kwargs["properties"]["source_type"] == mock_exercise.source_type.value

    @pytest.mark.asyncio
    async def test_already_mastered_does_not_fire_event(self, mock_db_session):
        """MASTERED → MASTERED (re-review) should NOT fire event."""
        mock_exercise = _make_mock_exercise()
        mock_record = _make_mock_record(status=CardStatus.MASTERED)
        mock_record_updated = _make_mock_record_updated(status=CardStatus.MASTERED)
        sm2_result = _make_sm2_result(new_status=CardStatus.MASTERED)
        user_id = uuid4()
        exercise_id = mock_exercise.id

        service = ExerciseSM2Service(mock_db_session)
        service.record_repo.get_or_create = AsyncMock(return_value=(mock_record, False))
        service.record_repo.update_sm2_data = AsyncMock(return_value=mock_record_updated)
        service.review_repo.create_review = AsyncMock(return_value=MagicMock())

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_exercise
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        with (
            patch("src.services.exercise_sm2_service.calculate_sm2", return_value=sm2_result),
            patch(
                "src.services.exercise_sm2_service.calculate_next_review_date",
                return_value=date.today(),
            ),
            patch("src.services.exercise_sm2_service.capture_event") as mock_capture,
        ):
            await service.process_review(
                user_id=user_id,
                exercise_id=exercise_id,
                score=5,
                max_score=5,
            )

        mock_capture.assert_not_called()

    @pytest.mark.asyncio
    async def test_non_mastery_transition_does_not_fire_event(self, mock_db_session):
        """NEW → LEARNING transition should NOT fire event."""
        mock_exercise = _make_mock_exercise()
        mock_record = _make_mock_record(status=CardStatus.NEW)
        mock_record_updated = _make_mock_record_updated(status=CardStatus.LEARNING)
        sm2_result = _make_sm2_result(new_status=CardStatus.LEARNING)
        user_id = uuid4()
        exercise_id = mock_exercise.id

        service = ExerciseSM2Service(mock_db_session)
        service.record_repo.get_or_create = AsyncMock(return_value=(mock_record, False))
        service.record_repo.update_sm2_data = AsyncMock(return_value=mock_record_updated)
        service.review_repo.create_review = AsyncMock(return_value=MagicMock())

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_exercise
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        with (
            patch("src.services.exercise_sm2_service.calculate_sm2", return_value=sm2_result),
            patch(
                "src.services.exercise_sm2_service.calculate_next_review_date",
                return_value=date.today(),
            ),
            patch("src.services.exercise_sm2_service.capture_event") as mock_capture,
        ):
            await service.process_review(
                user_id=user_id,
                exercise_id=exercise_id,
                score=3,
                max_score=5,
            )

        mock_capture.assert_not_called()
