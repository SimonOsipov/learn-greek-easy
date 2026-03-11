"""Tests for src/utils/sse.py — SSE event formatting and stream utilities."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import BaseModel

from src.utils.sse import (
    SSE_AUTH_FAILED,
    SSE_RATE_LIMITED,
    SSE_STREAM_ERROR,
    create_sse_response,
    format_sse_error,
    format_sse_event,
    sse_stream,
)

# ============================================================
# Helpers
# ============================================================


class _SampleModel(BaseModel):
    id: int
    name: str


async def _make_generator(*events: str) -> AsyncGenerator[str, None]:
    for event in events:
        yield event


# ============================================================
# format_sse_event
# ============================================================


class TestFormatSSEEvent:
    """Tests for format_sse_event()."""

    def test_string_data(self) -> None:
        result = format_sse_event("hello")
        assert result == "data: hello\n\n"

    def test_dict_data(self) -> None:
        result = format_sse_event({"key": "value"})
        assert "data:" in result
        # Extract the data payload and verify it's valid JSON
        data_line = [line for line in result.split("\n") if line.startswith("data:")][0]
        parsed = json.loads(data_line[6:])
        assert parsed == {"key": "value"}
        assert result.endswith("\n\n")

    def test_pydantic_model_data(self) -> None:
        model = _SampleModel(id=1, name="Test")
        result = format_sse_event(model)
        assert "data:" in result
        data_line = [line for line in result.split("\n") if line.startswith("data:")][0]
        parsed = json.loads(data_line[6:])
        assert parsed["id"] == 1
        assert parsed["name"] == "Test"

    def test_event_type(self) -> None:
        result = format_sse_event("payload", event="update")
        assert "event: update\n" in result
        assert "data: payload\n\n" in result

    def test_id_field(self) -> None:
        result = format_sse_event("payload", id="42")
        assert "id: 42\n" in result
        assert result.startswith("id:")

    def test_retry_field(self) -> None:
        result = format_sse_event("payload", retry=5000)
        assert "retry: 5000\n" in result

    def test_all_fields_combined(self) -> None:
        result = format_sse_event("payload", event="update", id="1", retry=3000)
        lines = result.strip().split("\n")
        # id must come before event, event before retry, retry before data
        field_names = [line.split(":")[0] for line in lines]
        assert field_names.index("id") < field_names.index("event")
        assert field_names.index("event") < field_names.index("retry")
        assert field_names.index("retry") < field_names.index("data")

    def test_multiline_data(self) -> None:
        result = format_sse_event("line1\nline2")
        assert "data: line1\n" in result
        assert "data: line2\n\n" in result

    def test_empty_string_data(self) -> None:
        result = format_sse_event("")
        assert result == "data: \n\n"

    def test_terminates_with_double_newline(self) -> None:
        result = format_sse_event("x")
        assert result.endswith("\n\n")


# ============================================================
# format_sse_error
# ============================================================


class TestFormatSSEError:
    """Tests for format_sse_error()."""

    def test_error_event_format(self) -> None:
        result = format_sse_error("auth_failed", "Token expired")
        assert "event: error\n" in result
        data_line = [line for line in result.split("\n") if line.startswith("data:")][0]
        payload = json.loads(data_line[6:])
        assert payload["code"] == "auth_failed"
        assert payload["message"] == "Token expired"

    def test_error_code_constants(self) -> None:
        assert SSE_AUTH_FAILED == "auth_failed"
        assert SSE_STREAM_ERROR == "stream_error"
        assert SSE_RATE_LIMITED == "rate_limited"
        assert all(
            isinstance(c, str) for c in [SSE_AUTH_FAILED, SSE_STREAM_ERROR, SSE_RATE_LIMITED]
        )


# ============================================================
# sse_stream
# ============================================================


class TestSSEStream:
    """Tests for sse_stream() async generator."""

    @pytest.mark.asyncio
    async def test_initial_retry_message(self) -> None:
        async def _empty() -> AsyncGenerator[str, None]:
            return
            yield  # make it a generator

        items = [item async for item in sse_stream(_empty())]
        assert items[0] == "retry: 3000\n\n"

    @pytest.mark.asyncio
    async def test_events_pass_through(self) -> None:
        gen = _make_generator("event1", "event2", "event3")
        items = [item async for item in sse_stream(gen)]
        # First item is retry directive, then the 3 events
        assert items[0] == "retry: 3000\n\n"
        assert items[1] == "event1"
        assert items[2] == "event2"
        assert items[3] == "event3"

    @pytest.mark.asyncio
    async def test_heartbeat_on_inactivity(self) -> None:
        async def _slow_gen() -> AsyncGenerator[str, None]:
            await asyncio.sleep(0.2)
            yield "delayed_event"

        items = [item async for item in sse_stream(_slow_gen(), heartbeat_interval=0.05)]
        assert items[0] == "retry: 3000\n\n"
        heartbeats = [i for i in items if i == ": heartbeat\n\n"]
        assert len(heartbeats) >= 1
        assert "delayed_event" in items

    @pytest.mark.asyncio
    async def test_long_running_generator_survives_heartbeats(self) -> None:
        async def _multi_slow() -> AsyncGenerator[str, None]:
            await asyncio.sleep(0.15)
            yield "event_1"
            await asyncio.sleep(0.15)
            yield "event_2"

        items = [item async for item in sse_stream(_multi_slow(), heartbeat_interval=0.05)]
        assert items[0] == "retry: 3000\n\n"
        events = [i for i in items if not i.startswith(("retry:", ":"))]
        assert events == ["event_1", "event_2"]
        heartbeats = [i for i in items if i == ": heartbeat\n\n"]
        assert len(heartbeats) >= 2

    @pytest.mark.asyncio
    async def test_cleanup_called_when_generator_cancelled(self) -> None:
        cleanup = AsyncMock()

        async def _infinite() -> AsyncGenerator[str, None]:
            while True:
                await asyncio.sleep(10)
                yield "never"

        stream = sse_stream(_infinite(), heartbeat_interval=0.05, on_cleanup=cleanup)
        items = []
        async for item in stream:
            items.append(item)
            if len(items) >= 3:
                break

        # Explicitly close the async generator to trigger cleanup; Python does
        # not automatically await aclose() when breaking out of an async for.
        await stream.aclose()
        cleanup.assert_called_once()

    @pytest.mark.asyncio
    async def test_inner_generator_closed_on_cancellation(self) -> None:
        """Verify inner generator's aclose() is called when sse_stream is cancelled.

        Prevents connection pool leaks: without explicit aclose(), async context
        managers inside the inner generator (e.g. DB sessions) aren't cleaned up
        until the garbage collector runs — triggering SQLAlchemy pool warnings.
        Fixes GREEKLY-BACKEND-1C.
        """
        inner_closed = False

        async def _slow_inner() -> AsyncGenerator[str, None]:
            nonlocal inner_closed
            try:
                while True:
                    await asyncio.sleep(10)
                    yield "never"
            finally:
                inner_closed = True

        stream = sse_stream(_slow_inner(), heartbeat_interval=0.05)
        items = []
        async for item in stream:
            items.append(item)
            if len(items) >= 3:
                break

        await stream.aclose()
        assert inner_closed, "Inner generator was not closed — DB connections may leak"

    @pytest.mark.asyncio
    async def test_cleanup_callback_on_exhaustion_async(self) -> None:
        mock = AsyncMock()
        gen = _make_generator("event")
        items = [item async for item in sse_stream(gen, on_cleanup=mock)]
        assert len(items) > 0
        mock.assert_called_once()

    @pytest.mark.asyncio
    async def test_cleanup_callback_sync(self) -> None:
        mock = MagicMock()
        gen = _make_generator("event")
        _ = [item async for item in sse_stream(gen, on_cleanup=mock)]
        mock.assert_called_once()

    @pytest.mark.asyncio
    async def test_stream_terminates_on_exhaustion(self) -> None:
        gen = _make_generator("a", "b")
        items = [item async for item in sse_stream(gen)]
        # retry + 2 events = 3 items
        assert len(items) == 3


# ============================================================
# create_sse_response
# ============================================================


class TestCreateSSEResponse:
    """Tests for create_sse_response()."""

    def test_response_media_type(self) -> None:
        async def _gen() -> AsyncGenerator[str, None]:
            yield ""

        response = create_sse_response(_gen())
        assert response.media_type == "text/event-stream"

    def test_response_headers(self) -> None:
        async def _gen() -> AsyncGenerator[str, None]:
            yield ""

        response = create_sse_response(_gen())
        assert response.headers["cache-control"] == "no-cache, no-store"
        assert response.headers["connection"] == "keep-alive"
        assert response.headers["x-accel-buffering"] == "no"
