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
    ElevenLabsVoiceNotFoundError,
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


# ============================================================================
# _call_tts_api() Tests
# ============================================================================


class TestCallTtsApi:
    """Tests for ElevenLabsService._call_tts_api() HTTP request structure."""

    @pytest.mark.asyncio
    async def test_returns_audio_bytes(self, mock_settings_configured: None) -> None:
        """Test successful TTS call returns audio bytes."""
        service = ElevenLabsService()
        audio_data = b"\xff\xd8" + b"\x00" * 100

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = audio_data

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            result = await service._call_tts_api("Γεια σου", "v1", "Alice")

        assert result == audio_data

    @pytest.mark.asyncio
    async def test_output_format_as_query_param(self, mock_settings_configured: None) -> None:
        """Test output_format is query param, NOT in request body."""
        service = ElevenLabsService()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"audio"

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            await service._call_tts_api("text", "v1", "Alice")

        call_kwargs = mock_client.post.call_args
        assert call_kwargs.kwargs["params"] == {"output_format": "mp3_44100_128"}
        assert "output_format" not in call_kwargs.kwargs["json"]

    @pytest.mark.asyncio
    async def test_request_body_includes_language_code_el(
        self, mock_settings_configured: None
    ) -> None:
        """Test request body includes language_code 'el' for Greek."""
        service = ElevenLabsService()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"audio"

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            await service._call_tts_api("text", "v1", "Alice")

        body = mock_client.post.call_args.kwargs["json"]
        assert body["language_code"] == "el"
        assert body["model_id"] == "eleven_multilingual_v2"
        assert body["text"] == "text"

    @pytest.mark.asyncio
    async def test_url_includes_voice_id(self, mock_settings_configured: None) -> None:
        """Test POST URL includes the voice_id."""
        service = ElevenLabsService()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"audio"

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            await service._call_tts_api("text", "my-voice-123", "Alice")

        url = mock_client.post.call_args.args[0]
        assert "my-voice-123" in url

    @pytest.mark.asyncio
    async def test_404_raises_voice_not_found(self, mock_settings_configured: None) -> None:
        """Test 404 response raises ElevenLabsVoiceNotFoundError."""
        service = ElevenLabsService()

        mock_response = MagicMock()
        mock_response.status_code = 404

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(ElevenLabsVoiceNotFoundError) as exc_info:
                await service._call_tts_api("text", "v1", "Alice")
            assert exc_info.value.voice_id == "v1"

    @pytest.mark.asyncio
    async def test_401_raises_authentication_error(self, mock_settings_configured: None) -> None:
        """Test 401 raises ElevenLabsAuthenticationError."""
        service = ElevenLabsService()

        mock_response = MagicMock()
        mock_response.status_code = 401

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(ElevenLabsAuthenticationError):
                await service._call_tts_api("text", "v1", "Alice")

    @pytest.mark.asyncio
    async def test_429_raises_rate_limit_error(self, mock_settings_configured: None) -> None:
        """Test 429 raises ElevenLabsRateLimitError."""
        service = ElevenLabsService()

        mock_response = MagicMock()
        mock_response.status_code = 429

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(ElevenLabsRateLimitError):
                await service._call_tts_api("text", "v1", "Alice")

    @pytest.mark.asyncio
    async def test_500_raises_api_error(self, mock_settings_configured: None) -> None:
        """Test 500 raises ElevenLabsAPIError with status code."""
        service = ElevenLabsService()

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(ElevenLabsAPIError) as exc_info:
                await service._call_tts_api("text", "v1", "Alice")
            assert exc_info.value.status_code == 500


# ============================================================================
# generate_speech() Tests
# ============================================================================


class TestGenerateSpeech:
    """Tests for ElevenLabsService.generate_speech() and retry logic."""

    @pytest.mark.asyncio
    async def test_returns_audio_bytes(self, mock_settings_configured: None) -> None:
        """Test successful speech generation returns bytes."""
        service = ElevenLabsService()
        voices = [{"voice_id": "v1", "name": "Alice"}]

        with (
            patch.object(service, "list_voices", return_value=voices),
            patch(
                "src.services.elevenlabs_service.random.choice",
                return_value=voices[0],
            ),
            patch.object(service, "_call_tts_api", return_value=b"mp3_audio"),
        ):
            result = await service.generate_speech("Γεια σου")

        assert result == b"mp3_audio"

    @pytest.mark.asyncio
    async def test_uses_random_choice_for_voice(self, mock_settings_configured: None) -> None:
        """Test voice selected via random.choice from voice list."""
        service = ElevenLabsService()
        voices = [
            {"voice_id": "v1", "name": "Alice"},
            {"voice_id": "v2", "name": "Bob"},
            {"voice_id": "v3", "name": "Carol"},
        ]

        with (
            patch.object(service, "list_voices", return_value=voices),
            patch(
                "src.services.elevenlabs_service.random.choice",
                return_value=voices[1],
            ) as mock_choice,
            patch.object(service, "_call_tts_api", return_value=b"audio") as mock_tts,
        ):
            await service.generate_speech("text")

        mock_choice.assert_called_once_with(voices)
        mock_tts.assert_called_once_with("text", "v2", "Bob", is_retry=False)

    @pytest.mark.asyncio
    async def test_404_retry_invalidates_cache_and_retries(
        self, mock_settings_configured: None
    ) -> None:
        """Test 404 triggers cache invalidation and one retry."""
        service = ElevenLabsService()

        with (
            patch.object(
                service,
                "list_voices",
                side_effect=[
                    [{"voice_id": "v1", "name": "Old"}],
                    [{"voice_id": "v2", "name": "New"}],
                ],
            ),
            patch(
                "src.services.elevenlabs_service.random.choice",
                side_effect=lambda v: v[0],
            ),
            patch.object(
                service,
                "_call_tts_api",
                side_effect=[
                    ElevenLabsVoiceNotFoundError(voice_id="v1"),
                    b"audio_retry",
                ],
            ) as mock_tts,
            patch.object(service, "_invalidate_voice_cache") as mock_inv,
        ):
            result = await service.generate_speech("text")

        assert result == b"audio_retry"
        assert mock_tts.call_count == 2
        mock_inv.assert_called_once()
        # First call: is_retry=False
        assert mock_tts.call_args_list[0].kwargs["is_retry"] is False
        # Second call: is_retry=True
        assert mock_tts.call_args_list[1].kwargs["is_retry"] is True

    @pytest.mark.asyncio
    async def test_double_404_raises_no_infinite_loop(self, mock_settings_configured: None) -> None:
        """Test double 404 raises error instead of infinite retry."""
        service = ElevenLabsService()

        with (
            patch.object(
                service,
                "list_voices",
                side_effect=[
                    [{"voice_id": "v1", "name": "A"}],
                    [{"voice_id": "v2", "name": "B"}],
                ],
            ),
            patch(
                "src.services.elevenlabs_service.random.choice",
                side_effect=lambda v: v[0],
            ),
            patch.object(
                service,
                "_call_tts_api",
                side_effect=[
                    ElevenLabsVoiceNotFoundError(voice_id="v1"),
                    ElevenLabsVoiceNotFoundError(voice_id="v2"),
                ],
            ) as mock_tts,
            patch.object(service, "_invalidate_voice_cache"),
        ):
            with pytest.raises(ElevenLabsVoiceNotFoundError):
                await service.generate_speech("text")

        assert mock_tts.call_count == 2

    @pytest.mark.asyncio
    async def test_not_configured_raises_error(self, mock_settings_not_configured: None) -> None:
        """Test not configured raises error before any API call."""
        service = ElevenLabsService()
        with pytest.raises(ElevenLabsNotConfiguredError):
            await service.generate_speech("text")

    @pytest.mark.asyncio
    async def test_auth_error_propagates(self, mock_settings_configured: None) -> None:
        """Test authentication error propagates from _call_tts_api."""
        service = ElevenLabsService()

        with (
            patch.object(
                service,
                "list_voices",
                return_value=[{"voice_id": "v1", "name": "A"}],
            ),
            patch(
                "src.services.elevenlabs_service.random.choice",
                return_value={"voice_id": "v1", "name": "A"},
            ),
            patch.object(
                service,
                "_call_tts_api",
                side_effect=ElevenLabsAuthenticationError(),
            ),
        ):
            with pytest.raises(ElevenLabsAuthenticationError):
                await service.generate_speech("text")

    @pytest.mark.asyncio
    async def test_rate_limit_error_propagates(self, mock_settings_configured: None) -> None:
        """Test rate limit error propagates from _call_tts_api."""
        service = ElevenLabsService()

        with (
            patch.object(
                service,
                "list_voices",
                return_value=[{"voice_id": "v1", "name": "A"}],
            ),
            patch(
                "src.services.elevenlabs_service.random.choice",
                return_value={"voice_id": "v1", "name": "A"},
            ),
            patch.object(
                service,
                "_call_tts_api",
                side_effect=ElevenLabsRateLimitError(),
            ),
        ):
            with pytest.raises(ElevenLabsRateLimitError):
                await service.generate_speech("text")

    @pytest.mark.asyncio
    async def test_generate_speech_with_voice_id_skips_list_voices(
        self, mock_settings_configured: None
    ) -> None:
        """When voice_id provided, list_voices is NOT called."""
        service = ElevenLabsService()
        with patch.object(service, "_check_configured"):
            with patch.object(service, "list_voices", new_callable=AsyncMock) as mock_list:
                with patch.object(
                    service, "_call_tts_api", new_callable=AsyncMock, return_value=b"audio"
                ) as mock_tts:
                    result = await service.generate_speech("text", voice_id="custom-voice-123")

        mock_list.assert_not_called()
        mock_tts.assert_called_once_with("text", "custom-voice-123", "custom", is_retry=False)
        assert result == b"audio"

    @pytest.mark.asyncio
    async def test_generate_speech_with_voice_id_no_retry_on_404(
        self, mock_settings_configured: None
    ) -> None:
        """When voice_id provided and 404 occurs, error propagates immediately without retry."""
        service = ElevenLabsService()
        with patch.object(service, "_check_configured"):
            with patch.object(service, "list_voices", new_callable=AsyncMock) as mock_list:
                with patch.object(
                    service,
                    "_call_tts_api",
                    new_callable=AsyncMock,
                    side_effect=ElevenLabsVoiceNotFoundError(voice_id="bad-id"),
                ) as mock_tts:
                    with pytest.raises(ElevenLabsVoiceNotFoundError):
                        await service.generate_speech("text", voice_id="bad-id")

        mock_tts.assert_called_once()  # No retry
        mock_list.assert_not_called()

    @pytest.mark.asyncio
    async def test_generate_speech_without_voice_id_uses_random(
        self, mock_settings_configured: None
    ) -> None:
        """When voice_id not provided (default None), random voice selection is used."""
        service = ElevenLabsService()
        mock_voice = MagicMock()
        mock_voice.voice_id = "random-voice-id"
        mock_voice.name = "Random Voice"

        with patch.object(service, "_check_configured"):
            with patch.object(
                service, "list_voices", new_callable=AsyncMock, return_value=[mock_voice]
            ) as mock_list:
                with patch(
                    "src.services.elevenlabs_service.random.choice", return_value=mock_voice
                ):
                    with patch.object(
                        service, "_call_tts_api", new_callable=AsyncMock, return_value=b"audio"
                    ):
                        result = await service.generate_speech("text")

        mock_list.assert_called_once()  # list_voices WAS called
        assert result == b"audio"


# ============================================================================
# PERF-19-02: Pooled AsyncClient Lifecycle (start/close) + Fallback Lock
# ============================================================================


class TestPooledClientLifecycle:
    """Tests for PERF-19-02: pooled httpx.AsyncClient singleton + fallback.

    Mirrors OpenRouterService's start()/close() + pooled-vs-fallback pattern
    (see openrouter_service.py). Test Specs from Backlog task-1259:
      1. start() builds a pooled client with http2=True + httpx.Limits.
      2. close() awaits aclose() and nulls _client.
      3. A TTS call uses the pooled client when present (no per-call client
         construction).
      4. A TTS call falls back to the existing per-call client when no pooled
         client is set (LOCKS current behavior so the refactor can't drop it).
    """

    @pytest.mark.asyncio
    async def test_start_creates_pooled_client(self, mock_settings_configured: None) -> None:
        """start() builds and stores a pooled AsyncClient with http2 + Limits.

        Pre-impl: ElevenLabsService has no start() -> AttributeError.
        """
        service = ElevenLabsService()

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            await service.start()

        assert service._client is mock_cls.return_value
        call_kwargs = mock_cls.call_args.kwargs
        assert call_kwargs["http2"] is True
        assert call_kwargs["timeout"] == 30
        assert call_kwargs["limits"] == httpx.Limits(
            max_connections=10, max_keepalive_connections=5
        )

    @pytest.mark.asyncio
    async def test_close_closes_and_nulls_client(self, mock_settings_configured: None) -> None:
        """close() awaits the pooled client's aclose() and nulls _client.

        Pre-impl: ElevenLabsService has no close() -> AttributeError.
        """
        service = ElevenLabsService()
        mock_client = AsyncMock()
        service._client = mock_client

        await service.close()

        mock_client.aclose.assert_awaited_once()
        assert service._client is None

    @pytest.mark.asyncio
    async def test_tts_call_uses_pooled_client_when_present(
        self, mock_settings_configured: None
    ) -> None:
        """When self._client is set, the TTS call uses it and builds no per-call client.

        Pre-impl: _call_tts_api ignores self._client entirely and always opens
        a per-call `async with httpx.AsyncClient(...)`, so `mock_cls` IS
        called and `mock_cls.assert_not_called()` fails (AssertionError).
        """
        service = ElevenLabsService()

        pooled_response = MagicMock()
        pooled_response.status_code = 200
        pooled_response.content = b"audio_pooled"
        pooled_client = AsyncMock()
        pooled_client.post.return_value = pooled_response
        service._client = pooled_client

        # If the fallback path is (mistakenly, pre-impl) taken, give it a
        # working mocked chain so the test fails cleanly on the
        # "AsyncClient not constructed" assertion instead of crashing.
        fallback_response = MagicMock()
        fallback_response.status_code = 200
        fallback_response.content = b"audio_fallback"
        fallback_client = AsyncMock()
        fallback_client.post.return_value = fallback_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = fallback_client
            result = await service._call_tts_api("text", "v1", "Alice")

        mock_cls.assert_not_called()
        pooled_client.post.assert_called_once()
        assert result == b"audio_pooled"

    @pytest.mark.asyncio
    async def test_tts_call_falls_back_when_client_absent(
        self, mock_settings_configured: None
    ) -> None:
        """LOCKS the existing per-call fallback when no pooled client is set.

        Passes today (pre-impl there is no self._client at all) and must keep
        passing post-impl once self._client exists but is None -- guards
        against the refactor accidentally deleting the fallback branch.
        """
        service = ElevenLabsService()
        if hasattr(service, "_client"):
            service._client = None

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"audio_fallback"
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            result = await service._call_tts_api("text", "v1", "Alice")

        mock_cls.assert_called_once()
        mock_client.post.assert_called_once()
        assert result == b"audio_fallback"


class TestPooledClientEdgeCases:
    """QA adversarial coverage for PERF-19-02 (task-1259) beyond the 4 AC specs.

    The AC tests (TestPooledClientLifecycle) only exercise start()/close()
    lifecycle and the _call_tts_api pooled-vs-fallback branch. These tests
    guard the regression risks the AC specs don't cover:
      1. close() is safe to call on a service that was never start()-ed.
      2. The pooled-vs-fallback branch is wired at the OTHER 3 call sites
         (list_voices, generate_dialog_audio, forced_align), not just TTS --
         a silent revert of any one site would only be caught here.
      3. Network errors (httpx.RequestError) raised by the POOLED client are
         still converted to ElevenLabsAPIError by the existing except-wrapper
         (the wrapper was written for the `async with` fallback shape; the
         restructure must not have broken it for the pooled path).
    """

    @pytest.mark.asyncio
    async def test_close_when_never_started_is_noop(self, mock_settings_configured: None) -> None:
        """close() on a fresh (never start()-ed) service must not raise.

        __init__ sets self._client = None; close() must guard on that (no
        AttributeError from calling .aclose() on None).
        """
        service = ElevenLabsService()

        await service.close()  # must not raise

        assert service._client is None

    @pytest.mark.asyncio
    async def test_list_voices_uses_pooled_client_when_present(
        self, mock_settings_configured: None
    ) -> None:
        """list_voices() must use the pooled client and build no per-call client.

        Locks the pooled branch at the list_voices call site independently of
        the TTS-only AC test -- a revert here would not otherwise be caught.
        """
        service = ElevenLabsService()

        pooled_response = MagicMock()
        pooled_response.status_code = 200
        pooled_response.json.return_value = {"voices": [{"voice_id": "v1", "name": "Alice"}]}
        pooled_client = AsyncMock()
        pooled_client.get.return_value = pooled_response
        service._client = pooled_client

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            result = await service.list_voices()

        mock_cls.assert_not_called()
        pooled_client.get.assert_called_once()
        assert result == [{"voice_id": "v1", "name": "Alice"}]

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_uses_pooled_client_when_present(
        self, mock_settings_configured: None
    ) -> None:
        """generate_dialog_audio() must use the pooled client when present.

        Locks the pooled branch at this call site independently of the
        TTS-only AC test -- a revert here would not otherwise be caught.
        """
        service = ElevenLabsService()

        pooled_response = MagicMock()
        pooled_response.status_code = 200
        pooled_response.json.return_value = {
            "audio_base64": "abc123",
            "voice_segments": [],
        }
        pooled_client = AsyncMock()
        pooled_client.post.return_value = pooled_response
        service._client = pooled_client

        inputs = [{"text": "Γεια σας!", "voice_id": "voice-1"}]

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            result = await service.generate_dialog_audio(inputs)

        mock_cls.assert_not_called()
        pooled_client.post.assert_called_once()
        assert result == {"audio_base64": "abc123", "voice_segments": []}

    @pytest.mark.asyncio
    async def test_forced_align_uses_pooled_client_when_present(
        self, mock_settings_configured: None
    ) -> None:
        """forced_align() must use the pooled client and preserve the
        files=/data=/header-override request shape when using it.

        Locks the pooled branch at this call site independently of the
        TTS-only AC test -- a revert here would not otherwise be caught.
        """
        service = ElevenLabsService()

        pooled_response = MagicMock()
        pooled_response.status_code = 200
        pooled_response.json.return_value = {"words": [], "loss": 0.01}
        pooled_client = AsyncMock()
        pooled_client.post.return_value = pooled_response
        service._client = pooled_client

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            result = await service.forced_align(b"audio-bytes", "some text")

        mock_cls.assert_not_called()
        pooled_client.post.assert_called_once()
        call_kwargs = pooled_client.post.call_args.kwargs
        assert call_kwargs["headers"] == {"xi-api-key": "test-api-key-12345"}
        assert call_kwargs["files"] == {"file": ("dialog.mp3", b"audio-bytes", "audio/mpeg")}
        assert call_kwargs["data"] == {"text": "some text"}
        assert result == {"words": [], "loss": 0.01}

    @pytest.mark.asyncio
    async def test_pooled_client_network_error_still_raises_api_error(
        self, mock_settings_configured: None
    ) -> None:
        """A RequestError raised by the POOLED client must still be converted
        to ElevenLabsAPIError(status_code=0) by the existing except-wrapper.

        Guards that the request-in-branch / body-read-after-branch restructure
        did not move the pooled call outside the try/except httpx.RequestError
        wrapper (which was written when the request always sat inside the
        `async with` block).
        """
        service = ElevenLabsService()

        pooled_client = AsyncMock()
        pooled_client.post.side_effect = httpx.RequestError("boom")
        service._client = pooled_client

        with pytest.raises(ElevenLabsAPIError) as exc_info:
            await service._call_tts_api("text", "v1", "Alice")

        assert exc_info.value.status_code == 0
        pooled_client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_start_called_twice_replaces_client_without_closing_previous(
        self, mock_settings_configured: None
    ) -> None:
        """Documents current start() idempotence: calling start() twice
        overwrites self._client with a new client; the previous client's
        aclose() is NOT awaited (no double-start guard).

        This mirrors OpenRouterService.start() (also unguarded) -- not a
        regression introduced here. Locked as a regression test so any future
        divergence between the two services' lifecycle semantics is caught
        (in practice lifespan calls start() exactly once, so this is not
        exercised in production).
        """
        service = ElevenLabsService()

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            first_client = AsyncMock()
            mock_cls.return_value = first_client
            await service.start()
            first_client_ref = service._client

            second_client = AsyncMock()
            mock_cls.return_value = second_client
            await service.start()

        assert service._client is second_client
        assert service._client is not first_client_ref
        first_client_ref.aclose.assert_not_awaited()
