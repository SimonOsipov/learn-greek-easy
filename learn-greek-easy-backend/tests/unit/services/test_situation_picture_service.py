"""Unit tests for situation_picture_service primitives.

All external collaborators (factory, openrouter_service, s3_service) are
mocked — no DB or network required.

``factory.begin()`` returns an async context manager; we wire it with an
``AsyncMock`` session so ``async with factory.begin() as session`` yields the
mock session.
"""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.core.exceptions import (
    OpenRouterAPIError,
    OpenRouterNoImageError,
    OpenRouterRateLimitError,
    OpenRouterTimeoutError,
)
from src.db.models import PictureStatus
from src.schemas.nlp import OpenRouterImageResult
from src.services.situation_picture_service import (
    PictureGenerateError,
    PictureLoadError,
    PicturePersistError,
    PictureUploadError,
    generate_picture_bytes,
    load_picture_for_generation,
    persist_picture_generation,
    upload_picture_to_s3,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_factory(session: AsyncMock) -> MagicMock:
    """Return a mock factory whose .begin() is an async context manager yielding *session*."""
    ctx = AsyncMock()
    ctx.__aenter__.return_value = session
    ctx.__aexit__.return_value = None
    factory = MagicMock()
    factory.begin.return_value = ctx
    return factory


def _make_picture(prompt: str = "A sunny scene", picture_id=None):
    """Return a MagicMock SituationPicture with the given image_prompt."""
    pic = MagicMock()
    pic.id = picture_id or uuid4()
    pic.image_prompt = prompt
    pic.image_s3_key = None
    pic.status = PictureStatus.DRAFT
    return pic


def _make_situation(picture=None):
    """Return a MagicMock Situation optionally linked to *picture*."""
    sit = MagicMock()
    sit.id = uuid4()
    sit.picture = picture
    return sit


# ---------------------------------------------------------------------------
# load_picture_for_generation
# ---------------------------------------------------------------------------


def _mock_session_execute(session: AsyncMock, row):
    """Set up session.execute so that (await session.execute(...)).scalar_one_or_none() -> row."""
    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = row
    session.execute = AsyncMock(return_value=execute_result)


class TestLoadPictureForGeneration:
    async def test_happy_path_returns_picture_id_and_prompt(self):
        """Returns (picture_id, image_prompt) for a valid situation with a picture."""
        picture = _make_picture(prompt="Evening in Athens")
        situation = _make_situation(picture=picture)

        session = AsyncMock()
        _mock_session_execute(session, situation)
        factory = _make_factory(session)

        result = await load_picture_for_generation(situation.id, factory)

        assert result == (picture.id, "Evening in Athens")

    async def test_missing_situation_raises_picture_load_error(self):
        """Raises PictureLoadError when the Situation row is not found."""
        session = AsyncMock()
        _mock_session_execute(session, None)
        factory = _make_factory(session)

        with pytest.raises(PictureLoadError):
            await load_picture_for_generation(uuid4(), factory)

    async def test_no_picture_raises_picture_load_error(self):
        """Raises PictureLoadError when situation has no linked SituationPicture."""
        situation = _make_situation(picture=None)

        session = AsyncMock()
        _mock_session_execute(session, situation)
        factory = _make_factory(session)

        with pytest.raises(PictureLoadError):
            await load_picture_for_generation(situation.id, factory)

    @pytest.mark.parametrize("prompt", ["", "   ", "\t\n"])
    async def test_empty_prompt_raises_picture_load_error(self, prompt: str):
        """Raises PictureLoadError when image_prompt is empty or whitespace."""
        picture = _make_picture(prompt=prompt)
        situation = _make_situation(picture=picture)

        session = AsyncMock()
        _mock_session_execute(session, situation)
        factory = _make_factory(session)

        with pytest.raises(PictureLoadError):
            await load_picture_for_generation(situation.id, factory)


# ---------------------------------------------------------------------------
# generate_picture_bytes
# ---------------------------------------------------------------------------


class TestGeneratePictureBytes:
    @pytest.mark.parametrize(
        "exc_instance",
        [
            OpenRouterNoImageError("no image returned"),
            OpenRouterTimeoutError("request timed out"),
            OpenRouterRateLimitError("rate limited"),
            OpenRouterAPIError(500, "internal error"),
        ],
    )
    async def test_openrouter_errors_translate_to_picture_generate_error(self, exc_instance):
        """Each OpenRouter exception class is translated to PictureGenerateError."""
        openrouter_service = MagicMock()
        openrouter_service.generate_image = AsyncMock(side_effect=exc_instance)

        with pytest.raises(PictureGenerateError):
            await generate_picture_bytes("some prompt", openrouter_service)

    async def test_happy_path_returns_image_result(self):
        """Returns the OpenRouterImageResult from the service on success."""
        expected = OpenRouterImageResult(
            image_bytes=b"\x89PNG",
            mime_type="image/png",
            model="test/model",
            latency_ms=123.0,
        )
        openrouter_service = MagicMock()
        openrouter_service.generate_image = AsyncMock(return_value=expected)

        with patch("src.services.situation_picture_service.settings") as mock_settings:
            mock_settings.openrouter_image_model = "test/model"
            mock_settings.openrouter_image_aspect_ratio = "16:9"
            result = await generate_picture_bytes("some prompt", openrouter_service)

        assert result is expected


# ---------------------------------------------------------------------------
# upload_picture_to_s3
# ---------------------------------------------------------------------------


class TestUploadPictureToS3:
    async def test_happy_path_returns_s3_key(self):
        """Returns the canonical s3_key when upload_object returns True."""
        picture_id = uuid4()
        s3_service = MagicMock()
        s3_service.upload_object.return_value = True

        result = await upload_picture_to_s3(picture_id, b"\x89PNG", s3_service)

        assert result == f"situation-pictures/{picture_id}.png"

    async def test_upload_object_called_with_correct_kwargs(self):
        """upload_object is called with keyword args s3_key, data, content_type."""
        picture_id = uuid4()
        image_bytes = b"\x89PNG fake"
        s3_service = MagicMock()
        s3_service.upload_object.return_value = True

        await upload_picture_to_s3(picture_id, image_bytes, s3_service)

        s3_service.upload_object.assert_called_once_with(
            s3_key=f"situation-pictures/{picture_id}.png",
            data=image_bytes,
            content_type="image/png",
        )

    async def test_upload_failure_raises_picture_upload_error(self):
        """Raises PictureUploadError when upload_object returns False."""
        s3_service = MagicMock()
        s3_service.upload_object.return_value = False

        with pytest.raises(PictureUploadError):
            await upload_picture_to_s3(uuid4(), b"\x89PNG", s3_service)


# ---------------------------------------------------------------------------
# persist_picture_generation
# ---------------------------------------------------------------------------


class TestPersistPictureGeneration:
    async def test_happy_path_updates_key_and_status(self):
        """Updates image_s3_key and status=GENERATED on the picture row."""
        picture_id = uuid4()
        s3_key = f"situation-pictures/{picture_id}.png"

        picture = MagicMock()
        picture.id = picture_id
        picture.status = PictureStatus.DRAFT
        picture.image_s3_key = None

        session = AsyncMock()
        session.get.return_value = picture
        factory = _make_factory(session)

        await persist_picture_generation(picture_id, s3_key, factory)

        assert picture.image_s3_key == s3_key
        assert picture.status == PictureStatus.GENERATED

    async def test_regenerate_updates_key_keeps_generated_status(self):
        """Second call (regenerate) keeps status=GENERATED and overwrites s3_key."""
        picture_id = uuid4()
        old_key = f"situation-pictures/{picture_id}.png"
        new_key = f"situation-pictures/{picture_id}.png"

        picture = MagicMock()
        picture.id = picture_id
        picture.status = PictureStatus.GENERATED
        picture.image_s3_key = old_key

        session = AsyncMock()
        session.get.return_value = picture
        factory = _make_factory(session)

        await persist_picture_generation(picture_id, new_key, factory)

        assert picture.image_s3_key == new_key
        assert picture.status == PictureStatus.GENERATED

    async def test_commit_failure_logs_orphaned_key_and_raises(self, caplog_loguru):
        """On commit failure: logs orphaned key at ERROR level and raises PicturePersistError."""
        picture_id = uuid4()
        s3_key = f"situation-pictures/{picture_id}.png"

        # Session.get returns a picture, but committing (context manager exit) raises
        picture = MagicMock()
        picture.id = picture_id
        picture.status = PictureStatus.DRAFT
        picture.image_s3_key = None

        session = AsyncMock()
        session.get.return_value = picture

        # Make __aexit__ raise to simulate commit failure
        ctx = AsyncMock()
        ctx.__aenter__.return_value = session
        ctx.__aexit__.side_effect = RuntimeError("simulated commit failure")
        factory = MagicMock()
        factory.begin.return_value = ctx

        caplog_loguru.set_level(logging.ERROR)

        with pytest.raises(PicturePersistError):
            await persist_picture_generation(picture_id, s3_key, factory)

        error_messages = [r.getMessage() for r in caplog_loguru.records if r.levelname == "ERROR"]
        assert any("Orphaned S3 key" in m for m in error_messages)
