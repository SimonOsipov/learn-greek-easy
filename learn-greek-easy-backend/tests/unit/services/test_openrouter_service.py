"""Unit tests for OpenRouter Service core functionality.

Tests cover:
- Singleton pattern for get_openrouter_service()
- Configuration validation via _check_configured()
- HTTP header generation via _get_headers()
- Successful API completion with correct OpenRouterResponse fields
- Model selection (default vs explicit)
- Error mapping (401, 429, 500, 400)
- Retry with exponential backoff (500, 429, timeout)
- Backoff timing verification
- Usage field handling (present and None)
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from src.core.exceptions import (
    OpenRouterAPIError,
    OpenRouterAuthenticationError,
    OpenRouterNotConfiguredError,
    OpenRouterRateLimitError,
    OpenRouterTimeoutError,
)
from src.services.openrouter_service import OpenRouterService, get_openrouter_service

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture()
def mock_settings_configured():
    """Settings with OpenRouter configured (valid API key)."""
    with patch("src.services.openrouter_service.settings") as mock:
        mock.openrouter_api_key = "test-openrouter-key-12345"
        mock.openrouter_configured = True
        mock.openrouter_default_model = "google/gemini-2.5-flash-lite"
        mock.openrouter_base_url = "https://openrouter.ai/api/v1"
        mock.openrouter_timeout = 60
        yield mock


@pytest.fixture()
def mock_settings_not_configured():
    """Settings without OpenRouter configured (empty API key)."""
    with patch("src.services.openrouter_service.settings") as mock:
        mock.openrouter_api_key = ""
        mock.openrouter_configured = False
        yield mock


@pytest.fixture()
def reset_singleton():
    """Reset the singleton OpenRouterService instance."""
    import src.services.openrouter_service as openrouter_module

    openrouter_module._openrouter_service = None
    yield
    openrouter_module._openrouter_service = None


def _make_success_response(
    content: str = "Hello",
    model: str = "google/gemini-2.5-flash-lite",
    usage: dict | None = None,
) -> MagicMock:
    """Build a mock httpx response for a successful OpenRouter completion."""
    if usage is None:
        usage = {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30}
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": content}}],
        "model": model,
        "usage": usage,
    }
    return mock_response


def _make_error_response(status_code: int, body: str = "error") -> MagicMock:
    """Build a mock httpx response for an error status code."""
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.text = body
    return mock_response


# ============================================================================
# get_openrouter_service() Singleton Tests
# ============================================================================


class TestGetOpenRouterService:
    """Tests for get_openrouter_service() singleton function."""

    def test_returns_singleton(self, reset_singleton: None, mock_settings_configured: None) -> None:
        """Test that get_openrouter_service returns the same instance."""
        service1 = get_openrouter_service()
        service2 = get_openrouter_service()
        assert service1 is service2

    def test_creates_openrouter_service_instance(
        self, reset_singleton: None, mock_settings_configured: None
    ) -> None:
        """Test that get_openrouter_service returns an OpenRouterService."""
        service = get_openrouter_service()
        assert isinstance(service, OpenRouterService)

    def test_reset_singleton_creates_new_instance(
        self, reset_singleton: None, mock_settings_configured: None
    ) -> None:
        """Test that resetting module-level _openrouter_service produces new instance."""
        import src.services.openrouter_service as openrouter_module

        service1 = get_openrouter_service()
        openrouter_module._openrouter_service = None
        service2 = get_openrouter_service()
        assert service1 is not service2


# ============================================================================
# OpenRouterService._check_configured() Tests
# ============================================================================


class TestCheckConfigured:
    """Tests for OpenRouterService._check_configured() method."""

    def test_passes_when_configured(self, mock_settings_configured: None) -> None:
        """Test _check_configured passes when API key is set."""
        service = OpenRouterService()
        service._check_configured()  # Should not raise

    def test_raises_when_not_configured(self, mock_settings_not_configured: None) -> None:
        """Test _check_configured raises when API key is empty."""
        service = OpenRouterService()
        with pytest.raises(OpenRouterNotConfiguredError):
            service._check_configured()


# ============================================================================
# OpenRouterService._get_headers() Tests
# ============================================================================


class TestGetHeaders:
    """Tests for OpenRouterService._get_headers() method."""

    def test_returns_dict_with_correct_keys(self, mock_settings_configured: None) -> None:
        """Test _get_headers returns dict with Authorization and Content-Type."""
        service = OpenRouterService()
        headers = service._get_headers()
        assert isinstance(headers, dict)
        assert "Authorization" in headers
        assert "Content-Type" in headers

    def test_includes_bearer_token_from_settings(self, mock_settings_configured: None) -> None:
        """Test _get_headers uses Bearer token from settings."""
        service = OpenRouterService()
        headers = service._get_headers()
        assert headers["Authorization"] == "Bearer test-openrouter-key-12345"

    def test_includes_json_content_type(self, mock_settings_configured: None) -> None:
        """Test _get_headers includes application/json content type."""
        service = OpenRouterService()
        headers = service._get_headers()
        assert headers["Content-Type"] == "application/json"


# ============================================================================
# complete() Success Tests
# ============================================================================


class TestCompleteSuccess:
    """Tests for OpenRouterService.complete() successful responses."""

    @pytest.mark.asyncio
    async def test_returns_openrouter_response(self, mock_settings_configured: None) -> None:
        """Test successful call returns OpenRouterResponse with correct fields."""
        service = OpenRouterService()
        mock_response = _make_success_response(
            content="Translated text",
            model="google/gemini-2.5-flash-lite",
            usage={"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
        )

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch("src.services.openrouter_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            result = await service.complete([{"role": "user", "content": "Translate"}])

        assert result.content == "Translated text"
        assert result.model == "google/gemini-2.5-flash-lite"
        assert result.usage == {
            "prompt_tokens": 10,
            "completion_tokens": 20,
            "total_tokens": 30,
        }
        assert isinstance(result.latency_ms, float)

    @pytest.mark.asyncio
    async def test_usage_dict_access(self, mock_settings_configured: None) -> None:
        """Test usage field is a dict with prompt_tokens/completion_tokens keys."""
        service = OpenRouterService()
        mock_response = _make_success_response(
            usage={"prompt_tokens": 5, "completion_tokens": 15, "total_tokens": 20},
        )

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch("src.services.openrouter_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            result = await service.complete([{"role": "user", "content": "test"}])

        assert result.usage is not None
        assert result.usage["prompt_tokens"] == 5
        assert result.usage["completion_tokens"] == 15
        assert result.usage["total_tokens"] == 20

    @pytest.mark.asyncio
    async def test_usage_none_when_absent(self, mock_settings_configured: None) -> None:
        """Test usage is None when API response has no usage field."""
        service = OpenRouterService()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "reply"}}],
            "model": "test-model",
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch("src.services.openrouter_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            result = await service.complete([{"role": "user", "content": "test"}])

        assert result.usage is None

    @pytest.mark.asyncio
    async def test_usage_none_when_null(self, mock_settings_configured: None) -> None:
        """Test usage is None when API response has usage: null."""
        service = OpenRouterService()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "reply"}}],
            "model": "test-model",
            "usage": None,
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch("src.services.openrouter_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            result = await service.complete([{"role": "user", "content": "test"}])

        assert result.usage is None


# ============================================================================
# complete() Model Selection Tests
# ============================================================================


class TestModelSelection:
    """Tests for model selection behavior in complete()."""

    @pytest.mark.asyncio
    async def test_default_model_from_settings(self, mock_settings_configured: None) -> None:
        """Test model=None uses settings.openrouter_default_model."""
        service = OpenRouterService()
        mock_response = _make_success_response()

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch("src.services.openrouter_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            await service.complete([{"role": "user", "content": "test"}])

        call_kwargs = mock_client.post.call_args
        body = call_kwargs.kwargs["json"]
        assert body["model"] == "google/gemini-2.5-flash-lite"

    @pytest.mark.asyncio
    async def test_explicit_model_overrides_default(self, mock_settings_configured: None) -> None:
        """Test explicit model parameter overrides default."""
        service = OpenRouterService()
        mock_response = _make_success_response()

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response

        with patch("src.services.openrouter_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            await service.complete(
                [{"role": "user", "content": "test"}],
                model="anthropic/claude-3-haiku",
            )

        call_kwargs = mock_client.post.call_args
        body = call_kwargs.kwargs["json"]
        assert body["model"] == "anthropic/claude-3-haiku"


# ============================================================================
# complete() Error Mapping Tests
# ============================================================================


class TestErrorMapping:
    """Tests for HTTP status code to exception mapping."""

    @pytest.mark.asyncio
    async def test_401_raises_authentication_error(self, mock_settings_configured: None) -> None:
        """Test 401 response raises OpenRouterAuthenticationError immediately."""
        service = OpenRouterService()

        mock_client = AsyncMock()
        mock_client.post.return_value = _make_error_response(401)

        with patch("src.services.openrouter_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(OpenRouterAuthenticationError):
                await service.complete([{"role": "user", "content": "test"}])

        mock_client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_429_raises_rate_limit_error(self, mock_settings_configured: None) -> None:
        """Test 429 response raises OpenRouterRateLimitError after retries."""
        service = OpenRouterService()

        mock_client = AsyncMock()
        mock_client.post.return_value = _make_error_response(429)

        with (
            patch("src.services.openrouter_service.httpx.AsyncClient") as mock_cls,
            patch(
                "src.services.openrouter_service.asyncio.sleep",
                new_callable=AsyncMock,
            ),
        ):
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(OpenRouterRateLimitError):
                await service.complete([{"role": "user", "content": "test"}])

        assert mock_client.post.call_count == 3

    @pytest.mark.asyncio
    async def test_500_raises_api_error(self, mock_settings_configured: None) -> None:
        """Test 500 response raises OpenRouterAPIError after retries."""
        service = OpenRouterService()

        mock_client = AsyncMock()
        mock_client.post.return_value = _make_error_response(500, "Internal Error")

        with (
            patch("src.services.openrouter_service.httpx.AsyncClient") as mock_cls,
            patch(
                "src.services.openrouter_service.asyncio.sleep",
                new_callable=AsyncMock,
            ),
        ):
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(OpenRouterAPIError) as exc_info:
                await service.complete([{"role": "user", "content": "test"}])

        assert exc_info.value.status_code == 500
        assert mock_client.post.call_count == 3

    @pytest.mark.asyncio
    async def test_400_raises_api_error_immediately(self, mock_settings_configured: None) -> None:
        """Test 400 response raises OpenRouterAPIError without retries."""
        service = OpenRouterService()

        mock_client = AsyncMock()
        mock_client.post.return_value = _make_error_response(400, "Bad Request")

        with patch("src.services.openrouter_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(OpenRouterAPIError) as exc_info:
                await service.complete([{"role": "user", "content": "test"}])

        assert exc_info.value.status_code == 400
        mock_client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_network_error_raises_api_error(self, mock_settings_configured: None) -> None:
        """Test httpx.RequestError wraps as OpenRouterAPIError with status_code=0."""
        service = OpenRouterService()

        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.ConnectError("Connection refused")

        with patch("src.services.openrouter_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(OpenRouterAPIError) as exc_info:
                await service.complete([{"role": "user", "content": "test"}])

        assert exc_info.value.status_code == 0
        assert "Network error" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_not_configured_raises_error(self, mock_settings_not_configured: None) -> None:
        """Test not configured raises OpenRouterNotConfiguredError."""
        service = OpenRouterService()
        with pytest.raises(OpenRouterNotConfiguredError):
            await service.complete([{"role": "user", "content": "test"}])


# ============================================================================
# complete() Retry Behavior Tests
# ============================================================================


class TestRetryBehavior:
    """Tests for retry with exponential backoff in complete()."""

    @pytest.mark.asyncio
    async def test_500_500_200_succeeds_on_third_attempt(
        self, mock_settings_configured: None
    ) -> None:
        """Test 500-500-200 succeeds on 3rd attempt."""
        service = OpenRouterService()

        mock_client = AsyncMock()
        mock_client.post.side_effect = [
            _make_error_response(500, "err"),
            _make_error_response(500, "err"),
            _make_success_response(content="success"),
        ]

        with (
            patch("src.services.openrouter_service.httpx.AsyncClient") as mock_cls,
            patch(
                "src.services.openrouter_service.asyncio.sleep",
                new_callable=AsyncMock,
            ),
        ):
            mock_cls.return_value.__aenter__.return_value = mock_client
            result = await service.complete([{"role": "user", "content": "test"}])

        assert result.content == "success"
        assert mock_client.post.call_count == 3

    @pytest.mark.asyncio
    async def test_500_500_500_raises_after_3_attempts(
        self, mock_settings_configured: None
    ) -> None:
        """Test 500-500-500 raises OpenRouterAPIError after 3 attempts."""
        service = OpenRouterService()

        mock_client = AsyncMock()
        mock_client.post.return_value = _make_error_response(500, "persistent error")

        with (
            patch("src.services.openrouter_service.httpx.AsyncClient") as mock_cls,
            patch(
                "src.services.openrouter_service.asyncio.sleep",
                new_callable=AsyncMock,
            ),
        ):
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(OpenRouterAPIError):
                await service.complete([{"role": "user", "content": "test"}])

        assert mock_client.post.call_count == 3

    @pytest.mark.asyncio
    async def test_backoff_timing(self, mock_settings_configured: None) -> None:
        """Test asyncio.sleep called with 1 then 2 for exponential backoff."""
        service = OpenRouterService()

        mock_client = AsyncMock()
        mock_client.post.return_value = _make_error_response(500, "err")

        with (
            patch("src.services.openrouter_service.httpx.AsyncClient") as mock_cls,
            patch(
                "src.services.openrouter_service.asyncio.sleep",
                new_callable=AsyncMock,
            ) as mock_sleep,
        ):
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(OpenRouterAPIError):
                await service.complete([{"role": "user", "content": "test"}])

        assert mock_sleep.call_count == 2
        assert mock_sleep.call_args_list[0].args[0] == 1
        assert mock_sleep.call_args_list[1].args[0] == 2

    @pytest.mark.asyncio
    async def test_timeout_retried_3_times(self, mock_settings_configured: None) -> None:
        """Test httpx.TimeoutException is retried up to 3 attempts."""
        service = OpenRouterService()

        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.ReadTimeout("read timed out")

        with (
            patch("src.services.openrouter_service.httpx.AsyncClient") as mock_cls,
            patch(
                "src.services.openrouter_service.asyncio.sleep",
                new_callable=AsyncMock,
            ),
        ):
            mock_cls.return_value.__aenter__.return_value = mock_client
            with pytest.raises(OpenRouterTimeoutError):
                await service.complete([{"role": "user", "content": "test"}])

        assert mock_client.post.call_count == 3

    @pytest.mark.asyncio
    async def test_429_retried_then_succeeds(self, mock_settings_configured: None) -> None:
        """Test 429-429-200 succeeds on 3rd attempt."""
        service = OpenRouterService()

        mock_client = AsyncMock()
        mock_client.post.side_effect = [
            _make_error_response(429),
            _make_error_response(429),
            _make_success_response(content="recovered"),
        ]

        with (
            patch("src.services.openrouter_service.httpx.AsyncClient") as mock_cls,
            patch(
                "src.services.openrouter_service.asyncio.sleep",
                new_callable=AsyncMock,
            ),
        ):
            mock_cls.return_value.__aenter__.return_value = mock_client
            result = await service.complete([{"role": "user", "content": "test"}])

        assert result.content == "recovered"
        assert mock_client.post.call_count == 3
