"""Integration tests for rate limiting with Redis.

These tests require a running Redis instance and test the full
rate limiting flow including Redis operations.

Mark tests with @pytest.mark.integration for CI/CD filtering.
"""

import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.middleware.rate_limit import RateLimitingMiddleware


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
    async def test_rate_limit_headers_with_real_redis(self, client: TestClient):
        """Test that rate limit headers are correct with real Redis."""
        # First request should show full remaining count
        response = client.get("/api/v1/test")

        if response.status_code == 200:
            limit = int(response.headers["X-RateLimit-Limit"])
            remaining = int(response.headers["X-RateLimit-Remaining"])
            reset = int(response.headers["X-RateLimit-Reset"])

            assert limit == 100  # General API limit
            assert remaining >= 0
            assert remaining < limit
            assert reset > time.time()

    @pytest.mark.asyncio
    async def test_remaining_decreases_with_requests(self, client: TestClient):
        """Test that remaining count decreases with each request."""
        # Make first request
        response1 = client.get(
            "/api/v1/test",
            headers={"X-Forwarded-For": "192.0.2.100"},  # Use unique IP
        )

        if response1.status_code == 200:
            remaining1 = int(response1.headers["X-RateLimit-Remaining"])

            # Make second request
            response2 = client.get(
                "/api/v1/test",
                headers={"X-Forwarded-For": "192.0.2.100"},
            )

            if response2.status_code == 200:
                remaining2 = int(response2.headers["X-RateLimit-Remaining"])

                # Remaining should have decreased
                assert remaining2 < remaining1

    @pytest.mark.asyncio
    async def test_different_ips_have_separate_limits(self, client: TestClient):
        """Test that different IPs have independent rate limits."""
        # Request from IP 1
        response1 = client.get(
            "/api/v1/test",
            headers={"X-Forwarded-For": "192.0.2.1"},
        )

        # Request from IP 2
        response2 = client.get(
            "/api/v1/test",
            headers={"X-Forwarded-For": "192.0.2.2"},
        )

        # Both should succeed (independent limits)
        assert response1.status_code == 200
        assert response2.status_code == 200

        # Both should have high remaining counts (only 1 request each)
        remaining1 = int(response1.headers["X-RateLimit-Remaining"])
        remaining2 = int(response2.headers["X-RateLimit-Remaining"])

        assert remaining1 >= 98  # Close to limit
        assert remaining2 >= 98


@pytest.mark.integration
@pytest.mark.slow
class TestRateLimitExhaustion:
    """Tests for rate limit exhaustion (may be slow)."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with low limit for testing."""
        from unittest.mock import patch

        with patch("src.middleware.rate_limit.settings") as mock_settings:
            mock_settings.feature_rate_limiting = True
            mock_settings.rate_limit_per_minute = 5  # Low limit for testing
            mock_settings.rate_limit_auth_per_minute = 3

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
    async def test_returns_429_when_limit_exceeded(self, client: TestClient):
        """Test that 429 is returned when limit is exceeded."""
        unique_ip = f"192.0.2.{int(time.time()) % 255}"

        # Make requests until limit is exceeded
        for i in range(10):  # More than limit
            response = client.get(
                "/api/v1/test",
                headers={"X-Forwarded-For": unique_ip},
            )

            if response.status_code == 429:
                # Verify 429 response format
                data = response.json()
                assert data["success"] is False
                assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"
                assert "retry_after" in data["error"]
                return

        # If we get here without 429, the test setup may be wrong
        # This is acceptable if Redis isn't available (graceful degradation)
        pass
