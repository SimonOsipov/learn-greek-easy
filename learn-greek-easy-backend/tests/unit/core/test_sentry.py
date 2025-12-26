"""Unit tests for Sentry error tracking integration.

Tests cover:
- _is_test_user: Test user filtering by email patterns
- _before_send: Event filtering and header sanitization
- _before_send_transaction: Transaction filtering for test users
- init_sentry: Sentry SDK initialization conditions
- shutdown_sentry: Graceful shutdown with event flushing
- is_sentry_enabled: Initialization state checking
- capture_exception_if_needed: Exception capture with filtering
- set_user_context: User context setting
- set_request_context: Request tagging
- add_breadcrumb: Breadcrumb addition

Acceptance Criteria tested:
- AC #1: Test user patterns filtered correctly
- AC #2: Initialization conditions handled (DSN, testing mode)
- AC #3: Events filtered for test users before sending
- AC #4: Headers sanitized (authorization, cookie, x-api-key)
- AC #5: Graceful shutdown with error handling
"""

from unittest.mock import MagicMock, patch

import pytest

import src.core.sentry as sentry_module
from src.core.sentry import (
    _before_send,
    _before_send_transaction,
    _is_test_user,
    add_breadcrumb,
    capture_exception_if_needed,
    init_sentry,
    is_sentry_enabled,
    set_request_context,
    set_user_context,
    shutdown_sentry,
)


@pytest.fixture(autouse=True)
def reset_sentry_state():
    """Reset global Sentry state before and after each test."""
    sentry_module._sentry_initialized = False
    yield
    sentry_module._sentry_initialized = False


@pytest.mark.unit
@pytest.mark.sentry
class TestIsTestUser:
    """Tests for _is_test_user helper function.

    Test users are identified by:
    - Email starting with 'e2e_' or 'test_' (case-insensitive)
    - Email matching '*@test.*' pattern (case-insensitive)
    """

    def test_filters_test_prefix_email(self):
        """Should filter emails starting with test_."""
        assert _is_test_user("test_user@example.com") is True
        assert _is_test_user("test_@example.com") is True

    def test_filters_test_prefix_case_insensitive(self):
        """Should filter test_ prefix regardless of case."""
        assert _is_test_user("TEST_USER@example.com") is True
        assert _is_test_user("Test_User@example.com") is True

    def test_filters_e2e_prefix_email(self):
        """Should filter emails starting with e2e_."""
        assert _is_test_user("e2e_learner@example.com") is True
        assert _is_test_user("e2e_admin@example.com") is True

    def test_filters_e2e_prefix_case_insensitive(self):
        """Should filter e2e_ prefix regardless of case."""
        assert _is_test_user("E2E_admin@example.com") is True
        assert _is_test_user("E2E_User@example.com") is True

    def test_filters_test_email_domain(self):
        """Should filter emails with @test. domain."""
        assert _is_test_user("user@test.com") is True
        assert _is_test_user("admin@test.example.com") is True

    def test_filters_test_email_domain_case_insensitive(self):
        """Should filter @test. pattern regardless of case."""
        assert _is_test_user("USER@TEST.COM") is True
        assert _is_test_user("Admin@Test.Example.com") is True

    def test_allows_regular_users(self):
        """Should allow regular user emails."""
        assert _is_test_user("john@example.com") is False
        assert _is_test_user("user@gmail.com") is False

    def test_allows_non_prefixed_test_word(self):
        """Should allow emails that contain 'test' but don't START with test_."""
        assert _is_test_user("testing@example.com") is False
        assert _is_test_user("my_test@example.com") is False
        assert _is_test_user("unittest@example.com") is False

    def test_handles_none_value(self):
        """Should handle None value without error."""
        assert _is_test_user(None) is False

    def test_handles_empty_string(self):
        """Should handle empty string without error."""
        assert _is_test_user("") is False


@pytest.mark.unit
@pytest.mark.sentry
class TestBeforeSend:
    """Tests for _before_send event filtering callback."""

    def test_filters_test_user_events(self):
        """Should return None for test user events."""
        event = {"user": {"email": "e2e_learner@test.com"}}
        result = _before_send(event, {})
        assert result is None

    def test_allows_regular_user_events(self):
        """Should pass through events for regular users."""
        event = {"user": {"email": "john@example.com"}}
        result = _before_send(event, {})
        assert result == event

    def test_allows_events_without_user(self):
        """Should pass through events without user data."""
        event = {"message": "Something happened"}
        result = _before_send(event, {})
        assert result == event

    def test_allows_events_with_empty_user(self):
        """Should pass through events with empty user object."""
        event = {"user": {}}
        result = _before_send(event, {})
        assert result == event

    def test_sanitizes_authorization_header(self):
        """Should filter authorization header from requests."""
        event = {
            "user": {"email": "john@example.com"},
            "request": {"headers": {"authorization": "Bearer secret-token"}},
        }
        result = _before_send(event, {})
        assert result["request"]["headers"]["authorization"] == "[Filtered]"

    def test_sanitizes_cookie_header(self):
        """Should filter cookie header from requests."""
        event = {
            "user": {"email": "john@example.com"},
            "request": {"headers": {"cookie": "session=abc123"}},
        }
        result = _before_send(event, {})
        assert result["request"]["headers"]["cookie"] == "[Filtered]"

    def test_sanitizes_x_api_key_header(self):
        """Should filter x-api-key header from requests."""
        event = {
            "user": {"email": "john@example.com"},
            "request": {"headers": {"x-api-key": "my-api-key"}},
        }
        result = _before_send(event, {})
        assert result["request"]["headers"]["x-api-key"] == "[Filtered]"

    def test_sanitizes_x_test_seed_secret_header(self):
        """Should filter x-test-seed-secret header from requests."""
        event = {
            "user": {"email": "john@example.com"},
            "request": {"headers": {"x-test-seed-secret": "secret123"}},
        }
        result = _before_send(event, {})
        assert result["request"]["headers"]["x-test-seed-secret"] == "[Filtered]"

    def test_preserves_non_sensitive_headers(self):
        """Should preserve non-sensitive headers."""
        event = {
            "user": {"email": "john@example.com"},
            "request": {
                "headers": {"content-type": "application/json", "accept": "application/json"}
            },
        }
        result = _before_send(event, {})
        assert result["request"]["headers"]["content-type"] == "application/json"
        assert result["request"]["headers"]["accept"] == "application/json"

    def test_handles_event_without_request(self):
        """Should handle events without request data."""
        event = {"user": {"email": "john@example.com"}, "message": "Error"}
        result = _before_send(event, {})
        assert result == event

    def test_handles_request_without_headers(self):
        """Should handle requests without headers."""
        event = {"user": {"email": "john@example.com"}, "request": {"url": "/api/v1/test"}}
        result = _before_send(event, {})
        assert result == event


@pytest.mark.unit
@pytest.mark.sentry
class TestBeforeSendTransaction:
    """Tests for _before_send_transaction transaction filtering callback."""

    def test_filters_test_user_transactions(self):
        """Should return None for test user transactions."""
        event = {"user": {"email": "e2e_learner@test.com"}}
        result = _before_send_transaction(event, {})
        assert result is None

    def test_allows_regular_user_transactions(self):
        """Should pass through transactions for regular users."""
        event = {"user": {"email": "john@example.com"}}
        result = _before_send_transaction(event, {})
        assert result == event

    def test_allows_transactions_without_user(self):
        """Should pass through transactions without user data."""
        event = {"transaction": "/api/v1/cards"}
        result = _before_send_transaction(event, {})
        assert result == event

    def test_allows_transactions_with_empty_user(self):
        """Should pass through transactions with empty user object."""
        event = {"user": {}, "transaction": "/api/v1/decks"}
        result = _before_send_transaction(event, {})
        assert result == event

    def test_filters_test_prefix_user(self):
        """Should filter transactions from test_ prefixed users."""
        event = {"user": {"email": "test_user@example.com"}}
        result = _before_send_transaction(event, {})
        assert result is None

    def test_filters_test_domain_user(self):
        """Should filter transactions from @test. domain users."""
        event = {"user": {"email": "admin@test.example.com"}}
        result = _before_send_transaction(event, {})
        assert result is None


@pytest.mark.unit
@pytest.mark.sentry
class TestInitSentry:
    """Tests for init_sentry function."""

    @patch("src.core.sentry.sentry_sdk")
    @patch("src.core.sentry.settings")
    def test_initializes_with_dsn(self, mock_settings, mock_sentry_sdk):
        """Should initialize when DSN is present and not testing."""
        mock_settings.is_testing = False
        mock_settings.sentry_dsn = "https://key@sentry.io/123"
        mock_settings.sentry_environment = "development"
        mock_settings.sentry_traces_sample_rate = 0.1
        mock_settings.sentry_profiles_sample_rate = 0.1
        mock_settings.sentry_send_default_pii = False
        mock_settings.sentry_debug = False

        init_sentry()

        assert is_sentry_enabled() is True
        mock_sentry_sdk.init.assert_called_once()

    @patch("src.core.sentry.settings")
    def test_skips_when_is_testing_true(self, mock_settings):
        """Should skip initialization when is_testing is True."""
        mock_settings.is_testing = True
        mock_settings.sentry_dsn = "https://key@sentry.io/123"

        init_sentry()

        assert is_sentry_enabled() is False

    @patch("src.core.sentry.settings")
    def test_skips_when_no_dsn(self, mock_settings):
        """Should skip initialization when DSN is None."""
        mock_settings.is_testing = False
        mock_settings.sentry_dsn = None

        init_sentry()

        assert is_sentry_enabled() is False

    @patch("src.core.sentry.settings")
    def test_skips_when_dsn_empty(self, mock_settings):
        """Should skip initialization when DSN is empty string."""
        mock_settings.is_testing = False
        mock_settings.sentry_dsn = ""

        init_sentry()

        assert is_sentry_enabled() is False

    @patch("src.core.sentry.logger")
    def test_logs_warning_if_already_initialized(self, mock_logger):
        """Should log warning if called when already initialized."""
        sentry_module._sentry_initialized = True

        init_sentry()

        mock_logger.warning.assert_called_once_with("Sentry SDK already initialized")

    @patch("src.core.sentry.sentry_sdk")
    @patch("src.core.sentry.settings")
    def test_passes_configuration_to_sdk(self, mock_settings, mock_sentry_sdk):
        """Should pass correct configuration to Sentry SDK."""
        mock_settings.is_testing = False
        mock_settings.sentry_dsn = "https://key@sentry.io/123"
        mock_settings.sentry_environment = "production"
        mock_settings.sentry_traces_sample_rate = 0.5
        mock_settings.sentry_profiles_sample_rate = 0.2
        mock_settings.sentry_send_default_pii = True
        mock_settings.sentry_debug = True

        init_sentry()

        call_kwargs = mock_sentry_sdk.init.call_args.kwargs
        assert call_kwargs["dsn"] == "https://key@sentry.io/123"
        assert call_kwargs["environment"] == "production"
        assert call_kwargs["traces_sample_rate"] == 0.5
        assert call_kwargs["profiles_sample_rate"] == 0.2
        assert call_kwargs["send_default_pii"] is True
        assert call_kwargs["debug"] is True

    @patch("src.core.sentry.sentry_sdk")
    @patch("src.core.sentry.settings")
    @patch("src.core.sentry.logger")
    def test_handles_initialization_error(self, mock_logger, mock_settings, mock_sentry_sdk):
        """Should handle initialization errors gracefully."""
        mock_settings.is_testing = False
        mock_settings.sentry_dsn = "https://key@sentry.io/123"
        mock_sentry_sdk.init.side_effect = Exception("Init error")

        init_sentry()

        assert is_sentry_enabled() is False
        mock_logger.error.assert_called()


@pytest.mark.unit
@pytest.mark.sentry
class TestShutdownSentry:
    """Tests for shutdown_sentry function."""

    @patch("src.core.sentry.sentry_sdk")
    def test_flushes_and_resets_state(self, mock_sentry_sdk):
        """Should flush events and reset state."""
        sentry_module._sentry_initialized = True

        shutdown_sentry()

        mock_sentry_sdk.flush.assert_called_once_with(timeout=5.0)
        assert is_sentry_enabled() is False

    @patch("src.core.sentry.sentry_sdk")
    def test_no_op_when_not_initialized(self, mock_sentry_sdk):
        """Should do nothing when Sentry is not initialized."""
        sentry_module._sentry_initialized = False

        shutdown_sentry()

        mock_sentry_sdk.flush.assert_not_called()

    @patch("src.core.sentry.sentry_sdk")
    @patch("src.core.sentry.logger")
    def test_handles_shutdown_exception(self, mock_logger, mock_sentry_sdk):
        """Should handle exceptions gracefully without raising."""
        sentry_module._sentry_initialized = True
        mock_sentry_sdk.flush.side_effect = Exception("Flush error")

        # Should not raise
        shutdown_sentry()

        # Should still reset initialized flag
        assert is_sentry_enabled() is False
        mock_logger.error.assert_called()

    @patch("src.core.sentry.sentry_sdk")
    def test_resets_state_even_on_error(self, mock_sentry_sdk):
        """Should reset _sentry_initialized even when shutdown fails."""
        sentry_module._sentry_initialized = True
        mock_sentry_sdk.flush.side_effect = Exception("Flush error")

        shutdown_sentry()

        # State should be reset despite error
        assert sentry_module._sentry_initialized is False


@pytest.mark.unit
@pytest.mark.sentry
class TestIsSentryEnabled:
    """Tests for is_sentry_enabled function."""

    def test_returns_false_when_not_initialized(self):
        """Should return False when not initialized."""
        sentry_module._sentry_initialized = False
        assert is_sentry_enabled() is False

    def test_returns_true_when_initialized(self):
        """Should return True when initialized."""
        sentry_module._sentry_initialized = True
        assert is_sentry_enabled() is True


@pytest.mark.unit
@pytest.mark.sentry
class TestCaptureExceptionIfNeeded:
    """Tests for capture_exception_if_needed function."""

    @patch("src.core.sentry.sentry_sdk")
    def test_captures_exception_when_enabled(self, mock_sentry_sdk):
        """Should capture exception when Sentry is initialized."""
        sentry_module._sentry_initialized = True
        mock_sentry_sdk.capture_exception.return_value = "event-123"
        exc = ValueError("Test error")

        result = capture_exception_if_needed(exc, user_email="john@example.com")

        assert result == "event-123"
        mock_sentry_sdk.capture_exception.assert_called_once_with(exc)

    @patch("src.core.sentry.sentry_sdk")
    def test_returns_none_when_not_initialized(self, mock_sentry_sdk):
        """Should return None when Sentry is not initialized."""
        sentry_module._sentry_initialized = False
        exc = ValueError("Test error")

        result = capture_exception_if_needed(exc)

        assert result is None
        mock_sentry_sdk.capture_exception.assert_not_called()

    @patch("src.core.sentry.sentry_sdk")
    def test_filters_test_users(self, mock_sentry_sdk):
        """Should not capture exceptions for test users."""
        sentry_module._sentry_initialized = True
        exc = ValueError("Test error")

        result = capture_exception_if_needed(exc, user_email="e2e_learner@test.com")

        assert result is None
        mock_sentry_sdk.capture_exception.assert_not_called()

    @patch("src.core.sentry.sentry_sdk")
    def test_filters_test_prefix_users(self, mock_sentry_sdk):
        """Should not capture exceptions for test_ prefixed users."""
        sentry_module._sentry_initialized = True
        exc = ValueError("Test error")

        result = capture_exception_if_needed(exc, user_email="test_user@example.com")

        assert result is None
        mock_sentry_sdk.capture_exception.assert_not_called()

    @patch("src.core.sentry.sentry_sdk")
    def test_adds_extra_context(self, mock_sentry_sdk):
        """Should add extra context to scope."""
        sentry_module._sentry_initialized = True
        mock_scope = MagicMock()
        mock_sentry_sdk.push_scope.return_value.__enter__ = MagicMock(return_value=mock_scope)
        mock_sentry_sdk.push_scope.return_value.__exit__ = MagicMock(return_value=False)
        mock_sentry_sdk.capture_exception.return_value = "event-123"
        exc = ValueError("Test error")

        capture_exception_if_needed(exc, extra={"key": "value", "another": 123})

        mock_scope.set_extra.assert_any_call("key", "value")
        mock_scope.set_extra.assert_any_call("another", 123)

    @patch("src.core.sentry.sentry_sdk")
    @patch("src.core.sentry.logger")
    def test_handles_capture_exception(self, mock_logger, mock_sentry_sdk):
        """Should handle exceptions gracefully without raising."""
        sentry_module._sentry_initialized = True
        mock_sentry_sdk.push_scope.side_effect = Exception("Capture error")
        exc = ValueError("Test error")

        # Should not raise
        result = capture_exception_if_needed(exc)

        assert result is None
        mock_logger.error.assert_called()


@pytest.mark.unit
@pytest.mark.sentry
class TestSetUserContext:
    """Tests for set_user_context function."""

    @patch("src.core.sentry.sentry_sdk")
    @patch("src.core.sentry.settings")
    def test_sets_user_context(self, mock_settings, mock_sentry_sdk):
        """Should set user context with id and username."""
        sentry_module._sentry_initialized = True
        mock_settings.sentry_send_default_pii = False

        set_user_context("user-123", email="john@example.com", username="John Doe")

        mock_sentry_sdk.set_user.assert_called_once()
        call_args = mock_sentry_sdk.set_user.call_args[0][0]
        assert call_args["id"] == "user-123"
        assert call_args["username"] == "John Doe"
        # Email not included when PII disabled
        assert "email" not in call_args

    @patch("src.core.sentry.sentry_sdk")
    @patch("src.core.sentry.settings")
    def test_includes_email_when_pii_enabled(self, mock_settings, mock_sentry_sdk):
        """Should include email when send_default_pii is True."""
        sentry_module._sentry_initialized = True
        mock_settings.sentry_send_default_pii = True

        set_user_context("user-123", email="john@example.com")

        call_args = mock_sentry_sdk.set_user.call_args[0][0]
        assert call_args["email"] == "john@example.com"

    @patch("src.core.sentry.sentry_sdk")
    def test_no_op_when_not_initialized(self, mock_sentry_sdk):
        """Should do nothing when Sentry is not initialized."""
        sentry_module._sentry_initialized = False

        set_user_context("user-123")

        mock_sentry_sdk.set_user.assert_not_called()

    @patch("src.core.sentry.sentry_sdk")
    def test_filters_test_users(self, mock_sentry_sdk):
        """Should not set context for test users."""
        sentry_module._sentry_initialized = True

        set_user_context("user-123", email="e2e_learner@test.com")

        mock_sentry_sdk.set_user.assert_not_called()

    @patch("src.core.sentry.sentry_sdk")
    @patch("src.core.sentry.settings")
    def test_sets_context_without_optional_fields(self, mock_settings, mock_sentry_sdk):
        """Should set context with only user_id when other fields absent."""
        sentry_module._sentry_initialized = True
        mock_settings.sentry_send_default_pii = False

        set_user_context("user-123")

        call_args = mock_sentry_sdk.set_user.call_args[0][0]
        assert call_args == {"id": "user-123"}


@pytest.mark.unit
@pytest.mark.sentry
class TestSetRequestContext:
    """Tests for set_request_context function."""

    @patch("src.core.sentry.sentry_sdk")
    def test_sets_request_tags(self, mock_sentry_sdk):
        """Should set request_id and endpoint tags."""
        sentry_module._sentry_initialized = True

        set_request_context("req-123", "/api/v1/cards")

        mock_sentry_sdk.set_tag.assert_any_call("request_id", "req-123")
        mock_sentry_sdk.set_tag.assert_any_call("endpoint", "/api/v1/cards")

    @patch("src.core.sentry.sentry_sdk")
    def test_no_op_when_not_initialized(self, mock_sentry_sdk):
        """Should do nothing when Sentry is not initialized."""
        sentry_module._sentry_initialized = False

        set_request_context("req-123", "/api/v1/cards")

        mock_sentry_sdk.set_tag.assert_not_called()


@pytest.mark.unit
@pytest.mark.sentry
class TestAddBreadcrumb:
    """Tests for add_breadcrumb function."""

    @patch("src.core.sentry.sentry_sdk")
    def test_adds_breadcrumb(self, mock_sentry_sdk):
        """Should add breadcrumb with all parameters."""
        sentry_module._sentry_initialized = True

        add_breadcrumb("auth", "User logged in", level="info", data={"method": "google"})

        mock_sentry_sdk.add_breadcrumb.assert_called_once_with(
            category="auth",
            message="User logged in",
            level="info",
            data={"method": "google"},
        )

    @patch("src.core.sentry.sentry_sdk")
    def test_adds_breadcrumb_with_defaults(self, mock_sentry_sdk):
        """Should add breadcrumb with default level."""
        sentry_module._sentry_initialized = True

        add_breadcrumb("database", "Query executed")

        mock_sentry_sdk.add_breadcrumb.assert_called_once_with(
            category="database",
            message="Query executed",
            level="info",
            data=None,
        )

    @patch("src.core.sentry.sentry_sdk")
    def test_no_op_when_not_initialized(self, mock_sentry_sdk):
        """Should do nothing when Sentry is not initialized."""
        sentry_module._sentry_initialized = False

        add_breadcrumb("auth", "User logged in")

        mock_sentry_sdk.add_breadcrumb.assert_not_called()
