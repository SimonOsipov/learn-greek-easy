"""Unit tests for AuthService session management methods.

Tests now use Redis-only session storage (no PostgreSQL fallback).
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from src.core.exceptions import TokenExpiredException, TokenInvalidException
from src.repositories.session import SessionRepository
from src.services.auth_service import AuthService


def _create_mock_session_repo() -> AsyncMock:
    """Create a mock SessionRepository for tests."""
    mock_repo = AsyncMock(spec=SessionRepository)
    mock_repo.is_available = True
    mock_repo.get_user_sessions.return_value = []
    mock_repo.revoke_all_user_sessions.return_value = 0
    mock_repo.delete_session.return_value = True
    mock_repo.validate_session.return_value = True
    return mock_repo


class TestRevokeRefreshToken:
    """Test suite for revoke_refresh_token method."""

    @pytest.mark.asyncio
    async def test_revoke_existing_token_returns_true(self):
        """Test that revoking an existing token returns True."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        mock_session_repo.delete_session.return_value = True
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()
        token_id = "test_token_id_123"
        token_str = "valid_refresh_token_123"

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            mock_verify.return_value = (user_id, token_id)

            # Act
            result = await service.revoke_refresh_token(token_str)

            # Assert
            assert result is True
            mock_session_repo.delete_session.assert_called_once_with(user_id, token_id)

    @pytest.mark.asyncio
    async def test_revoke_nonexistent_token_returns_false(self):
        """Test that revoking a non-existent token returns False."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        mock_session_repo.delete_session.return_value = False  # Token not found
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()
        token_id = "nonexistent_token_id"
        token_str = "nonexistent_token_456"

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            mock_verify.return_value = (user_id, token_id)

            # Act
            result = await service.revoke_refresh_token(token_str)

            # Assert
            assert result is False

    @pytest.mark.asyncio
    async def test_revoke_legacy_token_without_jti_returns_false(self):
        """Test that revoking a legacy token without jti returns False."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()
        token_str = "legacy_token_without_jti"

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            # Legacy token returns None for token_id
            mock_verify.return_value = (user_id, None)

            # Act
            result = await service.revoke_refresh_token(token_str)

            # Assert
            assert result is False
            mock_session_repo.delete_session.assert_not_called()

    @pytest.mark.asyncio
    async def test_revoke_invalid_token_returns_false(self):
        """Test that revoking an invalid token returns False."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        service = AuthService(mock_db, session_repo=mock_session_repo)

        token_str = "invalid_token"

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            mock_verify.side_effect = TokenInvalidException("Invalid token")

            # Act
            result = await service.revoke_refresh_token(token_str)

            # Assert
            assert result is False
            mock_session_repo.delete_session.assert_not_called()


class TestRevokeAllUserTokens:
    """Test suite for revoke_all_user_tokens method."""

    @pytest.mark.asyncio
    async def test_revoke_multiple_tokens_returns_count(self):
        """Test that revoking multiple tokens returns correct count from Redis."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        mock_session_repo.revoke_all_user_sessions.return_value = 3
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()

        # Act
        result = await service.revoke_all_user_tokens(user_id)

        # Assert
        assert result == 3
        mock_session_repo.revoke_all_user_sessions.assert_called_once_with(user_id)

    @pytest.mark.asyncio
    async def test_revoke_no_tokens_returns_zero(self):
        """Test that revoking with no tokens returns zero."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        mock_session_repo.revoke_all_user_sessions.return_value = 0
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()

        # Act
        result = await service.revoke_all_user_tokens(user_id)

        # Assert
        assert result == 0
        mock_session_repo.revoke_all_user_sessions.assert_called_once_with(user_id)


class TestCleanupExpiredTokens:
    """Test suite for cleanup_expired_tokens method."""

    @pytest.mark.asyncio
    async def test_cleanup_returns_zero_redis_handles_expiry(self):
        """Test that cleanup always returns 0 since Redis handles expiry via TTL."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        service = AuthService(mock_db, session_repo=mock_session_repo)

        # Act
        result = await service.cleanup_expired_tokens()

        # Assert
        assert result == 0
        # No database operations should occur
        mock_db.execute.assert_not_called()


class TestGetUserSessions:
    """Test suite for get_user_sessions method."""

    @pytest.mark.asyncio
    async def test_get_sessions_returns_session_info_from_redis(self):
        """Test that sessions are returned from Redis without exposing token values."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()

        created_at = (datetime.utcnow() - timedelta(hours=1)).isoformat()
        expires_at = (datetime.utcnow() + timedelta(days=30)).isoformat()

        mock_session_repo.get_user_sessions.return_value = [
            {
                "token_id": "session_123",
                "created_at": created_at,
                "expires_at": expires_at,
                "ip_address": "192.168.1.100",
                "user_agent": "Mozilla/5.0",
            }
        ]
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()

        # Act
        result = await service.get_user_sessions(user_id)

        # Assert
        assert len(result) == 1
        assert result[0]["id"] == "session_123"
        assert result[0]["created_at"] == created_at
        assert result[0]["expires_at"] == expires_at
        assert result[0]["ip_address"] == "192.168.1.100"
        assert result[0]["user_agent"] == "Mozilla/5.0"
        # Ensure token value is NOT in the result
        assert "token" not in result[0]

    @pytest.mark.asyncio
    async def test_get_sessions_returns_multiple_sessions(self):
        """Test that multiple sessions are returned correctly."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()

        mock_session_repo.get_user_sessions.return_value = [
            {
                "token_id": "session_1",
                "created_at": None,
                "expires_at": None,
                "ip_address": None,
                "user_agent": None,
            },
            {
                "token_id": "session_2",
                "created_at": None,
                "expires_at": None,
                "ip_address": None,
                "user_agent": None,
            },
            {
                "token_id": "session_3",
                "created_at": None,
                "expires_at": None,
                "ip_address": None,
                "user_agent": None,
            },
        ]
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()

        # Act
        result = await service.get_user_sessions(user_id)

        # Assert
        assert len(result) == 3
        mock_session_repo.get_user_sessions.assert_called_once_with(user_id)

    @pytest.mark.asyncio
    async def test_get_sessions_returns_empty_list_when_no_sessions(self):
        """Test that empty list is returned when no sessions exist."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        mock_session_repo.get_user_sessions.return_value = []
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()

        # Act
        result = await service.get_user_sessions(user_id)

        # Assert
        assert len(result) == 0
        assert result == []


class TestRevokeSessionById:
    """Test suite for revoke_session_by_id method."""

    @pytest.mark.asyncio
    async def test_revoke_own_session_returns_true(self):
        """Test that revoking own session returns True."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        mock_session_repo.delete_session.return_value = True
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()
        session_id = "session_token_id_123"

        # Act
        result = await service.revoke_session_by_id(user_id, session_id)

        # Assert
        assert result is True
        mock_session_repo.delete_session.assert_called_once_with(user_id, session_id)

    @pytest.mark.asyncio
    async def test_revoke_nonexistent_session_returns_false(self):
        """Test that revoking non-existent session returns False."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        mock_session_repo.delete_session.return_value = False  # Session not found
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()
        session_id = "nonexistent_session_id"

        # Act
        result = await service.revoke_session_by_id(user_id, session_id)

        # Assert
        assert result is False
        mock_session_repo.delete_session.assert_called_once_with(user_id, session_id)


class TestLogoutUser:
    """Test suite for logout_user method."""

    @pytest.mark.asyncio
    async def test_logout_deletes_session_from_redis(self):
        """Test that logout deletes the session from Redis."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()
        token_id = "test_token_id"
        refresh_token = "test_refresh_token"

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            mock_verify.return_value = (user_id, token_id)

            # Act
            await service.logout_user(refresh_token)

            # Assert
            mock_session_repo.delete_session.assert_called_once_with(user_id, token_id)

    @pytest.mark.asyncio
    async def test_logout_with_invalid_token_succeeds_silently(self):
        """Test that logout with invalid token succeeds without error."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        service = AuthService(mock_db, session_repo=mock_session_repo)

        refresh_token = "invalid_token"

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            mock_verify.side_effect = TokenInvalidException("Invalid token")

            # Act - should not raise
            await service.logout_user(refresh_token)

            # Assert - no Redis call since we couldn't extract token_id
            mock_session_repo.delete_session.assert_not_called()

    @pytest.mark.asyncio
    async def test_logout_with_expired_token_succeeds_silently(self):
        """Test that logout with expired token succeeds without error."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        service = AuthService(mock_db, session_repo=mock_session_repo)

        refresh_token = "expired_token"

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            mock_verify.side_effect = TokenExpiredException("Token expired")

            # Act - should not raise
            await service.logout_user(refresh_token)

            # Assert - no Redis call since we couldn't extract token_id
            mock_session_repo.delete_session.assert_not_called()

    @pytest.mark.asyncio
    async def test_logout_with_legacy_token_no_jti(self):
        """Test that logout with legacy token (no jti) does not call Redis."""
        # Arrange
        mock_db = AsyncMock()
        mock_session_repo = _create_mock_session_repo()
        service = AuthService(mock_db, session_repo=mock_session_repo)

        user_id = uuid4()
        refresh_token = "legacy_token"

        with patch("src.services.auth_service.verify_refresh_token_with_jti") as mock_verify:
            mock_verify.return_value = (user_id, None)  # No jti

            # Act
            await service.logout_user(refresh_token)

            # Assert - no Redis call since token_id is None
            mock_session_repo.delete_session.assert_not_called()
