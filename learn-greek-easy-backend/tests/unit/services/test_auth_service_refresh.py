"""Unit tests for AuthService refresh_access_token method.

Tests cover:
- Successful token refresh with rotation
- Invalid JWT signature
- Expired JWT token
- Revoked token (not in database)
- User not found
- User inactive
- Token rotation verification
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from src.core.exceptions import (
    TokenExpiredException,
    TokenInvalidException,
    UserNotFoundException,
)
from src.db.models import RefreshToken, User, UserSettings
from src.services.auth_service import AuthService


class TestAuthServiceRefresh:
    """Test suite for AuthService.refresh_access_token method."""

    @pytest.mark.asyncio
    async def test_refresh_success(self):
        """Test successful token refresh returns new tokens and user."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        user_id = uuid4()
        old_refresh_token = "old_valid_refresh_token"

        # Mock user
        mock_user = MagicMock(spec=User)
        mock_user.id = user_id
        mock_user.email = "user@example.com"
        mock_user.is_active = True
        mock_user.settings = MagicMock(spec=UserSettings)

        # Mock refresh token in database
        mock_db_token = MagicMock(spec=RefreshToken)
        mock_db_token.token = old_refresh_token
        mock_db_token.user_id = user_id
        mock_db_token.expires_at = datetime.utcnow() + timedelta(days=7)

        # Setup mock execute to return token first, then user
        token_result = MagicMock()
        token_result.scalar_one_or_none.return_value = mock_db_token

        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = mock_user

        mock_db.execute.side_effect = [token_result, user_result]
        mock_db.delete = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()

        with patch("src.services.auth_service.verify_token") as mock_verify:
            mock_verify.return_value = user_id

            with patch("src.services.auth_service.create_access_token") as mock_access:
                mock_access.return_value = (
                    "new_access_token",
                    datetime.utcnow() + timedelta(minutes=30),
                )

                with patch("src.services.auth_service.create_refresh_token") as mock_refresh:
                    mock_refresh.return_value = (
                        "new_refresh_token",
                        datetime.utcnow() + timedelta(days=30),
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

                    # Verify token rotation: old deleted, new added
                    mock_db.delete.assert_called_once_with(mock_db_token)
                    mock_db.add.assert_called_once()
                    mock_db.commit.assert_called_once()

                    # Verify correct token type was checked
                    mock_verify.assert_called_once_with(
                        old_refresh_token, token_type="refresh"
                    )

    @pytest.mark.asyncio
    async def test_refresh_invalid_jwt(self):
        """Test refresh with invalid JWT raises TokenInvalidException."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        invalid_token = "invalid_jwt_token"

        with patch("src.services.auth_service.verify_token") as mock_verify:
            mock_verify.side_effect = TokenInvalidException("Invalid token signature")

            # Act & Assert
            with pytest.raises(TokenInvalidException) as exc_info:
                await service.refresh_access_token(invalid_token)

            assert "Invalid refresh token" in str(exc_info.value.detail)
            mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_refresh_expired_jwt(self):
        """Test refresh with expired JWT raises TokenExpiredException."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        expired_token = "expired_jwt_token"

        # Mock execute for cleanup (should find no token)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        with patch("src.services.auth_service.verify_token") as mock_verify:
            mock_verify.side_effect = TokenExpiredException("Token has expired")

            # Act & Assert
            with pytest.raises(TokenExpiredException) as exc_info:
                await service.refresh_access_token(expired_token)

            assert "expired" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_refresh_revoked_token(self):
        """Test refresh with token not in database (revoked) raises exception."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        user_id = uuid4()
        revoked_token = "revoked_refresh_token"

        # Mock execute to return None (token not found)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        with patch("src.services.auth_service.verify_token") as mock_verify:
            mock_verify.return_value = user_id

            # Act & Assert
            with pytest.raises(TokenInvalidException) as exc_info:
                await service.refresh_access_token(revoked_token)

            assert "revoked" in str(exc_info.value.detail).lower()
            mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_refresh_user_not_found(self):
        """Test refresh raises UserNotFoundException if user deleted."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        user_id = uuid4()
        valid_token = "valid_token_deleted_user"

        # Mock refresh token exists
        mock_db_token = MagicMock(spec=RefreshToken)
        mock_db_token.token = valid_token
        mock_db_token.user_id = user_id
        mock_db_token.expires_at = datetime.utcnow() + timedelta(days=7)

        token_result = MagicMock()
        token_result.scalar_one_or_none.return_value = mock_db_token

        # User not found
        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = None

        mock_db.execute.side_effect = [token_result, user_result]
        mock_db.delete = AsyncMock()
        mock_db.commit = AsyncMock()

        with patch("src.services.auth_service.verify_token") as mock_verify:
            mock_verify.return_value = user_id

            # Act & Assert
            with pytest.raises(UserNotFoundException):
                await service.refresh_access_token(valid_token)

            # Token should be deleted when user not found
            mock_db.delete.assert_called_once_with(mock_db_token)
            mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_refresh_user_inactive(self):
        """Test refresh raises TokenInvalidException if user is inactive."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        user_id = uuid4()
        valid_token = "valid_token_inactive_user"

        # Mock refresh token exists
        mock_db_token = MagicMock(spec=RefreshToken)
        mock_db_token.token = valid_token
        mock_db_token.user_id = user_id
        mock_db_token.expires_at = datetime.utcnow() + timedelta(days=7)

        # Mock inactive user
        mock_user = MagicMock(spec=User)
        mock_user.id = user_id
        mock_user.email = "inactive@example.com"
        mock_user.is_active = False
        mock_user.settings = None

        token_result = MagicMock()
        token_result.scalar_one_or_none.return_value = mock_db_token

        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = mock_user

        mock_db.execute.side_effect = [token_result, user_result]
        mock_db.delete = AsyncMock()
        mock_db.commit = AsyncMock()

        with patch("src.services.auth_service.verify_token") as mock_verify:
            mock_verify.return_value = user_id

            # Act & Assert
            with pytest.raises(TokenInvalidException) as exc_info:
                await service.refresh_access_token(valid_token)

            assert "deactivated" in str(exc_info.value.detail).lower()
            # Token should be revoked for inactive user
            mock_db.delete.assert_called_once_with(mock_db_token)
            mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_refresh_token_rotation(self):
        """Test that token rotation works - old token deleted, new one created."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        user_id = uuid4()
        old_refresh_token = "old_token_to_rotate"
        new_refresh_token_value = "new_rotated_token"

        # Mock user
        mock_user = MagicMock(spec=User)
        mock_user.id = user_id
        mock_user.email = "user@example.com"
        mock_user.is_active = True
        mock_user.settings = MagicMock(spec=UserSettings)

        # Mock old refresh token
        mock_old_db_token = MagicMock(spec=RefreshToken)
        mock_old_db_token.token = old_refresh_token
        mock_old_db_token.user_id = user_id
        mock_old_db_token.expires_at = datetime.utcnow() + timedelta(days=7)

        token_result = MagicMock()
        token_result.scalar_one_or_none.return_value = mock_old_db_token

        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = mock_user

        mock_db.execute.side_effect = [token_result, user_result]
        mock_db.delete = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()

        with patch("src.services.auth_service.verify_token") as mock_verify:
            mock_verify.return_value = user_id

            with patch("src.services.auth_service.create_access_token") as mock_access:
                mock_access.return_value = (
                    "new_access_token",
                    datetime.utcnow() + timedelta(minutes=30),
                )

                with patch("src.services.auth_service.create_refresh_token") as mock_refresh:
                    new_expires = datetime.utcnow() + timedelta(days=30)
                    mock_refresh.return_value = (new_refresh_token_value, new_expires)

                    # Act
                    (
                        access,
                        refresh,
                        user,
                    ) = await service.refresh_access_token(old_refresh_token)

                    # Assert - token rotation verification
                    assert refresh == new_refresh_token_value
                    assert refresh != old_refresh_token  # New token is different

                    # Old token was deleted
                    mock_db.delete.assert_called_once_with(mock_old_db_token)

                    # New token was added
                    mock_db.add.assert_called_once()
                    added_token = mock_db.add.call_args[0][0]
                    assert isinstance(added_token, RefreshToken)
                    assert added_token.token == new_refresh_token_value
                    assert added_token.user_id == user_id

    @pytest.mark.asyncio
    async def test_refresh_db_expired_token(self):
        """Test refresh with token expired in database (not JWT expiry)."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        user_id = uuid4()
        db_expired_token = "db_expired_token"

        # Mock refresh token that exists but is expired
        mock_db_token = MagicMock(spec=RefreshToken)
        mock_db_token.token = db_expired_token
        mock_db_token.user_id = user_id
        mock_db_token.expires_at = datetime.utcnow() - timedelta(hours=1)  # Expired

        token_result = MagicMock()
        token_result.scalar_one_or_none.return_value = mock_db_token
        mock_db.execute.return_value = token_result
        mock_db.delete = AsyncMock()
        mock_db.commit = AsyncMock()

        with patch("src.services.auth_service.verify_token") as mock_verify:
            mock_verify.return_value = user_id

            # Act & Assert
            with pytest.raises(TokenExpiredException):
                await service.refresh_access_token(db_expired_token)

            # Expired token should be cleaned up
            mock_db.delete.assert_called_once_with(mock_db_token)
            mock_db.commit.assert_called_once()


class TestCleanupToken:
    """Test suite for AuthService._cleanup_token helper method."""

    @pytest.mark.asyncio
    async def test_cleanup_token_exists(self):
        """Test cleanup removes token when it exists."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        token_to_clean = "token_to_cleanup"
        mock_db_token = MagicMock(spec=RefreshToken)
        mock_db_token.token = token_to_clean

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_db_token
        mock_db.execute.return_value = mock_result
        mock_db.delete = AsyncMock()
        mock_db.commit = AsyncMock()

        # Act
        await service._cleanup_token(token_to_clean)

        # Assert
        mock_db.delete.assert_called_once_with(mock_db_token)
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_cleanup_token_not_exists(self):
        """Test cleanup does nothing when token doesn't exist."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        token_to_clean = "nonexistent_token"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result
        mock_db.delete = AsyncMock()
        mock_db.commit = AsyncMock()

        # Act
        await service._cleanup_token(token_to_clean)

        # Assert
        mock_db.delete.assert_not_called()
        mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_cleanup_token_handles_error(self):
        """Test cleanup handles database errors gracefully."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        token_to_clean = "error_token"
        mock_db.execute.side_effect = Exception("Database error")

        # Act - should not raise
        await service._cleanup_token(token_to_clean)

        # Assert - no error raised, error was logged (can't easily verify logging)
