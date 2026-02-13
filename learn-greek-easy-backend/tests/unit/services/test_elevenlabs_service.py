"""Unit tests for ElevenLabs Service core functionality.

Tests cover:
- Singleton pattern for get_elevenlabs_service()
- Configuration validation via _check_configured()
- HTTP header generation via _get_headers()
"""

from unittest.mock import patch

import pytest

from src.core.exceptions import ElevenLabsNotConfiguredError
from src.services.elevenlabs_service import ElevenLabsService, get_elevenlabs_service

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture()
def mock_settings_configured():
    """Settings with ElevenLabs configured (valid API key)."""
    with patch("src.services.elevenlabs_service.settings") as mock:
        mock.elevenlabs_api_key = "test-api-key-12345"
        mock.elevenlabs_configured = True
        mock.elevenlabs_model_id = "eleven_multilingual_v2"
        mock.elevenlabs_output_format = "mp3_44100_128"
        mock.elevenlabs_timeout = 30
        yield mock


@pytest.fixture()
def mock_settings_not_configured():
    """Settings without ElevenLabs configured (empty API key)."""
    with patch("src.services.elevenlabs_service.settings") as mock:
        mock.elevenlabs_api_key = ""
        mock.elevenlabs_configured = False
        yield mock


@pytest.fixture()
def reset_singleton():
    """Reset the singleton ElevenLabsService instance."""
    import src.services.elevenlabs_service as elevenlabs_module

    elevenlabs_module._elevenlabs_service = None
    yield
    elevenlabs_module._elevenlabs_service = None


# ============================================================================
# get_elevenlabs_service() Singleton Tests
# ============================================================================


class TestGetElevenLabsService:
    """Tests for get_elevenlabs_service() singleton function."""

    def test_returns_singleton(self, reset_singleton: None, mock_settings_configured: None) -> None:
        """Test that get_elevenlabs_service returns the same instance."""
        service1 = get_elevenlabs_service()
        service2 = get_elevenlabs_service()
        assert service1 is service2

    def test_creates_elevenlabs_service_instance(
        self, reset_singleton: None, mock_settings_configured: None
    ) -> None:
        """Test that get_elevenlabs_service returns an ElevenLabsService."""
        service = get_elevenlabs_service()
        assert isinstance(service, ElevenLabsService)


# ============================================================================
# ElevenLabsService._check_configured() Tests
# ============================================================================


class TestCheckConfigured:
    """Tests for ElevenLabsService._check_configured() method."""

    def test_passes_when_configured(self, mock_settings_configured: None) -> None:
        """Test _check_configured passes when API key is set."""
        service = ElevenLabsService()
        service._check_configured()  # Should not raise

    def test_raises_when_not_configured(self, mock_settings_not_configured: None) -> None:
        """Test _check_configured raises when API key is empty."""
        service = ElevenLabsService()
        with pytest.raises(ElevenLabsNotConfiguredError):
            service._check_configured()


# ============================================================================
# ElevenLabsService._get_headers() Tests
# ============================================================================


class TestGetHeaders:
    """Tests for ElevenLabsService._get_headers() method."""

    def test_returns_dict_with_correct_keys(self, mock_settings_configured: None) -> None:
        """Test _get_headers returns dict with xi-api-key and Content-Type."""
        service = ElevenLabsService()
        headers = service._get_headers()
        assert isinstance(headers, dict)
        assert "xi-api-key" in headers
        assert "Content-Type" in headers

    def test_includes_api_key_from_settings(self, mock_settings_configured: None) -> None:
        """Test _get_headers uses API key from settings."""
        service = ElevenLabsService()
        headers = service._get_headers()
        assert headers["xi-api-key"] == "test-api-key-12345"

    def test_includes_json_content_type(self, mock_settings_configured: None) -> None:
        """Test _get_headers includes application/json content type."""
        service = ElevenLabsService()
        headers = service._get_headers()
        assert headers["Content-Type"] == "application/json"
