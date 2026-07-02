"""RED tests for GET /api/v1/dashboard/summary read-through caching (PERF-15-04).

Mirrors tests/unit/api/test_decks_list_cache.py: calls the endpoint function
DIRECTLY (no HTTP test client / DB) with mocked db/current_user, patching
`src.api.v1.dashboard.get_cache` (the stub module imports get_cache
specifically so this patch target exists -- see its module docstring).

Pre-implementation, the STUB (src/api/v1/dashboard.py) never touches the
cache and never calls DashboardSummaryService.build() -- it just returns a
hardcoded placeholder dict. RED condition: setex is never called (miss/key
test), and the returned value is never a real DashboardSummaryResponse (hit
/ none-fallback tests), because none of that wiring exists yet.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.api.v1.dashboard import get_dashboard_summary
from src.core.cache import CacheService
from src.schemas.dashboard import DashboardSummaryResponse, StreakSummary, TodaySummary, WeekHeat

# =============================================================================
# Helpers
# =============================================================================


def _make_mock_db():
    return MagicMock()


def _make_mock_user(user_id=None):
    user = MagicMock()
    user.id = user_id or uuid4()
    return user


def _make_real_cache(mock_redis) -> CacheService:
    return CacheService(redis_client=mock_redis)


def _make_cache_settings_patch():
    mock_settings = MagicMock()
    mock_settings.cache_enabled = True
    mock_settings.cache_key_prefix = "cache"
    mock_settings.cache_default_ttl = 300
    mock_settings.cache_user_progress_ttl = 60
    return patch("src.core.cache.settings", mock_settings)


def _make_valid_summary_response() -> DashboardSummaryResponse:
    """A minimal, fully-valid DashboardSummaryResponse (brand-new-user shape)."""
    return DashboardSummaryResponse(
        is_new_user=True,
        mastered=0,
        today=TodaySummary(
            reviews_completed=0,
            cards_due=0,
            daily_goal=20,
            goal_progress_percentage=0.0,
            study_time_seconds=0,
        ),
        streak=StreakSummary(current_streak=0, longest_streak=0),
        week_heat=WeekHeat(heat=[0, 0, 0, 0, 0, 0, 0], today_idx=6),
        decks=[],
        feed=[],
        whats_new_count=0,
        queue_count=0,
    )


# =============================================================================
# PERF-15-04: dashboard summary read-through cache tests (RED)
# =============================================================================


@pytest.mark.unit
class TestDashboardSummaryCacheRed:
    """RED tests: caching + build() not yet wired in src/api/v1/dashboard.py."""

    async def test_summary_cache_miss_sets_key_and_ttl(self):
        """Cache miss: result stored at progress:user:{uid}:dashboard_summary
        (full redis key cache:progress:user:{uid}:dashboard_summary, TTL=60)
        -- matches the existing progress:user:{uid}:dashboard namespacing
        precedent in src/services/progress_service.py.

        RED: setex call_count == 0 (STUB never touches the cache).
        """
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None  # force cache miss

        real_cache = _make_real_cache(mock_redis)
        db = _make_mock_db()
        user_id = uuid4()
        user = _make_mock_user(user_id)

        with (
            _make_cache_settings_patch(),
            patch("src.api.v1.dashboard.get_cache", return_value=real_cache),
            # Fixture fix (PERF-15-04 GREEN pass): db is a bare MagicMock, so
            # the real DashboardSummaryService.build() cannot execute (it
            # issues real SQLAlchemy queries via 6 sub-services); patch it
            # to a valid response, matching the sibling hit/none-fallback
            # tests below. Assertions (setex key/ttl/call_count) unchanged.
            patch(
                "src.services.dashboard_summary_service.DashboardSummaryService.build",
                new_callable=AsyncMock,
                return_value=_make_valid_summary_response(),
            ),
        ):
            await get_dashboard_summary(db=db, current_user=user)

        expected_key = f"cache:progress:user:{user_id}:dashboard_summary"
        # RED: setex never called pre-impl -> call_count == 0, assertion fails
        assert mock_redis.setex.call_count == 1, (
            f"Expected setex called once with key {expected_key!r}, "
            f"but call_count={mock_redis.setex.call_count}"
        )
        actual_key, actual_ttl, _payload = mock_redis.setex.call_args[0]
        assert actual_key == expected_key, f"Wrong cache key: {actual_key!r}"
        assert actual_ttl == 60, f"Wrong TTL: {actual_ttl}"

    async def test_summary_cache_hit_skips_build(self):
        """Cache hit: DashboardSummaryService.build() must not run, and the
        endpoint must return a validated DashboardSummaryResponse built from
        the cached payload.

        RED: the STUB returns a hardcoded dict (not a DashboardSummaryResponse)
        regardless of cache state, so the isinstance check fails.
        """
        cached_dump = _make_valid_summary_response().model_dump(mode="json")
        mock_cache = MagicMock()
        mock_cache.get_or_set = AsyncMock(return_value=cached_dump)

        db = _make_mock_db()
        user = _make_mock_user()

        with (
            patch("src.api.v1.dashboard.get_cache", return_value=mock_cache),
            patch(
                "src.services.dashboard_summary_service.DashboardSummaryService.build",
                new_callable=AsyncMock,
            ) as build_spy,
        ):
            result = await get_dashboard_summary(db=db, current_user=user)

        assert build_spy.call_count == 0, (
            "Expected build() skipped on cache hit, " f"got {build_spy.call_count} call(s)"
        )
        assert isinstance(
            result, DashboardSummaryResponse
        ), f"Expected a validated DashboardSummaryResponse, got {type(result)}: {result!r}"

    async def test_summary_cache_none_falls_back_to_build(self):
        """None-guard: get_or_set -> None must fall back to a direct
        DashboardSummaryService.build() call rather than crashing on
        model_validate(None).

        RED: the STUB never calls build() (it ignores the cache entirely),
        so call_count stays 0 instead of the expected 1.
        """
        mock_cache = MagicMock()
        mock_cache.get_or_set = AsyncMock(return_value=None)

        db = _make_mock_db()
        user = _make_mock_user()
        valid_response = _make_valid_summary_response()

        with (
            patch("src.api.v1.dashboard.get_cache", return_value=mock_cache),
            patch(
                "src.services.dashboard_summary_service.DashboardSummaryService.build",
                new_callable=AsyncMock,
                return_value=valid_response,
            ) as build_spy,
        ):
            result = await get_dashboard_summary(db=db, current_user=user)

        # Must return a valid DashboardSummaryResponse (no exception, no crash).
        assert isinstance(result, DashboardSummaryResponse)
        # RED: build() must have been called once as the direct-compute fallback.
        assert build_spy.call_count == 1, (
            "Expected direct build() fallback when get_or_set returns None, "
            f"got {build_spy.call_count} call(s)"
        )
