"""Request logging middleware for comprehensive API observability.

This middleware provides structured logging of all HTTP requests with:
- Unique request ID generation for correlation
- Request timing and duration tracking
- Client IP extraction from proxy headers
- Configurable path exclusions
- Status code-based log levels
"""

import logging
import time
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging all HTTP requests with timing and request IDs.

    Features:
    - Generates unique request ID for correlation
    - Logs request start with method, path, client IP
    - Logs response with status code and duration
    - Adds X-Request-ID header to response
    - Supports log level based on status code

    Attributes:
        EXCLUDED_PATHS: Paths to exclude from logging (health checks, static files)

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

        # Log request start
        start_time = time.perf_counter()
        client_ip = self._get_client_ip(request)

        logger.info(
            "Request started",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "query": str(request.query_params) if request.query_params else None,
                "client_ip": client_ip,
                "user_agent": request.headers.get("user-agent"),
            },
        )

        # Process request
        try:
            response: Response = await call_next(request)
        except Exception as e:
            # Log unhandled exceptions
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.exception(
                "Request failed with unhandled exception",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": round(duration_ms, 2),
                    "error": str(e),
                },
            )
            raise

        # Calculate duration
        duration_ms = (time.perf_counter() - start_time) * 1000

        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id

        # Log response
        log_level = self._get_log_level(response.status_code)
        logger.log(
            log_level,
            "Request completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
            },
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

    def _get_log_level(self, status_code: int) -> int:
        """Determine log level based on status code.

        Args:
            status_code: The HTTP response status code.

        Returns:
            logging level constant (INFO, WARNING, or ERROR).
        """
        if status_code >= 500:
            return logging.ERROR
        elif status_code >= 400:
            return logging.WARNING
        return logging.INFO
