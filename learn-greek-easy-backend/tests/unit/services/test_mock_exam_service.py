"""Unit tests for MockExamService.

This module tests:
- create_mock_exam: Creates exam with 25 questions
- submit_answer: Processes answers with SM-2 and XP integration
- complete_exam: Completes exam with pass/fail determination
- get_statistics: Returns aggregated stats with recent exams
- get_active_exam: Returns active session info
- abandon_exam: Abandons session successfully

Tests use real database fixtures and mock S3Service where needed.
"""

from datetime import datetime, timedelta
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import MockExamNotFoundException, MockExamSessionExpiredException
from src.db.models import CultureDeck, CultureQuestion, MockExamSession, MockExamStatus, User
from src.services.mock_exam_service import MockExamService

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active culture deck for testing."""
    deck = CultureDeck(
        name="Greek History",
        description="Learn about Greek history",
        icon="book-open",
        color_accent="#4F46E5",
        category="history",
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def culture_questions(
    db_session: AsyncSession, culture_deck: CultureDeck
) -> list[CultureQuestion]:
    """Create 30 culture questions (more than needed for mock exam)."""
    questions = []
    for i in range(30):
        question = CultureQuestion(
            deck_id=culture_deck.id,
            question_text={
                "en": f"Question {i + 1}?",
                "el": f"Ερώτηση {i + 1};",
            },
            option_a={"en": "Option A", "el": "Επιλογή Α"},
            option_b={"en": "Option B", "el": "Επιλογή Β"},
            option_c={"en": "Option C", "el": "Επιλογή Γ"},
            option_d={"en": "Option D", "el": "Επιλογή Δ"},
            correct_option=(i % 4) + 1,
            order_index=i,
        )
        db_session.add(question)
        questions.append(question)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)
    return questions


@pytest.fixture
async def active_mock_exam(db_session: AsyncSession, test_user: User) -> MockExamSession:
    """Create an active mock exam session."""
    session = MockExamSession(
        user_id=test_user.id,
        total_questions=25,
        status=MockExamStatus.ACTIVE,
        score=0,
        passed=False,
        time_taken_seconds=0,
    )
    db_session.add(session)
    await db_session.flush()
    await db_session.refresh(session)
    return session


@pytest.fixture
async def completed_mock_exam(db_session: AsyncSession, test_user: User) -> MockExamSession:
    """Create a completed mock exam session."""
    session = MockExamSession(
        user_id=test_user.id,
        total_questions=25,
        status=MockExamStatus.COMPLETED,
        score=22,
        passed=True,
        time_taken_seconds=900,
        completed_at=datetime.utcnow(),
    )
    db_session.add(session)
    await db_session.flush()
    await db_session.refresh(session)
    return session


@pytest.fixture
async def multiple_completed_exams(
    db_session: AsyncSession, test_user: User
) -> list[MockExamSession]:
    """Create multiple completed exam sessions with varying scores."""
    sessions = []
    for i in range(5):
        score = 15 + i * 2  # 15, 17, 19, 21, 23
        passed = score >= 20  # 80% threshold
        session = MockExamSession(
            user_id=test_user.id,
            total_questions=25,
            status=MockExamStatus.COMPLETED,
            score=score,
            passed=passed,
            time_taken_seconds=600 + (i * 60),
            completed_at=datetime.utcnow() - timedelta(days=i),
        )
        db_session.add(session)
        sessions.append(session)

    await db_session.flush()
    for s in sessions:
        await db_session.refresh(s)
    return sessions


@pytest.fixture
def mock_s3_service():
    """Create a mock S3 service."""
    mock = MagicMock()
    mock.generate_presigned_url.return_value = "https://s3.example.com/presigned-url"
    return mock


# =============================================================================
# Test create_mock_exam
# =============================================================================


class TestCreateMockExam:
    """Tests for create_mock_exam method."""

    @pytest.mark.asyncio
    async def test_create_mock_exam_success(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should create exam with 25 questions."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        result = await service.create_mock_exam(test_user.id)

        assert result["session"] is not None
        assert result["session"].user_id == test_user.id
        assert result["session"].status == MockExamStatus.ACTIVE
        assert result["session"].total_questions == 25
        assert result["is_resumed"] is False
        assert len(result["questions"]) == 25

    @pytest.mark.asyncio
    async def test_create_mock_exam_prevents_duplicate_active(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should return existing session if user has an active exam."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        result = await service.create_mock_exam(test_user.id)

        assert result["session"].id == active_mock_exam.id
        assert result["is_resumed"] is True

    @pytest.mark.asyncio
    async def test_create_mock_exam_no_questions(
        self,
        db_session: AsyncSession,
        test_user: User,
        mock_s3_service,
    ):
        """Should raise ValueError when no questions available."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        with pytest.raises(ValueError, match="No questions available"):
            await service.create_mock_exam(test_user.id)


# =============================================================================
# Test submit_answer
# =============================================================================


class TestSubmitAnswer:
    """Tests for submit_answer method."""

    @pytest.mark.asyncio
    async def test_submit_answer_correct(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Correct answer should award XP and update SM-2."""
        service = MockExamService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]  # correct_option is 1

        result = await service.submit_answer(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
            question_id=question.id,
            selected_option=1,  # Correct
            time_taken_seconds=10,
        )

        assert result["is_correct"] is True
        assert result["correct_option"] == 1
        assert result["xp_earned"] > 0
        assert result["current_score"] == 1
        assert result["duplicate"] is False

    @pytest.mark.asyncio
    async def test_submit_answer_wrong(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Wrong answer should award encouragement XP (2 XP)."""
        service = MockExamService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]  # correct_option is 1

        result = await service.submit_answer(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
            question_id=question.id,
            selected_option=2,  # Wrong
            time_taken_seconds=10,
        )

        assert result["is_correct"] is False
        assert result["correct_option"] == 1
        assert result["xp_earned"] == 2  # Encouragement XP
        assert result["current_score"] == 0
        assert result["duplicate"] is False

    @pytest.mark.asyncio
    async def test_submit_answer_invalid_session(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should raise MockExamNotFoundException for invalid session."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        with pytest.raises(MockExamNotFoundException):
            await service.submit_answer(
                user_id=test_user.id,
                session_id=uuid4(),
                question_id=culture_questions[0].id,
                selected_option=1,
                time_taken_seconds=10,
            )

    @pytest.mark.asyncio
    async def test_submit_answer_expired_session(
        self,
        db_session: AsyncSession,
        test_user: User,
        completed_mock_exam: MockExamSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should raise MockExamSessionExpiredException for completed session."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        with pytest.raises(MockExamSessionExpiredException):
            await service.submit_answer(
                user_id=test_user.id,
                session_id=completed_mock_exam.id,
                question_id=culture_questions[0].id,
                selected_option=1,
                time_taken_seconds=10,
            )

    @pytest.mark.asyncio
    async def test_submit_answer_duplicate(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Duplicate answer should return existing state without re-processing."""
        service = MockExamService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        # First answer
        await service.submit_answer(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
            question_id=question.id,
            selected_option=1,
            time_taken_seconds=10,
        )

        # Duplicate answer
        result = await service.submit_answer(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
            question_id=question.id,
            selected_option=2,  # Different option
            time_taken_seconds=5,
        )

        assert result["duplicate"] is True
        assert result["xp_earned"] == 0


# =============================================================================
# Test complete_exam
# =============================================================================


class TestCompleteExam:
    """Tests for complete_exam method."""

    @pytest.mark.asyncio
    async def test_complete_exam_pass(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """80%+ should result in passed=True."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        # Submit 20 correct answers (80%)
        for i in range(20):
            question = culture_questions[i]
            await service.submit_answer(
                user_id=test_user.id,
                session_id=active_mock_exam.id,
                question_id=question.id,
                selected_option=question.correct_option,
                time_taken_seconds=10,
            )

        # Submit 5 wrong answers
        for i in range(20, 25):
            question = culture_questions[i]
            wrong_option = (question.correct_option % 4) + 1
            await service.submit_answer(
                user_id=test_user.id,
                session_id=active_mock_exam.id,
                question_id=question.id,
                selected_option=wrong_option,
                time_taken_seconds=10,
            )

        result = await service.complete_exam(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
            total_time_seconds=900,
        )

        assert result["passed"] is True
        assert result["score"] == 20
        assert result["percentage"] == 80.0
        assert result["pass_threshold"] == 80

    @pytest.mark.asyncio
    async def test_complete_exam_fail(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """<80% should result in passed=False."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        # Submit 19 correct answers (76%)
        for i in range(19):
            question = culture_questions[i]
            await service.submit_answer(
                user_id=test_user.id,
                session_id=active_mock_exam.id,
                question_id=question.id,
                selected_option=question.correct_option,
                time_taken_seconds=10,
            )

        # Submit 6 wrong answers
        for i in range(19, 25):
            question = culture_questions[i]
            wrong_option = (question.correct_option % 4) + 1
            await service.submit_answer(
                user_id=test_user.id,
                session_id=active_mock_exam.id,
                question_id=question.id,
                selected_option=wrong_option,
                time_taken_seconds=10,
            )

        result = await service.complete_exam(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
            total_time_seconds=900,
        )

        assert result["passed"] is False
        assert result["score"] == 19
        assert result["percentage"] == 76.0

    @pytest.mark.asyncio
    async def test_complete_exam_invalid_session(
        self,
        db_session: AsyncSession,
        test_user: User,
        mock_s3_service,
    ):
        """Should raise MockExamNotFoundException for invalid session."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        with pytest.raises(MockExamNotFoundException):
            await service.complete_exam(
                user_id=test_user.id,
                session_id=uuid4(),
                total_time_seconds=900,
            )

    @pytest.mark.asyncio
    async def test_complete_exam_already_completed(
        self,
        db_session: AsyncSession,
        test_user: User,
        completed_mock_exam: MockExamSession,
        mock_s3_service,
    ):
        """Should raise MockExamSessionExpiredException for already completed session."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        with pytest.raises(MockExamSessionExpiredException):
            await service.complete_exam(
                user_id=test_user.id,
                session_id=completed_mock_exam.id,
                total_time_seconds=900,
            )


# =============================================================================
# Test get_statistics
# =============================================================================


class TestGetStatistics:
    """Tests for get_statistics method."""

    @pytest.mark.asyncio
    async def test_get_statistics(
        self,
        db_session: AsyncSession,
        test_user: User,
        multiple_completed_exams: list[MockExamSession],
        mock_s3_service,
    ):
        """Should return aggregated stats with recent exams."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        result = await service.get_statistics(test_user.id)

        assert "stats" in result
        assert "recent_exams" in result

        stats = result["stats"]
        assert stats["total_exams"] == 5
        # Scores: 15, 17, 19, 21, 23 - only 21 and 23 pass (80%)
        assert stats["passed_exams"] == 2
        assert stats["pass_rate"] == 40.0

        # Recent exams should be ordered by completion date
        recent = result["recent_exams"]
        assert len(recent) == 5

    @pytest.mark.asyncio
    async def test_get_statistics_empty(
        self,
        db_session: AsyncSession,
        test_user: User,
        mock_s3_service,
    ):
        """Should return zeros for new user."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        result = await service.get_statistics(test_user.id)

        assert result["stats"]["total_exams"] == 0
        assert result["stats"]["passed_exams"] == 0
        assert result["recent_exams"] == []


# =============================================================================
# Test get_active_exam
# =============================================================================


class TestGetActiveExam:
    """Tests for get_active_exam method."""

    @pytest.mark.asyncio
    async def test_get_active_exam(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should return active session info."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        result = await service.get_active_exam(test_user.id)

        assert result is not None
        assert result["session"].id == active_mock_exam.id
        assert "questions" in result
        assert "answers_count" in result

    @pytest.mark.asyncio
    async def test_get_active_exam_none(
        self,
        db_session: AsyncSession,
        test_user: User,
        mock_s3_service,
    ):
        """Should return None when no active exam."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        result = await service.get_active_exam(test_user.id)

        assert result is None


# =============================================================================
# Test abandon_exam
# =============================================================================


class TestAbandonExam:
    """Tests for abandon_exam method."""

    @pytest.mark.asyncio
    async def test_abandon_exam(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        mock_s3_service,
    ):
        """Should abandon session successfully."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        result = await service.abandon_exam(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
        )

        assert result is not None
        assert result.status == MockExamStatus.ABANDONED
        assert result.completed_at is not None

    @pytest.mark.asyncio
    async def test_abandon_exam_invalid_session(
        self,
        db_session: AsyncSession,
        test_user: User,
        mock_s3_service,
    ):
        """Should raise MockExamNotFoundException for invalid session."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        with pytest.raises(MockExamNotFoundException):
            await service.abandon_exam(
                user_id=test_user.id,
                session_id=uuid4(),
            )

    @pytest.mark.asyncio
    async def test_abandon_exam_already_completed(
        self,
        db_session: AsyncSession,
        test_user: User,
        completed_mock_exam: MockExamSession,
        mock_s3_service,
    ):
        """Should raise MockExamSessionExpiredException for completed session."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        with pytest.raises(MockExamSessionExpiredException):
            await service.abandon_exam(
                user_id=test_user.id,
                session_id=completed_mock_exam.id,
            )
