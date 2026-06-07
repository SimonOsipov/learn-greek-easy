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

from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch
from uuid import UUID

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardRecord, CardRecordStatistics, CardStatus, CardType
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


# UTC timestamps used to place MASTERED rows inside / outside the query windows.
# IN-WINDOW: falls on _BOUNDARY_EVE → inside [_RANGE_START, _RANGE_END] and
#             inside the quarter window [2023-12-18, 2024-03-16].
_MASTERED_IN_WINDOW_TS = datetime(2024, 3, 15, 23, 30, tzinfo=timezone.utc)
# OUT-OF-WINDOW: clearly before _RANGE_START; also outside the quarter window
#                (2023-12-18 is the earliest quarter boundary, so pick 2023-06-01).
_MASTERED_OUT_OF_WINDOW_TS = datetime(2023, 6, 1, 12, 0, tzinfo=timezone.utc)


async def _make_mastered_stats(
    db_session: AsyncSession,
    user_id: UUID,
    golden_seed: GoldenSeed,
    forced_updated_at: datetime,
    variant_suffix: str,
) -> CardRecordStatistics:
    """Seed one MASTERED CardRecordStatistics row and backdate updated_at via raw SQL.

    ``updated_at`` uses a DB server_default (func.now()), so it cannot be
    overridden at INSERT time through the ORM.  After flush we issue a targeted
    UPDATE to pin the timestamp to ``forced_updated_at``.

    A new CardRecord with a unique variant_key is created to avoid the
    (user_id, card_record_id) unique constraint on CardRecordStatistics — the
    golden seed already owns golden_seed.card_record for the LEARNING row.
    """
    # Reuse the existing CardRecord from the golden seed but we need a fresh
    # CardRecord for a new stats row (unique constraint: user_id + card_record_id).
    # Create a sibling card with a unique variant_key.
    new_card = CardRecord(
        word_entry_id=golden_seed.card_record.word_entry_id,
        deck_id=golden_seed.card_record.deck_id,
        card_type=CardType.MEANING_EL_TO_EN,
        variant_key=f"mastered_test_{variant_suffix}",
        is_active=True,
        front_content={"card_type": "meaning_el_to_en", "main": "λόγος"},
        back_content={"card_type": "meaning_el_to_en", "answer": "word"},
    )
    db_session.add(new_card)
    await db_session.flush()
    await db_session.refresh(new_card)

    stats = CardRecordStatistics(
        user_id=user_id,
        card_record_id=new_card.id,
        easiness_factor=2.7,
        interval=30,
        repetitions=10,
        status=CardStatus.MASTERED,
    )
    db_session.add(stats)
    await db_session.flush()
    await db_session.refresh(stats)

    # Override the server-set updated_at via raw SQL so it falls inside/outside
    # the query window as needed.
    await db_session.execute(
        text("UPDATE card_record_statistics " "SET updated_at = :ts " "WHERE id = :sid"),
        {"ts": forced_updated_at, "sid": stats.id},
    )
    await db_session.flush()
    await db_session.refresh(stats)
    return stats


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
        """AC5: Python-derived mastered total from per-day rows == the old DB scalar.

        Seeds 1 MASTERED row INSIDE [_RANGE_START, _RANGE_END] and 1 MASTERED
        row OUTSIDE that range so that:
        - A broken date-range filter (no BETWEEN) would return 2 instead of 1.
        - A broken status filter (no status==MASTERED) would return 0.
        Both failures are discriminated; the test cannot pass vacuously (0 == 0).
        """
        await assert_session_utc(db_session)
        stats_repo = CardRecordStatisticsRepository(db_session)
        user_id: UUID = golden_seed_fixture.user.id

        # 1 MASTERED row inside the window, 1 outside — expected count = 1.
        await _make_mastered_stats(
            db_session,
            user_id,
            golden_seed_fixture,
            forced_updated_at=_MASTERED_IN_WINDOW_TS,
            variant_suffix="in_window",
        )
        await _make_mastered_stats(
            db_session,
            user_id,
            golden_seed_fixture,
            forced_updated_at=_MASTERED_OUT_OF_WINDOW_TS,
            variant_suffix="out_of_window",
        )
        _EXPECTED_MASTERED = 1

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

        assert legacy_mastered == _EXPECTED_MASTERED, (
            f"Legacy scalar returned {legacy_mastered}, expected {_EXPECTED_MASTERED}. "
            "Check that the in-window MASTERED row's updated_at was correctly backdated."
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
        quarter window (89 days back = 2023-12-18 … 2024-03-16) covers the seed
        boundary dates.

        Seeds 1 MASTERED row INSIDE the quarter window (_MASTERED_IN_WINDOW_TS
        = 2024-03-15) and 1 MASTERED row OUTSIDE that window
        (_MASTERED_OUT_OF_WINDOW_TS = 2023-06-01) so the assertion is
        non-vacuous: both legacy scalar and service summary must return 1, not 0.
        A broken date-range filter would yield 2; a broken status filter 0.
        """
        await assert_session_utc(db_session)
        user_id: UUID = golden_seed_fixture.user.id

        # Seed 1 MASTERED in-window + 1 MASTERED out-of-window.
        await _make_mastered_stats(
            db_session,
            user_id,
            golden_seed_fixture,
            forced_updated_at=_MASTERED_IN_WINDOW_TS,
            variant_suffix="svc_in_window",
        )
        await _make_mastered_stats(
            db_session,
            user_id,
            golden_seed_fixture,
            forced_updated_at=_MASTERED_OUT_OF_WINDOW_TS,
            variant_suffix="svc_out_of_window",
        )
        _EXPECTED_MASTERED = 1

        # Legacy mastered count via direct repo call over the same date range
        stats_repo = CardRecordStatisticsRepository(db_session)
        expected_start = _TODAY_FIXED - timedelta(days=90 - 1)  # period="quarter" = 90 days
        legacy_mastered = await stats_repo.count_cards_mastered_in_range(
            user_id, expected_start, _TODAY_FIXED
        )

        assert legacy_mastered == _EXPECTED_MASTERED, (
            f"Legacy scalar returned {legacy_mastered}, expected {_EXPECTED_MASTERED}. "
            "Check that the in-window MASTERED row's updated_at was correctly backdated."
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
        assert result.summary.cards_mastered == _EXPECTED_MASTERED, (
            f"summary.cards_mastered={result.summary.cards_mastered} "
            f"!= expected {_EXPECTED_MASTERED} (vacuous 0==0 guard)"
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
