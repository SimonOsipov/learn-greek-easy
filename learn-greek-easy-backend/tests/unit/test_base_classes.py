"""Tests for base test classes and auth fixtures.

This module verifies that:
- BaseTestCase utility methods work correctly
- AuthenticatedTestCase auth methods work correctly
- Auth fixtures create valid users and tokens
- Token fixtures are properly formatted
- Error fixtures (expired, invalid) behave correctly
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DeckLevel, User
from tests.base import AuthenticatedTestCase, BaseTestCase
from tests.fixtures.auth import AuthenticatedUser

# =============================================================================
# BaseTestCase Tests
# =============================================================================


class TestBaseTestCaseUserCreation(BaseTestCase):
    """Tests for BaseTestCase user creation methods."""

    async def test_create_test_user_basic(self, db_session: AsyncSession):
        """Test creating a basic test user."""
        user = await self.create_test_user(db_session)

        assert user is not None
        assert user.id is not None
        assert user.email is not None
        assert "@example.com" in user.email
        assert user.is_active is True
        assert user.is_superuser is False
        assert user.settings is not None

    async def test_create_test_user_custom_email(self, db_session: AsyncSession):
        """Test creating a user with custom email."""
        email = "custom@test.com"
        user = await self.create_test_user(db_session, email=email)

        assert user.email == email

    async def test_create_test_user_superuser(self, db_session: AsyncSession):
        """Test creating a superuser."""
        user = await self.create_test_user(db_session, is_superuser=True)

        assert user.is_superuser is True

    async def test_create_test_user_inactive(self, db_session: AsyncSession):
        """Test creating an inactive user."""
        user = await self.create_test_user(db_session, is_active=False)

        assert user.is_active is False

    async def test_create_test_superuser_helper(self, db_session: AsyncSession):
        """Test the create_test_superuser helper method."""
        user = await self.create_test_superuser(db_session)

        assert user.is_superuser is True
        assert user.is_active is True


class TestBaseTestCaseDeckCardCreation(BaseTestCase):
    """Tests for BaseTestCase deck and card creation methods."""

    async def test_create_test_deck(self, db_session: AsyncSession):
        """Test creating a test deck."""
        deck = await self.create_test_deck(db_session)

        assert deck is not None
        assert deck.id is not None
        assert deck.name_en == "Test Deck"
        assert deck.level == DeckLevel.A1
        assert deck.is_active is True

    async def test_create_test_deck_custom(self, db_session: AsyncSession):
        """Test creating a deck with custom attributes."""
        deck = await self.create_test_deck(
            db_session,
            name="Greek B2 Vocabulary",
            level=DeckLevel.B2,
        )

        assert deck.name_en == "Greek B2 Vocabulary"
        assert deck.level == DeckLevel.B2

    async def test_create_test_card(self, db_session: AsyncSession):
        """Test creating a test card."""
        deck = await self.create_test_deck(db_session)
        card = await self.create_test_card(db_session, deck)

        assert card is not None
        assert card.id is not None
        assert card.deck_id == deck.id
        assert card.front_text == "Hello"
        assert card.back_text_en == "Yeia"

    async def test_create_deck_with_cards(self, db_session: AsyncSession):
        """Test creating a deck with multiple cards."""
        deck, cards = await self.create_deck_with_cards(
            db_session,
            name="Test Deck with Cards",
            card_count=5,
        )

        assert deck is not None
        assert len(cards) == 5
        for i, card in enumerate(cards):
            assert card.deck_id == deck.id


class TestBaseTestCaseDatabaseHelpers(BaseTestCase):
    """Tests for BaseTestCase database helper methods."""

    async def test_count_table_rows(self, db_session: AsyncSession):
        """Test counting table rows."""
        # Create some users
        for i in range(3):
            await self.create_test_user(db_session)

        count = await self.count_table_rows(db_session, "users")
        assert count >= 3

    async def test_table_exists(self, db_session: AsyncSession):
        """Test checking if table exists."""
        assert await self.table_exists(db_session, "users") is True
        assert await self.table_exists(db_session, "nonexistent_table") is False

    async def test_get_entity_by_id(self, db_session: AsyncSession):
        """Test getting entity by ID."""
        user = await self.create_test_user(db_session)

        found_user = await self.get_entity_by_id(db_session, User, user.id)
        assert found_user is not None
        assert found_user.id == user.id


class TestBaseTestCaseTimestampUtilities(BaseTestCase):
    """Tests for BaseTestCase timestamp utilities."""

    def test_utc_now(self):
        """Test getting current UTC time."""
        now = self.utc_now()
        assert now is not None

    def test_days_ago(self):
        """Test getting past timestamp."""
        past = self.days_ago(7)
        now = self.utc_now()
        assert past < now

    def test_days_from_now(self):
        """Test getting future timestamp."""
        future = self.days_from_now(7)
        now = self.utc_now()
        assert future > now


class TestBaseTestCaseAssertions(BaseTestCase):
    """Tests for BaseTestCase assertion helpers."""

    async def test_assert_user_created(self, db_session: AsyncSession):
        """Test the assert_user_created helper."""
        user = await self.create_test_user(db_session, email="test@test.com")
        # Should not raise
        self.assert_user_created(user, email="test@test.com")


# =============================================================================
# AuthenticatedTestCase Tests
# =============================================================================


class TestAuthenticatedTestCaseAuthUtilities(AuthenticatedTestCase):
    """Tests for AuthenticatedTestCase auth utilities."""

    def test_create_auth_headers(self):
        """Test creating auth headers."""
        headers = self.create_auth_headers()

        assert "Authorization" in headers
        assert headers["Authorization"].startswith("Bearer ")
        assert headers["Authorization"] == "Bearer test-supabase-token"


class TestAuthenticatedTestCaseAssertions(AuthenticatedTestCase):
    """Tests for AuthenticatedTestCase assertion helpers."""

    async def test_assert_unauthorized(self, client: AsyncClient):
        """Test detecting unauthorized response."""
        response = await client.get("/api/v1/auth/me")
        # Should not raise
        self.assert_unauthorized(response)


# =============================================================================
# Auth Fixtures Tests
# =============================================================================


class TestAuthFixturesUserCreation:
    """Tests for auth fixture user creation."""

    async def test_test_user_fixture(self, test_user: User):
        """Test that test_user fixture creates valid user."""
        assert test_user is not None
        assert test_user.id is not None
        assert test_user.email is not None
        assert test_user.is_active is True
        assert test_user.is_superuser is False
        assert test_user.settings is not None

    async def test_test_superuser_fixture(self, test_superuser: User):
        """Test that test_superuser fixture creates admin user."""
        assert test_superuser is not None
        assert test_superuser.is_superuser is True
        assert test_superuser.is_active is True

    async def test_test_inactive_user_fixture(self, test_inactive_user: User):
        """Test that test_inactive_user is inactive."""
        assert test_inactive_user is not None
        assert test_inactive_user.is_active is False

    async def test_two_users_fixture(self, two_users: tuple[User, User]):
        """Test that two_users fixture creates different users."""
        user1, user2 = two_users
        assert user1.id != user2.id
        assert user1.email != user2.email


# Token creation tests removed - Supabase handles JWT tokens


class TestAuthFixturesHeaders:
    """Tests for auth fixture header creation."""

    async def test_auth_headers_fixture(self, auth_headers: dict[str, str]):
        """Test that auth_headers has correct format."""
        assert "Authorization" in auth_headers
        assert auth_headers["Authorization"].startswith("Bearer ")
        # Token should be present after "Bearer "
        token = auth_headers["Authorization"].replace("Bearer ", "")
        assert len(token) > 0  # Just verify token exists (dependency override handles auth)

    async def test_superuser_auth_headers_fixture(
        self,
        superuser_auth_headers: dict[str, str],
    ):
        """Test that superuser_auth_headers has correct format."""
        assert "Authorization" in superuser_auth_headers
        assert superuser_auth_headers["Authorization"].startswith("Bearer ")


class TestAuthFixturesBundles:
    """Tests for auth fixture bundles."""

    async def test_authenticated_user_bundle(
        self,
        authenticated_user: AuthenticatedUser,
    ):
        """Test that authenticated_user bundle contains all components."""
        assert authenticated_user.user is not None
        assert authenticated_user.headers is not None
        assert authenticated_user.user.id is not None

    async def test_authenticated_superuser_bundle(
        self,
        authenticated_superuser: AuthenticatedUser,
    ):
        """Test that authenticated_superuser bundle contains admin user."""
        assert authenticated_superuser.user.is_superuser is True


class TestAuthFixturesErrorCases:
    """Tests for auth fixtures that test error cases."""

    def test_invalid_token_fixture(self, invalid_token: str):
        """Test that invalid_token is properly invalid."""
        assert invalid_token == "invalid.token.string"

    def test_invalid_auth_headers_fixture(self, invalid_auth_headers: dict[str, str]):
        """Test that invalid_auth_headers has correct format."""
        assert "Authorization" in invalid_auth_headers
        assert invalid_auth_headers["Authorization"].startswith("Bearer ")
        assert "invalid.token.string" in invalid_auth_headers["Authorization"]


# =============================================================================
# Integration Tests with HTTP Client
# =============================================================================


@pytest.mark.integration
class TestAuthenticatedHTTPRequests(AuthenticatedTestCase):
    """Test making authenticated HTTP requests."""

    async def test_unauthenticated_request_fails(self, client: AsyncClient):
        """Test that unauthenticated request to protected endpoint fails."""
        response = await client.get("/api/v1/auth/me")

        self.assert_unauthorized(response)

    async def test_invalid_token_fails(self, client: AsyncClient):
        """Test that invalid token returns 401."""
        headers = {"Authorization": "Bearer invalid-token"}
        response = await client.get("/api/v1/auth/me", headers=headers)

        self.assert_unauthorized(response)
