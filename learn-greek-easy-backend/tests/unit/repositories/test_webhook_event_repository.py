"""Unit tests for WebhookEventRepository.

This module is the sole idempotency gate for Stripe webhooks. It tests:
- get_by_event_id: returns None for unknown event, correct row after create
- create_processing: creates a row with PROCESSING status
- mark_completed: PROCESSING -> COMPLETED, stamps processed_at
- mark_failed: PROCESSING -> FAILED, stamps processed_at + error_message
- Duplicate event_id raises IntegrityError (unique constraint)
- Long error_message is stored verbatim (Text column, no truncation)

Tests use real database fixtures to verify SQL queries / constraints work.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import WebhookEvent, WebhookProcessingStatus
from src.repositories.webhook_event import WebhookEventRepository

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def processing_event(db_session: AsyncSession) -> WebhookEvent:
    """Create a single webhook event in PROCESSING status."""
    event = WebhookEvent(
        event_id="evt_processing_1",
        event_type="checkout.session.completed",
        raw_payload={"id": "evt_processing_1", "object": "event"},
        processing_status=WebhookProcessingStatus.PROCESSING,
    )
    db_session.add(event)
    await db_session.flush()
    await db_session.refresh(event)
    return event


# =============================================================================
# Test get_by_event_id
# =============================================================================


class TestGetByEventId:
    """Tests for get_by_event_id (idempotency lookup)."""

    @pytest.mark.asyncio
    async def test_returns_none_for_unknown_event(
        self,
        db_session: AsyncSession,
    ):
        """Should return None when the event_id has never been received."""
        repo = WebhookEventRepository(db_session)

        result = await repo.get_by_event_id("evt_does_not_exist")

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_row_after_create_processing(
        self,
        db_session: AsyncSession,
    ):
        """Should return the persisted row after create_processing."""
        repo = WebhookEventRepository(db_session)
        created = await repo.create_processing(
            event_id="evt_lookup_1",
            event_type="customer.subscription.updated",
            raw_payload={"id": "evt_lookup_1"},
        )

        result = await repo.get_by_event_id("evt_lookup_1")

        assert result is not None
        assert result.id == created.id
        assert result.event_id == "evt_lookup_1"
        assert result.event_type == "customer.subscription.updated"
        assert result.processing_status == WebhookProcessingStatus.PROCESSING


# =============================================================================
# Test create_processing
# =============================================================================


class TestCreateProcessing:
    """Tests for create_processing."""

    @pytest.mark.asyncio
    async def test_creates_with_processing_status(
        self,
        db_session: AsyncSession,
    ):
        """Should create a row in PROCESSING status with no processed_at yet."""
        repo = WebhookEventRepository(db_session)

        result = await repo.create_processing(
            event_id="evt_create_1",
            event_type="invoice.paid",
            raw_payload={"id": "evt_create_1", "amount": 999},
        )

        assert result.id is not None
        assert result.event_id == "evt_create_1"
        assert result.event_type == "invoice.paid"
        assert result.raw_payload == {"id": "evt_create_1", "amount": 999}
        assert result.processing_status == WebhookProcessingStatus.PROCESSING
        assert result.processed_at is None
        assert result.error_message is None

    @pytest.mark.asyncio
    async def test_duplicate_event_id_raises_integrity_error(
        self,
        db_session: AsyncSession,
    ):
        """Should raise IntegrityError on duplicate event_id (unique constraint)."""
        repo = WebhookEventRepository(db_session)

        await repo.create_processing(
            event_id="evt_dup_1",
            event_type="checkout.session.completed",
            raw_payload={"id": "evt_dup_1"},
        )

        with pytest.raises(IntegrityError):
            await repo.create_processing(
                event_id="evt_dup_1",
                event_type="checkout.session.completed",
                raw_payload={"id": "evt_dup_1", "retry": True},
            )

        await db_session.rollback()


# =============================================================================
# Test mark_completed (state-machine transition)
# =============================================================================


class TestMarkCompleted:
    """Tests for mark_completed."""

    @pytest.mark.asyncio
    async def test_processing_to_completed_stamps_processed_at(
        self,
        db_session: AsyncSession,
        processing_event: WebhookEvent,
    ):
        """PROCESSING -> COMPLETED sets status and stamps processed_at."""
        repo = WebhookEventRepository(db_session)
        assert processing_event.processed_at is None

        result = await repo.mark_completed(processing_event)

        assert result.processing_status == WebhookProcessingStatus.COMPLETED
        assert result.processed_at is not None
        assert result.error_message is None

    @pytest.mark.asyncio
    async def test_completed_state_persisted(
        self,
        db_session: AsyncSession,
        processing_event: WebhookEvent,
    ):
        """Completed status should be persisted and re-readable from the DB."""
        repo = WebhookEventRepository(db_session)

        await repo.mark_completed(processing_event)

        reloaded = await db_session.scalar(
            select(WebhookEvent).where(WebhookEvent.event_id == processing_event.event_id)
        )
        assert reloaded is not None
        assert reloaded.processing_status == WebhookProcessingStatus.COMPLETED
        assert reloaded.processed_at is not None


# =============================================================================
# Test mark_failed (state-machine transition)
# =============================================================================


class TestMarkFailed:
    """Tests for mark_failed."""

    @pytest.mark.asyncio
    async def test_processing_to_failed_stamps_error_and_processed_at(
        self,
        db_session: AsyncSession,
        processing_event: WebhookEvent,
    ):
        """PROCESSING -> FAILED sets status, error_message, and processed_at."""
        repo = WebhookEventRepository(db_session)

        result = await repo.mark_failed(processing_event, "boom: subscription not found")

        assert result.processing_status == WebhookProcessingStatus.FAILED
        assert result.error_message == "boom: subscription not found"
        assert result.processed_at is not None

    @pytest.mark.asyncio
    async def test_long_error_message_stored_verbatim(
        self,
        db_session: AsyncSession,
        processing_event: WebhookEvent,
    ):
        """error_message is a Text column: long messages are stored, not truncated."""
        repo = WebhookEventRepository(db_session)
        long_message = "x" * 10_000

        await repo.mark_failed(processing_event, long_message)

        reloaded = await db_session.scalar(
            select(WebhookEvent).where(WebhookEvent.event_id == processing_event.event_id)
        )
        assert reloaded is not None
        assert reloaded.error_message == long_message
        assert len(reloaded.error_message) == 10_000
        assert reloaded.processing_status == WebhookProcessingStatus.FAILED
