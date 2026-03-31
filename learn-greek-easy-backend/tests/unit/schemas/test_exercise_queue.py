"""Unit tests for exercise queue schema validation."""

from uuid import uuid4

import pytest
from pydantic import ValidationError

from src.db.models import ExerciseModality
from src.schemas.exercise_queue import ExerciseQueue, ExerciseReviewRequest, ExerciseReviewResult


@pytest.mark.unit
class TestExerciseModality:
    """Test ExerciseModality enum values and membership."""

    def test_listening_value(self):
        assert ExerciseModality.LISTENING == "listening"

    def test_reading_value(self):
        assert ExerciseModality.READING == "reading"

    def test_exactly_two_members(self):
        assert len(ExerciseModality) == 2


@pytest.mark.unit
class TestExerciseReviewRequest:
    """Test ExerciseReviewRequest schema validation."""

    @pytest.mark.parametrize(
        "score,max_score",
        [
            (0, 1),
            (1, 1),
            (3, 5),
            (5, 5),
            (0, 10),
            (10, 10),
        ],
    )
    def test_valid_score_lte_max_score(self, score, max_score):
        req = ExerciseReviewRequest(
            exercise_id=uuid4(),
            score=score,
            max_score=max_score,
        )
        assert req.score == score
        assert req.max_score == max_score

    @pytest.mark.parametrize(
        "score,max_score",
        [
            (2, 1),
            (6, 5),
            (11, 10),
        ],
    )
    def test_score_greater_than_max_score_rejected(self, score, max_score):
        with pytest.raises(ValidationError, match="must be <= max_score"):
            ExerciseReviewRequest(
                exercise_id=uuid4(),
                score=score,
                max_score=max_score,
            )

    def test_max_score_zero_rejected(self):
        with pytest.raises(ValidationError):
            ExerciseReviewRequest(
                exercise_id=uuid4(),
                score=0,
                max_score=0,
            )

    def test_max_score_one_accepted(self):
        req = ExerciseReviewRequest(
            exercise_id=uuid4(),
            score=0,
            max_score=1,
        )
        assert req.max_score == 1

    def test_negative_score_rejected(self):
        with pytest.raises(ValidationError):
            ExerciseReviewRequest(
                exercise_id=uuid4(),
                score=-1,
                max_score=5,
            )


@pytest.mark.unit
class TestExerciseQueueSerialization:
    """Test ExerciseQueue serialization edge cases."""

    def test_empty_exercises_list(self):
        queue = ExerciseQueue(
            total_due=0,
            total_new=0,
            total_in_queue=0,
            exercises=[],
        )
        assert queue.exercises == []

    def test_empty_exercises_round_trip(self):
        queue = ExerciseQueue(
            total_due=0,
            total_new=0,
            total_in_queue=0,
            exercises=[],
        )
        data = queue.model_dump()
        restored = ExerciseQueue.model_validate(data)
        assert restored.exercises == []
        assert restored.total_due == 0
        assert restored.total_new == 0
        assert restored.total_in_queue == 0


@pytest.mark.unit
class TestExerciseReviewResult:
    """Test ExerciseReviewResult field constraints."""

    def _valid_kwargs(self, **overrides):
        from datetime import date

        from src.db.models import CardStatus

        kwargs = dict(
            exercise_id=uuid4(),
            quality=3,
            score=3,
            max_score=5,
            previous_status=CardStatus.NEW,
            new_status=CardStatus.LEARNING,
            easiness_factor=2.5,
            interval=1,
            repetitions=1,
            next_review_date=date.today(),
        )
        kwargs.update(overrides)
        return kwargs

    def test_valid_result(self):
        result = ExerciseReviewResult(**self._valid_kwargs())
        assert result.easiness_factor == 2.5

    def test_easiness_factor_minimum_1_3_accepted(self):
        result = ExerciseReviewResult(**self._valid_kwargs(easiness_factor=1.3))
        assert result.easiness_factor == 1.3

    def test_easiness_factor_below_1_3_rejected(self):
        with pytest.raises(ValidationError):
            ExerciseReviewResult(**self._valid_kwargs(easiness_factor=1.2))

    def test_quality_maximum_5_accepted(self):
        result = ExerciseReviewResult(**self._valid_kwargs(quality=5))
        assert result.quality == 5

    def test_quality_above_5_rejected(self):
        with pytest.raises(ValidationError):
            ExerciseReviewResult(**self._valid_kwargs(quality=6))
