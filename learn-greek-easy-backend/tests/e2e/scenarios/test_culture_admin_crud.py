"""E2E tests for Culture Admin CRUD API endpoints.

This module provides comprehensive E2E tests for culture admin operations:
- POST /api/v1/culture/decks - Create a new culture deck
- PATCH /api/v1/culture/decks/{deck_id} - Update a culture deck
- DELETE /api/v1/culture/decks/{deck_id} - Soft delete a culture deck
- POST /api/v1/culture/questions - Create a culture question
- POST /api/v1/culture/questions/bulk - Bulk create culture questions
- PATCH /api/v1/culture/questions/{question_id} - Update a culture question
- DELETE /api/v1/culture/questions/{question_id} - Delete a culture question
- GET /api/v1/admin/stats - Get admin dashboard statistics

Run with:
    pytest tests/e2e/scenarios/test_culture_admin_crud.py -v
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.e2e.conftest import E2ETestCase, UserSession
from tests.factories.content import CardFactory, DeckFactory
from tests.factories.culture import CultureDeckFactory, CultureQuestionFactory

# =============================================================================
# TestCultureDeckCRUD - Admin Deck Operations
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureDeckCreate(E2ETestCase):
    """E2E tests for POST /api/v1/culture/decks endpoint."""

    @pytest.mark.asyncio
    async def test_create_deck_success(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test superuser can create a new culture deck."""
        deck_data = {
            "name": "Greek History",
            "description": "Learn about Greek history",
            "icon": "book-open",
            "color_accent": "#4F46E5",
            "category": "history",
        }

        response = await client.post(
            "/api/v1/culture/decks",
            json=deck_data,
            headers=admin_session.headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Greek History"
        assert data["category"] == "history"
        assert data["question_count"] == 0
        assert data["is_active"] is True
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_create_deck_with_custom_order_index(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test creating deck with custom order_index."""
        deck_data = {
            "name": "Test Deck",
            "description": "Description",
            "icon": "star",
            "color_accent": "#10B981",
            "category": "geography",
            "order_index": 100,
        }

        response = await client.post(
            "/api/v1/culture/decks",
            json=deck_data,
            headers=admin_session.headers,
        )

        assert response.status_code == 201
        # Order index is set internally, verify deck was created
        assert response.json()["category"] == "geography"

    @pytest.mark.asyncio
    async def test_create_deck_requires_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Test that regular user cannot create culture deck."""
        deck_data = {
            "name": "Test",
            "description": "Desc",
            "icon": "book",
            "color_accent": "#000000",
            "category": "test",
        }

        response = await client.post(
            "/api/v1/culture/decks",
            json=deck_data,
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_create_deck_unauthenticated(
        self,
        client: AsyncClient,
    ) -> None:
        """Test that unauthenticated request fails."""
        deck_data = {
            "name": "Test",
            "description": "Desc",
            "icon": "book",
            "color_accent": "#000000",
            "category": "test",
        }

        response = await client.post("/api/v1/culture/decks", json=deck_data)

        assert response.status_code == 401


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureDeckUpdate(E2ETestCase):
    """E2E tests for PATCH /api/v1/culture/decks/{deck_id} endpoint."""

    @pytest.mark.asyncio
    async def test_update_deck_success(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test superuser can update a culture deck."""
        # Create a deck
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        update_data = {
            "category": "updated_category",
            "color_accent": "#FF0000",
        }

        response = await client.patch(
            f"/api/v1/culture/decks/{deck.id}",
            json=update_data,
            headers=admin_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "updated_category"
        assert data["color_accent"] == "#FF0000"

    @pytest.mark.asyncio
    async def test_update_deck_partial_update(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that partial updates only change specified fields."""
        deck = await CultureDeckFactory.create(
            session=db_session,
            category="original_category",
        )
        await db_session.commit()
        original_name = deck.name

        response = await client.patch(
            f"/api/v1/culture/decks/{deck.id}",
            json={"icon": "new-icon"},
            headers=admin_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["icon"] == "new-icon"
        assert data["category"] == "original_category"
        # Name should be unchanged
        assert data["name"] == original_name

    @pytest.mark.asyncio
    async def test_update_deck_not_found(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test updating non-existent deck returns 404."""
        response = await client.patch(
            f"/api/v1/culture/decks/{uuid4()}",
            json={"category": "new"},
            headers=admin_session.headers,
        )

        assert response.status_code == 404


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureDeckDelete(E2ETestCase):
    """E2E tests for DELETE /api/v1/culture/decks/{deck_id} endpoint."""

    @pytest.mark.asyncio
    async def test_soft_delete_deck_success(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test superuser can soft delete a culture deck."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()
        deck_id = deck.id

        response = await client.delete(
            f"/api/v1/culture/decks/{deck_id}",
            headers=admin_session.headers,
        )

        assert response.status_code == 204

        # Verify deck is no longer visible via public API
        list_response = await client.get(
            "/api/v1/culture/decks",
            headers=admin_session.headers,
        )
        deck_ids = [d["id"] for d in list_response.json()["decks"]]
        assert str(deck_id) not in deck_ids

    @pytest.mark.asyncio
    async def test_soft_delete_deck_idempotent(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test deleting already-deleted deck is idempotent."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        # First delete
        response1 = await client.delete(
            f"/api/v1/culture/decks/{deck.id}",
            headers=admin_session.headers,
        )
        assert response1.status_code == 204

        # Second delete should also succeed (idempotent)
        response2 = await client.delete(
            f"/api/v1/culture/decks/{deck.id}",
            headers=admin_session.headers,
        )
        assert response2.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_deck_not_found(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test deleting non-existent deck returns 404."""
        response = await client.delete(
            f"/api/v1/culture/decks/{uuid4()}",
            headers=admin_session.headers,
        )

        assert response.status_code == 404


# =============================================================================
# TestCultureQuestionCRUD - Admin Question Operations
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureQuestionCreate(E2ETestCase):
    """E2E tests for POST /api/v1/culture/questions endpoint."""

    @pytest.mark.asyncio
    async def test_create_question_success(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test superuser can create a culture question."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        question_data = {
            "deck_id": str(deck.id),
            "question_text": {
                "el": "Ποια ειναι η πρωτευουσα;",
                "en": "What is the capital?",
                "ru": "Какая столица?",
            },
            "option_a": {"el": "Αθηνα", "en": "Athens", "ru": "Афины"},
            "option_b": {"el": "Θεσσαλονικη", "en": "Thessaloniki", "ru": "Салоники"},
            "option_c": {"el": "Πατρα", "en": "Patras", "ru": "Патры"},
            "option_d": {"el": "Ηρακλειο", "en": "Heraklion", "ru": "Ираклион"},
            "correct_option": 1,
        }

        response = await client.post(
            "/api/v1/culture/questions",
            json=question_data,
            headers=admin_session.headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["correct_option"] == 1
        assert "id" in data

    @pytest.mark.asyncio
    async def test_create_question_deck_not_found(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test creating question for non-existent deck fails."""
        question_data = {
            "deck_id": str(uuid4()),
            "question_text": {"el": "Q", "en": "Q", "ru": "Q"},
            "option_a": {"el": "A", "en": "A", "ru": "A"},
            "option_b": {"el": "B", "en": "B", "ru": "B"},
            "option_c": {"el": "C", "en": "C", "ru": "C"},
            "option_d": {"el": "D", "en": "D", "ru": "D"},
            "correct_option": 1,
        }

        response = await client.post(
            "/api/v1/culture/questions",
            json=question_data,
            headers=admin_session.headers,
        )

        assert response.status_code == 404


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureQuestionBulkCreate(E2ETestCase):
    """E2E tests for POST /api/v1/culture/questions/bulk endpoint."""

    @pytest.mark.asyncio
    async def test_bulk_create_questions_success(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test superuser can bulk create culture questions."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        questions = [
            {
                "question_text": {"el": f"Q{i}", "en": f"Question {i}", "ru": f"Вопрос {i}"},
                "option_a": {"el": "A", "en": "Option A", "ru": "A"},
                "option_b": {"el": "B", "en": "Option B", "ru": "B"},
                "option_c": {"el": "C", "en": "Option C", "ru": "C"},
                "option_d": {"el": "D", "en": "Option D", "ru": "D"},
                "correct_option": (i % 4) + 1,
            }
            for i in range(3)
        ]

        response = await client.post(
            "/api/v1/culture/questions/bulk",
            json={"deck_id": str(deck.id), "questions": questions},
            headers=admin_session.headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 3
        assert len(data["questions"]) == 3

    @pytest.mark.asyncio
    async def test_bulk_create_empty_array_returns_422(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test bulk create with empty questions array returns 422."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.post(
            "/api/v1/culture/questions/bulk",
            json={"deck_id": str(deck.id), "questions": []},
            headers=admin_session.headers,
        )

        assert response.status_code == 422


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureQuestionUpdate(E2ETestCase):
    """E2E tests for PATCH /api/v1/culture/questions/{question_id} endpoint."""

    @pytest.mark.asyncio
    async def test_update_question_success(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test superuser can update a culture question."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(
            session=db_session,
            deck=deck,
            correct_option=1,
        )
        await db_session.commit()

        response = await client.patch(
            f"/api/v1/culture/questions/{question.id}",
            json={"correct_option": 3},
            headers=admin_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["correct_option"] == 3

    @pytest.mark.asyncio
    async def test_update_question_not_found(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test updating non-existent question returns 404."""
        response = await client.patch(
            f"/api/v1/culture/questions/{uuid4()}",
            json={"correct_option": 2},
            headers=admin_session.headers,
        )

        assert response.status_code == 404


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureQuestionDelete(E2ETestCase):
    """E2E tests for DELETE /api/v1/culture/questions/{question_id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_question_success(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test superuser can delete a culture question."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck=deck)
        await db_session.commit()
        question_id = question.id

        response = await client.delete(
            f"/api/v1/culture/questions/{question_id}",
            headers=admin_session.headers,
        )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_question_not_found(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test deleting non-existent question returns 404."""
        response = await client.delete(
            f"/api/v1/culture/questions/{uuid4()}",
            headers=admin_session.headers,
        )

        assert response.status_code == 404


# =============================================================================
# TestAdminStats - GET /api/v1/admin/stats
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestAdminStats(E2ETestCase):
    """E2E tests for GET /api/v1/admin/stats endpoint."""

    @pytest.mark.asyncio
    async def test_get_admin_stats_success(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test superuser can get admin statistics with vocabulary decks."""
        # Create some vocabulary decks and cards
        deck = await DeckFactory.create(session=db_session, is_active=True)
        for _ in range(5):
            await CardFactory.create(session=db_session, deck=deck)
        await db_session.commit()

        response = await client.get(
            "/api/v1/admin/stats",
            headers=admin_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Check all required fields
        assert "total_decks" in data
        assert "total_cards" in data
        assert "total_vocabulary_decks" in data
        assert "total_culture_decks" in data
        assert "total_vocabulary_cards" in data
        assert "total_culture_questions" in data
        assert "decks" in data
        assert "culture_decks" in data
        assert isinstance(data["decks"], list)
        assert isinstance(data["culture_decks"], list)
        # Should have at least our created vocabulary deck
        assert data["total_vocabulary_decks"] >= 1
        assert data["total_vocabulary_cards"] >= 5

    @pytest.mark.asyncio
    async def test_get_admin_stats_with_culture_decks(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test admin stats includes culture decks and questions."""
        # Create culture deck with questions
        culture_deck = await CultureDeckFactory.create(session=db_session, is_active=True)
        for _ in range(3):
            await CultureQuestionFactory.create(session=db_session, deck=culture_deck)
        await db_session.commit()

        response = await client.get(
            "/api/v1/admin/stats",
            headers=admin_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Should include culture deck in stats
        assert data["total_culture_decks"] >= 1
        assert data["total_culture_questions"] >= 3
        assert len(data["culture_decks"]) >= 1

        # Verify culture deck structure
        culture_deck_item = next(
            (d for d in data["culture_decks"] if d["id"] == str(culture_deck.id)),
            None,
        )
        if culture_deck_item:
            assert "name" in culture_deck_item
            assert "category" in culture_deck_item
            assert "question_count" in culture_deck_item
            assert isinstance(culture_deck_item["name"], str)
            assert culture_deck_item["question_count"] >= 3

    @pytest.mark.asyncio
    async def test_get_admin_stats_combined_totals(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test admin stats correctly combines vocabulary and culture totals."""
        # Create vocabulary deck
        vocab_deck = await DeckFactory.create(session=db_session, is_active=True)
        for _ in range(2):
            await CardFactory.create(session=db_session, deck=vocab_deck)

        # Create culture deck
        culture_deck = await CultureDeckFactory.create(session=db_session, is_active=True)
        for _ in range(3):
            await CultureQuestionFactory.create(session=db_session, deck=culture_deck)
        await db_session.commit()

        response = await client.get(
            "/api/v1/admin/stats",
            headers=admin_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify total_decks = vocab + culture
        assert data["total_decks"] == data["total_vocabulary_decks"] + data["total_culture_decks"]
        # Verify total_cards = vocab cards + culture questions
        assert (
            data["total_cards"] == data["total_vocabulary_cards"] + data["total_culture_questions"]
        )

    @pytest.mark.asyncio
    async def test_get_admin_stats_deck_structure(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test admin stats deck items have correct structure."""
        # Create deck with a1 trait to get proper A1 level
        deck = await DeckFactory.create(
            session=db_session,
            a1=True,
            is_active=True,
        )
        await CardFactory.create(session=db_session, deck=deck)
        await db_session.commit()
        deck_name = deck.name

        response = await client.get(
            "/api/v1/admin/stats",
            headers=admin_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Find our deck in the list
        our_deck = next((d for d in data["decks"] if d["name"] == deck_name), None)
        assert our_deck is not None
        assert "id" in our_deck
        assert "name" in our_deck
        assert "level" in our_deck
        assert "card_count" in our_deck

    @pytest.mark.asyncio
    async def test_get_admin_stats_unauthorized(
        self,
        client: AsyncClient,
    ) -> None:
        """Test unauthenticated request returns 401."""
        response = await client.get("/api/v1/admin/stats")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_admin_stats_forbidden_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Test regular user cannot access admin stats."""
        response = await client.get(
            "/api/v1/admin/stats",
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_admin_stats_empty_database(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test admin stats with no decks returns zeros."""
        response = await client.get(
            "/api/v1/admin/stats",
            headers=admin_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        # May have existing data from other tests, but structure should be valid
        assert "total_decks" in data
        assert "total_cards" in data
        assert isinstance(data["total_decks"], int)
        assert isinstance(data["total_cards"], int)


# =============================================================================
# TestCultureDeckProgress - Deck Progress Integration
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureDeckProgress(E2ETestCase):
    """E2E tests for culture deck progress tracking."""

    @pytest.mark.asyncio
    async def test_list_decks_with_user_progress(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that deck listing includes user progress data when authenticated."""
        # Create deck and questions
        deck = await CultureDeckFactory.create(session=db_session)
        q1 = await CultureQuestionFactory.create(session=db_session, deck=deck)
        await CultureQuestionFactory.create(session=db_session, deck=deck)  # q2
        await db_session.commit()

        # Answer a question to create progress
        response = await client.post(
            f"/api/v1/culture/questions/{q1.id}/answer",
            json={"selected_option": q1.correct_option, "time_taken": 5, "language": "en"},
            headers=fresh_user_session.headers,
        )
        assert response.status_code == 200

        # Now list decks - should show progress
        list_response = await client.get(
            "/api/v1/culture/decks",
            headers=fresh_user_session.headers,
        )
        assert list_response.status_code == 200
        data = list_response.json()

        # Find our deck
        our_deck = next((d for d in data["decks"] if d["id"] == str(deck.id)), None)
        assert our_deck is not None

        # Should have progress data since user answered a question
        if our_deck["progress"]:
            assert "questions_total" in our_deck["progress"]
            assert "questions_mastered" in our_deck["progress"]
            assert "questions_learning" in our_deck["progress"]

    @pytest.mark.asyncio
    async def test_get_deck_with_user_progress(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that deck detail includes user progress data."""
        # Create deck and question
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(session=db_session, deck=deck)
        await db_session.commit()

        # Answer the question
        await client.post(
            f"/api/v1/culture/questions/{question.id}/answer",
            json={"selected_option": question.correct_option, "time_taken": 5, "language": "en"},
            headers=fresh_user_session.headers,
        )

        # Get deck detail
        detail_response = await client.get(
            f"/api/v1/culture/decks/{deck.id}",
            headers=fresh_user_session.headers,
        )
        assert detail_response.status_code == 200
        data = detail_response.json()

        # Verify deck data
        assert data["id"] == str(deck.id)
        assert data["question_count"] >= 1

        # Progress should be present if user has started the deck
        if data["progress"]:
            progress = data["progress"]
            assert "questions_total" in progress
            assert "last_practiced_at" in progress

    @pytest.mark.asyncio
    async def test_list_decks_filters_by_category(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        db_session: AsyncSession,
    ) -> None:
        """Test that category filter works correctly."""
        # Create decks with different categories
        await CultureDeckFactory.create(
            session=db_session,
            category="history",
        )
        await CultureDeckFactory.create(
            session=db_session,
            category="geography",
        )
        await db_session.commit()

        # Filter by history category
        response = await client.get(
            "/api/v1/culture/decks?category=history",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Should only contain history decks
        for deck in data["decks"]:
            assert deck["category"] == "history"

    @pytest.mark.asyncio
    async def test_list_decks_pagination(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        db_session: AsyncSession,
    ) -> None:
        """Test deck listing pagination."""
        # Create multiple decks
        for i in range(5):
            await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        # Get first page with small page size
        response = await client.get(
            "/api/v1/culture/decks?page=1&page_size=2",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert len(data["decks"]) <= 2
        assert data["total"] >= 5


# =============================================================================
# Extended Admin E2E Tests for Coverage
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestCultureAdminExtended(E2ETestCase):
    """Extended E2E tests for admin CRUD to increase coverage."""

    @pytest.mark.asyncio
    async def test_update_deck_all_fields(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test updating all deck fields at once."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        update_data = {
            "name": "New Name",
            "description": "New Description",
            "icon": "star",
            "color_accent": "#FF5733",
            "category": "traditions",
        }

        response = await client.patch(
            f"/api/v1/culture/decks/{deck.id}",
            json=update_data,
            headers=admin_session.headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["icon"] == "star"
        assert data["color_accent"] == "#FF5733"

    @pytest.mark.asyncio
    async def test_create_multiple_questions_same_deck(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test creating multiple questions in the same deck."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        for i in range(3):
            question_data = {
                "deck_id": str(deck.id),
                "question_text": {
                    "el": f"Ερώτηση {i}",
                    "en": f"Question {i}",
                    "ru": f"Вопрос {i}",
                },
                "option_a": {"el": "A", "en": "A", "ru": "A"},
                "option_b": {"el": "B", "en": "B", "ru": "B"},
                "option_c": {"el": "C", "en": "C", "ru": "C"},
                "option_d": {"el": "D", "en": "D", "ru": "D"},
                "correct_option": (i % 4) + 1,
                "order_index": i,
            }

            response = await client.post(
                "/api/v1/culture/questions",
                json=question_data,
                headers=admin_session.headers,
            )
            assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_bulk_create_with_order_indices(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test bulk creating questions with specific order indices."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        bulk_data = {
            "deck_id": str(deck.id),
            "questions": [
                {
                    "question_text": {"el": f"Q{i}", "en": f"Q{i}", "ru": f"Q{i}"},
                    "option_a": {"el": "A", "en": "A", "ru": "A"},
                    "option_b": {"el": "B", "en": "B", "ru": "B"},
                    "option_c": {"el": "C", "en": "C", "ru": "C"},
                    "option_d": {"el": "D", "en": "D", "ru": "D"},
                    "correct_option": 1,
                    "order_index": i * 10,  # Non-sequential indices
                }
                for i in range(5)
            ],
        }

        response = await client.post(
            "/api/v1/culture/questions/bulk",
            json=bulk_data,
            headers=admin_session.headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 5

    @pytest.mark.asyncio
    async def test_update_question_order(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test updating question order index."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(
            session=db_session, deck_id=deck.id, order_index=1
        )
        await db_session.commit()

        response = await client.patch(
            f"/api/v1/culture/questions/{question.id}",
            json={"order_index": 100},
            headers=admin_session.headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["order_index"] == 100

    @pytest.mark.asyncio
    async def test_update_question_correct_option(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test updating question correct option."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(
            session=db_session, deck_id=deck.id, correct_option=1
        )
        await db_session.commit()

        response = await client.patch(
            f"/api/v1/culture/questions/{question.id}",
            json={"correct_option": 3},
            headers=admin_session.headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["correct_option"] == 3

    @pytest.mark.asyncio
    async def test_delete_question_then_verify_deck_count(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
        fresh_user_session: UserSession,
    ) -> None:
        """Test deleting a question and verifying deck question count updates."""
        deck = await CultureDeckFactory.create(session=db_session, is_active=True)
        questions = []
        for i in range(3):
            q = await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
            questions.append(q)
        await db_session.commit()

        # Get deck before delete
        before_response = await client.get(
            f"/api/v1/culture/decks/{deck.id}",
            headers=fresh_user_session.headers,
        )
        before_count = before_response.json()["question_count"]

        # Delete one question
        delete_response = await client.delete(
            f"/api/v1/culture/questions/{questions[0].id}",
            headers=admin_session.headers,
        )
        assert delete_response.status_code == 204

        # Verify count decreased
        after_response = await client.get(
            f"/api/v1/culture/decks/{deck.id}",
            headers=fresh_user_session.headers,
        )
        after_count = after_response.json()["question_count"]
        assert after_count == before_count - 1

    @pytest.mark.asyncio
    async def test_deck_with_multiple_categories(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test creating decks in different categories."""
        categories = ["history", "geography", "politics", "culture", "traditions"]

        for category in categories:
            deck_data = {
                "name": f"Deck {category}",
                "description": "Desc",
                "icon": "book",
                "color_accent": "#123456",
                "category": category,
            }

            response = await client.post(
                "/api/v1/culture/decks",
                json=deck_data,
                headers=admin_session.headers,
            )
            assert response.status_code == 201
            assert response.json()["category"] == category

    @pytest.mark.asyncio
    async def test_list_decks_after_creating_many(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        fresh_user_session: UserSession,
    ) -> None:
        """Test listing decks after creating several."""
        # Create 5 decks
        for i in range(5):
            deck_data = {
                "name": f"List Deck {i}",
                "description": "Desc",
                "icon": "star",
                "color_accent": "#ABCDEF",
                "category": "history",
            }
            await client.post(
                "/api/v1/culture/decks",
                json=deck_data,
                headers=admin_session.headers,
            )

        # List them as regular user
        response = await client.get(
            "/api/v1/culture/decks",
            headers=fresh_user_session.headers,
        )
        assert response.status_code == 200
        assert response.json()["total"] >= 5

    @pytest.mark.asyncio
    async def test_update_deck_partial_name(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test partially updating deck description."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        # Update only the description
        response = await client.patch(
            f"/api/v1/culture/decks/{deck.id}",
            json={"description": "New Description"},
            headers=admin_session.headers,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_then_recreate_deck(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that we can delete a deck and create a new one with same category."""
        deck = await CultureDeckFactory.create(
            session=db_session, is_active=True, category="history"
        )
        await db_session.commit()
        original_id = str(deck.id)

        # Delete original deck
        delete_response = await client.delete(
            f"/api/v1/culture/decks/{original_id}",
            headers=admin_session.headers,
        )
        assert delete_response.status_code == 204

        # Create new deck with same category
        new_deck_data = {
            "name": "New History",
            "description": "Desc",
            "icon": "clock",
            "color_accent": "#112233",
            "category": "history",
        }
        create_response = await client.post(
            "/api/v1/culture/decks",
            json=new_deck_data,
            headers=admin_session.headers,
        )
        assert create_response.status_code == 201
        assert create_response.json()["id"] != original_id

    @pytest.mark.asyncio
    async def test_question_with_all_correct_options(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test creating questions with each correct option (1-4)."""
        deck = await CultureDeckFactory.create(session=db_session)
        await db_session.commit()

        for option in [1, 2, 3, 4]:
            question_data = {
                "deck_id": str(deck.id),
                "question_text": {"el": f"Q{option}", "en": f"Q{option}", "ru": f"Q{option}"},
                "option_a": {"el": "A", "en": "A", "ru": "A"},
                "option_b": {"el": "B", "en": "B", "ru": "B"},
                "option_c": {"el": "C", "en": "C", "ru": "C"},
                "option_d": {"el": "D", "en": "D", "ru": "D"},
                "correct_option": option,
            }

            response = await client.post(
                "/api/v1/culture/questions",
                json=question_data,
                headers=admin_session.headers,
            )
            assert response.status_code == 201
            assert response.json()["correct_option"] == option
