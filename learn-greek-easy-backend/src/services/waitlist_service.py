"""Waitlist service for managing email signups via Resend Contacts API.

Uses Resend Contacts API for contact management (create/get/update).
Email sending is delegated to EmailService (from EMAIL-01).

TOKEN STORAGE WORKAROUND:
Resend audience contacts do NOT support custom metadata properties.
The confirmation token secret is stored in the contact's `first_name` field.
After confirmation, `first_name` is cleared to "" (token consumed).
Idempotency: if first_name is empty AND unsubscribed=False, already confirmed.
"""

from __future__ import annotations

import hashlib
import secrets

import resend

from src.config import settings
from src.core.logging import get_logger
from src.core.posthog import capture_event
from src.services.email_service import get_email_service

logger = get_logger(__name__)


class WaitlistDuplicateError(Exception):
    """Raised when email already exists in Resend audience."""


class WaitlistAPIError(Exception):
    """Raised when a Resend API call fails unexpectedly."""


def _hash_email(email: str) -> str:
    """Return SHA-256 hex digest of lowercased, stripped email for PostHog distinct_id."""
    return hashlib.sha256(email.lower().strip().encode()).hexdigest()


def _build_confirmation_email(confirm_url: str) -> str:
    """Build plain-HTML confirmation email body with inline styles."""
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
  <div style="background: white; border-radius: 8px; padding: 40px; text-align: center;">
    <h1 style="color: #1a1a2e; margin-bottom: 8px;">Greekly</h1>
    <p style="color: #666; font-size: 16px; margin-bottom: 24px;">
      Thanks for signing up! Please confirm your email to secure your spot on the waitlist.
    </p>
    <a href="{confirm_url}"
       style="display: inline-block; background: #4f46e5; color: white; padding: 14px 32px;
              border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
      Confirm my spot
    </a>
    <p style="color: #999; font-size: 13px; margin-top: 24px;">
      If you didn't sign up for Greekly, you can safely ignore this email.
    </p>
  </div>
</body></html>"""


class WaitlistService:
    """Service for managing waitlist signups via Resend Contacts API."""

    def __init__(self) -> None:
        """Initialize. Stateless — no heavy setup."""

    async def subscribe(self, email: str) -> dict[str, str]:
        """Create a Resend contact, store token in first_name, send confirmation email.

        Returns:
            {"message": "Check your email to confirm"}

        Raises:
            WaitlistDuplicateError: if email already exists in audience.
            WaitlistAPIError: if any Resend API call fails.
        """
        if not settings.resend_configured:
            logger.info(
                "Waitlist subscribe (dry run — no API key configured)",
                extra={"email": email},
            )
            return {"message": "Check your email to confirm"}

        resend.api_key = settings.resend_api_key
        random_secret = secrets.token_urlsafe(32)

        # Create contact (unsubscribed=True = not yet confirmed)
        try:
            contact = resend.Contacts.create(
                {
                    "audience_id": settings.resend_audience_id,
                    "email": email,
                    "unsubscribed": True,
                    "first_name": "",
                    "last_name": "",
                }
            )
        except Exception as e:
            error_str = str(e).lower()
            if "409" in error_str or "already exists" in error_str or "already" in error_str:
                raise WaitlistDuplicateError(f"Email already registered: {email}") from e
            raise WaitlistAPIError(f"Failed to create Resend contact: {e}") from e

        contact_id: str = contact["id"]
        token = f"{contact_id}.{random_secret}"

        # Store secret in first_name (workaround — Resend contacts have no custom fields)
        try:
            resend.Contacts.update(
                {
                    "audience_id": settings.resend_audience_id,
                    "id": contact_id,
                    "unsubscribed": True,
                    "first_name": random_secret,
                }
            )
        except Exception as e:
            raise WaitlistAPIError(f"Failed to store token: {e}") from e

        # Build confirmation URL pointing to the frontend
        confirm_url = f"{settings.waitlist_frontend_base_url}/waitlist/confirm?token={token}"

        # Send confirmation email via shared EmailService (not resend.Emails.send directly)
        get_email_service().send(
            to=email,
            subject="Confirm your spot on the Greekly waitlist",
            html=_build_confirmation_email(confirm_url),
            from_address="sam@greeklish.eu",
        )

        # PostHog: server-side event, distinct_id = SHA-256 hash of email
        capture_event(
            distinct_id=_hash_email(email),
            event="waitlist_signup_submitted",
            properties={"source": "landing_page"},
        )

        return {"message": "Check your email to confirm"}

    async def confirm(self, token: str) -> bool:  # noqa: C901
        """Verify token, mark contact as subscribed.

        Returns:
            True if confirmed (or already confirmed), False if invalid token.
        """
        if not settings.resend_configured:
            return False

        # Split token into contact_id and random_secret
        if "." not in token:
            return False
        dot_idx = token.index(".")
        contact_id = token[:dot_idx]
        random_secret = token[dot_idx + 1 :]

        if not contact_id or not random_secret:
            return False

        resend.api_key = settings.resend_api_key

        # Fetch contact from Resend
        try:
            contact = resend.Contacts.get(
                audience_id=settings.resend_audience_id,
                id=contact_id,
            )
        except Exception:
            return False

        stored_secret: str = contact.get("first_name", "") or ""
        is_subscribed: bool = not contact.get("unsubscribed", True)

        # Idempotency: already confirmed (token consumed, contact subscribed)
        if not stored_secret and is_subscribed:
            return True

        # Token mismatch
        if stored_secret != random_secret:
            return False

        # Valid token — mark subscribed and clear token
        try:
            resend.Contacts.update(
                {
                    "audience_id": settings.resend_audience_id,
                    "id": contact_id,
                    "unsubscribed": False,
                    "first_name": "",
                }
            )
        except Exception:
            return False

        # PostHog: confirmed event
        email: str = contact.get("email", "")
        if email:
            capture_event(
                distinct_id=_hash_email(email),
                event="waitlist_signup_confirmed",
            )

        return True
