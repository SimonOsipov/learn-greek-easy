"""Unit tests for health service.

Tests cover:
- check_database_health() with various scenarios
- check_redis_health_component() status conversion
- check_stripe_health() with various scenarios
- check_memory_health() with different memory states
- get_health_status() comprehensive health check
- get_liveness_status() simple liveness check
- get_readiness_status() readiness probe
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.schemas.health import ComponentStatus, HealthStatus, StripeHealth

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def mock_session_factory():
    """Create a mock session factory."""
    factory = MagicMock()
    session = AsyncMock()

    async_context = AsyncMock()
    async_context.__aenter__ = AsyncMock(return_value=session)
    async_context.__aexit__ = AsyncMock(return_value=None)

    factory.return_value = async_context

    return factory, session


@pytest.fixture
def mock_psutil_process():
    """Create a mock psutil Process."""
    process = MagicMock()
    memory_info = MagicMock()
    memory_info.rss = 128 * 1024 * 1024  # 128 MB
    process.memory_info.return_value = memory_info
    process.memory_percent.return_value = 25.5
    return process


# ============================================================================
# check_database_health() Tests
# ============================================================================


class TestCheckDatabaseHealth:
    """Tests for check_database_health function."""

    @pytest.mark.asyncio
    async def test_check_database_health_success(self, mock_session_factory):
        """Test successful database health check."""
        from src.services.health_service import check_database_health

        factory, session = mock_session_factory
        mock_result = MagicMock()
        mock_result.scalar.return_value = 1
        session.execute = AsyncMock(return_value=mock_result)

        with patch("src.services.health_service.get_session_factory", return_value=factory):
            result = await check_database_health()

            assert result.status == ComponentStatus.HEALTHY
            assert result.message == "Connection successful"
            assert result.latency_ms is not None
            assert result.latency_ms >= 0

    @pytest.mark.asyncio
    async def test_check_database_health_not_initialized(self):
        """Test database health check when not initialized."""
        from src.services.health_service import check_database_health

        with patch(
            "src.services.health_service.get_session_factory",
            side_effect=RuntimeError("Database not initialized"),
        ):
            result = await check_database_health()

            assert result.status == ComponentStatus.UNHEALTHY
            assert result.latency_ms is None
            assert "not initialized" in result.message.lower()

    @pytest.mark.asyncio
    async def test_check_database_health_timeout(self, mock_session_factory):
        """Test database health check with timeout."""
        from src.services.health_service import check_database_health

        factory, session = mock_session_factory

        async def slow_execute(*args, **kwargs):
            await asyncio.sleep(10)

        session.execute = slow_execute

        with patch("src.services.health_service.get_session_factory", return_value=factory):
            result = await check_database_health(timeout=0.01)

            assert result.status == ComponentStatus.UNHEALTHY
            assert result.latency_ms is None
            assert "timeout" in result.message.lower()

    @pytest.mark.asyncio
    async def test_check_database_health_connection_error(self, mock_session_factory):
        """Test database health check with connection error."""
        from src.services.health_service import check_database_health

        factory, session = mock_session_factory
        session.execute = AsyncMock(side_effect=ConnectionError("Connection refused"))

        with patch("src.services.health_service.get_session_factory", return_value=factory):
            with patch("src.services.health_service.logger"):
                result = await check_database_health()

                assert result.status == ComponentStatus.UNHEALTHY
                assert result.latency_ms is None
                assert "error" in result.message.lower()

    @pytest.mark.asyncio
    async def test_check_database_health_latency_calculation(self, mock_session_factory):
        """Test that latency is calculated correctly."""
        from src.services.health_service import check_database_health

        factory, session = mock_session_factory

        async def delayed_execute(*args, **kwargs):
            await asyncio.sleep(0.05)  # 50ms delay
            result = MagicMock()
            result.scalar.return_value = 1
            return result

        session.execute = delayed_execute

        with patch("src.services.health_service.get_session_factory", return_value=factory):
            result = await check_database_health()

            assert result.status == ComponentStatus.HEALTHY
            # Latency should be at least 50ms
            assert result.latency_ms >= 40  # Allow some tolerance


# ============================================================================
# check_redis_health_component() Tests
# ============================================================================


class TestCheckRedisHealthComponent:
    """Tests for check_redis_health_component function."""

    @pytest.mark.asyncio
    async def test_check_redis_health_component_success(self):
        """Test successful Redis health check."""
        from src.services.health_service import check_redis_health_component

        with patch(
            "src.services.health_service.check_redis_health",
            return_value=(True, 5.5, "PONG received"),
        ):
            result = await check_redis_health_component()

            assert result.status == ComponentStatus.HEALTHY
            assert result.latency_ms == 5.5
            assert result.message == "PONG received"

    @pytest.mark.asyncio
    async def test_check_redis_health_component_unhealthy(self):
        """Test Redis health check when unhealthy."""
        from src.services.health_service import check_redis_health_component

        with patch(
            "src.services.health_service.check_redis_health",
            return_value=(False, 0.0, "Redis client not initialized"),
        ):
            result = await check_redis_health_component()

            assert result.status == ComponentStatus.UNHEALTHY
            assert result.latency_ms is None  # 0.0 becomes None
            assert result.message == "Redis client not initialized"

    @pytest.mark.asyncio
    async def test_check_redis_health_component_latency_rounding(self):
        """Test that latency is rounded to 2 decimal places."""
        from src.services.health_service import check_redis_health_component

        with patch(
            "src.services.health_service.check_redis_health",
            return_value=(True, 3.456789, "PONG received"),
        ):
            result = await check_redis_health_component()

            assert result.latency_ms == 3.46  # Rounded to 2 decimal places


# ============================================================================
# check_stripe_health() Tests
# ============================================================================


class TestCheckStripeHealth:
    """Tests for check_stripe_health function."""

    @pytest.mark.asyncio
    async def test_check_stripe_health_unconfigured(self):
        """Test Stripe health check when not configured."""
        from src.services.health_service import check_stripe_health

        with patch(
            "src.services.health_service.is_stripe_configured",
            return_value=False,
        ):
            result = await check_stripe_health()

            assert result.status == "unconfigured"
            assert "not configured" in result.message.lower()

    @pytest.mark.asyncio
    async def test_check_stripe_health_success(self):
        """Test successful Stripe health check."""
        from src.services.health_service import check_stripe_health

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.accounts.retrieve_current_async = AsyncMock()

        with patch(
            "src.services.health_service.is_stripe_configured",
            return_value=True,
        ):
            with patch(
                "src.services.health_service.get_stripe_client",
                return_value=mock_stripe_client,
            ):
                result = await check_stripe_health()

                assert result.status == "ok"
                assert result.message == "Stripe API reachable"

    @pytest.mark.asyncio
    async def test_check_stripe_health_timeout(self):
        """Test Stripe health check with timeout."""
        from src.services.health_service import check_stripe_health

        mock_stripe_client = MagicMock()

        async def slow_retrieve():
            await asyncio.sleep(10)

        mock_stripe_client.v1.accounts.retrieve_current_async = slow_retrieve

        with patch(
            "src.services.health_service.is_stripe_configured",
            return_value=True,
        ):
            with patch(
                "src.services.health_service.get_stripe_client",
                return_value=mock_stripe_client,
            ):
                result = await check_stripe_health(timeout=0.01)

                assert result.status == "error"
                assert "timeout" in result.message.lower()

    @pytest.mark.asyncio
    async def test_check_stripe_health_api_error(self):
        """Test Stripe health check with API error."""
        from src.services.health_service import check_stripe_health

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.accounts.retrieve_current_async = AsyncMock(
            side_effect=Exception("Connection failed")
        )

        with patch(
            "src.services.health_service.is_stripe_configured",
            return_value=True,
        ):
            with patch(
                "src.services.health_service.get_stripe_client",
                return_value=mock_stripe_client,
            ):
                with patch("src.services.health_service.logger"):
                    result = await check_stripe_health()

                    assert result.status == "error"
                    assert "Stripe API error" in result.message

    @pytest.mark.asyncio
    async def test_check_stripe_health_exception_handling(self):
        """Test Stripe health check handles generic exceptions."""
        from src.services.health_service import check_stripe_health

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.accounts.retrieve_current_async = AsyncMock(
            side_effect=RuntimeError("Unexpected error")
        )

        with patch(
            "src.services.health_service.is_stripe_configured",
            return_value=True,
        ):
            with patch(
                "src.services.health_service.get_stripe_client",
                return_value=mock_stripe_client,
            ):
                with patch("src.services.health_service.logger"):
                    result = await check_stripe_health()

                    assert result.status == "error"
                    assert "Unexpected error" in result.message


# ============================================================================
# check_memory_health() Tests
# ============================================================================


class TestCheckMemoryHealth:
    """Tests for check_memory_health function."""

    def test_check_memory_health_normal(self, mock_psutil_process):
        """Test memory health check with normal memory usage."""
        from src.services.health_service import check_memory_health

        with patch("src.services.health_service.psutil.Process", return_value=mock_psutil_process):
            with patch("src.services.health_service.settings") as mock_settings:
                mock_settings.health_check_memory_warning_percent = 80.0

                result = check_memory_health()

                assert result.status == ComponentStatus.HEALTHY
                assert result.used_mb == 128.0
                assert result.percent == 25.5
                assert "normal" in result.message.lower()

    def test_check_memory_health_warning_threshold(self):
        """Test memory health check with high memory usage."""
        from src.services.health_service import check_memory_health

        process = MagicMock()
        memory_info = MagicMock()
        memory_info.rss = 256 * 1024 * 1024  # 256 MB
        process.memory_info.return_value = memory_info
        process.memory_percent.return_value = 85.0

        with patch("src.services.health_service.psutil.Process", return_value=process):
            with patch("src.services.health_service.settings") as mock_settings:
                mock_settings.health_check_memory_warning_percent = 80.0

                result = check_memory_health()

                assert result.status == ComponentStatus.WARNING
                assert "high memory" in result.message.lower()

    def test_check_memory_health_exception_handling(self):
        """Test memory health check when exception occurs."""
        from src.services.health_service import check_memory_health

        with patch(
            "src.services.health_service.psutil.Process",
            side_effect=Exception("Process error"),
        ):
            with patch("src.services.health_service.logger"):
                result = check_memory_health()

                assert result.status == ComponentStatus.WARNING
                assert result.used_mb == 0.0
                assert result.percent == 0.0
                assert "unable to check" in result.message.lower()


# ============================================================================
# get_health_status() Tests
# ============================================================================


class TestGetHealthStatus:
    """Tests for get_health_status function."""

    @pytest.mark.asyncio
    @patch("src.services.health_service.check_stripe_health")
    @patch("src.services.health_service.check_memory_health")
    @patch("src.services.health_service.check_redis_health_component")
    @patch("src.services.health_service.check_database_health")
    async def test_get_health_status_all_healthy(
        self,
        mock_db: MagicMock,
        mock_redis: MagicMock,
        mock_memory: MagicMock,
        mock_stripe: MagicMock,
    ):
        """Test health status when all components are healthy."""
        from src.schemas.health import ComponentHealth, MemoryHealth
        from src.services.health_service import get_health_status

        mock_db.return_value = ComponentHealth(
            status=ComponentStatus.HEALTHY,
            latency_ms=5.0,
            message="Connection successful",
        )
        mock_redis.return_value = ComponentHealth(
            status=ComponentStatus.HEALTHY,
            latency_ms=2.0,
            message="PONG received",
        )
        mock_memory.return_value = MemoryHealth(
            status=ComponentStatus.HEALTHY,
            used_mb=128.0,
            percent=25.0,
            message="Memory usage normal",
        )
        mock_stripe.return_value = StripeHealth(
            status="ok",
            message="Stripe API reachable",
        )

        response, status_code = await get_health_status()

        assert response.status == HealthStatus.HEALTHY
        assert status_code == 200

    @pytest.mark.asyncio
    @patch("src.services.health_service.check_stripe_health")
    @patch("src.services.health_service.check_memory_health")
    @patch("src.services.health_service.check_redis_health_component")
    @patch("src.services.health_service.check_database_health")
    async def test_get_health_status_db_unhealthy_returns_503(
        self,
        mock_db: MagicMock,
        mock_redis: MagicMock,
        mock_memory: MagicMock,
        mock_stripe: MagicMock,
    ):
        """Test health status returns 503 when DB is unhealthy."""
        from src.schemas.health import ComponentHealth, MemoryHealth
        from src.services.health_service import get_health_status

        mock_db.return_value = ComponentHealth(
            status=ComponentStatus.UNHEALTHY,
            latency_ms=None,
            message="Connection error",
        )
        mock_redis.return_value = ComponentHealth(
            status=ComponentStatus.HEALTHY,
            latency_ms=2.0,
            message="PONG received",
        )
        mock_memory.return_value = MemoryHealth(
            status=ComponentStatus.HEALTHY,
            used_mb=128.0,
            percent=25.0,
            message="Memory usage normal",
        )
        mock_stripe.return_value = StripeHealth(
            status="ok",
            message="Stripe API reachable",
        )

        response, status_code = await get_health_status()

        assert response.status == HealthStatus.UNHEALTHY
        assert status_code == 503

    @pytest.mark.asyncio
    @patch("src.services.health_service.check_stripe_health")
    @patch("src.services.health_service.check_memory_health")
    @patch("src.services.health_service.check_redis_health_component")
    @patch("src.services.health_service.check_database_health")
    async def test_get_health_status_redis_unhealthy_returns_degraded(
        self,
        mock_db: MagicMock,
        mock_redis: MagicMock,
        mock_memory: MagicMock,
        mock_stripe: MagicMock,
    ):
        """Test health status returns degraded when Redis is unhealthy."""
        from src.schemas.health import ComponentHealth, MemoryHealth
        from src.services.health_service import get_health_status

        mock_db.return_value = ComponentHealth(
            status=ComponentStatus.HEALTHY,
            latency_ms=5.0,
            message="Connection successful",
        )
        mock_redis.return_value = ComponentHealth(
            status=ComponentStatus.UNHEALTHY,
            latency_ms=None,
            message="Connection refused",
        )
        mock_memory.return_value = MemoryHealth(
            status=ComponentStatus.HEALTHY,
            used_mb=128.0,
            percent=25.0,
            message="Memory usage normal",
        )
        mock_stripe.return_value = StripeHealth(
            status="ok",
            message="Stripe API reachable",
        )

        response, status_code = await get_health_status()

        assert response.status == HealthStatus.DEGRADED
        assert status_code == 200  # Degraded is still OK for health checks

    @pytest.mark.asyncio
    @patch("src.services.health_service.check_stripe_health")
    @patch("src.services.health_service.check_memory_health")
    @patch("src.services.health_service.check_redis_health_component")
    @patch("src.services.health_service.check_database_health")
    async def test_get_health_status_handles_check_exceptions(
        self,
        mock_db: MagicMock,
        mock_redis: MagicMock,
        mock_memory: MagicMock,
        mock_stripe: MagicMock,
    ):
        """Test health status handles exceptions from checks."""
        from src.schemas.health import ComponentHealth, MemoryHealth
        from src.services.health_service import get_health_status

        mock_db.side_effect = Exception("DB check failed")
        mock_redis.return_value = ComponentHealth(
            status=ComponentStatus.HEALTHY,
            latency_ms=2.0,
            message="PONG received",
        )
        mock_memory.return_value = MemoryHealth(
            status=ComponentStatus.HEALTHY,
            used_mb=128.0,
            percent=25.0,
            message="Memory usage normal",
        )
        mock_stripe.return_value = StripeHealth(
            status="ok",
            message="Stripe API reachable",
        )

        with patch("src.services.health_service.logger"):
            response, status_code = await get_health_status()

            # Should handle exception gracefully
            assert response.status == HealthStatus.UNHEALTHY
            assert status_code == 503

    @pytest.mark.asyncio
    @patch("src.services.health_service.check_stripe_health")
    @patch("src.services.health_service.check_memory_health")
    @patch("src.services.health_service.check_redis_health_component")
    @patch("src.services.health_service.check_database_health")
    async def test_get_health_status_stripe_error_returns_degraded(
        self,
        mock_db: MagicMock,
        mock_redis: MagicMock,
        mock_memory: MagicMock,
        mock_stripe: MagicMock,
    ):
        """Test health status returns degraded when Stripe is unhealthy."""
        from src.schemas.health import ComponentHealth, MemoryHealth
        from src.services.health_service import get_health_status

        mock_db.return_value = ComponentHealth(
            status=ComponentStatus.HEALTHY,
            latency_ms=5.0,
            message="Connection successful",
        )
        mock_redis.return_value = ComponentHealth(
            status=ComponentStatus.HEALTHY,
            latency_ms=2.0,
            message="PONG received",
        )
        mock_memory.return_value = MemoryHealth(
            status=ComponentStatus.HEALTHY,
            used_mb=128.0,
            percent=25.0,
            message="Memory usage normal",
        )
        mock_stripe.return_value = StripeHealth(
            status="error",
            message="Stripe API error: Connection failed",
        )

        response, status_code = await get_health_status()

        assert response.status == HealthStatus.DEGRADED
        assert status_code == 200  # Degraded is still OK for health checks


# ============================================================================
# get_liveness_status() Tests
# ============================================================================


class TestGetLivenessStatus:
    """Tests for get_liveness_status function."""

    @pytest.mark.asyncio
    async def test_get_liveness_status_returns_alive(self):
        """Test that liveness status returns alive."""
        from src.services.health_service import get_liveness_status

        response = await get_liveness_status()

        assert response.status == "alive"
        assert response.timestamp is not None


# ============================================================================
# get_readiness_status() Tests
# ============================================================================


class TestGetReadinessStatus:
    """Tests for get_readiness_status function."""

    @pytest.mark.asyncio
    async def test_get_readiness_status_all_ready(self):
        """Test readiness status when all components are ready."""
        from src.schemas.health import ComponentHealth
        from src.services.health_service import get_readiness_status

        mock_db_health = ComponentHealth(
            status=ComponentStatus.HEALTHY,
            latency_ms=5.0,
            message="Connection successful",
        )
        mock_redis_health = ComponentHealth(
            status=ComponentStatus.HEALTHY,
            latency_ms=2.0,
            message="PONG received",
        )

        with patch(
            "src.services.health_service.check_database_health",
            return_value=mock_db_health,
        ):
            with patch(
                "src.services.health_service.check_redis_health_component",
                return_value=mock_redis_health,
            ):
                response, status_code = await get_readiness_status()

                assert response.status == "ready"
                assert status_code == 200
                assert response.checks.database is True
                assert response.checks.redis is True

    @pytest.mark.asyncio
    async def test_get_readiness_status_db_not_ready_returns_503(self):
        """Test readiness status returns 503 when DB is not ready."""
        from src.schemas.health import ComponentHealth
        from src.services.health_service import get_readiness_status

        mock_db_health = ComponentHealth(
            status=ComponentStatus.UNHEALTHY,
            latency_ms=None,
            message="Connection error",
        )
        mock_redis_health = ComponentHealth(
            status=ComponentStatus.HEALTHY,
            latency_ms=2.0,
            message="PONG received",
        )

        with patch(
            "src.services.health_service.check_database_health",
            return_value=mock_db_health,
        ):
            with patch(
                "src.services.health_service.check_redis_health_component",
                return_value=mock_redis_health,
            ):
                response, status_code = await get_readiness_status()

                assert response.status == "not_ready"
                assert status_code == 503
                assert response.checks.database is False
                assert response.checks.redis is True

    @pytest.mark.asyncio
    async def test_get_readiness_status_redis_not_ready_returns_503(self):
        """Test readiness status returns 503 when Redis is not ready."""
        from src.schemas.health import ComponentHealth
        from src.services.health_service import get_readiness_status

        mock_db_health = ComponentHealth(
            status=ComponentStatus.HEALTHY,
            latency_ms=5.0,
            message="Connection successful",
        )
        mock_redis_health = ComponentHealth(
            status=ComponentStatus.UNHEALTHY,
            latency_ms=None,
            message="Connection refused",
        )

        with patch(
            "src.services.health_service.check_database_health",
            return_value=mock_db_health,
        ):
            with patch(
                "src.services.health_service.check_redis_health_component",
                return_value=mock_redis_health,
            ):
                response, status_code = await get_readiness_status()

                assert response.status == "not_ready"
                assert status_code == 503
                assert response.checks.database is True
                assert response.checks.redis is False

    @pytest.mark.asyncio
    async def test_get_readiness_status_handles_exceptions(self):
        """Test readiness status handles exceptions from checks."""
        from src.schemas.health import ComponentHealth
        from src.services.health_service import get_readiness_status

        mock_redis_health = ComponentHealth(
            status=ComponentStatus.HEALTHY,
            latency_ms=2.0,
            message="PONG received",
        )

        with patch(
            "src.services.health_service.check_database_health",
            side_effect=Exception("DB check failed"),
        ):
            with patch(
                "src.services.health_service.check_redis_health_component",
                return_value=mock_redis_health,
            ):
                response, status_code = await get_readiness_status()

                # Should handle exception gracefully
                assert response.status == "not_ready"
                assert status_code == 503
                # Database check failed, so it's not ready
                assert response.checks.database is False


# ============================================================================
# get_uptime_seconds() Tests
# ============================================================================


class TestGetUptimeSeconds:
    """Tests for get_uptime_seconds function."""

    def test_get_uptime_seconds_returns_positive(self):
        """Test that uptime is always positive."""
        from src.services.health_service import get_uptime_seconds

        uptime = get_uptime_seconds()

        assert uptime >= 0
        assert isinstance(uptime, float)
