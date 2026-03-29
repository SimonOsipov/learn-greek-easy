"""Unit tests for AudioGenerationService."""

import base64
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

import src.services.audio_generation_service as audio_module
from src.services.audio_generation_service import (
    AudioGenerationService,
    AudioResult,
    AudioWithTimestampsResult,
    DialogAudioResult,
    DialogInput,
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
    mock.forced_align = AsyncMock(return_value={"words": [], "loss": 0.0})
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


def _make_dialog_response(num_lines=2, make_degenerate=False):
    """Build a minimal mock ElevenLabs generate_dialog_audio response."""
    segments = []
    for i in range(num_lines):
        start = i * 1.5
        end = start if make_degenerate else start + 1.5
        segments.append(
            {
                "dialogue_input_index": i,
                "start_time_seconds": start,
                "end_time_seconds": end,
                "character_start_index": i * 5,
                "character_end_index": (i + 1) * 5,
            }
        )
    return {
        "audio_base64": base64.b64encode(b"fake_mp3_audio").decode(),
        "voice_segments": segments,
        "alignment": {
            "characters": [],
            "character_start_times_seconds": [],
            "character_end_times_seconds": [],
        },
    }


@pytest.fixture
def mock_elevenlabs_dialog(mock_elevenlabs):
    mock_elevenlabs.generate_dialog_audio = AsyncMock(return_value=_make_dialog_response())
    mock_elevenlabs.forced_align = AsyncMock(return_value={"words": [], "loss": 0.01})
    return mock_elevenlabs


@pytest.fixture
def dialog_service(mock_elevenlabs_dialog, mock_s3):
    svc = AudioGenerationService.__new__(AudioGenerationService)
    svc._elevenlabs = mock_elevenlabs_dialog
    svc._s3 = mock_s3
    return svc


class TestGenerateDialog:
    async def test_generate_dialog_happy_path(
        self, dialog_service, mock_elevenlabs_dialog, mock_s3
    ):
        inputs = [
            DialogInput(text="Hello", voice_id="voice-1"),
            DialogInput(text="World", voice_id="voice-2"),
        ]

        with patch("src.services.audio_generation_service.MP3") as mock_mp3_cls:
            mock_mp3_instance = MagicMock()
            mock_mp3_instance.info.length = 3.0
            mock_mp3_cls.return_value = mock_mp3_instance

            result = await dialog_service.generate_dialog(inputs=inputs, s3_key="dialog/key.mp3")

        assert isinstance(result, DialogAudioResult)
        assert result.s3_key == "dialog/key.mp3"
        assert result.audio_bytes == base64.b64decode(base64.b64encode(b"fake_mp3_audio").decode())
        assert result.file_size_bytes == len(b"fake_mp3_audio")
        assert result.duration_seconds == 3.0
        assert result.alignment_source == "original"
        assert result.degenerate_line_count == 0
        assert 0 in result.line_timings
        assert 1 in result.line_timings
        mock_s3.upload_object.assert_called_once_with(
            "dialog/key.mp3", result.audio_bytes, "audio/mpeg"
        )

    async def test_generate_dialog_s3_failure(self, dialog_service, mock_s3):
        mock_s3.upload_object.return_value = False
        inputs = [
            DialogInput(text="Hello", voice_id="voice-1"),
            DialogInput(text="World", voice_id="voice-2"),
        ]

        with patch("src.services.audio_generation_service.MP3") as mock_mp3_cls:
            mock_mp3_instance = MagicMock()
            mock_mp3_instance.info.length = 3.0
            mock_mp3_cls.return_value = mock_mp3_instance

            with pytest.raises(RuntimeError, match="S3 upload failed"):
                await dialog_service.generate_dialog(inputs=inputs, s3_key="dialog/key.mp3")

    async def test_generate_dialog_progress_callback_no_degenerate(self, dialog_service):
        inputs = [
            DialogInput(text="Hello", voice_id="voice-1"),
            DialogInput(text="World", voice_id="voice-2"),
        ]
        stages = []

        async def on_progress(stage: str, **kwargs: Any) -> None:
            stages.append(stage)

        with patch("src.services.audio_generation_service.MP3") as mock_mp3_cls:
            mock_mp3_instance = MagicMock()
            mock_mp3_instance.info.length = 3.0
            mock_mp3_cls.return_value = mock_mp3_instance

            await dialog_service.generate_dialog(
                inputs=inputs, s3_key="dialog/key.mp3", on_progress=on_progress
            )

        assert stages == ["tts", "upload"]

    async def test_generate_dialog_progress_callback_with_fa(self, mock_elevenlabs_dialog, mock_s3):
        # Build a response with 1 degenerate line (line 0: start == end == 0.0)
        degenerate_response = _make_dialog_response(num_lines=2, make_degenerate=True)
        mock_elevenlabs_dialog.generate_dialog_audio = AsyncMock(return_value=degenerate_response)

        svc = AudioGenerationService.__new__(AudioGenerationService)
        svc._elevenlabs = mock_elevenlabs_dialog
        svc._s3 = mock_s3

        inputs = [
            DialogInput(text="Hello", voice_id="voice-1"),
            DialogInput(text="World", voice_id="voice-2"),
        ]
        stages = []

        async def on_progress(stage: str, **kwargs: Any) -> None:
            stages.append(stage)

        # Patch _apply_forced_alignment to return non-degenerate timing_map
        fixed_timing_map: dict[int, tuple[int, int]] = {0: (0, 1000), 1: (1000, 2000)}

        def fake_apply_fa(alignment_response, timing_map, sorted_lines, word_timestamps_map):
            return fixed_timing_map, word_timestamps_map

        with (
            patch(
                "src.services.audio_generation_service._apply_forced_alignment",
                side_effect=fake_apply_fa,
            ),
            patch("src.services.audio_generation_service.MP3") as mock_mp3_cls,
        ):
            mock_mp3_instance = MagicMock()
            mock_mp3_instance.info.length = 3.0
            mock_mp3_cls.return_value = mock_mp3_instance

            result = await svc.generate_dialog(
                inputs=inputs, s3_key="dialog/key.mp3", on_progress=on_progress
            )

        assert stages == ["tts", "alignment", "upload"]
        assert result.alignment_source == "forced_alignment"

    async def test_generate_dialog_missing_segments(self, mock_elevenlabs_dialog, mock_s3):
        mock_elevenlabs_dialog.generate_dialog_audio = AsyncMock(
            return_value={
                "audio_base64": base64.b64encode(b"fake_mp3_audio").decode(),
                "voice_segments": [],
                "alignment": {
                    "characters": [],
                    "character_start_times_seconds": [],
                    "character_end_times_seconds": [],
                },
            }
        )
        svc = AudioGenerationService.__new__(AudioGenerationService)
        svc._elevenlabs = mock_elevenlabs_dialog
        svc._s3 = mock_s3

        inputs = [DialogInput(text="Hello", voice_id="voice-1")]

        with pytest.raises(ValueError, match="voice_segments missing or empty"):
            await svc.generate_dialog(inputs=inputs, s3_key="dialog/key.mp3")

    async def test_generate_dialog_redistribution_fallback(self, mock_elevenlabs_dialog, mock_s3):
        degenerate_response = _make_dialog_response(num_lines=2, make_degenerate=True)
        mock_elevenlabs_dialog.generate_dialog_audio = AsyncMock(return_value=degenerate_response)
        mock_elevenlabs_dialog.forced_align = AsyncMock(side_effect=RuntimeError("FA failed"))

        svc = AudioGenerationService.__new__(AudioGenerationService)
        svc._elevenlabs = mock_elevenlabs_dialog
        svc._s3 = mock_s3

        inputs = [
            DialogInput(text="Hello", voice_id="voice-1"),
            DialogInput(text="World", voice_id="voice-2"),
        ]

        with patch("src.services.audio_generation_service.MP3") as mock_mp3_cls:
            mock_mp3_instance = MagicMock()
            mock_mp3_instance.info.length = 3.0
            mock_mp3_cls.return_value = mock_mp3_instance

            result = await svc.generate_dialog(inputs=inputs, s3_key="dialog/key.mp3")

        assert result.alignment_source == "redistribution"


class TestGenerateSingleWithTimestamps:
    async def test_generate_single_with_timestamps_happy_path(
        self, service, mock_elevenlabs, mock_s3
    ):
        mock_elevenlabs.forced_align = AsyncMock(
            return_value={
                "words": [
                    {"text": "Hello", "start": 0.0, "end": 0.5},
                    {"text": "world", "start": 0.6, "end": 1.2},
                ]
            }
        )
        result = await service.generate_single(
            text="Hello world", s3_key="test/key.mp3", with_timestamps=True
        )
        assert isinstance(result, AudioWithTimestampsResult)
        assert result.word_timestamps == [
            {"word": "Hello", "start_ms": 0, "end_ms": 500},
            {"word": "world", "start_ms": 600, "end_ms": 1200},
        ]
        mock_elevenlabs.forced_align.assert_called_once_with(b"audio_data_here", "Hello world")

    async def test_generate_single_with_timestamps_duration_from_mutagen(
        self, service, mock_elevenlabs
    ):
        with patch("src.services.audio_generation_service.MP3") as mock_mp3_cls:
            mock_mp3_instance = MagicMock()
            mock_mp3_instance.info.length = 3.75
            mock_mp3_cls.return_value = mock_mp3_instance
            result = await service.generate_single(
                text="Hello", s3_key="key.mp3", with_timestamps=True
            )
        assert result.duration_seconds == pytest.approx(3.75)

    async def test_generate_single_with_timestamps_alignment_failure(
        self, service, mock_elevenlabs
    ):
        mock_elevenlabs.forced_align = AsyncMock(side_effect=RuntimeError("FA failed"))
        result = await service.generate_single(text="Hello", s3_key="key.mp3", with_timestamps=True)
        assert isinstance(result, AudioWithTimestampsResult)
        assert result.word_timestamps == []  # graceful degradation

    async def test_generate_single_with_timestamps_progress_callback(self, service):
        stages = []

        async def on_progress(stage: str, **kwargs: Any) -> None:
            stages.append(stage)

        await service.generate_single(
            text="Hello", s3_key="key.mp3", with_timestamps=True, on_progress=on_progress
        )
        assert stages == ["tts", "alignment", "upload"]

    async def test_generate_single_without_timestamps_unchanged(self, service, mock_elevenlabs):
        result = await service.generate_single(
            text="Hello", s3_key="key.mp3"
        )  # with_timestamps=False (default)
        assert isinstance(result, AudioResult)
        assert not isinstance(result, AudioWithTimestampsResult)
        mock_elevenlabs.forced_align.assert_not_called()
