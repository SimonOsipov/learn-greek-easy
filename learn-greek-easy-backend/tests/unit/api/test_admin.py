"""Unit tests for Admin API endpoints.

Tests cover:
- Admin stats retrieval (GET /api/v1/admin/stats)
- Authentication requirements (401 without token)
- Authorization requirements (403 for non-superusers)
- Response structure validation
- Filtering of inactive decks
- Edge cases (empty database, decks with no cards)
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.content import CardFactory, DeckFactory

# =============================================================================
# TestAdminStats - Tests for GET /api/v1/admin/stats
# =============================================================================


class TestAdminStats:
    """Tests for GET /api/v1/admin/stats endpoint."""

    @pytest.mark.asyncio
    async def test_get_stats_requires_auth(
        self,
        client: AsyncClient,
    ):
        """Test that endpoint returns 401 without authentication."""
        response = await client.get("/api/v1/admin/stats")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_stats_requires_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,  # Regular user headers
    ):
        """Test that endpoint returns 403 for non-superuser."""
        response = await client.get(
            "/api/v1/admin/stats",
            headers=auth_headers,
        )
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "FORBIDDEN"
        assert "superuser" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_get_stats_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,  # Superuser headers
        db_session: AsyncSession,
    ):
        """Test successful stats retrieval for superuser."""
        # Create test data
        deck = await DeckFactory.create(session=db_session, is_active=True)
        for _ in range(5):
            await CardFactory.create(session=db_session, deck_id=deck.id)

        response = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert "total_decks" in data
        assert "total_cards" in data
        assert "decks" in data
        assert data["total_decks"] >= 1
        assert data["total_cards"] >= 5

    @pytest.mark.asyncio
    async def test_get_stats_excludes_inactive_decks(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that inactive decks are excluded from stats."""
        # Create active and inactive decks
        active_deck = await DeckFactory.create(session=db_session, is_active=True)
        inactive_deck = await DeckFactory.create(session=db_session, is_active=False)

        for _ in range(3):
            await CardFactory.create(session=db_session, deck_id=active_deck.id)
        for _ in range(5):
            await CardFactory.create(session=db_session, deck_id=inactive_deck.id)

        response = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify inactive deck is not in the list
        deck_ids = [d["id"] for d in data["decks"]]
        assert str(active_deck.id) in deck_ids
        assert str(inactive_deck.id) not in deck_ids

    @pytest.mark.asyncio
    async def test_get_stats_empty_database(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test stats with no decks in database."""
        response = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["total_decks"] == 0
        assert data["total_cards"] == 0
        assert data["decks"] == []

    @pytest.mark.asyncio
    async def test_get_stats_deck_with_no_cards(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that decks with zero cards show card_count=0."""
        deck = await DeckFactory.create(session=db_session, is_active=True)

        response = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Find our deck in the response
        deck_data = next(
            (d for d in data["decks"] if d["id"] == str(deck.id)),
            None,
        )
        assert deck_data is not None
        assert deck_data["card_count"] == 0

    @pytest.mark.asyncio
    async def test_get_stats_response_structure(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test response matches expected schema structure."""
        deck = await DeckFactory.create(
            session=db_session,
            name="Test Deck",
            a1=True,
            is_active=True,
        )
        for _ in range(2):
            await CardFactory.create(session=db_session, deck_id=deck.id)

        response = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify top-level structure
        assert isinstance(data["total_decks"], int)
        assert isinstance(data["total_cards"], int)
        assert isinstance(data["decks"], list)

        # Verify deck item structure
        deck_item = next(d for d in data["decks"] if d["id"] == str(deck.id))
        assert "id" in deck_item
        assert "name" in deck_item
        assert "level" in deck_item
        assert "card_count" in deck_item

    @pytest.mark.asyncio
    async def test_get_stats_multiple_decks_sorted_by_level(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that decks are sorted by level and name."""
        # Create decks in non-level order
        deck_b2 = await DeckFactory.create(
            session=db_session, b2=True, name="B2 Deck", is_active=True
        )
        deck_a1 = await DeckFactory.create(
            session=db_session, a1=True, name="A1 Deck", is_active=True
        )
        deck_c1 = await DeckFactory.create(
            session=db_session, c1=True, name="C1 Deck", is_active=True
        )

        response = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify A1 comes before B2 and B2 comes before C1
        a1_index = next(i for i, d in enumerate(data["decks"]) if d["id"] == str(deck_a1.id))
        b2_index = next(i for i, d in enumerate(data["decks"]) if d["id"] == str(deck_b2.id))
        c1_index = next(i for i, d in enumerate(data["decks"]) if d["id"] == str(deck_c1.id))

        assert a1_index < b2_index < c1_index
