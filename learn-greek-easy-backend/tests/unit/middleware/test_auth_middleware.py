"""Unit tests for authentication middleware.

Tests cover:
- Path filtering (auth vs non-auth endpoints)
- Log content verification (method, path, status, duration, client_ip)
- Client IP extraction from different headers
- Log levels based on status code
- Sensitive path marking
- Failed login warning
"""

import logging
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from src.middleware.auth import AuthLoggingMiddleware


class TestPathFiltering:
    """Tests for auth path filtering logic."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(AuthLoggingMiddleware)

        @app.get("/api/v1/auth/me")
        async def auth_me():
            return {"user": "test"}

        @app.post("/api/v1/auth/login")
        async def auth_login():
            return {"token": "abc123"}

        @app.get("/api/v1/other")
        async def other_endpoint():
            return {"other": "route"}

        @app.get("/health")
        async def health():
            return {"status": "healthy"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_logs_auth_endpoint_requests(self, client: TestClient):
        """Test that auth endpoint requests are logged."""
        with patch("src.middleware.auth.logger") as mock_logger:
            response = client.get("/api/v1/auth/me")

            assert response.status_code == 200
            mock_logger.log.assert_called_once()

    def test_does_not_log_non_auth_endpoints(self, client: TestClient):
        """Test that non-auth endpoints are not logged."""
        with patch("src.middleware.auth.logger") as mock_logger:
            response = client.get("/api/v1/other")

            assert response.status_code == 200
            mock_logger.log.assert_not_called()

    def test_does_not_log_health_endpoint(self, client: TestClient):
        """Test that health endpoint is not logged."""
        with patch("src.middleware.auth.logger") as mock_logger:
            response = client.get("/health")

            assert response.status_code == 200
            mock_logger.log.assert_not_called()

    def test_logs_auth_subpaths(self, client: TestClient):
        """Test that all auth subpaths are logged."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.post("/api/v1/auth/login")
            assert mock_logger.log.call_count == 1

    def test_should_log_returns_true_for_auth_path(self):
        """Test _should_log returns True for auth paths."""
        middleware = AuthLoggingMiddleware(app=MagicMock())
        assert middleware._should_log("/api/v1/auth/me") is True
        assert middleware._should_log("/api/v1/auth/login") is True
        assert middleware._should_log("/api/v1/auth/register") is True
        assert middleware._should_log("/api/v1/auth/logout") is True

    def test_should_log_returns_false_for_non_auth_path(self):
        """Test _should_log returns False for non-auth paths."""
        middleware = AuthLoggingMiddleware(app=MagicMock())
        assert middleware._should_log("/api/v1/other") is False
        assert middleware._should_log("/health") is False
        assert middleware._should_log("/api/v1/users") is False
        assert middleware._should_log("/") is False


class TestLogContent:
    """Tests for log content verification."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(AuthLoggingMiddleware)

        @app.get("/api/v1/auth/me")
        async def auth_me():
            return {"user": "test"}

        @app.post("/api/v1/auth/login")
        async def auth_login():
            return {"token": "abc123"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_log_contains_method(self, client: TestClient):
        """Test that log contains HTTP method."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/me")

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert extra["method"] == "GET"

    def test_log_contains_post_method(self, client: TestClient):
        """Test that log contains POST method for login."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.post("/api/v1/auth/login")

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert extra["method"] == "POST"

    def test_log_contains_path(self, client: TestClient):
        """Test that log contains request path."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/me")

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert extra["path"] == "/api/v1/auth/me"

    def test_log_contains_status_code(self, client: TestClient):
        """Test that log contains response status code."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/me")

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert extra["status_code"] == 200

    def test_log_contains_duration_ms(self, client: TestClient):
        """Test that log contains duration in milliseconds."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/me")

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert "duration_ms" in extra
            assert isinstance(extra["duration_ms"], float)
            assert extra["duration_ms"] >= 0

    def test_log_contains_client_ip(self, client: TestClient):
        """Test that log contains client IP."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/me")

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert "client_ip" in extra

    def test_log_message_is_auth_endpoint_accessed(self, client: TestClient):
        """Test that log message is 'Auth endpoint accessed'."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/me")

            call_args = mock_logger.log.call_args
            assert call_args.args[1] == "Auth endpoint accessed"


class TestRequestTiming:
    """Tests for request timing measurement."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        import asyncio

        app = FastAPI()
        app.add_middleware(AuthLoggingMiddleware)

        @app.get("/api/v1/auth/slow")
        async def slow_endpoint():
            await asyncio.sleep(0.05)  # 50ms delay
            return {"status": "slow"}

        @app.get("/api/v1/auth/fast")
        async def fast_endpoint():
            return {"status": "fast"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_duration_is_positive(self, client: TestClient):
        """Test that duration is a positive number."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/fast")

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert extra["duration_ms"] > 0

    def test_duration_is_rounded(self, client: TestClient):
        """Test that duration is rounded to 2 decimal places."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/fast")

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            duration_str = str(extra["duration_ms"])
            if "." in duration_str:
                decimal_places = len(duration_str.split(".")[1])
                assert decimal_places <= 2

    def test_slow_endpoint_has_higher_duration(self, client: TestClient):
        """Test that slow endpoint has higher duration than fast."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/slow")
            slow_call = mock_logger.log.call_args
            slow_duration = slow_call.kwargs.get("extra", {})["duration_ms"]

            mock_logger.reset_mock()

            client.get("/api/v1/auth/fast")
            fast_call = mock_logger.log.call_args
            fast_duration = fast_call.kwargs.get("extra", {})["duration_ms"]

            # Slow endpoint should take at least 40ms (we added 50ms delay)
            assert slow_duration >= 40
            assert slow_duration > fast_duration


class TestClientIPExtraction:
    """Tests for client IP extraction from various headers."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(AuthLoggingMiddleware)

        @app.get("/api/v1/auth/me")
        async def auth_me():
            return {"user": "test"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_extracts_ip_from_x_forwarded_for_single(self, client: TestClient):
        """Test IP extraction from X-Forwarded-For with single IP."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get(
                "/api/v1/auth/me",
                headers={"X-Forwarded-For": "203.0.113.50"},
            )

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert extra["client_ip"] == "203.0.113.50"

    def test_extracts_first_ip_from_x_forwarded_for_chain(self, client: TestClient):
        """Test IP extraction from X-Forwarded-For with multiple IPs."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get(
                "/api/v1/auth/me",
                headers={"X-Forwarded-For": "203.0.113.50, 198.51.100.178, 192.0.2.1"},
            )

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert extra["client_ip"] == "203.0.113.50"

    def test_extracts_ip_from_x_real_ip(self, client: TestClient):
        """Test IP extraction from X-Real-IP header."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get(
                "/api/v1/auth/me",
                headers={"X-Real-IP": "203.0.113.100"},
            )

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert extra["client_ip"] == "203.0.113.100"

    def test_x_forwarded_for_takes_precedence_over_x_real_ip(self, client: TestClient):
        """Test that X-Forwarded-For takes precedence over X-Real-IP."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get(
                "/api/v1/auth/me",
                headers={
                    "X-Forwarded-For": "203.0.113.50",
                    "X-Real-IP": "192.168.1.1",
                },
            )

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert extra["client_ip"] == "203.0.113.50"

    def test_extracts_ip_from_direct_connection(self, client: TestClient):
        """Test IP extraction from direct connection."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/me")

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            # TestClient uses "testclient" as the host
            assert extra["client_ip"] == "testclient"

    def test_strips_whitespace_from_forwarded_for(self, client: TestClient):
        """Test that whitespace is stripped from X-Forwarded-For IPs."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get(
                "/api/v1/auth/me",
                headers={"X-Forwarded-For": "  203.0.113.50  , 198.51.100.178"},
            )

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert extra["client_ip"] == "203.0.113.50"

    def test_get_client_ip_with_no_headers_or_client(self):
        """Test _get_client_ip returns None when no IP source is available."""
        middleware = AuthLoggingMiddleware(app=MagicMock())
        mock_request = MagicMock()
        mock_request.headers.get.return_value = None
        mock_request.client = None

        result = middleware._get_client_ip(mock_request)
        assert result is None


class TestLogLevel:
    """Tests for log level selection based on status code."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(AuthLoggingMiddleware)

        @app.get("/api/v1/auth/success")
        async def success():
            return {"status": "ok"}

        @app.get("/api/v1/auth/unauthorized")
        async def unauthorized():
            raise HTTPException(status_code=401, detail="Unauthorized")

        @app.get("/api/v1/auth/forbidden")
        async def forbidden():
            raise HTTPException(status_code=403, detail="Forbidden")

        @app.get("/api/v1/auth/not-found")
        async def not_found():
            raise HTTPException(status_code=404, detail="Not found")

        @app.get("/api/v1/auth/server-error")
        async def server_error():
            raise HTTPException(status_code=500, detail="Server error")

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app, raise_server_exceptions=False)

    def test_logs_info_for_2xx_responses(self, client: TestClient):
        """Test that 2xx responses are logged as INFO."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/success")

            call_args = mock_logger.log.call_args
            assert call_args.args[0] == logging.INFO

    def test_logs_warning_for_401_responses(self, client: TestClient):
        """Test that 401 responses are logged as WARNING."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/unauthorized")

            call_args = mock_logger.log.call_args
            assert call_args.args[0] == logging.WARNING

    def test_logs_warning_for_403_responses(self, client: TestClient):
        """Test that 403 responses are logged as WARNING."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/forbidden")

            call_args = mock_logger.log.call_args
            assert call_args.args[0] == logging.WARNING

    def test_logs_warning_for_404_responses(self, client: TestClient):
        """Test that 404 responses are logged as WARNING."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/not-found")

            call_args = mock_logger.log.call_args
            assert call_args.args[0] == logging.WARNING

    def test_logs_error_for_5xx_responses(self, client: TestClient):
        """Test that 5xx responses are logged as ERROR."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/server-error")

            call_args = mock_logger.log.call_args
            assert call_args.args[0] == logging.ERROR


class TestSensitivePaths:
    """Tests for sensitive path marking."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(AuthLoggingMiddleware)

        @app.post("/api/v1/auth/login")
        async def login():
            return {"token": "abc123"}

        @app.post("/api/v1/auth/register")
        async def register():
            return {"user_id": "123"}

        @app.post("/api/v1/auth/logout")
        async def logout():
            return {"status": "logged out"}

        @app.post("/api/v1/auth/logout-all")
        async def logout_all():
            return {"status": "all sessions logged out"}

        @app.get("/api/v1/auth/me")
        async def me():
            return {"user": "test"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_login_marked_as_sensitive(self, client: TestClient):
        """Test that /login is marked as sensitive."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.post("/api/v1/auth/login")

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert extra.get("sensitive") is True

    def test_register_marked_as_sensitive(self, client: TestClient):
        """Test that /register is marked as sensitive."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.post("/api/v1/auth/register")

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert extra.get("sensitive") is True

    def test_logout_marked_as_sensitive(self, client: TestClient):
        """Test that /logout is marked as sensitive."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.post("/api/v1/auth/logout")

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert extra.get("sensitive") is True

    def test_logout_all_marked_as_sensitive(self, client: TestClient):
        """Test that /logout-all is marked as sensitive."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.post("/api/v1/auth/logout-all")

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert extra.get("sensitive") is True

    def test_me_not_marked_as_sensitive(self, client: TestClient):
        """Test that /me is NOT marked as sensitive."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/me")

            call_args = mock_logger.log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert "sensitive" not in extra or extra.get("sensitive") is not True


class TestFailedLoginWarning:
    """Tests for failed login attempt warning."""

    @pytest.fixture
    def app_with_successful_login(self) -> FastAPI:
        """Create test FastAPI app with successful login endpoint."""
        app = FastAPI()
        app.add_middleware(AuthLoggingMiddleware)

        @app.post("/api/v1/auth/login")
        async def login_success():
            return {"token": "abc123"}

        @app.get("/api/v1/auth/me")
        async def me_unauthorized():
            raise HTTPException(status_code=401, detail="Not authenticated")

        return app

    @pytest.fixture
    def app_with_failed_login(self) -> FastAPI:
        """Create test FastAPI app with failed login endpoint."""
        app = FastAPI()
        app.add_middleware(AuthLoggingMiddleware)

        @app.post("/api/v1/auth/login")
        async def login_fail():
            raise HTTPException(status_code=401, detail="Invalid credentials")

        @app.get("/api/v1/auth/me")
        async def me_unauthorized():
            raise HTTPException(status_code=401, detail="Not authenticated")

        return app

    def test_logs_warning_for_failed_login(self, app_with_failed_login: FastAPI):
        """Test that failed login attempts log an additional warning."""
        client = TestClient(app_with_failed_login, raise_server_exceptions=False)

        with patch("src.middleware.auth.logger") as mock_logger:
            client.post("/api/v1/auth/login")

            # Should have the main log.call and a warning.call
            mock_logger.log.assert_called_once()
            mock_logger.warning.assert_called_once()

            # Verify warning content
            warning_call = mock_logger.warning.call_args
            assert warning_call.args[0] == "Failed login attempt"
            extra = warning_call.kwargs.get("extra", {})
            assert extra["path"] == "/api/v1/auth/login"
            assert "client_ip" in extra

    def test_no_warning_for_successful_login(self, app_with_successful_login: FastAPI):
        """Test that successful login does not log warning."""
        client = TestClient(app_with_successful_login)

        with patch("src.middleware.auth.logger") as mock_logger:
            client.post("/api/v1/auth/login")

            mock_logger.log.assert_called_once()
            mock_logger.warning.assert_not_called()

    def test_no_warning_for_401_on_non_login_endpoint(self, app_with_failed_login: FastAPI):
        """Test that 401 on /me does not trigger failed login warning."""
        client = TestClient(app_with_failed_login, raise_server_exceptions=False)

        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/me")

            # Should have the main log call but no warning
            mock_logger.log.assert_called_once()
            mock_logger.warning.assert_not_called()


class TestMiddlewareIntegration:
    """Integration tests for middleware with FastAPI app."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(AuthLoggingMiddleware)

        @app.get("/api/v1/auth/me")
        async def auth_me():
            return {"user": "test"}

        @app.post("/api/v1/auth/login")
        async def auth_login():
            return {"token": "abc123"}

        @app.get("/api/v1/users")
        async def users():
            return {"users": []}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_middleware_does_not_modify_response(self, client: TestClient):
        """Test that middleware does not modify the response body."""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 200
        assert response.json() == {"user": "test"}

    def test_middleware_does_not_break_non_auth_endpoints(self, client: TestClient):
        """Test that middleware does not interfere with non-auth endpoints."""
        response = client.get("/api/v1/users")
        assert response.status_code == 200
        assert response.json() == {"users": []}

    def test_multiple_requests_logged_independently(self, client: TestClient):
        """Test that multiple requests are logged independently."""
        with patch("src.middleware.auth.logger") as mock_logger:
            client.get("/api/v1/auth/me")
            client.post("/api/v1/auth/login")

            assert mock_logger.log.call_count == 2

            # Verify different paths logged
            first_call = mock_logger.log.call_args_list[0]
            second_call = mock_logger.log.call_args_list[1]

            assert first_call.kwargs["extra"]["path"] == "/api/v1/auth/me"
            assert first_call.kwargs["extra"]["method"] == "GET"

            assert second_call.kwargs["extra"]["path"] == "/api/v1/auth/login"
            assert second_call.kwargs["extra"]["method"] == "POST"


class TestMiddlewareAttributes:
    """Tests for middleware class attributes."""

    def test_auth_path_prefix_is_correct(self):
        """Test that AUTH_PATH_PREFIX is set correctly."""
        assert AuthLoggingMiddleware.AUTH_PATH_PREFIX == "/api/v1/auth"

    def test_sensitive_paths_contains_expected_endpoints(self):
        """Test that SENSITIVE_PATHS contains expected endpoints."""
        sensitive_paths = AuthLoggingMiddleware.SENSITIVE_PATHS
        assert "/api/v1/auth/login" in sensitive_paths
        assert "/api/v1/auth/register" in sensitive_paths
        assert "/api/v1/auth/logout" in sensitive_paths
        assert "/api/v1/auth/logout-all" in sensitive_paths

    def test_sensitive_paths_does_not_contain_me(self):
        """Test that /me is not in sensitive paths."""
        assert "/api/v1/auth/me" not in AuthLoggingMiddleware.SENSITIVE_PATHS
