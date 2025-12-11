"""Unit tests for session_cleanup_task scheduled task."""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from src.config import settings


class TestSessionCleanupTaskImports:
    """Test that session_cleanup_task can be imported correctly."""

    def test_import_from_scheduled_module(self):
        """Test importing session_cleanup_task from scheduled module."""
        from src.tasks.scheduled import session_cleanup_task

        assert callable(session_cleanup_task)

    def test_is_async_function(self):
        """Test that session_cleanup_task is an async function."""
        from src.tasks.scheduled import session_cleanup_task

        assert asyncio.iscoroutinefunction(session_cleanup_task)


class TestSessionCleanupTaskRedisUnavailable:
    """Test session_cleanup_task when Redis is unavailable."""

    @pytest.mark.asyncio
    async def test_handles_redis_unavailable_gracefully(self):
        """Test that task handles Redis unavailability without raising errors."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock):
                    # Simulate Redis not available
                    mock_get_redis.return_value = None

                    with patch("src.tasks.scheduled.logger") as mock_logger:
                        # Should not raise
                        await session_cleanup_task()

                        # Should log warning
                        mock_logger.warning.assert_called_once()
                        warning_call = mock_logger.warning.call_args[0][0]
                        assert "Redis not available" in warning_call


class TestSessionCleanupTaskNoTTLKeys:
    """Test session_cleanup_task handling of keys without TTL."""

    @pytest.mark.asyncio
    async def test_removes_keys_without_ttl(self):
        """Test that keys without TTL (TTL = -1) are deleted."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock):
                    mock_redis = AsyncMock()
                    mock_get_redis.return_value = mock_redis

                    # Mock scan returning one session key, then done
                    mock_redis.scan.side_effect = [
                        (0, ["refresh:user1:token1"]),  # First scan - session keys
                        (0, []),  # Second scan - user_sessions keys
                    ]
                    # Key has no TTL
                    mock_redis.ttl.return_value = -1

                    await session_cleanup_task()

                    # Should delete the key without TTL
                    mock_redis.delete.assert_any_call("refresh:user1:token1")

    @pytest.mark.asyncio
    async def test_does_not_delete_keys_with_ttl(self):
        """Test that keys with valid TTL are not deleted."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock):
                    mock_redis = AsyncMock()
                    mock_get_redis.return_value = mock_redis

                    # Mock scan returning one session key, then done
                    mock_redis.scan.side_effect = [
                        (0, ["refresh:user1:token1"]),  # First scan - session keys
                        (0, []),  # Second scan - user_sessions keys
                    ]
                    # Key has valid TTL (e.g., 3600 seconds)
                    mock_redis.ttl.return_value = 3600

                    await session_cleanup_task()

                    # Should NOT delete the key with valid TTL
                    mock_redis.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_logs_warning_for_keys_without_ttl(self):
        """Test that a warning is logged when a key without TTL is deleted."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock):
                    mock_redis = AsyncMock()
                    mock_get_redis.return_value = mock_redis

                    # Mock scan
                    mock_redis.scan.side_effect = [
                        (0, ["refresh:user1:token1"]),
                        (0, []),
                    ]
                    mock_redis.ttl.return_value = -1

                    with patch("src.tasks.scheduled.logger") as mock_logger:
                        await session_cleanup_task()

                        # Should log warning about the key
                        warning_calls = [
                            call
                            for call in mock_logger.warning.call_args_list
                            if "without TTL" in call[0][0]
                        ]
                        assert len(warning_calls) == 1
                        assert warning_calls[0][1]["extra"]["key"] == "refresh:user1:token1"


class TestSessionCleanupTaskOrphanedReferences:
    """Test session_cleanup_task handling of orphaned session references."""

    @pytest.mark.asyncio
    async def test_removes_orphaned_session_references(self):
        """Test that orphaned session references are removed from user_sessions set."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock):
                    mock_redis = AsyncMock()
                    mock_get_redis.return_value = mock_redis

                    # Mock scan - no session keys, one user_sessions set
                    mock_redis.scan.side_effect = [
                        (0, []),  # session keys scan
                        (0, ["user_sessions:user1"]),  # user_sessions scan
                    ]
                    # Set contains one orphaned token
                    mock_redis.smembers.return_value = {"orphan_token"}
                    # Token doesn't exist (orphaned)
                    mock_redis.exists.return_value = False
                    # After removal, set is empty
                    mock_redis.scard.return_value = 0

                    await session_cleanup_task()

                    # Should remove the orphaned token from the set
                    mock_redis.srem.assert_called_once_with("user_sessions:user1", "orphan_token")

    @pytest.mark.asyncio
    async def test_keeps_valid_session_references(self):
        """Test that valid session references are kept in user_sessions set."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock):
                    mock_redis = AsyncMock()
                    mock_get_redis.return_value = mock_redis

                    # Mock scan
                    mock_redis.scan.side_effect = [
                        (0, []),
                        (0, ["user_sessions:user1"]),
                    ]
                    mock_redis.smembers.return_value = {"token1", "token2"}
                    # Both tokens exist
                    mock_redis.exists.side_effect = [True, True]
                    mock_redis.scard.return_value = 2

                    await session_cleanup_task()

                    # Should NOT remove any tokens
                    mock_redis.srem.assert_not_called()


class TestSessionCleanupTaskEmptySets:
    """Test session_cleanup_task handling of empty user_sessions sets."""

    @pytest.mark.asyncio
    async def test_deletes_empty_user_sessions_sets(self):
        """Test that empty user_sessions sets are deleted."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock):
                    mock_redis = AsyncMock()
                    mock_get_redis.return_value = mock_redis

                    # Mock scan
                    mock_redis.scan.side_effect = [
                        (0, []),  # session keys
                        (0, ["user_sessions:user1"]),  # user_sessions
                    ]
                    # Set contains one orphaned token
                    mock_redis.smembers.return_value = {"token1"}
                    # Token doesn't exist
                    mock_redis.exists.return_value = False
                    # After removal, set is empty
                    mock_redis.scard.return_value = 0

                    await session_cleanup_task()

                    # Should delete the empty set
                    delete_calls = [call for call in mock_redis.delete.call_args_list]
                    delete_keys = [call[0][0] for call in delete_calls]
                    assert "user_sessions:user1" in delete_keys

    @pytest.mark.asyncio
    async def test_keeps_non_empty_user_sessions_sets(self):
        """Test that non-empty user_sessions sets are kept."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock):
                    mock_redis = AsyncMock()
                    mock_get_redis.return_value = mock_redis

                    # Mock scan
                    mock_redis.scan.side_effect = [
                        (0, []),
                        (0, ["user_sessions:user1"]),
                    ]
                    mock_redis.smembers.return_value = {"token1"}
                    # Token exists
                    mock_redis.exists.return_value = True
                    # Set still has 1 member
                    mock_redis.scard.return_value = 1

                    await session_cleanup_task()

                    # Should NOT delete the set (no delete calls)
                    mock_redis.delete.assert_not_called()


class TestSessionCleanupTaskPagination:
    """Test session_cleanup_task pagination using SCAN."""

    @pytest.mark.asyncio
    async def test_uses_scan_with_count_parameter(self):
        """Test that SCAN is called with count parameter for batching."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock):
                    mock_redis = AsyncMock()
                    mock_get_redis.return_value = mock_redis

                    # Mock scan with empty results
                    mock_redis.scan.return_value = (0, [])

                    await session_cleanup_task()

                    # Check scan calls include count=100
                    scan_calls = mock_redis.scan.call_args_list
                    for call in scan_calls:
                        assert call[1]["count"] == 100

    @pytest.mark.asyncio
    async def test_continues_scanning_until_cursor_is_zero(self):
        """Test that SCAN continues until cursor returns to 0."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock):
                    mock_redis = AsyncMock()
                    mock_get_redis.return_value = mock_redis

                    # Mock multiple scan iterations for session keys
                    # First call returns cursor 5, second returns 0
                    # Then for user_sessions, returns 0 immediately
                    mock_redis.scan.side_effect = [
                        (5, ["refresh:user1:token1"]),  # First batch
                        (0, ["refresh:user1:token2"]),  # Second batch, done
                        (0, []),  # user_sessions scan
                    ]
                    # All keys have valid TTL
                    mock_redis.ttl.return_value = 3600

                    await session_cleanup_task()

                    # Should have scanned 2 session keys total
                    assert mock_redis.scan.call_count == 3


class TestSessionCleanupTaskLogging:
    """Test logging behavior of session_cleanup_task."""

    @pytest.mark.asyncio
    async def test_logs_start_message(self):
        """Test that task logs start message."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock):
                    mock_redis = AsyncMock()
                    mock_get_redis.return_value = mock_redis
                    mock_redis.scan.return_value = (0, [])

                    with patch("src.tasks.scheduled.logger") as mock_logger:
                        await session_cleanup_task()

                        # Check start log was called
                        info_calls = [call[0][0] for call in mock_logger.info.call_args_list]
                        assert any("Starting session cleanup task" in msg for msg in info_calls)

    @pytest.mark.asyncio
    async def test_logs_completion_with_metrics(self):
        """Test that task logs completion with all metrics."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock):
                    mock_redis = AsyncMock()
                    mock_get_redis.return_value = mock_redis
                    mock_redis.scan.side_effect = [
                        (0, ["refresh:user1:token1"]),
                        (0, []),
                    ]
                    mock_redis.ttl.return_value = 3600  # Valid TTL

                    with patch("src.tasks.scheduled.logger") as mock_logger:
                        await session_cleanup_task()

                        # Find completion log
                        completion_call = None
                        for call in mock_logger.info.call_args_list:
                            if "Session cleanup complete" in call[0][0]:
                                completion_call = call
                                break

                        assert completion_call is not None
                        extra = completion_call[1]["extra"]
                        assert "scanned_keys" in extra
                        assert "deleted_no_ttl" in extra
                        assert "deleted_orphaned" in extra
                        assert "deleted_empty_sets" in extra
                        assert "duration_ms" in extra

    @pytest.mark.asyncio
    async def test_logs_correct_scanned_keys_count(self):
        """Test that scanned_keys count is accurate."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock):
                    mock_redis = AsyncMock()
                    mock_get_redis.return_value = mock_redis
                    # Two batches of session keys
                    mock_redis.scan.side_effect = [
                        (5, ["refresh:u1:t1", "refresh:u2:t2"]),  # 2 keys
                        (0, ["refresh:u3:t3"]),  # 1 key
                        (0, []),  # user_sessions
                    ]
                    mock_redis.ttl.return_value = 3600

                    with patch("src.tasks.scheduled.logger") as mock_logger:
                        await session_cleanup_task()

                        completion_call = None
                        for call in mock_logger.info.call_args_list:
                            if "Session cleanup complete" in call[0][0]:
                                completion_call = call
                                break

                        assert completion_call[1]["extra"]["scanned_keys"] == 3


class TestSessionCleanupTaskErrorHandling:
    """Test error handling in session_cleanup_task."""

    @pytest.mark.asyncio
    async def test_raises_exception_on_redis_error(self):
        """Test that Redis errors are raised after logging."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock):
                    mock_redis = AsyncMock()
                    mock_get_redis.return_value = mock_redis
                    mock_redis.scan.side_effect = Exception("Redis connection lost")

                    with patch("src.tasks.scheduled.logger") as mock_logger:
                        with pytest.raises(Exception, match="Redis connection lost"):
                            await session_cleanup_task()

                        # Should log error
                        mock_logger.error.assert_called_once()
                        error_call = mock_logger.error.call_args
                        assert "Session cleanup failed" in error_call[0][0]

    @pytest.mark.asyncio
    async def test_closes_redis_on_error(self):
        """Test that Redis connection is closed even after errors."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock) as mock_close:
                    mock_redis = AsyncMock()
                    mock_get_redis.return_value = mock_redis
                    mock_redis.scan.side_effect = Exception("Redis connection lost")

                    with pytest.raises(Exception):
                        await session_cleanup_task()

                    # close_redis should still be called
                    mock_close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_closes_redis_on_success(self):
        """Test that Redis connection is closed after successful execution."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock) as mock_close:
                    mock_redis = AsyncMock()
                    mock_get_redis.return_value = mock_redis
                    mock_redis.scan.return_value = (0, [])

                    await session_cleanup_task()

                    # close_redis should be called
                    mock_close.assert_awaited_once()


class TestSessionCleanupTaskConfiguration:
    """Test configuration usage in session_cleanup_task."""

    def test_uses_session_key_prefix_from_settings(self):
        """Test that session_key_prefix setting is used."""
        assert hasattr(settings, "session_key_prefix")
        assert settings.session_key_prefix == "refresh:"

    @pytest.mark.asyncio
    async def test_scan_uses_correct_key_pattern(self):
        """Test that SCAN uses the correct key pattern from settings."""
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock):
                    mock_redis = AsyncMock()
                    mock_get_redis.return_value = mock_redis
                    mock_redis.scan.return_value = (0, [])

                    await session_cleanup_task()

                    # First scan call should use session_key_prefix
                    first_scan_call = mock_redis.scan.call_args_list[0]
                    assert first_scan_call[1]["match"] == f"{settings.session_key_prefix}*"
