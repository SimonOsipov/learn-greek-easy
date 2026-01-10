"""Unit tests for AuthService.

Tests cover Auth0 authentication flow and session management.
Legacy email/password and Google OAuth tests have been removed.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.services.auth_service import AuthService


class TestAuthService:
    """Test suite for AuthService."""

    @pytest.mark.asyncio
    async def test_get_user_by_email_found(self):
        """Test getting user by email when user exists."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        mock_user = MagicMock()
        mock_user.email = "found@example.com"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        user = await service._get_user_by_email("found@example.com")

        # Assert
        assert user is not None
        assert user.email == "found@example.com"

    @pytest.mark.asyncio
    async def test_get_user_by_email_not_found(self):
        """Test getting user by email when user doesn't exist."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        user = await service._get_user_by_email("notfound@example.com")

        # Assert
        assert user is None
