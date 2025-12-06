"""Integration tests for rate limiting with Redis.

These tests require a running Redis instance and test the full
rate limiting flow including Redis operations.

Note: These tests require a running Redis instance (via Docker or local).
If Redis is not available, tests will be skipped.
"""

import uuid

import httpx
import pytest
from fastapi import FastAPI
from httpx import ASGITransport

from src.config import settings
from src.core.redis import get_redis, init_redis
from src.middleware.rate_limit import RateLimitingMiddleware


async def ensure_redis_initialized() -> bool:
    """Initialize Redis and verify connection in the current event loop.

    Returns True if Redis is available, False otherwise.
    This must be called within each test to ensure Redis is initialized
    in the same event loop context as the test.
    """
    try:
        await init_redis()
        client = get_redis()
        if client:
            await client.ping()
            return True
        return False
    except Exception:
        return False


def generate_unique_ip() -> str:
    """Generate a unique IP address using UUID to avoid test conflicts."""
    # Use UUID bytes to create a unique IP in the test range
    uid = uuid.uuid4()
    # Use last 4 bytes of UUID for IP octets
    octets = uid.bytes[-4:]
    return f"10.{octets[1] % 256}.{octets[2] % 256}.{octets[3] % 256}"


def create_test_app() -> FastAPI:
    """Create a test FastAPI app with rate limiting middleware."""
    app = FastAPI()
    app.add_middleware(RateLimitingMiddleware)

    @app.get("/api/v1/test")
    async def test_endpoint():
        return {"status": "ok"}

    @app.post("/api/v1/auth/login")
    async def login_endpoint():
        return {"status": "logged_in"}

    return app


@pytest.mark.integration
class TestRateLimitingWithRedis:
    """Integration tests for rate limiting with actual Redis.

    Uses httpx.AsyncClient with ASGITransport to keep everything in the
    same async context, ensuring the Redis client is accessible.
    """

    @pytest.mark.asyncio
    async def test_rate_limit_headers_with_real_redis(self):
        """Test that rate limit headers are correct with real Redis."""
        # Initialize Redis in this test's event loop
        if not await ensure_redis_initialized():
            pytest.skip("Redis not available")

        app = create_test_app()
        unique_ip = generate_unique_ip()

        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                "/api/v1/test",
                headers={"X-Forwarded-For": unique_ip},
            )

        assert response.status_code == 200

        limit = int(response.headers["X-RateLimit-Limit"])
        remaining = int(response.headers["X-RateLimit-Remaining"])
        reset = int(response.headers["X-RateLimit-Reset"])

        # Use configured limit from settings
        expected_limit = settings.rate_limit_per_minute
        assert limit == expected_limit, f"Expected limit {expected_limit}, got {limit}"
        assert remaining >= 0
        # After first request, remaining should be limit - 1
        assert remaining == limit - 1, f"Expected {limit - 1}, got {remaining}"
        assert reset > 0

    @pytest.mark.asyncio
    async def test_remaining_decreases_with_requests(self):
        """Test that remaining count decreases with each request."""
        # Initialize Redis in this test's event loop
        if not await ensure_redis_initialized():
            pytest.skip("Redis not available")

        app = create_test_app()
        unique_ip = generate_unique_ip()

        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            # Make first request
            response1 = await client.get(
                "/api/v1/test",
                headers={"X-Forwarded-For": unique_ip},
            )

            assert response1.status_code == 200
            remaining1 = int(response1.headers["X-RateLimit-Remaining"])

            # Make second request
            response2 = await client.get(
                "/api/v1/test",
                headers={"X-Forwarded-For": unique_ip},
            )

            assert response2.status_code == 200
            remaining2 = int(response2.headers["X-RateLimit-Remaining"])

        # Remaining should have decreased by exactly 1
        assert (
            remaining2 == remaining1 - 1
        ), f"Expected remaining to decrease by 1: {remaining1} -> {remaining2}"

    @pytest.mark.asyncio
    async def test_different_ips_have_separate_limits(self):
        """Test that different IPs have independent rate limits."""
        # Initialize Redis in this test's event loop
        if not await ensure_redis_initialized():
            pytest.skip("Redis not available")

        app = create_test_app()
        ip1 = generate_unique_ip()
        ip2 = generate_unique_ip()

        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            # Request from IP 1
            response1 = await client.get(
                "/api/v1/test",
                headers={"X-Forwarded-For": ip1},
            )

            # Request from IP 2
            response2 = await client.get(
                "/api/v1/test",
                headers={"X-Forwarded-For": ip2},
            )

        # Both should succeed (independent limits)
        assert response1.status_code == 200
        assert response2.status_code == 200

        # Both should have high remaining counts (only 1 request each)
        remaining1 = int(response1.headers["X-RateLimit-Remaining"])
        remaining2 = int(response2.headers["X-RateLimit-Remaining"])
        limit = int(response1.headers["X-RateLimit-Limit"])

        # Both should be limit - 1 since each made only 1 request
        assert remaining1 == limit - 1, f"IP1: expected {limit - 1}, got {remaining1}"
        assert remaining2 == limit - 1, f"IP2: expected {limit - 1}, got {remaining2}"

    @pytest.mark.asyncio
    async def test_auth_endpoint_has_stricter_limit(self):
        """Test that auth endpoints have stricter rate limits."""
        # Initialize Redis in this test's event loop
        if not await ensure_redis_initialized():
            pytest.skip("Redis not available")

        app = create_test_app()
        unique_ip = generate_unique_ip()

        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/v1/auth/login",
                headers={"X-Forwarded-For": unique_ip},
            )

        assert response.status_code == 200

        limit = int(response.headers["X-RateLimit-Limit"])
        remaining = int(response.headers["X-RateLimit-Remaining"])

        # Auth endpoints should have stricter limit from settings
        expected_auth_limit = settings.rate_limit_auth_per_minute
        assert (
            limit == expected_auth_limit
        ), f"Expected auth limit {expected_auth_limit}, got {limit}"
        assert remaining == limit - 1, f"Expected {limit - 1}, got {remaining}"

        # Auth limit should be stricter than general limit
        assert limit < settings.rate_limit_per_minute, (
            f"Auth limit ({limit}) should be less than "
            f"general limit ({settings.rate_limit_per_minute})"
        )


@pytest.mark.integration
@pytest.mark.slow
class TestRateLimitExhaustion:
    """Tests for rate limit exhaustion (may be slow)."""

    @pytest.mark.asyncio
    async def test_returns_429_when_limit_exceeded(self):
        """Test that 429 is returned when limit is exceeded.

        This test uses the auth endpoint which has a stricter limit,
        so we need fewer requests to trigger 429.
        """
        # Initialize Redis in this test's event loop
        if not await ensure_redis_initialized():
            pytest.skip("Redis not available")

        app = create_test_app()
        unique_ip = generate_unique_ip()

        # Use auth limit which should be stricter
        auth_limit = settings.rate_limit_auth_per_minute
        # Make more requests than the limit to ensure we hit 429
        max_requests = auth_limit + 5

        got_429 = False
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            # Make requests until limit is exceeded
            for i in range(max_requests):
                response = await client.post(
                    "/api/v1/auth/login",
                    headers={"X-Forwarded-For": unique_ip},
                )

                if response.status_code == 429:
                    # Verify 429 response format
                    data = response.json()
                    assert data["success"] is False
                    assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"
                    assert "retry_after" in data["error"]
                    assert "Retry-After" in response.headers
                    got_429 = True
                    break

        assert got_429, "Expected to receive 429 after exceeding rate limit"
