"""Integration tests for Mock Exam API endpoints.

This module tests:
- GET /api/v1/culture/mock-exam/queue - Preview questions
- POST /api/v1/culture/mock-exam/sessions - Create/resume exam
- POST /api/v1/culture/mock-exam/sessions/{session_id}/answers - Submit answer
- POST /api/v1/culture/mock-exam/sessions/{session_id}/complete - Complete exam
- GET /api/v1/culture/mock-exam/statistics - User statistics
- DELETE /api/v1/culture/mock-exam/sessions/{session_id} - Abandon exam

All tests use real database connections via the db_session fixture.
All endpoints require authentication.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureDeck, CultureQuestion

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def culture_deck_with_questions(
    db_session: AsyncSession,
) -> tuple[CultureDeck, list[CultureQuestion]]:
    """Create a culture deck with 30 questions for mock exam testing."""
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

    questions = []
    for i in range(30):
        question = CultureQuestion(
            deck_id=deck.id,
            question_text={
                "en": f"Question {i + 1}?",
                "el": f"Ερώτηση {i + 1};",
                "ru": f"Вопрос {i + 1}?",
            },
            option_a={"en": "Option A", "el": "Επιλογή Α", "ru": "Вариант А"},
            option_b={"en": "Option B", "el": "Επιλογή Β", "ru": "Вариант Б"},
            option_c={"en": "Option C", "el": "Επιλογή Γ", "ru": "Вариант В"},
            option_d={"en": "Option D", "el": "Επιλογή Δ", "ru": "Вариант Г"},
            correct_option=(i % 4) + 1,  # Cycle through 1, 2, 3, 4
            order_index=i,
        )
        db_session.add(question)
        questions.append(question)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)

    return deck, questions


@pytest.fixture
async def few_questions_deck(db_session: AsyncSession) -> tuple[CultureDeck, list[CultureQuestion]]:
    """Create a culture deck with only 10 questions (not enough for mock exam)."""
    deck = CultureDeck(
        name="Small Deck",
        description="Small deck for testing",
        icon="archive",
        color_accent="#6B7280",
        category="culture",
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)

    questions = []
    for i in range(10):
        question = CultureQuestion(
            deck_id=deck.id,
            question_text={"en": f"Q{i}", "el": f"E{i}", "ru": f"В{i}"},
            option_a={"en": "A", "el": "Α", "ru": "А"},
            option_b={"en": "B", "el": "Β", "ru": "Б"},
            correct_option=1,
            order_index=i,
        )
        db_session.add(question)
        questions.append(question)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)

    return deck, questions


# =============================================================================
# Test Mock Exam Queue Endpoint
# =============================================================================


class TestMockExamQueueEndpoint:
    """Test suite for GET /api/v1/culture/mock-exam/queue endpoint."""

    @pytest.mark.asyncio
    async def test_queue_unauthenticated_returns_401(self, client: AsyncClient):
        """Test unauthenticated request returns 401."""
        response = await client.get("/api/v1/culture/mock-exam/queue")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_queue_success_with_questions(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test successful queue response with enough questions."""
        deck, questions = culture_deck_with_questions

        response = await client.get("/api/v1/culture/mock-exam/queue", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total_questions"] >= 25
        assert data["available_questions"] >= 25
        assert data["can_start_exam"] is True
        assert len(data["sample_questions"]) == 5

        # Verify sample question structure
        sample = data["sample_questions"][0]
        assert "id" in sample
        assert "question_text" in sample
        assert "options" in sample
        assert "option_count" in sample

    @pytest.mark.asyncio
    async def test_queue_insufficient_questions(
        self,
        client: AsyncClient,
        auth_headers: dict,
        few_questions_deck: tuple,
    ):
        """Test queue response when not enough questions available."""
        deck, questions = few_questions_deck

        response = await client.get("/api/v1/culture/mock-exam/queue", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total_questions"] == 10
        assert data["can_start_exam"] is False

    @pytest.mark.asyncio
    async def test_queue_empty_database(self, client: AsyncClient, auth_headers: dict):
        """Test queue response with no questions in database."""
        response = await client.get("/api/v1/culture/mock-exam/queue", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total_questions"] == 0
        assert data["can_start_exam"] is False
        assert data["sample_questions"] == []


# =============================================================================
# Test Mock Exam Create Endpoint
# =============================================================================


class TestMockExamCreateEndpoint:
    """Test suite for POST /api/v1/culture/mock-exam/sessions endpoint."""

    @pytest.mark.asyncio
    async def test_create_unauthenticated_returns_401(self, client: AsyncClient):
        """Test unauthenticated request returns 401."""
        response = await client.post("/api/v1/culture/mock-exam/sessions")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_create_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test successfully creating a mock exam session."""
        deck, questions = culture_deck_with_questions

        response = await client.post("/api/v1/culture/mock-exam/sessions", headers=auth_headers)

        assert response.status_code == 201
        data = response.json()

        # Verify session
        assert "session" in data
        session = data["session"]
        assert "id" in session
        assert session["score"] == 0
        assert session["total_questions"] == 25
        assert session["passed"] is False
        assert session["status"] == "active"

        # Verify questions
        assert "questions" in data
        assert len(data["questions"]) == 25
        assert data["is_resumed"] is False

    @pytest.mark.asyncio
    async def test_create_resumes_existing_session(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test creating session when one already exists returns the existing one."""
        deck, questions = culture_deck_with_questions

        # Create first session
        response1 = await client.post("/api/v1/culture/mock-exam/sessions", headers=auth_headers)
        assert response1.status_code == 201
        session_id_1 = response1.json()["session"]["id"]

        # Attempt to create second session - should return existing
        response2 = await client.post("/api/v1/culture/mock-exam/sessions", headers=auth_headers)
        assert response2.status_code == 201
        data = response2.json()
        assert data["session"]["id"] == session_id_1
        assert data["is_resumed"] is True


# =============================================================================
# Test Mock Exam Answer Endpoint
# =============================================================================


class TestMockExamAnswerEndpoint:
    """Test suite for POST /api/v1/culture/mock-exam/sessions/{id}/answers endpoint."""

    @pytest.mark.asyncio
    async def test_answer_unauthenticated_returns_401(self, client: AsyncClient):
        """Test unauthenticated request returns 401."""
        session_id = uuid4()
        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/answers",
            json={"question_id": str(uuid4()), "selected_option": 1, "time_taken_seconds": 10},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_answer_session_not_found(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test answering with non-existent session returns 404."""
        non_existent_id = uuid4()

        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{non_existent_id}/answers",
            headers=auth_headers,
            json={"question_id": str(uuid4()), "selected_option": 1, "time_taken_seconds": 10},
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_answer_correct(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test submitting a correct answer."""
        deck, questions = culture_deck_with_questions

        # Create session
        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        session_id = create_response.json()["session"]["id"]
        exam_questions = create_response.json()["questions"]

        # Get the first question and its correct answer
        question = exam_questions[0]
        question_id = question["id"]

        # Find the correct option for this question from the database
        db_question = next(q for q in questions if str(q.id) == question_id)
        correct_option = db_question.correct_option

        # Submit correct answer
        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/answers",
            headers=auth_headers,
            json={
                "question_id": question_id,
                "selected_option": correct_option,
                "time_taken_seconds": 10,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_correct"] is True
        assert data["correct_option"] == correct_option
        assert data["xp_earned"] > 0
        assert data["current_score"] == 1
        assert data["answers_count"] == 1
        assert data["duplicate"] is False

    @pytest.mark.asyncio
    async def test_answer_wrong(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test submitting a wrong answer."""
        deck, questions = culture_deck_with_questions

        # Create session
        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        session_id = create_response.json()["session"]["id"]
        exam_questions = create_response.json()["questions"]

        # Get the first question
        question = exam_questions[0]
        question_id = question["id"]

        # Find the correct option and pick a wrong one
        db_question = next(q for q in questions if str(q.id) == question_id)
        correct_option = db_question.correct_option
        wrong_option = (correct_option % 4) + 1  # Pick a different option

        # Submit wrong answer
        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/answers",
            headers=auth_headers,
            json={
                "question_id": question_id,
                "selected_option": wrong_option,
                "time_taken_seconds": 10,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_correct"] is False
        assert data["correct_option"] == correct_option
        assert data["xp_earned"] >= 0  # Still get encouragement XP
        assert data["current_score"] == 0  # Wrong answer doesn't increase score
        assert data["duplicate"] is False

    @pytest.mark.asyncio
    async def test_answer_duplicate_handling(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test that duplicate answers are handled gracefully."""
        deck, questions = culture_deck_with_questions

        # Create session
        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        session_id = create_response.json()["session"]["id"]
        exam_questions = create_response.json()["questions"]

        question_id = exam_questions[0]["id"]

        # Submit first answer
        await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/answers",
            headers=auth_headers,
            json={
                "question_id": question_id,
                "selected_option": 1,
                "time_taken_seconds": 10,
            },
        )

        # Submit duplicate answer
        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/answers",
            headers=auth_headers,
            json={
                "question_id": question_id,
                "selected_option": 2,  # Different option
                "time_taken_seconds": 5,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["duplicate"] is True
        assert data["is_correct"] is None
        assert data["correct_option"] is None
        assert data["xp_earned"] == 0


# =============================================================================
# Test Mock Exam Complete Endpoint
# =============================================================================


class TestMockExamCompleteEndpoint:
    """Test suite for POST /api/v1/culture/mock-exam/sessions/{id}/complete endpoint."""

    @pytest.mark.asyncio
    async def test_complete_unauthenticated_returns_401(self, client: AsyncClient):
        """Test unauthenticated request returns 401."""
        session_id = uuid4()
        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/complete",
            json={"total_time_seconds": 1200},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_complete_session_not_found(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test completing non-existent session returns 404."""
        non_existent_id = uuid4()

        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{non_existent_id}/complete",
            headers=auth_headers,
            json={"total_time_seconds": 1200},
        )

        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_complete_success_pass(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test completing exam with passing score."""
        deck, questions = culture_deck_with_questions

        # Create session
        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        session_id = create_response.json()["session"]["id"]
        exam_questions = create_response.json()["questions"]

        # Answer 16 questions correctly (64% - above 60% pass threshold)
        for i, question in enumerate(exam_questions[:16]):
            question_id = question["id"]
            db_question = next(q for q in questions if str(q.id) == question_id)
            await client.post(
                f"/api/v1/culture/mock-exam/sessions/{session_id}/answers",
                headers=auth_headers,
                json={
                    "question_id": question_id,
                    "selected_option": db_question.correct_option,
                    "time_taken_seconds": 5,
                },
            )

        # Answer remaining 9 questions incorrectly
        for question in exam_questions[16:]:
            question_id = question["id"]
            db_question = next(q for q in questions if str(q.id) == question_id)
            wrong_option = (db_question.correct_option % 4) + 1
            await client.post(
                f"/api/v1/culture/mock-exam/sessions/{session_id}/answers",
                headers=auth_headers,
                json={
                    "question_id": question_id,
                    "selected_option": wrong_option,
                    "time_taken_seconds": 5,
                },
            )

        # Complete the exam
        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/complete",
            headers=auth_headers,
            json={"total_time_seconds": 1200},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["passed"] is True
        assert data["score"] == 16
        assert data["total_questions"] == 25
        assert data["percentage"] == 64.0
        assert data["pass_threshold"] == 60
        assert data["session"]["status"] == "completed"

    @pytest.mark.asyncio
    async def test_complete_success_fail(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test completing exam with failing score."""
        deck, questions = culture_deck_with_questions

        # Create session
        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        session_id = create_response.json()["session"]["id"]
        exam_questions = create_response.json()["questions"]

        # Answer only 10 questions correctly (40% - failing)
        for i, question in enumerate(exam_questions[:10]):
            question_id = question["id"]
            db_question = next(q for q in questions if str(q.id) == question_id)
            await client.post(
                f"/api/v1/culture/mock-exam/sessions/{session_id}/answers",
                headers=auth_headers,
                json={
                    "question_id": question_id,
                    "selected_option": db_question.correct_option,
                    "time_taken_seconds": 5,
                },
            )

        # Answer remaining questions incorrectly
        for question in exam_questions[10:]:
            question_id = question["id"]
            db_question = next(q for q in questions if str(q.id) == question_id)
            wrong_option = (db_question.correct_option % 4) + 1
            await client.post(
                f"/api/v1/culture/mock-exam/sessions/{session_id}/answers",
                headers=auth_headers,
                json={
                    "question_id": question_id,
                    "selected_option": wrong_option,
                    "time_taken_seconds": 5,
                },
            )

        # Complete the exam
        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/complete",
            headers=auth_headers,
            json={"total_time_seconds": 1200},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["passed"] is False
        assert data["score"] == 10
        assert data["percentage"] == 40.0

    @pytest.mark.asyncio
    async def test_complete_already_completed_returns_400(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test completing an already completed session returns 400."""
        deck, questions = culture_deck_with_questions

        # Create and complete session
        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        session_id = create_response.json()["session"]["id"]

        # Complete it first
        await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/complete",
            headers=auth_headers,
            json={"total_time_seconds": 1200},
        )

        # Try to complete again
        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/complete",
            headers=auth_headers,
            json={"total_time_seconds": 1300},
        )

        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "MOCK_EXAM_SESSION_EXPIRED"


# =============================================================================
# Test Mock Exam Statistics Endpoint
# =============================================================================


class TestMockExamStatisticsEndpoint:
    """Test suite for GET /api/v1/culture/mock-exam/statistics endpoint."""

    @pytest.mark.asyncio
    async def test_statistics_unauthenticated_returns_401(self, client: AsyncClient):
        """Test unauthenticated request returns 401."""
        response = await client.get("/api/v1/culture/mock-exam/statistics")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_statistics_empty(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test statistics for user with no exam history."""
        response = await client.get("/api/v1/culture/mock-exam/statistics", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "stats" in data
        assert data["stats"]["total_exams"] == 0
        assert data["stats"]["passed_exams"] == 0
        assert data["stats"]["pass_rate"] == 0.0
        assert data["recent_exams"] == []

    @pytest.mark.asyncio
    async def test_statistics_after_exam(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test statistics after completing an exam."""
        deck, questions = culture_deck_with_questions

        # Create and complete an exam
        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        session_id = create_response.json()["session"]["id"]
        exam_questions = create_response.json()["questions"]

        # Answer 20 questions correctly (passing score)
        for question in exam_questions[:20]:
            question_id = question["id"]
            db_question = next(q for q in questions if str(q.id) == question_id)
            await client.post(
                f"/api/v1/culture/mock-exam/sessions/{session_id}/answers",
                headers=auth_headers,
                json={
                    "question_id": question_id,
                    "selected_option": db_question.correct_option,
                    "time_taken_seconds": 5,
                },
            )

        # Complete the exam
        await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/complete",
            headers=auth_headers,
            json={"total_time_seconds": 1200},
        )

        # Get statistics
        response = await client.get("/api/v1/culture/mock-exam/statistics", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["stats"]["total_exams"] == 1
        assert data["stats"]["passed_exams"] == 1
        assert data["stats"]["pass_rate"] == 100.0
        assert len(data["recent_exams"]) == 1
        assert data["recent_exams"][0]["passed"] is True


# =============================================================================
# Test Mock Exam Abandon Endpoint
# =============================================================================


class TestMockExamAbandonEndpoint:
    """Test suite for DELETE /api/v1/culture/mock-exam/sessions/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_abandon_unauthenticated_returns_401(self, client: AsyncClient):
        """Test unauthenticated request returns 401."""
        session_id = uuid4()
        response = await client.delete(
            f"/api/v1/culture/mock-exam/sessions/{session_id}",
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_abandon_session_not_found(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test abandoning non-existent session returns 404."""
        non_existent_id = uuid4()

        response = await client.delete(
            f"/api/v1/culture/mock-exam/sessions/{non_existent_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_abandon_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test successfully abandoning an active session."""
        deck, questions = culture_deck_with_questions

        # Create session
        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        session_id = create_response.json()["session"]["id"]

        # Abandon the session
        response = await client.delete(
            f"/api/v1/culture/mock-exam/sessions/{session_id}",
            headers=auth_headers,
        )

        assert response.status_code == 204

        # Verify session cannot be resumed - creating new should create a new one
        create_response2 = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        assert create_response2.status_code == 201
        new_session_id = create_response2.json()["session"]["id"]
        assert new_session_id != session_id  # New session, not resumed
        assert create_response2.json()["is_resumed"] is False

    @pytest.mark.asyncio
    async def test_abandon_already_completed_returns_400(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test abandoning an already completed session returns 400."""
        deck, questions = culture_deck_with_questions

        # Create and complete session
        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        session_id = create_response.json()["session"]["id"]

        # Complete it
        await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/complete",
            headers=auth_headers,
            json={"total_time_seconds": 1200},
        )

        # Try to abandon
        response = await client.delete(
            f"/api/v1/culture/mock-exam/sessions/{session_id}",
            headers=auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "MOCK_EXAM_SESSION_EXPIRED"
