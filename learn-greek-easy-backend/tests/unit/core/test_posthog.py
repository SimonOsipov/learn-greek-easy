"""Unit tests for PostHog analytics integration.

Tests cover:
- _is_test_user: Test user filtering by distinct_id and email patterns
- init_posthog: PostHog SDK initialization conditions
- capture_event: Event capture with properties and test user filtering
- identify_user: User identification with properties
- shutdown_posthog: Graceful shutdown with event flushing
- is_posthog_enabled: Initialization state checking

Acceptance Criteria tested:
- AC #1: Test user patterns filtered correctly
- AC #2: Initialization conditions handled (API key, testing mode)
- AC #3: Events captured with default properties
- AC #4: Test users filtered from events and identification
- AC #5: Graceful shutdown with error handling
"""

from unittest.mock import patch

import pytest

import src.core.posthog as posthog_module
from src.core.posthog import (
    _is_test_user,
    capture_event,
    identify_user,
    init_posthog,
    is_posthog_enabled,
    shutdown_posthog,
)


@pytest.fixture(autouse=True)
def reset_posthog_state():
    """Reset global PostHog state before and after each test."""
    posthog_module._posthog_initialized = False
    yield
    posthog_module._posthog_initialized = False


@pytest.mark.unit
@pytest.mark.posthog
class TestIsTestUser:
    """Tests for _is_test_user helper function.

    Test users are identified by:
    - distinct_id starting with 'e2e_' or 'test_' (case-insensitive)
    - email matching '*@test.*' pattern (case-insensitive)
    """

    def test_filters_test_prefix_distinct_id(self):
        """Should filter distinct_id starting with test_."""
        assert _is_test_user("test_user_123", None) is True
        assert _is_test_user("test_", None) is True

    def test_filters_test_prefix_case_insensitive(self):
        """Should filter test_ prefix regardless of case."""
        assert _is_test_user("TEST_USER_123", None) is True
        assert _is_test_user("Test_User", None) is True

    def test_filters_e2e_prefix_distinct_id(self):
        """Should filter distinct_id starting with e2e_."""
        assert _is_test_user("e2e_learner", None) is True
        assert _is_test_user("e2e_admin", None) is True

    def test_filters_e2e_prefix_case_insensitive(self):
        """Should filter e2e_ prefix regardless of case."""
        assert _is_test_user("E2E_admin", None) is True
        assert _is_test_user("E2E_User", None) is True

    def test_filters_test_email_domain(self):
        """Should filter emails with @test. domain."""
        assert _is_test_user(None, "user@test.com") is True
        assert _is_test_user(None, "admin@test.example.com") is True

    def test_filters_test_email_case_insensitive(self):
        """Should filter @test. pattern regardless of case."""
        assert _is_test_user(None, "USER@TEST.COM") is True
        assert _is_test_user(None, "Admin@Test.Example.com") is True

    def test_allows_regular_users(self):
        """Should allow regular user IDs and emails."""
        assert _is_test_user("user-123", "john@example.com") is False
        assert _is_test_user("regular_user", "test@gmail.com") is False

    def test_allows_non_prefixed_test_word(self):
        """Should allow IDs that contain 'test' but don't START with test_."""
        assert _is_test_user("testing_user", None) is False
        assert _is_test_user("my_test_user", None) is False
        assert _is_test_user("unittest", None) is False

    def test_handles_none_values(self):
        """Should handle None values without error."""
        assert _is_test_user(None, None) is False

    def test_filters_by_distinct_id_only(self):
        """Should filter if distinct_id matches, even with regular email."""
        assert _is_test_user("test_user", "regular@example.com") is True

    def test_filters_by_email_only(self):
        """Should filter if email matches, even with regular distinct_id."""
        assert _is_test_user("regular-user", "admin@test.com") is True

    def test_filters_by_either_distinct_id_or_email(self):
        """Should filter if EITHER distinct_id OR email matches."""
        assert _is_test_user("test_user", "regular@example.com") is True
        assert _is_test_user("regular-user", "admin@test.com") is True
        # Both matching should also be filtered
        assert _is_test_user("e2e_user", "e2e@test.com") is True


@pytest.mark.unit
@pytest.mark.posthog
class TestInitPosthog:
    """Tests for init_posthog function."""

    @patch("src.core.posthog.posthog")
    @patch("src.core.posthog.settings")
    def test_initializes_with_api_key(self, mock_settings, mock_posthog):
        """Should initialize when API key is present and not testing."""
        mock_settings.is_testing = False
        mock_settings.posthog_api_key = "phc_test123"
        mock_settings.posthog_host = "https://us.i.posthog.com"
        mock_settings.debug = False
        mock_settings.app_env = "development"

        init_posthog()

        assert is_posthog_enabled() is True
        assert mock_posthog.project_api_key == "phc_test123"
        assert mock_posthog.host == "https://us.i.posthog.com"

    @patch("src.core.posthog.settings")
    def test_skips_when_is_testing_true(self, mock_settings):
        """Should skip initialization when is_testing is True."""
        mock_settings.is_testing = True
        mock_settings.posthog_api_key = "phc_test123"

        init_posthog()

        assert is_posthog_enabled() is False

    @patch("src.core.posthog.settings")
    def test_skips_when_no_api_key(self, mock_settings):
        """Should skip initialization when API key is None."""
        mock_settings.is_testing = False
        mock_settings.posthog_api_key = None

        init_posthog()

        assert is_posthog_enabled() is False

    @patch("src.core.posthog.settings")
    def test_skips_when_api_key_empty(self, mock_settings):
        """Should skip initialization when API key is empty string."""
        mock_settings.is_testing = False
        mock_settings.posthog_api_key = ""

        init_posthog()

        assert is_posthog_enabled() is False

    @patch("src.core.posthog.logger")
    def test_logs_warning_if_already_initialized(self, mock_logger):
        """Should log warning if called when already initialized."""
        posthog_module._posthog_initialized = True

        init_posthog()

        mock_logger.warning.assert_called_once_with("PostHog client already initialized")

    @patch("src.core.posthog.posthog")
    @patch("src.core.posthog.settings")
    def test_enables_debug_in_debug_mode(self, mock_settings, mock_posthog):
        """Should enable PostHog debug mode when settings.debug is True."""
        mock_settings.is_testing = False
        mock_settings.posthog_api_key = "phc_test123"
        mock_settings.posthog_host = "https://us.i.posthog.com"
        mock_settings.debug = True
        mock_settings.app_env = "development"

        init_posthog()

        assert mock_posthog.debug is True

    @patch("src.core.posthog.posthog")
    @patch("src.core.posthog.settings")
    @patch("src.core.posthog.logger")
    def test_handles_initialization_error(self, mock_logger, mock_settings, mock_posthog):
        """Should handle initialization errors gracefully."""
        mock_settings.is_testing = False
        mock_settings.posthog_api_key = "phc_test123"
        mock_settings.posthog_host = "https://us.i.posthog.com"
        mock_settings.debug = False
        mock_settings.app_env = "development"

        # Make setting project_api_key raise an exception
        type(mock_posthog).project_api_key = property(
            lambda self: None,
            lambda self, value: (_ for _ in ()).throw(Exception("Init error")),
        )

        init_posthog()

        assert is_posthog_enabled() is False
        mock_logger.error.assert_called()


@pytest.mark.unit
@pytest.mark.posthog
class TestCaptureEvent:
    """Tests for capture_event function."""

    @patch("src.core.posthog.posthog")
    @patch("src.core.posthog.settings")
    def test_captures_event_with_properties(self, mock_settings, mock_posthog):
        """Should capture event with merged properties."""
        posthog_module._posthog_initialized = True
        mock_settings.app_env = "development"
        mock_settings.app_version = "1.0.0"

        capture_event("user-123", "test_event", {"key": "value"}, user_email="user@example.com")

        mock_posthog.capture.assert_called_once()
        call_kwargs = mock_posthog.capture.call_args.kwargs
        assert call_kwargs["distinct_id"] == "user-123"
        assert call_kwargs["event"] == "test_event"
        assert call_kwargs["properties"]["key"] == "value"

    @patch("src.core.posthog.posthog")
    @patch("src.core.posthog.settings")
    def test_adds_default_properties(self, mock_settings, mock_posthog):
        """Should add environment and app_version to properties."""
        posthog_module._posthog_initialized = True
        mock_settings.app_env = "production"
        mock_settings.app_version = "2.0.0"

        capture_event("user-123", "test_event", {}, user_email=None)

        call_kwargs = mock_posthog.capture.call_args.kwargs
        assert call_kwargs["properties"]["environment"] == "production"
        assert call_kwargs["properties"]["app_version"] == "2.0.0"

    @patch("src.core.posthog.posthog")
    def test_filters_test_users_by_distinct_id(self, mock_posthog):
        """Should not capture events for test users by distinct_id."""
        posthog_module._posthog_initialized = True

        capture_event("test_user_123", "event", {}, user_email=None)

        mock_posthog.capture.assert_not_called()

    @patch("src.core.posthog.posthog")
    def test_filters_test_users_by_email(self, mock_posthog):
        """Should not capture events for test users by email."""
        posthog_module._posthog_initialized = True

        capture_event("user-123", "event", {}, user_email="admin@test.com")

        mock_posthog.capture.assert_not_called()

    @patch("src.core.posthog.posthog")
    def test_filters_e2e_users(self, mock_posthog):
        """Should not capture events for e2e test users."""
        posthog_module._posthog_initialized = True

        capture_event("e2e_learner", "event", {}, user_email=None)

        mock_posthog.capture.assert_not_called()

    @patch("src.core.posthog.posthog")
    def test_no_op_when_not_initialized(self, mock_posthog):
        """Should do nothing when PostHog is not initialized."""
        posthog_module._posthog_initialized = False

        capture_event("user-123", "test_event", {}, user_email=None)

        mock_posthog.capture.assert_not_called()

    @patch("src.core.posthog.posthog")
    def test_skips_empty_distinct_id(self, mock_posthog):
        """Should not capture when distinct_id is empty."""
        posthog_module._posthog_initialized = True

        capture_event("", "test_event", {}, user_email=None)

        mock_posthog.capture.assert_not_called()

    @patch("src.core.posthog.posthog")
    @patch("src.core.posthog.settings")
    @patch("src.core.posthog.logger")
    def test_handles_capture_exception(self, mock_logger, mock_settings, mock_posthog):
        """Should handle exceptions gracefully without raising."""
        posthog_module._posthog_initialized = True
        mock_settings.app_env = "dev"
        mock_settings.app_version = "1.0"
        mock_posthog.capture.side_effect = Exception("Network error")

        # Should not raise
        capture_event("user-123", "test_event", {}, user_email=None)

        mock_logger.error.assert_called()

    @patch("src.core.posthog.posthog")
    @patch("src.core.posthog.settings")
    def test_merges_custom_properties_with_defaults(self, mock_settings, mock_posthog):
        """Should merge custom properties with default properties."""
        posthog_module._posthog_initialized = True
        mock_settings.app_env = "staging"
        mock_settings.app_version = "1.5.0"

        custom_props = {"deck_id": "deck-123", "card_count": 10}
        capture_event("user-123", "deck_selected", custom_props, user_email=None)

        call_kwargs = mock_posthog.capture.call_args.kwargs
        assert call_kwargs["properties"]["deck_id"] == "deck-123"
        assert call_kwargs["properties"]["card_count"] == 10
        assert call_kwargs["properties"]["environment"] == "staging"
        assert call_kwargs["properties"]["app_version"] == "1.5.0"


@pytest.mark.unit
@pytest.mark.posthog
class TestIdentifyUser:
    """Tests for identify_user function."""

    @patch("src.core.posthog.posthog")
    @patch("src.core.posthog.settings")
    def test_identifies_user_with_properties(self, mock_settings, mock_posthog):
        """Should identify user with merged properties."""
        posthog_module._posthog_initialized = True
        mock_settings.app_env = "production"
        mock_settings.app_version = "1.0.0"

        identify_user("user-123", {"email": "user@example.com"}, user_email="user@example.com")

        mock_posthog.identify.assert_called_once()
        call_kwargs = mock_posthog.identify.call_args.kwargs
        assert call_kwargs["distinct_id"] == "user-123"
        assert "email" in call_kwargs["properties"]

    @patch("src.core.posthog.posthog")
    @patch("src.core.posthog.settings")
    def test_adds_default_properties_to_identify(self, mock_settings, mock_posthog):
        """Should add environment and app_version to identify properties."""
        posthog_module._posthog_initialized = True
        mock_settings.app_env = "development"
        mock_settings.app_version = "2.0.0"

        identify_user("user-123", {"name": "Test User"}, user_email=None)

        call_kwargs = mock_posthog.identify.call_args.kwargs
        assert call_kwargs["properties"]["environment"] == "development"
        assert call_kwargs["properties"]["app_version"] == "2.0.0"
        assert call_kwargs["properties"]["name"] == "Test User"

    @patch("src.core.posthog.posthog")
    def test_filters_test_users_by_distinct_id(self, mock_posthog):
        """Should not identify test users by distinct_id."""
        posthog_module._posthog_initialized = True

        identify_user("e2e_user", {}, user_email=None)

        mock_posthog.identify.assert_not_called()

    @patch("src.core.posthog.posthog")
    def test_filters_test_users_by_email(self, mock_posthog):
        """Should not identify test users by email."""
        posthog_module._posthog_initialized = True

        identify_user("user-123", {}, user_email="e2e@test.com")

        mock_posthog.identify.assert_not_called()

    @patch("src.core.posthog.posthog")
    def test_filters_test_prefix_users(self, mock_posthog):
        """Should not identify test_ prefixed users."""
        posthog_module._posthog_initialized = True

        identify_user("test_user", {"email": "test@example.com"}, user_email="test@example.com")

        mock_posthog.identify.assert_not_called()

    @patch("src.core.posthog.posthog")
    def test_no_op_when_not_initialized(self, mock_posthog):
        """Should do nothing when PostHog is not initialized."""
        posthog_module._posthog_initialized = False

        identify_user("user-123", {}, user_email=None)

        mock_posthog.identify.assert_not_called()

    @patch("src.core.posthog.posthog")
    def test_skips_empty_distinct_id(self, mock_posthog):
        """Should not identify when distinct_id is empty."""
        posthog_module._posthog_initialized = True

        identify_user("", {}, user_email=None)

        mock_posthog.identify.assert_not_called()

    @patch("src.core.posthog.posthog")
    @patch("src.core.posthog.settings")
    @patch("src.core.posthog.logger")
    def test_handles_identify_exception(self, mock_logger, mock_settings, mock_posthog):
        """Should handle exceptions gracefully without raising."""
        posthog_module._posthog_initialized = True
        mock_settings.app_env = "dev"
        mock_settings.app_version = "1.0"
        mock_posthog.identify.side_effect = Exception("Network error")

        # Should not raise
        identify_user("user-123", {"email": "test@example.com"}, user_email=None)

        mock_logger.error.assert_called()


@pytest.mark.unit
@pytest.mark.posthog
class TestShutdownPosthog:
    """Tests for shutdown_posthog function."""

    @patch("src.core.posthog.posthog")
    def test_flushes_and_shuts_down(self, mock_posthog):
        """Should flush events and shutdown client."""
        posthog_module._posthog_initialized = True

        shutdown_posthog()

        mock_posthog.flush.assert_called_once()
        mock_posthog.shutdown.assert_called_once()
        assert is_posthog_enabled() is False

    @patch("src.core.posthog.posthog")
    def test_no_op_when_not_initialized(self, mock_posthog):
        """Should do nothing when PostHog is not initialized."""
        posthog_module._posthog_initialized = False

        shutdown_posthog()

        mock_posthog.flush.assert_not_called()
        mock_posthog.shutdown.assert_not_called()

    @patch("src.core.posthog.posthog")
    @patch("src.core.posthog.logger")
    def test_handles_shutdown_exception(self, mock_logger, mock_posthog):
        """Should handle exceptions gracefully without raising."""
        posthog_module._posthog_initialized = True
        mock_posthog.flush.side_effect = Exception("Shutdown error")

        # Should not raise
        shutdown_posthog()

        # Should still reset initialized flag
        assert is_posthog_enabled() is False
        mock_logger.error.assert_called()

    @patch("src.core.posthog.posthog")
    @patch("src.core.posthog.logger")
    def test_resets_state_even_on_error(self, mock_logger, mock_posthog):
        """Should reset _posthog_initialized even when shutdown fails."""
        posthog_module._posthog_initialized = True
        mock_posthog.shutdown.side_effect = Exception("Thread join error")

        shutdown_posthog()

        # State should be reset despite error
        assert posthog_module._posthog_initialized is False


@pytest.mark.unit
@pytest.mark.posthog
class TestIsPosthogEnabled:
    """Tests for is_posthog_enabled function."""

    def test_returns_false_when_not_initialized(self):
        """Should return False when not initialized."""
        posthog_module._posthog_initialized = False
        assert is_posthog_enabled() is False

    def test_returns_true_when_initialized(self):
        """Should return True when initialized."""
        posthog_module._posthog_initialized = True
        assert is_posthog_enabled() is True


@pytest.mark.unit
@pytest.mark.posthog
class TestGetPosthogClient:
    """Tests for get_posthog_client function."""

    def test_returns_none_when_not_initialized(self):
        """Should return None when not initialized."""
        from src.core.posthog import get_posthog_client

        posthog_module._posthog_initialized = False
        assert get_posthog_client() is None

    @patch("src.core.posthog.posthog")
    def test_returns_posthog_module_when_initialized(self, mock_posthog):
        """Should return posthog module when initialized."""
        from src.core.posthog import get_posthog_client

        posthog_module._posthog_initialized = True
        result = get_posthog_client()
        assert result is mock_posthog
