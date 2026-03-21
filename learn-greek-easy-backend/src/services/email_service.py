"""Email service using Resend API for transactional emails.

Three-tier send logic:
1. feature_email_notifications=False → silent no-op (no logging)
2. resend_api_key empty → log payload at INFO level, no API call
3. Both conditions pass → call Resend SDK

All Resend API errors are caught and logged as WARNING, never re-raised
(fire-and-forget pattern).
"""

from __future__ import annotations

from typing import Any, Optional

import resend

from src.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)


class EmailService:
    """Service for sending transactional emails via Resend API."""

    def __init__(self) -> None:
        """Initialize EmailService. Stateless — no setup needed."""

    def send(
        self,
        *,
        to: str | list[str],
        subject: str,
        html: str,
        from_address: str = "Learn Greek Easy <noreply@learngreekeasy.com>",
        reply_to: str | None = None,
    ) -> None:
        """Send a transactional email via Resend.

        Three-tier logic:
        - feature_email_notifications=False: return immediately (silent no-op)
        - resend_api_key empty: log the email payload at INFO, return
        - Otherwise: call Resend API

        All Resend errors are caught, logged as WARNING, and swallowed.

        Args:
            to: Recipient email address(es).
            subject: Email subject line.
            html: HTML body content.
            from_address: Sender address.
            reply_to: Optional reply-to address.
        """
        if not settings.feature_email_notifications:
            return

        recipients = [to] if isinstance(to, str) else to

        if not settings.resend_configured:
            logger.info(
                "Email send (dry run — no API key configured)",
                extra={
                    "to": recipients,
                    "subject": subject,
                    "from_address": from_address,
                    "html_length": len(html),
                },
            )
            return

        try:
            resend.api_key = settings.resend_api_key

            params: Any = {
                "from": from_address,
                "to": recipients,
                "subject": subject,
                "html": html,
            }
            if reply_to is not None:
                params["reply_to"] = reply_to

            resend.Emails.send(params)

            logger.info(
                "Email sent via Resend",
                extra={
                    "to": recipients,
                    "subject": subject,
                },
            )
        except Exception:
            logger.warning(
                "Failed to send email via Resend",
                extra={
                    "to": recipients,
                    "subject": subject,
                },
                exc_info=True,
            )


_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Get or create the singleton EmailService instance.

    Returns:
        EmailService instance.
    """
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
