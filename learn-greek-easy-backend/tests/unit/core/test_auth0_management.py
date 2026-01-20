"""Unit tests for Auth0ManagementClient.

Tests cover:
- Token cache operations
- Successful user deletion (204 response)
- User not found (404 is success)
- Token retry on 401
- get_auth0_management_client factory function

These tests mock httpx to avoid hitting real Auth0 endpoints.
"""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from src.core.auth0_management import (
    Auth0ManagementClient,
    M2MTokenCache,
    get_auth0_management_client,
    invalidate_m2m_token_cache,
)
from src.core.exceptions import Auth0ManagementError


@pytest.fixture
def token_cache():
    """Create a fresh M2MTokenCache instance."""
    return M2MTokenCache(ttl=3600)


@pytest.fixture
def client():
    """Create an Auth0ManagementClient instance."""
    return Auth0ManagementClient(
        domain="test-tenant.us.auth0.com",
        client_id="test-client-id",
        client_secret="test-client-secret",
    )


@pytest.mark.unit
class TestM2MTokenCache:
    """Tests for M2MTokenCache."""

    def test_get_returns_none_when_empty(self, token_cache):
        """Test get returns None when cache is empty."""
        assert token_cache.get() is None

    def test_set_and_get(self, token_cache):
        """Test set stores token and get retrieves it."""
        token_cache.set("test-token")
        assert token_cache.get() == "test-token"

    def test_get_returns_none_when_expired(self, token_cache):
        """Test get returns None when token is expired."""
        # Create cache with very short TTL
        short_cache = M2MTokenCache(ttl=0)
        short_cache.set("test-token")
        # Token should be immediately expired
        time.sleep(0.01)  # Small sleep to ensure time passes
        assert short_cache.get() is None

    def test_invalidate_clears_token(self, token_cache):
        """Test invalidate clears the cached token."""
        token_cache.set("test-token")
        assert token_cache.get() == "test-token"

        token_cache.invalidate()
        assert token_cache.get() is None

    def test_set_updates_fetched_at(self, token_cache):
        """Test that set updates the fetched_at timestamp."""
        # First set
        token_cache.set("token-1")
        first_time = token_cache._fetched_at

        time.sleep(0.01)

        # Second set
        token_cache.set("token-2")
        second_time = token_cache._fetched_at

        assert second_time > first_time


@pytest.mark.unit
class TestAuth0ManagementClient:
    """Tests for Auth0ManagementClient."""

    @pytest.mark.asyncio
    async def test_delete_user_success_204(self, client):
        """Test successful user deletion returns True on 204."""
        with patch("src.core.auth0_management._m2m_token_cache") as mock_cache:
            mock_cache.get.return_value = "cached-token"

            with patch("httpx.AsyncClient") as MockAsyncClient:
                mock_response = MagicMock()
                mock_response.status_code = 204

                mock_client_instance = MagicMock()
                mock_client_instance.delete = AsyncMock(return_value=mock_response)
                mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
                mock_client_instance.__aexit__ = AsyncMock(return_value=None)
                MockAsyncClient.return_value = mock_client_instance

                result = await client.delete_user("auth0|123456")

        assert result is True

    @pytest.mark.asyncio
    async def test_delete_user_404_is_success(self, client):
        """Test user not found (404) returns True (idempotent)."""
        with patch("src.core.auth0_management._m2m_token_cache") as mock_cache:
            mock_cache.get.return_value = "cached-token"

            with patch("httpx.AsyncClient") as MockAsyncClient:
                mock_response = MagicMock()
                mock_response.status_code = 404

                mock_client_instance = MagicMock()
                mock_client_instance.delete = AsyncMock(return_value=mock_response)
                mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
                mock_client_instance.__aexit__ = AsyncMock(return_value=None)
                MockAsyncClient.return_value = mock_client_instance

                result = await client.delete_user("auth0|123456")

        # 404 should be treated as success (user doesn't exist)
        assert result is True

    @pytest.mark.asyncio
    async def test_delete_user_401_retry(self, client):
        """Test 401 response triggers token refresh and retry."""
        with patch("src.core.auth0_management._m2m_token_cache") as mock_cache:
            # First call returns cached token, second returns new token
            mock_cache.get.side_effect = ["cached-token", None]
            mock_cache.set = MagicMock()

            call_count = [0]

            async def mock_delete(*args, **kwargs):
                call_count[0] += 1
                if call_count[0] == 1:
                    # First call: return 401
                    response = MagicMock()
                    response.status_code = 401
                    return response
                else:
                    # Second call: return 204
                    response = MagicMock()
                    response.status_code = 204
                    return response

            async def mock_post(*args, **kwargs):
                # Token endpoint
                response = MagicMock()
                response.status_code = 200
                response.json = MagicMock(return_value={"access_token": "new-token"})
                response.raise_for_status = MagicMock()
                return response

            with patch("httpx.AsyncClient") as MockAsyncClient:
                mock_client_instance = MagicMock()
                mock_client_instance.delete = AsyncMock(side_effect=mock_delete)
                mock_client_instance.post = AsyncMock(side_effect=mock_post)
                mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
                mock_client_instance.__aexit__ = AsyncMock(return_value=None)
                MockAsyncClient.return_value = mock_client_instance

                result = await client.delete_user("auth0|123456")

        assert result is True
        # Should have invalidated cache on 401
        mock_cache.invalidate.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_user_500_raises_error(self, client):
        """Test 500 response raises Auth0ManagementError."""
        with patch("src.core.auth0_management._m2m_token_cache") as mock_cache:
            mock_cache.get.return_value = "cached-token"

            with patch("httpx.AsyncClient") as MockAsyncClient:
                mock_response = MagicMock()
                mock_response.status_code = 500

                mock_client_instance = MagicMock()
                mock_client_instance.delete = AsyncMock(return_value=mock_response)
                mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
                mock_client_instance.__aexit__ = AsyncMock(return_value=None)
                MockAsyncClient.return_value = mock_client_instance

                with pytest.raises(Auth0ManagementError) as exc_info:
                    await client.delete_user("auth0|123456")

        assert "500" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_delete_user_timeout_raises_error(self, client):
        """Test timeout raises Auth0ManagementError."""
        with patch("src.core.auth0_management._m2m_token_cache") as mock_cache:
            mock_cache.get.return_value = "cached-token"

            with patch("httpx.AsyncClient") as MockAsyncClient:
                mock_client_instance = MagicMock()
                mock_client_instance.delete = AsyncMock(
                    side_effect=httpx.TimeoutException("Timeout")
                )
                mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
                mock_client_instance.__aexit__ = AsyncMock(return_value=None)
                MockAsyncClient.return_value = mock_client_instance

                with pytest.raises(Auth0ManagementError) as exc_info:
                    await client.delete_user("auth0|123456")

        assert "timeout" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_get_management_token_uses_cache(self, client):
        """Test that cached token is used when available."""
        with patch("src.core.auth0_management._m2m_token_cache") as mock_cache:
            mock_cache.get.return_value = "cached-token"

            with patch("httpx.AsyncClient") as MockAsyncClient:
                mock_response = MagicMock()
                mock_response.status_code = 204

                mock_client_instance = MagicMock()
                mock_client_instance.delete = AsyncMock(return_value=mock_response)
                mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
                mock_client_instance.__aexit__ = AsyncMock(return_value=None)
                MockAsyncClient.return_value = mock_client_instance

                await client.delete_user("auth0|123456")

        # Token endpoint should not be called if cache is valid
        # (delete is called but not post for token)
        mock_client_instance.post.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_management_token_fetches_when_cache_empty(self, client):
        """Test that token is fetched when cache is empty."""
        with patch("src.core.auth0_management._m2m_token_cache") as mock_cache:
            mock_cache.get.return_value = None  # Cache miss

            with patch("httpx.AsyncClient") as MockAsyncClient:
                # Token fetch response
                token_response = MagicMock()
                token_response.status_code = 200
                token_response.json = MagicMock(return_value={"access_token": "new-token"})
                token_response.raise_for_status = MagicMock()

                # Delete response
                delete_response = MagicMock()
                delete_response.status_code = 204

                mock_client_instance = MagicMock()
                mock_client_instance.post = AsyncMock(return_value=token_response)
                mock_client_instance.delete = AsyncMock(return_value=delete_response)
                mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
                mock_client_instance.__aexit__ = AsyncMock(return_value=None)
                MockAsyncClient.return_value = mock_client_instance

                result = await client.delete_user("auth0|123456")

        assert result is True
        # Token should be cached
        mock_cache.set.assert_called_once_with("new-token")


@pytest.mark.unit
class TestGetAuth0ManagementClient:
    """Tests for get_auth0_management_client factory function."""

    def test_get_client_returns_none_when_not_configured(self):
        """Test that None is returned when Auth0 M2M is not configured."""
        with patch("src.core.auth0_management.settings") as mock_settings:
            mock_settings.auth0_m2m_configured = False

            result = get_auth0_management_client()

        assert result is None

    def test_get_client_returns_client_when_configured(self):
        """Test that client is returned when Auth0 M2M is configured."""
        with patch("src.core.auth0_management.settings") as mock_settings:
            mock_settings.auth0_m2m_configured = True
            mock_settings.auth0_domain = "test.us.auth0.com"
            mock_settings.auth0_m2m_client_id = "client-id"
            mock_settings.auth0_m2m_client_secret = "client-secret"

            result = get_auth0_management_client()

        assert result is not None
        assert isinstance(result, Auth0ManagementClient)
        assert result.domain == "test.us.auth0.com"
        assert result.client_id == "client-id"
        assert result.client_secret == "client-secret"


@pytest.mark.unit
class TestInvalidateM2MTokenCache:
    """Tests for invalidate_m2m_token_cache function."""

    def test_invalidate_m2m_token_cache(self):
        """Test that invalidate function clears the global cache."""
        with patch("src.core.auth0_management._m2m_token_cache") as mock_cache:
            invalidate_m2m_token_cache()

        mock_cache.invalidate.assert_called_once()
