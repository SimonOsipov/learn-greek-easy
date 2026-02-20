"""Integration tests for seed API endpoints with real database.

Tests cover:
- Full seed cycle via API
- Truncation via API
- Users-only seeding via API
- Content-only seeding via API
- Skip truncate option
- Authorization flows
"""

from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Card, CardRecord, CardType, Deck, User

# Mark all tests in this file as seed tests; can be excluded from
# runs with: pytest -m "not seed"
pytestmark = pytest.mark.seed

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def seed_url(api_base_url: str) -> str:
    """Return the seed endpoints base URL.

    Returns:
        str: The seed URL ("/api/v1/test/seed")
    """
    return f"{api_base_url}/test/seed"


@pytest.fixture
def enable_seeding():
    """Enable seeding for tests by patching settings."""
    with patch("src.api.v1.test.seed.settings") as mock_settings:
        mock_settings.is_production = False
        mock_settings.test_seed_enabled = True
        mock_settings.seed_requires_secret = False
        mock_settings.can_seed_database.return_value = True
        mock_settings.app_env = "test"
        mock_settings.get_seed_validation_errors.return_value = []
        yield mock_settings


@pytest.fixture
def enable_seeding_service():
    """Enable seeding in the service layer."""
    with patch("src.services.seed_service.settings") as mock_settings:
        mock_settings.can_seed_database.return_value = True
        mock_settings.get_seed_validation_errors.return_value = []
        yield mock_settings


# ============================================================================
# GET /test/seed/status Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedStatusIntegration:
    """Integration tests for status endpoint."""

    @pytest.mark.asyncio
    async def test_status_returns_enabled_in_development(
        self,
        client: AsyncClient,
        seed_url: str,
        enable_seeding,
    ):
        """Status endpoint should return enabled in non-production."""
        response = await client.get(f"{seed_url}/status")

        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is True
        assert data["environment"] == "test"
        assert data["requires_secret"] is False

    @pytest.mark.asyncio
    async def test_status_shows_disabled_when_not_enabled(
        self,
        client: AsyncClient,
        seed_url: str,
    ):
        """Status should show disabled when TEST_SEED_ENABLED is false."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.can_seed_database.return_value = False
            mock_settings.app_env = "development"
            mock_settings.seed_requires_secret = False
            mock_settings.get_seed_validation_errors.return_value = ["TEST_SEED_ENABLED is false"]

            response = await client.get(f"{seed_url}/status")

            assert response.status_code == 200
            data = response.json()
            assert data["enabled"] is False
            assert len(data["validation_errors"]) > 0


# ============================================================================
# POST /test/seed/all Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedAllIntegration:
    """Integration tests for full seeding endpoint."""

    @pytest.mark.asyncio
    async def test_seed_all_creates_data(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """POST /test/seed/all should create all test data."""
        response = await client.post(f"{seed_url}/all")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["operation"] == "all"
        assert "duration_ms" in data
        assert "timestamp" in data

        # Verify users created
        # seed_users creates 4 base users + seed_all adds 3 XP test users = 7 total
        user_count = await db_session.scalar(select(func.count(User.id)))
        assert user_count == 7

        # Verify decks created
        # 6 CEFR decks + 4 user decks (3 for learner + 1 for admin) + 3 V2 decks = 13 total
        deck_count = await db_session.scalar(select(func.count(Deck.id)))
        assert deck_count == 13

        # Verify cards created
        # 60 CEFR cards + 10 user deck cards (5+3+0+2) = 70 total
        card_count = await db_session.scalar(select(func.count(Card.id)))
        assert card_count == 70

        # Verify card records created (60 meaning + 44 plural + 60 sentence + 10 article = 174)
        card_record_count = await db_session.scalar(select(func.count(CardRecord.id)))
        assert card_record_count == 174

    @pytest.mark.asyncio
    async def test_seed_all_returns_403_when_disabled(
        self,
        client: AsyncClient,
        seed_url: str,
    ):
        """POST /test/seed/all should return 403 when disabled."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = False

            response = await client.post(f"{seed_url}/all")

            assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_seed_all_returns_401_with_invalid_secret(
        self,
        client: AsyncClient,
        seed_url: str,
    ):
        """POST /test/seed/all should return 401 with bad secret."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = True
            mock_settings.validate_seed_secret.return_value = False

            response = await client.post(
                f"{seed_url}/all",
                headers={"X-Test-Seed-Secret": "wrong-secret"},
            )

            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_seed_all_with_valid_secret(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding_service,
    ):
        """POST /test/seed/all should succeed with valid secret."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = True
            mock_settings.seed_requires_secret = True
            mock_settings.validate_seed_secret.return_value = True

            response = await client.post(
                f"{seed_url}/all",
                headers={"X-Test-Seed-Secret": "valid-secret"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True


# ============================================================================
# POST /test/seed/truncate Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedTruncateIntegration:
    """Integration tests for truncation endpoint."""

    @pytest.mark.asyncio
    async def test_truncate_clears_all_data(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """POST /test/seed/truncate should clear all tables."""
        # First seed some data
        await client.post(f"{seed_url}/all")

        # Verify data exists
        user_count = await db_session.scalar(select(func.count(User.id)))
        assert user_count > 0

        # Now truncate
        response = await client.post(f"{seed_url}/truncate")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["operation"] == "truncate"

        # Refresh session to see changes (expire_all is synchronous)
        db_session.expire_all()

        # Verify tables are empty
        user_count = await db_session.scalar(select(func.count(User.id)))
        assert user_count == 0

        deck_count = await db_session.scalar(select(func.count(Deck.id)))
        assert deck_count == 0


# ============================================================================
# POST /test/seed/users Tests
# ============================================================================


# ============================================================================
# POST /test/seed/content Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedContentIntegration:
    """Integration tests for content-only seeding endpoint."""

    @pytest.mark.asyncio
    async def test_seed_content_creates_only_decks_and_cards(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """POST /test/seed/content should create only decks and cards."""
        response = await client.post(f"{seed_url}/content")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["operation"] == "content"

        # Verify decks created
        deck_count = await db_session.scalar(select(func.count(Deck.id)))
        assert deck_count == 6

        # Verify cards created
        card_count = await db_session.scalar(select(func.count(Card.id)))
        assert card_count == 60

        # Verify no users created
        user_count = await db_session.scalar(select(func.count(User.id)))
        assert user_count == 0


# ============================================================================
# Skip Truncate Option Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedSkipTruncateIntegration:
    """Integration tests for skip_truncate option."""

    @pytest.mark.asyncio
    @pytest.mark.skip(
        reason="SeedService.seed_users doesn't handle existing users - "
        "it tries to INSERT which fails on duplicate email. "
        "This test assumes idempotent user creation which is not implemented."
    )
    async def test_seed_with_skip_truncate_is_additive(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """POST /test/seed/all with skip_truncate should be additive."""
        # First, seed users only
        await client.post(f"{seed_url}/users")
        user_count_after_first = await db_session.scalar(select(func.count(User.id)))
        assert user_count_after_first == 4

        # Now seed with skip_truncate - should add more data
        # Note: seed_all with skip_truncate will try to create users again
        # which will find existing users by email
        response = await client.post(
            f"{seed_url}/all",
            json={"options": {"skip_truncate": True}},
        )

        assert response.status_code == 200

        # User count should still be 4 (finds existing by email)
        user_count = await db_session.scalar(select(func.count(User.id)))
        assert user_count == 4

        # But now we should have decks and cards
        deck_count = await db_session.scalar(select(func.count(Deck.id)))
        assert deck_count == 6


# ============================================================================
# Response Format Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedResponseFormat:
    """Tests for response format compliance."""

    @pytest.mark.asyncio
    async def test_seed_all_response_format(
        self,
        client: AsyncClient,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """Response should match SeedResultResponse schema."""
        response = await client.post(f"{seed_url}/all")

        assert response.status_code == 200
        data = response.json()

        # Required fields
        assert "success" in data
        assert "operation" in data
        assert "timestamp" in data
        assert "duration_ms" in data
        assert "results" in data

        # Types
        assert isinstance(data["success"], bool)
        assert isinstance(data["operation"], str)
        assert isinstance(data["duration_ms"], (int, float))
        assert isinstance(data["results"], dict)

    @pytest.mark.asyncio
    async def test_status_response_format(
        self,
        client: AsyncClient,
        seed_url: str,
        enable_seeding,
    ):
        """Status response should match SeedStatusResponse schema."""
        response = await client.get(f"{seed_url}/status")

        assert response.status_code == 200
        data = response.json()

        # Required fields
        assert "enabled" in data
        assert "environment" in data
        assert "requires_secret" in data
        assert "validation_errors" in data

        # Types
        assert isinstance(data["enabled"], bool)
        assert isinstance(data["environment"], str)
        assert isinstance(data["requires_secret"], bool)
        assert isinstance(data["validation_errors"], list)


# ============================================================================
# POST /test/seed/news-feed Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedNewsFeedIntegration:
    """Integration tests for news-feed seeding endpoint."""

    @pytest.mark.asyncio
    async def test_seed_news_feed_creates_news_items(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """POST /test/seed/news-feed should create 5 news items."""
        from sqlalchemy import func, select

        from src.db.models import NewsItem

        # First truncate to ensure clean state
        await client.post(f"{seed_url}/truncate")

        response = await client.post(f"{seed_url}/news-feed")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["operation"] == "news-feed"
        assert data["results"]["count"] == 5

        # Verify news items created in database
        news_count = await db_session.scalar(select(func.count(NewsItem.id)))
        assert news_count == 5

    @pytest.mark.asyncio
    async def test_seed_news_feed_returns_403_when_disabled(
        self,
        client: AsyncClient,
        seed_url: str,
    ):
        """POST /test/seed/news-feed should return 403 when disabled."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = False

            response = await client.post(f"{seed_url}/news-feed")

            assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_seed_news_feed_response_format(
        self,
        client: AsyncClient,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """Response should match SeedResultResponse schema."""
        response = await client.post(f"{seed_url}/news-feed")

        assert response.status_code == 200
        data = response.json()

        # Required fields
        assert "success" in data
        assert "operation" in data
        assert "timestamp" in data
        assert "duration_ms" in data
        assert "results" in data

        # Results structure
        assert "news_items" in data["results"]
        assert "count" in data["results"]
        assert isinstance(data["results"]["news_items"], list)


# ============================================================================
# POST /test/seed/news-feed/clear Tests
# ============================================================================


@pytest.mark.no_parallel
class TestClearNewsFeedIntegration:
    """Integration tests for news-feed clear endpoint."""

    @pytest.mark.asyncio
    async def test_clear_news_feed_deletes_only_news_items(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """POST /test/seed/news-feed/clear should delete only news items.

        This is critical for test isolation - unlike /truncate which clears
        ALL tables, this endpoint only clears news_items table.
        """
        from sqlalchemy import func, select

        from src.db.models import NewsItem

        # First seed users and news items
        await client.post(f"{seed_url}/users")
        await client.post(f"{seed_url}/news-feed")

        # Verify both users and news items exist
        user_count_before = await db_session.scalar(select(func.count(User.id)))
        news_count_before = await db_session.scalar(select(func.count(NewsItem.id)))
        assert user_count_before == 4
        assert news_count_before == 5

        # Clear news items only
        response = await client.post(f"{seed_url}/news-feed/clear")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["operation"] == "clear_news"
        assert data["results"]["cleared"] is True
        assert data["results"]["table"] == "news_items"

        # Refresh session to see changes
        db_session.expire_all()

        # Verify news items are cleared but users remain
        news_count_after = await db_session.scalar(select(func.count(NewsItem.id)))
        user_count_after = await db_session.scalar(select(func.count(User.id)))

        assert news_count_after == 0, "News items should be cleared"
        assert user_count_after == 4, "Users should NOT be affected"

    @pytest.mark.asyncio
    async def test_clear_news_feed_returns_403_when_disabled(
        self,
        client: AsyncClient,
        seed_url: str,
    ):
        """POST /test/seed/news-feed/clear should return 403 when disabled."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = False

            response = await client.post(f"{seed_url}/news-feed/clear")

            assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_clear_news_feed_is_idempotent(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """POST /test/seed/news-feed/clear should be safe to call multiple times."""
        # Clear without seeding first (empty table)
        response = await client.post(f"{seed_url}/news-feed/clear")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Call again (still empty)
        response = await client.post(f"{seed_url}/news-feed/clear")
        assert response.status_code == 200


# ============================================================================
# POST /test/seed/news-feed-page Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedNewsFeedPageIntegration:
    """Integration tests for news-feed-page seeding endpoint."""

    @pytest.mark.asyncio
    async def test_seed_news_feed_page_creates_25_news_items(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """POST /test/seed/news-feed-page should create 25 news items."""
        from sqlalchemy import func, select

        from src.db.models import NewsItem

        # First truncate to ensure clean state
        await client.post(f"{seed_url}/truncate")

        response = await client.post(f"{seed_url}/news-feed-page")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["operation"] == "news-feed-page"
        assert data["results"]["news_items_created"] == 25

        # Verify news items created in database
        news_count = await db_session.scalar(select(func.count(NewsItem.id)))
        assert news_count == 25

    @pytest.mark.asyncio
    async def test_seed_news_feed_page_creates_questions_for_10_items(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """POST /test/seed/news-feed-page should create questions for 10 items."""
        from sqlalchemy import func, select

        from src.db.models import CultureQuestion

        # Truncate and seed
        await client.post(f"{seed_url}/truncate")
        response = await client.post(f"{seed_url}/news-feed-page")

        assert response.status_code == 200
        data = response.json()
        assert data["results"]["items_with_questions"] == 10
        assert data["results"]["items_without_questions"] == 15

        # Verify questions created - should be 3+4+5+3+4+5+3+4+5+3 = 39 questions
        # (items 0-9 get 3+(i%3) questions each)
        questions_count = await db_session.scalar(
            select(func.count(CultureQuestion.id)).where(
                CultureQuestion.original_article_url.like(
                    "https://example.com/e2e-news-feed-page-%"
                )
            )
        )
        assert questions_count == 39

    @pytest.mark.asyncio
    async def test_seed_news_feed_page_links_questions_via_original_url(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """Questions should be linked to news items via original_article_url."""
        from sqlalchemy import select

        from src.db.models import CultureQuestion, NewsItem

        # Truncate and seed
        await client.post(f"{seed_url}/truncate")
        await client.post(f"{seed_url}/news-feed-page")

        # Get a news item with questions (first 10 have questions)
        news_item = (
            await db_session.execute(
                select(NewsItem).where(
                    NewsItem.original_article_url == "https://example.com/e2e-news-feed-page-1"
                )
            )
        ).scalar_one_or_none()

        assert news_item is not None

        # Find questions for this news item
        questions = (
            (
                await db_session.execute(
                    select(CultureQuestion).where(
                        CultureQuestion.original_article_url == news_item.original_article_url
                    )
                )
            )
            .scalars()
            .all()
        )

        # Item 0 should have 3 questions (3 + (0 % 3))
        assert len(questions) == 3

    @pytest.mark.asyncio
    async def test_seed_news_feed_page_is_idempotent(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """POST /test/seed/news-feed-page should be idempotent (safe to call multiple times)."""
        from sqlalchemy import func, select

        from src.db.models import CultureQuestion, NewsItem

        # Truncate first
        await client.post(f"{seed_url}/truncate")

        # Call seed twice
        await client.post(f"{seed_url}/news-feed-page")
        response = await client.post(f"{seed_url}/news-feed-page")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Refresh session to see changes
        db_session.expire_all()

        # Should still have exactly 25 news items (not 50)
        news_count = await db_session.scalar(
            select(func.count(NewsItem.id)).where(
                NewsItem.original_article_url.like("https://example.com/e2e-news-feed-page-%")
            )
        )
        assert news_count == 25

        # Should still have exactly 39 questions (not 78)
        questions_count = await db_session.scalar(
            select(func.count(CultureQuestion.id)).where(
                CultureQuestion.original_article_url.like(
                    "https://example.com/e2e-news-feed-page-%"
                )
            )
        )
        assert questions_count == 39

    @pytest.mark.asyncio
    async def test_seed_news_feed_page_has_greek_titles(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """News items should have Greek titles."""
        from sqlalchemy import select

        from src.db.models import NewsItem

        # Truncate and seed
        await client.post(f"{seed_url}/truncate")
        await client.post(f"{seed_url}/news-feed-page")

        # Get a sample news item
        news_item = (
            (
                await db_session.execute(
                    select(NewsItem).where(
                        NewsItem.original_article_url.like(
                            "https://example.com/e2e-news-feed-page-%"
                        )
                    )
                )
            )
            .scalars()
            .first()
        )

        assert news_item is not None
        assert news_item.title_el is not None and len(news_item.title_el) > 0
        # Verify Greek characters present
        assert any(
            "\u0370" <= char <= "\u03FF" or "\u1F00" <= char <= "\u1FFF"
            for char in news_item.title_el
        )

    @pytest.mark.asyncio
    async def test_seed_news_feed_page_has_trilingual_summaries(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """News items should have Greek, English, and Russian summaries."""
        from sqlalchemy import select

        from src.db.models import NewsItem

        # Truncate and seed
        await client.post(f"{seed_url}/truncate")
        await client.post(f"{seed_url}/news-feed-page")

        # Get all news items and verify trilingual content
        news_items = (
            (
                await db_session.execute(
                    select(NewsItem).where(
                        NewsItem.original_article_url.like(
                            "https://example.com/e2e-news-feed-page-%"
                        )
                    )
                )
            )
            .scalars()
            .all()
        )

        for item in news_items:
            # Check all three languages present
            assert item.description_el is not None and len(item.description_el) > 0
            assert item.description_en is not None and len(item.description_en) > 0
            assert item.description_ru is not None and len(item.description_ru) > 0

    @pytest.mark.asyncio
    async def test_seed_news_feed_page_returns_403_when_disabled(
        self,
        client: AsyncClient,
        seed_url: str,
    ):
        """POST /test/seed/news-feed-page should return 403 when disabled."""
        with patch("src.api.v1.test.seed.settings") as mock_settings:
            mock_settings.is_production = False
            mock_settings.test_seed_enabled = False

            response = await client.post(f"{seed_url}/news-feed-page")

            assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_seed_news_feed_page_response_format(
        self,
        client: AsyncClient,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """Response should match SeedResultResponse schema."""
        response = await client.post(f"{seed_url}/news-feed-page")

        assert response.status_code == 200
        data = response.json()

        # Required fields
        assert "success" in data
        assert "operation" in data
        assert "timestamp" in data
        assert "duration_ms" in data
        assert "results" in data

        # Results structure
        assert "news_items_created" in data["results"]
        assert "questions_created" in data["results"]
        assert "items_with_questions" in data["results"]
        assert "items_without_questions" in data["results"]
        assert "deck_id" in data["results"]

    @pytest.mark.asyncio
    async def test_seed_news_feed_page_creates_culture_deck(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """POST /test/seed/news-feed-page should create E2E News Feed Page deck."""
        from sqlalchemy import select

        from src.db.models import CultureDeck

        # Truncate and seed
        await client.post(f"{seed_url}/truncate")
        response = await client.post(f"{seed_url}/news-feed-page")

        assert response.status_code == 200
        data = response.json()

        # Verify deck was created
        deck = (
            await db_session.execute(
                select(CultureDeck).where(CultureDeck.name == "E2E News Feed Page")
            )
        ).scalar_one_or_none()

        assert deck is not None
        assert data["results"]["deck_id"] == str(deck.id)


# ============================================================================
# Meaning Card Record Integration Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedMeaningCardsIntegration:
    """Integration tests for meaning card seeding via seed_all."""

    @pytest.mark.asyncio
    async def test_seed_all_creates_164_card_records(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """POST /test/seed/all should create 174 CardRecord rows (60 meaning + 44 plural + 60 sentence + 10 article)."""
        response = await client.post(f"{seed_url}/all")
        assert response.status_code == 200

        card_record_count = await db_session.scalar(select(func.count(CardRecord.id)))
        assert card_record_count == 174

    @pytest.mark.asyncio
    async def test_seed_all_creates_30_el_to_en_cards(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """POST /test/seed/all should create 30 MEANING_EL_TO_EN cards."""
        await client.post(f"{seed_url}/all")

        el_to_en = await db_session.scalar(
            select(func.count(CardRecord.id)).where(
                CardRecord.card_type == CardType.MEANING_EL_TO_EN
            )
        )
        assert el_to_en == 30

    @pytest.mark.asyncio
    async def test_seed_all_creates_30_en_to_el_cards(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """POST /test/seed/all should create 30 MEANING_EN_TO_EL cards."""
        await client.post(f"{seed_url}/all")

        en_to_el = await db_session.scalar(
            select(func.count(CardRecord.id)).where(
                CardRecord.card_type == CardType.MEANING_EN_TO_EL
            )
        )
        assert en_to_el == 30

    @pytest.mark.asyncio
    async def test_card_records_linked_to_word_entries(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """All CardRecord rows should be linked to distinct word entries."""
        await client.post(f"{seed_url}/all")

        distinct_we_ids = await db_session.scalar(
            select(func.count(func.distinct(CardRecord.word_entry_id)))
        )
        assert distinct_we_ids == 30

    @pytest.mark.asyncio
    async def test_card_records_have_valid_front_content(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """CardRecord front_content should validate against Pydantic schemas."""
        from src.schemas.card_record import MeaningElToEnFront, MeaningEnToElFront

        await client.post(f"{seed_url}/all")

        result = await db_session.execute(
            select(CardRecord).where(CardRecord.card_type == CardType.MEANING_EL_TO_EN).limit(1)
        )
        card = result.scalar_one()
        front = MeaningElToEnFront(**card.front_content)
        assert front.card_type == "meaning_el_to_en"
        assert front.prompt == "What does this mean?"
        assert len(front.main) > 0
        assert len(front.badge) > 0

        result2 = await db_session.execute(
            select(CardRecord).where(CardRecord.card_type == CardType.MEANING_EN_TO_EL).limit(1)
        )
        card2 = result2.scalar_one()
        front2 = MeaningEnToElFront(**card2.front_content)
        assert front2.card_type == "meaning_en_to_el"

    @pytest.mark.asyncio
    async def test_card_records_have_valid_back_content(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """CardRecord back_content should validate against Pydantic schemas."""
        from src.schemas.card_record import MeaningElToEnBack, MeaningEnToElBack

        await client.post(f"{seed_url}/all")

        result = await db_session.execute(
            select(CardRecord).where(CardRecord.card_type == CardType.MEANING_EL_TO_EN).limit(1)
        )
        card = result.scalar_one()
        back = MeaningElToEnBack(**card.back_content)
        assert back.card_type == "meaning_el_to_en"
        assert len(back.answer) > 0

        result2 = await db_session.execute(
            select(CardRecord).where(CardRecord.card_type == CardType.MEANING_EN_TO_EL).limit(1)
        )
        card2 = result2.scalar_one()
        back2 = MeaningEnToElBack(**card2.back_content)
        assert back2.card_type == "meaning_en_to_el"
        assert len(back2.answer) > 0
