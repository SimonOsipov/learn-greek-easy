"""Tests for GET /api/v1/progress/stream SSE endpoint and debouncing."""

from __future__ import annotations

import asyncio
import json
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from src.core.dependencies import SSEAuthResult
from src.core.event_bus import GenericEventBus

# ============================================================
# SSE parsing helpers
# ============================================================


def _parse_sse_text(text: str) -> list[dict]:
    """Parse raw SSE text into a list of event dicts."""
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
    """Collect all chunks from a StreamingResponse body iterator."""
    content = b""
    async for chunk in response.body_iterator:
        content += chunk if isinstance(chunk, bytes) else chunk.encode()
    return _parse_sse_text(content.decode())


# ============================================================
# Tests for the progress SSE endpoint
# ============================================================


class TestProgressStreamEndpoint:
    """Tests for the progress SSE stream endpoint."""

    @pytest.mark.asyncio
    async def test_unauthenticated_yields_error(self) -> None:
        """Unauthenticated SSEAuthResult produces an SSE error event."""
        from src.api.v1.progress import stream_progress

        sse_auth = SSEAuthResult(error_code="auth_required", error_message="Auth required")
        response = await stream_progress(sse_auth=sse_auth)
        events = await _collect_stream(response)

        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["code"] == "auth_required"

    @pytest.mark.asyncio
    async def test_unauthenticated_error_contains_message(self) -> None:
        """Unauthenticated SSE error event carries the error message."""
        from src.api.v1.progress import stream_progress

        sse_auth = SSEAuthResult(error_code="token_expired", error_message="Token has expired")
        response = await stream_progress(sse_auth=sse_auth)
        events = await _collect_stream(response)

        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["message"] == "Token has expired"

    @pytest.mark.asyncio
    async def test_unauthenticated_stream_terminates(self) -> None:
        """Unauthenticated stream terminates (body_iterator exhausts) without hanging."""
        from src.api.v1.progress import stream_progress

        sse_auth = SSEAuthResult(error_code="auth_required", error_message="Auth required")
        response = await stream_progress(sse_auth=sse_auth)

        # Collect with timeout — stream must finish without blocking
        async def collect() -> list[dict]:
            return await _collect_stream(response)

        events = await asyncio.wait_for(collect(), timeout=2.0)
        assert len(events) >= 1

    @pytest.mark.asyncio
    async def test_authenticated_yields_connected_event(self) -> None:
        """Authenticated connection yields a 'connected' SSE event."""
        from src.api.v1.progress import stream_progress

        mock_user = MagicMock()
        mock_user.id = uuid4()
        sse_auth = SSEAuthResult(user=mock_user)

        local_bus = GenericEventBus()
        events_received: list[dict] = []

        async def limited_collect(response) -> None:
            async for chunk in response.body_iterator:
                text = chunk if isinstance(chunk, str) else chunk.decode()
                parsed = _parse_sse_text(text)
                events_received.extend(parsed)
                if any(e.get("event") == "connected" for e in events_received):
                    break

        with patch("src.api.v1.progress.dashboard_event_bus", local_bus):
            response = await stream_progress(sse_auth=sse_auth)
            try:
                await asyncio.wait_for(limited_collect(response), timeout=1.0)
            except (asyncio.TimeoutError, StopAsyncIteration):
                pass

        connected = [e for e in events_received if e.get("event") == "connected"]
        assert len(connected) >= 1

    @pytest.mark.asyncio
    async def test_receives_dashboard_updated_on_signal(self) -> None:
        """Signalling the bus produces a 'dashboard_updated' event on the stream."""
        from src.api.v1.progress import stream_progress

        mock_user = MagicMock()
        user_id = uuid4()
        mock_user.id = user_id
        sse_auth = SSEAuthResult(user=mock_user)

        local_bus = GenericEventBus()
        events_received: list[dict] = []

        async def collect_with_signal() -> None:
            response = await stream_progress(sse_auth=sse_auth)

            async def read_stream() -> None:
                async for chunk in response.body_iterator:
                    text = chunk if isinstance(chunk, str) else chunk.decode()
                    parsed = _parse_sse_text(text)
                    events_received.extend(parsed)
                    if any(e.get("event") == "dashboard_updated" for e in events_received):
                        return

            read_task = asyncio.create_task(read_stream())
            await asyncio.sleep(0.05)
            await local_bus.signal(f"dashboard:{user_id}", {"reason": "review_completed"})
            try:
                await asyncio.wait_for(read_task, timeout=2.0)
            except asyncio.TimeoutError:
                read_task.cancel()

        with patch("src.api.v1.progress.dashboard_event_bus", local_bus):
            await collect_with_signal()

        updated = [e for e in events_received if e.get("event") == "dashboard_updated"]
        assert len(updated) >= 1
        assert updated[0]["data"]["reason"] == "review_completed"

    @pytest.mark.asyncio
    async def test_dashboard_updated_event_has_timestamp(self) -> None:
        """dashboard_updated events include a timestamp field."""
        from src.api.v1.progress import stream_progress

        mock_user = MagicMock()
        user_id = uuid4()
        mock_user.id = user_id
        sse_auth = SSEAuthResult(user=mock_user)

        local_bus = GenericEventBus()
        events_received: list[dict] = []

        async def collect_with_signal() -> None:
            response = await stream_progress(sse_auth=sse_auth)

            async def read_stream() -> None:
                async for chunk in response.body_iterator:
                    text = chunk if isinstance(chunk, str) else chunk.decode()
                    parsed = _parse_sse_text(text)
                    events_received.extend(parsed)
                    if any(e.get("event") == "dashboard_updated" for e in events_received):
                        return

            read_task = asyncio.create_task(read_stream())
            await asyncio.sleep(0.05)
            await local_bus.signal(f"dashboard:{user_id}", {"reason": "card_studied"})
            try:
                await asyncio.wait_for(read_task, timeout=2.0)
            except asyncio.TimeoutError:
                read_task.cancel()

        with patch("src.api.v1.progress.dashboard_event_bus", local_bus):
            await collect_with_signal()

        updated = [e for e in events_received if e.get("event") == "dashboard_updated"]
        assert len(updated) >= 1
        assert "timestamp" in updated[0]["data"]


# ============================================================
# Tests for GenericEventBus (dashboard_event_bus)
# ============================================================


class TestDashboardEventBus:
    """Tests for the GenericEventBus used as dashboard_event_bus."""

    @pytest.mark.asyncio
    async def test_signal_delivers_to_subscriber(self) -> None:
        """A signalled payload is delivered to a subscribed queue."""
        bus = GenericEventBus()
        key = f"dashboard:{uuid4()}"
        queue = await bus.subscribe(key)

        await bus.signal(key, {"reason": "test"})
        event = queue.get_nowait()
        assert event["reason"] == "test"

        await bus.unsubscribe(key, queue)

    @pytest.mark.asyncio
    async def test_user_isolation(self) -> None:
        """Signal for key A does not reach queue subscribed to key B."""
        bus = GenericEventBus()
        key_a = f"dashboard:{uuid4()}"
        key_b = f"dashboard:{uuid4()}"

        qa = await bus.subscribe(key_a)
        qb = await bus.subscribe(key_b)

        await bus.signal(key_a, {"reason": "only_a"})

        assert qa.qsize() == 1
        assert qb.qsize() == 0

        await bus.unsubscribe(key_a, qa)
        await bus.unsubscribe(key_b, qb)

    @pytest.mark.asyncio
    async def test_multiple_subscribers_same_key(self) -> None:
        """Multiple queues subscribed to the same key all receive the signal."""
        bus = GenericEventBus()
        key = f"dashboard:{uuid4()}"

        qa = await bus.subscribe(key)
        qb = await bus.subscribe(key)

        await bus.signal(key, {"reason": "broadcast"})

        assert qa.qsize() == 1
        assert qb.qsize() == 1

        await bus.unsubscribe(key, qa)
        await bus.unsubscribe(key, qb)

    @pytest.mark.asyncio
    async def test_unsubscribe_removes_queue(self) -> None:
        """After unsubscribe, the queue no longer receives signals."""
        bus = GenericEventBus()
        key = f"dashboard:{uuid4()}"

        queue = await bus.subscribe(key)
        await bus.unsubscribe(key, queue)

        # Signal after unsubscribe — should not raise, queue stays empty
        await bus.signal(key, {"reason": "after_unsub"})
        assert queue.qsize() == 0

    @pytest.mark.asyncio
    async def test_signal_to_unknown_key_does_not_raise(self) -> None:
        """Signalling a key with no subscribers silently does nothing."""
        bus = GenericEventBus()
        unknown_key = f"dashboard:{uuid4()}"

        # Must not raise
        await bus.signal(unknown_key, {"reason": "nobody_listening"})

    @pytest.mark.asyncio
    async def test_subscribe_returns_asyncio_queue(self) -> None:
        """subscribe() returns an asyncio.Queue instance."""
        bus = GenericEventBus()
        key = f"dashboard:{uuid4()}"

        queue = await bus.subscribe(key)
        assert isinstance(queue, asyncio.Queue)

        await bus.unsubscribe(key, queue)

    @pytest.mark.asyncio
    async def test_unsubscribe_cleans_up_empty_key(self) -> None:
        """Unsubscribing the last queue for a key removes the key from registry."""
        bus = GenericEventBus()
        key = f"dashboard:{uuid4()}"

        queue = await bus.subscribe(key)
        await bus.unsubscribe(key, queue)

        # The key should be gone — signal does nothing and doesn't re-create the key
        await bus.signal(key, {"reason": "no_key"})
        # No assertion needed beyond no exception; internal _subscribers has no entry
        assert key not in bus._subscribers
