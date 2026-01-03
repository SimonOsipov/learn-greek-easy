"""Integration tests for Sentry with FastAPI app.

Tests verify that Sentry integrates properly with the FastAPI application
without breaking normal operation, regardless of Sentry configuration.

These tests focus on verifying the Sentry module's behavior
in an application context rather than requiring full stack.
"""

from unittest.mock import patch

import pytest

import src.core.sentry as sentry_module


@pytest.mark.integration
@pytest.mark.sentry
class TestSentryModuleIntegration:
    """Test Sentry module integration behavior."""

    @pytest.fixture(autouse=True)
    def reset_sentry_state(self):
        """Reset global Sentry state before and after each test."""
        sentry_module._sentry_initialized = False
        yield
        sentry_module._sentry_initialized = False

    def test_sentry_disabled_in_test_mode(self):
        """Sentry should be disabled when is_testing is True.

        This is the production behavior during test runs.
        """
        with patch("src.core.sentry.settings") as mock_settings:
            mock_settings.is_testing = True
            mock_settings.sentry_dsn = "https://key@sentry.io/123"

            sentry_module.init_sentry()

            assert sentry_module.is_sentry_enabled() is False

    @patch("src.core.sentry.sentry_sdk")
    def test_sentry_initialization_sets_integrations(self, mock_sentry_sdk):
        """Sentry should be configured with FastAPI and SQLAlchemy integrations."""
        with patch("src.core.sentry.settings") as mock_settings:
            mock_settings.is_testing = False
            mock_settings.sentry_dsn = "https://key@sentry.io/123"
            mock_settings.sentry_environment = "test"
            mock_settings.sentry_traces_sample_rate = 0.1
            mock_settings.sentry_profiles_sample_rate = 0.1
            mock_settings.sentry_send_default_pii = False
            mock_settings.sentry_debug = False

            sentry_module.init_sentry()

            # Verify init was called with integrations
            call_kwargs = mock_sentry_sdk.init.call_args.kwargs
            integrations = call_kwargs["integrations"]

            # Should have 5 integrations: Starlette, FastAPI, SQLAlchemy, Redis, Loguru
            assert len(integrations) == 5

    @patch("src.core.sentry.sentry_sdk")
    def test_event_filtering_in_before_send(self, mock_sentry_sdk):
        """The before_send callback should filter test user events."""
        # Test the before_send function directly
        test_event = {"user": {"email": "e2e_learner@test.com"}, "message": "Error"}

        result = sentry_module._before_send(test_event, {})

        assert result is None  # Event filtered

    @patch("src.core.sentry.sentry_sdk")
    def test_header_sanitization_in_before_send(self, mock_sentry_sdk):
        """The before_send callback should sanitize sensitive headers."""
        event = {
            "user": {"email": "real@example.com"},
            "request": {
                "headers": {
                    "authorization": "Bearer secret-token",
                    "content-type": "application/json",
                }
            },
        }

        result = sentry_module._before_send(event, {})

        assert result["request"]["headers"]["authorization"] == "[Filtered]"
        assert result["request"]["headers"]["content-type"] == "application/json"

    @patch("src.core.sentry.sentry_sdk")
    def test_capture_exception_filters_test_users(self, mock_sentry_sdk):
        """capture_exception_if_needed should not capture for test users."""
        sentry_module._sentry_initialized = True
        exc = ValueError("Test error")

        result = sentry_module.capture_exception_if_needed(exc, user_email="test_user@test.com")

        assert result is None
        mock_sentry_sdk.capture_exception.assert_not_called()

    @patch("src.core.sentry.sentry_sdk")
    def test_shutdown_flushes_events(self, mock_sentry_sdk):
        """shutdown_sentry should flush pending events."""
        sentry_module._sentry_initialized = True

        sentry_module.shutdown_sentry()

        mock_sentry_sdk.flush.assert_called_once_with(timeout=5.0)
        assert sentry_module.is_sentry_enabled() is False


@pytest.mark.integration
@pytest.mark.sentry
class TestSentryEnvironmentConfiguration:
    """Test Sentry configuration from environment variables."""

    @pytest.fixture(autouse=True)
    def reset_sentry_state(self):
        """Reset global Sentry state before and after each test."""
        sentry_module._sentry_initialized = False
        yield
        sentry_module._sentry_initialized = False

    @patch("src.core.sentry.sentry_sdk")
    def test_environment_tag_applied(self, mock_sentry_sdk):
        """Sentry should apply environment tag from settings."""
        with patch("src.core.sentry.settings") as mock_settings:
            mock_settings.is_testing = False
            mock_settings.sentry_dsn = "https://key@sentry.io/123"
            mock_settings.sentry_environment = "staging"
            mock_settings.sentry_traces_sample_rate = 0.1
            mock_settings.sentry_profiles_sample_rate = 0.1
            mock_settings.sentry_send_default_pii = False
            mock_settings.sentry_debug = False

            sentry_module.init_sentry()

            call_kwargs = mock_sentry_sdk.init.call_args.kwargs
            assert call_kwargs["environment"] == "staging"

    @patch("src.core.sentry.sentry_sdk")
    def test_sample_rates_applied(self, mock_sentry_sdk):
        """Sentry should apply trace and profile sample rates from settings."""
        with patch("src.core.sentry.settings") as mock_settings:
            mock_settings.is_testing = False
            mock_settings.sentry_dsn = "https://key@sentry.io/123"
            mock_settings.sentry_environment = "production"
            mock_settings.sentry_traces_sample_rate = 0.5
            mock_settings.sentry_profiles_sample_rate = 0.25
            mock_settings.sentry_send_default_pii = False
            mock_settings.sentry_debug = False

            sentry_module.init_sentry()

            call_kwargs = mock_sentry_sdk.init.call_args.kwargs
            assert call_kwargs["traces_sample_rate"] == 0.5
            assert call_kwargs["profiles_sample_rate"] == 0.25

    @patch("src.core.sentry.sentry_sdk")
    def test_pii_setting_applied(self, mock_sentry_sdk):
        """Sentry should respect send_default_pii setting."""
        with patch("src.core.sentry.settings") as mock_settings:
            mock_settings.is_testing = False
            mock_settings.sentry_dsn = "https://key@sentry.io/123"
            mock_settings.sentry_environment = "production"
            mock_settings.sentry_traces_sample_rate = 0.1
            mock_settings.sentry_profiles_sample_rate = 0.1
            mock_settings.sentry_send_default_pii = True
            mock_settings.sentry_debug = False

            sentry_module.init_sentry()

            call_kwargs = mock_sentry_sdk.init.call_args.kwargs
            assert call_kwargs["send_default_pii"] is True
