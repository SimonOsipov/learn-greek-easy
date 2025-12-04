"""Enhanced unit tests for AuthService login functionality.

Tests cover the new features added to login:
- last_login_at timestamp update
- last_login_ip tracking
- Login audit logging
"""

import logging
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.core.exceptions import InvalidCredentialsException
from src.schemas.user import UserLogin
from src.services.auth_service import AuthService


class TestEnhancedLoginFeatures:
    """Test enhanced login features."""

    @pytest.mark.asyncio
    async def test_login_updates_last_login_at(self):
        """Test that successful login updates last_login_at timestamp."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="user@example.com", password="TestPassword123!")
        client_ip = "192.168.1.100"

        # Mock user
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "user@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = True
        mock_user.last_login_at = None
        mock_user.last_login_ip = None

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()

        with patch("src.services.auth_service.verify_password") as mock_verify:
            mock_verify.return_value = True

            with patch("src.services.auth_service.create_access_token") as mock_access:
                mock_access.return_value = (
                    "access_token",
                    datetime.utcnow() + timedelta(minutes=30),
                )

                with patch("src.services.auth_service.create_refresh_token") as mock_refresh:
                    mock_refresh.return_value = (
                        "refresh_token",
                        datetime.utcnow() + timedelta(days=30),
                        "token_id_123",
                    )

                    # Act
                    user, token_response = await service.login_user(login_data, client_ip)

                    # Assert
                    assert mock_user.last_login_at is not None
                    assert isinstance(mock_user.last_login_at, datetime)
                    assert mock_user.last_login_ip == client_ip

    @pytest.mark.asyncio
    async def test_login_updates_ip_when_provided(self):
        """Test that login updates last_login_ip when client IP is provided."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="user@example.com", password="TestPassword123!")
        client_ip = "10.0.0.42"

        # Mock user
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "user@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = True
        mock_user.last_login_ip = "old_ip"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()

        with patch("src.services.auth_service.verify_password") as mock_verify:
            mock_verify.return_value = True

            with patch("src.services.auth_service.create_access_token") as mock_access:
                mock_access.return_value = (
                    "access_token",
                    datetime.utcnow() + timedelta(minutes=30),
                )

                with patch("src.services.auth_service.create_refresh_token") as mock_refresh:
                    mock_refresh.return_value = (
                        "refresh_token",
                        datetime.utcnow() + timedelta(days=30),
                        "token_id_123",
                    )

                    # Act
                    user, token_response = await service.login_user(login_data, client_ip)

                    # Assert
                    assert mock_user.last_login_ip == client_ip

    @pytest.mark.asyncio
    async def test_login_without_client_ip(self):
        """Test that login works without client IP."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="user@example.com", password="TestPassword123!")

        # Mock user
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "user@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = True
        mock_user.last_login_ip = None

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()

        with patch("src.services.auth_service.verify_password") as mock_verify:
            mock_verify.return_value = True

            with patch("src.services.auth_service.create_access_token") as mock_access:
                mock_access.return_value = (
                    "access_token",
                    datetime.utcnow() + timedelta(minutes=30),
                )

                with patch("src.services.auth_service.create_refresh_token") as mock_refresh:
                    mock_refresh.return_value = (
                        "refresh_token",
                        datetime.utcnow() + timedelta(days=30),
                        "token_id_123",
                    )

                    # Act
                    user, token_response = await service.login_user(login_data, client_ip=None)

                    # Assert
                    assert mock_user.last_login_at is not None
                    assert mock_user.last_login_ip is None  # Should not be set

    @pytest.mark.asyncio
    async def test_login_logs_success(self, caplog):
        """Test that successful login is logged."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="user@example.com", password="TestPassword123!")
        client_ip = "192.168.1.100"

        # Mock user
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "user@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = True

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()

        with patch("src.services.auth_service.verify_password") as mock_verify:
            mock_verify.return_value = True

            with patch("src.services.auth_service.create_access_token") as mock_access:
                mock_access.return_value = (
                    "access_token",
                    datetime.utcnow() + timedelta(minutes=30),
                )

                with patch("src.services.auth_service.create_refresh_token") as mock_refresh:
                    mock_refresh.return_value = (
                        "refresh_token",
                        datetime.utcnow() + timedelta(days=30),
                        "token_id_123",
                    )

                    # Act
                    with caplog.at_level(logging.INFO):
                        user, token_response = await service.login_user(login_data, client_ip)

                    # Assert - check log message exists
                    # Note: user_id and email are in extra dict, not in message text
                    assert "Successful login" in caplog.text

    @pytest.mark.asyncio
    async def test_login_logs_failed_user_not_found(self, caplog):
        """Test that failed login (user not found) is logged."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="nonexistent@example.com", password="TestPassword123!")
        client_ip = "192.168.1.100"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        with caplog.at_level(logging.WARNING):
            with pytest.raises(InvalidCredentialsException):
                await service.login_user(login_data, client_ip)

        # Assert - check log message exists
        # Note: email and ip are in extra dict, not in message text
        assert "Failed login attempt - user not found" in caplog.text

    @pytest.mark.asyncio
    async def test_login_logs_failed_wrong_password(self, caplog):
        """Test that failed login (wrong password) is logged."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="user@example.com", password="WrongPassword123!")
        client_ip = "192.168.1.100"

        # Mock user
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "user@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = True

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch("src.services.auth_service.verify_password") as mock_verify:
            mock_verify.return_value = False

            # Act
            with caplog.at_level(logging.WARNING):
                with pytest.raises(InvalidCredentialsException):
                    await service.login_user(login_data, client_ip)

            # Assert - check log message exists
            # Note: user_id and ip are in extra dict, not in message text
            assert "Failed login attempt - invalid password" in caplog.text

    @pytest.mark.asyncio
    async def test_login_logs_failed_inactive_account(self, caplog):
        """Test that failed login (inactive account) is logged."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="user@example.com", password="TestPassword123!")
        client_ip = "192.168.1.100"

        # Mock user
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "user@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = False

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch("src.services.auth_service.verify_password") as mock_verify:
            mock_verify.return_value = True

            # Act
            with caplog.at_level(logging.WARNING):
                with pytest.raises(InvalidCredentialsException):
                    await service.login_user(login_data, client_ip)

            # Assert - check log message exists
            # Note: user_id and ip are in extra dict, not in message text
            assert "Failed login attempt - inactive account" in caplog.text

    @pytest.mark.asyncio
    async def test_oauth_user_cannot_login_with_password(self):
        """Test that OAuth users (no password hash) cannot login with password."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="oauth_user@example.com", password="AnyPassword123!")

        # Mock OAuth user (no password hash)
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "oauth_user@example.com"
        mock_user.password_hash = None  # OAuth user has no password
        mock_user.google_id = "google_12345"
        mock_user.is_active = True

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch("src.services.auth_service.verify_password") as mock_verify:
            # verify_password should handle None password_hash gracefully
            mock_verify.return_value = False

            # Act & Assert
            with pytest.raises(InvalidCredentialsException):
                await service.login_user(login_data)

    @pytest.mark.asyncio
    async def test_login_handles_database_commit_error(self):
        """Test that login handles database commit errors gracefully."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="user@example.com", password="TestPassword123!")

        # Mock user
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "user@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = True

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock(side_effect=Exception("Database error"))

        with patch("src.services.auth_service.verify_password") as mock_verify:
            mock_verify.return_value = True

            with patch("src.services.auth_service.create_access_token") as mock_access:
                mock_access.return_value = (
                    "access_token",
                    datetime.utcnow() + timedelta(minutes=30),
                )

                with patch("src.services.auth_service.create_refresh_token") as mock_refresh:
                    mock_refresh.return_value = (
                        "refresh_token",
                        datetime.utcnow() + timedelta(days=30),
                        "token_id_123",
                    )

                    # Act & Assert
                    with pytest.raises(Exception) as exc_info:
                        await service.login_user(login_data)

                    assert "Database error" in str(exc_info.value)
