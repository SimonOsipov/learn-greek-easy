"""Unit tests for OpenRouter exception classes.

Tests verify:
- Exception inheritance hierarchy (subclass of OpenRouterError, NOT BaseAPIException)
- Attribute storage (status_code, detail)
- Default messages for all exception types
- Exception catching via base class
- Custom message overrides
"""

import pytest

from src.core.exceptions import (
    BaseAPIException,
    OpenRouterAPIError,
    OpenRouterAuthenticationError,
    OpenRouterError,
    OpenRouterNotConfiguredError,
    OpenRouterRateLimitError,
    OpenRouterTimeoutError,
)


class TestExceptionInheritance:
    """Test exception inheritance hierarchy."""

    def test_openrouter_error_extends_exception(self) -> None:
        assert issubclass(OpenRouterError, Exception)

    def test_openrouter_error_not_base_api_exception(self) -> None:
        assert not issubclass(OpenRouterError, BaseAPIException)

    @pytest.mark.parametrize(
        "exception_class",
        [
            OpenRouterNotConfiguredError,
            OpenRouterAuthenticationError,
            OpenRouterRateLimitError,
            OpenRouterAPIError,
            OpenRouterTimeoutError,
        ],
    )
    def test_all_subclass_openrouter_error(self, exception_class: type) -> None:
        assert issubclass(exception_class, OpenRouterError)

    @pytest.mark.parametrize(
        "exception_class",
        [
            OpenRouterNotConfiguredError,
            OpenRouterAuthenticationError,
            OpenRouterRateLimitError,
            OpenRouterAPIError,
            OpenRouterTimeoutError,
        ],
    )
    def test_none_subclass_base_api_exception(self, exception_class: type) -> None:
        assert not issubclass(exception_class, BaseAPIException)


class TestOpenRouterAPIError:
    """Test OpenRouterAPIError specific attributes."""

    def test_stores_status_code(self) -> None:
        error = OpenRouterAPIError(status_code=429, detail="Rate limit")
        assert error.status_code == 429

    def test_stores_detail(self) -> None:
        error = OpenRouterAPIError(status_code=500, detail="Server error")
        assert error.detail == "Server error"

    def test_message_format(self) -> None:
        error = OpenRouterAPIError(status_code=503, detail="Unavailable")
        assert "503" in str(error)
        assert "Unavailable" in str(error)


class TestDefaultMessages:
    """Test default messages for exceptions with defaults."""

    def test_not_configured_default(self) -> None:
        error = OpenRouterNotConfiguredError()
        assert error.detail == "OpenRouter API key is not configured"

    def test_authentication_default(self) -> None:
        error = OpenRouterAuthenticationError()
        assert error.detail == "OpenRouter authentication failed"

    def test_rate_limit_default(self) -> None:
        error = OpenRouterRateLimitError()
        assert error.detail == "OpenRouter rate limit exceeded"

    def test_timeout_default(self) -> None:
        error = OpenRouterTimeoutError()
        assert error.detail == "OpenRouter request timed out"


class TestCustomMessages:
    """Test custom message overrides."""

    def test_not_configured_custom(self) -> None:
        error = OpenRouterNotConfiguredError(detail="Custom msg")
        assert error.detail == "Custom msg"
        assert "Custom msg" in str(error)

    def test_authentication_custom(self) -> None:
        error = OpenRouterAuthenticationError(detail="Bad key")
        assert error.detail == "Bad key"

    def test_rate_limit_custom(self) -> None:
        error = OpenRouterRateLimitError(detail="Quota hit")
        assert error.detail == "Quota hit"

    def test_timeout_custom(self) -> None:
        error = OpenRouterTimeoutError(detail="Took too long")
        assert error.detail == "Took too long"


class TestExceptionCatching:
    """Test all exceptions catchable via base class."""

    def test_catch_not_configured(self) -> None:
        with pytest.raises(OpenRouterError):
            raise OpenRouterNotConfiguredError()

    def test_catch_authentication(self) -> None:
        with pytest.raises(OpenRouterError):
            raise OpenRouterAuthenticationError()

    def test_catch_rate_limit(self) -> None:
        with pytest.raises(OpenRouterError):
            raise OpenRouterRateLimitError()

    def test_catch_timeout(self) -> None:
        with pytest.raises(OpenRouterError):
            raise OpenRouterTimeoutError()

    def test_catch_api_error(self) -> None:
        with pytest.raises(OpenRouterError):
            raise OpenRouterAPIError(status_code=500, detail="Error")
