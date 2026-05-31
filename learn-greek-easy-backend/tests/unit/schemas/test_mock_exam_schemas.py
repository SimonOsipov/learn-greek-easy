"""Unit tests for mock exam schemas validation.

Covers:
- MockExamAnswerItem.selected_option bounds (0/5 reject, 1/4 pass)
- MockExamSubmitAllRequest.answers list bounds (empty and 26 reject, 1 and 25 pass)
- MockExamQueueResponse.can_start_exam: documents the gap that there is no
  cross-field validator tying can_start_exam to available_questions >= 25
- MockExamSubmitAllResponse.percentage and pass_threshold <= 100 bounds
- Supporting schemas: MockExamSessionResponse, MockExamAnswerResult,
  MockExamHistoryItem, MockExamStatisticsResponse
"""

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from src.schemas.mock_exam import (
    MockExamAnswerItem,
    MockExamAnswerResult,
    MockExamCreateResponse,
    MockExamHistoryItem,
    MockExamQuestionResponse,
    MockExamQueueResponse,
    MockExamSessionResponse,
    MockExamStatisticsResponse,
    MockExamSubmitAllRequest,
    MockExamSubmitAllResponse,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_session(**overrides) -> dict:
    """Return a valid MockExamSessionResponse payload."""
    base = dict(
        id=uuid4(),
        user_id=uuid4(),
        started_at=datetime.now(),
        completed_at=None,
        score=0,
        total_questions=25,
        passed=False,
        time_taken_seconds=0,
        status="active",
    )
    base.update(overrides)
    return base


def _make_question(**overrides) -> dict:
    """Return a valid MockExamQuestionResponse payload."""
    base = dict(
        id=uuid4(),
        question_text={"el": "Ερώτηση", "en": "Question", "ru": "Вопрос"},
        options=[
            {"el": "A", "en": "A", "ru": "A"},
            {"el": "B", "en": "B", "ru": "B"},
            {"el": "C", "en": "C", "ru": "C"},
            {"el": "D", "en": "D", "ru": "D"},
        ],
        option_count=4,
        image_url=None,
        order_index=0,
    )
    base.update(overrides)
    return base


def _make_answer_item(selected_option: int = 1, question_id=None) -> dict:
    return dict(
        question_id=question_id or uuid4(),
        selected_option=selected_option,
        time_taken_seconds=10,
    )


def _make_answer_result(**overrides) -> dict:
    base = dict(
        question_id=uuid4(),
        is_correct=True,
        correct_option=1,
        selected_option=1,
        xp_earned=10,
        was_duplicate=False,
    )
    base.update(overrides)
    return base


def _make_submit_all_response(**overrides) -> dict:
    session = MockExamSessionResponse(**_make_session(status="completed", passed=True, score=20))
    answer_results = [MockExamAnswerResult(**_make_answer_result())]
    base = dict(
        session=session,
        passed=True,
        score=20,
        total_questions=25,
        percentage=80.0,
        pass_threshold=60,
        answer_results=answer_results,
        total_xp_earned=100,
        new_answers_count=1,
        duplicate_answers_count=0,
    )
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# MockExamAnswerItem — selected_option bounds
# ---------------------------------------------------------------------------


class TestMockExamAnswerItemSelectedOption:
    """Tests for MockExamAnswerItem.selected_option field validation."""

    def test_selected_option_1_passes(self):
        """Lower boundary 1 is accepted."""
        item = MockExamAnswerItem(**_make_answer_item(selected_option=1))
        assert item.selected_option == 1

    def test_selected_option_4_passes(self):
        """Upper boundary 4 is accepted."""
        item = MockExamAnswerItem(**_make_answer_item(selected_option=4))
        assert item.selected_option == 4

    def test_selected_option_2_passes(self):
        """Interior value 2 is accepted."""
        item = MockExamAnswerItem(**_make_answer_item(selected_option=2))
        assert item.selected_option == 2

    def test_selected_option_3_passes(self):
        """Interior value 3 is accepted."""
        item = MockExamAnswerItem(**_make_answer_item(selected_option=3))
        assert item.selected_option == 3

    def test_selected_option_0_rejected(self):
        """0 is below the minimum of 1 and must be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamAnswerItem(**_make_answer_item(selected_option=0))
        assert "greater than or equal to 1" in str(exc_info.value)

    def test_selected_option_5_rejected(self):
        """5 is above the maximum of 4 and must be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamAnswerItem(**_make_answer_item(selected_option=5))
        assert "less than or equal to 4" in str(exc_info.value)

    def test_selected_option_negative_rejected(self):
        """Negative value is below the minimum and must be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamAnswerItem(**_make_answer_item(selected_option=-1))
        assert "greater than or equal to 1" in str(exc_info.value)

    def test_time_taken_seconds_negative_rejected(self):
        """Negative time_taken_seconds must be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamAnswerItem(
                question_id=uuid4(),
                selected_option=1,
                time_taken_seconds=-1,
            )
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_time_taken_seconds_zero_passes(self):
        """Zero time_taken_seconds is valid."""
        item = MockExamAnswerItem(
            question_id=uuid4(),
            selected_option=1,
            time_taken_seconds=0,
        )
        assert item.time_taken_seconds == 0


# ---------------------------------------------------------------------------
# MockExamSubmitAllRequest — answers list length bounds
# ---------------------------------------------------------------------------


class TestMockExamSubmitAllRequestAnswersBounds:
    """Tests for MockExamSubmitAllRequest.answers list length validation."""

    def test_answers_list_with_1_item_passes(self):
        """Minimum valid list length of 1 is accepted."""
        request = MockExamSubmitAllRequest(
            answers=[MockExamAnswerItem(**_make_answer_item())],
            total_time_seconds=30,
        )
        assert len(request.answers) == 1

    def test_answers_list_with_25_items_passes(self):
        """Maximum valid list length of 25 is accepted."""
        answers = [MockExamAnswerItem(**_make_answer_item()) for _ in range(25)]
        request = MockExamSubmitAllRequest(
            answers=answers,
            total_time_seconds=300,
        )
        assert len(request.answers) == 25

    def test_answers_list_empty_rejected(self):
        """Empty list (0 items) must be rejected (min_length=1)."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamSubmitAllRequest(
                answers=[],
                total_time_seconds=0,
            )
        error_text = str(exc_info.value)
        # Pydantic 2 reports list too short as "too_short"
        assert "too_short" in error_text.lower()

    def test_answers_list_with_26_items_rejected(self):
        """26 items exceed max_length=25 and must be rejected."""
        answers = [MockExamAnswerItem(**_make_answer_item()) for _ in range(26)]
        with pytest.raises(ValidationError) as exc_info:
            MockExamSubmitAllRequest(
                answers=answers,
                total_time_seconds=400,
            )
        error_text = str(exc_info.value)
        # Pydantic 2 reports list too long as "too_long"
        assert "too_long" in error_text.lower()

    def test_answers_list_with_13_items_passes(self):
        """Interior value of 13 items is accepted."""
        answers = [MockExamAnswerItem(**_make_answer_item()) for _ in range(13)]
        request = MockExamSubmitAllRequest(
            answers=answers,
            total_time_seconds=150,
        )
        assert len(request.answers) == 13

    def test_total_time_seconds_negative_rejected(self):
        """Negative total_time_seconds must be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamSubmitAllRequest(
                answers=[MockExamAnswerItem(**_make_answer_item())],
                total_time_seconds=-1,
            )
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_total_time_seconds_zero_passes(self):
        """Zero total_time_seconds is valid."""
        request = MockExamSubmitAllRequest(
            answers=[MockExamAnswerItem(**_make_answer_item())],
            total_time_seconds=0,
        )
        assert request.total_time_seconds == 0


# ---------------------------------------------------------------------------
# MockExamQueueResponse — can_start_exam gap documentation
# ---------------------------------------------------------------------------


class TestMockExamQueueResponseCanStartExamGap:
    """Document that can_start_exam has no cross-field validator.

    The field docstring says "True if at least 25 questions available" but
    Pydantic does not enforce that invariant. A caller can set
    available_questions < 25 while can_start_exam=True (or vice-versa) and
    the schema will accept it without error. This test pins that current
    behaviour to make the gap visible; if a @model_validator is added later,
    this test will fail and should be updated.
    """

    def _make_queue_response(self, **overrides) -> dict:
        base = dict(
            total_questions=50,
            available_questions=25,
            can_start_exam=True,
            sample_questions=[],
        )
        base.update(overrides)
        return base

    def test_valid_queue_response_25_available(self):
        """25 available questions with can_start_exam=True is valid."""
        response = MockExamQueueResponse(**self._make_queue_response())
        assert response.can_start_exam is True
        assert response.available_questions == 25

    def test_valid_queue_response_0_available_cannot_start(self):
        """0 available questions with can_start_exam=False is valid."""
        response = MockExamQueueResponse(
            **self._make_queue_response(available_questions=0, can_start_exam=False)
        )
        assert response.can_start_exam is False
        assert response.available_questions == 0

    def test_can_start_exam_gap_no_cross_field_validation(self):
        """Pydantic accepts available_questions=5 with can_start_exam=True (gap).

        There is no @model_validator enforcing the business rule that
        can_start_exam must be True iff available_questions >= 25.
        This test documents the gap — it asserts that this inconsistent state
        is currently accepted without error.
        """
        # This should raise if a cross-field validator existed; since it does
        # not, the construction succeeds — pinning current (gapped) behaviour.
        response = MockExamQueueResponse(
            **self._make_queue_response(available_questions=5, can_start_exam=True)
        )
        assert response.available_questions == 5
        assert response.can_start_exam is True  # logically wrong, but schema allows it

    def test_can_start_exam_gap_false_despite_sufficient_questions(self):
        """Schema also accepts available_questions=30 with can_start_exam=False (gap)."""
        response = MockExamQueueResponse(
            **self._make_queue_response(available_questions=30, can_start_exam=False)
        )
        assert response.available_questions == 30
        assert response.can_start_exam is False  # logically wrong, but schema allows it

    def test_negative_available_questions_rejected(self):
        """Negative available_questions is rejected (ge=0)."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamQueueResponse(**self._make_queue_response(available_questions=-1))
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_negative_total_questions_rejected(self):
        """Negative total_questions is rejected (ge=0)."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamQueueResponse(**self._make_queue_response(total_questions=-1))
        assert "greater than or equal to 0" in str(exc_info.value)


# ---------------------------------------------------------------------------
# MockExamSubmitAllResponse — percentage and pass_threshold bounds
# ---------------------------------------------------------------------------


class TestMockExamSubmitAllResponseBounds:
    """Tests for percentage and pass_threshold fields in MockExamSubmitAllResponse."""

    def test_percentage_0_passes(self):
        """0.0 percentage is valid (ge=0)."""
        response = MockExamSubmitAllResponse(**_make_submit_all_response(percentage=0.0))
        assert response.percentage == 0.0

    def test_percentage_100_passes(self):
        """100.0 percentage is valid (le=100)."""
        response = MockExamSubmitAllResponse(**_make_submit_all_response(percentage=100.0))
        assert response.percentage == 100.0

    def test_percentage_60_passes(self):
        """Typical pass-threshold percentage of 60.0 is valid."""
        response = MockExamSubmitAllResponse(**_make_submit_all_response(percentage=60.0))
        assert response.percentage == 60.0

    def test_percentage_above_100_rejected(self):
        """Percentage above 100 must be rejected (le=100)."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamSubmitAllResponse(**_make_submit_all_response(percentage=100.1))
        assert "less than or equal to 100" in str(exc_info.value)

    def test_percentage_negative_rejected(self):
        """Negative percentage must be rejected (ge=0)."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamSubmitAllResponse(**_make_submit_all_response(percentage=-0.1))
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_pass_threshold_0_passes(self):
        """0 pass_threshold is valid (ge=0)."""
        response = MockExamSubmitAllResponse(**_make_submit_all_response(pass_threshold=0))
        assert response.pass_threshold == 0

    def test_pass_threshold_100_passes(self):
        """100 pass_threshold is valid (le=100)."""
        response = MockExamSubmitAllResponse(**_make_submit_all_response(pass_threshold=100))
        assert response.pass_threshold == 100

    def test_pass_threshold_60_passes(self):
        """Typical pass_threshold of 60 is valid."""
        response = MockExamSubmitAllResponse(**_make_submit_all_response(pass_threshold=60))
        assert response.pass_threshold == 60

    def test_pass_threshold_above_100_rejected(self):
        """pass_threshold above 100 must be rejected (le=100)."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamSubmitAllResponse(**_make_submit_all_response(pass_threshold=101))
        assert "less than or equal to 100" in str(exc_info.value)

    def test_pass_threshold_negative_rejected(self):
        """Negative pass_threshold must be rejected (ge=0)."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamSubmitAllResponse(**_make_submit_all_response(pass_threshold=-1))
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_score_negative_rejected(self):
        """Negative score in submit-all response must be rejected (ge=0)."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamSubmitAllResponse(**_make_submit_all_response(score=-1))
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_total_xp_earned_negative_rejected(self):
        """Negative total_xp_earned must be rejected (ge=0)."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamSubmitAllResponse(**_make_submit_all_response(total_xp_earned=-1))
        assert "greater than or equal to 0" in str(exc_info.value)


# ---------------------------------------------------------------------------
# MockExamAnswerResult — selected_option / correct_option bounds
# ---------------------------------------------------------------------------


class TestMockExamAnswerResultBounds:
    """Tests for MockExamAnswerResult.selected_option and correct_option bounds."""

    def test_valid_answer_result(self):
        """Valid answer result is accepted."""
        result = MockExamAnswerResult(**_make_answer_result())
        assert result.is_correct is True
        assert result.xp_earned == 10

    def test_selected_option_0_rejected(self):
        """0 is below the minimum of 1 for selected_option."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamAnswerResult(**_make_answer_result(selected_option=0))
        assert "greater than or equal to 1" in str(exc_info.value)

    def test_selected_option_5_rejected(self):
        """5 is above the maximum of 4 for selected_option."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamAnswerResult(**_make_answer_result(selected_option=5))
        assert "less than or equal to 4" in str(exc_info.value)

    def test_correct_option_0_rejected(self):
        """0 is below the minimum of 1 for correct_option."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamAnswerResult(**_make_answer_result(correct_option=0))
        assert "greater than or equal to 1" in str(exc_info.value)

    def test_correct_option_5_rejected(self):
        """5 is above the maximum of 4 for correct_option."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamAnswerResult(**_make_answer_result(correct_option=5))
        assert "less than or equal to 4" in str(exc_info.value)

    def test_xp_earned_negative_rejected(self):
        """Negative xp_earned must be rejected (ge=0)."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamAnswerResult(**_make_answer_result(xp_earned=-1))
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_was_duplicate_default_false(self):
        """was_duplicate defaults to False."""
        result = MockExamAnswerResult(
            question_id=uuid4(),
            is_correct=True,
            correct_option=2,
            selected_option=2,
            xp_earned=10,
        )
        assert result.was_duplicate is False


# ---------------------------------------------------------------------------
# MockExamSessionResponse — basic validation
# ---------------------------------------------------------------------------


class TestMockExamSessionResponse:
    """Tests for MockExamSessionResponse schema."""

    def test_valid_active_session(self):
        """A valid active session is accepted."""
        session = MockExamSessionResponse(**_make_session())
        assert session.status == "active"
        assert session.score == 0
        assert session.passed is False

    def test_valid_completed_session(self):
        """A completed session with all fields is accepted."""
        now = datetime.now()
        session = MockExamSessionResponse(
            **_make_session(
                completed_at=now,
                score=20,
                passed=True,
                time_taken_seconds=900,
                status="completed",
            )
        )
        assert session.completed_at == now
        assert session.score == 20
        assert session.passed is True

    def test_score_negative_rejected(self):
        """Negative score must be rejected (ge=0)."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamSessionResponse(**_make_session(score=-1))
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_total_questions_negative_rejected(self):
        """Negative total_questions must be rejected (ge=0)."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamSessionResponse(**_make_session(total_questions=-1))
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_time_taken_seconds_negative_rejected(self):
        """Negative time_taken_seconds must be rejected (ge=0)."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamSessionResponse(**_make_session(time_taken_seconds=-1))
        assert "greater than or equal to 0" in str(exc_info.value)


# ---------------------------------------------------------------------------
# MockExamHistoryItem — basic validation
# ---------------------------------------------------------------------------


class TestMockExamHistoryItem:
    """Tests for MockExamHistoryItem schema."""

    def test_valid_history_item(self):
        """A valid history item is accepted."""
        item = MockExamHistoryItem(
            id=uuid4(),
            started_at=datetime.now(),
            completed_at=datetime.now(),
            score=15,
            total_questions=25,
            passed=False,
            time_taken_seconds=600,
        )
        assert item.score == 15
        assert item.passed is False

    def test_score_negative_rejected(self):
        """Negative score must be rejected (ge=0)."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamHistoryItem(
                id=uuid4(),
                started_at=datetime.now(),
                completed_at=None,
                score=-1,
                total_questions=25,
                passed=False,
                time_taken_seconds=0,
            )
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_time_taken_seconds_negative_rejected(self):
        """Negative time_taken_seconds must be rejected (ge=0)."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamHistoryItem(
                id=uuid4(),
                started_at=datetime.now(),
                completed_at=None,
                score=0,
                total_questions=25,
                passed=False,
                time_taken_seconds=-1,
            )
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_completed_at_optional(self):
        """completed_at is optional and can be None."""
        item = MockExamHistoryItem(
            id=uuid4(),
            started_at=datetime.now(),
            completed_at=None,
            score=0,
            total_questions=25,
            passed=False,
            time_taken_seconds=0,
        )
        assert item.completed_at is None


# ---------------------------------------------------------------------------
# MockExamCreateResponse — composition
# ---------------------------------------------------------------------------


class TestMockExamCreateResponse:
    """Tests for MockExamCreateResponse schema composition."""

    def test_valid_create_response_new_session(self):
        """A new session response is accepted."""
        session = MockExamSessionResponse(**_make_session())
        questions = [MockExamQuestionResponse(**_make_question())]
        response = MockExamCreateResponse(
            session=session,
            questions=questions,
            is_resumed=False,
        )
        assert response.is_resumed is False
        assert len(response.questions) == 1

    def test_valid_create_response_resumed_session(self):
        """A resumed session response is accepted."""
        session = MockExamSessionResponse(**_make_session())
        response = MockExamCreateResponse(
            session=session,
            questions=[MockExamQuestionResponse(**_make_question())],
            is_resumed=True,
        )
        assert response.is_resumed is True


# ---------------------------------------------------------------------------
# MockExamStatisticsResponse
# ---------------------------------------------------------------------------


class TestMockExamStatisticsResponse:
    """Tests for MockExamStatisticsResponse schema."""

    def test_valid_statistics_response(self):
        """A valid statistics response is accepted."""
        stats_dict = {
            "total_exams": 10,
            "passed_exams": 7,
            "pass_rate": 70.0,
            "average_score": 18.5,
            "best_score": 25,
            "total_questions_answered": 250,
            "average_time_seconds": 900,
        }
        response = MockExamStatisticsResponse(
            stats=stats_dict,
            recent_exams=[],
        )
        assert response.stats["total_exams"] == 10
        assert response.stats["pass_rate"] == 70.0

    def test_empty_recent_exams_accepted(self):
        """An empty recent_exams list is accepted."""
        response = MockExamStatisticsResponse(
            stats={},
            recent_exams=[],
        )
        assert response.recent_exams == []

    def test_recent_exams_with_items(self):
        """recent_exams list with history items is accepted."""
        item = MockExamHistoryItem(
            id=uuid4(),
            started_at=datetime.now(),
            completed_at=datetime.now(),
            score=20,
            total_questions=25,
            passed=True,
            time_taken_seconds=750,
        )
        response = MockExamStatisticsResponse(
            stats={"pass_rate": 80.0},
            recent_exams=[item],
        )
        assert len(response.recent_exams) == 1
        assert response.recent_exams[0].score == 20
