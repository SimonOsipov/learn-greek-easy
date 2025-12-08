"""Integration tests for Cards API endpoints.

This module contains integration tests for card router endpoints.
Tests verify endpoint behavior with real database operations.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.db.models import Card, CardDifficulty, Deck, DeckLevel


class TestListCardsIntegration:
    """Integration tests for GET /api/v1/cards endpoint."""

    @pytest.fixture
    async def active_deck(self, db_session):
        """Create an active deck in the database."""
        deck = Deck(
            id=uuid4(),
            name="Test Active Deck",
            description="A test deck for cards API testing",
            level=DeckLevel.A1,
            is_active=True,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)
        return deck

    @pytest.fixture
    async def inactive_deck(self, db_session):
        """Create an inactive deck in the database."""
        deck = Deck(
            id=uuid4(),
            name="Test Inactive Deck",
            description="An inactive test deck",
            level=DeckLevel.A1,
            is_active=False,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)
        return deck

    @pytest.fixture
    async def deck_with_cards(self, db_session, active_deck):
        """Create a deck with multiple cards of different difficulties."""
        cards = []
        difficulties = [
            CardDifficulty.EASY,
            CardDifficulty.EASY,
            CardDifficulty.MEDIUM,
            CardDifficulty.MEDIUM,
            CardDifficulty.HARD,
        ]

        for i, difficulty in enumerate(difficulties):
            card = Card(
                id=uuid4(),
                deck_id=active_deck.id,
                front_text=f"Greek word {i}",
                back_text=f"English translation {i}",
                example_sentence=f"Example sentence {i}",
                pronunciation=f"pronunciation-{i}",
                difficulty=difficulty,
                order_index=i,
            )
            db_session.add(card)
            cards.append(card)

        await db_session.commit()
        for card in cards:
            await db_session.refresh(card)

        return active_deck, cards

    @pytest.mark.asyncio
    async def test_list_cards_success(self, client: AsyncClient, deck_with_cards):
        """Test successful card listing with real database."""
        deck, cards = deck_with_cards

        response = await client.get(f"/api/v1/cards?deck_id={deck.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["page"] == 1
        assert data["page_size"] == 50
        assert str(data["deck_id"]) == str(deck.id)
        assert len(data["cards"]) == 5

        # Verify cards are ordered by order_index
        for i, card_data in enumerate(data["cards"]):
            assert card_data["order_index"] == i
            assert card_data["front_text"] == f"Greek word {i}"

    @pytest.mark.asyncio
    async def test_list_cards_empty_deck(self, client: AsyncClient, active_deck):
        """Test listing cards from empty deck returns empty list."""
        response = await client.get(f"/api/v1/cards?deck_id={active_deck.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["cards"] == []

    @pytest.mark.asyncio
    async def test_list_cards_deck_not_found(self, client: AsyncClient):
        """Test 404 response when deck doesn't exist."""
        non_existent_id = uuid4()
        response = await client.get(f"/api/v1/cards?deck_id={non_existent_id}")

        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == "NOT_FOUND"
        assert str(non_existent_id) in data["error"]["message"]

    @pytest.mark.asyncio
    async def test_list_cards_inactive_deck(self, client: AsyncClient, inactive_deck):
        """Test 404 response for inactive deck."""
        response = await client.get(f"/api/v1/cards?deck_id={inactive_deck.id}")

        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_list_cards_filter_by_difficulty_easy(self, client: AsyncClient, deck_with_cards):
        """Test filtering cards by easy difficulty."""
        deck, cards = deck_with_cards

        response = await client.get(f"/api/v1/cards?deck_id={deck.id}&difficulty=easy")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2  # 2 easy cards
        assert all(card["difficulty"] == "easy" for card in data["cards"])

    @pytest.mark.asyncio
    async def test_list_cards_filter_by_difficulty_medium(
        self, client: AsyncClient, deck_with_cards
    ):
        """Test filtering cards by medium difficulty."""
        deck, cards = deck_with_cards

        response = await client.get(f"/api/v1/cards?deck_id={deck.id}&difficulty=medium")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2  # 2 medium cards
        assert all(card["difficulty"] == "medium" for card in data["cards"])

    @pytest.mark.asyncio
    async def test_list_cards_filter_by_difficulty_hard(self, client: AsyncClient, deck_with_cards):
        """Test filtering cards by hard difficulty."""
        deck, cards = deck_with_cards

        response = await client.get(f"/api/v1/cards?deck_id={deck.id}&difficulty=hard")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1  # 1 hard card
        assert all(card["difficulty"] == "hard" for card in data["cards"])

    @pytest.mark.asyncio
    async def test_list_cards_pagination_first_page(self, client: AsyncClient, deck_with_cards):
        """Test first page of pagination."""
        deck, cards = deck_with_cards

        response = await client.get(f"/api/v1/cards?deck_id={deck.id}&page=1&page_size=2")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5  # Total remains 5
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["cards"]) == 2
        # First page should have cards with order_index 0, 1
        assert data["cards"][0]["order_index"] == 0
        assert data["cards"][1]["order_index"] == 1

    @pytest.mark.asyncio
    async def test_list_cards_pagination_second_page(self, client: AsyncClient, deck_with_cards):
        """Test second page of pagination."""
        deck, cards = deck_with_cards

        response = await client.get(f"/api/v1/cards?deck_id={deck.id}&page=2&page_size=2")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["page"] == 2
        assert data["page_size"] == 2
        assert len(data["cards"]) == 2
        # Second page should have cards with order_index 2, 3
        assert data["cards"][0]["order_index"] == 2
        assert data["cards"][1]["order_index"] == 3

    @pytest.mark.asyncio
    async def test_list_cards_pagination_last_page(self, client: AsyncClient, deck_with_cards):
        """Test last page with partial results."""
        deck, cards = deck_with_cards

        response = await client.get(f"/api/v1/cards?deck_id={deck.id}&page=3&page_size=2")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["page"] == 3
        assert data["page_size"] == 2
        assert len(data["cards"]) == 1  # Only 1 card on last page
        assert data["cards"][0]["order_index"] == 4

    @pytest.mark.asyncio
    async def test_list_cards_pagination_beyond_last_page(
        self, client: AsyncClient, deck_with_cards
    ):
        """Test page beyond available data returns empty list."""
        deck, cards = deck_with_cards

        response = await client.get(f"/api/v1/cards?deck_id={deck.id}&page=10&page_size=2")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["page"] == 10
        assert data["cards"] == []

    @pytest.mark.asyncio
    async def test_list_cards_pagination_with_difficulty_filter(
        self, client: AsyncClient, deck_with_cards
    ):
        """Test pagination combined with difficulty filter."""
        deck, cards = deck_with_cards

        response = await client.get(
            f"/api/v1/cards?deck_id={deck.id}&difficulty=easy&page=1&page_size=1"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2  # Total easy cards
        assert data["page"] == 1
        assert data["page_size"] == 1
        assert len(data["cards"]) == 1
        assert data["cards"][0]["difficulty"] == "easy"

    @pytest.mark.asyncio
    async def test_list_cards_card_response_fields(self, client: AsyncClient, deck_with_cards):
        """Test card response contains all expected fields."""
        deck, cards = deck_with_cards

        response = await client.get(f"/api/v1/cards?deck_id={deck.id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data["cards"]) > 0

        card = data["cards"][0]
        # Verify all CardResponse fields
        assert "id" in card
        assert "deck_id" in card
        assert "front_text" in card
        assert "back_text" in card
        assert "example_sentence" in card
        assert "pronunciation" in card
        assert "difficulty" in card
        assert "order_index" in card
        assert "created_at" in card
        assert "updated_at" in card

    @pytest.mark.asyncio
    async def test_list_cards_max_page_size(self, client: AsyncClient, active_deck):
        """Test that page_size=100 is accepted (max value)."""
        response = await client.get(f"/api/v1/cards?deck_id={active_deck.id}&page_size=100")

        assert response.status_code == 200
        data = response.json()
        assert data["page_size"] == 100


class TestListCardsValidation:
    """Validation tests for GET /api/v1/cards endpoint."""

    @pytest.mark.asyncio
    async def test_missing_deck_id(self, client: AsyncClient):
        """Test 422 response when deck_id is missing."""
        response = await client.get("/api/v1/cards")

        assert response.status_code == 422
        data = response.json()
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_invalid_uuid_format(self, client: AsyncClient):
        """Test 422 response for invalid UUID format."""
        response = await client.get("/api/v1/cards?deck_id=invalid-uuid")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_page_less_than_one(self, client: AsyncClient):
        """Test 422 response when page < 1."""
        deck_id = uuid4()
        response = await client.get(f"/api/v1/cards?deck_id={deck_id}&page=0")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_page_size_less_than_one(self, client: AsyncClient):
        """Test 422 response when page_size < 1."""
        deck_id = uuid4()
        response = await client.get(f"/api/v1/cards?deck_id={deck_id}&page_size=0")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_page_size_greater_than_100(self, client: AsyncClient):
        """Test 422 response when page_size > 100."""
        deck_id = uuid4()
        response = await client.get(f"/api/v1/cards?deck_id={deck_id}&page_size=101")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_difficulty_value(self, client: AsyncClient):
        """Test 422 response for invalid difficulty value."""
        deck_id = uuid4()
        response = await client.get(f"/api/v1/cards?deck_id={deck_id}&difficulty=super_hard")

        assert response.status_code == 422


class TestGetCardEndpoint:
    """Integration tests for GET /api/v1/cards/{card_id} endpoint."""

    @pytest.fixture
    async def active_deck(self, db_session):
        """Create an active deck in the database."""
        deck = Deck(
            id=uuid4(),
            name="Test Active Deck",
            description="A test deck for get card API testing",
            level=DeckLevel.A1,
            is_active=True,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)
        return deck

    @pytest.fixture
    async def inactive_deck(self, db_session):
        """Create an inactive deck in the database."""
        deck = Deck(
            id=uuid4(),
            name="Test Inactive Deck",
            description="An inactive test deck",
            level=DeckLevel.A1,
            is_active=False,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)
        return deck

    @pytest.fixture
    async def card_in_active_deck(self, db_session, active_deck):
        """Create a card in an active deck."""
        card = Card(
            id=uuid4(),
            deck_id=active_deck.id,
            front_text="kalimera",
            back_text="good morning",
            example_sentence="Kalimera! Pos eisai?",
            pronunciation="kah-lee-MEH-rah",
            difficulty=CardDifficulty.EASY,
            order_index=0,
        )
        db_session.add(card)
        await db_session.commit()
        await db_session.refresh(card)
        return card

    @pytest.fixture
    async def card_in_inactive_deck(self, db_session, inactive_deck):
        """Create a card in an inactive deck."""
        card = Card(
            id=uuid4(),
            deck_id=inactive_deck.id,
            front_text="kalinihta",
            back_text="good night",
            example_sentence="Kalinihta! Kali orexi!",
            pronunciation="kah-lee-NEEKH-tah",
            difficulty=CardDifficulty.MEDIUM,
            order_index=0,
        )
        db_session.add(card)
        await db_session.commit()
        await db_session.refresh(card)
        return card

    @pytest.mark.asyncio
    async def test_get_card_success(self, client: AsyncClient, card_in_active_deck):
        """Test successful retrieval of a card by ID."""
        card = card_in_active_deck

        response = await client.get(f"/api/v1/cards/{card.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(card.id)
        assert data["deck_id"] == str(card.deck_id)
        assert data["front_text"] == "kalimera"
        assert data["back_text"] == "good morning"
        assert data["example_sentence"] == "Kalimera! Pos eisai?"
        assert data["pronunciation"] == "kah-lee-MEH-rah"
        assert data["difficulty"] == "easy"
        assert data["order_index"] == 0
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_get_card_not_found(self, client: AsyncClient):
        """Test 404 response when card doesn't exist."""
        non_existent_id = uuid4()

        response = await client.get(f"/api/v1/cards/{non_existent_id}")

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"
        assert str(non_existent_id) in data["error"]["message"]

    @pytest.mark.asyncio
    async def test_get_card_invalid_uuid(self, client: AsyncClient):
        """Test 422 response for invalid UUID format."""
        response = await client.get("/api/v1/cards/not-a-valid-uuid")

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_get_card_includes_all_fields(self, client: AsyncClient, card_in_active_deck):
        """Test that response includes all required CardResponse fields."""
        card = card_in_active_deck

        response = await client.get(f"/api/v1/cards/{card.id}")

        assert response.status_code == 200
        data = response.json()

        # Verify all required CardResponse fields are present
        required_fields = [
            "id",
            "deck_id",
            "front_text",
            "back_text",
            "example_sentence",
            "pronunciation",
            "difficulty",
            "order_index",
            "created_at",
            "updated_at",
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"

    @pytest.mark.asyncio
    async def test_get_card_from_inactive_deck_still_accessible(
        self, client: AsyncClient, card_in_inactive_deck
    ):
        """Test that card from inactive deck is still accessible.

        Unlike the list endpoint which filters by active deck,
        the get single card endpoint returns any card by ID
        regardless of deck active status.
        """
        card = card_in_inactive_deck

        response = await client.get(f"/api/v1/cards/{card.id}")

        # Card should be accessible even if deck is inactive
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(card.id)
        assert data["front_text"] == "kalinihta"
        assert data["difficulty"] == "medium"


class TestCreateCardEndpoint:
    """Integration tests for POST /api/v1/cards endpoint."""

    @pytest.fixture
    async def active_deck_for_create(self, db_session):
        """Create an active deck for card creation tests."""
        deck = Deck(
            id=uuid4(),
            name="Deck for Card Creation",
            description="Test deck for create card endpoint",
            level=DeckLevel.A1,
            is_active=True,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)
        return deck

    @pytest.fixture
    async def inactive_deck_for_create(self, db_session):
        """Create an inactive deck for card creation tests."""
        deck = Deck(
            id=uuid4(),
            name="Inactive Deck for Card Creation",
            description="Inactive test deck",
            level=DeckLevel.A1,
            is_active=False,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)
        return deck

    @pytest.mark.asyncio
    async def test_create_card_success(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_create
    ):
        """Test superuser can create a card successfully."""
        card_data = {
            "deck_id": str(active_deck_for_create.id),
            "front_text": "efharisto",
            "back_text": "thank you",
            "example_sentence": "Efharisto poly!",
            "pronunciation": "efharisto",
            "difficulty": "easy",
            "order_index": 0,
        }

        response = await client.post(
            "/api/v1/cards",
            json=card_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["front_text"] == card_data["front_text"]
        assert data["back_text"] == card_data["back_text"]
        assert data["example_sentence"] == card_data["example_sentence"]
        assert data["pronunciation"] == card_data["pronunciation"]
        assert data["difficulty"] == card_data["difficulty"]
        assert data["order_index"] == card_data["order_index"]
        assert str(data["deck_id"]) == card_data["deck_id"]
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_create_card_minimal_fields(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_create
    ):
        """Test creating a card with only required fields."""
        card_data = {
            "deck_id": str(active_deck_for_create.id),
            "front_text": "kalimera",
            "back_text": "good morning",
            "difficulty": "medium",
        }

        response = await client.post(
            "/api/v1/cards",
            json=card_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["front_text"] == card_data["front_text"]
        assert data["back_text"] == card_data["back_text"]
        assert data["difficulty"] == card_data["difficulty"]
        assert data["example_sentence"] is None
        assert data["pronunciation"] is None
        assert data["order_index"] == 0  # Default value

    @pytest.mark.asyncio
    async def test_create_card_unauthenticated_returns_401(
        self, client: AsyncClient, active_deck_for_create
    ):
        """Test unauthenticated request returns 401."""
        card_data = {
            "deck_id": str(active_deck_for_create.id),
            "front_text": "test",
            "back_text": "test",
            "difficulty": "easy",
        }

        response = await client.post("/api/v1/cards", json=card_data)

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_create_card_non_superuser_returns_403(
        self, client: AsyncClient, auth_headers: dict, active_deck_for_create
    ):
        """Test regular user (non-superuser) returns 403."""
        card_data = {
            "deck_id": str(active_deck_for_create.id),
            "front_text": "test",
            "back_text": "test",
            "difficulty": "easy",
        }

        response = await client.post(
            "/api/v1/cards",
            json=card_data,
            headers=auth_headers,
        )

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_create_card_deck_not_found_returns_404(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test invalid deck_id returns 404."""
        non_existent_deck_id = uuid4()
        card_data = {
            "deck_id": str(non_existent_deck_id),
            "front_text": "test",
            "back_text": "test",
            "difficulty": "easy",
        }

        response = await client.post(
            "/api/v1/cards",
            json=card_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"
        assert str(non_existent_deck_id) in data["error"]["message"]

    @pytest.mark.asyncio
    async def test_create_card_validation_error_missing_front_text_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_create
    ):
        """Test missing required front_text field returns 422."""
        card_data = {
            "deck_id": str(active_deck_for_create.id),
            "back_text": "test",
            "difficulty": "easy",
        }

        response = await client.post(
            "/api/v1/cards",
            json=card_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_create_card_validation_error_missing_back_text_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_create
    ):
        """Test missing required back_text field returns 422."""
        card_data = {
            "deck_id": str(active_deck_for_create.id),
            "front_text": "test",
            "difficulty": "easy",
        }

        response = await client.post(
            "/api/v1/cards",
            json=card_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_create_card_validation_error_invalid_difficulty_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_create
    ):
        """Test invalid difficulty value returns 422."""
        card_data = {
            "deck_id": str(active_deck_for_create.id),
            "front_text": "test",
            "back_text": "test",
            "difficulty": "super_hard",  # Invalid value
        }

        response = await client.post(
            "/api/v1/cards",
            json=card_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_create_card_validation_error_invalid_deck_id_format_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test invalid deck_id format returns 422."""
        card_data = {
            "deck_id": "not-a-valid-uuid",
            "front_text": "test",
            "back_text": "test",
            "difficulty": "easy",
        }

        response = await client.post(
            "/api/v1/cards",
            json=card_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_create_card_validation_error_negative_order_index_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_create
    ):
        """Test negative order_index returns 422."""
        card_data = {
            "deck_id": str(active_deck_for_create.id),
            "front_text": "test",
            "back_text": "test",
            "difficulty": "easy",
            "order_index": -1,
        }

        response = await client.post(
            "/api/v1/cards",
            json=card_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_create_card_all_difficulties(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_create
    ):
        """Test creating cards with all valid difficulty levels."""
        difficulties = ["easy", "medium", "hard"]

        for i, difficulty in enumerate(difficulties):
            card_data = {
                "deck_id": str(active_deck_for_create.id),
                "front_text": f"test word {i}",
                "back_text": f"translation {i}",
                "difficulty": difficulty,
            }

            response = await client.post(
                "/api/v1/cards",
                json=card_data,
                headers=superuser_auth_headers,
            )

            assert response.status_code == 201
            assert response.json()["difficulty"] == difficulty

    @pytest.mark.asyncio
    async def test_create_card_in_inactive_deck_succeeds(
        self, client: AsyncClient, superuser_auth_headers: dict, inactive_deck_for_create
    ):
        """Test admin can create cards in inactive decks (admin privilege)."""
        card_data = {
            "deck_id": str(inactive_deck_for_create.id),
            "front_text": "test in inactive",
            "back_text": "translation",
            "difficulty": "easy",
        }

        response = await client.post(
            "/api/v1/cards",
            json=card_data,
            headers=superuser_auth_headers,
        )

        # Admin should be able to create cards in inactive decks
        assert response.status_code == 201
        data = response.json()
        assert data["front_text"] == card_data["front_text"]
        assert str(data["deck_id"]) == card_data["deck_id"]

    @pytest.mark.asyncio
    async def test_created_card_is_persisted(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_create
    ):
        """Test created card can be retrieved via GET endpoint."""
        card_data = {
            "deck_id": str(active_deck_for_create.id),
            "front_text": "persisted test",
            "back_text": "persisted translation",
            "difficulty": "hard",
        }

        # Create the card
        create_response = await client.post(
            "/api/v1/cards",
            json=card_data,
            headers=superuser_auth_headers,
        )

        assert create_response.status_code == 201
        created_card = create_response.json()
        card_id = created_card["id"]

        # Verify it can be retrieved
        get_response = await client.get(f"/api/v1/cards/{card_id}")

        assert get_response.status_code == 200
        retrieved_card = get_response.json()
        assert retrieved_card["id"] == card_id
        assert retrieved_card["front_text"] == card_data["front_text"]
        assert retrieved_card["back_text"] == card_data["back_text"]
        assert retrieved_card["difficulty"] == card_data["difficulty"]

    @pytest.mark.asyncio
    async def test_create_card_response_fields(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_create
    ):
        """Test card response contains all expected fields."""
        card_data = {
            "deck_id": str(active_deck_for_create.id),
            "front_text": "full response test",
            "back_text": "translation",
            "example_sentence": "Example sentence here",
            "pronunciation": "pronunciation",
            "difficulty": "easy",
            "order_index": 5,
        }

        response = await client.post(
            "/api/v1/cards",
            json=card_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()

        # Verify all CardResponse fields are present
        required_fields = [
            "id",
            "deck_id",
            "front_text",
            "back_text",
            "example_sentence",
            "pronunciation",
            "difficulty",
            "order_index",
            "created_at",
            "updated_at",
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
