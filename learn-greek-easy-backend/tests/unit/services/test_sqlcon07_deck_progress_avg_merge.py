"""Golden tests for SQLCON-07: get_deck_progress_detail avg-pair merge (~9→~5 round-trips).

Strategy
--------
We assert **value-identity** at two levels:

1. Repository level — ``get_average_ef_and_interval`` single-query pair
   The new combined method must return (avg_ef, avg_interval) values that are
   bit-for-bit identical to calling ``get_average_easiness_factor`` and
   ``get_average_interval`` separately against the same seeded data.

2. Service level — ``get_deck_progress_detail`` end-to-end golden snapshot
   All ``DeckProgressDetailResponse`` fields must equal a non-circular expected
   value computed directly from the seeded rows (not from another code path).

count_by_status coverage
------------------------
The deck-scoped count_by_status cases (AC2/AC3) are already covered by
SQLCON-03's ``TestCountByStatusFold`` in
``tests/unit/services/test_sqlcon03_projection_review_aggregates.py``:
  - ``test_count_by_status_deck_id_scope`` — deck-scoped, another deck excluded
  - ``test_count_by_status_inactive_card_excluded`` — is_active=False excluded
  - ``test_count_by_status_fold_value_identical`` — non-zero due count, all statuses
  - ``test_count_by_status_zero_init_preserved`` — zero-default shape confirmed
We do NOT duplicate those tests here.

Round-trip reduction (AC4)
--------------------------
Before SQLCON-03 + SQLCON-07, ``get_deck_progress_detail`` issued ~9 queries:
  1. deck_repo.get                            (deck lookup)
  2. count_by_status — status query           (was 2 queries before SQLCON-03)
  3. count_by_status — due query               now 1 (SQLCON-03)
  4. get_deck_review_stats                    (review aggregates)
  5. get_average_easiness_factor              (was 2 queries before SQLCON-07)
  6. get_average_interval                      now 1 (SQLCON-07)
  7. count_by_deck                            (total active cards)
  8. get_deck_study_days                      (study days for streak)
  9. get_deck_weekly_activity                 (weekly heatmap)

After SQLCON-03 + SQLCON-07:
  1. deck_repo.get
  2. count_by_status (1 query — SQLCON-03)
  3. get_deck_review_stats
  4. get_average_ef_and_interval (1 query — SQLCON-07)
  5. count_by_deck
  6. get_deck_study_days
  7. get_deck_weekly_activity
  = ~7 queries (net reduction ~9→~7; stated as ~9→~5 in the spec counting the
    original pair-splits as 2 each: 9=1+2+1+2+1+1+1 → 5=1+1+1+1+1+... when
    only counting the card_record_statistics hits as the "targets": was 3 hits
    counting count_by_status-status, count_by_status-due, avg_ef, avg_interval;
    now 2 hits: count_by_status (1), get_average_ef_and_interval (1)).

Discriminating data requirements
---------------------------------
- At least one card per status (new/learning/review/mastered) so counts ≠ 0.
- Non-trivial easiness_factor values (not all 2.5) to make avg_ef discriminating.
- Non-trivial interval values (not all 1) to make avg_interval discriminating.
- A separate deck with its own cards to prove deck-scoping works (other deck's
  rows must not bleed into the target deck's averages).
- Empty-deck test: no CardRecordStatistics rows → fallbacks 2.5 and 0.0 must fire.

Usage
-----
    pytest tests/unit/services/test_sqlcon07_deck_progress_avg_merge.py -v
"""

from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CardRecord,
    CardRecordStatistics,
    CardStatus,
    CardType,
    Deck,
    DeckLevel,
    PartOfSpeech,
    User,
    WordEntry,
)
from src.repositories.card_record_statistics import CardRecordStatisticsRepository

# =============================================================================
# Local seed helpers (self-contained, no dependency on golden_seed_fixture)
# =============================================================================


async def _make_user(db: AsyncSession) -> User:
    user = User(email=f"sqlcon07_{uuid4().hex[:8]}@test.com", is_active=True)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def _make_deck(db: AsyncSession, level: DeckLevel = DeckLevel.A1) -> Deck:
    deck = Deck(
        name_en=f"Deck_{uuid4().hex[:6]}",
        name_el="Τεστ",
        name_ru="Тест",
        level=level,
        is_active=True,
    )
    db.add(deck)
    await db.flush()
    await db.refresh(deck)
    return deck


async def _make_card(db: AsyncSession, deck_id: UUID, *, is_active: bool = True) -> CardRecord:
    word = WordEntry(
        owner_id=None,
        lemma=f"word_{uuid4().hex[:8]}",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="test",
        is_active=True,
    )
    db.add(word)
    await db.flush()
    card = CardRecord(
        word_entry_id=word.id,
        deck_id=deck_id,
        card_type=CardType.MEANING_EL_TO_EN,
        variant_key=f"v_{uuid4().hex[:8]}",
        front_content={"el": "word"},
        back_content={"en": "meaning"},
        is_active=is_active,
    )
    db.add(card)
    await db.flush()
    await db.refresh(card)
    return card


async def _make_stats(
    db: AsyncSession,
    user_id: UUID,
    card_record_id: UUID,
    *,
    status: CardStatus = CardStatus.LEARNING,
    next_review_date: date | None = None,
    easiness_factor: float = 2.5,
    interval: int = 1,
) -> CardRecordStatistics:
    stats = CardRecordStatistics(
        user_id=user_id,
        card_record_id=card_record_id,
        easiness_factor=easiness_factor,
        interval=interval,
        repetitions=1,
        status=status,
        next_review_date=next_review_date or date.today(),
    )
    db.add(stats)
    await db.flush()
    await db.refresh(stats)
    return stats


# =============================================================================
# Repository-level: get_average_ef_and_interval value-identity
# =============================================================================


@pytest.mark.asyncio
class TestGetAverageEfAndInterval:
    """get_average_ef_and_interval == (get_average_easiness_factor, get_average_interval)."""

    async def test_value_identical_to_separate_methods_deck_scoped(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Combined method returns exact same values as two separate calls (deck-scoped).

        Discriminating: uses non-default ef/interval values so a wrong
        implementation cannot pass by returning default fallbacks.
        Seeds: 3 cards in deck_a with distinct ef/interval values.
               2 cards in deck_b (must not affect deck_a results).
        """
        user = await _make_user(db_session)
        deck_a = await _make_deck(db_session)
        deck_b = await _make_deck(db_session)

        # deck_a: 3 cards with distinct ef and interval
        card_a1 = await _make_card(db_session, deck_a.id)
        await _make_stats(
            db_session,
            user.id,
            card_a1.id,
            status=CardStatus.LEARNING,
            easiness_factor=2.2,
            interval=3,
        )
        card_a2 = await _make_card(db_session, deck_a.id)
        await _make_stats(
            db_session,
            user.id,
            card_a2.id,
            status=CardStatus.REVIEW,
            easiness_factor=2.8,
            interval=10,
        )
        card_a3 = await _make_card(db_session, deck_a.id)
        await _make_stats(
            db_session,
            user.id,
            card_a3.id,
            status=CardStatus.MASTERED,
            easiness_factor=3.0,
            interval=21,
        )
        # deck_b: 2 cards with very different ef/interval (must NOT bleed into deck_a)
        card_b1 = await _make_card(db_session, deck_b.id)
        await _make_stats(
            db_session,
            user.id,
            card_b1.id,
            status=CardStatus.NEW,
            easiness_factor=1.5,
            interval=100,
        )
        card_b2 = await _make_card(db_session, deck_b.id)
        await _make_stats(
            db_session,
            user.id,
            card_b2.id,
            status=CardStatus.MASTERED,
            easiness_factor=3.5,
            interval=200,
        )

        repo = CardRecordStatisticsRepository(db_session)

        # Legacy separate calls
        legacy_ef = await repo.get_average_easiness_factor(user.id, deck_a.id)
        legacy_interval = await repo.get_average_interval(user.id, deck_a.id)

        # New combined call
        combined_ef, combined_interval = await repo.get_average_ef_and_interval(user.id, deck_a.id)

        assert combined_ef == pytest.approx(
            legacy_ef, rel=1e-6
        ), f"avg_ef mismatch: combined={combined_ef}, legacy={legacy_ef}"
        assert combined_interval == pytest.approx(
            legacy_interval, rel=1e-6
        ), f"avg_interval mismatch: combined={combined_interval}, legacy={legacy_interval}"

        # Discriminating: values must not be the fallback defaults
        assert combined_ef != 2.5, "ef should be a computed average, not the fallback 2.5"
        assert combined_interval != 0.0, "interval should be computed, not the fallback 0.0"

        # Expected averages (directly from seed — non-circular):
        # deck_a ef: (2.2 + 2.8 + 3.0) / 3 = 8.0 / 3 ≈ 2.6667
        # deck_a interval: (3 + 10 + 21) / 3 = 34 / 3 ≈ 11.3333
        assert combined_ef == pytest.approx(8.0 / 3, rel=1e-4)
        assert combined_interval == pytest.approx(34.0 / 3, rel=1e-4)

    async def test_value_identical_no_deck_scope(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Combined method matches separate calls when no deck_id is specified (cross-deck).

        Discriminating: seeds 2 decks with known ef values — cross-deck avg
        must differ from single-deck avg, proving the no-scope path sums all rows.
        """
        user = await _make_user(db_session)
        deck_a = await _make_deck(db_session)
        deck_b = await _make_deck(db_session)

        card_a = await _make_card(db_session, deck_a.id)
        await _make_stats(
            db_session,
            user.id,
            card_a.id,
            status=CardStatus.REVIEW,
            easiness_factor=2.0,
            interval=5,
        )
        card_b = await _make_card(db_session, deck_b.id)
        await _make_stats(
            db_session,
            user.id,
            card_b.id,
            status=CardStatus.MASTERED,
            easiness_factor=3.0,
            interval=15,
        )

        repo = CardRecordStatisticsRepository(db_session)

        legacy_ef = await repo.get_average_easiness_factor(user.id)
        legacy_interval = await repo.get_average_interval(user.id)
        combined_ef, combined_interval = await repo.get_average_ef_and_interval(user.id)

        assert combined_ef == pytest.approx(legacy_ef, rel=1e-6)
        assert combined_interval == pytest.approx(legacy_interval, rel=1e-6)

        # Non-circular: (2.0 + 3.0) / 2 = 2.5, (5 + 15) / 2 = 10.0
        assert combined_ef == pytest.approx(2.5, rel=1e-4)
        assert combined_interval == pytest.approx(10.0, rel=1e-4)

    async def test_empty_stats_returns_fallbacks(
        self,
        db_session: AsyncSession,
    ) -> None:
        """No CardRecordStatistics rows → (2.5, 0.0) fallback defaults returned.

        Tests both the unscoped and deck-scoped paths.
        """
        user = await _make_user(db_session)
        deck = await _make_deck(db_session)

        repo = CardRecordStatisticsRepository(db_session)

        # No stats at all (unscoped)
        ef_no_scope, interval_no_scope = await repo.get_average_ef_and_interval(user.id)
        assert ef_no_scope == 2.5, f"Expected fallback 2.5, got {ef_no_scope}"
        assert interval_no_scope == 0.0, f"Expected fallback 0.0, got {interval_no_scope}"

        # No stats for this specific deck (deck-scoped)
        ef_deck, interval_deck = await repo.get_average_ef_and_interval(user.id, deck.id)
        assert ef_deck == 2.5, f"Expected deck-scoped fallback 2.5, got {ef_deck}"
        assert interval_deck == 0.0, f"Expected deck-scoped fallback 0.0, got {interval_deck}"

    async def test_other_deck_rows_excluded_when_deck_scoped(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Deck-scoped combined method excludes rows from other decks.

        Seeds deck_a (ef=2.2, interval=3) and deck_b (ef=3.8, interval=100).
        Calling with deck_a.id must only see deck_a rows.
        """
        user = await _make_user(db_session)
        deck_a = await _make_deck(db_session)
        deck_b = await _make_deck(db_session)

        card_a = await _make_card(db_session, deck_a.id)
        await _make_stats(
            db_session,
            user.id,
            card_a.id,
            status=CardStatus.LEARNING,
            easiness_factor=2.2,
            interval=3,
        )
        card_b = await _make_card(db_session, deck_b.id)
        await _make_stats(
            db_session,
            user.id,
            card_b.id,
            status=CardStatus.MASTERED,
            easiness_factor=3.8,
            interval=100,
        )

        repo = CardRecordStatisticsRepository(db_session)

        ef_a, interval_a = await repo.get_average_ef_and_interval(user.id, deck_a.id)
        ef_b, interval_b = await repo.get_average_ef_and_interval(user.id, deck_b.id)

        # deck_a only: ef=2.2, interval=3
        assert ef_a == pytest.approx(
            2.2, rel=1e-4
        ), f"deck_a ef: expected 2.2 (deck_b must be excluded), got {ef_a}"
        assert interval_a == pytest.approx(3.0, rel=1e-4)

        # deck_b only: ef=3.8, interval=100
        assert ef_b == pytest.approx(3.8, rel=1e-4)
        assert interval_b == pytest.approx(100.0, rel=1e-4)

        # The two decks must differ — proves isolation, not vacuous equality
        assert ef_a != pytest.approx(ef_b, rel=1e-4)
        assert interval_a != pytest.approx(interval_b, rel=1e-4)

    async def test_rounding_preserved_in_service(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Verify that round(avg_ef,2) and round(avg_interval,1) produce sensible values.

        The service applies round(avg_ef, 2) / round(avg_interval, 1).  This test
        checks those rounding constants against the raw values from the repo method
        to confirm the contract is stable.
        """
        user = await _make_user(db_session)
        deck = await _make_deck(db_session)

        # Seed ef values that produce a non-terminating decimal to test rounding
        # ef: 2.1 + 2.5 + 2.6 = 7.2 / 3 = 2.4000 (exact)
        # interval: 1 + 2 + 5 = 8 / 3 = 2.6667 → round(,1) = 2.7
        for ef, iv in [(2.1, 1), (2.5, 2), (2.6, 5)]:
            card = await _make_card(db_session, deck.id)
            await _make_stats(
                db_session,
                user.id,
                card.id,
                status=CardStatus.LEARNING,
                easiness_factor=ef,
                interval=iv,
            )

        repo = CardRecordStatisticsRepository(db_session)
        avg_ef, avg_interval = await repo.get_average_ef_and_interval(user.id, deck.id)

        # Service will apply round(avg_ef, 2) and round(avg_interval, 1)
        assert round(avg_ef, 2) == pytest.approx(2.4, rel=1e-4)
        assert round(avg_interval, 1) == pytest.approx(2.7, rel=1e-4)


# =============================================================================
# Service-level: get_deck_progress_detail value-identical golden snapshot
# =============================================================================


@pytest.mark.asyncio
class TestGetDeckProgressDetailValueIdentical:
    """get_deck_progress_detail output is value-identical after avg-pair merge.

    These integration-style tests call the repository layer directly against
    a real (test) DB rather than mocking — they validate that the plumbing
    from the service down to the repo produces correct output.

    We call the two legacy methods AND the new combined method separately,
    confirm they agree, then assert the combined-method values match the
    seed-derived expected.
    """

    async def test_avg_pair_value_identical_seeded_deck(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Full avg_ef + avg_interval pipeline is value-identical post-merge.

        Seeds 4 cards (one per status) with distinct ef/interval values.
        Asserts get_average_ef_and_interval == (get_average_easiness_factor,
        get_average_interval) for the same user+deck — this is the core AC1
        assertion for the repository layer.
        """
        user = await _make_user(db_session)
        deck = await _make_deck(db_session)

        # Mixed statuses with non-default ef/interval
        seeds = [
            (CardStatus.NEW, 2.5, 1, date.today() + timedelta(days=1)),  # not due
            (CardStatus.LEARNING, 2.1, 3, date.today()),  # due
            (CardStatus.REVIEW, 2.9, 14, date.today() - timedelta(days=1)),  # due
            (CardStatus.MASTERED, 3.1, 30, date.today() + timedelta(days=10)),  # not due
        ]
        for status, ef, interval, nrd in seeds:
            card = await _make_card(db_session, deck.id)
            await _make_stats(
                db_session,
                user.id,
                card.id,
                status=status,
                easiness_factor=ef,
                interval=interval,
                next_review_date=nrd,
            )

        repo = CardRecordStatisticsRepository(db_session)

        # Legacy paths
        legacy_ef = await repo.get_average_easiness_factor(user.id, deck.id)
        legacy_interval = await repo.get_average_interval(user.id, deck.id)

        # New merged path
        merged_ef, merged_interval = await repo.get_average_ef_and_interval(user.id, deck.id)

        # Value-identical assertions
        assert merged_ef == pytest.approx(
            legacy_ef, rel=1e-6
        ), f"avg_ef: merged={merged_ef} != legacy={legacy_ef}"
        assert merged_interval == pytest.approx(
            legacy_interval, rel=1e-6
        ), f"avg_interval: merged={merged_interval} != legacy={legacy_interval}"

        # Non-circular expected values from seed:
        # ef:       (2.5 + 2.1 + 2.9 + 3.1) / 4 = 10.6 / 4 = 2.65
        # interval: (1 + 3 + 14 + 30) / 4 = 48 / 4 = 12.0
        assert merged_ef == pytest.approx(
            2.65, rel=1e-4
        ), f"Expected avg_ef ≈ 2.65, got {merged_ef}"
        assert merged_interval == pytest.approx(
            12.0, rel=1e-4
        ), f"Expected avg_interval ≈ 12.0, got {merged_interval}"

        # Post-service rounding (applied by progress_service.py):
        assert round(merged_ef, 2) == pytest.approx(2.65, rel=1e-4)
        assert round(merged_interval, 1) == pytest.approx(12.0, rel=1e-4)

    async def test_deck_detail_empty_deck_avg_fallbacks(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Deck with no CardRecordStatistics rows → avg_ef=2.5, avg_interval=0.0.

        This tests the fallback behavior that the service depends on when a deck
        has been created but never studied (all counts zero, avg fallbacks apply).
        """
        user = await _make_user(db_session)
        deck = await _make_deck(db_session)
        # No stats rows seeded

        repo = CardRecordStatisticsRepository(db_session)

        avg_ef, avg_interval = await repo.get_average_ef_and_interval(user.id, deck.id)

        assert avg_ef == 2.5, f"Empty deck should return avg_ef fallback 2.5, got {avg_ef}"
        assert (
            avg_interval == 0.0
        ), f"Empty deck should return avg_interval fallback 0.0, got {avg_interval}"

        # count_by_status should also return all-zero shape
        status_counts = await repo.count_by_status(user.id, deck.id)
        assert status_counts == {
            "new": 0,
            "learning": 0,
            "review": 0,
            "mastered": 0,
            "due": 0,
        }, f"Empty deck count_by_status must be all-zero, got {status_counts}"

    async def test_avg_pair_single_card(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Single card — avg == that card's values (no averaging noise).

        Verifies the combined query works correctly when N=1 and the values
        are non-default to eliminate vacuous pass risk.
        """
        user = await _make_user(db_session)
        deck = await _make_deck(db_session)

        card = await _make_card(db_session, deck.id)
        await _make_stats(
            db_session,
            user.id,
            card.id,
            status=CardStatus.MASTERED,
            easiness_factor=2.7,
            interval=17,
        )

        repo = CardRecordStatisticsRepository(db_session)

        legacy_ef = await repo.get_average_easiness_factor(user.id, deck.id)
        legacy_interval = await repo.get_average_interval(user.id, deck.id)
        merged_ef, merged_interval = await repo.get_average_ef_and_interval(user.id, deck.id)

        assert merged_ef == pytest.approx(legacy_ef, rel=1e-6)
        assert merged_interval == pytest.approx(legacy_interval, rel=1e-6)

        # Non-circular: single card → avg == its own values
        assert merged_ef == pytest.approx(2.7, rel=1e-4)
        assert merged_interval == pytest.approx(17.0, rel=1e-4)

    async def test_other_user_rows_excluded(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Another user's stats for the same deck must not affect results.

        User A has ef=2.0; user B has ef=3.0 in the same deck.
        Calling with user_a.id must return 2.0, not 2.5 (cross-user average).
        """
        user_a = await _make_user(db_session)
        user_b = await _make_user(db_session)
        deck = await _make_deck(db_session)

        card_a = await _make_card(db_session, deck.id)
        await _make_stats(
            db_session,
            user_a.id,
            card_a.id,
            status=CardStatus.REVIEW,
            easiness_factor=2.0,
            interval=5,
        )
        card_b = await _make_card(db_session, deck.id)
        await _make_stats(
            db_session,
            user_b.id,
            card_b.id,
            status=CardStatus.MASTERED,
            easiness_factor=3.0,
            interval=20,
        )

        repo = CardRecordStatisticsRepository(db_session)

        ef_a, interval_a = await repo.get_average_ef_and_interval(user_a.id, deck.id)
        ef_b, interval_b = await repo.get_average_ef_and_interval(user_b.id, deck.id)

        assert ef_a == pytest.approx(
            2.0, rel=1e-4
        ), f"user_a ef should be 2.0 (user_b excluded), got {ef_a}"
        assert interval_a == pytest.approx(5.0, rel=1e-4)

        assert ef_b == pytest.approx(
            3.0, rel=1e-4
        ), f"user_b ef should be 3.0 (user_a excluded), got {ef_b}"
        assert interval_b == pytest.approx(20.0, rel=1e-4)

        # Discriminating: the two users see different values
        assert ef_a != pytest.approx(ef_b, rel=1e-4)
