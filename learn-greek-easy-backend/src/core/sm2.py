"""SM-2 Spaced Repetition Algorithm.

This module implements the SuperMemo 2 (SM-2) algorithm for calculating
optimal review intervals based on recall quality. The algorithm schedules
flashcard reviews at increasing intervals to maximize long-term retention
while minimizing study time.

Reference: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2

Algorithm Overview:
- Quality ratings 0-5 indicate recall difficulty
- Easiness Factor (EF) adjusts based on performance
- Failed recalls (quality < 3) reset the learning cycle
- Intervals increase exponentially with successful reviews

Security Notes:
- This is a pure algorithm module with no external dependencies
- Safe for use in any context (no database, network, or I/O operations)
- All functions are deterministic given the same inputs

Example Usage:
    from src.core.sm2 import calculate_sm2, DEFAULT_EASINESS_FACTOR

    # First review with quality 4 (correct with hesitation)
    result = calculate_sm2(
        current_ef=DEFAULT_EASINESS_FACTOR,
        current_interval=0,
        current_repetitions=0,
        quality=4,
    )
    print(f"Next interval: {result.new_interval} days")
    print(f"New EF: {result.new_easiness_factor}")
    print(f"Status: {result.new_status}")
"""

from dataclasses import dataclass
from datetime import date, timedelta

from src.db.models import CardStatus

# ============================================================================
# Constants
# ============================================================================

# Easiness Factor bounds
MIN_EASINESS_FACTOR: float = 1.3
"""Minimum allowed easiness factor.

The SM-2 algorithm prevents EF from dropping below 1.3 to avoid
excessively short intervals that would make learning frustrating.
"""

DEFAULT_EASINESS_FACTOR: float = 2.5
"""Default easiness factor for new cards.

Standard starting EF for SM-2. Cards with EF 2.5 are considered
of "average" difficulty. EF decreases for difficult cards and
increases for easy cards.
"""

# Status transition thresholds
MASTERY_EF_THRESHOLD: float = 2.3
"""Minimum EF required for mastery status.

Cards must have EF >= 2.3 (indicating consistent good recall)
to be eligible for MASTERED status.
"""

MASTERY_INTERVAL_THRESHOLD: int = 21
"""Minimum interval in days required for mastery status.

Cards must have interval >= 21 days (indicating long-term retention)
to be eligible for MASTERED status.
"""

LEARNING_REPETITIONS_THRESHOLD: int = 3
"""Minimum successful reviews to exit learning phase.

A card must have at least 3 consecutive successful reviews
to transition from LEARNING to REVIEW status.
"""


# ============================================================================
# Data Structures
# ============================================================================


@dataclass
class SM2Calculation:
    """Result of SM-2 algorithm calculation.

    This dataclass contains all the updated values after processing
    a card review through the SM-2 algorithm.

    Attributes:
        new_easiness_factor: Updated EF after applying the quality rating.
            Range: [MIN_EASINESS_FACTOR, infinity). Higher values mean
            the card is easier and intervals will grow faster.

        new_interval: Days until the next review. For failed recalls,
            this resets to 1. Otherwise follows the SM-2 progression.

        new_repetitions: Count of consecutive successful recalls.
            Resets to 0 on failed recall (quality < 3).

        new_status: Updated card status based on SM-2 metrics.
            See CardStatus enum for possible values.

    Example:
        >>> result = calculate_sm2(2.5, 6, 2, quality=5)
        >>> result.new_interval
        15
        >>> result.new_status
        <CardStatus.LEARNING: 'learning'>
    """

    new_easiness_factor: float
    new_interval: int
    new_repetitions: int
    new_status: CardStatus


# ============================================================================
# Core Algorithm Functions
# ============================================================================


def calculate_easiness_factor(current_ef: float, quality: int) -> float:
    """Calculate new easiness factor based on quality rating.

    Applies the SM-2 formula to update the easiness factor (EF) based
    on the quality of recall. The EF influences how quickly intervals
    grow - higher EF means easier card with longer intervals.

    Formula:
        EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))

    Where:
        - EF' is the new easiness factor
        - EF is the current easiness factor
        - q is the quality rating (0-5)

    Quality Impact:
        - q=5: EF increases by +0.10 (card is getting easier)
        - q=4: EF increases by +0.00 (card difficulty unchanged)
        - q=3: EF decreases by -0.14 (card is getting harder)
        - q=2: EF decreases by -0.32
        - q=1: EF decreases by -0.54
        - q=0: EF decreases by -0.80

    Args:
        current_ef: Current easiness factor.
            Typically in range [1.3, 2.5+]. Must be >= MIN_EASINESS_FACTOR.

        quality: Quality rating from the review.
            Must be in range 0-5 inclusive.

    Returns:
        New easiness factor, guaranteed to be >= MIN_EASINESS_FACTOR (1.3).

    Example:
        >>> calculate_easiness_factor(2.5, 5)  # Perfect recall
        2.6
        >>> calculate_easiness_factor(2.5, 3)  # Difficult recall
        2.36
        >>> calculate_easiness_factor(1.4, 0)  # Failed, near minimum
        1.3  # Clamped to minimum
    """
    # Apply SM-2 formula
    new_ef = current_ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))

    # Enforce minimum EF
    return max(MIN_EASINESS_FACTOR, new_ef)


def calculate_interval(
    current_interval: int,
    current_repetitions: int,
    easiness_factor: float,
    quality: int,
) -> tuple[int, int]:
    """Calculate new interval and repetition count.

    Determines the next review interval based on the SM-2 algorithm:
    - Failed recall (q < 3): Reset to interval=1, repetitions=0
    - First successful: interval=1
    - Second successful: interval=6
    - Subsequent: interval = round(previous_interval * EF)

    Args:
        current_interval: Current interval in days.
            0 for new cards, positive integer for reviewed cards.

        current_repetitions: Current count of consecutive successful reviews.
            0 for new cards or cards that had a failed recall.

        easiness_factor: Current EF value (used for interval calculation).
            Should be the new EF after quality adjustment.

        quality: Quality rating from the review.
            Must be in range 0-5 inclusive.

    Returns:
        Tuple of (new_interval, new_repetitions):
            - new_interval: Days until next review (minimum 1)
            - new_repetitions: Updated count of consecutive successes

    Example:
        >>> calculate_interval(0, 0, 2.5, 4)  # First review
        (1, 1)
        >>> calculate_interval(1, 1, 2.5, 4)  # Second review
        (6, 2)
        >>> calculate_interval(6, 2, 2.5, 4)  # Third review
        (15, 3)
        >>> calculate_interval(15, 3, 2.5, 1)  # Failed recall
        (1, 0)
    """
    if quality < 3:
        # Failed recall - reset progress
        return 1, 0

    # Successful recall - progress through stages
    if current_repetitions == 0:
        # First successful review
        new_interval = 1
    elif current_repetitions == 1:
        # Second successful review
        new_interval = 6
    else:
        # Subsequent reviews - exponential growth
        new_interval = round(current_interval * easiness_factor)

    return new_interval, current_repetitions + 1


def determine_status(
    repetitions: int,
    easiness_factor: float,
    interval: int,
    quality: int,
) -> CardStatus:
    """Determine card status based on SM-2 metrics.

    Calculates the appropriate learning status for a card based on
    its current metrics after a review.

    Status Transitions:
        - LEARNING: Card has fewer than 3 successful reviews,
          or had a failed recall (quality < 3)
        - REVIEW: Card has 3+ successful reviews but hasn't reached
          mastery thresholds
        - MASTERED: Card has EF >= 2.3 AND interval >= 21 days

    Note:
        NEW status is not returned by this function. A card transitions
        from NEW to LEARNING on its first review (handled by the service
        layer that creates CardStatistics).

    Args:
        repetitions: New repetition count after this review.
            0 indicates a failed recall, 3+ indicates potential for REVIEW.

        easiness_factor: New EF after this review.
            Must be >= 2.3 for mastery eligibility.

        interval: New interval after this review.
            Must be >= 21 days for mastery eligibility.

        quality: Quality rating from this review.
            Used to detect failed recalls (q < 3).

    Returns:
        New CardStatus value: LEARNING, REVIEW, or MASTERED.

    Example:
        >>> determine_status(2, 2.5, 6, 5)
        <CardStatus.LEARNING: 'learning'>  # Only 2 reps
        >>> determine_status(3, 2.5, 15, 5)
        <CardStatus.REVIEW: 'review'>  # 3 reps, but interval < 21
        >>> determine_status(5, 2.4, 25, 5)
        <CardStatus.MASTERED: 'mastered'>  # EF >= 2.3, interval >= 21
        >>> determine_status(5, 2.5, 25, 2)
        <CardStatus.LEARNING: 'learning'>  # Failed recall resets
    """
    if quality < 3:
        # Failed recall - back to learning
        return CardStatus.LEARNING

    if repetitions < LEARNING_REPETITIONS_THRESHOLD:
        # Not enough successful reviews yet
        return CardStatus.LEARNING

    if easiness_factor >= MASTERY_EF_THRESHOLD and interval >= MASTERY_INTERVAL_THRESHOLD:
        # Card has been consistently easy with long intervals
        return CardStatus.MASTERED

    # Good progress but not yet mastered
    return CardStatus.REVIEW


def calculate_sm2(
    current_ef: float,
    current_interval: int,
    current_repetitions: int,
    quality: int,
) -> SM2Calculation:
    """Execute full SM-2 calculation.

    This is the main entry point for SM-2 calculations. It orchestrates
    all the individual calculation functions and returns a complete
    result with all updated values.

    The calculation order is important:
    1. Calculate new EF (always update, even on failure)
    2. Calculate new interval and repetitions
    3. Determine new status based on updated metrics

    Args:
        current_ef: Current easiness factor.
            Use DEFAULT_EASINESS_FACTOR (2.5) for new cards.

        current_interval: Current interval in days.
            Use 0 for new cards.

        current_repetitions: Current count of consecutive successful reviews.
            Use 0 for new cards.

        quality: Quality rating for this review.
            Must be in range 0-5 inclusive:
            - 0: Complete blackout (worst)
            - 1: Incorrect, but correct answer felt familiar
            - 2: Incorrect, but correct answer was easy to recall
            - 3: Correct response recalled with serious difficulty
            - 4: Correct response after hesitation
            - 5: Perfect response (best)

    Returns:
        SM2Calculation containing all updated values:
            - new_easiness_factor
            - new_interval
            - new_repetitions
            - new_status

    Raises:
        ValueError: If quality is not in range 0-5 inclusive.

    Example:
        >>> # New card with perfect first review
        >>> result = calculate_sm2(2.5, 0, 0, 5)
        >>> print(f"Next review in {result.new_interval} day(s)")
        Next review in 1 day(s)
        >>> print(f"Status: {result.new_status.value}")
        Status: learning

        >>> # Card with failed recall
        >>> result = calculate_sm2(2.3, 15, 4, 2)
        >>> print(f"Reset to {result.new_interval} day, {result.new_repetitions} reps")
        Reset to 1 day, 0 reps
    """
    if not 0 <= quality <= 5:
        raise ValueError(f"Quality must be 0-5, got {quality}")

    # Step 1: Calculate new EF (always update, even on failure)
    new_ef = calculate_easiness_factor(current_ef, quality)

    # Step 2: Calculate new interval and repetitions
    new_interval, new_repetitions = calculate_interval(
        current_interval,
        current_repetitions,
        new_ef,
        quality,
    )

    # Step 3: Determine new status
    new_status = determine_status(
        new_repetitions,
        new_ef,
        new_interval,
        quality,
    )

    return SM2Calculation(
        new_easiness_factor=new_ef,
        new_interval=new_interval,
        new_repetitions=new_repetitions,
        new_status=new_status,
    )


def calculate_next_review_date(interval: int, from_date: date | None = None) -> date:
    """Calculate the next review date.

    Computes the calendar date for the next scheduled review
    based on the interval in days.

    Args:
        interval: Number of days until next review.
            Must be >= 0. Typically 1 for reset cards, up to
            365+ for well-mastered cards.

        from_date: Base date for calculation.
            Defaults to today if not provided.
            Useful for testing or batch processing historical data.

    Returns:
        The date when the card should next be reviewed.

    Example:
        >>> from datetime import date
        >>> calculate_next_review_date(7, from_date=date(2024, 1, 1))
        datetime.date(2024, 1, 8)
        >>> # Using today's date
        >>> next_date = calculate_next_review_date(1)
        >>> next_date == date.today() + timedelta(days=1)
        True
    """
    base = from_date or date.today()
    return base + timedelta(days=interval)


# ============================================================================
# Module Exports
# ============================================================================

__all__ = [
    # Data structures
    "SM2Calculation",
    # Core functions
    "calculate_sm2",
    "calculate_easiness_factor",
    "calculate_interval",
    "determine_status",
    "calculate_next_review_date",
    # Constants
    "MIN_EASINESS_FACTOR",
    "DEFAULT_EASINESS_FACTOR",
    "MASTERY_EF_THRESHOLD",
    "MASTERY_INTERVAL_THRESHOLD",
    "LEARNING_REPETITIONS_THRESHOLD",
]
