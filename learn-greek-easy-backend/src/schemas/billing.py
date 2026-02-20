"""Billing schemas for checkout and subscription management."""

from pydantic import BaseModel, Field

from src.db.models import BillingCycle


class CheckoutRequest(BaseModel):
    """Schema for creating a checkout session."""

    billing_cycle: BillingCycle = Field(..., description="Billing cycle for the subscription")


class CheckoutResponse(BaseModel):
    """Schema for checkout session response."""

    checkout_url: str = Field(..., description="Stripe checkout session URL")
    session_id: str = Field(..., description="Stripe checkout session ID")
