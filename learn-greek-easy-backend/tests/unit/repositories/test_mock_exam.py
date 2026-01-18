"""Unit tests for MockExamRepository.

This module tests:
- create_session: Creates session with ACTIVE status, score=0, passed=False
- get_session: Retrieves session with answers loaded
- get_active_session: Gets user's active session
- save_answer: Creates answer record with all fields
- answer_exists: Checks for duplicate answers
- complete_session: Updates status to COMPLETED with score, passed, time
- abandon_session: Updates status to ABANDONED
- get_user_statistics: Calculates aggregated statistics
- get_recent_exams: Returns ordered list of completed exams
- get_random_questions: Returns random questions from active decks

Tests use real database fixtures to verify SQL queries work correctly.
"""

from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureDeck, CultureQuestion, MockExamSession, MockExamStatus, User
from src.repositories.mock_exam import MockExamRepository

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
async def inactive_culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an inactive culture deck for testing."""
    deck = CultureDeck(
        name="Archived Deck",
        description="Archived deck",
        icon="archive",
        color_accent="#6B7280",
        category="history",
        is_active=False,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def culture_questions(
    db_session: AsyncSession, culture_deck: CultureDeck
) -> list[CultureQuestion]:
    """Create multiple culture questions."""
    questions = []
    for i in range(30):  # Create more than 25 to ensure random selection works
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
async def inactive_deck_questions(
    db_session: AsyncSession, inactive_culture_deck: CultureDeck
) -> list[CultureQuestion]:
    """Create questions in an inactive deck."""
    questions = []
    for i in range(5):
        question = CultureQuestion(
            deck_id=inactive_culture_deck.id,
            question_text={"en": f"Inactive Q{i}?", "el": f"Ανενεργό {i};"},
            option_a={"en": "A", "el": "Α"},
            option_b={"en": "B", "el": "Β"},
            option_c={"en": "C", "el": "Γ"},
            option_d={"en": "D", "el": "Δ"},
            correct_option=1,
            order_index=i,
        )
        db_session.add(question)
        questions.append(question)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)
    return questions


@pytest.fixture
async def mock_exam_session(db_session: AsyncSession, test_user: User) -> MockExamSession:
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
async def completed_exam_sessions(
    db_session: AsyncSession, test_user: User
) -> list[MockExamSession]:
    """Create multiple completed exam sessions with varying scores."""
    sessions = []
    for i in range(5):
        # Vary scores: 20, 21, 22, 23, 24 correct out of 25
        score = 20 + i
        passed = score >= 20  # 80% threshold
        session = MockExamSession(
            user_id=test_user.id,
            total_questions=25,
            status=MockExamStatus.COMPLETED,
            score=score,
            passed=passed,
            time_taken_seconds=600 + (i * 60),  # 10-14 minutes
            completed_at=datetime.utcnow() - timedelta(days=i),
        )
        db_session.add(session)
        sessions.append(session)

    await db_session.flush()
    for s in sessions:
        await db_session.refresh(s)
    return sessions


# =============================================================================
# Test create_session
# =============================================================================


class TestCreateSession:
    """Tests for create_session method."""

    @pytest.mark.asyncio
    async def test_create_session_defaults(
        self,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Should create session with ACTIVE status, score=0, passed=False."""
        repo = MockExamRepository(db_session)

        session = await repo.create_session(user_id=test_user.id)

        assert session is not None
        assert session.user_id == test_user.id
        assert session.status == MockExamStatus.ACTIVE
        assert session.score == 0
        assert session.passed is False
        assert session.total_questions == 25  # Default
        assert session.time_taken_seconds == 0

    @pytest.mark.asyncio
    async def test_create_session_custom_questions(
        self,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Should create session with custom total_questions count."""
        repo = MockExamRepository(db_session)

        session = await repo.create_session(
            user_id=test_user.id,
            total_questions=30,
        )

        assert session.total_questions == 30


# =============================================================================
# Test get_session
# =============================================================================


class TestGetSession:
    """Tests for get_session method."""

    @pytest.mark.asyncio
    async def test_get_session_with_answers(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_questions: list[CultureQuestion],
    ):
        """Should retrieve session with answers loaded."""
        repo = MockExamRepository(db_session)

        # Create the session directly in the test to avoid fixture caching issues
        created_session = await repo.create_session(user_id=test_user.id)
        session_id = created_session.id

        # Clear identity map to ensure fresh load
        db_session.expunge(created_session)

        # Save an answer
        await repo.save_answer(
            session_id=session_id,
            question_id=culture_questions[0].id,
            selected_option=1,
            is_correct=True,
            time_taken_seconds=10,
        )

        # Get session - this should load with answers via selectinload
        session = await repo.get_session(session_id, test_user.id)

        assert session is not None
        assert session.id == session_id
        assert len(session.answers) == 1
        assert session.answers[0].question_id == culture_questions[0].id

    @pytest.mark.asyncio
    async def test_get_session_not_found(
        self,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Should return None for non-existent session."""
        repo = MockExamRepository(db_session)

        session = await repo.get_session(uuid4(), test_user.id)

        assert session is None

    @pytest.mark.asyncio
    async def test_get_session_wrong_user(
        self,
        db_session: AsyncSession,
        mock_exam_session: MockExamSession,
    ):
        """Should return None when querying with wrong user_id."""
        repo = MockExamRepository(db_session)

        session = await repo.get_session(mock_exam_session.id, uuid4())

        assert session is None


# =============================================================================
# Test get_active_session
# =============================================================================


class TestGetActiveSession:
    """Tests for get_active_session method."""

    @pytest.mark.asyncio
    async def test_get_active_session(
        self,
        db_session: AsyncSession,
        test_user: User,
        mock_exam_session: MockExamSession,
    ):
        """Should return user's active session."""
        repo = MockExamRepository(db_session)

        session = await repo.get_active_session(test_user.id)

        assert session is not None
        assert session.id == mock_exam_session.id
        assert session.status == MockExamStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_get_active_session_none(
        self,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Should return None when no active session exists."""
        repo = MockExamRepository(db_session)

        session = await repo.get_active_session(test_user.id)

        assert session is None

    @pytest.mark.asyncio
    async def test_get_active_session_ignores_completed(
        self,
        db_session: AsyncSession,
        test_user: User,
        completed_exam_sessions: list[MockExamSession],
    ):
        """Should not return completed sessions."""
        repo = MockExamRepository(db_session)

        session = await repo.get_active_session(test_user.id)

        assert session is None


# =============================================================================
# Test save_answer
# =============================================================================


class TestSaveAnswer:
    """Tests for save_answer method."""

    @pytest.mark.asyncio
    async def test_save_answer(
        self,
        db_session: AsyncSession,
        mock_exam_session: MockExamSession,
        culture_questions: list[CultureQuestion],
    ):
        """Should create answer record with all fields."""
        repo = MockExamRepository(db_session)

        answer = await repo.save_answer(
            session_id=mock_exam_session.id,
            question_id=culture_questions[0].id,
            selected_option=2,
            is_correct=False,
            time_taken_seconds=15,
        )

        assert answer is not None
        assert answer.session_id == mock_exam_session.id
        assert answer.question_id == culture_questions[0].id
        assert answer.selected_option == 2
        assert answer.is_correct is False
        assert answer.time_taken_seconds == 15


# =============================================================================
# Test answer_exists
# =============================================================================


class TestAnswerExists:
    """Tests for answer_exists method."""

    @pytest.mark.asyncio
    async def test_answer_exists_true(
        self,
        db_session: AsyncSession,
        mock_exam_session: MockExamSession,
        culture_questions: list[CultureQuestion],
    ):
        """Should return True when answer exists."""
        repo = MockExamRepository(db_session)

        # Create an answer
        await repo.save_answer(
            session_id=mock_exam_session.id,
            question_id=culture_questions[0].id,
            selected_option=1,
            is_correct=True,
            time_taken_seconds=10,
        )

        exists = await repo.answer_exists(mock_exam_session.id, culture_questions[0].id)

        assert exists is True

    @pytest.mark.asyncio
    async def test_answer_exists_false(
        self,
        db_session: AsyncSession,
        mock_exam_session: MockExamSession,
        culture_questions: list[CultureQuestion],
    ):
        """Should return False when answer does not exist."""
        repo = MockExamRepository(db_session)

        exists = await repo.answer_exists(mock_exam_session.id, culture_questions[0].id)

        assert exists is False


# =============================================================================
# Test complete_session
# =============================================================================


class TestCompleteSession:
    """Tests for complete_session method."""

    @pytest.mark.asyncio
    async def test_complete_session(
        self,
        db_session: AsyncSession,
        mock_exam_session: MockExamSession,
    ):
        """Should update status to COMPLETED with score, passed, and time."""
        repo = MockExamRepository(db_session)

        session = await repo.complete_session(
            session_id=mock_exam_session.id,
            score=20,
            passed=True,
            time_taken_seconds=900,
        )

        assert session is not None
        assert session.status == MockExamStatus.COMPLETED
        assert session.score == 20
        assert session.passed is True
        assert session.time_taken_seconds == 900
        assert session.completed_at is not None

    @pytest.mark.asyncio
    async def test_complete_session_not_found(
        self,
        db_session: AsyncSession,
    ):
        """Should return None for non-existent session."""
        repo = MockExamRepository(db_session)

        session = await repo.complete_session(
            session_id=uuid4(),
            score=20,
            passed=True,
            time_taken_seconds=900,
        )

        assert session is None


# =============================================================================
# Test abandon_session
# =============================================================================


class TestAbandonSession:
    """Tests for abandon_session method."""

    @pytest.mark.asyncio
    async def test_abandon_session(
        self,
        db_session: AsyncSession,
        mock_exam_session: MockExamSession,
    ):
        """Should update status to ABANDONED."""
        repo = MockExamRepository(db_session)

        session = await repo.abandon_session(mock_exam_session.id)

        assert session is not None
        assert session.status == MockExamStatus.ABANDONED
        assert session.completed_at is not None

    @pytest.mark.asyncio
    async def test_abandon_session_not_found(
        self,
        db_session: AsyncSession,
    ):
        """Should return None for non-existent session."""
        repo = MockExamRepository(db_session)

        session = await repo.abandon_session(uuid4())

        assert session is None


# =============================================================================
# Test get_user_statistics
# =============================================================================


class TestGetUserStatistics:
    """Tests for get_user_statistics method."""

    @pytest.mark.asyncio
    async def test_get_user_statistics_empty(
        self,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Should return zeros for new user with no completed exams."""
        repo = MockExamRepository(db_session)

        stats = await repo.get_user_statistics(test_user.id)

        assert stats["total_exams"] == 0
        assert stats["passed_exams"] == 0
        assert stats["pass_rate"] == 0.0
        assert stats["average_score"] == 0.0
        assert stats["best_score"] == 0
        assert stats["total_questions_answered"] == 0
        assert stats["average_time_seconds"] == 0

    @pytest.mark.asyncio
    async def test_get_user_statistics_with_data(
        self,
        db_session: AsyncSession,
        test_user: User,
        completed_exam_sessions: list[MockExamSession],
    ):
        """Should calculate correct aggregates with exam data."""
        repo = MockExamRepository(db_session)

        stats = await repo.get_user_statistics(test_user.id)

        # 5 completed exams with scores: 20, 21, 22, 23, 24 out of 25 questions
        assert stats["total_exams"] == 5
        assert stats["passed_exams"] == 5  # All >= 20 (80%)
        assert stats["pass_rate"] == 100.0
        # Average score as percentage: (80+84+88+92+96) / 5 = 88.0%
        assert stats["average_score"] == 88.0
        # Best score as percentage: 24/25 = 96.0%
        assert stats["best_score"] == 96.0
        # Total questions = 5 * 25 = 125
        assert stats["total_questions_answered"] == 125
        # Average time = (600+660+720+780+840) / 5 = 720
        assert stats["average_time_seconds"] == 720


# =============================================================================
# Test get_recent_exams
# =============================================================================


class TestGetRecentExams:
    """Tests for get_recent_exams method."""

    @pytest.mark.asyncio
    async def test_get_recent_exams(
        self,
        db_session: AsyncSession,
        test_user: User,
        completed_exam_sessions: list[MockExamSession],
    ):
        """Should return ordered list of completed exams (most recent first)."""
        repo = MockExamRepository(db_session)

        exams = await repo.get_recent_exams(test_user.id, limit=10)

        assert len(exams) == 5
        # Should be ordered by completed_at descending (most recent first)
        for i in range(len(exams) - 1):
            assert exams[i].completed_at >= exams[i + 1].completed_at

    @pytest.mark.asyncio
    async def test_get_recent_exams_respects_limit(
        self,
        db_session: AsyncSession,
        test_user: User,
        completed_exam_sessions: list[MockExamSession],
    ):
        """Should respect the limit parameter."""
        repo = MockExamRepository(db_session)

        exams = await repo.get_recent_exams(test_user.id, limit=2)

        assert len(exams) == 2

    @pytest.mark.asyncio
    async def test_get_recent_exams_empty(
        self,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Should return empty list for user with no completed exams."""
        repo = MockExamRepository(db_session)

        exams = await repo.get_recent_exams(test_user.id)

        assert exams == []


# =============================================================================
# Test get_random_questions
# =============================================================================


class TestGetRandomQuestions:
    """Tests for get_random_questions method."""

    @pytest.mark.asyncio
    async def test_get_random_questions(
        self,
        db_session: AsyncSession,
        culture_questions: list[CultureQuestion],
    ):
        """Should return requested count of random questions."""
        repo = MockExamRepository(db_session)

        questions = await repo.get_random_questions(count=25)

        assert len(questions) == 25
        # All questions should be from active decks
        for q in questions:
            assert q.id is not None

    @pytest.mark.asyncio
    async def test_get_random_questions_excludes_inactive(
        self,
        db_session: AsyncSession,
        culture_questions: list[CultureQuestion],
        inactive_deck_questions: list[CultureQuestion],
    ):
        """Should exclude questions from inactive decks."""
        repo = MockExamRepository(db_session)

        # Get all available questions
        questions = await repo.get_random_questions(count=100)

        # Get IDs of inactive deck questions
        inactive_ids = {q.id for q in inactive_deck_questions}

        # No question should be from the inactive deck
        for q in questions:
            assert q.id not in inactive_ids

    @pytest.mark.asyncio
    async def test_get_random_questions_with_exclusion(
        self,
        db_session: AsyncSession,
        culture_questions: list[CultureQuestion],
    ):
        """Should exclude specified question IDs."""
        repo = MockExamRepository(db_session)

        # Exclude first 5 questions
        exclude_ids = [q.id for q in culture_questions[:5]]

        questions = await repo.get_random_questions(
            count=25,
            exclude_question_ids=exclude_ids,
        )

        # No excluded question should appear
        question_ids = {q.id for q in questions}
        for exclude_id in exclude_ids:
            assert exclude_id not in question_ids

    @pytest.mark.asyncio
    async def test_get_random_questions_fewer_available(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
    ):
        """Should return all available when fewer than requested."""
        repo = MockExamRepository(db_session)

        # Create only 5 questions
        for i in range(5):
            question = CultureQuestion(
                deck_id=culture_deck.id,
                question_text={"en": f"Q{i}?", "el": f"Ε{i};"},
                option_a={"en": "A", "el": "Α"},
                option_b={"en": "B", "el": "Β"},
                option_c={"en": "C", "el": "Γ"},
                option_d={"en": "D", "el": "Δ"},
                correct_option=1,
                order_index=i,
            )
            db_session.add(question)
        await db_session.flush()

        questions = await repo.get_random_questions(count=25)

        # Should return only available questions
        assert len(questions) == 5
