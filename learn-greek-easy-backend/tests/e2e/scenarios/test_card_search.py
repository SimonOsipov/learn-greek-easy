"""E2E tests for card search endpoint.

These tests verify the card search API through real HTTP requests,
covering:
- GET /api/v1/cards/search
- Search query validation
- Deck filtering
- Pagination
- Response structure validation

Run with:
    pytest tests/e2e/scenarios/test_card_search.py -v
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.e2e.conftest import E2ETestCase, UserSession


class TestCardSearchBasic(E2ETestCase):
    """E2E tests for basic card search functionality."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_returns_results(self, client: AsyncClient) -> None:
        """Test that search returns results for existing term."""
        # Search for common Greek word
        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "hello"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "cards" in data
        assert isinstance(data["cards"], list)

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_response_structure(self, client: AsyncClient) -> None:
        """Test that response has correct structure."""
        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "test"},
        )

        assert response.status_code == 200
        data = response.json()

        # Required fields
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "query" in data
        assert "deck_id" in data  # Can be null
        assert "cards" in data

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_no_results(self, client: AsyncClient) -> None:
        """Test search with term that doesn't match any cards."""
        # Use a string unlikely to match any cards
        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "xyznonexistent12345"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["cards"] == []

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_case_insensitive(self, client: AsyncClient) -> None:
        """Test that search is case insensitive."""
        # Search with uppercase
        response_upper = await client.get(
            "/api/v1/cards/search",
            params={"q": "HELLO"},
        )

        # Search with lowercase
        response_lower = await client.get(
            "/api/v1/cards/search",
            params={"q": "hello"},
        )

        assert response_upper.status_code == 200
        assert response_lower.status_code == 200

        # Results should be the same
        data_upper = response_upper.json()
        data_lower = response_lower.json()
        assert data_upper["total"] == data_lower["total"]


class TestCardSearchValidation(E2ETestCase):
    """E2E tests for card search query validation."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_missing_query_returns_422(self, client: AsyncClient) -> None:
        """Test that missing query parameter returns 422."""
        response = await client.get("/api/v1/cards/search")

        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_empty_query_returns_422(self, client: AsyncClient) -> None:
        """Test that empty query returns 422."""
        response = await client.get(
            "/api/v1/cards/search",
            params={"q": ""},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_query_too_long_returns_422(self, client: AsyncClient) -> None:
        """Test that query > 100 chars returns 422."""
        long_query = "a" * 101

        response = await client.get(
            "/api/v1/cards/search",
            params={"q": long_query},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_query_exactly_100_chars_accepted(self, client: AsyncClient) -> None:
        """Test that query with exactly 100 chars is accepted."""
        query_100 = "a" * 100

        response = await client.get(
            "/api/v1/cards/search",
            params={"q": query_100},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_single_char_query_accepted(self, client: AsyncClient) -> None:
        """Test that single character query is accepted."""
        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "a"},
        )

        assert response.status_code == 200


class TestCardSearchDeckFilter(E2ETestCase):
    """E2E tests for card search with deck filtering."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_with_deck_filter(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test search with deck_id filter."""
        decks = await self.browse_available_decks(client, fresh_user_session.headers)

        if not decks:
            pytest.skip("No decks available for testing")

        deck_id = decks[0]["id"]

        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "hello", "deck_id": deck_id},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["deck_id"] == deck_id

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_nonexistent_deck_returns_404(self, client: AsyncClient) -> None:
        """Test search with non-existent deck_id returns 404."""
        fake_deck_id = str(uuid4())

        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "hello", "deck_id": fake_deck_id},
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_invalid_deck_id_format_returns_422(
        self, client: AsyncClient
    ) -> None:
        """Test search with invalid deck_id format returns 422."""
        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "hello", "deck_id": "not-a-uuid"},
        )

        assert response.status_code == 422


class TestCardSearchPagination(E2ETestCase):
    """E2E tests for card search pagination."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_default_pagination(self, client: AsyncClient) -> None:
        """Test default pagination values."""
        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "hello"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 20  # Default

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_custom_page_size(self, client: AsyncClient) -> None:
        """Test custom page_size parameter."""
        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "hello", "page_size": 10},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page_size"] == 10

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_page_parameter(self, client: AsyncClient) -> None:
        """Test page parameter."""
        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "hello", "page": 2},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_page_zero_returns_422(self, client: AsyncClient) -> None:
        """Test that page=0 returns 422."""
        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "hello", "page": 0},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_page_size_exceeds_max_returns_422(self, client: AsyncClient) -> None:
        """Test that page_size > 50 returns 422."""
        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "hello", "page_size": 100},
        )

        assert response.status_code == 422


class TestCardSearchHttpMethods(E2ETestCase):
    """E2E tests for card search HTTP method handling."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_post_method_not_allowed(self, client: AsyncClient) -> None:
        """Test that POST method returns 405."""
        response = await client.post(
            "/api/v1/cards/search",
            json={"q": "hello"},
        )

        assert response.status_code == 405

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_put_method_not_allowed(self, client: AsyncClient) -> None:
        """Test that PUT method returns 405."""
        response = await client.put(
            "/api/v1/cards/search",
            json={"q": "hello"},
        )

        assert response.status_code == 405

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_delete_method_not_allowed(self, client: AsyncClient) -> None:
        """Test that DELETE method returns 401 or 405.

        Note: DELETE on /api/v1/cards/search may match /api/v1/cards/{card_id}
        route pattern, which requires authentication. So we may get 401
        (unauthenticated) rather than 405 (method not allowed).
        """
        response = await client.delete("/api/v1/cards/search")

        # May get 401 if route matches card delete pattern, or 405 if no match
        assert response.status_code in [401, 405]


class TestCardSearchResponseFormat(E2ETestCase):
    """E2E tests for card search response formatting."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_response_is_json(self, client: AsyncClient) -> None:
        """Test that response is JSON formatted."""
        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "hello"},
        )

        assert response.status_code == 200
        assert "application/json" in response.headers.get("content-type", "")

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_card_search_cards_have_expected_fields(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that card objects have expected fields."""
        decks = await self.browse_available_decks(client, fresh_user_session.headers)

        if not decks:
            pytest.skip("No decks available for testing")

        deck_id = decks[0]["id"]

        # Get cards from deck first
        cards_response = await client.get(
            f"/api/v1/decks/{deck_id}/cards",
            headers=fresh_user_session.headers,
        )

        if cards_response.status_code == 200:
            cards_data = cards_response.json()
            if cards_data.get("items") or cards_data.get("cards"):
                cards = cards_data.get("items", cards_data.get("cards", []))
                if cards:
                    # Get front_text from first card for search
                    search_term = cards[0].get("front_text", "hello")[:10]

                    response = await client.get(
                        "/api/v1/cards/search",
                        params={"q": search_term},
                    )

                    assert response.status_code == 200
                    data = response.json()

                    if data["cards"]:
                        card = data["cards"][0]
                        assert "id" in card
                        assert "deck_id" in card
                        assert "front_text" in card
                        assert "back_text" in card
