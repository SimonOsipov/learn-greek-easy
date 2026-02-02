"""Integration tests for Mock Exam API endpoints.

This module tests:
- GET /api/v1/culture/mock-exam/queue - Preview questions
- POST /api/v1/culture/mock-exam/sessions - Create/resume exam
- POST /api/v1/culture/mock-exam/sessions/{session_id}/submit-all - Submit all answers and complete
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
        name_en="Greek History",
        name_el="Greek History",
        name_ru="Greek History",
        description_en="Learn about Greek history",
        description_el="Learn about Greek history",
        description_ru="Learn about Greek history",
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
        name_en="Small Deck",
        name_el="Small Deck",
        name_ru="Small Deck",
        description_en="Small deck for testing",
        description_el="Small deck for testing",
        description_ru="Small deck for testing",
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

        # Build answers: 20 correct (passing score)
        answers = []
        for question in exam_questions[:20]:
            question_id = question["id"]
            db_question = next(q for q in questions if str(q.id) == question_id)
            answers.append(
                {
                    "question_id": question_id,
                    "selected_option": db_question.correct_option,
                    "time_taken_seconds": 5,
                }
            )

        # Submit all and complete the exam
        await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/submit-all",
            headers=auth_headers,
            json={"answers": answers, "total_time_seconds": 1200},
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
        exam_questions = create_response.json()["questions"]

        # Complete it using submit-all
        answers = []
        for question in exam_questions[:10]:
            question_id = question["id"]
            db_question = next(q for q in questions if str(q.id) == question_id)
            answers.append(
                {
                    "question_id": question_id,
                    "selected_option": db_question.correct_option,
                    "time_taken_seconds": 5,
                }
            )

        await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/submit-all",
            headers=auth_headers,
            json={"answers": answers, "total_time_seconds": 1200},
        )

        # Try to abandon
        response = await client.delete(
            f"/api/v1/culture/mock-exam/sessions/{session_id}",
            headers=auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "MOCK_EXAM_SESSION_EXPIRED"


# =============================================================================
# Test Mock Exam Submit-All Endpoint
# =============================================================================


class TestMockExamSubmitAllEndpoint:
    """Test suite for POST /api/v1/culture/mock-exam/sessions/{id}/submit-all endpoint."""

    @pytest.mark.asyncio
    async def test_submit_all_unauthenticated_returns_401(self, client: AsyncClient):
        """Test unauthenticated request returns 401."""
        session_id = uuid4()
        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/submit-all",
            json={
                "answers": [
                    {"question_id": str(uuid4()), "selected_option": 1, "time_taken_seconds": 10}
                ],
                "total_time_seconds": 1200,
            },
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_submit_all_session_not_found(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test submitting to non-existent session returns 404."""
        non_existent_id = uuid4()

        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{non_existent_id}/submit-all",
            headers=auth_headers,
            json={
                "answers": [
                    {"question_id": str(uuid4()), "selected_option": 1, "time_taken_seconds": 10}
                ],
                "total_time_seconds": 1200,
            },
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_submit_all_success_pass(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test successful submit-all with passing score."""
        deck, questions = culture_deck_with_questions

        # Create session
        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        session_id = create_response.json()["session"]["id"]
        exam_questions = create_response.json()["questions"]

        # Build answers: 16 correct, 9 wrong (64% = pass)
        answers = []
        for i, question in enumerate(exam_questions):
            question_id = question["id"]
            db_question = next(q for q in questions if str(q.id) == question_id)
            if i < 16:
                # Correct answer
                answers.append(
                    {
                        "question_id": question_id,
                        "selected_option": db_question.correct_option,
                        "time_taken_seconds": 10,
                    }
                )
            else:
                # Wrong answer
                wrong_option = (db_question.correct_option % 4) + 1
                answers.append(
                    {
                        "question_id": question_id,
                        "selected_option": wrong_option,
                        "time_taken_seconds": 10,
                    }
                )

        # Submit all
        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/submit-all",
            headers=auth_headers,
            json={
                "answers": answers,
                "total_time_seconds": 1200,
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["passed"] is True
        assert data["score"] == 16
        assert data["total_questions"] == 25
        assert data["percentage"] == 64.0
        assert data["pass_threshold"] == 60
        assert len(data["answer_results"]) == 25
        assert data["new_answers_count"] == 25
        assert data["duplicate_answers_count"] == 0
        assert data["total_xp_earned"] > 0
        assert data["session"]["status"] == "completed"

    @pytest.mark.asyncio
    async def test_submit_all_success_fail(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test successful submit-all with failing score."""
        deck, questions = culture_deck_with_questions

        # Create session
        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        session_id = create_response.json()["session"]["id"]
        exam_questions = create_response.json()["questions"]

        # Build answers: 10 correct, 15 wrong (40% = fail)
        answers = []
        for i, question in enumerate(exam_questions):
            question_id = question["id"]
            db_question = next(q for q in questions if str(q.id) == question_id)
            if i < 10:
                # Correct answer
                answers.append(
                    {
                        "question_id": question_id,
                        "selected_option": db_question.correct_option,
                        "time_taken_seconds": 10,
                    }
                )
            else:
                # Wrong answer
                wrong_option = (db_question.correct_option % 4) + 1
                answers.append(
                    {
                        "question_id": question_id,
                        "selected_option": wrong_option,
                        "time_taken_seconds": 10,
                    }
                )

        # Submit all
        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/submit-all",
            headers=auth_headers,
            json={
                "answers": answers,
                "total_time_seconds": 1200,
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["passed"] is False
        assert data["score"] == 10
        assert data["percentage"] == 40.0

    @pytest.mark.asyncio
    async def test_submit_all_all_answers_processed(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test submit-all processes all answers correctly with no duplicates."""
        deck, questions = culture_deck_with_questions

        # Create session
        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        session_id = create_response.json()["session"]["id"]
        exam_questions = create_response.json()["questions"]

        # Submit all 25 answers via submit-all
        answers = []
        for question in exam_questions:
            question_id = question["id"]
            db_question = next(q for q in questions if str(q.id) == question_id)
            answers.append(
                {
                    "question_id": question_id,
                    "selected_option": db_question.correct_option,
                    "time_taken_seconds": 10,
                }
            )

        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/submit-all",
            headers=auth_headers,
            json={
                "answers": answers,
                "total_time_seconds": 1200,
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["new_answers_count"] == 25  # All new
        assert data["duplicate_answers_count"] == 0
        assert data["score"] == 25  # All correct
        assert data["passed"] is True

        # Verify no duplicates in results
        duplicate_results = [ar for ar in data["answer_results"] if ar["was_duplicate"]]
        assert len(duplicate_results) == 0

    @pytest.mark.asyncio
    async def test_submit_all_already_completed_returns_400(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test submit-all to already completed session returns 400."""
        deck, questions = culture_deck_with_questions

        # Create session
        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        session_id = create_response.json()["session"]["id"]
        exam_questions = create_response.json()["questions"]

        # Complete it first via submit-all
        first_answers = []
        for question in exam_questions[:10]:
            question_id = question["id"]
            db_question = next(q for q in questions if str(q.id) == question_id)
            first_answers.append(
                {
                    "question_id": question_id,
                    "selected_option": db_question.correct_option,
                    "time_taken_seconds": 5,
                }
            )

        await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/submit-all",
            headers=auth_headers,
            json={"answers": first_answers, "total_time_seconds": 1200},
        )

        # Try to submit-all again
        second_answers = []
        for question in exam_questions:
            question_id = question["id"]
            second_answers.append(
                {
                    "question_id": question_id,
                    "selected_option": 1,
                    "time_taken_seconds": 10,
                }
            )

        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/submit-all",
            headers=auth_headers,
            json={
                "answers": second_answers,
                "total_time_seconds": 1200,
            },
        )

        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "MOCK_EXAM_SESSION_EXPIRED"

    @pytest.mark.asyncio
    async def test_submit_all_validation_empty_answers(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test validation error for empty answers list."""
        deck, questions = culture_deck_with_questions

        # Create session
        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        session_id = create_response.json()["session"]["id"]

        # Try to submit empty answers
        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/submit-all",
            headers=auth_headers,
            json={
                "answers": [],
                "total_time_seconds": 1200,
            },
        )

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_submit_all_validation_invalid_option(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions: tuple,
    ):
        """Test validation error for invalid option value."""
        deck, questions = culture_deck_with_questions

        # Create session
        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        session_id = create_response.json()["session"]["id"]
        exam_questions = create_response.json()["questions"]

        # Try to submit with invalid option (5 is out of range 1-4)
        answers = [
            {
                "question_id": exam_questions[0]["id"],
                "selected_option": 5,  # Invalid: must be 1-4
                "time_taken_seconds": 10,
            }
        ]

        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/submit-all",
            headers=auth_headers,
            json={
                "answers": answers,
                "total_time_seconds": 1200,
            },
        )

        assert response.status_code == 422  # Validation error
