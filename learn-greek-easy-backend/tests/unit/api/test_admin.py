"""Unit tests for Admin API endpoints.

Tests cover:
- Admin stats retrieval (GET /api/v1/admin/stats)
- Admin deck listing with search and pagination (GET /api/v1/admin/decks)
- Authentication requirements (401 without token)
- Authorization requirements (403 for non-superusers)
- Response structure validation
- Type filtering (vocabulary/culture)
- Search functionality (case-insensitive)
- Pagination (page, page_size, total)
- Sorting by created_at DESC
- Filtering of inactive decks
- Edge cases (empty database, decks with no cards/questions)
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.content import CardFactory, DeckFactory
from tests.factories.culture import CultureDeckFactory, CultureQuestionFactory

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


# =============================================================================
# TestAdminDecks - Tests for GET /api/v1/admin/decks
# =============================================================================


class TestAdminDecks:
    """Tests for GET /api/v1/admin/decks endpoint."""

    # =========================================================================
    # P0 - Critical Tests (9 tests)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_list_decks_requires_auth(
        self,
        client: AsyncClient,
    ):
        """Test that endpoint returns 401 without authentication."""
        response = await client.get("/api/v1/admin/decks")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_decks_requires_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that endpoint returns 403 for non-superusers."""
        response = await client.get(
            "/api/v1/admin/decks",
            headers=auth_headers,
        )
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "FORBIDDEN"
        assert "superuser" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_list_decks_success_for_superuser(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that endpoint returns 200 for superusers."""
        # Create a test deck
        await DeckFactory.create(session=db_session, is_active=True)

        response = await client.get(
            "/api/v1/admin/decks",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "decks" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data

    @pytest.mark.asyncio
    async def test_list_decks_empty_database(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that endpoint returns empty list when no decks exist."""
        response = await client.get(
            "/api/v1/admin/decks",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["decks"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_list_decks_returns_vocabulary_decks(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that endpoint returns vocabulary decks correctly."""
        deck = await DeckFactory.create(
            session=db_session,
            name="Test Vocabulary Deck",
            is_active=True,
        )

        response = await client.get(
            "/api/v1/admin/decks",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["decks"]) >= 1

        # Find our deck
        deck_data = next((d for d in data["decks"] if d["id"] == str(deck.id)), None)
        assert deck_data is not None
        assert deck_data["type"] == "vocabulary"
        assert deck_data["name"] == "Test Vocabulary Deck"

    @pytest.mark.asyncio
    async def test_list_decks_returns_culture_decks(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that endpoint returns culture decks correctly."""
        culture_deck = await CultureDeckFactory.create(
            session=db_session,
            name="Test Culture Deck",
            is_active=True,
        )

        response = await client.get(
            "/api/v1/admin/decks",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["decks"]) >= 1

        # Find our deck
        deck_data = next(
            (d for d in data["decks"] if d["id"] == str(culture_deck.id)), None
        )
        assert deck_data is not None
        assert deck_data["type"] == "culture"
        assert deck_data["name"] == "Test Culture Deck"

    @pytest.mark.asyncio
    async def test_list_decks_returns_both_types(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that endpoint returns both vocabulary and culture decks when both exist."""
        vocab_deck = await DeckFactory.create(
            session=db_session,
            name="Vocabulary Test",
            is_active=True,
        )
        culture_deck = await CultureDeckFactory.create(
            session=db_session,
            name="Culture Test",
            is_active=True,
        )

        response = await client.get(
            "/api/v1/admin/decks",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Find both decks
        deck_ids = [d["id"] for d in data["decks"]]
        assert str(vocab_deck.id) in deck_ids
        assert str(culture_deck.id) in deck_ids

        # Verify types
        types = {d["id"]: d["type"] for d in data["decks"]}
        assert types[str(vocab_deck.id)] == "vocabulary"
        assert types[str(culture_deck.id)] == "culture"

    @pytest.mark.asyncio
    async def test_vocabulary_deck_response_structure(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that vocabulary deck has correct structure (category is None)."""
        deck = await DeckFactory.create(
            session=db_session,
            name="Structure Test Vocab",
            a1=True,
            is_active=True,
        )

        response = await client.get(
            "/api/v1/admin/decks",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Find our deck
        deck_data = next((d for d in data["decks"] if d["id"] == str(deck.id)), None)
        assert deck_data is not None

        # Verify structure
        assert deck_data["type"] == "vocabulary"
        assert deck_data["level"] == "A1"
        assert deck_data["category"] is None
        assert "item_count" in deck_data
        assert "is_active" in deck_data
        assert "created_at" in deck_data

    @pytest.mark.asyncio
    async def test_culture_deck_response_structure(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that culture deck has correct structure (level is None)."""
        culture_deck = await CultureDeckFactory.create(
            session=db_session,
            name="Structure Test Culture",
            category="geography",
            is_active=True,
        )

        response = await client.get(
            "/api/v1/admin/decks",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Find our deck
        deck_data = next(
            (d for d in data["decks"] if d["id"] == str(culture_deck.id)), None
        )
        assert deck_data is not None

        # Verify structure
        assert deck_data["type"] == "culture"
        assert deck_data["level"] is None
        assert deck_data["category"] == "geography"
        assert "item_count" in deck_data
        assert "is_active" in deck_data
        assert "created_at" in deck_data

    # =========================================================================
    # P1 - High Priority Tests (7 tests)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_filter_type_vocabulary_only(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that type=vocabulary returns only vocabulary decks."""
        vocab_deck = await DeckFactory.create(
            session=db_session,
            name="Vocab Only Test",
            is_active=True,
        )
        culture_deck = await CultureDeckFactory.create(
            session=db_session,
            name="Culture Filter Test",
            is_active=True,
        )

        response = await client.get(
            "/api/v1/admin/decks?type=vocabulary",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # All returned decks should be vocabulary
        for deck in data["decks"]:
            assert deck["type"] == "vocabulary"

        # Vocab deck should be present, culture deck should not
        deck_ids = [d["id"] for d in data["decks"]]
        assert str(vocab_deck.id) in deck_ids
        assert str(culture_deck.id) not in deck_ids

    @pytest.mark.asyncio
    async def test_filter_type_culture_only(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that type=culture returns only culture decks."""
        vocab_deck = await DeckFactory.create(
            session=db_session,
            name="Vocab Filter Test",
            is_active=True,
        )
        culture_deck = await CultureDeckFactory.create(
            session=db_session,
            name="Culture Only Test",
            is_active=True,
        )

        response = await client.get(
            "/api/v1/admin/decks?type=culture",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # All returned decks should be culture
        for deck in data["decks"]:
            assert deck["type"] == "culture"

        # Culture deck should be present, vocab deck should not
        deck_ids = [d["id"] for d in data["decks"]]
        assert str(culture_deck.id) in deck_ids
        assert str(vocab_deck.id) not in deck_ids

    @pytest.mark.asyncio
    async def test_filter_type_invalid_returns_422(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that invalid type value returns 422."""
        response = await client.get(
            "/api/v1/admin/decks?type=invalid",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_search_filters_vocabulary_decks_by_name(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that search filters vocabulary decks by name."""
        matching_deck = await DeckFactory.create(
            session=db_session,
            name="Alpha Vocabulary",
            is_active=True,
        )
        non_matching_deck = await DeckFactory.create(
            session=db_session,
            name="Beta Learning",
            is_active=True,
        )

        response = await client.get(
            "/api/v1/admin/decks?search=Alpha",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        deck_ids = [d["id"] for d in data["decks"]]
        assert str(matching_deck.id) in deck_ids
        assert str(non_matching_deck.id) not in deck_ids

    @pytest.mark.asyncio
    async def test_search_filters_culture_decks_by_name(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that search filters culture decks by name."""
        matching_deck = await CultureDeckFactory.create(
            session=db_session,
            name="Greek History",
            is_active=True,
        )
        non_matching_deck = await CultureDeckFactory.create(
            session=db_session,
            name="Politics Quiz",
            is_active=True,
        )

        response = await client.get(
            "/api/v1/admin/decks?search=History",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        deck_ids = [d["id"] for d in data["decks"]]
        assert str(matching_deck.id) in deck_ids
        assert str(non_matching_deck.id) not in deck_ids

    @pytest.mark.asyncio
    async def test_search_is_case_insensitive(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that search is case-insensitive."""
        deck = await DeckFactory.create(
            session=db_session,
            name="UPPERCASE Deck",
            is_active=True,
        )

        response = await client.get(
            "/api/v1/admin/decks?search=uppercase",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        deck_ids = [d["id"] for d in data["decks"]]
        assert str(deck.id) in deck_ids

    @pytest.mark.asyncio
    async def test_search_no_matches_returns_empty_list(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that search with no matches returns empty list."""
        await DeckFactory.create(
            session=db_session,
            name="Regular Deck",
            is_active=True,
        )

        response = await client.get(
            "/api/v1/admin/decks?search=NONEXISTENT",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["decks"] == []
        assert data["total"] == 0

    # =========================================================================
    # P2 - Medium Priority Tests (8 tests)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_pagination_default_values(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that default pagination is page=1, page_size=10."""
        # Create 5 decks
        for i in range(5):
            await DeckFactory.create(
                session=db_session,
                name=f"Deck {i}",
                is_active=True,
            )

        response = await client.get(
            "/api/v1/admin/decks",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 10

    @pytest.mark.asyncio
    async def test_pagination_custom_page_size(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that custom page_size limits results."""
        # Create 10 decks
        for i in range(10):
            await DeckFactory.create(
                session=db_session,
                name=f"Page Size Deck {i}",
                is_active=True,
            )

        response = await client.get(
            "/api/v1/admin/decks?page_size=3",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["decks"]) == 3
        assert data["page_size"] == 3
        assert data["total"] >= 10

    @pytest.mark.asyncio
    async def test_pagination_page_2_returns_correct_results(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that page 2 returns correct results."""
        # Create 6 decks
        for i in range(6):
            await DeckFactory.create(
                session=db_session,
                name=f"Pagination Deck {i}",
                is_active=True,
            )

        # Get page 1 with size 3
        response_page1 = await client.get(
            "/api/v1/admin/decks?page=1&page_size=3",
            headers=superuser_auth_headers,
        )
        data_page1 = response_page1.json()

        # Get page 2 with size 3
        response_page2 = await client.get(
            "/api/v1/admin/decks?page=2&page_size=3",
            headers=superuser_auth_headers,
        )

        assert response_page2.status_code == 200
        data_page2 = response_page2.json()

        assert data_page2["page"] == 2
        assert len(data_page2["decks"]) == 3

        # Ensure different decks on page 1 and 2
        page1_ids = {d["id"] for d in data_page1["decks"]}
        page2_ids = {d["id"] for d in data_page2["decks"]}
        assert page1_ids.isdisjoint(page2_ids)

    @pytest.mark.asyncio
    async def test_pagination_beyond_data_returns_empty(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that page beyond data returns empty list."""
        await DeckFactory.create(
            session=db_session,
            name="Only One Deck",
            is_active=True,
        )

        response = await client.get(
            "/api/v1/admin/decks?page=100&page_size=10",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["decks"] == []
        assert data["page"] == 100

    @pytest.mark.asyncio
    async def test_pagination_page_zero_returns_422(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that page=0 returns 422."""
        response = await client.get(
            "/api/v1/admin/decks?page=0",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_pagination_page_size_zero_returns_422(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that page_size=0 returns 422."""
        response = await client.get(
            "/api/v1/admin/decks?page_size=0",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_pagination_page_size_exceeds_max_returns_422(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that page_size > 100 returns 422."""
        response = await client.get(
            "/api/v1/admin/decks?page_size=101",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_pagination_total_reflects_all_matching(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that total count reflects all matching decks."""
        # Create 15 decks with same prefix
        for i in range(15):
            await DeckFactory.create(
                session=db_session,
                name=f"TotalTest Deck {i}",
                is_active=True,
            )

        response = await client.get(
            "/api/v1/admin/decks?search=TotalTest&page_size=5",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["decks"]) == 5  # Limited by page_size
        assert data["total"] == 15  # Total reflects all matching

    # =========================================================================
    # P3 - Low Priority Tests (6 tests)
    # =========================================================================

    @pytest.mark.asyncio
    async def test_results_sorted_by_created_at_desc(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that results are sorted by created_at DESC."""
        # Create decks in sequence
        deck1 = await DeckFactory.create(
            session=db_session,
            name="First Created",
            is_active=True,
        )
        deck2 = await DeckFactory.create(
            session=db_session,
            name="Second Created",
            is_active=True,
        )
        deck3 = await DeckFactory.create(
            session=db_session,
            name="Third Created",
            is_active=True,
        )

        response = await client.get(
            "/api/v1/admin/decks",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Find indices of our decks (should be in reverse creation order)
        deck_ids = [d["id"] for d in data["decks"]]
        idx1 = deck_ids.index(str(deck1.id))
        idx2 = deck_ids.index(str(deck2.id))
        idx3 = deck_ids.index(str(deck3.id))

        # Newest (deck3) should come first
        assert idx3 < idx2 < idx1

    @pytest.mark.asyncio
    async def test_mixed_types_sorted_together_by_created_at(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that mixed types are sorted together by created_at."""
        vocab_deck = await DeckFactory.create(
            session=db_session,
            name="Vocab Mixed Sort",
            is_active=True,
        )
        culture_deck = await CultureDeckFactory.create(
            session=db_session,
            name="Culture Mixed Sort",
            is_active=True,
        )

        response = await client.get(
            "/api/v1/admin/decks",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        deck_ids = [d["id"] for d in data["decks"]]
        vocab_idx = deck_ids.index(str(vocab_deck.id))
        culture_idx = deck_ids.index(str(culture_deck.id))

        # Culture deck was created after, so should come first
        assert culture_idx < vocab_idx

    @pytest.mark.asyncio
    async def test_inactive_decks_excluded(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that inactive decks are excluded from results."""
        active_deck = await DeckFactory.create(
            session=db_session,
            name="Active Deck",
            is_active=True,
        )
        inactive_deck = await DeckFactory.create(
            session=db_session,
            name="Inactive Deck",
            is_active=False,
        )

        response = await client.get(
            "/api/v1/admin/decks",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        deck_ids = [d["id"] for d in data["decks"]]
        assert str(active_deck.id) in deck_ids
        assert str(inactive_deck.id) not in deck_ids

    @pytest.mark.asyncio
    async def test_deck_with_zero_items_shows_item_count_zero(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that deck with zero items shows item_count=0."""
        empty_deck = await DeckFactory.create(
            session=db_session,
            name="Empty Deck",
            is_active=True,
        )

        response = await client.get(
            "/api/v1/admin/decks",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        deck_data = next(
            (d for d in data["decks"] if d["id"] == str(empty_deck.id)), None
        )
        assert deck_data is not None
        assert deck_data["item_count"] == 0

    @pytest.mark.asyncio
    async def test_search_combined_with_type_filter(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that search combined with type filter works."""
        vocab_matching = await DeckFactory.create(
            session=db_session,
            name="Combined Vocabulary",
            is_active=True,
        )
        culture_matching = await CultureDeckFactory.create(
            session=db_session,
            name="Combined Culture",
            is_active=True,
        )
        vocab_not_matching = await DeckFactory.create(
            session=db_session,
            name="Other Deck",
            is_active=True,
        )

        response = await client.get(
            "/api/v1/admin/decks?search=Combined&type=vocabulary",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        deck_ids = [d["id"] for d in data["decks"]]
        # Should include vocab matching
        assert str(vocab_matching.id) in deck_ids
        # Should exclude culture (wrong type)
        assert str(culture_matching.id) not in deck_ids
        # Should exclude vocab not matching (wrong name)
        assert str(vocab_not_matching.id) not in deck_ids

    @pytest.mark.asyncio
    async def test_item_count_reflects_actual_card_question_count(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that item_count reflects actual card/question count."""
        # Create vocabulary deck with cards
        vocab_deck = await DeckFactory.create(
            session=db_session,
            name="Deck With Cards",
            is_active=True,
        )
        for _ in range(7):
            await CardFactory.create(session=db_session, deck_id=vocab_deck.id)

        # Create culture deck with questions
        culture_deck = await CultureDeckFactory.create(
            session=db_session,
            name="Deck With Questions",
            is_active=True,
        )
        for _ in range(5):
            await CultureQuestionFactory.create(
                session=db_session, deck_id=culture_deck.id
            )

        response = await client.get(
            "/api/v1/admin/decks",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Check vocabulary deck item count
        vocab_data = next(
            (d for d in data["decks"] if d["id"] == str(vocab_deck.id)), None
        )
        assert vocab_data is not None
        assert vocab_data["item_count"] == 7

        # Check culture deck item count
        culture_data = next(
            (d for d in data["decks"] if d["id"] == str(culture_deck.id)), None
        )
        assert culture_data is not None
        assert culture_data["item_count"] == 5
