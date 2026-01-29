"""E2E tests for card operations including search and admin CRUD.

These tests cover the cards API endpoints that have lower coverage:
- GET /api/v1/cards - List cards with pagination and difficulty filter
- GET /api/v1/cards/search - Search cards with multilingual text
- POST /api/v1/cards - Create card (superuser only)
- POST /api/v1/cards/bulk - Bulk create cards (superuser only)

Run with:
    pytest tests/e2e/scenarios/test_card_operations.py -v
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.e2e.conftest import E2ETestCase, UserSession
from tests.factories.content import CardFactory, DeckFactory

# =============================================================================
# Test Card Listing
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestCardListing(E2ETestCase):
    """E2E tests for GET /api/v1/cards endpoint."""

    @pytest.mark.asyncio
    async def test_list_cards_with_pagination(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test listing cards with pagination."""
        # Create a deck with multiple cards
        deck = await DeckFactory.create(session=db_session)
        for i in range(5):
            await CardFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.get(
            "/api/v1/cards",
            params={"deck_id": str(deck.id), "page": 1, "page_size": 2},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert "items" in data or "cards" in data
        items = data.get("items", data.get("cards", []))
        assert len(items) <= 2

    @pytest.mark.asyncio
    async def test_list_cards_response_structure(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that card list response has correct structure."""
        deck = await DeckFactory.create(session=db_session)
        await CardFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        response = await client.get(
            "/api/v1/cards",
            params={"deck_id": str(deck.id)},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Pagination structure
        assert "total" in data or "items" in data or "cards" in data

        items = data.get("items", data.get("cards", []))
        if len(items) > 0:
            card = items[0]
            # Card should have these fields
            assert "id" in card
            assert "deck_id" in card

    @pytest.mark.asyncio
    async def test_list_cards_unauthenticated(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Test that card listing requires authentication."""
        deck = await DeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.get(
            "/api/v1/cards",
            params={"deck_id": str(deck.id)},
        )

        assert response.status_code == 401


# =============================================================================
# Test Card Search
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestCardSearch(E2ETestCase):
    """E2E tests for GET /api/v1/cards/search endpoint."""

    @pytest.mark.asyncio
    async def test_search_cards_by_greek_text(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test searching cards by Greek text."""
        deck = await DeckFactory.create(session=db_session)
        # Create cards with specific Greek words
        await CardFactory.create(
            session=db_session,
            deck_id=deck.id,
            front_text="καλημέρα",  # Good morning
            back_text_en="good morning",
        )
        await CardFactory.create(
            session=db_session,
            deck_id=deck.id,
            front_text="καληνύχτα",  # Good night
            back_text_en="good night",
        )
        await db_session.commit()

        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "καλημ", "deck_id": str(deck.id)},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        items = data.get("items", data.get("cards", data.get("results", [])))

        # Should find the card with "καλημέρα"
        assert len(items) >= 1

    @pytest.mark.asyncio
    async def test_search_cards_by_english_text(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test searching cards by English text."""
        deck = await DeckFactory.create(session=db_session)
        await CardFactory.create(
            session=db_session,
            deck_id=deck.id,
            front_text="σπίτι",
            back_text_en="house",
        )
        await CardFactory.create(
            session=db_session,
            deck_id=deck.id,
            front_text="αυτοκίνητο",
            back_text_en="car",
        )
        await db_session.commit()

        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "house", "deck_id": str(deck.id)},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        items = data.get("items", data.get("cards", data.get("results", [])))

        # Should find the card with "house"
        assert len(items) >= 1

    @pytest.mark.asyncio
    async def test_search_cards_empty_results(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test search returns empty when no match found."""
        deck = await DeckFactory.create(session=db_session)
        await CardFactory.create(
            session=db_session,
            deck_id=deck.id,
            front_text="σπίτι",
            back_text_en="house",
        )
        await db_session.commit()

        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "xyznonexistent", "deck_id": str(deck.id)},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        items = data.get("items", data.get("cards", data.get("results", [])))
        assert len(items) == 0

    @pytest.mark.asyncio
    async def test_search_cards_case_insensitive(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that search is case-insensitive."""
        deck = await DeckFactory.create(session=db_session)
        await CardFactory.create(
            session=db_session,
            deck_id=deck.id,
            front_text="Ελλάδα",
            back_text_en="Greece",
        )
        await db_session.commit()

        # Search with lowercase
        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "greece", "deck_id": str(deck.id)},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        items = data.get("items", data.get("cards", data.get("results", [])))
        # Should find despite case difference
        assert len(items) >= 1

    @pytest.mark.asyncio
    async def test_search_cards_with_pagination(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test search with pagination parameters."""
        deck = await DeckFactory.create(session=db_session)
        # Create multiple cards with similar text
        for i in range(5):
            await CardFactory.create(
                session=db_session,
                deck_id=deck.id,
                front_text=f"λέξη{i}",  # word{i}
                back_text_en=f"word{i}",
            )
        await db_session.commit()

        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "word", "deck_id": str(deck.id), "page": 1, "page_size": 2},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        items = data.get("items", data.get("cards", data.get("results", [])))
        assert len(items) <= 2

    @pytest.mark.asyncio
    async def test_search_cards_unauthenticated(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Test that search requires authentication."""
        deck = await DeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.get(
            "/api/v1/cards/search",
            params={"q": "test", "deck_id": str(deck.id)},
        )

        assert response.status_code == 401


# =============================================================================
# Test Admin Card Operations
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestAdminCardCreate(E2ETestCase):
    """E2E tests for POST /api/v1/cards (superuser only)."""

    @pytest.mark.asyncio
    async def test_create_card_as_superuser(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that superuser can create a card."""
        deck = await DeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.post(
            "/api/v1/cards",
            json={
                "deck_id": str(deck.id),
                "front_text": "νερό",
                "back_text_en": "water",
            },
            headers=admin_session.headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["front_text"] == "νερό"
        assert data["back_text_en"] == "water"

    @pytest.mark.asyncio
    async def test_create_card_forbidden_for_regular_user(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that regular user cannot create a card."""
        deck = await DeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.post(
            "/api/v1/cards",
            json={
                "deck_id": str(deck.id),
                "front_text": "test",
                "back_text_en": "test",
            },
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_create_card_deck_not_found(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test that creating card for non-existent deck returns error."""
        fake_deck_id = str(uuid4())

        response = await client.post(
            "/api/v1/cards",
            json={
                "deck_id": fake_deck_id,
                "front_text": "test",
                "back_text_en": "test",
            },
            headers=admin_session.headers,
        )

        # API returns 422 (validation) or 404 (not found)
        assert response.status_code in [404, 422]


@pytest.mark.e2e
@pytest.mark.scenario
class TestAdminCardBulkCreate(E2ETestCase):
    """E2E tests for POST /api/v1/cards/bulk (superuser only)."""

    @pytest.mark.asyncio
    async def test_bulk_create_cards_as_superuser(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that superuser can bulk create cards."""
        deck = await DeckFactory.create(session=db_session)
        await db_session.commit()

        cards = [{"front_text": f"word{i}", "back_text_en": f"λέξη{i}"} for i in range(5)]

        response = await client.post(
            "/api/v1/cards/bulk",
            json={
                "deck_id": str(deck.id),
                "cards": cards,
            },
            headers=admin_session.headers,
        )

        assert response.status_code == 201
        data = response.json()
        # Should have created 5 cards
        assert len(data.get("cards", data.get("items", []))) == 5

    @pytest.mark.asyncio
    async def test_bulk_create_empty_array_rejected(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that empty cards array is rejected."""
        deck = await DeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.post(
            "/api/v1/cards/bulk",
            json={
                "deck_id": str(deck.id),
                "cards": [],
            },
            headers=admin_session.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_bulk_create_deck_not_found(
        self,
        client: AsyncClient,
        admin_session: UserSession,
    ) -> None:
        """Test that bulk creating for non-existent deck returns error."""
        fake_deck_id = str(uuid4())

        response = await client.post(
            "/api/v1/cards/bulk",
            json={
                "deck_id": fake_deck_id,
                "cards": [
                    {"front_text": "test", "back_text_en": "test"},
                ],
            },
            headers=admin_session.headers,
        )

        # API returns 422 (validation) or 404 (not found)
        assert response.status_code in [404, 422]

    @pytest.mark.asyncio
    async def test_bulk_create_forbidden_for_regular_user(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that regular user cannot bulk create cards."""
        deck = await DeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.post(
            "/api/v1/cards/bulk",
            json={
                "deck_id": str(deck.id),
                "cards": [{"front_text": "test", "back_text_en": "test"}],
            },
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 403


# =============================================================================
# Test Card Validation
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestCardValidation(E2ETestCase):
    """E2E tests for card input validation."""

    @pytest.mark.asyncio
    async def test_create_card_missing_front_text(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that missing front_text is rejected."""
        deck = await DeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.post(
            "/api/v1/cards",
            json={
                "deck_id": str(deck.id),
                "back_text_en": "translation",
                # front_text missing
            },
            headers=admin_session.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_card_missing_back_text(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that missing back_text is rejected."""
        deck = await DeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.post(
            "/api/v1/cards",
            json={
                "deck_id": str(deck.id),
                "front_text": "word",
                # back_text missing
            },
            headers=admin_session.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_card_invalid_part_of_speech(
        self,
        client: AsyncClient,
        admin_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that invalid part_of_speech value is rejected."""
        deck = await DeckFactory.create(session=db_session)
        await db_session.commit()

        response = await client.post(
            "/api/v1/cards",
            json={
                "deck_id": str(deck.id),
                "front_text": "word",
                "back_text_en": "translation",
                "part_of_speech": "invalid_pos",  # Invalid (must be noun/verb/adjective/adverb)
            },
            headers=admin_session.headers,
        )

        assert response.status_code == 422
