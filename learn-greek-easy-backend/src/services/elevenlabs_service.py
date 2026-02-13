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

from typing import Optional

from src.config import settings
from src.core.exceptions import ElevenLabsNotConfiguredError
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
