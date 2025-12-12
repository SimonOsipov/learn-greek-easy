"""Unit tests for Redis core module.

Tests cover:
- init_redis() connection initialization
- close_redis() connection cleanup
- get_redis() client retrieval
- check_redis_health() health checking
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import TimeoutError as RedisTimeoutError

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture(autouse=True)
def reset_redis_globals():
    """Reset global Redis state before and after each test."""
    import src.core.redis as redis_module

    # Save original state
    original_client = redis_module._redis_client
    original_pool = redis_module._connection_pool

    # Reset state before test
    redis_module._redis_client = None
    redis_module._connection_pool = None

    yield

    # Reset state after test
    redis_module._redis_client = original_client
    redis_module._connection_pool = original_pool


@pytest.fixture
def mock_connection_pool():
    """Create a mock connection pool."""
    pool = MagicMock()
    pool.disconnect = AsyncMock()
    return pool


@pytest.fixture
def mock_redis_client():
    """Create a mock Redis client."""
    client = AsyncMock()
    client.ping = AsyncMock(return_value=True)
    client.close = AsyncMock()
    return client


# ============================================================================
# init_redis() Tests
# ============================================================================


class TestInitRedis:
    """Tests for init_redis function."""

    @pytest.mark.asyncio
    async def test_init_redis_success(self, mock_connection_pool, mock_redis_client):
        """Test successful Redis initialization."""
        from src.core.redis import get_redis, init_redis

        with patch("src.core.redis.ConnectionPool.from_url", return_value=mock_connection_pool):
            with patch("src.core.redis.Redis", return_value=mock_redis_client):
                with patch("src.core.redis.logger"):
                    await init_redis()

                    # Verify client is set
                    assert get_redis() == mock_redis_client

                    # Verify ping was called
                    mock_redis_client.ping.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_init_redis_already_initialized_logs_warning(
        self, mock_connection_pool, mock_redis_client
    ):
        """Test that init_redis logs warning if already initialized."""
        import src.core.redis as redis_module
        from src.core.redis import init_redis

        # Pre-set the client
        redis_module._redis_client = mock_redis_client

        with patch("src.core.redis.logger") as mock_logger:
            await init_redis()

            mock_logger.warning.assert_called()
            # Check the warning message
            call_args = str(mock_logger.warning.call_args)
            assert "already initialized" in call_args.lower()

    @pytest.mark.asyncio
    async def test_init_redis_connection_failure_sets_degraded_mode(self, mock_connection_pool):
        """Test that connection failure results in degraded mode."""
        from src.core.redis import get_redis, init_redis

        mock_client = AsyncMock()
        mock_client.ping = AsyncMock(side_effect=RedisConnectionError("Connection refused"))

        with patch("src.core.redis.ConnectionPool.from_url", return_value=mock_connection_pool):
            with patch("src.core.redis.Redis", return_value=mock_client):
                with patch("src.core.redis.logger") as mock_logger:
                    await init_redis()

                    # Client should be None (degraded mode)
                    assert get_redis() is None

                    # Warning should be logged
                    mock_logger.warning.assert_called()

    @pytest.mark.asyncio
    async def test_init_redis_pool_configuration(self, mock_redis_client):
        """Test that connection pool is configured correctly."""
        from src.core.redis import init_redis

        with patch("src.core.redis.ConnectionPool.from_url") as mock_pool_factory:
            mock_pool = MagicMock()
            mock_pool_factory.return_value = mock_pool

            with patch("src.core.redis.Redis", return_value=mock_redis_client):
                with patch("src.core.redis.settings") as mock_settings:
                    mock_settings.redis_url = "redis://localhost:6379/0"
                    mock_settings.health_check_redis_timeout = 3.0

                    with patch("src.core.redis.logger"):
                        await init_redis()

                        # Verify pool was created with correct parameters
                        mock_pool_factory.assert_called_once()
                        call_kwargs = mock_pool_factory.call_args[1]
                        assert call_kwargs["max_connections"] == 10
                        assert call_kwargs["decode_responses"] is True


# ============================================================================
# close_redis() Tests
# ============================================================================


class TestCloseRedis:
    """Tests for close_redis function."""

    @pytest.mark.asyncio
    async def test_close_redis_success(self, mock_connection_pool, mock_redis_client):
        """Test successful Redis close."""
        import src.core.redis as redis_module
        from src.core.redis import close_redis, get_redis

        # Set up initialized state
        redis_module._redis_client = mock_redis_client
        redis_module._connection_pool = mock_connection_pool

        with patch("src.core.redis.logger"):
            await close_redis()

            # Verify close was called
            mock_redis_client.close.assert_awaited_once()
            mock_connection_pool.disconnect.assert_awaited_once()

            # Verify globals are reset
            assert get_redis() is None

    @pytest.mark.asyncio
    async def test_close_redis_when_not_initialized(self):
        """Test close_redis when not initialized."""
        from src.core.redis import close_redis, get_redis

        # Should not raise any error
        await close_redis()

        assert get_redis() is None

    @pytest.mark.asyncio
    async def test_close_redis_handles_close_exception(
        self, mock_connection_pool, mock_redis_client
    ):
        """Test close_redis handles exception during close."""
        import src.core.redis as redis_module
        from src.core.redis import close_redis, get_redis

        redis_module._redis_client = mock_redis_client
        redis_module._connection_pool = mock_connection_pool

        mock_redis_client.close = AsyncMock(side_effect=Exception("Close failed"))

        with patch("src.core.redis.logger") as mock_logger:
            await close_redis()

            # Error should be logged
            mock_logger.error.assert_called()

            # Globals should still be reset
            assert get_redis() is None

    @pytest.mark.asyncio
    async def test_close_redis_disconnects_pool(self, mock_connection_pool, mock_redis_client):
        """Test that close_redis disconnects the connection pool."""
        import src.core.redis as redis_module
        from src.core.redis import close_redis

        redis_module._redis_client = mock_redis_client
        redis_module._connection_pool = mock_connection_pool

        with patch("src.core.redis.logger"):
            await close_redis()

            mock_connection_pool.disconnect.assert_awaited_once()


# ============================================================================
# get_redis() Tests
# ============================================================================


class TestGetRedis:
    """Tests for get_redis function."""

    def test_get_redis_returns_client_when_initialized(self, mock_redis_client):
        """Test get_redis returns client when initialized."""
        import src.core.redis as redis_module
        from src.core.redis import get_redis

        redis_module._redis_client = mock_redis_client

        result = get_redis()
        assert result == mock_redis_client

    def test_get_redis_returns_none_when_not_initialized(self):
        """Test get_redis returns None when not initialized."""
        from src.core.redis import get_redis

        result = get_redis()
        assert result is None


# ============================================================================
# check_redis_health() Tests
# ============================================================================


class TestCheckRedisHealth:
    """Tests for check_redis_health function."""

    @pytest.mark.asyncio
    async def test_check_redis_health_not_initialized(self):
        """Test health check when Redis is not initialized."""
        from src.core.redis import check_redis_health

        is_healthy, latency_ms, message = await check_redis_health()

        assert is_healthy is False
        assert latency_ms == 0.0
        assert "not initialized" in message.lower()

    @pytest.mark.asyncio
    async def test_check_redis_health_success_with_latency(self, mock_redis_client):
        """Test successful health check returns latency."""
        import src.core.redis as redis_module
        from src.core.redis import check_redis_health

        redis_module._redis_client = mock_redis_client

        is_healthy, latency_ms, message = await check_redis_health()

        assert is_healthy is True
        assert latency_ms >= 0
        assert "PONG" in message

    @pytest.mark.asyncio
    async def test_check_redis_health_timeout(self, mock_redis_client):
        """Test health check with timeout."""
        import src.core.redis as redis_module
        from src.core.redis import check_redis_health

        async def slow_ping():
            await asyncio.sleep(10)
            return True

        mock_redis_client.ping = slow_ping
        redis_module._redis_client = mock_redis_client

        is_healthy, latency_ms, message = await check_redis_health(timeout=0.01)

        assert is_healthy is False
        assert latency_ms == 0.0
        assert "timeout" in message.lower()

    @pytest.mark.asyncio
    async def test_check_redis_health_connection_error(self, mock_redis_client):
        """Test health check with connection error."""
        import src.core.redis as redis_module
        from src.core.redis import check_redis_health

        mock_redis_client.ping = AsyncMock(side_effect=RedisConnectionError("Connection refused"))
        redis_module._redis_client = mock_redis_client

        is_healthy, latency_ms, message = await check_redis_health()

        assert is_healthy is False
        assert latency_ms == 0.0
        assert "connection error" in message.lower()

    @pytest.mark.asyncio
    async def test_check_redis_health_timeout_error(self, mock_redis_client):
        """Test health check with Redis timeout error."""
        import src.core.redis as redis_module
        from src.core.redis import check_redis_health

        mock_redis_client.ping = AsyncMock(side_effect=RedisTimeoutError("Operation timed out"))
        redis_module._redis_client = mock_redis_client

        is_healthy, latency_ms, message = await check_redis_health()

        assert is_healthy is False
        assert latency_ms == 0.0
        assert "timeout" in message.lower()

    @pytest.mark.asyncio
    async def test_check_redis_health_unexpected_error(self, mock_redis_client):
        """Test health check with unexpected error."""
        import src.core.redis as redis_module
        from src.core.redis import check_redis_health

        mock_redis_client.ping = AsyncMock(side_effect=Exception("Unknown error"))
        redis_module._redis_client = mock_redis_client

        is_healthy, latency_ms, message = await check_redis_health()

        assert is_healthy is False
        assert latency_ms == 0.0
        assert "unexpected error" in message.lower()

    @pytest.mark.asyncio
    async def test_check_redis_health_uses_custom_timeout(self, mock_redis_client):
        """Test health check uses custom timeout."""
        import src.core.redis as redis_module
        from src.core.redis import check_redis_health

        redis_module._redis_client = mock_redis_client

        # Should complete successfully with longer timeout
        is_healthy, _, _ = await check_redis_health(timeout=10.0)
        assert is_healthy is True


# ============================================================================
# Edge Cases Tests
# ============================================================================


class TestRedisEdgeCases:
    """Tests for edge cases in Redis module."""

    @pytest.mark.asyncio
    async def test_multiple_init_calls_only_first_succeeds(
        self, mock_connection_pool, mock_redis_client
    ):
        """Test that only the first init_redis call initializes the client."""
        from src.core.redis import get_redis, init_redis

        with patch("src.core.redis.ConnectionPool.from_url", return_value=mock_connection_pool):
            with patch("src.core.redis.Redis", return_value=mock_redis_client):
                with patch("src.core.redis.logger"):
                    await init_redis()
                    first_client = get_redis()

                    # Second call should not reinitialize
                    second_mock_client = AsyncMock()
                    with patch("src.core.redis.Redis", return_value=second_mock_client):
                        await init_redis()

                    # Should still be the first client
                    assert get_redis() == first_client

    @pytest.mark.asyncio
    async def test_close_then_init_works(self, mock_connection_pool, mock_redis_client):
        """Test that init works after close."""
        import src.core.redis as redis_module
        from src.core.redis import close_redis, get_redis, init_redis

        # First initialize
        redis_module._redis_client = mock_redis_client
        redis_module._connection_pool = mock_connection_pool

        with patch("src.core.redis.logger"):
            await close_redis()
            assert get_redis() is None

        # Then reinitialize
        new_client = AsyncMock()
        new_client.ping = AsyncMock(return_value=True)

        with patch("src.core.redis.ConnectionPool.from_url", return_value=mock_connection_pool):
            with patch("src.core.redis.Redis", return_value=new_client):
                with patch("src.core.redis.logger"):
                    await init_redis()
                    assert get_redis() == new_client
