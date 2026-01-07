"""Integration tests for Culture CRUD API endpoints.

This module contains integration tests for culture deck and question CRUD operations:
- POST /api/v1/culture/decks - Create deck
- PATCH /api/v1/culture/decks/{deck_id} - Update deck
- DELETE /api/v1/culture/decks/{deck_id} - Soft delete deck
- POST /api/v1/culture/questions - Create single question
- POST /api/v1/culture/questions/bulk - Bulk create questions
- PATCH /api/v1/culture/questions/{question_id} - Update question
- DELETE /api/v1/culture/questions/{question_id} - Delete question
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.db.models import CultureDeck, CultureQuestion

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def valid_multilingual_text():
    """Return valid multilingual text for all required languages."""
    return {"el": "Greek text", "en": "English text", "ru": "Russian text"}


@pytest.fixture
def valid_culture_deck_data():
    """Return valid culture deck creation data."""
    return {
        "name": "Test Deck",
        "description": "Test description",
        "icon": "book-open",
        "color_accent": "#4F46E5",
        "category": "history",
        "order_index": 0,
    }


@pytest.fixture
def valid_culture_question_data(valid_multilingual_text):
    """Return valid culture question creation data (without deck_id)."""
    return {
        "question_text": valid_multilingual_text,
        "option_a": {"el": "Option A el", "en": "Option A en", "ru": "Option A ru"},
        "option_b": {"el": "Option B el", "en": "Option B en", "ru": "Option B ru"},
        "option_c": {"el": "Option C el", "en": "Option C en", "ru": "Option C ru"},
        "option_d": {"el": "Option D el", "en": "Option D en", "ru": "Option D ru"},
        "correct_option": 2,
        "order_index": 0,
    }


@pytest.fixture
async def culture_deck_for_tests(db_session):
    """Create a culture deck for testing question operations."""
    deck = CultureDeck(
        id=uuid4(),
        name="Test Deck",
        description="Test description",
        icon="test-icon",
        color_accent="#FF0000",
        category="history",
        is_active=True,
        order_index=0,
    )
    db_session.add(deck)
    await db_session.commit()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def culture_question_for_tests(db_session, culture_deck_for_tests):
    """Create a culture question for testing update/delete operations."""
    question = CultureQuestion(
        id=uuid4(),
        deck_id=culture_deck_for_tests.id,
        question_text={"el": "Q", "en": "Question?", "ru": "Q"},
        option_a={"el": "A", "en": "A", "ru": "A"},
        option_b={"el": "B", "en": "B", "ru": "B"},
        option_c={"el": "C", "en": "C", "ru": "C"},
        option_d={"el": "D", "en": "D", "ru": "D"},
        correct_option=1,
        order_index=0,
    )
    db_session.add(question)
    await db_session.commit()
    await db_session.refresh(question)
    return question


# ============================================================================
# Culture Deck CRUD Tests
# ============================================================================


class TestCreateCultureDeck:
    """Tests for POST /api/v1/culture/decks."""

    @pytest.mark.asyncio
    async def test_create_deck_success(
        self, client: AsyncClient, superuser_auth_headers: dict, valid_culture_deck_data
    ):
        """Test superuser can create a culture deck successfully."""
        response = await client.post(
            "/api/v1/culture/decks",
            json=valid_culture_deck_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["category"] == "history"
        assert data["icon"] == "book-open"
        assert data["color_accent"] == "#4F46E5"
        assert data["is_active"] is True
        assert data["question_count"] == 0
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_create_deck_unauthorized_returns_401(
        self, client: AsyncClient, valid_culture_deck_data
    ):
        """Test unauthenticated request returns 401."""
        response = await client.post("/api/v1/culture/decks", json=valid_culture_deck_data)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_deck_non_superuser_returns_403(
        self, client: AsyncClient, auth_headers: dict, valid_culture_deck_data
    ):
        """Test regular user (non-superuser) returns 403."""
        response = await client.post(
            "/api/v1/culture/decks",
            json=valid_culture_deck_data,
            headers=auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_create_deck_invalid_color_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, valid_culture_deck_data
    ):
        """Test invalid color_accent format returns 422."""
        invalid_data = {**valid_culture_deck_data, "color_accent": "not-a-hex"}
        response = await client.post(
            "/api/v1/culture/decks",
            json=invalid_data,
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_deck_empty_name_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, valid_culture_deck_data
    ):
        """Test empty name returns 422."""
        invalid_data = {**valid_culture_deck_data}
        invalid_data["name"] = ""  # Empty string
        response = await client.post(
            "/api/v1/culture/decks",
            json=invalid_data,
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422


class TestUpdateCultureDeck:
    """Tests for PATCH /api/v1/culture/decks/{deck_id}."""

    @pytest.mark.asyncio
    async def test_update_deck_success(
        self, client: AsyncClient, superuser_auth_headers: dict, culture_deck_for_tests
    ):
        """Test superuser can update a culture deck."""
        update_data = {"category": "geography", "icon": "map"}

        response = await client.patch(
            f"/api/v1/culture/decks/{culture_deck_for_tests.id}",
            json=update_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "geography"
        assert data["icon"] == "map"
        # Unchanged fields should remain
        assert data["color_accent"] == "#FF0000"

    @pytest.mark.asyncio
    async def test_update_deck_not_found_returns_404(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test updating non-existent deck returns 404."""
        non_existent_id = uuid4()
        response = await client.patch(
            f"/api/v1/culture/decks/{non_existent_id}",
            json={"category": "politics"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_deck_unauthorized_returns_401(
        self, client: AsyncClient, culture_deck_for_tests
    ):
        """Test unauthenticated request returns 401."""
        response = await client.patch(
            f"/api/v1/culture/decks/{culture_deck_for_tests.id}",
            json={"category": "politics"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_update_deck_non_superuser_returns_403(
        self, client: AsyncClient, auth_headers: dict, culture_deck_for_tests
    ):
        """Test regular user returns 403."""
        response = await client.patch(
            f"/api/v1/culture/decks/{culture_deck_for_tests.id}",
            json={"category": "politics"},
            headers=auth_headers,
        )
        assert response.status_code == 403


class TestDeleteCultureDeck:
    """Tests for DELETE /api/v1/culture/decks/{deck_id}."""

    @pytest.mark.asyncio
    async def test_delete_deck_success(
        self, client: AsyncClient, superuser_auth_headers: dict, culture_deck_for_tests
    ):
        """Test superuser can soft delete a culture deck."""
        response = await client.delete(
            f"/api/v1/culture/decks/{culture_deck_for_tests.id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 204

        # Verify deck is now inactive (not visible in list)
        list_response = await client.get(
            "/api/v1/culture/decks",
            headers=superuser_auth_headers,
        )
        deck_ids = [d["id"] for d in list_response.json()["decks"]]
        assert str(culture_deck_for_tests.id) not in deck_ids

    @pytest.mark.asyncio
    async def test_delete_deck_not_found_returns_404(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test deleting non-existent deck returns 404."""
        non_existent_id = uuid4()
        response = await client.delete(
            f"/api/v1/culture/decks/{non_existent_id}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_deck_unauthorized_returns_401(
        self, client: AsyncClient, culture_deck_for_tests
    ):
        """Test unauthenticated request returns 401."""
        response = await client.delete(f"/api/v1/culture/decks/{culture_deck_for_tests.id}")
        assert response.status_code == 401


# ============================================================================
# Culture Question CRUD Tests
# ============================================================================


class TestCreateCultureQuestion:
    """Tests for POST /api/v1/culture/questions."""

    @pytest.mark.asyncio
    async def test_create_question_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        culture_deck_for_tests,
        valid_culture_question_data,
    ):
        """Test superuser can create a culture question."""
        question_data = {**valid_culture_question_data, "deck_id": str(culture_deck_for_tests.id)}

        response = await client.post(
            "/api/v1/culture/questions",
            json=question_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["deck_id"] == str(culture_deck_for_tests.id)
        assert data["correct_option"] == 2
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_create_question_invalid_deck_returns_404(
        self, client: AsyncClient, superuser_auth_headers: dict, valid_culture_question_data
    ):
        """Test creating question with non-existent deck returns 404."""
        question_data = {**valid_culture_question_data, "deck_id": str(uuid4())}

        response = await client.post(
            "/api/v1/culture/questions",
            json=question_data,
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_question_invalid_correct_option_returns_422(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        culture_deck_for_tests,
        valid_culture_question_data,
    ):
        """Test correct_option outside 1-4 range returns 422."""
        question_data = {
            **valid_culture_question_data,
            "deck_id": str(culture_deck_for_tests.id),
            "correct_option": 5,  # Invalid
        }

        response = await client.post(
            "/api/v1/culture/questions",
            json=question_data,
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_question_unauthorized_returns_401(
        self, client: AsyncClient, culture_deck_for_tests, valid_culture_question_data
    ):
        """Test unauthenticated request returns 401."""
        question_data = {**valid_culture_question_data, "deck_id": str(culture_deck_for_tests.id)}
        response = await client.post("/api/v1/culture/questions", json=question_data)
        assert response.status_code == 401


class TestBulkCreateCultureQuestions:
    """Tests for POST /api/v1/culture/questions/bulk."""

    @pytest.mark.asyncio
    async def test_bulk_create_questions_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        culture_deck_for_tests,
        valid_culture_question_data,
    ):
        """Test superuser can bulk create questions."""
        request_data = {
            "deck_id": str(culture_deck_for_tests.id),
            "questions": [
                valid_culture_question_data,
                {**valid_culture_question_data, "correct_option": 3, "order_index": 1},
            ],
        }

        response = await client.post(
            "/api/v1/culture/questions/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["deck_id"] == str(culture_deck_for_tests.id)
        assert data["created_count"] == 2
        assert len(data["questions"]) == 2

    @pytest.mark.asyncio
    async def test_bulk_create_over_limit_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, culture_deck_for_tests
    ):
        """Test 101 questions exceeds limit and returns 422."""
        base_question = {
            "question_text": {"el": "Q", "en": "Question?", "ru": "Q"},
            "option_a": {"el": "A", "en": "A", "ru": "A"},
            "option_b": {"el": "B", "en": "B", "ru": "B"},
            "option_c": {"el": "C", "en": "C", "ru": "C"},
            "option_d": {"el": "D", "en": "D", "ru": "D"},
            "correct_option": 1,
            "order_index": 0,
        }

        request_data = {
            "deck_id": str(culture_deck_for_tests.id),
            "questions": [{**base_question, "order_index": i} for i in range(101)],
        }

        response = await client.post(
            "/api/v1/culture/questions/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_bulk_create_empty_array_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, culture_deck_for_tests
    ):
        """Test empty questions array returns 422."""
        request_data = {
            "deck_id": str(culture_deck_for_tests.id),
            "questions": [],
        }

        response = await client.post(
            "/api/v1/culture/questions/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_bulk_create_invalid_deck_returns_404(
        self, client: AsyncClient, superuser_auth_headers: dict, valid_culture_question_data
    ):
        """Test bulk create with non-existent deck returns 404."""
        request_data = {
            "deck_id": str(uuid4()),
            "questions": [valid_culture_question_data],
        }

        response = await client.post(
            "/api/v1/culture/questions/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404


class TestUpdateCultureQuestion:
    """Tests for PATCH /api/v1/culture/questions/{question_id}."""

    @pytest.mark.asyncio
    async def test_update_question_success(
        self, client: AsyncClient, superuser_auth_headers: dict, culture_question_for_tests
    ):
        """Test superuser can update a culture question."""
        update_data = {"correct_option": 4}

        response = await client.patch(
            f"/api/v1/culture/questions/{culture_question_for_tests.id}",
            json=update_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["correct_option"] == 4

    @pytest.mark.asyncio
    async def test_update_question_not_found_returns_404(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test updating non-existent question returns 404."""
        response = await client.patch(
            f"/api/v1/culture/questions/{uuid4()}",
            json={"correct_option": 3},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_question_invalid_correct_option_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, culture_question_for_tests
    ):
        """Test invalid correct_option returns 422."""
        response = await client.patch(
            f"/api/v1/culture/questions/{culture_question_for_tests.id}",
            json={"correct_option": 0},  # Invalid - must be 1-4
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_question_unauthorized_returns_401(
        self, client: AsyncClient, culture_question_for_tests
    ):
        """Test unauthenticated request returns 401."""
        response = await client.patch(
            f"/api/v1/culture/questions/{culture_question_for_tests.id}",
            json={"correct_option": 3},
        )
        assert response.status_code == 401


class TestDeleteCultureQuestion:
    """Tests for DELETE /api/v1/culture/questions/{question_id}."""

    @pytest.mark.asyncio
    async def test_delete_question_success(
        self, client: AsyncClient, superuser_auth_headers: dict, culture_question_for_tests
    ):
        """Test superuser can delete a culture question (hard delete)."""
        response = await client.delete(
            f"/api/v1/culture/questions/{culture_question_for_tests.id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_question_not_found_returns_404(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test deleting non-existent question returns 404."""
        response = await client.delete(
            f"/api/v1/culture/questions/{uuid4()}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_question_unauthorized_returns_401(
        self, client: AsyncClient, culture_question_for_tests
    ):
        """Test unauthenticated request returns 401."""
        response = await client.delete(f"/api/v1/culture/questions/{culture_question_for_tests.id}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_question_non_superuser_returns_403(
        self, client: AsyncClient, auth_headers: dict, culture_question_for_tests
    ):
        """Test regular user returns 403."""
        response = await client.delete(
            f"/api/v1/culture/questions/{culture_question_for_tests.id}",
            headers=auth_headers,
        )
        assert response.status_code == 403
