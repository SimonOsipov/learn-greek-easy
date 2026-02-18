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

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    SubscriptionStatus,
    SubscriptionTier,
    WebhookEvent,
    WebhookProcessingStatus,
)
from tests.factories.auth import UserFactory

WEBHOOK_URL = "/api/v1/webhooks/stripe"


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
