"""Unit tests for WaitlistService resend_configured guards."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from src.services.waitlist_service import WaitlistService


@pytest.mark.asyncio
class TestWaitlistServiceGuards:
    """Tests for resend_configured early-exit guards."""

    async def test_subscribe_dry_run_when_resend_not_configured(self) -> None:
        """subscribe() returns success without calling Resend when API key is missing."""
        service = WaitlistService()
        with patch("src.services.waitlist_service.settings") as mock_settings:
            mock_settings.resend_configured = False
            result = await service.subscribe("test@example.com")
        assert result == {"message": "Check your email to confirm"}

    async def test_confirm_returns_false_when_resend_not_configured(self) -> None:
        """confirm() returns False without calling Resend when API key is missing."""
        service = WaitlistService()
        with patch("src.services.waitlist_service.settings") as mock_settings:
            mock_settings.resend_configured = False
            result = await service.confirm("some-contact-id.some-secret")
        assert result is False
