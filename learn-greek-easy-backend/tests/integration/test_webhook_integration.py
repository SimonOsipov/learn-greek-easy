"""Integration tests for the Stripe webhook endpoint.

Tests the full webhook processing pipeline with a real test database:
- checkout.session.completed upgrades user to PREMIUM
- Idempotency: duplicate event_id inserts only one WebhookEvent row
- customer.subscription.deleted downgrades user to FREE

Mocks only stripe.Webhook.construct_event to bypass signature verification.
All other layers (routing, service, repositories, DB) are real.
"""

import json
import time
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    SubscriptionStatus,
    SubscriptionTier,
    User,
    WebhookEvent,
    WebhookProcessingStatus,
)
from tests.factories.auth import UserFactory

WEBHOOK_URL = "/api/v1/webhooks/stripe"


# =============================================================================
# real_commit_session / real_commit_client (OPS-04-03)
# =============================================================================
#
# PAY-05-04: these two fixtures used to be defined here. They now live in
# tests/integration/conftest.py (alongside real_commit_authed_client, which
# builds on top of them) so other integration test modules can use them too
# -- see that file for the full docstrings and the SQLAlchemy
# join_transaction_mode rationale. Fixture resolution is name-based, so the
# tests below need no changes: pytest finds real_commit_client/
# real_commit_session in conftest.py automatically.


@pytest.mark.integration
@pytest.mark.stripe
class TestWebhookIntegration:
    """Integration tests for Stripe webhook endpoint using real database."""

    @pytest.mark.asyncio
    async def test_checkout_completed_creates_subscription(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """checkout.session.completed upgrades FREE user to PREMIUM with Stripe IDs set."""
        # Create a FREE user in the real DB
        user = await UserFactory.create(
            subscription_tier=SubscriptionTier.FREE,
            subscription_status=SubscriptionStatus.NONE,
            stripe_customer_id=None,
            stripe_subscription_id=None,
        )
        supabase_id = user.supabase_id

        event_id = "evt_test_checkout_001"
        payload = {
            "id": event_id,
            "object": "event",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "client_reference_id": supabase_id,
                    "customer": "cus_test123",
                    "subscription": "sub_test123",
                    "currency": "eur",
                    "metadata": {"price_id": None},
                }
            },
        }
        raw_body = json.dumps(payload).encode()

        with (
            patch("stripe.Webhook.construct_event") as mock_construct,
            patch("src.api.v1.webhooks.settings") as mock_settings,
        ):
            mock_construct.return_value = MagicMock()
            mock_settings.stripe_webhook_secret = "whsec_test"

            response = await client.post(
                WEBHOOK_URL,
                content=raw_body,
                headers={
                    "stripe-signature": "t=123,v1=fakesig",
                    "content-type": "application/json",
                },
            )

        assert response.status_code == 200
        assert response.json() == {"received": True}

        # Refresh user from DB and verify PREMIUM upgrade
        await db_session.refresh(user)
        assert user.subscription_tier == SubscriptionTier.PREMIUM
        assert user.subscription_status == SubscriptionStatus.ACTIVE
        assert user.stripe_customer_id == "cus_test123"
        assert user.stripe_subscription_id == "sub_test123"
        assert user.subscription_created_at is not None

        # Verify WebhookEvent row was created and marked COMPLETED
        result = await db_session.execute(
            select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        )
        webhook_event = result.scalar_one()
        assert webhook_event.processing_status == WebhookProcessingStatus.COMPLETED
        assert webhook_event.event_type == "checkout.session.completed"

    @pytest.mark.asyncio
    async def test_idempotency_with_real_db(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Sending the same event_id twice results in exactly one WebhookEvent row."""
        user = await UserFactory.create(
            subscription_tier=SubscriptionTier.FREE,
            subscription_status=SubscriptionStatus.NONE,
            stripe_customer_id=None,
            stripe_subscription_id=None,
        )
        supabase_id = user.supabase_id

        event_id = "evt_test_idempotency_001"
        payload = {
            "id": event_id,
            "object": "event",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "client_reference_id": supabase_id,
                    "customer": "cus_idempotency",
                    "subscription": "sub_idempotency",
                    "currency": "eur",
                    "metadata": {"price_id": None},
                }
            },
        }
        raw_body = json.dumps(payload).encode()

        with (
            patch("stripe.Webhook.construct_event") as mock_construct,
            patch("src.api.v1.webhooks.settings") as mock_settings,
        ):
            mock_construct.return_value = MagicMock()
            mock_settings.stripe_webhook_secret = "whsec_test"

            # Send the same event twice
            response1 = await client.post(
                WEBHOOK_URL,
                content=raw_body,
                headers={
                    "stripe-signature": "t=123,v1=fakesig",
                    "content-type": "application/json",
                },
            )
            response2 = await client.post(
                WEBHOOK_URL,
                content=raw_body,
                headers={
                    "stripe-signature": "t=123,v1=fakesig",
                    "content-type": "application/json",
                },
            )

        assert response1.status_code == 200
        assert response2.status_code == 200

        # Verify exactly one WebhookEvent row exists for this event_id
        count = await db_session.scalar(
            select(func.count(WebhookEvent.id)).where(WebhookEvent.event_id == event_id)
        )
        assert count == 1

    @pytest.mark.asyncio
    async def test_subscription_deleted_downgrades_user(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """customer.subscription.deleted downgrades PREMIUM user to FREE and clears fields."""
        user = await UserFactory.create(
            subscription_tier=SubscriptionTier.PREMIUM,
            subscription_status=SubscriptionStatus.ACTIVE,
            stripe_customer_id="cus_del_test",
            stripe_subscription_id="sub_del_test",
        )

        event_id = "evt_test_sub_deleted_001"
        payload = {
            "id": event_id,
            "object": "event",
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "id": "sub_del_test",
                    "customer": "cus_del_test",
                    "status": "canceled",
                    "items": {"data": [{"price": {"id": "price_test"}}]},
                    "current_period_end": int(time.time()),
                    "cancel_at_period_end": False,
                }
            },
        }
        raw_body = json.dumps(payload).encode()

        with (
            patch("stripe.Webhook.construct_event") as mock_construct,
            patch("src.api.v1.webhooks.settings") as mock_settings,
        ):
            mock_construct.return_value = MagicMock()
            mock_settings.stripe_webhook_secret = "whsec_test"

            response = await client.post(
                WEBHOOK_URL,
                content=raw_body,
                headers={
                    "stripe-signature": "t=123,v1=fakesig",
                    "content-type": "application/json",
                },
            )

        assert response.status_code == 200
        assert response.json() == {"received": True}

        # Refresh user and verify downgrade
        await db_session.refresh(user)
        assert user.subscription_tier == SubscriptionTier.FREE
        assert user.subscription_status == SubscriptionStatus.CANCELED
        # stripe_customer_id is intentionally preserved for resubscription
        assert user.stripe_customer_id == "cus_del_test"
        assert user.stripe_subscription_id is None
        assert user.billing_cycle is None
        assert user.subscription_cancel_at_period_end is False

        # Verify WebhookEvent row was created and marked COMPLETED
        result = await db_session.execute(
            select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        )
        webhook_event = result.scalar_one()
        assert webhook_event.processing_status == WebhookProcessingStatus.COMPLETED
        assert webhook_event.event_type == "customer.subscription.deleted"

    @pytest.mark.asyncio
    async def test_webhook_handler_failure_returns_500_and_rolls_back(
        self,
        real_commit_client: AsyncClient,
        real_commit_session: AsyncSession,
    ):
        """A matched handler that raises AFTER mutating the user must leave
        NOTHING committed: no partial user mutation, no webhook_events row --
        exercising the REAL get_db commit/rollback boundary
        (src/db/dependencies.py), which the shared `client` fixture's bare
        `yield db_session` override cannot observe (D7).

        Expected RED on pre-OPS-04-01 code (git a0594416^, i.e.
        5603f383 and earlier): the except-block inside process_event
        persisted a FAILED webhook_events row via the now-deleted
        failure-marking repo method and ALWAYS returned True; the route had
        no HTTPException-on-failure path and always returned 200. Because the
        route's real get_db then commits on that always-non-raising path,
        ALL THREE assertions below would fail on that code:
        (a) response.status_code would be 200, not 500;
        (b) fresh_user.stripe_subscription_id would be the NEW subscription
        id (the pre-exception mutation was committed), not None;
        (c) webhook_event would exist with processing_status=FAILED (via that
        now-deleted method), not None.
        """
        user = await UserFactory.create(
            session=real_commit_session,
            subscription_tier=SubscriptionTier.FREE,
            subscription_status=SubscriptionStatus.NONE,
            stripe_customer_id=f"cus_ops0403_fail_{uuid4().hex[:12]}",
            stripe_subscription_id=None,
        )
        # Checkpoint the seed into the outer transaction (release its
        # SAVEPOINT) BEFORE the request runs, so the request's own
        # rollback() cannot undo it too.
        await real_commit_session.commit()
        customer_id = user.stripe_customer_id
        user_id = user.id

        event_id = f"evt_ops0403_fail_{uuid4().hex[:12]}"
        new_subscription_id = f"sub_ops0403_fail_{uuid4().hex[:12]}"
        payload = {
            "id": event_id,
            "object": "event",
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": new_subscription_id,
                    "customer": customer_id,
                    "status": "active",
                    "items": {"data": [{"price": {"id": "price_test"}}]},
                    "current_period_end": int(time.time()),
                    "cancel_at_period_end": False,
                }
            },
        }
        raw_body = json.dumps(payload).encode()

        with (
            patch("stripe.Webhook.construct_event") as mock_construct,
            patch("src.api.v1.webhooks.settings") as mock_settings,
            patch(
                "src.services.webhook_service.stripe_status_to_subscription_status",
                side_effect=RuntimeError("boom"),
            ),
        ):
            mock_construct.return_value = MagicMock()
            mock_settings.stripe_webhook_secret = "whsec_test"

            response = await real_commit_client.post(
                WEBHOOK_URL,
                content=raw_body,
                headers={
                    "stripe-signature": "t=123,v1=fakesig",
                    "content-type": "application/json",
                },
            )

        assert response.status_code == 500

        # Re-observe via a FRESH select, not an expired-attribute read on the
        # pre-seeded `user` object -- this session's transaction has been
        # rolled back and restarted (join_transaction_mode) since `user` was
        # loaded, so touching a stale attribute on it risks MissingGreenlet.
        fresh_user = await real_commit_session.scalar(select(User).where(User.id == user_id))
        assert fresh_user is not None
        assert fresh_user.stripe_subscription_id is None

        webhook_event = await real_commit_session.scalar(
            select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        )
        assert webhook_event is None

    @pytest.mark.asyncio
    async def test_webhook_success_commits_via_restart_savepoint_fixture(
        self,
        real_commit_client: AsyncClient,
        real_commit_session: AsyncSession,
    ):
        """Non-tautology guard for the failure test above: proves
        real_commit_session/real_commit_client are NOT blind to all writes.

        Sends a SUCCESSFUL customer.subscription.updated (no patched raise)
        through the SAME fixture and asserts the mutation IS visible via a
        fresh select, and a COMPLETED WebhookEvent row exists. If this test
        failed, the failure test's "None / no row" assertions would be
        meaningless -- they could pass simply because the fixture never lets
        ANY write become visible, not because the rollback boundary
        actually works.
        """
        user = await UserFactory.create(
            session=real_commit_session,
            subscription_tier=SubscriptionTier.PREMIUM,
            subscription_status=SubscriptionStatus.ACTIVE,
            stripe_customer_id=f"cus_ops0403_ok_{uuid4().hex[:12]}",
            stripe_subscription_id=f"sub_ops0403_old_{uuid4().hex[:12]}",
        )
        await real_commit_session.commit()
        customer_id = user.stripe_customer_id
        user_id = user.id

        event_id = f"evt_ops0403_ok_{uuid4().hex[:12]}"
        new_subscription_id = f"sub_ops0403_new_{uuid4().hex[:12]}"
        payload = {
            "id": event_id,
            "object": "event",
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": new_subscription_id,
                    "customer": customer_id,
                    "status": "active",
                    "items": {"data": [{"price": {"id": "price_test"}}]},
                    "current_period_end": int(time.time()),
                    "cancel_at_period_end": False,
                }
            },
        }
        raw_body = json.dumps(payload).encode()

        with (
            patch("stripe.Webhook.construct_event") as mock_construct,
            patch("src.api.v1.webhooks.settings") as mock_settings,
        ):
            mock_construct.return_value = MagicMock()
            mock_settings.stripe_webhook_secret = "whsec_test"

            response = await real_commit_client.post(
                WEBHOOK_URL,
                content=raw_body,
                headers={
                    "stripe-signature": "t=123,v1=fakesig",
                    "content-type": "application/json",
                },
            )

        assert response.status_code == 200
        assert response.json() == {"received": True}

        fresh_user = await real_commit_session.scalar(select(User).where(User.id == user_id))
        assert fresh_user is not None
        assert fresh_user.stripe_subscription_id == new_subscription_id

        webhook_event = await real_commit_session.scalar(
            select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        )
        assert webhook_event is not None
        assert webhook_event.processing_status == WebhookProcessingStatus.COMPLETED
