"""Loguru-based logging configuration for the application."""

import inspect
import logging
import sys
from typing import TYPE_CHECKING

from loguru import logger

if TYPE_CHECKING:
    from loguru import Logger

from src.config import settings


class InterceptHandler(logging.Handler):
    """Intercept standard library logging and route to loguru.

    This handler captures all logs from the standard logging module
    and routes them through loguru for consistent formatting and output.
    Third-party libraries (uvicorn, sqlalchemy, etc.) will automatically
    have their logs formatted by loguru.
    """

    def emit(self, record: logging.LogRecord) -> None:
        """Emit a log record by routing it to loguru.

        Args:
            record: The log record from standard library logging.
        """
        # Get corresponding loguru level if it exists
        try:
            level: str | int = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Find caller from where originated the logged message
        frame, depth = inspect.currentframe(), 0
        while frame:
            filename = frame.f_code.co_filename
            is_logging = filename == logging.__file__
            is_frozen = "importlib" in filename and "_bootstrap" in filename
            if depth > 0 and not (is_logging or is_frozen):
                break
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def intercept_standard_logging(loggers: list[str] | None = None) -> None:
    """Install InterceptHandler to route stdlib logging through loguru.

    This function configures the standard library logging module to route
    all log messages through loguru. This ensures consistent log formatting
    across the application and third-party libraries.

    Args:
        loggers: List of logger names to intercept. If None, intercepts
                 the root logger (which captures all logging).

    Example:
        >>> intercept_standard_logging()  # Intercept all
        >>> intercept_standard_logging(["uvicorn", "sqlalchemy"])  # Specific
    """
    if loggers is None:
        loggers = [""]  # Root logger - captures all

    for logger_name in loggers:
        stdlib_logger = logging.getLogger(logger_name)
        stdlib_logger.handlers = [InterceptHandler()]
        stdlib_logger.setLevel(logging.DEBUG)  # Let loguru handle filtering
        if logger_name:
            stdlib_logger.propagate = False


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

    # Intercept standard library logging to route through loguru
    # This ensures uvicorn, sqlalchemy, and other libraries use loguru formatting
    intercept_standard_logging()

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
