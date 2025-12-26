"""Loguru-based logging configuration for the application."""

import sys
from typing import TYPE_CHECKING

from loguru import logger

if TYPE_CHECKING:
    from loguru import Logger

from src.config import settings


def setup_logging() -> None:
    """Configure loguru based on environment.

    Production: JSON format for structured log parsing (Railway, etc.)
    Development: Colorized human-readable format for console debugging

    Uses settings.log_level for filtering and settings.is_production
    for format selection.
    """
    # Remove default handler to avoid duplicate logs
    logger.remove()

    if settings.is_production:
        # JSON format for production (Railway log parsing)
        # serialize=True outputs each log as a JSON object with all metadata
        logger.add(
            sys.stdout,
            serialize=True,
            level=settings.log_level.upper(),
        )
    else:
        # Colorized format for development
        # Human-readable with timestamps, levels, source location, and colored output
        logger.add(
            sys.stderr,
            format=(
                "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
                "<level>{level: <8}</level> | "
                "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
                "<level>{message}</level>"
            ),
            level=settings.log_level.upper(),
            colorize=True,
        )

    logger.info(
        "Logging configured",
        level=settings.log_level,
        production=settings.is_production,
        format="json" if settings.is_production else "colorized",
    )


def get_logger(name: str | None = None) -> "Logger":
    """Get a contextualized logger instance.

    Args:
        name: Optional name to bind to the logger for context.
              Typically __name__ of the calling module.

    Returns:
        A loguru logger instance, optionally with name context bound.

    Example:
        >>> from src.core.logging import get_logger
        >>> logger = get_logger(__name__)
        >>> logger.info("Processing request", user_id=123)
    """
    if name:
        return logger.bind(name=name)
    return logger
