"""Unit tests for the gamification type foundation.

Tests cover:
- GamificationSnapshot is frozen and slot-based
- MetricValues raises KeyError on missing metrics (no silent zero)
- MetricValues __contains__ works
- ReconcileMode string values
- GAMIFICATION_PROJECTION_VERSION is an int
- AchievementMetric enum cleanup (SESSION_SPEED_CPM, SESSION_HOUR_LATEST, SESSION_HOUR_EARLIEST)
- Updated AchievementDef entries for Speed Demon, Night Owl, Early Bird
- Total achievement count unchanged at 45
"""

import dataclasses
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from src.services.achievement_definitions import (
    ACHIEVEMENTS,
    AchievementMetric,
    get_achievement_by_id,
)
from src.services.gamification import (
    GAMIFICATION_PROJECTION_VERSION,
    GamificationSnapshot,
    MetricValues,
    ReconcileMode,
)


@pytest.mark.unit
class TestGamificationSnapshot:
    """Tests for GamificationSnapshot dataclass."""

    def _make_snapshot(self) -> GamificationSnapshot:
        return GamificationSnapshot(
            user_id=uuid4(),
            metrics=MetricValues({AchievementMetric.STREAK_DAYS: 5}),
            unlocked=frozenset(["streak_first_flame"]),
            total_xp=100,
            current_level=2,
            projection_version=1,
            computed_at=datetime.now(tz=timezone.utc),
        )

    def test_snapshot_is_frozen(self) -> None:
        """GamificationSnapshot must be immutable (frozen=True)."""
        snapshot = self._make_snapshot()
        with pytest.raises(dataclasses.FrozenInstanceError):
            snapshot.total_xp = 999  # type: ignore[misc]

    def test_snapshot_has_slots(self) -> None:
        """GamificationSnapshot must use __slots__ (slots=True)."""
        assert hasattr(GamificationSnapshot, "__slots__")

    def test_snapshot_fields_accessible(self) -> None:
        """All snapshot fields should be readable."""
        snapshot = self._make_snapshot()
        assert isinstance(snapshot.total_xp, int)
        assert isinstance(snapshot.projection_version, int)
        assert isinstance(snapshot.unlocked, frozenset)


@pytest.mark.unit
class TestMetricValues:
    """Tests for MetricValues wrapper class."""

    def test_metric_values_raises_on_missing(self) -> None:
        """Accessing a metric not in the map must raise KeyError, not return 0."""
        mv = MetricValues({AchievementMetric.STREAK_DAYS: 10})
        with pytest.raises(KeyError):
            _ = mv[AchievementMetric.CARDS_LEARNED]

    def test_metric_values_returns_value_when_present(self) -> None:
        """Accessing a metric that is present should return its value."""
        mv = MetricValues({AchievementMetric.STREAK_DAYS: 7})
        assert mv[AchievementMetric.STREAK_DAYS] == 7

    def test_metric_values_contains(self) -> None:
        """The 'in' operator should return True for present metrics."""
        mv = MetricValues({AchievementMetric.STREAK_DAYS: 3})
        assert AchievementMetric.STREAK_DAYS in mv
        assert AchievementMetric.CARDS_LEARNED not in mv

    def test_metric_values_keys(self) -> None:
        """keys() should expose the underlying dict keys."""
        mv = MetricValues(
            {
                AchievementMetric.STREAK_DAYS: 1,
                AchievementMetric.SESSION_CARDS: 10,
            }
        )
        assert set(mv.keys()) == {AchievementMetric.STREAK_DAYS, AchievementMetric.SESSION_CARDS}

    def test_metric_values_items(self) -> None:
        """items() should expose key-value pairs."""
        mv = MetricValues({AchievementMetric.TOTAL_REVIEWS: 42})
        pairs = dict(mv.items())
        assert pairs[AchievementMetric.TOTAL_REVIEWS] == 42

    def test_metric_values_error_message_includes_metric_name(self) -> None:
        """KeyError message should mention the missing metric."""
        mv = MetricValues({})
        with pytest.raises(KeyError, match="CARDS_LEARNED"):
            _ = mv[AchievementMetric.CARDS_LEARNED]


@pytest.mark.unit
class TestReconcileMode:
    """Tests for ReconcileMode enum."""

    def test_reconcile_mode_immediate_value(self) -> None:
        assert ReconcileMode.IMMEDIATE.value == "immediate"

    def test_reconcile_mode_quiet_value(self) -> None:
        assert ReconcileMode.QUIET.value == "quiet"

    def test_reconcile_mode_summary_value(self) -> None:
        assert ReconcileMode.SUMMARY.value == "summary"

    def test_reconcile_mode_has_three_values(self) -> None:
        assert len(ReconcileMode) == 3

    def test_reconcile_mode_is_str(self) -> None:
        """ReconcileMode should be usable as a plain string."""
        assert isinstance(ReconcileMode.IMMEDIATE, str)


@pytest.mark.unit
class TestProjectionVersion:
    """Tests for GAMIFICATION_PROJECTION_VERSION constant."""

    def test_version_is_int(self) -> None:
        assert isinstance(GAMIFICATION_PROJECTION_VERSION, int)

    def test_version_is_one(self) -> None:
        assert GAMIFICATION_PROJECTION_VERSION == 1


@pytest.mark.unit
class TestAchievementMetricEnumCleanup:
    """Tests for AchievementMetric enum rename and split."""

    def test_session_speed_cpm_in_enum(self) -> None:
        """SESSION_SPEED_CPM must exist in AchievementMetric."""
        assert hasattr(AchievementMetric, "SESSION_SPEED_CPM")
        assert AchievementMetric.SESSION_SPEED_CPM.value == "session_speed_cpm"

    def test_old_session_speed_removed(self) -> None:
        """SESSION_SPEED (old name) must no longer exist in AchievementMetric."""
        assert not hasattr(AchievementMetric, "SESSION_SPEED")

    def test_session_hour_latest_in_enum(self) -> None:
        """SESSION_HOUR_LATEST must exist in AchievementMetric."""
        assert hasattr(AchievementMetric, "SESSION_HOUR_LATEST")
        assert AchievementMetric.SESSION_HOUR_LATEST.value == "session_hour_latest"

    def test_session_hour_earliest_in_enum(self) -> None:
        """SESSION_HOUR_EARLIEST must exist in AchievementMetric."""
        assert hasattr(AchievementMetric, "SESSION_HOUR_EARLIEST")
        assert AchievementMetric.SESSION_HOUR_EARLIEST.value == "session_hour_earliest"

    def test_old_session_time_removed(self) -> None:
        """SESSION_TIME (old name) must no longer exist in AchievementMetric."""
        assert not hasattr(AchievementMetric, "SESSION_TIME")

    def test_session_hour_split(self) -> None:
        """Both SESSION_HOUR_LATEST and SESSION_HOUR_EARLIEST must be distinct members."""
        assert AchievementMetric.SESSION_HOUR_LATEST != AchievementMetric.SESSION_HOUR_EARLIEST


@pytest.mark.unit
class TestUpdatedAchievementDefs:
    """Tests for the updated Speed Demon, Night Owl, and Early Bird AchievementDefs."""

    def test_speedster_achievement_uses_cpm(self) -> None:
        """Speed Demon must use SESSION_SPEED_CPM metric with threshold=20."""
        ach = get_achievement_by_id("session_speed_demon")
        assert ach is not None, "session_speed_demon achievement not found"
        assert ach.metric == AchievementMetric.SESSION_SPEED_CPM
        assert ach.threshold == 20

    def test_night_owl_uses_hour_latest(self) -> None:
        """Night Owl must use SESSION_HOUR_LATEST metric with threshold=22."""
        ach = get_achievement_by_id("session_night_owl")
        assert ach is not None, "session_night_owl achievement not found"
        assert ach.metric == AchievementMetric.SESSION_HOUR_LATEST
        assert ach.threshold == 22

    def test_early_bird_uses_hour_earliest_inverted(self) -> None:
        """Early Bird must use SESSION_HOUR_EARLIEST with threshold=17 (24-7, inverted)."""
        ach = get_achievement_by_id("session_early_bird")
        assert ach is not None, "session_early_bird achievement not found"
        assert ach.metric == AchievementMetric.SESSION_HOUR_EARLIEST
        assert ach.threshold == 17  # 24 - 7 (7 AM inverted via 24 - hour convention)

    def test_total_achievement_count_unchanged(self) -> None:
        """Total achievement count must remain exactly 45."""
        assert len(ACHIEVEMENTS) == 45, f"Expected 45 achievements, got {len(ACHIEVEMENTS)}"
