"""Unit tests for CORS configuration.

Tests cover:
- cors_expose_headers property parsing
- CORS production validation
- Backward compatibility with existing CORS config
"""

import os
from unittest.mock import patch


class TestCorsExposeHeaders:
    """Tests for cors_expose_headers configuration."""

    def test_default_expose_headers(self):
        """Test default expose_headers value."""
        from src.config import Settings

        settings = Settings()

        assert "X-Request-ID" in settings.cors_expose_headers
        assert "X-RateLimit-Limit" in settings.cors_expose_headers
        assert "X-RateLimit-Remaining" in settings.cors_expose_headers
        assert "X-RateLimit-Reset" in settings.cors_expose_headers

    def test_expose_headers_from_comma_separated(self):
        """Test parsing expose_headers from comma-separated string."""
        from src.config import Settings

        with patch.dict(os.environ, {"CORS_EXPOSE_HEADERS": "X-Custom,X-Another"}, clear=False):
            settings = Settings()

        assert settings.cors_expose_headers == ["X-Custom", "X-Another"]

    def test_expose_headers_from_json_array(self):
        """Test parsing expose_headers from JSON array."""
        from src.config import Settings

        with patch.dict(
            os.environ, {"CORS_EXPOSE_HEADERS": '["X-Custom", "X-Another"]'}, clear=False
        ):
            settings = Settings()

        assert settings.cors_expose_headers == ["X-Custom", "X-Another"]

    def test_expose_headers_empty_string(self):
        """Test expose_headers with empty string returns empty list."""
        from src.config import Settings

        with patch.dict(os.environ, {"CORS_EXPOSE_HEADERS": ""}, clear=False):
            settings = Settings()

        assert settings.cors_expose_headers == []

    def test_expose_headers_whitespace_handling(self):
        """Test expose_headers strips whitespace from values."""
        from src.config import Settings

        with patch.dict(os.environ, {"CORS_EXPOSE_HEADERS": " X-Custom , X-Another "}, clear=False):
            settings = Settings()

        assert settings.cors_expose_headers == ["X-Custom", "X-Another"]


class TestCorsValidation:
    """Tests for CORS production validation."""

    def test_warns_on_wildcard_with_credentials(self):
        """Test warning when wildcard origin used with credentials."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {
                "CORS_ORIGINS": "*",
                "CORS_ALLOW_CREDENTIALS": "true",
            },
            clear=False,
        ):
            settings = Settings()
            warnings = settings.validate_cors_for_production()

        assert any("'*'" in w or "wildcard" in w.lower() for w in warnings)

    def test_warns_on_empty_origins_in_production(self):
        """Test warning when origins empty in production."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {
                "CORS_ORIGINS": "",
                "APP_ENV": "production",
            },
            clear=False,
        ):
            settings = Settings()
            warnings = settings.validate_cors_for_production()

        assert any("empty" in w.lower() for w in warnings)

    def test_warns_on_http_origins_in_production(self):
        """Test warning when HTTP (non-localhost) origins in production."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {
                "CORS_ORIGINS": "http://example.com,https://secure.com",
                "APP_ENV": "production",
            },
            clear=False,
        ):
            settings = Settings()
            warnings = settings.validate_cors_for_production()

        assert any("http" in w.lower() for w in warnings)

    def test_no_warnings_for_valid_production_config(self):
        """Test no warnings for properly configured production."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {
                "CORS_ORIGINS": "https://frontend-production-1164.up.railway.app",
                "CORS_ALLOW_CREDENTIALS": "true",
                "APP_ENV": "production",
            },
            clear=False,
        ):
            settings = Settings()
            warnings = settings.validate_cors_for_production()

        assert len(warnings) == 0

    def test_allows_localhost_http_in_production(self):
        """Test localhost HTTP doesn't trigger warning (for local testing)."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {
                "CORS_ORIGINS": "http://localhost:5173,https://prod.example.com",
                "APP_ENV": "production",
            },
            clear=False,
        ):
            settings = Settings()
            warnings = settings.validate_cors_for_production()

        # Should not warn about localhost
        http_warnings = [
            w for w in warnings if "http" in w.lower() and "localhost" not in w.lower()
        ]
        assert len(http_warnings) == 0


class TestCorsBackwardCompatibility:
    """Tests ensuring backward compatibility with existing CORS config."""

    def test_existing_cors_origins_still_works(self):
        """Test existing CORS_ORIGINS environment variable still parsed correctly."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {
                "CORS_ORIGINS": "http://localhost:5173,http://localhost:3000",
            },
            clear=False,
        ):
            settings = Settings()

        assert "http://localhost:5173" in settings.cors_origins
        assert "http://localhost:3000" in settings.cors_origins

    def test_existing_cors_methods_still_works(self):
        """Test existing CORS_ALLOW_METHODS environment variable still works."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {
                "CORS_ALLOW_METHODS": "GET,POST,PUT",
            },
            clear=False,
        ):
            settings = Settings()

        assert settings.cors_allow_methods == ["GET", "POST", "PUT"]

    def test_existing_cors_credentials_still_works(self):
        """Test existing CORS_ALLOW_CREDENTIALS environment variable still works."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {
                "CORS_ALLOW_CREDENTIALS": "false",
            },
            clear=False,
        ):
            settings = Settings()

        assert settings.cors_allow_credentials is False
