"""Unit tests for error handling middleware.

Tests cover:
- Exception catching and response formatting
- Request ID inclusion in error responses
- X-Request-ID header in responses
- Debug information in debug mode
- Debug information hidden in production mode
- Logging with full context
- Normal request passthrough
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from src.middleware.error_handler import ErrorHandlingMiddleware
from src.middleware.logging import RequestLoggingMiddleware


class TestExceptionCatching:
    """Tests for exception catching functionality."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        # Add in correct order (reverse of execution)
        app.add_middleware(ErrorHandlingMiddleware)
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/success")
        async def success_endpoint():
            return {"status": "ok"}

        @app.get("/api/v1/error")
        async def error_endpoint():
            raise ValueError("Test error")

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app, raise_server_exceptions=False)

    def test_normal_requests_pass_through(self, client: TestClient):
        """Test that normal requests are not affected."""
        response = client.get("/api/v1/success")

        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_catches_unhandled_exceptions(self, client: TestClient):
        """Test that exceptions are caught and return 500."""
        response = client.get("/api/v1/error")

        assert response.status_code == 500
        assert response.json()["success"] is False

    def test_returns_consistent_error_format(self, client: TestClient):
        """Test error response follows standard format."""
        response = client.get("/api/v1/error")

        data = response.json()
        assert "success" in data
        assert "error" in data
        assert "code" in data["error"]
        assert "message" in data["error"]


class TestRequestIdInErrors:
    """Tests for request ID inclusion in error responses."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(ErrorHandlingMiddleware)
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/error")
        async def error_endpoint():
            raise ValueError("Test error")

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app, raise_server_exceptions=False)

    def test_error_response_includes_request_id(self, client: TestClient):
        """Test that error response includes request_id."""
        response = client.get("/api/v1/error")

        data = response.json()
        assert "request_id" in data["error"]
        assert data["error"]["request_id"] is not None

    def test_error_header_includes_request_id(self, client: TestClient):
        """Test that X-Request-ID header is present in error response."""
        response = client.get("/api/v1/error")

        assert "X-Request-ID" in response.headers
        assert len(response.headers["X-Request-ID"]) == 8

    def test_header_and_body_request_id_match(self, client: TestClient):
        """Test that header and body request IDs match."""
        response = client.get("/api/v1/error")

        header_id = response.headers["X-Request-ID"]
        body_id = response.json()["error"]["request_id"]

        assert header_id == body_id


class TestDebugMode:
    """Tests for debug mode behavior."""

    @pytest.fixture
    def app_debug_true(self) -> FastAPI:
        """Create test app with debug=True."""
        app = FastAPI()
        app.add_middleware(ErrorHandlingMiddleware)
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/error")
        async def error_endpoint():
            raise ValueError("Detailed error message")

        return app

    @pytest.fixture
    def client_debug(self, app_debug_true: FastAPI) -> TestClient:
        """Create test client for debug mode."""
        return TestClient(app_debug_true, raise_server_exceptions=False)

    def test_debug_info_included_when_debug_true(self, client_debug: TestClient):
        """Test that debug info is included when settings.debug is True."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = True

            response = client_debug.get("/api/v1/error")
            data = response.json()

            assert "debug" in data["error"]
            assert "type" in data["error"]["debug"]
            assert "message" in data["error"]["debug"]
            assert "traceback" in data["error"]["debug"]

    def test_debug_info_contains_exception_type(self, client_debug: TestClient):
        """Test that debug info contains correct exception type."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = True

            response = client_debug.get("/api/v1/error")
            data = response.json()

            assert data["error"]["debug"]["type"] == "ValueError"

    def test_debug_info_contains_exception_message(self, client_debug: TestClient):
        """Test that debug info contains exception message."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = True

            response = client_debug.get("/api/v1/error")
            data = response.json()

            assert data["error"]["debug"]["message"] == "Detailed error message"

    def test_debug_info_contains_traceback(self, client_debug: TestClient):
        """Test that debug info contains traceback as list."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = True

            response = client_debug.get("/api/v1/error")
            data = response.json()

            assert isinstance(data["error"]["debug"]["traceback"], list)
            assert len(data["error"]["debug"]["traceback"]) > 0

    def test_debug_info_hidden_when_debug_false(self, client_debug: TestClient):
        """Test that debug info is NOT included when settings.debug is False."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = False

            response = client_debug.get("/api/v1/error")
            data = response.json()

            assert "debug" not in data["error"]


class TestErrorLogging:
    """Tests for error logging functionality."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(ErrorHandlingMiddleware)
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/error")
        async def error_endpoint():
            raise ValueError("Test error")

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app, raise_server_exceptions=False)

    def test_logs_exception_with_logger_exception(self, client: TestClient):
        """Test that exceptions are logged using logger.exception."""
        with patch("src.middleware.error_handler.logger") as mock_logger:
            client.get("/api/v1/error")

            mock_logger.exception.assert_called_once()

    def test_log_contains_request_id(self, client: TestClient):
        """Test that log contains request ID."""
        with patch("src.middleware.error_handler.logger") as mock_logger:
            client.get("/api/v1/error")

            call_args = mock_logger.exception.call_args
            assert "request_id" in call_args.kwargs["extra"]

    def test_log_contains_method(self, client: TestClient):
        """Test that log contains HTTP method."""
        with patch("src.middleware.error_handler.logger") as mock_logger:
            client.get("/api/v1/error")

            call_args = mock_logger.exception.call_args
            assert call_args.kwargs["extra"]["method"] == "GET"

    def test_log_contains_path(self, client: TestClient):
        """Test that log contains request path."""
        with patch("src.middleware.error_handler.logger") as mock_logger:
            client.get("/api/v1/error")

            call_args = mock_logger.exception.call_args
            assert call_args.kwargs["extra"]["path"] == "/api/v1/error"

    def test_log_contains_error_type(self, client: TestClient):
        """Test that log contains error type."""
        with patch("src.middleware.error_handler.logger") as mock_logger:
            client.get("/api/v1/error")

            call_args = mock_logger.exception.call_args
            assert call_args.kwargs["extra"]["error_type"] == "ValueError"

    def test_log_contains_error_message(self, client: TestClient):
        """Test that log contains error message."""
        with patch("src.middleware.error_handler.logger") as mock_logger:
            client.get("/api/v1/error")

            call_args = mock_logger.exception.call_args
            assert call_args.kwargs["extra"]["error_message"] == "Test error"

    def test_log_message_is_correct(self, client: TestClient):
        """Test that log message is correct."""
        with patch("src.middleware.error_handler.logger") as mock_logger:
            client.get("/api/v1/error")

            call_args = mock_logger.exception.call_args
            assert call_args.args[0] == "Unhandled middleware exception"

    def test_log_contains_query_params(self, client: TestClient):
        """Test that log contains query params when present."""
        with patch("src.middleware.error_handler.logger") as mock_logger:
            # Create a custom app with an endpoint that has query params
            app = FastAPI()
            app.add_middleware(ErrorHandlingMiddleware)
            app.add_middleware(RequestLoggingMiddleware)

            @app.get("/api/v1/error")
            async def error_endpoint():
                raise ValueError("Test error")

            test_client = TestClient(app, raise_server_exceptions=False)
            test_client.get("/api/v1/error?page=1&limit=10")

            call_args = mock_logger.exception.call_args
            query = call_args.kwargs["extra"]["query"]
            assert "page=1" in query
            assert "limit=10" in query

    def test_log_contains_null_query_when_empty(self, client: TestClient):
        """Test that query is None when no query params."""
        with patch("src.middleware.error_handler.logger") as mock_logger:
            client.get("/api/v1/error")

            call_args = mock_logger.exception.call_args
            assert call_args.kwargs["extra"]["query"] is None


class TestErrorCodeAndMessage:
    """Tests for error code and message in responses."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(ErrorHandlingMiddleware)
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/error")
        async def error_endpoint():
            raise ValueError("Test error")

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app, raise_server_exceptions=False)

    def test_error_code_is_internal_server_error(self, client: TestClient):
        """Test that error code is INTERNAL_SERVER_ERROR."""
        response = client.get("/api/v1/error")
        data = response.json()

        assert data["error"]["code"] == "INTERNAL_SERVER_ERROR"

    def test_error_message_is_generic(self, client: TestClient):
        """Test that error message is generic (no sensitive info)."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = False

            response = client.get("/api/v1/error")
            data = response.json()

            assert data["error"]["message"] == "An unexpected error occurred"
            # Original error message should NOT be in response (except in debug)
            assert "Test error" not in data["error"]["message"]

    def test_success_is_false(self, client: TestClient):
        """Test that success is false in error response."""
        response = client.get("/api/v1/error")
        data = response.json()

        assert data["success"] is False


class TestMissingRequestId:
    """Tests for behavior when request ID is not available."""

    @pytest.fixture
    def app_no_logging_middleware(self) -> FastAPI:
        """Create test app without RequestLoggingMiddleware."""
        app = FastAPI()
        # Only add ErrorHandlingMiddleware, no RequestLoggingMiddleware
        app.add_middleware(ErrorHandlingMiddleware)

        @app.get("/api/v1/error")
        async def error_endpoint():
            raise ValueError("Test error")

        return app

    @pytest.fixture
    def client(self, app_no_logging_middleware: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app_no_logging_middleware, raise_server_exceptions=False)

    def test_uses_unknown_when_request_id_missing(self, client: TestClient):
        """Test that 'unknown' is used when request_id is not set."""
        response = client.get("/api/v1/error")
        data = response.json()

        assert data["error"]["request_id"] == "unknown"

    def test_header_contains_unknown_when_missing(self, client: TestClient):
        """Test that X-Request-ID header contains 'unknown' when missing."""
        response = client.get("/api/v1/error")

        assert response.headers["X-Request-ID"] == "unknown"


class TestMiddlewareExceptionCatching:
    """Tests for catching exceptions from other middleware."""

    @pytest.fixture
    def app_with_failing_middleware(self) -> FastAPI:
        """Create test app with a failing middleware after error handler."""
        from starlette.middleware.base import BaseHTTPMiddleware

        class FailingMiddleware(BaseHTTPMiddleware):
            async def dispatch(self, request, call_next):
                raise RuntimeError("Middleware failure")

        app = FastAPI()
        # Order: FailingMiddleware runs AFTER ErrorHandling catches
        app.add_middleware(FailingMiddleware)
        app.add_middleware(ErrorHandlingMiddleware)
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/test")
        async def test_endpoint():
            return {"status": "ok"}

        return app

    @pytest.fixture
    def client(self, app_with_failing_middleware: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app_with_failing_middleware, raise_server_exceptions=False)

    def test_catches_middleware_exceptions(self, client: TestClient):
        """Test that exceptions from other middleware are caught."""
        response = client.get("/api/v1/test")

        assert response.status_code == 500
        assert response.json()["success"] is False

    def test_catches_runtime_error_from_middleware(self, client: TestClient):
        """Test catching RuntimeError from middleware."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = True

            response = client.get("/api/v1/test")
            data = response.json()

            assert data["error"]["debug"]["type"] == "RuntimeError"
            assert data["error"]["debug"]["message"] == "Middleware failure"


class TestBuildErrorResponseHelper:
    """Tests for the _build_error_response helper method."""

    @pytest.fixture
    def middleware(self):
        """Create middleware instance."""
        return ErrorHandlingMiddleware(app=MagicMock())

    def test_build_error_response_structure(self, middleware):
        """Test error response has correct structure."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = False

            exc = ValueError("test")
            response = middleware._build_error_response("req123", exc)

            assert response["success"] is False
            assert response["error"]["code"] == "INTERNAL_SERVER_ERROR"
            assert response["error"]["message"] == "An unexpected error occurred"
            assert response["error"]["request_id"] == "req123"

    def test_build_error_response_debug_mode(self, middleware):
        """Test error response includes debug info when debug=True."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = True

            exc = ValueError("debug test")
            response = middleware._build_error_response("req456", exc)

            assert "debug" in response["error"]
            assert response["error"]["debug"]["type"] == "ValueError"
            assert response["error"]["debug"]["message"] == "debug test"

    def test_build_error_response_no_debug_in_production(self, middleware):
        """Test error response excludes debug info when debug=False."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = False

            exc = ValueError("secret info")
            response = middleware._build_error_response("req789", exc)

            assert "debug" not in response["error"]

    def test_build_error_response_traceback_is_list(self, middleware):
        """Test that traceback is returned as a list."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = True

            exc = ValueError("test")
            response = middleware._build_error_response("req-tb", exc)

            assert isinstance(response["error"]["debug"]["traceback"], list)


class TestHandleExceptionHelper:
    """Tests for the _handle_exception helper method."""

    @pytest.fixture
    def middleware(self):
        """Create middleware instance."""
        return ErrorHandlingMiddleware(app=MagicMock())

    @pytest.fixture
    def mock_request(self):
        """Create mock request with ASGI scope."""
        request = MagicMock(spec=Request)
        request.method = "GET"
        request.url.path = "/test/path"
        request.query_params = None
        request.state.request_id = "test-req-id"
        # Pure ASGI middleware accesses request.scope for state
        request.scope = {"state": {"request_id": "test-req-id"}}
        return request

    def test_handle_exception_returns_json_response(self, middleware, mock_request):
        """Test that _handle_exception returns JSONResponse."""
        from fastapi.responses import JSONResponse

        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = False
            with patch("src.middleware.error_handler.logger"):
                exc = ValueError("test error")
                response = middleware._handle_exception(mock_request, exc)

                assert isinstance(response, JSONResponse)
                assert response.status_code == 500

    def test_handle_exception_includes_x_request_id_header(self, middleware, mock_request):
        """Test that _handle_exception includes X-Request-ID header."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = False
            with patch("src.middleware.error_handler.logger"):
                exc = ValueError("test error")
                response = middleware._handle_exception(mock_request, exc)

                assert "X-Request-ID" in response.headers
                assert response.headers["X-Request-ID"] == "test-req-id"


class TestDifferentExceptionTypes:
    """Tests for handling different exception types."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(ErrorHandlingMiddleware)
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/value-error")
        async def value_error_endpoint():
            raise ValueError("Value error")

        @app.get("/api/v1/type-error")
        async def type_error_endpoint():
            raise TypeError("Type error")

        @app.get("/api/v1/runtime-error")
        async def runtime_error_endpoint():
            raise RuntimeError("Runtime error")

        @app.get("/api/v1/key-error")
        async def key_error_endpoint():
            raise KeyError("missing_key")

        @app.get("/api/v1/attribute-error")
        async def attribute_error_endpoint():
            raise AttributeError("Attribute error")

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app, raise_server_exceptions=False)

    def test_handles_value_error(self, client: TestClient):
        """Test handling ValueError."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = True

            response = client.get("/api/v1/value-error")
            data = response.json()

            assert response.status_code == 500
            assert data["error"]["debug"]["type"] == "ValueError"

    def test_handles_type_error(self, client: TestClient):
        """Test handling TypeError."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = True

            response = client.get("/api/v1/type-error")
            data = response.json()

            assert response.status_code == 500
            assert data["error"]["debug"]["type"] == "TypeError"

    def test_handles_runtime_error(self, client: TestClient):
        """Test handling RuntimeError."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = True

            response = client.get("/api/v1/runtime-error")
            data = response.json()

            assert response.status_code == 500
            assert data["error"]["debug"]["type"] == "RuntimeError"

    def test_handles_key_error(self, client: TestClient):
        """Test handling KeyError."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = True

            response = client.get("/api/v1/key-error")
            data = response.json()

            assert response.status_code == 500
            assert data["error"]["debug"]["type"] == "KeyError"

    def test_handles_attribute_error(self, client: TestClient):
        """Test handling AttributeError."""
        with patch("src.middleware.error_handler.settings") as mock_settings:
            mock_settings.debug = True

            response = client.get("/api/v1/attribute-error")
            data = response.json()

            assert response.status_code == 500
            assert data["error"]["debug"]["type"] == "AttributeError"


class TestMiddlewareDispatch:
    """Tests for the dispatch method."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(ErrorHandlingMiddleware)
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/success")
        async def success_endpoint():
            return {"status": "ok"}

        @app.get("/api/v1/error")
        async def error_endpoint():
            raise ValueError("Test error")

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app, raise_server_exceptions=False)

    def test_dispatch_passes_successful_response(self, client: TestClient):
        """Test that dispatch returns normal response for successful requests."""
        response = client.get("/api/v1/success")

        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_dispatch_catches_exception_and_returns_error(self, client: TestClient):
        """Test that dispatch catches exceptions and returns error response."""
        response = client.get("/api/v1/error")

        assert response.status_code == 500
        assert response.json()["success"] is False

    def test_dispatch_does_not_modify_success_response_headers(self, client: TestClient):
        """Test that dispatch does not modify headers on success."""
        response = client.get("/api/v1/success")

        # X-Request-ID should be set by RequestLoggingMiddleware
        assert "X-Request-ID" in response.headers

    def test_dispatch_adds_x_request_id_on_error(self, client: TestClient):
        """Test that dispatch adds X-Request-ID header on error."""
        response = client.get("/api/v1/error")

        assert "X-Request-ID" in response.headers


class TestIntegrationWithLoggingMiddleware:
    """Integration tests with RequestLoggingMiddleware."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with both middleware."""
        app = FastAPI()
        app.add_middleware(ErrorHandlingMiddleware)
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/api/v1/error")
        async def error_endpoint():
            raise ValueError("Integration test error")

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app, raise_server_exceptions=False)

    def test_request_id_flows_through_middleware_stack(self, client: TestClient):
        """Test that request ID from logging middleware is used in error handler."""
        response = client.get("/api/v1/error")

        header_id = response.headers["X-Request-ID"]
        body_id = response.json()["error"]["request_id"]

        # Both should be 8 characters and match
        assert len(header_id) == 8
        assert header_id == body_id

    def test_both_middleware_log_errors(self, client: TestClient):
        """Test that both middleware log when error occurs."""
        with (
            patch("src.middleware.error_handler.logger") as error_logger,
            patch("src.middleware.logging.logger") as logging_logger,
        ):
            client.get("/api/v1/error")

            # ErrorHandlingMiddleware logs the exception
            error_logger.exception.assert_called_once()

            # RequestLoggingMiddleware logs request start
            logging_logger.info.assert_called()
