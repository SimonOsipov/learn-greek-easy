"""Webhook event repository for Stripe webhook idempotency and lifecycle."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import WebhookEvent, WebhookProcessingStatus
from src.repositories.base import BaseRepository


class WebhookEventRepository(BaseRepository[WebhookEvent]):
    """Repository for WebhookEvent CRUD and lifecycle operations.

    Provides idempotency checks and status transitions for Stripe
    webhook event processing.
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(WebhookEvent, db)

    async def get_by_event_id(self, event_id: str) -> WebhookEvent | None:
        """Get a webhook event by its Stripe event ID.

        Used for idempotency: check if this event was already received
        before processing it again.

        Args:
            event_id: Stripe event ID (e.g., "evt_1abc...")

        Returns:
            WebhookEvent instance or None if not yet received
        """
        query = select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_processing(
        self,
        event_id: str,
        event_type: str,
        raw_payload: dict,
    ) -> WebhookEvent:
        """Create a new webhook event record with PROCESSING status.

        Args:
            event_id: Stripe event ID (e.g., "evt_1abc...")
            event_type: Stripe event type (e.g., "checkout.session.completed")
            raw_payload: Full JSON payload from Stripe

        Returns:
            Created WebhookEvent with processing_status=PROCESSING
        """
        db_obj = WebhookEvent(
            event_id=event_id,
            event_type=event_type,
            raw_payload=raw_payload,
            processing_status=WebhookProcessingStatus.PROCESSING,
        )
        self.db.add(db_obj)
        await self.db.flush()
        return db_obj

    async def mark_completed(self, event: WebhookEvent) -> WebhookEvent:
        """Mark a webhook event as successfully processed.

        Args:
            event: WebhookEvent instance to mark completed

        Returns:
            Updated WebhookEvent with processing_status=COMPLETED, processed_at set
        """
        event.processing_status = WebhookProcessingStatus.COMPLETED
        event.processed_at = datetime.now(timezone.utc)
        self.db.add(event)
        await self.db.flush()
        return event

    async def mark_failed(self, event: WebhookEvent, error_message: str) -> WebhookEvent:
        """Mark a webhook event as failed.

        Args:
            event: WebhookEvent instance to mark failed
            error_message: Description of what went wrong

        Returns:
            Updated WebhookEvent with processing_status=FAILED, error_message,
            processed_at set
        """
        event.processing_status = WebhookProcessingStatus.FAILED
        event.error_message = error_message
        event.processed_at = datetime.now(timezone.utc)
        self.db.add(event)
        await self.db.flush()
        return event
