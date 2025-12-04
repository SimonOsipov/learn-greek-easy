"""Unit tests for AuthService refresh_access_token method.

Tests cover:
- Successful token refresh with rotation (Redis-only)
- Invalid JWT signature
- Expired JWT token
- Revoked token (not in Redis)
- Legacy token (no jti) rejection
- User not found
- User inactive
- Token rotation verification via Redis
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.core.exceptions import TokenExpiredException, TokenInvalidException, UserNotFoundException
from src.db.models import User, UserSettings
from src.repositories.session import SessionRepository
from src.services.auth_service import AuthService


def _create_mock_session_repo() -> AsyncMock:
    """Create a mock SessionRepository for tests."""
    mock_repo = AsyncMock(spec=SessionRepository)
    mock_repo.is_available = True
    mock_repo.validate_session.return_value = True
    mock_repo.create_session.return_value = True
    mock_repo.delete_session.return_value = True
    mock_repo.rotate_session.return_value = True
    return mock_repo


class TestAuthServiceRefresh:
    """Test suite for AuthService.refresh_access_token method."""

    @pytest.mark.asyncio
    async def test_refresh_success(self):
        """Test successful token refresh returns new tokens and user."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()
        token_id = "test_token_id_123"
        old_refresh_token = "old_valid_refresh_token"

        # Mock user
        mock_user = MagicMock(spec=User)
        mock_user.id = user_id
        mock_user.email = "user@example.com"
        mock_user.is_active = True
        mock_user.settings = MagicMock(spec=UserSettings)

        # Setup mock execute to return user
        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute.return_value = user_result

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            mock_verify.return_value = (user_id, token_id)

            with patch("src.services.auth_service.create_access_token") as mock_access:
                mock_access.return_value = (
                    "new_access_token",
                    datetime.utcnow() + timedelta(minutes=30),
                )

                with patch("src.services.auth_service.create_refresh_token") as mock_refresh:
                    new_token_id = "new_token_id_456"
                    mock_refresh.return_value = (
                        "new_refresh_token",
                        datetime.utcnow() + timedelta(days=30),
                        new_token_id,
                    )

                    # Act
                    (
                        new_access_token,
                        new_refresh_token,
                        returned_user,
                    ) = await service.refresh_access_token(old_refresh_token)

                    # Assert
                    assert new_access_token == "new_access_token"
                    assert new_refresh_token == "new_refresh_token"
                    assert returned_user == mock_user

                    # Verify Redis session validation was called
                    mock_session_repo.validate_session.assert_called_once_with(
                        user_id=user_id,
                        token_id=token_id,
                        token=old_refresh_token,
                    )

                    # Verify Redis rotation was called
                    mock_session_repo.rotate_session.assert_called_once()

    @pytest.mark.asyncio
    async def test_refresh_invalid_jwt(self):
        """Test refresh with invalid JWT raises TokenInvalidException."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        service = AuthService(mock_db, session_repo=mock_session_repo)

        invalid_token = "invalid_jwt_token"

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            mock_verify.side_effect = TokenInvalidException("Invalid token signature")

            # Act & Assert
            with pytest.raises(TokenInvalidException) as exc_info:
                await service.refresh_access_token(invalid_token)

            assert "Invalid refresh token" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_refresh_expired_jwt(self):
        """Test refresh with expired JWT raises TokenExpiredException."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        service = AuthService(mock_db, session_repo=mock_session_repo)

        expired_token = "expired_jwt_token"

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            mock_verify.side_effect = TokenExpiredException("Token has expired")

            # Act & Assert
            with pytest.raises(TokenExpiredException) as exc_info:
                await service.refresh_access_token(expired_token)

            assert "expired" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_refresh_legacy_token_without_jti_rejected(self):
        """Test refresh with legacy token (no jti) is rejected."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()
        legacy_token = "legacy_token_without_jti"

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            # Legacy token has no jti (token_id is None)
            mock_verify.return_value = (user_id, None)

            # Act & Assert
            with pytest.raises(TokenInvalidException) as exc_info:
                await service.refresh_access_token(legacy_token)

            assert "outdated" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_refresh_revoked_token_not_in_redis(self):
        """Test refresh with token not in Redis (revoked) raises exception."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        mock_session_repo.validate_session.return_value = False  # Token not found
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()
        token_id = "revoked_token_id"
        revoked_token = "revoked_refresh_token"

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            mock_verify.return_value = (user_id, token_id)

            # Act & Assert
            with pytest.raises(TokenInvalidException) as exc_info:
                await service.refresh_access_token(revoked_token)

            assert "revoked" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_refresh_user_not_found(self):
        """Test refresh raises UserNotFoundException if user deleted."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()
        token_id = "valid_token_id"
        valid_token = "valid_token_deleted_user"

        # User not found
        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = user_result

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            mock_verify.return_value = (user_id, token_id)

            # Act & Assert
            with pytest.raises(UserNotFoundException):
                await service.refresh_access_token(valid_token)

            # Session should be deleted from Redis when user not found
            mock_session_repo.delete_session.assert_called_once_with(user_id, token_id)

    @pytest.mark.asyncio
    async def test_refresh_user_inactive(self):
        """Test refresh raises TokenInvalidException if user is inactive."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()
        token_id = "valid_token_id"
        valid_token = "valid_token_inactive_user"

        # Mock inactive user
        mock_user = MagicMock(spec=User)
        mock_user.id = user_id
        mock_user.email = "inactive@example.com"
        mock_user.is_active = False
        mock_user.settings = None

        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute.return_value = user_result

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            mock_verify.return_value = (user_id, token_id)

            # Act & Assert
            with pytest.raises(TokenInvalidException) as exc_info:
                await service.refresh_access_token(valid_token)

            assert "deactivated" in str(exc_info.value.detail).lower()
            # Session should be deleted from Redis for inactive user
            mock_session_repo.delete_session.assert_called_once_with(user_id, token_id)

    @pytest.mark.asyncio
    async def test_refresh_token_rotation_via_redis(self):
        """Test that token rotation works via Redis - old session deleted, new one created."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()
        old_token_id = "old_token_id"
        old_refresh_token = "old_token_to_rotate"
        new_refresh_token_value = "new_rotated_token"
        new_token_id = "new_token_id"

        # Mock user
        mock_user = MagicMock(spec=User)
        mock_user.id = user_id
        mock_user.email = "user@example.com"
        mock_user.is_active = True
        mock_user.settings = MagicMock(spec=UserSettings)

        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute.return_value = user_result

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            mock_verify.return_value = (user_id, old_token_id)

            with patch("src.services.auth_service.create_access_token") as mock_access:
                mock_access.return_value = (
                    "new_access_token",
                    datetime.utcnow() + timedelta(minutes=30),
                )

                with patch("src.services.auth_service.create_refresh_token") as mock_refresh:
                    new_expires = datetime.utcnow() + timedelta(days=30)
                    mock_refresh.return_value = (new_refresh_token_value, new_expires, new_token_id)

                    # Act
                    (
                        access,
                        refresh,
                        user,
                    ) = await service.refresh_access_token(old_refresh_token)

                    # Assert - token rotation verification
                    assert refresh == new_refresh_token_value
                    assert refresh != old_refresh_token  # New token is different

                    # Verify rotate_session was called with correct parameters
                    mock_session_repo.rotate_session.assert_called_once_with(
                        user_id=user_id,
                        old_token_id=old_token_id,
                        new_token_id=new_token_id,
                        new_token=new_refresh_token_value,
                        new_expires_at=new_expires,
                        ip_address=None,
                        user_agent=None,
                    )

    @pytest.mark.asyncio
    async def test_refresh_with_client_info(self):
        """Test refresh passes client IP and user agent to rotation."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()
        token_id = "token_id"
        refresh_token = "refresh_token"
        client_ip = "192.168.1.100"
        user_agent = "Mozilla/5.0"

        # Mock user
        mock_user = MagicMock(spec=User)
        mock_user.id = user_id
        mock_user.email = "user@example.com"
        mock_user.is_active = True
        mock_user.settings = MagicMock(spec=UserSettings)

        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute.return_value = user_result

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            mock_verify.return_value = (user_id, token_id)

            with patch("src.services.auth_service.create_access_token") as mock_access:
                mock_access.return_value = ("new_access", datetime.utcnow() + timedelta(minutes=30))

                with patch("src.services.auth_service.create_refresh_token") as mock_refresh:
                    mock_refresh.return_value = (
                        "new_refresh",
                        datetime.utcnow() + timedelta(days=30),
                        "new_token_id",
                    )

                    # Act
                    await service.refresh_access_token(
                        refresh_token, client_ip=client_ip, user_agent=user_agent
                    )

                    # Assert - verify client info was passed
                    call_kwargs = mock_session_repo.rotate_session.call_args.kwargs
                    assert call_kwargs["ip_address"] == client_ip
                    assert call_kwargs["user_agent"] == user_agent

    @pytest.mark.asyncio
    async def test_refresh_redis_rotation_failure_still_returns_tokens(self):
        """Test that refresh returns tokens even if Redis rotation fails."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        mock_session_repo.rotate_session.return_value = False  # Redis rotation failed
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()
        token_id = "token_id"
        refresh_token = "refresh_token"

        # Mock user
        mock_user = MagicMock(spec=User)
        mock_user.id = user_id
        mock_user.email = "user@example.com"
        mock_user.is_active = True
        mock_user.settings = MagicMock(spec=UserSettings)

        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute.return_value = user_result

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            mock_verify.return_value = (user_id, token_id)

            with patch("src.services.auth_service.create_access_token") as mock_access:
                mock_access.return_value = ("new_access", datetime.utcnow() + timedelta(minutes=30))

                with patch("src.services.auth_service.create_refresh_token") as mock_refresh:
                    mock_refresh.return_value = (
                        "new_refresh",
                        datetime.utcnow() + timedelta(days=30),
                        "new_token_id",
                    )

                    # Act - should not raise, just log warning
                    new_access, new_refresh, user = await service.refresh_access_token(
                        refresh_token
                    )

                    # Assert - tokens are still returned
                    assert new_access == "new_access"
                    assert new_refresh == "new_refresh"
                    assert user == mock_user
