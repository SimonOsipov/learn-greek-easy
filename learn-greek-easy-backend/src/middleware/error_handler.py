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

Note: This middleware uses pure ASGI pattern (not BaseHTTPMiddleware) to avoid
response streaming issues that can cause 502 errors with reverse proxies.
See: https://www.starlette.io/middleware/#pure-asgi-middleware
"""

import traceback

from fastapi.responses import JSONResponse
from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from src.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)


class ErrorHandlingMiddleware:
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

    def __init__(self, app: ASGIApp) -> None:
        """Initialize the middleware.

        Args:
            app: The ASGI application to wrap.
        """
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Process request with error catching.

        Args:
            scope: The ASGI scope dictionary.
            receive: The ASGI receive callable.
            send: The ASGI send callable.
        """
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        try:
            await self.app(scope, receive, send)
        except Exception as exc:
            request = Request(scope, receive, send)
            response = self._handle_exception(request, exc)
            await response(scope, receive, send)

    def _handle_exception(self, request: Request, exc: Exception) -> JSONResponse:
        """Handle an exception and return formatted error response.

        Args:
            request: The HTTP request that caused the error.
            exc: The exception that was raised.

        Returns:
            A JSONResponse with consistent error format.
        """
        # Get request ID if available (set by RequestLoggingMiddleware)
        # Check scope state first (pure ASGI pattern), then request.state
        state = request.scope.get("state", {})
        request_id = state.get("request_id") or getattr(request.state, "request_id", "unknown")

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
