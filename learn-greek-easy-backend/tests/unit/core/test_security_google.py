"""Unit tests for Google ID token verification."""

from unittest.mock import patch

import pytest

from src.core.exceptions import GoogleTokenInvalidException
from src.core.security import verify_google_id_token


class TestVerifyGoogleIdToken:
    """Tests for verify_google_id_token function."""

    @patch("src.core.security.google_id_token.verify_oauth2_token")
    def test_valid_token_returns_user_info(self, mock_verify):
        """Test successful token verification."""
        mock_verify.return_value = {
            "sub": "google-user-123",
            "email": "test@example.com",
            "email_verified": True,
            "name": "Test User",
            "picture": "https://example.com/photo.jpg",
            "iss": "accounts.google.com",
        }

        result = verify_google_id_token("valid-token", "client-id")

        assert result.google_id == "google-user-123"
        assert result.email == "test@example.com"
        assert result.email_verified is True
        assert result.full_name == "Test User"
        assert result.picture_url == "https://example.com/photo.jpg"

    @patch("src.core.security.google_id_token.verify_oauth2_token")
    def test_invalid_token_raises_exception(self, mock_verify):
        """Test invalid token raises GoogleTokenInvalidException."""
        mock_verify.side_effect = ValueError("Invalid token")

        with pytest.raises(GoogleTokenInvalidException) as exc_info:
            verify_google_id_token("invalid-token", "client-id")

        assert "Invalid Google ID token" in str(exc_info.value.detail)

    @patch("src.core.security.google_id_token.verify_oauth2_token")
    def test_wrong_issuer_raises_exception(self, mock_verify):
        """Test wrong issuer raises exception."""
        mock_verify.return_value = {
            "sub": "google-user-123",
            "email": "test@example.com",
            "iss": "malicious-issuer.com",
        }

        with pytest.raises(GoogleTokenInvalidException) as exc_info:
            verify_google_id_token("token", "client-id")

        assert "Invalid token issuer" in str(exc_info.value.detail)

    @patch("src.core.security.google_id_token.verify_oauth2_token")
    def test_minimal_claims_still_works(self, mock_verify):
        """Test token with only required claims."""
        mock_verify.return_value = {
            "sub": "google-user-123",
            "email": "test@example.com",
            "iss": "accounts.google.com",
        }

        result = verify_google_id_token("token", "client-id")

        assert result.google_id == "google-user-123"
        assert result.email == "test@example.com"
        assert result.email_verified is False  # Default
        assert result.full_name is None
        assert result.picture_url is None

    @patch("src.core.security.google_id_token.verify_oauth2_token")
    def test_https_issuer_also_valid(self, mock_verify):
        """Test that https://accounts.google.com issuer is also valid."""
        mock_verify.return_value = {
            "sub": "google-user-456",
            "email": "user@example.com",
            "email_verified": True,
            "iss": "https://accounts.google.com",
        }

        result = verify_google_id_token("token", "client-id")

        assert result.google_id == "google-user-456"
        assert result.email == "user@example.com"

    @patch("src.core.security.google_id_token.verify_oauth2_token")
    def test_generic_exception_handled(self, mock_verify):
        """Test that generic exceptions are converted to GoogleTokenInvalidException."""
        mock_verify.side_effect = RuntimeError("Unexpected error")

        with pytest.raises(GoogleTokenInvalidException) as exc_info:
            verify_google_id_token("token", "client-id")

        assert "Failed to verify Google ID token" in str(exc_info.value.detail)

    @patch("src.core.security.google_id_token.verify_oauth2_token")
    def test_expired_token_raises_exception(self, mock_verify):
        """Test expired token raises exception."""
        mock_verify.side_effect = ValueError("Token expired")

        with pytest.raises(GoogleTokenInvalidException) as exc_info:
            verify_google_id_token("expired-token", "client-id")

        assert "Invalid Google ID token" in str(exc_info.value.detail)

    @patch("src.core.security.google_id_token.verify_oauth2_token")
    def test_wrong_audience_raises_exception(self, mock_verify):
        """Test wrong audience (client_id mismatch) raises exception."""
        mock_verify.side_effect = ValueError("Wrong recipient, wrong audience")

        with pytest.raises(GoogleTokenInvalidException) as exc_info:
            verify_google_id_token("token", "wrong-client-id")

        assert "Invalid Google ID token" in str(exc_info.value.detail)
