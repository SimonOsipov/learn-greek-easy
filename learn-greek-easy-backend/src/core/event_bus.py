"""In-process event bus for real-time SSE notification delivery.

Provides a lightweight pub/sub mechanism using asyncio.Queue instances.
Each SSE connection subscribes a Queue for a specific user, and any service
can signal that user by publishing to their queues.

Pattern:
    # Subscribe (SSE endpoint):
    queue = await notification_event_bus.subscribe(user_id)
    try:
        event = await queue.get()
        yield format_sse_event(event.payload, event=event.event_type)
    finally:
        await notification_event_bus.unsubscribe(user_id, queue)

    # Publish (any service):
    await notification_event_bus.signal(
        user_id,
        NotificationEvent(event_type="unread_count", user_id=user_id, payload={"count": 5}),
    )
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from src.core.logging import get_logger

logger = get_logger(__name__)


# ============================================================
# Event type
# ============================================================


@dataclass(frozen=True)
class NotificationEvent:
    """An event delivered to SSE notification streams.

    Frozen to make it safe to share across queues without copying.
    """

    event_type: str
    """Type of event, e.g. 'unread_count' or 'new_notification'."""

    user_id: UUID
    """The user this event is intended for."""

    payload: dict[str, Any]
    """Event data forwarded directly as SSE event data."""


# ============================================================
# Event bus
# ============================================================


class NotificationEventBus:
    """In-process publish/subscribe bus for notification SSE streams.

    Maps user_id to a set of asyncio.Queue instances — one per active SSE
    connection for that user. Uses asyncio.Lock to protect mutations of the
    subscriber registry.
    """

    def __init__(self) -> None:
        self._subscribers: dict[UUID, set[asyncio.Queue[NotificationEvent]]] = {}
        self._lock: asyncio.Lock = asyncio.Lock()

    async def subscribe(self, user_id: UUID) -> asyncio.Queue[NotificationEvent]:
        """Register a new queue for user_id and return it.

        Args:
            user_id: The user ID to subscribe for.

        Returns:
            A new asyncio.Queue bound to this subscription.
        """
        queue: asyncio.Queue[NotificationEvent] = asyncio.Queue(maxsize=100)
        async with self._lock:
            if user_id not in self._subscribers:
                self._subscribers[user_id] = set()
            self._subscribers[user_id].add(queue)
        return queue

    async def unsubscribe(self, user_id: UUID, queue: asyncio.Queue[NotificationEvent]) -> None:
        """Remove a queue from the subscriber registry.

        Deletes the user_id key if the queue set becomes empty,
        preventing memory leaks from idle users.

        Args:
            user_id: The user ID to unsubscribe from.
            queue: The specific queue to remove.
        """
        async with self._lock:
            queues = self._subscribers.get(user_id)
            if queues is not None:
                queues.discard(queue)
                if not queues:
                    del self._subscribers[user_id]

    async def signal(self, user_id: UUID, event: NotificationEvent) -> None:
        """Deliver an event to all subscribed queues for user_id.

        Uses put_nowait() — if a queue is full (maxsize=100), the event is
        dropped with a warning log rather than blocking. Different users are
        fully isolated: a signal for user A never reaches user B's queues.

        Args:
            user_id: The target user ID.
            event: The event to deliver.
        """
        async with self._lock:
            queues = self._subscribers.get(user_id)
            if not queues:
                return
            for queue in queues:
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    logger.warning(
                        "Event bus queue full, dropping event",
                        extra={
                            "user_id": str(user_id),
                            "event_type": event.event_type,
                        },
                    )


# ============================================================
# Module-level singleton
# ============================================================

notification_event_bus = NotificationEventBus()
