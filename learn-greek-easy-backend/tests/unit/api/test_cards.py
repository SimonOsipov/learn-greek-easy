"""Unit tests for Cards API endpoints.

This module contains unit tests for the card router endpoints.
Tests verify endpoint behavior, response formats, and error handling.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.db.models import Card, CardDifficulty, Deck


class TestListCardsUnit:
    """Unit tests for GET /api/v1/cards endpoint."""

    @pytest.fixture
    def mock_deck(self):
        """Create a mock active deck."""
        deck = MagicMock(spec=Deck)
        deck.id = uuid4()
        deck.is_active = True
        deck.name = "Test Deck"
        return deck

    @pytest.fixture
    def mock_cards(self, mock_deck):
        """Create a list of mock cards."""
        cards = []
        for i in range(3):
            card = MagicMock(spec=Card)
            card.id = uuid4()
            card.deck_id = mock_deck.id
            card.front_text = f"Greek {i}"
            card.back_text = f"English {i}"
            card.example_sentence = f"Example {i}"
            card.pronunciation = f"pron-{i}"
            card.difficulty = CardDifficulty.EASY
            card.order_index = i
            card.created_at = MagicMock()
            card.updated_at = MagicMock()
            cards.append(card)
        return cards

    @pytest.mark.asyncio
    async def test_list_cards_success(self, client: AsyncClient, mock_deck, mock_cards):
        """Test successful card listing."""
        with (
            patch("src.api.v1.cards.DeckRepository") as MockDeckRepo,
            patch("src.api.v1.cards.CardRepository") as MockCardRepo,
        ):
            # Setup mocks
            mock_deck_repo = AsyncMock()
            mock_deck_repo.get.return_value = mock_deck
            MockDeckRepo.return_value = mock_deck_repo

            mock_card_repo = AsyncMock()
            mock_card_repo.get_by_deck.return_value = mock_cards
            mock_card_repo.count_by_deck.return_value = 3
            MockCardRepo.return_value = mock_card_repo

            response = await client.get(f"/api/v1/cards?deck_id={mock_deck.id}")

            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 3
            assert data["page"] == 1
            assert data["page_size"] == 50
            assert str(data["deck_id"]) == str(mock_deck.id)
            assert len(data["cards"]) == 3

    @pytest.mark.asyncio
    async def test_list_cards_empty_deck(self, client: AsyncClient, mock_deck):
        """Test listing cards from empty deck."""
        with (
            patch("src.api.v1.cards.DeckRepository") as MockDeckRepo,
            patch("src.api.v1.cards.CardRepository") as MockCardRepo,
        ):
            mock_deck_repo = AsyncMock()
            mock_deck_repo.get.return_value = mock_deck
            MockDeckRepo.return_value = mock_deck_repo

            mock_card_repo = AsyncMock()
            mock_card_repo.get_by_deck.return_value = []
            mock_card_repo.count_by_deck.return_value = 0
            MockCardRepo.return_value = mock_card_repo

            response = await client.get(f"/api/v1/cards?deck_id={mock_deck.id}")

            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 0
            assert data["cards"] == []

    @pytest.mark.asyncio
    async def test_list_cards_deck_not_found(self, client: AsyncClient):
        """Test 404 response when deck doesn't exist."""
        with patch("src.api.v1.cards.DeckRepository") as MockDeckRepo:
            mock_deck_repo = AsyncMock()
            mock_deck_repo.get.return_value = None
            MockDeckRepo.return_value = mock_deck_repo

            non_existent_id = uuid4()
            response = await client.get(f"/api/v1/cards?deck_id={non_existent_id}")

            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_cards_inactive_deck(self, client: AsyncClient):
        """Test 404 response for inactive deck."""
        with patch("src.api.v1.cards.DeckRepository") as MockDeckRepo:
            inactive_deck = MagicMock(spec=Deck)
            inactive_deck.id = uuid4()
            inactive_deck.is_active = False

            mock_deck_repo = AsyncMock()
            mock_deck_repo.get.return_value = inactive_deck
            MockDeckRepo.return_value = mock_deck_repo

            response = await client.get(f"/api/v1/cards?deck_id={inactive_deck.id}")

            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_cards_missing_deck_id(self, client: AsyncClient):
        """Test 422 response when deck_id is missing."""
        response = await client.get("/api/v1/cards")

        assert response.status_code == 422
        data = response.json()
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_list_cards_invalid_deck_id_format(self, client: AsyncClient):
        """Test 422 response for invalid UUID format."""
        response = await client.get("/api/v1/cards?deck_id=not-a-uuid")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_cards_invalid_page_zero(self, client: AsyncClient):
        """Test 422 response when page is 0."""
        deck_id = uuid4()
        response = await client.get(f"/api/v1/cards?deck_id={deck_id}&page=0")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_cards_invalid_page_negative(self, client: AsyncClient):
        """Test 422 response when page is negative."""
        deck_id = uuid4()
        response = await client.get(f"/api/v1/cards?deck_id={deck_id}&page=-1")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_cards_invalid_page_size_zero(self, client: AsyncClient):
        """Test 422 response when page_size is 0."""
        deck_id = uuid4()
        response = await client.get(f"/api/v1/cards?deck_id={deck_id}&page_size=0")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_cards_invalid_page_size_over_limit(self, client: AsyncClient):
        """Test 422 response when page_size exceeds 100."""
        deck_id = uuid4()
        response = await client.get(f"/api/v1/cards?deck_id={deck_id}&page_size=101")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_cards_invalid_difficulty(self, client: AsyncClient):
        """Test 422 response for invalid difficulty value."""
        deck_id = uuid4()
        response = await client.get(f"/api/v1/cards?deck_id={deck_id}&difficulty=invalid")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_cards_with_difficulty_filter(
        self, client: AsyncClient, mock_deck, mock_cards
    ):
        """Test filtering cards by difficulty."""
        with (
            patch("src.api.v1.cards.DeckRepository") as MockDeckRepo,
            patch("src.api.v1.cards.CardRepository") as MockCardRepo,
        ):
            mock_deck_repo = AsyncMock()
            mock_deck_repo.get.return_value = mock_deck
            MockDeckRepo.return_value = mock_deck_repo

            # Return only cards that match difficulty
            mock_card_repo = AsyncMock()
            mock_card_repo.get_by_difficulty.return_value = mock_cards[:1]
            MockCardRepo.return_value = mock_card_repo

            response = await client.get(f"/api/v1/cards?deck_id={mock_deck.id}&difficulty=easy")

            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 1
            mock_card_repo.get_by_difficulty.assert_called_once_with(
                mock_deck.id, CardDifficulty.EASY
            )

    @pytest.mark.asyncio
    async def test_list_cards_pagination(self, client: AsyncClient, mock_deck, mock_cards):
        """Test pagination parameters are passed correctly."""
        with (
            patch("src.api.v1.cards.DeckRepository") as MockDeckRepo,
            patch("src.api.v1.cards.CardRepository") as MockCardRepo,
        ):
            mock_deck_repo = AsyncMock()
            mock_deck_repo.get.return_value = mock_deck
            MockDeckRepo.return_value = mock_deck_repo

            mock_card_repo = AsyncMock()
            mock_card_repo.get_by_deck.return_value = mock_cards[2:3]  # 3rd card
            mock_card_repo.count_by_deck.return_value = 3
            MockCardRepo.return_value = mock_card_repo

            response = await client.get(f"/api/v1/cards?deck_id={mock_deck.id}&page=2&page_size=2")

            assert response.status_code == 200
            data = response.json()
            assert data["page"] == 2
            assert data["page_size"] == 2
            assert data["total"] == 3
            # Verify get_by_deck was called with skip=2 (page 2, size 2)
            mock_card_repo.get_by_deck.assert_called_once_with(mock_deck.id, skip=2, limit=2)


class TestListCardsResponseFormat:
    """Tests for CardListResponse schema compliance."""

    @pytest.mark.asyncio
    async def test_response_contains_required_fields(self, client: AsyncClient):
        """Test response contains all required fields."""
        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = uuid4()
        mock_deck.is_active = True

        with (
            patch("src.api.v1.cards.DeckRepository") as MockDeckRepo,
            patch("src.api.v1.cards.CardRepository") as MockCardRepo,
        ):
            mock_deck_repo = AsyncMock()
            mock_deck_repo.get.return_value = mock_deck
            MockDeckRepo.return_value = mock_deck_repo

            mock_card_repo = AsyncMock()
            mock_card_repo.get_by_deck.return_value = []
            mock_card_repo.count_by_deck.return_value = 0
            MockCardRepo.return_value = mock_card_repo

            response = await client.get(f"/api/v1/cards?deck_id={mock_deck.id}")

            assert response.status_code == 200
            data = response.json()

            # Verify required fields
            assert "total" in data
            assert "page" in data
            assert "page_size" in data
            assert "deck_id" in data
            assert "cards" in data

            # Verify types
            assert isinstance(data["total"], int)
            assert isinstance(data["page"], int)
            assert isinstance(data["page_size"], int)
            assert isinstance(data["cards"], list)


class TestGetCardUnit:
    """Unit tests for GET /api/v1/cards/{card_id} endpoint."""

    @pytest.fixture
    def mock_card(self):
        """Create a mock card."""
        card = MagicMock(spec=Card)
        card.id = uuid4()
        card.deck_id = uuid4()
        card.front_text = "kalimera"
        card.back_text = "good morning"
        card.example_sentence = "Kalimera! Pos eisai?"
        card.pronunciation = "kah-lee-MEH-rah"
        card.difficulty = CardDifficulty.EASY
        card.order_index = 0
        card.created_at = MagicMock()
        card.updated_at = MagicMock()
        return card

    @pytest.mark.asyncio
    async def test_get_card_calls_repository_with_card_id(self, client: AsyncClient, mock_card):
        """Test that get_card calls repository.get with correct card_id."""
        with patch("src.api.v1.cards.CardRepository") as MockCardRepo:
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = mock_card
            MockCardRepo.return_value = mock_card_repo

            response = await client.get(f"/api/v1/cards/{mock_card.id}")

            assert response.status_code == 200
            mock_card_repo.get.assert_called_once_with(mock_card.id)

    @pytest.mark.asyncio
    async def test_get_card_not_found_returns_404(self, client: AsyncClient):
        """Test 404 response when card doesn't exist."""
        with patch("src.api.v1.cards.CardRepository") as MockCardRepo:
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = None
            MockCardRepo.return_value = mock_card_repo

            non_existent_id = uuid4()
            response = await client.get(f"/api/v1/cards/{non_existent_id}")

            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_card_invalid_uuid_returns_422(self, client: AsyncClient):
        """Test 422 response for invalid UUID format."""
        response = await client.get("/api/v1/cards/not-a-uuid")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_card_response_format(self, client: AsyncClient, mock_card):
        """Test that response matches CardResponse schema."""
        with patch("src.api.v1.cards.CardRepository") as MockCardRepo:
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = mock_card
            MockCardRepo.return_value = mock_card_repo

            response = await client.get(f"/api/v1/cards/{mock_card.id}")

            assert response.status_code == 200
            data = response.json()

            # Verify all CardResponse fields
            assert data["id"] == str(mock_card.id)
            assert data["deck_id"] == str(mock_card.deck_id)
            assert data["front_text"] == mock_card.front_text
            assert data["back_text"] == mock_card.back_text
            assert data["example_sentence"] == mock_card.example_sentence
            assert data["pronunciation"] == mock_card.pronunciation
            assert data["difficulty"] == mock_card.difficulty.value
            assert data["order_index"] == mock_card.order_index
