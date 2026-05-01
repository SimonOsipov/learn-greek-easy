"""Unit tests for gamification reconcile-on-read rollout gate.

Tests cover:
- Master switch off excludes all users even at percent=100
- Percent 0 excludes all users even with master switch on
- Percent 100 includes all users with master switch on
- Same user_id returns same result deterministically
- Monotonic expansion: in at percent=10 → also in at percent=50 and percent=90
- Distribution roughly uniform (10_000 UUIDs at 10% → ~1000 included)
"""

import uuid
from unittest.mock import patch

from src.services.gamification.rollout import is_user_in_reconcile_rollout


def _make_settings(*, on: bool, percent: int):
    """Context manager: patch settings for the duration of a test."""
    return patch.multiple(
        "src.services.gamification.rollout.settings",
        gamification_reconcile_on_read=on,
        gamification_reconcile_rollout_percent=percent,
    )


class TestMasterSwitch:
    def test_master_switch_off_excludes_all(self):
        """When master switch is off, no user is in the rollout (even at 100%)."""
        with _make_settings(on=False, percent=100):
            for _ in range(100):
                assert is_user_in_reconcile_rollout(uuid.uuid4()) is False


class TestPercentEdgeCases:
    def test_percent_zero_excludes_all(self):
        """When percent=0, no user is in the rollout."""
        with _make_settings(on=True, percent=0):
            for _ in range(100):
                assert is_user_in_reconcile_rollout(uuid.uuid4()) is False

    def test_percent_100_includes_all(self):
        """When percent=100, every user is in the rollout."""
        with _make_settings(on=True, percent=100):
            for _ in range(100):
                assert is_user_in_reconcile_rollout(uuid.uuid4()) is True


class TestDeterminism:
    def test_deterministic(self):
        """The same user_id must always return the same result."""
        user_id = uuid.uuid4()
        with _make_settings(on=True, percent=50):
            first = is_user_in_reconcile_rollout(user_id)
            for _ in range(9):
                assert is_user_in_reconcile_rollout(user_id) == first


class TestMonotonicExpansion:
    def test_monotonic_expansion(self):
        """If a user is in at percent=10, they must also be in at percent=50 and percent=90."""
        uuids = [uuid.uuid4() for _ in range(1000)]
        for uid in uuids:
            with _make_settings(on=True, percent=10):
                in_at_10 = is_user_in_reconcile_rollout(uid)
            with _make_settings(on=True, percent=50):
                in_at_50 = is_user_in_reconcile_rollout(uid)
            with _make_settings(on=True, percent=90):
                in_at_90 = is_user_in_reconcile_rollout(uid)

            if in_at_10:
                assert in_at_50, f"user {uid} was in at 10% but not 50%"
                assert in_at_90, f"user {uid} was in at 10% but not 90%"


class TestDistribution:
    def test_distribution_roughly_uniform(self):
        """10_000 UUIDs at 10% should yield between 800 and 1200 included users."""
        uuids = [uuid.uuid4() for _ in range(10_000)]
        with _make_settings(on=True, percent=10):
            included = sum(1 for uid in uuids if is_user_in_reconcile_rollout(uid))
        assert 800 <= included <= 1200, (
            f"Expected ~1000 (10% of 10_000) but got {included}. "
            "Distribution may not be uniform."
        )
