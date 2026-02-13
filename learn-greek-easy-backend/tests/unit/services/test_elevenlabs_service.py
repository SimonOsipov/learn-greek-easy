"""Unit tests for ElevenLabs Service core functionality.

Tests cover:
- Singleton pattern for get_elevenlabs_service()
- Configuration validation via _check_configured()
- HTTP header generation via _get_headers()
"""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from src.core.exceptions import (
    ElevenLabsAPIError,
    ElevenLabsAuthenticationError,
    ElevenLabsNotConfiguredError,
    ElevenLabsNoVoicesError,
    ElevenLabsRateLimitError,
)
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


# ============================================================================
# list_voices() and Cache Behavior Tests
# ============================================================================


class TestListVoices:
    """Tests for ElevenLabsService.list_voices() and caching."""

    @pytest.mark.asyncio
    async def test_returns_voice_list_on_success(self, mock_settings_configured: None) -> None:
        """Test list_voices returns transformed voice list."""
        service = ElevenLabsService()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "voices": [
                {"voice_id": "v1", "name": "Alice", "extra": "ignored"},
                {"voice_id": "v2", "name": "Bob", "extra": "ignored"},
            ]
        }

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            result = await service.list_voices()

        assert result == [
            {"voice_id": "v1", "name": "Alice"},
            {"voice_id": "v2", "name": "Bob"},
        ]
        mock_client.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_cache_hit_skips_http_call(self, mock_settings_configured: None) -> None:
        """Test cache hit returns cached data without HTTP call."""
        service = ElevenLabsService()
        cached = [{"voice_id": "c1", "name": "Cached"}]
        service._voice_cache = cached
        service._voice_cache_time = time.monotonic()

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            result = await service.list_voices()
            mock_cls.assert_not_called()

        assert result == cached

    @pytest.mark.asyncio
    async def test_cache_expired_fetches_fresh(self, mock_settings_configured: None) -> None:
        """Test expired cache triggers fresh API fetch."""
        service = ElevenLabsService()
        service._voice_cache = [{"voice_id": "old", "name": "Old"}]
        service._voice_cache_time = time.monotonic() - 301

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"voices": [{"voice_id": "new", "name": "New"}]}

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            result = await service.list_voices()

        assert result == [{"voice_id": "new", "name": "New"}]
        mock_client.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_populates_cache_after_fetch(self, mock_settings_configured: None) -> None:
        """Test cache is populated after successful API fetch."""
        service = ElevenLabsService()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"voices": [{"voice_id": "v1", "name": "Voice"}]}

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            await service.list_voices()

        assert service._voice_cache == [{"voice_id": "v1", "name": "Voice"}]
        assert service._voice_cache_time is not None

    @pytest.mark.asyncio
    async def test_invalidate_cache_forces_refetch(self, mock_settings_configured: None) -> None:
        """Test _invalidate_voice_cache clears cache."""
        service = ElevenLabsService()
        service._voice_cache = [{"voice_id": "c", "name": "C"}]
        service._voice_cache_time = time.monotonic()

        service._invalidate_voice_cache()

        assert service._voice_cache is None
        assert service._voice_cache_time is None

    @pytest.mark.asyncio
    async def test_401_raises_authentication_error(self, mock_settings_configured: None) -> None:
        """Test 401 response raises ElevenLabsAuthenticationError."""
        service = ElevenLabsService()

        mock_response = MagicMock()
        mock_response.status_code = 401

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(ElevenLabsAuthenticationError):
                await service.list_voices()

    @pytest.mark.asyncio
    async def test_429_raises_rate_limit_error(self, mock_settings_configured: None) -> None:
        """Test 429 response raises ElevenLabsRateLimitError."""
        service = ElevenLabsService()

        mock_response = MagicMock()
        mock_response.status_code = 429

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(ElevenLabsRateLimitError):
                await service.list_voices()

    @pytest.mark.asyncio
    async def test_500_raises_api_error(self, mock_settings_configured: None) -> None:
        """Test 500 response raises ElevenLabsAPIError with status code."""
        service = ElevenLabsService()

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(ElevenLabsAPIError) as exc_info:
                await service.list_voices()
            assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_empty_voices_raises_no_voices_error(
        self, mock_settings_configured: None
    ) -> None:
        """Test empty voice list raises ElevenLabsNoVoicesError."""
        service = ElevenLabsService()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"voices": []}

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(ElevenLabsNoVoicesError):
                await service.list_voices()

    @pytest.mark.asyncio
    async def test_network_error_raises_api_error(self, mock_settings_configured: None) -> None:
        """Test network error wraps as ElevenLabsAPIError."""
        service = ElevenLabsService()

        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx.RequestError("Connection failed")

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(ElevenLabsAPIError) as exc_info:
                await service.list_voices()
            assert exc_info.value.status_code == 0
            assert "Network error" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_not_configured_raises_error(self, mock_settings_not_configured: None) -> None:
        """Test not configured raises ElevenLabsNotConfiguredError."""
        service = ElevenLabsService()
        with pytest.raises(ElevenLabsNotConfiguredError):
            await service.list_voices()
