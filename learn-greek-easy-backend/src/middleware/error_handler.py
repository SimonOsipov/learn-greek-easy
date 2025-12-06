"""Centralized error handling middleware.

This middleware provides a safety net for catching and formatting
unhandled exceptions that occur in other middleware layers.

While FastAPI exception handlers catch most errors that occur within
the router/endpoint lifecycle, exceptions in middleware are not caught
by those handlers. This middleware ensures:

1. All exceptions produce consistent JSON error responses
2. Errors are logged with full context including request ID
3. Debug information is included only in development mode
4. Request ID is always included in error responses
"""

import logging
import traceback
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from src.config import settings

logger = logging.getLogger(__name__)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware for catching and formatting unhandled errors.

    This middleware complements FastAPI exception handlers by providing
    error catching for the middleware layer. It should be registered
    AFTER RequestLoggingMiddleware to ensure request_id is available.

    Features:
    - Catches exceptions from downstream middleware
    - Logs errors with full traceback and request context
    - Returns consistent JSON error format
    - Includes debug info only when settings.debug is True
    - Adds X-Request-ID header to error responses

    Middleware Registration Order:
    The error handling middleware should be registered AFTER the
    request logging middleware (meaning it executes AFTER logging
    on the request path but BEFORE logging on the response path):

        app.add_middleware(RequestLoggingMiddleware)  # First registered
        app.add_middleware(ErrorHandlingMiddleware)   # Second registered

    Starlette processes in reverse: ErrorHandling wraps RequestLogging.

    Example Response (Production):
        {
            "success": false,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "request_id": "abc12345"
            }
        }

    Example Response (Debug Mode):
        {
            "success": false,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "request_id": "abc12345",
                "debug": {
                    "type": "ValueError",
                    "message": "Invalid configuration",
                    "traceback": ["Traceback (most recent call last):", ...]
                }
            }
        }
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable,
    ) -> Response:
        """Process request with error catching.

        Args:
            request: The incoming HTTP request.
            call_next: The next middleware/handler in the chain.

        Returns:
            Either the normal response or a formatted error response.
        """
        try:
            response: Response = await call_next(request)
            return response
        except Exception as exc:
            return self._handle_exception(request, exc)

    def _handle_exception(self, request: Request, exc: Exception) -> JSONResponse:
        """Handle an exception and return formatted error response.

        Args:
            request: The HTTP request that caused the error.
            exc: The exception that was raised.

        Returns:
            A JSONResponse with consistent error format.
        """
        # Get request ID if available (set by RequestLoggingMiddleware)
        request_id = getattr(request.state, "request_id", "unknown")

        # Log the error with full context
        logger.exception(
            "Unhandled middleware exception",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "query": str(request.query_params) if request.query_params else None,
                "error_type": type(exc).__name__,
                "error_message": str(exc),
            },
        )

        # Build error response
        error_response = self._build_error_response(request_id, exc)

        return JSONResponse(
            status_code=500,
            content=error_response,
            headers={"X-Request-ID": request_id},
        )

    def _build_error_response(
        self,
        request_id: str,
        exc: Exception,
    ) -> dict:
        """Build the error response dictionary.

        Args:
            request_id: The correlation request ID.
            exc: The exception that was raised.

        Returns:
            Dictionary matching the standard error response format.
        """
        error_content: dict = {
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred",
            "request_id": request_id,
        }

        # Include debug information only in debug mode
        if settings.debug:
            error_content["debug"] = {
                "type": type(exc).__name__,
                "message": str(exc),
                "traceback": traceback.format_exc().split("\n"),
            }

        return {
            "success": False,
            "error": error_content,
        }
