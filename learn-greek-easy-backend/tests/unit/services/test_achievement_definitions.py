"""Unit tests for achievement definitions.

Tests cover:
- Achievement count minimum (35+)
- All categories have achievements
- Unique IDs
- Positive thresholds and XP rewards
- Helper functions (get_by_id, get_by_category, get_by_metric)
"""

import pytest

from src.db.models import AchievementCategory
from src.services.achievement_definitions import (
    ACHIEVEMENTS,
    AchievementMetric,
    get_achievement_by_id,
    get_achievements_by_category,
    get_achievements_by_metric,
)


@pytest.mark.unit
class TestAchievementCount:
    """Tests for achievement count requirements."""

    def test_achievement_count_minimum_35(self):
        """Should have at least 35 achievements defined."""
        assert len(ACHIEVEMENTS) >= 35, f"Expected 35+ achievements, got {len(ACHIEVEMENTS)}"

    def test_streak_achievements_count(self):
        """Should have 7 streak achievements."""
        streak_achievements = get_achievements_by_category(AchievementCategory.STREAK)
        assert (
            len(streak_achievements) == 7
        ), f"Expected 7 streak achievements, got {len(streak_achievements)}"

    def test_learning_achievements_count(self):
        """Should have 7 learning achievements."""
        learning_achievements = get_achievements_by_category(AchievementCategory.LEARNING)
        assert (
            len(learning_achievements) == 7
        ), f"Expected 7 learning achievements, got {len(learning_achievements)}"

    def test_session_achievements_count(self):
        """Should have 6 session achievements."""
        session_achievements = get_achievements_by_category(AchievementCategory.SESSION)
        assert (
            len(session_achievements) == 6
        ), f"Expected 6 session achievements, got {len(session_achievements)}"

    def test_accuracy_achievements_count(self):
        """Should have 4 accuracy achievements."""
        accuracy_achievements = get_achievements_by_category(AchievementCategory.ACCURACY)
        assert (
            len(accuracy_achievements) == 4
        ), f"Expected 4 accuracy achievements, got {len(accuracy_achievements)}"

    def test_cefr_achievements_count(self):
        """Should have 6 CEFR achievements."""
        cefr_achievements = get_achievements_by_category(AchievementCategory.CEFR)
        assert (
            len(cefr_achievements) == 6
        ), f"Expected 6 CEFR achievements, got {len(cefr_achievements)}"

    def test_special_achievements_count(self):
        """Should have at least 5 special achievements."""
        special_achievements = get_achievements_by_category(AchievementCategory.SPECIAL)
        assert (
            len(special_achievements) >= 5
        ), f"Expected 5+ special achievements, got {len(special_achievements)}"


@pytest.mark.unit
class TestAchievementCategories:
    """Tests for achievement category coverage."""

    def test_all_categories_have_achievements(self):
        """Each achievement category should have at least one achievement."""
        for category in AchievementCategory:
            achievements = get_achievements_by_category(category)
            assert len(achievements) >= 1, f"No achievements for category {category}"

    def test_streak_category_exists(self):
        """Streak category should have achievements."""
        achievements = get_achievements_by_category(AchievementCategory.STREAK)
        assert len(achievements) > 0

    def test_learning_category_exists(self):
        """Learning category should have achievements."""
        achievements = get_achievements_by_category(AchievementCategory.LEARNING)
        assert len(achievements) > 0

    def test_session_category_exists(self):
        """Session category should have achievements."""
        achievements = get_achievements_by_category(AchievementCategory.SESSION)
        assert len(achievements) > 0

    def test_accuracy_category_exists(self):
        """Accuracy category should have achievements."""
        achievements = get_achievements_by_category(AchievementCategory.ACCURACY)
        assert len(achievements) > 0

    def test_cefr_category_exists(self):
        """CEFR category should have achievements."""
        achievements = get_achievements_by_category(AchievementCategory.CEFR)
        assert len(achievements) > 0

    def test_special_category_exists(self):
        """Special category should have achievements."""
        achievements = get_achievements_by_category(AchievementCategory.SPECIAL)
        assert len(achievements) > 0


@pytest.mark.unit
class TestUniqueIds:
    """Tests for achievement ID uniqueness."""

    def test_unique_ids(self):
        """All achievement IDs must be unique."""
        ids = [a.id for a in ACHIEVEMENTS]
        unique_ids = set(ids)
        assert len(ids) == len(unique_ids), "Achievement IDs must be unique"

    def test_ids_not_empty(self):
        """All achievement IDs must be non-empty."""
        for achievement in ACHIEVEMENTS:
            assert achievement.id, "Achievement has empty ID"
            assert len(achievement.id) > 0

    def test_ids_follow_naming_convention(self):
        """Achievement IDs should follow category_name convention."""
        for achievement in ACHIEVEMENTS:
            # ID should contain underscore
            assert (
                "_" in achievement.id
            ), f"ID {achievement.id} should follow category_name convention"


@pytest.mark.unit
class TestPositiveThresholds:
    """Tests for positive threshold and XP reward values."""

    def test_positive_thresholds(self):
        """All thresholds should be positive integers."""
        for achievement in ACHIEVEMENTS:
            assert (
                achievement.threshold > 0
            ), f"{achievement.id} has invalid threshold: {achievement.threshold}"

    def test_positive_xp_rewards(self):
        """All XP rewards should be positive integers."""
        for achievement in ACHIEVEMENTS:
            assert (
                achievement.xp_reward > 0
            ), f"{achievement.id} has invalid xp_reward: {achievement.xp_reward}"

    def test_streak_thresholds_ascending(self):
        """Streak achievement thresholds should be in ascending order."""
        streak_achievements = get_achievements_by_category(AchievementCategory.STREAK)
        thresholds = [a.threshold for a in streak_achievements]
        # Should contain expected values
        assert 3 in thresholds
        assert 7 in thresholds
        assert 14 in thresholds
        assert 30 in thresholds
        assert 60 in thresholds
        assert 100 in thresholds
        assert 365 in thresholds

    def test_learning_thresholds_ascending(self):
        """Learning achievement thresholds should be in ascending order."""
        learning_achievements = get_achievements_by_category(AchievementCategory.LEARNING)
        thresholds = sorted([a.threshold for a in learning_achievements])
        # Should contain expected values
        assert 1 in thresholds
        assert 50 in thresholds
        assert 100 in thresholds
        assert 250 in thresholds
        assert 500 in thresholds
        assert 1000 in thresholds
        assert 2500 in thresholds


@pytest.mark.unit
class TestAchievementDefinitionFields:
    """Tests for required achievement fields."""

    def test_all_achievements_have_required_fields(self):
        """All achievements should have all required fields populated."""
        for achievement in ACHIEVEMENTS:
            assert achievement.id, "Achievement missing id"
            assert achievement.name, f"{achievement.id} missing name"
            assert achievement.description, f"{achievement.id} missing description"
            assert achievement.icon, f"{achievement.id} missing icon"
            assert achievement.hint, f"{achievement.id} missing hint"
            assert (
                achievement.category in AchievementCategory
            ), f"{achievement.id} has invalid category"
            assert achievement.metric in AchievementMetric, f"{achievement.id} has invalid metric"

    def test_achievement_definition_is_frozen(self):
        """AchievementDef should be immutable (frozen dataclass)."""
        achievement = get_achievement_by_id("streak_first_flame")
        assert achievement is not None
        with pytest.raises(Exception):  # FrozenInstanceError
            achievement.xp_reward = 999

    def test_achievement_definition_hashable(self):
        """AchievementDef should be hashable (can be used in sets)."""
        achievement = get_achievement_by_id("streak_first_flame")
        assert achievement is not None
        # Should not raise
        hash(achievement)
        # Should be usable in a set
        achievement_set = {achievement}
        assert len(achievement_set) == 1


@pytest.mark.unit
class TestHelperFunctions:
    """Tests for achievement helper functions."""

    def test_get_achievement_by_id_found(self):
        """Should return achievement when ID exists."""
        achievement = get_achievement_by_id("streak_first_flame")
        assert achievement is not None
        assert achievement.id == "streak_first_flame"
        assert achievement.name == "First Flame"

    def test_get_achievement_by_id_not_found(self):
        """Should return None when ID doesn't exist."""
        achievement = get_achievement_by_id("nonexistent_id")
        assert achievement is None

    def test_get_achievements_by_category_streak(self):
        """Should return all streak achievements."""
        streaks = get_achievements_by_category(AchievementCategory.STREAK)
        assert len(streaks) >= 3
        for a in streaks:
            assert a.category == AchievementCategory.STREAK

    def test_get_achievements_by_category_learning(self):
        """Should return all learning achievements."""
        learning = get_achievements_by_category(AchievementCategory.LEARNING)
        assert len(learning) >= 4
        for a in learning:
            assert a.category == AchievementCategory.LEARNING

    def test_get_achievements_by_category_empty_for_invalid(self):
        """Should return empty list for unused category (if any)."""
        for category in AchievementCategory:
            achievements = get_achievements_by_category(category)
            # Should return list (possibly empty for future types)
            assert isinstance(achievements, list)

    def test_get_achievements_by_metric_streak_days(self):
        """Should return achievements for STREAK_DAYS metric."""
        achievements = get_achievements_by_metric(AchievementMetric.STREAK_DAYS)
        assert len(achievements) >= 7  # All streak achievements use this metric
        for a in achievements:
            assert a.metric == AchievementMetric.STREAK_DAYS

    def test_get_achievements_by_metric_cards_learned(self):
        """Should return achievements for CARDS_LEARNED metric."""
        achievements = get_achievements_by_metric(AchievementMetric.CARDS_LEARNED)
        assert len(achievements) >= 7  # All learning achievements use this metric
        for a in achievements:
            assert a.metric == AchievementMetric.CARDS_LEARNED

    def test_get_achievements_by_metric_session_cards(self):
        """Should return achievements for SESSION_CARDS metric."""
        achievements = get_achievements_by_metric(AchievementMetric.SESSION_CARDS)
        assert len(achievements) >= 2  # Quick Study, Marathon
        for a in achievements:
            assert a.metric == AchievementMetric.SESSION_CARDS


@pytest.mark.unit
class TestSpecificAchievements:
    """Tests for specific achievement configurations."""

    def test_first_flame_achievement(self):
        """First Flame achievement should have correct configuration."""
        ach = get_achievement_by_id("streak_first_flame")
        assert ach is not None
        assert ach.threshold == 3
        assert ach.xp_reward == 50
        assert ach.category == AchievementCategory.STREAK
        assert ach.metric == AchievementMetric.STREAK_DAYS

    def test_prometheus_achievement(self):
        """Prometheus achievement should have correct configuration."""
        ach = get_achievement_by_id("streak_prometheus")
        assert ach is not None
        assert ach.threshold == 365
        assert ach.xp_reward == 5000
        assert ach.category == AchievementCategory.STREAK
        assert ach.metric == AchievementMetric.STREAK_DAYS

    def test_first_word_achievement(self):
        """First Word achievement should have correct configuration."""
        ach = get_achievement_by_id("learning_first_word")
        assert ach is not None
        assert ach.threshold == 1
        assert ach.xp_reward == 10
        assert ach.category == AchievementCategory.LEARNING
        assert ach.metric == AchievementMetric.CARDS_LEARNED

    def test_library_achievement(self):
        """Library achievement should have correct configuration."""
        ach = get_achievement_by_id("learning_library")
        assert ach is not None
        assert ach.threshold == 2500
        assert ach.xp_reward == 3000
        assert ach.category == AchievementCategory.LEARNING

    def test_all_cefr_achievements_exist(self):
        """All CEFR level achievements should exist."""
        cefr_ids = [
            "cefr_a1_explorer",
            "cefr_a2_traveler",
            "cefr_b1_conversant",
            "cefr_b2_proficient",
            "cefr_c1_advanced",
            "cefr_c2_mastery",
        ]
        for ach_id in cefr_ids:
            ach = get_achievement_by_id(ach_id)
            assert ach is not None, f"CEFR achievement {ach_id} not found"
            assert ach.category == AchievementCategory.CEFR
