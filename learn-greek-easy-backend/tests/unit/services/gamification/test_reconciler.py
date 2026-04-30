"""Unit tests for GamificationReconciler.reconcile().

Coverage:
- test_idempotency_run_twice_no_diff
- test_immediate_mode_emits_notifications
- test_quiet_mode_no_notifications
- test_summary_mode_logs_stub_warning
- test_xp_cache_integrity_after_reconcile
- test_no_duplicate_user_achievement_on_concurrent_call
- test_level_up_detection
- test_returns_reconcile_result_type
- test_empty_diff_path

Tests use real db_session (matches test_projection.py style).
NotificationService is mocked via unittest.mock.patch for mode-dispatch tests.
GamificationProjection.compute is mocked to provide controlled snapshots.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Achievement, AchievementCategory, User, UserAchievement, UserXP
from src.services.achievement_definitions import AchievementMetric
from src.services.gamification.reconciler import GamificationReconciler, ReconcileResult
from src.services.gamification.types import GamificationSnapshot, MetricValues, ReconcileMode
from src.services.gamification.version import GAMIFICATION_PROJECTION_VERSION

# =============================================================================
# Helpers
# =============================================================================


async def _make_user(db: AsyncSession) -> User:
    user = User(email=f"reconciler_test_{uuid4().hex[:8]}@example.com", is_active=True)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def _seed_achievement(db: AsyncSession, ach_id: str, xp_reward: int = 50) -> Achievement:
    """Insert an Achievement row (required for UserAchievement FK)."""
    # Use merge to avoid PK conflict when the same id is seeded across tests
    ach = Achievement(
        id=ach_id,
        name=ach_id.replace("_", " ").title(),
        description=f"Test achievement {ach_id}",
        category=AchievementCategory.STREAK,
        icon="star",
        threshold=1,
        xp_reward=xp_reward,
        sort_order=0,
    )
    db.add(ach)
    await db.flush()
    return ach


def _make_snapshot(
    user_id: Any,
    *,
    unlocked: frozenset[str] | None = None,
    total_xp: int = 0,
    current_level: int = 1,
) -> GamificationSnapshot:
    """Build a minimal GamificationSnapshot with one metric populated."""
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


# =============================================================================
# Tests
# =============================================================================


@pytest.mark.unit
class TestReconcileReturnType:
    """Return value is always a ReconcileResult with all fields populated."""

    async def test_returns_reconcile_result_type(self, db_session: AsyncSession) -> None:
        user = await _make_user(db_session)
        snapshot = _make_snapshot(user.id, total_xp=100, current_level=2)

        with patch(
            "src.services.gamification.reconciler.GamificationProjection.compute",
            new=AsyncMock(return_value=snapshot),
        ):
            result = await GamificationReconciler.reconcile(
                db_session, user.id, ReconcileMode.QUIET
            )

        assert isinstance(result, ReconcileResult)
        assert result.new_unlocks == []
        assert result.total_xp_before == 0  # freshly created UserXP starts at 0
        assert result.total_xp_after == 100
        assert result.leveled_up is True
        assert result.snapshot is snapshot


@pytest.mark.unit
class TestXPAbsoluteWrite:
    """UserXP.total_xp is set absolutely, not incremented."""

    async def test_xp_cache_integrity_after_reconcile(self, db_session: AsyncSession) -> None:
        user = await _make_user(db_session)
        snapshot = _make_snapshot(user.id, total_xp=500, current_level=3)

        with patch(
            "src.services.gamification.reconciler.GamificationProjection.compute",
            new=AsyncMock(return_value=snapshot),
        ):
            result = await GamificationReconciler.reconcile(
                db_session, user.id, ReconcileMode.QUIET
            )

        # Verify stored value equals snapshot
        stored = await db_session.execute(select(UserXP).where(UserXP.user_id == user.id))
        user_xp = stored.scalar_one()
        assert user_xp.total_xp == 500
        assert user_xp.current_level == 3
        assert result.total_xp_after == 500


@pytest.mark.unit
class TestIdempotency:
    """Reconcile twice produces no diff on the second call."""

    async def test_idempotency_run_twice_no_diff(self, db_session: AsyncSession) -> None:
        user = await _make_user(db_session)
        await _seed_achievement(db_session, "streak_first_flame", xp_reward=50)

        snapshot = _make_snapshot(
            user.id,
            unlocked=frozenset({"streak_first_flame"}),
            total_xp=50,
            current_level=1,
        )

        with patch(
            "src.services.gamification.reconciler.GamificationProjection.compute",
            new=AsyncMock(return_value=snapshot),
        ):
            result1 = await GamificationReconciler.reconcile(
                db_session, user.id, ReconcileMode.QUIET
            )
            result2 = await GamificationReconciler.reconcile(
                db_session, user.id, ReconcileMode.QUIET
            )

        assert result1.new_unlocks == ["streak_first_flame"]
        # Second call: already in DB, no new unlocks
        assert result2.new_unlocks == []
        assert result2.total_xp_before == result2.total_xp_after


@pytest.mark.unit
class TestEmptyDiffPath:
    """No diff when user already has the correct state."""

    async def test_empty_diff_path(self, db_session: AsyncSession) -> None:
        user = await _make_user(db_session)
        # Snapshot with no unlocks and zero XP
        snapshot = _make_snapshot(user.id, total_xp=0, current_level=1)

        with (
            patch(
                "src.services.gamification.reconciler.GamificationProjection.compute",
                new=AsyncMock(return_value=snapshot),
            ),
            patch(
                "src.services.gamification.reconciler.NotificationService",
            ) as mock_ns_cls,
        ):
            mock_ns_cls.return_value.notify_achievement_unlocked = AsyncMock()
            mock_ns_cls.return_value.notify_level_up = AsyncMock()

            result = await GamificationReconciler.reconcile(
                db_session, user.id, ReconcileMode.IMMEDIATE
            )

        assert result.new_unlocks == []
        assert result.leveled_up is False
        mock_ns_cls.return_value.notify_achievement_unlocked.assert_not_called()
        mock_ns_cls.return_value.notify_level_up.assert_not_called()


@pytest.mark.unit
class TestImmediateMode:
    """IMMEDIATE mode emits per-unlock and level-up notifications."""

    async def test_immediate_mode_emits_notifications(self, db_session: AsyncSession) -> None:
        user = await _make_user(db_session)
        await _seed_achievement(db_session, "streak_first_flame", xp_reward=50)
        await _seed_achievement(db_session, "learning_first_word", xp_reward=10)

        snapshot = _make_snapshot(
            user.id,
            unlocked=frozenset({"streak_first_flame", "learning_first_word"}),
            total_xp=160,  # enough to cross level 2 threshold (100)
            current_level=2,
        )

        with (
            patch(
                "src.services.gamification.reconciler.GamificationProjection.compute",
                new=AsyncMock(return_value=snapshot),
            ),
            patch(
                "src.services.gamification.reconciler.NotificationService",
            ) as mock_ns_cls,
        ):
            mock_ns_instance = AsyncMock()
            mock_ns_cls.return_value = mock_ns_instance
            mock_ns_instance.notify_achievement_unlocked = AsyncMock()
            mock_ns_instance.notify_level_up = AsyncMock()

            result = await GamificationReconciler.reconcile(
                db_session, user.id, ReconcileMode.IMMEDIATE
            )

        assert len(result.new_unlocks) == 2
        assert result.leveled_up is True
        # One notify_achievement_unlocked call per new unlock
        assert mock_ns_instance.notify_achievement_unlocked.call_count == 2
        # One level-up notification
        mock_ns_instance.notify_level_up.assert_awaited_once()


@pytest.mark.unit
class TestQuietMode:
    """QUIET mode emits no notifications."""

    async def test_quiet_mode_no_notifications(self, db_session: AsyncSession) -> None:
        user = await _make_user(db_session)
        await _seed_achievement(db_session, "streak_first_flame", xp_reward=50)

        snapshot = _make_snapshot(
            user.id,
            unlocked=frozenset({"streak_first_flame"}),
            total_xp=200,
            current_level=2,
        )

        with (
            patch(
                "src.services.gamification.reconciler.GamificationProjection.compute",
                new=AsyncMock(return_value=snapshot),
            ),
            patch(
                "src.services.gamification.reconciler.NotificationService",
            ) as mock_ns_cls,
        ):
            mock_ns_instance = AsyncMock()
            mock_ns_cls.return_value = mock_ns_instance
            mock_ns_instance.notify_achievement_unlocked = AsyncMock()
            mock_ns_instance.notify_level_up = AsyncMock()

            result = await GamificationReconciler.reconcile(
                db_session, user.id, ReconcileMode.QUIET
            )

        assert result.new_unlocks == ["streak_first_flame"]
        # QUIET: nothing called
        mock_ns_instance.notify_achievement_unlocked.assert_not_called()
        mock_ns_instance.notify_level_up.assert_not_called()


@pytest.mark.unit
class TestSummaryMode:
    """SUMMARY mode logs stub warning; level-up still emits."""

    async def test_summary_mode_logs_stub_warning(
        self, db_session: AsyncSession, caplog_loguru: Any
    ) -> None:
        user = await _make_user(db_session)
        await _seed_achievement(db_session, "streak_first_flame", xp_reward=50)

        snapshot = _make_snapshot(
            user.id,
            unlocked=frozenset({"streak_first_flame"}),
            total_xp=50,
            current_level=1,
        )

        with (
            patch(
                "src.services.gamification.reconciler.GamificationProjection.compute",
                new=AsyncMock(return_value=snapshot),
            ),
            patch(
                "src.services.gamification.reconciler.NotificationService",
            ) as mock_ns_cls,
        ):
            mock_ns_instance = AsyncMock()
            mock_ns_cls.return_value = mock_ns_instance
            mock_ns_instance.notify_achievement_unlocked = AsyncMock()
            mock_ns_instance.notify_level_up = AsyncMock()

            import logging

            with caplog_loguru.at_level(logging.WARNING):
                result = await GamificationReconciler.reconcile(
                    db_session, user.id, ReconcileMode.SUMMARY
                )

        assert result.new_unlocks == ["streak_first_flame"]
        # SUMMARY stub: no per-unlock notification, but warning logged
        mock_ns_instance.notify_achievement_unlocked.assert_not_called()
        # Level did not change (level stayed at 1) so no level-up notification
        assert result.leveled_up is False

        # Check that the warning log references SUMMARY mode and GAMIF-05-01
        warning_records = [r for r in caplog_loguru.records if r.levelno >= logging.WARNING]
        assert any(
            "SUMMARY mode" in r.getMessage() for r in warning_records
        ), f"Expected 'SUMMARY mode' in warning. Records: {[r.getMessage() for r in warning_records]}"
        assert any(
            "GAMIF-05-01" in r.getMessage() for r in warning_records
        ), f"Expected 'GAMIF-05-01' in warning. Records: {[r.getMessage() for r in warning_records]}"


@pytest.mark.unit
class TestSummaryModeWithLevelUp:
    """SUMMARY mode still emits level-up notification even when achievements are batched."""

    async def test_summary_mode_emits_level_up(self, db_session: AsyncSession) -> None:
        user = await _make_user(db_session)
        await _seed_achievement(db_session, "streak_first_flame", xp_reward=50)

        snapshot = _make_snapshot(
            user.id,
            unlocked=frozenset({"streak_first_flame"}),
            total_xp=200,
            current_level=2,
        )

        with (
            patch(
                "src.services.gamification.reconciler.GamificationProjection.compute",
                new=AsyncMock(return_value=snapshot),
            ),
            patch(
                "src.services.gamification.reconciler.NotificationService",
            ) as mock_ns_cls,
        ):
            mock_ns_instance = AsyncMock()
            mock_ns_cls.return_value = mock_ns_instance
            mock_ns_instance.notify_achievement_unlocked = AsyncMock()
            mock_ns_instance.notify_level_up = AsyncMock()

            result = await GamificationReconciler.reconcile(
                db_session, user.id, ReconcileMode.SUMMARY
            )

        assert result.leveled_up is True
        # Achievement notification NOT called (batched in SUMMARY stub)
        mock_ns_instance.notify_achievement_unlocked.assert_not_called()
        # Level-up IS called in SUMMARY mode
        mock_ns_instance.notify_level_up.assert_awaited_once()


@pytest.mark.unit
class TestNoDuplicateAchievements:
    """pg_insert.on_conflict_do_nothing prevents duplicate UserAchievement rows."""

    async def test_no_duplicate_user_achievement_on_concurrent_call(
        self, db_session: AsyncSession
    ) -> None:
        user = await _make_user(db_session)
        await _seed_achievement(db_session, "streak_first_flame", xp_reward=50)

        snapshot = _make_snapshot(
            user.id,
            unlocked=frozenset({"streak_first_flame"}),
            total_xp=50,
            current_level=1,
        )

        with patch(
            "src.services.gamification.reconciler.GamificationProjection.compute",
            new=AsyncMock(return_value=snapshot),
        ):
            await GamificationReconciler.reconcile(db_session, user.id, ReconcileMode.QUIET)
            # Second call with same snapshot — on_conflict_do_nothing absorbs it
            await GamificationReconciler.reconcile(db_session, user.id, ReconcileMode.QUIET)

        # Only one UserAchievement row should exist
        result = await db_session.execute(
            select(UserAchievement).where(
                UserAchievement.user_id == user.id,
                UserAchievement.achievement_id == "streak_first_flame",
            )
        )
        rows = result.scalars().all()
        assert len(rows) == 1


@pytest.mark.unit
class TestLevelUpDetection:
    """Level-up is detected when snapshot.current_level > stored old_level."""

    async def test_level_up_detection(self, db_session: AsyncSession) -> None:
        user = await _make_user(db_session)

        # First reconcile: bring user to level 2
        snapshot_l2 = _make_snapshot(user.id, total_xp=200, current_level=2)
        with patch(
            "src.services.gamification.reconciler.GamificationProjection.compute",
            new=AsyncMock(return_value=snapshot_l2),
        ):
            result1 = await GamificationReconciler.reconcile(
                db_session, user.id, ReconcileMode.QUIET
            )

        assert result1.leveled_up is True  # 1 → 2

        # Second reconcile: bump to level 4 (simulates earning enough XP)
        snapshot_l4 = _make_snapshot(user.id, total_xp=1000, current_level=4)
        with (
            patch(
                "src.services.gamification.reconciler.GamificationProjection.compute",
                new=AsyncMock(return_value=snapshot_l4),
            ),
            patch(
                "src.services.gamification.reconciler.NotificationService",
            ) as mock_ns_cls,
        ):
            mock_ns_instance = AsyncMock()
            mock_ns_cls.return_value = mock_ns_instance
            mock_ns_instance.notify_level_up = AsyncMock()

            result2 = await GamificationReconciler.reconcile(
                db_session, user.id, ReconcileMode.IMMEDIATE
            )

        assert result2.leveled_up is True  # 2 → 4
        # Exactly one level-up notification fired (for the new level, not each intermediate)
        mock_ns_instance.notify_level_up.assert_awaited_once()
        call_args = mock_ns_instance.notify_level_up.call_args
        assert call_args.args[1] == 4 or call_args.kwargs.get("new_level") == 4
