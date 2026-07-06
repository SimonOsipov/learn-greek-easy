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
from sqlalchemy.exc import OperationalError

import src.services.health_service as health_service
from src.schemas.health import ComponentStatus, HealthStatus

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

    factory.begin = MagicMock(return_value=async_context)

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
        """Test database health check with timeout (OperationalError)."""
        from src.services.health_service import check_database_health

        factory, session = mock_session_factory

        session.execute = AsyncMock(side_effect=OperationalError("statement timeout", None, None))

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
    @patch("src.services.health_service.check_redis_health_component")
    @patch("src.services.health_service.check_database_health")
    async def test_get_health_status_all_healthy(
        self,
        mock_db: MagicMock,
        mock_redis: MagicMock,
    ):
        """Test health status when all components are healthy."""
        from src.schemas.health import ComponentHealth
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

        response, status_code = await get_health_status()

        assert response.status == HealthStatus.HEALTHY
        assert status_code == 200

    @pytest.mark.asyncio
    @patch("src.services.health_service.check_redis_health_component")
    @patch("src.services.health_service.check_database_health")
    async def test_get_health_status_db_unhealthy_returns_503(
        self,
        mock_db: MagicMock,
        mock_redis: MagicMock,
    ):
        """Test health status returns 503 when DB is unhealthy."""
        from src.schemas.health import ComponentHealth
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

        response, status_code = await get_health_status()

        assert response.status == HealthStatus.UNHEALTHY
        assert status_code == 503

    @pytest.mark.asyncio
    @patch("src.services.health_service.check_redis_health_component")
    @patch("src.services.health_service.check_database_health")
    async def test_get_health_status_redis_unhealthy_returns_degraded(
        self,
        mock_db: MagicMock,
        mock_redis: MagicMock,
    ):
        """Test health status returns degraded when Redis is unhealthy."""
        from src.schemas.health import ComponentHealth
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

        response, status_code = await get_health_status()

        assert response.status == HealthStatus.DEGRADED
        assert status_code == 200  # Degraded is still OK for health checks

    @pytest.mark.asyncio
    @patch("src.services.health_service.check_redis_health_component")
    @patch("src.services.health_service.check_database_health")
    async def test_get_health_status_handles_check_exceptions(
        self,
        mock_db: MagicMock,
        mock_redis: MagicMock,
    ):
        """Test health status handles exceptions from checks."""
        from src.schemas.health import ComponentHealth
        from src.services.health_service import get_health_status

        mock_db.side_effect = Exception("DB check failed")
        mock_redis.return_value = ComponentHealth(
            status=ComponentStatus.HEALTHY,
            latency_ms=2.0,
            message="PONG received",
        )

        with patch("src.services.health_service.logger"):
            response, status_code = await get_health_status()

            # Should handle exception gracefully
            assert response.status == HealthStatus.UNHEALTHY
            assert status_code == 503

    @pytest.mark.asyncio
    @patch("src.services.health_service.check_stripe_health")
    @patch("src.services.health_service.check_redis_health_component")
    @patch("src.services.health_service.check_database_health")
    async def test_get_health_status_stripe_not_called_in_aggregate(
        self,
        mock_db: MagicMock,
        mock_redis: MagicMock,
        mock_stripe: MagicMock,
    ):
        """Stripe health check must NOT be called in the aggregate health poll (PERF-01).

        Stripe makes a synchronous external API call; including it in the readiness/liveness
        aggregate would add latency and external-service dependency to every health probe.
        The response should carry stripe=None when called via the aggregate path.
        """
        from src.schemas.health import ComponentHealth
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

        response, status_code = await get_health_status()

        mock_stripe.assert_not_called()
        assert response.checks.stripe is None
        assert response.status == HealthStatus.HEALTHY
        assert status_code == 200


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
# OPS-03-01: async single-flight TTL cache for readiness/health (contract-lock)
# ============================================================================
#
# These specs lock in the OPS-03-01 async single-flight TTL cache. They
# reference two module-level symbols — `_reset_health_caches` and
# `_HEALTH_CACHE_TTL_SECONDS` — via the `health_service` MODULE OBJECT
# (imported at the top of this file) rather than a top-level
# `from src.services.health_service import ...`. That indirection is a relic of
# when they were authored ahead of the cache: a not-yet-defined symbol then
# raised a clean per-test AttributeError instead of an ImportError that would
# break collection of this whole file. It is harmless now that the cache exists
# and both symbols are defined.


@pytest.fixture(autouse=True)
def reset_health_caches():
    """Reset the health-service TTL caches before every test in this module.

    OPS-03-01 adds a module-level single-flight TTL cache in front of
    `get_readiness_status` / `get_health_status`; without a reset, a cached
    result from one test would leak into the next. Called via `getattr` with a
    no-op fallback — a defensive relic from when `_reset_health_caches` did not
    yet exist; now that the cache is implemented the real reset always runs.
    """
    getattr(health_service, "_reset_health_caches", lambda: None)()


class TestReadinessHealthCache:
    """Contract-lock specs for the OPS-03-01 async single-flight TTL cache.

    Covers: N-concurrent-calls-collapse-to-one-compute (readiness + health),
    sequential-call-within-TTL-is-cached, reset-forces-recheck, real
    `time.monotonic()` crossing expiry, the TTL constant itself, and that
    unhealthy results are cached too (not just healthy ones).
    """

    @pytest.mark.asyncio
    async def test_readiness_concurrent_calls_check_runs_once(self, monkeypatch):
        """AC C-a: 10 concurrent get_readiness_status() calls -> the DB/Redis
        checks each run EXACTLY once (single-flight, not a thundering memo).

        Stubs are real `async def`s installed via monkeypatch.setattr (never
        an AsyncMock whose side_effect just sleeps and implicitly returns
        None) so a wrong-reason 503 (from `isinstance(db_check, ComponentHealth)`
        being False) can't masquerade as a genuine single-flight pass.
        """
        from src.schemas.health import ComponentHealth
        from src.services.health_service import get_readiness_status

        db_calls = {"count": 0}
        redis_calls = {"count": 0}

        async def fake_db_check(timeout=None):
            db_calls["count"] += 1
            await asyncio.sleep(0.05)
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        async def fake_redis_check(timeout=None):
            redis_calls["count"] += 1
            await asyncio.sleep(0.05)
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        monkeypatch.setattr(health_service, "check_database_health", fake_db_check)
        monkeypatch.setattr(health_service, "check_redis_health_component", fake_redis_check)

        results = await asyncio.gather(*[get_readiness_status() for _ in range(10)])

        assert db_calls["count"] == 1
        assert redis_calls["count"] == 1
        for response, status_code in results:
            assert status_code == 200
            assert response.status == "ready"

    @pytest.mark.asyncio
    async def test_health_concurrent_calls_check_runs_once(self, monkeypatch):
        """AC C-a: 5 concurrent get_health_status() calls -> the DB/Redis
        checks each run EXACTLY once."""
        from src.schemas.health import ComponentHealth
        from src.services.health_service import get_health_status

        db_calls = {"count": 0}
        redis_calls = {"count": 0}

        async def fake_db_check(timeout=None):
            db_calls["count"] += 1
            await asyncio.sleep(0.05)
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        async def fake_redis_check(timeout=None):
            redis_calls["count"] += 1
            await asyncio.sleep(0.05)
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        monkeypatch.setattr(health_service, "check_database_health", fake_db_check)
        monkeypatch.setattr(health_service, "check_redis_health_component", fake_redis_check)

        results = await asyncio.gather(*[get_health_status() for _ in range(5)])

        assert db_calls["count"] == 1
        assert redis_calls["count"] == 1
        for response, status_code in results:
            assert status_code == 200
            assert response.status == HealthStatus.HEALTHY

    @pytest.mark.asyncio
    async def test_readiness_second_call_within_ttl_skips_recheck(self, monkeypatch):
        """AC C-cache: two SEQUENTIAL get_readiness_status() calls within one
        TTL window -> checks run once total; the 2nd response equals the 1st
        (served from cache, not recomputed)."""
        from src.schemas.health import ComponentHealth
        from src.services.health_service import get_readiness_status

        db_calls = {"count": 0}
        redis_calls = {"count": 0}

        async def fake_db_check(timeout=None):
            db_calls["count"] += 1
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        async def fake_redis_check(timeout=None):
            redis_calls["count"] += 1
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        monkeypatch.setattr(health_service, "check_database_health", fake_db_check)
        monkeypatch.setattr(health_service, "check_redis_health_component", fake_redis_check)

        first = await get_readiness_status()
        second = await get_readiness_status()

        assert db_calls["count"] == 1
        assert redis_calls["count"] == 1
        assert first == second

    @pytest.mark.asyncio
    async def test_readiness_recheck_after_reset_reflects_new_state(self, monkeypatch):
        """AC C-freshness: a healthy call caches `(ready, 200)`; after
        `_reset_health_caches()` and repatching DB to unhealthy, the next
        call must reflect the new state as `(not_ready, 503)`."""
        from src.schemas.health import ComponentHealth
        from src.services.health_service import get_readiness_status

        async def healthy_db(timeout=None):
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        async def healthy_redis(timeout=None):
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        monkeypatch.setattr(health_service, "check_database_health", healthy_db)
        monkeypatch.setattr(health_service, "check_redis_health_component", healthy_redis)

        response, status_code = await get_readiness_status()
        assert response.status == "ready"
        assert status_code == 200

        # Not-implemented until OPS-03-01: attribute doesn't exist yet -> AttributeError.
        health_service._reset_health_caches()

        async def unhealthy_db(timeout=None):
            return ComponentHealth(
                status=ComponentStatus.UNHEALTHY, latency_ms=None, message="down"
            )

        monkeypatch.setattr(health_service, "check_database_health", unhealthy_db)

        response, status_code = await get_readiness_status()
        assert response.status == "not_ready"
        assert status_code == 503

    @pytest.mark.asyncio
    async def test_readiness_flips_to_503_after_monotonic_crosses_expiry(self, monkeypatch):
        """AC C-freshness (F3): drives a real `time.monotonic()` crossing of
        the cache expiry via a controllable fake clock — the only spec that
        exercises the actual `now >= expiry` branch (guards against a `<`/`<=`
        inversion, or an `expiry = TTL` bug instead of `monotonic() + TTL`).

        Given t0: a healthy call caches the result (expiry = t0 + TTL).
        When a second call happens still at t0 (within the window): it must
        be served from cache (no recompute) — the cache short-circuits the
        recompute that an uncached implementation would run on every call
        regardless of the clock.
        Then the fake clock advances past the TTL and DB flips unhealthy:
        the next call must re-run the check and return 503.
        """
        from src.schemas.health import ComponentHealth
        from src.services.health_service import get_readiness_status

        fake_time = {"now": 1_000.0}
        monkeypatch.setattr(health_service.time, "monotonic", lambda: fake_time["now"])

        db_calls = {"count": 0}

        async def healthy_db(timeout=None):
            db_calls["count"] += 1
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        async def healthy_redis(timeout=None):
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        monkeypatch.setattr(health_service, "check_database_health", healthy_db)
        monkeypatch.setattr(health_service, "check_redis_health_component", healthy_redis)

        # t0: first call caches the healthy result (expiry = t0 + TTL).
        response, status_code = await get_readiness_status()
        assert status_code == 200
        assert db_calls["count"] == 1

        # Still at t0 (within the TTL window): must be served from cache.
        response, status_code = await get_readiness_status()
        assert status_code == 200
        assert db_calls["count"] == 1  # cached: single compute (would be 2 without the cache)

        # Advance the fake clock past the ~5s TTL and flip DB unhealthy.
        fake_time["now"] += 6.0

        async def unhealthy_db(timeout=None):
            db_calls["count"] += 1
            return ComponentHealth(
                status=ComponentStatus.UNHEALTHY, latency_ms=None, message="down"
            )

        monkeypatch.setattr(health_service, "check_database_health", unhealthy_db)

        response, status_code = await get_readiness_status()
        assert db_calls["count"] == 2  # re-ran after expiry, not still (incorrectly) cached
        assert status_code == 503
        assert response.status == "not_ready"

    def test_health_cache_ttl_is_short(self):
        """AC C-freshness: the TTL constant must be short (<=5s) so a
        genuinely-just-died dependency still surfaces within ~one window."""
        assert health_service._HEALTH_CACHE_TTL_SECONDS <= 5

    @pytest.mark.asyncio
    async def test_readiness_unhealthy_result_cached_within_window(self, monkeypatch):
        """AC C (unhealthy cached): an UNHEALTHY result must also be cached
        for the full TTL window — two calls within the window -> checks run
        once; both return 503. Caching failures too prevents health-check
        amplification against an already-struggling dependency (D3 budget)."""
        from src.schemas.health import ComponentHealth
        from src.services.health_service import get_readiness_status

        db_calls = {"count": 0}
        redis_calls = {"count": 0}

        async def unhealthy_db(timeout=None):
            db_calls["count"] += 1
            return ComponentHealth(
                status=ComponentStatus.UNHEALTHY, latency_ms=None, message="down"
            )

        async def healthy_redis(timeout=None):
            redis_calls["count"] += 1
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        monkeypatch.setattr(health_service, "check_database_health", unhealthy_db)
        monkeypatch.setattr(health_service, "check_redis_health_component", healthy_redis)

        first = await get_readiness_status()
        second = await get_readiness_status()

        assert db_calls["count"] == 1
        assert redis_calls["count"] == 1
        assert first[1] == 503
        assert second[1] == 503


# ============================================================================
# OPS-03-01: QA adversarial coverage (Mode B) for the single-flight TTL cache
# ============================================================================
#
# The AC specs above (TestReadinessHealthCache) prove the happy-path
# single-flight/TTL contract. These add the risk cases the AC table didn't
# name: a raising factory, cache independence between the two public
# entrypoints, TTL-driven recovery (not just TTL-driven death), and object
# identity across concurrent waiters (proving a *shared* result, not merely
# an equal-by-value one).


class TestAsyncSingleFlightTTLAdversarial:
    """Adversarial coverage for `_AsyncSingleFlightTTL` and the two public
    cached entrypoints it backs."""

    @pytest.mark.asyncio
    async def test_factory_exception_does_not_poison_cache_and_lock_releases(self):
        """Highest-value missing case: a factory that raises must not wedge
        the cache. `async with self._lock` releases on ANY exit path
        (including via exception), and the cache must stay empty (the
        failure itself must not be "cached") so the very next call retries
        the factory instead of deadlocking on a still-held lock or replaying
        a stale/partial value."""
        cache = health_service._AsyncSingleFlightTTL(5.0)
        calls = {"n": 0}

        async def raising_factory():
            calls["n"] += 1
            raise RuntimeError("boom")

        with pytest.raises(RuntimeError, match="boom"):
            await cache.get(raising_factory)

        assert calls["n"] == 1
        # No poisoned/partial value was captured.
        assert cache._value is None
        assert cache._expiry == 0.0

        # The lock must be released -- a subsequent get() must neither
        # deadlock nor serve a false-cached hit; it must retry the factory.
        async def good_factory():
            calls["n"] += 1
            return "ok"

        result = await asyncio.wait_for(cache.get(good_factory), timeout=1.0)
        assert result == "ok"
        assert calls["n"] == 2

    @pytest.mark.asyncio
    async def test_concurrent_callers_all_surface_factory_exception_without_deadlock(self):
        """N concurrent misses against an always-raising factory must all
        complete (no deadlock) with the exception surfaced to every caller --
        guards against a bug where an exception mid-critical-section leaves
        the lock permanently held for the remaining waiters."""
        cache = health_service._AsyncSingleFlightTTL(5.0)
        calls = {"n": 0}

        async def raising_factory():
            calls["n"] += 1
            await asyncio.sleep(0.01)
            raise RuntimeError("still down")

        results = await asyncio.wait_for(
            asyncio.gather(*[cache.get(raising_factory) for _ in range(5)], return_exceptions=True),
            timeout=1.0,
        )

        assert len(results) == 5
        for r in results:
            assert isinstance(r, RuntimeError)
        assert calls["n"] >= 1
        assert cache._value is None
        assert cache._expiry == 0.0

    @pytest.mark.asyncio
    async def test_readiness_and_health_caches_are_independent(self, monkeypatch):
        """Readiness and health each wrap a distinct compute fn behind a
        distinct cache instance -- a readiness call must not warm the health
        cache (or vice versa). A shared/aliased cache would skip the second
        recompute below."""
        from src.schemas.health import ComponentHealth
        from src.services.health_service import get_health_status, get_readiness_status

        db_calls = {"count": 0}
        redis_calls = {"count": 0}

        async def fake_db(timeout=None):
            db_calls["count"] += 1
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        async def fake_redis(timeout=None):
            redis_calls["count"] += 1
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        monkeypatch.setattr(health_service, "check_database_health", fake_db)
        monkeypatch.setattr(health_service, "check_redis_health_component", fake_redis)

        readiness_response, readiness_status_code = await get_readiness_status()
        assert db_calls["count"] == 1
        assert redis_calls["count"] == 1

        health_response, health_status_code = await get_health_status()
        # Independent caches must re-run the underlying checks for the
        # health compute rather than serving the readiness-shaped result.
        assert db_calls["count"] == 2
        assert redis_calls["count"] == 2
        assert health_status_code == 200
        assert health_response.status == HealthStatus.HEALTHY
        assert readiness_response.status == "ready"
        assert readiness_status_code == 200

    @pytest.mark.asyncio
    async def test_concurrent_callers_receive_identical_cached_object(self, monkeypatch):
        """Single-flight must return one SHARED result object to every
        waiter -- not merely an equal-by-value copy. Also stages a "late
        arrival": a caller dispatched after the in-flight compute has
        already started must still be served the one shared result rather
        than triggering a second compute."""
        from src.schemas.health import ComponentHealth
        from src.services.health_service import get_readiness_status

        db_calls = {"count": 0}

        async def fake_db(timeout=None):
            db_calls["count"] += 1
            await asyncio.sleep(0.05)
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        async def fake_redis(timeout=None):
            await asyncio.sleep(0.05)
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        monkeypatch.setattr(health_service, "check_database_health", fake_db)
        monkeypatch.setattr(health_service, "check_redis_health_component", fake_redis)

        async def late_arrival():
            # Head start for the first wave so this arrives mid-compute,
            # while the factory is still awaiting inside the critical section.
            await asyncio.sleep(0.01)
            return await get_readiness_status()

        tasks = [asyncio.create_task(get_readiness_status()) for _ in range(4)]
        tasks.append(asyncio.create_task(late_arrival()))
        results = await asyncio.gather(*tasks)

        assert db_calls["count"] == 1
        first = results[0]
        for r in results[1:]:
            assert r is first  # identical object, not an equal-but-distinct copy

    @pytest.mark.asyncio
    async def test_health_recovers_healthy_after_ttl_expiry_following_unhealthy_window(
        self, monkeypatch
    ):
        """Recovery path in the OTHER direction from the AC spec (which only
        drove healthy->unhealthy): an unhealthy result cached for a window
        must, once the fake clock crosses the TTL and the dependency comes
        back, flip to healthy on the very next call -- guards against a
        recheck bug that only triggers on failure transitions, not recovery."""
        from src.schemas.health import ComponentHealth
        from src.services.health_service import get_health_status

        fake_time = {"now": 2_000.0}
        monkeypatch.setattr(health_service.time, "monotonic", lambda: fake_time["now"])

        db_calls = {"count": 0}

        async def unhealthy_db(timeout=None):
            db_calls["count"] += 1
            return ComponentHealth(
                status=ComponentStatus.UNHEALTHY, latency_ms=None, message="down"
            )

        async def healthy_redis(timeout=None):
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        monkeypatch.setattr(health_service, "check_database_health", unhealthy_db)
        monkeypatch.setattr(health_service, "check_redis_health_component", healthy_redis)

        response, status_code = await get_health_status()
        assert status_code == 503
        assert response.status == HealthStatus.UNHEALTHY
        assert db_calls["count"] == 1

        # Still within the window: must be served from cache, not recomputed.
        response, status_code = await get_health_status()
        assert status_code == 503
        assert db_calls["count"] == 1  # would be 2 without caching

        # Advance past the TTL and let the dependency recover.
        fake_time["now"] += 6.0

        async def healthy_db(timeout=None):
            db_calls["count"] += 1
            return ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok")

        monkeypatch.setattr(health_service, "check_database_health", healthy_db)

        response, status_code = await get_health_status()
        assert db_calls["count"] == 2  # re-ran after expiry, recovered
        assert status_code == 200
        assert response.status == HealthStatus.HEALTHY


# ============================================================================
# OPS-03-02: public /health payload trim — schema contract (contract-lock)
# ============================================================================
#
# HealthResponse.version/.environment and HealthChecks.memory are trimmed
# from the publicly-reachable /health and /api/v1/health payloads by
# OPS-03-02. This spec asserts the Pydantic model definitions directly (the
# schema-level half of the contract; the router-level half lives in
# tests/unit/api/test_health.py + tests/unit/api/v1/test_health.py). It passes
# now that the trim shipped and locks it in — it would fail again only if those
# fields were re-declared on the models.


class TestHealthResponseSchemaTrim:
    """Contract-lock spec for the OPS-03-02 schema trim."""

    def test_health_response_schema_drops_trimmed_fields(self):
        """AC C-trim: HealthResponse must not define version/environment;
        HealthChecks must not define memory. Green post-trim — these fields
        were removed from `model_fields`; this test locks them out."""
        from src.schemas.health import HealthChecks, HealthResponse

        assert "version" not in HealthResponse.model_fields
        assert "environment" not in HealthResponse.model_fields
        assert "memory" not in HealthChecks.model_fields


# ============================================================================
# OPS-03-02: QA Mode B adversarial coverage — extra-field leak guard
# ============================================================================
#
# Pydantic v2 BaseModel defaults to `extra="ignore"`: passing an unknown
# kwarg to the constructor is silently dropped rather than raising. That
# means a caller who still passes version=/environment=/memory= (as this
# repo's own test fixtures in test_health.py / v1/test_health.py still do --
# only their assertions were adapted by the trim, not their constructor
# calls) would not error, which could mask an incomplete trim if a future
# edit re-introduced these as `extra="allow"` fields or similar. This test
# proves the actual serialized key set stays exactly the trimmed set even
# when the old removed kwargs are still passed in.


class TestHealthResponseSchemaTrimAdversarial:
    """Guards against the trimmed fields leaking back in via model_dump."""

    def test_extra_kwargs_do_not_leak_into_serialized_health_response(self):
        import json
        from datetime import datetime, timezone

        from src.schemas.health import (
            ComponentHealth,
            ComponentStatus,
            HealthChecks,
            HealthResponse,
            HealthStatus,
        )

        response = HealthResponse(
            status=HealthStatus.HEALTHY,
            version="0.1.0",  # removed field -- must be dropped, not leaked
            environment="test",  # removed field -- must be dropped, not leaked
            timestamp=datetime.now(timezone.utc),
            uptime_seconds=1.0,
            checks=HealthChecks(
                database=ComponentHealth(
                    status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok"
                ),
                redis=ComponentHealth(status=ComponentStatus.HEALTHY, latency_ms=1.0, message="ok"),
                memory={  # removed field -- must be dropped, not leaked
                    "status": "healthy",
                    "used_mb": 1.0,
                    "percent": 1.0,
                    "message": "ok",
                },
            ),
        )

        dumped = response.model_dump()
        assert set(dumped.keys()) == {"status", "timestamp", "uptime_seconds", "checks"}
        assert set(dumped["checks"].keys()) == {"database", "redis", "stripe"}

        json_dumped = json.loads(response.model_dump_json())
        assert set(json_dumped.keys()) == {"status", "timestamp", "uptime_seconds", "checks"}
        assert set(json_dumped["checks"].keys()) == {"database", "redis", "stripe"}


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
