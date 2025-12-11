"""Unit tests for SM-2 core algorithm functions.

Tests cover:
- calculate_easiness_factor: EF updates based on quality ratings
- calculate_interval: Interval and repetition calculations
- determine_status: Card status transitions
- calculate_sm2: Full SM-2 calculation orchestration
- calculate_next_review_date: Date arithmetic
- Edge cases and error handling

Acceptance Criteria tested:
- AC #1: All EF calculation paths tested
- AC #2: All interval calculation paths tested
- AC #3: All status transition paths tested
- AC #4: Edge cases covered
- AC #5: Invalid input handling tested
"""

from datetime import date, timedelta

import pytest

from src.core.sm2 import (
    DEFAULT_EASINESS_FACTOR,
    LEARNING_REPETITIONS_THRESHOLD,
    MASTERY_EF_THRESHOLD,
    MASTERY_INTERVAL_THRESHOLD,
    MIN_EASINESS_FACTOR,
    calculate_easiness_factor,
    calculate_interval,
    calculate_next_review_date,
    calculate_sm2,
    determine_status,
)
from src.db.models import CardStatus


@pytest.mark.unit
@pytest.mark.sm2
class TestCalculateEasinessFactor:
    """Tests for calculate_easiness_factor function.

    The SM-2 formula for EF adjustment:
    EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))

    Quality impact:
    - q=5: +0.10
    - q=4: +0.00
    - q=3: -0.14
    - q=2: -0.32
    - q=1: -0.54
    - q=0: -0.80
    """

    def test_perfect_recall_increases_ef(self):
        """q=5 (perfect) increases EF by 0.10."""
        initial_ef = 2.5
        new_ef = calculate_easiness_factor(initial_ef, quality=5)

        assert new_ef == pytest.approx(2.6)
        assert new_ef > initial_ef

    def test_correct_hesitant_maintains_ef(self):
        """q=4 (correct with hesitation) maintains EF unchanged."""
        initial_ef = 2.5
        new_ef = calculate_easiness_factor(initial_ef, quality=4)

        assert new_ef == pytest.approx(2.5)

    def test_correct_hard_decreases_ef_slightly(self):
        """q=3 (correct but difficult) decreases EF by 0.14."""
        initial_ef = 2.5
        new_ef = calculate_easiness_factor(initial_ef, quality=3)

        assert new_ef == pytest.approx(2.36)
        assert new_ef < initial_ef

    def test_incorrect_responses_decrease_ef_q2(self):
        """q=2 (incorrect, easy to recall) decreases EF by 0.32."""
        initial_ef = 2.5
        new_ef = calculate_easiness_factor(initial_ef, quality=2)

        assert new_ef == pytest.approx(2.18)

    def test_incorrect_responses_decrease_ef_q1(self):
        """q=1 (incorrect, seemed familiar) decreases EF by 0.54."""
        initial_ef = 2.5
        new_ef = calculate_easiness_factor(initial_ef, quality=1)

        assert new_ef == pytest.approx(1.96)

    def test_incorrect_responses_decrease_ef_q0(self):
        """q=0 (complete blackout) decreases EF by 0.80."""
        initial_ef = 2.5
        new_ef = calculate_easiness_factor(initial_ef, quality=0)

        assert new_ef == pytest.approx(1.7)

    def test_ef_minimum_bound_enforced(self):
        """EF never goes below MIN_EASINESS_FACTOR (1.3)."""
        # Start with low EF
        initial_ef = 1.4
        # Complete blackout should try to reduce by 0.80
        new_ef = calculate_easiness_factor(initial_ef, quality=0)

        # Should be clamped at minimum
        assert new_ef == MIN_EASINESS_FACTOR
        assert new_ef == 1.3

    def test_ef_minimum_bound_with_already_minimum_ef(self):
        """EF at minimum stays at minimum after failure."""
        initial_ef = MIN_EASINESS_FACTOR
        new_ef = calculate_easiness_factor(initial_ef, quality=0)

        assert new_ef == MIN_EASINESS_FACTOR

    def test_ef_can_exceed_default(self):
        """EF can grow above DEFAULT_EASINESS_FACTOR (2.5)."""
        initial_ef = 2.8
        new_ef = calculate_easiness_factor(initial_ef, quality=5)

        assert new_ef == pytest.approx(2.9)
        assert new_ef > DEFAULT_EASINESS_FACTOR

    def test_ef_growth_with_consecutive_perfect_scores(self):
        """EF grows progressively with consecutive q=5 ratings."""
        ef = 2.5
        expected_values = [2.6, 2.7, 2.8, 2.9, 3.0]

        for expected in expected_values:
            ef = calculate_easiness_factor(ef, quality=5)
            assert ef == pytest.approx(expected)


@pytest.mark.unit
@pytest.mark.sm2
class TestCalculateInterval:
    """Tests for calculate_interval function.

    Interval progression:
    - First successful review: interval=1 day
    - Second successful review: interval=6 days
    - Subsequent: interval = round(previous_interval * EF)
    - Failed recall (q<3): reset to interval=1, repetitions=0
    """

    def test_first_successful_review_returns_one(self):
        """First successful review (rep=0, q>=3) returns interval=1."""
        interval, reps = calculate_interval(
            current_interval=0,
            current_repetitions=0,
            easiness_factor=2.5,
            quality=4,
        )

        assert interval == 1
        assert reps == 1

    def test_second_successful_review_returns_six(self):
        """Second successful review (rep=1, q>=3) returns interval=6."""
        interval, reps = calculate_interval(
            current_interval=1,
            current_repetitions=1,
            easiness_factor=2.5,
            quality=4,
        )

        assert interval == 6
        assert reps == 2

    def test_subsequent_reviews_use_ef_multiplier(self):
        """Reviews after second use interval * EF."""
        # Third review: 6 * 2.5 = 15
        interval, reps = calculate_interval(
            current_interval=6,
            current_repetitions=2,
            easiness_factor=2.5,
            quality=4,
        )

        assert interval == 15  # round(6 * 2.5)
        assert reps == 3

    def test_subsequent_reviews_with_different_ef(self):
        """Verify EF affects interval calculation correctly."""
        # With EF=2.0, interval should be 6 * 2.0 = 12
        interval, reps = calculate_interval(
            current_interval=6,
            current_repetitions=2,
            easiness_factor=2.0,
            quality=4,
        )

        assert interval == 12
        assert reps == 3

    def test_failed_review_resets_progress(self):
        """Failed recall (q<3) resets to interval=1, repetitions=0."""
        for quality in [0, 1, 2]:
            interval, reps = calculate_interval(
                current_interval=15,
                current_repetitions=4,
                easiness_factor=2.5,
                quality=quality,
            )

            assert interval == 1
            assert reps == 0

    def test_quality_three_counts_as_successful(self):
        """q=3 is threshold for success, should not reset."""
        interval, reps = calculate_interval(
            current_interval=6,
            current_repetitions=2,
            easiness_factor=2.36,  # Typical EF after q=3
            quality=3,
        )

        # Should progress, not reset
        assert interval == round(6 * 2.36)  # 14
        assert reps == 3

    def test_long_interval_progression(self):
        """Test interval growth over multiple reviews."""
        ef = 2.5
        interval = 0
        reps = 0

        # First review
        interval, reps = calculate_interval(interval, reps, ef, 4)
        assert interval == 1

        # Second review
        interval, reps = calculate_interval(interval, reps, ef, 4)
        assert interval == 6

        # Third review: 6 * 2.5 = 15
        interval, reps = calculate_interval(interval, reps, ef, 4)
        assert interval == 15

        # Fourth review: 15 * 2.5 = 37.5 -> 38
        interval, reps = calculate_interval(interval, reps, ef, 4)
        assert interval == 38

        # Fifth review: 38 * 2.5 = 95
        interval, reps = calculate_interval(interval, reps, ef, 4)
        assert interval == 95


@pytest.mark.unit
@pytest.mark.sm2
class TestDetermineStatus:
    """Tests for determine_status function.

    Status transitions:
    - LEARNING: reps < 3 or q < 3
    - REVIEW: reps >= 3 but not meeting mastery criteria
    - MASTERED: EF >= 2.3 AND interval >= 21
    """

    def test_failed_recall_sets_learning(self):
        """Failed recall (q<3) always results in LEARNING status."""
        for quality in [0, 1, 2]:
            status = determine_status(
                repetitions=5,
                easiness_factor=2.5,
                interval=30,
                quality=quality,
            )
            assert status == CardStatus.LEARNING

    def test_early_reps_stay_learning(self):
        """Cards with reps < 3 stay in LEARNING."""
        for reps in [0, 1, 2]:
            status = determine_status(
                repetitions=reps,
                easiness_factor=2.5,
                interval=6,
                quality=4,
            )
            assert status == CardStatus.LEARNING

    def test_three_plus_reps_transitions_to_review(self):
        """Cards with 3+ reps transition to REVIEW (if not mastered)."""
        status = determine_status(
            repetitions=3,
            easiness_factor=2.5,
            interval=15,
            quality=4,
        )
        assert status == CardStatus.REVIEW

    def test_mastery_requires_ef_and_interval(self):
        """MASTERED requires EF >= 2.3 AND interval >= 21."""
        status = determine_status(
            repetitions=5,
            easiness_factor=MASTERY_EF_THRESHOLD,  # 2.3
            interval=MASTERY_INTERVAL_THRESHOLD,  # 21
            quality=4,
        )
        assert status == CardStatus.MASTERED

    def test_high_ef_low_interval_not_mastered(self):
        """High EF but low interval -> REVIEW, not MASTERED."""
        status = determine_status(
            repetitions=5,
            easiness_factor=2.5,  # >= 2.3
            interval=15,  # < 21
            quality=4,
        )
        assert status == CardStatus.REVIEW

    def test_low_ef_high_interval_not_mastered(self):
        """High interval but low EF -> REVIEW, not MASTERED."""
        status = determine_status(
            repetitions=5,
            easiness_factor=2.0,  # < 2.3
            interval=30,  # >= 21
            quality=4,
        )
        assert status == CardStatus.REVIEW

    def test_mastery_boundary_conditions(self):
        """Test exact boundary values for mastery."""
        # Exactly at threshold - should be MASTERED
        status = determine_status(
            repetitions=3,
            easiness_factor=2.3,
            interval=21,
            quality=4,
        )
        assert status == CardStatus.MASTERED

        # Just below EF threshold - should be REVIEW
        status = determine_status(
            repetitions=3,
            easiness_factor=2.29,
            interval=21,
            quality=4,
        )
        assert status == CardStatus.REVIEW

        # Just below interval threshold - should be REVIEW
        status = determine_status(
            repetitions=3,
            easiness_factor=2.3,
            interval=20,
            quality=4,
        )
        assert status == CardStatus.REVIEW


@pytest.mark.unit
@pytest.mark.sm2
class TestCalculateSM2:
    """Tests for calculate_sm2 function - the main orchestrator."""

    def test_first_perfect_review(self):
        """New card with perfect review (q=5)."""
        result = calculate_sm2(
            current_ef=DEFAULT_EASINESS_FACTOR,
            current_interval=0,
            current_repetitions=0,
            quality=5,
        )

        assert result.new_easiness_factor == pytest.approx(2.6)
        assert result.new_interval == 1
        assert result.new_repetitions == 1
        assert result.new_status == CardStatus.LEARNING

    def test_failed_review_resets_all(self):
        """Failed review (q<3) resets interval and reps, updates EF."""
        result = calculate_sm2(
            current_ef=2.5,
            current_interval=15,
            current_repetitions=4,
            quality=2,
        )

        # EF should decrease
        assert result.new_easiness_factor == pytest.approx(2.18)
        # Interval and reps reset
        assert result.new_interval == 1
        assert result.new_repetitions == 0
        # Status becomes LEARNING
        assert result.new_status == CardStatus.LEARNING

    def test_path_to_mastery_simulation(self):
        """Simulate reviews to achieve mastery."""
        ef = DEFAULT_EASINESS_FACTOR
        interval = 0
        reps = 0

        # Review 1: q=5
        result = calculate_sm2(ef, interval, reps, quality=5)
        ef, interval, reps = (
            result.new_easiness_factor,
            result.new_interval,
            result.new_repetitions,
        )
        assert result.new_status == CardStatus.LEARNING
        assert reps == 1
        assert interval == 1

        # Review 2: q=5
        result = calculate_sm2(ef, interval, reps, quality=5)
        ef, interval, reps = (
            result.new_easiness_factor,
            result.new_interval,
            result.new_repetitions,
        )
        assert result.new_status == CardStatus.LEARNING
        assert reps == 2
        assert interval == 6

        # Review 3: q=5 -> transitions to REVIEW (reps=3)
        # EF: 2.7, Interval: round(6 * 2.7) = 16
        result = calculate_sm2(ef, interval, reps, quality=5)
        ef, interval, reps = (
            result.new_easiness_factor,
            result.new_interval,
            result.new_repetitions,
        )
        assert reps == 3
        assert result.new_status == CardStatus.REVIEW  # interval=16 < 21, so REVIEW

        # Review 4: q=5
        # EF: 2.8, Interval: round(16 * 2.8) = 45
        result = calculate_sm2(ef, interval, reps, quality=5)
        ef, interval, reps = (
            result.new_easiness_factor,
            result.new_interval,
            result.new_repetitions,
        )
        # At this point: EF should be 2.8 (>= 2.3), interval should be 45 (>= 21)
        # So card becomes MASTERED here (not review 5 or 6 as originally thought)
        assert result.new_status == CardStatus.MASTERED
        assert result.new_easiness_factor >= MASTERY_EF_THRESHOLD
        assert result.new_interval >= MASTERY_INTERVAL_THRESHOLD

    def test_invalid_quality_raises_valueerror_negative(self):
        """Invalid quality (-1) raises ValueError."""
        with pytest.raises(ValueError) as exc_info:
            calculate_sm2(
                current_ef=2.5,
                current_interval=0,
                current_repetitions=0,
                quality=-1,
            )

        assert "Quality must be 0-5" in str(exc_info.value)
        assert "-1" in str(exc_info.value)

    def test_invalid_quality_raises_valueerror_high(self):
        """Invalid quality (6) raises ValueError."""
        with pytest.raises(ValueError) as exc_info:
            calculate_sm2(
                current_ef=2.5,
                current_interval=0,
                current_repetitions=0,
                quality=6,
            )

        assert "Quality must be 0-5" in str(exc_info.value)
        assert "6" in str(exc_info.value)

    def test_all_quality_values_accepted(self):
        """All valid quality values (0-5) are accepted."""
        for quality in range(6):
            result = calculate_sm2(
                current_ef=2.5,
                current_interval=0,
                current_repetitions=0,
                quality=quality,
            )
            assert result is not None


@pytest.mark.unit
@pytest.mark.sm2
class TestEdgeCases:
    """Edge case and stress tests for SM-2 algorithm."""

    def test_fifty_consecutive_failures(self):
        """EF stays at minimum (1.3) after many consecutive failures."""
        ef = DEFAULT_EASINESS_FACTOR
        interval = 0
        reps = 0

        # 50 failures with q=0
        for _ in range(50):
            result = calculate_sm2(ef, interval, reps, quality=0)
            ef = result.new_easiness_factor
            interval = result.new_interval
            reps = result.new_repetitions

        # EF should be at minimum
        assert ef == MIN_EASINESS_FACTOR
        # Interval and reps should be reset
        assert interval == 1
        assert reps == 0
        # Status should be LEARNING
        assert result.new_status == CardStatus.LEARNING

    def test_alternating_success_failure(self):
        """Verify behavior with alternating success/failure pattern."""
        ef = DEFAULT_EASINESS_FACTOR
        interval = 0
        reps = 0

        # Alternating pattern: success, failure, success, failure...
        for i in range(10):
            quality = 5 if i % 2 == 0 else 0
            result = calculate_sm2(ef, interval, reps, quality=quality)
            ef = result.new_easiness_factor
            interval = result.new_interval
            reps = result.new_repetitions

        # EF should have decreased due to failures
        assert ef < DEFAULT_EASINESS_FACTOR
        # After failure, reps reset to 0
        assert reps == 0
        # Status should be LEARNING due to resets
        assert result.new_status == CardStatus.LEARNING

    def test_ef_precision_no_floating_point_errors(self):
        """Test that EF calculations don't accumulate floating point errors."""
        ef = 2.5

        # Apply many calculations
        for _ in range(100):
            ef = calculate_easiness_factor(ef, quality=4)  # q=4 should maintain EF

        # EF should still be exactly 2.5 (no drift)
        assert ef == pytest.approx(2.5, abs=1e-10)

    def test_calculate_next_review_date_basic(self):
        """Test basic next review date calculation."""
        today = date.today()

        # 1 day interval
        next_date = calculate_next_review_date(1, from_date=today)
        assert next_date == today + timedelta(days=1)

        # 7 day interval
        next_date = calculate_next_review_date(7, from_date=today)
        assert next_date == today + timedelta(days=7)

        # 30 day interval
        next_date = calculate_next_review_date(30, from_date=today)
        assert next_date == today + timedelta(days=30)

    def test_calculate_next_review_date_defaults_to_today(self):
        """Test that from_date defaults to today."""
        today = date.today()
        next_date = calculate_next_review_date(5)

        assert next_date == today + timedelta(days=5)

    def test_calculate_next_review_date_with_specific_date(self):
        """Test with a specific from_date."""
        from_date = date(2024, 1, 1)
        next_date = calculate_next_review_date(7, from_date=from_date)

        assert next_date == date(2024, 1, 8)

    def test_calculate_next_review_date_zero_interval(self):
        """Test with zero interval (due immediately)."""
        today = date.today()
        next_date = calculate_next_review_date(0, from_date=today)

        assert next_date == today

    def test_very_high_ef_progression(self):
        """Test that very high EF values don't cause issues."""
        ef = 3.5  # Very high EF
        interval = 100
        reps = 10

        result = calculate_sm2(ef, interval, reps, quality=5)

        assert result.new_easiness_factor == pytest.approx(3.6)
        # Interval should grow: round(100 * 3.6) = 360
        assert result.new_interval == 360
        assert result.new_status == CardStatus.MASTERED


@pytest.mark.unit
@pytest.mark.sm2
class TestConstants:
    """Tests to verify SM-2 constants are set correctly."""

    def test_min_easiness_factor_value(self):
        """MIN_EASINESS_FACTOR should be 1.3."""
        assert MIN_EASINESS_FACTOR == 1.3

    def test_default_easiness_factor_value(self):
        """DEFAULT_EASINESS_FACTOR should be 2.5."""
        assert DEFAULT_EASINESS_FACTOR == 2.5

    def test_mastery_ef_threshold_value(self):
        """MASTERY_EF_THRESHOLD should be 2.3."""
        assert MASTERY_EF_THRESHOLD == 2.3

    def test_mastery_interval_threshold_value(self):
        """MASTERY_INTERVAL_THRESHOLD should be 21."""
        assert MASTERY_INTERVAL_THRESHOLD == 21

    def test_learning_repetitions_threshold_value(self):
        """LEARNING_REPETITIONS_THRESHOLD should be 3."""
        assert LEARNING_REPETITIONS_THRESHOLD == 3
