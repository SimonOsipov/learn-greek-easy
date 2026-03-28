"""Unit tests for AudioGenerationService."""

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

import src.services.audio_generation_service as audio_module
from src.services.audio_generation_service import (
    AudioGenerationService,
    AudioResult,
    get_audio_generation_service,
)


@pytest.fixture(autouse=True)
def reset_singleton():
    audio_module._service = None
    yield
    audio_module._service = None


@pytest.fixture
def mock_elevenlabs():
    mock = MagicMock()
    mock.generate_speech = AsyncMock(return_value=b"audio_data_here")
    return mock


@pytest.fixture
def mock_s3():
    mock = MagicMock()
    mock.upload_object = MagicMock(return_value=True)
    return mock


@pytest.fixture
def service(mock_elevenlabs, mock_s3):
    svc = AudioGenerationService.__new__(AudioGenerationService)
    svc._elevenlabs = mock_elevenlabs
    svc._s3 = mock_s3
    return svc


class TestGenerateSingle:
    async def test_generate_single_happy_path(self, service, mock_elevenlabs, mock_s3):
        result = await service.generate_single(text="Hello", s3_key="test/key.mp3")

        mock_elevenlabs.generate_speech.assert_called_once_with(
            "Hello", voice_id=None, news_item_id=None
        )
        mock_s3.upload_object.assert_called_once_with(
            "test/key.mp3", b"audio_data_here", "audio/mpeg"
        )

        assert isinstance(result, AudioResult)
        assert result.audio_bytes == b"audio_data_here"
        assert result.s3_key == "test/key.mp3"
        assert result.file_size_bytes == len(b"audio_data_here")
        expected_duration = (len(b"audio_data_here") * 8) / (128 * 1000)
        assert result.duration_seconds == pytest.approx(expected_duration)

    async def test_generate_single_with_voice_id(self, service, mock_elevenlabs):
        await service.generate_single(text="Hello", s3_key="key.mp3", voice_id="voice-123")
        mock_elevenlabs.generate_speech.assert_called_once_with(
            "Hello", voice_id="voice-123", news_item_id=None
        )

    async def test_generate_single_news_item_id_passthrough(self, service, mock_elevenlabs):
        nid = UUID("12345678-1234-5678-1234-567812345678")
        await service.generate_single(text="Hello", s3_key="key.mp3", news_item_id=nid)
        mock_elevenlabs.generate_speech.assert_called_once_with(
            "Hello", voice_id=None, news_item_id=nid
        )

    async def test_generate_single_s3_failure(self, service, mock_s3):
        mock_s3.upload_object.return_value = False
        with pytest.raises(RuntimeError, match="S3 upload failed"):
            await service.generate_single(text="Hello", s3_key="key.mp3")

    async def test_generate_single_progress_callback(self, service):
        stages = []

        async def on_progress(stage: str, **kwargs: Any) -> None:
            stages.append(stage)

        await service.generate_single(text="Hello", s3_key="key.mp3", on_progress=on_progress)
        assert stages == ["tts", "upload"]

    async def test_generate_single_no_callback(self, service):
        result = await service.generate_single(text="Hello", s3_key="key.mp3", on_progress=None)
        assert isinstance(result, AudioResult)

    def test_singleton(self):
        with patch(
            "src.services.audio_generation_service.AudioGenerationService.__init__",
            return_value=None,
        ):
            s1 = get_audio_generation_service()
            s2 = get_audio_generation_service()
            assert s1 is s2
