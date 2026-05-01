"""Integration tests for reconcile-on-read wiring in XP endpoints.

Coverage (3 tests):
10. Flag off: GamificationReconciler.reconcile is NOT called by either endpoint.
11. Flag on + percent=100: both endpoints call reconcile exactly once each with QUIET mode.
12. Reconcile raises: both endpoints still return HTTP 200 and emit gamification.reconcile.error.

Patterns used:
- monkeypatch.setattr(settings, ...) — same as test_xp_shadow.py
- patch GamificationReconciler.reconcile with AsyncMock to control behaviour
- caplog_loguru — project fixture that routes loguru through caplog
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from src.config import settings
from src.services.gamification.types import ReconcileMode

# ---------------------------------------------------------------------------
# Test 10: flag off → reconcile never called
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestFlagOffNoReconcile:
    @pytest.mark.asyncio
    async def test_flag_off_does_not_call_reconcile(
        self,
        client: AsyncClient,
        auth_headers: dict,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """When master switch is off, GamificationReconciler.reconcile must not be called."""
        monkeypatch.setattr(settings, "gamification_reconcile_on_read", False)
        monkeypatch.setattr(settings, "gamification_reconcile_rollout_percent", 100)

        mock_reconcile = AsyncMock()
        with patch(
            "src.api.v1.xp.GamificationReconciler.reconcile",
            new=mock_reconcile,
        ):
            r_stats = await client.get("/api/v1/xp/stats", headers=auth_headers)
            r_achievements = await client.get("/api/v1/xp/achievements", headers=auth_headers)

        assert r_stats.status_code == 200
        assert r_achievements.status_code == 200
        assert mock_reconcile.call_count == 0


# ---------------------------------------------------------------------------
# Test 11: flag on + percent=100 → exactly one reconcile call per endpoint
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestFlagOnCallsReconcile:
    @pytest.mark.asyncio
    async def test_flag_on_percent_100_calls_reconcile_once_per_endpoint(
        self,
        client: AsyncClient,
        auth_headers: dict,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """With flags on + percent=100, each endpoint calls reconcile exactly once with QUIET."""
        monkeypatch.setattr(settings, "gamification_reconcile_on_read", True)
        monkeypatch.setattr(settings, "gamification_reconcile_rollout_percent", 100)

        mock_reconcile = AsyncMock(return_value=None)
        with patch(
            "src.api.v1.xp.GamificationReconciler.reconcile",
            new=mock_reconcile,
        ):
            r_stats = await client.get("/api/v1/xp/stats", headers=auth_headers)
            assert r_stats.status_code == 200
            assert mock_reconcile.call_count == 1
            _, kwargs_stats = mock_reconcile.call_args_list[0]
            assert kwargs_stats.get("mode") == ReconcileMode.QUIET

            r_achievements = await client.get("/api/v1/xp/achievements", headers=auth_headers)
            assert r_achievements.status_code == 200
            assert mock_reconcile.call_count == 2
            _, kwargs_ach = mock_reconcile.call_args_list[1]
            assert kwargs_ach.get("mode") == ReconcileMode.QUIET


# ---------------------------------------------------------------------------
# Test 12: reconcile raises → endpoint still returns 200, emits error log
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestReconcileFailureTransparency:
    @pytest.mark.asyncio
    async def test_reconcile_failure_does_not_break_endpoint(
        self,
        client: AsyncClient,
        auth_headers: dict,
        monkeypatch: pytest.MonkeyPatch,
        caplog_loguru: Any,
    ) -> None:
        """Reconcile raising RuntimeError must not cause 500; error must be logged."""
        monkeypatch.setattr(settings, "gamification_reconcile_on_read", True)
        monkeypatch.setattr(settings, "gamification_reconcile_rollout_percent", 100)

        with patch(
            "src.api.v1.xp.GamificationReconciler.reconcile",
            new=AsyncMock(side_effect=RuntimeError("reconcile exploded")),
        ):
            r_stats = await client.get("/api/v1/xp/stats", headers=auth_headers)
            r_achievements = await client.get("/api/v1/xp/achievements", headers=auth_headers)

        assert r_stats.status_code == 200
        assert "total_xp" in r_stats.json()

        assert r_achievements.status_code == 200
        assert "achievements" in r_achievements.json()

        error_events = [
            r for r in caplog_loguru.records if "gamification.reconcile.error" in r.getMessage()
        ]
        assert (
            len(error_events) == 2
        ), f"Expected 2 gamification.reconcile.error log records, got {len(error_events)}"
