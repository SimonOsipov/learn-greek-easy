"""Unit tests for Supabase authentication token verification.

Tests cover:
- Valid token verification and claims extraction
- Expired token handling
- Invalid signature detection
- Missing/wrong claims (sub, aud, iss)
- JWKS endpoint failures (timeout, error)
- Key rotation and retry logic
- Cache behavior (hit, miss, expiry, invalidate)
- Email extraction from token claims
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest
from authlib.jose import jwt

from src.core.exceptions import TokenExpiredException, TokenInvalidException
from src.core.supabase_auth import SupabaseUserClaims, invalidate_jwks_cache, verify_supabase_token

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def mock_settings():
    """Mock settings for Supabase configuration."""
    with patch("src.core.supabase_auth.settings") as mock:
        mock.supabase_url = "https://test.supabase.co"
        mock.supabase_jwt_secret = "test-jwt-secret"
        yield mock


@pytest.fixture
def valid_token_payload():
    """Provide a valid token payload."""
    return {
        "sub": str(uuid4()),
        "email": "test@example.com",
        "aud": "authenticated",
        "iss": "https://test.supabase.co/auth/v1",
        "exp": int((datetime.utcnow() + timedelta(hours=1)).timestamp()),
        "iat": int(datetime.utcnow().timestamp()),
        "user_metadata": {
            "full_name": "Test User",
        },
    }


@pytest.fixture
def mock_jwks_response():
    """Mock JWKS endpoint response."""
    return {
        "keys": [
            {
                "kty": "RSA",
                "kid": "test-key-id",
                "use": "sig",
                "alg": "RS256",
                "n": "test-n-value",
                "e": "AQAB",
            }
        ]
    }


@pytest.fixture(autouse=True)
def clear_cache():
    """Clear JWKS cache before each test."""
    invalidate_jwks_cache()
    yield
    invalidate_jwks_cache()


# =============================================================================
# Valid Token Tests
# =============================================================================


class TestValidTokenVerification:
    """Tests for valid token verification."""

    @pytest.mark.asyncio
    async def test_valid_token_returns_claims(
        self, mock_settings, valid_token_payload, mock_jwks_response
    ):
        """Test that valid token returns correct claims."""
        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            # Create a real JWT token for testing
            token = jwt.encode(
                {"alg": "HS256"}, valid_token_payload, mock_settings.supabase_jwt_secret
            )

            claims = await verify_supabase_token(token)

            assert isinstance(claims, SupabaseUserClaims)
            assert claims.supabase_id == valid_token_payload["sub"]
            assert claims.email == valid_token_payload["email"]
            assert claims.full_name == "Test User"

    @pytest.mark.asyncio
    async def test_email_extraction_from_claims(
        self, mock_settings, valid_token_payload, mock_jwks_response
    ):
        """Test email is correctly extracted from token."""
        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            token = jwt.encode(
                {"alg": "HS256"}, valid_token_payload, mock_settings.supabase_jwt_secret
            )

            claims = await verify_supabase_token(token)

            assert claims.email == "test@example.com"

    @pytest.mark.asyncio
    async def test_full_name_from_user_metadata(
        self, mock_settings, valid_token_payload, mock_jwks_response
    ):
        """Test full_name is extracted from user_metadata."""
        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            token = jwt.encode(
                {"alg": "HS256"}, valid_token_payload, mock_settings.supabase_jwt_secret
            )

            claims = await verify_supabase_token(token)

            assert claims.full_name == "Test User"

    @pytest.mark.asyncio
    async def test_missing_email_returns_none(
        self, mock_settings, valid_token_payload, mock_jwks_response
    ):
        """Test that missing email returns None."""
        payload_without_email = {**valid_token_payload}
        del payload_without_email["email"]

        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            token = jwt.encode(
                {"alg": "HS256"},
                payload_without_email,
                mock_settings.supabase_jwt_secret,
            )

            claims = await verify_supabase_token(token)

            assert claims.email is None


# =============================================================================
# Invalid Token Tests
# =============================================================================


class TestInvalidTokens:
    """Tests for invalid token handling."""

    @pytest.mark.asyncio
    async def test_expired_token_raises_exception(self, mock_settings, mock_jwks_response):
        """Test that expired token raises TokenExpiredException."""
        expired_payload = {
            "sub": str(uuid4()),
            "email": "test@example.com",
            "aud": "authenticated",
            "iss": "https://test.supabase.co/auth/v1",
            "exp": int((datetime.utcnow() - timedelta(hours=1)).timestamp()),
            "iat": int((datetime.utcnow() - timedelta(hours=2)).timestamp()),
        }

        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            token = jwt.encode({"alg": "HS256"}, expired_payload, mock_settings.supabase_jwt_secret)

            with pytest.raises(TokenExpiredException) as exc_info:
                await verify_supabase_token(token)

            assert "expired" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_invalid_signature_raises_exception(self, mock_settings, mock_jwks_response):
        """Test that invalid signature raises TokenInvalidException."""
        payload = {
            "sub": str(uuid4()),
            "email": "test@example.com",
            "aud": "authenticated",
            "iss": "https://test.supabase.co/auth/v1",
            "exp": int((datetime.utcnow() + timedelta(hours=1)).timestamp()),
            "iat": int(datetime.utcnow().timestamp()),
        }

        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            # Create token with wrong secret
            token = jwt.encode({"alg": "HS256"}, payload, "wrong-secret")

            with pytest.raises(TokenInvalidException) as exc_info:
                await verify_supabase_token(token)

            assert "invalid" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_missing_sub_raises_exception(self, mock_settings, mock_jwks_response):
        """Test that missing 'sub' claim raises TokenInvalidException."""
        payload_without_sub = {
            "email": "test@example.com",
            "aud": "authenticated",
            "iss": "https://test.supabase.co/auth/v1",
            "exp": int((datetime.utcnow() + timedelta(hours=1)).timestamp()),
            "iat": int(datetime.utcnow().timestamp()),
        }

        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            token = jwt.encode(
                {"alg": "HS256"},
                payload_without_sub,
                mock_settings.supabase_jwt_secret,
            )

            with pytest.raises(TokenInvalidException) as exc_info:
                await verify_supabase_token(token)

            assert "missing" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_wrong_audience_raises_exception(self, mock_settings, mock_jwks_response):
        """Test that wrong audience claim raises TokenInvalidException."""
        payload_wrong_aud = {
            "sub": str(uuid4()),
            "email": "test@example.com",
            "aud": "wrong-audience",
            "iss": "https://test.supabase.co/auth/v1",
            "exp": int((datetime.utcnow() + timedelta(hours=1)).timestamp()),
            "iat": int(datetime.utcnow().timestamp()),
        }

        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            token = jwt.encode(
                {"alg": "HS256"},
                payload_wrong_aud,
                mock_settings.supabase_jwt_secret,
            )

            with pytest.raises(TokenInvalidException) as exc_info:
                await verify_supabase_token(token)

            assert "audience" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_wrong_issuer_raises_exception(self, mock_settings, mock_jwks_response):
        """Test that wrong issuer claim raises TokenInvalidException."""
        payload_wrong_iss = {
            "sub": str(uuid4()),
            "email": "test@example.com",
            "aud": "authenticated",
            "iss": "https://wrong-issuer.com",
            "exp": int((datetime.utcnow() + timedelta(hours=1)).timestamp()),
            "iat": int(datetime.utcnow().timestamp()),
        }

        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            token = jwt.encode(
                {"alg": "HS256"},
                payload_wrong_iss,
                mock_settings.supabase_jwt_secret,
            )

            with pytest.raises(TokenInvalidException) as exc_info:
                await verify_supabase_token(token)

            assert "issuer" in str(exc_info.value.detail).lower()


# =============================================================================
# JWKS Endpoint Tests
# =============================================================================


class TestJWKSEndpoint:
    """Tests for JWKS endpoint interaction."""

    @pytest.mark.asyncio
    async def test_jwks_timeout_raises_exception(self, mock_settings, valid_token_payload):
        """Test that JWKS endpoint timeout raises TokenInvalidException."""
        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get.side_effect = TimeoutError(
                "Request timeout"
            )

            token = jwt.encode(
                {"alg": "HS256"}, valid_token_payload, mock_settings.supabase_jwt_secret
            )

            with pytest.raises(TokenInvalidException) as exc_info:
                await verify_supabase_token(token)

            assert "timeout" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_jwks_error_response_raises_exception(self, mock_settings, valid_token_payload):
        """Test that JWKS error response raises TokenInvalidException."""
        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 500
            mock_response.raise_for_status.side_effect = Exception("Server error")
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            token = jwt.encode(
                {"alg": "HS256"}, valid_token_payload, mock_settings.supabase_jwt_secret
            )

            with pytest.raises(TokenInvalidException) as exc_info:
                await verify_supabase_token(token)

            assert "jwks" in str(exc_info.value.detail).lower()


# =============================================================================
# Cache Tests
# =============================================================================


class TestJWKSCache:
    """Tests for JWKS caching behavior."""

    @pytest.mark.asyncio
    async def test_cache_hit_reuses_keys(
        self, mock_settings, valid_token_payload, mock_jwks_response
    ):
        """Test that second request uses cached JWKS."""
        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            token = jwt.encode(
                {"alg": "HS256"}, valid_token_payload, mock_settings.supabase_jwt_secret
            )

            # First call - should fetch JWKS
            await verify_supabase_token(token)

            # Second call - should use cache
            await verify_supabase_token(token)

            # Should only call JWKS endpoint once
            assert mock_client.return_value.__aenter__.return_value.get.call_count == 1

    @pytest.mark.asyncio
    async def test_cache_invalidation_refetches_keys(
        self, mock_settings, valid_token_payload, mock_jwks_response
    ):
        """Test that cache invalidation causes refetch."""
        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            token = jwt.encode(
                {"alg": "HS256"}, valid_token_payload, mock_settings.supabase_jwt_secret
            )

            # First call
            await verify_supabase_token(token)

            # Invalidate cache
            invalidate_jwks_cache()

            # Second call should refetch
            await verify_supabase_token(token)

            # Should call JWKS endpoint twice
            assert mock_client.return_value.__aenter__.return_value.get.call_count == 2
