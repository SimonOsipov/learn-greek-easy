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
