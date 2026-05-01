"""Unit tests for src.services.gamification.shadow.

Coverage (8 tests):
1. Flag off → no log emitted, GamificationProjection.compute not called.
2. Flag on, identical state → single gamification.shadow.match event.
3. Flag on, diff present → gamification.shadow.diff with correct sorted fields.
4. Cache hit on second call within 30 s → compute called once; second event cache_hit=True.
5. Cache expires after 30 s → time.monotonic monkeypatched; compute called twice.
6. Cache bounded at 512 entries.
7. Projection raises → gamification.shadow.error emitted; helper returns None.
8. Logger raises inside _run_shadow → no exception escapes the public helper.

loguru capture: uses the project-provided ``caplog_loguru`` fixture so logs
reach pytest's caplog.  Shadow module re-uses the ``get_logger(__name__)``
pattern; the caplog_loguru sink is attached at the DEBUG level.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from src.services.achievement_definitions import AchievementMetric
from src.services.gamification import shadow as shadow_mod
from src.services.gamification.shadow import (
    _clear_cache,
    shadow_compare_achievements,
    shadow_compare_xp_stats,
)
from src.services.gamification.types import GamificationSnapshot, MetricValues
from src.services.gamification.version import GAMIFICATION_PROJECTION_VERSION

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DUMMY_DB: Any = MagicMock()  # shadow never writes; db mock is fine for unit tests


def _make_snapshot(
    user_id: UUID,
    *,
    unlocked: frozenset[str] | None = None,
    total_xp: int = 0,
    current_level: int = 1,
) -> GamificationSnapshot:
    metrics = MetricValues({AchievementMetric.STREAK_DAYS: 0})
    return GamificationSnapshot(
        user_id=user_id,
        metrics=metrics,
        unlocked=unlocked if unlocked is not None else frozenset(),
        total_xp=total_xp,
        current_level=current_level,
        projection_version=GAMIFICATION_PROJECTION_VERSION,
        computed_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Fixture: reset cache between tests
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_cache() -> None:
    """Ensure _cache is empty before and after every test."""
    _clear_cache()
    yield
    _clear_cache()


# ---------------------------------------------------------------------------
# Test 1: flag off
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestFlagOff:
    async def test_flag_off_no_log_no_compute(self, caplog_loguru: Any) -> None:
        """When shadow_mode is False, no log events and compute is not called."""
        user_id = uuid4()

        with (
            patch(
                "src.services.gamification.shadow.settings",
                gamification_shadow_mode=False,
            ),
            patch(
                "src.services.gamification.shadow.GamificationProjection.compute",
                new=AsyncMock(),
            ) as mock_compute,
        ):
            await shadow_compare_xp_stats(
                _DUMMY_DB,
                user_id,
                legacy_total_xp=100,
                legacy_current_level=2,
                endpoint="/xp/stats",
            )

        mock_compute.assert_not_called()
        shadow_records = [
            r for r in caplog_loguru.records if "gamification.shadow" in r.getMessage()
        ]
        assert shadow_records == []


# ---------------------------------------------------------------------------
# Test 2: flag on, identical state → match
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestIdenticalState:
    async def test_identical_state_emits_match(self, caplog_loguru: Any) -> None:
        """When projection matches legacy exactly, gamification.shadow.match is emitted."""
        user_id = uuid4()
        snapshot = _make_snapshot(user_id, unlocked=frozenset(), total_xp=0, current_level=1)

        with (
            patch(
                "src.services.gamification.shadow.settings",
                gamification_shadow_mode=True,
            ),
            patch(
                "src.services.gamification.shadow.GamificationProjection.compute",
                new=AsyncMock(return_value=snapshot),
            ),
        ):
            await shadow_compare_xp_stats(
                _DUMMY_DB,
                user_id,
                legacy_total_xp=0,
                legacy_current_level=1,
                endpoint="/xp/stats",
            )

        shadow_msgs = [r.getMessage() for r in caplog_loguru.records]
        assert "gamification.shadow.match" in shadow_msgs
        assert "gamification.shadow.diff" not in shadow_msgs
        assert "gamification.shadow.error" not in shadow_msgs


# ---------------------------------------------------------------------------
# Test 3: diff present → diff event with correct fields
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestDiffPresent:
    async def test_diff_emits_correct_sorted_fields(self, caplog_loguru: Any) -> None:
        """gamification.shadow.diff is emitted with sorted legacy_only, projection_only."""
        user_id = uuid4()
        snapshot = _make_snapshot(
            user_id,
            unlocked=frozenset({"ach_b", "ach_c"}),
            total_xp=500,
            current_level=3,
        )

        with (
            patch(
                "src.services.gamification.shadow.settings",
                gamification_shadow_mode=True,
            ),
            patch(
                "src.services.gamification.shadow.GamificationProjection.compute",
                new=AsyncMock(return_value=snapshot),
            ),
        ):
            await shadow_compare_achievements(
                _DUMMY_DB,
                user_id,
                legacy_unlocked_ids={"ach_a", "ach_b"},
                endpoint="/xp/achievements",
            )

        diff_records = [
            r for r in caplog_loguru.records if "gamification.shadow.diff" in r.getMessage()
        ]
        assert len(diff_records) == 1

        # caplog records don't carry kwargs; check via the message presence
        assert "gamification.shadow.match" not in [r.getMessage() for r in caplog_loguru.records]

        # Verify sorted fields by calling _run_shadow directly via the patch and
        # inspecting the logger call through a dedicated mock instead.
        _clear_cache()

    async def test_diff_fields_via_logger_mock(self) -> None:
        """Verify log kwargs: sorted legacy_only, sorted projection_only, xp_delta."""
        user_id = uuid4()
        snapshot = _make_snapshot(
            user_id,
            unlocked=frozenset({"ach_b", "ach_c"}),
            total_xp=0,
            current_level=0,
        )

        logged_calls: list[dict] = []

        class _FakeLogger:
            def info(self, msg: str, **kwargs: Any) -> None:
                logged_calls.append({"msg": msg, **kwargs})

            def warning(self, msg: str, **kwargs: Any) -> None:
                logged_calls.append({"msg": msg, **kwargs})

        with (
            patch(
                "src.services.gamification.shadow.settings",
                gamification_shadow_mode=True,
            ),
            patch(
                "src.services.gamification.shadow.GamificationProjection.compute",
                new=AsyncMock(return_value=snapshot),
            ),
            patch("src.services.gamification.shadow.logger", _FakeLogger()),
        ):
            await shadow_compare_achievements(
                _DUMMY_DB,
                user_id,
                legacy_unlocked_ids={"ach_a", "ach_b"},
                endpoint="/xp/achievements",
            )

        assert len(logged_calls) == 1
        call = logged_calls[0]
        assert call["msg"] == "gamification.shadow.diff"
        assert call["legacy_only"] == ["ach_a"]  # sorted
        assert call["projection_only"] == ["ach_c"]  # sorted
        assert call["xp_delta"] == 0  # achievements path: legacy_total_xp=None → emits 0
        assert call["cache_hit"] is False
        assert call["per_metric_mismatches"] == []

    async def test_achievements_match_with_non_zero_projection_xp(self) -> None:
        """Regression: achievements path must not false-diff when snapshot has non-zero XP.

        Guards Issue 1: _run_shadow with legacy_total_xp=None means xp_delta never
        contributes to has_diff, so identical unlock sets → match even with XP>0.
        """
        user_id = uuid4()
        # Non-zero XP and level in projection; legacy unlocked set matches exactly.
        snapshot = _make_snapshot(
            user_id,
            unlocked=frozenset({"ach_a", "ach_b"}),
            total_xp=1500,
            current_level=5,
        )

        logged_calls: list[dict] = []

        class _FakeLogger:
            def info(self, msg: str, **kwargs: Any) -> None:
                logged_calls.append({"msg": msg, **kwargs})

            def warning(self, msg: str, **kwargs: Any) -> None:
                logged_calls.append({"msg": msg, **kwargs})

        with (
            patch(
                "src.services.gamification.shadow.settings",
                gamification_shadow_mode=True,
            ),
            patch(
                "src.services.gamification.shadow.GamificationProjection.compute",
                new=AsyncMock(return_value=snapshot),
            ),
            patch("src.services.gamification.shadow.logger", _FakeLogger()),
        ):
            await shadow_compare_achievements(
                _DUMMY_DB,
                user_id,
                legacy_unlocked_ids={"ach_a", "ach_b"},  # identical to projection
                endpoint="/api/v1/xp/achievements",
            )

        assert len(logged_calls) == 1
        call = logged_calls[0]
        # Must emit match (not diff) even though snapshot.total_xp=1500, current_level=5
        assert call["msg"] == "gamification.shadow.match"


# ---------------------------------------------------------------------------
# Test 4: cache hit within 30 s
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestCacheHit:
    async def test_cache_hit_second_call_uses_cache(self) -> None:
        """Second call within 30 s should reuse cached snapshot; compute called once."""
        user_id = uuid4()
        snapshot = _make_snapshot(user_id, total_xp=0, current_level=1)

        logged_calls: list[dict] = []

        class _FakeLogger:
            def info(self, msg: str, **kwargs: Any) -> None:
                logged_calls.append({"msg": msg, **kwargs})

            def warning(self, msg: str, **kwargs: Any) -> None:
                logged_calls.append({"msg": msg, **kwargs})

        with (
            patch(
                "src.services.gamification.shadow.settings",
                gamification_shadow_mode=True,
            ),
            patch(
                "src.services.gamification.shadow.GamificationProjection.compute",
                new=AsyncMock(return_value=snapshot),
            ) as mock_compute,
            patch("src.services.gamification.shadow.logger", _FakeLogger()),
        ):
            await shadow_compare_xp_stats(
                _DUMMY_DB,
                user_id,
                legacy_total_xp=0,
                legacy_current_level=1,
                endpoint="/xp/stats",
            )
            await shadow_compare_xp_stats(
                _DUMMY_DB,
                user_id,
                legacy_total_xp=0,
                legacy_current_level=1,
                endpoint="/xp/stats",
            )

        assert mock_compute.call_count == 1
        assert len(logged_calls) == 2
        # Second call must report cache_hit=True
        assert logged_calls[1]["cache_hit"] is True


# ---------------------------------------------------------------------------
# Test 5: cache expires after 30 s
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestCacheExpiry:
    async def test_cache_expires_after_ttl(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """After TTL elapses, a second call must re-invoke GamificationProjection.compute."""
        user_id = uuid4()
        snapshot = _make_snapshot(user_id, total_xp=0, current_level=1)

        # Stepped callable: starts at 0.0, increments by 0.1 each call except
        # after the 2nd call where it jumps past TTL.  Using a callable instead
        # of iter([...]) avoids StopIteration if _cache_get/_cache_put consume
        # more monotonic() calls than expected (e.g. on slow CI paths).
        _call_count: list[int] = [0]

        def _fake_monotonic() -> float:
            _call_count[0] += 1
            # First two calls (cache miss + cache put) return 0.0.
            # All subsequent calls (second get + put) return 31.0.
            if _call_count[0] <= 2:
                return 0.0
            return 31.0

        monkeypatch.setattr(
            "src.services.gamification.shadow.time.monotonic",
            _fake_monotonic,
        )

        with (
            patch(
                "src.services.gamification.shadow.settings",
                gamification_shadow_mode=True,
            ),
            patch(
                "src.services.gamification.shadow.GamificationProjection.compute",
                new=AsyncMock(return_value=snapshot),
            ) as mock_compute,
        ):
            await shadow_compare_xp_stats(
                _DUMMY_DB,
                user_id,
                legacy_total_xp=0,
                legacy_current_level=1,
                endpoint="/xp/stats",
            )
            await shadow_compare_xp_stats(
                _DUMMY_DB,
                user_id,
                legacy_total_xp=0,
                legacy_current_level=1,
                endpoint="/xp/stats",
            )

        assert mock_compute.call_count == 2


# ---------------------------------------------------------------------------
# Test 6: cache bounded at 512 entries
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestCacheBound:
    async def test_cache_bounded_at_512(self) -> None:
        """After inserting 513 entries the cache must hold at most 512."""
        # Fill cache with 512 non-expired entries by direct dict manipulation
        # (avoids spawning 512 DB calls; tests the eviction logic directly).
        now = time.monotonic()
        with shadow_mod._cache_lock:
            shadow_mod._cache.clear()
            for i in range(512):
                uid = uuid4()
                snap = _make_snapshot(uid)
                shadow_mod._cache[uid] = (snap, now)

        # Insert a 513th entry via _cache_put
        new_uid = uuid4()
        new_snap = _make_snapshot(new_uid)
        shadow_mod._cache_put(new_uid, new_snap)

        assert len(shadow_mod._cache) <= 512


# ---------------------------------------------------------------------------
# Test 7: projection raises → gamification.shadow.error
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestProjectionError:
    async def test_projection_raises_emits_error_event(self, caplog_loguru: Any) -> None:
        """When GamificationProjection.compute raises, shadow.error is emitted, helper returns None."""
        user_id = uuid4()

        with (
            patch(
                "src.services.gamification.shadow.settings",
                gamification_shadow_mode=True,
            ),
            patch(
                "src.services.gamification.shadow.GamificationProjection.compute",
                new=AsyncMock(side_effect=RuntimeError("db exploded")),
            ),
        ):
            result = await shadow_compare_xp_stats(
                _DUMMY_DB,
                user_id,
                legacy_total_xp=0,
                legacy_current_level=1,
                endpoint="/xp/stats",
            )

        assert result is None
        error_records = [
            r for r in caplog_loguru.records if "gamification.shadow.error" in r.getMessage()
        ]
        assert len(error_records) >= 1
        match_records = [
            r for r in caplog_loguru.records if "gamification.shadow.match" in r.getMessage()
        ]
        assert match_records == []


# ---------------------------------------------------------------------------
# Test 8: logger raises inside _run_shadow → no exception escapes
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestLoggerRaises:
    async def test_logger_raises_does_not_escape_helper(self) -> None:
        """Even if the logger itself raises, the public helper must not propagate it."""
        user_id = uuid4()
        snapshot = _make_snapshot(user_id, total_xp=0, current_level=1)

        class _BrokenLogger:
            def info(self, *args: Any, **kwargs: Any) -> None:
                raise MemoryError("OOM in logger")

            def warning(self, *args: Any, **kwargs: Any) -> None:
                raise MemoryError("OOM in logger")

        with (
            patch(
                "src.services.gamification.shadow.settings",
                gamification_shadow_mode=True,
            ),
            patch(
                "src.services.gamification.shadow.GamificationProjection.compute",
                new=AsyncMock(return_value=snapshot),
            ),
            patch("src.services.gamification.shadow.logger", _BrokenLogger()),
        ):
            # Must not raise
            result = await shadow_compare_xp_stats(
                _DUMMY_DB,
                user_id,
                legacy_total_xp=0,
                legacy_current_level=1,
                endpoint="/xp/stats",
            )

        assert result is None
