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

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.db.models import CultureDeck, CultureQuestion, User
from src.tasks import invalidate_cache_task

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


@pytest.fixture
async def culture_deck_with_questions_and_images(
    db_session: AsyncSession,
) -> tuple[CultureDeck, list[CultureQuestion]]:
    """30 active-deck questions all sharing ONE image_key (PERF-21-03 AC4).

    Every question carries the same `image_key` so the queue endpoint's
    5-question random sample always references exactly 1 unique key,
    regardless of which 5 rows `func.random()` picks -- keeping the
    batched-signing assertions in `TestMockExamQueueBatchedSigning`
    deterministic and non-flaky.
    """
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
            correct_option=(i % 4) + 1,
            order_index=i,
            image_key="examSharedImg",
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
# PERF-21-03: Dedupe + off-loop the /mock-exam/queue sample presigning
# (Test-Spec)
# =============================================================================


class TestMockExamQueueBatchedSigning:
    """PERF-21-03 Test Specs (Mode A / RED): batch-sign the queue endpoint's
    <=5 sample image keys off the event loop.

    RED (Test-Spec / RALPH Mode A): `get_mock_exam_queue` still signs each
    sample question's image inline via a per-item list comprehension calling
    `service.s3_service.generate_presigned_url(...)`. This test is authored
    from the PERF-21-03 AC4 acceptance criterion BEFORE the batching
    implementation and is expected to fail until the endpoint collects
    `(image_key, IMAGE_PRESIGN_EXPIRY_SECONDS)` pairs across the <=5 sample
    questions, dispatches `S3Service.generate_presigned_urls` via
    `asyncio.to_thread`, and builds each `MockExamQuestionResponse.image_url`
    from the resulting map instead of calling `generate_presigned_url`
    per-item.

    DB-gated: this is a full-stack integration test (real DB + auth), so
    locally (no Postgres) it errors with "Cannot connect to test database"
    regardless of RED/GREEN status (documented no-local-DB-verification
    convention) -- RED-by-construction here, runs for real in CI.
    """

    @pytest.mark.asyncio
    async def test_mock_exam_queue_endpoint_batched(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_questions_and_images: tuple,
    ):
        """AC4: the queue endpoint's sample build makes ZERO direct
        `generate_presigned_url` calls, routes through `generate_presigned_urls`
        exactly once (called with the deduped set of unique image keys across
        the sample -- here always `{"examSharedImg"}` since every seeded
        question shares one key), dispatches that batch call via
        `asyncio.to_thread`, and leaves the 1000-row availability count
        query's observable behavior (the `total_questions` field) unchanged
        (Finding 7/8 -- assert on the singular method's call count and the
        explicit `to_thread` patch target, not a boto count masked by the
        per-instance `_url_cache`).
        """
        deck, questions = culture_deck_with_questions_and_images

        mock_s3 = MagicMock()

        def _fake_batch(keys_with_expiry):
            result: dict[str, str | None] = {}
            for key, expiry in keys_with_expiry:
                if not key or key in result:
                    continue
                result[key] = f"https://s3.example.com/presigned/{key}?exp={expiry}"
            return result

        mock_s3.generate_presigned_urls.side_effect = _fake_batch
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/presigned-url"

        with (
            patch("src.services.mock_exam_service.get_s3_service", return_value=mock_s3),
            patch(
                "asyncio.to_thread",
                new=AsyncMock(side_effect=lambda func, *a, **kw: func(*a, **kw)),
            ) as mock_to_thread,
        ):
            response = await client.get("/api/v1/culture/mock-exam/queue", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        # Scope guard: the 1000-row availability count query is untouched --
        # all 30 seeded questions are still counted as available.
        assert data["total_questions"] >= 25
        assert len(data["sample_questions"]) == 5
        assert all(
            q["image_url"] is not None for q in data["sample_questions"]
        ), "every sampled question shares examSharedImg and must resolve a URL"

        assert mock_s3.generate_presigned_url.call_count == 0, (
            "get_mock_exam_queue must no longer call the singular "
            f"generate_presigned_url per sample item; got "
            f"{mock_s3.generate_presigned_url.call_count} calls"
        )
        assert mock_s3.generate_presigned_urls.call_count == 1, (
            "Sample image signing must run in one batched call, not once per "
            f"sample item (got {mock_s3.generate_presigned_urls.call_count})"
        )
        called_pairs = mock_s3.generate_presigned_urls.call_args[0][0]
        called_keys = {key for key, _expiry in called_pairs}
        assert called_keys == {"examSharedImg"}

        dispatched_targets = [call.args[0] for call in mock_to_thread.await_args_list]
        assert (
            mock_s3.generate_presigned_urls in dispatched_targets
        ), "get_mock_exam_queue must dispatch batch signing via asyncio.to_thread"


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


# =============================================================================
# RED tests for PERF-05-04: cache-invalidation wiring
# =============================================================================


class TestMockExamCacheInvalidation:
    """[RED] Tests verifying that mock exam submit-all schedules
    invalidate_cache_task. Fails until PERF-05-04 wires the hook.
    """

    @pytest.mark.asyncio
    async def test_mock_exam_submit_all_schedules_progress_invalidation(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
        culture_deck_with_questions: tuple,
    ):
        """[RED] POST /api/v1/culture/mock-exam/sessions/{id}/submit-all must schedule
        invalidate_cache_task(cache_type='progress', user_id=<auth user>, entity_id=None)
        when background tasks are enabled.
        Fails until the hook is wired in the mock exam submit-all endpoint.
        """
        deck, questions = culture_deck_with_questions

        # Create an active session first
        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        assert (
            create_response.status_code == 201
        ), f"Session creation failed: {create_response.text}"
        session_id = create_response.json()["session"]["id"]
        exam_questions = create_response.json()["questions"]

        # Build passing answers (16/25 = 64%, above 60% threshold)
        answers = []
        for i, question in enumerate(exam_questions):
            question_id = question["id"]
            db_question = next(q for q in questions if str(q.id) == question_id)
            if i < 16:
                answers.append(
                    {
                        "question_id": question_id,
                        "selected_option": db_question.correct_option,
                        "time_taken_seconds": 10,
                    }
                )
            else:
                wrong_option = (db_question.correct_option % 4) + 1
                answers.append(
                    {
                        "question_id": question_id,
                        "selected_option": wrong_option,
                        "time_taken_seconds": 10,
                    }
                )

        # Patch BackgroundTasks.add_task at the Starlette class level so all
        # instances are instrumented. feature_background_tasks must be True so
        # the gated branch in mock_exam.py fires.
        with (
            patch.object(settings, "feature_background_tasks", True),
            patch("starlette.background.BackgroundTasks.add_task") as mock_add_task,
        ):
            response = await client.post(
                f"/api/v1/culture/mock-exam/sessions/{session_id}/submit-all",
                headers=auth_headers,
                json={"answers": answers, "total_time_seconds": 1200},
            )

        assert response.status_code == 200, (
            f"Endpoint returned {response.status_code}: {response.text}. "
            "Fix setup so endpoint succeeds before asserting on invalidation."
        )

        # Filter for invalidate_cache_task calls only
        invalidation_calls = [
            c for c in mock_add_task.call_args_list if c.args and c.args[0] is invalidate_cache_task
        ]
        assert (
            len(invalidation_calls) == 1
        ), f"Expected exactly 1 invalidate_cache_task call, found {len(invalidation_calls)}"
        call_kwargs = invalidation_calls[0].kwargs
        assert call_kwargs.get("cache_type") == "progress"
        assert call_kwargs.get("user_id") == test_user.id
        assert call_kwargs.get("entity_id") is None


# =============================================================================
# WEDGE-04-01 (Test-Spec / RALPH Mode A): submit-all topic_breakdown
# =============================================================================


@pytest.fixture
async def culture_deck_with_topic_seeded_questions(
    db_session: AsyncSession,
) -> tuple[CultureDeck, list[CultureQuestion]]:
    """25 questions (exactly the mock-exam count) cycling through the 5
    CultureTopic values in canonical order, 5 questions per topic --
    deterministic regardless of `get_random_questions`' `ORDER BY random()`
    shuffle since there are exactly 25 rows to draw 25 from (same precedent
    as `culture_questions_shared_image` in test_mock_exam_service.py).

    Each topic's 5 questions are seeded with an increasing number of
    designed-correct answers so the test can independently verify each
    topic's asked/correct/percentage: history 1/5, geography 2/5, politics
    3/5, culture 4/5, practical 5/5 -- all clean round percentages
    (20/40/60/80/100), no rounding ambiguity.
    """
    from src.core.culture_topic import CultureTopic

    deck = CultureDeck(
        name_en="Topic Breakdown Deck",
        name_el="Topic Breakdown Deck",
        name_ru="Topic Breakdown Deck",
        description_en="test",
        description_el="test",
        description_ru="test",
        category="history",
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)

    topics = list(CultureTopic)
    questions = []
    for i in range(25):
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
            correct_option=1,
            order_index=i,
            topic=topics[i % 5].value,
        )
        db_session.add(question)
        questions.append(question)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)

    return deck, questions


class TestMockExamTopicBreakdownEndpoint:
    """WEDGE-04-01: the submit-all response includes a `topic_breakdown`
    field."""

    @pytest.mark.asyncio
    async def test_submit_all_response_includes_topic_breakdown(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck_with_topic_seeded_questions: tuple,
    ):
        """AC-2: submit-all response's topic_breakdown has exactly 5 items
        and each topic's asked/correct/percentage matches the seeded fixture
        (history 1/5=20.0, geography 2/5=40.0, politics 3/5=60.0, culture
        4/5=80.0, practical 5/5=100.0)."""
        deck, questions = culture_deck_with_topic_seeded_questions

        create_response = await client.post(
            "/api/v1/culture/mock-exam/sessions",
            headers=auth_headers,
        )
        session_id = create_response.json()["session"]["id"]
        exam_questions = create_response.json()["questions"]
        # Exactly 25 seeded -> the full set is drawn regardless of shuffle order.
        assert len(exam_questions) == 25

        topic_order = ["history", "geography", "politics", "culture", "practical"]
        expected_correct_by_topic = {
            "history": 1,
            "geography": 2,
            "politics": 3,
            "culture": 4,
            "practical": 5,
        }

        answers = []
        for question in exam_questions:
            question_id = question["id"]
            db_question = next(q for q in questions if str(q.id) == question_id)
            t = db_question.order_index % 5
            j = db_question.order_index // 5
            topic = topic_order[t]
            is_correct = j < expected_correct_by_topic[topic]
            selected_option = (
                db_question.correct_option if is_correct else (db_question.correct_option % 4) + 1
            )
            answers.append(
                {
                    "question_id": question_id,
                    "selected_option": selected_option,
                    "time_taken_seconds": 10,
                }
            )

        response = await client.post(
            f"/api/v1/culture/mock-exam/sessions/{session_id}/submit-all",
            headers=auth_headers,
            json={"answers": answers, "total_time_seconds": 500},
        )

        assert response.status_code == 200
        data = response.json()

        assert "topic_breakdown" in data
        assert len(data["topic_breakdown"]) == 5
        assert [item["topic"] for item in data["topic_breakdown"]] == topic_order

        breakdown = {item["topic"]: item for item in data["topic_breakdown"]}
        for topic, correct_count in expected_correct_by_topic.items():
            assert breakdown[topic]["asked"] == 5, f"{topic} asked mismatch"
            assert breakdown[topic]["correct"] == correct_count, f"{topic} correct mismatch"
            expected_pct = round(correct_count / 5 * 100, 1)
            assert breakdown[topic]["percentage"] == expected_pct, f"{topic} percentage mismatch"

        # Overall score sanity: 1+2+3+4+5=15/25=60% -> passes right at the boundary.
        assert data["score"] == 15
        assert data["percentage"] == 60.0
        assert data["passed"] is True
