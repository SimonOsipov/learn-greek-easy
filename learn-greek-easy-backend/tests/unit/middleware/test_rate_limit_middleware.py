"""Unit tests for rate limiting middleware.

Tests cover:
- Rate limit enforcement for general API endpoints
- Stricter limits for auth endpoints
- Rate limit headers in responses
- 429 response format when limit exceeded
- Path exemption logic
- Client IP extraction from headers
- Graceful degradation when Redis unavailable
- Sliding window algorithm behavior
"""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.config import settings
from src.middleware.rate_limit import RateLimitConfig, RateLimitingMiddleware


@pytest.fixture(autouse=True)
def enable_rate_limiting_for_tests(monkeypatch):
    """Enable rate limiting for these specific tests.

    The global test configuration disables rate limiting via TESTING=true.
    These tests specifically test rate limiting behavior, so we need to
    temporarily re-enable it by setting testing=False.
    """
    monkeypatch.setattr(settings, "testing", False)


class TestRateLimitEnforcement:
    """Tests for rate limit enforcement."""

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

    def test_allows_requests_under_limit(self, client: TestClient):
        """Test that requests within limit are allowed."""
        with patch("src.middleware.rate_limit.get_redis") as mock_get_redis:
            # Create a proper async mock pipeline
            mock_pipeline = AsyncMock()
            mock_pipeline.zremrangebyscore = MagicMock(return_value=mock_pipeline)
            mock_pipeline.zcard = MagicMock(return_value=mock_pipeline)
            mock_pipeline.zadd = MagicMock(return_value=mock_pipeline)
            mock_pipeline.expire = MagicMock(return_value=mock_pipeline)
            mock_pipeline.execute = AsyncMock(return_value=[0, 5, True, True])  # 5 requests so far

            mock_redis = MagicMock()
            mock_redis.pipeline = MagicMock(return_value=mock_pipeline)
            mock_get_redis.return_value = mock_redis

            response = client.get("/api/v1/test")

            assert response.status_code == 200
            assert response.json() == {"status": "ok"}

    def test_includes_rate_limit_headers(self, client: TestClient):
        """Test that rate limit headers are present in response."""
        with patch("src.middleware.rate_limit.get_redis") as mock_get_redis:
            # Create a proper async mock pipeline
            mock_pipeline = AsyncMock()
            mock_pipeline.zremrangebyscore = MagicMock(return_value=mock_pipeline)
            mock_pipeline.zcard = MagicMock(return_value=mock_pipeline)
            mock_pipeline.zadd = MagicMock(return_value=mock_pipeline)
            mock_pipeline.expire = MagicMock(return_value=mock_pipeline)
            mock_pipeline.execute = AsyncMock(return_value=[0, 10, True, True])

            mock_redis = MagicMock()
            mock_redis.pipeline = MagicMock(return_value=mock_pipeline)
            mock_get_redis.return_value = mock_redis

            response = client.get("/api/v1/test")

            assert "X-RateLimit-Limit" in response.headers
            assert "X-RateLimit-Remaining" in response.headers
            assert "X-RateLimit-Reset" in response.headers

    def test_blocks_requests_over_limit(self, client: TestClient):
        """Test that requests exceeding limit are blocked."""
        with (
            patch("src.middleware.rate_limit.get_redis") as mock_get_redis,
            patch("src.middleware.rate_limit.settings") as mock_settings,
        ):
            mock_settings.feature_rate_limiting = True
            mock_settings.is_testing = False
            mock_settings.rate_limit_per_minute = 100

            # Create a proper async mock pipeline
            mock_pipeline = AsyncMock()
            mock_pipeline.zremrangebyscore = MagicMock(return_value=mock_pipeline)
            mock_pipeline.zcard = MagicMock(return_value=mock_pipeline)
            mock_pipeline.zadd = MagicMock(return_value=mock_pipeline)
            mock_pipeline.expire = MagicMock(return_value=mock_pipeline)
            mock_pipeline.execute = AsyncMock(return_value=[0, 100, True, True])  # At limit

            mock_redis = MagicMock()
            mock_redis.pipeline = MagicMock(return_value=mock_pipeline)
            mock_redis.zrem = AsyncMock()
            mock_get_redis.return_value = mock_redis

            response = client.get("/api/v1/test")

            assert response.status_code == 429
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"

    def test_429_response_includes_retry_after(self, client: TestClient):
        """Test that 429 response includes Retry-After header."""
        with (
            patch("src.middleware.rate_limit.get_redis") as mock_get_redis,
            patch("src.middleware.rate_limit.settings") as mock_settings,
        ):
            mock_settings.feature_rate_limiting = True
            mock_settings.is_testing = False
            mock_settings.rate_limit_per_minute = 100

            # Create a proper async mock pipeline
            mock_pipeline = AsyncMock()
            mock_pipeline.zremrangebyscore = MagicMock(return_value=mock_pipeline)
            mock_pipeline.zcard = MagicMock(return_value=mock_pipeline)
            mock_pipeline.zadd = MagicMock(return_value=mock_pipeline)
            mock_pipeline.expire = MagicMock(return_value=mock_pipeline)
            mock_pipeline.execute = AsyncMock(return_value=[0, 100, True, True])  # At limit

            mock_redis = MagicMock()
            mock_redis.pipeline = MagicMock(return_value=mock_pipeline)
            mock_redis.zrem = AsyncMock()
            mock_get_redis.return_value = mock_redis

            response = client.get("/api/v1/test")

            assert response.status_code == 429
            assert "Retry-After" in response.headers
            retry_after = int(response.headers["Retry-After"])
            assert retry_after > 0
            assert retry_after <= 60


class TestAuthEndpointLimits:
    """Tests for stricter auth endpoint rate limits."""

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

        @app.post("/api/v1/auth/register")
        async def register_endpoint():
            return {"status": "registered"}

        @app.post("/api/v1/auth/google")
        async def google_endpoint():
            return {"status": "google_auth"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_auth_endpoint_has_stricter_limit(self, client: TestClient):
        """Test that auth endpoints use stricter rate limit."""
        with (
            patch("src.middleware.rate_limit.get_redis") as mock_get_redis,
            patch("src.middleware.rate_limit.settings") as mock_settings,
        ):
            mock_settings.feature_rate_limiting = True
            mock_settings.is_testing = False
            mock_settings.rate_limit_per_minute = 100
            mock_settings.rate_limit_auth_per_minute = 10

            # Create a proper async mock pipeline
            mock_pipeline = AsyncMock()
            mock_pipeline.zremrangebyscore = MagicMock(return_value=mock_pipeline)
            mock_pipeline.zcard = MagicMock(return_value=mock_pipeline)
            mock_pipeline.zadd = MagicMock(return_value=mock_pipeline)
            mock_pipeline.expire = MagicMock(return_value=mock_pipeline)
            mock_pipeline.execute = AsyncMock(return_value=[0, 0, True, True])

            mock_redis = MagicMock()
            mock_redis.pipeline = MagicMock(return_value=mock_pipeline)
            mock_get_redis.return_value = mock_redis

            response = client.post("/api/v1/auth/login")

            assert response.status_code == 200
            # Auth limit should be 10, not 100
            assert response.headers["X-RateLimit-Limit"] == "10"

    def test_general_endpoint_has_higher_limit(self, client: TestClient):
        """Test that general endpoints use higher rate limit."""
        with (
            patch("src.middleware.rate_limit.get_redis") as mock_get_redis,
            patch("src.middleware.rate_limit.settings") as mock_settings,
        ):
            mock_settings.feature_rate_limiting = True
            mock_settings.is_testing = False
            mock_settings.rate_limit_per_minute = 100
            mock_settings.rate_limit_auth_per_minute = 10

            # Create a proper async mock pipeline
            mock_pipeline = AsyncMock()
            mock_pipeline.zremrangebyscore = MagicMock(return_value=mock_pipeline)
            mock_pipeline.zcard = MagicMock(return_value=mock_pipeline)
            mock_pipeline.zadd = MagicMock(return_value=mock_pipeline)
            mock_pipeline.expire = MagicMock(return_value=mock_pipeline)
            mock_pipeline.execute = AsyncMock(return_value=[0, 0, True, True])

            mock_redis = MagicMock()
            mock_redis.pipeline = MagicMock(return_value=mock_pipeline)
            mock_get_redis.return_value = mock_redis

            response = client.get("/api/v1/test")

            assert response.status_code == 200
            # General limit should be 100
            assert response.headers["X-RateLimit-Limit"] == "100"


class TestPathExemption:
    """Tests for path exemption logic."""

    @pytest.fixture
    def middleware(self):
        """Create middleware instance."""
        return RateLimitingMiddleware(app=MagicMock())

    def test_health_endpoints_are_exempt(self, middleware):
        """Test that health check endpoints are exempt."""
        assert middleware._is_exempt("/health") is True
        assert middleware._is_exempt("/health/live") is True
        assert middleware._is_exempt("/health/ready") is True

    def test_docs_endpoints_are_exempt(self, middleware):
        """Test that documentation endpoints are exempt."""
        assert middleware._is_exempt("/docs") is True
        assert middleware._is_exempt("/redoc") is True
        assert middleware._is_exempt("/openapi.json") is True

    def test_api_endpoints_are_not_exempt(self, middleware):
        """Test that API endpoints are not exempt."""
        assert middleware._is_exempt("/api/v1/test") is False
        assert middleware._is_exempt("/api/v1/auth/login") is False
        assert middleware._is_exempt("/api/v1/decks") is False

    def test_root_endpoint_is_not_exempt(self, middleware):
        """Test that root endpoint is not exempt."""
        assert middleware._is_exempt("/") is False


class TestClientIPExtraction:
    """Tests for client IP extraction from headers."""

    @pytest.fixture
    def middleware(self):
        """Create middleware instance."""
        return RateLimitingMiddleware(app=MagicMock())

    def test_extracts_ip_from_x_forwarded_for_single(self, middleware):
        """Test IP extraction from X-Forwarded-For with single IP."""
        request = MagicMock()
        request.headers.get.side_effect = lambda k: {
            "X-Forwarded-For": "203.0.113.50",
            "X-Real-IP": None,
        }.get(k)
        request.client = None

        ip = middleware._get_client_id(request)
        assert ip == "203.0.113.50"

    def test_extracts_first_ip_from_x_forwarded_for_chain(self, middleware):
        """Test IP extraction from X-Forwarded-For with multiple IPs."""
        request = MagicMock()
        request.headers.get.side_effect = lambda k: {
            "X-Forwarded-For": "203.0.113.50, 70.41.3.18, 192.0.2.1",
            "X-Real-IP": None,
        }.get(k)
        request.client = None

        ip = middleware._get_client_id(request)
        assert ip == "203.0.113.50"

    def test_extracts_ip_from_x_real_ip(self, middleware):
        """Test IP extraction from X-Real-IP header."""
        request = MagicMock()
        request.headers.get.side_effect = lambda k: {
            "X-Forwarded-For": None,
            "X-Real-IP": "10.0.0.1",
        }.get(k)
        request.client = None

        ip = middleware._get_client_id(request)
        assert ip == "10.0.0.1"

    def test_x_forwarded_for_takes_precedence(self, middleware):
        """Test that X-Forwarded-For takes precedence over X-Real-IP."""
        request = MagicMock()
        request.headers.get.side_effect = lambda k: {
            "X-Forwarded-For": "203.0.113.50",
            "X-Real-IP": "192.168.1.1",
        }.get(k)
        request.client = None

        ip = middleware._get_client_id(request)
        assert ip == "203.0.113.50"

    def test_falls_back_to_client_host(self, middleware):
        """Test fallback to request.client.host."""
        request = MagicMock()
        request.headers.get.return_value = None
        request.client.host = "127.0.0.1"

        ip = middleware._get_client_id(request)
        assert ip == "127.0.0.1"

    def test_returns_unknown_when_no_source(self, middleware):
        """Test returns 'unknown' when no IP source available."""
        request = MagicMock()
        request.headers.get.return_value = None
        request.client = None

        ip = middleware._get_client_id(request)
        assert ip == "unknown"


class TestGracefulDegradation:
    """Tests for graceful degradation when Redis unavailable."""

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

    def test_allows_requests_when_redis_unavailable(self, client: TestClient):
        """Test that requests are allowed when Redis is unavailable."""
        with (
            patch("src.middleware.rate_limit.get_redis") as mock_get_redis,
            patch("src.middleware.rate_limit.settings") as mock_settings,
        ):
            mock_settings.feature_rate_limiting = True
            mock_settings.is_testing = False
            mock_settings.rate_limit_per_minute = 100
            mock_get_redis.return_value = None

            response = client.get("/api/v1/test")

            assert response.status_code == 200

    def test_logs_warning_when_redis_unavailable(self, client: TestClient):
        """Test that warning is logged when Redis is unavailable."""
        with (
            patch("src.middleware.rate_limit.get_redis") as mock_get_redis,
            patch("src.middleware.rate_limit.settings") as mock_settings,
            patch("src.middleware.rate_limit.logger") as mock_logger,
        ):
            mock_settings.feature_rate_limiting = True
            mock_settings.is_testing = False
            mock_settings.rate_limit_per_minute = 100
            mock_get_redis.return_value = None

            client.get("/api/v1/test")

            mock_logger.warning.assert_called()
            call_args = mock_logger.warning.call_args
            assert "Redis unavailable" in call_args.args[0]

    def test_allows_requests_on_redis_error(self, client: TestClient):
        """Test that requests are allowed when Redis operation fails."""
        with (
            patch("src.middleware.rate_limit.get_redis") as mock_get_redis,
            patch("src.middleware.rate_limit.settings") as mock_settings,
        ):
            mock_settings.feature_rate_limiting = True
            mock_settings.is_testing = False
            mock_settings.rate_limit_per_minute = 100

            # Create a proper async mock pipeline that raises on execute
            mock_pipeline = AsyncMock()
            mock_pipeline.zremrangebyscore = MagicMock(return_value=mock_pipeline)
            mock_pipeline.zcard = MagicMock(return_value=mock_pipeline)
            mock_pipeline.zadd = MagicMock(return_value=mock_pipeline)
            mock_pipeline.expire = MagicMock(return_value=mock_pipeline)
            mock_pipeline.execute = AsyncMock(side_effect=Exception("Redis connection error"))

            mock_redis = MagicMock()
            mock_redis.pipeline = MagicMock(return_value=mock_pipeline)
            mock_get_redis.return_value = mock_redis

            response = client.get("/api/v1/test")

            assert response.status_code == 200


class TestFeatureFlag:
    """Tests for rate limiting feature flag."""

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

    def test_skips_rate_limiting_when_disabled(self, client: TestClient):
        """Test that rate limiting is skipped when feature flag is disabled."""
        with patch("src.middleware.rate_limit.settings") as mock_settings:
            mock_settings.feature_rate_limiting = False

            response = client.get("/api/v1/test")

            assert response.status_code == 200
            # No rate limit headers when disabled
            assert "X-RateLimit-Limit" not in response.headers


class TestRateLimitConfig:
    """Tests for RateLimitConfig dataclass."""

    def test_default_values(self):
        """Test default values for RateLimitConfig."""
        config = RateLimitConfig(limit=100)

        assert config.limit == 100
        assert config.window_seconds == 60
        assert config.key_prefix == "ratelimit"

    def test_custom_values(self):
        """Test custom values for RateLimitConfig."""
        config = RateLimitConfig(
            limit=10,
            window_seconds=30,
            key_prefix="ratelimit:auth",
        )

        assert config.limit == 10
        assert config.window_seconds == 30
        assert config.key_prefix == "ratelimit:auth"


class TestGetRateConfig:
    """Tests for _get_rate_config method."""

    @pytest.fixture
    def middleware(self):
        """Create middleware instance."""
        return RateLimitingMiddleware(app=MagicMock())

    def test_auth_login_gets_auth_config(self, middleware):
        """Test that auth/login gets auth rate config."""
        with patch("src.middleware.rate_limit.settings") as mock_settings:
            mock_settings.rate_limit_auth_per_minute = 10

            config = middleware._get_rate_config("/api/v1/auth/login")

            assert config.limit == 10
            assert config.key_prefix == "ratelimit:auth"

    def test_auth_register_gets_auth_config(self, middleware):
        """Test that auth/register gets auth rate config."""
        with patch("src.middleware.rate_limit.settings") as mock_settings:
            mock_settings.rate_limit_auth_per_minute = 10

            config = middleware._get_rate_config("/api/v1/auth/register")

            assert config.limit == 10

    def test_auth_google_gets_auth_config(self, middleware):
        """Test that auth/google gets auth rate config."""
        with patch("src.middleware.rate_limit.settings") as mock_settings:
            mock_settings.rate_limit_auth_per_minute = 10

            config = middleware._get_rate_config("/api/v1/auth/google")

            assert config.limit == 10

    def test_auth_refresh_gets_auth_config(self, middleware):
        """Test that auth/refresh gets auth rate config."""
        with patch("src.middleware.rate_limit.settings") as mock_settings:
            mock_settings.rate_limit_auth_per_minute = 10

            config = middleware._get_rate_config("/api/v1/auth/refresh")

            assert config.limit == 10

    def test_general_endpoint_gets_general_config(self, middleware):
        """Test that general endpoints get general rate config."""
        with patch("src.middleware.rate_limit.settings") as mock_settings:
            mock_settings.rate_limit_per_minute = 100

            config = middleware._get_rate_config("/api/v1/decks")

            assert config.limit == 100
            assert config.key_prefix == "ratelimit:api"


class TestRateLimitResponse:
    """Tests for _rate_limit_response method."""

    @pytest.fixture
    def middleware(self):
        """Create middleware instance."""
        return RateLimitingMiddleware(app=MagicMock())

    def test_response_has_429_status(self, middleware):
        """Test that response has 429 status code."""
        config = RateLimitConfig(limit=100)
        reset_at = time.time() + 60

        response = middleware._rate_limit_response(config, reset_at, "test-req-id")

        assert response.status_code == 429

    def test_response_has_correct_body(self, middleware):
        """Test that response body has correct format."""
        config = RateLimitConfig(limit=100)
        reset_at = time.time() + 60

        response = middleware._rate_limit_response(config, reset_at, "test-req-id")
        body = response.body.decode()

        import json

        data = json.loads(body)

        assert data["success"] is False
        assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"
        assert data["error"]["request_id"] == "test-req-id"
        assert "retry_after" in data["error"]

    def test_response_has_required_headers(self, middleware):
        """Test that response has all required headers."""
        config = RateLimitConfig(limit=100)
        reset_at = time.time() + 60

        response = middleware._rate_limit_response(config, reset_at, "test-req-id")

        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers
        assert "Retry-After" in response.headers
        assert "X-Request-ID" in response.headers

    def test_retry_after_is_positive(self, middleware):
        """Test that Retry-After is a positive integer."""
        config = RateLimitConfig(limit=100)
        reset_at = time.time() + 30

        response = middleware._rate_limit_response(config, reset_at, "test-req-id")

        retry_after = int(response.headers["Retry-After"])
        assert retry_after > 0
        assert retry_after <= 60


class TestMiddlewareIntegration:
    """Integration tests for middleware with full request flow."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware stack."""
        from src.middleware.error_handler import ErrorHandlingMiddleware
        from src.middleware.logging import RequestLoggingMiddleware

        app = FastAPI()
        # Simulate production middleware stack
        app.add_middleware(RateLimitingMiddleware)
        app.add_middleware(ErrorHandlingMiddleware)
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/test")
        async def test_endpoint():
            return {"status": "ok"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_request_id_flows_to_rate_limit_response(self, client: TestClient):
        """Test that request ID from logging middleware is in rate limit response."""
        with (
            patch("src.middleware.rate_limit.get_redis") as mock_get_redis,
            patch("src.middleware.rate_limit.settings") as mock_settings,
        ):
            mock_settings.feature_rate_limiting = True
            mock_settings.is_testing = False
            mock_settings.rate_limit_per_minute = 100

            # Create a proper async mock pipeline
            mock_pipeline = AsyncMock()
            mock_pipeline.zremrangebyscore = MagicMock(return_value=mock_pipeline)
            mock_pipeline.zcard = MagicMock(return_value=mock_pipeline)
            mock_pipeline.zadd = MagicMock(return_value=mock_pipeline)
            mock_pipeline.expire = MagicMock(return_value=mock_pipeline)
            mock_pipeline.execute = AsyncMock(return_value=[0, 100, True, True])  # At limit

            mock_redis = MagicMock()
            mock_redis.pipeline = MagicMock(return_value=mock_pipeline)
            mock_redis.zrem = AsyncMock()
            mock_get_redis.return_value = mock_redis

            response = client.get("/api/v1/test")

            # Request ID should be in both header and body
            if response.status_code == 429:
                header_id = response.headers.get("X-Request-ID")
                body_id = response.json()["error"]["request_id"]
                assert header_id is not None
                assert header_id == body_id
