"""Unit tests for ElevenLabsService.generate_dialog_audio method."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from src.core.exceptions import (
    ElevenLabsAPIError,
    ElevenLabsAuthenticationError,
    ElevenLabsNotConfiguredError,
    ElevenLabsRateLimitError,
)
from src.services.elevenlabs_service import ElevenLabsService

SAMPLE_INPUTS = [
    {"text": "Γεια σας!", "voice_id": "voice-1"},
    {"text": "Γεια σου!", "voice_id": "voice-2"},
]

SAMPLE_RESPONSE = {
    "audio_base64": "abc123fakeb64",
    "voice_segments": [
        {"dialogue_input_index": 0, "start_time_seconds": 0.0, "end_time_seconds": 1.5},
        {"dialogue_input_index": 1, "start_time_seconds": 1.5, "end_time_seconds": 3.0},
    ],
}


@pytest.fixture()
def mock_settings_configured():
    """Settings with ElevenLabs configured (valid API key)."""
    with patch("src.services.elevenlabs_service.settings") as mock:
        mock.elevenlabs_api_key = "test-api-key-12345"
        mock.elevenlabs_configured = True
        mock.elevenlabs_model_id = "eleven_multilingual_v2"
        mock.elevenlabs_dialog_model_id = "eleven_v3"
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


def _make_mock_client(status_code: int, json_data=None, text="", side_effect=None):
    """Helper to create a mock httpx client with a configured response."""
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.json.return_value = json_data or {}
    mock_response.text = text

    mock_client = AsyncMock()
    if side_effect:
        mock_client.post.side_effect = side_effect
    else:
        mock_client.post.return_value = mock_response

    return mock_client, mock_response


class TestGenerateDialogAudio:
    """Unit tests for ElevenLabsService.generate_dialog_audio."""

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_success(self, mock_settings_configured):
        """Success path returns parsed JSON dict unchanged."""
        mock_client, _ = _make_mock_client(200, json_data=SAMPLE_RESPONSE)

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            service = ElevenLabsService()
            result = await service.generate_dialog_audio(SAMPLE_INPUTS)

        assert result == SAMPLE_RESPONSE
        assert result["audio_base64"] == "abc123fakeb64"
        assert len(result["voice_segments"]) == 2

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_401(self, mock_settings_configured):
        """401 response raises ElevenLabsAuthenticationError."""
        mock_client, _ = _make_mock_client(401, text="Unauthorized")

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            service = ElevenLabsService()
            with pytest.raises(ElevenLabsAuthenticationError):
                await service.generate_dialog_audio(SAMPLE_INPUTS)

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_429(self, mock_settings_configured):
        """429 response raises ElevenLabsRateLimitError."""
        mock_client, _ = _make_mock_client(429)

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            service = ElevenLabsService()
            with pytest.raises(ElevenLabsRateLimitError):
                await service.generate_dialog_audio(SAMPLE_INPUTS)

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_500(self, mock_settings_configured):
        """500 response raises ElevenLabsAPIError with correct status_code."""
        mock_client, _ = _make_mock_client(500, text="Internal Server Error")

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            service = ElevenLabsService()
            with pytest.raises(ElevenLabsAPIError) as exc_info:
                await service.generate_dialog_audio(SAMPLE_INPUTS)

        assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_network_error(self, mock_settings_configured):
        """httpx.RequestError raises ElevenLabsAPIError with status_code=0."""
        mock_client, _ = _make_mock_client(0, side_effect=httpx.RequestError("Connection failed"))

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            service = ElevenLabsService()
            with pytest.raises(ElevenLabsAPIError) as exc_info:
                await service.generate_dialog_audio(SAMPLE_INPUTS)

        assert exc_info.value.status_code == 0
        assert "Network error" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_not_configured(self, mock_settings_not_configured):
        """Service raises ElevenLabsNotConfiguredError when not configured."""
        service = ElevenLabsService()
        with pytest.raises(ElevenLabsNotConfiguredError):
            await service.generate_dialog_audio(SAMPLE_INPUTS)

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_request_body(self, mock_settings_configured):
        """Request body, URL, and query params are correct."""
        mock_client, _ = _make_mock_client(200, json_data=SAMPLE_RESPONSE)

        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            service = ElevenLabsService()
            await service.generate_dialog_audio(SAMPLE_INPUTS)

        call_args = mock_client.post.call_args
        url = call_args.args[0]
        body = call_args.kwargs["json"]
        params = call_args.kwargs["params"]

        assert "/v1/text-to-dialogue/with-timestamps" in url
        assert body["model_id"] == mock_settings_configured.elevenlabs_dialog_model_id
        assert body["inputs"] == SAMPLE_INPUTS
        assert body["language_code"] == "el"
        assert params["output_format"] == mock_settings_configured.elevenlabs_output_format
