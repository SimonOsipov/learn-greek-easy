"""Unit tests for /api/v1/health API endpoints.

Tests cover:
- /api/v1/health endpoint with various health statuses
- /api/v1/health/live liveness probe endpoint
- /api/v1/health/ready readiness probe endpoint
- Response status codes for different health states

These endpoints mirror the root-level /health endpoints and are used when
the backend is private and accessed through the frontend proxy.
"""

from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.v1.health import router
from src.schemas.health import (
    ComponentHealth,
    ComponentStatus,
    HealthChecks,
    HealthResponse,
    HealthStatus,
    LivenessResponse,
    MemoryHealth,
    ReadinessChecks,
    ReadinessResponse,
)

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def app() -> FastAPI:
    """Create test FastAPI app with v1 health router."""
    app = FastAPI()
    # Mount at /api/v1 to test full path
    app.include_router(router, prefix="/api/v1")
    return app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def healthy_health_response() -> HealthResponse:
    """Create a healthy health response."""
    return HealthResponse(
        status=HealthStatus.HEALTHY,
        version="0.1.0",
        environment="test",
        timestamp=datetime.now(timezone.utc),
        uptime_seconds=100.0,
        checks=HealthChecks(
            database=ComponentHealth(
                status=ComponentStatus.HEALTHY,
                latency_ms=5.0,
                message="Connection successful",
            ),
            redis=ComponentHealth(
                status=ComponentStatus.HEALTHY,
                latency_ms=2.0,
                message="PONG received",
            ),
            memory=MemoryHealth(
                status=ComponentStatus.HEALTHY,
                used_mb=128.0,
                percent=25.0,
                message="Memory usage normal",
            ),
        ),
    )


@pytest.fixture
def degraded_health_response() -> HealthResponse:
    """Create a degraded health response."""
    return HealthResponse(
        status=HealthStatus.DEGRADED,
        version="0.1.0",
        environment="test",
        timestamp=datetime.now(timezone.utc),
        uptime_seconds=100.0,
        checks=HealthChecks(
            database=ComponentHealth(
                status=ComponentStatus.HEALTHY,
                latency_ms=5.0,
                message="Connection successful",
            ),
            redis=ComponentHealth(
                status=ComponentStatus.UNHEALTHY,
                latency_ms=None,
                message="Connection refused",
            ),
            memory=MemoryHealth(
                status=ComponentStatus.HEALTHY,
                used_mb=128.0,
                percent=25.0,
                message="Memory usage normal",
            ),
        ),
    )


@pytest.fixture
def unhealthy_health_response() -> HealthResponse:
    """Create an unhealthy health response."""
    return HealthResponse(
        status=HealthStatus.UNHEALTHY,
        version="0.1.0",
        environment="test",
        timestamp=datetime.now(timezone.utc),
        uptime_seconds=100.0,
        checks=HealthChecks(
            database=ComponentHealth(
                status=ComponentStatus.UNHEALTHY,
                latency_ms=None,
                message="Connection error",
            ),
            redis=ComponentHealth(
                status=ComponentStatus.HEALTHY,
                latency_ms=2.0,
                message="PONG received",
            ),
            memory=MemoryHealth(
                status=ComponentStatus.HEALTHY,
                used_mb=128.0,
                percent=25.0,
                message="Memory usage normal",
            ),
        ),
    )


# ============================================================================
# /api/v1/health Endpoint Tests
# ============================================================================


class TestV1HealthEndpoint:
    """Tests for /api/v1/health endpoint."""

    def test_health_check_returns_healthy_status_200(
        self, client: TestClient, healthy_health_response: HealthResponse
    ):
        """Test /api/v1/health returns 200 when healthy."""
        with patch(
            "src.api.v1.health.get_health_status",
            return_value=(healthy_health_response, 200),
        ):
            response = client.get("/api/v1/health")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert "checks" in data

    def test_health_check_returns_degraded_status_200(
        self, client: TestClient, degraded_health_response: HealthResponse
    ):
        """Test /api/v1/health returns 200 when degraded."""
        with patch(
            "src.api.v1.health.get_health_status",
            return_value=(degraded_health_response, 200),
        ):
            response = client.get("/api/v1/health")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "degraded"

    def test_health_check_returns_unhealthy_status_503(
        self, client: TestClient, unhealthy_health_response: HealthResponse
    ):
        """Test /api/v1/health returns 503 when unhealthy."""
        with patch(
            "src.api.v1.health.get_health_status",
            return_value=(unhealthy_health_response, 503),
        ):
            response = client.get("/api/v1/health")

            assert response.status_code == 503
            data = response.json()
            assert data["status"] == "unhealthy"

    def test_health_check_sets_response_status_code(
        self, client: TestClient, unhealthy_health_response: HealthResponse
    ):
        """Test that health check correctly sets the response status code."""
        with patch(
            "src.api.v1.health.get_health_status",
            return_value=(unhealthy_health_response, 503),
        ):
            response = client.get("/api/v1/health")

            # The response status code should match what the service returned
            assert response.status_code == 503

    def test_health_check_response_contains_all_fields(
        self, client: TestClient, healthy_health_response: HealthResponse
    ):
        """Test that health response contains all expected fields."""
        with patch(
            "src.api.v1.health.get_health_status",
            return_value=(healthy_health_response, 200),
        ):
            response = client.get("/api/v1/health")
            data = response.json()

            assert "status" in data
            assert "version" in data
            assert "environment" in data
            assert "timestamp" in data
            assert "uptime_seconds" in data
            assert "checks" in data
            assert "database" in data["checks"]
            assert "redis" in data["checks"]
            assert "memory" in data["checks"]


# ============================================================================
# /api/v1/health/live Endpoint Tests
# ============================================================================


class TestV1LivenessEndpoint:
    """Tests for /api/v1/health/live endpoint."""

    def test_liveness_check_returns_alive(self, client: TestClient):
        """Test /api/v1/health/live returns alive status."""
        mock_response = LivenessResponse(
            status="alive",
            timestamp=datetime.now(timezone.utc),
        )

        with patch(
            "src.api.v1.health.get_liveness_status",
            return_value=mock_response,
        ):
            response = client.get("/api/v1/health/live")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "alive"
            assert "timestamp" in data

    def test_liveness_check_always_returns_200(self, client: TestClient):
        """Test that liveness check always returns 200."""
        mock_response = LivenessResponse(
            status="alive",
            timestamp=datetime.now(timezone.utc),
        )

        with patch(
            "src.api.v1.health.get_liveness_status",
            return_value=mock_response,
        ):
            response = client.get("/api/v1/health/live")

            assert response.status_code == 200


# ============================================================================
# /api/v1/health/ready Endpoint Tests
# ============================================================================


class TestV1ReadinessEndpoint:
    """Tests for /api/v1/health/ready endpoint."""

    def test_readiness_check_returns_ready_status_200(self, client: TestClient):
        """Test /api/v1/health/ready returns 200 when ready."""
        mock_response = ReadinessResponse(
            status="ready",
            timestamp=datetime.now(timezone.utc),
            checks=ReadinessChecks(database=True, redis=True),
        )

        with patch(
            "src.api.v1.health.get_readiness_status",
            return_value=(mock_response, 200),
        ):
            response = client.get("/api/v1/health/ready")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ready"
            assert data["checks"]["database"] is True
            assert data["checks"]["redis"] is True

    def test_readiness_check_returns_not_ready_status_503(self, client: TestClient):
        """Test /api/v1/health/ready returns 503 when not ready."""
        mock_response = ReadinessResponse(
            status="not_ready",
            timestamp=datetime.now(timezone.utc),
            checks=ReadinessChecks(database=False, redis=True),
        )

        with patch(
            "src.api.v1.health.get_readiness_status",
            return_value=(mock_response, 503),
        ):
            response = client.get("/api/v1/health/ready")

            assert response.status_code == 503
            data = response.json()
            assert data["status"] == "not_ready"
            assert data["checks"]["database"] is False

    def test_readiness_check_sets_response_status_code(self, client: TestClient):
        """Test that readiness check correctly sets the response status code."""
        mock_response = ReadinessResponse(
            status="not_ready",
            timestamp=datetime.now(timezone.utc),
            checks=ReadinessChecks(database=True, redis=False),
        )

        with patch(
            "src.api.v1.health.get_readiness_status",
            return_value=(mock_response, 503),
        ):
            response = client.get("/api/v1/health/ready")

            assert response.status_code == 503

    def test_readiness_check_response_contains_all_fields(self, client: TestClient):
        """Test that readiness response contains all expected fields."""
        mock_response = ReadinessResponse(
            status="ready",
            timestamp=datetime.now(timezone.utc),
            checks=ReadinessChecks(database=True, redis=True),
        )

        with patch(
            "src.api.v1.health.get_readiness_status",
            return_value=(mock_response, 200),
        ):
            response = client.get("/api/v1/health/ready")
            data = response.json()

            assert "status" in data
            assert "timestamp" in data
            assert "checks" in data
            assert "database" in data["checks"]
            assert "redis" in data["checks"]


# ============================================================================
# Edge Cases Tests
# ============================================================================


class TestV1HealthEdgeCases:
    """Tests for edge cases in /api/v1/health endpoints."""

    def test_health_with_memory_warning(self, client: TestClient):
        """Test health response with memory warning."""
        response = HealthResponse(
            status=HealthStatus.HEALTHY,
            version="0.1.0",
            environment="test",
            timestamp=datetime.now(timezone.utc),
            uptime_seconds=100.0,
            checks=HealthChecks(
                database=ComponentHealth(
                    status=ComponentStatus.HEALTHY,
                    latency_ms=5.0,
                    message="Connection successful",
                ),
                redis=ComponentHealth(
                    status=ComponentStatus.HEALTHY,
                    latency_ms=2.0,
                    message="PONG received",
                ),
                memory=MemoryHealth(
                    status=ComponentStatus.WARNING,
                    used_mb=512.0,
                    percent=85.0,
                    message="High memory usage",
                ),
            ),
        )

        with patch(
            "src.api.v1.health.get_health_status",
            return_value=(response, 200),
        ):
            resp = client.get("/api/v1/health")

            assert resp.status_code == 200
            data = resp.json()
            # Memory warning doesn't affect overall status
            assert data["status"] == "healthy"
            assert data["checks"]["memory"]["status"] == "warning"

    def test_health_response_timestamp_format(
        self, client: TestClient, healthy_health_response: HealthResponse
    ):
        """Test that timestamp is in ISO format."""
        with patch(
            "src.api.v1.health.get_health_status",
            return_value=(healthy_health_response, 200),
        ):
            response = client.get("/api/v1/health")
            data = response.json()

            # Timestamp should be parseable
            timestamp = data["timestamp"]
            assert "T" in timestamp  # ISO format contains T separator

    def test_health_endpoints_use_same_service_as_root(self, client: TestClient):
        """Test that v1 health endpoints call the same service functions."""
        # This verifies the endpoints are using the correct service imports
        mock_response = LivenessResponse(
            status="alive",
            timestamp=datetime.now(timezone.utc),
        )

        with patch(
            "src.api.v1.health.get_liveness_status",
            return_value=mock_response,
        ) as mock_service:
            client.get("/api/v1/health/live")
            mock_service.assert_called_once()
