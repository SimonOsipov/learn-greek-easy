"""Unit tests for version header middleware.

Tests cover:
- X-App-Version header presence on HTTP responses
- Environment variable priority (RAILWAY_GIT_COMMIT_SHA > GITHUB_SHA > "dev")
- Fallback to "dev" when no env vars set
- Non-HTTP requests pass through unchanged
- Header value consistency
"""

import os
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.middleware.version import VersionHeaderMiddleware


class TestVersionHeaderPresence:
    """Tests for X-App-Version header presence on responses."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(VersionHeaderMiddleware)

        @app.get("/api/v1/test")
        async def test_endpoint():
            return {"status": "ok"}

        @app.post("/api/v1/data")
        async def post_endpoint():
            return {"created": True}

        @app.get("/health")
        async def health():
            return {"status": "healthy"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_header_present_on_get_request(self, client: TestClient):
        """Test that X-App-Version header is present on GET responses."""
        response = client.get("/api/v1/test")

        assert response.status_code == 200
        assert "X-App-Version" in response.headers

    def test_header_present_on_post_request(self, client: TestClient):
        """Test that X-App-Version header is present on POST responses."""
        response = client.post("/api/v1/data")

        assert response.status_code == 200
        assert "X-App-Version" in response.headers

    def test_header_present_on_health_endpoint(self, client: TestClient):
        """Test that X-App-Version header is present on health check responses."""
        response = client.get("/health")

        assert response.status_code == 200
        assert "X-App-Version" in response.headers

    def test_header_value_is_consistent(self, client: TestClient):
        """Test that X-App-Version header value is consistent across requests."""
        response1 = client.get("/api/v1/test")
        response2 = client.get("/api/v1/test")
        response3 = client.post("/api/v1/data")

        version1 = response1.headers["X-App-Version"]
        version2 = response2.headers["X-App-Version"]
        version3 = response3.headers["X-App-Version"]

        assert version1 == version2 == version3

    def test_header_does_not_interfere_with_response_body(self, client: TestClient):
        """Test that middleware does not modify response body."""
        response = client.get("/api/v1/test")

        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestVersionEnvironmentVariables:
    """Tests for environment variable priority in version detection."""

    def test_uses_railway_commit_sha_when_set(self):
        """Test that RAILWAY_GIT_COMMIT_SHA takes priority."""
        with patch.dict(
            os.environ,
            {"RAILWAY_GIT_COMMIT_SHA": "railway123", "GITHUB_SHA": "github456"},
            clear=False,
        ):
            # Create a fresh middleware class to pick up env vars
            # We need to reimport to get fresh class with new VERSION
            import importlib

            import src.middleware.version as version_module

            importlib.reload(version_module)
            VersionHeaderMiddleware = version_module.VersionHeaderMiddleware

            assert VersionHeaderMiddleware.VERSION == "railway123"

    def test_uses_github_sha_as_fallback(self):
        """Test that GITHUB_SHA is used when RAILWAY_GIT_COMMIT_SHA is not set."""
        with patch.dict(
            os.environ,
            {"GITHUB_SHA": "github456"},
            clear=False,
        ):
            # Remove RAILWAY_GIT_COMMIT_SHA if present
            env = os.environ.copy()
            env.pop("RAILWAY_GIT_COMMIT_SHA", None)
            env["GITHUB_SHA"] = "github456"

            with patch.dict(os.environ, env, clear=True):
                import importlib

                import src.middleware.version as version_module

                importlib.reload(version_module)
                VersionHeaderMiddleware = version_module.VersionHeaderMiddleware

                assert VersionHeaderMiddleware.VERSION == "github456"

    def test_falls_back_to_dev(self):
        """Test that 'dev' is used when no env vars are set."""
        # Clear both env vars
        with patch.dict(os.environ, {}, clear=True):
            import importlib

            import src.middleware.version as version_module

            importlib.reload(version_module)
            VersionHeaderMiddleware = version_module.VersionHeaderMiddleware

            assert VersionHeaderMiddleware.VERSION == "dev"


class TestVersionMiddlewareClass:
    """Tests for VersionHeaderMiddleware class attributes and methods."""

    def test_version_class_attribute_exists(self):
        """Test that VERSION class attribute exists."""
        assert hasattr(VersionHeaderMiddleware, "VERSION")
        assert isinstance(VersionHeaderMiddleware.VERSION, str)

    def test_version_is_non_empty(self):
        """Test that VERSION is never empty."""
        assert len(VersionHeaderMiddleware.VERSION) > 0

    def test_middleware_stores_app_reference(self):
        """Test that middleware stores the app reference."""
        mock_app = MagicMock()
        middleware = VersionHeaderMiddleware(mock_app)

        assert middleware.app is mock_app


class TestErrorResponses:
    """Tests for X-App-Version header on error responses."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(VersionHeaderMiddleware)

        @app.get("/api/v1/not-found")
        async def not_found():
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Not found")

        @app.get("/api/v1/error")
        async def server_error():
            from fastapi import HTTPException

            raise HTTPException(status_code=500, detail="Server error")

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app, raise_server_exceptions=False)

    def test_header_present_on_404_response(self, client: TestClient):
        """Test that X-App-Version header is present on 404 responses."""
        response = client.get("/api/v1/not-found")

        assert response.status_code == 404
        assert "X-App-Version" in response.headers

    def test_header_present_on_500_response(self, client: TestClient):
        """Test that X-App-Version header is present on 500 responses."""
        response = client.get("/api/v1/error")

        assert response.status_code == 500
        assert "X-App-Version" in response.headers


class TestMiddlewareIntegration:
    """Integration tests with other middleware."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with multiple middleware."""
        from starlette.middleware.base import BaseHTTPMiddleware

        app = FastAPI()

        # Add our version middleware
        app.add_middleware(VersionHeaderMiddleware)

        # Add another middleware to test stacking
        class CustomHeaderMiddleware(BaseHTTPMiddleware):
            async def dispatch(self, request, call_next):
                response = await call_next(request)
                response.headers["X-Custom-Header"] = "custom-value"
                return response

        app.add_middleware(CustomHeaderMiddleware)

        @app.get("/api/v1/test")
        async def test_endpoint():
            return {"status": "ok"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_version_header_coexists_with_other_headers(self, client: TestClient):
        """Test that X-App-Version header works with other custom headers."""
        response = client.get("/api/v1/test")

        assert response.status_code == 200
        assert "X-App-Version" in response.headers
        assert "X-Custom-Header" in response.headers
        assert response.headers["X-Custom-Header"] == "custom-value"


class TestVersionHeaderValue:
    """Tests for the actual value of the version header."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create test FastAPI app with middleware."""
        app = FastAPI()
        app.add_middleware(VersionHeaderMiddleware)

        @app.get("/api/v1/test")
        async def test_endpoint():
            return {"status": "ok"}

        return app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_header_matches_class_version(self, client: TestClient):
        """Test that header value matches the class VERSION attribute."""
        response = client.get("/api/v1/test")

        header_value = response.headers["X-App-Version"]
        assert header_value == VersionHeaderMiddleware.VERSION

    def test_header_is_string(self, client: TestClient):
        """Test that header value is a string."""
        response = client.get("/api/v1/test")

        header_value = response.headers["X-App-Version"]
        assert isinstance(header_value, str)
