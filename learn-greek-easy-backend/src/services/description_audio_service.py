"""Reusable description-audio pipeline core.

Extracted from _description_audio_sse_pipeline in src/api/v1/admin.py so the
same load → TTS → persist logic can be called from non-SSE contexts (e.g. a
fire-and-forget BackgroundTask wired into create_news_item).

Usage pattern
-------------
SSE wrapper (admin.py):
    - Resolves factory = get_session_factory() and
      audio_service = get_audio_generation_service() at the wrapper level.
    - Calls the 3 sub-functions directly so it can interleave SSE events
      between steps.

BG-task wrapper (SITAUDO-02):
    - Builds its own engine + sessionmaker per call, passes as factory.
    - Calls run_description_audio_pipeline(situation_id, level, factory,
      audio_service=audio_service) for a single-call entry point.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.core.logging import get_logger
from src.db.models import DescriptionStatus, SituationDescription
from src.services.audio_generation_service import AudioGenerationService, AudioWithTimestampsResult

if TYPE_CHECKING:
    pass

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Exception hierarchy
# ---------------------------------------------------------------------------


class DescriptionAudioError(Exception):
    """Base class. ``stage`` is the SSE stage the failure should be attributed to."""

    stage: str = "unknown"


class DescriptionLoadError(DescriptionAudioError):
    """Raised for invalid level, missing description, or missing text."""

    stage = "load"


class DescriptionGenerateError(DescriptionAudioError):
    """Raised for ElevenLabs / audio-service failures."""

    stage = "tts"


class DescriptionPersistError(DescriptionAudioError):
    """Raised for DB write failures."""

    stage = "persist"


# ---------------------------------------------------------------------------
# Sub-functions
# ---------------------------------------------------------------------------


async def load_description_text(
    situation_id: UUID,
    level: Literal["b1", "a2"],
    factory: async_sessionmaker[AsyncSession],
) -> tuple[UUID, str]:
    """Load the description text for *situation_id* at *level*.

    Returns ``(description_id, text)``.

    Raises :class:`DescriptionLoadError` when:
    - *level* is not ``"b1"`` or ``"a2"``
    - no ``SituationDescription`` row exists for *situation_id*
    - the text column for *level* is empty / whitespace

    The level check is intentionally first — no DB session is opened when
    the level is invalid (required by the ``test_invalid_level`` assertion
    ``mock_factory.begin.assert_not_called()``).
    """
    # Delta 3: level check MUST come before any factory.begin() call.
    if level not in ("b1", "a2"):
        raise DescriptionLoadError(f"Invalid level: {level}. Must be 'b1' or 'a2'")

    async with factory.begin() as session:
        db_result = await session.execute(
            select(SituationDescription).where(SituationDescription.situation_id == situation_id)
        )
        description = db_result.scalar_one_or_none()
        if description is None:
            raise DescriptionLoadError("No description found for this situation")
        description_id: UUID = description.id
        text = description.text_el if level == "b1" else description.text_el_a2

    if not text or not text.strip():
        raise DescriptionLoadError(f"No text for level {level}")

    return description_id, text.strip()


async def generate_description_audio(
    text: str,
    s3_key: str,
    audio_service: AudioGenerationService,
) -> AudioWithTimestampsResult:
    """Call the audio service and return an :class:`AudioWithTimestampsResult`.

    The caller (SSE wrapper or orchestrator) must inject *audio_service* — this
    function does NOT call ``get_audio_generation_service()`` internally so that
    the patch target ``src.api.v1.admin.get_audio_generation_service`` used by
    the 9 regression tests remains effective (Delta 2).

    Raises :class:`DescriptionGenerateError` on any failure.
    """
    try:
        result = await audio_service.generate_single(
            text=text,
            s3_key=s3_key,
            with_timestamps=True,
        )
    except Exception as exc:
        raise DescriptionGenerateError(str(exc)) from exc

    if not isinstance(result, AudioWithTimestampsResult):
        raise DescriptionGenerateError(
            f"Expected AudioWithTimestampsResult, got {type(result).__name__}"
        )

    return result


async def persist_description_audio(
    description_id: UUID,
    level: Literal["b1", "a2"],
    s3_key: str,
    result: AudioWithTimestampsResult,
    factory: async_sessionmaker[AsyncSession],
) -> None:
    """Write a single UPDATE inside a ``factory.begin()`` transaction.

    The value-dict shape mirrors ``admin.py:4175-4194`` exactly (Delta 5).
    Raises :class:`DescriptionPersistError` on any DB failure.
    """
    if level == "b1":
        values: dict = {
            "audio_s3_key": s3_key,
            "audio_duration_seconds": result.duration_seconds,
            "word_timestamps": result.word_timestamps,
            "status": DescriptionStatus.AUDIO_READY,
        }
    else:
        values = {
            "audio_a2_s3_key": s3_key,
            "audio_a2_duration_seconds": result.duration_seconds,
            "word_timestamps_a2": result.word_timestamps,
            "status": DescriptionStatus.AUDIO_READY,
        }

    try:
        async with factory.begin() as session:
            await session.execute(
                update(SituationDescription)
                .where(SituationDescription.id == description_id)
                .values(**values)
            )
    except Exception as exc:
        raise DescriptionPersistError(str(exc)) from exc


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


async def run_description_audio_pipeline(
    situation_id: UUID,
    level: Literal["b1", "a2"],
    factory: async_sessionmaker[AsyncSession],
    audio_service: AudioGenerationService,
) -> None:
    """Full load → generate → persist pipeline.

    RAISES on failure (``DescriptionAudioError`` subclasses or unexpected
    ``Exception``). Callers are responsible for translating exceptions into
    their own error sinks.

    AC#11 observability: if ``forced_align`` returns empty ``word_timestamps``
    despite non-empty text, an ERROR is logged for Sentry visibility — the
    audio is still persisted (do not raise).
    """
    description_id, text = await load_description_text(situation_id, level, factory)

    s3_key = (
        f"situation-description-audio/{description_id}.mp3"
        if level == "b1"
        else f"situation-description-audio/a2/{description_id}.mp3"
    )

    result = await generate_description_audio(text, s3_key, audio_service)

    # AC#11: forced_align silent-failure observability
    if result.word_timestamps == [] and text.strip():
        logger.error(
            "forced_align returned empty timestamps despite non-empty text",
            extra={
                "situation_id": str(situation_id),
                "level": level,
                "text_length": len(text),
            },
        )
        # Do NOT raise — audio is still useful; persist anyway.

    await persist_description_audio(description_id, level, s3_key, result, factory)
