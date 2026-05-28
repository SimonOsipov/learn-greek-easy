"""Integration tests for GET /api/v1/admin/decks/{deck_id} endpoint.

Tests for:
- GET /api/v1/admin/decks/{deck_id} - Retrieve single deck detail

Run with:
    pytest tests/integration/api/test_admin_deck_detail.py -v
"""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.content import DeckFactory
from tests.factories.culture import CultureDeckFactory

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def mock_s3(mocker):
    """Mock S3 service for deck detail tests."""
    mock = mocker.MagicMock()
    mock.generate_presigned_url.return_value = "https://s3.example.com/deck-images/test.jpg"
    mocker.patch("src.api.v1.admin.get_s3_service", return_value=mock)
    return mock


# ============================================================================
# GET /api/v1/admin/decks/{deck_id} Tests
# ============================================================================


class TestGetAdminDeckDetail:
    """Tests for GET /api/v1/admin/decks/{deck_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_admin_deck_vocabulary(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test 200 response for an existing vocabulary deck."""
        deck = await DeckFactory.create(session=db_session)

        response = await client.get(
            f"/api/v1/admin/decks/{deck.id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(deck.id)
        assert data["type"] == "vocabulary"
        # DeckFactory creates system decks (no owner_id) by default
        assert data["is_system_deck"] is True
        assert data["owner_id"] is None
        assert "item_count" in data
        assert "cover_image_url" in data

    @pytest.mark.asyncio
    async def test_get_admin_deck_culture(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test 200 response for a culture deck; is_system_deck always True."""
        deck = await CultureDeckFactory.create(session=db_session)

        response = await client.get(
            f"/api/v1/admin/decks/{deck.id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(deck.id)
        assert data["type"] == "culture"
        assert data["is_system_deck"] is True
        assert data["owner_id"] is None
        assert "item_count" in data

    @pytest.mark.asyncio
    async def test_get_admin_deck_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3: MagicMock,
    ) -> None:
        """Test 404 when deck does not exist."""
        random_id = uuid4()

        response = await client.get(
            f"/api/v1/admin/decks/{random_id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_get_admin_deck_non_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test 403 for a regular (non-superuser) authenticated user."""
        deck = await DeckFactory.create(session=db_session)

        response = await client.get(
            f"/api/v1/admin/decks/{deck.id}",
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_deck_list_includes_is_system_deck(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3: MagicMock,
    ) -> None:
        """Test that GET /admin/decks list includes is_system_deck on each item."""
        await DeckFactory.create(session=db_session)

        response = await client.get(
            "/api/v1/admin/decks",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "decks" in data
        assert len(data["decks"]) >= 1
        for deck_item in data["decks"]:
            assert "is_system_deck" in deck_item
