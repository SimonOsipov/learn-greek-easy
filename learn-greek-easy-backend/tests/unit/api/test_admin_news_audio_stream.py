"""Tests for /admin/news/{id}/audio/stream SSE endpoint helpers."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.core.dependencies import SSEAuthResult


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


class TestNewsAudioStreamAuth:
    """Auth-related tests for news audio stream endpoint."""

    @pytest.mark.asyncio
    async def test_unauthenticated_yields_error(self) -> None:
        from src.api.v1.admin import stream_news_audio

        sse_auth = SSEAuthResult(error_code="auth_required", error_message="Auth required")
        response = await stream_news_audio(
            news_item_id=uuid4(),
            sse_auth=sse_auth,
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["code"] == "auth_required"

    @pytest.mark.asyncio
    async def test_non_superuser_yields_forbidden(self) -> None:
        from src.api.v1.admin import stream_news_audio

        mock_user = MagicMock()
        mock_user.is_superuser = False
        sse_auth = SSEAuthResult(user=mock_user)

        response = await stream_news_audio(
            news_item_id=uuid4(),
            sse_auth=sse_auth,
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert any(e["data"].get("code") == "forbidden" for e in error_events)

    @pytest.mark.asyncio
    async def test_not_found_yields_error(self) -> None:
        from src.api.v1.admin import stream_news_audio

        mock_user = MagicMock()
        mock_user.is_superuser = True
        sse_auth = SSEAuthResult(user=mock_user)

        with patch("src.api.v1.admin._fetch_news_item_for_sse", return_value=None):
            response = await stream_news_audio(
                news_item_id=uuid4(),
                sse_auth=sse_auth,
            )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert any(e["data"].get("code") == "not_found" for e in error_events)


class TestNewsAudioSignalHelper:
    """Tests for _signal_news_audio_event helper."""

    def test_does_not_raise_on_exception(self) -> None:
        from src.tasks.background import _signal_news_audio_event

        with patch("src.core.event_bus.news_audio_event_bus") as mock_bus:
            mock_bus.signal = AsyncMock(side_effect=RuntimeError("bus error"))
            # Should not raise — fire-and-forget pattern swallows exceptions
            _signal_news_audio_event(
                news_item_id=uuid4(),
                level="b2",
                event_type="audio_progress",
                stage="generating_tts",
            )

    def test_no_exception_on_missing_loop(self) -> None:
        """Signal function silently skips when no running event loop exists."""
        from src.tasks.background import _signal_news_audio_event

        # In a sync test context, loop.is_running() returns False — the function
        # should complete without error.
        _signal_news_audio_event(
            news_item_id=uuid4(),
            level="b2",
            event_type="audio_completed",
            audio_url="https://cdn.example.com/audio.mp3",
        )

    def test_key_format_uses_news_item_id(self) -> None:
        """The event bus key must be f'news_audio:{news_item_id}'."""
        from src.tasks.background import _signal_news_audio_event

        news_item_id = uuid4()
        captured_keys: list[str] = []

        async def capture(key: str, payload: dict) -> None:
            captured_keys.append(key)

        import asyncio

        async def run_test() -> None:
            with patch("src.core.event_bus.news_audio_event_bus") as mock_bus:
                mock_bus.signal = AsyncMock(side_effect=capture)
                _signal_news_audio_event(
                    news_item_id=news_item_id,
                    level="a2",
                    event_type="audio_completed",
                    audio_url="https://cdn.example.com/audio.mp3",
                )
                # Give the created task a tick to execute
                await asyncio.sleep(0)

        asyncio.run(run_test())
        assert captured_keys == [f"news_audio:{news_item_id}"]

    def test_payload_contains_level(self) -> None:
        """The event bus payload must include the 'level' field."""
        from src.tasks.background import _signal_news_audio_event

        captured_payloads: list[dict] = []

        async def capture(key: str, payload: dict) -> None:
            captured_payloads.append(payload)

        import asyncio

        async def run_test() -> None:
            with patch("src.core.event_bus.news_audio_event_bus") as mock_bus:
                mock_bus.signal = AsyncMock(side_effect=capture)
                _signal_news_audio_event(
                    news_item_id=uuid4(),
                    level="b2",
                    event_type="audio_progress",
                    stage="uploading_s3",
                )
                await asyncio.sleep(0)

        asyncio.run(run_test())
        assert len(captured_payloads) == 1
        assert captured_payloads[0]["level"] == "b2"
        assert captured_payloads[0]["type"] == "audio_progress"
        assert captured_payloads[0]["stage"] == "uploading_s3"
