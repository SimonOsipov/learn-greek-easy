"""Unit tests for authentication dependencies.

Tests cover:
- get_current_user: Supabase token verification + auto-provisioning
- get_current_superuser: Superuser privilege check
- get_current_user_optional: Optional authentication for mixed endpoints
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import Request
from fastapi.security import HTTPAuthorizationCredentials

from src.core.dependencies import get_current_superuser, get_current_user, get_current_user_optional
from src.core.exceptions import ForbiddenException, UnauthorizedException
from src.core.supabase_auth import SupabaseUserClaims


class _FakeState:
    """Minimal request.state stand-in: getattr raises AttributeError for missing keys."""

    pass


# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def mock_request():
    """Create a mock FastAPI request with a real State-like object.

    Using _FakeState (a plain object) instead of MagicMock() ensures that
    getattr(request.state, "current_user", None) returns None until the
    dependency explicitly writes it — matching FastAPI's runtime behaviour.
    """
    request = MagicMock(spec=Request)
    request.state = _FakeState()
    return request


@pytest.fixture
def mock_user():
    """Create a mock user object."""
    user = MagicMock()
    user.id = uuid4()
    user.email = "test@example.com"
    user.full_name = "Test User"
    user.is_active = True
    user.is_superuser = False
    return user


@pytest.fixture
def mock_superuser():
    """Create a mock superuser object."""
    user = MagicMock()
    user.id = uuid4()
    user.email = "admin@example.com"
    user.full_name = "Admin User"
    user.is_active = True
    user.is_superuser = True
    return user


@pytest.fixture
def mock_inactive_user():
    """Create a mock inactive user."""
    user = MagicMock()
    user.id = uuid4()
    user.email = "inactive@example.com"
    user.full_name = "Inactive User"
    user.is_active = False
    user.is_superuser = False
    return user


@pytest.fixture
def valid_credentials():
    """Create valid HTTP authorization credentials."""
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")


@pytest.fixture
def valid_claims():
    """Create valid Supabase user claims."""
    return SupabaseUserClaims(
        supabase_id=str(uuid4()), email="test@example.com", full_name="Test User"
    )


# ============================================================================
# get_current_user Tests
# ============================================================================


class TestGetCurrentUser:
    """Tests for get_current_user dependency."""

    @pytest.mark.asyncio
    async def test_no_credentials_raises_401(self, mock_request):
        """Test that missing credentials raises UnauthorizedException."""
        mock_db = AsyncMock()

        with pytest.raises(UnauthorizedException) as exc_info:
            await get_current_user(mock_request, None, mock_db)

        assert "authentication required" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_invalid_token_raises_401(self, mock_request, valid_credentials):
        """Test that invalid token raises UnauthorizedException."""
        mock_db = AsyncMock()

        with patch("src.core.dependencies.verify_supabase_token") as mock_verify:
            from src.core.exceptions import TokenInvalidException

            mock_verify.side_effect = TokenInvalidException("Invalid token")

            with pytest.raises(UnauthorizedException):
                await get_current_user(mock_request, valid_credentials, mock_db)

    @pytest.mark.asyncio
    async def test_valid_token_returns_user(
        self, mock_request, valid_credentials, valid_claims, mock_user
    ):
        """Test that valid token returns user."""
        mock_db = AsyncMock()

        with (
            patch("src.core.dependencies.verify_supabase_token") as mock_verify,
            patch("src.core.dependencies.get_or_create_user") as mock_get_or_create,
        ):
            mock_verify.return_value = valid_claims
            mock_get_or_create.return_value = mock_user

            user = await get_current_user(mock_request, valid_credentials, mock_db)

            assert user == mock_user
            mock_verify.assert_called_once()
            mock_get_or_create.assert_called_once_with(mock_db, valid_claims)

    @pytest.mark.asyncio
    async def test_inactive_user_raises_401(
        self, mock_request, valid_credentials, valid_claims, mock_inactive_user
    ):
        """Test that inactive user raises UnauthorizedException."""
        mock_db = AsyncMock()

        with (
            patch("src.core.dependencies.verify_supabase_token") as mock_verify,
            patch("src.core.dependencies.get_or_create_user") as mock_get_or_create,
        ):
            mock_verify.return_value = valid_claims
            mock_get_or_create.return_value = mock_inactive_user

            with pytest.raises(UnauthorizedException) as exc_info:
                await get_current_user(mock_request, valid_credentials, mock_db)

            assert "deactivated" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_sets_request_state_user_email(
        self, mock_request, valid_credentials, valid_claims, mock_user
    ):
        """Test that user email is set in request.state."""
        mock_db = AsyncMock()

        with (
            patch("src.core.dependencies.verify_supabase_token") as mock_verify,
            patch("src.core.dependencies.get_or_create_user") as mock_get_or_create,
        ):
            mock_verify.return_value = valid_claims
            mock_get_or_create.return_value = mock_user

            await get_current_user(mock_request, valid_credentials, mock_db)

            assert mock_request.state.user_email == mock_user.email

    @pytest.mark.asyncio
    async def test_memoizes_user_on_request_state(
        self, mock_request, valid_credentials, valid_claims, mock_user
    ):
        """Two resolutions on the SAME request invoke get_or_create_user exactly once.

        The second call short-circuits at the request.state.current_user check
        and never touches the DB or token verification again.
        """
        mock_db = AsyncMock()

        with (
            patch("src.core.dependencies.verify_supabase_token") as mock_verify,
            patch("src.core.dependencies.get_or_create_user") as mock_get_or_create,
        ):
            mock_verify.return_value = valid_claims
            mock_get_or_create.return_value = mock_user

            # First resolution: full path through token verify + DB lookup
            user1 = await get_current_user(mock_request, valid_credentials, mock_db)
            # Second resolution on the SAME request object: short-circuit fires
            user2 = await get_current_user(mock_request, valid_credentials, mock_db)

        assert user1 is mock_user
        assert user2 is mock_user
        # get_or_create_user must have been called exactly once
        mock_get_or_create.assert_called_once()

    @pytest.mark.asyncio
    async def test_distinct_requests_resolve_independently(
        self, valid_credentials, valid_claims, mock_user
    ):
        """Two DISTINCT request objects each resolve the user independently.

        Per-request memo must NOT leak across request boundaries.
        """
        mock_db = AsyncMock()

        request_a = MagicMock(spec=Request)
        request_a.state = _FakeState()
        request_b = MagicMock(spec=Request)
        request_b.state = _FakeState()

        with (
            patch("src.core.dependencies.verify_supabase_token") as mock_verify,
            patch("src.core.dependencies.get_or_create_user") as mock_get_or_create,
        ):
            mock_verify.return_value = valid_claims
            mock_get_or_create.return_value = mock_user

            user_a = await get_current_user(request_a, valid_credentials, mock_db)
            user_b = await get_current_user(request_b, valid_credentials, mock_db)

        assert user_a is mock_user
        assert user_b is mock_user
        # Each distinct request triggers its own DB lookup
        assert mock_get_or_create.call_count == 2

    @pytest.mark.asyncio
    async def test_sets_current_user_on_request_state(
        self, mock_request, valid_credentials, valid_claims, mock_user
    ):
        """Resolved user is stored on request.state.current_user after first resolution."""
        mock_db = AsyncMock()

        with (
            patch("src.core.dependencies.verify_supabase_token") as mock_verify,
            patch("src.core.dependencies.get_or_create_user") as mock_get_or_create,
        ):
            mock_verify.return_value = valid_claims
            mock_get_or_create.return_value = mock_user

            await get_current_user(mock_request, valid_credentials, mock_db)

        assert mock_request.state.current_user is mock_user


# ============================================================================
# get_current_user_optional Tests
# ============================================================================


class TestGetCurrentUserOptional:
    """Tests for get_current_user_optional dependency."""

    @pytest.mark.asyncio
    async def test_no_credentials_returns_none(self, mock_request):
        """Test that missing credentials returns None."""
        mock_db = AsyncMock()

        user = await get_current_user_optional(mock_request, None, mock_db)

        assert user is None

    @pytest.mark.asyncio
    async def test_invalid_token_returns_none(self, mock_request, valid_credentials):
        """Test that invalid token returns None (doesn't raise)."""
        mock_db = AsyncMock()

        with patch("src.core.dependencies.verify_supabase_token") as mock_verify:
            from src.core.exceptions import TokenInvalidException

            mock_verify.side_effect = TokenInvalidException("Invalid token")

            user = await get_current_user_optional(mock_request, valid_credentials, mock_db)

            assert user is None

    @pytest.mark.asyncio
    async def test_valid_token_returns_user(
        self, mock_request, valid_credentials, valid_claims, mock_user
    ):
        """Test that valid token returns user."""
        mock_db = AsyncMock()

        with (
            patch("src.core.dependencies.verify_supabase_token") as mock_verify,
            patch("src.core.dependencies.get_or_create_user") as mock_get_or_create,
        ):
            mock_verify.return_value = valid_claims
            mock_get_or_create.return_value = mock_user

            user = await get_current_user_optional(mock_request, valid_credentials, mock_db)

            assert user == mock_user

    @pytest.mark.asyncio
    async def test_inactive_user_returns_none(
        self, mock_request, valid_credentials, valid_claims, mock_inactive_user
    ):
        """Test that inactive user returns None (doesn't raise)."""
        mock_db = AsyncMock()

        with (
            patch("src.core.dependencies.verify_supabase_token") as mock_verify,
            patch("src.core.dependencies.get_or_create_user") as mock_get_or_create,
        ):
            mock_verify.return_value = valid_claims
            mock_get_or_create.return_value = mock_inactive_user

            user = await get_current_user_optional(mock_request, valid_credentials, mock_db)

            assert user is None


# ============================================================================
# get_current_superuser Tests
# ============================================================================


class TestGetCurrentSuperuser:
    """Tests for get_current_superuser dependency."""

    @pytest.mark.asyncio
    async def test_superuser_allowed(self, mock_superuser):
        """Test that superuser is allowed."""
        # Should not raise
        result = await get_current_superuser(mock_superuser)
        assert result == mock_superuser

    @pytest.mark.asyncio
    async def test_regular_user_forbidden(self, mock_user):
        """Test that regular user is forbidden."""
        with pytest.raises(ForbiddenException) as exc_info:
            await get_current_superuser(mock_user)

        assert "superuser" in str(exc_info.value.detail).lower()
