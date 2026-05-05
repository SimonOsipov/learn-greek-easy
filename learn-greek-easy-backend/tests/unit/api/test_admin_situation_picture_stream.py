"""Tests for POST /api/v1/admin/situations/{id}/picture/stream SSE endpoint."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.core.dependencies import SSEAuthResult
from src.core.exceptions import OpenRouterNoImageError
from src.db.models import PictureStatus
from src.schemas.nlp import OpenRouterImageResult

# ---------------------------------------------------------------------------
# SSE parsing helpers (copied verbatim from test_admin_description_audio_stream.py)
# ---------------------------------------------------------------------------


def _parse_sse_text(text: str) -> list[dict]:
    events = []
    for block in text.split("\n\n"):
        block = block.strip()
        if not block or block.startswith(":") or block.startswith("retry:"):
            continue
        etype, data_str = None, None
        has_data = False
        for line in block.split("\n"):
            if line.startswith("event:"):
                etype = line[6:].strip()
            elif line.startswith("data:"):
                data_str = line[5:].strip()
                has_data = True
        if has_data:
            if data_str:
                try:
                    data = json.loads(data_str)
                except json.JSONDecodeError:
                    data = data_str
            else:
                data = None
            events.append({"event": etype, "data": data})
    return events


async def _collect_stream(response) -> list[dict]:
    content = b""
    async for chunk in response.body_iterator:
        content += chunk if isinstance(chunk, bytes) else chunk.encode()
    return _parse_sse_text(content.decode())


async def _collect_generator(gen) -> list[dict]:
    """Collect SSE events directly from an async generator."""
    chunks = []
    async for chunk in gen:
        chunks.append(chunk)
    raw_text = "".join(chunks)
    return _parse_sse_text(raw_text)


# ---------------------------------------------------------------------------
# Auth helpers (copied verbatim from test_admin_description_audio_stream.py)
# ---------------------------------------------------------------------------


def _make_superuser_auth() -> SSEAuthResult:
    mock_user = MagicMock()
    mock_user.is_superuser = True
    mock_user.id = uuid4()
    return SSEAuthResult(user=mock_user)


def _make_non_superuser_auth() -> SSEAuthResult:
    mock_user = MagicMock()
    mock_user.is_superuser = False
    mock_user.id = uuid4()
    return SSEAuthResult(user=mock_user)


def _make_unauth() -> SSEAuthResult:
    return SSEAuthResult(
        error_code="auth_required",
        error_message="Authentication required",
    )


# ---------------------------------------------------------------------------
# Mock factories
# ---------------------------------------------------------------------------

PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00"


def _make_openrouter_service_mock(picture_id: object = None) -> MagicMock:
    """Mock OpenRouterService that returns a valid image result."""
    mock = MagicMock()
    mock.generate_image = AsyncMock(
        return_value=OpenRouterImageResult(
            image_bytes=PNG_BYTES,
            mime_type="image/png",
            model="google/gemini-3.1-flash-image-preview",
            latency_ms=1234.0,
        )
    )
    if picture_id is not None:
        s3_key = f"situation-pictures/{picture_id}.png"
        mock.generate_presigned_url = MagicMock(return_value=f"https://cdn.example.com/{s3_key}")
    else:
        mock.generate_presigned_url = MagicMock(
            return_value="https://cdn.example.com/situation-pictures/stub.png"
        )
    return mock


def _make_s3_service_mock(upload_success: bool = True, picture_id: object = None) -> MagicMock:
    """Mock S3Service."""
    mock = MagicMock()
    mock.upload_object = MagicMock(return_value=upload_success)
    if picture_id is not None:
        s3_key = f"situation-pictures/{picture_id}.png"
        mock.generate_presigned_url = MagicMock(return_value=f"https://cdn.example.com/{s3_key}")
    else:
        mock.generate_presigned_url = MagicMock(
            return_value="https://cdn.example.com/situation-pictures/stub.png"
        )
    return mock


def _acm(session: MagicMock) -> MagicMock:
    """Wrap a session mock in an async context manager."""
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=session)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm


def _make_factory(
    situation: MagicMock | None,
    persist_picture: MagicMock | None = None,
    persist_fail: bool = False,
) -> MagicMock:
    """Build a two-call session factory.

    Call 1 (load): session.execute returns scalar_one_or_none=situation.
    Call 2 (persist): session.get returns persist_picture.
    """
    load_session = MagicMock()
    result_mock = MagicMock()
    result_mock.scalar_one_or_none = MagicMock(return_value=situation)
    load_session.execute = AsyncMock(return_value=result_mock)

    persist_session = MagicMock()
    persist_session.get = AsyncMock(return_value=persist_picture)

    load_cm = _acm(load_session)
    persist_cm = _acm(persist_session)

    if persist_fail:
        persist_cm.__aexit__ = AsyncMock(side_effect=RuntimeError("db down"))

    factory = MagicMock()
    factory.begin = MagicMock(side_effect=[load_cm, persist_cm])
    return factory


def _make_situation_with_picture(
    situation_id: object,
    picture_id: object,
    image_prompt: str = "A sunny Greek village square",
    picture_status: PictureStatus = PictureStatus.DRAFT,
    image_s3_key: str | None = None,
) -> MagicMock:
    """Build a mock Situation with an attached SituationPicture."""
    mock_picture = MagicMock()
    mock_picture.id = picture_id
    mock_picture.image_prompt = image_prompt
    mock_picture.status = picture_status
    mock_picture.image_s3_key = image_s3_key

    mock_situation = MagicMock()
    mock_situation.id = situation_id
    mock_situation.picture = mock_picture

    return mock_situation


# ---------------------------------------------------------------------------
# Pre-stream gate tests (call generate_picture_stream directly)
# ---------------------------------------------------------------------------


class TestPictureStreamAuth:
    """Auth/authz tests — call endpoint directly, no DB needed."""

    @pytest.mark.asyncio
    async def test_unauthenticated(self) -> None:
        """Unauthenticated request returns auth_required error event."""
        from src.api.v1.admin import generate_picture_stream

        sse_auth = _make_unauth()
        response = await generate_picture_stream(
            situation_id=uuid4(),
            sse_auth=sse_auth,
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["code"] == "auth_required"

    @pytest.mark.asyncio
    async def test_forbidden_non_superuser(self) -> None:
        """Non-superuser request returns forbidden error event."""
        from src.api.v1.admin import generate_picture_stream

        sse_auth = _make_non_superuser_auth()
        response = await generate_picture_stream(
            situation_id=uuid4(),
            sse_auth=sse_auth,
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert any(e["data"].get("code") == "forbidden" for e in error_events)

    @pytest.mark.asyncio
    async def test_openrouter_not_configured(self) -> None:
        """Returns service_unavailable when OpenRouter is not configured."""
        from src.api.v1.admin import generate_picture_stream

        sse_auth = _make_superuser_auth()
        with patch("src.api.v1.admin.settings") as mock_settings:
            mock_settings.openrouter_configured = False
            response = await generate_picture_stream(
                situation_id=uuid4(),
                sse_auth=sse_auth,
            )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert any(e["data"].get("code") == "service_unavailable" for e in error_events)


# ---------------------------------------------------------------------------
# Pipeline tests (call _picture_sse_pipeline directly)
# ---------------------------------------------------------------------------


class TestPictureSSEPipeline:
    """Pipeline tests — mock session factory, openrouter_service, and s3_service."""

    @pytest.mark.asyncio
    async def test_happy_path(self) -> None:
        """Full event sequence with all expected events in order."""
        from src.api.v1.admin import _picture_sse_pipeline

        situation_id = uuid4()
        picture_id = uuid4()
        s3_key = f"situation-pictures/{picture_id}.png"

        situation = _make_situation_with_picture(situation_id, picture_id)
        persist_picture = MagicMock()
        persist_picture.id = picture_id

        mock_factory = _make_factory(situation, persist_picture)
        mock_openrouter = _make_openrouter_service_mock(picture_id)
        mock_s3 = _make_s3_service_mock(upload_success=True, picture_id=picture_id)

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch("src.api.v1.admin.get_openrouter_service", return_value=mock_openrouter),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
        ):
            events = await _collect_generator(_picture_sse_pipeline(situation_id))

        event_types = [e["event"] for e in events]
        assert "connected" in event_types
        assert "picture:start" in event_types
        assert "picture:generate" in event_types
        assert "picture:upload" in event_types
        assert "picture:persist" in event_types
        assert "picture:complete" in event_types
        assert "picture:error" not in event_types

        # Verify event ordering
        assert event_types.index("connected") < event_types.index("picture:start")
        assert event_types.index("picture:start") < event_types.index("picture:generate")
        assert event_types.index("picture:generate") < event_types.index("picture:upload")
        assert event_types.index("picture:upload") < event_types.index("picture:persist")
        assert event_types.index("picture:persist") < event_types.index("picture:complete")

        # Verify S3 upload called with correct args
        mock_s3.upload_object.assert_called_once_with(
            s3_key=s3_key,
            data=PNG_BYTES,
            content_type="image/png",
        )

        # Verify picture:complete carries presigned URL
        complete_events = [e for e in events if e["event"] == "picture:complete"]
        assert len(complete_events) == 1
        assert complete_events[0]["data"]["image_url"] == f"https://cdn.example.com/{s3_key}"
        assert complete_events[0]["data"]["s3_key"] == s3_key

        # Verify persist was called (second factory.begin() call)
        assert mock_factory.begin.call_count == 2

    @pytest.mark.asyncio
    async def test_situation_not_found(self) -> None:
        """Situation not found returns picture:error stage=load, no S3 calls."""
        from src.api.v1.admin import _picture_sse_pipeline

        situation_id = uuid4()
        # scalar_one_or_none returns None → load raises PictureLoadError
        mock_factory = _make_factory(situation=None)
        mock_s3 = _make_s3_service_mock()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch("src.api.v1.admin.get_openrouter_service", return_value=MagicMock()),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
        ):
            events = await _collect_generator(_picture_sse_pipeline(situation_id))

        error_events = [e for e in events if e["event"] == "picture:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "load"

        mock_s3.upload_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_picture_not_found(self) -> None:
        """Situation exists but has no picture row → picture:error stage=load."""
        from src.api.v1.admin import _picture_sse_pipeline

        situation_id = uuid4()
        mock_situation = MagicMock()
        mock_situation.id = situation_id
        mock_situation.picture = None  # No picture row

        mock_factory = _make_factory(situation=mock_situation)
        mock_s3 = _make_s3_service_mock()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch("src.api.v1.admin.get_openrouter_service", return_value=MagicMock()),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
        ):
            events = await _collect_generator(_picture_sse_pipeline(situation_id))

        error_events = [e for e in events if e["event"] == "picture:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "load"

        mock_s3.upload_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_empty_image_prompt(self) -> None:
        """Empty/whitespace image_prompt → picture:error stage=load."""
        from src.api.v1.admin import _picture_sse_pipeline

        situation_id = uuid4()
        picture_id = uuid4()

        situation = _make_situation_with_picture(situation_id, picture_id, image_prompt="   ")
        mock_factory = _make_factory(situation=situation)
        mock_s3 = _make_s3_service_mock()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch("src.api.v1.admin.get_openrouter_service", return_value=MagicMock()),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
        ):
            events = await _collect_generator(_picture_sse_pipeline(situation_id))

        error_events = [e for e in events if e["event"] == "picture:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "load"

        mock_s3.upload_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_regenerate(self) -> None:
        """Regenerate: pre-seeded GENERATED picture gets S3 upload called again."""
        from src.api.v1.admin import _picture_sse_pipeline

        situation_id = uuid4()
        picture_id = uuid4()
        existing_key = f"situation-pictures/{picture_id}.png"

        situation = _make_situation_with_picture(
            situation_id,
            picture_id,
            picture_status=PictureStatus.GENERATED,
            image_s3_key=existing_key,
        )
        persist_picture = MagicMock()
        persist_picture.id = picture_id
        persist_picture.status = PictureStatus.GENERATED
        persist_picture.image_s3_key = existing_key

        mock_factory = _make_factory(situation, persist_picture)
        mock_openrouter = _make_openrouter_service_mock(picture_id)
        mock_s3 = _make_s3_service_mock(upload_success=True, picture_id=picture_id)

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch("src.api.v1.admin.get_openrouter_service", return_value=mock_openrouter),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
        ):
            events = await _collect_generator(_picture_sse_pipeline(situation_id))

        event_types = [e["event"] for e in events]
        assert "picture:complete" in event_types
        assert "picture:error" not in event_types

        # S3 upload was still called with the canonical key (idempotent overwrite)
        mock_s3.upload_object.assert_called_once_with(
            s3_key=existing_key,
            data=PNG_BYTES,
            content_type="image/png",
        )

        # Both DB calls happened
        assert mock_factory.begin.call_count == 2

    @pytest.mark.asyncio
    async def test_openrouter_no_image_refusal(self) -> None:
        """OpenRouter refuses to generate image → picture:error stage=generate, no S3."""
        from src.api.v1.admin import _picture_sse_pipeline

        situation_id = uuid4()
        picture_id = uuid4()

        situation = _make_situation_with_picture(situation_id, picture_id)
        mock_factory = _make_factory(situation)
        mock_s3 = _make_s3_service_mock()

        mock_openrouter = MagicMock()
        mock_openrouter.generate_image = AsyncMock(
            side_effect=OpenRouterNoImageError("content policy violation")
        )

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch("src.api.v1.admin.get_openrouter_service", return_value=mock_openrouter),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
        ):
            events = await _collect_generator(_picture_sse_pipeline(situation_id))

        error_events = [e for e in events if e["event"] == "picture:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "generate"

        mock_s3.upload_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_s3_upload_failure(self) -> None:
        """S3 upload returns False → picture:error stage=upload, picture untouched."""
        from src.api.v1.admin import _picture_sse_pipeline

        situation_id = uuid4()
        picture_id = uuid4()

        situation = _make_situation_with_picture(situation_id, picture_id)
        mock_factory = _make_factory(situation)
        mock_openrouter = _make_openrouter_service_mock(picture_id)
        mock_s3 = _make_s3_service_mock(upload_success=False)

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch("src.api.v1.admin.get_openrouter_service", return_value=mock_openrouter),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
        ):
            events = await _collect_generator(_picture_sse_pipeline(situation_id))

        error_events = [e for e in events if e["event"] == "picture:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "upload"

        # Upload was attempted but returned False
        mock_s3.upload_object.assert_called_once()
        # Persist was never reached (only 1 factory.begin call for load)
        assert mock_factory.begin.call_count == 1

    @pytest.mark.asyncio
    async def test_persist_failure_logs_orphaned_key(self) -> None:
        """Persist DB failure → picture:error stage=persist + orphaned-key log."""
        from io import StringIO

        from loguru import logger

        from src.api.v1.admin import _picture_sse_pipeline

        situation_id = uuid4()
        picture_id = uuid4()
        s3_key = f"situation-pictures/{picture_id}.png"

        situation = _make_situation_with_picture(situation_id, picture_id)
        persist_picture = MagicMock()
        persist_picture.id = picture_id

        mock_factory = _make_factory(situation, persist_picture, persist_fail=True)
        mock_openrouter = _make_openrouter_service_mock(picture_id)
        mock_s3 = _make_s3_service_mock(upload_success=True, picture_id=picture_id)

        log_output = StringIO()
        handler_id = logger.add(log_output, format="{level} {message} {extra}", level="ERROR")
        try:
            with (
                patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
                patch("src.api.v1.admin.get_openrouter_service", return_value=mock_openrouter),
                patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
            ):
                events = await _collect_generator(_picture_sse_pipeline(situation_id))
        finally:
            logger.remove(handler_id)

        error_events = [e for e in events if e["event"] == "picture:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "persist"

        # Verify orphaned-key log was emitted
        captured = log_output.getvalue()
        assert "Orphaned S3 key after picture persist failure" in captured
        assert str(picture_id) in captured
        assert s3_key in captured
