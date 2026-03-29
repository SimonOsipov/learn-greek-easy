"""Tests for POST /api/v1/admin/situations/{id}/description-audio/stream SSE endpoint."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.core.dependencies import SSEAuthResult
from src.services.audio_generation_service import AudioWithTimestampsResult


def _parse_sse_text(text: str) -> list[dict]:
    events = []
    for block in text.split("\n\n"):
        block = block.strip()
        if not block or block.startswith(":") or block.startswith("retry:"):
            continue
        etype, data_str = None, None
        for line in block.split("\n"):
            if line.startswith("event:"):
                etype = line[6:].strip()
            elif line.startswith("data:"):
                data_str = line[5:].strip()
        if data_str:
            try:
                data = json.loads(data_str)
            except json.JSONDecodeError:
                data = data_str
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


def _make_description_mock(
    situation_id,
    description_id=None,
    text_el: str = "Το σπίτι είναι μεγάλο.",
    text_el_a2: str | None = "Μικρό σπίτι.",
) -> MagicMock:
    mock = MagicMock()
    mock.id = description_id or uuid4()
    mock.situation_id = situation_id
    mock.text_el = text_el
    mock.text_el_a2 = text_el_a2
    return mock


def _make_audio_result(description_id, level: str = "b1") -> AudioWithTimestampsResult:
    s3_key = (
        f"situation-description-audio/{description_id}.mp3"
        if level == "b1"
        else f"situation-description-audio/a2/{description_id}.mp3"
    )
    return AudioWithTimestampsResult(
        audio_bytes=b"fake-mp3",
        s3_key=s3_key,
        duration_seconds=2.0,
        file_size_bytes=8,
        word_timestamps=[{"word": "hello", "start_ms": 0, "end_ms": 500}],
    )


def _make_session_factory_mock(description: MagicMock | None = None) -> MagicMock:
    """Create a mock session factory.

    First begin() call: SELECT for SituationDescription.
    Second begin() call: UPDATE after audio generation.
    """
    call_count = 0

    def begin_side_effect():
        nonlocal call_count
        call_count += 1
        session = MagicMock()

        if call_count == 1:
            result_mock = MagicMock()
            result_mock.scalar_one_or_none.return_value = description
            session.execute = AsyncMock(return_value=result_mock)
        else:
            session.execute = AsyncMock(return_value=MagicMock())

        cm = MagicMock()
        cm.__aenter__ = AsyncMock(return_value=session)
        cm.__aexit__ = AsyncMock(return_value=False)
        return cm

    mock_factory = MagicMock()
    mock_factory.begin.side_effect = begin_side_effect
    return mock_factory


def _make_session_factory_not_found() -> MagicMock:
    """Factory where DB returns None (description not found)."""
    session = MagicMock()
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=result_mock)

    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=session)
    cm.__aexit__ = AsyncMock(return_value=False)

    mock_factory = MagicMock()
    mock_factory.begin.return_value = cm
    return mock_factory


class TestDescriptionAudioStreamAuth:
    """Auth/authz tests — call endpoint directly, no DB needed."""

    @pytest.mark.asyncio
    async def test_unauthenticated(self) -> None:
        """Unauthenticated request returns auth_required error event."""
        from src.api.v1.admin import generate_description_audio_stream

        sse_auth = _make_unauth()
        response = await generate_description_audio_stream(
            situation_id=uuid4(),
            level="b1",
            sse_auth=sse_auth,
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["code"] == "auth_required"

    @pytest.mark.asyncio
    async def test_forbidden_non_superuser(self) -> None:
        """Non-superuser request returns forbidden error event."""
        from src.api.v1.admin import generate_description_audio_stream

        sse_auth = _make_non_superuser_auth()
        response = await generate_description_audio_stream(
            situation_id=uuid4(),
            level="b1",
            sse_auth=sse_auth,
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert any(e["data"].get("code") == "forbidden" for e in error_events)

    @pytest.mark.asyncio
    async def test_elevenlabs_not_configured(self) -> None:
        """Returns service_unavailable when ElevenLabs is not configured."""
        from src.api.v1.admin import generate_description_audio_stream

        sse_auth = _make_superuser_auth()
        with patch("src.api.v1.admin.settings") as mock_settings:
            mock_settings.elevenlabs_configured = False
            response = await generate_description_audio_stream(
                situation_id=uuid4(),
                level="b1",
                sse_auth=sse_auth,
            )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert any(e["data"].get("code") == "service_unavailable" for e in error_events)


class TestDescriptionAudioSSEPipeline:
    """Pipeline tests — mock session factory and audio_generation_service."""

    @pytest.mark.asyncio
    async def test_b1_happy_path(self) -> None:
        """B1 level generates audio and persists with correct fields."""
        from src.api.v1.admin import _description_audio_sse_pipeline

        situation_id = uuid4()
        description_id = uuid4()
        description = _make_description_mock(situation_id, description_id)
        mock_factory = _make_session_factory_mock(description)

        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(
            return_value=_make_audio_result(description_id, level="b1")
        )
        mock_audio_service.generate_presigned_url = MagicMock(
            return_value="https://cdn.example.com/audio.mp3"
        )

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_description_audio_sse_pipeline(situation_id, "b1"))

        event_types = [e["event"] for e in events]
        assert "description_audio:start" in event_types
        assert "description_audio:tts" in event_types
        assert "description_audio:alignment" in event_types
        assert "description_audio:upload" in event_types
        assert "description_audio:persist" in event_types
        assert "description_audio:complete" in event_types
        assert "description_audio:error" not in event_types

        start_events = [e for e in events if e["event"] == "description_audio:start"]
        assert start_events[0]["data"]["level"] == "b1"

        complete_events = [e for e in events if e["event"] == "description_audio:complete"]
        assert complete_events[0]["data"]["level"] == "b1"
        assert complete_events[0]["data"]["duration_seconds"] == 2.0
        assert complete_events[0]["data"]["audio_url"] == "https://cdn.example.com/audio.mp3"

        # Verify generate_single called with correct args
        call_kwargs = mock_audio_service.generate_single.call_args
        assert call_kwargs.kwargs["s3_key"] == f"situation-description-audio/{description_id}.mp3"
        assert call_kwargs.kwargs["with_timestamps"] is True

    @pytest.mark.asyncio
    async def test_a2_happy_path(self) -> None:
        """A2 level generates audio and persists with a2-prefixed fields."""
        from src.api.v1.admin import _description_audio_sse_pipeline

        situation_id = uuid4()
        description_id = uuid4()
        description = _make_description_mock(situation_id, description_id)
        mock_factory = _make_session_factory_mock(description)

        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(
            return_value=_make_audio_result(description_id, level="a2")
        )
        mock_audio_service.generate_presigned_url = MagicMock(
            return_value="https://cdn.example.com/audio-a2.mp3"
        )

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_description_audio_sse_pipeline(situation_id, "a2"))

        event_types = [e["event"] for e in events]
        assert "description_audio:start" in event_types
        assert "description_audio:complete" in event_types
        assert "description_audio:error" not in event_types

        start_events = [e for e in events if e["event"] == "description_audio:start"]
        assert start_events[0]["data"]["level"] == "a2"

        complete_events = [e for e in events if e["event"] == "description_audio:complete"]
        assert complete_events[0]["data"]["level"] == "a2"

        # Verify a2 s3_key and with_timestamps=True were used
        call_kwargs = mock_audio_service.generate_single.call_args
        assert (
            call_kwargs.kwargs["s3_key"] == f"situation-description-audio/a2/{description_id}.mp3"
        )
        assert call_kwargs.kwargs["with_timestamps"] is True

    @pytest.mark.asyncio
    async def test_invalid_level(self) -> None:
        """Invalid level returns error event with stage=load without hitting the DB."""
        from src.api.v1.admin import _description_audio_sse_pipeline

        situation_id = uuid4()
        mock_factory = MagicMock()

        with patch("src.api.v1.admin.get_session_factory", return_value=mock_factory):
            events = await _collect_generator(_description_audio_sse_pipeline(situation_id, "c1"))

        error_events = [e for e in events if e["event"] == "description_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "load"
        assert "c1" in error_events[0]["data"]["error"]

        # Should not have started
        assert "description_audio:start" not in [e["event"] for e in events]
        # Should not have touched the DB
        mock_factory.begin.assert_not_called()

    @pytest.mark.asyncio
    async def test_no_description(self) -> None:
        """DB returns None for description — error event with stage=load."""
        from src.api.v1.admin import _description_audio_sse_pipeline

        situation_id = uuid4()
        mock_factory = _make_session_factory_not_found()

        with patch("src.api.v1.admin.get_session_factory", return_value=mock_factory):
            events = await _collect_generator(_description_audio_sse_pipeline(situation_id, "b1"))

        error_events = [e for e in events if e["event"] == "description_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "load"
        assert "No description" in error_events[0]["data"]["error"]

        assert "description_audio:start" not in [e["event"] for e in events]

    @pytest.mark.asyncio
    async def test_no_text_for_level(self) -> None:
        """Empty text_el_a2 for a2 level returns error event with stage=load."""
        from src.api.v1.admin import _description_audio_sse_pipeline

        situation_id = uuid4()
        description_id = uuid4()
        description = _make_description_mock(situation_id, description_id, text_el_a2=None)
        mock_factory = _make_session_factory_mock(description)

        with patch("src.api.v1.admin.get_session_factory", return_value=mock_factory):
            events = await _collect_generator(_description_audio_sse_pipeline(situation_id, "a2"))

        error_events = [e for e in events if e["event"] == "description_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "load"
        assert "a2" in error_events[0]["data"]["error"]

        assert "description_audio:start" not in [e["event"] for e in events]

    @pytest.mark.asyncio
    async def test_regenerate_overwrites_existing_audio(self) -> None:
        """Existing audio_s3_key is overwritten when regenerating."""
        from src.api.v1.admin import _description_audio_sse_pipeline

        situation_id = uuid4()
        description_id = uuid4()
        # Description already has existing b1 audio
        description = _make_description_mock(situation_id, description_id)
        description.audio_s3_key = f"situation-description-audio/{description_id}-old.mp3"
        description.audio_duration_seconds = 1.0
        description.word_timestamps = []

        mock_factory = _make_session_factory_mock(description)

        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(
            return_value=_make_audio_result(description_id, level="b1")
        )
        mock_audio_service.generate_presigned_url = MagicMock(
            return_value="https://cdn.example.com/audio-new.mp3"
        )

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_description_audio_sse_pipeline(situation_id, "b1"))

        event_types = [e["event"] for e in events]
        assert "description_audio:complete" in event_types
        assert "description_audio:error" not in event_types

        complete_events = [e for e in events if e["event"] == "description_audio:complete"]
        assert complete_events[0]["data"]["audio_url"] == "https://cdn.example.com/audio-new.mp3"

        # The UPDATE should have been called (second factory.begin() call)
        assert mock_factory.begin.call_count == 2
