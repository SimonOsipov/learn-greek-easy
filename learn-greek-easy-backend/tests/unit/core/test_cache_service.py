# -*- coding: utf-8 -*-
"""Unit tests for CacheService (Redis-based caching layer)."""

import asyncio
import json
import time
from typing import Any, Dict
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.core.cache import CacheService, cached, get_cache, reset_cache


class TestCacheServiceAvailability:
    """Test suite for cache availability checks."""

    def test_enabled_returns_true_when_cache_enabled_and_redis_available(self):
        """Test that enabled returns True when caching is on and Redis exists."""
        mock_redis = MagicMock()
        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            service = CacheService(redis_client=mock_redis)
            assert service.enabled is True

    def test_enabled_returns_false_when_cache_disabled(self):
        """Test that enabled returns False when caching is disabled in settings."""
        mock_redis = MagicMock()
        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = False
            service = CacheService(redis_client=mock_redis)
            assert service.enabled is False

    def test_enabled_returns_false_when_redis_unavailable(self):
        """Test that enabled returns False when Redis client is None."""
        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            service = CacheService(redis_client=None)
            with patch("src.core.cache.get_redis", return_value=None):
                assert service.enabled is False

    def test_redis_property_uses_injected_client(self):
        """Test that redis property returns the injected client."""
        mock_redis = MagicMock()
        service = CacheService(redis_client=mock_redis)
        assert service.redis is mock_redis

    def test_redis_property_falls_back_to_global_client(self):
        """Test that redis property uses global client when none injected."""
        mock_global_redis = MagicMock()
        service = CacheService(redis_client=None)
        with patch("src.core.cache.get_redis", return_value=mock_global_redis):
            assert service.redis is mock_global_redis


class TestCacheServiceKeyBuilding:
    """Test suite for cache key construction."""

    def test_build_key_format(self):
        """Test that cache key is built correctly with prefix."""
        mock_redis = MagicMock()
        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            key = service._build_key("deck:abc123")
            assert key == "cache:deck:abc123"

    def test_build_key_custom_prefix(self):
        """Test that cache key uses custom prefix from settings."""
        mock_redis = MagicMock()
        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_key_prefix = "myapp:cache"
            service = CacheService(redis_client=mock_redis)

            key = service._build_key("user:123")
            assert key == "myapp:cache:user:123"


class TestCacheGet:
    """Test suite for cache get operation."""

    @pytest.mark.asyncio
    async def test_get_returns_cached_value(self):
        """Test successful cache retrieval."""
        mock_redis = AsyncMock()
        cached_data = {"name": "Test Deck", "cards_count": 42}
        mock_redis.get.return_value = json.dumps(cached_data)

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            result = await service.get("deck:abc123")

        assert result == cached_data
        mock_redis.get.assert_called_once_with("cache:deck:abc123")

    @pytest.mark.asyncio
    async def test_get_returns_none_on_cache_miss(self):
        """Test get returns None when key doesn't exist."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            result = await service.get("nonexistent:key")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_returns_none_when_cache_disabled(self):
        """Test get returns None when caching is disabled."""
        mock_redis = AsyncMock()

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = False
            service = CacheService(redis_client=mock_redis)

            result = await service.get("some:key")

        assert result is None
        mock_redis.get.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_returns_none_when_redis_unavailable(self):
        """Test get returns None when Redis is unavailable."""
        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            service = CacheService(redis_client=None)

            with patch("src.core.cache.get_redis", return_value=None):
                result = await service.get("some:key")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_handles_redis_error_gracefully(self):
        """Test get returns None when Redis raises an error."""
        mock_redis = AsyncMock()
        mock_redis.get.side_effect = Exception("Redis connection error")

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            result = await service.get("error:key")

        assert result is None


class TestCacheSet:
    """Test suite for cache set operation."""

    @pytest.mark.asyncio
    async def test_set_stores_value_with_custom_ttl(self):
        """Test set stores value with specified TTL."""
        mock_redis = AsyncMock()

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            service = CacheService(redis_client=mock_redis)

            data = {"name": "Test"}
            result = await service.set("test:key", data, ttl=600)

        assert result is True
        mock_redis.setex.assert_called_once()
        call_args = mock_redis.setex.call_args
        assert call_args[0][0] == "cache:test:key"
        assert call_args[0][1] == 600
        assert json.loads(call_args[0][2]) == data

    @pytest.mark.asyncio
    async def test_set_uses_default_ttl_when_not_specified(self):
        """Test set uses default TTL from settings when none provided."""
        mock_redis = AsyncMock()

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            service = CacheService(redis_client=mock_redis)

            await service.set("test:key", {"data": "value"})

        call_args = mock_redis.setex.call_args
        assert call_args[0][1] == 300  # default TTL

    @pytest.mark.asyncio
    async def test_set_serializes_uuid_correctly(self):
        """Test that UUIDs are serialized as strings."""
        mock_redis = AsyncMock()
        test_uuid = uuid4()

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            service = CacheService(redis_client=mock_redis)

            data = {"id": test_uuid, "name": "Test"}
            await service.set("test:key", data)

        call_args = mock_redis.setex.call_args
        stored_data = json.loads(call_args[0][2])
        assert stored_data["id"] == str(test_uuid)

    @pytest.mark.asyncio
    async def test_set_returns_false_when_cache_disabled(self):
        """Test set returns False when caching is disabled."""
        mock_redis = AsyncMock()

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = False
            service = CacheService(redis_client=mock_redis)

            result = await service.set("test:key", {"data": "value"})

        assert result is False
        mock_redis.setex.assert_not_called()

    @pytest.mark.asyncio
    async def test_set_handles_redis_error_gracefully(self):
        """Test set returns False when Redis raises an error."""
        mock_redis = AsyncMock()
        mock_redis.setex.side_effect = Exception("Redis connection error")

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            service = CacheService(redis_client=mock_redis)

            result = await service.set("error:key", {"data": "value"})

        assert result is False


class TestCacheDelete:
    """Test suite for cache delete operation."""

    @pytest.mark.asyncio
    async def test_delete_success(self):
        """Test successful cache key deletion."""
        mock_redis = AsyncMock()

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            result = await service.delete("test:key")

        assert result is True
        mock_redis.delete.assert_called_once_with("cache:test:key")

    @pytest.mark.asyncio
    async def test_delete_returns_false_when_cache_disabled(self):
        """Test delete returns False when caching is disabled."""
        mock_redis = AsyncMock()

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = False
            service = CacheService(redis_client=mock_redis)

            result = await service.delete("test:key")

        assert result is False
        mock_redis.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_handles_redis_error_gracefully(self):
        """Test delete returns False when Redis raises an error."""
        mock_redis = AsyncMock()
        mock_redis.delete.side_effect = Exception("Redis error")

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            result = await service.delete("error:key")

        assert result is False


class TestCacheDeletePattern:
    """Test suite for cache delete_pattern operation."""

    @pytest.mark.asyncio
    async def test_delete_pattern_deletes_matching_keys(self):
        """Test pattern-based deletion finds and deletes matching keys."""
        mock_redis = AsyncMock()
        # Simulate SCAN returning matching keys
        mock_redis.scan.return_value = (0, ["cache:deck:1", "cache:deck:2"])

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            result = await service.delete_pattern("deck:*")

        assert result == 2
        mock_redis.scan.assert_called()
        mock_redis.delete.assert_called_once_with("cache:deck:1", "cache:deck:2")

    @pytest.mark.asyncio
    async def test_delete_pattern_handles_multiple_scan_iterations(self):
        """Test pattern deletion handles SCAN pagination."""
        mock_redis = AsyncMock()
        # Simulate SCAN returning keys across multiple iterations
        mock_redis.scan.side_effect = [
            (100, ["cache:deck:1", "cache:deck:2"]),  # First iteration
            (0, ["cache:deck:3"]),  # Final iteration
        ]

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            result = await service.delete_pattern("deck:*")

        assert result == 3
        assert mock_redis.delete.call_count == 2

    @pytest.mark.asyncio
    async def test_delete_pattern_returns_zero_when_no_matches(self):
        """Test delete_pattern returns 0 when no keys match."""
        mock_redis = AsyncMock()
        mock_redis.scan.return_value = (0, [])

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            result = await service.delete_pattern("nonexistent:*")

        assert result == 0
        mock_redis.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_pattern_returns_zero_when_cache_disabled(self):
        """Test delete_pattern returns 0 when caching is disabled."""
        mock_redis = AsyncMock()

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = False
            service = CacheService(redis_client=mock_redis)

            result = await service.delete_pattern("test:*")

        assert result == 0
        mock_redis.scan.assert_not_called()


class TestCacheGetOrSet:
    """Test suite for cache get_or_set (cache-aside pattern)."""

    @pytest.mark.asyncio
    async def test_get_or_set_returns_cached_value(self):
        """Test get_or_set returns cached value without calling factory."""
        mock_redis = AsyncMock()
        cached_data = {"name": "Cached Value"}
        mock_redis.get.return_value = json.dumps(cached_data)

        async def factory():
            return {"name": "Factory Value"}

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            result = await service.get_or_set("test:key", factory)

        assert result == cached_data
        mock_redis.setex.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_or_set_calls_factory_on_cache_miss(self):
        """Test get_or_set calls factory and caches result on miss."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None
        factory_data = {"name": "Factory Value"}

        async def factory():
            return factory_data

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            service = CacheService(redis_client=mock_redis)

            result = await service.get_or_set("test:key", factory)

        assert result == factory_data
        mock_redis.setex.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_or_set_respects_custom_ttl(self):
        """Test get_or_set uses provided TTL for caching."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None

        async def factory():
            return {"data": "value"}

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            service = CacheService(redis_client=mock_redis)

            await service.get_or_set("test:key", factory, ttl=600)

        call_args = mock_redis.setex.call_args
        assert call_args[0][1] == 600

    @pytest.mark.asyncio
    async def test_get_or_set_does_not_cache_none(self):
        """Test get_or_set does not cache None values from factory."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None

        async def factory():
            return None

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            result = await service.get_or_set("test:key", factory)

        assert result is None
        mock_redis.setex.assert_not_called()


class _FakeAsyncRedis:
    """Minimal dict-backed async fake Redis with REAL SET-NX semantics.

    PERF-16-01: dedup tests need genuine "only one caller wins" contention
    across concurrently-scheduled coroutines. `AsyncMock` can't model that --
    it just returns a canned value on every call regardless of prior state --
    so this tiny fake tracks actual key presence for `get`/`set(nx=...)`/
    `setex`/`delete`, matching the subset of the redis-asyncio client
    `CacheService` touches.
    """

    def __init__(self) -> None:
        self.store: Dict[str, Any] = {}

    async def get(self, name: str) -> Any:
        return self.store.get(name)

    async def set(
        self,
        name: str,
        value: Any,
        *,
        nx: bool = False,
        px: Any = None,
        ex: Any = None,
        **kwargs: Any,
    ) -> Any:
        if nx and name in self.store:
            return None
        self.store[name] = value
        return True

    async def setex(self, name: str, ttl: int, value: Any) -> bool:
        self.store[name] = value
        return True

    async def delete(self, *names: str) -> int:
        count = 0
        for name in names:
            if name in self.store:
                del self.store[name]
                count += 1
        return count


class TestCacheGetOrSetSingleFlight:
    """PERF-16-01: single-flight `SET NX PX` guard for `get_or_set`.

    `get_or_set` currently has no dedup -- every concurrent caller on a cold
    key runs its own factory. These specs pin the target behavior: only one
    caller ("the leader") computes the value while it holds a Redis lock;
    everyone else ("followers") either observes the leader's result or, if
    the leader stalls past the lock TTL, falls through and computes their
    own value. All of them are RED against the current implementation.
    """

    @pytest.mark.asyncio
    async def test_get_or_set_single_flight_single_loader(self):
        """N concurrent cold misses on the same key run the factory exactly once."""
        fake_redis = _FakeAsyncRedis()
        call_count = 0

        async def factory():
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.05)
            return {"value": "computed"}

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            mock_settings.cache_single_flight_lock_ttl_ms = 5000
            mock_settings.cache_single_flight_poll_ms = 50
            service = CacheService(redis_client=fake_redis)

            results = await asyncio.wait_for(
                asyncio.gather(*[service.get_or_set("sf:key", factory, ttl=30) for _ in range(5)]),
                timeout=10,
            )

        assert call_count == 1, (
            f"expected the factory to run exactly once across 5 concurrent "
            f"cold callers, but it ran {call_count} times"
        )
        assert results == [{"value": "computed"}] * 5

    @pytest.mark.asyncio
    async def test_get_or_set_follower_returns_leader_value(self):
        """A follower that loses the lock race returns the leader's value
        once it appears in the cache -- it must never run its own factory."""
        mock_redis = AsyncMock()
        leader_value = {"value": "from_leader"}
        # 1st call: get_or_set's initial cache check (miss). 2nd call: first
        # poll while the leader is still computing (miss). 3rd call: the
        # leader has finished and published its value.
        mock_redis.get.side_effect = [None, None, json.dumps(leader_value)]
        mock_redis.set.return_value = None  # lock already held by the leader

        async def follower_factory():
            raise AssertionError(
                "follower factory must not run when the leader's value becomes available"
            )

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            mock_settings.cache_single_flight_lock_ttl_ms = 5000
            mock_settings.cache_single_flight_poll_ms = 10
            service = CacheService(redis_client=mock_redis)

            result = await asyncio.wait_for(
                service.get_or_set("follower:key", follower_factory, ttl=30),
                timeout=5,
            )

        assert result == leader_value, (
            f"expected the follower to return the leader's published value "
            f"{leader_value!r}, got {result!r}"
        )
        mock_redis.set.assert_called()  # a lock acquisition was attempted

    @pytest.mark.asyncio
    async def test_get_or_set_follower_falls_through_on_stall(self):
        """If the lock is contended and the leader's value never appears
        before lock_ttl elapses, the follower gives up waiting and computes
        its own value instead of hanging forever."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None  # value never appears (leader stalled)
        mock_redis.set.return_value = None  # lock always contended

        call_count = 0

        async def own_factory():
            nonlocal call_count
            call_count += 1
            return {"value": "fallback"}

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            mock_settings.cache_single_flight_lock_ttl_ms = 100
            mock_settings.cache_single_flight_poll_ms = 10
            service = CacheService(redis_client=mock_redis)

            result = await asyncio.wait_for(
                service.get_or_set("stall:key", own_factory, ttl=30),
                timeout=5,
            )

        assert result == {"value": "fallback"}
        assert call_count == 1, (
            f"expected the stalled follower's own factory to run exactly "
            f"once, ran {call_count} times"
        )
        assert mock_redis.set.called, (
            "expected the follower to have attempted a SET NX lock acquisition "
            "before falling through to its own factory"
        )

    @pytest.mark.asyncio
    async def test_get_or_set_degrades_when_redis_none(self):
        """With no Redis available at all, get_or_set must still degrade
        gracefully: run the factory once and return its value, without
        attempting any lock acquisition (there's nothing to lock against)."""
        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            mock_settings.cache_single_flight_lock_ttl_ms = 5000
            mock_settings.cache_single_flight_poll_ms = 50
            service = CacheService(redis_client=None)

            call_count = 0

            async def factory():
                nonlocal call_count
                call_count += 1
                return {"value": "no_redis"}

            with patch("src.core.cache.get_redis", return_value=None):
                result = await service.get_or_set("noredis:key", factory, ttl=30)

        assert call_count == 1
        assert result == {"value": "no_redis"}

    @pytest.mark.asyncio
    async def test_get_or_set_releases_lock_on_factory_error(self):
        """If the leader's factory raises, the lock it acquired must be
        released (deleted) in a finally block -- not leaked until PX expiry."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None  # cold cache
        mock_redis.set.return_value = True  # lock acquired, no contention

        async def failing_factory():
            raise RuntimeError("boom")

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            mock_settings.cache_single_flight_lock_ttl_ms = 5000
            mock_settings.cache_single_flight_poll_ms = 50
            service = CacheService(redis_client=mock_redis)

            result = await service.get_or_set("errkey:lock", failing_factory, ttl=30)

        assert result is None

        assert mock_redis.delete.called, (
            "expected the single-flight lock key to be released via "
            "redis.delete after the factory raised"
        )
        deleted_keys = [key for call in mock_redis.delete.call_args_list for key in call.args]
        assert any("errkey:lock" in k and k.startswith("cache:") for k in deleted_keys), (
            f"expected a lock key derived from 'errkey:lock' under the "
            f"'cache:' prefix to be deleted, got: {deleted_keys}"
        )

    @pytest.mark.asyncio
    async def test_get_or_set_hit_skips_lock(self):
        """A cache hit returns immediately -- no lock is ever attempted and
        the factory never runs."""
        mock_redis = AsyncMock()
        cached_value = {"name": "Already Cached"}
        mock_redis.get.return_value = json.dumps(cached_value)

        async def factory():
            raise AssertionError("factory should not run on a cache hit")

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            mock_settings.cache_single_flight_lock_ttl_ms = 5000
            mock_settings.cache_single_flight_poll_ms = 50
            service = CacheService(redis_client=mock_redis)

            result = await service.get_or_set("hit:key", factory, ttl=30)

        assert result == cached_value
        mock_redis.set.assert_not_called()


class TestCacheGetOrSetSingleFlightAdversarial:
    """QA (PERF-16-01): adversarial/edge coverage beyond the architect's
    RED specs in TestCacheGetOrSetSingleFlight -- sync factories, a
    lock-backend outage on acquisition, a legitimately-None leader result,
    and follower poll latency (must return promptly, not after the full
    lock TTL budget).
    """

    @pytest.mark.asyncio
    async def test_get_or_set_single_flight_sync_factory(self):
        """A plain sync (non-coroutine) factory must work through the
        leader path exactly like an async factory: get_or_set supports
        both via asyncio.iscoroutine, and the single-flight lock wraps
        either kind transparently."""
        fake_redis = _FakeAsyncRedis()
        call_count = 0

        def sync_factory() -> Dict[str, str]:
            nonlocal call_count
            call_count += 1
            return {"value": "sync_computed"}

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            mock_settings.cache_single_flight_lock_ttl_ms = 5000
            mock_settings.cache_single_flight_poll_ms = 50
            service = CacheService(redis_client=fake_redis)

            result = await asyncio.wait_for(
                service.get_or_set("sync:key", sync_factory, ttl=30), timeout=5
            )

        assert result == {"value": "sync_computed"}
        assert call_count == 1
        # Leader path must have cached the sync result under the real key
        # (not the lock key) via setex.
        assert fake_redis.store.get("cache:sync:key") == json.dumps({"value": "sync_computed"})
        # Lock must be released, not leaked until PX expiry.
        assert "cache:sync:key:lock" not in fake_redis.store

    @pytest.mark.asyncio
    async def test_get_or_set_lock_acquisition_error_falls_through_to_leader(self):
        """If the lock backend itself errors on SET NX (e.g. a Redis blip),
        get_or_set must degrade to leader behavior -- run the factory once
        and return/cache its value -- rather than propagating the error or
        silently returning None."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None  # cold cache
        mock_redis.set.side_effect = Exception("connection reset")

        call_count = 0

        async def factory():
            nonlocal call_count
            call_count += 1
            return {"value": "degraded_leader"}

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            mock_settings.cache_single_flight_lock_ttl_ms = 5000
            mock_settings.cache_single_flight_poll_ms = 50
            service = CacheService(redis_client=mock_redis)

            result = await asyncio.wait_for(
                service.get_or_set("lockerr:key", factory, ttl=30), timeout=5
            )

        assert result == {"value": "degraded_leader"}
        assert call_count == 1
        mock_redis.setex.assert_called_once()
        # Lock release is still attempted in finally even though the lock
        # was never really held (harmless no-op against a real backend).
        assert mock_redis.delete.called

    @pytest.mark.asyncio
    async def test_get_or_set_leader_none_result_no_hang_no_permanent_dogpile(self):
        """A factory that legitimately returns None must not be cached (per
        existing get_or_set contract), and the lock must still be released.
        A concurrent follower must NOT hang or spin forever waiting for a
        value that will never appear -- it must fall through to self-serve
        once the (short, test-tuned) lock TTL budget elapses, bounded and
        deterministic, not a permanent deadlock."""
        fake_redis = _FakeAsyncRedis()
        call_count = 0

        async def none_factory():
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.01)
            return None

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            mock_settings.cache_single_flight_lock_ttl_ms = 60
            mock_settings.cache_single_flight_poll_ms = 10
            service = CacheService(redis_client=fake_redis)

            results = await asyncio.wait_for(
                asyncio.gather(
                    service.get_or_set("none:key", none_factory, ttl=30),
                    service.get_or_set("none:key", none_factory, ttl=30),
                ),
                timeout=5,  # generous bound -- proves it terminates, not a hang
            )

        # Both callers resolve to None -- no crash, no hang.
        assert results == [None, None]
        # Nothing was ever cached for a None result.
        assert "cache:none:key" not in fake_redis.store
        # The lock is released, not leaked.
        assert "cache:none:key:lock" not in fake_redis.store
        # NOTE (known design tradeoff, not a hang/leak): because a None
        # result is indistinguishable from "not computed yet" in the cache,
        # the follower cannot short-circuit on the leader's (None) result --
        # it still waits out the poll budget and self-serves, so the
        # factory runs twice here (once per caller) rather than once. This
        # is bounded by lock_ttl_ms per follower, never unbounded.
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_get_or_set_follower_returns_promptly_not_after_full_budget(self):
        """A follower must return as soon as the leader's value appears in
        the cache, not after waiting out the entire lock_ttl_ms budget --
        i.e. the poll loop must actually observe the value on an early
        iteration rather than always draining the full window."""
        fake_redis = _FakeAsyncRedis()
        leader_started = asyncio.Event()

        async def leader_factory():
            leader_started.set()
            await asyncio.sleep(0.03)  # leader takes ~30ms
            return {"value": "prompt_leader"}

        async def follower_factory():
            raise AssertionError(
                "follower must observe the leader's value and must not "
                "self-serve after only ~30ms against a 5s lock_ttl_ms budget"
            )

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            # Lock TTL budget is generous (5s); poll is fine-grained (10ms).
            # If the follower correctly observes the leader's value shortly
            # after ~30ms, the test finishes in well under a second. If it
            # were (incorrectly) waiting out the full budget, this would
            # take ~5s and trip the tight wait_for below.
            mock_settings.cache_single_flight_lock_ttl_ms = 5000
            mock_settings.cache_single_flight_poll_ms = 10
            service = CacheService(redis_client=fake_redis)

            start = time.monotonic()
            leader_task = asyncio.ensure_future(
                service.get_or_set("prompt:key", leader_factory, ttl=30)
            )
            await leader_started.wait()
            follower_task = asyncio.ensure_future(
                service.get_or_set("prompt:key", follower_factory, ttl=30)
            )

            results = await asyncio.wait_for(asyncio.gather(leader_task, follower_task), timeout=2)
            elapsed = time.monotonic() - start

        assert results == [{"value": "prompt_leader"}, {"value": "prompt_leader"}]
        assert elapsed < 1.0, (
            f"expected the follower to return promptly after the leader "
            f"published (~30ms), but the call took {elapsed:.3f}s -- "
            f"suggests it drained the full lock_ttl_ms budget instead of "
            f"observing the value on an early poll"
        )


class TestCacheExists:
    """Test suite for cache exists operation."""

    @pytest.mark.asyncio
    async def test_exists_returns_true_when_key_exists(self):
        """Test exists returns True when key is in cache."""
        mock_redis = AsyncMock()
        mock_redis.exists.return_value = 1

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            result = await service.exists("test:key")

        assert result is True
        mock_redis.exists.assert_called_once_with("cache:test:key")

    @pytest.mark.asyncio
    async def test_exists_returns_false_when_key_not_found(self):
        """Test exists returns False when key is not in cache."""
        mock_redis = AsyncMock()
        mock_redis.exists.return_value = 0

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            result = await service.exists("nonexistent:key")

        assert result is False

    @pytest.mark.asyncio
    async def test_exists_returns_false_when_cache_disabled(self):
        """Test exists returns False when caching is disabled."""
        mock_redis = AsyncMock()

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = False
            service = CacheService(redis_client=mock_redis)

            result = await service.exists("test:key")

        assert result is False
        mock_redis.exists.assert_not_called()


class TestCacheInvalidation:
    """Test suite for domain-specific cache invalidation."""

    @pytest.mark.asyncio
    async def test_invalidate_deck_deletes_related_cache_entries(self):
        """Test invalidate_deck clears deck and related caches."""
        mock_redis = AsyncMock()
        deck_id = uuid4()

        # Mock scan to return empty for patterns
        mock_redis.scan.return_value = (0, [])

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            await service.invalidate_deck(deck_id)

        # Should have deleted specific deck key
        mock_redis.delete.assert_called()
        # Check that scan was called for pattern deletions
        assert mock_redis.scan.call_count >= 1

    @pytest.mark.asyncio
    async def test_invalidate_card_deletes_deck_related_caches(self):
        """Test invalidate_card clears cards and deck caches."""
        mock_redis = AsyncMock()
        card_id = uuid4()
        deck_id = uuid4()

        mock_redis.scan.return_value = (0, [])

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            await service.invalidate_card(card_id, deck_id)

        # Should have called delete for deck detail
        mock_redis.delete.assert_called()
        # Should have scanned for cards pattern
        mock_redis.scan.assert_called()

    @pytest.mark.asyncio
    async def test_invalidate_user_progress_with_specific_deck(self):
        """Test invalidate_user_progress with specific deck clears targeted cache."""
        mock_redis = AsyncMock()
        user_id = uuid4()
        deck_id = uuid4()

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            await service.invalidate_user_progress(user_id, deck_id)

        # Should delete specific progress, due cards, and stats
        assert mock_redis.delete.call_count >= 2

    @pytest.mark.asyncio
    async def test_invalidate_user_progress_without_deck(self):
        """Test invalidate_user_progress without deck clears all user progress."""
        mock_redis = AsyncMock()
        user_id = uuid4()

        mock_redis.scan.return_value = (0, [])

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            await service.invalidate_user_progress(user_id)

        # Should scan for all progress keys
        mock_redis.scan.assert_called()
        # Should delete due cards and stats
        mock_redis.delete.assert_called()


class TestCacheInvalidateUserIdentity:
    """PERF-16-02: CacheService.invalidate_user_identity is the single choke
    point every identity-mutating write path (webhook, delete_account,
    update_me, delete_avatar, billing plan changes, repo.deactivate) calls to
    bust the supabase_id->identity projection and the user:me:{uid} entry.

    Necessary because the identity TTL was raised from 20s to 900s (PERF-16-02):
    a stale identity/is_active projection can now live for up to 15 minutes
    unless explicitly busted on every mutation.

    RED reason: CacheService has no invalidate_user_identity method yet --
    calling it raises AttributeError. Per PERF-16-02 RED discipline this is an
    acceptable not-implemented red (matches the documented seam problem: the
    method must exist before any assertion on its call args can even run).
    """

    @pytest.mark.asyncio
    async def test_invalidate_user_identity_deletes_both_keys(self):
        """delete() is called for both cache:user:identity:{sub} and cache:user:me:{uid}."""
        mock_redis = AsyncMock()
        supabase_id = "sb-abc-123"
        user_id = uuid4()

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            service = CacheService(redis_client=mock_redis)

            await service.invalidate_user_identity(supabase_id, user_id)

        deleted_keys = [call.args[0] for call in mock_redis.delete.call_args_list]
        assert (
            f"cache:user:identity:{supabase_id}" in deleted_keys
        ), f"Expected identity key deleted, got: {deleted_keys}"
        assert (
            f"cache:user:me:{user_id}" in deleted_keys
        ), f"Expected user:me key deleted, got: {deleted_keys}"

    @pytest.mark.asyncio
    async def test_invalidate_user_identity_noop_redis_down(self):
        """When Redis is unavailable, invalidate_user_identity must not raise."""
        supabase_id = "sb-abc-123"
        user_id = uuid4()

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            service = CacheService(redis_client=None)

            with patch("src.core.cache.get_redis", return_value=None):
                # Must degrade gracefully -- no exception, no delete attempted.
                await service.invalidate_user_identity(supabase_id, user_id)


class TestCacheInvalidationSweepsDashboardSummary:
    """PERF-15-04: the dashboard-summary cache key must live under the
    progress:user:{uid}:* namespace so invalidate_user_progress() sweeps it
    automatically after any review/progress-changing action -- no bespoke
    invalidation call needed for the new endpoint.

    NOTE: this test doesn't touch src/api/v1/dashboard.py at all -- it
    proves the namespacing convention (progress:user:{uid}:dashboard_summary)
    against the ALREADY-implemented CacheService.invalidate_user_progress().
    It is expected to be GREEN already; it exists to lock in the key format
    PERF-15-04's real endpoint must follow for automatic invalidation to work.
    """

    @pytest.mark.asyncio
    async def test_summary_key_swept_by_invalidate_user_progress(self):
        """A progress:user:{uid}:dashboard_summary key falls inside the
        glob pattern invalidate_user_progress() sweeps, and is actually
        deleted when that method runs against a redis holding it.
        """
        import fnmatch

        user_id = uuid4()
        prefix = "cache"
        summary_key = f"progress:user:{user_id}:dashboard_summary"
        full_summary_key = f"{prefix}:{summary_key}"
        sweep_pattern = f"{prefix}:progress:user:{user_id}:*"

        # 1. Namespacing proof: the dashboard-summary key matches the glob
        #    pattern invalidate_user_progress() sweeps.
        assert fnmatch.fnmatchcase(full_summary_key, sweep_pattern), (
            f"Expected {full_summary_key!r} to match sweep pattern {sweep_pattern!r} "
            "-- dashboard_summary must live under progress:user:{uid}:*"
        )

        # 2. Behavioral proof: a redis holding that exact key gets it deleted
        #    when invalidate_user_progress(user_id) runs (SCAN returns it once).
        mock_redis = AsyncMock()
        mock_redis.scan.side_effect = [(0, [full_summary_key])]

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = prefix
            service = CacheService(redis_client=mock_redis)

            await service.invalidate_user_progress(user_id)

        deleted_keys = [key for call in mock_redis.delete.call_args_list for key in call.args]
        assert full_summary_key in deleted_keys, (
            f"Expected {full_summary_key!r} to be deleted by invalidate_user_progress, "
            f"got deletes: {deleted_keys}"
        )


class TestCachedDecorator:
    """Test suite for @cached decorator."""

    @pytest.mark.asyncio
    async def test_cached_decorator_returns_cached_value(self):
        """Test that decorator returns cached value without calling function."""
        call_count = 0

        @cached("test_func")
        async def expensive_function(arg1: str) -> dict:
            nonlocal call_count
            call_count += 1
            return {"result": arg1}

        mock_redis = AsyncMock()
        cached_data = {"result": "cached"}
        mock_redis.get.return_value = json.dumps(cached_data)

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            with patch("src.core.cache.get_cache") as mock_get_cache:
                mock_cache = CacheService(redis_client=mock_redis)
                mock_get_cache.return_value = mock_cache

                result = await expensive_function("test")

        assert result == cached_data
        assert call_count == 0

    @pytest.mark.asyncio
    async def test_cached_decorator_calls_function_on_miss(self):
        """Test that decorator calls function and caches result on miss."""
        call_count = 0

        @cached("test_func")
        async def expensive_function(arg1: str) -> dict:
            nonlocal call_count
            call_count += 1
            return {"result": arg1}

        mock_redis = AsyncMock()
        mock_redis.get.return_value = None

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            with patch("src.core.cache.get_cache") as mock_get_cache:
                mock_cache = CacheService(redis_client=mock_redis)
                mock_get_cache.return_value = mock_cache

                result = await expensive_function("test")

        assert result == {"result": "test"}
        assert call_count == 1
        mock_redis.setex.assert_called_once()

    @pytest.mark.asyncio
    async def test_cached_decorator_with_custom_ttl(self):
        """Test that decorator uses custom TTL when provided."""

        @cached("test_func", ttl=600)
        async def expensive_function() -> dict:
            return {"data": "value"}

        mock_redis = AsyncMock()
        mock_redis.get.return_value = None

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            with patch("src.core.cache.get_cache") as mock_get_cache:
                mock_cache = CacheService(redis_client=mock_redis)
                mock_get_cache.return_value = mock_cache

                await expensive_function()

        call_args = mock_redis.setex.call_args
        assert call_args[0][1] == 600

    @pytest.mark.asyncio
    async def test_cached_decorator_with_custom_key_builder(self):
        """Test that decorator uses custom key builder when provided."""

        @cached("search", key_builder=lambda q, page=1: f"{q}:page{page}")
        async def search(query: str, page: int = 1) -> list:
            return [{"result": query, "page": page}]

        mock_redis = AsyncMock()
        mock_redis.get.return_value = None

        with patch("src.core.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_key_prefix = "cache"
            mock_settings.cache_default_ttl = 300
            with patch("src.core.cache.get_cache") as mock_get_cache:
                mock_cache = CacheService(redis_client=mock_redis)
                mock_get_cache.return_value = mock_cache

                await search("python", page=2)

        # Verify the key was built using custom builder
        mock_redis.get.assert_called_once_with("cache:search:python:page2")


class TestGlobalCacheInstance:
    """Test suite for global cache instance management."""

    def test_get_cache_returns_singleton(self):
        """Test that get_cache returns the same instance."""
        reset_cache()  # Start fresh

        with patch("src.core.cache.get_redis", return_value=MagicMock()):
            cache1 = get_cache()
            cache2 = get_cache()

        assert cache1 is cache2
        reset_cache()

    def test_reset_cache_clears_instance(self):
        """Test that reset_cache clears the global instance."""
        with patch("src.core.cache.get_redis", return_value=MagicMock()):
            cache1 = get_cache()
            reset_cache()
            cache2 = get_cache()

        assert cache1 is not cache2
        reset_cache()

    def test_get_cache_creates_new_instance_if_none(self):
        """Test that get_cache creates a new instance if none exists."""
        reset_cache()

        with patch("src.core.cache.get_redis", return_value=MagicMock()):
            cache = get_cache()

        assert cache is not None
        assert isinstance(cache, CacheService)
        reset_cache()
