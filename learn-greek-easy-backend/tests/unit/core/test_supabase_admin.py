"""Unit tests for Supabase Admin client.

Tests cover:
- User deletion success (HTTP 200)
- 404 idempotent handling
- Error responses (500, etc.)
- Timeout handling
- Correct headers sent
- get_supabase_admin_client() factory function
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import httpx
import pytest

from src.core.exceptions import SupabaseAdminError
from src.core.supabase_admin import SupabaseAdminClient, get_supabase_admin_client

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def mock_settings_configured():
    """Mock settings with Supabase Admin configured."""
    with patch("src.core.supabase_admin.settings") as mock:
        mock.supabase_url = "https://test.supabase.co"
        mock.supabase_secret_key = "test-secret-key"
        mock.supabase_admin_configured = True
        yield mock


@pytest.fixture
def mock_settings_not_configured():
    """Mock settings without Supabase Admin configured."""
    with patch("src.core.supabase_admin.settings") as mock:
        mock.supabase_url = None
        mock.supabase_secret_key = None
        mock.supabase_admin_configured = False
        yield mock


# =============================================================================
# Delete User Tests
# =============================================================================


class TestDeleteUser:
    """Tests for SupabaseAdminClient.delete_user()."""

    @pytest.mark.asyncio
    async def test_delete_user_success_returns_true(self, mock_settings_configured):
        """Test successful deletion returns True (HTTP 200)."""
        user_id = str(uuid4())

        with patch("src.core.supabase_admin.httpx.AsyncClient") as mock_client:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_client.return_value.__aenter__.return_value.delete.return_value = mock_response

            client = SupabaseAdminClient(
                supabase_url=mock_settings_configured.supabase_url,
                secret_key=mock_settings_configured.supabase_secret_key,
            )
            result = await client.delete_user(user_id)

            assert result is True

    @pytest.mark.asyncio
    async def test_delete_user_404_is_idempotent(self, mock_settings_configured):
        """Test 404 response is treated as success (idempotent)."""
        user_id = str(uuid4())

        with patch("src.core.supabase_admin.httpx.AsyncClient") as mock_client:
            mock_response = AsyncMock()
            mock_response.status_code = 404
            mock_client.return_value.__aenter__.return_value.delete.return_value = mock_response

            client = SupabaseAdminClient(
                supabase_url=mock_settings_configured.supabase_url,
                secret_key=mock_settings_configured.supabase_secret_key,
            )
            result = await client.delete_user(user_id)

            assert result is True

    @pytest.mark.asyncio
    async def test_delete_user_500_raises_error(self, mock_settings_configured):
        """Test 500 error raises SupabaseAdminError."""
        user_id = str(uuid4())

        with patch("src.core.supabase_admin.httpx.AsyncClient") as mock_client:
            mock_response = AsyncMock()
            mock_response.status_code = 500
            mock_response.text = "Internal server error"
            mock_client.return_value.__aenter__.return_value.delete.return_value = mock_response

            client = SupabaseAdminClient(
                supabase_url=mock_settings_configured.supabase_url,
                secret_key=mock_settings_configured.supabase_secret_key,
            )

            with pytest.raises(SupabaseAdminError) as exc_info:
                await client.delete_user(user_id)

            assert "500" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_delete_user_timeout_raises_error(self, mock_settings_configured):
        """Test timeout raises SupabaseAdminError."""
        user_id = str(uuid4())

        with patch("src.core.supabase_admin.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.delete.side_effect = (
                httpx.TimeoutException("Request timeout")
            )

            client = SupabaseAdminClient(
                supabase_url=mock_settings_configured.supabase_url,
                secret_key=mock_settings_configured.supabase_secret_key,
            )

            with pytest.raises(SupabaseAdminError) as exc_info:
                await client.delete_user(user_id)

            assert "timeout" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_delete_user_sends_correct_headers(self, mock_settings_configured):
        """Test that correct headers are sent."""
        user_id = str(uuid4())

        with patch("src.core.supabase_admin.httpx.AsyncClient") as mock_client:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_delete = mock_client.return_value.__aenter__.return_value.delete
            mock_delete.return_value = mock_response

            client = SupabaseAdminClient(
                supabase_url=mock_settings_configured.supabase_url,
                secret_key=mock_settings_configured.supabase_secret_key,
            )
            await client.delete_user(user_id)

            # Verify headers
            call_kwargs = mock_delete.call_args.kwargs
            assert "headers" in call_kwargs
            headers = call_kwargs["headers"]
            assert "Authorization" in headers
            assert headers["Authorization"] == "Bearer test-secret-key"
            assert headers["apikey"] == "test-secret-key"

    @pytest.mark.asyncio
    async def test_delete_user_calls_correct_url(self, mock_settings_configured):
        """Test that correct URL is called."""
        user_id = str(uuid4())

        with patch("src.core.supabase_admin.httpx.AsyncClient") as mock_client:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_delete = mock_client.return_value.__aenter__.return_value.delete
            mock_delete.return_value = mock_response

            client = SupabaseAdminClient(
                supabase_url=mock_settings_configured.supabase_url,
                secret_key=mock_settings_configured.supabase_secret_key,
            )
            await client.delete_user(user_id)

            # Verify URL
            call_args = mock_delete.call_args.args
            assert len(call_args) > 0
            url = call_args[0]
            assert f"https://test.supabase.co/auth/v1/admin/users/{user_id}" == url


# =============================================================================
# Factory Function Tests
# =============================================================================


class TestGetSupabaseAdminClient:
    """Tests for get_supabase_admin_client() factory function."""

    def test_returns_client_when_configured(self, mock_settings_configured):
        """Test returns client when properly configured."""
        client = get_supabase_admin_client()
        assert client is not None
        assert isinstance(client, SupabaseAdminClient)

    def test_returns_none_when_not_configured(self, mock_settings_not_configured):
        """Test returns None when not configured."""
        client = get_supabase_admin_client()
        assert client is None

    def test_returns_none_when_url_missing(self):
        """Test returns None when URL is missing."""
        with patch("src.core.supabase_admin.settings") as mock:
            mock.supabase_url = None
            mock.supabase_secret_key = "test-key"
            mock.supabase_admin_configured = False

            client = get_supabase_admin_client()
            assert client is None

    def test_returns_none_when_key_missing(self):
        """Test returns None when secret key is missing."""
        with patch("src.core.supabase_admin.settings") as mock:
            mock.supabase_url = "https://test.supabase.co"
            mock.supabase_secret_key = None
            mock.supabase_admin_configured = False

            client = get_supabase_admin_client()
            assert client is None
