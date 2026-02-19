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

import random
import time
from typing import Optional
from uuid import UUID

import httpx

from src.config import settings
from src.core.exceptions import (
    ElevenLabsAPIError,
    ElevenLabsAuthenticationError,
    ElevenLabsNotConfiguredError,
    ElevenLabsNoVoicesError,
    ElevenLabsRateLimitError,
    ElevenLabsVoiceNotFoundError,
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
                    raise ElevenLabsAuthenticationError(
                        f"Authentication failed (list_voices): {response.text[:200]}"
                    )

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

    async def _call_tts_api(
        self,
        text: str,
        voice_id: str,
        voice_name: str,
        *,
        is_retry: bool = False,
    ) -> bytes:
        """Call ElevenLabs TTS API to generate speech audio.

        Args:
            text: Greek text to synthesize.
            voice_id: ElevenLabs voice ID.
            voice_name: Human-readable voice name (for logging).
            is_retry: Whether this is a retry after cache invalidation.

        Returns:
            Raw MP3 audio bytes.

        Raises:
            ElevenLabsVoiceNotFoundError: If voice not found (404).
            ElevenLabsAuthenticationError: If API key invalid (401).
            ElevenLabsRateLimitError: If rate limit exceeded (429).
            ElevenLabsAPIError: For other API errors.
        """
        try:
            async with httpx.AsyncClient(timeout=settings.elevenlabs_timeout) as client:
                response = await client.post(
                    f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                    params={"output_format": settings.elevenlabs_output_format},
                    headers=self._get_headers(),
                    json={
                        "text": text,
                        "model_id": settings.elevenlabs_model_id,
                        "language_code": "el",
                    },
                )

                if response.status_code == 404:
                    raise ElevenLabsVoiceNotFoundError(voice_id=voice_id)

                if response.status_code == 401:
                    raise ElevenLabsAuthenticationError(
                        f"Authentication failed (text_to_speech): {response.text[:200]}"
                    )

                if response.status_code == 429:
                    raise ElevenLabsRateLimitError("Rate limit exceeded")

                if response.status_code >= 400:
                    raise ElevenLabsAPIError(
                        status_code=response.status_code,
                        detail=response.text[:200],
                    )

                audio_bytes: bytes = response.content
                logger.info(
                    "TTS audio generated",
                    extra={
                        "voice_name": voice_name,
                        "text_length": len(text),
                        "audio_bytes": len(audio_bytes),
                        "is_retry": is_retry,
                    },
                )
                return audio_bytes

        except (
            ElevenLabsVoiceNotFoundError,
            ElevenLabsAuthenticationError,
            ElevenLabsRateLimitError,
            ElevenLabsAPIError,
        ):
            raise
        except httpx.RequestError as e:
            logger.error(
                "Network error during TTS generation",
                extra={"error": str(e)},
            )
            raise ElevenLabsAPIError(status_code=0, detail=f"Network error: {e}")

    async def generate_speech(
        self,
        text: str,
        *,
        voice_id: str | None = None,
        news_item_id: Optional[UUID] = None,
    ) -> bytes:
        """Generate Greek speech audio from text using ElevenLabs API.

        If voice_id is provided, calls TTS directly without fetching the voice
        list and without retrying on 404. If voice_id is None, selects a random
        voice, calls TTS API, and retries once on 404 (stale voice cache) with
        a fresh voice selection.

        Args:
            text: Greek text to convert to speech.
            voice_id: Optional voice ID to use directly, skipping voice list
                lookup. When provided, 404 errors are not retried.
            news_item_id: Optional UUID for logging context.

        Returns:
            Raw MP3 audio bytes.

        Raises:
            ElevenLabsNotConfiguredError: If API key not set.
            ElevenLabsAuthenticationError: If API key invalid (401).
            ElevenLabsRateLimitError: If rate limit exceeded (429).
            ElevenLabsVoiceNotFoundError: If voice not found after retry.
            ElevenLabsAPIError: For other API errors.
        """
        self._check_configured()

        # Direct voice_id path: skip list_voices, no retry on 404
        if voice_id is not None:
            logger.info(
                "Using provided voice_id for TTS",
                extra={
                    "voice_id": voice_id,
                    "text_length": len(text),
                },
            )
            return await self._call_tts_api(
                text,
                voice_id,
                "custom",
                is_retry=False,
            )

        voices = await self.list_voices()
        selected = random.choice(voices)
        logger.info(
            "Selected voice for TTS",
            extra={
                "voice_id": selected["voice_id"],
                "voice_name": selected["name"],
                "news_item_id": str(news_item_id) if news_item_id else None,
                "text_length": len(text),
            },
        )

        try:
            return await self._call_tts_api(
                text,
                selected["voice_id"],
                selected["name"],
                is_retry=False,
            )
        except ElevenLabsVoiceNotFoundError:
            logger.warning(
                "Voice not found, invalidating cache and retrying",
                extra={"voice_id": selected["voice_id"]},
            )
            self._invalidate_voice_cache()
            voices = await self.list_voices()
            selected = random.choice(voices)
            return await self._call_tts_api(
                text,
                selected["voice_id"],
                selected["name"],
                is_retry=True,
            )


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
