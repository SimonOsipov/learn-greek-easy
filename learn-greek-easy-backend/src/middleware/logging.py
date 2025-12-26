"""Request logging middleware for comprehensive API observability.

This middleware provides structured logging of all HTTP requests with:
- Unique request ID generation for correlation
- Request timing and duration tracking
- Client IP extraction from proxy headers
- Configurable path exclusions
- Status code-based log levels
- Sensitive data redaction
"""

import time
import uuid
from typing import Any, Callable

from fastapi import Request, Response
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware

from src.core.sentry import set_request_context


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging all HTTP requests with timing and request IDs.

    Features:
    - Generates unique request ID for correlation
    - Logs request start with method, path, client IP
    - Logs response with status code and duration
    - Adds X-Request-ID header to response
    - Supports log level based on status code
    - Redacts sensitive headers and body fields

    Attributes:
        EXCLUDED_PATHS: Paths to exclude from logging (health checks, static files)
        SENSITIVE_HEADERS: Headers to redact in logs
        SENSITIVE_BODY_FIELDS: Body fields to redact in logs
        REDACTED: Placeholder string for redacted values

    Example log output:
        INFO Request started | request_id=abc12345 method=GET path=/api/v1/decks
             client_ip=192.168.1.100 user_agent=Mozilla/5.0 ...
        INFO Request completed | request_id=abc12345 status_code=200 duration_ms=45.32

    Usage:
        from src.middleware.logging import RequestLoggingMiddleware
        app.add_middleware(RequestLoggingMiddleware)
    """

    EXCLUDED_PATHS: list[str] = [
        "/health/live",  # Liveness probe - too frequent
        "/docs",
        "/redoc",
        "/openapi.json",
        "/favicon.ico",
    ]

    SENSITIVE_HEADERS: set[str] = {
        "authorization",
        "cookie",
        "x-api-key",
        "x-test-seed-secret",
    }

    SENSITIVE_BODY_FIELDS: set[str] = {
        "password",
        "token",
        "secret",
        "api_key",
        "apikey",
        "refresh_token",
        "access_token",
    }

    REDACTED: str = "[REDACTED]"

    def _redact_headers(self, headers: dict[str, str]) -> dict[str, str]:
        """Redact sensitive headers.

        Args:
            headers: Dictionary of header name to value.

        Returns:
            Dictionary with sensitive values replaced with REDACTED.
        """
        return {
            key: self.REDACTED if key.lower() in self.SENSITIVE_HEADERS else value
            for key, value in headers.items()
        }

    def _redact_body(self, body: dict[str, Any] | None) -> dict[str, Any] | None:
        """Recursively redact sensitive fields from body.

        Args:
            body: Dictionary representing the request/response body.

        Returns:
            Dictionary with sensitive values replaced with REDACTED.
        """
        if body is None:
            return None

        if not isinstance(body, dict):
            return body

        result: dict[str, Any] = {}
        for key, value in body.items():
            if key.lower() in self.SENSITIVE_BODY_FIELDS:
                result[key] = self.REDACTED
            elif isinstance(value, dict):
                result[key] = self._redact_body(value)
            elif isinstance(value, list):
                result[key] = [
                    self._redact_body(item) if isinstance(item, dict) else item for item in value
                ]
            else:
                result[key] = value
        return result

    async def dispatch(
        self,
        request: Request,
        call_next: Callable,
    ) -> Response:
        """Process request and log details.

        Args:
            request: The incoming HTTP request.
            call_next: The next middleware/handler in the chain.

        Returns:
            The HTTP response from the endpoint.
        """
        # Skip excluded paths
        if self._should_skip(request.url.path):
            skip_response: Response = await call_next(request)
            return skip_response

        # Generate request ID
        request_id = str(uuid.uuid4())[:8]  # Short ID for readability

        # Store in request state for access by handlers
        request.state.request_id = request_id

        # Set Sentry request context for correlation
        set_request_context(request_id, request.url.path)

        # Use contextualize to automatically include request_id in all logs
        with logger.contextualize(request_id=request_id):
            # Log request start
            start_time = time.perf_counter()
            client_ip = self._get_client_ip(request)

            logger.info(
                "Request started",
                method=request.method,
                path=request.url.path,
                query=str(request.query_params) if request.query_params else None,
                client_ip=client_ip,
                user_agent=request.headers.get("user-agent"),
            )

            # Process request
            try:
                response: Response = await call_next(request)
            except Exception as e:
                # Log unhandled exceptions
                duration_ms = (time.perf_counter() - start_time) * 1000
                logger.exception(
                    "Request failed with unhandled exception",
                    method=request.method,
                    path=request.url.path,
                    duration_ms=round(duration_ms, 2),
                    error=str(e),
                )
                raise

            # Calculate duration
            duration_ms = (time.perf_counter() - start_time) * 1000

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id

            # Log response
            log_level = self._get_log_level_name(response.status_code)
            logger.log(
                log_level,
                "Request completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round(duration_ms, 2),
            )

            return response

    def _should_skip(self, path: str) -> bool:
        """Check if path should be excluded from logging.

        Args:
            path: The request URL path.

        Returns:
            True if the path should be skipped.
        """
        return any(path.startswith(excluded) for excluded in self.EXCLUDED_PATHS)

    def _get_client_ip(self, request: Request) -> str | None:
        """Extract client IP, handling proxied requests.

        Checks headers in order of precedence:
        1. X-Forwarded-For (first IP in chain)
        2. X-Real-IP
        3. Direct client connection

        Args:
            request: The HTTP request.

        Returns:
            Client IP address or None if unavailable.
        """
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return str(forwarded_for.split(",")[0].strip())
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return str(real_ip)
        if request.client:
            return str(request.client.host)
        return None

    def _get_log_level_name(self, status_code: int) -> str:
        """Determine log level name based on status code.

        Args:
            status_code: The HTTP response status code.

        Returns:
            Log level name string ("INFO", "WARNING", or "ERROR").
        """
        if status_code >= 500:
            return "ERROR"
        elif status_code >= 400:
            return "WARNING"
        return "INFO"
