"""Integration tests for admin API endpoints.

This module tests the admin statistics endpoint with real database operations:
- GET /api/v1/admin/stats - Content statistics for superusers

Tests cover:
- Authentication requirements (401 without auth, 403 for non-superusers)
- Authorization (only superusers can access)
- Response structure validation
- Integration with real database data
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.content import CardFactory, DeckFactory


class TestAdminStatsIntegration:
    """Integration tests for GET /api/v1/admin/stats endpoint."""

    # =========================================================================
    # Authentication Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_admin_stats_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated requests return 401 Unauthorized."""
        # Act
        response = await client.get("/api/v1/admin/stats")

        # Assert
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_admin_stats_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        # Act
        response = await client.get(
            "/api/v1/admin/stats",
            headers=auth_headers,
        )

        # Assert
        assert response.status_code == 403
        error = response.json()
        # Check error response structure
        assert error.get("success") is False
        assert error.get("error", {}).get("code") == "FORBIDDEN"

    # =========================================================================
    # Success Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_admin_stats_returns_200_for_superuser(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that superuser can access admin stats successfully."""
        # Act
        response = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "total_decks" in data
        assert "total_cards" in data
        assert "decks" in data
        assert isinstance(data["decks"], list)

    @pytest.mark.asyncio
    async def test_admin_stats_with_test_data(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test admin stats with created test data."""
        # Arrange - Create test decks and cards
        deck1 = await DeckFactory.create(
            session=db_session,
            name="Test Deck A1",
            a1=True,
            is_active=True,
        )
        deck2 = await DeckFactory.create(
            session=db_session,
            name="Test Deck B1",
            b1=True,
            is_active=True,
        )

        # Create cards for deck1
        for _ in range(3):
            await CardFactory.create(session=db_session, deck_id=deck1.id)

        # Create cards for deck2
        for _ in range(5):
            await CardFactory.create(session=db_session, deck_id=deck2.id)

        # Act
        response = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()

        # Should have at least our created decks
        assert data["total_decks"] >= 2
        assert data["total_cards"] >= 8

        # Find our decks in the response
        deck_ids = [d["id"] for d in data["decks"]]
        assert str(deck1.id) in deck_ids
        assert str(deck2.id) in deck_ids

    @pytest.mark.asyncio
    async def test_admin_stats_excludes_inactive_decks(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that inactive decks are excluded from the stats."""
        # Arrange - Create active and inactive decks
        active_deck = await DeckFactory.create(
            session=db_session,
            name="Active Deck",
            a2=True,
            is_active=True,
        )
        inactive_deck = await DeckFactory.create(
            session=db_session,
            name="Inactive Deck",
            b2=True,
            is_active=False,
        )

        # Act
        response = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()

        deck_ids = [d["id"] for d in data["decks"]]
        assert str(active_deck.id) in deck_ids
        assert str(inactive_deck.id) not in deck_ids

    @pytest.mark.asyncio
    async def test_admin_stats_response_structure(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that response matches expected schema structure."""
        # Arrange - Create a deck with cards
        deck = await DeckFactory.create(
            session=db_session,
            name="Schema Test Deck",
            c1=True,
            is_active=True,
        )
        await CardFactory.create(session=db_session, deck_id=deck.id)

        # Act
        response = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )

        # Assert
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
        assert deck_item["level"] == "C1"
        assert deck_item["name"] == "Schema Test Deck"

    @pytest.mark.asyncio
    async def test_admin_stats_decks_sorted_by_level(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that decks are sorted by CEFR level (A1 -> C2)."""
        # Arrange - Create decks in non-level order
        deck_c2 = await DeckFactory.create(
            session=db_session,
            name="C2 Deck",
            c2=True,
            is_active=True,
        )
        deck_a1 = await DeckFactory.create(
            session=db_session,
            name="A1 Deck",
            a1=True,
            is_active=True,
        )
        deck_b1 = await DeckFactory.create(
            session=db_session,
            name="B1 Deck",
            b1=True,
            is_active=True,
        )

        # Act
        response = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()

        # Find positions of our decks
        a1_index = next(
            (i for i, d in enumerate(data["decks"]) if d["id"] == str(deck_a1.id)),
            None,
        )
        b1_index = next(
            (i for i, d in enumerate(data["decks"]) if d["id"] == str(deck_b1.id)),
            None,
        )
        c2_index = next(
            (i for i, d in enumerate(data["decks"]) if d["id"] == str(deck_c2.id)),
            None,
        )

        # Verify order: A1 < B1 < C2
        assert a1_index is not None
        assert b1_index is not None
        assert c2_index is not None
        assert a1_index < b1_index < c2_index

    @pytest.mark.asyncio
    async def test_admin_stats_deck_with_zero_cards(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that decks with no cards show card_count=0."""
        # Arrange - Create a deck without cards
        empty_deck = await DeckFactory.create(
            session=db_session,
            name="Empty Deck",
            a1=True,
            is_active=True,
        )

        # Act
        response = await client.get(
            "/api/v1/admin/stats",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()

        # Find our empty deck
        deck_data = next(
            (d for d in data["decks"] if d["id"] == str(empty_deck.id)),
            None,
        )
        assert deck_data is not None
        assert deck_data["card_count"] == 0

    @pytest.mark.asyncio
    async def test_admin_stats_with_expired_token(
        self,
        client: AsyncClient,
        expired_auth_headers: dict,
    ):
        """Test that expired tokens are rejected."""
        # Act
        response = await client.get(
            "/api/v1/admin/stats",
            headers=expired_auth_headers,
        )

        # Assert
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_admin_stats_with_invalid_token(
        self,
        client: AsyncClient,
        invalid_token: str,
    ):
        """Test that invalid/malformed tokens are rejected."""
        # Act
        response = await client.get(
            "/api/v1/admin/stats",
            headers={"Authorization": f"Bearer {invalid_token}"},
        )

        # Assert
        assert response.status_code == 401
