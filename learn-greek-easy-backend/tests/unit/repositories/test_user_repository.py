"""Unit tests for UserRepository.

This module tests:
- get_by_auth0_id: Get user by Auth0 ID

Tests use real database fixtures to verify SQL queries work correctly.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User
from src.repositories.user import UserRepository
from tests.factories.auth import UserFactory


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def user_with_auth0_id(db_session: AsyncSession) -> User:
    """Create a user with auth0_id for testing."""
    user = User(
        email="auth0_test@example.com",
        password_hash=None,
        full_name="Auth0 User",
        is_active=True,
        auth0_id="auth0|507f1f77bcf86cd799439011",
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


# =============================================================================
# Test get_by_auth0_id
# =============================================================================


class TestGetByAuth0Id:
    """Tests for UserRepository.get_by_auth0_id()"""

    @pytest.mark.asyncio
    async def test_returns_user_when_found(
        self,
        db_session: AsyncSession,
        user_with_auth0_id: User,
    ):
        """Should return user when auth0_id matches."""
        repo = UserRepository(db_session)

        result = await repo.get_by_auth0_id("auth0|507f1f77bcf86cd799439011")

        assert result is not None
        assert result.id == user_with_auth0_id.id
        assert result.auth0_id == "auth0|507f1f77bcf86cd799439011"
        assert result.email == "auth0_test@example.com"

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(
        self,
        db_session: AsyncSession,
    ):
        """Should return None when auth0_id doesn't exist."""
        repo = UserRepository(db_session)

        result = await repo.get_by_auth0_id("auth0|nonexistent")

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_for_empty_string(
        self,
        db_session: AsyncSession,
        user_with_auth0_id: User,
    ):
        """Should return None when searching with empty string."""
        repo = UserRepository(db_session)

        result = await repo.get_by_auth0_id("")

        assert result is None

    @pytest.mark.asyncio
    async def test_handles_special_characters_in_auth0_id(
        self,
        db_session: AsyncSession,
    ):
        """Should handle Auth0 IDs with special characters."""
        # Auth0 IDs can contain pipes and other characters
        special_auth0_id = "auth0|abc123-def456_ghi789"
        user = User(
            email="special_auth0@example.com",
            password_hash=None,
            full_name="Special Auth0 User",
            is_active=True,
            auth0_id=special_auth0_id,
        )
        db_session.add(user)
        await db_session.flush()

        repo = UserRepository(db_session)

        result = await repo.get_by_auth0_id(special_auth0_id)

        assert result is not None
        assert result.auth0_id == special_auth0_id

    @pytest.mark.asyncio
    async def test_uses_factory_with_auth0_trait(
        self,
        db_session: AsyncSession,
    ):
        """Should work with UserFactory auth0 trait."""
        # Create user using factory with auth0 trait
        user = await UserFactory.create(session=db_session, auth0=True)
        await db_session.flush()

        repo = UserRepository(db_session)

        # The factory generates an auth0_id like "auth0|<uuid_hex>"
        result = await repo.get_by_auth0_id(user.auth0_id)

        assert result is not None
        assert result.id == user.id
        assert result.password_hash is None  # Auth0 users have no local password
        assert result.email_verified_at is not None  # Auth0 users are verified
