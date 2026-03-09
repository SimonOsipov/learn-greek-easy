"""Tests for src/core/event_bus.py — NotificationEventBus."""

from __future__ import annotations

import asyncio
from uuid import UUID, uuid4

import pytest

from src.core.event_bus import NotificationEvent, NotificationEventBus


def _make_event(user_id: UUID, event_type: str = "unread_count") -> NotificationEvent:
    return NotificationEvent(event_type=event_type, user_id=user_id, payload={"count": 1})


class TestNotificationEventBus:
    """Tests for NotificationEventBus."""

    @pytest.mark.asyncio
    async def test_subscribe_creates_queue(self) -> None:
        bus = NotificationEventBus()
        user_id = uuid4()
        queue = await bus.subscribe(user_id)
        assert queue is not None
        assert user_id in bus._subscribers
        assert queue in bus._subscribers[user_id]

    @pytest.mark.asyncio
    async def test_unsubscribe_removes_queue(self) -> None:
        bus = NotificationEventBus()
        user_id = uuid4()
        queue = await bus.subscribe(user_id)
        await bus.unsubscribe(user_id, queue)
        assert user_id not in bus._subscribers

    @pytest.mark.asyncio
    async def test_unsubscribe_cleans_empty_user(self) -> None:
        bus = NotificationEventBus()
        user_id = uuid4()
        q1 = await bus.subscribe(user_id)
        q2 = await bus.subscribe(user_id)
        await bus.unsubscribe(user_id, q1)
        assert user_id in bus._subscribers  # still has q2
        await bus.unsubscribe(user_id, q2)
        assert user_id not in bus._subscribers  # empty, key deleted

    @pytest.mark.asyncio
    async def test_signal_delivers_to_all_subscribers(self) -> None:
        bus = NotificationEventBus()
        user_id = uuid4()
        q1 = await bus.subscribe(user_id)
        q2 = await bus.subscribe(user_id)
        event = _make_event(user_id)
        await bus.signal(user_id, event)
        assert q1.qsize() == 1
        assert q2.qsize() == 1
        assert q1.get_nowait() is event
        assert q2.get_nowait() is event

    @pytest.mark.asyncio
    async def test_signal_isolates_users(self) -> None:
        bus = NotificationEventBus()
        user_a = uuid4()
        user_b = uuid4()
        qa = await bus.subscribe(user_a)
        qb = await bus.subscribe(user_b)
        await bus.signal(user_a, _make_event(user_a))
        assert qa.qsize() == 1
        assert qb.qsize() == 0

    @pytest.mark.asyncio
    async def test_signal_no_subscribers_noop(self) -> None:
        bus = NotificationEventBus()
        # Should not raise
        await bus.signal(uuid4(), _make_event(uuid4()))

    @pytest.mark.asyncio
    async def test_signal_full_queue_skipped(self) -> None:
        bus = NotificationEventBus()
        user_id = uuid4()
        queue = await bus.subscribe(user_id)
        # Fill the queue
        for i in range(100):
            queue.put_nowait(_make_event(user_id))
        assert queue.full()
        # One more signal — should not block or raise
        await bus.signal(user_id, _make_event(user_id))
        assert queue.qsize() == 100  # still at capacity

    @pytest.mark.asyncio
    async def test_concurrent_subscribe_unsubscribe(self) -> None:
        bus = NotificationEventBus()
        user_id = uuid4()

        async def sub_unsub() -> None:
            q = await bus.subscribe(user_id)
            await bus.unsubscribe(user_id, q)

        await asyncio.gather(*[sub_unsub() for _ in range(50)])
        assert user_id not in bus._subscribers
