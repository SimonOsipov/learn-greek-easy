# -*- coding: utf-8 -*-
"""Unit tests for CacheService (Redis-based caching layer)."""

import json
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
