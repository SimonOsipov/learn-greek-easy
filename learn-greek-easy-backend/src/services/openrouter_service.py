"""OpenRouter LLM Chat Completions Service.

This service provides:
- Generic HTTP client for OpenRouter chat completions API
- Per-call model selection with configurable default
- Retry with exponential backoff (3 attempts max)
- Structured logging with token usage tracking
- response_format pass-through for JSON mode

Configuration:
    OPENROUTER_API_KEY: Required API key from OpenRouter
    OPENROUTER_BASE_URL: API base URL (default: https://openrouter.ai/api/v1)
    OPENROUTER_DEFAULT_MODEL: Default model (default: google/gemini-2.5-flash-lite)
    OPENROUTER_TIMEOUT: API call timeout in seconds (default: 60)
"""

import asyncio
import time
from typing import Any

import httpx

from src.config import settings
from src.core.exceptions import (
    OpenRouterAPIError,
    OpenRouterAuthenticationError,
    OpenRouterNotConfiguredError,
    OpenRouterRateLimitError,
    OpenRouterTimeoutError,
)
from src.core.logging import get_logger
from src.schemas.nlp import OpenRouterResponse

logger = get_logger(__name__)

MAX_ATTEMPTS = 3
BACKOFF_SECONDS = [1, 2]


class OpenRouterService:
    """Service for OpenRouter chat completions API."""

    def _check_configured(self) -> None:
        """Raise OpenRouterNotConfiguredError if API key is not set."""
        if not settings.openrouter_configured:
            raise OpenRouterNotConfiguredError()

    def _get_headers(self) -> dict[str, str]:
        """Return authorization and content-type headers."""
        return {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
        }

    async def complete(  # noqa: C901
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        response_format: dict[str, Any] | None = None,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> OpenRouterResponse:
        """Call OpenRouter chat completions API with retry and structured logging."""
        self._check_configured()
        effective_model = model or settings.openrouter_default_model
        url = f"{settings.openrouter_base_url}/chat/completions"

        body: dict[str, Any] = {
            "model": effective_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format is not None:
            body["response_format"] = response_format

        logger.debug(
            "OpenRouter request",
            extra={
                "model": effective_model,
                "message_count": len(messages),
                "temperature": temperature,
                "max_tokens": max_tokens,
                "has_response_format": response_format is not None,
            },
        )

        last_exception: Exception | None = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            start_time = time.monotonic()
            try:
                async with httpx.AsyncClient(timeout=settings.openrouter_timeout) as client:
                    response = await client.post(url, headers=self._get_headers(), json=body)

                latency_ms = round((time.monotonic() - start_time) * 1000)

                if response.status_code == 401:
                    logger.error(
                        "OpenRouter authentication failed",
                        extra={
                            "model": effective_model,
                            "latency_ms": latency_ms,
                            "attempt": attempt,
                            "success": False,
                        },
                    )
                    raise OpenRouterAuthenticationError()

                if response.status_code == 429:
                    logger.warning(
                        "OpenRouter rate limited",
                        extra={
                            "model": effective_model,
                            "latency_ms": latency_ms,
                            "attempt": attempt,
                            "success": False,
                        },
                    )
                    last_exception = OpenRouterRateLimitError()
                    if attempt < MAX_ATTEMPTS:
                        await asyncio.sleep(BACKOFF_SECONDS[attempt - 1])
                        continue
                    raise last_exception

                if response.status_code >= 500:
                    logger.warning(
                        "OpenRouter server error",
                        extra={
                            "model": effective_model,
                            "status_code": response.status_code,
                            "latency_ms": latency_ms,
                            "attempt": attempt,
                            "success": False,
                        },
                    )
                    last_exception = OpenRouterAPIError(
                        status_code=response.status_code,
                        detail=response.text[:200],
                    )
                    if attempt < MAX_ATTEMPTS:
                        await asyncio.sleep(BACKOFF_SECONDS[attempt - 1])
                        continue
                    raise last_exception

                if response.status_code >= 400:
                    logger.error(
                        "OpenRouter client error",
                        extra={
                            "model": effective_model,
                            "status_code": response.status_code,
                            "latency_ms": latency_ms,
                            "attempt": attempt,
                            "success": False,
                        },
                    )
                    raise OpenRouterAPIError(
                        status_code=response.status_code,
                        detail=response.text[:200],
                    )

                data = response.json()
                usage = data.get("usage") or {}
                choices = data.get("choices", [])
                content = choices[0].get("message", {}).get("content", "") if choices else ""

                input_tokens = usage.get("prompt_tokens", 0) or 0
                output_tokens = usage.get("completion_tokens", 0) or 0
                total_tokens = usage.get("total_tokens", 0) or 0

                logger.info(
                    "OpenRouter completion succeeded",
                    extra={
                        "model": effective_model,
                        "latency_ms": latency_ms,
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                        "total_tokens": total_tokens,
                        "success": True,
                        "attempt": attempt,
                    },
                )
                logger.debug(
                    "OpenRouter response content",
                    extra={"content_preview": content[:200] if content else ""},
                )

                return OpenRouterResponse(
                    content=content,
                    model=data.get("model", effective_model),
                    usage=data.get("usage"),
                    latency_ms=latency_ms,
                )

            except httpx.TimeoutException:
                latency_ms = round((time.monotonic() - start_time) * 1000)
                logger.warning(
                    "OpenRouter request timed out",
                    extra={
                        "model": effective_model,
                        "latency_ms": latency_ms,
                        "attempt": attempt,
                        "success": False,
                    },
                )
                last_exception = OpenRouterTimeoutError()
                if attempt < MAX_ATTEMPTS:
                    await asyncio.sleep(BACKOFF_SECONDS[attempt - 1])
                    continue
                raise last_exception
            except (
                OpenRouterAuthenticationError,
                OpenRouterNotConfiguredError,
                OpenRouterAPIError,
                OpenRouterRateLimitError,
                OpenRouterTimeoutError,
            ):
                raise
            except httpx.RequestError as e:
                raise OpenRouterAPIError(status_code=0, detail=f"Network error: {e}") from e

        raise last_exception  # type: ignore[misc]


_openrouter_service: OpenRouterService | None = None


def get_openrouter_service() -> OpenRouterService:
    """Return the singleton OpenRouterService instance."""
    global _openrouter_service
    if _openrouter_service is None:
        _openrouter_service = OpenRouterService()
    return _openrouter_service
