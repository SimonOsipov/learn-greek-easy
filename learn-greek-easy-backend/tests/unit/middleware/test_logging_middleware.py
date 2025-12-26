"""Unit tests for request logging middleware.

Tests cover:
- Request ID generation and uniqueness
- Path exclusion logic
- Client IP extraction from headers
- Log levels by status code
- X-Request-ID header in response
- Exception handling
- Request state storage
- Sensitive data redaction
"""

from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient

from src.middleware.logging import RequestLoggingMiddleware


@contextmanager
def mock_logger_contextualize():
    """Mock logger.contextualize as a context manager."""
    with patch("src.middleware.logging.logger") as mock_logger:
        # Create a proper context manager mock for contextualize
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=None)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_logger.contextualize.return_value = mock_ctx
        yield mock_logger


class TestRequestIdGeneration:
    """Tests for request ID generation."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/test")
        async def test_endpoint():
            return {"status": "ok"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_generates_request_id(self, client: TestClient):
        """Test that request ID is generated and returned in header."""
        response = client.get("/api/v1/test")

        assert response.status_code == 200
        assert "X-Request-ID" in response.headers
        assert len(response.headers["X-Request-ID"]) == 8

    def test_request_id_is_unique(self, client: TestClient):
        """Test that each request gets a unique ID."""
        response1 = client.get("/api/v1/test")
        response2 = client.get("/api/v1/test")

        assert response1.headers["X-Request-ID"] != response2.headers["X-Request-ID"]

    def test_request_id_is_alphanumeric(self, client: TestClient):
        """Test that request ID contains only alphanumeric characters and hyphens."""
        response = client.get("/api/v1/test")
        request_id = response.headers["X-Request-ID"]

        # UUID prefix should be alphanumeric with possible hyphens
        assert all(c.isalnum() or c == "-" for c in request_id)


class TestRequestIdStorage:
    """Tests for request ID storage in request.state."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/capture")
        async def capture_endpoint(request: Request):
            request_id = getattr(request.state, "request_id", None)
            return {"captured_id": request_id}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_request_id_stored_in_state(self, client: TestClient):
        """Test that request ID is accessible via request.state."""
        response = client.get("/api/v1/capture")

        assert response.status_code == 200
        data = response.json()
        assert data["captured_id"] is not None
        assert data["captured_id"] == response.headers["X-Request-ID"]

    def test_request_id_matches_header(self, client: TestClient):
        """Test that stored request ID matches the response header."""
        response = client.get("/api/v1/capture")

        data = response.json()
        header_id = response.headers["X-Request-ID"]
        state_id = data["captured_id"]

        assert state_id == header_id


class TestPathExclusion:
    """Tests for path exclusion logic."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/test")
        async def test_endpoint():
            return {"status": "ok"}

        @app.get("/health/live")
        async def health_live():
            return {"status": "alive"}

        @app.get("/health")
        async def health():
            return {"status": "healthy"}

        @app.get("/health/ready")
        async def health_ready():
            return {"status": "ready"}

        @app.get("/docs")
        async def docs():
            return {"docs": "page"}

        @app.get("/redoc")
        async def redoc():
            return {"redoc": "page"}

        @app.get("/openapi.json")
        async def openapi():
            return {"openapi": "spec"}

        @app.get("/favicon.ico")
        async def favicon():
            return {"icon": "data"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_excludes_health_live_from_logging(self, client: TestClient):
        """Test that /health/live is excluded from logging."""
        with mock_logger_contextualize() as mock_logger:
            response = client.get("/health/live")

            assert response.status_code == 200
            assert "X-Request-ID" not in response.headers
            mock_logger.info.assert_not_called()

    def test_includes_health_in_logging(self, client: TestClient):
        """Test that /health is NOT excluded from logging."""
        with mock_logger_contextualize() as mock_logger:
            response = client.get("/health")

            assert response.status_code == 200
            assert "X-Request-ID" in response.headers
            mock_logger.info.assert_called()

    def test_includes_health_ready_in_logging(self, client: TestClient):
        """Test that /health/ready is NOT excluded from logging."""
        with mock_logger_contextualize() as mock_logger:
            response = client.get("/health/ready")

            assert response.status_code == 200
            assert "X-Request-ID" in response.headers
            mock_logger.info.assert_called()

    def test_excludes_docs_from_logging(self, client: TestClient):
        """Test that /docs is excluded from logging."""
        with mock_logger_contextualize() as mock_logger:
            response = client.get("/docs")

            assert response.status_code == 200
            assert "X-Request-ID" not in response.headers
            mock_logger.info.assert_not_called()

    def test_excludes_docs_subpaths_from_logging(self, client: TestClient):
        """Test that /docs/* subpaths are excluded from logging."""
        middleware = RequestLoggingMiddleware(app=MagicMock())
        # /docs/oauth2-redirect should be excluded since it starts with /docs
        assert middleware._should_skip("/docs/oauth2-redirect") is True

    def test_excludes_redoc_from_logging(self, client: TestClient):
        """Test that /redoc is excluded from logging."""
        with mock_logger_contextualize() as mock_logger:
            response = client.get("/redoc")

            assert response.status_code == 200
            assert "X-Request-ID" not in response.headers
            mock_logger.info.assert_not_called()

    def test_excludes_openapi_json_from_logging(self, client: TestClient):
        """Test that /openapi.json is excluded from logging."""
        with mock_logger_contextualize() as mock_logger:
            response = client.get("/openapi.json")

            assert response.status_code == 200
            assert "X-Request-ID" not in response.headers
            mock_logger.info.assert_not_called()

    def test_excludes_favicon_from_logging(self, client: TestClient):
        """Test that /favicon.ico is excluded from logging."""
        with mock_logger_contextualize() as mock_logger:
            response = client.get("/favicon.ico")

            assert response.status_code == 200
            assert "X-Request-ID" not in response.headers
            mock_logger.info.assert_not_called()

    def test_includes_api_endpoints_in_logging(self, client: TestClient):
        """Test that API endpoints are NOT excluded from logging."""
        with mock_logger_contextualize() as mock_logger:
            response = client.get("/api/v1/test")

            assert response.status_code == 200
            assert "X-Request-ID" in response.headers
            mock_logger.info.assert_called()


class TestShouldSkipHelper:
    """Tests for the _should_skip helper method."""

    @pytest.fixture
    def middleware(self):
        """Create middleware instance."""
        return RequestLoggingMiddleware(app=MagicMock())

    def test_should_skip_excluded_paths(self, middleware):
        """Test path exclusion logic."""
        assert middleware._should_skip("/health/live") is True
        assert middleware._should_skip("/docs") is True
        assert middleware._should_skip("/docs/oauth2-redirect") is True
        assert middleware._should_skip("/redoc") is True
        assert middleware._should_skip("/openapi.json") is True
        assert middleware._should_skip("/favicon.ico") is True

    def test_should_not_skip_api_paths(self, middleware):
        """Test that API paths are not skipped."""
        assert middleware._should_skip("/api/v1/decks") is False
        assert middleware._should_skip("/health") is False
        assert middleware._should_skip("/health/ready") is False
        assert middleware._should_skip("/api/v1/auth/login") is False
        assert middleware._should_skip("/") is False


class TestLogContent:
    """Tests for log content verification."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/test")
        async def test_endpoint():
            return {"status": "ok"}

        @app.post("/api/v1/data")
        async def post_endpoint():
            return {"created": True}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_logs_request_started(self, client: TestClient):
        """Test that request start is logged."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/test")

            # Find the "Request started" call
            started_calls = [
                call
                for call in mock_logger.info.call_args_list
                if call.args[0] == "Request started"
            ]
            assert len(started_calls) == 1

    def test_logs_request_completed(self, client: TestClient):
        """Test that request completion is logged."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/test")

            # Find the "Request completed" call via logger.log
            mock_logger.log.assert_called_once()
            call_args = mock_logger.log.call_args
            assert call_args.args[1] == "Request completed"

    def test_log_contains_method(self, client: TestClient):
        """Test that logs contain HTTP method."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/test")

            started_call = mock_logger.info.call_args
            assert started_call.kwargs["method"] == "GET"

            completed_call = mock_logger.log.call_args
            assert completed_call.kwargs["method"] == "GET"

    def test_log_contains_post_method(self, client: TestClient):
        """Test that logs contain POST method for POST requests."""
        with mock_logger_contextualize() as mock_logger:
            client.post("/api/v1/data")

            started_call = mock_logger.info.call_args
            assert started_call.kwargs["method"] == "POST"

    def test_log_contains_path(self, client: TestClient):
        """Test that logs contain request path."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/test")

            started_call = mock_logger.info.call_args
            assert started_call.kwargs["path"] == "/api/v1/test"

            completed_call = mock_logger.log.call_args
            assert completed_call.kwargs["path"] == "/api/v1/test"

    def test_log_contains_query_params(self, client: TestClient):
        """Test that logs contain query parameters."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/test?page=1&limit=10")

            started_call = mock_logger.info.call_args
            query = started_call.kwargs["query"]
            assert "page=1" in query
            assert "limit=10" in query

    def test_log_contains_null_query_when_empty(self, client: TestClient):
        """Test that query is None when no query params."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/test")

            started_call = mock_logger.info.call_args
            assert started_call.kwargs["query"] is None

    def test_log_contains_status_code(self, client: TestClient):
        """Test that completed log contains status code."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/test")

            completed_call = mock_logger.log.call_args
            assert completed_call.kwargs["status_code"] == 200

    def test_log_contains_duration_ms(self, client: TestClient):
        """Test that completed log contains duration in milliseconds."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/test")

            completed_call = mock_logger.log.call_args
            duration = completed_call.kwargs["duration_ms"]
            assert isinstance(duration, float)
            assert duration >= 0

    def test_log_contains_user_agent(self, client: TestClient):
        """Test that started log contains user agent."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/test", headers={"User-Agent": "TestAgent/1.0"})

            started_call = mock_logger.info.call_args
            assert started_call.kwargs["user_agent"] == "TestAgent/1.0"


class TestClientIPExtraction:
    """Tests for client IP extraction from various headers."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/test")
        async def test_endpoint():
            return {"status": "ok"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_extracts_ip_from_x_forwarded_for_single(self, client: TestClient):
        """Test IP extraction from X-Forwarded-For with single IP."""
        with mock_logger_contextualize() as mock_logger:
            client.get(
                "/api/v1/test",
                headers={"X-Forwarded-For": "203.0.113.50"},
            )

            started_call = mock_logger.info.call_args
            assert started_call.kwargs["client_ip"] == "203.0.113.50"

    def test_extracts_first_ip_from_x_forwarded_for_chain(self, client: TestClient):
        """Test IP extraction from X-Forwarded-For with multiple IPs."""
        with mock_logger_contextualize() as mock_logger:
            client.get(
                "/api/v1/test",
                headers={"X-Forwarded-For": "203.0.113.50, 70.41.3.18, 192.0.2.1"},
            )

            started_call = mock_logger.info.call_args
            assert started_call.kwargs["client_ip"] == "203.0.113.50"

    def test_extracts_ip_from_x_real_ip(self, client: TestClient):
        """Test IP extraction from X-Real-IP header."""
        with mock_logger_contextualize() as mock_logger:
            client.get(
                "/api/v1/test",
                headers={"X-Real-IP": "10.0.0.1"},
            )

            started_call = mock_logger.info.call_args
            assert started_call.kwargs["client_ip"] == "10.0.0.1"

    def test_x_forwarded_for_takes_precedence_over_x_real_ip(self, client: TestClient):
        """Test that X-Forwarded-For takes precedence over X-Real-IP."""
        with mock_logger_contextualize() as mock_logger:
            client.get(
                "/api/v1/test",
                headers={
                    "X-Forwarded-For": "203.0.113.50",
                    "X-Real-IP": "192.168.1.1",
                },
            )

            started_call = mock_logger.info.call_args
            assert started_call.kwargs["client_ip"] == "203.0.113.50"

    def test_extracts_ip_from_direct_connection(self, client: TestClient):
        """Test IP extraction from direct connection."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/test")

            started_call = mock_logger.info.call_args
            # TestClient uses "testclient" as the host
            assert started_call.kwargs["client_ip"] == "testclient"

    def test_strips_whitespace_from_forwarded_for(self, client: TestClient):
        """Test that whitespace is stripped from X-Forwarded-For IPs."""
        with mock_logger_contextualize() as mock_logger:
            client.get(
                "/api/v1/test",
                headers={"X-Forwarded-For": "  203.0.113.50  , 198.51.100.178"},
            )

            started_call = mock_logger.info.call_args
            assert started_call.kwargs["client_ip"] == "203.0.113.50"


class TestGetClientIPHelper:
    """Tests for the _get_client_ip helper method."""

    @pytest.fixture
    def middleware(self):
        """Create middleware instance."""
        return RequestLoggingMiddleware(app=MagicMock())

    def test_get_client_ip_from_forwarded_for(self, middleware):
        """Test IP extraction from X-Forwarded-For."""
        request = MagicMock()
        request.headers.get.side_effect = lambda k: {
            "X-Forwarded-For": "203.0.113.50, 70.41.3.18",
            "X-Real-IP": None,
        }.get(k)
        request.client = None

        ip = middleware._get_client_ip(request)
        assert ip == "203.0.113.50"

    def test_get_client_ip_from_real_ip(self, middleware):
        """Test IP extraction from X-Real-IP."""
        request = MagicMock()
        request.headers.get.side_effect = lambda k: {
            "X-Forwarded-For": None,
            "X-Real-IP": "10.0.0.1",
        }.get(k)
        request.client = None

        ip = middleware._get_client_ip(request)
        assert ip == "10.0.0.1"

    def test_get_client_ip_from_client(self, middleware):
        """Test IP extraction from request.client."""
        request = MagicMock()
        request.headers.get.return_value = None
        request.client.host = "127.0.0.1"

        ip = middleware._get_client_ip(request)
        assert ip == "127.0.0.1"

    def test_get_client_ip_none(self, middleware):
        """Test IP extraction when no source available."""
        request = MagicMock()
        request.headers.get.return_value = None
        request.client = None

        ip = middleware._get_client_ip(request)
        assert ip is None


class TestLogLevel:
    """Tests for log level selection based on status code."""

    @pytest.fixture
    def app(self) -> FastAPI:  # noqa: C901
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/success")
        async def success():
            return {"status": "ok"}

        @app.get("/api/v1/created")
        async def created():
            from fastapi.responses import JSONResponse

            return JSONResponse(status_code=201, content={"status": "created"})

        @app.get("/api/v1/redirect")
        async def redirect():
            from fastapi.responses import RedirectResponse

            return RedirectResponse(url="/api/v1/success", status_code=302)

        @app.get("/api/v1/bad-request")
        async def bad_request():
            raise HTTPException(status_code=400, detail="Bad request")

        @app.get("/api/v1/unauthorized")
        async def unauthorized():
            raise HTTPException(status_code=401, detail="Unauthorized")

        @app.get("/api/v1/forbidden")
        async def forbidden():
            raise HTTPException(status_code=403, detail="Forbidden")

        @app.get("/api/v1/not-found")
        async def not_found():
            raise HTTPException(status_code=404, detail="Not found")

        @app.get("/api/v1/unprocessable")
        async def unprocessable():
            raise HTTPException(status_code=422, detail="Validation error")

        @app.get("/api/v1/too-many-requests")
        async def too_many():
            raise HTTPException(status_code=429, detail="Rate limited")

        @app.get("/api/v1/server-error")
        async def server_error():
            raise HTTPException(status_code=500, detail="Server error")

        @app.get("/api/v1/bad-gateway")
        async def bad_gateway():
            raise HTTPException(status_code=502, detail="Bad gateway")

        @app.get("/api/v1/service-unavailable")
        async def service_unavailable():
            raise HTTPException(status_code=503, detail="Service unavailable")

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app, raise_server_exceptions=False)

    def test_logs_info_for_200_responses(self, client: TestClient):
        """Test that 200 responses are logged as INFO."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/success")

            completed_call = mock_logger.log.call_args
            assert completed_call.args[0] == "INFO"

    def test_logs_info_for_201_responses(self, client: TestClient):
        """Test that 201 responses are logged as INFO."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/created")

            completed_call = mock_logger.log.call_args
            assert completed_call.args[0] == "INFO"

    def test_logs_info_for_302_responses(self, client: TestClient):
        """Test that 302 redirects are logged as INFO."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/redirect", follow_redirects=False)

            completed_call = mock_logger.log.call_args
            assert completed_call.args[0] == "INFO"

    def test_logs_warning_for_400_responses(self, client: TestClient):
        """Test that 400 responses are logged as WARNING."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/bad-request")

            completed_call = mock_logger.log.call_args
            assert completed_call.args[0] == "WARNING"

    def test_logs_warning_for_401_responses(self, client: TestClient):
        """Test that 401 responses are logged as WARNING."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/unauthorized")

            completed_call = mock_logger.log.call_args
            assert completed_call.args[0] == "WARNING"

    def test_logs_warning_for_403_responses(self, client: TestClient):
        """Test that 403 responses are logged as WARNING."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/forbidden")

            completed_call = mock_logger.log.call_args
            assert completed_call.args[0] == "WARNING"

    def test_logs_warning_for_404_responses(self, client: TestClient):
        """Test that 404 responses are logged as WARNING."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/not-found")

            completed_call = mock_logger.log.call_args
            assert completed_call.args[0] == "WARNING"

    def test_logs_warning_for_422_responses(self, client: TestClient):
        """Test that 422 responses are logged as WARNING."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/unprocessable")

            completed_call = mock_logger.log.call_args
            assert completed_call.args[0] == "WARNING"

    def test_logs_warning_for_429_responses(self, client: TestClient):
        """Test that 429 responses are logged as WARNING."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/too-many-requests")

            completed_call = mock_logger.log.call_args
            assert completed_call.args[0] == "WARNING"

    def test_logs_error_for_500_responses(self, client: TestClient):
        """Test that 500 responses are logged as ERROR."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/server-error")

            completed_call = mock_logger.log.call_args
            assert completed_call.args[0] == "ERROR"

    def test_logs_error_for_502_responses(self, client: TestClient):
        """Test that 502 responses are logged as ERROR."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/bad-gateway")

            completed_call = mock_logger.log.call_args
            assert completed_call.args[0] == "ERROR"

    def test_logs_error_for_503_responses(self, client: TestClient):
        """Test that 503 responses are logged as ERROR."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/service-unavailable")

            completed_call = mock_logger.log.call_args
            assert completed_call.args[0] == "ERROR"


class TestGetLogLevelNameHelper:
    """Tests for the _get_log_level_name helper method."""

    @pytest.fixture
    def middleware(self):
        """Create middleware instance."""
        return RequestLoggingMiddleware(app=MagicMock())

    def test_get_log_level_name_success(self, middleware):
        """Test log level name for successful responses."""
        assert middleware._get_log_level_name(200) == "INFO"
        assert middleware._get_log_level_name(201) == "INFO"
        assert middleware._get_log_level_name(204) == "INFO"
        assert middleware._get_log_level_name(301) == "INFO"
        assert middleware._get_log_level_name(302) == "INFO"

    def test_get_log_level_name_client_error(self, middleware):
        """Test log level name for client errors."""
        assert middleware._get_log_level_name(400) == "WARNING"
        assert middleware._get_log_level_name(401) == "WARNING"
        assert middleware._get_log_level_name(403) == "WARNING"
        assert middleware._get_log_level_name(404) == "WARNING"
        assert middleware._get_log_level_name(422) == "WARNING"
        assert middleware._get_log_level_name(429) == "WARNING"

    def test_get_log_level_name_server_error(self, middleware):
        """Test log level name for server errors."""
        assert middleware._get_log_level_name(500) == "ERROR"
        assert middleware._get_log_level_name(502) == "ERROR"
        assert middleware._get_log_level_name(503) == "ERROR"


class TestRequestTiming:
    """Tests for request timing measurement."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        import asyncio

        app = FastAPI()
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/slow")
        async def slow_endpoint():
            await asyncio.sleep(0.05)  # 50ms delay
            return {"status": "slow"}

        @app.get("/api/v1/fast")
        async def fast_endpoint():
            return {"status": "fast"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_duration_is_positive(self, client: TestClient):
        """Test that duration is a positive number."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/fast")

            completed_call = mock_logger.log.call_args
            duration = completed_call.kwargs["duration_ms"]
            assert duration > 0

    def test_duration_is_rounded(self, client: TestClient):
        """Test that duration is rounded to 2 decimal places."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/fast")

            completed_call = mock_logger.log.call_args
            duration = completed_call.kwargs["duration_ms"]
            duration_str = str(duration)
            if "." in duration_str:
                decimal_places = len(duration_str.split(".")[1])
                assert decimal_places <= 2

    def test_slow_endpoint_has_higher_duration(self, client: TestClient):
        """Test that slow endpoint has higher duration than fast."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/slow")
            slow_call = mock_logger.log.call_args
            slow_duration = slow_call.kwargs["duration_ms"]

            mock_logger.reset_mock()

            client.get("/api/v1/fast")
            fast_call = mock_logger.log.call_args
            fast_duration = fast_call.kwargs["duration_ms"]

            # Slow endpoint should take at least 40ms (we added 50ms delay)
            assert slow_duration >= 40
            assert slow_duration > fast_duration


class TestExceptionHandling:
    """Tests for exception handling in middleware."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/error")
        async def error_endpoint():
            raise ValueError("Test error")

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app, raise_server_exceptions=False)

    def test_logs_exception_with_error_message(self, client: TestClient):
        """Test that exceptions are logged with error message."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/error")

            # Should have logged the exception
            mock_logger.exception.assert_called_once()
            exception_call = mock_logger.exception.call_args
            assert exception_call.kwargs["error"] == "Test error"

    def test_logs_exception_with_duration(self, client: TestClient):
        """Test that exceptions are logged with duration."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/error")

            exception_call = mock_logger.exception.call_args
            assert "duration_ms" in exception_call.kwargs
            assert exception_call.kwargs["duration_ms"] >= 0

    def test_logs_exception_message(self, client: TestClient):
        """Test that correct exception message is logged."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/error")

            exception_call = mock_logger.exception.call_args
            assert exception_call.args[0] == "Request failed with unhandled exception"


class TestMiddlewareIntegration:
    """Integration tests for middleware with FastAPI app."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/test")
        async def test_endpoint():
            return {"status": "ok"}

        @app.post("/api/v1/data")
        async def post_endpoint():
            return {"created": True}

        @app.get("/health/live")
        async def health_live():
            return {"status": "alive"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_middleware_does_not_modify_response_body(self, client: TestClient):
        """Test that middleware does not modify the response body."""
        response = client.get("/api/v1/test")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_middleware_does_not_break_excluded_endpoints(self, client: TestClient):
        """Test that middleware does not interfere with excluded endpoints."""
        response = client.get("/health/live")
        assert response.status_code == 200
        assert response.json() == {"status": "alive"}

    def test_multiple_requests_logged_independently(self, client: TestClient):
        """Test that multiple requests are logged independently."""
        with mock_logger_contextualize() as mock_logger:
            client.get("/api/v1/test")
            client.post("/api/v1/data")

            # Should have 2 "Request started" logs and 2 "Request completed" logs
            assert mock_logger.info.call_count == 2
            assert mock_logger.log.call_count == 2

    def test_request_ids_are_unique_across_requests(self, client: TestClient):
        """Test that request IDs are unique for each request."""
        response1 = client.get("/api/v1/test")
        response2 = client.get("/api/v1/test")
        response3 = client.post("/api/v1/data")

        ids = {
            response1.headers["X-Request-ID"],
            response2.headers["X-Request-ID"],
            response3.headers["X-Request-ID"],
        }

        assert len(ids) == 3  # All unique


class TestMiddlewareAttributes:
    """Tests for middleware class attributes."""

    def test_excluded_paths_contains_expected_endpoints(self):
        """Test that EXCLUDED_PATHS contains expected endpoints."""
        excluded = RequestLoggingMiddleware.EXCLUDED_PATHS
        assert "/health/live" in excluded
        assert "/docs" in excluded
        assert "/redoc" in excluded
        assert "/openapi.json" in excluded
        assert "/favicon.ico" in excluded

    def test_excluded_paths_does_not_contain_health(self):
        """Test that /health is not in excluded paths."""
        excluded = RequestLoggingMiddleware.EXCLUDED_PATHS
        # /health should NOT be excluded (only /health/live)
        assert "/health" not in excluded

    def test_excluded_paths_does_not_contain_health_ready(self):
        """Test that /health/ready is not in excluded paths."""
        excluded = RequestLoggingMiddleware.EXCLUDED_PATHS
        assert "/health/ready" not in excluded

    def test_excluded_paths_does_not_contain_api_endpoints(self):
        """Test that API endpoints are not in excluded paths."""
        excluded = RequestLoggingMiddleware.EXCLUDED_PATHS
        # No API endpoints should be excluded
        assert not any("/api/" in path for path in excluded)

    def test_sensitive_headers_contains_expected_headers(self):
        """Test that SENSITIVE_HEADERS contains expected headers."""
        sensitive = RequestLoggingMiddleware.SENSITIVE_HEADERS
        assert "authorization" in sensitive
        assert "cookie" in sensitive
        assert "x-api-key" in sensitive
        assert "x-test-seed-secret" in sensitive

    def test_sensitive_body_fields_contains_expected_fields(self):
        """Test that SENSITIVE_BODY_FIELDS contains expected fields."""
        sensitive = RequestLoggingMiddleware.SENSITIVE_BODY_FIELDS
        assert "password" in sensitive
        assert "token" in sensitive
        assert "secret" in sensitive
        assert "api_key" in sensitive
        assert "apikey" in sensitive
        assert "refresh_token" in sensitive
        assert "access_token" in sensitive


class TestHeaderRedaction:
    """Tests for sensitive header redaction."""

    @pytest.fixture
    def middleware(self):
        """Create middleware instance."""
        return RequestLoggingMiddleware(app=MagicMock())

    def test_redacts_authorization_header(self, middleware):
        """Test that authorization header is redacted."""
        headers = {
            "Authorization": "Bearer secret-token-123",
            "Content-Type": "application/json",
        }
        redacted = middleware._redact_headers(headers)

        assert redacted["Authorization"] == "[REDACTED]"
        assert redacted["Content-Type"] == "application/json"

    def test_redacts_cookie_header(self, middleware):
        """Test that cookie header is redacted."""
        headers = {
            "Cookie": "session=abc123",
            "Accept": "application/json",
        }
        redacted = middleware._redact_headers(headers)

        assert redacted["Cookie"] == "[REDACTED]"
        assert redacted["Accept"] == "application/json"

    def test_redacts_api_key_header(self, middleware):
        """Test that x-api-key header is redacted."""
        headers = {
            "X-API-Key": "my-secret-api-key",
            "Host": "example.com",
        }
        redacted = middleware._redact_headers(headers)

        assert redacted["X-API-Key"] == "[REDACTED]"
        assert redacted["Host"] == "example.com"

    def test_redacts_test_seed_secret_header(self, middleware):
        """Test that x-test-seed-secret header is redacted."""
        headers = {
            "X-Test-Seed-Secret": "seed-secret",
            "User-Agent": "TestClient/1.0",
        }
        redacted = middleware._redact_headers(headers)

        assert redacted["X-Test-Seed-Secret"] == "[REDACTED]"
        assert redacted["User-Agent"] == "TestClient/1.0"

    def test_redaction_is_case_insensitive(self, middleware):
        """Test that header redaction is case insensitive."""
        headers = {
            "AUTHORIZATION": "Bearer token",
            "authorization": "Bearer token",
            "Authorization": "Bearer token",
        }
        redacted = middleware._redact_headers(headers)

        # All should be redacted
        assert all(v == "[REDACTED]" for v in redacted.values())

    def test_preserves_non_sensitive_headers(self, middleware):
        """Test that non-sensitive headers are preserved."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Custom-Header": "custom-value",
        }
        redacted = middleware._redact_headers(headers)

        assert redacted == headers


class TestBodyRedaction:
    """Tests for sensitive body field redaction."""

    @pytest.fixture
    def middleware(self):
        """Create middleware instance."""
        return RequestLoggingMiddleware(app=MagicMock())

    def test_redacts_password_field(self, middleware):
        """Test that password field is redacted."""
        body = {
            "username": "testuser",
            "password": "secret123",
        }
        redacted = middleware._redact_body(body)

        assert redacted["username"] == "testuser"
        assert redacted["password"] == "[REDACTED]"

    def test_redacts_token_fields(self, middleware):
        """Test that token fields are redacted."""
        body = {
            "token": "jwt-token",
            "refresh_token": "refresh-jwt",
            "access_token": "access-jwt",
            "user_id": 123,
        }
        redacted = middleware._redact_body(body)

        assert redacted["token"] == "[REDACTED]"
        assert redacted["refresh_token"] == "[REDACTED]"
        assert redacted["access_token"] == "[REDACTED]"
        assert redacted["user_id"] == 123

    def test_redacts_secret_field(self, middleware):
        """Test that secret field is redacted."""
        body = {
            "secret": "my-secret",
            "name": "Test",
        }
        redacted = middleware._redact_body(body)

        assert redacted["secret"] == "[REDACTED]"
        assert redacted["name"] == "Test"

    def test_redacts_api_key_fields(self, middleware):
        """Test that api_key and apikey fields are redacted."""
        body = {
            "api_key": "key-123",
            "apikey": "key-456",
            "service": "test-service",
        }
        redacted = middleware._redact_body(body)

        assert redacted["api_key"] == "[REDACTED]"
        assert redacted["apikey"] == "[REDACTED]"
        assert redacted["service"] == "test-service"

    def test_redacts_nested_fields(self, middleware):
        """Test that nested sensitive fields are redacted."""
        body = {
            "user": {
                "email": "user@example.com",
                "password": "secret123",
            },
            "name": "Test",
        }
        redacted = middleware._redact_body(body)

        assert redacted["user"]["email"] == "user@example.com"
        assert redacted["user"]["password"] == "[REDACTED]"
        assert redacted["name"] == "Test"

    def test_redacts_deeply_nested_fields(self, middleware):
        """Test that deeply nested sensitive fields are redacted."""
        body = {
            "data": {
                "auth": {
                    "credentials": {
                        "password": "deep-secret",
                    },
                },
            },
        }
        redacted = middleware._redact_body(body)

        assert redacted["data"]["auth"]["credentials"]["password"] == "[REDACTED]"

    def test_redacts_fields_in_lists(self, middleware):
        """Test that sensitive fields in lists are redacted."""
        body = {
            "users": [
                {"name": "User1", "password": "pass1"},
                {"name": "User2", "password": "pass2"},
            ],
        }
        redacted = middleware._redact_body(body)

        assert redacted["users"][0]["name"] == "User1"
        assert redacted["users"][0]["password"] == "[REDACTED]"
        assert redacted["users"][1]["name"] == "User2"
        assert redacted["users"][1]["password"] == "[REDACTED]"

    def test_handles_none_body(self, middleware):
        """Test that None body is handled."""
        assert middleware._redact_body(None) is None

    def test_handles_non_dict_body(self, middleware):
        """Test that non-dict body is returned unchanged."""
        assert middleware._redact_body("string") == "string"
        assert middleware._redact_body(123) == 123
        assert middleware._redact_body([1, 2, 3]) == [1, 2, 3]

    def test_redaction_is_case_insensitive(self, middleware):
        """Test that body redaction is case insensitive."""
        body = {
            "PASSWORD": "pass1",
            "Password": "pass2",
            "password": "pass3",
        }
        redacted = middleware._redact_body(body)

        assert all(v == "[REDACTED]" for v in redacted.values())

    def test_preserves_non_sensitive_fields(self, middleware):
        """Test that non-sensitive fields are preserved."""
        body = {
            "name": "Test User",
            "email": "test@example.com",
            "age": 25,
            "active": True,
        }
        redacted = middleware._redact_body(body)

        assert redacted == body


class TestContextualize:
    """Tests for logger.contextualize usage."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/test")
        async def test_endpoint():
            return {"status": "ok"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_contextualize_called_with_request_id(self, client: TestClient):
        """Test that logger.contextualize is called with request_id."""
        with mock_logger_contextualize() as mock_logger:
            response = client.get("/api/v1/test")
            request_id = response.headers["X-Request-ID"]

            # Verify contextualize was called with the request_id
            mock_logger.contextualize.assert_called_once_with(request_id=request_id)

    def test_contextualize_not_called_for_excluded_paths(self, client: TestClient):
        """Test that logger.contextualize is not called for excluded paths."""
        app = FastAPI()
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/health/live")
        async def health():
            return {"status": "ok"}

        test_client = TestClient(app)

        with mock_logger_contextualize() as mock_logger:
            test_client.get("/health/live")

            # Contextualize should NOT be called for excluded paths
            mock_logger.contextualize.assert_not_called()
