"""Integration tests for Cards API endpoints.

This module contains integration tests for card router endpoints.
Tests verify endpoint behavior with real database operations.

All read endpoints (list, get, search) now require authentication.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.db.models import Card, Deck, DeckLevel


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
        """Create a deck with multiple cards."""
        cards = []

        for i in range(5):
            card = Card(
                id=uuid4(),
                deck_id=active_deck.id,
                front_text=f"Greek word {i}",
                back_text_en=f"English translation {i}",
                example_sentence=f"Example sentence {i}",
                pronunciation=f"pronunciation-{i}",
            )
            db_session.add(card)
            cards.append(card)

        await db_session.commit()
        for card in cards:
            await db_session.refresh(card)

        return active_deck, cards

    @pytest.mark.asyncio
    async def test_list_cards_unauthenticated_returns_401(self, client: AsyncClient, active_deck):
        """Test unauthenticated request returns 401."""
        response = await client.get(f"/api/v1/cards?deck_id={active_deck.id}")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_list_cards_success(
        self, client: AsyncClient, auth_headers: dict, deck_with_cards
    ):
        """Test successful card listing with real database."""
        deck, cards = deck_with_cards

        response = await client.get(f"/api/v1/cards?deck_id={deck.id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["page"] == 1
        assert data["page_size"] == 50
        assert str(data["deck_id"]) == str(deck.id)
        assert len(data["cards"]) == 5

        # Verify cards are returned (ordered by created_at)
        for i, card_data in enumerate(data["cards"]):
            assert card_data["front_text"] == f"Greek word {i}"

    @pytest.mark.asyncio
    async def test_list_cards_empty_deck(
        self, client: AsyncClient, auth_headers: dict, active_deck
    ):
        """Test listing cards from empty deck returns empty list."""
        response = await client.get(f"/api/v1/cards?deck_id={active_deck.id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["cards"] == []

    @pytest.mark.asyncio
    async def test_list_cards_deck_not_found(self, client: AsyncClient, auth_headers: dict):
        """Test 404 response when deck doesn't exist."""
        non_existent_id = uuid4()
        response = await client.get(
            f"/api/v1/cards?deck_id={non_existent_id}", headers=auth_headers
        )

        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == "NOT_FOUND"
        assert str(non_existent_id) in data["error"]["message"]

    @pytest.mark.asyncio
    async def test_list_cards_inactive_deck(
        self, client: AsyncClient, auth_headers: dict, inactive_deck
    ):
        """Test 404 response for inactive deck."""
        response = await client.get(
            f"/api/v1/cards?deck_id={inactive_deck.id}", headers=auth_headers
        )

        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_list_cards_pagination_first_page(
        self, client: AsyncClient, auth_headers: dict, deck_with_cards
    ):
        """Test first page of pagination."""
        deck, cards = deck_with_cards

        response = await client.get(
            f"/api/v1/cards?deck_id={deck.id}&page=1&page_size=2", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5  # Total remains 5
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["cards"]) == 2

    @pytest.mark.asyncio
    async def test_list_cards_pagination_second_page(
        self, client: AsyncClient, auth_headers: dict, deck_with_cards
    ):
        """Test second page of pagination."""
        deck, cards = deck_with_cards

        response = await client.get(
            f"/api/v1/cards?deck_id={deck.id}&page=2&page_size=2", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["page"] == 2
        assert data["page_size"] == 2
        assert len(data["cards"]) == 2

    @pytest.mark.asyncio
    async def test_list_cards_pagination_last_page(
        self, client: AsyncClient, auth_headers: dict, deck_with_cards
    ):
        """Test last page with partial results."""
        deck, cards = deck_with_cards

        response = await client.get(
            f"/api/v1/cards?deck_id={deck.id}&page=3&page_size=2", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["page"] == 3
        assert data["page_size"] == 2
        assert len(data["cards"]) == 1  # Only 1 card on last page

    @pytest.mark.asyncio
    async def test_list_cards_pagination_beyond_last_page(
        self, client: AsyncClient, auth_headers: dict, deck_with_cards
    ):
        """Test page beyond available data returns empty list."""
        deck, cards = deck_with_cards

        response = await client.get(
            f"/api/v1/cards?deck_id={deck.id}&page=10&page_size=2", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["page"] == 10
        assert data["cards"] == []

    @pytest.mark.asyncio
    async def test_list_cards_card_response_fields(
        self, client: AsyncClient, auth_headers: dict, deck_with_cards
    ):
        """Test card response contains all expected fields."""
        deck, cards = deck_with_cards

        response = await client.get(f"/api/v1/cards?deck_id={deck.id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data["cards"]) > 0

        card = data["cards"][0]
        # Verify all CardResponse fields
        assert "id" in card
        assert "deck_id" in card
        assert "front_text" in card
        assert "back_text_en" in card
        assert "example_sentence" in card
        assert "pronunciation" in card
        assert "created_at" in card
        assert "updated_at" in card

    @pytest.mark.asyncio
    async def test_list_cards_max_page_size(
        self, client: AsyncClient, auth_headers: dict, active_deck
    ):
        """Test that page_size=100 is accepted (max value)."""
        response = await client.get(
            f"/api/v1/cards?deck_id={active_deck.id}&page_size=100", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page_size"] == 100


class TestListCardsValidation:
    """Validation tests for GET /api/v1/cards endpoint."""

    @pytest.mark.asyncio
    async def test_missing_deck_id(self, client: AsyncClient, auth_headers: dict):
        """Test 422 response when deck_id is missing."""
        response = await client.get("/api/v1/cards", headers=auth_headers)

        assert response.status_code == 422
        data = response.json()
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_invalid_uuid_format(self, client: AsyncClient, auth_headers: dict):
        """Test 422 response for invalid UUID format."""
        response = await client.get("/api/v1/cards?deck_id=invalid-uuid", headers=auth_headers)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_page_less_than_one(self, client: AsyncClient, auth_headers: dict):
        """Test 422 response when page < 1."""
        deck_id = uuid4()
        response = await client.get(f"/api/v1/cards?deck_id={deck_id}&page=0", headers=auth_headers)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_page_size_less_than_one(self, client: AsyncClient, auth_headers: dict):
        """Test 422 response when page_size < 1."""
        deck_id = uuid4()
        response = await client.get(
            f"/api/v1/cards?deck_id={deck_id}&page_size=0", headers=auth_headers
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_page_size_greater_than_100(self, client: AsyncClient, auth_headers: dict):
        """Test 422 response when page_size > 100."""
        deck_id = uuid4()
        response = await client.get(
            f"/api/v1/cards?deck_id={deck_id}&page_size=101", headers=auth_headers
        )

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
            back_text_en="good morning",
            example_sentence="Kalimera! Pos eisai?",
            pronunciation="kah-lee-MEH-rah",
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
            back_text_en="good night",
            example_sentence="Kalinihta! Kali orexi!",
            pronunciation="kah-lee-NEEKH-tah",
        )
        db_session.add(card)
        await db_session.commit()
        await db_session.refresh(card)
        return card

    @pytest.mark.asyncio
    async def test_get_card_unauthenticated_returns_401(
        self, client: AsyncClient, card_in_active_deck
    ):
        """Test unauthenticated request returns 401."""
        card = card_in_active_deck

        response = await client.get(f"/api/v1/cards/{card.id}")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_get_card_success(
        self, client: AsyncClient, auth_headers: dict, card_in_active_deck
    ):
        """Test successful retrieval of a card by ID."""
        card = card_in_active_deck

        response = await client.get(f"/api/v1/cards/{card.id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(card.id)
        assert data["deck_id"] == str(card.deck_id)
        assert data["front_text"] == "kalimera"
        assert data["back_text_en"] == "good morning"
        assert data["example_sentence"] == "Kalimera! Pos eisai?"
        assert data["pronunciation"] == "kah-lee-MEH-rah"
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_get_card_not_found(self, client: AsyncClient, auth_headers: dict):
        """Test 404 response when card doesn't exist."""
        non_existent_id = uuid4()

        response = await client.get(f"/api/v1/cards/{non_existent_id}", headers=auth_headers)

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"
        assert str(non_existent_id) in data["error"]["message"]

    @pytest.mark.asyncio
    async def test_get_card_invalid_uuid(self, client: AsyncClient, auth_headers: dict):
        """Test 422 response for invalid UUID format."""
        response = await client.get("/api/v1/cards/not-a-valid-uuid", headers=auth_headers)

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_get_card_includes_all_fields(
        self, client: AsyncClient, auth_headers: dict, card_in_active_deck
    ):
        """Test that response includes all required CardResponse fields."""
        card = card_in_active_deck

        response = await client.get(f"/api/v1/cards/{card.id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        # Verify all required CardResponse fields are present
        required_fields = [
            "id",
            "deck_id",
            "front_text",
            "back_text_en",
            "example_sentence",
            "pronunciation",
            "created_at",
            "updated_at",
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"

    @pytest.mark.asyncio
    async def test_get_card_from_inactive_deck_still_accessible(
        self, client: AsyncClient, auth_headers: dict, card_in_inactive_deck
    ):
        """Test that card from inactive deck is still accessible.

        Unlike the list endpoint which filters by active deck,
        the get single card endpoint returns any card by ID
        regardless of deck active status.
        """
        card = card_in_inactive_deck

        response = await client.get(f"/api/v1/cards/{card.id}", headers=auth_headers)

        # Card should be accessible even if deck is inactive
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(card.id)
        assert data["front_text"] == "kalinihta"


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
            "back_text_en": "thank you",
            "example_sentence": "Efharisto poly!",
            "pronunciation": "efharisto",
        }

        response = await client.post(
            "/api/v1/cards",
            json=card_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["front_text"] == card_data["front_text"]
        assert data["back_text_en"] == card_data["back_text_en"]
        assert data["example_sentence"] == card_data["example_sentence"]
        assert data["pronunciation"] == card_data["pronunciation"]
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
            "back_text_en": "good morning",
        }

        response = await client.post(
            "/api/v1/cards",
            json=card_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["front_text"] == card_data["front_text"]
        assert data["back_text_en"] == card_data["back_text_en"]
        assert data["example_sentence"] is None
        assert data["pronunciation"] is None

    @pytest.mark.asyncio
    async def test_create_card_unauthenticated_returns_401(
        self, client: AsyncClient, active_deck_for_create
    ):
        """Test unauthenticated request returns 401."""
        card_data = {
            "deck_id": str(active_deck_for_create.id),
            "front_text": "test",
            "back_text_en": "test",
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
            "back_text_en": "test",
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
            "back_text_en": "test",
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
            "back_text_en": "test",
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
    async def test_create_card_validation_error_missing_back_text_en_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_create
    ):
        """Test missing required back_text_en field returns 422."""
        card_data = {
            "deck_id": str(active_deck_for_create.id),
            "front_text": "test",
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
            "back_text_en": "test",
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
    async def test_create_card_in_inactive_deck_succeeds(
        self, client: AsyncClient, superuser_auth_headers: dict, inactive_deck_for_create
    ):
        """Test admin can create cards in inactive decks (admin privilege)."""
        card_data = {
            "deck_id": str(inactive_deck_for_create.id),
            "front_text": "test in inactive",
            "back_text_en": "translation",
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
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        auth_headers: dict,
        active_deck_for_create,
    ):
        """Test created card can be retrieved via GET endpoint."""
        card_data = {
            "deck_id": str(active_deck_for_create.id),
            "front_text": "persisted test",
            "back_text_en": "persisted translation",
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

        # Verify it can be retrieved (now requires auth)
        get_response = await client.get(f"/api/v1/cards/{card_id}", headers=auth_headers)

        assert get_response.status_code == 200
        retrieved_card = get_response.json()
        assert retrieved_card["id"] == card_id
        assert retrieved_card["front_text"] == card_data["front_text"]
        assert retrieved_card["back_text_en"] == card_data["back_text_en"]

    @pytest.mark.asyncio
    async def test_create_card_response_fields(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_create
    ):
        """Test card response contains all expected fields."""
        card_data = {
            "deck_id": str(active_deck_for_create.id),
            "front_text": "full response test",
            "back_text_en": "translation",
            "example_sentence": "Example sentence here",
            "pronunciation": "pronunciation",
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
            "back_text_en",
            "example_sentence",
            "pronunciation",
            "created_at",
            "updated_at",
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"


class TestSearchCardsEndpoint:
    """Integration tests for GET /api/v1/cards/search endpoint."""

    @pytest.fixture
    async def active_deck_for_search(self, db_session):
        """Create an active deck for search tests."""
        deck = Deck(
            id=uuid4(),
            name="Search Test Deck",
            description="Deck for card search tests",
            level=DeckLevel.A1,
            is_active=True,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)
        return deck

    @pytest.fixture
    async def deck_with_searchable_cards(self, db_session, active_deck_for_search):
        """Create a deck with cards that have searchable text."""
        cards = []
        card_data = [
            ("kalimera", "good morning", "Kalimera! Pos eisai?"),
            ("kalispera", "good evening", "Kalispera! Ti kaneis?"),
            ("kalinihta", "good night", "Kalinihta kai kala oneira!"),
            ("efharisto", "thank you", "Efharisto poly!"),
            ("parakalo", "please / you're welcome", "Parakalo, boroume na pame?"),
        ]

        for i, (front, back, example) in enumerate(card_data):
            card = Card(
                id=uuid4(),
                deck_id=active_deck_for_search.id,
                front_text=front,
                back_text_en=back,
                example_sentence=example,
                pronunciation=f"pron-{i}",
            )
            db_session.add(card)
            cards.append(card)

        await db_session.commit()
        for card in cards:
            await db_session.refresh(card)

        return active_deck_for_search, cards

    @pytest.mark.asyncio
    async def test_search_cards_unauthenticated_returns_401(self, client: AsyncClient):
        """Test unauthenticated request returns 401."""
        response = await client.get("/api/v1/cards/search?q=morning")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_search_cards_success(
        self, client: AsyncClient, auth_headers: dict, deck_with_searchable_cards
    ):
        """Test successful card search."""
        deck, cards = deck_with_searchable_cards

        response = await client.get("/api/v1/cards/search?q=morning", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert data["query"] == "morning"
        assert len(data["cards"]) >= 1
        # Should find "good morning" in back_text_en
        assert any("morning" in card["back_text_en"].lower() for card in data["cards"])

    @pytest.mark.asyncio
    async def test_search_cards_in_front_text(
        self, client: AsyncClient, auth_headers: dict, deck_with_searchable_cards
    ):
        """Test search matches front_text (Greek words)."""
        deck, cards = deck_with_searchable_cards

        response = await client.get("/api/v1/cards/search?q=kalimera", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert any(card["front_text"] == "kalimera" for card in data["cards"])

    @pytest.mark.asyncio
    async def test_search_cards_in_example_sentence(
        self, client: AsyncClient, auth_headers: dict, deck_with_searchable_cards
    ):
        """Test search matches example_sentence."""
        deck, cards = deck_with_searchable_cards

        response = await client.get(
            "/api/v1/cards/search?q=oneira", headers=auth_headers
        )  # "dreams" in Greek

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        # Should find card with "kala oneira" (good dreams) in example

    @pytest.mark.asyncio
    async def test_search_cards_case_insensitive(
        self, client: AsyncClient, auth_headers: dict, deck_with_searchable_cards
    ):
        """Test search is case-insensitive."""
        response_lower = await client.get("/api/v1/cards/search?q=morning", headers=auth_headers)
        response_upper = await client.get("/api/v1/cards/search?q=MORNING", headers=auth_headers)
        response_mixed = await client.get("/api/v1/cards/search?q=MoRnInG", headers=auth_headers)

        assert response_lower.status_code == 200
        assert response_upper.status_code == 200
        assert response_mixed.status_code == 200

        # All should return the same results
        assert response_lower.json()["total"] == response_upper.json()["total"]
        assert response_lower.json()["total"] == response_mixed.json()["total"]

    @pytest.mark.asyncio
    async def test_search_cards_with_deck_filter(
        self, client: AsyncClient, auth_headers: dict, deck_with_searchable_cards
    ):
        """Test search filtered by deck_id."""
        deck, cards = deck_with_searchable_cards

        response = await client.get(
            f"/api/v1/cards/search?q=good&deck_id={deck.id}", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert str(data["deck_id"]) == str(deck.id)
        # All cards should be from the filtered deck
        for card in data["cards"]:
            assert card["deck_id"] == str(deck.id)

    @pytest.mark.asyncio
    async def test_search_cards_no_results(
        self, client: AsyncClient, auth_headers: dict, deck_with_searchable_cards
    ):
        """Test search with no matching cards returns empty list."""
        response = await client.get(
            "/api/v1/cards/search?q=xyznonexistent123", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["cards"] == []
        assert data["query"] == "xyznonexistent123"

    @pytest.mark.asyncio
    async def test_search_cards_pagination(
        self, client: AsyncClient, auth_headers: dict, deck_with_searchable_cards
    ):
        """Test search pagination."""
        deck, cards = deck_with_searchable_cards

        # Search for "good" which should match multiple cards
        response_page1 = await client.get(
            "/api/v1/cards/search?q=good&page=1&page_size=2", headers=auth_headers
        )
        response_page2 = await client.get(
            "/api/v1/cards/search?q=good&page=2&page_size=2", headers=auth_headers
        )

        assert response_page1.status_code == 200
        assert response_page2.status_code == 200

        data_page1 = response_page1.json()
        data_page2 = response_page2.json()

        assert data_page1["page"] == 1
        assert data_page1["page_size"] == 2
        assert data_page2["page"] == 2
        assert data_page2["page_size"] == 2

        # Ensure different cards on different pages (if enough results)
        if data_page1["total"] > 2:
            page1_ids = [c["id"] for c in data_page1["cards"]]
            page2_ids = [c["id"] for c in data_page2["cards"]]
            assert not set(page1_ids).intersection(set(page2_ids))

    @pytest.mark.asyncio
    async def test_search_cards_missing_query_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test missing q parameter returns 422."""
        response = await client.get("/api/v1/cards/search", headers=auth_headers)

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_search_cards_empty_query_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test empty q parameter returns 422."""
        response = await client.get("/api/v1/cards/search?q=", headers=auth_headers)

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_search_cards_query_too_long_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test query exceeding 100 characters returns 422."""
        long_query = "a" * 101
        response = await client.get(f"/api/v1/cards/search?q={long_query}", headers=auth_headers)

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_search_cards_invalid_deck_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test search with non-existent deck_id returns 404."""
        non_existent_deck = uuid4()

        response = await client.get(
            f"/api/v1/cards/search?q=test&deck_id={non_existent_deck}", headers=auth_headers
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_search_cards_response_includes_query(
        self, client: AsyncClient, auth_headers: dict, deck_with_searchable_cards
    ):
        """Test response includes the search query that was used."""
        search_term = "kalimera"
        response = await client.get(f"/api/v1/cards/search?q={search_term}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["query"] == search_term

    @pytest.mark.asyncio
    async def test_search_cards_default_pagination(
        self, client: AsyncClient, auth_headers: dict, deck_with_searchable_cards
    ):
        """Test default pagination values (page=1, page_size=20)."""
        response = await client.get("/api/v1/cards/search?q=good", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 20


class TestUpdateCardEndpoint:
    """Integration tests for PATCH /api/v1/cards/{card_id} endpoint."""

    @pytest.fixture
    async def active_deck_for_update(self, db_session):
        """Create an active deck for update tests."""
        deck = Deck(
            id=uuid4(),
            name="Update Test Deck",
            description="Deck for card update tests",
            level=DeckLevel.A1,
            is_active=True,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)
        return deck

    @pytest.fixture
    async def card_for_update(self, db_session, active_deck_for_update):
        """Create a card for update tests."""
        card = Card(
            id=uuid4(),
            deck_id=active_deck_for_update.id,
            front_text="original_front",
            back_text_en="original_back",
            example_sentence="Original example sentence",
            pronunciation="original-pron",
        )
        db_session.add(card)
        await db_session.commit()
        await db_session.refresh(card)
        return card

    @pytest.mark.asyncio
    async def test_update_card_front_text_only(
        self, client: AsyncClient, superuser_auth_headers: dict, card_for_update
    ):
        """Test updating only the card front_text (partial update)."""
        new_front_text = "updated_front"

        response = await client.patch(
            f"/api/v1/cards/{card_for_update.id}",
            json={"front_text": new_front_text},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["front_text"] == new_front_text
        # Other fields should remain unchanged
        assert data["back_text_en"] == "original_back"
        assert data["example_sentence"] == "Original example sentence"
        assert data["pronunciation"] == "original-pron"

    @pytest.mark.asyncio
    async def test_update_card_all_fields(
        self, client: AsyncClient, superuser_auth_headers: dict, card_for_update
    ):
        """Test updating all card fields."""
        update_data = {
            "front_text": "completely_updated_front",
            "back_text_en": "completely_updated_back",
            "example_sentence": "Completely updated example",
            "pronunciation": "updated-pron",
        }

        response = await client.patch(
            f"/api/v1/cards/{card_for_update.id}",
            json=update_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["front_text"] == update_data["front_text"]
        assert data["back_text_en"] == update_data["back_text_en"]
        assert data["example_sentence"] == update_data["example_sentence"]
        assert data["pronunciation"] == update_data["pronunciation"]

    @pytest.mark.asyncio
    async def test_update_card_updated_at_changes(
        self, client: AsyncClient, superuser_auth_headers: dict, card_for_update
    ):
        """Test that updated_at timestamp changes after update."""
        import asyncio

        original_updated_at = card_for_update.updated_at.isoformat()

        # Small delay to ensure different timestamp
        await asyncio.sleep(0.1)

        response = await client.patch(
            f"/api/v1/cards/{card_for_update.id}",
            json={"front_text": "timestamp_test"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Updated_at should be different (newer)
        assert data["updated_at"] != original_updated_at

    @pytest.mark.asyncio
    async def test_update_card_unauthenticated_returns_401(
        self, client: AsyncClient, card_for_update
    ):
        """Test unauthenticated request returns 401."""
        response = await client.patch(
            f"/api/v1/cards/{card_for_update.id}",
            json={"front_text": "should_fail"},
        )

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_update_card_non_superuser_returns_403(
        self, client: AsyncClient, auth_headers: dict, card_for_update
    ):
        """Test regular user (non-superuser) returns 403."""
        response = await client.patch(
            f"/api/v1/cards/{card_for_update.id}",
            json={"front_text": "should_fail"},
            headers=auth_headers,
        )

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_update_card_not_found_returns_404(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test updating non-existent card returns 404."""
        non_existent_id = uuid4()

        response = await client.patch(
            f"/api/v1/cards/{non_existent_id}",
            json={"front_text": "should_fail"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_update_card_invalid_uuid_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test invalid UUID format returns 422."""
        response = await client.patch(
            "/api/v1/cards/not-a-valid-uuid",
            json={"front_text": "should_fail"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_update_card_empty_front_text_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, card_for_update
    ):
        """Test empty front_text string returns 422."""
        response = await client.patch(
            f"/api/v1/cards/{card_for_update.id}",
            json={"front_text": ""},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_updated_card_is_persisted(
        self, client: AsyncClient, superuser_auth_headers: dict, auth_headers: dict, card_for_update
    ):
        """Test that update changes are persisted in database."""
        new_front_text = "persisted_update"

        # Update the card
        update_response = await client.patch(
            f"/api/v1/cards/{card_for_update.id}",
            json={"front_text": new_front_text},
            headers=superuser_auth_headers,
        )
        assert update_response.status_code == 200

        # Verify changes are persisted by fetching the card again (now requires auth)
        get_response = await client.get(f"/api/v1/cards/{card_for_update.id}", headers=auth_headers)

        assert get_response.status_code == 200
        data = get_response.json()
        assert data["front_text"] == new_front_text

    @pytest.mark.asyncio
    async def test_update_card_response_has_all_fields(
        self, client: AsyncClient, superuser_auth_headers: dict, card_for_update
    ):
        """Test that response includes all required fields."""
        response = await client.patch(
            f"/api/v1/cards/{card_for_update.id}",
            json={"front_text": "field_test"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        required_fields = [
            "id",
            "deck_id",
            "front_text",
            "back_text_en",
            "example_sentence",
            "pronunciation",
            "created_at",
            "updated_at",
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"


class TestDeleteCardEndpoint:
    """Integration tests for DELETE /api/v1/cards/{card_id} endpoint."""

    @pytest.fixture
    async def active_deck_for_delete(self, db_session):
        """Create an active deck for delete tests."""
        deck = Deck(
            id=uuid4(),
            name="Delete Test Deck",
            description="Deck for card delete tests",
            level=DeckLevel.A1,
            is_active=True,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)
        return deck

    @pytest.fixture
    async def card_for_delete(self, db_session, active_deck_for_delete):
        """Create a card for delete tests."""
        card = Card(
            id=uuid4(),
            deck_id=active_deck_for_delete.id,
            front_text="delete_me",
            back_text_en="to be deleted",
            example_sentence="This card will be deleted",
            pronunciation="del-pron",
        )
        db_session.add(card)
        await db_session.commit()
        await db_session.refresh(card)
        return card

    @pytest.mark.asyncio
    async def test_delete_card_success(
        self, client: AsyncClient, superuser_auth_headers: dict, card_for_delete
    ):
        """Test superuser can delete a card successfully."""
        response = await client.delete(
            f"/api/v1/cards/{card_for_delete.id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 204
        assert response.content == b""  # No content

    @pytest.mark.asyncio
    async def test_delete_card_removes_from_database(
        self, client: AsyncClient, superuser_auth_headers: dict, auth_headers: dict, card_for_delete
    ):
        """Test that deleted card is actually removed from database."""
        card_id = card_for_delete.id

        # Delete the card
        delete_response = await client.delete(
            f"/api/v1/cards/{card_id}",
            headers=superuser_auth_headers,
        )
        assert delete_response.status_code == 204

        # Try to GET the deleted card - should return 404 (now requires auth)
        get_response = await client.get(f"/api/v1/cards/{card_id}", headers=auth_headers)
        assert get_response.status_code == 404
        data = get_response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_delete_card_unauthenticated_returns_401(
        self, client: AsyncClient, card_for_delete
    ):
        """Test unauthenticated request returns 401."""
        response = await client.delete(f"/api/v1/cards/{card_for_delete.id}")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_delete_card_non_superuser_returns_403(
        self, client: AsyncClient, auth_headers: dict, card_for_delete
    ):
        """Test regular user (non-superuser) returns 403."""
        response = await client.delete(
            f"/api/v1/cards/{card_for_delete.id}",
            headers=auth_headers,
        )

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_delete_card_not_found_returns_404(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test deleting non-existent card returns 404."""
        non_existent_id = uuid4()

        response = await client.delete(
            f"/api/v1/cards/{non_existent_id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_delete_card_invalid_uuid_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test invalid UUID format returns 422."""
        response = await client.delete(
            "/api/v1/cards/not-a-valid-uuid",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_deleted_card_not_visible_in_list(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        auth_headers: dict,
        card_for_delete,
        active_deck_for_delete,
    ):
        """Test that deleted card is not visible in the list endpoint."""
        card_id = str(card_for_delete.id)
        deck_id = active_deck_for_delete.id

        # Verify card is in list before deletion (now requires auth)
        list_response_before = await client.get(
            f"/api/v1/cards?deck_id={deck_id}", headers=auth_headers
        )
        card_ids_before = [c["id"] for c in list_response_before.json()["cards"]]
        assert card_id in card_ids_before

        # Delete the card
        delete_response = await client.delete(
            f"/api/v1/cards/{card_for_delete.id}",
            headers=superuser_auth_headers,
        )
        assert delete_response.status_code == 204

        # Verify card is NOT in list after deletion
        list_response_after = await client.get(
            f"/api/v1/cards?deck_id={deck_id}", headers=auth_headers
        )
        card_ids_after = [c["id"] for c in list_response_after.json()["cards"]]
        assert card_id not in card_ids_after


class TestCardCRUDFlow:
    """Integration tests for complete card CRUD operations."""

    @pytest.fixture
    async def deck_for_crud(self, db_session):
        """Create a deck for CRUD flow tests."""
        deck = Deck(
            id=uuid4(),
            name="CRUD Flow Test Deck",
            description="Deck for card CRUD flow tests",
            level=DeckLevel.A1,
            is_active=True,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)
        return deck

    @pytest.mark.asyncio
    async def test_full_card_lifecycle(
        self, client: AsyncClient, superuser_auth_headers: dict, auth_headers: dict, deck_for_crud
    ):
        """Test complete create-read-update-delete flow for a card."""
        # 1. CREATE
        create_data = {
            "deck_id": str(deck_for_crud.id),
            "front_text": "CRUD Test Word",
            "back_text_en": "Testing full lifecycle",
            "example_sentence": "This is a CRUD test example",
            "pronunciation": "crud-test",
        }
        create_response = await client.post(
            "/api/v1/cards",
            json=create_data,
            headers=superuser_auth_headers,
        )
        assert create_response.status_code == 201
        created_card = create_response.json()
        card_id = created_card["id"]

        # 2. READ (now requires auth)
        get_response = await client.get(f"/api/v1/cards/{card_id}", headers=auth_headers)
        assert get_response.status_code == 200
        fetched_card = get_response.json()
        assert fetched_card["front_text"] == create_data["front_text"]
        assert fetched_card["back_text_en"] == create_data["back_text_en"]

        # 3. UPDATE
        update_data = {
            "front_text": "Updated CRUD Word",
            "back_text_en": "Updated lifecycle test",
        }
        update_response = await client.patch(
            f"/api/v1/cards/{card_id}",
            json=update_data,
            headers=superuser_auth_headers,
        )
        assert update_response.status_code == 200
        updated_card = update_response.json()
        assert updated_card["front_text"] == update_data["front_text"]
        assert updated_card["back_text_en"] == update_data["back_text_en"]

        # Verify update persisted (now requires auth)
        verify_response = await client.get(f"/api/v1/cards/{card_id}", headers=auth_headers)
        assert verify_response.status_code == 200
        assert verify_response.json()["front_text"] == update_data["front_text"]

        # 4. DELETE
        delete_response = await client.delete(
            f"/api/v1/cards/{card_id}",
            headers=superuser_auth_headers,
        )
        assert delete_response.status_code == 204

        # 5. VERIFY DELETION (now requires auth)
        final_get_response = await client.get(f"/api/v1/cards/{card_id}", headers=auth_headers)
        assert final_get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_created_card_appears_in_deck_list(
        self, client: AsyncClient, superuser_auth_headers: dict, auth_headers: dict, deck_for_crud
    ):
        """Test newly created card appears in deck card listing."""
        # Create a uniquely identifiable card
        create_data = {
            "deck_id": str(deck_for_crud.id),
            "front_text": "UniqueListTest123",
            "back_text_en": "Testing visibility in list",
        }

        # Create card
        create_response = await client.post(
            "/api/v1/cards",
            json=create_data,
            headers=superuser_auth_headers,
        )
        assert create_response.status_code == 201
        card_id = create_response.json()["id"]

        # Check it appears in deck's card list (now requires auth)
        list_response = await client.get(
            f"/api/v1/cards?deck_id={deck_for_crud.id}", headers=auth_headers
        )
        assert list_response.status_code == 200
        card_ids = [c["id"] for c in list_response.json()["cards"]]
        assert card_id in card_ids

    @pytest.mark.asyncio
    async def test_created_card_appears_in_search(
        self, client: AsyncClient, superuser_auth_headers: dict, auth_headers: dict, deck_for_crud
    ):
        """Test newly created card appears in search results."""
        # Create a card with unique text
        unique_text = "UniqueSearchTest987"
        create_data = {
            "deck_id": str(deck_for_crud.id),
            "front_text": unique_text,
            "back_text_en": "Testing search visibility",
        }

        # Create card
        create_response = await client.post(
            "/api/v1/cards",
            json=create_data,
            headers=superuser_auth_headers,
        )
        assert create_response.status_code == 201
        card_id = create_response.json()["id"]

        # Check it appears in search (now requires auth)
        search_response = await client.get(
            f"/api/v1/cards/search?q={unique_text}", headers=auth_headers
        )
        assert search_response.status_code == 200
        search_card_ids = [c["id"] for c in search_response.json()["cards"]]
        assert card_id in search_card_ids

    @pytest.mark.asyncio
    async def test_updated_card_reflects_changes_in_list(
        self, client: AsyncClient, superuser_auth_headers: dict, auth_headers: dict, deck_for_crud
    ):
        """Test updates are reflected when fetching card from list."""
        # Create card
        create_data = {
            "deck_id": str(deck_for_crud.id),
            "front_text": "Before Update",
            "back_text_en": "Initial translation",
        }
        create_response = await client.post(
            "/api/v1/cards",
            json=create_data,
            headers=superuser_auth_headers,
        )
        assert create_response.status_code == 201
        card_id = create_response.json()["id"]

        # Update card
        update_data = {
            "front_text": "After Update",
        }
        update_response = await client.patch(
            f"/api/v1/cards/{card_id}",
            json=update_data,
            headers=superuser_auth_headers,
        )
        assert update_response.status_code == 200

        # Verify changes in list (now requires auth)
        list_response = await client.get(
            f"/api/v1/cards?deck_id={deck_for_crud.id}", headers=auth_headers
        )
        assert list_response.status_code == 200
        cards = list_response.json()["cards"]
        matching = [c for c in cards if c["id"] == card_id]
        assert len(matching) == 1
        assert matching[0]["front_text"] == "After Update"

    @pytest.mark.asyncio
    async def test_auth_flow_for_card_admin_endpoints(
        self, client: AsyncClient, auth_headers: dict, superuser_auth_headers: dict, deck_for_crud
    ):
        """Test authentication flow for admin-only card endpoints."""
        # 1. Regular user cannot create
        create_data = {
            "deck_id": str(deck_for_crud.id),
            "front_text": "Auth Test",
            "back_text_en": "Test",
        }
        create_response = await client.post("/api/v1/cards", json=create_data, headers=auth_headers)
        assert create_response.status_code == 403

        # 2. Superuser can create
        create_response = await client.post(
            "/api/v1/cards", json=create_data, headers=superuser_auth_headers
        )
        assert create_response.status_code == 201
        card_id = create_response.json()["id"]

        # 3. Regular user cannot update
        update_response = await client.patch(
            f"/api/v1/cards/{card_id}",
            json={"front_text": "Should Fail"},
            headers=auth_headers,
        )
        assert update_response.status_code == 403

        # 4. Regular user cannot delete
        delete_response = await client.delete(f"/api/v1/cards/{card_id}", headers=auth_headers)
        assert delete_response.status_code == 403

        # 5. Unauthenticated requests fail
        unauth_create = await client.post("/api/v1/cards", json=create_data)
        assert unauth_create.status_code == 401

        unauth_update = await client.patch(f"/api/v1/cards/{card_id}", json={"front_text": "Fail"})
        assert unauth_update.status_code == 401

        unauth_delete = await client.delete(f"/api/v1/cards/{card_id}")
        assert unauth_delete.status_code == 401

        # 6. Read endpoints now require auth
        get_response = await client.get(f"/api/v1/cards/{card_id}")
        assert get_response.status_code == 401

        list_response = await client.get(f"/api/v1/cards?deck_id={deck_for_crud.id}")
        assert list_response.status_code == 401

        search_response = await client.get("/api/v1/cards/search?q=Auth")
        assert search_response.status_code == 401

        # 7. Regular user can read with auth
        get_response = await client.get(f"/api/v1/cards/{card_id}", headers=auth_headers)
        assert get_response.status_code == 200

        list_response = await client.get(
            f"/api/v1/cards?deck_id={deck_for_crud.id}", headers=auth_headers
        )
        assert list_response.status_code == 200

        search_response = await client.get("/api/v1/cards/search?q=Auth", headers=auth_headers)
        assert search_response.status_code == 200
