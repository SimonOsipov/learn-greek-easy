"""Unit tests for EmailService.

Tests cover:
- Singleton pattern for get_email_service()
- Feature flag disabled results in silent no-op (no Resend call, no log)
- Empty API key results in payload logged at INFO level (no Resend call)
- Configured API key calls Resend API (mocked)
- Resend API error is caught and logged as WARNING, no exception raised
"""

from __future__ import annotations

import logging
from unittest.mock import MagicMock, patch

import pytest

from src.services.email_service import EmailService, get_email_service

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture()
def _reset_singleton():
    """Reset the singleton EmailService instance before and after each test."""
    import src.services.email_service as email_module

    email_module._email_service = None
    yield
    email_module._email_service = None


@pytest.fixture()
def mock_settings_disabled():
    """Settings with email feature flag disabled."""
    with patch("src.services.email_service.settings") as mock:
        mock.feature_email_notifications = False
        mock.resend_configured = False
        mock.resend_api_key = ""
        yield mock


@pytest.fixture()
def mock_settings_no_api_key():
    """Settings with feature flag enabled but no API key (log-only mode)."""
    with patch("src.services.email_service.settings") as mock:
        mock.feature_email_notifications = True
        mock.resend_configured = False
        mock.resend_api_key = ""
        yield mock


@pytest.fixture()
def mock_settings_configured():
    """Settings fully configured."""
    with patch("src.services.email_service.settings") as mock:
        mock.feature_email_notifications = True
        mock.resend_configured = True
        mock.resend_api_key = "re_test_123456789"
        yield mock


# ============================================================================
# Singleton Tests
# ============================================================================


@pytest.mark.unit
class TestGetEmailService:
    """Tests for get_email_service() singleton function."""

    def test_returns_singleton(self, _reset_singleton: None) -> None:
        """get_email_service() returns the same instance on repeated calls."""
        service1 = get_email_service()
        service2 = get_email_service()
        assert service1 is service2

    def test_creates_email_service_instance(self, _reset_singleton: None) -> None:
        """get_email_service() returns an EmailService."""
        service = get_email_service()
        assert isinstance(service, EmailService)


# ============================================================================
# Feature Flag Disabled — Silent No-Op
# ============================================================================


@pytest.mark.unit
class TestFeatureFlagDisabled:
    """When feature flag is disabled, send() is a silent no-op."""

    def test_no_resend_call_when_flag_off(
        self, _reset_singleton: None, mock_settings_disabled: MagicMock
    ) -> None:
        """No Resend SDK call when feature_email_notifications is False."""
        with patch("src.services.email_service.resend") as mock_resend:
            service = get_email_service()
            service.send(to="user@example.com", subject="Test", html="<p>Hello</p>")
            mock_resend.Emails.send.assert_not_called()

    def test_no_log_when_flag_off(
        self,
        _reset_singleton: None,
        mock_settings_disabled: MagicMock,
        caplog_loguru: pytest.LogCaptureFixture,
    ) -> None:
        """No log output when feature flag is off (truly silent)."""
        with patch("src.services.email_service.resend"):
            with caplog_loguru.at_level(logging.DEBUG):
                service = get_email_service()
                service.send(to="user@example.com", subject="Test", html="<p>Hello</p>")
        email_records = [
            r
            for r in caplog_loguru.records
            if "send" in r.message.lower() and "email" in r.message.lower()
        ]
        assert len(email_records) == 0


# ============================================================================
# Log-Only Mode (Empty API Key)
# ============================================================================


@pytest.mark.unit
class TestLogOnlyMode:
    """When feature flag is on but API key is empty, payload is logged at INFO."""

    def test_no_resend_call_without_api_key(
        self, _reset_singleton: None, mock_settings_no_api_key: MagicMock
    ) -> None:
        """No Resend SDK call when resend_configured is False."""
        with patch("src.services.email_service.resend") as mock_resend:
            service = get_email_service()
            service.send(to="user@example.com", subject="Welcome", html="<p>Hi</p>")
            mock_resend.Emails.send.assert_not_called()

    def test_payload_logged_at_info(
        self,
        _reset_singleton: None,
        mock_settings_no_api_key: MagicMock,
        caplog_loguru: pytest.LogCaptureFixture,
    ) -> None:
        """Email payload is logged at INFO level in dry-run mode."""
        with patch("src.services.email_service.resend"):
            with caplog_loguru.at_level(logging.INFO):
                service = get_email_service()
                service.send(to="user@example.com", subject="Welcome", html="<p>Hi</p>")
        info_records = [r for r in caplog_loguru.records if r.levelno == logging.INFO]
        assert (
            len(info_records) >= 1
        ), f"Expected at least one INFO log, got: {[r.message for r in caplog_loguru.records]}"


# ============================================================================
# Configured Mode — Successful Send
# ============================================================================


@pytest.mark.unit
class TestConfiguredSend:
    """When fully configured, emails are sent via Resend SDK."""

    def test_calls_resend_api(
        self, _reset_singleton: None, mock_settings_configured: MagicMock
    ) -> None:
        """Resend SDK is called when service is fully configured."""
        with patch("src.services.email_service.resend") as mock_resend:
            mock_resend.Emails.send.return_value = {"id": "msg_abc123"}
            service = get_email_service()
            service.send(to="user@example.com", subject="Welcome", html="<p>Hi</p>")
            mock_resend.Emails.send.assert_called_once()

    def test_resend_called_with_correct_params(
        self, _reset_singleton: None, mock_settings_configured: MagicMock
    ) -> None:
        """Resend SDK call includes correct to, subject, html, from fields."""
        with patch("src.services.email_service.resend") as mock_resend:
            mock_resend.Emails.send.return_value = {"id": "msg_abc123"}
            service = get_email_service()
            service.send(
                to="user@example.com",
                subject="Welcome to Greeklish",
                html="<p>Hi there</p>",
                from_address="sam@greeklish.eu",
            )
            call_args = mock_resend.Emails.send.call_args[0][0]
            assert call_args["to"] == ["user@example.com"]
            assert call_args["subject"] == "Welcome to Greeklish"
            assert call_args["from"] == "sam@greeklish.eu"


# ============================================================================
# Error Handling — Fire-and-Forget
# ============================================================================


@pytest.mark.unit
class TestErrorHandling:
    """Resend API errors are caught and logged as WARNING, never raised."""

    def test_resend_error_logged_as_warning(
        self,
        _reset_singleton: None,
        mock_settings_configured: MagicMock,
        caplog_loguru: pytest.LogCaptureFixture,
    ) -> None:
        """Exception from Resend is caught and logged as WARNING."""
        with patch("src.services.email_service.resend") as mock_resend:
            mock_resend.Emails.send.side_effect = Exception("Resend API unavailable")
            with caplog_loguru.at_level(logging.WARNING):
                service = get_email_service()
                service.send(to="user@example.com", subject="Test", html="<p>Hello</p>")
        warning_records = [r for r in caplog_loguru.records if r.levelno >= logging.WARNING]
        assert len(warning_records) >= 1

    def test_resend_error_does_not_propagate(
        self, _reset_singleton: None, mock_settings_configured: MagicMock
    ) -> None:
        """Exception from Resend is swallowed — caller receives nothing."""
        with patch("src.services.email_service.resend") as mock_resend:
            mock_resend.Emails.send.side_effect = RuntimeError("Network failure")
            service = get_email_service()
            # Must not raise
            service.send(to="user@example.com", subject="Test", html="<p>Hello</p>")
