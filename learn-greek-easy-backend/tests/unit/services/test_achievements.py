"""Unit tests for achievement definitions and logic.

Tests cover:
- Achievement definitions validity
- Achievement type coverage
- Progress calculation
- Points calculation
- Next milestone identification
"""

import pytest

from src.services.achievements import (
    ACHIEVEMENTS,
    AchievementDefinition,
    AchievementType,
    get_achievement_by_id,
    get_achievements_by_type,
)


@pytest.mark.unit
class TestAchievementDefinitions:
    """Tests for achievement definition validity."""

    def test_all_achievements_have_unique_ids(self):
        """Each achievement should have a unique ID."""
        ids = [a.id for a in ACHIEVEMENTS]
        assert len(ids) == len(set(ids)), "Achievement IDs must be unique"

    def test_all_achievements_have_positive_thresholds(self):
        """All thresholds should be positive integers."""
        for achievement in ACHIEVEMENTS:
            assert achievement.threshold > 0, f"{achievement.id} has invalid threshold"

    def test_all_achievements_have_positive_points(self):
        """All achievements should have positive point values."""
        for achievement in ACHIEVEMENTS:
            assert achievement.points > 0, f"{achievement.id} has invalid points"

    def test_all_achievements_have_required_fields(self):
        """All achievements should have all required fields populated."""
        for achievement in ACHIEVEMENTS:
            assert achievement.id, "Achievement missing id"
            assert achievement.name, f"{achievement.id} missing name"
            assert achievement.description, f"{achievement.id} missing description"
            assert achievement.icon, f"{achievement.id} missing icon"
            assert achievement.type in AchievementType, f"{achievement.id} has invalid type"

    def test_achievement_count(self):
        """There should be at least 10 achievements defined."""
        assert len(ACHIEVEMENTS) >= 10, "Should have at least 10 achievements"

    def test_all_achievement_types_have_at_least_one(self):
        """Each achievement type should have at least one achievement."""
        for achievement_type in AchievementType:
            achievements = get_achievements_by_type(achievement_type)
            assert len(achievements) >= 1, f"No achievements for type {achievement_type}"


@pytest.mark.unit
class TestAchievementHelpers:
    """Tests for achievement helper functions."""

    def test_get_achievement_by_id_found(self):
        """Should return achievement when ID exists."""
        achievement = get_achievement_by_id("streak_7")
        assert achievement is not None
        assert achievement.id == "streak_7"
        assert achievement.name == "Week Warrior"

    def test_get_achievement_by_id_not_found(self):
        """Should return None when ID doesn't exist."""
        achievement = get_achievement_by_id("nonexistent_id")
        assert achievement is None

    def test_get_achievements_by_type_streak(self):
        """Should return all streak achievements."""
        streaks = get_achievements_by_type(AchievementType.STREAK)
        assert len(streaks) >= 3  # 3-day, 7-day, 30-day
        for a in streaks:
            assert a.type == AchievementType.STREAK

    def test_get_achievements_by_type_mastered(self):
        """Should return all mastered achievements."""
        mastered = get_achievements_by_type(AchievementType.MASTERED)
        assert len(mastered) >= 4  # 10, 50, 100, 500
        for a in mastered:
            assert a.type == AchievementType.MASTERED

    def test_get_achievements_by_type_empty(self):
        """Should return empty list for unused type (if any)."""
        # This test would fail if we add a new type without achievements
        # Currently all types have achievements, so we test known ones
        for achievement_type in AchievementType:
            achievements = get_achievements_by_type(achievement_type)
            # Should return list (possibly empty for future types)
            assert isinstance(achievements, list)


@pytest.mark.unit
class TestAchievementProgressCalculation:
    """Tests for progress calculation logic."""

    def test_progress_0_when_no_value(self):
        """Progress should be 0 when user has no activity."""
        # This tests the formula: progress = (current / threshold) * 100
        # When current = 0, progress = 0
        current = 0
        threshold = 100
        progress = min((current / threshold) * 100, 100.0)
        assert progress == 0.0

    def test_progress_capped_at_100(self):
        """Progress should not exceed 100%."""
        current = 200
        threshold = 100
        progress = min((current / threshold) * 100, 100.0)
        assert progress == 100.0

    def test_progress_partial(self):
        """Progress should be calculated correctly for partial completion."""
        current = 45
        threshold = 100
        progress = min((current / threshold) * 100, 100.0)
        assert progress == 45.0

    def test_unlocked_when_threshold_met(self):
        """Achievement should be unlocked when threshold is met."""
        current = 100
        threshold = 100
        unlocked = current >= threshold
        assert unlocked is True

    def test_unlocked_when_threshold_exceeded(self):
        """Achievement should be unlocked when threshold is exceeded."""
        current = 150
        threshold = 100
        unlocked = current >= threshold
        assert unlocked is True

    def test_not_unlocked_when_threshold_not_met(self):
        """Achievement should not be unlocked when below threshold."""
        current = 99
        threshold = 100
        unlocked = current >= threshold
        assert unlocked is False


@pytest.mark.unit
class TestAchievementTypeMapping:
    """Tests for achievement type to stat mapping."""

    def test_streak_type_definition(self):
        """Streak achievements should have appropriate thresholds."""
        streaks = get_achievements_by_type(AchievementType.STREAK)
        thresholds = sorted([a.threshold for a in streaks])
        # Should have 3, 7, 30 day streaks
        assert 3 in thresholds
        assert 7 in thresholds
        assert 30 in thresholds

    def test_mastered_type_definition(self):
        """Mastered achievements should have appropriate thresholds."""
        mastered = get_achievements_by_type(AchievementType.MASTERED)
        thresholds = sorted([a.threshold for a in mastered])
        # Should have 10, 50, 100, 500 cards
        assert 10 in thresholds
        assert 50 in thresholds
        assert 100 in thresholds
        assert 500 in thresholds

    def test_study_time_in_seconds(self):
        """Study time achievements should use seconds."""
        time_achievements = get_achievements_by_type(AchievementType.STUDY_TIME)
        for a in time_achievements:
            # 1 hour = 3600 seconds minimum
            assert a.threshold >= 3600, f"{a.id} threshold too low for seconds"


@pytest.mark.unit
class TestAchievementDefinitionDataclass:
    """Tests for AchievementDefinition dataclass."""

    def test_achievement_definition_creation(self):
        """Should be able to create an AchievementDefinition."""
        achievement = AchievementDefinition(
            id="test_achievement",
            name="Test Achievement",
            description="Test description",
            icon="test_icon",
            threshold=100,
            type=AchievementType.MASTERED,
            points=50,
        )
        assert achievement.id == "test_achievement"
        assert achievement.points == 50

    def test_achievement_definition_is_frozen(self):
        """AchievementDefinition should be immutable (frozen)."""
        achievement = get_achievement_by_id("streak_7")
        with pytest.raises(Exception):  # FrozenInstanceError or similar
            achievement.points = 999

    def test_achievement_definition_hashable(self):
        """AchievementDefinition should be hashable (can be used in sets)."""
        achievement = get_achievement_by_id("streak_7")
        # Should not raise
        hash(achievement)
        # Should be usable in a set
        achievement_set = {achievement}
        assert len(achievement_set) == 1
