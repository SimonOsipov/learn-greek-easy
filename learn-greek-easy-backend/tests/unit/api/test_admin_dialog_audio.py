"""Tests for POST /api/v1/admin/listening-dialogs/{id}/generate-audio/stream SSE endpoint."""

from __future__ import annotations

import base64
import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import SSEAuthResult
from src.core.exceptions import ElevenLabsAPIError
from src.db.models import DeckLevel, DialogLine, DialogSpeaker, DialogStatus, ListeningDialog


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


def _make_superuser_auth() -> SSEAuthResult:
    mock_user = MagicMock()
    mock_user.is_superuser = True
    mock_user.id = uuid4()
    return SSEAuthResult(user=mock_user)


def _make_elevenlabs_response(num_lines: int = 3) -> dict:
    """Build a realistic ElevenLabs response for num_lines dialog lines."""
    segments = []
    for i in range(num_lines):
        segments.append(
            {
                "dialogue_input_index": i,
                "start_time_seconds": float(i * 1.5),
                "end_time_seconds": float((i + 1) * 1.5),
            }
        )
    return {
        "audio_base64": base64.b64encode(b"fake-mp3-bytes").decode(),
        "voice_segments": segments,
    }


def _make_session_factory_mock(db_session: AsyncSession) -> MagicMock:
    """Create a mock session factory that yields db_session from factory.begin()."""
    mock_begin_cm = MagicMock()
    mock_begin_cm.__aenter__ = AsyncMock(return_value=db_session)
    mock_begin_cm.__aexit__ = AsyncMock(return_value=False)

    mock_factory = MagicMock()
    mock_factory.begin.return_value = mock_begin_cm
    return mock_factory


class TestDialogAudioStreamAuth:
    """Auth/authz tests — call endpoint directly, no DB needed."""

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_auth_required(self) -> None:
        """Unauthenticated request returns auth_required error event."""
        from src.api.v1.admin import generate_dialog_audio_stream

        sse_auth = SSEAuthResult(error_code="auth_required", error_message="Auth required")
        response = await generate_dialog_audio_stream(
            dialog_id=uuid4(),
            sse_auth=sse_auth,
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["code"] == "auth_required"

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_non_admin(self) -> None:
        """Non-superuser request returns forbidden error event."""
        from src.api.v1.admin import generate_dialog_audio_stream

        mock_user = MagicMock()
        mock_user.is_superuser = False
        sse_auth = SSEAuthResult(user=mock_user)

        response = await generate_dialog_audio_stream(
            dialog_id=uuid4(),
            sse_auth=sse_auth,
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert any(e["data"].get("code") == "forbidden" for e in error_events)

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_elevenlabs_not_configured(self) -> None:
        """Returns service_unavailable when ElevenLabs is not configured."""
        from src.api.v1.admin import generate_dialog_audio_stream

        sse_auth = _make_superuser_auth()
        with patch("src.api.v1.admin.settings") as mock_settings:
            mock_settings.elevenlabs_configured = False
            response = await generate_dialog_audio_stream(
                dialog_id=uuid4(),
                sse_auth=sse_auth,
            )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert any(e["data"].get("code") == "service_unavailable" for e in error_events)


class TestDialogAudioStreamPipeline:
    """Pipeline tests — use db_session for DB setup, mock external services."""

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_happy_path(self, db_session: AsyncSession) -> None:
        """Full pipeline: dialog + 2 speakers + 3 lines → all 6 stage events + DB updated."""
        from src.api.v1.admin import generate_dialog_audio_stream

        # Create dialog
        dialog = ListeningDialog(
            scenario_el="Μια συνομιλία",
            scenario_en="A conversation",
            scenario_ru="Разговор",
            cefr_level=DeckLevel.B1,
            status=DialogStatus.DRAFT,
            num_speakers=2,
        )
        db_session.add(dialog)
        await db_session.flush()

        # Create 2 speakers
        speaker_a = DialogSpeaker(
            dialog_id=dialog.id,
            speaker_index=0,
            character_name="Άρης",
            voice_id="voice-abc",
        )
        speaker_b = DialogSpeaker(
            dialog_id=dialog.id,
            speaker_index=1,
            character_name="Μαρία",
            voice_id="voice-xyz",
        )
        db_session.add_all([speaker_a, speaker_b])
        await db_session.flush()

        # Create 3 lines alternating speakers
        lines = [
            DialogLine(
                dialog_id=dialog.id, speaker_id=speaker_a.id, line_index=0, text="Γεια σας!"
            ),
            DialogLine(
                dialog_id=dialog.id, speaker_id=speaker_b.id, line_index=1, text="Γεια σου!"
            ),
            DialogLine(
                dialog_id=dialog.id, speaker_id=speaker_a.id, line_index=2, text="Πώς είστε;"
            ),
        ]
        db_session.add_all(lines)
        await db_session.flush()

        elevenlabs_response = _make_elevenlabs_response(num_lines=3)
        mock_factory = _make_session_factory_mock(db_session)

        mock_elevenlabs = MagicMock()
        mock_elevenlabs.generate_dialog_audio = AsyncMock(return_value=elevenlabs_response)

        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
            patch("src.api.v1.admin.settings") as mock_settings,
        ):
            mock_settings.elevenlabs_configured = True
            response = await generate_dialog_audio_stream(
                dialog_id=dialog.id,
                sse_auth=sse_auth,
            )
            events = await _collect_stream(response)

        # Verify event sequence (connected has empty data so _parse_sse_text skips it)
        event_types = [e["event"] for e in events]
        assert "dialog_audio:start" in event_types
        assert "dialog_audio:elevenlabs" in event_types
        assert "dialog_audio:upload" in event_types
        assert "dialog_audio:timing" in event_types
        assert "dialog_audio:complete" in event_types
        assert "dialog_audio:error" not in event_types

        # Verify DB state was updated
        await db_session.refresh(dialog)
        assert dialog.status == DialogStatus.AUDIO_READY
        assert dialog.audio_s3_key is not None
        assert dialog.audio_duration_seconds is not None
        assert dialog.audio_duration_seconds > 0
        assert dialog.audio_generated_at is not None

        for line in lines:
            await db_session.refresh(line)
            assert line.start_time_ms is not None
            assert line.end_time_ms is not None
            assert line.start_time_ms < line.end_time_ms

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_not_found(self, db_session: AsyncSession) -> None:
        """Random UUID returns dialog_audio:error with stage=load."""
        from src.api.v1.admin import generate_dialog_audio_stream

        mock_factory = _make_session_factory_mock(db_session)
        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch("src.api.v1.admin.settings") as mock_settings,
        ):
            mock_settings.elevenlabs_configured = True
            response = await generate_dialog_audio_stream(
                dialog_id=uuid4(),
                sse_auth=sse_auth,
            )
            events = await _collect_stream(response)

        error_events = [e for e in events if e.get("event") == "dialog_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "load"

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_wrong_status(self, db_session: AsyncSession) -> None:
        """Dialog with status=audio_ready returns error with stage=load."""
        from src.api.v1.admin import generate_dialog_audio_stream

        dialog = ListeningDialog(
            scenario_el="Μια συνομιλία",
            scenario_en="A conversation",
            scenario_ru="Разговор",
            cefr_level=DeckLevel.B1,
            status=DialogStatus.AUDIO_READY,
            num_speakers=2,
        )
        db_session.add(dialog)
        await db_session.flush()

        mock_factory = _make_session_factory_mock(db_session)
        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch("src.api.v1.admin.settings") as mock_settings,
        ):
            mock_settings.elevenlabs_configured = True
            response = await generate_dialog_audio_stream(
                dialog_id=dialog.id,
                sse_auth=sse_auth,
            )
            events = await _collect_stream(response)

        error_events = [e for e in events if e.get("event") == "dialog_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "load"

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_elevenlabs_error(self, db_session: AsyncSession) -> None:
        """ElevenLabsAPIError from generate_dialog_audio → error event with stage=elevenlabs, dialog stays DRAFT."""
        from src.api.v1.admin import generate_dialog_audio_stream

        dialog = ListeningDialog(
            scenario_el="Μια συνομιλία",
            scenario_en="A conversation",
            scenario_ru="Разговор",
            cefr_level=DeckLevel.B1,
            status=DialogStatus.DRAFT,
            num_speakers=2,
        )
        db_session.add(dialog)
        await db_session.flush()

        speaker = DialogSpeaker(
            dialog_id=dialog.id, speaker_index=0, character_name="Alex", voice_id="v-1"
        )
        db_session.add(speaker)
        await db_session.flush()

        line = DialogLine(dialog_id=dialog.id, speaker_id=speaker.id, line_index=0, text="Hello")
        db_session.add(line)
        await db_session.flush()

        mock_factory = _make_session_factory_mock(db_session)
        mock_elevenlabs = MagicMock()
        mock_elevenlabs.generate_dialog_audio = AsyncMock(
            side_effect=ElevenLabsAPIError(status_code=500, detail="Service error")
        )
        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.api.v1.admin.settings") as mock_settings,
        ):
            mock_settings.elevenlabs_configured = True
            response = await generate_dialog_audio_stream(
                dialog_id=dialog.id,
                sse_auth=sse_auth,
            )
            events = await _collect_stream(response)

        error_events = [e for e in events if e.get("event") == "dialog_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "elevenlabs"

        await db_session.refresh(dialog)
        assert dialog.status == DialogStatus.DRAFT

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_s3_upload_failure(self, db_session: AsyncSession) -> None:
        """S3 upload failure → error event with stage=upload, dialog stays DRAFT."""
        from src.api.v1.admin import generate_dialog_audio_stream

        dialog = ListeningDialog(
            scenario_el="Μια συνομιλία",
            scenario_en="A conversation",
            scenario_ru="Разговор",
            cefr_level=DeckLevel.B1,
            status=DialogStatus.DRAFT,
            num_speakers=2,
        )
        db_session.add(dialog)
        await db_session.flush()

        speaker = DialogSpeaker(
            dialog_id=dialog.id, speaker_index=0, character_name="Alex", voice_id="v-1"
        )
        db_session.add(speaker)
        await db_session.flush()

        line = DialogLine(dialog_id=dialog.id, speaker_id=speaker.id, line_index=0, text="Hello")
        db_session.add(line)
        await db_session.flush()

        mock_factory = _make_session_factory_mock(db_session)
        mock_elevenlabs = MagicMock()
        mock_elevenlabs.generate_dialog_audio = AsyncMock(return_value=_make_elevenlabs_response(1))
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=False)
        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
            patch("src.api.v1.admin.settings") as mock_settings,
        ):
            mock_settings.elevenlabs_configured = True
            response = await generate_dialog_audio_stream(
                dialog_id=dialog.id,
                sse_auth=sse_auth,
            )
            events = await _collect_stream(response)

        error_events = [e for e in events if e.get("event") == "dialog_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "upload"

        await db_session.refresh(dialog)
        assert dialog.status == DialogStatus.DRAFT

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_missing_segments(self, db_session: AsyncSession) -> None:
        """ElevenLabs response without voice_segments → error with stage=timing."""
        from src.api.v1.admin import generate_dialog_audio_stream

        dialog = ListeningDialog(
            scenario_el="Μια συνομιλία",
            scenario_en="A conversation",
            scenario_ru="Разговор",
            cefr_level=DeckLevel.B1,
            status=DialogStatus.DRAFT,
            num_speakers=2,
        )
        db_session.add(dialog)
        await db_session.flush()

        speaker = DialogSpeaker(
            dialog_id=dialog.id, speaker_index=0, character_name="Alex", voice_id="v-1"
        )
        db_session.add(speaker)
        await db_session.flush()

        line = DialogLine(dialog_id=dialog.id, speaker_id=speaker.id, line_index=0, text="Hello")
        db_session.add(line)
        await db_session.flush()

        # Response missing voice_segments
        bad_response = {"audio_base64": base64.b64encode(b"fake").decode()}

        mock_factory = _make_session_factory_mock(db_session)
        mock_elevenlabs = MagicMock()
        mock_elevenlabs.generate_dialog_audio = AsyncMock(return_value=bad_response)
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)
        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
            patch("src.api.v1.admin.settings") as mock_settings,
        ):
            mock_settings.elevenlabs_configured = True
            response = await generate_dialog_audio_stream(
                dialog_id=dialog.id,
                sse_auth=sse_auth,
            )
            events = await _collect_stream(response)

        error_events = [e for e in events if e.get("event") == "dialog_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "timing"
