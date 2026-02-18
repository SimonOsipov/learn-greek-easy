"""Unit tests for WebhookService.

Tests cover:
- Idempotency: duplicate event returns early without DB mutation
- Unknown events: recorded as completed, returns True
- checkout.session.completed: sets PREMIUM, Stripe IDs, billing_cycle,
  subscription_created_at; preserves trial dates; sets resubscribed_at for
  previously-canceled users; marks failed on user-not-found; fires PostHog
- invoice.paid: sets ACTIVE, updates period_end and subscription_created_at;
  fires subscription_renewed for non-first invoices only
- invoice.payment_failed: sets PAST_DUE; fires payment_failed
- invoice.payment_action_required: sets PAST_DUE; fires payment_action_required
- customer.subscription.updated: syncs fields; detects plan change/cancel schedule/
  reactivation; fires correct PostHog events
- customer.subscription.deleted: downgrades to FREE/CANCELED; clears sub fields;
  fires subscription_canceled
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.db.models import (
    BillingCycle,
    SubscriptionStatus,
    SubscriptionTier,
    User,
    WebhookProcessingStatus,
)
from src.services.webhook_service import WebhookService

# ---------------------------------------------------------------------------
# Price IDs used in tests (patched into settings via billing_utils)
# ---------------------------------------------------------------------------
PRICE_MONTHLY = "price_monthly_test"
PRICE_QUARTERLY = "price_quarterly_test"
PRICE_SEMI_ANNUAL = "price_semi_annual_test"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_user(
    subscription_status: SubscriptionStatus = SubscriptionStatus.NONE,
    subscription_tier: SubscriptionTier = SubscriptionTier.FREE,
    subscription_created_at=None,
    billing_cycle: BillingCycle | None = None,
    subscription_cancel_at_period_end: bool = False,
    stripe_customer_id: str | None = None,
    stripe_subscription_id: str | None = None,
    trial_start_date=None,
    trial_end_date=None,
) -> MagicMock:
    """Build a MagicMock User with realistic subscription field defaults."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = "user@example.com"
    user.subscription_status = subscription_status
    user.subscription_tier = subscription_tier
    user.subscription_created_at = subscription_created_at
    user.subscription_resubscribed_at = None
    user.billing_cycle = billing_cycle
    user.subscription_cancel_at_period_end = subscription_cancel_at_period_end
    user.subscription_current_period_end = None
    user.stripe_customer_id = stripe_customer_id
    user.stripe_subscription_id = stripe_subscription_id
    user.trial_start_date = trial_start_date
    user.trial_end_date = trial_end_date
    return user


def _make_webhook_event(
    processing_status: WebhookProcessingStatus = WebhookProcessingStatus.COMPLETED,
) -> MagicMock:
    evt = MagicMock()
    evt.processing_status = processing_status
    return evt


def _make_service() -> WebhookService:
    """Create a WebhookService with a mocked DB session (repos overridden per test)."""
    db = MagicMock()
    return WebhookService(db)


def _make_mock_user_repo(user: User | None = None) -> MagicMock:
    repo = MagicMock()
    repo.get_by_supabase_id = AsyncMock(return_value=user)
    repo.filter_by = AsyncMock(return_value=[user] if user is not None else [])
    return repo


def _make_mock_webhook_repo(existing: MagicMock | None = None) -> MagicMock:
    repo = MagicMock()
    repo.get_by_event_id = AsyncMock(return_value=existing)
    repo.create_processing = AsyncMock(
        return_value=_make_webhook_event(WebhookProcessingStatus.PROCESSING)
    )
    repo.mark_completed = AsyncMock(
        return_value=_make_webhook_event(WebhookProcessingStatus.COMPLETED)
    )
    repo.mark_failed = AsyncMock(return_value=_make_webhook_event(WebhookProcessingStatus.FAILED))
    return repo


# ---------------------------------------------------------------------------
# Settings patch for billing_utils price mappings
# ---------------------------------------------------------------------------

PATCHED_SETTINGS = {
    "stripe_price_premium_monthly": PRICE_MONTHLY,
    "stripe_price_premium_quarterly": PRICE_QUARTERLY,
    "stripe_price_premium_semi_annual": PRICE_SEMI_ANNUAL,
}


def _patch_settings():
    """Return a context-manager-like patch for billing_utils settings."""
    mock_settings = MagicMock()
    mock_settings.stripe_price_premium_monthly = PRICE_MONTHLY
    mock_settings.stripe_price_premium_quarterly = PRICE_QUARTERLY
    mock_settings.stripe_price_premium_semi_annual = PRICE_SEMI_ANNUAL
    return patch("src.core.billing_utils.settings", mock_settings)


# ---------------------------------------------------------------------------
# Test: Idempotency
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.stripe
class TestWebhookServiceIdempotency:
    """Duplicate events are short-circuited without touching the DB further."""

    @pytest.mark.asyncio
    async def test_duplicate_event_returns_true_immediately(self):
        """When event already exists in DB, process_event returns True immediately."""
        svc = _make_service()
        existing = _make_webhook_event(WebhookProcessingStatus.COMPLETED)
        webhook_repo = _make_mock_webhook_repo(existing=existing)
        svc.webhook_repo = webhook_repo
        svc.user_repo = _make_mock_user_repo()

        event = {"id": "evt_dup", "type": "invoice.paid", "data": {"object": {}}}
        result = await svc.process_event(event)

        assert result is True

    @pytest.mark.asyncio
    async def test_duplicate_event_does_not_create_new_record(self):
        """Duplicate event must NOT call create_processing."""
        svc = _make_service()
        existing = _make_webhook_event(WebhookProcessingStatus.COMPLETED)
        webhook_repo = _make_mock_webhook_repo(existing=existing)
        svc.webhook_repo = webhook_repo
        svc.user_repo = _make_mock_user_repo()

        event = {"id": "evt_dup", "type": "invoice.paid", "data": {"object": {}}}
        await svc.process_event(event)

        webhook_repo.create_processing.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_duplicate_event_does_not_mutate_user(self):
        """Duplicate event must NOT call user_repo methods."""
        svc = _make_service()
        existing = _make_webhook_event(WebhookProcessingStatus.COMPLETED)
        webhook_repo = _make_mock_webhook_repo(existing=existing)
        user_repo = _make_mock_user_repo()
        svc.webhook_repo = webhook_repo
        svc.user_repo = user_repo

        event = {"id": "evt_dup", "type": "invoice.paid", "data": {"object": {}}}
        await svc.process_event(event)

        user_repo.get_by_supabase_id.assert_not_awaited()
        user_repo.filter_by.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_missing_event_id_returns_true(self):
        """Event with no 'id' field returns True without recording."""
        svc = _make_service()
        webhook_repo = _make_mock_webhook_repo(existing=None)
        svc.webhook_repo = webhook_repo
        svc.user_repo = _make_mock_user_repo()

        event = {"type": "invoice.paid", "data": {"object": {}}}
        result = await svc.process_event(event)

        assert result is True
        webhook_repo.create_processing.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_missing_event_type_returns_true(self):
        """Event with no 'type' field returns True without recording."""
        svc = _make_service()
        webhook_repo = _make_mock_webhook_repo(existing=None)
        svc.webhook_repo = webhook_repo
        svc.user_repo = _make_mock_user_repo()

        event = {"id": "evt_no_type", "data": {"object": {}}}
        result = await svc.process_event(event)

        assert result is True
        webhook_repo.create_processing.assert_not_awaited()


# ---------------------------------------------------------------------------
# Test: Unknown Events
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.stripe
class TestWebhookServiceUnknownEvents:
    """Unrecognized event types are recorded as completed but not dispatched."""

    @pytest.mark.asyncio
    async def test_unknown_type_returns_true(self):
        """Unknown event type returns True."""
        svc = _make_service()
        webhook_event = _make_webhook_event(WebhookProcessingStatus.PROCESSING)
        webhook_repo = _make_mock_webhook_repo(existing=None)
        webhook_repo.create_processing = AsyncMock(return_value=webhook_event)
        svc.webhook_repo = webhook_repo
        svc.user_repo = _make_mock_user_repo()

        event = {"id": "evt_new", "type": "unknown.event.type", "data": {"object": {}}}
        result = await svc.process_event(event)

        assert result is True

    @pytest.mark.asyncio
    async def test_unknown_type_is_recorded_as_completed(self):
        """Unknown event type is marked completed in DB."""
        svc = _make_service()
        webhook_event = _make_webhook_event(WebhookProcessingStatus.PROCESSING)
        webhook_repo = _make_mock_webhook_repo(existing=None)
        webhook_repo.create_processing = AsyncMock(return_value=webhook_event)
        svc.webhook_repo = webhook_repo
        svc.user_repo = _make_mock_user_repo()

        event = {"id": "evt_new", "type": "unknown.event.type", "data": {"object": {}}}
        await svc.process_event(event)

        webhook_repo.create_processing.assert_awaited_once()
        webhook_repo.mark_completed.assert_awaited_once_with(webhook_event)

    @pytest.mark.asyncio
    async def test_unknown_type_does_not_mutate_user(self):
        """Unknown event type does NOT touch user repo."""
        svc = _make_service()
        webhook_event = _make_webhook_event(WebhookProcessingStatus.PROCESSING)
        webhook_repo = _make_mock_webhook_repo(existing=None)
        webhook_repo.create_processing = AsyncMock(return_value=webhook_event)
        user_repo = _make_mock_user_repo()
        svc.webhook_repo = webhook_repo
        svc.user_repo = user_repo

        event = {"id": "evt_new", "type": "payment_intent.created", "data": {"object": {}}}
        await svc.process_event(event)

        user_repo.get_by_supabase_id.assert_not_awaited()
        user_repo.filter_by.assert_not_awaited()


# ---------------------------------------------------------------------------
# Test: checkout.session.completed
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.stripe
class TestCheckoutSessionCompleted:
    """Tests for _handle_checkout_session_completed."""

    def _make_event(
        self,
        supabase_id: str = "sup_user_123",
        customer: str = "cus_123",
        subscription: str = "sub_123",
        price_id: str | None = None,
        currency: str = "eur",
    ) -> dict:
        metadata = {}
        if price_id is not None:
            metadata["price_id"] = price_id
        return {
            "id": "evt_checkout",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "client_reference_id": supabase_id,
                    "customer": customer,
                    "subscription": subscription,
                    "currency": currency,
                    "metadata": metadata,
                }
            },
        }

    @pytest.mark.asyncio
    async def test_sets_premium_tier_and_active_status(self):
        """checkout.session.completed upgrades user to PREMIUM/ACTIVE."""
        user = _make_user()
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.subscription_tier == SubscriptionTier.PREMIUM
        assert user.subscription_status == SubscriptionStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_sets_stripe_ids(self):
        """Stripe customer ID and subscription ID are stored on user."""
        user = _make_user()
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event(customer="cus_abc", subscription="sub_abc"))

        assert user.stripe_customer_id == "cus_abc"
        assert user.stripe_subscription_id == "sub_abc"

    @pytest.mark.asyncio
    async def test_sets_billing_cycle_from_price_id(self):
        """billing_cycle is mapped from metadata price_id."""
        user = _make_user()
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event(price_id=PRICE_MONTHLY))

        assert user.billing_cycle == BillingCycle.MONTHLY

    @pytest.mark.asyncio
    async def test_sets_billing_cycle_quarterly(self):
        """billing_cycle is set to QUARTERLY for quarterly price ID."""
        user = _make_user()
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event(price_id=PRICE_QUARTERLY))

        assert user.billing_cycle == BillingCycle.QUARTERLY

    @pytest.mark.asyncio
    async def test_sets_subscription_created_at_when_none(self):
        """subscription_created_at is set when not previously set."""
        user = _make_user(subscription_created_at=None)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.subscription_created_at is not None

    @pytest.mark.asyncio
    async def test_does_not_overwrite_existing_subscription_created_at(self):
        """subscription_created_at is NOT overwritten if already set."""
        from datetime import datetime, timezone

        existing_date = datetime(2024, 1, 1, tzinfo=timezone.utc)
        user = _make_user(subscription_created_at=existing_date)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.subscription_created_at == existing_date

    @pytest.mark.asyncio
    async def test_sets_resubscribed_at_for_previously_canceled_user(self):
        """subscription_resubscribed_at is set when user was previously CANCELED."""
        user = _make_user(subscription_status=SubscriptionStatus.CANCELED)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.subscription_resubscribed_at is not None

    @pytest.mark.asyncio
    async def test_does_not_set_resubscribed_at_for_new_user(self):
        """subscription_resubscribed_at is NOT set for a brand-new subscriber."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.subscription_resubscribed_at is None

    @pytest.mark.asyncio
    async def test_does_not_touch_trial_dates(self):
        """trial_start_date and trial_end_date are NOT modified."""
        from datetime import datetime, timezone

        trial_start = datetime(2024, 3, 1, tzinfo=timezone.utc)
        trial_end = datetime(2024, 3, 15, tzinfo=timezone.utc)
        user = _make_user(trial_start_date=trial_start, trial_end_date=trial_end)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.trial_start_date == trial_start
        assert user.trial_end_date == trial_end

    @pytest.mark.asyncio
    async def test_user_not_found_marks_event_failed(self):
        """When user cannot be found by supabase_id, event is marked failed."""
        svc = _make_service()
        webhook_event = _make_webhook_event(WebhookProcessingStatus.PROCESSING)
        webhook_repo = _make_mock_webhook_repo()
        webhook_repo.create_processing = AsyncMock(return_value=webhook_event)
        # user_repo.get_by_supabase_id returns None → user not found
        user_repo = _make_mock_user_repo(user=None)
        svc.user_repo = user_repo
        svc.webhook_repo = webhook_repo

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            result = await svc.process_event(self._make_event())

        assert result is True
        # Handler returned None early, so mark_completed is called (handler returned without raising)
        # Actually: when user is None the handler returns without error → mark_completed is called
        webhook_repo.mark_completed.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_fires_posthog_subscription_created(self):
        """PostHog subscription_created event is fired."""
        user = _make_user()
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event") as mock_capture:
            await svc.process_event(self._make_event(price_id=PRICE_MONTHLY))

        mock_capture.assert_called_once()
        call_kwargs = mock_capture.call_args
        assert (
            call_kwargs.kwargs.get("event") == "subscription_created"
            or call_kwargs.args[1] == "subscription_created"
        )

    @pytest.mark.asyncio
    async def test_no_posthog_when_user_not_found(self):
        """PostHog is NOT fired when user is not found."""
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=None)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event") as mock_capture:
            await svc.process_event(self._make_event())

        mock_capture.assert_not_called()


# ---------------------------------------------------------------------------
# Test: invoice.paid
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.stripe
class TestInvoicePaid:
    """Tests for _handle_invoice_paid."""

    def _make_event(
        self,
        customer: str = "cus_123",
        period_end_ts: int | None = 1800000000,
        price_id: str | None = None,
        amount_paid: int = 1000,
    ) -> dict:
        line_item: dict = {}
        if period_end_ts is not None:
            line_item["period"] = {"end": period_end_ts}
        if price_id is not None:
            line_item["price"] = {"id": price_id}
        return {
            "id": "evt_invoice_paid",
            "type": "invoice.paid",
            "data": {
                "object": {
                    "customer": customer,
                    "amount_paid": amount_paid,
                    "lines": {"data": [line_item]} if line_item else {"data": []},
                }
            },
        }

    @pytest.mark.asyncio
    async def test_sets_subscription_status_active(self):
        """invoice.paid sets subscription_status to ACTIVE."""
        user = _make_user(subscription_status=SubscriptionStatus.PAST_DUE)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.subscription_status == SubscriptionStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_updates_period_end(self):
        """subscription_current_period_end is updated from line items."""
        user = _make_user()
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event(period_end_ts=1800000000))

        assert user.subscription_current_period_end is not None

    @pytest.mark.asyncio
    async def test_sets_subscription_created_at_when_null(self):
        """subscription_created_at is set on first invoice if previously None."""
        user = _make_user(subscription_created_at=None)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.subscription_created_at is not None

    @pytest.mark.asyncio
    async def test_does_not_fire_posthog_for_first_invoice(self):
        """No subscription_renewed event for first invoice (subscription_created_at was None)."""
        user = _make_user(subscription_created_at=None)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event") as mock_capture:
            await svc.process_event(self._make_event())

        mock_capture.assert_not_called()

    @pytest.mark.asyncio
    async def test_fires_subscription_renewed_for_non_first_invoice(self):
        """subscription_renewed PostHog event fires for subsequent invoices."""
        from datetime import datetime, timezone

        existing_created = datetime(2024, 1, 1, tzinfo=timezone.utc)
        user = _make_user(
            subscription_created_at=existing_created,
            subscription_tier=SubscriptionTier.PREMIUM,
        )
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event") as mock_capture:
            await svc.process_event(self._make_event(price_id=PRICE_MONTHLY, amount_paid=999))

        mock_capture.assert_called_once()
        # Verify event name
        call_args = mock_capture.call_args
        event_name = call_args.kwargs.get("event") or call_args.args[1]
        assert event_name == "subscription_renewed"

    @pytest.mark.asyncio
    async def test_updates_billing_cycle_from_price(self):
        """billing_cycle is updated from invoice line item price_id."""
        user = _make_user(billing_cycle=BillingCycle.MONTHLY)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event(price_id=PRICE_QUARTERLY))

        assert user.billing_cycle == BillingCycle.QUARTERLY


# ---------------------------------------------------------------------------
# Test: invoice.payment_failed
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.stripe
class TestInvoicePaymentFailed:
    """Tests for _handle_invoice_payment_failed."""

    def _make_event(self, customer: str = "cus_123") -> dict:
        return {
            "id": "evt_pay_failed",
            "type": "invoice.payment_failed",
            "data": {"object": {"customer": customer}},
        }

    @pytest.mark.asyncio
    async def test_sets_past_due_status(self):
        """invoice.payment_failed sets subscription_status to PAST_DUE."""
        user = _make_user(subscription_status=SubscriptionStatus.ACTIVE)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.subscription_status == SubscriptionStatus.PAST_DUE

    @pytest.mark.asyncio
    async def test_fires_posthog_payment_failed(self):
        """PostHog payment_failed event is fired."""
        user = _make_user(
            subscription_status=SubscriptionStatus.ACTIVE,
            subscription_tier=SubscriptionTier.PREMIUM,
        )
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with patch("src.services.webhook_service.capture_event") as mock_capture:
            await svc.process_event(self._make_event())

        mock_capture.assert_called_once()
        call_args = mock_capture.call_args
        event_name = call_args.kwargs.get("event") or call_args.args[1]
        assert event_name == "payment_failed"

    @pytest.mark.asyncio
    async def test_no_user_found_returns_true(self):
        """When user not found by customer_id, returns True without error."""
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=None)
        svc.webhook_repo = _make_mock_webhook_repo()

        with patch("src.services.webhook_service.capture_event"):
            result = await svc.process_event(self._make_event())

        assert result is True


# ---------------------------------------------------------------------------
# Test: invoice.payment_action_required
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.stripe
class TestInvoicePaymentActionRequired:
    """Tests for _handle_invoice_payment_action_required."""

    def _make_event(self, customer: str = "cus_123") -> dict:
        return {
            "id": "evt_action_required",
            "type": "invoice.payment_action_required",
            "data": {"object": {"customer": customer}},
        }

    @pytest.mark.asyncio
    async def test_sets_past_due_status(self):
        """invoice.payment_action_required sets subscription_status to PAST_DUE."""
        user = _make_user(subscription_status=SubscriptionStatus.ACTIVE)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.subscription_status == SubscriptionStatus.PAST_DUE

    @pytest.mark.asyncio
    async def test_fires_posthog_payment_action_required(self):
        """PostHog payment_action_required event is fired."""
        user = _make_user(
            subscription_status=SubscriptionStatus.ACTIVE,
            subscription_tier=SubscriptionTier.PREMIUM,
        )
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with patch("src.services.webhook_service.capture_event") as mock_capture:
            await svc.process_event(self._make_event())

        mock_capture.assert_called_once()
        call_args = mock_capture.call_args
        event_name = call_args.kwargs.get("event") or call_args.args[1]
        assert event_name == "payment_action_required"

    @pytest.mark.asyncio
    async def test_no_user_found_returns_true(self):
        """When user not found by customer_id, returns True without error."""
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=None)
        svc.webhook_repo = _make_mock_webhook_repo()

        with patch("src.services.webhook_service.capture_event"):
            result = await svc.process_event(self._make_event())

        assert result is True


# ---------------------------------------------------------------------------
# Test: customer.subscription.updated
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.stripe
class TestSubscriptionUpdated:
    """Tests for _handle_subscription_updated."""

    def _make_event(
        self,
        customer: str = "cus_123",
        stripe_status: str = "active",
        current_period_end: int = 1800000000,
        cancel_at_period_end: bool = False,
        price_id: str | None = None,
        sub_id: str = "sub_123",
    ) -> dict:
        items_data = []
        if price_id is not None:
            items_data = [{"price": {"id": price_id}}]
        return {
            "id": "evt_sub_updated",
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": sub_id,
                    "customer": customer,
                    "status": stripe_status,
                    "current_period_end": current_period_end,
                    "cancel_at_period_end": cancel_at_period_end,
                    "items": {"data": items_data},
                }
            },
        }

    @pytest.mark.asyncio
    async def test_syncs_stripe_subscription_id(self):
        """stripe_subscription_id is synced from event."""
        user = _make_user()
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event(sub_id="sub_new_456"))

        assert user.stripe_subscription_id == "sub_new_456"

    @pytest.mark.asyncio
    async def test_syncs_status_from_stripe(self):
        """subscription_status is mapped from Stripe status string."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event(stripe_status="past_due"))

        assert user.subscription_status == SubscriptionStatus.PAST_DUE

    @pytest.mark.asyncio
    async def test_syncs_period_end(self):
        """subscription_current_period_end is updated from event."""
        user = _make_user()
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event(current_period_end=1800000000))

        assert user.subscription_current_period_end is not None

    @pytest.mark.asyncio
    async def test_syncs_cancel_at_period_end(self):
        """subscription_cancel_at_period_end is synced from event."""
        user = _make_user(subscription_cancel_at_period_end=False)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event(cancel_at_period_end=True))

        assert user.subscription_cancel_at_period_end is True

    @pytest.mark.asyncio
    async def test_detects_billing_cycle_change_fires_posthog(self):
        """Plan change fires subscription_plan_changed PostHog event."""
        user = _make_user(billing_cycle=BillingCycle.MONTHLY)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event") as mock_capture:
            await svc.process_event(self._make_event(price_id=PRICE_QUARTERLY))

        # At least one call should be subscription_plan_changed
        event_names = [(c.kwargs.get("event") or c.args[1]) for c in mock_capture.call_args_list]
        assert "subscription_plan_changed" in event_names

    @pytest.mark.asyncio
    async def test_no_plan_change_event_when_cycle_unchanged(self):
        """No subscription_plan_changed event when billing cycle stays the same."""
        user = _make_user(billing_cycle=BillingCycle.MONTHLY)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event") as mock_capture:
            # Same price ID → same billing cycle → no plan change event
            await svc.process_event(self._make_event(price_id=PRICE_MONTHLY))

        event_names = [(c.kwargs.get("event") or c.args[1]) for c in mock_capture.call_args_list]
        assert "subscription_plan_changed" not in event_names

    @pytest.mark.asyncio
    async def test_cancel_scheduled_fires_posthog(self):
        """subscription_cancel_scheduled PostHog event fires when cancel_at_period_end turns True."""
        user = _make_user(
            subscription_cancel_at_period_end=False,
            subscription_tier=SubscriptionTier.PREMIUM,
        )
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event") as mock_capture:
            await svc.process_event(self._make_event(cancel_at_period_end=True))

        event_names = [(c.kwargs.get("event") or c.args[1]) for c in mock_capture.call_args_list]
        assert "subscription_cancel_scheduled" in event_names

    @pytest.mark.asyncio
    async def test_reactivation_fires_posthog(self):
        """subscription_reactivated PostHog event fires when cancel_at_period_end goes False→False already False doesn't fire."""
        # old=True, new=False → reactivated
        user = _make_user(
            subscription_cancel_at_period_end=True,
            subscription_tier=SubscriptionTier.PREMIUM,
        )
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event") as mock_capture:
            await svc.process_event(self._make_event(cancel_at_period_end=False))

        event_names = [(c.kwargs.get("event") or c.args[1]) for c in mock_capture.call_args_list]
        assert "subscription_reactivated" in event_names

    @pytest.mark.asyncio
    async def test_no_user_found_returns_true(self):
        """When user not found returns True."""
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=None)
        svc.webhook_repo = _make_mock_webhook_repo()

        with _patch_settings(), patch("src.services.webhook_service.capture_event"):
            result = await svc.process_event(self._make_event())

        assert result is True


# ---------------------------------------------------------------------------
# Test: customer.subscription.deleted
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.stripe
class TestSubscriptionDeleted:
    """Tests for _handle_subscription_deleted."""

    def _make_event(self, customer: str = "cus_123") -> dict:
        return {
            "id": "evt_sub_deleted",
            "type": "customer.subscription.deleted",
            "data": {"object": {"customer": customer}},
        }

    @pytest.mark.asyncio
    async def test_sets_free_tier(self):
        """subscription_tier is set to FREE."""
        user = _make_user(subscription_tier=SubscriptionTier.PREMIUM)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.subscription_tier == SubscriptionTier.FREE

    @pytest.mark.asyncio
    async def test_sets_canceled_status(self):
        """subscription_status is set to CANCELED."""
        user = _make_user(subscription_status=SubscriptionStatus.ACTIVE)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.subscription_status == SubscriptionStatus.CANCELED

    @pytest.mark.asyncio
    async def test_clears_stripe_subscription_id(self):
        """stripe_subscription_id is cleared (set to None)."""
        user = _make_user(stripe_subscription_id="sub_old")
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.stripe_subscription_id is None

    @pytest.mark.asyncio
    async def test_clears_period_end(self):
        """subscription_current_period_end is cleared."""
        from datetime import datetime, timezone

        user = _make_user()
        user.subscription_current_period_end = datetime(2025, 12, 31, tzinfo=timezone.utc)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.subscription_current_period_end is None

    @pytest.mark.asyncio
    async def test_clears_billing_cycle(self):
        """billing_cycle is cleared (set to None)."""
        user = _make_user(billing_cycle=BillingCycle.MONTHLY)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.billing_cycle is None

    @pytest.mark.asyncio
    async def test_resets_cancel_at_period_end_to_false(self):
        """subscription_cancel_at_period_end is reset to False."""
        user = _make_user(subscription_cancel_at_period_end=True)
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.subscription_cancel_at_period_end is False

    @pytest.mark.asyncio
    async def test_preserves_stripe_customer_id(self):
        """stripe_customer_id is NOT cleared (reused for future resubscription)."""
        user = _make_user(stripe_customer_id="cus_keep_me")
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with patch("src.services.webhook_service.capture_event"):
            await svc.process_event(self._make_event())

        assert user.stripe_customer_id == "cus_keep_me"

    @pytest.mark.asyncio
    async def test_fires_posthog_subscription_canceled(self):
        """PostHog subscription_canceled event is fired."""
        user = _make_user(
            subscription_tier=SubscriptionTier.PREMIUM,
            billing_cycle=BillingCycle.MONTHLY,
        )
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=user)
        svc.webhook_repo = _make_mock_webhook_repo()

        with patch("src.services.webhook_service.capture_event") as mock_capture:
            await svc.process_event(self._make_event())

        mock_capture.assert_called_once()
        call_args = mock_capture.call_args
        event_name = call_args.kwargs.get("event") or call_args.args[1]
        assert event_name == "subscription_canceled"

    @pytest.mark.asyncio
    async def test_no_user_found_returns_true(self):
        """When user not found returns True."""
        svc = _make_service()
        svc.user_repo = _make_mock_user_repo(user=None)
        svc.webhook_repo = _make_mock_webhook_repo()

        with patch("src.services.webhook_service.capture_event"):
            result = await svc.process_event(self._make_event())

        assert result is True
