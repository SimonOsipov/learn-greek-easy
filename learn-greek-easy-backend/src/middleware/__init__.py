"""Middleware package for Learn Greek Easy backend.

This package contains custom middleware components for:
- Authentication logging and security monitoring
- Request timing and performance tracking
- Future: Rate limiting
"""

from src.middleware.auth import AuthLoggingMiddleware

__all__ = ["AuthLoggingMiddleware"]
