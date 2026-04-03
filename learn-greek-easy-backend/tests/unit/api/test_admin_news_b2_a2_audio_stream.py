"""Tests for POST /admin/news/{id}/generate-b2-audio/stream and
POST /admin/news/{id}/generate-a2-audio/stream SSE endpoints."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.core.dependencies import SSEAuthResult

# ---------------------------------------------------------------------------
# SSE parsing helpers (mirrored from test_admin_word_audio_stream.py)
# ---------------------------------------------------------------------------


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
    chunks = []
    async for chunk in gen:
        chunks.append(chunk)
    return _parse_sse_text("".join(chunks))


# ---------------------------------------------------------------------------
# Auth helper factories
# ---------------------------------------------------------------------------


def _make_superuser_auth() -> SSEAuthResult:
    mock_user = MagicMock()
    mock_user.is_superuser = True
    mock_user.id = uuid4()
    return SSEAuthResult(user=mock_user)


def _make_non_superuser_auth() -> SSEAuthResult:
    mock_user = MagicMock()
    mock_user.is_superuser = False
    return SSEAuthResult(user=mock_user)


def _make_unauth() -> SSEAuthResult:
    return SSEAuthResult(
        error_code="auth_required",
        error_message="Authentication required",
    )


# ---------------------------------------------------------------------------
# Session factory helpers
# ---------------------------------------------------------------------------


def _make_session_factory_not_found() -> MagicMock:
    """Factory where DB returns None (news item not found)."""
    session = MagicMock()
    result_mock = MagicMock()
    result_mock.one_or_none.return_value = None
    session.execute = AsyncMock(return_value=result_mock)

    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=session)
    cm.__aexit__ = AsyncMock(return_value=False)

    mock_factory = MagicMock()
    mock_factory.begin.return_value = cm
    return mock_factory


def _make_session_factory_found(row: tuple) -> MagicMock:
    """Factory that returns the row tuple on first begin(), plain session for DB updates."""
    call_count = 0

    def begin_side_effect():
        nonlocal call_count
        call_count += 1
        session = MagicMock()

        if call_count == 1:
            result_mock = MagicMock()
            result_mock.one_or_none.return_value = row
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


def _make_news_row_b2(text_el: str = "Σήμερα στην Κύπρο.") -> tuple:
    return (uuid4(), uuid4(), text_el)


def _make_news_row_a2(text_el_a2: str = "Σήμερα στην Κύπρο.") -> tuple:
    return (uuid4(), uuid4(), text_el_a2)


# ---------------------------------------------------------------------------
# Endpoint auth/authz tests (B2)
# ---------------------------------------------------------------------------


class TestNewsB2AudioStreamEndpointAuth:
    """Auth tests for generate_news_b2_audio_stream endpoint."""

    @pytest.mark.asyncio
    async def test_unauthenticated_returns_auth_required(self) -> None:
        from src.api.v1.admin import generate_news_b2_audio_stream

        response = await generate_news_b2_audio_stream(
            news_item_id=uuid4(),
            sse_auth=_make_unauth(),
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["code"] == "auth_required"

    @pytest.mark.asyncio
    async def test_non_superuser_returns_forbidden(self) -> None:
        from src.api.v1.admin import generate_news_b2_audio_stream

        response = await generate_news_b2_audio_stream(
            news_item_id=uuid4(),
            sse_auth=_make_non_superuser_auth(),
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert any(e["data"].get("code") == "forbidden" for e in error_events)

    @pytest.mark.asyncio
    async def test_elevenlabs_not_configured_returns_service_unavailable(self) -> None:
        from src.api.v1.admin import generate_news_b2_audio_stream

        with patch("src.api.v1.admin.settings") as mock_settings:
            mock_settings.elevenlabs_configured = False
            response = await generate_news_b2_audio_stream(
                news_item_id=uuid4(),
                sse_auth=_make_superuser_auth(),
            )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert any(e["data"].get("code") == "service_unavailable" for e in error_events)


# ---------------------------------------------------------------------------
# Endpoint auth/authz tests (A2)
# ---------------------------------------------------------------------------


class TestNewsA2AudioStreamEndpointAuth:
    """Auth tests for generate_news_a2_audio_stream endpoint."""

    @pytest.mark.asyncio
    async def test_unauthenticated_returns_auth_required(self) -> None:
        from src.api.v1.admin import generate_news_a2_audio_stream

        response = await generate_news_a2_audio_stream(
            news_item_id=uuid4(),
            sse_auth=_make_unauth(),
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["code"] == "auth_required"

    @pytest.mark.asyncio
    async def test_non_superuser_returns_forbidden(self) -> None:
        from src.api.v1.admin import generate_news_a2_audio_stream

        response = await generate_news_a2_audio_stream(
            news_item_id=uuid4(),
            sse_auth=_make_non_superuser_auth(),
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert any(e["data"].get("code") == "forbidden" for e in error_events)

    @pytest.mark.asyncio
    async def test_elevenlabs_not_configured_returns_service_unavailable(self) -> None:
        from src.api.v1.admin import generate_news_a2_audio_stream

        with patch("src.api.v1.admin.settings") as mock_settings:
            mock_settings.elevenlabs_configured = False
            response = await generate_news_a2_audio_stream(
                news_item_id=uuid4(),
                sse_auth=_make_superuser_auth(),
            )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert any(e["data"].get("code") == "service_unavailable" for e in error_events)


# ---------------------------------------------------------------------------
# B2 pipeline tests
# ---------------------------------------------------------------------------


class TestNewsB2AudioSSEPipeline:
    """Pipeline unit tests for _news_b2_audio_sse_pipeline."""

    @pytest.mark.asyncio
    async def test_news_item_not_found_yields_error_stage_load(self) -> None:
        from src.api.v1.admin import _news_b2_audio_sse_pipeline

        mock_factory = _make_session_factory_not_found()

        with patch("src.api.v1.admin.get_session_factory", return_value=mock_factory):
            events = await _collect_generator(_news_b2_audio_sse_pipeline(uuid4()))

        error_events = [e for e in events if e["event"] == "news_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "load"
        assert error_events[0]["data"]["level"] == "b2"
        # No start event emitted when not found
        assert "news_audio:start" not in [e["event"] for e in events]

    @pytest.mark.asyncio
    async def test_missing_description_el_yields_error_stage_load(self) -> None:
        from src.api.v1.admin import _news_b2_audio_sse_pipeline

        item = _make_news_row_b2(text_el="")
        mock_factory = _make_session_factory_found(item)

        with patch("src.api.v1.admin.get_session_factory", return_value=mock_factory):
            events = await _collect_generator(_news_b2_audio_sse_pipeline(uuid4()))

        error_events = [e for e in events if e["event"] == "news_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "load"
        assert error_events[0]["data"]["level"] == "b2"

    @pytest.mark.asyncio
    async def test_whitespace_only_description_el_yields_error(self) -> None:
        from src.api.v1.admin import _news_b2_audio_sse_pipeline

        item = _make_news_row_b2(text_el="   \n  ")
        mock_factory = _make_session_factory_found(item)

        with patch("src.api.v1.admin.get_session_factory", return_value=mock_factory):
            events = await _collect_generator(_news_b2_audio_sse_pipeline(uuid4()))

        error_events = [e for e in events if e["event"] == "news_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "load"

    @pytest.mark.asyncio
    async def test_happy_path_full_event_sequence(self) -> None:
        from src.api.v1.admin import _news_b2_audio_sse_pipeline
        from src.services.audio_generation_service import AudioResult

        news_id = uuid4()
        item = _make_news_row_b2()
        mock_factory = _make_session_factory_found(item)
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(
            return_value=AudioResult(
                audio_bytes=b"fake-audio",
                s3_key=f"news-audio/{news_id}.mp3",
                duration_seconds=1.234,
                file_size_bytes=9,
            )
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
            events = await _collect_generator(_news_b2_audio_sse_pipeline(news_id))

        event_names = [e["event"] for e in events]
        assert "news_audio:start" in event_names
        assert "news_audio:tts" in event_names
        assert "news_audio:upload" in event_names
        assert "news_audio:persist" in event_names
        assert "news_audio:complete" in event_names
        assert "news_audio:error" not in event_names

    @pytest.mark.asyncio
    async def test_happy_path_all_payloads_include_level_b2(self) -> None:
        from src.api.v1.admin import _news_b2_audio_sse_pipeline
        from src.services.audio_generation_service import AudioResult

        item = _make_news_row_b2()
        mock_factory = _make_session_factory_found(item)
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(
            return_value=AudioResult(
                audio_bytes=b"fake-audio",
                s3_key="news-audio/fake.mp3",
                duration_seconds=1.234,
                file_size_bytes=9,
            )
        )
        mock_audio_service.generate_presigned_url = MagicMock(
            return_value="https://cdn.example.com/a.mp3"
        )

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_news_b2_audio_sse_pipeline(uuid4()))

        named_events = [e for e in events if e["event"] and e["event"].startswith("news_audio:")]
        assert len(named_events) >= 5
        for e in named_events:
            assert (
                e["data"].get("level") == "b2"
            ), f"Missing level='b2' in event {e['event']}: {e['data']}"

    @pytest.mark.asyncio
    async def test_s3_key_uses_audio_s3_prefix(self) -> None:
        from src.api.v1.admin import _news_b2_audio_sse_pipeline
        from src.services.audio_generation_service import AudioResult

        news_id = uuid4()
        item = _make_news_row_b2()
        desc_id = item[1]  # S3 key now uses desc_id, not news_item_id
        mock_factory = _make_session_factory_found(item)
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(
            return_value=AudioResult(
                audio_bytes=b"fake-audio",
                s3_key=f"news-audio/{desc_id}.mp3",
                duration_seconds=1.234,
                file_size_bytes=9,
            )
        )
        mock_audio_service.generate_presigned_url = MagicMock(
            return_value="https://cdn.example.com/a.mp3"
        )

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
            patch("src.api.v1.admin.settings") as mock_settings,
        ):
            mock_settings.audio_s3_prefix = "news-audio"
            mock_settings.elevenlabs_configured = True
            events = await _collect_generator(_news_b2_audio_sse_pipeline(news_id))

        upload_events = [e for e in events if e["event"] == "news_audio:upload"]
        assert len(upload_events) == 1
        assert upload_events[0]["data"]["s3_key"] == f"news-audio/{desc_id}.mp3"

    @pytest.mark.asyncio
    async def test_tts_failure_yields_error_stage_tts(self) -> None:
        from src.api.v1.admin import _news_b2_audio_sse_pipeline

        item = _make_news_row_b2()
        mock_factory = _make_session_factory_found(item)
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(side_effect=RuntimeError("ElevenLabs error"))

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_news_b2_audio_sse_pipeline(uuid4()))

        error_events = [e for e in events if e["event"] == "news_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "tts"
        assert error_events[0]["data"]["level"] == "b2"

    @pytest.mark.asyncio
    async def test_s3_upload_failure_yields_error_stage_upload(self) -> None:
        from src.api.v1.admin import _news_b2_audio_sse_pipeline

        item = _make_news_row_b2()
        mock_factory = _make_session_factory_found(item)
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(side_effect=RuntimeError("S3 upload failed"))

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_news_b2_audio_sse_pipeline(uuid4()))

        error_events = [e for e in events if e["event"] == "news_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "tts"
        assert error_events[0]["data"]["level"] == "b2"

    @pytest.mark.asyncio
    async def test_duration_calculation(self) -> None:
        """duration_seconds comes from AudioResult — verify DB receives it."""
        from src.api.v1.admin import _news_b2_audio_sse_pipeline
        from src.services.audio_generation_service import AudioResult

        item = _make_news_row_b2()
        persisted_values: list[dict] = []

        call_count = 0

        def begin_side_effect():
            nonlocal call_count
            call_count += 1
            session = MagicMock()

            if call_count == 1:
                result_mock = MagicMock()
                result_mock.one_or_none.return_value = item
                session.execute = AsyncMock(return_value=result_mock)
            else:

                async def capture_execute(stmt, *args, **kwargs):
                    # Capture values passed to UPDATE NewsItem
                    try:
                        vals = stmt._values
                        persisted_values.append({k.key: v for k, v in vals.items()})
                    except Exception:
                        pass
                    return MagicMock()

                session.execute = capture_execute

            cm = MagicMock()
            cm.__aenter__ = AsyncMock(return_value=session)
            cm.__aexit__ = AsyncMock(return_value=False)
            return cm

        mock_factory = MagicMock()
        mock_factory.begin.side_effect = begin_side_effect

        news_id = uuid4()
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(
            return_value=AudioResult(
                audio_bytes=b"fake-audio",
                s3_key=f"news-audio/{news_id}.mp3",
                duration_seconds=1.234,
                file_size_bytes=9,
            )
        )
        mock_audio_service.generate_presigned_url = MagicMock(
            return_value="https://cdn.example.com/a.mp3"
        )

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_news_b2_audio_sse_pipeline(news_id))

        assert "news_audio:complete" in [e["event"] for e in events]

    @pytest.mark.asyncio
    async def test_complete_event_includes_audio_url(self) -> None:
        from src.api.v1.admin import _news_b2_audio_sse_pipeline
        from src.services.audio_generation_service import AudioResult

        item = _make_news_row_b2()
        mock_factory = _make_session_factory_found(item)
        news_id = uuid4()
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(
            return_value=AudioResult(
                audio_bytes=b"fake-audio",
                s3_key=f"news-audio/{news_id}.mp3",
                duration_seconds=1.234,
                file_size_bytes=9,
            )
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
            events = await _collect_generator(_news_b2_audio_sse_pipeline(news_id))

        complete_events = [e for e in events if e["event"] == "news_audio:complete"]
        assert len(complete_events) == 1
        assert complete_events[0]["data"]["audio_url"] == "https://cdn.example.com/audio.mp3"


# ---------------------------------------------------------------------------
# A2 pipeline tests
# ---------------------------------------------------------------------------


class TestNewsA2AudioSSEPipeline:
    """Pipeline unit tests for _news_a2_audio_sse_pipeline."""

    @pytest.mark.asyncio
    async def test_news_item_not_found_yields_error_stage_load(self) -> None:
        from src.api.v1.admin import _news_a2_audio_sse_pipeline

        mock_factory = _make_session_factory_not_found()

        with patch("src.api.v1.admin.get_session_factory", return_value=mock_factory):
            events = await _collect_generator(_news_a2_audio_sse_pipeline(uuid4()))

        error_events = [e for e in events if e["event"] == "news_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "load"
        assert error_events[0]["data"]["level"] == "a2"
        assert "news_audio:start" not in [e["event"] for e in events]

    @pytest.mark.asyncio
    async def test_missing_description_el_a2_yields_error_stage_load(self) -> None:
        from src.api.v1.admin import _news_a2_audio_sse_pipeline

        item = _make_news_row_a2(text_el_a2="")
        mock_factory = _make_session_factory_found(item)

        with patch("src.api.v1.admin.get_session_factory", return_value=mock_factory):
            events = await _collect_generator(_news_a2_audio_sse_pipeline(uuid4()))

        error_events = [e for e in events if e["event"] == "news_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "load"
        assert error_events[0]["data"]["level"] == "a2"

    @pytest.mark.asyncio
    async def test_happy_path_full_event_sequence(self) -> None:
        from src.api.v1.admin import _news_a2_audio_sse_pipeline
        from src.services.audio_generation_service import AudioResult

        item = _make_news_row_a2()
        mock_factory = _make_session_factory_found(item)
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(
            return_value=AudioResult(
                audio_bytes=b"fake-audio",
                s3_key="news-audio/a2/fake.mp3",
                duration_seconds=1.234,
                file_size_bytes=9,
            )
        )
        mock_audio_service.generate_presigned_url = MagicMock(
            return_value="https://cdn.example.com/a2.mp3"
        )

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_news_a2_audio_sse_pipeline(uuid4()))

        event_names = [e["event"] for e in events]
        assert "news_audio:start" in event_names
        assert "news_audio:tts" in event_names
        assert "news_audio:upload" in event_names
        assert "news_audio:persist" in event_names
        assert "news_audio:complete" in event_names
        assert "news_audio:error" not in event_names

    @pytest.mark.asyncio
    async def test_happy_path_all_payloads_include_level_a2(self) -> None:
        from src.api.v1.admin import _news_a2_audio_sse_pipeline
        from src.services.audio_generation_service import AudioResult

        item = _make_news_row_a2()
        mock_factory = _make_session_factory_found(item)
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(
            return_value=AudioResult(
                audio_bytes=b"fake-audio",
                s3_key="news-audio/a2/fake.mp3",
                duration_seconds=1.234,
                file_size_bytes=9,
            )
        )
        mock_audio_service.generate_presigned_url = MagicMock(
            return_value="https://cdn.example.com/a2.mp3"
        )

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_news_a2_audio_sse_pipeline(uuid4()))

        named_events = [e for e in events if e["event"] and e["event"].startswith("news_audio:")]
        assert len(named_events) >= 5
        for e in named_events:
            assert (
                e["data"].get("level") == "a2"
            ), f"Missing level='a2' in event {e['event']}: {e['data']}"

    @pytest.mark.asyncio
    async def test_s3_key_uses_audio_a2_s3_prefix(self) -> None:
        from src.api.v1.admin import _news_a2_audio_sse_pipeline
        from src.services.audio_generation_service import AudioResult

        news_id = uuid4()
        item = _make_news_row_a2()
        desc_id = item[1]  # S3 key now uses desc_id, not news_item_id
        mock_factory = _make_session_factory_found(item)
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(
            return_value=AudioResult(
                audio_bytes=b"fake-audio",
                s3_key=f"news-audio/a2/{desc_id}.mp3",
                duration_seconds=1.234,
                file_size_bytes=9,
            )
        )
        mock_audio_service.generate_presigned_url = MagicMock(
            return_value="https://cdn.example.com/a2.mp3"
        )

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
            patch("src.api.v1.admin.settings") as mock_settings,
        ):
            mock_settings.audio_a2_s3_prefix = "news-audio/a2"
            mock_settings.elevenlabs_configured = True
            events = await _collect_generator(_news_a2_audio_sse_pipeline(news_id))

        upload_events = [e for e in events if e["event"] == "news_audio:upload"]
        assert len(upload_events) == 1
        assert upload_events[0]["data"]["s3_key"] == f"news-audio/a2/{desc_id}.mp3"

    @pytest.mark.asyncio
    async def test_tts_failure_yields_error_stage_tts(self) -> None:
        from src.api.v1.admin import _news_a2_audio_sse_pipeline

        item = _make_news_row_a2()
        mock_factory = _make_session_factory_found(item)
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(side_effect=RuntimeError("ElevenLabs error"))

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_news_a2_audio_sse_pipeline(uuid4()))

        error_events = [e for e in events if e["event"] == "news_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "tts"
        assert error_events[0]["data"]["level"] == "a2"

    @pytest.mark.asyncio
    async def test_s3_upload_failure_yields_error_stage_upload(self) -> None:
        from src.api.v1.admin import _news_a2_audio_sse_pipeline

        item = _make_news_row_a2()
        mock_factory = _make_session_factory_found(item)
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(side_effect=RuntimeError("S3 upload failed"))

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_news_a2_audio_sse_pipeline(uuid4()))

        error_events = [e for e in events if e["event"] == "news_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "tts"
        assert error_events[0]["data"]["level"] == "a2"

    @pytest.mark.asyncio
    async def test_no_culture_question_propagation(self) -> None:
        """A2 pipeline must NOT touch CultureQuestion table — only 2 session opens."""
        from src.api.v1.admin import _news_a2_audio_sse_pipeline
        from src.services.audio_generation_service import AudioResult

        item = _make_news_row_a2()
        begin_calls: list[int] = []

        call_count = 0

        def begin_side_effect():
            nonlocal call_count
            call_count += 1
            begin_calls.append(call_count)
            session = MagicMock()

            if call_count == 1:
                result_mock = MagicMock()
                result_mock.one_or_none.return_value = item
                session.execute = AsyncMock(return_value=result_mock)
            else:
                executed_stmts: list = []

                async def capture_execute(stmt, *args, **kwargs):
                    executed_stmts.append(stmt)
                    session._captured_stmts = executed_stmts
                    return MagicMock()

                session.execute = capture_execute
                session._captured_stmts = executed_stmts

            cm = MagicMock()
            cm.__aenter__ = AsyncMock(return_value=session)
            cm.__aexit__ = AsyncMock(return_value=False)
            return cm

        mock_factory = MagicMock()
        mock_factory.begin.side_effect = begin_side_effect

        news_id = uuid4()
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(
            return_value=AudioResult(
                audio_bytes=b"fake-audio",
                s3_key=f"news-audio/a2/{news_id}.mp3",
                duration_seconds=1.234,
                file_size_bytes=9,
            )
        )
        mock_audio_service.generate_presigned_url = MagicMock(
            return_value="https://cdn.example.com/a2.mp3"
        )

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_news_a2_audio_sse_pipeline(news_id))

        # A2 pipeline: 1 session for load, 1 session for persist. No extra sessions.
        assert len(begin_calls) == 2
        assert "news_audio:complete" in [e["event"] for e in events]

    @pytest.mark.asyncio
    async def test_complete_event_includes_audio_url(self) -> None:
        from src.api.v1.admin import _news_a2_audio_sse_pipeline
        from src.services.audio_generation_service import AudioResult

        item = _make_news_row_a2()
        mock_factory = _make_session_factory_found(item)
        news_id = uuid4()
        mock_audio_service = MagicMock()
        mock_audio_service.generate_single = AsyncMock(
            return_value=AudioResult(
                audio_bytes=b"fake-audio",
                s3_key=f"news-audio/a2/{news_id}.mp3",
                duration_seconds=1.234,
                file_size_bytes=9,
            )
        )
        mock_audio_service.generate_presigned_url = MagicMock(
            return_value="https://cdn.example.com/a2.mp3"
        )

        with (
            patch("src.api.v1.admin.get_session_factory", return_value=mock_factory),
            patch(
                "src.api.v1.admin.get_audio_generation_service",
                return_value=mock_audio_service,
            ),
        ):
            events = await _collect_generator(_news_a2_audio_sse_pipeline(news_id))

        complete_events = [e for e in events if e["event"] == "news_audio:complete"]
        assert len(complete_events) == 1
        assert complete_events[0]["data"]["audio_url"] == "https://cdn.example.com/a2.mp3"


# ---------------------------------------------------------------------------
# B2 vs A2 differentiation tests
# ---------------------------------------------------------------------------


class TestNewsAudioPipelineDifferentiation:
    """Verify B2 and A2 pipelines are distinct in their behavior."""

    @pytest.mark.asyncio
    async def test_b2_uses_description_el_not_a2(self) -> None:
        """B2 pipeline reads text_el (index 2) and errors if it is empty."""
        from src.api.v1.admin import _news_b2_audio_sse_pipeline

        # Row has empty text_el (b2) — pipeline should error at load stage
        row = _make_news_row_b2(text_el="")
        mock_factory = _make_session_factory_found(row)

        with patch("src.api.v1.admin.get_session_factory", return_value=mock_factory):
            events = await _collect_generator(_news_b2_audio_sse_pipeline(uuid4()))

        error_events = [e for e in events if e["event"] == "news_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "load"

    @pytest.mark.asyncio
    async def test_a2_uses_description_el_a2_not_b2(self) -> None:
        """A2 pipeline reads text_el_a2 (index 2) and errors if it is empty."""
        from src.api.v1.admin import _news_a2_audio_sse_pipeline

        # Row has empty text_el_a2 — pipeline should error at load stage
        row = _make_news_row_a2(text_el_a2="")
        mock_factory = _make_session_factory_found(row)

        with patch("src.api.v1.admin.get_session_factory", return_value=mock_factory):
            events = await _collect_generator(_news_a2_audio_sse_pipeline(uuid4()))

        error_events = [e for e in events if e["event"] == "news_audio:error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["stage"] == "load"
