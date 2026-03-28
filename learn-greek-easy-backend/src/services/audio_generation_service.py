from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional, Protocol
from uuid import UUID

from src.core.logging import get_logger

logger = get_logger(__name__)


class ProgressCallback(Protocol):
    async def __call__(self, stage: str, **kwargs: Any) -> None: ...  # noqa: E704


@dataclass
class AudioResult:
    audio_bytes: bytes
    s3_key: str
    duration_seconds: float
    file_size_bytes: int


@dataclass
class DialogAudioResult(AudioResult):
    line_timings: dict[int, tuple[int, int]]
    word_timestamps_map: dict[int, list[dict] | None]
    alignment_source: str
    degenerate_line_count: int


class AudioGenerationService:
    def __init__(self) -> None:
        from src.services.elevenlabs_service import get_elevenlabs_service
        from src.services.s3_service import get_s3_service

        self._elevenlabs = get_elevenlabs_service()
        self._s3 = get_s3_service()

    async def generate_single(
        self,
        text: str,
        s3_key: str,
        voice_id: str | None = None,
        on_progress: ProgressCallback | None = None,
        news_item_id: Optional[UUID] = None,
    ) -> AudioResult:
        if on_progress is not None:
            await on_progress("tts")

        audio_bytes = await self._elevenlabs.generate_speech(
            text,
            voice_id=voice_id,
            news_item_id=news_item_id,
        )

        duration_seconds = (len(audio_bytes) * 8) / (128 * 1000)

        if on_progress is not None:
            await on_progress("upload")

        upload_ok = self._s3.upload_object(s3_key, audio_bytes, "audio/mpeg")
        if not upload_ok:
            raise RuntimeError("S3 upload failed")

        return AudioResult(
            audio_bytes=audio_bytes,
            s3_key=s3_key,
            duration_seconds=duration_seconds,
            file_size_bytes=len(audio_bytes),
        )


_service: AudioGenerationService | None = None


def get_audio_generation_service() -> AudioGenerationService:
    global _service
    if _service is None:
        _service = AudioGenerationService()
    return _service
