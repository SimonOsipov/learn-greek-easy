# -*- coding: utf-8 -*-
"""Integration tests for Redis cache layer.

These tests verify that the CacheService integrates correctly with a real
Redis instance. They test actual Redis operations including caching,
TTL expiry, pattern-based deletion, and domain invalidation.

Note: These tests require a running Redis instance (via Docker or local).
If Redis is not available, tests will be skipped.
"""

import asyncio
from datetime import datetime
from uuid import uuid4

import pytest

from src.core.cache import CacheService, get_cache, reset_cache
from src.core.redis import close_redis, get_redis, init_redis


@pytest.fixture
async def redis_client():
    """Provide a Redis client for integration tests.

    Returns None if Redis is not available, allowing tests to be skipped.
    """
    try:
        await init_redis()
        client = get_redis()
        if client:
            # Test connection
            await client.ping()
            yield client
        else:
            yield None
    except Exception:
        yield None
    finally:
        await close_redis()


@pytest.fixture
async def cache_service(redis_client):
    """Provide a CacheService instance for integration tests."""
    if redis_client is None:
        yield None
    else:
        service = CacheService(redis_client=redis_client)
        yield service
        # Cleanup: delete all cache keys created during test
        await service.delete_pattern("*")


class TestCacheIntegration:
    """Integration tests for CacheService with real Redis operations."""

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_cache_roundtrip(self, cache_service):
        """Test set and get operations work correctly."""
        if cache_service is None:
            pytest.skip("Redis not available")

        test_key = f"test:roundtrip:{uuid4()}"
        test_data = {
            "name": "Test Cache Entry",
            "count": 42,
            "active": True,
            "items": ["a", "b", "c"],
        }

        # Set value
        set_result = await cache_service.set(test_key, test_data, ttl=60)
        assert set_result is True

        # Get value
        get_result = await cache_service.get(test_key)
        assert get_result is not None
        assert get_result == test_data

        # Cleanup
        await cache_service.delete(test_key)

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_cache_ttl_expiry(self, cache_service):
        """Test that cached values expire after TTL."""
        if cache_service is None:
            pytest.skip("Redis not available")

        test_key = f"test:ttl:{uuid4()}"
        test_data = {"ephemeral": True}

        # Set with very short TTL (1 second)
        await cache_service.set(test_key, test_data, ttl=1)

        # Value should exist immediately
        result = await cache_service.get(test_key)
        assert result == test_data

        # Wait for TTL to expire
        await asyncio.sleep(1.5)

        # Value should be gone
        result = await cache_service.get(test_key)
        assert result is None

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_delete_specific_key(self, cache_service):
        """Test deletion of a specific cache key."""
        if cache_service is None:
            pytest.skip("Redis not available")

        test_key = f"test:delete:{uuid4()}"
        test_data = {"to_delete": True}

        # Create entry
        await cache_service.set(test_key, test_data, ttl=60)

        # Verify it exists
        assert await cache_service.exists(test_key) is True

        # Delete it
        delete_result = await cache_service.delete(test_key)
        assert delete_result is True

        # Verify it's gone
        assert await cache_service.exists(test_key) is False
        assert await cache_service.get(test_key) is None

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_delete_pattern(self, cache_service):
        """Test pattern-based deletion of multiple keys."""
        if cache_service is None:
            pytest.skip("Redis not available")

        test_prefix = f"test:pattern:{uuid4()}"

        # Create multiple entries with same prefix
        for i in range(5):
            key = f"{test_prefix}:item:{i}"
            await cache_service.set(key, {"index": i}, ttl=60)

        # Verify all exist
        for i in range(5):
            key = f"{test_prefix}:item:{i}"
            assert await cache_service.exists(key) is True

        # Delete by pattern
        deleted = await cache_service.delete_pattern(f"{test_prefix}:*")
        assert deleted == 5

        # Verify all are gone
        for i in range(5):
            key = f"{test_prefix}:item:{i}"
            assert await cache_service.exists(key) is False

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_get_or_set_pattern(self, cache_service):
        """Test cache-aside pattern with get_or_set."""
        if cache_service is None:
            pytest.skip("Redis not available")

        test_key = f"test:get_or_set:{uuid4()}"
        factory_call_count = 0

        async def factory():
            nonlocal factory_call_count
            factory_call_count += 1
            return {"computed": True, "timestamp": datetime.utcnow().isoformat()}

        # First call - should call factory
        result1 = await cache_service.get_or_set(test_key, factory, ttl=60)
        assert result1 is not None
        assert result1["computed"] is True
        assert factory_call_count == 1

        # Second call - should return cached value
        result2 = await cache_service.get_or_set(test_key, factory, ttl=60)
        assert result2 == result1
        assert factory_call_count == 1  # Factory not called again

        # Cleanup
        await cache_service.delete(test_key)

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_invalidate_deck(self, cache_service):
        """Test deck cache invalidation."""
        if cache_service is None:
            pytest.skip("Redis not available")

        deck_id = uuid4()

        # Create deck-related cache entries
        await cache_service.set(f"deck:{deck_id}", {"name": "Test Deck"}, ttl=60)
        await cache_service.set(f"cards:deck:{deck_id}:page1", [1, 2, 3], ttl=60)
        await cache_service.set("decks:list:public", [{"id": str(deck_id)}], ttl=60)

        # Verify entries exist
        assert await cache_service.exists(f"deck:{deck_id}") is True
        assert await cache_service.exists(f"cards:deck:{deck_id}:page1") is True
        assert await cache_service.exists("decks:list:public") is True

        # Invalidate deck
        deleted = await cache_service.invalidate_deck(deck_id)

        # Verify entries are cleared
        assert await cache_service.exists(f"deck:{deck_id}") is False
        assert await cache_service.exists(f"cards:deck:{deck_id}:page1") is False
        assert await cache_service.exists("decks:list:public") is False
        assert deleted >= 1

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_invalidate_user_progress(self, cache_service):
        """Test user progress cache invalidation."""
        if cache_service is None:
            pytest.skip("Redis not available")

        user_id = uuid4()
        deck_id = uuid4()

        # Create user progress-related cache entries
        await cache_service.set(
            f"progress:user:{user_id}:deck:{deck_id}",
            {"cards_studied": 10},
            ttl=60,
        )
        await cache_service.set(
            f"due_cards:user:{user_id}",
            [{"id": 1}, {"id": 2}],
            ttl=60,
        )
        await cache_service.set(
            f"stats:user:{user_id}",
            {"total_cards": 100},
            ttl=60,
        )

        # Verify entries exist
        assert await cache_service.exists(f"progress:user:{user_id}:deck:{deck_id}") is True
        assert await cache_service.exists(f"due_cards:user:{user_id}") is True
        assert await cache_service.exists(f"stats:user:{user_id}") is True

        # Invalidate user progress for specific deck
        await cache_service.invalidate_user_progress(user_id, deck_id)

        # Verify targeted entries are cleared
        assert await cache_service.exists(f"progress:user:{user_id}:deck:{deck_id}") is False
        assert await cache_service.exists(f"due_cards:user:{user_id}") is False
        assert await cache_service.exists(f"stats:user:{user_id}") is False

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_cache_handles_complex_data(self, cache_service):
        """Test caching of complex nested data structures."""
        if cache_service is None:
            pytest.skip("Redis not available")

        test_key = f"test:complex:{uuid4()}"
        complex_data = {
            "id": str(uuid4()),
            "name": "Complex Object",
            "nested": {
                "level1": {
                    "level2": {"value": 42, "items": [1, 2, 3]},
                },
            },
            "array_of_objects": [
                {"id": 1, "name": "First"},
                {"id": 2, "name": "Second"},
            ],
            "metadata": {
                "created_at": datetime.utcnow().isoformat(),
                "tags": ["tag1", "tag2", "tag3"],
                "nullable_field": None,
            },
        }

        # Set complex data
        await cache_service.set(test_key, complex_data, ttl=60)

        # Retrieve and verify
        result = await cache_service.get(test_key)
        assert result is not None
        assert result["name"] == "Complex Object"
        assert result["nested"]["level1"]["level2"]["value"] == 42
        assert len(result["array_of_objects"]) == 2
        assert result["metadata"]["tags"] == ["tag1", "tag2", "tag3"]
        assert result["metadata"]["nullable_field"] is None

        # Cleanup
        await cache_service.delete(test_key)

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_cache_with_uuid_values(self, cache_service):
        """Test that UUIDs are properly serialized and deserialized."""
        if cache_service is None:
            pytest.skip("Redis not available")

        test_key = f"test:uuid:{uuid4()}"
        test_uuid = uuid4()
        data_with_uuid = {
            "id": test_uuid,  # UUID object, should be serialized as string
            "name": "Test",
        }

        # Set data with UUID
        await cache_service.set(test_key, data_with_uuid, ttl=60)

        # Retrieve - UUID will be a string after JSON round-trip
        result = await cache_service.get(test_key)
        assert result is not None
        assert result["id"] == str(test_uuid)
        assert result["name"] == "Test"

        # Cleanup
        await cache_service.delete(test_key)

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_cache_miss_returns_none(self, cache_service):
        """Test that getting a non-existent key returns None."""
        if cache_service is None:
            pytest.skip("Redis not available")

        nonexistent_key = f"test:nonexistent:{uuid4()}"
        result = await cache_service.get(nonexistent_key)
        assert result is None

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_exists_for_existing_and_missing_keys(self, cache_service):
        """Test exists method for both existing and missing keys."""
        if cache_service is None:
            pytest.skip("Redis not available")

        test_key = f"test:exists:{uuid4()}"
        nonexistent_key = f"test:nonexistent:{uuid4()}"

        # Create a key
        await cache_service.set(test_key, {"exists": True}, ttl=60)

        # Check existing key
        assert await cache_service.exists(test_key) is True

        # Check non-existing key
        assert await cache_service.exists(nonexistent_key) is False

        # Cleanup
        await cache_service.delete(test_key)


class TestGlobalCacheIntegration:
    """Integration tests for global cache instance."""

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_global_cache_with_redis(self, redis_client):
        """Test that global cache works with Redis available."""
        if redis_client is None:
            pytest.skip("Redis not available")

        # Reset to ensure fresh instance
        reset_cache()

        # Get global cache
        cache = get_cache()
        assert cache is not None
        assert cache.enabled is True

        # Use global cache
        test_key = f"test:global:{uuid4()}"
        await cache.set(test_key, {"global": True}, ttl=60)
        result = await cache.get(test_key)
        assert result == {"global": True}

        # Cleanup
        await cache.delete(test_key)
        reset_cache()
