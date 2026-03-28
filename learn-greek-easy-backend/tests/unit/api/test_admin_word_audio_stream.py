"""Tests for POST /api/v1/admin/word-entries/{id}/generate-audio/stream SSE endpoint."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.core.dependencies import SSEAuthResult
from src.db.models import PartOfSpeech
from src.services.audio_generation_service import AudioResult


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


def _make_word_entry_mock(
    lemma: str = "σπίτι",
    part_of_speech: PartOfSpeech = PartOfSpeech.NOUN,
    grammar_data: dict | None = None,
    examples: list[dict] | None = None,
) -> MagicMock:
    mock = MagicMock()
    mock.lemma = lemma
    mock.part_of_speech = part_of_speech
    mock.grammar_data = grammar_data or {}
    mock.examples = examples
    return mock


def _make_session_mock() -> MagicMock:
    """Create an async session mock that supports execute()."""
    session = MagicMock()
    session.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    )
    return session


def _make_session_factory_mock(word_entry: MagicMock | None = None) -> MagicMock:
    """Create a mock session factory.

    On the first factory.begin() call, the session's execute() returns the word_entry.
    Subsequent calls return a plain session for DB updates.
    """
    call_count = 0

    def begin_side_effect():
        nonlocal call_count
        call_count += 1
        session = MagicMock()

        if call_count == 1 and word_entry is not None:
            # First session: load word entry
            result_mock = MagicMock()
            result_mock.scalar_one_or_none.return_value = word_entry
            session.execute = AsyncMock(return_value=result_mock)
        else:
            # Subsequent sessions: DB updates (don't need to return anything)
            session.execute = AsyncMock(return_value=MagicMock())

        cm = MagicMock()
        cm.__aenter__ = AsyncMock(return_value=session)
        cm.__aexit__ = AsyncMock(return_value=False)
        return cm

    mock_factory = MagicMock()
    mock_factory.begin.side_effect = begin_side_effect
    return mock_factory


def _make_session_factory_not_found() -> MagicMock:
    """Factory where DB returns None (word entry not found)."""
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


class TestWordAudioStreamEndpoint:
    """Auth/authz tests — call endpoint directly, no DB needed."""

    @pytest.mark.asyncio
    async def test_auth_required(self) -> None:
        """Unauthenticated request returns auth_required error event."""
        from src.api.v1.admin import generate_word_entry_audio_stream

        sse_auth = _make_unauth()
        response = await generate_word_entry_audio_stream(
            word_entry_id=uuid4(),
            sse_auth=sse_auth,
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["code"] == "auth_required"

    @pytest.mark.asyncio
    async def test_forbidden_non_superuser(self) -> None:
        """Non-superuser request returns forbidden error event."""
        from src.api.v1.admin import generate_word_entry_audio_stream

        sse_auth = _make_non_superuser_auth()
        response = await generate_word_entry_audio_stream(
            word_entry_id=uuid4(),
            sse_auth=sse_auth,
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert any(e["data"].get("code") == "forbidden" for e in error_events)

    @pytest.mark.asyncio
    async def test_elevenlabs_not_configured(self) -> None:
        """Returns service_unavailable when ElevenLabs is not configured."""
        from src.api.v1.admin import generate_word_entry_audio_stream

        sse_auth = _make_superuser_auth()
        with patch("src.api.v1.admin.settings") as mock_settings:
            mock_settings.elevenlabs_configured = False
            response = await generate_word_entry_audio_stream(
                word_entry_id=uuid4(),
                sse_auth=sse_auth,
            )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert any(e["data"].get("code") == "service_unavailable" for e in error_events)


class TestWordAudioSSEPipeline:
    """Pipeline tests — mock session factory and audio_generation_service."""

    def _make_audio_result(self, s3_key: str) -> AudioResult:
        return AudioResult(
            audio_bytes=b"fake-mp3",
            s3_key=s3_key,
            duration_seconds=1.0,
            file_size_bytes=8,
        )

    @pytest.mark.asyncio
    async def test_happy_path_lemma_and_examples(self) -> None:
        """Word entry with lemma + 2 examples produces full event sequence."""
        from src.api.v1.admin import _word_audio_sse_pipeline

        word_entry_id = uuid4()
        word_entry = _make_word_entry_mock(
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            examples=[
                {"id": "ex1", "greek": "Το σπίτι είναι μεγάλο"},
                {"id": "ex2", "greek": "Πήγα στο σπίτι"},
            ],
        )

        mock_factory = _make_session_factory_mock(word_entry)
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(
            side_effect=[
                self._make_audio_result(f"word-audio/{word_entry_id}.mp3"),
                self._make_audio_result(f"word-audio/{word_entry_id}/ex1.mp3"),
                self._make_audio_result(f"word-audio/{word_entry_id}/ex2.mp3"),
            ]
        )

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_word_audio_sse_pipeline(word_entry_id))

        event_types = [e["event"] for e in events]

        # Verify all required event types are present
        assert "word_audio:start" in event_types
        assert "word_audio:tts" in event_types
        assert "word_audio:upload" in event_types
        assert "word_audio:persist" in event_types
        assert "word_audio:part_complete" in event_types
        assert "word_audio:complete" in event_types
        assert "word_audio:error" not in event_types

        # Verify start event has correct part_count
        start_events = [e for e in events if e["event"] == "word_audio:start"]
        assert start_events[0]["data"]["part_count"] == 3

        # Verify complete event
        complete_events = [e for e in events if e["event"] == "word_audio:complete"]
        assert complete_events[0]["data"]["parts_completed"] == 3

        # Verify generate_single called 3 times
        assert mock_audio_service.generate_single.call_count == 3

    @pytest.mark.asyncio
    async def test_happy_path_lemma_only(self) -> None:
        """Word entry with no examples produces single-part event sequence."""
        from src.api.v1.admin import _word_audio_sse_pipeline

        word_entry_id = uuid4()
        word_entry = _make_word_entry_mock(lemma="σπίτι", examples=None)

        mock_factory = _make_session_factory_mock(word_entry)
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(
            return_value=self._make_audio_result(f"word-audio/{word_entry_id}.mp3")
        )

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_word_audio_sse_pipeline(word_entry_id))

        start_events = [e for e in events if e["event"] == "word_audio:start"]
        assert start_events[0]["data"]["part_count"] == 1

        complete_events = [e for e in events if e["event"] == "word_audio:complete"]
        assert complete_events[0]["data"]["parts_completed"] == 1

        assert mock_audio_service.generate_single.call_count == 1

        tts_events = [e for e in events if e["event"] == "word_audio:tts"]
        assert len(tts_events) == 1
        assert tts_events[0]["data"]["part"] == "lemma"

    @pytest.mark.asyncio
    async def test_word_entry_not_found(self) -> None:
        """Random UUID returns word_audio:error with stage=load."""
        from src.api.v1.admin import _word_audio_sse_pipeline

        mock_factory = _make_session_factory_not_found()

        with patch("src.api.v1.admin.get_session_factory", return_value=mock_factory):
            events = await _collect_generator(_word_audio_sse_pipeline(uuid4()))

        error_events = [e for e in events if e["event"] == "word_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "load"

        # No start event should be emitted when not found
        assert "word_audio:start" not in [e["event"] for e in events]

    @pytest.mark.asyncio
    async def test_per_part_error_isolation(self) -> None:
        """TTS raises on lemma, succeeds on examples — pipeline continues."""
        from src.api.v1.admin import _word_audio_sse_pipeline

        word_entry_id = uuid4()
        word_entry = _make_word_entry_mock(
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            examples=[
                {"id": "ex1", "greek": "Το σπίτι είναι μεγάλο"},
                {"id": "ex2", "greek": "Πήγα στο σπίτι"},
            ],
        )

        mock_factory = _make_session_factory_mock(word_entry)
        mock_audio_service = MagicMock()
        # Fail on first call (lemma), succeed on subsequent (examples)
        mock_audio_service.generate_single = AsyncMock(
            side_effect=[
                RuntimeError("TTS failed for lemma"),
                self._make_audio_result(f"word-audio/{word_entry_id}/ex1.mp3"),
                self._make_audio_result(f"word-audio/{word_entry_id}/ex2.mp3"),
            ]
        )

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_word_audio_sse_pipeline(word_entry_id))

        event_types = [e["event"] for e in events]

        # Error for lemma
        assert "word_audio:error" in event_types
        error_events = [e for e in events if e["event"] == "word_audio:error"]
        lemma_error = next(e for e in error_events if e["data"]["part"] == "lemma")
        assert lemma_error["data"]["stage"] == "tts"

        # Examples still processed
        part_complete_events = [e for e in events if e["event"] == "word_audio:part_complete"]
        assert len(part_complete_events) == 2
        completed_parts = [e["data"]["part"] for e in part_complete_events]
        assert "example" in completed_parts

        # Final complete with 2 parts done
        complete_events = [e for e in events if e["event"] == "word_audio:complete"]
        assert len(complete_events) == 1
        assert complete_events[0]["data"]["parts_completed"] == 2

        # generate_single was called 3 times total (failed once, succeeded twice)
        assert mock_audio_service.generate_single.call_count == 3

    @pytest.mark.asyncio
    async def test_generating_status_set_before_tts(self) -> None:
        """Verify DB GENERATING update happens before generate_single is called."""
        from src.api.v1.admin import _word_audio_sse_pipeline

        word_entry_id = uuid4()
        word_entry = _make_word_entry_mock(lemma="σπίτι", examples=None)

        call_order: list[str] = []

        # Track the session factory's execute calls
        call_count = 0

        def begin_side_effect():
            nonlocal call_count
            call_count += 1
            session = MagicMock()

            if call_count == 1:
                result_mock = MagicMock()
                result_mock.scalar_one_or_none.return_value = word_entry

                async def execute_side_effect(*args, **kwargs):
                    call_order.append("db_update")
                    return result_mock

                session.execute = execute_side_effect
            else:

                async def execute_side_effect_update(*args, **kwargs):
                    call_order.append("db_persist")
                    return MagicMock()

                session.execute = execute_side_effect_update

            cm = MagicMock()
            cm.__aenter__ = AsyncMock(return_value=session)
            cm.__aexit__ = AsyncMock(return_value=False)
            return cm

        mock_factory = MagicMock()
        mock_factory.begin.side_effect = begin_side_effect

        async def generate_single_side_effect(*args, **kwargs):
            call_order.append("generate_speech")
            return AudioResult(
                audio_bytes=b"fake-mp3",
                s3_key=f"word-audio/{word_entry_id}.mp3",
                duration_seconds=1.0,
                file_size_bytes=8,
            )

        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = generate_single_side_effect

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            await _collect_generator(_word_audio_sse_pipeline(word_entry_id))

        # DB update (GENERATING) must happen before generate_single
        assert "db_update" in call_order
        assert "generate_speech" in call_order
        db_update_idx = call_order.index("db_update")
        generate_speech_idx = call_order.index("generate_speech")
        assert db_update_idx < generate_speech_idx

    @pytest.mark.asyncio
    async def test_s3_upload_failure(self) -> None:
        """S3 upload failure inside generate_single causes error event and FAILED status."""
        from src.api.v1.admin import _word_audio_sse_pipeline

        word_entry = _make_word_entry_mock(lemma="σπίτι", examples=None)

        mock_factory = _make_session_factory_mock(word_entry)
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(side_effect=RuntimeError("S3 upload failed"))

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_word_audio_sse_pipeline(uuid4()))

        error_events = [e for e in events if e["event"] == "word_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "tts"
        assert error_events[0]["data"]["part"] == "lemma"

        # Complete event still emitted with 0 parts completed
        complete_events = [e for e in events if e["event"] == "word_audio:complete"]
        assert len(complete_events) == 1
        assert complete_events[0]["data"]["parts_completed"] == 0
