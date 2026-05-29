"""Picture generation pipeline primitives + orchestrator.

Pure-logic primitives composed in two ways:
- The SSE wrapper in ``src/api/v1/admin.py`` calls the 4 sub-functions
  directly so it can interleave SSE events between steps.
- ``run_picture_generation_pipeline`` composes them as a single
  load → generate → upload → persist call for non-SSE callers
  (e.g. background tasks).

No SSE / FastAPI imports — keeps tests easy.

Usage pattern
-------------
SSE wrapper (admin.py):
    - Resolves factory = get_session_factory() and
      openrouter_service / s3_service at the wrapper level.
    - Calls the 4 sub-functions directly so it can interleave SSE events
      between steps.

Orchestrator (background tasks):
    - Resolves factory + services at the call site.
    - Calls ``run_picture_generation_pipeline(...)`` and lets
      ``PictureGenerationError`` subclasses propagate to its own error sink.
"""

from __future__ import annotations

import asyncio
import hashlib
from typing import Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from src.config import settings
from src.core.exceptions import (
    OpenRouterAPIError,
    OpenRouterAuthenticationError,
    OpenRouterNoImageError,
    OpenRouterNotConfiguredError,
    OpenRouterRateLimitError,
    OpenRouterTimeoutError,
)
from src.core.logging import get_logger
from src.db.models import PictureStatus, Situation, SituationPicture
from src.schemas.nlp import OpenRouterImageResult
from src.services.openrouter_service import OpenRouterService
from src.services.picture_match_exercise_service import (
    reconcile_picture_match_exercises_for_situation,
)
from src.services.s3_service import S3Service

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Exception hierarchy
# ---------------------------------------------------------------------------


class PictureGenerationError(Exception):
    """Base class. ``stage`` is the SSE stage the failure should be attributed to."""

    stage: Literal["load", "generate", "upload", "persist"] = "load"


class PictureLoadError(PictureGenerationError):
    """Raised when the situation/picture cannot be loaded for generation."""

    stage = "load"


class PictureGenerateError(PictureGenerationError):
    """Raised for OpenRouter / image-generation failures."""

    stage = "generate"


class PictureUploadError(PictureGenerationError):
    """Raised when the S3 upload fails."""

    stage = "upload"


class PicturePersistError(PictureGenerationError):
    """Raised for DB write failures."""

    stage = "persist"


# ---------------------------------------------------------------------------
# Sub-functions
# ---------------------------------------------------------------------------


async def load_picture_for_generation(
    situation_id: UUID,
    factory: async_sessionmaker[AsyncSession],
) -> tuple[UUID, str]:
    """Load (picture_id, image_prompt) for the picture attached to ``situation_id``.

    Returns ``(picture_id, image_prompt)``.

    Raises :class:`PictureLoadError` when:
    - no ``Situation`` row exists for ``situation_id``
    - the situation has no linked ``SituationPicture`` row
    - the picture's ``image_prompt`` is empty or whitespace
    """
    async with factory.begin() as session:
        stmt = (
            select(Situation)
            .where(Situation.id == situation_id)
            .options(selectinload(Situation.picture))
        )
        situation = (await session.execute(stmt)).scalar_one_or_none()
        if situation is None:
            raise PictureLoadError(f"Situation not found: {situation_id}")
        picture = situation.picture
        if picture is None:
            raise PictureLoadError(f"Situation {situation_id} has no picture row")
        prompt = (picture.image_prompt or "").strip()
        if not prompt:
            raise PictureLoadError(f"Picture {picture.id} has empty image_prompt")
        return picture.id, prompt


async def generate_picture_bytes(
    prompt: str,
    openrouter_service: OpenRouterService,
) -> OpenRouterImageResult:
    """Wrap OpenRouterService.generate_image; translate upstream errors to PictureGenerateError.

    Raises :class:`PictureGenerateError` for any ``OpenRouterError`` subclass,
    preserving the original message.
    """
    try:
        return await openrouter_service.generate_image(
            prompt,
            model=settings.openrouter_image_model,
            aspect_ratio=settings.openrouter_image_aspect_ratio,
        )
    except OpenRouterNotConfiguredError as exc:
        raise PictureGenerateError(f"OpenRouter not configured: {exc}") from exc
    except OpenRouterAuthenticationError as exc:
        raise PictureGenerateError(f"OpenRouter authentication failed: {exc}") from exc
    except OpenRouterNoImageError as exc:
        raise PictureGenerateError(str(exc)) from exc
    except OpenRouterTimeoutError as exc:
        raise PictureGenerateError(f"OpenRouter timeout: {exc}") from exc
    except OpenRouterRateLimitError as exc:
        raise PictureGenerateError(f"OpenRouter rate-limited: {exc}") from exc
    except OpenRouterAPIError as exc:
        raise PictureGenerateError(f"OpenRouter error: {exc}") from exc


async def upload_picture_to_s3(
    picture_id: UUID,
    image_bytes: bytes,
    s3_service: S3Service,
) -> str:
    """Upload PNG bytes to the canonical S3 key. Returns the key on success.

    ``s3_service.upload_object`` is SYNC and returns ``bool``.  It swallows
    boto exceptions internally so they never propagate here — we only inspect
    the return value.

    Raises :class:`PictureUploadError` when upload returns ``False``.
    """
    s3_key = f"situation-pictures/{picture_id}/{hashlib.sha256(image_bytes).hexdigest()}.png"
    success = await asyncio.to_thread(
        s3_service.upload_object,
        s3_key=s3_key,
        data=image_bytes,
        content_type="image/png",
    )
    if not success:
        raise PictureUploadError("S3 upload failed")
    return s3_key


async def persist_picture_generation(
    picture_id: UUID,
    s3_key: str,
    factory: async_sessionmaker[AsyncSession],
) -> str | None:
    """Set image_s3_key + status=GENERATED on the picture. Idempotent on re-run.

    Returns the *prior* ``image_s3_key`` value (before overwriting) so the caller
    can delete the old S3 object.  Returns ``None`` when there was no prior key.

    On commit failure: logs the orphaned S3 key at ERROR level then raises
    :class:`PicturePersistError`.  Does NOT delete the S3 object — a stable key
    means a successful retry overwrites cleanly.
    """
    try:
        async with factory.begin() as session:
            picture = await session.get(SituationPicture, picture_id)
            if picture is None:
                raise PicturePersistError(f"Picture vanished mid-pipeline: {picture_id}")
            prior_key = picture.image_s3_key
            picture.image_s3_key = s3_key
            picture.status = PictureStatus.GENERATED
            try:
                await reconcile_picture_match_exercises_for_situation(session, picture.situation_id)
            except Exception as exc:  # broad except: reconcile failure must not block persist
                logger.error(
                    "picture_match_reconcile_failed",
                    extra={"situation_id": str(picture.situation_id), "error": str(exc)},
                )
        return prior_key
    except PicturePersistError:
        raise
    except Exception as exc:
        logger.error(
            "Orphaned S3 key after picture persist failure",
            extra={"picture_id": str(picture_id), "s3_key": s3_key, "error": str(exc)},
        )
        raise PicturePersistError(f"Persist failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


async def run_picture_generation_pipeline(
    situation_id: UUID,
    factory: async_sessionmaker[AsyncSession],
    openrouter_service: OpenRouterService,
    s3_service: S3Service,
) -> None:
    """Full load → generate → upload → persist pipeline.

    RAISES on failure (``PictureGenerationError`` subclasses or unexpected
    ``Exception``). Callers are responsible for translating exceptions into
    their own error sinks (e.g. SSE stage events, background-task error logs).
    """
    picture_id, image_prompt = await load_picture_for_generation(situation_id, factory)
    result = await generate_picture_bytes(image_prompt, openrouter_service)
    s3_key = await upload_picture_to_s3(picture_id, result.image_bytes, s3_service)
    await persist_picture_generation(picture_id, s3_key, factory)
