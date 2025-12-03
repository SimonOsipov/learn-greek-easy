"""Authentication middleware for security monitoring and audit logging.

This middleware logs all requests to authentication endpoints for:
- Security audit trails
- Performance monitoring
- Anomaly detection (via log analysis)
- Debugging authentication issues

Note: This middleware is passive and does not authenticate requests.
Authentication is handled by FastAPI dependencies (get_current_user).
"""

import logging
import time
from typing import Callable, Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class AuthLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging authentication endpoint requests.

    Logs all requests to /api/v1/auth/* endpoints with:
    - HTTP method
    - Request path
    - Response status code
    - Request duration (milliseconds)
    - Client IP address

    This middleware is passive and does not modify requests or responses.
    Authentication is handled by FastAPI dependencies (get_current_user).

    Attributes:
        AUTH_PATH_PREFIX: The URL prefix for auth endpoints to monitor.
        SENSITIVE_PATHS: Paths that should be marked as sensitive in logs.

    Example log output:
        INFO Auth endpoint accessed | method=POST path=/api/v1/auth/login
             status_code=200 duration_ms=45.23 client_ip=192.168.1.100

    Usage:
        from src.middleware.auth import AuthLoggingMiddleware
        app.add_middleware(AuthLoggingMiddleware)
    """

    # Endpoints to log (configurable)
    AUTH_PATH_PREFIX: str = "/api/v1/auth"

    # Sensitive paths that should have extra logging
    SENSITIVE_PATHS: list[str] = [
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/logout",
        "/api/v1/auth/logout-all",
    ]

    async def dispatch(
        self,
        request: Request,
        call_next: Callable,
    ) -> Response:
        """Process request and log auth endpoint access.

        Args:
            request: The incoming HTTP request.
            call_next: The next middleware/handler in the chain.

        Returns:
            The HTTP response from the endpoint.
        """
        # Start timing
        start_time = time.perf_counter()

        # Process the request
        response = await call_next(request)

        # Calculate duration
        duration_ms = (time.perf_counter() - start_time) * 1000

        # Log auth endpoint requests
        if self._should_log(request.url.path):
            self._log_request(request, response, duration_ms)

        return response

    def _should_log(self, path: str) -> bool:
        """Determine if the request path should be logged.

        Args:
            path: The request URL path.

        Returns:
            True if the path is an auth endpoint.
        """
        return path.startswith(self.AUTH_PATH_PREFIX)

    def _get_client_ip(self, request: Request) -> Optional[str]:
        """Extract client IP address from request.

        Handles proxied requests by checking X-Forwarded-For header.
        Priority:
        1. X-Forwarded-For (first IP in chain)
        2. X-Real-IP
        3. Direct client connection

        Args:
            request: The HTTP request.

        Returns:
            Client IP address or None if unavailable.
        """
        # Check for proxy headers first
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # X-Forwarded-For can contain multiple IPs; first is the client
            return str(forwarded_for.split(",")[0].strip())

        # Check X-Real-IP (used by some proxies)
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return str(real_ip)

        # Fall back to direct client connection
        if request.client:
            return str(request.client.host)

        return None

    def _log_request(
        self,
        request: Request,
        response: Response,
        duration_ms: float,
    ) -> None:
        """Log the authentication request details.

        Determines log level based on response status code:
        - 5xx: ERROR
        - 4xx: WARNING
        - 2xx/3xx: INFO

        Also logs an additional warning for failed login attempts (401 on /login).

        Args:
            request: The HTTP request.
            response: The HTTP response.
            duration_ms: Request processing time in milliseconds.
        """
        client_ip = self._get_client_ip(request)
        path = request.url.path
        method = request.method
        status_code = response.status_code

        # Determine log level based on status code
        if status_code >= 500:
            log_level = logging.ERROR
        elif status_code >= 400:
            log_level = logging.WARNING
        else:
            log_level = logging.INFO

        # Build log extra data
        log_extra = {
            "method": method,
            "path": path,
            "status_code": status_code,
            "duration_ms": round(duration_ms, 2),
            "client_ip": client_ip,
        }

        # Add extra context for sensitive endpoints
        if path in self.SENSITIVE_PATHS:
            log_extra["sensitive"] = True

        # Log the request
        logger.log(
            log_level,
            "Auth endpoint accessed",
            extra=log_extra,
        )

        # Additional warning for failed auth attempts
        if path == "/api/v1/auth/login" and status_code == 401:
            logger.warning(
                "Failed login attempt",
                extra={
                    "client_ip": client_ip,
                    "path": path,
                },
            )
