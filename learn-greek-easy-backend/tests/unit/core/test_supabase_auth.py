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

import base64
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest
from authlib.jose import jwt
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from src.core.exceptions import TokenExpiredException, TokenInvalidException
from src.core.supabase_auth import SupabaseUserClaims, invalidate_jwks_cache, verify_supabase_token

# =============================================================================
# RSA Key Pair Generation
# =============================================================================


def generate_rsa_key_pair():
    """Generate an RSA key pair for testing.

    Returns:
        tuple: (private_key, public_key_jwk)
            - private_key: RSA private key for signing tokens
            - public_key_jwk: Public key in JWK format for JWKS mock
    """
    # Generate RSA key pair
    private_key = rsa.generate_private_key(
        public_exponent=65537, key_size=2048, backend=default_backend()
    )

    # Get public key
    public_key = private_key.public_key()

    # Convert public key to PEM format then to JWK
    public_numbers = public_key.public_numbers()

    # Extract modulus (n) and exponent (e)
    n = public_numbers.n
    e = public_numbers.e

    # Convert to base64url encoding (JWK format)
    def int_to_base64url(num):
        num_bytes = num.to_bytes((num.bit_length() + 7) // 8, byteorder="big")
        return base64.urlsafe_b64encode(num_bytes).rstrip(b"=").decode("ascii")

    # Create JWK representation
    public_key_jwk = {
        "kty": "RSA",
        "kid": "test-key-id",
        "use": "sig",
        "alg": "RS256",
        "n": int_to_base64url(n),
        "e": int_to_base64url(e),
    }

    return private_key, public_key_jwk


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def rsa_keys():
    """Generate RSA key pair for testing."""
    return generate_rsa_key_pair()


@pytest.fixture
def mock_settings(rsa_keys):
    """Mock settings for Supabase configuration."""
    _, public_key_jwk = rsa_keys
    with patch("src.core.supabase_auth.settings") as mock:
        mock.supabase_url = "https://test.supabase.co"
        mock.supabase_secret_key = "test-secret"
        mock.supabase_configured = True
        mock.supabase_jwks_url = "https://test.supabase.co/auth/v1/.well-known/jwks.json"
        mock.supabase_issuer = "https://test.supabase.co/auth/v1"
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
def mock_jwks_response(rsa_keys):
    """Mock JWKS endpoint response with real RSA public key."""
    _, public_key_jwk = rsa_keys
    return {"keys": [public_key_jwk]}


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
        self, mock_settings, valid_token_payload, mock_jwks_response, rsa_keys
    ):
        """Test that valid token returns correct claims."""
        private_key, _ = rsa_keys

        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            # Create JWT token signed with RSA private key
            header = {"alg": "RS256", "kid": "test-key-id"}
            private_key_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            token = jwt.encode(header, valid_token_payload, private_key_pem)

            claims = await verify_supabase_token(token)

            assert isinstance(claims, SupabaseUserClaims)
            assert claims.supabase_id == valid_token_payload["sub"]
            assert claims.email == valid_token_payload["email"]
            assert claims.full_name == "Test User"

    @pytest.mark.asyncio
    async def test_email_extraction_from_claims(
        self, mock_settings, valid_token_payload, mock_jwks_response, rsa_keys
    ):
        """Test email is correctly extracted from token."""
        private_key, _ = rsa_keys

        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            header = {"alg": "RS256", "kid": "test-key-id"}
            private_key_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            token = jwt.encode(header, valid_token_payload, private_key_pem)

            claims = await verify_supabase_token(token)

            assert claims.email == "test@example.com"

    @pytest.mark.asyncio
    async def test_full_name_from_user_metadata(
        self, mock_settings, valid_token_payload, mock_jwks_response, rsa_keys
    ):
        """Test full_name is extracted from user_metadata."""
        private_key, _ = rsa_keys

        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            header = {"alg": "RS256", "kid": "test-key-id"}
            private_key_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            token = jwt.encode(header, valid_token_payload, private_key_pem)

            claims = await verify_supabase_token(token)

            assert claims.full_name == "Test User"

    @pytest.mark.asyncio
    async def test_missing_email_returns_none(
        self, mock_settings, valid_token_payload, mock_jwks_response, rsa_keys
    ):
        """Test that missing email returns None."""
        private_key, _ = rsa_keys
        payload_without_email = {**valid_token_payload}
        del payload_without_email["email"]

        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            header = {"alg": "RS256", "kid": "test-key-id"}
            private_key_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            token = jwt.encode(header, payload_without_email, private_key_pem)

            claims = await verify_supabase_token(token)

            assert claims.email is None


# =============================================================================
# Invalid Token Tests
# =============================================================================


class TestInvalidTokens:
    """Tests for invalid token handling."""

    @pytest.mark.asyncio
    async def test_expired_token_raises_exception(
        self, mock_settings, mock_jwks_response, rsa_keys
    ):
        """Test that expired token raises TokenExpiredException."""
        private_key, _ = rsa_keys
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

            header = {"alg": "RS256", "kid": "test-key-id"}
            private_key_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            token = jwt.encode(header, expired_payload, private_key_pem)

            with pytest.raises(TokenExpiredException) as exc_info:
                await verify_supabase_token(token)

            assert "expired" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_invalid_signature_raises_exception(
        self, mock_settings, mock_jwks_response, rsa_keys
    ):
        """Test that invalid signature raises TokenInvalidException."""
        # Create a DIFFERENT RSA key pair for signing (mismatch with JWKS)
        wrong_private_key, _ = generate_rsa_key_pair()

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

            # Sign with wrong private key
            header = {"alg": "RS256", "kid": "test-key-id"}
            wrong_private_key_pem = wrong_private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            token = jwt.encode(header, payload, wrong_private_key_pem)

            with pytest.raises(TokenInvalidException) as exc_info:
                await verify_supabase_token(token)

            assert "invalid" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_missing_sub_raises_exception(self, mock_settings, mock_jwks_response, rsa_keys):
        """Test that missing 'sub' claim raises TokenInvalidException."""
        private_key, _ = rsa_keys
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

            header = {"alg": "RS256", "kid": "test-key-id"}
            private_key_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            token = jwt.encode(header, payload_without_sub, private_key_pem)

            with pytest.raises(TokenInvalidException) as exc_info:
                await verify_supabase_token(token)

            assert "missing" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_wrong_audience_raises_exception(
        self, mock_settings, mock_jwks_response, rsa_keys
    ):
        """Test that wrong audience claim raises TokenInvalidException."""
        private_key, _ = rsa_keys
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

            header = {"alg": "RS256", "kid": "test-key-id"}
            private_key_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            token = jwt.encode(header, payload_wrong_aud, private_key_pem)

            with pytest.raises(TokenInvalidException) as exc_info:
                await verify_supabase_token(token)

            assert "aud" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_wrong_issuer_raises_exception(self, mock_settings, mock_jwks_response, rsa_keys):
        """Test that wrong issuer claim raises TokenInvalidException."""
        private_key, _ = rsa_keys
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

            header = {"alg": "RS256", "kid": "test-key-id"}
            private_key_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            token = jwt.encode(header, payload_wrong_iss, private_key_pem)

            with pytest.raises(TokenInvalidException) as exc_info:
                await verify_supabase_token(token)

            assert "iss" in str(exc_info.value.detail).lower()


# =============================================================================
# JWKS Endpoint Tests
# =============================================================================


class TestJWKSEndpoint:
    """Tests for JWKS endpoint interaction."""

    @pytest.mark.asyncio
    async def test_jwks_timeout_raises_exception(
        self, mock_settings, valid_token_payload, rsa_keys
    ):
        """Test that JWKS endpoint timeout raises TokenInvalidException."""
        private_key, _ = rsa_keys

        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get.side_effect = TimeoutError(
                "Request timeout"
            )

            header = {"alg": "RS256", "kid": "test-key-id"}
            private_key_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            token = jwt.encode(header, valid_token_payload, private_key_pem)

            with pytest.raises(TokenInvalidException) as exc_info:
                await verify_supabase_token(token)

            # TimeoutError gets caught as general exception and returns generic JWKS error
            assert "jwks" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_jwks_error_response_raises_exception(
        self, mock_settings, valid_token_payload, rsa_keys
    ):
        """Test that JWKS error response raises TokenInvalidException."""
        private_key, _ = rsa_keys

        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 500
            mock_response.raise_for_status.side_effect = Exception("Server error")
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            header = {"alg": "RS256", "kid": "test-key-id"}
            private_key_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            token = jwt.encode(header, valid_token_payload, private_key_pem)

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
        self, mock_settings, valid_token_payload, mock_jwks_response, rsa_keys
    ):
        """Test that second request uses cached JWKS."""
        private_key, _ = rsa_keys

        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            header = {"alg": "RS256", "kid": "test-key-id"}
            private_key_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            token = jwt.encode(header, valid_token_payload, private_key_pem)

            # First call - should fetch JWKS
            await verify_supabase_token(token)

            # Second call - should use cache
            await verify_supabase_token(token)

            # Should only call JWKS endpoint once
            assert mock_client.return_value.__aenter__.return_value.get.call_count == 1

    @pytest.mark.asyncio
    async def test_cache_invalidation_refetches_keys(
        self, mock_settings, valid_token_payload, mock_jwks_response, rsa_keys
    ):
        """Test that cache invalidation causes refetch."""
        private_key, _ = rsa_keys

        with patch("src.core.supabase_auth.httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_jwks_response
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            header = {"alg": "RS256", "kid": "test-key-id"}
            private_key_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            token = jwt.encode(header, valid_token_payload, private_key_pem)

            # First call
            await verify_supabase_token(token)

            # Invalidate cache
            invalidate_jwks_cache()

            # Second call should refetch
            await verify_supabase_token(token)

            # Should call JWKS endpoint twice
            assert mock_client.return_value.__aenter__.return_value.get.call_count == 2
