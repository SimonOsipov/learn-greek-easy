# -*- coding: utf-8 -*-
"""Redis-based caching service for application data.

This module provides a caching layer for the application using Redis.
It supports:
- Generic get/set/delete operations with TTL
- Pattern-based key deletion for cache invalidation
- Cache-aside pattern (get_or_set)
- Domain-specific invalidation methods for decks, cards, and user progress
- A @cached decorator for easy method caching

The cache service operates independently from session storage and uses
a separate key prefix to avoid collisions.

NOTE: If Redis is unavailable, all cache operations gracefully degrade
(returning None for gets, False for sets, etc.) without raising exceptions.
"""

import asyncio
import functools
import json
from typing import Any, Awaitable, Callable, Optional, TypeVar, Union, cast
from uuid import UUID

from redis.asyncio import Redis

from src.config import settings
from src.core.logging import get_logger
from src.core.redis import get_redis

logger = get_logger(__name__)

# Type variable for generic return types
T = TypeVar("T")

# Global cache service instance
_cache_service: Optional["CacheService"] = None


class CacheService:
    """Service for caching application data in Redis.

    Redis Key Schema:
        - All keys are prefixed with settings.cache_key_prefix (default: "cache")
        - Key format: {prefix}:{key}

    Examples:
        - Deck list: cache:decks:list:public
        - Deck detail: cache:deck:{deck_id}
        - Cards by deck: cache:cards:deck:{deck_id}
        - User progress: cache:progress:user:{user_id}:deck:{deck_id}
        - Due cards: cache:due_cards:user:{user_id}

    TTL Configuration:
        Different data types have different TTL values configured in settings:
        - cache_default_ttl: 300 seconds (5 minutes)
        - cache_deck_list_ttl: 300 seconds
        - cache_deck_detail_ttl: 600 seconds (10 minutes)
        - cache_cards_by_deck_ttl: 300 seconds
        - cache_user_progress_ttl: 60 seconds (1 minute)
        - cache_due_cards_ttl: 30 seconds
        - cache_user_stats_ttl: 120 seconds (2 minutes)
    """

    def __init__(self, redis_client: Optional[Redis] = None):
        """Initialize the cache service.

        Args:
            redis_client: Optional Redis client. If not provided, uses the
                global Redis client from get_redis().
        """
        self._redis = redis_client

    @property
    def redis(self) -> Optional[Redis]:
        """Get the Redis client, using global client if not set."""
        if self._redis is not None:
            return self._redis
        return get_redis()

    @property
    def enabled(self) -> bool:
        """Check if caching is enabled and Redis is available."""
        return settings.cache_enabled and self.redis is not None

    def _build_key(self, key: str) -> str:
        """Build a full Redis key with the cache prefix.

        Args:
            key: The cache key without prefix

        Returns:
            Full Redis key in format: {prefix}:{key}
        """
        return f"{settings.cache_key_prefix}:{key}"

    async def get(self, key: str) -> Optional[Any]:
        """Get a value from the cache.

        Args:
            key: The cache key (without prefix)

        Returns:
            The cached value deserialized from JSON, or None if not found
            or if caching is disabled/unavailable.
        """
        if not self.enabled:
            logger.debug("Cache disabled or unavailable, returning None for get")
            return None

        try:
            redis = self.redis
            if redis is None:
                return None

            full_key = self._build_key(key)
            data = await redis.get(full_key)

            if data is None:
                logger.debug(f"Cache miss for key: {key}")
                return None

            logger.debug(f"Cache hit for key: {key}")
            return json.loads(data)

        except Exception as e:
            logger.error(f"Failed to get cache key '{key}': {e}")
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
    ) -> bool:
        """Set a value in the cache.

        Args:
            key: The cache key (without prefix)
            value: The value to cache (will be JSON serialized)
            ttl: Time-to-live in seconds. If None, uses cache_default_ttl.

        Returns:
            True if the value was cached successfully, False otherwise.
        """
        if not self.enabled:
            logger.debug("Cache disabled or unavailable, skipping set")
            return False

        try:
            redis = self.redis
            if redis is None:
                return False

            full_key = self._build_key(key)
            ttl_seconds = ttl if ttl is not None else settings.cache_default_ttl

            # Serialize with default=str to handle UUIDs and other non-JSON types
            serialized = json.dumps(value, default=str)
            await redis.setex(full_key, ttl_seconds, serialized)

            logger.debug(f"Cache set for key: {key} (TTL: {ttl_seconds}s)")
            return True

        except Exception as e:
            logger.error(f"Failed to set cache key '{key}': {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Delete a value from the cache.

        Args:
            key: The cache key (without prefix)

        Returns:
            True if the key was deleted (or didn't exist), False on error.
        """
        if not self.enabled:
            return False

        try:
            redis = self.redis
            if redis is None:
                return False

            full_key = self._build_key(key)
            await redis.delete(full_key)

            logger.debug(f"Cache deleted for key: {key}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete cache key '{key}': {e}")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern.

        This is useful for invalidating groups of related cache entries.
        Uses SCAN to avoid blocking Redis with large key sets.

        Args:
            pattern: The key pattern (without prefix). Supports Redis glob patterns.
                    For example: "deck:*" will delete all deck-related keys.

        Returns:
            Number of keys deleted, or 0 on error.
        """
        if not self.enabled:
            return 0

        try:
            redis = self.redis
            if redis is None:
                return 0

            full_pattern = self._build_key(pattern)
            deleted_count = 0

            # Use SCAN to iterate over keys matching the pattern
            cursor = 0
            while True:
                cursor, keys = await redis.scan(
                    cursor=cursor,
                    match=full_pattern,
                    count=100,
                )

                if keys:
                    await redis.delete(*keys)
                    deleted_count += len(keys)

                if cursor == 0:
                    break

            logger.debug(f"Cache pattern delete: {pattern} (deleted {deleted_count} keys)")
            return deleted_count

        except Exception as e:
            logger.error(f"Failed to delete cache pattern '{pattern}': {e}")
            return 0

    async def get_or_set(
        self,
        key: str,
        factory: Callable[[], Union[T, Awaitable[T]]],
        ttl: Optional[int] = None,
    ) -> Optional[Any]:
        """Get a value from cache, or compute and cache it if not found.

        This implements the cache-aside pattern: check cache first, if miss
        call the factory function to compute the value, cache it, and return.

        Args:
            key: The cache key (without prefix)
            factory: An async or sync callable that produces the value if not cached.
            ttl: Time-to-live in seconds. If None, uses cache_default_ttl.

        Returns:
            The cached or computed value, or None if both fail.
        """
        # Try to get from cache first
        cached_value = await self.get(key)
        if cached_value is not None:
            return cached_value

        # Cache miss - compute the value
        try:
            result = factory()
            if asyncio.iscoroutine(result):
                value = await result
            else:
                value = result
            if value is not None:
                await self.set(key, value, ttl)
            return value

        except Exception as e:
            logger.error(f"Failed to compute value for cache key '{key}': {e}")
            return None

    async def exists(self, key: str) -> bool:
        """Check if a key exists in the cache.

        Args:
            key: The cache key (without prefix)

        Returns:
            True if the key exists, False otherwise.
        """
        if not self.enabled:
            return False

        try:
            redis = self.redis
            if redis is None:
                return False

            full_key = self._build_key(key)
            return await redis.exists(full_key) > 0

        except Exception as e:
            logger.error(f"Failed to check cache key existence '{key}': {e}")
            return False

    # =========================================================================
    # Domain-Specific Invalidation Methods
    # =========================================================================

    async def invalidate_deck(self, deck_id: Union[UUID, str]) -> int:
        """Invalidate all cache entries related to a specific deck.

        This should be called when a deck is created, updated, or deleted.

        Args:
            deck_id: The deck's UUID

        Returns:
            Number of cache entries invalidated.
        """
        deck_id_str = str(deck_id)
        deleted = 0

        # Delete specific deck cache
        if await self.delete(f"deck:{deck_id_str}"):
            deleted += 1

        # Delete cards for this deck
        deleted += await self.delete_pattern(f"cards:deck:{deck_id_str}*")

        # Delete deck list caches (they all need to be refreshed)
        deleted += await self.delete_pattern("decks:list:*")

        logger.info(f"Invalidated cache for deck {deck_id_str} ({deleted} entries deleted)")
        return deleted

    async def invalidate_card(
        self,
        card_id: Union[UUID, str],
        deck_id: Union[UUID, str],
    ) -> int:
        """Invalidate cache entries related to a card change.

        This should be called when a card is created, updated, or deleted.

        Args:
            card_id: The card's UUID
            deck_id: The deck's UUID the card belongs to

        Returns:
            Number of cache entries invalidated.
        """
        deck_id_str = str(deck_id)
        deleted = 0

        # Delete cards for this deck
        deleted += await self.delete_pattern(f"cards:deck:{deck_id_str}*")

        # Also invalidate deck detail (card count may have changed)
        if await self.delete(f"deck:{deck_id_str}"):
            deleted += 1

        logger.info(f"Invalidated cache for card in deck {deck_id_str} ({deleted} entries)")
        return deleted

    async def invalidate_user_progress(
        self,
        user_id: Union[UUID, str],
        deck_id: Optional[Union[UUID, str]] = None,
    ) -> int:
        """Invalidate user progress cache entries.

        This should be called when user progress is updated (e.g., after
        reviewing cards, completing sessions).

        Args:
            user_id: The user's UUID
            deck_id: Optional specific deck ID. If None, invalidates all
                    progress for the user.

        Returns:
            Number of cache entries invalidated.
        """
        user_id_str = str(user_id)
        deleted = 0

        if deck_id:
            deck_id_str = str(deck_id)
            # Invalidate specific deck progress
            if await self.delete(f"progress:user:{user_id_str}:deck:{deck_id_str}"):
                deleted += 1
        else:
            # Invalidate all progress for user
            deleted += await self.delete_pattern(f"progress:user:{user_id_str}:*")

        # Always invalidate due cards and user stats
        if await self.delete(f"due_cards:user:{user_id_str}"):
            deleted += 1
        if await self.delete(f"stats:user:{user_id_str}"):
            deleted += 1

        logger.info(f"Invalidated progress cache for user {user_id_str} ({deleted} entries)")
        return deleted

    async def invalidate_all_user_data(self, user_id: Union[UUID, str]) -> int:
        """Clear ALL cache entries for a user, including direct Redis keys.

        This is used when resetting or deleting a user account.
        Unlike invalidate_user_progress() which targets specific progress data,
        this method clears everything associated with the user including
        direct Redis keys that bypass the cache service.

        Args:
            user_id: The user's UUID

        Returns:
            Number of cache entries invalidated.
        """
        user_id_str = str(user_id)
        deleted = 0

        # 1. Clear standard cache keys (reuse existing method)
        deleted += await self.invalidate_user_progress(user_id)

        # 2. Clear direct Redis keys (not through cache prefix)
        # daily_goal_notified uses direct Redis without cache prefix
        try:
            redis = self.redis
            if redis:
                daily_goal_pattern = f"daily_goal_notified:{user_id_str}:*"
                cursor = 0
                while True:
                    cursor, keys = await redis.scan(
                        cursor=cursor, match=daily_goal_pattern, count=100
                    )
                    if keys:
                        await redis.delete(*keys)
                        deleted += len(keys)
                    if cursor == 0:
                        break
        except Exception as e:
            logger.warning(f"Failed to clear daily_goal_notified keys for user {user_id_str}: {e}")

        logger.info(f"Invalidated all cache data for user {user_id_str} ({deleted} entries)")
        return deleted


# =============================================================================
# Global Instance Management
# =============================================================================


def get_cache() -> CacheService:
    """Get the global CacheService instance.

    Returns:
        The global CacheService instance. Creates one if it doesn't exist.
    """
    global _cache_service

    if _cache_service is None:
        _cache_service = CacheService()

    return _cache_service


def reset_cache() -> None:
    """Reset the global CacheService instance.

    This is primarily useful for testing to ensure a fresh instance.
    """
    global _cache_service
    _cache_service = None


# =============================================================================
# Cached Decorator
# =============================================================================


def cached(
    key_prefix: str,
    ttl: Optional[int] = None,
    key_builder: Optional[Callable[..., str]] = None,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorator to cache the result of an async function.

    Usage:
        @cached("user_profile", ttl=300)
        async def get_user_profile(user_id: UUID) -> dict:
            # ... expensive database query
            return profile

        # The cache key will be: cache:user_profile:{user_id}

    Custom key builder:
        @cached("search", key_builder=lambda q, page: f"{q}:{page}")
        async def search(query: str, page: int = 1) -> list:
            # ...

    Args:
        key_prefix: Prefix for the cache key. The full key will be
                   "{key_prefix}:{args}" by default.
        ttl: Time-to-live in seconds. Uses cache_default_ttl if None.
        key_builder: Optional function to build the cache key suffix from
                    the function arguments. If None, uses str representation
                    of all arguments.

    Returns:
        Decorator function.
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            cache = get_cache()

            # Build cache key
            if key_builder:
                key_suffix = key_builder(*args, **kwargs)
            else:
                # Default: combine all args as strings
                all_args = [str(a) for a in args]
                all_args.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
                key_suffix = ":".join(all_args) if all_args else "default"

            cache_key = f"{key_prefix}:{key_suffix}"

            # Try to get from cache
            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                return cached_value

            # Cache miss - call the original function
            result = await func(*args, **kwargs)

            # Cache the result if not None
            if result is not None:
                await cache.set(cache_key, result, ttl)

            return result

        return cast(Callable[..., Any], wrapper)

    return decorator
