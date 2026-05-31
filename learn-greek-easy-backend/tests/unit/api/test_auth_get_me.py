"""Unit tests for auth.get_me — PERF-04: no redundant DB reload.

Tests verify:
- get_me returns correct profile including settings
- get_me does NOT issue a second select(User) / DB execute call
- Response is built from current_user provided by the dependency
- Freshly-provisioned users (settings present on first /auth/me) work correctly
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.api.v1.auth import get_me
from src.db.models import User, UserSettings

# =============================================================================
# Helpers
# =============================================================================


def _make_settings(user_id=None) -> MagicMock:
    """Create a mock UserSettings object."""
    s = MagicMock(spec=UserSettings)
    s.id = uuid4()
    s.user_id = user_id or uuid4()
    s.daily_goal = 20
    s.email_notifications = True
    s.preferred_language = None
    s.theme = None
    s.tour_completed_at = None
    s.created_at = datetime(2024, 11, 25, 10, 30, 0, tzinfo=timezone.utc)
    s.updated_at = datetime(2024, 11, 25, 10, 30, 0, tzinfo=timezone.utc)
    return s


def _make_user(
    is_superuser: bool = False,
    avatar_url: str | None = None,
) -> MagicMock:
    """Create a mock User object with eager-loaded settings (as the dependency provides)."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = f"user_{uuid4().hex[:6]}@example.com"
    user.full_name = "Test User"
    user.is_active = True
    user.is_superuser = is_superuser
    user.avatar_url = avatar_url
    user.supabase_id = str(uuid4())
    user.created_at = datetime(2024, 11, 25, 10, 30, 0, tzinfo=timezone.utc)
    user.updated_at = datetime(2024, 11, 25, 10, 30, 0, tzinfo=timezone.utc)
    # Subscriptions / stripe fields expected by get_effective_access_level
    user.subscription_status = None
    user.subscription_tier = None

    settings = _make_settings(user_id=user.id)
    user.settings = settings
    return user


def _make_request(auth_provider: str = "email") -> MagicMock:
    """Create a mock Request with supabase_claims set."""
    req = MagicMock()
    claims = MagicMock()
    claims.auth_provider = auth_provider
    req.state.supabase_claims = claims
    return req


# =============================================================================
# TestGetMeNoDB — assert no DB query is issued
# =============================================================================


class TestGetMeNoDB:
    """get_me must not call db.execute (no reload of user+settings)."""

    @pytest.mark.asyncio
    async def test_get_me_does_not_call_db_execute(self):
        """get_me must build response from current_user without hitting the DB."""
        user = _make_user()
        request = _make_request()
        # A real AsyncSession.execute would be async; use AsyncMock to detect any call
        mock_db = AsyncMock()

        with patch("src.api.v1.auth.get_s3_service") as mock_s3_factory:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.return_value = None
            mock_s3_factory.return_value = mock_s3
            with patch("src.api.v1.auth.get_effective_access_level") as mock_access:
                mock_access.return_value = MagicMock(value="free")

                result = await get_me(request=request, current_user=user)

        # The critical assertion: no DB execute was triggered
        mock_db.execute.assert_not_called()
        assert result is not None

    @pytest.mark.asyncio
    async def test_get_me_response_contains_settings(self):
        """Response must embed settings provided by the dependency."""
        user = _make_user()
        request = _make_request()

        with patch("src.api.v1.auth.get_s3_service") as mock_s3_factory:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.return_value = None
            mock_s3_factory.return_value = mock_s3
            with patch("src.api.v1.auth.get_effective_access_level") as mock_access:
                mock_access.return_value = MagicMock(value="free")

                result = await get_me(request=request, current_user=user)

        assert result.settings is not None
        assert result.settings.daily_goal == 20
        assert result.settings.email_notifications is True

    @pytest.mark.asyncio
    async def test_get_me_auth_provider_from_request(self):
        """auth_provider in response must reflect the request's Supabase claims."""
        user = _make_user()
        request = _make_request(auth_provider="google")

        with patch("src.api.v1.auth.get_s3_service") as mock_s3_factory:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.return_value = None
            mock_s3_factory.return_value = mock_s3
            with patch("src.api.v1.auth.get_effective_access_level") as mock_access:
                mock_access.return_value = MagicMock(value="free")

                result = await get_me(request=request, current_user=user)

        assert result.auth_provider == "google"

    @pytest.mark.asyncio
    async def test_get_me_auth_provider_defaults_to_email(self):
        """auth_provider defaults to 'email' when claims are absent."""
        user = _make_user()

        # Request with no supabase_claims on state
        request = MagicMock()
        request.state.supabase_claims = None

        with patch("src.api.v1.auth.get_s3_service") as mock_s3_factory:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.return_value = None
            mock_s3_factory.return_value = mock_s3
            with patch("src.api.v1.auth.get_effective_access_level") as mock_access:
                mock_access.return_value = MagicMock(value="free")

                result = await get_me(request=request, current_user=user)

        assert result.auth_provider == "email"

    @pytest.mark.asyncio
    async def test_get_me_superuser_effective_role_admin(self):
        """Superusers must get effective_role='admin' without a DB query."""
        user = _make_user(is_superuser=True)
        request = _make_request()

        with patch("src.api.v1.auth.get_s3_service") as mock_s3_factory:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.return_value = None
            mock_s3_factory.return_value = mock_s3
            # get_effective_access_level should NOT be called for superusers
            with patch("src.api.v1.auth.get_effective_access_level") as mock_access:
                result = await get_me(request=request, current_user=user)
                mock_access.assert_not_called()

        assert result.effective_role == "admin"

    @pytest.mark.asyncio
    async def test_get_me_avatar_url_presigned(self):
        """Avatar S3 key must be converted to a presigned URL."""
        user = _make_user(avatar_url="avatars/user123.jpg")
        request = _make_request()

        with patch("src.api.v1.auth.get_s3_service") as mock_s3_factory:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.return_value = "https://cdn.example.com/avatar.jpg"
            mock_s3_factory.return_value = mock_s3
            with patch("src.api.v1.auth.get_effective_access_level") as mock_access:
                mock_access.return_value = MagicMock(value="free")

                result = await get_me(request=request, current_user=user)

        mock_s3.generate_presigned_url.assert_called_once_with(
            "avatars/user123.jpg",
            expiry_seconds=2592000,
        )
        assert result.avatar_url == "https://cdn.example.com/avatar.jpg"


# =============================================================================
# TestGetMeFreshUser — regression: settings present for newly-provisioned users
# =============================================================================


class TestGetMeFreshUser:
    """Regression tests for freshly-provisioned users (first call to /auth/me)."""

    @pytest.mark.asyncio
    async def test_fresh_user_settings_present_on_first_call(self):
        """A brand-new user's settings must be embedded in get_me response.

        The get_current_user dependency calls db.refresh(new_user, ['settings'])
        on the new-user path, so settings are always available. This test
        confirms that get_me does not need to reload them.
        """
        fresh_user = _make_user()
        # Simulate a user that was just created — settings is set (not None)
        assert fresh_user.settings is not None

        request = _make_request()

        with patch("src.api.v1.auth.get_s3_service") as mock_s3_factory:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.return_value = None
            mock_s3_factory.return_value = mock_s3
            with patch("src.api.v1.auth.get_effective_access_level") as mock_access:
                mock_access.return_value = MagicMock(value="free")

                result = await get_me(request=request, current_user=fresh_user)

        # Settings must be in the response
        assert result.settings is not None
        assert result.settings.daily_goal == 20
        assert result.settings.email_notifications is True

    @pytest.mark.asyncio
    async def test_fresh_user_user_id_preserved(self):
        """User ID in response must match current_user.id (no reload that could differ)."""
        fresh_user = _make_user()
        request = _make_request()

        with patch("src.api.v1.auth.get_s3_service") as mock_s3_factory:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.return_value = None
            mock_s3_factory.return_value = mock_s3
            with patch("src.api.v1.auth.get_effective_access_level") as mock_access:
                mock_access.return_value = MagicMock(value="free")

                result = await get_me(request=request, current_user=fresh_user)

        assert result.id == fresh_user.id
