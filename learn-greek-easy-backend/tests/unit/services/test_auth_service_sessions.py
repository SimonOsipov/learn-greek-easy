"""Unit tests for AuthService session management methods."""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock

from src.db.models import RefreshToken
from src.services.auth_service import AuthService


class TestRevokeRefreshToken:
    """Test suite for revoke_refresh_token method."""

    @pytest.mark.asyncio
    async def test_revoke_existing_token_returns_true(self):
        """Test that revoking an existing token returns True."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        token_str = "valid_refresh_token_123"
        mock_token = MagicMock(spec=RefreshToken)
        mock_token.id = uuid4()
        mock_token.user_id = uuid4()

        # scalar_one_or_none is a sync method, not async
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_token
        mock_db.execute.return_value = mock_result
        mock_db.delete = AsyncMock()
        mock_db.commit = AsyncMock()

        # Act
        result = await service.revoke_refresh_token(token_str)

        # Assert
        assert result is True
        mock_db.delete.assert_called_once_with(mock_token)
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_revoke_nonexistent_token_returns_false(self):
        """Test that revoking a non-existent token returns False."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        token_str = "nonexistent_token_456"

        # scalar_one_or_none is a sync method
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        # Act
        result = await service.revoke_refresh_token(token_str)

        # Assert
        assert result is False
        mock_db.delete.assert_not_called()
        mock_db.commit.assert_not_called()


class TestRevokeAllUserTokens:
    """Test suite for revoke_all_user_tokens method."""

    @pytest.mark.asyncio
    async def test_revoke_multiple_tokens_returns_count(self):
        """Test that revoking multiple tokens returns correct count."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        user_id = uuid4()
        mock_tokens = [
            MagicMock(spec=RefreshToken),
            MagicMock(spec=RefreshToken),
            MagicMock(spec=RefreshToken),
        ]

        # scalars().all() chain - both sync methods
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_tokens
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute.return_value = mock_result
        mock_db.delete = AsyncMock()
        mock_db.commit = AsyncMock()

        # Act
        result = await service.revoke_all_user_tokens(user_id)

        # Assert
        assert result == 3
        assert mock_db.delete.call_count == 3
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_revoke_no_tokens_returns_zero(self):
        """Test that revoking with no tokens returns zero."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        user_id = uuid4()

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute.return_value = mock_result

        # Act
        result = await service.revoke_all_user_tokens(user_id)

        # Assert
        assert result == 0
        mock_db.delete.assert_not_called()
        mock_db.commit.assert_not_called()


class TestCleanupExpiredTokens:
    """Test suite for cleanup_expired_tokens method."""

    @pytest.mark.asyncio
    async def test_cleanup_removes_expired_tokens(self):
        """Test that cleanup removes expired tokens and returns count."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        # Create expired tokens
        mock_expired_tokens = [
            MagicMock(spec=RefreshToken),
            MagicMock(spec=RefreshToken),
        ]

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_expired_tokens
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute.return_value = mock_result
        mock_db.delete = AsyncMock()
        mock_db.commit = AsyncMock()

        # Act
        result = await service.cleanup_expired_tokens()

        # Assert
        assert result == 2
        assert mock_db.delete.call_count == 2
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_cleanup_with_no_expired_tokens_returns_zero(self):
        """Test that cleanup with no expired tokens returns zero."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute.return_value = mock_result

        # Act
        result = await service.cleanup_expired_tokens()

        # Assert
        assert result == 0
        mock_db.delete.assert_not_called()
        mock_db.commit.assert_not_called()


class TestGetUserSessions:
    """Test suite for get_user_sessions method."""

    @pytest.mark.asyncio
    async def test_get_sessions_returns_session_info_without_token(self):
        """Test that sessions are returned without exposing actual token values."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        user_id = uuid4()
        session_id = uuid4()
        created_at = datetime.utcnow() - timedelta(hours=1)
        expires_at = datetime.utcnow() + timedelta(days=30)

        mock_token = MagicMock(spec=RefreshToken)
        mock_token.id = session_id
        mock_token.created_at = created_at
        mock_token.expires_at = expires_at
        mock_token.token = "secret_token_value"  # This should NOT be exposed

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [mock_token]
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute.return_value = mock_result

        # Act
        result = await service.get_user_sessions(user_id)

        # Assert
        assert len(result) == 1
        assert result[0]["id"] == session_id
        assert result[0]["created_at"] == created_at
        assert result[0]["expires_at"] == expires_at
        # Ensure token value is NOT in the result
        assert "token" not in result[0]

    @pytest.mark.asyncio
    async def test_get_sessions_returns_multiple_sessions(self):
        """Test that multiple sessions are returned correctly."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        user_id = uuid4()

        mock_tokens = []
        for _ in range(3):
            mock_token = MagicMock(spec=RefreshToken)
            mock_token.id = uuid4()
            mock_token.created_at = datetime.utcnow()
            mock_token.expires_at = datetime.utcnow() + timedelta(days=30)
            mock_tokens.append(mock_token)

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_tokens
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute.return_value = mock_result

        # Act
        result = await service.get_user_sessions(user_id)

        # Assert
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_get_sessions_returns_empty_list_when_no_sessions(self):
        """Test that empty list is returned when no sessions exist."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        user_id = uuid4()

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute.return_value = mock_result

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
        service = AuthService(mock_db)

        user_id = uuid4()
        session_id = uuid4()

        mock_token = MagicMock(spec=RefreshToken)
        mock_token.id = session_id
        mock_token.user_id = user_id

        # scalar_one_or_none is a sync method
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_token
        mock_db.execute.return_value = mock_result
        mock_db.delete = AsyncMock()
        mock_db.commit = AsyncMock()

        # Act
        result = await service.revoke_session_by_id(user_id, session_id)

        # Assert
        assert result is True
        mock_db.delete.assert_called_once_with(mock_token)
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_revoke_nonexistent_session_returns_false(self):
        """Test that revoking non-existent session returns False."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        user_id = uuid4()
        session_id = uuid4()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        # Act
        result = await service.revoke_session_by_id(user_id, session_id)

        # Assert
        assert result is False
        mock_db.delete.assert_not_called()
        mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_revoke_other_users_session_returns_false(self):
        """Test that attempting to revoke another user's session returns False.

        The query includes user_id in WHERE clause, so attempting to revoke
        another user's session will not find the token (returns None).
        """
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        user_id = uuid4()
        session_id = uuid4()

        # The token belongs to other_user_id, but we're querying with user_id
        # The WHERE clause (user_id = user_id AND id = session_id) will not match
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None  # Not found for this user
        mock_db.execute.return_value = mock_result

        # Act
        result = await service.revoke_session_by_id(user_id, session_id)

        # Assert
        assert result is False
        mock_db.delete.assert_not_called()
        mock_db.commit.assert_not_called()
