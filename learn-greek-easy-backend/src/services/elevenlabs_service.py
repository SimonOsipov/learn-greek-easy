"""ElevenLabs Text-to-Speech Service for Greek vocabulary audio generation.

This service provides:
- Voice caching with TTL (300 seconds)
- Authentication via xi-api-key header
- Graceful handling of missing API configuration
- Support for Greek text-to-speech using ElevenLabs multilingual v2 model

Configuration:
    ELEVENLABS_API_KEY: Required API key from ElevenLabs
    ELEVENLABS_MODEL_ID: Model ID (default: eleven_multilingual_v2)
    ELEVENLABS_OUTPUT_FORMAT: Audio format (default: mp3_44100_128)
    ELEVENLABS_TIMEOUT: API call timeout in seconds (default: 30)
"""

import time
from typing import Optional

import httpx

from src.config import settings
from src.core.exceptions import (
    ElevenLabsAPIError,
    ElevenLabsAuthenticationError,
    ElevenLabsNotConfiguredError,
    ElevenLabsNoVoicesError,
    ElevenLabsRateLimitError,
)
from src.core.logging import get_logger

logger = get_logger(__name__)

# Voice cache TTL in seconds (5 minutes)
VOICE_CACHE_TTL_SECONDS = 300


class ElevenLabsService:
    """Service for ElevenLabs Text-to-Speech API operations."""

    def __init__(self) -> None:
        """Initialize ElevenLabs service with voice caching.

        Voice cache stores available voices to reduce API calls.
        Cache is invalidated after VOICE_CACHE_TTL_SECONDS.
        """
        self._voice_cache: Optional[list[dict]] = None
        self._voice_cache_time: Optional[float] = None

    def _get_headers(self) -> dict[str, str]:
        """Generate authentication headers for ElevenLabs API.

        Returns:
            Dictionary with xi-api-key and Content-Type headers.
        """
        return {
            "xi-api-key": settings.elevenlabs_api_key,
            "Content-Type": "application/json",
        }

    def _check_configured(self) -> None:
        """Check if ElevenLabs API is properly configured.

        Raises:
            ElevenLabsNotConfiguredError: If API key is not set.
        """
        if not settings.elevenlabs_configured:
            logger.warning(
                "ElevenLabs API not configured",
                extra={
                    "has_api_key": bool(settings.elevenlabs_api_key),
                },
            )
            raise ElevenLabsNotConfiguredError()

    async def list_voices(self) -> list[dict[str, str]]:
        """List available ElevenLabs voices with caching.

        Returns cached result if cache is valid (< 300 seconds old).
        Otherwise fetches from ElevenLabs API and updates cache.

        Returns:
            List of voice dicts with 'voice_id' and 'name' keys.

        Raises:
            ElevenLabsNotConfiguredError: If API key is not set.
            ElevenLabsAuthenticationError: If API key is invalid (401).
            ElevenLabsRateLimitError: If rate limit exceeded (429).
            ElevenLabsNoVoicesError: If no voices returned.
            ElevenLabsAPIError: For other API errors.
        """
        self._check_configured()

        if self._voice_cache is not None and self._voice_cache_time is not None:
            elapsed = time.monotonic() - self._voice_cache_time
            if elapsed < VOICE_CACHE_TTL_SECONDS:
                logger.debug("Voice list cache hit")
                return self._voice_cache

        try:
            async with httpx.AsyncClient(timeout=settings.elevenlabs_timeout) as client:
                response = await client.get(
                    "https://api.elevenlabs.io/v1/voices",
                    params={"voice_type": "saved", "page_size": 100},
                    headers=self._get_headers(),
                )

                if response.status_code == 401:
                    raise ElevenLabsAuthenticationError("Invalid API key")

                if response.status_code == 429:
                    raise ElevenLabsRateLimitError("Rate limit exceeded")

                if response.status_code >= 400:
                    raise ElevenLabsAPIError(
                        status_code=response.status_code,
                        detail=response.text[:200],
                    )

                data = response.json()
                voices = data.get("voices", [])

                if not voices:
                    raise ElevenLabsNoVoicesError()

                voice_list = [{"voice_id": v["voice_id"], "name": v["name"]} for v in voices]

                self._voice_cache = voice_list
                self._voice_cache_time = time.monotonic()
                logger.info(
                    "Cached voices from ElevenLabs",
                    extra={"voice_count": len(voice_list)},
                )
                return voice_list

        except (
            ElevenLabsAuthenticationError,
            ElevenLabsRateLimitError,
            ElevenLabsNoVoicesError,
            ElevenLabsAPIError,
        ):
            raise
        except httpx.RequestError as e:
            logger.error("Network error fetching voices", extra={"error": str(e)})
            raise ElevenLabsAPIError(status_code=0, detail=f"Network error: {e}")

    def _invalidate_voice_cache(self) -> None:
        """Clear the voice list cache.

        Forces next list_voices() call to fetch fresh data from API.
        """
        self._voice_cache = None
        self._voice_cache_time = None
        logger.debug("Voice cache invalidated")


# Singleton instance for use across the application
_elevenlabs_service: Optional[ElevenLabsService] = None


def get_elevenlabs_service() -> ElevenLabsService:
    """Get or create the singleton ElevenLabsService instance.

    Returns:
        ElevenLabsService instance.
    """
    global _elevenlabs_service
    if _elevenlabs_service is None:
        _elevenlabs_service = ElevenLabsService()
    return _elevenlabs_service
