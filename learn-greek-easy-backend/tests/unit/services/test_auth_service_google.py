"""Unit tests for AuthService.authenticate_google method."""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.core.exceptions import (
    AccountLinkingConflictException,
    GoogleOAuthDisabledException,
    GoogleTokenInvalidException,
    InvalidCredentialsException,
)
from src.schemas.user import GoogleUserInfo
from src.services.auth_service import AuthService


class TestAuthenticateGoogle:
    """Tests for authenticate_google method."""

    @pytest.fixture
    def google_user_info(self):
        """Sample Google user info."""
        return GoogleUserInfo(
            google_id="google-123",
            email="test@example.com",
            email_verified=True,
            full_name="Test User",
            picture_url=None,
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
        """Create mock settings with Google OAuth enabled."""
        mock = MagicMock()
        mock.google_oauth_configured = True
        mock.google_client_id = "test-client-id"
        return mock

    @pytest.fixture
    def mock_settings_disabled(self):
        """Create mock settings with Google OAuth disabled."""
        mock = MagicMock()
        mock.google_oauth_configured = False
        return mock

    @pytest.mark.asyncio
    async def test_oauth_disabled_raises_exception(self, mock_db, mock_settings_disabled):
        """Test that disabled OAuth raises exception."""
        with patch("src.config.settings", mock_settings_disabled):
            service = AuthService(mock_db)

            with pytest.raises(GoogleOAuthDisabledException):
                await service.authenticate_google("token")

    @pytest.mark.asyncio
    async def test_new_user_created(
        self, mock_db, mock_session_repo, google_user_info, mock_settings_enabled
    ):
        """Test new user is created for new Google account."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.services.auth_service.verify_google_id_token") as mock_verify:
                mock_verify.return_value = google_user_info

                # Mock no existing user (both by google_id and email)
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
                        user, tokens = await service.authenticate_google("valid-token")

                        assert user.email == "test@example.com"
                        assert user.google_id == "google-123"
                        assert user.password_hash is None
                        assert user.email_verified_at is not None

    @pytest.mark.asyncio
    async def test_existing_google_user_login(
        self, mock_db, mock_session_repo, google_user_info, mock_settings_enabled
    ):
        """Test existing Google user can login."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.services.auth_service.verify_google_id_token") as mock_verify:
                mock_verify.return_value = google_user_info

                # Mock existing user found by google_id
                mock_user = MagicMock()
                mock_user.id = uuid4()
                mock_user.email = "test@example.com"
                mock_user.google_id = google_user_info.google_id
                mock_user.is_active = True

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
                        user, tokens = await service.authenticate_google("valid-token")

                        assert user.id == mock_user.id

    @pytest.mark.asyncio
    async def test_account_linking(
        self, mock_db, mock_session_repo, google_user_info, mock_settings_enabled
    ):
        """Test Google account linked to existing email user."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.services.auth_service.verify_google_id_token") as mock_verify:
                mock_verify.return_value = google_user_info

                # Mock user not found by google_id (first call), but found by email (second call)
                mock_user = MagicMock()
                mock_user.id = uuid4()
                mock_user.email = google_user_info.email
                mock_user.google_id = None  # No Google account linked yet
                mock_user.is_active = True
                mock_user.email_verified_at = None
                mock_user.full_name = None

                mock_result_no_user = MagicMock()
                mock_result_no_user.scalar_one_or_none = MagicMock(return_value=None)

                mock_result_with_user = MagicMock()
                mock_result_with_user.scalar_one_or_none = MagicMock(return_value=mock_user)

                # First call (by google_id) returns None, second (by email) returns user
                mock_db.execute = AsyncMock(
                    side_effect=[mock_result_no_user, mock_result_with_user]
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
                        user, tokens = await service.authenticate_google("valid-token")

                        assert user.id == mock_user.id
                        assert user.google_id == google_user_info.google_id

    @pytest.mark.asyncio
    async def test_account_conflict_raises_exception(
        self, mock_db, google_user_info, mock_settings_enabled
    ):
        """Test conflict when email linked to different Google account."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.services.auth_service.verify_google_id_token") as mock_verify:
                mock_verify.return_value = google_user_info

                # Mock user not found by google_id, but email has DIFFERENT Google ID
                mock_user = MagicMock()
                mock_user.email = google_user_info.email
                mock_user.google_id = "different-google-id"  # Different Google account!

                mock_result_no_user = MagicMock()
                mock_result_no_user.scalar_one_or_none = MagicMock(return_value=None)

                mock_result_with_user = MagicMock()
                mock_result_with_user.scalar_one_or_none = MagicMock(return_value=mock_user)

                mock_db.execute = AsyncMock(
                    side_effect=[mock_result_no_user, mock_result_with_user]
                )

                service = AuthService(mock_db)

                with pytest.raises(AccountLinkingConflictException):
                    await service.authenticate_google("valid-token")

    @pytest.mark.asyncio
    async def test_inactive_user_rejected(
        self, mock_db, mock_session_repo, google_user_info, mock_settings_enabled
    ):
        """Test inactive user cannot login via Google."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.services.auth_service.verify_google_id_token") as mock_verify:
                mock_verify.return_value = google_user_info

                # Mock inactive user
                mock_user = MagicMock()
                mock_user.id = uuid4()
                mock_user.email = "test@example.com"
                mock_user.google_id = google_user_info.google_id
                mock_user.is_active = False  # Inactive!

                mock_result = MagicMock()
                mock_result.scalar_one_or_none = MagicMock(return_value=mock_user)
                mock_db.execute = AsyncMock(return_value=mock_result)

                service = AuthService(mock_db, mock_session_repo)

                with pytest.raises(InvalidCredentialsException) as exc_info:
                    await service.authenticate_google("valid-token")

                assert "deactivated" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_token_response_contains_expected_fields(
        self, mock_db, mock_session_repo, google_user_info, mock_settings_enabled
    ):
        """Test that token response has all expected fields."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.services.auth_service.verify_google_id_token") as mock_verify:
                mock_verify.return_value = google_user_info

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
                        user, tokens = await service.authenticate_google("valid-token")

                        assert tokens.access_token == "test_access_token"
                        assert tokens.refresh_token == "test_refresh_token"
                        assert tokens.token_type == "bearer"
                        assert tokens.expires_in > 0

    @pytest.mark.asyncio
    async def test_invalid_token_raises_exception(self, mock_db, mock_settings_enabled):
        """Test that invalid Google token raises exception."""
        with patch("src.config.settings", mock_settings_enabled):
            with patch("src.services.auth_service.verify_google_id_token") as mock_verify:
                mock_verify.side_effect = GoogleTokenInvalidException("Invalid token")

                service = AuthService(mock_db)

                with pytest.raises(GoogleTokenInvalidException):
                    await service.authenticate_google("invalid-token")
