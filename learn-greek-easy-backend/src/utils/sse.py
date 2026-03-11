"""Server-Sent Events (SSE) utility functions for Learn Greek Easy backend.

This module provides infrastructure for Server-Sent Events streaming:
- format_sse_event: Format a single SSE event string from any data type
- format_sse_error: Convenience wrapper for error events
- sse_stream: Async generator wrapper that adds heartbeats and retry config
- create_sse_response: Create a StreamingResponse with correct SSE headers

SSE Event Format:
    [id: <id>]
    [event: <event_type>]
    [retry: <ms>]
    data: <json_payload>
    <blank line>

Usage:
    async def my_events():
        yield format_sse_event({"count": 1}, event="update")
        yield format_sse_event({"count": 2}, event="update")

    return create_sse_response(sse_stream(my_events()))
"""

from __future__ import annotations

import asyncio
import json
import os
from collections.abc import AsyncGenerator, Awaitable, Callable
from typing import Union

from pydantic import BaseModel
from starlette.responses import StreamingResponse


def _default_heartbeat_interval() -> float:
    """Return heartbeat interval based on current environment.

    In test/CI mode (TESTING=true), use a very long interval so that
    waitForLoadState('networkidle') in Playwright E2E tests can settle
    without SSE heartbeat comments keeping the network active.
    """
    return 3600.0 if os.getenv("TESTING", "").lower() == "true" else 30.0


# ============================================================
# Error code constants
# ============================================================

SSE_AUTH_FAILED = "auth_failed"
SSE_STREAM_ERROR = "stream_error"
SSE_RATE_LIMITED = "rate_limited"


# ============================================================
# Event formatting
# ============================================================


def format_sse_event(
    data: Union[str, dict, BaseModel],
    event: str | None = None,
    id: str | None = None,
    retry: int | None = None,
) -> str:
    """Format a single SSE event string.

    Args:
        data: Event payload. str is used as-is; dict is JSON-serialized;
              BaseModel is serialized via model_dump_json().
        event: Optional event type (maps to SSE `event:` field).
        id: Optional event ID (maps to SSE `id:` field).
        retry: Optional reconnect interval in milliseconds.

    Returns:
        A properly formatted SSE event string ending with double newline.
    """
    # Serialize data
    if isinstance(data, BaseModel):
        serialized = data.model_dump_json()
    elif isinstance(data, dict):
        serialized = json.dumps(data, ensure_ascii=False)
    else:
        serialized = str(data)

    # Build lines in SSE field order: id, event, retry, data
    lines: list[str] = []

    if id is not None:
        lines.append(f"id: {id}")

    if event is not None:
        lines.append(f"event: {event}")

    if retry is not None:
        lines.append(f"retry: {retry}")

    # Multi-line data: each \n becomes a separate `data:` line
    for data_line in serialized.split("\n"):
        lines.append(f"data: {data_line}")

    return "\n".join(lines) + "\n\n"


def format_sse_error(code: str, message: str) -> str:
    """Format a standardized SSE error event.

    Args:
        code: Machine-readable error code (e.g. SSE_AUTH_FAILED).
        message: Human-readable error description.

    Returns:
        A formatted SSE error event string.
    """
    return format_sse_event({"code": code, "message": message}, event="error")


# ============================================================
# Stream wrapping
# ============================================================


async def sse_stream(
    event_generator: AsyncGenerator[str, None],
    heartbeat_interval: float | None = None,
    on_cleanup: Callable[[], None] | Callable[[], Awaitable[None]] | None = None,
) -> AsyncGenerator[str, None]:
    """Wrap an async generator with SSE infrastructure.

    Yields an initial `retry:` directive, then forwards events from the
    inner generator while interleaving heartbeat comments during idle periods.
    Invokes the cleanup callback when the stream ends.

    Args:
        event_generator: The inner async generator producing SSE event strings.
        heartbeat_interval: Seconds of inactivity before yielding a heartbeat
                            comment. Defaults to 30 (or 3600 in TESTING mode).
        on_cleanup: Optional callback (sync or async) called after the stream
                    ends, whether by exhaustion, cancellation, or error.

    Yields:
        SSE-formatted strings: the retry directive, events, and heartbeats.
    """
    if heartbeat_interval is None:
        heartbeat_interval = _default_heartbeat_interval()

    # First message: set client reconnect interval to 3 seconds
    yield "retry: 3000\n\n"

    _SENTINEL = object()
    try:
        task: asyncio.Task | None = None
        while True:
            if task is None:
                task = asyncio.ensure_future(anext(event_generator, _SENTINEL))
            done, _ = await asyncio.wait({task}, timeout=heartbeat_interval)
            if done:
                result = task.result()
                task = None
                if result is _SENTINEL:
                    break
                yield result
            else:
                yield ": heartbeat\n\n"
    finally:
        if task is not None and not task.done():
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, StopAsyncIteration):
                pass
        # Explicitly close the inner generator so its async context managers
        # (e.g. factory.begin() DB sessions) run __aexit__ deterministically
        # instead of being left for the garbage collector.  Shield prevents a
        # concurrent CancelledError from interrupting the cleanup.
        try:
            await asyncio.shield(event_generator.aclose())
        except (asyncio.CancelledError, GeneratorExit):
            pass
        if on_cleanup is not None:
            if asyncio.iscoroutinefunction(on_cleanup):
                await on_cleanup()
            else:
                on_cleanup()


# ============================================================
# Response helper
# ============================================================


def create_sse_response(generator: AsyncGenerator[str, None]) -> StreamingResponse:
    """Create a StreamingResponse configured for Server-Sent Events.

    Sets the required headers to disable caching, enable keep-alive, and
    prevent proxy buffering (critical for Railway deployments).

    Args:
        generator: Async generator producing SSE event strings.

    Returns:
        A StreamingResponse with correct SSE headers.
    """
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ============================================================
# Public API
# ============================================================

__all__ = [
    # Constants
    "SSE_AUTH_FAILED",
    "SSE_STREAM_ERROR",
    "SSE_RATE_LIMITED",
    # Event formatting
    "format_sse_event",
    "format_sse_error",
    # Streaming
    "sse_stream",
    "create_sse_response",
]
