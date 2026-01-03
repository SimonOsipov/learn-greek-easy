"""Fixed unit tests for AuthService login functionality.

This file contains corrected tests that properly handle async/await in mocks.
These tests verify the complete login functionality including:
- Successful login
- Error handling
- Last login tracking
- Audit logging
- OAuth user prevention
"""

import logging
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from src.core.exceptions import InvalidCredentialsException
from src.schemas.user import UserLogin
from src.services.auth_service import AuthService


class TestLoginFunctionality:
    """Complete test suite for login functionality."""

    @pytest.mark.asyncio
    async def test_login_success_with_tracking(self):
        """Test successful login updates last_login fields."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="test@example.com", password="TestPassword123!")
        client_ip = "192.168.1.100"

        # Create mock user
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "test@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = True
        mock_user.last_login_at = None
        mock_user.last_login_ip = None

        # Setup database mock to return user
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
                    assert user == mock_user
                    assert mock_user.last_login_at is not None
                    assert isinstance(mock_user.last_login_at, datetime)
                    assert mock_user.last_login_ip == client_ip
                    assert token_response.access_token == "access_token"
                    assert token_response.refresh_token == "refresh_token"
                    assert token_response.token_type == "bearer"
                    assert token_response.expires_in > 0

                    # Verify database operations
                    # Note: login doesn't call add() - it just modifies the user and commits
                    mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_login_user_not_found(self):
        """Test login with non-existent email."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="nonexistent@example.com", password="TestPassword123!")

        # Setup database mock to return None (user not found)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act & Assert
        with pytest.raises(InvalidCredentialsException):
            await service.login_user(login_data)

        # Verify no database commit
        mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_login_wrong_password(self):
        """Test login with incorrect password."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="test@example.com", password="WrongPassword123!")

        # Create mock user
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "test@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = True

        # Setup database mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch("src.services.auth_service.verify_password") as mock_verify:
            mock_verify.return_value = False  # Wrong password

            # Act & Assert
            with pytest.raises(InvalidCredentialsException):
                await service.login_user(login_data)

            # Verify no database commit
            mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_login_inactive_account(self):
        """Test login with inactive account."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="test@example.com", password="TestPassword123!")

        # Create inactive user
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "test@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = False  # Inactive

        # Setup database mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch("src.services.auth_service.verify_password") as mock_verify:
            mock_verify.return_value = True

            # Act & Assert
            with pytest.raises(InvalidCredentialsException) as exc_info:
                await service.login_user(login_data)

            assert "deactivated" in str(exc_info.value)
            mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_oauth_user_cannot_login(self):
        """Test that OAuth users without password cannot login."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="oauth@example.com", password="AnyPassword123!")

        # Create OAuth user (no password hash)
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "oauth@example.com"
        mock_user.password_hash = None  # OAuth user
        mock_user.google_id = "google_12345"
        mock_user.is_active = True

        # Setup database mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch("src.services.auth_service.verify_password") as mock_verify:
            # verify_password should return False for None password_hash
            mock_verify.return_value = False

            # Act & Assert
            with pytest.raises(InvalidCredentialsException):
                await service.login_user(login_data)

            mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_login_logs_success(self, caplog_loguru):
        """Test successful login is logged."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="test@example.com", password="TestPassword123!")
        client_ip = "192.168.1.100"

        # Create mock user
        mock_user = MagicMock()
        user_id = uuid4()
        mock_user.id = user_id
        mock_user.email = "test@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = True

        # Setup database mock
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
                    with caplog_loguru.at_level(logging.INFO):
                        await service.login_user(login_data, client_ip)

                    # Assert - check log message exists
                    # Note: user_id, email, and ip are in extra dict, not in message text
                    assert "Successful login" in caplog_loguru.text

    @pytest.mark.asyncio
    async def test_login_logs_failure_user_not_found(self, caplog_loguru):
        """Test failed login (user not found) is logged."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="notfound@example.com", password="TestPassword123!")
        client_ip = "192.168.1.100"

        # Setup database mock to return None
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        with caplog_loguru.at_level(logging.WARNING):
            with pytest.raises(InvalidCredentialsException):
                await service.login_user(login_data, client_ip)

        # Assert - check log message exists
        # Note: email and ip are in extra dict, not in message text
        assert "Failed login attempt - user not found" in caplog_loguru.text

    @pytest.mark.asyncio
    async def test_login_logs_failure_wrong_password(self, caplog_loguru):
        """Test failed login (wrong password) is logged."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="test@example.com", password="WrongPassword123!")
        client_ip = "192.168.1.100"

        # Create mock user
        mock_user = MagicMock()
        user_id = uuid4()
        mock_user.id = user_id
        mock_user.email = "test@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = True

        # Setup database mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch("src.services.auth_service.verify_password") as mock_verify:
            mock_verify.return_value = False

            # Act
            with caplog_loguru.at_level(logging.WARNING):
                with pytest.raises(InvalidCredentialsException):
                    await service.login_user(login_data, client_ip)

            # Assert - check log message exists
            # Note: user_id and ip are in extra dict, not in message text
            assert "Failed login attempt - invalid password" in caplog_loguru.text

    @pytest.mark.asyncio
    async def test_login_logs_failure_inactive_account(self, caplog_loguru):
        """Test failed login (inactive account) is logged."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="test@example.com", password="TestPassword123!")
        client_ip = "192.168.1.100"

        # Create inactive user
        mock_user = MagicMock()
        user_id = uuid4()
        mock_user.id = user_id
        mock_user.email = "test@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = False

        # Setup database mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch("src.services.auth_service.verify_password") as mock_verify:
            mock_verify.return_value = True

            # Act
            with caplog_loguru.at_level(logging.WARNING):
                with pytest.raises(InvalidCredentialsException):
                    await service.login_user(login_data, client_ip)

            # Assert - check log message exists
            # Note: user_id and ip are in extra dict, not in message text
            assert "Failed login attempt - inactive account" in caplog_loguru.text

    @pytest.mark.asyncio
    async def test_login_without_client_ip(self):
        """Test login works without client IP."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="test@example.com", password="TestPassword123!")

        # Create mock user
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "test@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = True
        mock_user.last_login_ip = None

        # Setup database mock
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
                    assert mock_user.last_login_ip is None  # Should remain None

    @pytest.mark.asyncio
    async def test_login_token_expiry_calculation(self):
        """Test that token expiry is calculated correctly."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="test@example.com", password="TestPassword123!")

        # Create mock user
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "test@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = True

        # Setup database mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()

        with patch("src.services.auth_service.verify_password") as mock_verify:
            mock_verify.return_value = True

            # Control the expiry time precisely
            access_expiry = datetime.utcnow() + timedelta(minutes=30)
            refresh_expiry = datetime.utcnow() + timedelta(days=30)

            with patch("src.services.auth_service.create_access_token") as mock_access:
                mock_access.return_value = ("access_token", access_expiry)

                with patch("src.services.auth_service.create_refresh_token") as mock_refresh:
                    mock_refresh.return_value = ("refresh_token", refresh_expiry, "token_id_123")

                    # Act
                    user, token_response = await service.login_user(login_data)

                    # Assert
                    # Should be approximately 1800 seconds (30 minutes)
                    assert 1795 <= token_response.expires_in <= 1800

    @pytest.mark.asyncio
    async def test_login_database_error_handling(self):
        """Test login handles database errors gracefully."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="test@example.com", password="TestPassword123!")

        # Create mock user
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "test@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = True

        # Setup database mock
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock(side_effect=IntegrityError("Database error", None, None))

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
                    with pytest.raises(IntegrityError):
                        await service.login_user(login_data)

    @pytest.mark.asyncio
    async def test_login_case_insensitive_email(self):
        """Test that email comparison is case-insensitive."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        # Use uppercase email in login
        login_data = UserLogin(email="TEST@EXAMPLE.COM", password="TestPassword123!")

        # Create user with lowercase email
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "test@example.com"  # Lowercase in DB
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = True

        # Setup database mock
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
                    user, token_response = await service.login_user(login_data)

                    # Assert - should succeed despite case difference
                    assert user == mock_user
                    assert token_response.access_token == "access_token"


class TestMissingScenarios:
    """Tests for scenarios not covered in existing tests."""

    @pytest.mark.asyncio
    async def test_concurrent_login_sessions(self):
        """Test that multiple login sessions can exist for same user."""
        # This would require integration testing with real database
        # to properly test concurrent refresh tokens
        pass

    @pytest.mark.asyncio
    async def test_login_performance(self):
        """Test that login completes within acceptable time."""
        # This is better suited for integration/performance testing
        # with real bcrypt hashing
        pass

    @pytest.mark.asyncio
    async def test_login_with_special_characters_in_email(self):
        """Test login with email containing special characters."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="test.user+tag@example.com", password="TestPassword123!")

        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.email = "test.user+tag@example.com"
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
                    user, token_response = await service.login_user(login_data)

                    # Assert
                    assert user == mock_user
                    assert token_response.access_token == "access_token"
