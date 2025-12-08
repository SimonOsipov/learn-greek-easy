"""Unit tests for deck API endpoints.

These tests mock the DeckRepository to test endpoint logic in isolation.
For full integration tests, see tests/integration/api/test_decks.py
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.db.models import Deck, DeckLevel


class TestListDecksUnit:
    """Unit tests for GET /api/v1/decks endpoint."""

    @pytest.mark.asyncio
    async def test_list_decks_calls_repository_with_correct_params(self, client: AsyncClient):
        """Test that list endpoint calls repository with correct parameters."""
        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = uuid4()
        mock_deck.name = "Test Deck"
        mock_deck.description = "Test description"
        mock_deck.level = DeckLevel.A1
        mock_deck.is_active = True
        mock_deck.created_at = MagicMock()
        mock_deck.updated_at = MagicMock()

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_active.return_value = [mock_deck]
            mock_repo.count_active.return_value = 1
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/decks?page=2&page_size=10")

            assert response.status_code == 200
            # Verify repository was called with correct offset (skip) and limit
            mock_repo.list_active.assert_called_once()
            call_kwargs = mock_repo.list_active.call_args.kwargs
            assert call_kwargs["skip"] == 10  # (page 2 - 1) * page_size 10
            assert call_kwargs["limit"] == 10

    @pytest.mark.asyncio
    async def test_list_decks_with_level_filter_passes_to_repository(self, client: AsyncClient):
        """Test that level filter is passed to repository."""
        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_active.return_value = []
            mock_repo.count_active.return_value = 0
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/decks?level=B1")

            assert response.status_code == 200
            mock_repo.list_active.assert_called_once()
            call_kwargs = mock_repo.list_active.call_args.kwargs
            assert call_kwargs["level"] == DeckLevel.B1

    @pytest.mark.asyncio
    async def test_list_decks_returns_correct_response_structure(self, client: AsyncClient):
        """Test that response has correct structure."""
        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_active.return_value = []
            mock_repo.count_active.return_value = 0
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/decks")

            assert response.status_code == 200
            data = response.json()
            assert "total" in data
            assert "page" in data
            assert "page_size" in data
            assert "decks" in data
            assert data["page"] == 1
            assert data["page_size"] == 20  # Default

    @pytest.mark.asyncio
    async def test_list_decks_invalid_page_returns_422(self, client: AsyncClient):
        """Test that invalid page number returns 422."""
        response = await client.get("/api/v1/decks?page=0")
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_list_decks_negative_page_returns_422(self, client: AsyncClient):
        """Test that negative page number returns 422."""
        response = await client.get("/api/v1/decks?page=-1")
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_list_decks_invalid_page_size_returns_422(self, client: AsyncClient):
        """Test that invalid page size returns 422."""
        # page_size > 100
        response = await client.get("/api/v1/decks?page_size=101")
        assert response.status_code == 422

        # page_size = 0
        response = await client.get("/api/v1/decks?page_size=0")
        assert response.status_code == 422


class TestGetDeckUnit:
    """Unit tests for GET /api/v1/decks/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_deck_calls_repository_with_deck_id(self, client: AsyncClient):
        """Test that get deck calls repository with correct ID."""
        deck_id = uuid4()
        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = deck_id
        mock_deck.name = "Test Deck"
        mock_deck.description = "Test"
        mock_deck.level = DeckLevel.A1
        mock_deck.is_active = True
        mock_deck.created_at = MagicMock()
        mock_deck.updated_at = MagicMock()

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_deck
            mock_repo.count_cards.return_value = 5
            mock_repo_class.return_value = mock_repo

            response = await client.get(f"/api/v1/decks/{deck_id}")

            assert response.status_code == 200
            mock_repo.get.assert_called_once_with(deck_id)
            mock_repo.count_cards.assert_called_once_with(deck_id)

    @pytest.mark.asyncio
    async def test_get_deck_not_found_returns_404(self, client: AsyncClient):
        """Test that non-existent deck returns 404."""
        deck_id = uuid4()

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = None
            mock_repo_class.return_value = mock_repo

            response = await client.get(f"/api/v1/decks/{deck_id}")

            assert response.status_code == 404
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_get_deck_inactive_returns_404(self, client: AsyncClient):
        """Test that inactive deck returns 404."""
        deck_id = uuid4()
        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = deck_id
        mock_deck.is_active = False

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_deck
            mock_repo_class.return_value = mock_repo

            response = await client.get(f"/api/v1/decks/{deck_id}")

            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_deck_invalid_uuid_returns_422(self, client: AsyncClient):
        """Test that invalid UUID returns 422."""
        response = await client.get("/api/v1/decks/not-a-uuid")

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"


class TestSearchDecksUnit:
    """Unit tests for GET /api/v1/decks/search endpoint."""

    @pytest.mark.asyncio
    async def test_search_decks_calls_repository_with_query(self, client: AsyncClient):
        """Test that search calls repository with correct parameters."""
        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.search.return_value = []
            mock_repo.count_search.return_value = 0
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/decks/search?q=greek")

            assert response.status_code == 200
            mock_repo.search.assert_called_once()
            call_kwargs = mock_repo.search.call_args.kwargs
            assert call_kwargs["query_text"] == "greek"

    @pytest.mark.asyncio
    async def test_search_decks_missing_query_returns_422(self, client: AsyncClient):
        """Test that missing query parameter returns 422."""
        response = await client.get("/api/v1/decks/search")

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_search_decks_empty_query_returns_422(self, client: AsyncClient):
        """Test that empty query returns 422."""
        response = await client.get("/api/v1/decks/search?q=")

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_search_decks_query_too_long_returns_422(self, client: AsyncClient):
        """Test that query over 100 chars returns 422."""
        long_query = "a" * 101
        response = await client.get(f"/api/v1/decks/search?q={long_query}")

        assert response.status_code == 422


class TestCreateDeckUnit:
    """Unit tests for POST /api/v1/decks endpoint."""

    @pytest.mark.asyncio
    async def test_create_deck_unauthorized_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        deck_data = {"name": "Test Deck", "level": "A1"}

        response = await client.post("/api/v1/decks", json=deck_data)

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_create_deck_non_superuser_returns_403(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that regular user returns 403."""
        deck_data = {"name": "Test Deck", "level": "A1"}

        response = await client.post("/api/v1/decks", json=deck_data, headers=auth_headers)

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_create_deck_missing_name_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test that missing name returns 422."""
        deck_data = {"level": "A1"}

        response = await client.post(
            "/api/v1/decks", json=deck_data, headers=superuser_auth_headers
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_create_deck_missing_level_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test that missing level returns 422."""
        deck_data = {"name": "Test Deck"}

        response = await client.post(
            "/api/v1/decks", json=deck_data, headers=superuser_auth_headers
        )

        assert response.status_code == 422


class TestUpdateDeckUnit:
    """Unit tests for PATCH /api/v1/decks/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_update_deck_unauthorized_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        deck_id = uuid4()

        response = await client.patch(f"/api/v1/decks/{deck_id}", json={"name": "Updated"})

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_update_deck_non_superuser_returns_403(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that regular user returns 403."""
        deck_id = uuid4()

        response = await client.patch(
            f"/api/v1/decks/{deck_id}", json={"name": "Updated"}, headers=auth_headers
        )

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_update_deck_not_found_returns_404(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test that non-existent deck returns 404."""
        deck_id = uuid4()

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = None
            mock_repo_class.return_value = mock_repo

            response = await client.patch(
                f"/api/v1/decks/{deck_id}",
                json={"name": "Updated"},
                headers=superuser_auth_headers,
            )

            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_deck_invalid_uuid_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test that invalid UUID returns 422."""
        response = await client.patch(
            "/api/v1/decks/invalid-uuid",
            json={"name": "Updated"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422


class TestDeleteDeckUnit:
    """Unit tests for DELETE /api/v1/decks/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_deck_unauthorized_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        deck_id = uuid4()

        response = await client.delete(f"/api/v1/decks/{deck_id}")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_delete_deck_non_superuser_returns_403(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that regular user returns 403."""
        deck_id = uuid4()

        response = await client.delete(f"/api/v1/decks/{deck_id}", headers=auth_headers)

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_delete_deck_not_found_returns_404(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test that non-existent deck returns 404."""
        deck_id = uuid4()

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = None
            mock_repo_class.return_value = mock_repo

            response = await client.delete(
                f"/api/v1/decks/{deck_id}", headers=superuser_auth_headers
            )

            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_deck_invalid_uuid_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test that invalid UUID returns 422."""
        response = await client.delete("/api/v1/decks/invalid-uuid", headers=superuser_auth_headers)

        assert response.status_code == 422
