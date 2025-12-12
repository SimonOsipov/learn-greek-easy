"""E2E tests for health check endpoints.

These tests verify the health check API endpoints work correctly through
real HTTP requests, covering:
- /health - Comprehensive health check with component status
- /health/live - Kubernetes liveness probe
- /health/ready - Kubernetes readiness probe

Note: In test environments, Redis may not always be available, so tests
account for both healthy and degraded/unhealthy states.

Run with:
    pytest tests/e2e/scenarios/test_health_endpoints.py -v
"""

import pytest
from httpx import AsyncClient

from tests.e2e.conftest import E2ETestCase


class TestHealthEndpoints(E2ETestCase):
    """E2E tests for health check endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_health_check_returns_valid_response(self, client: AsyncClient) -> None:
        """Test that /health returns a valid response (200 or 503 depending on services)."""
        response = await client.get("/health")

        # Health endpoint can return 200 (healthy/degraded) or 503 (unhealthy)
        assert response.status_code in [200, 503]
        data = response.json()
        assert data["status"] in ["healthy", "degraded", "unhealthy"]
        assert "version" in data
        assert "environment" in data
        assert "timestamp" in data
        assert "uptime_seconds" in data
        assert "checks" in data

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_health_response_includes_all_component_checks(self, client: AsyncClient) -> None:
        """Test that /health response includes database, redis, and memory checks."""
        response = await client.get("/health")

        # Accept both 200 and 503 (depends on service availability)
        assert response.status_code in [200, 503]
        data = response.json()
        checks = data["checks"]

        # Verify all component checks are present
        assert "database" in checks
        assert "redis" in checks
        assert "memory" in checks

        # Verify database check structure
        db_check = checks["database"]
        assert "status" in db_check
        assert "message" in db_check
        # latency_ms may be None if unhealthy, but key should exist
        assert "latency_ms" in db_check

        # Verify redis check structure
        redis_check = checks["redis"]
        assert "status" in redis_check
        assert "message" in redis_check
        assert "latency_ms" in redis_check

        # Verify memory check structure
        memory_check = checks["memory"]
        assert "status" in memory_check
        assert "message" in memory_check
        assert "used_mb" in memory_check
        assert "percent" in memory_check

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_health_response_database_check_structure(self, client: AsyncClient) -> None:
        """Test that database check has the correct structure."""
        response = await client.get("/health")

        assert response.status_code in [200, 503]
        data = response.json()
        db_check = data["checks"]["database"]

        # Database check should have status, latency_ms, and message
        assert "status" in db_check
        assert db_check["status"] in ["healthy", "unhealthy", "warning"]
        assert "latency_ms" in db_check  # Can be None or number
        assert "message" in db_check
        assert isinstance(db_check["message"], str)

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_health_response_memory_stats(self, client: AsyncClient) -> None:
        """Test that memory check returns valid statistics."""
        response = await client.get("/health")

        assert response.status_code in [200, 503]
        data = response.json()
        memory_check = data["checks"]["memory"]

        # Memory should be healthy or warning (high usage)
        assert memory_check["status"] in ["healthy", "warning"]
        assert isinstance(memory_check["used_mb"], (int, float))
        assert memory_check["used_mb"] >= 0
        assert isinstance(memory_check["percent"], (int, float))
        assert memory_check["percent"] >= 0
        assert memory_check["percent"] <= 100

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_health_response_includes_version(self, client: AsyncClient) -> None:
        """Test that /health response includes app version."""
        response = await client.get("/health")

        assert response.status_code in [200, 503]
        data = response.json()
        assert "version" in data
        assert isinstance(data["version"], str)
        assert len(data["version"]) > 0

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_health_response_includes_uptime(self, client: AsyncClient) -> None:
        """Test that /health response includes uptime seconds."""
        response = await client.get("/health")

        assert response.status_code in [200, 503]
        data = response.json()
        assert "uptime_seconds" in data
        assert isinstance(data["uptime_seconds"], (int, float))
        assert data["uptime_seconds"] >= 0

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_liveness_check_returns_alive(self, client: AsyncClient) -> None:
        """Test that /health/live returns alive status."""
        response = await client.get("/health/live")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "alive"
        assert "timestamp" in data

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_liveness_check_is_lightweight(self, client: AsyncClient) -> None:
        """Test that liveness check is lightweight and fast."""
        import time

        start = time.time()
        response = await client.get("/health/live")
        elapsed = time.time() - start

        assert response.status_code == 200
        # Liveness check should be very fast (< 500ms to account for test overhead)
        assert elapsed < 0.5

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_readiness_check_returns_valid_response(self, client: AsyncClient) -> None:
        """Test that /health/ready returns valid response (ready or not_ready)."""
        response = await client.get("/health/ready")

        # Readiness can be 200 (ready) or 503 (not_ready)
        assert response.status_code in [200, 503]
        data = response.json()
        assert data["status"] in ["ready", "not_ready"]
        assert "timestamp" in data
        assert "checks" in data

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_readiness_check_includes_dependency_status(self, client: AsyncClient) -> None:
        """Test that readiness check includes database and redis status."""
        response = await client.get("/health/ready")

        assert response.status_code in [200, 503]
        data = response.json()
        checks = data["checks"]

        # Verify dependency checks are present
        assert "database" in checks
        assert "redis" in checks

        # Values should be boolean
        assert isinstance(checks["database"], bool)
        assert isinstance(checks["redis"], bool)

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_health_endpoints_no_auth_required(self, client: AsyncClient) -> None:
        """Test that health endpoints do not require authentication."""
        # All health endpoints should work without auth headers
        health_resp = await client.get("/health")
        assert health_resp.status_code in [200, 503]

        live_resp = await client.get("/health/live")
        assert live_resp.status_code == 200

        ready_resp = await client.get("/health/ready")
        assert ready_resp.status_code in [200, 503]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_health_check_timestamp_format(self, client: AsyncClient) -> None:
        """Test that health check timestamps are in valid ISO format."""
        response = await client.get("/health")

        assert response.status_code in [200, 503]
        data = response.json()

        # Timestamp should be in ISO 8601 format
        timestamp = data["timestamp"]
        assert isinstance(timestamp, str)
        # Should contain date and time components
        assert "T" in timestamp or "-" in timestamp

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_liveness_check_timestamp_format(self, client: AsyncClient) -> None:
        """Test that liveness check timestamp is in valid format."""
        response = await client.get("/health/live")

        assert response.status_code == 200
        data = response.json()

        timestamp = data["timestamp"]
        assert isinstance(timestamp, str)
        assert "T" in timestamp or "-" in timestamp

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_readiness_check_timestamp_format(self, client: AsyncClient) -> None:
        """Test that readiness check timestamp is in valid format."""
        response = await client.get("/health/ready")

        assert response.status_code in [200, 503]
        data = response.json()

        timestamp = data["timestamp"]
        assert isinstance(timestamp, str)
        assert "T" in timestamp or "-" in timestamp

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_health_status_values_are_valid(self, client: AsyncClient) -> None:
        """Test that health status is one of the expected values."""
        response = await client.get("/health")

        assert response.status_code in [200, 503]
        data = response.json()

        # Overall status should be one of the valid values
        assert data["status"] in ["healthy", "degraded", "unhealthy"]

        # Component statuses should also be valid
        for component in ["database", "redis"]:
            status = data["checks"][component]["status"]
            assert status in ["healthy", "unhealthy", "warning"]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_health_check_environment_value(self, client: AsyncClient) -> None:
        """Test that health check includes environment value."""
        response = await client.get("/health")

        assert response.status_code in [200, 503]
        data = response.json()

        assert "environment" in data
        assert isinstance(data["environment"], str)
        # Environment should be one of the expected values
        assert data["environment"] in ["development", "staging", "production", "testing", "test"]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_health_check_latency_values_reasonable(self, client: AsyncClient) -> None:
        """Test that health check latency values are reasonable when present."""
        response = await client.get("/health")

        assert response.status_code in [200, 503]
        data = response.json()

        # Database latency should be reasonable when present
        db_latency = data["checks"]["database"]["latency_ms"]
        if db_latency is not None:
            assert isinstance(db_latency, (int, float))
            assert db_latency >= 0

        # Redis latency should be reasonable when present
        redis_latency = data["checks"]["redis"]["latency_ms"]
        if redis_latency is not None:
            assert isinstance(redis_latency, (int, float))
            assert redis_latency >= 0

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_health_unhealthy_returns_503(self, client: AsyncClient) -> None:
        """Test that unhealthy status results in 503 status code."""
        response = await client.get("/health")

        data = response.json()
        if data["status"] == "unhealthy":
            assert response.status_code == 503
        else:
            # healthy or degraded returns 200
            assert response.status_code == 200

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_readiness_not_ready_returns_503(self, client: AsyncClient) -> None:
        """Test that not_ready status results in 503 status code."""
        response = await client.get("/health/ready")

        data = response.json()
        if data["status"] == "not_ready":
            assert response.status_code == 503
        else:
            assert response.status_code == 200

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_multiple_health_checks_consistent(self, client: AsyncClient) -> None:
        """Test that multiple health checks return consistent structure."""
        # Make multiple requests
        responses = []
        for _ in range(3):
            resp = await client.get("/health")
            responses.append(resp.json())

        # All responses should have the same structure
        for data in responses:
            assert "status" in data
            assert "version" in data
            assert "checks" in data
            assert "database" in data["checks"]
            assert "redis" in data["checks"]
            assert "memory" in data["checks"]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_liveness_always_returns_200(self, client: AsyncClient) -> None:
        """Test that liveness check always returns 200 if the process is running."""
        # Liveness should always succeed as long as the app is running
        for _ in range(3):
            response = await client.get("/health/live")
            assert response.status_code == 200
            assert response.json()["status"] == "alive"
