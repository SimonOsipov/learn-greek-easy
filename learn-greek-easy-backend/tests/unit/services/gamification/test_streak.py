"""Unit tests for per-surface streak pure helpers.

Coverage:
- _compute_streak_from_dates (input DESCENDING-sorted, 1-day grace):
    empty → 0
    single date today → 1
    single date yesterday (grace) → 1
    single date 2 days ago (outside grace) → 0
    consecutive today,-1,-2 → 3
    grace: yesterday,-2,-3 (nothing today) → 3
    broken run: today,-1,-3 (gap at -2) → 2
    most-recent in future → 0 (guard: dates[0] > start)

- _longest_streak_from_dates (input ASCENDING-sorted):
    empty → 0
    single → 1
    all consecutive 5 days → 5
    two runs [d-10..d-8, d-5..d-4] → longest 3
    no consecutive (all gaps) → 1
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from src.services.gamification.streak import _compute_streak_from_dates, _longest_streak_from_dates

# ---------------------------------------------------------------------------
# _compute_streak_from_dates
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_compute_streak_empty_returns_zero() -> None:
    """Empty date list → 0."""
    assert _compute_streak_from_dates([]) == 0


@pytest.mark.unit
def test_compute_streak_single_today_returns_one() -> None:
    """Single date == today → 1."""
    today = datetime.now(timezone.utc).date()
    assert _compute_streak_from_dates([today]) == 1


@pytest.mark.unit
def test_compute_streak_single_yesterday_returns_one_grace() -> None:
    """Single date == yesterday — grace period applies → 1."""
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    assert _compute_streak_from_dates([yesterday]) == 1


@pytest.mark.unit
def test_compute_streak_single_two_days_ago_returns_zero() -> None:
    """Single date 2 days ago — outside 1-day grace → 0."""
    today = datetime.now(timezone.utc).date()
    two_ago = today - timedelta(days=2)
    assert _compute_streak_from_dates([two_ago]) == 0


@pytest.mark.unit
def test_compute_streak_consecutive_from_today() -> None:
    """Consecutive run today, -1, -2 → 3."""
    today = datetime.now(timezone.utc).date()
    dates = [today - timedelta(days=i) for i in range(3)]  # [today, -1, -2]
    assert _compute_streak_from_dates(dates) == 3


@pytest.mark.unit
def test_compute_streak_grace_consecutive_from_yesterday() -> None:
    """Grace: yesterday, -2, -3 (nothing today) → 3."""
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    dates = [yesterday - timedelta(days=i) for i in range(3)]  # [-1, -2, -3]
    assert _compute_streak_from_dates(dates) == 3


@pytest.mark.unit
def test_compute_streak_broken_run_stops_at_gap() -> None:
    """Broken run: today, -1, -3 (gap at -2) → 2 (stops at gap)."""
    today = datetime.now(timezone.utc).date()
    dates = [today, today - timedelta(days=1), today - timedelta(days=3)]
    assert _compute_streak_from_dates(dates) == 2


@pytest.mark.unit
def test_compute_streak_future_date_returns_zero() -> None:
    """Most-recent date in the future → 0 (dates[0] > start guard)."""
    today = datetime.now(timezone.utc).date()
    tomorrow = today + timedelta(days=1)
    # Future date is ahead of the start anchor (max of today, yesterday)
    dates = [tomorrow, today, today - timedelta(days=1)]
    assert _compute_streak_from_dates(dates) == 0


# ---------------------------------------------------------------------------
# _longest_streak_from_dates
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_longest_streak_empty_returns_zero() -> None:
    """Empty list → 0."""
    assert _longest_streak_from_dates([]) == 0


@pytest.mark.unit
def test_longest_streak_single_returns_one() -> None:
    """Single date → 1."""
    today = datetime.now(timezone.utc).date()
    assert _longest_streak_from_dates([today]) == 1


@pytest.mark.unit
def test_longest_streak_all_consecutive() -> None:
    """5 ascending consecutive dates → 5."""
    today = datetime.now(timezone.utc).date()
    dates = sorted([today - timedelta(days=i) for i in range(5)])  # ascending
    assert _longest_streak_from_dates(dates) == 5


@pytest.mark.unit
def test_longest_streak_two_runs_picks_longer() -> None:
    """Two runs [d-10,d-9,d-8] and [d-5,d-4] → longest is 3."""
    today = datetime.now(timezone.utc).date()
    run_a = [today - timedelta(days=10 - i) for i in range(3)]  # d-10, d-9, d-8
    run_b = [today - timedelta(days=5 - i) for i in range(2)]  # d-5, d-4
    dates = sorted(run_a + run_b)  # ascending
    assert _longest_streak_from_dates(dates) == 3


@pytest.mark.unit
def test_longest_streak_no_consecutive_returns_one() -> None:
    """All dates with gaps (no consecutive pair) → 1."""
    today = datetime.now(timezone.utc).date()
    # Gaps of 2 between every date
    dates = sorted([today - timedelta(days=2 * i) for i in range(4)])  # ascending
    assert _longest_streak_from_dates(dates) == 1
