"""Integration tests for rate limiting with Redis.

These tests require a running Redis instance and test the full
rate limiting flow including Redis operations.

Note: These tests require a running Redis instance (via Docker or local).
If Redis is not available, tests will be skipped.
"""

import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.core.redis import close_redis, get_redis, init_redis
from src.middleware.rate_limit import RateLimitingMiddleware


@pytest.fixture
async def redis_client():
    """Initialize Redis for integration tests.

    Initializes Redis connection and yields the client.
    Skips tests if Redis is not available.
    """
    try:
        await init_redis()
        client = get_redis()
        if client:
            # Test connection
            await client.ping()
            yield client
        else:
            pytest.skip("Redis not available")
    except Exception as e:
        pytest.skip(f"Redis connection failed: {e}")
    finally:
        await close_redis()


@pytest.mark.integration
class TestRateLimitingWithRedis:
    """Integration tests for rate limiting with actual Redis."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(RateLimitingMiddleware)

        @app.get("/api/v1/test")
        async def test_endpoint():
            return {"status": "ok"}

        @app.post("/api/v1/auth/login")
        async def login_endpoint():
            return {"status": "logged_in"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    @pytest.mark.asyncio
    async def test_rate_limit_headers_with_real_redis(self, redis_client, client: TestClient):
        """Test that rate limit headers are correct with real Redis."""
        # Use unique IP to avoid conflicts with other tests
        unique_ip = f"192.0.2.{int(time.time() * 1000) % 255}"

        # First request should show remaining count less than limit
        response = client.get(
            "/api/v1/test",
            headers={"X-Forwarded-For": unique_ip},
        )

        assert response.status_code == 200

        limit = int(response.headers["X-RateLimit-Limit"])
        remaining = int(response.headers["X-RateLimit-Remaining"])
        reset = int(response.headers["X-RateLimit-Reset"])

        assert limit == 100  # General API limit
        assert remaining >= 0
        # After first request, remaining should be limit - 1
        assert remaining == limit - 1
        assert reset > time.time()

    @pytest.mark.asyncio
    async def test_remaining_decreases_with_requests(self, redis_client, client: TestClient):
        """Test that remaining count decreases with each request."""
        # Use unique IP to avoid conflicts with other tests
        unique_ip = f"192.0.2.{(int(time.time() * 1000) + 1) % 255}"

        # Make first request
        response1 = client.get(
            "/api/v1/test",
            headers={"X-Forwarded-For": unique_ip},
        )

        assert response1.status_code == 200
        remaining1 = int(response1.headers["X-RateLimit-Remaining"])

        # Make second request
        response2 = client.get(
            "/api/v1/test",
            headers={"X-Forwarded-For": unique_ip},
        )

        assert response2.status_code == 200
        remaining2 = int(response2.headers["X-RateLimit-Remaining"])

        # Remaining should have decreased
        assert remaining2 < remaining1
        assert remaining2 == remaining1 - 1

    @pytest.mark.asyncio
    async def test_different_ips_have_separate_limits(self, redis_client, client: TestClient):
        """Test that different IPs have independent rate limits."""
        base_time = int(time.time() * 1000)

        # Request from IP 1
        response1 = client.get(
            "/api/v1/test",
            headers={"X-Forwarded-For": f"192.0.2.{(base_time + 10) % 255}"},
        )

        # Request from IP 2
        response2 = client.get(
            "/api/v1/test",
            headers={"X-Forwarded-For": f"192.0.2.{(base_time + 20) % 255}"},
        )

        # Both should succeed (independent limits)
        assert response1.status_code == 200
        assert response2.status_code == 200

        # Both should have high remaining counts (only 1 request each)
        remaining1 = int(response1.headers["X-RateLimit-Remaining"])
        remaining2 = int(response2.headers["X-RateLimit-Remaining"])

        # Both should be limit - 1 (99) since each made only 1 request
        assert remaining1 == 99
        assert remaining2 == 99

    @pytest.mark.asyncio
    async def test_auth_endpoint_has_stricter_limit(self, redis_client, client: TestClient):
        """Test that auth endpoints have stricter rate limits."""
        unique_ip = f"192.0.2.{(int(time.time() * 1000) + 30) % 255}"

        response = client.post(
            "/api/v1/auth/login",
            headers={"X-Forwarded-For": unique_ip},
        )

        assert response.status_code == 200

        limit = int(response.headers["X-RateLimit-Limit"])
        remaining = int(response.headers["X-RateLimit-Remaining"])

        # Auth endpoints should have limit of 10
        assert limit == 10
        assert remaining == 9  # limit - 1 after first request


@pytest.mark.integration
@pytest.mark.slow
class TestRateLimitExhaustion:
    """Tests for rate limit exhaustion (may be slow)."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(RateLimitingMiddleware)

        @app.get("/api/v1/test")
        async def test_endpoint():
            return {"status": "ok"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    @pytest.mark.asyncio
    async def test_returns_429_when_limit_exceeded(self, redis_client, client: TestClient):
        """Test that 429 is returned when limit is exceeded.

        This test uses the auth endpoint which has a limit of 10,
        so we only need to make 11 requests to trigger 429.
        """
        # Create app with auth endpoint for faster testing (limit=10)
        app = FastAPI()
        app.add_middleware(RateLimitingMiddleware)

        @app.post("/api/v1/auth/login")
        async def login():
            return {"status": "ok"}

        test_client = TestClient(app)
        unique_ip = f"192.0.2.{(int(time.time() * 1000) + 100) % 255}"

        got_429 = False
        # Make requests until limit is exceeded (auth limit is 10)
        for i in range(15):
            response = test_client.post(
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
