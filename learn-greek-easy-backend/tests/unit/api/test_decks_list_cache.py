"""RED tests for list_decks read-through caching (PERF-05-03).

Calls the list_decks endpoint function DIRECTLY (no HTTP test client / DB).
The executor will add `from src.core.cache import get_cache` and cache logic
to src/api/v1/decks.py.  Pre-impl, get_cache is not imported in that module
so we use create=True on the patch; the RED condition is that setex is not
called (miss/key tests) or repo is called more than once (hit tests).
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.api.v1.decks import list_decks
from src.core.cache import CacheService
from src.db.models import DeckLevel
from src.schemas.deck import DeckListResponse

# =============================================================================
# Helpers
# =============================================================================


def _make_mock_db():
    db = MagicMock()
    return db


def _make_mock_user():
    user = MagicMock()
    user.id = uuid4()
    return user


def _make_real_cache(mock_redis) -> CacheService:
    return CacheService(redis_client=mock_redis)


def _make_cache_settings_patch():
    mock_settings = MagicMock()
    mock_settings.cache_enabled = True
    mock_settings.cache_key_prefix = "cache"
    mock_settings.cache_default_ttl = 300
    mock_settings.cache_deck_list_ttl = 300
    return patch("src.core.cache.settings", mock_settings)


def _make_empty_deck_list_response(page: int = 1, page_size: int = 20) -> DeckListResponse:
    return DeckListResponse(total=0, page=page, page_size=page_size, decks=[])


def _wire_repo_empty(mock_repo_cls):
    """Wire DeckRepository mock to return empty results."""
    mock_repo = mock_repo_cls.return_value
    mock_repo.list_active = AsyncMock(return_value=[])
    mock_repo.count_active = AsyncMock(return_value=0)
    mock_repo.get_batch_card_counts = AsyncMock(return_value={})
    return mock_repo


# =============================================================================
# PERF-05-03: list_decks read-through cache tests (RED)
# =============================================================================


@pytest.mark.unit
class TestListDecksCacheRed:
    """RED tests: caching not yet wired in src/api/v1/decks.py."""

    async def test_list_decks_miss_computes_and_stores(self):
        """Cache miss: result stored at cache:decks:list:en:all:1:20 (TTL=300).

        RED: setex call_count == 0 (cache not wired).
        """
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None  # force cache miss

        real_cache = _make_real_cache(mock_redis)
        db = _make_mock_db()
        user = _make_mock_user()

        with (
            _make_cache_settings_patch(),
            patch(
                "src.api.v1.decks.get_cache",
                return_value=real_cache,
                create=True,
            ),
            patch("src.api.v1.decks.DeckRepository") as mock_repo_cls,
            patch(
                "src.api.v1.decks.get_s3_service",
                return_value=MagicMock(generate_presigned_url=MagicMock(return_value=None)),
            ),
            patch(
                "src.api.v1.decks.get_localized_deck_content",
                return_value=("name", "desc"),
            ),
            # Suppress background task cache-invalidation calls
            patch("src.api.v1.decks.invalidate_cache_task", MagicMock()),
        ):
            _wire_repo_empty(mock_repo_cls)
            result = await list_decks(
                page=1,
                page_size=20,
                level=None,
                locale="en",
                db=db,
                current_user=user,
            )

        assert isinstance(result, DeckListResponse)

        expected_key = "cache:decks:list:en:all:1:20"
        # RED: setex never called pre-impl → call_count == 0, assertion fails
        assert mock_redis.setex.call_count == 1, (
            f"Expected setex called once with key {expected_key!r}, "
            f"but call_count={mock_redis.setex.call_count}"
        )
        actual_key, actual_ttl, _payload = mock_redis.setex.call_args[0]
        assert actual_key == expected_key, f"Wrong cache key: {actual_key!r}"
        assert actual_ttl == 300, f"Wrong TTL: {actual_ttl}"

    async def test_list_decks_hit_skips_repo_fanout(self):
        """Cache hit: repo.list_active must not be called a second time.

        RED: list_active call_count == 2 pre-impl (called per invocation).
        """
        cached_response = _make_empty_deck_list_response()
        cached_dict = cached_response.model_dump(mode="json")

        mock_get_or_set = AsyncMock(return_value=cached_dict)
        mock_cache = MagicMock()
        mock_cache.get_or_set = mock_get_or_set

        db = _make_mock_db()
        user = _make_mock_user()

        with (
            patch(
                "src.api.v1.decks.get_cache",
                return_value=mock_cache,
                create=True,
            ),
            patch("src.api.v1.decks.DeckRepository") as mock_repo_cls,
            patch(
                "src.api.v1.decks.get_s3_service",
                return_value=MagicMock(generate_presigned_url=MagicMock(return_value=None)),
            ),
            patch(
                "src.api.v1.decks.get_localized_deck_content",
                return_value=("name", "desc"),
            ),
            patch("src.api.v1.decks.invalidate_cache_task", MagicMock()),
        ):
            mock_repo = _wire_repo_empty(mock_repo_cls)
            # Call twice; second should be a cache hit → list_active not called again
            await list_decks(
                page=1, page_size=20, level=None, locale="en", db=db, current_user=user
            )
            await list_decks(
                page=1, page_size=20, level=None, locale="en", db=db, current_user=user
            )

        # RED: 2 calls pre-impl (no caching); post-impl must be 1 (or 0 if factory-lazy)
        assert mock_repo.list_active.call_count == 0, (
            "Expected list_active skipped on cache hit, "
            f"got {mock_repo.list_active.call_count} call(s)"
        )

    async def test_list_decks_recomputes_when_cache_none(self):
        """None-guard: get_or_set→None must fall back to direct compute.

        RED: if none-guard missing, model_validate(None) raises TypeError post-impl.
        Pre-impl (no cache): function computes normally regardless → passes as green.
        Regression guard: verifies list_active IS called (direct compute ran).
        """
        mock_get_or_set = AsyncMock(return_value=None)
        mock_cache = MagicMock()
        mock_cache.get_or_set = mock_get_or_set

        db = _make_mock_db()
        user = _make_mock_user()

        with (
            patch(
                "src.api.v1.decks.get_cache",
                return_value=mock_cache,
                create=True,
            ),
            patch("src.api.v1.decks.DeckRepository") as mock_repo_cls,
            patch(
                "src.api.v1.decks.get_s3_service",
                return_value=MagicMock(generate_presigned_url=MagicMock(return_value=None)),
            ),
            patch(
                "src.api.v1.decks.get_localized_deck_content",
                return_value=("name", "desc"),
            ),
            patch("src.api.v1.decks.invalidate_cache_task", MagicMock()),
        ):
            mock_repo = _wire_repo_empty(mock_repo_cls)
            result = await list_decks(
                page=1, page_size=20, level=None, locale="en", db=db, current_user=user
            )

        # Must return valid DeckListResponse (no exception)
        assert isinstance(result, DeckListResponse)
        # Repo must be called (direct compute path executed)
        assert mock_repo.list_active.call_count >= 1

    async def test_list_decks_key_includes_locale_level_page_size(self):
        """Cache key encodes locale, level, page, page_size correctly.

        Asserts:
        - level=DeckLevel.A1, locale="ru", page=2, page_size=5
            → key contains 'decks:list:ru:A1:2:5'
        - level=None, locale="ru"
            → key contains 'decks:list:ru:all:...'
        - No collision between the two keys

        RED: setex not called pre-impl → assertion on call_count fails.
        """
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None  # cache miss always

        real_cache = _make_real_cache(mock_redis)
        db = _make_mock_db()
        user = _make_mock_user()

        with (
            _make_cache_settings_patch(),
            patch(
                "src.api.v1.decks.get_cache",
                return_value=real_cache,
                create=True,
            ),
            patch("src.api.v1.decks.DeckRepository") as mock_repo_cls,
            patch(
                "src.api.v1.decks.get_s3_service",
                return_value=MagicMock(generate_presigned_url=MagicMock(return_value=None)),
            ),
            patch(
                "src.api.v1.decks.get_localized_deck_content",
                return_value=("name", "desc"),
            ),
            patch("src.api.v1.decks.invalidate_cache_task", MagicMock()),
        ):
            _wire_repo_empty(mock_repo_cls)

            # Call 1: level=A1, locale=ru, page=2, page_size=5
            await list_decks(
                page=2,
                page_size=5,
                level=DeckLevel.A1,
                locale="ru",
                db=db,
                current_user=user,
            )
            # Call 2: level=None (→ "all"), locale=ru, page=1, page_size=20
            await list_decks(
                page=1,
                page_size=20,
                level=None,
                locale="ru",
                db=db,
                current_user=user,
            )

        setex_calls = mock_redis.setex.call_args_list
        # RED: 0 calls pre-impl
        assert len(setex_calls) == 2, f"Expected 2 setex calls, got {len(setex_calls)}"
        keys = [call[0][0] for call in setex_calls]

        assert any(
            "decks:list:ru:A1:2:5" in k for k in keys
        ), f"Expected key with 'decks:list:ru:A1:2:5', got: {keys}"
        assert any(
            "decks:list:ru:all:" in k for k in keys
        ), f"Expected key with 'decks:list:ru:all:', got: {keys}"
        # The two keys must be distinct (level=A1 vs level=None must not collide)
        assert keys[0] != keys[1], f"Expected distinct keys, got: {keys}"


# =============================================================================
# PERF-05-06 Gap 2 — list_decks: factory-raises / None-guard surfaces real error (AC#4)
# =============================================================================


@pytest.mark.unit
class TestListDecksNoneGuardSurfacesRealError:
    """PERF-05-06 plan item 2 / AC#4 — list_decks variant.

    For list_decks, _compute() is a local inner function so it cannot be
    patched directly.  Instead, we patch DeckRepository.list_active with
    side_effect=RuntimeError so that BOTH calls to _compute (the factory
    invocation inside get_or_set AND the None-guard recompute) raise the
    same error.

    Flow:
    1. mock_redis.get.return_value = None  →  cache miss  →  get_or_set calls factory
    2. factory calls _compute() which calls repo.list_active  →  raises RuntimeError
    3. get_or_set catches and returns None
    4. None-guard recomputes: _compute() called directly  →  raises RuntimeError again
    5. RuntimeError propagates to the caller — NOT a pydantic.ValidationError
    """

    async def test_list_decks_surfaces_db_error_not_validation_error(self):
        """RuntimeError from DeckRepository.list_active propagates through None-guard.

        Strategy: real CacheService(redis_client=mock_redis) so the full
        get_or_set path executes.  DeckRepository.list_active raises RuntimeError
        on every call, so both the factory and the None-guard recompute raise,
        and the original error type propagates.
        """
        import pydantic

        mock_redis = AsyncMock()
        mock_redis.get.return_value = None  # force miss → get_or_set calls factory

        real_cache = _make_real_cache(mock_redis)
        db = _make_mock_db()
        user = _make_mock_user()

        with (
            _make_cache_settings_patch(),
            patch(
                "src.api.v1.decks.get_cache",
                return_value=real_cache,
                create=True,
            ),
            patch("src.api.v1.decks.DeckRepository") as mock_repo_cls,
            patch(
                "src.api.v1.decks.get_s3_service",
                return_value=MagicMock(generate_presigned_url=MagicMock(return_value=None)),
            ),
            patch(
                "src.api.v1.decks.get_localized_deck_content",
                return_value=("name", "desc"),
            ),
            patch("src.api.v1.decks.invalidate_cache_task", MagicMock()),
        ):
            # Make list_active raise on every call (both factory + None-guard recompute)
            mock_repo_cls.return_value.list_active = AsyncMock(
                side_effect=RuntimeError("simulated DB failure")
            )

            with pytest.raises(RuntimeError, match="simulated DB failure") as exc_info:
                await list_decks(
                    page=1,
                    page_size=20,
                    level=None,
                    locale="en",
                    db=db,
                    current_user=user,
                )

        # Must NOT be wrapped in a pydantic ValidationError
        assert not isinstance(
            exc_info.value, pydantic.ValidationError
        ), "None-guard must surface the original RuntimeError, not wrap it in ValidationError"
