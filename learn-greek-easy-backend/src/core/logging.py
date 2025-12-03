"""Logging configuration with structured JSON output."""

import json
import logging
import logging.handlers
import sys
from pathlib import Path
from typing import Any, Dict

from src.config import settings


class JSONFormatter(logging.Formatter):
    """Format logs as JSON for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        log_data: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add extra fields if present
        if hasattr(record, "extra"):
            log_data["extra"] = record.extra

        return json.dumps(log_data)


class ColoredFormatter(logging.Formatter):
    """Colored formatter for development console output."""

    COLORS = {
        "DEBUG": "\033[36m",  # Cyan
        "INFO": "\033[32m",  # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",  # Red
        "CRITICAL": "\033[35m",  # Magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        """Format with colors."""
        log_color = self.COLORS.get(record.levelname, self.RESET)
        record.levelname = f"{log_color}{record.levelname}{self.RESET}"
        return super().format(record)


def setup_logging() -> None:
    """Configure application logging."""
    # Create logs directory
    log_dir = Path(settings.log_file).parent
    log_dir.mkdir(parents=True, exist_ok=True)

    # Root logger
    logger = logging.getLogger()
    logger.setLevel(settings.log_level.upper())

    # Remove existing handlers
    logger.handlers = []

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(settings.log_level.upper())

    if settings.log_format == "json":
        console_handler.setFormatter(JSONFormatter())
    else:
        formatter = ColoredFormatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        console_handler.setFormatter(formatter)

    logger.addHandler(console_handler)

    # File handler with rotation
    file_handler = logging.handlers.RotatingFileHandler(
        settings.log_file,
        maxBytes=settings.log_max_bytes,
        backupCount=settings.log_backup_count,
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(JSONFormatter())
    logger.addHandler(file_handler)

    # Error file handler
    error_file_handler = logging.handlers.RotatingFileHandler(
        settings.log_file.replace(".log", "_error.log"),
        maxBytes=settings.log_max_bytes,
        backupCount=settings.log_backup_count,
    )
    error_file_handler.setLevel(logging.ERROR)
    error_file_handler.setFormatter(JSONFormatter())
    logger.addHandler(error_file_handler)

    # Third-party library log levels
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("fastapi").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy").setLevel(logging.WARNING)

    logger.info(
        "Logging configured",
        extra={
            "level": settings.log_level,
            "format": settings.log_format,
            "file": settings.log_file,
        },
    )


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance."""
    return logging.getLogger(name)
