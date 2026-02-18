"""Stripe webhook endpoint.

Receives Stripe events, verifies signatures, and delegates to WebhookService.
Not behind JWT auth - authenticated via Stripe signature verification.
"""

import json

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.logging import get_logger
from src.db.dependencies import get_db
from src.services.webhook_service import WebhookService

logger = get_logger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/stripe", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Handle incoming Stripe webhook events.

    Reads raw body, verifies Stripe signature, delegates to WebhookService.
    Returns 200 for all successfully verified events.
    """
    # Read raw body - MUST happen before any JSON parsing
    payload = await request.body()

    # Get stripe-signature header
    sig_header = request.headers.get("stripe-signature")
    if not sig_header:
        logger.warning("Stripe webhook received without signature header")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing stripe-signature header",
        )

    # Check webhook secret is configured
    if not settings.stripe_webhook_secret:
        logger.error("stripe_webhook_secret is not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook secret not configured",
        )

    # Verify signature
    try:
        stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except stripe.SignatureVerificationError:
        logger.warning("Stripe webhook signature verification failed")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature",
        )

    # Parse event from raw payload (clean dict, no SDK objects)
    event_dict = json.loads(payload)

    logger.info(
        "Stripe webhook received",
        event_type=event_dict.get("type"),
        event_id=event_dict.get("id"),
    )

    webhook_service = WebhookService(db)
    await webhook_service.process_event(event_dict)

    return {"received": True}
