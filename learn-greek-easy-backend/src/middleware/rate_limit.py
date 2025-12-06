"""Rate limiting middleware with Redis backend.

This middleware provides protection against API abuse by limiting the number
of requests a client can make within a time window. It uses a sliding window
algorithm with Redis Sorted Sets for accurate rate limiting.

Features:
- Redis-based sliding window algorithm for accurate limiting
- Different limits for auth endpoints vs general API
- Graceful degradation when Redis is unavailable (allows requests)
- Rate limit headers in all responses
- IP-based client identification with proxy header support
- Configurable via settings with feature flag

Rate Limit Headers:
- X-RateLimit-Limit: Maximum requests allowed in window
- X-RateLimit-Remaining: Requests remaining in current window
- X-RateLimit-Reset: Unix timestamp when window resets

Usage:
    from src.middleware.rate_limit import RateLimitingMiddleware

    app.add_middleware(RateLimitingMiddleware)

Example Response Headers:
    X-RateLimit-Limit: 100
    X-RateLimit-Remaining: 95
    X-RateLimit-Reset: 1701867700
"""

import logging
import time
from dataclasses import dataclass
from typing import Callable, Tuple

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from src.config import settings
from src.core.redis import get_redis

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting on a specific path type.

    Attributes:
        limit: Maximum number of requests allowed in the window.
        window_seconds: Time window in seconds (default: 60).
        key_prefix: Redis key prefix for this rate limit type.
    """

    limit: int
    window_seconds: int = 60
    key_prefix: str = "ratelimit"


class RateLimitingMiddleware(BaseHTTPMiddleware):
    """Middleware for rate limiting API requests.

    Uses Redis Sorted Sets to implement a sliding window rate limiting
    algorithm. This provides accurate rate limiting without the "burst
    at window boundary" problem of fixed window algorithms.

    The middleware:
    1. Checks if rate limiting is enabled via settings.feature_rate_limiting
    2. Skips exempt paths (health checks, docs)
    3. Determines the appropriate rate limit based on path
    4. Checks current request count against limit using Redis
    5. Either allows the request or returns HTTP 429
    6. Adds rate limit headers to all responses

    When Redis is unavailable, the middleware gracefully degrades by
    allowing all requests and logging a warning.

    Attributes:
        AUTH_PATHS: Paths that receive stricter rate limiting.
        EXEMPT_PATHS: Paths exempt from rate limiting entirely.
    """

    # Auth endpoints receive stricter rate limiting
    # These are sensitive endpoints vulnerable to brute force attacks
    AUTH_PATHS: list[str] = [
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/google",
        "/api/v1/auth/refresh",
    ]

    # Paths exempt from rate limiting
    # Health checks must always be accessible for monitoring
    # Docs/OpenAPI are static and don't need protection
    EXEMPT_PATHS: list[str] = [
        "/health",
        "/health/live",
        "/health/ready",
        "/docs",
        "/redoc",
        "/openapi.json",
    ]

    async def dispatch(
        self,
        request: Request,
        call_next: Callable,
    ) -> Response:
        """Process request with rate limiting.

        Args:
            request: The incoming HTTP request.
            call_next: The next middleware/handler in the chain.

        Returns:
            Either the normal response with rate limit headers,
            or a 429 response if rate limit is exceeded.
        """
        # Skip if rate limiting is disabled
        if not settings.feature_rate_limiting:
            response: Response = await call_next(request)
            return response

        path = request.url.path

        # Skip exempt paths
        if self._is_exempt(path):
            response = await call_next(request)
            return response

        # Get rate limit configuration for this path
        rate_config = self._get_rate_config(path)

        # Get client identifier (IP-based)
        client_id = self._get_client_id(request)

        # Check rate limit using Redis
        allowed, remaining, reset_at = await self._check_rate_limit(
            client_id=client_id,
            rate_config=rate_config,
        )

        if not allowed:
            # Rate limit exceeded
            request_id = getattr(request.state, "request_id", "unknown")

            logger.warning(
                "Rate limit exceeded",
                extra={
                    "request_id": request_id,
                    "client_id": client_id,
                    "path": path,
                    "limit": rate_config.limit,
                    "window_seconds": rate_config.window_seconds,
                },
            )

            return self._rate_limit_response(rate_config, reset_at, request_id)

        # Process request normally
        response = await call_next(request)

        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(rate_config.limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Reset"] = str(int(reset_at))

        return response

    def _is_exempt(self, path: str) -> bool:
        """Check if path is exempt from rate limiting.

        Args:
            path: The request URL path.

        Returns:
            True if the path should skip rate limiting.
        """
        return any(path.startswith(exempt) for exempt in self.EXEMPT_PATHS)

    def _get_rate_config(self, path: str) -> RateLimitConfig:
        """Get rate limit configuration for the given path.

        Auth endpoints receive stricter limits to protect against
        brute force attacks. All other endpoints use the general limit.

        Args:
            path: The request URL path.

        Returns:
            RateLimitConfig with appropriate limit settings.
        """
        if any(path.startswith(auth_path) for auth_path in self.AUTH_PATHS):
            return RateLimitConfig(
                limit=settings.rate_limit_auth_per_minute,
                window_seconds=60,
                key_prefix="ratelimit:auth",
            )

        return RateLimitConfig(
            limit=settings.rate_limit_per_minute,
            window_seconds=60,
            key_prefix="ratelimit:api",
        )

    def _get_client_id(self, request: Request) -> str:
        """Get unique client identifier from request.

        Extracts client IP address, handling proxied requests by
        checking proxy headers in order of precedence:
        1. X-Forwarded-For (first IP in chain)
        2. X-Real-IP
        3. Direct client connection

        Args:
            request: The HTTP request.

        Returns:
            Client IP address or "unknown" if not determinable.
        """
        # Check X-Forwarded-For (standard proxy header)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP (original client)
            return str(forwarded_for.split(",")[0].strip())

        # Check X-Real-IP (nginx proxy header)
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return str(real_ip.strip())

        # Fall back to direct connection
        if request.client:
            return str(request.client.host)

        return "unknown"

    async def _check_rate_limit(
        self,
        client_id: str,
        rate_config: RateLimitConfig,
    ) -> Tuple[bool, int, float]:
        """Check if request is within rate limit using Redis.

        Implements sliding window algorithm using Redis Sorted Sets:
        1. Remove entries older than the window
        2. Count remaining entries
        3. If under limit, add current request
        4. Return whether request is allowed

        Args:
            client_id: Unique client identifier (IP address).
            rate_config: Rate limit configuration for this request.

        Returns:
            Tuple of (allowed, remaining, reset_timestamp):
            - allowed: True if request should be processed
            - remaining: Number of requests remaining in window
            - reset_timestamp: Unix timestamp when window resets
        """
        redis = get_redis()

        if redis is None:
            # Graceful degradation - allow request if Redis unavailable
            logger.warning(
                "Redis unavailable for rate limiting, allowing request",
                extra={"client_id": client_id},
            )
            return True, rate_config.limit, time.time() + rate_config.window_seconds

        current_time = time.time()
        window_start = current_time - rate_config.window_seconds
        reset_at = current_time + rate_config.window_seconds

        # Redis key format: ratelimit:{type}:{client_id}
        key = f"{rate_config.key_prefix}:{client_id}"

        try:
            # Use pipeline for atomic operations
            pipe = redis.pipeline()

            # 1. Remove entries older than window (sliding window cleanup)
            pipe.zremrangebyscore(key, 0, window_start)

            # 2. Count requests in current window
            pipe.zcard(key)

            # 3. Add current request with timestamp as score and member
            # Using timestamp as member ensures uniqueness
            member = f"{current_time}"
            pipe.zadd(key, {member: current_time})

            # 4. Set key expiry to window duration (auto-cleanup)
            pipe.expire(key, rate_config.window_seconds)

            # Execute pipeline
            results = await pipe.execute()

            # results[1] is the count from ZCARD (before adding current request)
            request_count = results[1]
            remaining = rate_config.limit - request_count - 1  # -1 for current request

            # If count before adding was >= limit, we're over the limit
            if request_count >= rate_config.limit:
                # Remove the request we just added since it's over limit
                await redis.zrem(key, member)
                return False, 0, reset_at

            return True, max(0, remaining), reset_at

        except Exception as e:
            logger.error(
                "Rate limit check failed",
                extra={
                    "client_id": client_id,
                    "error": str(e),
                    "error_type": type(e).__name__,
                },
            )
            # Graceful degradation - allow request on Redis error
            return True, rate_config.limit, time.time() + rate_config.window_seconds

    def _rate_limit_response(
        self,
        rate_config: RateLimitConfig,
        reset_at: float,
        request_id: str,
    ) -> JSONResponse:
        """Generate HTTP 429 rate limit exceeded response.

        The response includes:
        - Standard error body format matching other API errors
        - Retry-After header (RFC 6585)
        - Rate limit headers for client information
        - X-Request-ID for correlation

        Args:
            rate_config: Rate limit configuration that was exceeded.
            reset_at: Unix timestamp when the client can retry.
            request_id: Request ID for correlation.

        Returns:
            JSONResponse with 429 status and appropriate headers.
        """
        retry_after = max(1, int(reset_at - time.time()))

        return JSONResponse(
            status_code=429,
            content={
                "success": False,
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": "Too many requests. Please try again later.",
                    "request_id": request_id,
                    "retry_after": retry_after,
                },
            },
            headers={
                "X-RateLimit-Limit": str(rate_config.limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(reset_at)),
                "Retry-After": str(retry_after),
                "X-Request-ID": request_id,
            },
        )
