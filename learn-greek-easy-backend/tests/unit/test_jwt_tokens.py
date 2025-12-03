"""Unit tests for JWT token generation and validation.

Tests cover:
- Access token generation with correct expiry
- Refresh token generation with correct expiry
- Token verification with correct user_id extraction
- Token type validation (access vs refresh)
- Expired token handling
- Invalid token handling
- Token extraction from HTTP headers
"""

import time
from datetime import datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt

from src.config import settings
from src.core.exceptions import TokenExpiredException, TokenInvalidException
from src.core.security import (
    create_access_token,
    create_refresh_token,
    extract_token_from_header,
    verify_token,
)

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def sample_user_id() -> UUID:
    """Provide a sample user UUID for testing."""
    return uuid4()


@pytest.fixture
def sample_access_token(sample_user_id: UUID) -> tuple[str, datetime]:
    """Provide a sample access token and expiration."""
    return create_access_token(sample_user_id)


@pytest.fixture
def sample_refresh_token(sample_user_id: UUID) -> tuple[str, datetime]:
    """Provide a sample refresh token and expiration."""
    return create_refresh_token(sample_user_id)


# ============================================================================
# Access Token Generation Tests
# ============================================================================


class TestAccessTokenGeneration:
    """Tests for access token generation."""

    def test_create_access_token_returns_tuple(self, sample_user_id: UUID) -> None:
        """Test that create_access_token returns (token, expiration) tuple."""
        result = create_access_token(sample_user_id)
        assert isinstance(result, tuple)
        assert len(result) == 2
        token, expires_at = result
        assert isinstance(token, str)
        assert isinstance(expires_at, datetime)

    def test_access_token_is_valid_jwt(self, sample_access_token: tuple[str, datetime]) -> None:
        """Test that access token is a valid JWT format."""
        token, _ = sample_access_token
        # JWT format: header.payload.signature
        parts = token.split(".")
        assert len(parts) == 3

    def test_access_token_expiry_is_30_minutes(self, sample_user_id: UUID) -> None:
        """Test that access token expires in 30 minutes (or configured value)."""
        before = datetime.utcnow()
        token, expires_at = create_access_token(sample_user_id)
        after = datetime.utcnow()

        # Calculate expected expiry range
        expected_delta = timedelta(minutes=settings.jwt_access_token_expire_minutes)
        min_expiry = before + expected_delta
        max_expiry = after + expected_delta

        # Expiration should be within this range
        assert min_expiry <= expires_at <= max_expiry

    def test_access_token_contains_correct_payload(self, sample_user_id: UUID) -> None:
        """Test that access token payload contains correct claims."""
        token, expires_at = create_access_token(sample_user_id)

        # Decode WITHOUT verification to inspect payload
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )

        # Verify payload structure
        assert "sub" in payload
        assert "exp" in payload
        assert "iat" in payload
        assert "type" in payload

        # Verify payload values
        assert payload["sub"] == str(sample_user_id)
        assert payload["type"] == "access"

    def test_access_token_different_each_time(self, sample_user_id: UUID) -> None:
        """Test that generating access tokens produces different tokens each time."""
        token1, _ = create_access_token(sample_user_id)
        time.sleep(1)  # 1 second delay to ensure different iat timestamp
        token2, _ = create_access_token(sample_user_id)

        # Tokens should be different due to different "iat" timestamps
        assert token1 != token2


# ============================================================================
# Refresh Token Generation Tests
# ============================================================================


class TestRefreshTokenGeneration:
    """Tests for refresh token generation."""

    def test_create_refresh_token_returns_tuple(self, sample_user_id: UUID) -> None:
        """Test that create_refresh_token returns (token, expiration) tuple."""
        result = create_refresh_token(sample_user_id)
        assert isinstance(result, tuple)
        assert len(result) == 2
        token, expires_at = result
        assert isinstance(token, str)
        assert isinstance(expires_at, datetime)

    def test_refresh_token_is_valid_jwt(self, sample_refresh_token: tuple[str, datetime]) -> None:
        """Test that refresh token is a valid JWT format."""
        token, _ = sample_refresh_token
        parts = token.split(".")
        assert len(parts) == 3

    def test_refresh_token_expiry_is_30_days(self, sample_user_id: UUID) -> None:
        """Test that refresh token expires in 30 days (or configured value)."""
        before = datetime.utcnow()
        token, expires_at = create_refresh_token(sample_user_id)
        after = datetime.utcnow()

        # Calculate expected expiry range
        expected_delta = timedelta(days=settings.jwt_refresh_token_expire_days)
        min_expiry = before + expected_delta
        max_expiry = after + expected_delta

        # Expiration should be within this range
        assert min_expiry <= expires_at <= max_expiry

    def test_refresh_token_contains_correct_payload(self, sample_user_id: UUID) -> None:
        """Test that refresh token payload contains correct claims."""
        token, expires_at = create_refresh_token(sample_user_id)

        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )

        # Verify payload structure
        assert "sub" in payload
        assert "exp" in payload
        assert "iat" in payload
        assert "type" in payload

        # Verify payload values
        assert payload["sub"] == str(sample_user_id)
        assert payload["type"] == "refresh"

    def test_refresh_token_different_from_access_token(self, sample_user_id: UUID) -> None:
        """Test that access and refresh tokens are different."""
        access_token, _ = create_access_token(sample_user_id)
        refresh_token, _ = create_refresh_token(sample_user_id)

        assert access_token != refresh_token


# ============================================================================
# Token Verification Tests
# ============================================================================


class TestTokenVerification:
    """Tests for token verification and user_id extraction."""

    def test_verify_access_token_returns_user_id(
        self, sample_user_id: UUID, sample_access_token: tuple[str, datetime]
    ) -> None:
        """Test that verifying access token returns correct user_id."""
        token, _ = sample_access_token
        user_id = verify_token(token, "access")

        assert isinstance(user_id, UUID)
        assert user_id == sample_user_id

    def test_verify_refresh_token_returns_user_id(
        self, sample_user_id: UUID, sample_refresh_token: tuple[str, datetime]
    ) -> None:
        """Test that verifying refresh token returns correct user_id."""
        token, _ = sample_refresh_token
        user_id = verify_token(token, "refresh")

        assert isinstance(user_id, UUID)
        assert user_id == sample_user_id

    def test_verify_token_default_type_is_access(
        self, sample_access_token: tuple[str, datetime]
    ) -> None:
        """Test that verify_token defaults to 'access' type."""
        token, _ = sample_access_token
        # Should work without specifying token_type
        user_id = verify_token(token)
        assert isinstance(user_id, UUID)

    def test_verify_token_wrong_type_raises_exception(
        self, sample_access_token: tuple[str, datetime]
    ) -> None:
        """Test that using wrong token type raises TokenInvalidException."""
        token, _ = sample_access_token  # This is an access token

        # Try to verify as refresh token (should fail)
        with pytest.raises(TokenInvalidException) as exc_info:
            verify_token(token, "refresh")

        assert "Invalid token type" in str(exc_info.value.detail)

    def test_verify_token_invalid_signature_raises_exception(self, sample_user_id: UUID) -> None:
        """Test that token with invalid signature raises TokenInvalidException."""
        # Create a token with different secret
        fake_token = jwt.encode(
            {"sub": str(sample_user_id), "type": "access"},
            "wrong-secret-key",
            algorithm=settings.jwt_algorithm,
        )

        with pytest.raises(TokenInvalidException):
            verify_token(fake_token, "access")

    def test_verify_token_malformed_token_raises_exception(self) -> None:
        """Test that malformed token raises TokenInvalidException."""
        malformed_tokens = [
            "not-a-jwt-token",
            "invalid.jwt",
            "",
            "header.payload",  # Missing signature
        ]

        for token in malformed_tokens:
            with pytest.raises(TokenInvalidException):
                verify_token(token, "access")

    def test_verify_token_missing_subject_raises_exception(self) -> None:
        """Test that token without 'sub' claim raises TokenInvalidException."""
        # Create token without sub claim
        token = jwt.encode(
            {"type": "access", "exp": datetime.utcnow() + timedelta(minutes=30)},
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )

        with pytest.raises(TokenInvalidException) as exc_info:
            verify_token(token, "access")

        assert "missing subject" in str(exc_info.value.detail).lower()

    def test_verify_token_invalid_uuid_raises_exception(self) -> None:
        """Test that token with invalid UUID format raises TokenInvalidException."""
        # Create token with invalid UUID
        token = jwt.encode(
            {
                "sub": "not-a-valid-uuid",
                "type": "access",
                "exp": datetime.utcnow() + timedelta(minutes=30),
            },
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )

        with pytest.raises(TokenInvalidException) as exc_info:
            verify_token(token, "access")

        assert "invalid user id" in str(exc_info.value.detail).lower()

    def test_verify_expired_token_raises_exception(self, sample_user_id: UUID) -> None:
        """Test that expired token raises TokenExpiredException."""
        # Create a token that expired 1 hour ago
        expired_payload = {
            "sub": str(sample_user_id),
            "exp": datetime.utcnow() - timedelta(hours=1),
            "iat": datetime.utcnow() - timedelta(hours=2),
            "type": "access",
        }

        expired_token = jwt.encode(
            expired_payload,
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )

        with pytest.raises(TokenExpiredException):
            verify_token(expired_token, "access")


# ============================================================================
# Token Extraction Tests
# ============================================================================


class TestTokenExtraction:
    """Tests for extracting tokens from HTTP headers."""

    def test_extract_token_from_valid_credentials(self) -> None:
        """Test extracting token from valid HTTPAuthorizationCredentials."""
        token = "test-token-123"
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

        extracted = extract_token_from_header(credentials)
        assert extracted == token

    def test_extract_token_from_none_raises_exception(self) -> None:
        """Test that None credentials raises TokenInvalidException."""
        with pytest.raises(TokenInvalidException) as exc_info:
            extract_token_from_header(None)

        assert "No authentication token" in str(exc_info.value.detail)


# ============================================================================
# Integration Tests
# ============================================================================


class TestTokenIntegration:
    """Integration tests for complete token lifecycle."""

    def test_full_token_lifecycle(self, sample_user_id: UUID) -> None:
        """Test complete lifecycle: create access token -> verify -> extract user_id."""
        # Step 1: Create access token
        access_token, expires_at = create_access_token(sample_user_id)
        assert isinstance(access_token, str)
        assert isinstance(expires_at, datetime)

        # Step 2: Verify token
        verified_user_id = verify_token(access_token, "access")
        assert verified_user_id == sample_user_id

        # Step 3: Simulate HTTP header extraction
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=access_token)
        extracted_token = extract_token_from_header(credentials)
        assert extracted_token == access_token

        # Step 4: Verify extracted token
        final_user_id = verify_token(extracted_token, "access")
        assert final_user_id == sample_user_id

    def test_refresh_token_cannot_be_used_as_access_token(self, sample_user_id: UUID) -> None:
        """Test that refresh token cannot be used as access token (confused deputy attack prevention)."""
        refresh_token, _ = create_refresh_token(sample_user_id)

        # Attempting to verify refresh token as access token should fail
        with pytest.raises(TokenInvalidException) as exc_info:
            verify_token(refresh_token, "access")

        assert "Invalid token type" in str(exc_info.value.detail)

    def test_access_token_cannot_be_used_as_refresh_token(self, sample_user_id: UUID) -> None:
        """Test that access token cannot be used as refresh token."""
        access_token, _ = create_access_token(sample_user_id)

        # Attempting to verify access token as refresh token should fail
        with pytest.raises(TokenInvalidException) as exc_info:
            verify_token(access_token, "refresh")

        assert "Invalid token type" in str(exc_info.value.detail)

    def test_multiple_users_have_unique_tokens(self) -> None:
        """Test that different users get different tokens."""
        user1_id = uuid4()
        user2_id = uuid4()

        token1, _ = create_access_token(user1_id)
        token2, _ = create_access_token(user2_id)

        # Tokens should be different
        assert token1 != token2

        # Each token should verify to its own user
        assert verify_token(token1, "access") == user1_id
        assert verify_token(token2, "access") == user2_id


# ============================================================================
# Edge Case Tests
# ============================================================================


class TestTokenEdgeCases:
    """Tests for edge cases and unusual scenarios."""

    def test_token_with_special_characters_in_uuid(self) -> None:
        """Test that tokens work with all valid UUID formats."""
        # UUID with various formats
        user_id = uuid4()
        token, _ = create_access_token(user_id)
        verified_id = verify_token(token, "access")
        assert verified_id == user_id

    def test_token_verification_is_case_sensitive(self, sample_user_id: UUID) -> None:
        """Test that token verification is case-sensitive."""
        token, _ = create_access_token(sample_user_id)

        # Changing case should invalidate the token
        invalid_token = token.upper()
        with pytest.raises(TokenInvalidException):
            verify_token(invalid_token, "access")

    def test_token_survives_whitespace_stripping(self, sample_user_id: UUID) -> None:
        """Test that tokens work after stripping whitespace (common in HTTP headers)."""
        token, _ = create_access_token(sample_user_id)

        # Add whitespace (common in HTTP headers)
        token_with_whitespace = f"  {token}  "

        # Should work after stripping
        verified_id = verify_token(token_with_whitespace.strip(), "access")
        assert verified_id == sample_user_id
