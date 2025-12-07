"""Integration tests for deck API endpoints.

This module provides comprehensive tests for the deck endpoints including:
- POST /api/v1/decks - Create a new deck (admin only)
- GET /api/v1/decks/search - Search decks by name or description
- GET /api/v1/decks/{deck_id} - Get single deck with card count
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.db.models import Deck
from tests.fixtures.deck import DeckWithCards, MultiLevelDecks


class TestCreateDeckEndpoint:
    """Test suite for POST /api/v1/decks endpoint."""

    @pytest.mark.asyncio
    async def test_create_deck_success(self, client: AsyncClient, superuser_auth_headers: dict):
        """Test superuser can create a deck successfully."""
        deck_data = {
            "name": "Test Deck Creation",
            "description": "A test deck created via API",
            "level": "A1",
        }

        response = await client.post(
            "/api/v1/decks",
            json=deck_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == deck_data["name"]
        assert data["description"] == deck_data["description"]
        assert data["level"] == deck_data["level"]
        assert data["is_active"] is True
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_create_deck_without_description(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test creating a deck without optional description."""
        deck_data = {
            "name": "Deck Without Description",
            "level": "B1",
        }

        response = await client.post(
            "/api/v1/decks",
            json=deck_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == deck_data["name"]
        assert data["description"] is None
        assert data["level"] == deck_data["level"]

    @pytest.mark.asyncio
    async def test_create_deck_all_levels(self, client: AsyncClient, superuser_auth_headers: dict):
        """Test creating decks with all valid CEFR levels."""
        levels = ["A1", "A2", "B1", "B2", "C1", "C2"]

        for level in levels:
            deck_data = {
                "name": f"Test {level} Deck",
                "level": level,
            }

            response = await client.post(
                "/api/v1/decks",
                json=deck_data,
                headers=superuser_auth_headers,
            )

            assert response.status_code == 201
            assert response.json()["level"] == level

    @pytest.mark.asyncio
    async def test_create_deck_unauthenticated_returns_401(self, client: AsyncClient):
        """Test unauthenticated request returns 401."""
        deck_data = {
            "name": "Test Deck",
            "level": "A1",
        }

        response = await client.post("/api/v1/decks", json=deck_data)

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_create_deck_non_superuser_returns_403(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test regular user (non-superuser) returns 403."""
        deck_data = {
            "name": "Test Deck",
            "level": "A1",
        }

        response = await client.post(
            "/api/v1/decks",
            json=deck_data,
            headers=auth_headers,
        )

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_create_deck_missing_name_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test missing required name field returns 422."""
        deck_data = {
            "description": "Missing name",
            "level": "A1",
        }

        response = await client.post(
            "/api/v1/decks",
            json=deck_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_create_deck_missing_level_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test missing required level field returns 422."""
        deck_data = {
            "name": "Test Deck",
        }

        response = await client.post(
            "/api/v1/decks",
            json=deck_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_create_deck_invalid_level_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test invalid level value returns 422."""
        deck_data = {
            "name": "Test Deck",
            "level": "INVALID",
        }

        response = await client.post(
            "/api/v1/decks",
            json=deck_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_create_deck_empty_name_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test empty name string returns 422."""
        deck_data = {
            "name": "",
            "level": "A1",
        }

        response = await client.post(
            "/api/v1/decks",
            json=deck_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_create_deck_name_too_long_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test name exceeding 255 characters returns 422."""
        deck_data = {
            "name": "A" * 256,
            "level": "A1",
        }

        response = await client.post(
            "/api/v1/decks",
            json=deck_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_created_deck_is_persisted(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test created deck can be retrieved via GET endpoint."""
        deck_data = {
            "name": "Persistence Test Deck",
            "description": "Testing persistence",
            "level": "B2",
        }

        # Create deck
        create_response = await client.post(
            "/api/v1/decks",
            json=deck_data,
            headers=superuser_auth_headers,
        )
        assert create_response.status_code == 201
        created_deck = create_response.json()
        deck_id = created_deck["id"]

        # Retrieve deck
        get_response = await client.get(f"/api/v1/decks/{deck_id}")
        assert get_response.status_code == 200

        retrieved_deck = get_response.json()
        assert retrieved_deck["id"] == deck_id
        assert retrieved_deck["name"] == deck_data["name"]
        assert retrieved_deck["description"] == deck_data["description"]
        assert retrieved_deck["level"] == deck_data["level"]
        assert retrieved_deck["card_count"] == 0  # New deck has no cards


class TestSearchDecksEndpoint:
    """Test suite for GET /api/v1/decks/search endpoint."""

    @pytest.mark.asyncio
    async def test_search_decks_success(self, client: AsyncClient, deck_with_cards: DeckWithCards):
        """Test successful search returns matching decks."""
        # Search for part of deck name (deck_with_cards creates "Greek A1 Vocabulary")
        response = await client.get("/api/v1/decks/search?q=Greek")

        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "query" in data
        assert data["query"] == "Greek"
        assert "decks" in data
        assert len(data["decks"]) >= 1

    @pytest.mark.asyncio
    async def test_search_decks_case_insensitive(
        self, client: AsyncClient, deck_with_cards: DeckWithCards
    ):
        """Test search is case-insensitive."""
        # Search with different cases
        response_lower = await client.get("/api/v1/decks/search?q=greek")
        response_upper = await client.get("/api/v1/decks/search?q=GREEK")
        response_mixed = await client.get("/api/v1/decks/search?q=GrEeK")

        assert response_lower.status_code == 200
        assert response_upper.status_code == 200
        assert response_mixed.status_code == 200

        # All should return the same results
        assert response_lower.json()["total"] == response_upper.json()["total"]
        assert response_lower.json()["total"] == response_mixed.json()["total"]

    @pytest.mark.asyncio
    async def test_search_decks_partial_match_name(
        self, client: AsyncClient, deck_with_cards: DeckWithCards
    ):
        """Test search matches partial text in name."""
        # Search for partial word "Vocab" should match "Vocabulary"
        response = await client.get("/api/v1/decks/search?q=Vocab")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        # Verify we found the deck with "Vocabulary" in name
        deck_names = [d["name"] for d in data["decks"]]
        assert any("Vocabulary" in name for name in deck_names)

    @pytest.mark.asyncio
    async def test_search_decks_partial_match_description(
        self, client: AsyncClient, deck_with_cards: DeckWithCards
    ):
        """Test search matches partial text in description."""
        # Deck fixture description contains "beginner" or "Essential"
        response = await client.get("/api/v1/decks/search?q=beginner")

        assert response.status_code == 200
        data = response.json()
        # Should find deck with "beginner" in description
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_search_decks_pagination(
        self, client: AsyncClient, multi_level_decks: MultiLevelDecks
    ):
        """Test pagination works for search results."""
        # multi_level_decks creates 3 decks named "Greek A1/A2/B1 Vocabulary"
        # First page with page_size=1
        response_page1 = await client.get("/api/v1/decks/search?q=Greek&page=1&page_size=1")

        assert response_page1.status_code == 200
        data_page1 = response_page1.json()
        assert data_page1["page"] == 1
        assert data_page1["page_size"] == 1
        assert len(data_page1["decks"]) == 1
        assert data_page1["total"] >= 3  # At least 3 decks match "Greek"

        # Second page
        response_page2 = await client.get("/api/v1/decks/search?q=Greek&page=2&page_size=1")

        assert response_page2.status_code == 200
        data_page2 = response_page2.json()
        assert data_page2["page"] == 2
        assert len(data_page2["decks"]) == 1

        # Ensure different decks on different pages
        assert data_page1["decks"][0]["id"] != data_page2["decks"][0]["id"]

    @pytest.mark.asyncio
    async def test_search_decks_missing_query_returns_422(self, client: AsyncClient):
        """Test missing q parameter returns 422."""
        response = await client.get("/api/v1/decks/search")

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_search_decks_empty_query_returns_422(self, client: AsyncClient):
        """Test empty q parameter returns 422."""
        response = await client.get("/api/v1/decks/search?q=")

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_search_decks_query_too_long_returns_422(self, client: AsyncClient):
        """Test query exceeding 100 characters returns 422."""
        long_query = "a" * 101
        response = await client.get(f"/api/v1/decks/search?q={long_query}")

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_search_decks_excludes_inactive(
        self, client: AsyncClient, inactive_deck: Deck, deck_with_cards: DeckWithCards
    ):
        """Test inactive decks are not returned in search."""
        # inactive_deck has name "Archived Deck"
        response = await client.get("/api/v1/decks/search?q=Archived")

        assert response.status_code == 200
        data = response.json()
        # Should not find the inactive deck
        deck_ids = [d["id"] for d in data["decks"]]
        assert str(inactive_deck.id) not in deck_ids

    @pytest.mark.asyncio
    async def test_search_decks_no_results(
        self, client: AsyncClient, deck_with_cards: DeckWithCards
    ):
        """Test search with no matching decks returns empty list."""
        response = await client.get("/api/v1/decks/search?q=xyznonexistent123")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["decks"] == []
        assert data["query"] == "xyznonexistent123"

    @pytest.mark.asyncio
    async def test_search_decks_response_includes_query(
        self, client: AsyncClient, deck_with_cards: DeckWithCards
    ):
        """Test response includes the search query that was used."""
        search_term = "vocabulary"
        response = await client.get(f"/api/v1/decks/search?q={search_term}")

        assert response.status_code == 200
        data = response.json()
        assert data["query"] == search_term

    @pytest.mark.asyncio
    async def test_search_decks_response_includes_total_count(
        self, client: AsyncClient, multi_level_decks: MultiLevelDecks
    ):
        """Test response includes total count for pagination."""
        response = await client.get("/api/v1/decks/search?q=Greek&page_size=1")

        assert response.status_code == 200
        data = response.json()
        # Total should be >= number of returned decks (for pagination)
        assert data["total"] >= len(data["decks"])
        assert data["total"] >= 3  # At least 3 decks match "Greek"

    @pytest.mark.asyncio
    async def test_search_decks_default_pagination(
        self, client: AsyncClient, deck_with_cards: DeckWithCards
    ):
        """Test default pagination values (page=1, page_size=20)."""
        response = await client.get("/api/v1/decks/search?q=Greek")

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 20

    @pytest.mark.asyncio
    async def test_search_decks_response_deck_fields(
        self, client: AsyncClient, deck_with_cards: DeckWithCards
    ):
        """Test that deck objects in response have all required fields."""
        response = await client.get("/api/v1/decks/search?q=Greek")

        assert response.status_code == 200
        data = response.json()
        assert len(data["decks"]) >= 1

        # Verify deck object has all required fields
        deck = data["decks"][0]
        required_fields = [
            "id",
            "name",
            "description",
            "level",
            "is_active",
            "created_at",
            "updated_at",
        ]
        for field in required_fields:
            assert field in deck, f"Missing required field: {field}"


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


class TestUpdateDeckEndpoint:
    """Test suite for PATCH /api/v1/decks/{deck_id} endpoint."""

    @pytest.mark.asyncio
    async def test_update_deck_name_only(
        self, client: AsyncClient, superuser_auth_headers: dict, empty_deck: Deck
    ):
        """Test updating only the deck name (partial update)."""
        new_name = "Updated Deck Name"

        response = await client.patch(
            f"/api/v1/decks/{empty_deck.id}",
            json={"name": new_name},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == new_name
        # Other fields should remain unchanged
        assert data["description"] == empty_deck.description
        assert data["level"] == empty_deck.level.value
        assert data["is_active"] is True

    @pytest.mark.asyncio
    async def test_update_deck_all_fields(
        self, client: AsyncClient, superuser_auth_headers: dict, empty_deck: Deck
    ):
        """Test updating all deck fields."""
        update_data = {
            "name": "Completely Updated Deck",
            "description": "A completely new description",
            "level": "C1",
            "is_active": False,
        }

        response = await client.patch(
            f"/api/v1/decks/{empty_deck.id}",
            json=update_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["description"] == update_data["description"]
        assert data["level"] == update_data["level"]
        assert data["is_active"] == update_data["is_active"]

    @pytest.mark.asyncio
    async def test_update_deck_description_only(
        self, client: AsyncClient, superuser_auth_headers: dict, empty_deck: Deck
    ):
        """Test updating only the description."""
        new_description = "This is a brand new description"

        response = await client.patch(
            f"/api/v1/decks/{empty_deck.id}",
            json={"description": new_description},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["description"] == new_description
        assert data["name"] == empty_deck.name  # Unchanged

    @pytest.mark.asyncio
    async def test_update_deck_level(
        self, client: AsyncClient, superuser_auth_headers: dict, empty_deck: Deck
    ):
        """Test updating deck level to different CEFR levels."""
        levels = ["A1", "A2", "B1", "B2", "C1", "C2"]

        for level in levels:
            response = await client.patch(
                f"/api/v1/decks/{empty_deck.id}",
                json={"level": level},
                headers=superuser_auth_headers,
            )

            assert response.status_code == 200
            assert response.json()["level"] == level

    @pytest.mark.asyncio
    async def test_update_deck_is_active(
        self, client: AsyncClient, superuser_auth_headers: dict, empty_deck: Deck
    ):
        """Test toggling deck active status."""
        # Set to inactive
        response = await client.patch(
            f"/api/v1/decks/{empty_deck.id}",
            json={"is_active": False},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is False

        # Set back to active
        response = await client.patch(
            f"/api/v1/decks/{empty_deck.id}",
            json={"is_active": True},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is True

    @pytest.mark.asyncio
    async def test_update_inactive_deck(
        self, client: AsyncClient, superuser_auth_headers: dict, inactive_deck: Deck
    ):
        """Test that admins can update inactive decks."""
        response = await client.patch(
            f"/api/v1/decks/{inactive_deck.id}",
            json={"name": "Updated Inactive Deck"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Inactive Deck"
        assert data["is_active"] is False  # Still inactive

    @pytest.mark.asyncio
    async def test_update_deck_updated_at_changes(
        self, client: AsyncClient, superuser_auth_headers: dict, empty_deck: Deck
    ):
        """Test that updated_at timestamp changes after update."""
        original_updated_at = empty_deck.updated_at.isoformat()

        # Small delay to ensure different timestamp
        import asyncio

        await asyncio.sleep(0.1)

        response = await client.patch(
            f"/api/v1/decks/{empty_deck.id}",
            json={"name": "Timestamp Test"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Updated_at should be different (newer)
        assert data["updated_at"] != original_updated_at

    @pytest.mark.asyncio
    async def test_update_deck_unauthenticated_returns_401(
        self, client: AsyncClient, empty_deck: Deck
    ):
        """Test unauthenticated request returns 401."""
        response = await client.patch(
            f"/api/v1/decks/{empty_deck.id}",
            json={"name": "Should Fail"},
        )

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_update_deck_non_superuser_returns_403(
        self, client: AsyncClient, auth_headers: dict, empty_deck: Deck
    ):
        """Test regular user (non-superuser) returns 403."""
        response = await client.patch(
            f"/api/v1/decks/{empty_deck.id}",
            json={"name": "Should Fail"},
            headers=auth_headers,
        )

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_update_deck_not_found_returns_404(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test updating non-existent deck returns 404."""
        non_existent_id = uuid4()

        response = await client.patch(
            f"/api/v1/decks/{non_existent_id}",
            json={"name": "Should Fail"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_update_deck_invalid_uuid_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test invalid UUID format returns 422."""
        response = await client.patch(
            "/api/v1/decks/not-a-valid-uuid",
            json={"name": "Should Fail"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_update_deck_invalid_level_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, empty_deck: Deck
    ):
        """Test invalid level value returns 422."""
        response = await client.patch(
            f"/api/v1/decks/{empty_deck.id}",
            json={"level": "INVALID"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_update_deck_empty_name_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, empty_deck: Deck
    ):
        """Test empty name string returns 422."""
        response = await client.patch(
            f"/api/v1/decks/{empty_deck.id}",
            json={"name": ""},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_update_deck_name_too_long_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, empty_deck: Deck
    ):
        """Test name exceeding 255 characters returns 422."""
        response = await client.patch(
            f"/api/v1/decks/{empty_deck.id}",
            json={"name": "A" * 256},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_update_deck_response_has_all_fields(
        self, client: AsyncClient, superuser_auth_headers: dict, empty_deck: Deck
    ):
        """Test that response includes all required fields."""
        response = await client.patch(
            f"/api/v1/decks/{empty_deck.id}",
            json={"name": "Field Test Deck"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        required_fields = [
            "id",
            "name",
            "description",
            "level",
            "is_active",
            "created_at",
            "updated_at",
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"


class TestDeleteDeckEndpoint:
    """Test suite for DELETE /api/v1/decks/{deck_id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_deck_success(
        self, client: AsyncClient, superuser_auth_headers: dict, empty_deck: Deck
    ):
        """Test superuser can delete (soft) a deck successfully."""
        response = await client.delete(
            f"/api/v1/decks/{empty_deck.id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 204
        assert response.content == b""  # No content

    @pytest.mark.asyncio
    async def test_delete_deck_soft_deletes(
        self, client: AsyncClient, superuser_auth_headers: dict, empty_deck: Deck
    ):
        """Test that delete performs soft delete (sets is_active=False)."""
        deck_id = empty_deck.id

        # Delete the deck
        response = await client.delete(
            f"/api/v1/decks/{deck_id}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 204

        # Try to get the deck via public endpoint - should return 404
        get_response = await client.get(f"/api/v1/decks/{deck_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_already_inactive_deck_idempotent(
        self, client: AsyncClient, superuser_auth_headers: dict, inactive_deck: Deck
    ):
        """Test deleting an already-inactive deck is idempotent (returns 204)."""
        response = await client.delete(
            f"/api/v1/decks/{inactive_deck.id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 204
        assert response.content == b""

    @pytest.mark.asyncio
    async def test_delete_deck_twice_idempotent(
        self, client: AsyncClient, superuser_auth_headers: dict, empty_deck: Deck
    ):
        """Test deleting the same deck twice succeeds (idempotent)."""
        deck_id = empty_deck.id

        # First delete
        response1 = await client.delete(
            f"/api/v1/decks/{deck_id}",
            headers=superuser_auth_headers,
        )
        assert response1.status_code == 204

        # Second delete - should also succeed
        response2 = await client.delete(
            f"/api/v1/decks/{deck_id}",
            headers=superuser_auth_headers,
        )
        assert response2.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_deck_unauthenticated_returns_401(
        self, client: AsyncClient, empty_deck: Deck
    ):
        """Test unauthenticated request returns 401."""
        response = await client.delete(f"/api/v1/decks/{empty_deck.id}")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_delete_deck_non_superuser_returns_403(
        self, client: AsyncClient, auth_headers: dict, empty_deck: Deck
    ):
        """Test regular user (non-superuser) returns 403."""
        response = await client.delete(
            f"/api/v1/decks/{empty_deck.id}",
            headers=auth_headers,
        )

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_delete_deck_not_found_returns_404(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test deleting non-existent deck returns 404."""
        non_existent_id = uuid4()

        response = await client.delete(
            f"/api/v1/decks/{non_existent_id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_delete_deck_invalid_uuid_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test invalid UUID format returns 422."""
        response = await client.delete(
            "/api/v1/decks/not-a-valid-uuid",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_deleted_deck_not_visible_in_list(
        self, client: AsyncClient, superuser_auth_headers: dict, deck_with_cards: DeckWithCards
    ):
        """Test that deleted deck is not visible in the list endpoint."""
        deck = deck_with_cards.deck
        deck_id = str(deck.id)

        # Verify deck is in list before deletion
        list_response_before = await client.get("/api/v1/decks")
        deck_ids_before = [d["id"] for d in list_response_before.json()["decks"]]
        assert deck_id in deck_ids_before

        # Delete the deck
        delete_response = await client.delete(
            f"/api/v1/decks/{deck.id}",
            headers=superuser_auth_headers,
        )
        assert delete_response.status_code == 204

        # Verify deck is NOT in list after deletion
        list_response_after = await client.get("/api/v1/decks")
        deck_ids_after = [d["id"] for d in list_response_after.json()["decks"]]
        assert deck_id not in deck_ids_after

    @pytest.mark.asyncio
    async def test_deleted_deck_not_visible_in_search(
        self, client: AsyncClient, superuser_auth_headers: dict, deck_with_cards: DeckWithCards
    ):
        """Test that deleted deck is not visible in search results."""
        deck = deck_with_cards.deck
        deck_id = str(deck.id)

        # Verify deck is in search results before deletion
        search_response_before = await client.get("/api/v1/decks/search?q=Greek")
        deck_ids_before = [d["id"] for d in search_response_before.json()["decks"]]
        assert deck_id in deck_ids_before

        # Delete the deck
        delete_response = await client.delete(
            f"/api/v1/decks/{deck.id}",
            headers=superuser_auth_headers,
        )
        assert delete_response.status_code == 204

        # Verify deck is NOT in search results after deletion
        search_response_after = await client.get("/api/v1/decks/search?q=Greek")
        deck_ids_after = [d["id"] for d in search_response_after.json()["decks"]]
        assert deck_id not in deck_ids_after

    @pytest.mark.asyncio
    async def test_deleted_deck_returns_404_on_get(
        self, client: AsyncClient, superuser_auth_headers: dict, empty_deck: Deck
    ):
        """Test that deleted deck returns 404 on direct GET."""
        deck_id = empty_deck.id

        # Delete the deck
        delete_response = await client.delete(
            f"/api/v1/decks/{deck_id}",
            headers=superuser_auth_headers,
        )
        assert delete_response.status_code == 204

        # Try to GET the deleted deck - should return 404
        get_response = await client.get(f"/api/v1/decks/{deck_id}")
        assert get_response.status_code == 404
        data = get_response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"
