"""E2E tests for Culture Module API endpoints.

This module provides comprehensive E2E tests for the culture exam simulator API,
covering:
- GET /api/v1/culture/decks - List culture decks with pagination and filtering
- GET /api/v1/culture/decks/{deck_id} - Get culture deck details
- GET /api/v1/culture/categories - Get available categories
- GET /api/v1/culture/decks/{deck_id}/questions - Get question queue (auth required)
- POST /api/v1/culture/questions/{question_id}/answer - Submit answer (auth required)
- GET /api/v1/culture/progress - Get culture progress (auth required)

Run with:
    pytest tests/e2e/scenarios/test_culture_practice.py -v
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.e2e.conftest import E2ETestCase, UserSession
from tests.factories.culture import (
    CultureDeckFactory,
    CultureQuestionFactory,
    CultureQuestionStatsFactory,
)

# =============================================================================
# TestCultureDecksList - GET /api/v1/culture/decks
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureDecksList(E2ETestCase):
    """E2E tests for GET /api/v1/culture/decks endpoint."""

    @pytest.mark.asyncio
    async def test_list_decks_empty(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Test listing decks when no decks exist returns empty list."""
        response = await client.get("/api/v1/culture/decks", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["decks"] == []

    @pytest.mark.asyncio
    async def test_list_decks_response_structure(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        db_session: AsyncSession,
    ) -> None:
        """Test that deck list response has correct structure."""
        # Create a deck
        await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.get("/api/v1/culture/decks", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        # Top-level structure
        assert "total" in data
        assert "decks" in data
        assert isinstance(data["total"], int)
        assert isinstance(data["decks"], list)

        # Deck structure
        assert len(data["decks"]) == 1
        deck_data = data["decks"][0]
        required_fields = [
            "id",
            "name",
            "description",
            "icon",
            "color_accent",
            "category",
            "question_count",
            "progress",
        ]
        for field in required_fields:
            assert field in deck_data, f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_list_decks_pagination(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        db_session: AsyncSession,
    ) -> None:
        """Test pagination parameters work correctly."""
        # Create 5 decks
        for i in range(5):
            await CultureDeckFactory.create(
                session=db_session,
                name={"el": f"Deck {i}", "en": f"Deck {i}", "ru": f"Deck {i}"},
            )
        await db_session.commit()

        # First page: page=1, page_size=2
        response = await client.get(
            "/api/v1/culture/decks?page=1&page_size=2", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["decks"]) == 2
        assert data["total"] == 5

        # Second page: page=2, page_size=2
        response = await client.get(
            "/api/v1/culture/decks?page=2&page_size=2", headers=auth_headers
        )
        data = response.json()
        assert len(data["decks"]) == 2

        # Third page: page=3, page_size=2
        response = await client.get(
            "/api/v1/culture/decks?page=3&page_size=2", headers=auth_headers
        )
        data = response.json()
        assert len(data["decks"]) == 1  # Only 1 remaining

    @pytest.mark.asyncio
    async def test_list_decks_filter_by_category(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        db_session: AsyncSession,
    ) -> None:
        """Test filtering decks by category."""
        # Create decks with different categories
        await CultureDeckFactory.create(session=db_session)  # history (default)
        await CultureDeckFactory.create(session=db_session, geography=True)
        await CultureDeckFactory.create(session=db_session, politics=True)
        await db_session.commit()

        # Filter by history
        response = await client.get("/api/v1/culture/decks?category=history", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert all(d["category"] == "history" for d in data["decks"])

        # Filter by geography
        response = await client.get(
            "/api/v1/culture/decks?category=geography", headers=auth_headers
        )
        data = response.json()
        assert data["total"] == 1
        assert all(d["category"] == "geography" for d in data["decks"])

    @pytest.mark.asyncio
    async def test_list_decks_excludes_inactive(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        db_session: AsyncSession,
    ) -> None:
        """Test that inactive decks are not returned."""
        # Create active and inactive decks
        await CultureDeckFactory.create(session=db_session)  # active
        await CultureDeckFactory.create(session=db_session, inactive=True)
        await db_session.commit()

        response = await client.get("/api/v1/culture/decks", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Only active deck should be returned
        assert data["total"] == 1

    @pytest.mark.asyncio
    async def test_list_decks_unauthenticated_returns_401(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Test that unauthenticated users get 401."""
        await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.get("/api/v1/culture/decks")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_decks_authenticated_with_progress(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that authenticated users can see progress data."""
        # Create deck with questions
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        # Create stats for the user
        await CultureQuestionStatsFactory.create(
            session=db_session,
            user_id=fresh_user_session.user.id,
            question_id=question.id,
            learning=True,
        )
        await db_session.commit()

        response = await client.get(
            "/api/v1/culture/decks",
            headers=fresh_user_session.headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Progress should be populated for authenticated users
        assert data["decks"][0]["progress"] is not None
        progress = data["decks"][0]["progress"]
        assert "questions_total" in progress
        assert "questions_mastered" in progress
        assert "questions_learning" in progress
        assert "questions_new" in progress

    @pytest.mark.asyncio
    async def test_list_decks_multilingual_content(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        db_session: AsyncSession,
    ) -> None:
        """Test that decks include multilingual name and description."""
        await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.get("/api/v1/culture/decks", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        deck_data = data["decks"][0]
        # Name should have el, en, ru keys
        assert "el" in deck_data["name"]
        assert "en" in deck_data["name"]
        assert "ru" in deck_data["name"]
        # Description should have el, en, ru keys
        assert "el" in deck_data["description"]
        assert "en" in deck_data["description"]
        assert "ru" in deck_data["description"]


# =============================================================================
# TestCultureDeckDetail - GET /api/v1/culture/decks/{deck_id}
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureDeckDetail(E2ETestCase):
    """E2E tests for GET /api/v1/culture/decks/{deck_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_deck_success(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        db_session: AsyncSession,
    ) -> None:
        """Test getting a deck by ID returns correct data."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.get(f"/api/v1/culture/decks/{deck.id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(deck.id)
        assert data["category"] == deck.category
        assert data["icon"] == deck.icon

    @pytest.mark.asyncio
    async def test_get_deck_response_structure(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        db_session: AsyncSession,
    ) -> None:
        """Test that deck detail response has correct structure."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.get(f"/api/v1/culture/decks/{deck.id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        # Detail-specific fields
        required_fields = [
            "id",
            "name",
            "description",
            "icon",
            "color_accent",
            "category",
            "question_count",
            "progress",
            "is_active",
            "created_at",
            "updated_at",
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_get_deck_not_found(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Test getting a non-existent deck returns 404."""
        fake_id = uuid4()
        response = await client.get(f"/api/v1/culture/decks/{fake_id}", headers=auth_headers)

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_deck_invalid_uuid(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Test getting deck with invalid UUID returns 422."""
        response = await client.get("/api/v1/culture/decks/not-a-uuid", headers=auth_headers)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_inactive_deck_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        db_session: AsyncSession,
    ) -> None:
        """Test that inactive decks return 404."""
        deck = await CultureDeckFactory.create(session=db_session, inactive=True)
        await db_session.commit()

        response = await client.get(f"/api/v1/culture/decks/{deck.id}", headers=auth_headers)

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_deck_authenticated_with_progress(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test authenticated user sees progress in deck detail."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await CultureQuestionStatsFactory.create(
            session=db_session,
            user_id=fresh_user_session.user.id,
            question_id=question.id,
            mastered=True,
        )
        await db_session.commit()

        response = await client.get(
            f"/api/v1/culture/decks/{deck.id}",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["progress"] is not None
        assert data["progress"]["questions_mastered"] == 1


# =============================================================================
# TestCultureCategories - GET /api/v1/culture/categories
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureCategories(E2ETestCase):
    """E2E tests for GET /api/v1/culture/categories endpoint."""

    @pytest.mark.asyncio
    async def test_get_categories_empty(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Test getting categories when no decks exist returns empty list."""
        response = await client.get("/api/v1/culture/categories", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data == []

    @pytest.mark.asyncio
    async def test_get_categories_returns_list(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        db_session: AsyncSession,
    ) -> None:
        """Test that categories endpoint returns list of strings."""
        # Create decks with different categories
        await CultureDeckFactory.create(session=db_session)  # history
        await CultureDeckFactory.create(session=db_session, geography=True)
        await CultureDeckFactory.create(session=db_session, politics=True)
        await db_session.commit()

        response = await client.get("/api/v1/culture/categories", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 3
        assert "history" in data
        assert "geography" in data
        assert "politics" in data

    @pytest.mark.asyncio
    async def test_get_categories_unique(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        db_session: AsyncSession,
    ) -> None:
        """Test that categories are unique (no duplicates)."""
        # Create multiple decks with same category
        await CultureDeckFactory.create(session=db_session)  # history
        await CultureDeckFactory.create(session=db_session)  # history
        await db_session.commit()

        response = await client.get("/api/v1/culture/categories", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0] == "history"

    @pytest.mark.asyncio
    async def test_get_categories_excludes_inactive_decks(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        db_session: AsyncSession,
    ) -> None:
        """Test that categories from inactive decks are not returned."""
        await CultureDeckFactory.create(session=db_session)  # history, active
        await CultureDeckFactory.create(session=db_session, geography=True, inactive=True)
        await db_session.commit()

        response = await client.get("/api/v1/culture/categories", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "history" in data
        assert "geography" not in data


# =============================================================================
# TestCultureQuestionQueue - GET /api/v1/culture/decks/{deck_id}/questions
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureQuestionQueue(E2ETestCase):
    """E2E tests for GET /api/v1/culture/decks/{deck_id}/questions endpoint."""

    @pytest.mark.asyncio
    async def test_question_queue_requires_auth(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Test that question queue endpoint requires authentication."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.get(f"/api/v1/culture/decks/{deck.id}/questions")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_question_queue_invalid_token(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Test that invalid token returns 401."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        headers = {"Authorization": "Bearer invalid_token"}
        response = await client.get(
            f"/api/v1/culture/decks/{deck.id}/questions",
            headers=headers,
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_question_queue_response_structure(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that question queue response has correct structure."""
        deck = await CultureDeckFactory.create(session=db_session)
        await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.get(
            f"/api/v1/culture/decks/{deck.id}/questions",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Top-level structure
        required_fields = [
            "deck_id",
            "deck_name",
            "total_due",
            "total_new",
            "total_in_queue",
            "questions",
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_question_queue_question_structure(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that each question in queue has correct structure."""
        deck = await CultureDeckFactory.create(session=db_session)
        await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.get(
            f"/api/v1/culture/decks/{deck.id}/questions",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["questions"]) > 0

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
            assert field in question, f"Missing question field: {field}"

        # Options should have 4 items
        assert len(question["options"]) == 4

    @pytest.mark.asyncio
    async def test_question_queue_deck_not_found(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
    ) -> None:
        """Test that non-existent deck returns 404."""
        fake_id = uuid4()
        response = await client.get(
            f"/api/v1/culture/decks/{fake_id}/questions",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_question_queue_limit_parameter(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that limit parameter restricts number of questions."""
        deck = await CultureDeckFactory.create(session=db_session)
        # Create 10 questions
        for i in range(10):
            await CultureQuestionFactory.create(session=db_session, deck_id=deck.id, order_index=i)
        await db_session.commit()

        response = await client.get(
            f"/api/v1/culture/decks/{deck.id}/questions?limit=3",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["questions"]) <= 3

    @pytest.mark.asyncio
    async def test_question_queue_include_new_false(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that include_new=false excludes new questions."""
        deck = await CultureDeckFactory.create(session=db_session)
        await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        # By default, questions are new (no stats yet)
        response = await client.get(
            f"/api/v1/culture/decks/{deck.id}/questions?include_new=false",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Should have 0 questions since all are new and include_new=false
        assert data["total_new"] == 0
        assert len(data["questions"]) == 0

    @pytest.mark.asyncio
    async def test_question_queue_new_questions_limit(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that new_questions_limit parameter works."""
        deck = await CultureDeckFactory.create(session=db_session)
        # Create 10 new questions
        for i in range(10):
            await CultureQuestionFactory.create(session=db_session, deck_id=deck.id, order_index=i)
        await db_session.commit()

        response = await client.get(
            f"/api/v1/culture/decks/{deck.id}/questions?include_new=true&new_questions_limit=2",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Should have at most 2 new questions
        new_questions = [q for q in data["questions"] if q["is_new"]]
        assert len(new_questions) <= 2

    @pytest.mark.asyncio
    async def test_question_queue_multilingual_content(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that questions include multilingual content."""
        deck = await CultureDeckFactory.create(session=db_session)
        await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.get(
            f"/api/v1/culture/decks/{deck.id}/questions",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Deck name should be multilingual
        assert "el" in data["deck_name"]
        assert "en" in data["deck_name"]
        assert "ru" in data["deck_name"]

        # Question text and options should be multilingual
        question = data["questions"][0]
        assert "el" in question["question_text"]
        assert "en" in question["question_text"]
        assert "ru" in question["question_text"]


# =============================================================================
# TestCultureAnswerSubmission - POST /api/v1/culture/questions/{question_id}/answer
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureAnswerSubmission(E2ETestCase):
    """E2E tests for POST /api/v1/culture/questions/{question_id}/answer endpoint."""

    @pytest.mark.asyncio
    async def test_submit_answer_requires_auth(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Test that answer submission requires authentication."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 1, "time_taken": 10, "language": "en"},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_submit_correct_answer(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test submitting a correct answer."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
            correct_option=3,  # Option C is correct
        )
        await db_session.commit()

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 3, "time_taken": 10, "language": "en"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_correct"] is True
        assert data["correct_option"] == 3

    @pytest.mark.asyncio
    async def test_submit_wrong_answer(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test submitting a wrong answer."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
            correct_option=3,  # Option C is correct
        )
        await db_session.commit()

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 1, "time_taken": 10, "language": "en"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_correct"] is False
        assert data["correct_option"] == 3  # Reveals correct answer

    @pytest.mark.asyncio
    async def test_submit_answer_response_structure(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that answer response has correct structure."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 1, "time_taken": 10, "language": "en"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Required fields
        required_fields = [
            "is_correct",
            "correct_option",
            "xp_earned",
            "sm2_result",
            "message",
            "daily_goal_completed",
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"

        # SM2 result structure
        sm2_fields = [
            "success",
            "question_id",
            "previous_status",
            "new_status",
            "easiness_factor",
            "interval",
            "repetitions",
            "next_review_date",
        ]
        for field in sm2_fields:
            assert field in data["sm2_result"], f"Missing SM2 field: {field}"

    @pytest.mark.asyncio
    async def test_submit_answer_question_not_found(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
    ) -> None:
        """Test submitting answer for non-existent question returns 404."""
        fake_id = uuid4()
        response = await client.post(
            f"/api/v1/culture/questions/{fake_id}/answer",
            json={"selected_option": 1, "time_taken": 10, "language": "en"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_submit_answer_invalid_option_low(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that option less than 1 returns 422."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 0, "time_taken": 10, "language": "en"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_submit_answer_invalid_option_high(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that option greater than 4 returns 422."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 5, "time_taken": 10, "language": "en"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_submit_answer_invalid_language(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that invalid language returns 422."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 1, "time_taken": 10, "language": "fr"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_submit_answer_missing_fields(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that missing required fields returns 422."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        # Missing selected_option
        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"time_taken": 10, "language": "en"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_submit_answer_xp_earned(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that XP is earned on correct answer."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
            correct_option=2,
        )
        await db_session.commit()

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 2, "time_taken": 10, "language": "en"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_correct"] is True
        # XP should be earned for correct answer
        assert data["xp_earned"] >= 0

    @pytest.mark.asyncio
    async def test_submit_answer_sm2_updates_status(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that SM-2 algorithm updates question status."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
            correct_option=1,
        )
        await db_session.commit()

        # First answer - should transition from new to learning
        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 1, "time_taken": 10, "language": "en"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["sm2_result"]["previous_status"] == "new"
        assert data["sm2_result"]["new_status"] in ["learning", "review"]

    @pytest.mark.asyncio
    async def test_submit_answer_time_taken_boundary(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that time_taken boundary values work."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        # time_taken = 0 should work
        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 1, "time_taken": 0, "language": "en"},
            headers=fresh_user_session.headers,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_submit_answer_time_taken_max(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that time_taken at max boundary (300) works."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 1, "time_taken": 300, "language": "en"},
            headers=fresh_user_session.headers,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_submit_answer_time_taken_over_max(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that time_taken over max (>300) returns 422."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 1, "time_taken": 301, "language": "en"},
            headers=fresh_user_session.headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_submit_answer_greek_language(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test submitting answer with Greek language."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 1, "time_taken": 10, "language": "el"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_submit_answer_russian_language(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test submitting answer with Russian language."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 1, "time_taken": 10, "language": "ru"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200


# =============================================================================
# TestCultureProgress - GET /api/v1/culture/progress
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureProgress(E2ETestCase):
    """E2E tests for GET /api/v1/culture/progress endpoint."""

    @pytest.mark.asyncio
    async def test_progress_requires_auth(
        self,
        client: AsyncClient,
    ) -> None:
        """Test that progress endpoint requires authentication."""
        response = await client.get("/api/v1/culture/progress")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_progress_invalid_token(
        self,
        client: AsyncClient,
    ) -> None:
        """Test that invalid token returns 401."""
        headers = {"Authorization": "Bearer invalid_token"}
        response = await client.get(
            "/api/v1/culture/progress",
            headers=headers,
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_progress_new_user(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
    ) -> None:
        """Test that new user has zero progress."""
        response = await client.get(
            "/api/v1/culture/progress",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # New user should have zero progress
        overall = data["overall"]
        assert overall["total_questions"] == 0
        assert overall["questions_mastered"] == 0
        assert overall["questions_learning"] == 0
        assert overall["questions_new"] == 0
        assert overall["decks_started"] == 0
        assert overall["decks_completed"] == 0

    @pytest.mark.asyncio
    async def test_progress_response_structure(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
    ) -> None:
        """Test that progress response has correct structure."""
        response = await client.get(
            "/api/v1/culture/progress",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Top-level structure
        required_fields = ["overall", "by_category", "recent_sessions"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"

        # Overall structure
        overall_fields = [
            "total_questions",
            "questions_mastered",
            "questions_learning",
            "questions_new",
            "decks_started",
            "decks_completed",
            "accuracy_percentage",
            "total_practice_sessions",
        ]
        for field in overall_fields:
            assert field in data["overall"], f"Missing overall field: {field}"

    @pytest.mark.asyncio
    async def test_progress_with_activity(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test progress updates after answering questions."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
            correct_option=1,
        )
        await db_session.commit()

        # Answer a question
        await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 1, "time_taken": 10, "language": "en"},
            headers=fresh_user_session.headers,
        )

        # Check progress
        response = await client.get(
            "/api/v1/culture/progress",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Should have some progress now
        overall = data["overall"]
        assert overall["decks_started"] >= 0

    @pytest.mark.asyncio
    async def test_progress_by_category(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that progress is tracked by category."""
        # Create decks with different categories
        history_deck = await CultureDeckFactory.create(session=db_session)
        geo_deck = await CultureDeckFactory.create(session=db_session, geography=True)

        h_question = await CultureQuestionFactory.create(
            session=db_session, deck_id=history_deck.id, correct_option=1
        )
        g_question = await CultureQuestionFactory.create(
            session=db_session, deck_id=geo_deck.id, correct_option=1
        )
        await db_session.commit()

        # Answer questions from both categories
        await client.post(
            f"/api/v1/culture/questions/{h_question.id}/answer",
            json={"selected_option": 1, "time_taken": 10, "language": "en"},
            headers=fresh_user_session.headers,
        )
        await client.post(
            f"/api/v1/culture/questions/{g_question.id}/answer",
            json={"selected_option": 1, "time_taken": 10, "language": "en"},
            headers=fresh_user_session.headers,
        )

        # Check progress
        response = await client.get(
            "/api/v1/culture/progress",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # by_category should be a dict
        assert isinstance(data["by_category"], dict)

    @pytest.mark.asyncio
    async def test_progress_accuracy_percentage(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that accuracy percentage is calculated correctly."""
        deck = await CultureDeckFactory.create(session=db_session)
        q1 = await CultureQuestionFactory.create(
            session=db_session, deck_id=deck.id, correct_option=1
        )
        q2 = await CultureQuestionFactory.create(
            session=db_session, deck_id=deck.id, correct_option=2
        )
        await db_session.commit()

        # Answer one correct, one wrong
        await client.post(
            f"/api/v1/culture/questions/{q1.id}/answer",
            json={"selected_option": 1, "time_taken": 10, "language": "en"},
            headers=fresh_user_session.headers,
        )
        await client.post(
            f"/api/v1/culture/questions/{q2.id}/answer",
            json={"selected_option": 1, "time_taken": 10, "language": "en"},  # Wrong!
            headers=fresh_user_session.headers,
        )

        response = await client.get(
            "/api/v1/culture/progress",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Accuracy should be between 0 and 100
        assert 0 <= data["overall"]["accuracy_percentage"] <= 100


# =============================================================================
# TestCultureHTTPMethods - HTTP method handling
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureHTTPMethods(E2ETestCase):
    """E2E tests for HTTP method handling on culture endpoints."""

    @pytest.mark.asyncio
    async def test_decks_post_requires_auth(
        self,
        client: AsyncClient,
    ) -> None:
        """Test that POST to decks requires authentication (returns 401)."""
        response = await client.post("/api/v1/culture/decks")

        # POST is now allowed for superusers (admin CRUD), but requires auth
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_categories_post_not_allowed(
        self,
        client: AsyncClient,
    ) -> None:
        """Test that POST to categories returns 405."""
        response = await client.post("/api/v1/culture/categories")

        assert response.status_code == 405

    @pytest.mark.asyncio
    async def test_progress_post_not_allowed(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
    ) -> None:
        """Test that POST to progress returns 405."""
        response = await client.post(
            "/api/v1/culture/progress",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 405

    @pytest.mark.asyncio
    async def test_questions_get_not_allowed(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
    ) -> None:
        """Test that GET to questions/{id}/answer returns 405."""
        fake_id = uuid4()
        response = await client.get(
            f"/api/v1/culture/questions/{fake_id}/answer",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 405


# =============================================================================
# TestCultureResponseFormat - Response formatting
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureResponseFormat(E2ETestCase):
    """E2E tests for culture endpoint response formatting."""

    @pytest.mark.asyncio
    async def test_decks_response_is_json(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Test that decks response is JSON formatted."""
        response = await client.get("/api/v1/culture/decks", headers=auth_headers)

        assert response.status_code == 200
        assert "application/json" in response.headers.get("content-type", "")
        data = response.json()
        assert isinstance(data, dict)

    @pytest.mark.asyncio
    async def test_categories_response_is_json(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Test that categories response is JSON formatted."""
        response = await client.get("/api/v1/culture/categories", headers=auth_headers)

        assert response.status_code == 200
        assert "application/json" in response.headers.get("content-type", "")
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_progress_response_is_json(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
    ) -> None:
        """Test that progress response is JSON formatted."""
        response = await client.get(
            "/api/v1/culture/progress",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        assert "application/json" in response.headers.get("content-type", "")
        data = response.json()
        assert isinstance(data, dict)

    @pytest.mark.asyncio
    async def test_answer_response_is_json(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that answer response is JSON formatted."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": 1, "time_taken": 10, "language": "en"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        assert "application/json" in response.headers.get("content-type", "")
        data = response.json()
        assert isinstance(data, dict)
