"""Unit tests for authentication dependencies.

Tests cover:
- get_current_user: Token validation, user loading, inactive user handling
- get_current_superuser: Superuser privilege check
- get_current_user_optional: Optional authentication for mixed endpoints
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi.security import HTTPAuthorizationCredentials

from src.core.dependencies import get_current_superuser, get_current_user, get_current_user_optional
from src.core.exceptions import (
    ForbiddenException,
    TokenExpiredException,
    TokenInvalidException,
    UnauthorizedException,
    UserNotFoundException,
)

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def sample_user_id() -> UUID:
    """Provide a sample user UUID for testing."""
    return uuid4()


@pytest.fixture
def mock_user(sample_user_id: UUID) -> MagicMock:
    """Create a mock user object."""
    user = MagicMock()
    user.id = sample_user_id
    user.email = "test@example.com"
    user.full_name = "Test User"
    user.is_active = True
    user.is_superuser = False
    user.email_verified_at = None
    user.created_at = datetime.utcnow()
    user.updated_at = datetime.utcnow()
    user.settings = MagicMock()
    return user


@pytest.fixture
def mock_superuser(sample_user_id: UUID) -> MagicMock:
    """Create a mock superuser object."""
    user = MagicMock()
    user.id = sample_user_id
    user.email = "admin@example.com"
    user.full_name = "Admin User"
    user.is_active = True
    user.is_superuser = True
    user.email_verified_at = datetime.utcnow()
    user.created_at = datetime.utcnow()
    user.updated_at = datetime.utcnow()
    user.settings = MagicMock()
    return user


@pytest.fixture
def mock_inactive_user(sample_user_id: UUID) -> MagicMock:
    """Create a mock inactive user object."""
    user = MagicMock()
    user.id = sample_user_id
    user.email = "inactive@example.com"
    user.full_name = "Inactive User"
    user.is_active = False
    user.is_superuser = False
    user.settings = MagicMock()
    return user


@pytest.fixture
def mock_credentials() -> HTTPAuthorizationCredentials:
    """Create mock HTTP credentials with a sample token."""
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-jwt-token-123")


@pytest.fixture
def mock_db_session() -> AsyncMock:
    """Create a mock async database session."""
    session = AsyncMock()
    return session


# ============================================================================
# get_current_user Tests
# ============================================================================


class TestGetCurrentUser:
    """Tests for get_current_user dependency."""

    @pytest.mark.asyncio
    async def test_no_credentials_raises_unauthorized(self, mock_db_session: AsyncMock) -> None:
        """Test that missing credentials raises UnauthorizedException."""
        with pytest.raises(UnauthorizedException) as exc_info:
            await get_current_user(credentials=None, db=mock_db_session)

        assert "Authentication required" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_expired_token_raises_unauthorized(
        self,
        mock_credentials: HTTPAuthorizationCredentials,
        mock_db_session: AsyncMock,
    ) -> None:
        """Test that expired token raises UnauthorizedException."""
        with patch("src.core.dependencies.verify_token") as mock_verify:
            mock_verify.side_effect = TokenExpiredException()

            with pytest.raises(UnauthorizedException) as exc_info:
                await get_current_user(credentials=mock_credentials, db=mock_db_session)

            assert "expired" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_invalid_token_raises_unauthorized(
        self,
        mock_credentials: HTTPAuthorizationCredentials,
        mock_db_session: AsyncMock,
    ) -> None:
        """Test that invalid token raises UnauthorizedException."""
        with patch("src.core.dependencies.verify_token") as mock_verify:
            mock_verify.side_effect = TokenInvalidException(detail="Malformed token")

            with pytest.raises(UnauthorizedException) as exc_info:
                await get_current_user(credentials=mock_credentials, db=mock_db_session)

            assert "Invalid access token" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_user_not_found_raises_not_found(
        self,
        mock_credentials: HTTPAuthorizationCredentials,
        mock_db_session: AsyncMock,
        sample_user_id: UUID,
    ) -> None:
        """Test that missing user raises UserNotFoundException."""
        with patch("src.core.dependencies.verify_token") as mock_verify:
            mock_verify.return_value = sample_user_id

            # Mock the database query to return None
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_db_session.execute.return_value = mock_result

            with pytest.raises(UserNotFoundException):
                await get_current_user(credentials=mock_credentials, db=mock_db_session)

    @pytest.mark.asyncio
    async def test_inactive_user_raises_unauthorized(
        self,
        mock_credentials: HTTPAuthorizationCredentials,
        mock_db_session: AsyncMock,
        sample_user_id: UUID,
        mock_inactive_user: MagicMock,
    ) -> None:
        """Test that inactive user raises UnauthorizedException."""
        with patch("src.core.dependencies.verify_token") as mock_verify:
            mock_verify.return_value = sample_user_id

            # Mock the database query to return inactive user
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_inactive_user
            mock_db_session.execute.return_value = mock_result

            with pytest.raises(UnauthorizedException) as exc_info:
                await get_current_user(credentials=mock_credentials, db=mock_db_session)

            assert "deactivated" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_valid_token_returns_user(
        self,
        mock_credentials: HTTPAuthorizationCredentials,
        mock_db_session: AsyncMock,
        sample_user_id: UUID,
        mock_user: MagicMock,
    ) -> None:
        """Test that valid token returns the user."""
        with patch("src.core.dependencies.verify_token") as mock_verify:
            mock_verify.return_value = sample_user_id

            # Mock the database query to return active user
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_user
            mock_db_session.execute.return_value = mock_result

            result = await get_current_user(credentials=mock_credentials, db=mock_db_session)

            assert result == mock_user
            mock_verify.assert_called_once_with(mock_credentials.credentials, token_type="access")

    @pytest.mark.asyncio
    async def test_verifies_access_token_type(
        self,
        mock_credentials: HTTPAuthorizationCredentials,
        mock_db_session: AsyncMock,
        sample_user_id: UUID,
        mock_user: MagicMock,
    ) -> None:
        """Test that verify_token is called with token_type='access'."""
        with patch("src.core.dependencies.verify_token") as mock_verify:
            mock_verify.return_value = sample_user_id

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_user
            mock_db_session.execute.return_value = mock_result

            await get_current_user(credentials=mock_credentials, db=mock_db_session)

            # Verify the token_type argument
            call_args = mock_verify.call_args
            assert call_args[1]["token_type"] == "access"


# ============================================================================
# get_current_superuser Tests
# ============================================================================


class TestGetCurrentSuperuser:
    """Tests for get_current_superuser dependency."""

    @pytest.mark.asyncio
    async def test_regular_user_raises_forbidden(self, mock_user: MagicMock) -> None:
        """Test that non-superuser raises ForbiddenException."""
        with pytest.raises(ForbiddenException) as exc_info:
            await get_current_superuser(current_user=mock_user)

        assert "Superuser privileges required" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_superuser_returns_user(self, mock_superuser: MagicMock) -> None:
        """Test that superuser is returned successfully."""
        result = await get_current_superuser(current_user=mock_superuser)
        assert result == mock_superuser

    @pytest.mark.asyncio
    async def test_superuser_check_uses_is_superuser_flag(self, mock_user: MagicMock) -> None:
        """Test that the is_superuser flag is checked."""
        # Start with regular user
        assert mock_user.is_superuser is False
        with pytest.raises(ForbiddenException):
            await get_current_superuser(current_user=mock_user)

        # Promote to superuser
        mock_user.is_superuser = True
        result = await get_current_superuser(current_user=mock_user)
        assert result == mock_user


# ============================================================================
# get_current_user_optional Tests
# ============================================================================


class TestGetCurrentUserOptional:
    """Tests for get_current_user_optional dependency."""

    @pytest.mark.asyncio
    async def test_no_credentials_returns_none(self, mock_db_session: AsyncMock) -> None:
        """Test that missing credentials returns None (anonymous user)."""
        result = await get_current_user_optional(credentials=None, db=mock_db_session)
        assert result is None

    @pytest.mark.asyncio
    async def test_expired_token_returns_none(
        self,
        mock_credentials: HTTPAuthorizationCredentials,
        mock_db_session: AsyncMock,
    ) -> None:
        """Test that expired token returns None (anonymous user)."""
        with patch("src.core.dependencies.verify_token") as mock_verify:
            mock_verify.side_effect = TokenExpiredException()

            result = await get_current_user_optional(
                credentials=mock_credentials, db=mock_db_session
            )

            assert result is None

    @pytest.mark.asyncio
    async def test_invalid_token_returns_none(
        self,
        mock_credentials: HTTPAuthorizationCredentials,
        mock_db_session: AsyncMock,
    ) -> None:
        """Test that invalid token returns None (anonymous user)."""
        with patch("src.core.dependencies.verify_token") as mock_verify:
            mock_verify.side_effect = TokenInvalidException(detail="Bad token")

            result = await get_current_user_optional(
                credentials=mock_credentials, db=mock_db_session
            )

            assert result is None

    @pytest.mark.asyncio
    async def test_user_not_found_returns_none(
        self,
        mock_credentials: HTTPAuthorizationCredentials,
        mock_db_session: AsyncMock,
        sample_user_id: UUID,
    ) -> None:
        """Test that missing user returns None (anonymous user)."""
        with patch("src.core.dependencies.verify_token") as mock_verify:
            mock_verify.return_value = sample_user_id

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_db_session.execute.return_value = mock_result

            result = await get_current_user_optional(
                credentials=mock_credentials, db=mock_db_session
            )

            assert result is None

    @pytest.mark.asyncio
    async def test_inactive_user_returns_none(
        self,
        mock_credentials: HTTPAuthorizationCredentials,
        mock_db_session: AsyncMock,
        sample_user_id: UUID,
        mock_inactive_user: MagicMock,
    ) -> None:
        """Test that inactive user returns None (anonymous user)."""
        with patch("src.core.dependencies.verify_token") as mock_verify:
            mock_verify.return_value = sample_user_id

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_inactive_user
            mock_db_session.execute.return_value = mock_result

            result = await get_current_user_optional(
                credentials=mock_credentials, db=mock_db_session
            )

            assert result is None

    @pytest.mark.asyncio
    async def test_valid_token_returns_user(
        self,
        mock_credentials: HTTPAuthorizationCredentials,
        mock_db_session: AsyncMock,
        sample_user_id: UUID,
        mock_user: MagicMock,
    ) -> None:
        """Test that valid token returns the user."""
        with patch("src.core.dependencies.verify_token") as mock_verify:
            mock_verify.return_value = sample_user_id

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_user
            mock_db_session.execute.return_value = mock_result

            result = await get_current_user_optional(
                credentials=mock_credentials, db=mock_db_session
            )

            assert result == mock_user


# ============================================================================
# Integration Tests
# ============================================================================


class TestDependencyIntegration:
    """Integration tests for dependency chain."""

    @pytest.mark.asyncio
    async def test_superuser_dependency_chain(
        self,
        mock_credentials: HTTPAuthorizationCredentials,
        mock_db_session: AsyncMock,
        sample_user_id: UUID,
        mock_superuser: MagicMock,
    ) -> None:
        """Test the full dependency chain for superuser authentication."""
        with patch("src.core.dependencies.verify_token") as mock_verify:
            mock_verify.return_value = sample_user_id

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_superuser
            mock_db_session.execute.return_value = mock_result

            # First get_current_user
            user = await get_current_user(credentials=mock_credentials, db=mock_db_session)
            assert user == mock_superuser

            # Then get_current_superuser
            superuser = await get_current_superuser(current_user=user)
            assert superuser == mock_superuser

    @pytest.mark.asyncio
    async def test_regular_user_fails_superuser_check(
        self,
        mock_credentials: HTTPAuthorizationCredentials,
        mock_db_session: AsyncMock,
        sample_user_id: UUID,
        mock_user: MagicMock,
    ) -> None:
        """Test that regular user passes get_current_user but fails get_current_superuser."""
        with patch("src.core.dependencies.verify_token") as mock_verify:
            mock_verify.return_value = sample_user_id

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_user
            mock_db_session.execute.return_value = mock_result

            # get_current_user should succeed
            user = await get_current_user(credentials=mock_credentials, db=mock_db_session)
            assert user == mock_user

            # get_current_superuser should fail
            with pytest.raises(ForbiddenException):
                await get_current_superuser(current_user=user)


# ============================================================================
# Edge Case Tests
# ============================================================================


class TestEdgeCases:
    """Tests for edge cases and unusual scenarios."""

    @pytest.mark.asyncio
    async def test_empty_token_string(self, mock_db_session: AsyncMock) -> None:
        """Test handling of empty token string."""
        empty_credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="")

        with patch("src.core.dependencies.verify_token") as mock_verify:
            mock_verify.side_effect = TokenInvalidException(detail="Empty token")

            with pytest.raises(UnauthorizedException):
                await get_current_user(credentials=empty_credentials, db=mock_db_session)

    @pytest.mark.asyncio
    async def test_whitespace_only_token(self, mock_db_session: AsyncMock) -> None:
        """Test handling of whitespace-only token."""
        whitespace_credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="   ")

        with patch("src.core.dependencies.verify_token") as mock_verify:
            mock_verify.side_effect = TokenInvalidException(detail="Invalid token")

            with pytest.raises(UnauthorizedException):
                await get_current_user(credentials=whitespace_credentials, db=mock_db_session)

    @pytest.mark.asyncio
    async def test_user_with_no_settings_loaded(
        self,
        mock_credentials: HTTPAuthorizationCredentials,
        mock_db_session: AsyncMock,
        sample_user_id: UUID,
    ) -> None:
        """Test user without settings relationship loaded."""
        user = MagicMock()
        user.id = sample_user_id
        user.is_active = True
        user.settings = None  # No settings loaded

        with patch("src.core.dependencies.verify_token") as mock_verify:
            mock_verify.return_value = sample_user_id

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = user
            mock_db_session.execute.return_value = mock_result

            result = await get_current_user(credentials=mock_credentials, db=mock_db_session)

            # Should still return user even without settings
            assert result == user
            assert result.settings is None
