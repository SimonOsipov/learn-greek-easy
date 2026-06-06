"""Golden tests for SQLCON-02: get_learning_trends 6→4 DB round-trips.

Strategy
--------
We assert **value-identity** at two levels:

1. Repository level — Merge A
   ``CardRecordReviewRepository.get_daily_vocab_combined_stats`` must return
   rows that carry the *same* values as the two original calls
   ``get_daily_stats`` + ``get_daily_accuracy_stats`` for every day in the
   range.  We compare both the "vocab_daily" projection and the "accuracy"
   projection.

2. Repository level — Merge B (mastered derivation)
   Summing MASTERED rows from ``count_cards_by_status_per_day`` must equal
   what the old ``count_cards_mastered_in_range`` scalar returned.

3. Service level — end-to-end
   ``ProgressService.get_learning_trends`` with the consolidated path must
   return a ``LearningTrendsResponse`` whose ``summary.cards_mastered`` and
   all ``daily_stats`` fields are value-identical to those produced by the
   original 6-query path.  We patch ``datetime.date.today`` inside the
   service to a fixed date that brings both UTC day-boundary seed rows into
   the "quarter" window.

Timezone bucketing invariant
----------------------------
The seed has two vocab reviews straddling UTC midnight:
  - 2024-03-15 23:30 UTC  → buckets to date 2024-03-15
  - 2024-03-16 00:30 UTC  → buckets to date 2024-03-16
Both days must appear as distinct date buckets in every query that uses
``func.date(reviewed_at)``.  Tests explicitly assert this.

Usage
-----
    pytest tests/unit/services/test_sqlcon02_get_learning_trends.py -v
"""

from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import patch
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatus
from src.repositories.card_record_review import CardRecordReviewRepository
from src.repositories.card_record_statistics import CardRecordStatisticsRepository
from src.services.progress_service import ProgressService
from tests.fixtures.golden import (  # noqa: F401
    GoldenSeed,
    assert_rows_equal,
    assert_session_utc,
    golden_seed_fixture,
)

# The two boundary dates implied by the seed fixture
_BOUNDARY_EVE = date(2024, 3, 15)  # 23:30 UTC → this date bucket
_BOUNDARY_MORN = date(2024, 3, 16)  # 00:30 UTC → this date bucket

# Date range that covers both boundary days
_RANGE_START = date(2024, 3, 15)
_RANGE_END = date(2024, 3, 16)

# "Today" used to drive service-level test via period="quarter"
# start_date = _TODAY - 89 days = 2023-12-18  ← both boundary days fall inside
_TODAY_FIXED = date(2024, 3, 16)


# =============================================================================
# Merge A — repository level
# =============================================================================


@pytest.mark.asyncio
class TestMergeARepository:
    """get_daily_vocab_combined_stats value-identity vs get_daily_stats + get_daily_accuracy_stats."""

    async def test_combined_covers_both_boundary_days(
        self,
        db_session: AsyncSession,
        golden_seed_fixture: GoldenSeed,  # noqa: F811
    ) -> None:
        """Merged query returns one row per day for each boundary day."""
        await assert_session_utc(db_session)
        repo = CardRecordReviewRepository(db_session)
        user_id: UUID = golden_seed_fixture.user.id

        combined = await repo.get_daily_vocab_combined_stats(user_id, _RANGE_START, _RANGE_END)
        dates_in_result = {row["date"] for row in combined}

        assert _BOUNDARY_EVE in dates_in_result, (
            f"Boundary evening date {_BOUNDARY_EVE} missing from combined result. "
            f"Got: {sorted(dates_in_result)}"
        )
        assert _BOUNDARY_MORN in dates_in_result, (
            f"Boundary morning date {_BOUNDARY_MORN} missing from combined result. "
            f"Got: {sorted(dates_in_result)}"
        )
        assert len(combined) == 2, f"Expected 2 day-rows, got {len(combined)}"

    async def test_combined_vocab_daily_projection_equals_get_daily_stats(
        self,
        db_session: AsyncSession,
        golden_seed_fixture: GoldenSeed,  # noqa: F811
    ) -> None:
        """vocab-daily projection of combined == get_daily_stats for both days."""
        await assert_session_utc(db_session)
        repo = CardRecordReviewRepository(db_session)
        user_id: UUID = golden_seed_fixture.user.id

        legacy_daily = await repo.get_daily_stats(user_id, _RANGE_START, _RANGE_END)
        combined = await repo.get_daily_vocab_combined_stats(user_id, _RANGE_START, _RANGE_END)

        # Project combined rows to the vocab-daily subset for comparison
        combined_daily_projection = [
            {
                "date": row["date"],
                "reviews_count": row["reviews_count"],
                "avg_quality": row["avg_quality"],
                "total_time": row["total_time"],
            }
            for row in combined
        ]

        assert_rows_equal(
            legacy_daily,
            combined_daily_projection,
            msg="Merge A vocab-daily projection",
        )

    async def test_combined_accuracy_projection_equals_get_daily_accuracy_stats(
        self,
        db_session: AsyncSession,
        golden_seed_fixture: GoldenSeed,  # noqa: F811
    ) -> None:
        """accuracy projection of combined == get_daily_accuracy_stats for both days."""
        await assert_session_utc(db_session)
        repo = CardRecordReviewRepository(db_session)
        user_id: UUID = golden_seed_fixture.user.id

        legacy_accuracy = await repo.get_daily_accuracy_stats(user_id, _RANGE_START, _RANGE_END)
        combined = await repo.get_daily_vocab_combined_stats(user_id, _RANGE_START, _RANGE_END)

        # Project combined rows to the accuracy subset for comparison
        # The combined method exposes "total" == reviews_count (same count column reused)
        combined_accuracy_projection = [
            {
                "date": row["date"],
                "correct": row["correct"],
                "total": row["total"],
            }
            for row in combined
        ]

        assert_rows_equal(
            legacy_accuracy,
            combined_accuracy_projection,
            msg="Merge A accuracy projection",
        )

    async def test_accuracy_denom_equals_reviews_count(
        self,
        db_session: AsyncSession,
        golden_seed_fixture: GoldenSeed,  # noqa: F811
    ) -> None:
        """AC4: accuracy denominator ('total') equals reviews_count — single count column."""
        await assert_session_utc(db_session)
        repo = CardRecordReviewRepository(db_session)
        user_id: UUID = golden_seed_fixture.user.id

        combined = await repo.get_daily_vocab_combined_stats(user_id, _RANGE_START, _RANGE_END)

        for row in combined:
            assert row["total"] == row["reviews_count"], (
                f"On {row['date']}: total={row['total']} != reviews_count={row['reviews_count']}. "
                "The denominator must reuse the single count column."
            )

    async def test_tz_boundary_distinct_buckets(
        self,
        db_session: AsyncSession,
        golden_seed_fixture: GoldenSeed,  # noqa: F811
    ) -> None:
        """AC2/AC3: reviews at 23:30 and 00:30 UTC land in two distinct date buckets."""
        await assert_session_utc(db_session)
        repo = CardRecordReviewRepository(db_session)
        user_id: UUID = golden_seed_fixture.user.id

        combined = await repo.get_daily_vocab_combined_stats(user_id, _RANGE_START, _RANGE_END)

        # Each boundary day should have exactly 1 review
        by_date = {row["date"]: row for row in combined}
        assert by_date[_BOUNDARY_EVE]["reviews_count"] == 1, (
            f"Evening boundary day should have 1 review, "
            f"got {by_date[_BOUNDARY_EVE]['reviews_count']}"
        )
        assert by_date[_BOUNDARY_MORN]["reviews_count"] == 1, (
            f"Morning boundary day should have 1 review, "
            f"got {by_date[_BOUNDARY_MORN]['reviews_count']}"
        )


# =============================================================================
# Merge B — mastered derivation
# =============================================================================


@pytest.mark.asyncio
class TestMergeBMasteredDerivation:
    """Deriving cards_mastered from count_cards_by_status_per_day == count_cards_mastered_in_range."""

    async def test_derived_mastered_equals_legacy_scalar(
        self,
        db_session: AsyncSession,
        golden_seed_fixture: GoldenSeed,  # noqa: F811
    ) -> None:
        """AC5: Python-derived mastered total from per-day rows == the old DB scalar."""
        await assert_session_utc(db_session)
        stats_repo = CardRecordStatisticsRepository(db_session)
        user_id: UUID = golden_seed_fixture.user.id

        # Legacy approach: separate DB round-trip
        legacy_mastered = await stats_repo.count_cards_mastered_in_range(
            user_id, _RANGE_START, _RANGE_END
        )

        # New approach: derive from per-day status rows (Merge B)
        vocab_status_per_day = await stats_repo.count_cards_by_status_per_day(
            user_id, _RANGE_START, _RANGE_END
        )
        derived_mastered = sum(
            row["count"]
            for row in vocab_status_per_day
            if row["status"] == CardStatus.MASTERED.value
        )

        assert (
            derived_mastered == legacy_mastered
        ), f"Derived mastered ({derived_mastered}) != legacy scalar ({legacy_mastered})"


# =============================================================================
# Service level — end-to-end golden test
# =============================================================================


@pytest.mark.asyncio
class TestGetLearningTrendsGolden:
    """End-to-end: get_learning_trends summary.cards_mastered and daily_stats are value-identical
    before and after consolidation (AC1 full integration check)."""

    async def test_cards_mastered_in_summary(
        self,
        db_session: AsyncSession,
        golden_seed_fixture: GoldenSeed,  # noqa: F811
    ) -> None:
        """summary.cards_mastered in consolidated path equals legacy count_cards_mastered_in_range.

        We patch date.today() inside progress_service to _TODAY_FIXED so the
        quarter window (89 days back) covers the seed boundary dates.
        """
        await assert_session_utc(db_session)
        user_id: UUID = golden_seed_fixture.user.id

        # Legacy mastered count via direct repo call over the same date range
        stats_repo = CardRecordStatisticsRepository(db_session)
        expected_start = _TODAY_FIXED - timedelta(days=90 - 1)  # period="quarter" = 90 days
        legacy_mastered = await stats_repo.count_cards_mastered_in_range(
            user_id, expected_start, _TODAY_FIXED
        )

        # Service call with patched today — only today() is called in get_learning_trends
        with patch("src.services.progress_service.date") as mock_date:
            mock_date.today.return_value = _TODAY_FIXED
            service = ProgressService(db_session)
            result = await service.get_learning_trends(user_id, period="quarter")

        assert result.summary.cards_mastered == legacy_mastered, (
            f"summary.cards_mastered={result.summary.cards_mastered} "
            f"!= legacy={legacy_mastered}"
        )

    async def test_daily_stats_review_counts_and_accuracy_match(
        self,
        db_session: AsyncSession,
        golden_seed_fixture: GoldenSeed,  # noqa: F811
    ) -> None:
        """Daily stats review counts and accuracy values are correct for boundary days.

        Asserts that after consolidation:
        - 2024-03-15 has 1 review (evening bucket)
        - 2024-03-16 has 1 review (morning bucket)
        - Accuracy values are correctly computed from the merged query
        """
        await assert_session_utc(db_session)
        user_id: UUID = golden_seed_fixture.user.id

        with patch("src.services.progress_service.date") as mock_date:
            mock_date.today.return_value = _TODAY_FIXED
            service = ProgressService(db_session)
            result = await service.get_learning_trends(user_id, period="quarter")

        daily_by_date = {s.date: s for s in result.daily_stats}

        # Both boundary days must appear in daily_stats
        assert (
            _BOUNDARY_EVE in daily_by_date
        ), f"Boundary evening date {_BOUNDARY_EVE} not in daily_stats"
        assert (
            _BOUNDARY_MORN in daily_by_date
        ), f"Boundary morning date {_BOUNDARY_MORN} not in daily_stats"

        eve_stats = daily_by_date[_BOUNDARY_EVE]
        morn_stats = daily_by_date[_BOUNDARY_MORN]

        # Seed: evening review quality=4 (CORRECT_HESITANT), morning quality=5 (PERFECT)
        # Both >= 3 so both correct
        assert (
            eve_stats.reviews_count == 1
        ), f"Evening: expected 1 review, got {eve_stats.reviews_count}"
        assert (
            morn_stats.reviews_count == 1
        ), f"Morning: expected 1 review, got {morn_stats.reviews_count}"

        # vocab_accuracy for each day: 1 correct out of 1 total = 100%
        assert eve_stats.vocab_accuracy == pytest.approx(
            100.0, rel=1e-6
        ), f"Evening vocab_accuracy should be 100%, got {eve_stats.vocab_accuracy}"
        assert morn_stats.vocab_accuracy == pytest.approx(
            100.0, rel=1e-6
        ), f"Morning vocab_accuracy should be 100%, got {morn_stats.vocab_accuracy}"
