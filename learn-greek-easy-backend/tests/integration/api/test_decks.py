"""Integration tests for deck API endpoints.

This module provides comprehensive tests for the deck endpoints including:
- GET /api/v1/decks/{deck_id} - Get single deck with card count
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.db.models import Deck
from tests.fixtures.deck import DeckWithCards


class TestGetDeckEndpoint:
    """Test suite for GET /api/v1/decks/{deck_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_deck_success(self, client: AsyncClient, deck_with_cards: DeckWithCards):
        """Test successful retrieval of a deck with card count."""
        deck = deck_with_cards.deck
        expected_card_count = len(deck_with_cards.cards)

        response = await client.get(f"/api/v1/decks/{deck.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(deck.id)
        assert data["name"] == deck.name
        assert data["description"] == deck.description
        assert data["level"] == deck.level.value
        assert data["is_active"] is True
        assert data["card_count"] == expected_card_count
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_get_deck_not_found(self, client: AsyncClient):
        """Test 404 for non-existent deck."""
        non_existent_id = uuid4()

        response = await client.get(f"/api/v1/decks/{non_existent_id}")

        assert response.status_code == 404
        data = response.json()
        # App uses custom error format: {success: false, error: {code, message}}
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"
        assert "not found" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_get_inactive_deck_returns_404(self, client: AsyncClient, inactive_deck: Deck):
        """Test that inactive decks return 404."""
        response = await client.get(f"/api/v1/decks/{inactive_deck.id}")

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"
        assert "not found" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_get_deck_invalid_uuid(self, client: AsyncClient):
        """Test 422 for invalid UUID format."""
        response = await client.get("/api/v1/decks/not-a-valid-uuid")

        assert response.status_code == 422
        data = response.json()
        # Validation errors also use custom format
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_get_empty_deck_card_count_zero(self, client: AsyncClient, empty_deck: Deck):
        """Test that empty deck returns card_count of 0."""
        response = await client.get(f"/api/v1/decks/{empty_deck.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["card_count"] == 0
        assert data["id"] == str(empty_deck.id)
        assert data["name"] == empty_deck.name

    @pytest.mark.asyncio
    async def test_get_deck_includes_all_fields(
        self, client: AsyncClient, deck_with_cards: DeckWithCards
    ):
        """Test that response includes all required fields."""
        deck = deck_with_cards.deck

        response = await client.get(f"/api/v1/decks/{deck.id}")

        assert response.status_code == 200
        data = response.json()

        # Verify all required fields are present
        required_fields = [
            "id",
            "name",
            "description",
            "level",
            "is_active",
            "card_count",
            "created_at",
            "updated_at",
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
