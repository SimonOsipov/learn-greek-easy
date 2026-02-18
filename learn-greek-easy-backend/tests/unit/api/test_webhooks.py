"""Unit tests for Stripe webhook endpoint.

Tests cover:
- Missing stripe-signature header → 400
- Invalid signature → 400
- Valid event → 200 {"received": true}
- Unknown event type → 200
- Webhook secret not configured → 500
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import stripe
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.api.v1.webhooks import router
from src.db.dependencies import get_db

# =============================================================================
# Test Fixtures
# =============================================================================

VALID_PAYLOAD = b'{"id":"evt_123","type":"customer.subscription.updated","data":{"object":{}}}'


@pytest.fixture
def app() -> FastAPI:
    """Create standalone test FastAPI app with webhook router (no DB)."""
    test_app = FastAPI()
    # router already has prefix="/webhooks", include at /api/v1 to match production routing
    test_app.include_router(router, prefix="/api/v1")

    # Override get_db dependency to avoid needing a real database
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    test_app.dependency_overrides[get_db] = override_get_db

    return test_app


@pytest.fixture
async def client(app: FastAPI) -> AsyncClient:
    """Create async test client for the standalone webhook app."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


# =============================================================================
# TestStripeWebhookEndpoint
# =============================================================================


@pytest.mark.unit
@pytest.mark.stripe
class TestStripeWebhookEndpoint:
    """Tests for POST /api/v1/webhooks/stripe endpoint."""

    async def test_missing_signature_header_returns_400(self, client: AsyncClient):
        """Request without stripe-signature header should return 400."""
        response = await client.post(
            "/api/v1/webhooks/stripe",
            content=VALID_PAYLOAD,
            headers={"content-type": "application/json"},
        )

        assert response.status_code == 400
        data = response.json()
        assert "stripe-signature" in data["detail"].lower()

    async def test_invalid_signature_returns_400(self, client: AsyncClient):
        """Request with invalid stripe signature should return 400."""
        with (
            patch("src.api.v1.webhooks.settings") as mock_settings,
            patch(
                "src.api.v1.webhooks.stripe.Webhook.construct_event",
                side_effect=stripe.SignatureVerificationError("Invalid signature", "t=123"),
            ),
        ):
            mock_settings.stripe_webhook_secret = "whsec_test_secret"

            response = await client.post(
                "/api/v1/webhooks/stripe",
                content=VALID_PAYLOAD,
                headers={
                    "content-type": "application/json",
                    "stripe-signature": "t=123,v1=bad_signature",
                },
            )

        assert response.status_code == 400
        data = response.json()
        assert "signature" in data["detail"].lower()

    async def test_valid_event_returns_200_received_true(self, client: AsyncClient):
        """Valid event with correct signature should return 200 with received: true."""
        mock_event = MagicMock()
        mock_event.type = "customer.subscription.updated"
        mock_event.id = "evt_123"

        with (
            patch("src.api.v1.webhooks.settings") as mock_settings,
            patch(
                "src.api.v1.webhooks.stripe.Webhook.construct_event",
                return_value=mock_event,
            ),
            patch("src.api.v1.webhooks.WebhookService") as mock_service_class,
        ):
            mock_settings.stripe_webhook_secret = "whsec_test_secret"
            mock_service = AsyncMock()
            mock_service.process_event = AsyncMock()
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/webhooks/stripe",
                content=VALID_PAYLOAD,
                headers={
                    "content-type": "application/json",
                    "stripe-signature": "t=123,v1=valid_signature",
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert data == {"received": True}

    async def test_unknown_event_type_returns_200(self, client: AsyncClient):
        """Unknown event type should still return 200 (all verified events accepted)."""
        mock_event = MagicMock()
        mock_event.type = "some.unknown.event"
        mock_event.id = "evt_unknown"

        with (
            patch("src.api.v1.webhooks.settings") as mock_settings,
            patch(
                "src.api.v1.webhooks.stripe.Webhook.construct_event",
                return_value=mock_event,
            ),
            patch("src.api.v1.webhooks.WebhookService") as mock_service_class,
        ):
            mock_settings.stripe_webhook_secret = "whsec_test_secret"
            mock_service = AsyncMock()
            mock_service.process_event = AsyncMock()
            mock_service_class.return_value = mock_service

            payload = b'{"id":"evt_unknown","type":"some.unknown.event","data":{"object":{}}}'
            response = await client.post(
                "/api/v1/webhooks/stripe",
                content=payload,
                headers={
                    "content-type": "application/json",
                    "stripe-signature": "t=123,v1=valid_signature",
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert data == {"received": True}

    async def test_webhook_secret_not_configured_returns_500(self, client: AsyncClient):
        """When stripe_webhook_secret is None, should return 500."""
        with patch("src.api.v1.webhooks.settings") as mock_settings:
            mock_settings.stripe_webhook_secret = None

            response = await client.post(
                "/api/v1/webhooks/stripe",
                content=VALID_PAYLOAD,
                headers={
                    "content-type": "application/json",
                    "stripe-signature": "t=123,v1=some_signature",
                },
            )

        assert response.status_code == 500
        data = response.json()
        assert "webhook secret" in data["detail"].lower()
