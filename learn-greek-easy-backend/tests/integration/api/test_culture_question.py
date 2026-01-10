"""Integration tests for Culture Question API endpoints.

This module tests:
- GET /api/v1/culture/decks/{deck_id}/questions - Get question queue for practice
- POST /api/v1/culture/questions/{question_id}/answer - Submit answer with SM-2
- GET /api/v1/culture/progress - Get overall culture progress

All tests use real database connections via the db_session fixture.
"""

from datetime import date, timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatus, CultureDeck, CultureQuestion, CultureQuestionStats, User

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
async def inactive_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an inactive culture deck."""
    deck = CultureDeck(
        name="Archived",
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
    for i in range(10):
        question = CultureQuestion(
            deck_id=culture_deck.id,
            question_text={
                "en": f"Question {i + 1}?",
                "el": f"Ερώτηση {i + 1};",
                "ru": f"Вопрос {i + 1}?",
            },
            option_a={"en": "Option A", "el": "Επιλογή Α", "ru": "Вариант А"},
            option_b={"en": "Option B", "el": "Επιλογή Β", "ru": "Вариант Б"},
            option_c={"en": "Option C", "el": "Επιλογή Γ", "ru": "Вариант В"},
            option_d={"en": "Option D", "el": "Επιλογή Δ", "ru": "Вариант Г"},
            correct_option=(i % 4) + 1,  # Varies 1-4
            order_index=i,
            image_key=f"images/q{i}.jpg" if i % 3 == 0 else None,
        )
        db_session.add(question)
        questions.append(question)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)
    return questions


@pytest.fixture
async def due_question_stats(
    db_session: AsyncSession,
    test_user: User,
    culture_questions: list[CultureQuestion],
) -> list[CultureQuestionStats]:
    """Create question stats with some questions due for review."""
    stats_list = []

    for i, question in enumerate(culture_questions[:5]):
        if i < 2:
            next_review = date.today() - timedelta(days=i + 1)
            status = CardStatus.LEARNING
        elif i < 4:
            next_review = date.today()
            status = CardStatus.REVIEW
        else:
            next_review = date.today() + timedelta(days=1)
            status = CardStatus.MASTERED

        stats = CultureQuestionStats(
            user_id=test_user.id,
            question_id=question.id,
            easiness_factor=2.5,
            interval=i + 1,
            repetitions=i,
            next_review_date=next_review,
            status=status,
        )
        db_session.add(stats)
        stats_list.append(stats)

    await db_session.flush()
    for s in stats_list:
        await db_session.refresh(s)
    return stats_list


# =============================================================================
# Test Question Queue Endpoint
# =============================================================================


class TestGetQuestionQueueEndpoint:
    """Test suite for GET /api/v1/culture/decks/{deck_id}/questions endpoint."""

    @pytest.mark.asyncio
    async def test_get_questions_requires_auth(
        self,
        client: AsyncClient,
        culture_deck: CultureDeck,
    ):
        """Unauthenticated request should return 401."""
        response = await client.get(f"/api/v1/culture/decks/{culture_deck.id}/questions")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_questions_deck_not_found(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Non-existent deck should return 404."""
        non_existent_id = uuid4()

        response = await client.get(
            f"/api/v1/culture/decks/{non_existent_id}/questions",
            headers=auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_get_questions_inactive_deck_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
        inactive_deck: CultureDeck,
    ):
        """Inactive deck should return 404."""
        response = await client.get(
            f"/api/v1/culture/decks/{inactive_deck.id}/questions",
            headers=auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_questions_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should return question queue successfully."""
        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}/questions",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Check response structure
        assert "deck_id" in data
        assert "deck_name" in data
        assert "total_due" in data
        assert "total_new" in data
        assert "total_in_queue" in data
        assert "questions" in data

        # Verify deck info
        assert data["deck_id"] == str(culture_deck.id)

        # All should be new (no stats yet), limited by default new_questions_limit=5
        assert data["total_due"] == 0
        assert data["total_new"] == 5  # Default new_questions_limit is 5

    @pytest.mark.asyncio
    async def test_get_questions_with_due_questions(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        due_question_stats: list[CultureQuestionStats],
    ):
        """Should return due questions first."""
        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}/questions",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # 4 due (2 overdue + 2 today), 5 new
        assert data["total_due"] == 4
        assert data["total_new"] == 5
        assert data["total_in_queue"] == 9

    @pytest.mark.asyncio
    async def test_get_questions_respects_limit(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should respect limit parameter."""
        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}/questions?limit=3",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_in_queue"] == 3
        assert len(data["questions"]) == 3

    @pytest.mark.asyncio
    async def test_get_questions_excludes_new_when_disabled(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        due_question_stats: list[CultureQuestionStats],
    ):
        """Should not include new questions when include_new=false."""
        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}/questions?include_new=false",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_new"] == 0
        assert data["total_due"] == 4

    @pytest.mark.asyncio
    async def test_get_questions_response_format(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should return questions with correct format."""
        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}/questions?limit=1",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        question = data["questions"][0]
        required_fields = [
            "id",
            "question_text",
            "options",
            "image_url",
            "order_index",
            "is_new",
            "due_date",
            "status",
        ]
        for field in required_fields:
            assert field in question, f"Missing field: {field}"

        # Check options structure
        assert len(question["options"]) == 4
        assert "en" in question["options"][0]
        assert "el" in question["options"][0]

    @pytest.mark.asyncio
    async def test_get_questions_invalid_limit_returns_422(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
    ):
        """Invalid limit should return 422."""
        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}/questions?limit=0",
            headers=auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_questions_limit_max_50(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
    ):
        """Limit above 50 should return 422."""
        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}/questions?limit=51",
            headers=auth_headers,
        )

        assert response.status_code == 422


# =============================================================================
# Test Answer Submission Endpoint
# =============================================================================


class TestSubmitAnswerEndpoint:
    """Test suite for POST /api/v1/culture/questions/{question_id}/answer endpoint."""

    @pytest.mark.asyncio
    async def test_submit_answer_requires_auth(
        self,
        client: AsyncClient,
        culture_questions: list[CultureQuestion],
    ):
        """Unauthenticated request should return 401."""
        question = culture_questions[0]

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 1, "time_taken": 10},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_submit_answer_question_not_found(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Non-existent question should return 404."""
        non_existent_id = uuid4()

        response = await client.post(
            f"/api/v1/culture/questions/{non_existent_id}/answer",
            headers=auth_headers,
            json={"selected_option": 1, "time_taken": 10},
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_submit_answer_correct(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Correct answer should return is_correct=true."""
        question = culture_questions[0]  # correct_option = 1

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            headers=auth_headers,
            json={"selected_option": 1, "time_taken": 10},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_correct"] is True
        assert data["correct_option"] == 1

    @pytest.mark.asyncio
    async def test_submit_answer_wrong(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Wrong answer should return is_correct=false with correct answer."""
        question = culture_questions[0]  # correct_option = 1

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            headers=auth_headers,
            json={"selected_option": 2, "time_taken": 10},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_correct"] is False
        assert data["correct_option"] == 1

    @pytest.mark.asyncio
    async def test_submit_answer_full_flow(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Full flow: submit answer -> verify response structure.

        Note: SM-2 result assertions removed in PERF-03 because SM-2 processing
        now happens in background tasks. The API returns CultureAnswerResponseFast
        which does not include sm2_result.
        """
        question = culture_questions[0]

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            headers=auth_headers,
            json={"selected_option": 1, "time_taken": 15},
        )

        assert response.status_code == 200
        data = response.json()

        # Check response structure (CultureAnswerResponseFast schema)
        assert "is_correct" in data
        assert "correct_option" in data
        assert "xp_earned" in data
        assert "message" in data
        assert "deck_category" in data

        # Verify correct answer
        assert data["is_correct"] is True
        assert data["correct_option"] == 1
        assert data["xp_earned"] >= 0
        assert isinstance(data["message"], str)

    @pytest.mark.asyncio
    async def test_submit_answer_invalid_option_below_range(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_questions: list[CultureQuestion],
    ):
        """selected_option below 1 should return 422."""
        question = culture_questions[0]

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            headers=auth_headers,
            json={"selected_option": 0, "time_taken": 10},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_submit_answer_invalid_option_above_range(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_questions: list[CultureQuestion],
    ):
        """selected_option above 4 should return 422."""
        question = culture_questions[0]

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            headers=auth_headers,
            json={"selected_option": 5, "time_taken": 10},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_submit_answer_boundary_option_1(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """selected_option=1 (boundary) should be valid."""
        question = culture_questions[0]

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            headers=auth_headers,
            json={"selected_option": 1, "time_taken": 10},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_submit_answer_boundary_option_4(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """selected_option=4 (boundary) should be valid."""
        question = culture_questions[3]  # correct_option = 4

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            headers=auth_headers,
            json={"selected_option": 4, "time_taken": 10},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_submit_answer_time_taken_max(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """time_taken at max (180) should be valid."""
        question = culture_questions[0]

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            headers=auth_headers,
            json={"selected_option": 1, "time_taken": 180},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_submit_answer_time_taken_at_max_accepted(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_questions: list[CultureQuestion],
    ):
        """time_taken at max (180 seconds) is accepted."""
        question = culture_questions[0]

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            headers=auth_headers,
            json={"selected_option": 1, "time_taken": 180},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_submit_answer_returns_message(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should return a feedback message."""
        question = culture_questions[0]

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            headers=auth_headers,
            json={"selected_option": 1, "time_taken": 10},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] is not None
        assert isinstance(data["message"], str)


# =============================================================================
# Test Progress Endpoint
# =============================================================================


class TestGetProgressEndpoint:
    """Test suite for GET /api/v1/culture/progress endpoint."""

    @pytest.mark.asyncio
    async def test_get_progress_requires_auth(
        self,
        client: AsyncClient,
    ):
        """Unauthenticated request should return 401."""
        response = await client.get("/api/v1/culture/progress")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_progress_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should return progress successfully."""
        response = await client.get(
            "/api/v1/culture/progress",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Check response structure
        assert "overall" in data
        assert "by_category" in data
        assert "recent_sessions" in data

        # Check overall structure
        overall = data["overall"]
        assert "total_questions" in overall
        assert "questions_mastered" in overall
        assert "questions_learning" in overall
        assert "questions_new" in overall

    @pytest.mark.asyncio
    async def test_get_progress_empty_database(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should return zeros for empty database."""
        response = await client.get(
            "/api/v1/culture/progress",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["overall"]["total_questions"] == 0

    @pytest.mark.asyncio
    async def test_get_progress_counts_questions(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should count total questions from active decks."""
        response = await client.get(
            "/api/v1/culture/progress",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["overall"]["total_questions"] == 10

    @pytest.mark.asyncio
    async def test_get_progress_with_stats(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        due_question_stats: list[CultureQuestionStats],
    ):
        """Should count by status correctly."""
        response = await client.get(
            "/api/v1/culture/progress",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        overall = data["overall"]
        assert overall["questions_mastered"] == 1
        # 5 questions have stats, 5 are new
        assert overall["total_questions"] == 10

    @pytest.mark.asyncio
    async def test_get_progress_by_category(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should include category breakdown."""
        response = await client.get(
            "/api/v1/culture/progress",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert "history" in data["by_category"]
        assert data["by_category"]["history"]["questions_total"] == 10
