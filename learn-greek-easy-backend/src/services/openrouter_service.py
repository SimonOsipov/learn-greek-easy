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
import base64
import time
from typing import Any

import httpx

from src.config import settings
from src.core.exceptions import (
    OpenRouterAPIError,
    OpenRouterAuthenticationError,
    OpenRouterNoImageError,
    OpenRouterNotConfiguredError,
    OpenRouterRateLimitError,
    OpenRouterTimeoutError,
)
from src.core.logging import get_logger
from src.schemas.nlp import OpenRouterImageResult, OpenRouterResponse

logger = get_logger(__name__)

MAX_ATTEMPTS = 3
BACKOFF_SECONDS = [1, 2]


class OpenRouterService:
    """Service for OpenRouter chat completions API."""

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    async def start(self) -> None:
        """Create the long-lived HTTP client with connection pooling and HTTP/2."""
        self._client = httpx.AsyncClient(
            timeout=settings.openrouter_timeout,
            http2=True,
            limits=httpx.Limits(
                max_connections=10,
                max_keepalive_connections=5,
            ),
        )

    async def close(self) -> None:
        """Close the HTTP client and release connection pool."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None

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
        reasoning: dict[str, Any] | None = None,
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
        if reasoning is not None:
            body["reasoning"] = reasoning

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
                if self._client is not None:
                    response = await self._client.post(url, headers=self._get_headers(), json=body)
                else:
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

                try:
                    data = response.json()
                except ValueError as err:
                    raise OpenRouterAPIError(
                        status_code=response.status_code,
                        detail="Invalid JSON response from OpenRouter",
                    ) from err
                usage = data.get("usage") or {}
                choices = data.get("choices", [])
                content = choices[0].get("message", {}).get("content", "") if choices else ""
                finish_reason = choices[0].get("finish_reason", "") if choices else ""
                if finish_reason == "length":
                    logger.warning(
                        "OpenRouter response truncated",
                        extra={
                            "model": effective_model,
                            "finish_reason": finish_reason,
                            "latency_ms": latency_ms,
                            "attempt": attempt,
                        },
                    )
                    raise OpenRouterAPIError(
                        status_code=200,
                        detail="Response truncated (finish_reason=length). Increase max_tokens or reduce prompt size.",
                    )

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
                    "OpenRouter response metadata",
                    extra={"content_length": len(content) if content else 0},
                )

                return OpenRouterResponse(
                    content=content,
                    model=data.get("model", effective_model),
                    usage=data.get("usage"),
                    latency_ms=latency_ms,
                )

            except httpx.TimeoutException as err:
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
                last_exception.__cause__ = err
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

    async def generate_image(  # noqa: C901
        self,
        prompt: str,
        *,
        model: str,
        aspect_ratio: str,
        timeout: float = 60.0,
    ) -> OpenRouterImageResult:
        """Generate a single image via OpenRouter image-generation models (Gemini Flash Image).

        Single attempt — NO retry loop. Cost guardrail: image generation is paid and
        non-idempotent.
        """
        self._check_configured()
        url = f"{settings.openrouter_base_url}/chat/completions"
        headers = self._get_headers()
        body: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "modalities": ["image", "text"],
            "imageConfig": {"aspectRatio": aspect_ratio},
        }
        log_extra: dict[str, Any] = {"model": model, "aspect_ratio": aspect_ratio}
        start_time = time.monotonic()
        try:
            if self._client is not None:
                response = await self._client.post(url, headers=headers, json=body, timeout=timeout)
            else:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(url, headers=headers, json=body)
        except httpx.TimeoutException as exc:
            latency_ms = round((time.monotonic() - start_time) * 1000)
            logger.warning(
                "OpenRouter image generation timed out",
                extra={**log_extra, "latency_ms": latency_ms, "success": False},
            )
            raise OpenRouterTimeoutError(detail=f"Image generation timeout: {exc}") from exc
        except httpx.RequestError as exc:
            latency_ms = round((time.monotonic() - start_time) * 1000)
            logger.error(
                "OpenRouter image generation request error",
                extra={**log_extra, "latency_ms": latency_ms, "success": False},
            )
            raise OpenRouterAPIError(
                status_code=0, detail=f"Image generation request error: {exc}"
            ) from exc

        latency_ms = round((time.monotonic() - start_time) * 1000)

        if response.status_code == 401:
            logger.error(
                "OpenRouter image generation authentication failed",
                extra={**log_extra, "latency_ms": latency_ms, "success": False},
            )
            raise OpenRouterAuthenticationError("OpenRouter authentication failed")

        if response.status_code == 429:
            logger.warning(
                "OpenRouter image generation rate limited",
                extra={**log_extra, "latency_ms": latency_ms, "success": False},
            )
            raise OpenRouterRateLimitError(detail="OpenRouter rate limited image generation")

        if response.status_code >= 400:
            logger.error(
                "OpenRouter image generation HTTP error",
                extra={
                    **log_extra,
                    "status_code": response.status_code,
                    "latency_ms": latency_ms,
                    "success": False,
                },
            )
            raise OpenRouterAPIError(
                status_code=response.status_code,
                detail=f"OpenRouter image generation HTTP {response.status_code}: {response.text[:300]}",
            )

        try:
            data = response.json()
        except ValueError as exc:
            raise OpenRouterAPIError(
                status_code=response.status_code,
                detail="Invalid JSON response from OpenRouter image generation",
            ) from exc

        try:
            message = data["choices"][0]["message"]
        except (KeyError, IndexError, TypeError) as exc:
            logger.error(
                "OpenRouter image response missing choices/message",
                extra={**log_extra, "latency_ms": latency_ms, "success": False},
            )
            raise OpenRouterAPIError(
                status_code=response.status_code,
                detail="Malformed image response (no choices/message)",
            ) from exc

        images = message.get("images") or []
        if not images:
            logger.warning(
                "OpenRouter returned no image (likely content policy)",
                extra={**log_extra, "latency_ms": latency_ms, "success": False},
            )
            raise OpenRouterNoImageError("Model returned no image (likely content policy)")

        first_image = images[0]
        data_url = (
            first_image.get("image_url", {}).get("url") if isinstance(first_image, dict) else None
        )
        if not data_url or not isinstance(data_url, str):
            raise OpenRouterAPIError(
                status_code=response.status_code,
                detail="Malformed image response (no image_url.url)",
            )

        if not data_url.startswith("data:"):
            raise OpenRouterAPIError(
                status_code=response.status_code,
                detail=f"Unexpected image_url format: {data_url[:60]}",
            )

        try:
            header, b64 = data_url.split(",", 1)
            mime_type = header.split(";")[0].removeprefix("data:") or "image/png"
            image_bytes = base64.b64decode(b64)
        except Exception as exc:
            raise OpenRouterAPIError(
                status_code=response.status_code,
                detail=f"Failed to decode image data URL: {exc}",
            ) from exc

        logger.info(
            "OpenRouter image generation succeeded",
            extra={
                **log_extra,
                "latency_ms": latency_ms,
                "bytes": len(image_bytes),
                "success": True,
            },
        )
        return OpenRouterImageResult(
            image_bytes=image_bytes,
            mime_type=mime_type,
            model=model,
            latency_ms=float(latency_ms),
        )


_openrouter_service: OpenRouterService | None = None


def get_openrouter_service() -> OpenRouterService:
    """Return the singleton OpenRouterService instance."""
    global _openrouter_service
    if _openrouter_service is None:
        _openrouter_service = OpenRouterService()
    return _openrouter_service
