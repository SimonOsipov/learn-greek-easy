"""Middleware package for Learn Greek Easy backend.

This package contains custom middleware components for:
- Authentication logging and security monitoring
- Request logging with timing and request ID correlation
- Error handling for middleware-level exceptions
- Rate limiting for API protection
- Version header injection for stale client detection
"""

from src.middleware.auth import AuthLoggingMiddleware
from src.middleware.error_handler import ErrorHandlingMiddleware
from src.middleware.logging import RequestLoggingMiddleware
from src.middleware.rate_limit import RateLimitingMiddleware
from src.middleware.version import VersionHeaderMiddleware

__all__ = [
    "AuthLoggingMiddleware",
    "ErrorHandlingMiddleware",
    "RateLimitingMiddleware",
    "RequestLoggingMiddleware",
    "VersionHeaderMiddleware",
]
