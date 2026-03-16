"""Tests for POST /api/v1/admin/listening-dialogs/{id}/generate-audio/stream SSE endpoint."""

from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import SSEAuthResult
from src.core.exceptions import ElevenLabsAPIError
from src.db.models import (
    DeckLevel,
    DialogExercise,
    DialogLine,
    DialogSpeaker,
    DialogStatus,
    ExerciseItem,
    ExerciseStatus,
    ExerciseType,
    ListeningDialog,
    Situation,
)


async def _create_situation(db_session: AsyncSession) -> Situation:
    """Create and flush a minimal Situation for tests that build ListeningDialog directly."""
    situation = Situation(
        scenario_el="Ελληνικό σενάριο",
        scenario_en="English scenario",
        scenario_ru="Русский сценарий",
        cefr_level=DeckLevel.B1,
    )
    db_session.add(situation)
    await db_session.flush()
    return situation


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
    all_chars: list[str] = []
    all_starts: list[float] = []
    all_ends: list[float] = []
    char_offset = 0

    for i in range(num_lines):
        text = f"word{i} test"
        seg_start = float(i * 1.5)
        seg_end = float((i + 1) * 1.5)
        seg_chars = list(text)
        for j, ch in enumerate(seg_chars):
            all_chars.append(ch)
            t = seg_start + j * 0.05
            all_starts.append(t)
            all_ends.append(t + 0.049)
        segments.append(
            {
                "dialogue_input_index": i,
                "start_time_seconds": seg_start,
                "end_time_seconds": seg_end,
                "character_start_index": char_offset,
                "character_end_index": char_offset + len(seg_chars),
            }
        )
        char_offset += len(seg_chars)

    return {
        "audio_base64": base64.b64encode(b"fake-mp3-bytes").decode(),
        "voice_segments": segments,
        "alignment": {
            "characters": all_chars,
            "character_start_times_seconds": all_starts,
            "character_end_times_seconds": all_ends,
        },
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
        situation = await _create_situation(db_session)
        dialog = ListeningDialog(
            scenario_el="Μια συνομιλία",
            scenario_en="A conversation",
            scenario_ru="Разговор",
            cefr_level=DeckLevel.B1,
            status=DialogStatus.DRAFT,
            situation_id=situation.id,
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

        mock_mp3_instance = MagicMock()
        mock_mp3_instance.info.length = 4.5  # matches last segment end_time_seconds for num_lines=3

        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
            patch("src.api.v1.admin.settings") as mock_settings,
            patch("mutagen.mp3.MP3", return_value=mock_mp3_instance),
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
            assert line.word_timestamps is not None
            assert isinstance(line.word_timestamps, list)
            assert len(line.word_timestamps) > 0

        complete_event = next(e for e in events if e["event"] == "dialog_audio:complete")
        assert complete_event["data"]["has_exercises"] is False

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_with_exercises(self, db_session: AsyncSession) -> None:
        """Pipeline sets exercises_ready status and has_exercises=True when exercises exist."""
        from src.api.v1.admin import generate_dialog_audio_stream

        # Create dialog
        situation = await _create_situation(db_session)
        dialog = ListeningDialog(
            scenario_el="Μια συνομιλία",
            scenario_en="A conversation",
            scenario_ru="Разговор",
            cefr_level=DeckLevel.B1,
            status=DialogStatus.DRAFT,
            situation_id=situation.id,
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

        # Create an exercise with at least one item for the dialog
        exercise = DialogExercise(
            dialog_id=dialog.id,
            exercise_type=ExerciseType.FILL_GAPS,
            status=ExerciseStatus.DRAFT,
        )
        db_session.add(exercise)
        await db_session.flush()
        db_session.add(
            ExerciseItem(
                exercise_id=exercise.id,
                item_index=0,
                payload={
                    "line_index": 0,
                    "correct_answer": "Γεια",
                    "options": ["Γεια", "Αντίο"],
                    "context_before": "",
                    "context_after": "σας!",
                },
            )
        )
        await db_session.flush()

        elevenlabs_response = _make_elevenlabs_response(num_lines=3)
        mock_factory = _make_session_factory_mock(db_session)

        mock_elevenlabs = MagicMock()
        mock_elevenlabs.generate_dialog_audio = AsyncMock(return_value=elevenlabs_response)

        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        mock_mp3_instance = MagicMock()
        mock_mp3_instance.info.length = 4.5  # matches last segment end_time_seconds for num_lines=3

        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
            patch("src.api.v1.admin.settings") as mock_settings,
            patch("mutagen.mp3.MP3", return_value=mock_mp3_instance),
        ):
            mock_settings.elevenlabs_configured = True
            response = await generate_dialog_audio_stream(
                dialog_id=dialog.id,
                sse_auth=sse_auth,
            )
            events = await _collect_stream(response)

        # Verify DB status is exercises_ready
        await db_session.refresh(dialog)
        assert dialog.status == DialogStatus.EXERCISES_READY

        # Verify SSE complete event has has_exercises=True
        complete_event = next(e for e in events if e["event"] == "dialog_audio:complete")
        assert complete_event["data"]["has_exercises"] is True

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_missing_alignment(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Pipeline succeeds and word_timestamps is null when alignment is missing."""
        from src.api.v1.admin import generate_dialog_audio_stream

        # Create dialog
        situation = await _create_situation(db_session)
        dialog = ListeningDialog(
            scenario_el="Μια συνομιλία",
            scenario_en="A conversation",
            scenario_ru="Разговор",
            cefr_level=DeckLevel.B1,
            status=DialogStatus.DRAFT,
            situation_id=situation.id,
            num_speakers=2,
        )
        db_session.add(dialog)
        await db_session.flush()

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

        lines = [
            DialogLine(dialog_id=dialog.id, speaker_id=speaker_a.id, line_index=0, text="Γεια"),
            DialogLine(dialog_id=dialog.id, speaker_id=speaker_b.id, line_index=1, text="Σου"),
        ]
        db_session.add_all(lines)
        await db_session.flush()

        response_no_alignment = _make_elevenlabs_response(num_lines=2)
        del response_no_alignment["alignment"]
        for seg in response_no_alignment["voice_segments"]:
            seg.pop("character_start_index", None)
            seg.pop("character_end_index", None)

        mock_factory = _make_session_factory_mock(db_session)
        mock_elevenlabs = MagicMock()
        mock_elevenlabs.generate_dialog_audio = AsyncMock(return_value=response_no_alignment)
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        mock_mp3_instance = MagicMock()
        mock_mp3_instance.info.length = 3.0  # matches last segment end_time_seconds for num_lines=2

        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
            patch("src.api.v1.admin.settings") as mock_settings,
            patch("mutagen.mp3.MP3", return_value=mock_mp3_instance),
        ):
            mock_settings.elevenlabs_configured = True
            response = await generate_dialog_audio_stream(
                dialog_id=dialog.id,
                sse_auth=sse_auth,
            )
            events = await _collect_stream(response)

        complete_events = [e for e in events if e.get("event") == "dialog_audio:complete"]
        assert len(complete_events) == 1

        for line in lines:
            await db_session.refresh(line)
            assert line.start_time_ms is not None
            assert line.end_time_ms is not None
            assert line.word_timestamps is None

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
        """Guard rejects dialog status not in _ALLOWED_AUDIO_GEN_STATUSES."""
        from src.api.v1.admin import generate_dialog_audio_stream

        situation = await _create_situation(db_session)
        dialog = ListeningDialog(
            scenario_el="Μια συνομιλία",
            scenario_en="A conversation",
            scenario_ru="Разговор",
            cefr_level=DeckLevel.B1,
            status=DialogStatus.AUDIO_READY,
            situation_id=situation.id,
            num_speakers=2,
        )
        db_session.add(dialog)
        await db_session.flush()

        mock_factory = _make_session_factory_mock(db_session)
        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch("src.api.v1.admin.settings") as mock_settings,
            patch("src.api.v1.admin._ALLOWED_AUDIO_GEN_STATUSES", {DialogStatus.DRAFT}),
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
    async def test_generate_dialog_audio_regeneration_audio_ready(
        self, db_session: AsyncSession
    ) -> None:
        """Re-generation works for audio_ready dialog — old audio fields are overwritten."""
        from src.api.v1.admin import generate_dialog_audio_stream

        old_s3_key = "dialog-audio/old-key.mp3"
        old_generated_at = datetime(2025, 1, 1, tzinfo=timezone.utc)

        situation = await _create_situation(db_session)
        dialog = ListeningDialog(
            scenario_el="Μια συνομιλία",
            scenario_en="A conversation",
            scenario_ru="Разговор",
            cefr_level=DeckLevel.B1,
            status=DialogStatus.AUDIO_READY,
            situation_id=situation.id,
            num_speakers=2,
            audio_s3_key=old_s3_key,
            audio_duration_seconds=5.0,
            audio_generated_at=old_generated_at,
            audio_file_size_bytes=1000,
        )
        db_session.add(dialog)
        await db_session.flush()

        speaker1 = DialogSpeaker(
            dialog_id=dialog.id,
            speaker_index=0,
            character_name="Speaker 1",
            voice_id="voice-abc",
        )
        speaker2 = DialogSpeaker(
            dialog_id=dialog.id,
            speaker_index=1,
            character_name="Speaker 2",
            voice_id="voice-xyz",
        )
        db_session.add_all([speaker1, speaker2])
        await db_session.flush()

        lines = [
            DialogLine(
                dialog_id=dialog.id,
                speaker_id=speaker1.id,
                line_index=i,
                text=f"Γεια {i}",
            )
            for i in range(3)
        ]
        db_session.add_all(lines)
        await db_session.flush()

        elevenlabs_response = _make_elevenlabs_response(num_lines=3)
        mock_factory = _make_session_factory_mock(db_session)

        mock_elevenlabs = MagicMock()
        mock_elevenlabs.generate_dialog_audio = AsyncMock(return_value=elevenlabs_response)

        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        mock_mp3_instance = MagicMock()
        mock_mp3_instance.info.length = 4.5  # matches last segment end_time_seconds for num_lines=3

        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
            patch("src.api.v1.admin.settings") as mock_settings,
            patch("mutagen.mp3.MP3", return_value=mock_mp3_instance),
        ):
            mock_settings.elevenlabs_configured = True
            mock_settings.aws_s3_bucket = "test-bucket"
            mock_settings.aws_s3_prefix = "dialog-audio"
            response = await generate_dialog_audio_stream(
                dialog_id=dialog.id,
                sse_auth=sse_auth,
            )
            events = await _collect_stream(response)

        error_events = [e for e in events if e.get("event") == "dialog_audio:error"]
        assert error_events == [], f"Unexpected errors: {error_events}"

        complete_events = [e for e in events if e.get("event") == "dialog_audio:complete"]
        assert len(complete_events) == 1

        await db_session.refresh(dialog)
        assert dialog.audio_s3_key != old_s3_key
        assert dialog.audio_generated_at is not None
        assert dialog.audio_generated_at > old_generated_at
        assert dialog.audio_duration_seconds is not None
        assert dialog.audio_duration_seconds > 0
        assert dialog.status == DialogStatus.AUDIO_READY

        for line in lines:
            await db_session.refresh(line)
            assert line.start_time_ms is not None
            assert line.end_time_ms is not None

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_regeneration_exercises_ready(
        self, db_session: AsyncSession
    ) -> None:
        """Re-generation works for exercises_ready dialog — status is not downgraded after regeneration."""
        from src.api.v1.admin import generate_dialog_audio_stream

        old_s3_key = "dialog-audio/old-key.mp3"
        old_generated_at = datetime(2025, 1, 1, tzinfo=timezone.utc)

        situation = await _create_situation(db_session)
        dialog = ListeningDialog(
            scenario_el="Μια συνομιλία",
            scenario_en="A conversation",
            scenario_ru="Разговор",
            cefr_level=DeckLevel.B1,
            status=DialogStatus.EXERCISES_READY,
            situation_id=situation.id,
            num_speakers=2,
            audio_s3_key=old_s3_key,
            audio_duration_seconds=5.0,
            audio_generated_at=old_generated_at,
            audio_file_size_bytes=1000,
        )
        db_session.add(dialog)
        await db_session.flush()

        speaker1 = DialogSpeaker(
            dialog_id=dialog.id,
            speaker_index=0,
            character_name="Speaker 1",
            voice_id="voice-abc",
        )
        speaker2 = DialogSpeaker(
            dialog_id=dialog.id,
            speaker_index=1,
            character_name="Speaker 2",
            voice_id="voice-xyz",
        )
        db_session.add_all([speaker1, speaker2])
        await db_session.flush()

        lines = [
            DialogLine(
                dialog_id=dialog.id,
                speaker_id=speaker1.id,
                line_index=i,
                text=f"Γεια {i}",
            )
            for i in range(3)
        ]
        db_session.add_all(lines)
        await db_session.flush()

        elevenlabs_response = _make_elevenlabs_response(num_lines=3)
        mock_factory = _make_session_factory_mock(db_session)

        mock_elevenlabs = MagicMock()
        mock_elevenlabs.generate_dialog_audio = AsyncMock(return_value=elevenlabs_response)

        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        mock_mp3_instance = MagicMock()
        mock_mp3_instance.info.length = 4.5  # matches last segment end_time_seconds for num_lines=3

        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
            patch("src.api.v1.admin.settings") as mock_settings,
            patch("mutagen.mp3.MP3", return_value=mock_mp3_instance),
        ):
            mock_settings.elevenlabs_configured = True
            mock_settings.aws_s3_bucket = "test-bucket"
            mock_settings.aws_s3_prefix = "dialog-audio"
            response = await generate_dialog_audio_stream(
                dialog_id=dialog.id,
                sse_auth=sse_auth,
            )
            events = await _collect_stream(response)

        error_events = [e for e in events if e.get("event") == "dialog_audio:error"]
        assert error_events == [], f"Unexpected errors: {error_events}"

        complete_events = [e for e in events if e.get("event") == "dialog_audio:complete"]
        assert len(complete_events) == 1

        await db_session.refresh(dialog)
        assert dialog.audio_s3_key != old_s3_key
        assert dialog.audio_generated_at is not None
        assert dialog.audio_generated_at > old_generated_at
        assert dialog.audio_duration_seconds is not None
        assert dialog.audio_duration_seconds > 0
        assert dialog.status == DialogStatus.EXERCISES_READY

        for line in lines:
            await db_session.refresh(line)
            assert line.start_time_ms is not None
            assert line.end_time_ms is not None

    @pytest.mark.asyncio
    async def test_generate_dialog_audio_elevenlabs_error(self, db_session: AsyncSession) -> None:
        """ElevenLabsAPIError from generate_dialog_audio → error event with stage=elevenlabs, dialog stays DRAFT."""
        from src.api.v1.admin import generate_dialog_audio_stream

        situation = await _create_situation(db_session)
        dialog = ListeningDialog(
            scenario_el="Μια συνομιλία",
            scenario_en="A conversation",
            scenario_ru="Разговор",
            cefr_level=DeckLevel.B1,
            status=DialogStatus.DRAFT,
            situation_id=situation.id,
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

        situation = await _create_situation(db_session)
        dialog = ListeningDialog(
            scenario_el="Μια συνομιλία",
            scenario_en="A conversation",
            scenario_ru="Разговор",
            cefr_level=DeckLevel.B1,
            status=DialogStatus.DRAFT,
            situation_id=situation.id,
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

        situation = await _create_situation(db_session)
        dialog = ListeningDialog(
            scenario_el="Μια συνομιλία",
            scenario_en="A conversation",
            scenario_ru="Разговор",
            cefr_level=DeckLevel.B1,
            status=DialogStatus.DRAFT,
            situation_id=situation.id,
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

    async def _setup_dialog_3lines(self, db_session: AsyncSession):
        """Create a dialog with 2 speakers and 3 lines for mutagen tests."""
        situation = await _create_situation(db_session)
        dialog = ListeningDialog(
            scenario_el="Μια συνομιλία",
            scenario_en="A conversation",
            scenario_ru="Разговор",
            cefr_level=DeckLevel.B1,
            status=DialogStatus.DRAFT,
            situation_id=situation.id,
            num_speakers=2,
        )
        db_session.add(dialog)
        await db_session.flush()

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
        return dialog

    @pytest.mark.asyncio
    async def test_mutagen_duration_overrides_segment_duration(
        self, db_session: AsyncSession
    ) -> None:
        """Mutagen-parsed duration replaces voice_segments end_time_seconds."""
        from src.api.v1.admin import generate_dialog_audio_stream

        dialog = await self._setup_dialog_3lines(db_session)

        elevenlabs_response = _make_elevenlabs_response(num_lines=3)
        mock_factory = _make_session_factory_mock(db_session)
        mock_elevenlabs = MagicMock()
        mock_elevenlabs.generate_dialog_audio = AsyncMock(return_value=elevenlabs_response)
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        # Parsed duration differs significantly from segment duration (4.5)
        mock_mp3 = MagicMock()
        mock_mp3.info.length = 16.5

        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
            patch("src.api.v1.admin.settings") as mock_settings,
            patch("mutagen.mp3.MP3", return_value=mock_mp3),
        ):
            mock_settings.elevenlabs_configured = True
            response = await generate_dialog_audio_stream(
                dialog_id=dialog.id,
                sse_auth=sse_auth,
            )
            await _collect_stream(response)

        await db_session.refresh(dialog)
        assert dialog.audio_duration_seconds == pytest.approx(16.5)

    @pytest.mark.asyncio
    async def test_mutagen_failure_falls_back_to_segment_duration(
        self, db_session: AsyncSession, caplog_loguru
    ) -> None:
        """HeaderNotFoundError → falls back to voice_segments duration with warning."""
        from mutagen.mp3 import HeaderNotFoundError

        from src.api.v1.admin import generate_dialog_audio_stream

        dialog = await self._setup_dialog_3lines(db_session)

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
            patch("mutagen.mp3.MP3", side_effect=HeaderNotFoundError("bad mp3")),
        ):
            mock_settings.elevenlabs_configured = True
            response = await generate_dialog_audio_stream(
                dialog_id=dialog.id,
                sse_auth=sse_auth,
            )
            await _collect_stream(response)

        await db_session.refresh(dialog)
        # Falls back to voice_segments duration (last segment end_time_seconds for num_lines=3 = 4.5)
        assert dialog.audio_duration_seconds == pytest.approx(4.5)
        assert "Failed to parse MP3 duration" in caplog_loguru.text

    @pytest.mark.asyncio
    async def test_mutagen_mismatch_warning_logged(
        self, db_session: AsyncSession, caplog_loguru
    ) -> None:
        """Mismatch >1s between parsed and segment duration → warning logged."""
        from src.api.v1.admin import generate_dialog_audio_stream

        dialog = await self._setup_dialog_3lines(db_session)

        elevenlabs_response = _make_elevenlabs_response(num_lines=3)
        mock_factory = _make_session_factory_mock(db_session)
        mock_elevenlabs = MagicMock()
        mock_elevenlabs.generate_dialog_audio = AsyncMock(return_value=elevenlabs_response)
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        # segment=4.5, parsed=16.5, diff=12.0 → mismatch warning
        mock_mp3 = MagicMock()
        mock_mp3.info.length = 16.5

        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
            patch("src.api.v1.admin.settings") as mock_settings,
            patch("mutagen.mp3.MP3", return_value=mock_mp3),
        ):
            mock_settings.elevenlabs_configured = True
            response = await generate_dialog_audio_stream(
                dialog_id=dialog.id,
                sse_auth=sse_auth,
            )
            await _collect_stream(response)

        assert "MP3 duration mismatch" in caplog_loguru.text
        await db_session.refresh(dialog)
        assert dialog.audio_duration_seconds == pytest.approx(16.5)

    @pytest.mark.asyncio
    async def test_mutagen_close_durations_no_warning(
        self, db_session: AsyncSession, caplog_loguru
    ) -> None:
        """Mismatch <=1s → no mismatch warning."""
        from src.api.v1.admin import generate_dialog_audio_stream

        dialog = await self._setup_dialog_3lines(db_session)

        elevenlabs_response = _make_elevenlabs_response(num_lines=3)
        mock_factory = _make_session_factory_mock(db_session)
        mock_elevenlabs = MagicMock()
        mock_elevenlabs.generate_dialog_audio = AsyncMock(return_value=elevenlabs_response)
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        # segment=4.5, parsed=4.55, diff=0.05 → no mismatch warning
        mock_mp3 = MagicMock()
        mock_mp3.info.length = 4.55

        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
            patch("src.api.v1.admin.settings") as mock_settings,
            patch("mutagen.mp3.MP3", return_value=mock_mp3),
        ):
            mock_settings.elevenlabs_configured = True
            response = await generate_dialog_audio_stream(
                dialog_id=dialog.id,
                sse_auth=sse_auth,
            )
            await _collect_stream(response)

        assert "MP3 duration mismatch" not in caplog_loguru.text
        await db_session.refresh(dialog)
        assert dialog.audio_duration_seconds == pytest.approx(4.55)

    @pytest.mark.asyncio
    async def test_degenerate_segments_detected(
        self, db_session: AsyncSession, caplog_loguru
    ) -> None:
        """degenerate_line_count=1 in complete event and warning logged when one segment is zero-width."""
        from src.api.v1.admin import generate_dialog_audio_stream

        dialog = await self._setup_dialog_3lines(db_session)

        elevenlabs_response = _make_elevenlabs_response(num_lines=3)
        elevenlabs_response["voice_segments"][0]["end_time_seconds"] = elevenlabs_response[
            "voice_segments"
        ][0]["start_time_seconds"]

        mock_factory = _make_session_factory_mock(db_session)
        mock_elevenlabs = MagicMock()
        mock_elevenlabs.generate_dialog_audio = AsyncMock(return_value=elevenlabs_response)
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)
        mock_mp3_instance = MagicMock()
        mock_mp3_instance.info.length = 4.5

        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
            patch("src.api.v1.admin.settings") as mock_settings,
            patch("mutagen.mp3.MP3", return_value=mock_mp3_instance),
        ):
            mock_settings.elevenlabs_configured = True
            response = await generate_dialog_audio_stream(
                dialog_id=dialog.id,
                sse_auth=sse_auth,
            )
            events = await _collect_stream(response)

        complete_event = next(e for e in events if e["event"] == "dialog_audio:complete")
        assert complete_event["data"]["degenerate_line_count"] == 1
        assert "degenerate" in caplog_loguru.text

    @pytest.mark.asyncio
    async def test_normal_segments_degenerate_count_zero(self, db_session: AsyncSession) -> None:
        """degenerate_line_count=0 in complete event when all segments are non-degenerate."""
        from src.api.v1.admin import generate_dialog_audio_stream

        dialog = await self._setup_dialog_3lines(db_session)

        elevenlabs_response = _make_elevenlabs_response(num_lines=3)
        mock_factory = _make_session_factory_mock(db_session)
        mock_elevenlabs = MagicMock()
        mock_elevenlabs.generate_dialog_audio = AsyncMock(return_value=elevenlabs_response)
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)
        mock_mp3_instance = MagicMock()
        mock_mp3_instance.info.length = 4.5

        sse_auth = _make_superuser_auth()

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.api.v1.admin.get_s3_service", return_value=mock_s3),
            patch("src.api.v1.admin.settings") as mock_settings,
            patch("mutagen.mp3.MP3", return_value=mock_mp3_instance),
        ):
            mock_settings.elevenlabs_configured = True
            response = await generate_dialog_audio_stream(
                dialog_id=dialog.id,
                sse_auth=sse_auth,
            )
            events = await _collect_stream(response)

        complete_event = next(e for e in events if e["event"] == "dialog_audio:complete")
        assert complete_event["data"]["degenerate_line_count"] == 0


class TestBuildWordTimestamps:
    """Unit tests for _build_word_timestamps pure function."""

    def _make_alignment(
        self,
        chars: list[str],
        starts: list[float],
        ends: list[float],
    ) -> dict:
        return {
            "characters": chars,
            "character_start_times_seconds": starts,
            "character_end_times_seconds": ends,
        }

    def test_happy_path_multi_word(self) -> None:
        """Groups characters into words correctly with ms conversion."""
        from src.api.v1.admin import _build_word_timestamps

        chars = ["Γ", "ε", "ι", "α", " ", "σ", "ο", "υ", "!"]
        starts = [0.0, 0.04, 0.053, 0.066, 0.079, 0.139, 0.199, 0.259, 0.319]
        ends = [0.04, 0.053, 0.066, 0.079, 0.139, 0.199, 0.259, 0.319, 1.039]
        result_data = {
            "alignment": self._make_alignment(chars, starts, ends),
            "voice_segments": [
                {"character_start_index": 0, "character_end_index": 9, "dialogue_input_index": 0}
            ],
        }
        result = _build_word_timestamps(result_data, [{"text": "Γεια σου!"}])
        assert result[0] == [
            {"word": "Γεια", "start_ms": 0, "end_ms": 79},
            {"word": "σου!", "start_ms": 139, "end_ms": 1039},
        ]

    def test_single_word(self) -> None:
        """Single word with no spaces produces one entry."""
        from src.api.v1.admin import _build_word_timestamps

        chars = list("hello")
        starts = [0.0, 0.1, 0.2, 0.3, 0.4]
        ends = [0.1, 0.2, 0.3, 0.4, 0.5]
        result_data = {
            "alignment": self._make_alignment(chars, starts, ends),
            "voice_segments": [
                {"character_start_index": 0, "character_end_index": 5, "dialogue_input_index": 0}
            ],
        }
        result = _build_word_timestamps(result_data, [{"text": "hello"}])
        assert len(result[0]) == 1
        assert result[0][0]["word"] == "hello"
        assert result[0][0]["start_ms"] == 0
        assert result[0][0]["end_ms"] == 500

    def test_consecutive_spaces_filtered(self) -> None:
        """Multiple consecutive spaces produce no empty word entries."""
        from src.api.v1.admin import _build_word_timestamps

        chars = ["a", " ", " ", " ", "b"]
        starts = [0.0, 0.1, 0.2, 0.3, 0.4]
        ends = [0.1, 0.2, 0.3, 0.4, 0.5]
        result_data = {
            "alignment": self._make_alignment(chars, starts, ends),
            "voice_segments": [
                {"character_start_index": 0, "character_end_index": 5, "dialogue_input_index": 0}
            ],
        }
        result = _build_word_timestamps(result_data, [{"text": "a   b"}])
        words = result[0]
        assert len(words) == 2
        assert words[0]["word"] == "a"
        assert words[1]["word"] == "b"

    def test_missing_alignment_returns_all_none(self) -> None:
        """Missing alignment key returns None for all lines."""
        from src.api.v1.admin import _build_word_timestamps

        result_data = {
            "voice_segments": [
                {"character_start_index": 0, "character_end_index": 5, "dialogue_input_index": 0}
            ],
        }
        sorted_lines = [{"text": "line1"}, {"text": "line2"}]
        result = _build_word_timestamps(result_data, sorted_lines)
        assert result == {0: None, 1: None}

    def test_missing_character_indices_returns_none_for_line(self) -> None:
        """Segment missing character_start_index returns None for that line, others still work."""
        from src.api.v1.admin import _build_word_timestamps

        chars = list("ab cd")
        starts = [0.0, 0.1, 0.2, 0.3, 0.4]
        ends = [0.1, 0.2, 0.3, 0.4, 0.5]
        result_data = {
            "alignment": self._make_alignment(chars, starts, ends),
            "voice_segments": [
                {"dialogue_input_index": 0},  # missing indices
                {
                    "character_start_index": 0,
                    "character_end_index": 5,
                    "dialogue_input_index": 1,
                },
            ],
        }
        result = _build_word_timestamps(result_data, [{"text": "line0"}, {"text": "ab cd"}])
        assert result[0] is None
        assert result[1] is not None
        assert len(result[1]) == 2

    def test_punctuation_attached_to_word(self) -> None:
        """Punctuation attached to a word stays with the word."""
        from src.api.v1.admin import _build_word_timestamps

        chars = list("hello!")
        starts = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5]
        ends = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
        result_data = {
            "alignment": self._make_alignment(chars, starts, ends),
            "voice_segments": [
                {"character_start_index": 0, "character_end_index": 6, "dialogue_input_index": 0}
            ],
        }
        result = _build_word_timestamps(result_data, [{"text": "hello!"}])
        assert len(result[0]) == 1
        assert result[0][0]["word"] == "hello!"

    def test_fewer_segments_than_lines(self) -> None:
        """Lines without a matching voice_segment get None."""
        from src.api.v1.admin import _build_word_timestamps

        chars = list("hi")
        starts = [0.0, 0.1]
        ends = [0.1, 0.2]
        result_data = {
            "alignment": self._make_alignment(chars, starts, ends),
            "voice_segments": [
                {"character_start_index": 0, "character_end_index": 2, "dialogue_input_index": 0}
            ],
        }
        result = _build_word_timestamps(result_data, [{"text": "hi"}, {"text": "missing"}])
        assert result[0] is not None
        assert result[1] is None
