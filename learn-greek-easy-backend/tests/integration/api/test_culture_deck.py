"""Integration tests for Culture Deck API endpoints.

This module tests:
- GET /api/v1/culture/decks - List culture decks with pagination and filtering
- GET /api/v1/culture/decks/{deck_id} - Get culture deck details
- GET /api/v1/culture/categories - Get available categories

All tests use real database connections via the db_session fixture.
All read endpoints require authentication.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureDeck, CultureQuestion

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create a single active culture deck for testing."""
    deck = CultureDeck(
        name_en="Greek History",
        name_el="Ελληνική Ιστορία",
        name_ru="Греческая история",
        description_en="Learn about Greek history",
        description_el="Μάθετε για την ελληνική ιστορία",
        description_ru="Узнайте об истории Греции",
        category="history",
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def culture_deck_with_questions(
    db_session: AsyncSession, culture_deck: CultureDeck
) -> tuple[CultureDeck, list[CultureQuestion]]:
    """Create a culture deck with multiple questions."""
    questions = []
    for i in range(5):
        question = CultureQuestion(
            deck_id=culture_deck.id,
            question_text={
                "en": f"Question {i + 1}?",
                "el": f"Ερώτηση {i + 1};",
            },
            option_a={"en": "Option A", "el": "Επιλογή Α"},
            option_b={"en": "Option B", "el": "Επιλογή Β"},
            option_c={"en": "Option C", "el": "Επιλογή Γ"},
            option_d={"en": "Option D", "el": "Επιλογή Δ"},
            correct_option=1,
            order_index=i,
        )
        db_session.add(question)
        questions.append(question)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)

    return culture_deck, questions


@pytest.fixture
async def inactive_culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an inactive culture deck."""
    deck = CultureDeck(
        name_en="Archived Deck",
        name_el="Αρχειοθετημένο Ντεκ",
        name_ru="Архивированная колода",
        description_en="This deck is archived",
        description_el="Αυτό το ντεκ είναι αρχειοθετημένο",
        description_ru="Эта колода в архиве",
        category="history",
        is_active=False,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def multiple_culture_decks(db_session: AsyncSession) -> list[CultureDeck]:
    """Create multiple culture decks with different categories."""
    decks = []
    categories = ["history", "geography", "politics", "culture", "traditions"]

    for i, category in enumerate(categories):
        deck = CultureDeck(
            name_en=f"{category.title()} Deck",
            name_el=f"Ντεκ {category.title()}",
            name_ru=f"Колода {category.title()}",
            description_en=f"Deck about {category}",
            description_el=f"Ντεκ σχετικά με {category}",
            description_ru=f"Колода о {category}",
            category=category,
            is_active=True,
        )
        db_session.add(deck)
        decks.append(deck)

    await db_session.flush()
    for deck in decks:
        await db_session.refresh(deck)

    return decks


# =============================================================================
# Test List Culture Decks
# =============================================================================


class TestListCultureDecksEndpoint:
    """Test suite for GET /api/v1/culture/decks endpoint."""

    @pytest.mark.asyncio
    async def test_list_decks_unauthenticated_returns_401(self, client: AsyncClient):
        """Test unauthenticated request returns 401."""
        response = await client.get("/api/v1/culture/decks")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_list_decks_empty(self, client: AsyncClient, auth_headers: dict):
        """Test empty database returns empty list."""
        response = await client.get("/api/v1/culture/decks", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["decks"] == []

    @pytest.mark.asyncio
    async def test_list_decks_with_data(
        self, client: AsyncClient, auth_headers: dict, culture_deck_with_questions: tuple
    ):
        """Test returns culture decks when data exists."""
        deck, questions = culture_deck_with_questions

        response = await client.get("/api/v1/culture/decks", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["decks"]) == 1
        assert data["decks"][0]["id"] == str(deck.id)
        assert data["decks"][0]["question_count"] == 5

    @pytest.mark.asyncio
    async def test_list_decks_excludes_inactive(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        inactive_culture_deck: CultureDeck,
    ):
        """Test inactive decks are not included in list."""
        response = await client.get("/api/v1/culture/decks", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        deck_ids = [d["id"] for d in data["decks"]]
        assert str(inactive_culture_deck.id) not in deck_ids

    @pytest.mark.asyncio
    async def test_list_decks_filter_by_category(
        self, client: AsyncClient, auth_headers: dict, multiple_culture_decks: list[CultureDeck]
    ):
        """Test filtering by category."""
        response = await client.get("/api/v1/culture/decks?category=history", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["decks"][0]["category"] == "history"

    @pytest.mark.asyncio
    async def test_list_decks_pagination(
        self, client: AsyncClient, auth_headers: dict, multiple_culture_decks: list[CultureDeck]
    ):
        """Test pagination parameters."""
        # First page
        response = await client.get(
            "/api/v1/culture/decks?page=1&page_size=2", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert len(data["decks"]) == 2

        # Second page
        response2 = await client.get(
            "/api/v1/culture/decks?page=2&page_size=2", headers=auth_headers
        )
        data2 = response2.json()
        assert len(data2["decks"]) == 2

        # Different decks on different pages
        page1_ids = {d["id"] for d in data["decks"]}
        page2_ids = {d["id"] for d in data2["decks"]}
        assert page1_ids.isdisjoint(page2_ids)

    @pytest.mark.asyncio
    async def test_list_decks_response_format(
        self, client: AsyncClient, auth_headers: dict, culture_deck: CultureDeck
    ):
        """Test response includes required fields."""
        response = await client.get("/api/v1/culture/decks", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "decks" in data

        deck = data["decks"][0]
        required_fields = [
            "id",
            "name",
            "description",
            "category",
            "question_count",
            "progress",
        ]
        for field in required_fields:
            assert field in deck, f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_list_decks_user_no_progress(
        self, client: AsyncClient, auth_headers: dict, culture_deck: CultureDeck
    ):
        """Test user who hasn't started deck receives no progress data."""
        response = await client.get("/api/v1/culture/decks", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        # Progress is None because user hasn't started the deck
        assert data["decks"][0]["progress"] is None

    @pytest.mark.asyncio
    async def test_list_decks_invalid_pagination_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test invalid pagination returns 422."""
        response = await client.get("/api/v1/culture/decks?page=0", headers=auth_headers)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_decks_page_size_limit(self, client: AsyncClient, auth_headers: dict):
        """Test page_size over 100 returns 422."""
        response = await client.get("/api/v1/culture/decks?page_size=101", headers=auth_headers)

        assert response.status_code == 422


# =============================================================================
# Test Get Culture Deck
# =============================================================================


class TestGetCultureDeckEndpoint:
    """Test suite for GET /api/v1/culture/decks/{deck_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_deck_unauthenticated_returns_401(
        self, client: AsyncClient, culture_deck: CultureDeck
    ):
        """Test unauthenticated request returns 401."""
        response = await client.get(f"/api/v1/culture/decks/{culture_deck.id}")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_get_deck_success(
        self, client: AsyncClient, auth_headers: dict, culture_deck_with_questions: tuple
    ):
        """Test successfully retrieving a deck."""
        deck, questions = culture_deck_with_questions

        response = await client.get(f"/api/v1/culture/decks/{deck.id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(deck.id)
        # Default locale is English
        assert data["name"] == deck.name_en
        assert data["category"] == "history"
        assert data["question_count"] == 5
        assert data["is_active"] is True
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_get_deck_not_found(self, client: AsyncClient, auth_headers: dict):
        """Test 404 for non-existent deck."""
        non_existent_id = uuid4()

        response = await client.get(
            f"/api/v1/culture/decks/{non_existent_id}", headers=auth_headers
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_get_inactive_deck_returns_404(
        self, client: AsyncClient, auth_headers: dict, inactive_culture_deck: CultureDeck
    ):
        """Test inactive deck returns 404."""
        response = await client.get(
            f"/api/v1/culture/decks/{inactive_culture_deck.id}", headers=auth_headers
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_get_deck_invalid_uuid(self, client: AsyncClient, auth_headers: dict):
        """Test invalid UUID returns 422."""
        response = await client.get("/api/v1/culture/decks/not-a-uuid", headers=auth_headers)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_deck_response_format(
        self, client: AsyncClient, auth_headers: dict, culture_deck: CultureDeck
    ):
        """Test response includes all required fields."""
        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        required_fields = [
            "id",
            "name",
            "description",
            "category",
            "question_count",
            "progress",
            "is_active",
            "created_at",
            "updated_at",
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"


# =============================================================================
# Test Get Categories
# =============================================================================


class TestGetCategoriesEndpoint:
    """Test suite for GET /api/v1/culture/categories endpoint."""

    @pytest.mark.asyncio
    async def test_get_categories_unauthenticated_returns_401(self, client: AsyncClient):
        """Test unauthenticated request returns 401."""
        response = await client.get("/api/v1/culture/categories")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_get_categories_empty(self, client: AsyncClient, auth_headers: dict):
        """Test empty database returns empty list."""
        response = await client.get("/api/v1/culture/categories", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data == []

    @pytest.mark.asyncio
    async def test_get_categories_with_data(
        self, client: AsyncClient, auth_headers: dict, multiple_culture_decks: list[CultureDeck]
    ):
        """Test returns unique categories."""
        response = await client.get("/api/v1/culture/categories", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5  # 5 different categories
        assert "history" in data
        assert "geography" in data
        assert "politics" in data
        assert "culture" in data
        assert "traditions" in data

    @pytest.mark.asyncio
    async def test_get_categories_excludes_inactive(
        self,
        client: AsyncClient,
        auth_headers: dict,
        culture_deck: CultureDeck,
        inactive_culture_deck: CultureDeck,
    ):
        """Test only categories from active decks are returned."""
        # Both decks have category "history"
        response = await client.get("/api/v1/culture/categories", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        # Should only have "history" from the active deck
        assert data == ["history"]


# =============================================================================
# Test Authenticated Access
# =============================================================================


class TestAuthenticatedCultureDeckAccess:
    """Test culture deck endpoints with authenticated users."""

    @pytest.mark.asyncio
    async def test_list_decks_authenticated_user(
        self, client: AsyncClient, auth_headers: dict, culture_deck: CultureDeck
    ):
        """Test authenticated user can list decks (with potential progress)."""
        response = await client.get("/api/v1/culture/decks", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data["decks"]) == 1
        # Progress is None because user hasn't started the deck
        assert data["decks"][0]["progress"] is None

    @pytest.mark.asyncio
    async def test_get_deck_authenticated_user(
        self, client: AsyncClient, auth_headers: dict, culture_deck: CultureDeck
    ):
        """Test authenticated user can get deck details."""
        response = await client.get(
            f"/api/v1/culture/decks/{culture_deck.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(culture_deck.id)

    @pytest.mark.asyncio
    async def test_get_categories_authenticated_user(
        self, client: AsyncClient, auth_headers: dict, culture_deck: CultureDeck
    ):
        """Test authenticated user can get categories."""
        response = await client.get("/api/v1/culture/categories", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "history" in data

    @pytest.mark.asyncio
    async def test_auth_flow_for_culture_deck_endpoints(
        self, client: AsyncClient, auth_headers: dict, culture_deck: CultureDeck
    ):
        """Test that all culture deck read endpoints require authentication."""
        # All these endpoints should return 401 without auth
        unauthenticated_endpoints = [
            "/api/v1/culture/decks",
            f"/api/v1/culture/decks/{culture_deck.id}",
            "/api/v1/culture/categories",
        ]

        for endpoint in unauthenticated_endpoints:
            response = await client.get(endpoint)
            assert (
                response.status_code == 401
            ), f"Expected 401 for {endpoint}, got {response.status_code}"

        # All these endpoints should succeed with auth
        for endpoint in unauthenticated_endpoints:
            response = await client.get(endpoint, headers=auth_headers)
            assert response.status_code in (
                200,
                404,
            ), f"Expected 200/404 for {endpoint}, got {response.status_code}"


# =============================================================================
# Test Culture Deck Localization
# =============================================================================


class TestCultureDeckLocalizationIntegration:
    """Integration tests for culture deck localization with Accept-Language header.

    Tests verify that the API correctly returns localized name and description
    based on the Accept-Language header. Supported locales: en, el, ru.
    """

    # =========================================================================
    # Accept-Language Header Tests - List Culture Decks
    # =========================================================================

    @pytest.mark.asyncio
    async def test_list_culture_decks_english_locale(
        self,
        client: AsyncClient,
        auth_headers: dict,
        localized_culture_deck: CultureDeck,
    ):
        """Test GET /culture/decks returns English with Accept-Language: en."""
        headers = {**auth_headers, "Accept-Language": "en"}
        response = await client.get("/api/v1/culture/decks", headers=headers)

        assert response.status_code == 200
        data = response.json()

        deck = next(d for d in data["decks"] if d["id"] == str(localized_culture_deck.id))
        assert deck["name"] == localized_culture_deck.name_en
        assert deck["description"] == localized_culture_deck.description_en

    @pytest.mark.asyncio
    async def test_list_culture_decks_russian_locale(
        self,
        client: AsyncClient,
        auth_headers: dict,
        localized_culture_deck: CultureDeck,
    ):
        """Test GET /culture/decks returns Russian with Accept-Language: ru."""
        headers = {**auth_headers, "Accept-Language": "ru"}
        response = await client.get("/api/v1/culture/decks", headers=headers)

        assert response.status_code == 200
        data = response.json()

        deck = next(d for d in data["decks"] if d["id"] == str(localized_culture_deck.id))
        assert deck["name"] == localized_culture_deck.name_ru
        assert deck["description"] == localized_culture_deck.description_ru

    @pytest.mark.asyncio
    async def test_list_culture_decks_greek_locale(
        self,
        client: AsyncClient,
        auth_headers: dict,
        localized_culture_deck: CultureDeck,
    ):
        """Test GET /culture/decks returns Greek with Accept-Language: el."""
        headers = {**auth_headers, "Accept-Language": "el"}
        response = await client.get("/api/v1/culture/decks", headers=headers)

        assert response.status_code == 200
        data = response.json()

        deck = next(d for d in data["decks"] if d["id"] == str(localized_culture_deck.id))
        assert deck["name"] == localized_culture_deck.name_el
        assert deck["description"] == localized_culture_deck.description_el

    @pytest.mark.asyncio
    async def test_list_culture_decks_no_header_defaults_to_english(
        self,
        client: AsyncClient,
        auth_headers: dict,
        localized_culture_deck: CultureDeck,
    ):
        """Test missing Accept-Language header defaults to English."""
        response = await client.get("/api/v1/culture/decks", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        deck = next(d for d in data["decks"] if d["id"] == str(localized_culture_deck.id))
        assert deck["name"] == localized_culture_deck.name_en

    # =========================================================================
    # Accept-Language Header Tests - Get Culture Deck Detail
    # =========================================================================

    @pytest.mark.asyncio
    async def test_get_culture_deck_locale_english(
        self,
        client: AsyncClient,
        auth_headers: dict,
        localized_culture_deck: CultureDeck,
    ):
        """Test GET /culture/decks/{id} returns English with Accept-Language: en."""
        headers = {**auth_headers, "Accept-Language": "en"}
        response = await client.get(
            f"/api/v1/culture/decks/{localized_culture_deck.id}",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == localized_culture_deck.name_en
        assert data["description"] == localized_culture_deck.description_en

    @pytest.mark.asyncio
    async def test_get_culture_deck_locale_russian(
        self,
        client: AsyncClient,
        auth_headers: dict,
        localized_culture_deck: CultureDeck,
    ):
        """Test GET /culture/decks/{id} returns Russian with Accept-Language: ru."""
        headers = {**auth_headers, "Accept-Language": "ru"}
        response = await client.get(
            f"/api/v1/culture/decks/{localized_culture_deck.id}",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == localized_culture_deck.name_ru
        assert data["description"] == localized_culture_deck.description_ru

    @pytest.mark.asyncio
    async def test_get_culture_deck_locale_greek(
        self,
        client: AsyncClient,
        auth_headers: dict,
        localized_culture_deck: CultureDeck,
    ):
        """Test GET /culture/decks/{id} returns Greek with Accept-Language: el."""
        headers = {**auth_headers, "Accept-Language": "el"}
        response = await client.get(
            f"/api/v1/culture/decks/{localized_culture_deck.id}",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == localized_culture_deck.name_el
        assert data["description"] == localized_culture_deck.description_el

    @pytest.mark.asyncio
    async def test_culture_deck_unsupported_locale_fallback(
        self,
        client: AsyncClient,
        auth_headers: dict,
        localized_culture_deck: CultureDeck,
    ):
        """Test unsupported locale (de) falls back to English."""
        headers = {**auth_headers, "Accept-Language": "de-DE"}
        response = await client.get(
            f"/api/v1/culture/decks/{localized_culture_deck.id}",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == localized_culture_deck.name_en

    @pytest.mark.asyncio
    async def test_culture_deck_complex_accept_language(
        self,
        client: AsyncClient,
        auth_headers: dict,
        localized_culture_deck: CultureDeck,
    ):
        """Test complex Accept-Language with quality factors."""
        # Greek highest priority
        headers = {**auth_headers, "Accept-Language": "el-GR,el;q=0.9,en;q=0.7"}
        response = await client.get(
            f"/api/v1/culture/decks/{localized_culture_deck.id}",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == localized_culture_deck.name_el
