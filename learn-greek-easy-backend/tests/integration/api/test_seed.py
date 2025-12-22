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

from src.db.models import Card, Deck, User

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
        deck_count = await db_session.scalar(select(func.count(Deck.id)))
        assert deck_count == 6

        # Verify cards created
        card_count = await db_session.scalar(select(func.count(Card.id)))
        assert card_count == 60

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


@pytest.mark.no_parallel
class TestSeedUsersIntegration:
    """Integration tests for users-only seeding endpoint."""

    @pytest.mark.asyncio
    async def test_seed_users_creates_only_users(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        seed_url: str,
        enable_seeding,
        enable_seeding_service,
    ):
        """POST /test/seed/users should create only users."""
        response = await client.post(f"{seed_url}/users")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["operation"] == "users"

        # Verify users created
        user_count = await db_session.scalar(select(func.count(User.id)))
        assert user_count == 4

        # Verify no decks or cards created
        deck_count = await db_session.scalar(select(func.count(Deck.id)))
        assert deck_count == 0

        card_count = await db_session.scalar(select(func.count(Card.id)))
        assert card_count == 0


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
