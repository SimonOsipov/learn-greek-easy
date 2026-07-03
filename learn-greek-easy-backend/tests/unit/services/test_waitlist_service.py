"""Unit tests for WaitlistService resend_configured guards."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from src.services.waitlist_service import WaitlistAPIError, WaitlistDuplicateError, WaitlistService


@pytest.mark.asyncio
class TestWaitlistServiceGuards:
    """Tests for resend_configured early-exit guards."""

    async def test_subscribe_dry_run_when_resend_not_configured(self) -> None:
        """subscribe() returns success without calling Resend when API key is missing."""
        service = WaitlistService()
        background_tasks = MagicMock()
        with patch("src.services.waitlist_service.settings") as mock_settings:
            mock_settings.resend_configured = False
            result = await service.subscribe("test@example.com", background_tasks)
        assert result == {"message": "Check your email to confirm"}

    async def test_confirm_returns_false_when_resend_not_configured(self) -> None:
        """confirm() returns False without calling Resend when API key is missing."""
        service = WaitlistService()
        with patch("src.services.waitlist_service.settings") as mock_settings:
            mock_settings.resend_configured = False
            result = await service.confirm("some-contact-id.some-secret")
        assert result is False


@pytest.mark.asyncio
class TestWaitlistServiceOffPathEmail:
    """Tests for PERF-19-03: confirmation email is scheduled off the request path."""

    async def test_subscribe_enqueues_email_off_path(self) -> None:
        """subscribe() schedules the confirmation send via background_tasks.add_task
        (targeting EmailService.send) instead of calling send() inline.

        Pre-impl RED: subscribe() has no `background_tasks` param, so passing one
        raises TypeError (too many positional arguments).
        """
        service = WaitlistService()
        mock_background_tasks = MagicMock()
        with (
            patch("src.services.waitlist_service.settings") as mock_settings,
            patch("src.services.waitlist_service.resend") as mock_resend,
            patch("src.services.waitlist_service.capture_event"),
            patch("src.services.waitlist_service.get_email_service") as mock_get_email_service,
        ):
            mock_settings.resend_configured = True
            mock_settings.resend_audience_id = "aud_123"
            mock_settings.resend_api_key = "re_test_123456789"
            mock_settings.waitlist_frontend_base_url = "https://greeklish.eu"
            mock_resend.Contacts.create.return_value = {"id": "contact_123"}
            mock_resend.Contacts.update.return_value = {}
            mock_email_service = MagicMock()
            mock_get_email_service.return_value = mock_email_service

            result = await service.subscribe("test@example.com", mock_background_tasks)

        assert result == {"message": "Check your email to confirm"}

        mock_background_tasks.add_task.assert_called_once()
        call_args = mock_background_tasks.add_task.call_args
        assert call_args[0][0] == mock_email_service.send
        assert call_args.kwargs["to"] == "test@example.com"
        assert call_args.kwargs["subject"] == "Confirm your spot on the Greeklish waitlist"
        assert call_args.kwargs["from_address"] == "sam@greeklish.eu"
        assert "html" in call_args.kwargs

        # Fire-and-forget send must NOT happen inline — only via add_task above.
        mock_email_service.send.assert_not_called()

    async def test_subscribe_dry_run_does_not_schedule_email(self) -> None:
        """QA adversarial: the dry-run early-return (resend_configured=False) must not
        schedule ANY background task — regression guard against a future refactor that
        moves the add_task call before the dry-run guard.
        """
        service = WaitlistService()
        mock_background_tasks = MagicMock()
        with patch("src.services.waitlist_service.settings") as mock_settings:
            mock_settings.resend_configured = False
            result = await service.subscribe("test@example.com", mock_background_tasks)

        assert result == {"message": "Check your email to confirm"}
        mock_background_tasks.add_task.assert_not_called()

    async def test_subscribe_contact_create_duplicate_does_not_schedule_email(self) -> None:
        """QA adversarial: when Contacts.create raises a duplicate-email error, subscribe()
        must raise WaitlistDuplicateError BEFORE scheduling the confirmation email — the
        409 response path must never have an email queued behind it.
        """
        service = WaitlistService()
        mock_background_tasks = MagicMock()
        with (
            patch("src.services.waitlist_service.settings") as mock_settings,
            patch("src.services.waitlist_service.resend") as mock_resend,
            patch("src.services.waitlist_service.get_email_service") as mock_get_email_service,
        ):
            mock_settings.resend_configured = True
            mock_settings.resend_audience_id = "aud_123"
            mock_settings.resend_api_key = "re_test_123456789"
            mock_resend.Contacts.create.side_effect = Exception("409 already exists")

            with pytest.raises(WaitlistDuplicateError):
                await service.subscribe("test@example.com", mock_background_tasks)

        mock_background_tasks.add_task.assert_not_called()
        mock_get_email_service.return_value.send.assert_not_called()

    async def test_subscribe_contact_update_failure_does_not_schedule_email(self) -> None:
        """QA adversarial: when Contacts.create succeeds but the follow-up Contacts.update
        (token storage) fails, subscribe() must raise WaitlistAPIError BEFORE scheduling
        the confirmation email — the 502 response path must never have an email queued
        behind it.
        """
        service = WaitlistService()
        mock_background_tasks = MagicMock()
        with (
            patch("src.services.waitlist_service.settings") as mock_settings,
            patch("src.services.waitlist_service.resend") as mock_resend,
            patch("src.services.waitlist_service.get_email_service") as mock_get_email_service,
        ):
            mock_settings.resend_configured = True
            mock_settings.resend_audience_id = "aud_123"
            mock_settings.resend_api_key = "re_test_123456789"
            mock_resend.Contacts.create.return_value = {"id": "contact_123"}
            mock_resend.Contacts.update.side_effect = Exception("network error")

            with pytest.raises(WaitlistAPIError):
                await service.subscribe("test@example.com", mock_background_tasks)

        mock_background_tasks.add_task.assert_not_called()
        mock_get_email_service.return_value.send.assert_not_called()
