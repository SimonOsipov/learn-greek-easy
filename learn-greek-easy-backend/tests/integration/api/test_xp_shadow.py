"""Integration tests for shadow comparator wired into /xp/stats and /xp/achievements.

Coverage (4 tests):
9.  GET /xp/stats  response body is byte-identical with flag on vs off.
10. GET /xp/achievements response body is byte-identical with flag on vs off.
11. Each endpoint emits exactly one shadow event per request when flag on.
12. Endpoint returns 200 with correct body when GamificationProjection.compute raises.

Patterns used:
- monkeypatch.setattr(settings, ...) — same as test_rate_limiting.py
- caplog_loguru — project fixture that routes loguru through caplog
- patch GamificationProjection.compute to control shadow output
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from src.config import settings
from src.services.gamification.shadow import _clear_cache

# ---------------------------------------------------------------------------
# Autouse: reset in-process shadow cache between tests
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_shadow_cache() -> None:
    _clear_cache()
    yield
    _clear_cache()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _count_shadow_events(caplog_records: list) -> int:
    """Return count of log records whose message contains 'gamification.shadow'."""
    return sum(1 for r in caplog_records if "gamification.shadow" in r.getMessage())


# ---------------------------------------------------------------------------
# Test 9: GET /xp/stats — byte-identical response
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestXpStatsShadowTransparency:
    @pytest.mark.asyncio
    async def test_stats_response_identical_flag_on_vs_off(
        self,
        client: AsyncClient,
        auth_headers: dict,
        monkeypatch: pytest.MonkeyPatch,
        caplog_loguru: Any,
    ) -> None:
        """Shadow flag must not alter the /xp/stats response body."""
        # Flag off
        monkeypatch.setattr(settings, "gamification_shadow_mode", False)
        r_off = await client.get("/api/v1/xp/stats", headers=auth_headers)
        assert r_off.status_code == 200

        _clear_cache()

        # Flag on — patch compute to avoid real DB work
        from datetime import datetime, timezone
        from uuid import uuid4

        from src.services.achievement_definitions import AchievementMetric
        from src.services.gamification.types import GamificationSnapshot, MetricValues
        from src.services.gamification.version import GAMIFICATION_PROJECTION_VERSION

        dummy_snapshot = GamificationSnapshot(
            user_id=uuid4(),
            metrics=MetricValues({AchievementMetric.STREAK_DAYS: 0}),
            unlocked=frozenset(),
            total_xp=0,
            current_level=1,
            projection_version=GAMIFICATION_PROJECTION_VERSION,
            computed_at=datetime.now(timezone.utc),
        )

        monkeypatch.setattr(settings, "gamification_shadow_mode", True)
        with patch(
            "src.services.gamification.shadow.GamificationProjection.compute",
            new=AsyncMock(return_value=dummy_snapshot),
        ):
            r_on = await client.get("/api/v1/xp/stats", headers=auth_headers)

        assert r_on.status_code == 200
        assert r_on.content == r_off.content


# ---------------------------------------------------------------------------
# Test 10: GET /xp/achievements — byte-identical response
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestAchievementsShadowTransparency:
    @pytest.mark.asyncio
    async def test_achievements_response_identical_flag_on_vs_off(
        self,
        client: AsyncClient,
        auth_headers: dict,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Shadow flag must not alter the /xp/achievements response body."""
        from datetime import datetime, timezone
        from uuid import uuid4

        from src.services.achievement_definitions import AchievementMetric
        from src.services.gamification.types import GamificationSnapshot, MetricValues
        from src.services.gamification.version import GAMIFICATION_PROJECTION_VERSION

        dummy_snapshot = GamificationSnapshot(
            user_id=uuid4(),
            metrics=MetricValues({AchievementMetric.STREAK_DAYS: 0}),
            unlocked=frozenset(),
            total_xp=0,
            current_level=1,
            projection_version=GAMIFICATION_PROJECTION_VERSION,
            computed_at=datetime.now(timezone.utc),
        )

        # Flag off
        monkeypatch.setattr(settings, "gamification_shadow_mode", False)
        r_off = await client.get("/api/v1/xp/achievements", headers=auth_headers)
        assert r_off.status_code == 200

        _clear_cache()

        # Flag on
        monkeypatch.setattr(settings, "gamification_shadow_mode", True)
        with patch(
            "src.services.gamification.shadow.GamificationProjection.compute",
            new=AsyncMock(return_value=dummy_snapshot),
        ):
            r_on = await client.get("/api/v1/xp/achievements", headers=auth_headers)

        assert r_on.status_code == 200
        assert r_on.content == r_off.content


# ---------------------------------------------------------------------------
# Test 11: exactly one shadow event per request (both endpoints)
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestShadowEventEmission:
    @pytest.mark.asyncio
    async def test_stats_emits_one_shadow_event(
        self,
        client: AsyncClient,
        auth_headers: dict,
        monkeypatch: pytest.MonkeyPatch,
        caplog_loguru: Any,
    ) -> None:
        """GET /xp/stats must emit exactly one shadow event when flag on."""
        from datetime import datetime, timezone
        from uuid import uuid4

        from src.services.achievement_definitions import AchievementMetric
        from src.services.gamification.types import GamificationSnapshot, MetricValues
        from src.services.gamification.version import GAMIFICATION_PROJECTION_VERSION

        dummy_snapshot = GamificationSnapshot(
            user_id=uuid4(),
            metrics=MetricValues({AchievementMetric.STREAK_DAYS: 0}),
            unlocked=frozenset(),
            total_xp=0,
            current_level=1,
            projection_version=GAMIFICATION_PROJECTION_VERSION,
            computed_at=datetime.now(timezone.utc),
        )

        monkeypatch.setattr(settings, "gamification_shadow_mode", True)
        with patch(
            "src.services.gamification.shadow.GamificationProjection.compute",
            new=AsyncMock(return_value=dummy_snapshot),
        ):
            r = await client.get("/api/v1/xp/stats", headers=auth_headers)

        assert r.status_code == 200
        assert _count_shadow_events(caplog_loguru.records) == 1

    @pytest.mark.asyncio
    async def test_achievements_emits_one_shadow_event(
        self,
        client: AsyncClient,
        auth_headers: dict,
        monkeypatch: pytest.MonkeyPatch,
        caplog_loguru: Any,
    ) -> None:
        """GET /xp/achievements must emit exactly one shadow event when flag on."""
        from datetime import datetime, timezone
        from uuid import uuid4

        from src.services.achievement_definitions import AchievementMetric
        from src.services.gamification.types import GamificationSnapshot, MetricValues
        from src.services.gamification.version import GAMIFICATION_PROJECTION_VERSION

        dummy_snapshot = GamificationSnapshot(
            user_id=uuid4(),
            metrics=MetricValues({AchievementMetric.STREAK_DAYS: 0}),
            unlocked=frozenset(),
            total_xp=0,
            current_level=1,
            projection_version=GAMIFICATION_PROJECTION_VERSION,
            computed_at=datetime.now(timezone.utc),
        )

        monkeypatch.setattr(settings, "gamification_shadow_mode", True)
        with patch(
            "src.services.gamification.shadow.GamificationProjection.compute",
            new=AsyncMock(return_value=dummy_snapshot),
        ):
            r = await client.get("/api/v1/xp/achievements", headers=auth_headers)

        assert r.status_code == 200
        assert _count_shadow_events(caplog_loguru.records) == 1


# ---------------------------------------------------------------------------
# Test 12: compute raises → endpoint still returns 200
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestShadowComputeRaises:
    @pytest.mark.asyncio
    async def test_stats_200_when_compute_raises(
        self,
        client: AsyncClient,
        auth_headers: dict,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """GET /xp/stats returns 200 with correct body even if GamificationProjection.compute raises."""
        monkeypatch.setattr(settings, "gamification_shadow_mode", True)

        with patch(
            "src.services.gamification.shadow.GamificationProjection.compute",
            new=AsyncMock(side_effect=RuntimeError("projection exploded")),
        ):
            r = await client.get("/api/v1/xp/stats", headers=auth_headers)

        assert r.status_code == 200
        data = r.json()
        assert "total_xp" in data
        assert "current_level" in data

    @pytest.mark.asyncio
    async def test_achievements_200_when_compute_raises(
        self,
        client: AsyncClient,
        auth_headers: dict,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """GET /xp/achievements returns 200 with correct body even if GamificationProjection.compute raises."""
        monkeypatch.setattr(settings, "gamification_shadow_mode", True)

        with patch(
            "src.services.gamification.shadow.GamificationProjection.compute",
            new=AsyncMock(side_effect=RuntimeError("projection exploded")),
        ):
            r = await client.get("/api/v1/xp/achievements", headers=auth_headers)

        assert r.status_code == 200
        data = r.json()
        assert "achievements" in data
        assert "total_count" in data
