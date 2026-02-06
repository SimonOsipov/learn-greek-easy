"""Unit tests for deck API endpoints.

These tests mock the DeckRepository to test endpoint logic in isolation.
For full integration tests, see tests/integration/api/test_decks.py
All read endpoints require authentication.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.db.models import CardSystemVersion, Deck, DeckLevel


class TestListDecksUnit:
    """Unit tests for GET /api/v1/decks endpoint."""

    @pytest.mark.asyncio
    async def test_list_decks_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        response = await client.get("/api/v1/decks")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_list_decks_calls_repository_with_correct_params(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that list endpoint calls repository with correct parameters."""
        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = uuid4()
        mock_deck.name_en = "Test Deck"
        mock_deck.name_el = "Τεστ Τράπουλα"
        mock_deck.name_ru = "Тестовая колода"
        mock_deck.description_en = "Test description"
        mock_deck.description_el = "Περιγραφή τεστ"
        mock_deck.description_ru = "Тестовое описание"
        mock_deck.level = DeckLevel.A1
        mock_deck.is_active = True
        mock_deck.is_premium = False
        mock_deck.card_system = CardSystemVersion.V1
        mock_deck.created_at = MagicMock()
        mock_deck.updated_at = MagicMock()

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_active.return_value = [mock_deck]
            mock_repo.count_active.return_value = 1
            mock_repo.get_batch_card_counts.return_value = {mock_deck.id: 10}
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/decks?page=2&page_size=10", headers=auth_headers)

            assert response.status_code == 200
            # Verify repository was called with correct offset (skip) and limit
            mock_repo.list_active.assert_called_once()
            call_kwargs = mock_repo.list_active.call_args.kwargs
            assert call_kwargs["skip"] == 10  # (page 2 - 1) * page_size 10
            assert call_kwargs["limit"] == 10
            # Verify card counts were fetched
            mock_repo.get_batch_card_counts.assert_called_once_with([mock_deck.id])

    @pytest.mark.asyncio
    async def test_list_decks_with_level_filter_passes_to_repository(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that level filter is passed to repository."""
        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_active.return_value = []
            mock_repo.count_active.return_value = 0
            mock_repo.get_batch_card_counts.return_value = {}
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/decks?level=B1", headers=auth_headers)

            assert response.status_code == 200
            mock_repo.list_active.assert_called_once()
            call_kwargs = mock_repo.list_active.call_args.kwargs
            assert call_kwargs["level"] == DeckLevel.B1

    @pytest.mark.asyncio
    async def test_list_decks_returns_correct_response_structure(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that response has correct structure."""
        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_active.return_value = []
            mock_repo.count_active.return_value = 0
            mock_repo.get_batch_card_counts.return_value = {}
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/decks", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert "total" in data
            assert "page" in data
            assert "page_size" in data
            assert "decks" in data
            assert data["page"] == 1
            assert data["page_size"] == 20  # Default

    @pytest.mark.asyncio
    async def test_list_decks_invalid_page_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that invalid page number returns 422."""
        response = await client.get("/api/v1/decks?page=0", headers=auth_headers)
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_list_decks_negative_page_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that negative page number returns 422."""
        response = await client.get("/api/v1/decks?page=-1", headers=auth_headers)
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_list_decks_invalid_page_size_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that invalid page size returns 422."""
        # page_size > 100
        response = await client.get("/api/v1/decks?page_size=101", headers=auth_headers)
        assert response.status_code == 422

        # page_size = 0
        response = await client.get("/api/v1/decks?page_size=0", headers=auth_headers)
        assert response.status_code == 422


class TestGetDeckUnit:
    """Unit tests for GET /api/v1/decks/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_deck_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        deck_id = uuid4()

        response = await client.get(f"/api/v1/decks/{deck_id}")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_get_deck_calls_repository_with_deck_id(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that get deck calls repository with correct ID."""
        deck_id = uuid4()
        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = deck_id
        mock_deck.name_en = "Test Deck"
        mock_deck.name_el = "Τεστ Τράπουλα"
        mock_deck.name_ru = "Тестовая колода"
        mock_deck.description_en = "Test"
        mock_deck.description_el = "Τεστ"
        mock_deck.description_ru = "Тест"
        mock_deck.level = DeckLevel.A1
        mock_deck.is_active = True
        mock_deck.is_premium = False
        mock_deck.card_system = CardSystemVersion.V1
        mock_deck.owner_id = None  # System deck (accessible to all)
        mock_deck.created_at = MagicMock()
        mock_deck.updated_at = MagicMock()

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_deck
            mock_repo.count_cards.return_value = 5
            mock_repo_class.return_value = mock_repo

            response = await client.get(f"/api/v1/decks/{deck_id}", headers=auth_headers)

            assert response.status_code == 200
            mock_repo.get.assert_called_once_with(deck_id)
            mock_repo.count_cards.assert_called_once_with(deck_id)

    @pytest.mark.asyncio
    async def test_get_deck_not_found_returns_404(self, client: AsyncClient, auth_headers: dict):
        """Test that non-existent deck returns 404."""
        deck_id = uuid4()

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = None
            mock_repo_class.return_value = mock_repo

            response = await client.get(f"/api/v1/decks/{deck_id}", headers=auth_headers)

            assert response.status_code == 404
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_get_deck_inactive_returns_404(self, client: AsyncClient, auth_headers: dict):
        """Test that inactive deck returns 404."""
        deck_id = uuid4()
        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = deck_id
        mock_deck.is_active = False
        mock_deck.is_premium = False
        mock_deck.card_system = CardSystemVersion.V1

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_deck
            mock_repo_class.return_value = mock_repo

            response = await client.get(f"/api/v1/decks/{deck_id}", headers=auth_headers)

            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_deck_invalid_uuid_returns_422(self, client: AsyncClient, auth_headers: dict):
        """Test that invalid UUID returns 422."""
        response = await client.get("/api/v1/decks/not-a-uuid", headers=auth_headers)

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"


class TestSearchDecksUnit:
    """Unit tests for GET /api/v1/decks/search endpoint."""

    @pytest.mark.asyncio
    async def test_search_decks_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        response = await client.get("/api/v1/decks/search?q=greek")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_search_decks_calls_repository_with_query(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that search calls repository with correct parameters."""
        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.search.return_value = []
            mock_repo.count_search.return_value = 0
            mock_repo.get_batch_card_counts.return_value = {}
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/decks/search?q=greek", headers=auth_headers)

            assert response.status_code == 200
            mock_repo.search.assert_called_once()
            call_kwargs = mock_repo.search.call_args.kwargs
            assert call_kwargs["query_text"] == "greek"

    @pytest.mark.asyncio
    async def test_search_decks_missing_query_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that missing query parameter returns 422."""
        response = await client.get("/api/v1/decks/search", headers=auth_headers)

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_search_decks_empty_query_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that empty query returns 422."""
        response = await client.get("/api/v1/decks/search?q=", headers=auth_headers)

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_search_decks_query_too_long_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that query over 100 chars returns 422."""
        long_query = "a" * 101
        response = await client.get(f"/api/v1/decks/search?q={long_query}", headers=auth_headers)

        assert response.status_code == 422


class TestCreateDeckUnit:
    """Unit tests for POST /api/v1/decks endpoint.

    Note: Complex mock tests for create behavior with ownership are covered
    in integration tests (tests/integration/api/test_decks.py) since they
    require proper database session handling. Unit tests here focus on
    authentication and validation.
    """

    @pytest.mark.asyncio
    async def test_create_deck_unauthorized_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        deck_data = {"name": "Test Deck", "level": "A1"}

        response = await client.post("/api/v1/decks", json=deck_data)

        assert response.status_code == 401
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

    @pytest.mark.asyncio
    async def test_create_deck_missing_name_regular_user_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that regular user with missing name returns 422."""
        deck_data = {"level": "A1"}

        response = await client.post("/api/v1/decks", json=deck_data, headers=auth_headers)

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"


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
    async def test_update_deck_non_owner_returns_403(self, client: AsyncClient, auth_headers: dict):
        """Test that non-owner user returns 403 when trying to update another's deck."""
        deck_id = uuid4()
        other_user_id = uuid4()  # Different from test_user

        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = deck_id
        mock_deck.name_en = "Other User's Deck"
        mock_deck.name_el = "Τράπουλα Άλλου Χρήστη"
        mock_deck.name_ru = "Колода другого пользователя"
        mock_deck.is_premium = False
        mock_deck.card_system = CardSystemVersion.V1
        mock_deck.owner_id = other_user_id  # Owned by another user

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_deck
            mock_repo_class.return_value = mock_repo

            response = await client.patch(
                f"/api/v1/decks/{deck_id}", json={"name": "Updated"}, headers=auth_headers
            )

            assert response.status_code == 403
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "FORBIDDEN"
            assert "not authorized to edit this deck" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_update_deck_system_deck_non_superuser_returns_403(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that regular user returns 403 when trying to update a system deck."""
        deck_id = uuid4()

        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = deck_id
        mock_deck.name_en = "System Deck"
        mock_deck.name_el = "Σύστημα Τράπουλα"
        mock_deck.name_ru = "Системная колода"
        mock_deck.is_premium = False
        mock_deck.card_system = CardSystemVersion.V1
        mock_deck.owner_id = None  # System deck - owner_id is None

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_deck
            mock_repo_class.return_value = mock_repo

            response = await client.patch(
                f"/api/v1/decks/{deck_id}", json={"name": "Updated"}, headers=auth_headers
            )

            assert response.status_code == 403
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "FORBIDDEN"

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
    async def test_delete_system_deck_non_superuser_returns_403(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that regular user returns 403 when trying to delete a system deck."""
        deck_id = uuid4()

        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = deck_id
        mock_deck.name_en = "System Deck"
        mock_deck.name_el = "Σύστημα Τράπουλα"
        mock_deck.name_ru = "Системная колода"
        mock_deck.is_premium = False
        mock_deck.card_system = CardSystemVersion.V1
        mock_deck.owner_id = None  # System deck - owner_id is None

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_deck
            mock_repo_class.return_value = mock_repo

            response = await client.delete(f"/api/v1/decks/{deck_id}", headers=auth_headers)

            assert response.status_code == 403
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "FORBIDDEN"
            assert "not authorized to delete this deck" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_delete_other_users_deck_returns_403(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that regular user returns 403 when trying to delete another user's deck."""
        deck_id = uuid4()
        other_user_id = uuid4()  # Different from test_user

        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = deck_id
        mock_deck.name_en = "Other User's Deck"
        mock_deck.name_el = "Τράπουλα Άλλου Χρήστη"
        mock_deck.name_ru = "Колода другого пользователя"
        mock_deck.is_premium = False
        mock_deck.card_system = CardSystemVersion.V1
        mock_deck.owner_id = other_user_id  # Owned by another user

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_deck
            mock_repo_class.return_value = mock_repo

            response = await client.delete(f"/api/v1/decks/{deck_id}", headers=auth_headers)

            assert response.status_code == 403
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "FORBIDDEN"
            assert "not authorized to delete this deck" in data["error"]["message"].lower()

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


class TestDeckIsPremiumUnit:
    """Unit tests for is_premium field in deck API endpoints."""

    @pytest.mark.asyncio
    async def test_list_decks_includes_is_premium_in_response(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that list endpoint includes is_premium field in response."""
        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = uuid4()
        mock_deck.name_en = "Premium Test Deck"
        mock_deck.name_el = "Πρίμιουμ Τεστ Τράπουλα"
        mock_deck.name_ru = "Премиум тестовая колода"
        mock_deck.description_en = "Test description"
        mock_deck.description_el = "Περιγραφή τεστ"
        mock_deck.description_ru = "Тестовое описание"
        mock_deck.level = DeckLevel.A1
        mock_deck.is_active = True
        mock_deck.is_premium = True
        mock_deck.card_system = CardSystemVersion.V1
        mock_deck.created_at = MagicMock()
        mock_deck.updated_at = MagicMock()

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_active.return_value = [mock_deck]
            mock_repo.count_active.return_value = 1
            mock_repo.get_batch_card_counts.return_value = {mock_deck.id: 10}
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/decks", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert len(data["decks"]) == 1
            assert "is_premium" in data["decks"][0]
            assert data["decks"][0]["is_premium"] is True
            assert data["decks"][0]["card_count"] == 10

    @pytest.mark.asyncio
    async def test_list_decks_is_premium_false_in_response(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that list endpoint returns is_premium=False for free decks."""
        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = uuid4()
        mock_deck.name_en = "Free Test Deck"
        mock_deck.name_el = "Δωρεάν Τεστ Τράπουλα"
        mock_deck.name_ru = "Бесплатная тестовая колода"
        mock_deck.description_en = "Free content"
        mock_deck.description_el = "Δωρεάν περιεχόμενο"
        mock_deck.description_ru = "Бесплатный контент"
        mock_deck.level = DeckLevel.A1
        mock_deck.is_active = True
        mock_deck.is_premium = False
        mock_deck.card_system = CardSystemVersion.V1
        mock_deck.created_at = MagicMock()
        mock_deck.updated_at = MagicMock()

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_active.return_value = [mock_deck]
            mock_repo.count_active.return_value = 1
            mock_repo.get_batch_card_counts.return_value = {mock_deck.id: 5}
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/decks", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert len(data["decks"]) == 1
            assert data["decks"][0]["is_premium"] is False

    @pytest.mark.asyncio
    async def test_get_deck_includes_is_premium_in_response(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that get deck endpoint includes is_premium field."""
        deck_id = uuid4()
        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = deck_id
        mock_deck.name_en = "Premium Deck"
        mock_deck.name_el = "Πρίμιουμ Τράπουλα"
        mock_deck.name_ru = "Премиум колода"
        mock_deck.description_en = "Premium content"
        mock_deck.description_el = "Πρίμιουμ περιεχόμενο"
        mock_deck.description_ru = "Премиум контент"
        mock_deck.level = DeckLevel.B1
        mock_deck.is_active = True
        mock_deck.is_premium = True
        mock_deck.card_system = CardSystemVersion.V1
        mock_deck.owner_id = None  # System deck (accessible to all)
        mock_deck.created_at = MagicMock()
        mock_deck.updated_at = MagicMock()

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_deck
            mock_repo.count_cards.return_value = 10
            mock_repo_class.return_value = mock_repo

            response = await client.get(f"/api/v1/decks/{deck_id}", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert "is_premium" in data
            assert data["is_premium"] is True

    @pytest.mark.asyncio
    async def test_search_decks_includes_is_premium_in_response(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that search endpoint includes is_premium field."""
        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = uuid4()
        mock_deck.name_en = "Greek Premium"
        mock_deck.name_el = "Ελληνικό Πρίμιουμ"
        mock_deck.name_ru = "Греческий премиум"
        mock_deck.description_en = "Premium Greek content"
        mock_deck.description_el = "Πρίμιουμ ελληνικό περιεχόμενο"
        mock_deck.description_ru = "Премиум греческий контент"
        mock_deck.level = DeckLevel.B2
        mock_deck.is_active = True
        mock_deck.is_premium = True
        mock_deck.card_system = CardSystemVersion.V1
        mock_deck.created_at = MagicMock()
        mock_deck.updated_at = MagicMock()

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.search.return_value = [mock_deck]
            mock_repo.count_search.return_value = 1
            mock_repo.get_batch_card_counts.return_value = {mock_deck.id: 15}
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/decks/search?q=greek", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert len(data["decks"]) == 1
            assert "is_premium" in data["decks"][0]
            assert data["decks"][0]["is_premium"] is True
            assert data["decks"][0]["card_count"] == 15

    # Note: Update tests for is_premium are in integration tests
    # (tests/integration/api/test_decks.py::TestDeckIsPremiumIntegration)
    # because mocking the database session for update operations is complex
    # and integration tests provide better coverage for CRUD operations.


class TestListMyDecksUnit:
    """Unit tests for GET /api/v1/decks/mine endpoint."""

    @pytest.mark.asyncio
    async def test_list_my_decks_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        response = await client.get("/api/v1/decks/mine")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_list_my_decks_calls_repository_with_user_id(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that list_my_decks calls repository with current user's ID."""
        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = uuid4()
        mock_deck.name_en = "My Custom Deck"
        mock_deck.name_el = "Η Προσωπική μου Τράπουλα"
        mock_deck.name_ru = "Моя пользовательская колода"
        mock_deck.description_en = "My personal deck"
        mock_deck.description_el = "Η προσωπική μου τράπουλα"
        mock_deck.description_ru = "Моя личная колода"
        mock_deck.level = DeckLevel.A1
        mock_deck.is_active = True
        mock_deck.is_premium = False
        mock_deck.card_system = CardSystemVersion.V1
        mock_deck.created_at = MagicMock()
        mock_deck.updated_at = MagicMock()

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_user_owned.return_value = [mock_deck]
            mock_repo.count_user_owned.return_value = 1
            mock_repo.get_batch_card_counts.return_value = {mock_deck.id: 5}
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/decks/mine", headers=auth_headers)

            assert response.status_code == 200
            # Verify repository was called with user_id
            mock_repo.list_user_owned.assert_called_once()
            call_kwargs = mock_repo.list_user_owned.call_args.kwargs
            assert "user_id" in call_kwargs
            # Verify card counts were fetched
            mock_repo.get_batch_card_counts.assert_called_once_with([mock_deck.id])

    @pytest.mark.asyncio
    async def test_list_my_decks_with_pagination(self, client: AsyncClient, auth_headers: dict):
        """Test that pagination parameters are passed correctly."""
        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_user_owned.return_value = []
            mock_repo.count_user_owned.return_value = 0
            mock_repo.get_batch_card_counts.return_value = {}
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                "/api/v1/decks/mine?page=2&page_size=10", headers=auth_headers
            )

            assert response.status_code == 200
            call_kwargs = mock_repo.list_user_owned.call_args.kwargs
            assert call_kwargs["skip"] == 10  # (page 2 - 1) * page_size 10
            assert call_kwargs["limit"] == 10

    @pytest.mark.asyncio
    async def test_list_my_decks_with_level_filter(self, client: AsyncClient, auth_headers: dict):
        """Test that level filter is passed to repository."""
        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_user_owned.return_value = []
            mock_repo.count_user_owned.return_value = 0
            mock_repo.get_batch_card_counts.return_value = {}
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/decks/mine?level=B1", headers=auth_headers)

            assert response.status_code == 200
            call_kwargs = mock_repo.list_user_owned.call_args.kwargs
            assert call_kwargs["level"] == DeckLevel.B1

    @pytest.mark.asyncio
    async def test_list_my_decks_returns_correct_response_structure(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that response has correct structure."""
        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_user_owned.return_value = []
            mock_repo.count_user_owned.return_value = 0
            mock_repo.get_batch_card_counts.return_value = {}
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/decks/mine", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert "total" in data
            assert "page" in data
            assert "page_size" in data
            assert "decks" in data
            assert data["page"] == 1
            assert data["page_size"] == 20  # Default

    @pytest.mark.asyncio
    async def test_list_my_decks_invalid_page_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that invalid page number returns 422."""
        response = await client.get("/api/v1/decks/mine?page=0", headers=auth_headers)
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"


class TestGetDeckAuthorizationUnit:
    """Unit tests for deck ownership authorization in GET /api/v1/decks/{id}."""

    @pytest.mark.asyncio
    async def test_get_deck_system_deck_accessible_to_all(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that system decks (owner_id=None) are accessible to all users."""
        deck_id = uuid4()
        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = deck_id
        mock_deck.name_en = "System Deck"
        mock_deck.name_el = "Τράπουλα Συστήματος"
        mock_deck.name_ru = "Системная колода"
        mock_deck.description_en = "A system deck"
        mock_deck.description_el = "Μια τράπουλα συστήματος"
        mock_deck.description_ru = "Системная колода"
        mock_deck.level = DeckLevel.A1
        mock_deck.is_active = True
        mock_deck.is_premium = False
        mock_deck.card_system = CardSystemVersion.V1
        mock_deck.owner_id = None  # System deck
        mock_deck.created_at = MagicMock()
        mock_deck.updated_at = MagicMock()

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_deck
            mock_repo.count_cards.return_value = 5
            mock_repo_class.return_value = mock_repo

            response = await client.get(f"/api/v1/decks/{deck_id}", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == str(deck_id)

    @pytest.mark.asyncio
    async def test_get_deck_non_owner_returns_403(self, client: AsyncClient, auth_headers: dict):
        """Test that non-owner cannot access another user's deck."""
        deck_id = uuid4()
        other_user_id = uuid4()  # Different from test_user

        mock_deck = MagicMock(spec=Deck)
        mock_deck.id = deck_id
        mock_deck.name_en = "Other User's Deck"
        mock_deck.name_el = "Τράπουλα Άλλου Χρήστη"
        mock_deck.name_ru = "Колода другого пользователя"
        mock_deck.description_en = "Not my deck"
        mock_deck.description_el = "Όχι η τράπουλά μου"
        mock_deck.description_ru = "Не моя колода"
        mock_deck.level = DeckLevel.A1
        mock_deck.is_active = True
        mock_deck.is_premium = False
        mock_deck.card_system = CardSystemVersion.V1
        mock_deck.owner_id = other_user_id  # Owned by another user
        mock_deck.created_at = MagicMock()
        mock_deck.updated_at = MagicMock()

        with patch("src.api.v1.decks.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_deck
            mock_repo_class.return_value = mock_repo

            response = await client.get(f"/api/v1/decks/{deck_id}", headers=auth_headers)

            assert response.status_code == 403
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "FORBIDDEN"
            assert "permission" in data["error"]["message"].lower()
