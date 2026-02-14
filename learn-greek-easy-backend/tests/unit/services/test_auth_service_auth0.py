"""Unit tests for AuthService.authenticate_auth0 method."""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.core.auth0 import Auth0UserInfo
from src.core.exceptions import (
    ConflictException,
    InvalidCredentialsException,
    TokenExpiredException,
    TokenInvalidException,
    UnauthorizedException,
)
from src.services.auth_service import AuthService


class TestAuthenticateAuth0:
    """Tests for authenticate_auth0 method."""

    @pytest.fixture
    def auth0_user_info(self):
        """Sample Auth0 user info."""
        return Auth0UserInfo(
            auth0_id="auth0|123456789",
            email="test@example.com",
            email_verified=True,
            name="Test User",
        )

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        mock = AsyncMock()
        mock.add = MagicMock()
        mock.flush = AsyncMock()
        mock.commit = AsyncMock()
        mock.refresh = AsyncMock()
        return mock

    @pytest.fixture
    def mock_session_repo(self):
        """Create a mock session repository."""
        mock = AsyncMock()
        mock.create_session = AsyncMock(return_value=True)
        return mock

    @pytest.fixture
    def mock_settings_enabled(self):
        """Create mock settings with Auth0 enabled."""
        mock = MagicMock()
        mock.auth0_configured = True
        mock.auth0_domain = "example.auth0.com"
        mock.auth0_audience = "https://api.example.com"
        return mock

    @pytest.fixture
    def mock_settings_disabled(self):
        """Create mock settings with Auth0 disabled."""
        mock = MagicMock()
        mock.auth0_configured = False
        return mock

    @pytest.mark.asyncio
    async def test_auth0_disabled_raises_exception(self, mock_db, mock_settings_disabled):
        """Test that disabled Auth0 raises exception."""
        with patch("src.config.settings", mock_settings_disabled):
            service = AuthService(mock_db)

            with pytest.raises(UnauthorizedException):
                await service.authenticate_auth0("token")

    @pytest.mark.asyncio
    async def test_new_user_created(
        self, mock_db, mock_session_repo, auth0_user_info, mock_settings_enabled
    ):
        """Test new user is created for new Auth0 account."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.core.auth0.verify_auth0_token") as mock_verify:
                mock_verify.return_value = auth0_user_info

                # Create a mock user that will be returned after creation
                created_user = MagicMock()
                created_user.id = uuid4()
                created_user.email = "test@example.com"
                created_user.auth0_id = "auth0|123456789"
                created_user.password_hash = None
                created_user.email_verified_at = datetime.utcnow()
                created_user.is_active = True
                created_user.settings = MagicMock()

                # Mock execute: first 2 calls return None (no existing user),
                # last call returns the created user (re-fetch after commit)
                call_count = 0

                async def mock_execute_side_effect(*args, **kwargs):
                    nonlocal call_count
                    call_count += 1
                    result = MagicMock()
                    if call_count <= 2:
                        # First 2 calls: checking for existing user
                        result.scalar_one_or_none = MagicMock(return_value=None)
                    else:
                        # Final call: re-fetch user after commit
                        result.scalar_one = MagicMock(return_value=created_user)
                    return result

                mock_db.execute = AsyncMock(side_effect=mock_execute_side_effect)

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

                        service = AuthService(mock_db, mock_session_repo)
                        user, tokens = await service.authenticate_auth0("valid-token")

                        assert user.email == "test@example.com"
                        assert user.auth0_id == "auth0|123456789"
                        assert user.password_hash is None
                        assert user.email_verified_at is not None

    @pytest.mark.asyncio
    async def test_existing_auth0_user_login(
        self, mock_db, mock_session_repo, auth0_user_info, mock_settings_enabled
    ):
        """Test existing Auth0 user can login."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.core.auth0.verify_auth0_token") as mock_verify:
                mock_verify.return_value = auth0_user_info

                # Mock existing user found by auth0_id
                mock_user = MagicMock()
                mock_user.id = uuid4()
                mock_user.email = "test@example.com"
                mock_user.auth0_id = auth0_user_info.auth0_id
                mock_user.is_active = True
                mock_user.settings = MagicMock()

                # Mock execute: first call finds user, last call re-fetches after commit
                call_count = 0

                async def mock_execute_side_effect(*args, **kwargs):
                    nonlocal call_count
                    call_count += 1
                    result = MagicMock()
                    if call_count == 1:
                        # First call: find user by auth0_id
                        result.scalar_one_or_none = MagicMock(return_value=mock_user)
                    else:
                        # Final call: re-fetch user after commit
                        result.scalar_one = MagicMock(return_value=mock_user)
                    return result

                mock_db.execute = AsyncMock(side_effect=mock_execute_side_effect)

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

                        service = AuthService(mock_db, mock_session_repo)
                        user, tokens = await service.authenticate_auth0("valid-token")

                        assert user.id == mock_user.id

    @pytest.mark.asyncio
    async def test_account_linking(
        self, mock_db, mock_session_repo, auth0_user_info, mock_settings_enabled
    ):
        """Test Auth0 account linked to existing email user."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.core.auth0.verify_auth0_token") as mock_verify:
                mock_verify.return_value = auth0_user_info

                # Mock user not found by auth0_id (first call), but found by email (second call)
                mock_user = MagicMock()
                mock_user.id = uuid4()
                mock_user.email = auth0_user_info.email
                mock_user.auth0_id = None  # No Auth0 account linked yet
                mock_user.is_active = True
                mock_user.email_verified_at = None
                mock_user.full_name = None
                mock_user.settings = MagicMock()

                # After linking, auth0_id will be set
                linked_user = MagicMock()
                linked_user.id = mock_user.id
                linked_user.email = auth0_user_info.email
                linked_user.auth0_id = auth0_user_info.auth0_id
                linked_user.is_active = True
                linked_user.settings = MagicMock()

                mock_result_no_user = MagicMock()
                mock_result_no_user.scalar_one_or_none = MagicMock(return_value=None)

                mock_result_with_user = MagicMock()
                mock_result_with_user.scalar_one_or_none = MagicMock(return_value=mock_user)

                mock_result_refetch = MagicMock()
                mock_result_refetch.scalar_one = MagicMock(return_value=linked_user)

                # First call (by auth0_id) returns None, second (by email) returns user,
                # third (re-fetch after commit) returns linked user
                mock_db.execute = AsyncMock(
                    side_effect=[mock_result_no_user, mock_result_with_user, mock_result_refetch]
                )

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

                        service = AuthService(mock_db, mock_session_repo)
                        user, tokens = await service.authenticate_auth0("valid-token")

                        assert user.id == mock_user.id
                        assert user.auth0_id == auth0_user_info.auth0_id

    @pytest.mark.asyncio
    async def test_account_conflict_raises_exception(
        self, mock_db, auth0_user_info, mock_settings_enabled
    ):
        """Test conflict when email linked to different Auth0 account."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.core.auth0.verify_auth0_token") as mock_verify:
                mock_verify.return_value = auth0_user_info

                # Mock user not found by auth0_id, but email has DIFFERENT Auth0 ID
                mock_user = MagicMock()
                mock_user.email = auth0_user_info.email
                mock_user.auth0_id = "auth0|different-id"  # Different Auth0 account!

                mock_result_no_user = MagicMock()
                mock_result_no_user.scalar_one_or_none = MagicMock(return_value=None)

                mock_result_with_user = MagicMock()
                mock_result_with_user.scalar_one_or_none = MagicMock(return_value=mock_user)

                mock_db.execute = AsyncMock(
                    side_effect=[mock_result_no_user, mock_result_with_user]
                )

                service = AuthService(mock_db)

                with pytest.raises(ConflictException):
                    await service.authenticate_auth0("valid-token")

    @pytest.mark.asyncio
    async def test_inactive_user_rejected(
        self, mock_db, mock_session_repo, auth0_user_info, mock_settings_enabled
    ):
        """Test inactive user cannot login via Auth0."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.core.auth0.verify_auth0_token") as mock_verify:
                mock_verify.return_value = auth0_user_info

                # Mock inactive user
                mock_user = MagicMock()
                mock_user.id = uuid4()
                mock_user.email = "test@example.com"
                mock_user.auth0_id = auth0_user_info.auth0_id
                mock_user.is_active = False  # Inactive!

                mock_result = MagicMock()
                mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
                mock_db.execute = AsyncMock(return_value=mock_result)

                service = AuthService(mock_db, mock_session_repo)

                with pytest.raises(InvalidCredentialsException) as exc_info:
                    await service.authenticate_auth0("valid-token")

                assert "deactivated" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_token_response_contains_expected_fields(
        self, mock_db, mock_session_repo, auth0_user_info, mock_settings_enabled
    ):
        """Test that token response has all expected fields."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.core.auth0.verify_auth0_token") as mock_verify:
                mock_verify.return_value = auth0_user_info

                # Mock no existing user
                mock_result = MagicMock()
                mock_result.scalar_one_or_none = MagicMock(return_value=None)
                mock_db.execute = AsyncMock(return_value=mock_result)

                with patch("src.services.auth_service.create_access_token") as mock_access:
                    mock_access.return_value = (
                        "test_access_token",
                        datetime.utcnow() + timedelta(minutes=30),
                    )

                    with patch("src.services.auth_service.create_refresh_token") as mock_refresh:
                        mock_refresh.return_value = (
                            "test_refresh_token",
                            datetime.utcnow() + timedelta(days=30),
                            "token_id_123",
                        )

                        service = AuthService(mock_db, mock_session_repo)
                        user, tokens = await service.authenticate_auth0("valid-token")

                        assert tokens.access_token == "test_access_token"
                        assert tokens.refresh_token == "test_refresh_token"
                        assert tokens.token_type == "bearer"
                        assert tokens.expires_in > 0

    @pytest.mark.asyncio
    async def test_expired_token_raises_exception(self, mock_db, mock_settings_enabled):
        """Test that expired Auth0 token raises exception."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.core.auth0.verify_auth0_token") as mock_verify:
                mock_verify.side_effect = TokenExpiredException()

                service = AuthService(mock_db)

                with pytest.raises(TokenExpiredException):
                    await service.authenticate_auth0("expired-token")

    @pytest.mark.asyncio
    async def test_invalid_token_raises_exception(self, mock_db, mock_settings_enabled):
        """Test that invalid Auth0 token raises exception."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.core.auth0.verify_auth0_token") as mock_verify:
                mock_verify.side_effect = TokenInvalidException("Invalid token")

                service = AuthService(mock_db)

                with pytest.raises(TokenInvalidException):
                    await service.authenticate_auth0("invalid-token")

    @pytest.mark.asyncio
    async def test_user_without_email_gets_placeholder(
        self, mock_db, mock_session_repo, mock_settings_enabled
    ):
        """Test user created with placeholder email when Auth0 doesn't provide one."""
        auth0_user_no_email = Auth0UserInfo(
            auth0_id="auth0|no-email-user",
            email=None,  # No email provided
            email_verified=False,
            name="No Email User",
        )

        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.core.auth0.verify_auth0_token") as mock_verify:
                mock_verify.return_value = auth0_user_no_email

                # Create mock user with placeholder email
                placeholder_email = f"{uuid4()}@auth0.placeholder"
                created_user = MagicMock()
                created_user.id = uuid4()
                created_user.email = placeholder_email
                created_user.auth0_id = "auth0|no-email-user"
                created_user.is_active = True
                created_user.settings = MagicMock()

                # Mock execute: first call returns None (no existing user),
                # last call returns created user (re-fetch after commit)
                call_count = 0

                async def mock_execute_side_effect(*args, **kwargs):
                    nonlocal call_count
                    call_count += 1
                    result = MagicMock()
                    if call_count == 1:
                        # First call: checking for existing user by auth0_id
                        result.scalar_one_or_none = MagicMock(return_value=None)
                    else:
                        # Final call: re-fetch user after commit
                        result.scalar_one = MagicMock(return_value=created_user)
                    return result

                mock_db.execute = AsyncMock(side_effect=mock_execute_side_effect)

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

                        service = AuthService(mock_db, mock_session_repo)
                        user, tokens = await service.authenticate_auth0("valid-token")

                        # Should have placeholder email
                        assert "@auth0.placeholder" in user.email
                        assert user.auth0_id == "auth0|no-email-user"

    @pytest.mark.asyncio
    async def test_session_stored_in_redis(
        self, mock_db, mock_session_repo, auth0_user_info, mock_settings_enabled
    ):
        """Test that session is stored in Redis."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.core.auth0.verify_auth0_token") as mock_verify:
                mock_verify.return_value = auth0_user_info

                # Mock no existing user
                mock_result = MagicMock()
                mock_result.scalar_one_or_none = MagicMock(return_value=None)
                mock_db.execute = AsyncMock(return_value=mock_result)

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

                        service = AuthService(mock_db, mock_session_repo)
                        await service.authenticate_auth0(
                            "valid-token",
                            client_ip="192.168.1.1",
                            user_agent="Test Agent",
                        )

                        # Verify session was created
                        mock_session_repo.create_session.assert_called_once()
                        call_kwargs = mock_session_repo.create_session.call_args.kwargs
                        assert call_kwargs["token_id"] == "token_id_123"
                        assert call_kwargs["token"] == "refresh_token"
                        assert call_kwargs["ip_address"] == "192.168.1.1"
                        assert call_kwargs["user_agent"] == "Test Agent"

    @pytest.mark.asyncio
    async def test_last_login_updated(
        self, mock_db, mock_session_repo, auth0_user_info, mock_settings_enabled
    ):
        """Test that last_login_at and last_login_ip are updated."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.core.auth0.verify_auth0_token") as mock_verify:
                mock_verify.return_value = auth0_user_info

                # Mock existing user found by auth0_id
                mock_user = MagicMock()
                mock_user.id = uuid4()
                mock_user.email = "test@example.com"
                mock_user.auth0_id = auth0_user_info.auth0_id
                mock_user.is_active = True
                mock_user.last_login_at = None
                mock_user.last_login_ip = None

                mock_result = MagicMock()
                mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
                mock_db.execute = AsyncMock(return_value=mock_result)

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

                        service = AuthService(mock_db, mock_session_repo)
                        await service.authenticate_auth0(
                            "valid-token",
                            client_ip="10.0.0.1",
                        )

                        assert mock_user.last_login_at is not None
                        assert mock_user.last_login_ip == "10.0.0.1"


class TestGetUserByAuth0Id:
    """Tests for _get_user_by_auth0_id method."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_returns_user_when_found(self, mock_db):
        """Test that user is returned when found."""
        mock_user = MagicMock()
        mock_user.auth0_id = "auth0|123"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
        mock_db.execute = AsyncMock(return_value=mock_result)

        service = AuthService(mock_db)
        result = await service._get_user_by_auth0_id("auth0|123")

        assert result == mock_user

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self, mock_db):
        """Test that None is returned when user not found."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_db.execute = AsyncMock(return_value=mock_result)

        service = AuthService(mock_db)
        result = await service._get_user_by_auth0_id("nonexistent-id")

        assert result is None
