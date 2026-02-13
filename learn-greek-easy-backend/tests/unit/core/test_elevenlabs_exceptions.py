"""Unit tests for ElevenLabs exception classes.

Tests verify:
- Exception inheritance hierarchy (subclass of ElevenLabsError, NOT BaseAPIException)
- Attribute storage (status_code, detail, voice_id)
- Default messages for all exception types
- Exception catching via base class
- Custom message overrides
"""

import pytest

from src.core.exceptions import (
    BaseAPIException,
    ElevenLabsAPIError,
    ElevenLabsAuthenticationError,
    ElevenLabsError,
    ElevenLabsNotConfiguredError,
    ElevenLabsNoVoicesError,
    ElevenLabsRateLimitError,
    ElevenLabsVoiceNotFoundError,
)


class TestExceptionInheritance:
    """Test exception inheritance hierarchy."""

    def test_elevenlabs_error_extends_exception(self) -> None:
        assert issubclass(ElevenLabsError, Exception)

    def test_elevenlabs_error_not_base_api_exception(self) -> None:
        assert not issubclass(ElevenLabsError, BaseAPIException)

    @pytest.mark.parametrize(
        "exception_class",
        [
            ElevenLabsNotConfiguredError,
            ElevenLabsAuthenticationError,
            ElevenLabsRateLimitError,
            ElevenLabsNoVoicesError,
            ElevenLabsVoiceNotFoundError,
            ElevenLabsAPIError,
        ],
    )
    def test_all_subclass_elevenlabs_error(self, exception_class: type) -> None:
        assert issubclass(exception_class, ElevenLabsError)

    @pytest.mark.parametrize(
        "exception_class",
        [
            ElevenLabsNotConfiguredError,
            ElevenLabsAuthenticationError,
            ElevenLabsRateLimitError,
            ElevenLabsNoVoicesError,
            ElevenLabsVoiceNotFoundError,
            ElevenLabsAPIError,
        ],
    )
    def test_none_subclass_base_api_exception(self, exception_class: type) -> None:
        assert not issubclass(exception_class, BaseAPIException)


class TestElevenLabsAPIError:
    """Test ElevenLabsAPIError specific attributes."""

    def test_stores_status_code(self) -> None:
        error = ElevenLabsAPIError(status_code=429, detail="Rate limit")
        assert error.status_code == 429

    def test_stores_detail(self) -> None:
        error = ElevenLabsAPIError(status_code=500, detail="Server error")
        assert error.detail == "Server error"

    def test_message_format(self) -> None:
        error = ElevenLabsAPIError(status_code=503, detail="Unavailable")
        assert "503" in str(error)
        assert "Unavailable" in str(error)


class TestElevenLabsVoiceNotFoundError:
    """Test ElevenLabsVoiceNotFoundError specific attributes."""

    def test_stores_voice_id(self) -> None:
        error = ElevenLabsVoiceNotFoundError(voice_id="abc123")
        assert error.voice_id == "abc123"

    def test_stores_detail(self) -> None:
        error = ElevenLabsVoiceNotFoundError(voice_id="abc123")
        assert error.detail == "Voice not found"

    def test_custom_detail(self) -> None:
        error = ElevenLabsVoiceNotFoundError(voice_id="abc123", detail="Gone")
        assert error.detail == "Gone"
        assert "abc123" in str(error)

    def test_message_includes_voice_id(self) -> None:
        error = ElevenLabsVoiceNotFoundError(voice_id="xyz789")
        assert "xyz789" in str(error)


class TestDefaultMessages:
    """Test default messages for exceptions with defaults."""

    def test_not_configured_default(self) -> None:
        error = ElevenLabsNotConfiguredError()
        assert error.detail == "ElevenLabs API key is not configured"

    def test_authentication_default(self) -> None:
        error = ElevenLabsAuthenticationError()
        assert error.detail == "ElevenLabs authentication failed"

    def test_rate_limit_default(self) -> None:
        error = ElevenLabsRateLimitError()
        assert error.detail == "ElevenLabs rate limit exceeded"

    def test_no_voices_default(self) -> None:
        error = ElevenLabsNoVoicesError()
        assert error.detail == "No voices available from ElevenLabs"


class TestCustomMessages:
    """Test custom message overrides."""

    def test_not_configured_custom(self) -> None:
        error = ElevenLabsNotConfiguredError(detail="Custom msg")
        assert error.detail == "Custom msg"
        assert "Custom msg" in str(error)

    def test_authentication_custom(self) -> None:
        error = ElevenLabsAuthenticationError(detail="Bad key")
        assert error.detail == "Bad key"

    def test_rate_limit_custom(self) -> None:
        error = ElevenLabsRateLimitError(detail="Quota hit")
        assert error.detail == "Quota hit"

    def test_no_voices_custom(self) -> None:
        error = ElevenLabsNoVoicesError(detail="Empty list")
        assert error.detail == "Empty list"


class TestExceptionCatching:
    """Test all exceptions catchable via base class."""

    def test_catch_not_configured(self) -> None:
        with pytest.raises(ElevenLabsError):
            raise ElevenLabsNotConfiguredError()

    def test_catch_authentication(self) -> None:
        with pytest.raises(ElevenLabsError):
            raise ElevenLabsAuthenticationError()

    def test_catch_rate_limit(self) -> None:
        with pytest.raises(ElevenLabsError):
            raise ElevenLabsRateLimitError()

    def test_catch_no_voices(self) -> None:
        with pytest.raises(ElevenLabsError):
            raise ElevenLabsNoVoicesError()

    def test_catch_voice_not_found(self) -> None:
        with pytest.raises(ElevenLabsError):
            raise ElevenLabsVoiceNotFoundError(voice_id="test")

    def test_catch_api_error(self) -> None:
        with pytest.raises(ElevenLabsError):
            raise ElevenLabsAPIError(status_code=500, detail="Error")
