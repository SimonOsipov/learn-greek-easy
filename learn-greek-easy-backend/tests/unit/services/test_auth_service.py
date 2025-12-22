"""Unit tests for AuthService."""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from src.core.exceptions import EmailAlreadyExistsException, InvalidCredentialsException
from src.schemas.user import UserCreate, UserLogin
from src.services.auth_service import AuthService


class TestAuthService:
    """Test suite for AuthService."""

    @pytest.mark.asyncio
    async def test_register_user_success(self):
        """Test successful user registration."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        user_data = UserCreate(
            email="test@example.com", password="SecurePass123!", full_name="Test User"
        )

        # Mock database operations - use MagicMock for result to avoid coroutine issues
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)  # No existing user
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.flush = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        mock_db.add = MagicMock()

        with patch("src.services.auth_service.hash_password") as mock_hash:
            mock_hash.return_value = "hashed_password_123"

            with patch("src.services.auth_service.create_access_token") as mock_access:
                mock_access.return_value = (
                    "access_token_abc",
                    datetime.utcnow() + timedelta(minutes=30),
                )

                with patch("src.services.auth_service.create_refresh_token") as mock_refresh:
                    mock_refresh.return_value = (
                        "refresh_token_xyz",
                        datetime.utcnow() + timedelta(days=30),
                        "token_id_123",
                    )

                    # Act
                    user, token_response = await service.register_user(user_data)

                    # Assert
                    assert user.email == user_data.email
                    assert user.full_name == user_data.full_name
                    assert user.password_hash == "hashed_password_123"
                    assert user.is_active is True
                    assert user.is_superuser is False

                    assert token_response.access_token == "access_token_abc"
                    assert token_response.refresh_token == "refresh_token_xyz"
                    assert token_response.token_type == "bearer"
                    assert token_response.expires_in > 0

                    mock_hash.assert_called_once_with(user_data.password)
                    # First commit: save user and settings
                    # Second commit: save welcome notification (in _create_welcome_notification)
                    assert mock_db.commit.call_count == 2
                    mock_db.refresh.assert_called_once()
                    # Check that 3 objects were added: User, UserSettings, Notification
                    # (RefreshToken is now stored in Redis, not PostgreSQL)
                    assert mock_db.add.call_count == 3

    @pytest.mark.asyncio
    async def test_register_user_email_already_exists(self):
        """Test registration with existing email raises exception."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        user_data = UserCreate(
            email="existing@example.com", password="SecurePass123!", full_name="Test User"
        )

        # Mock existing user
        existing_user = MagicMock()
        existing_user.email = "existing@example.com"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=existing_user)
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act & Assert
        with pytest.raises(EmailAlreadyExistsException) as exc_info:
            await service.register_user(user_data)

        assert "existing@example.com" in str(exc_info.value.detail)
        mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_register_user_handles_race_condition(self):
        """Test registration handles race condition with duplicate email."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        user_data = UserCreate(
            email="race@example.com", password="SecurePass123!", full_name="Test User"
        )

        # Mock no existing user on initial check
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.flush = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.rollback = AsyncMock()

        # Simulate IntegrityError on commit (race condition)
        mock_orig_error = MagicMock()
        mock_orig_error.__str__.return_value = "unique constraint violation on email"
        integrity_error = IntegrityError("statement", "params", mock_orig_error)
        mock_db.commit.side_effect = integrity_error

        with patch("src.services.auth_service.hash_password") as mock_hash:
            mock_hash.return_value = "hashed_password"

            # Act & Assert
            with pytest.raises(EmailAlreadyExistsException) as exc_info:
                await service.register_user(user_data)

            assert "race@example.com" in str(exc_info.value.detail)
            mock_db.rollback.assert_called_once()

    @pytest.mark.asyncio
    async def test_login_user_success(self):
        """Test successful user login."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="user@example.com", password="CorrectPass123!")

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
                    "access_token_login",
                    datetime.utcnow() + timedelta(minutes=30),
                )

                with patch("src.services.auth_service.create_refresh_token") as mock_refresh:
                    mock_refresh.return_value = (
                        "refresh_token_login",
                        datetime.utcnow() + timedelta(days=30),
                        "token_id_123",
                    )

                    # Act
                    user, token_response = await service.login_user(login_data)

                    # Assert
                    assert user.email == "user@example.com"
                    assert token_response.access_token == "access_token_login"
                    assert token_response.refresh_token == "refresh_token_login"

                    mock_verify.assert_called_once_with(login_data.password, "hashed_password")
                    mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_login_user_invalid_email(self):
        """Test login with non-existent email."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="nonexistent@example.com", password="SomePass123!")

        # Mock no user found
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act & Assert
        with pytest.raises(InvalidCredentialsException):
            await service.login_user(login_data)

        mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_login_user_wrong_password(self):
        """Test login with incorrect password."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="user@example.com", password="WrongPass123!")

        # Mock user
        mock_user = MagicMock()
        mock_user.email = "user@example.com"
        mock_user.password_hash = "hashed_password"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch("src.services.auth_service.verify_password") as mock_verify:
            mock_verify.return_value = False

            # Act & Assert
            with pytest.raises(InvalidCredentialsException):
                await service.login_user(login_data)

            mock_verify.assert_called_once_with(login_data.password, "hashed_password")
            mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_login_user_inactive_account(self):
        """Test login with inactive account."""
        # Arrange
        mock_db = AsyncMock()
        service = AuthService(mock_db)

        login_data = UserLogin(email="user@example.com", password="CorrectPass123!")

        # Mock inactive user
        mock_user = MagicMock()
        mock_user.email = "user@example.com"
        mock_user.password_hash = "hashed_password"
        mock_user.is_active = False

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
