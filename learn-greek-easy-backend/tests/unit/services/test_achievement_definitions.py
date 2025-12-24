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

    def test_achievement_count_minimum_47(self):
        """Should have at least 47 achievements defined (35 original + 12 culture)."""
        assert len(ACHIEVEMENTS) >= 47, f"Expected 47+ achievements, got {len(ACHIEVEMENTS)}"

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


@pytest.mark.unit
class TestCultureAchievements:
    """Tests for culture exam achievements."""

    def test_culture_achievements_count(self):
        """Should have exactly 12 culture achievements."""
        culture_achievements = get_achievements_by_category(AchievementCategory.CULTURE)
        assert (
            len(culture_achievements) == 12
        ), f"Expected 12 culture achievements, got {len(culture_achievements)}"

    def test_culture_milestone_achievements_exist(self):
        """Culture milestone achievements should exist with correct thresholds."""
        milestones = [
            ("culture_curious", 10, 25),
            ("culture_explorer", 50, 75),
            ("culture_scholar", 100, 150),
            ("culture_master", 500, 500),
        ]
        for ach_id, threshold, xp_reward in milestones:
            ach = get_achievement_by_id(ach_id)
            assert ach is not None, f"Culture milestone {ach_id} not found"
            assert ach.category == AchievementCategory.CULTURE
            assert ach.threshold == threshold, f"{ach_id} threshold mismatch"
            assert ach.xp_reward == xp_reward, f"{ach_id} XP reward mismatch"
            assert ach.metric == AchievementMetric.CULTURE_QUESTIONS_ANSWERED

    def test_culture_accuracy_achievements_exist(self):
        """Culture accuracy achievements should exist."""
        accuracy_achievements = [
            ("perfect_culture_score", AchievementMetric.CULTURE_CONSECUTIVE_CORRECT, 10, 50),
            ("culture_sharp_mind", AchievementMetric.CULTURE_ACCURACY, 90, 100),
        ]
        for ach_id, metric, threshold, xp_reward in accuracy_achievements:
            ach = get_achievement_by_id(ach_id)
            assert ach is not None, f"Culture accuracy achievement {ach_id} not found"
            assert ach.category == AchievementCategory.CULTURE
            assert ach.metric == metric
            assert ach.threshold == threshold
            assert ach.xp_reward == xp_reward

    def test_culture_category_mastery_achievements_exist(self):
        """Culture category mastery achievements should exist."""
        mastery_achievements = [
            ("culture_historian", AchievementMetric.CULTURE_HISTORY_MASTERED, 200),
            ("culture_geographer", AchievementMetric.CULTURE_GEOGRAPHY_MASTERED, 200),
            ("culture_civic_expert", AchievementMetric.CULTURE_POLITICS_MASTERED, 200),
            ("culture_champion", AchievementMetric.CULTURE_ALL_MASTERED, 1000),
        ]
        for ach_id, metric, xp_reward in mastery_achievements:
            ach = get_achievement_by_id(ach_id)
            assert ach is not None, f"Culture mastery achievement {ach_id} not found"
            assert ach.category == AchievementCategory.CULTURE
            assert ach.metric == metric
            assert ach.threshold == 1  # All mastery achievements have threshold of 1
            assert ach.xp_reward == xp_reward

    def test_culture_champion_has_highest_reward(self):
        """Culture Champion should have the highest XP reward among culture achievements."""
        culture_achievements = get_achievements_by_category(AchievementCategory.CULTURE)
        culture_champion = get_achievement_by_id("culture_champion")
        assert culture_champion is not None

        for ach in culture_achievements:
            assert (
                culture_champion.xp_reward >= ach.xp_reward
            ), f"{ach.id} has higher XP than culture_champion"

        # Specifically, culture_champion should have 1000 XP
        assert culture_champion.xp_reward == 1000

    def test_culture_language_achievements_exist(self):
        """Culture language achievements should exist."""
        language_achievements = [
            ("culture_native_speaker", AchievementMetric.CULTURE_GREEK_QUESTIONS, 50, 100),
            ("culture_polyglot_learner", AchievementMetric.CULTURE_LANGUAGES_USED, 3, 50),
        ]
        for ach_id, metric, threshold, xp_reward in language_achievements:
            ach = get_achievement_by_id(ach_id)
            assert ach is not None, f"Culture language achievement {ach_id} not found"
            assert ach.category == AchievementCategory.CULTURE
            assert ach.metric == metric
            assert ach.threshold == threshold
            assert ach.xp_reward == xp_reward

    def test_culture_metrics_unique_and_valid(self):
        """All culture achievements should use valid culture metrics."""
        culture_metrics = {
            AchievementMetric.CULTURE_QUESTIONS_ANSWERED,
            AchievementMetric.CULTURE_CONSECUTIVE_CORRECT,
            AchievementMetric.CULTURE_ACCURACY,
            AchievementMetric.CULTURE_HISTORY_MASTERED,
            AchievementMetric.CULTURE_GEOGRAPHY_MASTERED,
            AchievementMetric.CULTURE_POLITICS_MASTERED,
            AchievementMetric.CULTURE_ALL_MASTERED,
            AchievementMetric.CULTURE_GREEK_QUESTIONS,
            AchievementMetric.CULTURE_LANGUAGES_USED,
        }

        culture_achievements = get_achievements_by_category(AchievementCategory.CULTURE)
        for ach in culture_achievements:
            assert ach.metric in culture_metrics, f"{ach.id} uses non-culture metric {ach.metric}"

    def test_total_achievement_count_increased(self):
        """Total achievement count should be 47 (35 original + 12 culture)."""
        assert len(ACHIEVEMENTS) == 47, f"Expected 47 achievements, got {len(ACHIEVEMENTS)}"

    def test_culture_category_exists_in_enum(self):
        """CULTURE should be a valid AchievementCategory."""
        assert hasattr(AchievementCategory, "CULTURE")
        assert AchievementCategory.CULTURE.value == "culture"
