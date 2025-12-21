"""Unit tests for XP constants and level functions.

Tests cover:
- XP constant values
- Level definitions (15 levels, increasing XP requirements)
- get_level_from_xp boundary testing
- get_xp_progress_in_level calculations
"""

import pytest

from src.services.xp_constants import (
    LEVELS,
    MAX_LEVEL,
    XP_CORRECT_ANSWER,
    XP_DAILY_GOAL,
    XP_FIRST_REVIEW,
    XP_PERFECT_ANSWER,
    XP_SESSION_COMPLETE,
    XP_STREAK_MULTIPLIER,
    get_level_definition,
    get_level_from_xp,
    get_xp_for_next_level,
    get_xp_progress_in_level,
)


@pytest.mark.unit
class TestXPConstants:
    """Tests for XP constant values."""

    def test_xp_correct_answer_value(self):
        """XP_CORRECT_ANSWER should be 10."""
        assert XP_CORRECT_ANSWER == 10

    def test_xp_perfect_answer_value(self):
        """XP_PERFECT_ANSWER should be 15."""
        assert XP_PERFECT_ANSWER == 15

    def test_xp_daily_goal_value(self):
        """XP_DAILY_GOAL should be 50."""
        assert XP_DAILY_GOAL == 50

    def test_xp_session_complete_value(self):
        """XP_SESSION_COMPLETE should be 25."""
        assert XP_SESSION_COMPLETE == 25

    def test_xp_first_review_value(self):
        """XP_FIRST_REVIEW should be 20."""
        assert XP_FIRST_REVIEW == 20

    def test_xp_streak_multiplier_value(self):
        """XP_STREAK_MULTIPLIER should be 10."""
        assert XP_STREAK_MULTIPLIER == 10


@pytest.mark.unit
class TestLevelDefinitions:
    """Tests for level definitions."""

    def test_has_15_levels(self):
        """There should be exactly 15 levels."""
        assert len(LEVELS) == 15

    def test_max_level_is_15(self):
        """MAX_LEVEL should be 15."""
        assert MAX_LEVEL == 15

    def test_levels_are_numbered_1_to_15(self):
        """Levels should be numbered from 1 to 15."""
        for i, level in enumerate(LEVELS, start=1):
            assert level.level == i

    def test_xp_requirements_are_increasing(self):
        """Total XP requirements should be strictly increasing."""
        for i in range(1, len(LEVELS)):
            assert LEVELS[i].total_xp > LEVELS[i - 1].total_xp

    def test_level_1_starts_at_0_xp(self):
        """Level 1 should require 0 XP."""
        assert LEVELS[0].total_xp == 0
        assert LEVELS[0].xp_required == 0

    def test_level_15_requires_100000_xp(self):
        """Level 15 should require 100,000 total XP."""
        assert LEVELS[14].total_xp == 100000

    def test_all_levels_have_greek_names(self):
        """All levels should have Greek names."""
        for level in LEVELS:
            assert level.name_greek is not None
            assert len(level.name_greek) > 0

    def test_all_levels_have_english_names(self):
        """All levels should have English names."""
        for level in LEVELS:
            assert level.name_english is not None
            assert len(level.name_english) > 0

    def test_level_1_is_beginner(self):
        """Level 1 should be Beginner/Archarios."""
        assert LEVELS[0].name_english == "Beginner"
        assert LEVELS[0].name_greek == "Αρχάριος"

    def test_level_15_is_polyglot(self):
        """Level 15 should be Polyglot/Polyglottos."""
        assert LEVELS[14].name_english == "Polyglot"
        assert LEVELS[14].name_greek == "Πολύγλωσσος"

    def test_xp_required_matches_difference(self):
        """xp_required should match difference between consecutive levels."""
        for i in range(1, len(LEVELS)):
            expected_required = LEVELS[i].total_xp - LEVELS[i - 1].total_xp
            assert LEVELS[i].xp_required == expected_required


@pytest.mark.unit
class TestGetLevelFromXP:
    """Tests for get_level_from_xp function."""

    def test_0_xp_is_level_1(self):
        """0 XP should return level 1."""
        assert get_level_from_xp(0) == 1

    def test_negative_xp_is_level_1(self):
        """Negative XP should return level 1."""
        assert get_level_from_xp(-100) == 1

    def test_99_xp_is_level_1(self):
        """99 XP (just below level 2) should return level 1."""
        assert get_level_from_xp(99) == 1

    def test_100_xp_is_level_2(self):
        """100 XP (exactly at level 2 threshold) should return level 2."""
        assert get_level_from_xp(100) == 2

    def test_349_xp_is_level_2(self):
        """349 XP (just below level 3) should return level 2."""
        assert get_level_from_xp(349) == 2

    def test_350_xp_is_level_3(self):
        """350 XP (exactly at level 3 threshold) should return level 3."""
        assert get_level_from_xp(350) == 3

    def test_all_level_boundaries(self):
        """Test all level boundaries return correct level."""
        for level_def in LEVELS:
            assert get_level_from_xp(level_def.total_xp) == level_def.level

    def test_just_below_each_level(self):
        """Test XP just below each level threshold."""
        for i in range(1, len(LEVELS)):
            xp_just_below = LEVELS[i].total_xp - 1
            expected_level = LEVELS[i - 1].level
            assert get_level_from_xp(xp_just_below) == expected_level

    def test_99999_xp_is_level_14(self):
        """99999 XP (just below max level) should return level 14."""
        assert get_level_from_xp(99999) == 14

    def test_100000_xp_is_level_15(self):
        """100,000 XP should return max level 15."""
        assert get_level_from_xp(100000) == 15

    def test_max_xp_is_level_15(self):
        """Very high XP should still return level 15."""
        assert get_level_from_xp(1000000) == 15


@pytest.mark.unit
class TestGetLevelDefinition:
    """Tests for get_level_definition function."""

    def test_returns_correct_level_1(self):
        """Level 1 returns correct definition."""
        level = get_level_definition(1)
        assert level.level == 1
        assert level.name_english == "Beginner"

    def test_returns_correct_level_15(self):
        """Level 15 returns correct definition."""
        level = get_level_definition(15)
        assert level.level == 15
        assert level.name_english == "Polyglot"

    def test_returns_correct_level_8(self):
        """Level 8 (Teacher) returns correct definition."""
        level = get_level_definition(8)
        assert level.level == 8
        assert level.name_english == "Teacher"
        assert level.name_greek == "Δάσκαλος"

    def test_level_below_1_returns_level_1(self):
        """Level below 1 returns level 1 definition."""
        level = get_level_definition(0)
        assert level.level == 1

        level = get_level_definition(-5)
        assert level.level == 1

    def test_level_above_max_returns_max(self):
        """Level above max returns max level definition."""
        level = get_level_definition(16)
        assert level.level == 15

        level = get_level_definition(100)
        assert level.level == 15


@pytest.mark.unit
class TestGetXPForNextLevel:
    """Tests for get_xp_for_next_level function."""

    def test_level_1_needs_100_for_next(self):
        """Level 1 needs 100 XP to reach level 2."""
        assert get_xp_for_next_level(1) == 100

    def test_level_2_needs_350_for_next(self):
        """Level 2 needs 350 total XP to reach level 3."""
        assert get_xp_for_next_level(2) == 350

    def test_level_14_needs_100000_for_next(self):
        """Level 14 needs 100,000 total XP to reach level 15."""
        assert get_xp_for_next_level(14) == 100000

    def test_max_level_returns_max_threshold(self):
        """Max level returns max threshold (no next level)."""
        assert get_xp_for_next_level(15) == 100000

    def test_above_max_level_returns_max_threshold(self):
        """Above max level still returns max threshold."""
        assert get_xp_for_next_level(20) == 100000


@pytest.mark.unit
class TestGetXPProgressInLevel:
    """Tests for get_xp_progress_in_level function."""

    def test_level_1_with_50_xp(self):
        """At level 1 with 50 XP, progress is 50/100."""
        progress, needed = get_xp_progress_in_level(50, 1)
        assert progress == 50
        assert needed == 100

    def test_level_1_with_0_xp(self):
        """At level 1 with 0 XP, progress is 0/100."""
        progress, needed = get_xp_progress_in_level(0, 1)
        assert progress == 0
        assert needed == 100

    def test_level_2_with_200_xp(self):
        """At level 2 with 200 XP, progress is 100/250."""
        # Level 2 starts at 100, level 3 at 350
        # Progress = 200 - 100 = 100
        # Needed = 350 - 100 = 250
        progress, needed = get_xp_progress_in_level(200, 2)
        assert progress == 100
        assert needed == 250

    def test_max_level_returns_zero(self):
        """At max level, progress is (0, 0)."""
        progress, needed = get_xp_progress_in_level(100000, 15)
        assert progress == 0
        assert needed == 0

    def test_above_max_level_returns_zero(self):
        """Above max level, progress is (0, 0)."""
        progress, needed = get_xp_progress_in_level(150000, 15)
        assert progress == 0
        assert needed == 0

    def test_at_level_boundary(self):
        """At exact level boundary, progress is 0."""
        # At exactly 100 XP (level 2 start)
        progress, needed = get_xp_progress_in_level(100, 2)
        assert progress == 0
        assert needed == 250

    def test_just_before_level_up(self):
        """Just before level up, progress is near max."""
        # At 349 XP (level 2, just before level 3)
        progress, needed = get_xp_progress_in_level(349, 2)
        assert progress == 249
        assert needed == 250
