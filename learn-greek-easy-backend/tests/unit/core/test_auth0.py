"""Unit tests for Auth0 token verification and JWKS caching."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from authlib.jose.errors import BadSignatureError, DecodeError, ExpiredTokenError

from src.core.auth0 import (
    Auth0UserInfo,
    JWKSCache,
    fetch_jwks,
    invalidate_jwks_cache,
    verify_auth0_token,
)
from src.core.exceptions import (
    Auth0DisabledException,
    Auth0TokenExpiredException,
    Auth0TokenInvalidException,
)


class TestAuth0UserInfo:
    """Tests for Auth0UserInfo dataclass."""

    def test_create_with_all_fields(self):
        """Test creating Auth0UserInfo with all fields."""
        user_info = Auth0UserInfo(
            auth0_id="auth0|123456",
            email="test@example.com",
            email_verified=True,
            name="Test User",
        )

        assert user_info.auth0_id == "auth0|123456"
        assert user_info.email == "test@example.com"
        assert user_info.email_verified is True
        assert user_info.name == "Test User"

    def test_create_with_minimal_fields(self):
        """Test creating Auth0UserInfo with only required fields."""
        user_info = Auth0UserInfo(auth0_id="auth0|789")

        assert user_info.auth0_id == "auth0|789"
        assert user_info.email is None
        assert user_info.email_verified is False
        assert user_info.name is None

    def test_immutable(self):
        """Test that Auth0UserInfo is immutable (frozen dataclass)."""
        user_info = Auth0UserInfo(auth0_id="auth0|123")

        with pytest.raises(Exception):  # FrozenInstanceError
            user_info.auth0_id = "different"


class TestJWKSCache:
    """Tests for JWKSCache class."""

    def test_cache_initially_empty(self):
        """Test that cache is empty on initialization."""
        cache = JWKSCache(ttl=3600)
        assert cache.get() is None

    def test_cache_set_and_get(self):
        """Test setting and getting cached keys."""
        cache = JWKSCache(ttl=3600)
        keys = {"keys": [{"kid": "key1"}]}

        cache.set(keys)
        assert cache.get() == keys

    def test_cache_expires(self):
        """Test that cache expires after TTL."""
        cache = JWKSCache(ttl=1)  # 1 second TTL
        keys = {"keys": [{"kid": "key1"}]}

        cache.set(keys)
        assert cache.get() == keys

        # Manually set fetched_at to expired time
        cache._fetched_at = 0

        assert cache.get() is None

    def test_cache_invalidate(self):
        """Test cache invalidation."""
        cache = JWKSCache(ttl=3600)
        keys = {"keys": [{"kid": "key1"}]}

        cache.set(keys)
        assert cache.get() == keys

        cache.invalidate()
        assert cache.get() is None


class TestFetchJWKS:
    """Tests for fetch_jwks function."""

    @pytest.mark.asyncio
    @patch("src.core.auth0._jwks_cache")
    @patch("src.core.auth0.httpx.AsyncClient")
    async def test_returns_cached_keys(self, mock_client_class, mock_cache):
        """Test that cached keys are returned without HTTP call."""
        cached_keys = {"keys": [{"kid": "cached-key"}]}
        mock_cache.get.return_value = cached_keys

        result = await fetch_jwks("https://example.auth0.com/.well-known/jwks.json")

        assert result == cached_keys
        mock_client_class.assert_not_called()

    @pytest.mark.asyncio
    @patch("src.core.auth0._jwks_cache")
    async def test_fetches_and_caches_keys(self, mock_cache):
        """Test fetching fresh keys when cache is empty."""
        mock_cache.get.return_value = None
        fresh_keys = {"keys": [{"kid": "fresh-key"}]}

        # Mock httpx response
        mock_response = MagicMock()
        mock_response.json.return_value = fresh_keys
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        with patch("src.core.auth0.httpx.AsyncClient") as mock_client_class:
            mock_client_class.return_value.__aenter__.return_value = mock_client

            result = await fetch_jwks("https://example.auth0.com/.well-known/jwks.json")

            assert result == fresh_keys
            mock_cache.set.assert_called_once_with(fresh_keys)

    @pytest.mark.asyncio
    @patch("src.core.auth0._jwks_cache")
    async def test_timeout_raises_exception(self, mock_cache):
        """Test timeout error handling."""
        mock_cache.get.return_value = None

        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx.TimeoutException("Connection timeout")

        with patch("src.core.auth0.httpx.AsyncClient") as mock_client_class:
            mock_client_class.return_value.__aenter__.return_value = mock_client

            with pytest.raises(Auth0TokenInvalidException) as exc_info:
                await fetch_jwks("https://example.auth0.com/.well-known/jwks.json")

            assert "JWKS timeout" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    @patch("src.core.auth0._jwks_cache")
    async def test_http_error_raises_exception(self, mock_cache):
        """Test HTTP error handling."""
        mock_cache.get.return_value = None

        mock_response = MagicMock()
        mock_response.status_code = 500

        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx.HTTPStatusError(
            "Server error", request=MagicMock(), response=mock_response
        )

        with patch("src.core.auth0.httpx.AsyncClient") as mock_client_class:
            mock_client_class.return_value.__aenter__.return_value = mock_client

            with pytest.raises(Auth0TokenInvalidException) as exc_info:
                await fetch_jwks("https://example.auth0.com/.well-known/jwks.json")

            assert "JWKS fetch failed" in str(exc_info.value.detail)


class TestVerifyAuth0Token:
    """Tests for verify_auth0_token function."""

    @pytest.mark.asyncio
    @patch("src.core.auth0.settings")
    async def test_raises_when_not_configured(self, mock_settings):
        """Test Auth0DisabledException when Auth0 is not configured."""
        mock_settings.auth0_configured = False

        with pytest.raises(Auth0DisabledException):
            await verify_auth0_token("some-token")

    @pytest.mark.asyncio
    @patch("src.core.auth0.fetch_jwks")
    @patch("src.core.auth0.jwt")
    @patch("src.core.auth0.JsonWebKey")
    @patch("src.core.auth0.settings")
    async def test_valid_token_returns_user_info(
        self, mock_settings, mock_jwk, mock_jwt, mock_fetch
    ):
        """Test successful token verification."""
        # Configure settings
        mock_settings.auth0_configured = True
        mock_settings.auth0_jwks_uri = "https://example.auth0.com/.well-known/jwks.json"
        mock_settings.auth0_issuer = "https://example.auth0.com/"
        mock_settings.auth0_audience = "https://api.example.com"

        # Mock JWKS
        mock_fetch.return_value = {"keys": [{"kid": "key1"}]}
        mock_jwk.import_key_set.return_value = MagicMock()

        # Mock JWT decode
        mock_claims = MagicMock()
        mock_claims.get.side_effect = lambda key, default=None: {
            "sub": "auth0|123456",
            "email": "test@example.com",
            "email_verified": True,
            "name": "Test User",
        }.get(key, default)
        mock_claims.validate = MagicMock()
        mock_jwt.decode.return_value = mock_claims

        result = await verify_auth0_token("valid-token")

        assert result.auth0_id == "auth0|123456"
        assert result.email == "test@example.com"
        assert result.email_verified is True
        assert result.name == "Test User"

    @pytest.mark.asyncio
    @patch("src.core.auth0.fetch_jwks")
    @patch("src.core.auth0.jwt")
    @patch("src.core.auth0.JsonWebKey")
    @patch("src.core.auth0.settings")
    async def test_expired_token_raises_exception(
        self, mock_settings, mock_jwk, mock_jwt, mock_fetch
    ):
        """Test expired token handling."""
        mock_settings.auth0_configured = True
        mock_settings.auth0_jwks_uri = "https://example.auth0.com/.well-known/jwks.json"
        mock_settings.auth0_issuer = "https://example.auth0.com/"
        mock_settings.auth0_audience = "https://api.example.com"

        mock_fetch.return_value = {"keys": []}
        mock_jwk.import_key_set.return_value = MagicMock()
        mock_jwt.decode.side_effect = ExpiredTokenError()

        with pytest.raises(Auth0TokenExpiredException):
            await verify_auth0_token("expired-token")

    @pytest.mark.asyncio
    @patch("src.core.auth0.fetch_jwks")
    @patch("src.core.auth0.jwt")
    @patch("src.core.auth0.JsonWebKey")
    @patch("src.core.auth0.settings")
    async def test_bad_signature_raises_exception(
        self, mock_settings, mock_jwk, mock_jwt, mock_fetch
    ):
        """Test invalid signature handling."""
        mock_settings.auth0_configured = True
        mock_settings.auth0_jwks_uri = "https://example.auth0.com/.well-known/jwks.json"
        mock_settings.auth0_issuer = "https://example.auth0.com/"
        mock_settings.auth0_audience = "https://api.example.com"

        mock_fetch.return_value = {"keys": []}
        mock_jwk.import_key_set.return_value = MagicMock()
        mock_jwt.decode.side_effect = BadSignatureError("Invalid signature")

        with pytest.raises(Auth0TokenInvalidException) as exc_info:
            await verify_auth0_token("tampered-token")

        assert "Invalid token signature" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    @patch("src.core.auth0.fetch_jwks")
    @patch("src.core.auth0.jwt")
    @patch("src.core.auth0.JsonWebKey")
    @patch("src.core.auth0.settings")
    async def test_decode_error_raises_exception(
        self, mock_settings, mock_jwk, mock_jwt, mock_fetch
    ):
        """Test decode error handling."""
        mock_settings.auth0_configured = True
        mock_settings.auth0_jwks_uri = "https://example.auth0.com/.well-known/jwks.json"
        mock_settings.auth0_issuer = "https://example.auth0.com/"
        mock_settings.auth0_audience = "https://api.example.com"

        mock_fetch.return_value = {"keys": []}
        mock_jwk.import_key_set.return_value = MagicMock()
        mock_jwt.decode.side_effect = DecodeError("Malformed token")

        with pytest.raises(Auth0TokenInvalidException) as exc_info:
            await verify_auth0_token("malformed-token")

        assert "Token could not be decoded" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    @patch("src.core.auth0.fetch_jwks")
    @patch("src.core.auth0.jwt")
    @patch("src.core.auth0.JsonWebKey")
    @patch("src.core.auth0.settings")
    async def test_missing_sub_claim_raises_exception(
        self, mock_settings, mock_jwk, mock_jwt, mock_fetch
    ):
        """Test missing sub claim handling."""
        mock_settings.auth0_configured = True
        mock_settings.auth0_jwks_uri = "https://example.auth0.com/.well-known/jwks.json"
        mock_settings.auth0_issuer = "https://example.auth0.com/"
        mock_settings.auth0_audience = "https://api.example.com"

        mock_fetch.return_value = {"keys": []}
        mock_jwk.import_key_set.return_value = MagicMock()

        # Mock claims without sub
        mock_claims = MagicMock()
        mock_claims.get.return_value = None
        mock_claims.validate = MagicMock()
        mock_jwt.decode.return_value = mock_claims

        with pytest.raises(Auth0TokenInvalidException) as exc_info:
            await verify_auth0_token("no-sub-token")

        assert "missing sub claim" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    @patch("src.core.auth0.fetch_jwks")
    @patch("src.core.auth0.jwt")
    @patch("src.core.auth0.JsonWebKey")
    @patch("src.core.auth0.settings")
    async def test_extracts_email_from_custom_namespace(
        self, mock_settings, mock_jwk, mock_jwt, mock_fetch
    ):
        """Test extracting email from custom namespace claim."""
        mock_settings.auth0_configured = True
        mock_settings.auth0_jwks_uri = "https://example.auth0.com/.well-known/jwks.json"
        mock_settings.auth0_issuer = "https://example.auth0.com/"
        mock_settings.auth0_audience = "https://api.example.com"

        mock_fetch.return_value = {"keys": []}
        mock_jwk.import_key_set.return_value = MagicMock()

        # Mock claims with namespaced email (no standard email claim)
        def get_claim(key, default=None):
            claims_data = {
                "sub": "auth0|123",
                "email": None,
                "https://api.example.com/email": "namespaced@example.com",
                "email_verified": False,
                "https://api.example.com/email_verified": True,
            }
            return claims_data.get(key, default)

        mock_claims = MagicMock()
        mock_claims.get.side_effect = get_claim
        mock_claims.validate = MagicMock()
        mock_jwt.decode.return_value = mock_claims

        result = await verify_auth0_token("namespaced-token")

        assert result.auth0_id == "auth0|123"
        # Note: Current implementation looks for standard claims first,
        # then falls back to namespaced
        assert result.email == "namespaced@example.com"


class TestInvalidateJWKSCache:
    """Tests for invalidate_jwks_cache function."""

    @patch("src.core.auth0._jwks_cache")
    def test_invalidates_cache(self, mock_cache):
        """Test that invalidate_jwks_cache calls cache.invalidate()."""
        invalidate_jwks_cache()
        mock_cache.invalidate.assert_called_once()
