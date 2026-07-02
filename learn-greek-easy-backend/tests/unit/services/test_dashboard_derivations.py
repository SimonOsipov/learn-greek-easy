"""Mode A RED tests for the PERF-15-03 pure derivation helpers.

Locks byte-parity between the (not-yet-implemented) server-side derivations
in src/services/dashboard_compose.py and their frontend oracles:
    - build_week_heat    <-> src/components/dashboard/lib/weekHeat.ts
    - map_deck_slice      <-> src/stores/deckStore.ts (transformDeckResponse)
    - derive_is_new_user <-> src/components/dashboard/lib/isNewUser.ts
    - pick_resume_deck   <-> src/components/dashboard/lib/heroEntries.ts

compose_feed (the most order/gating-heavy helper) has its own file,
test_compose_feed.py.

RED reason: every helper in src/services/dashboard_compose.py is currently a
stub that unconditionally raises NotImplementedError, so every test below
fails on that exception (not an import/collection error) until the
PERF-15-03 executor implements the real logic.

All tests are pure unit tests — no DB, no AsyncSession.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from uuid import UUID, uuid4

import pytest

from src.schemas.dashboard import DashboardDeckSlice
from src.schemas.progress import DeckProgressSummary, RecentActivity
from src.services.dashboard_compose import (
    build_week_heat,
    derive_is_new_user,
    map_deck_slice,
    pick_resume_deck,
)


class _FakeDeck:
    """Minimal DeckLike test double (see dashboard_compose.DeckLike) —
    duck-types the identity/display fields map_deck_slice reads off `deck`,
    independent of whichever concrete type (ORM Deck vs. DeckResponse) the
    PERF-15-03 executor ends up threading through."""

    def __init__(
        self,
        deck_id: UUID | None = None,
        name_el: str = "Λέξεις",
        name_en: str = "Words",
        name_ru: str = "Слова",
        level: str = "A1",
        is_premium: bool = False,
        cover_image_url: str | None = None,
        cover_image_variants: dict[int, str] | None = None,
    ) -> None:
        self.id = deck_id or uuid4()
        self.name_el = name_el
        self.name_en = name_en
        self.name_ru = name_ru
        self.level = level
        self.is_premium = is_premium
        self.cover_image_url = cover_image_url
        self.cover_image_variants = cover_image_variants


def _progress(**overrides) -> DeckProgressSummary:
    kwargs: dict = dict(
        deck_id=uuid4(),
        deck_name="Test Deck",
        deck_level="A1",
        total_cards=10,
        cards_studied=0,
        cards_mastered=0,
        cards_due=0,
        mastery_percentage=0.0,
        completion_percentage=0.0,
        last_studied_at=None,
        average_easiness_factor=None,
        estimated_review_time_minutes=0,
    )
    kwargs.update(overrides)
    return DeckProgressSummary(**kwargs)


def _deck_slice(**overrides) -> DashboardDeckSlice:
    kwargs: dict = dict(
        deck_id=uuid4(),
        name_el="Λέξεις",
        name_en="Words",
        name_ru="Слова",
        level="A1",
        is_premium=False,
        card_count=10,
        cover_image_url=None,
        cover_image_variants=None,
        status="not-started",
        cards_total=10,
        cards_new=10,
        cards_learning=0,
        cards_review=0,
        cards_mastered=0,
        due_today=0,
        completion_pct=0,
        mastery_pct=0.0,
        last_studied_at=None,
    )
    kwargs.update(overrides)
    return DashboardDeckSlice(**kwargs)


@pytest.mark.unit
class TestBuildWeekHeat:
    """AC-4: week-heat bucketing + UTC-anchored 7-day rolling window."""

    def test_buckets_reviews_correctly_oldest_to_newest(self) -> None:
        today_utc = date(2026, 3, 15)
        # index 0 = 6 days ago ... index 6 = today
        reviews = [0, 1, 3, 5, 8, 13, 2]
        recent_activity = [
            RecentActivity(
                date=today_utc - timedelta(days=6 - i),
                reviews_count=reviews[i],
                average_quality=3.0,
            )
            for i in range(7)
        ]

        result = build_week_heat(recent_activity, today_utc=today_utc)

        assert result.heat == [0, 1, 2, 3, 4, 5, 1]
        assert result.today_idx == 6
        assert len(result.heat) == 7

    def test_today_utc_boundary_included_seven_days_ago_dropped(self) -> None:
        today_utc = date(2026, 3, 15)
        recent_activity = [
            # "today UTC" -> index 6, bucket 1 (reviews_count=1 -> <=2)
            RecentActivity(date=today_utc, reviews_count=1, average_quality=3.0),
            # exactly 7 days ago -> outside the 0..6-days-ago window, dropped
            # entirely (must NOT bleed into index 0, which is 6 days ago).
            RecentActivity(
                date=today_utc - timedelta(days=7), reviews_count=100, average_quality=3.0
            ),
        ]

        result = build_week_heat(recent_activity, today_utc=today_utc)

        assert result.heat == [0, 0, 0, 0, 0, 0, 1]
        assert result.today_idx == 6


@pytest.mark.unit
class TestMapDeckSlice:
    """AC-5: deck-slice status/completion/count derivation — CRITICAL parity."""

    def test_completed_status_when_completion_percentage_at_least_100(self) -> None:
        deck = _FakeDeck()
        studied_at = datetime(2026, 3, 1, 12, 0, 0)
        progress = _progress(
            total_cards=10,
            cards_studied=10,
            cards_mastered=10,
            cards_due=0,
            completion_percentage=100.0,
            mastery_percentage=100.0,
            last_studied_at=studied_at,
        )
        # card_count (word-entry count) deliberately differs from
        # progress.total_cards (SRS card count) to prove cards_total is
        # sourced from progress, not the card_count argument, when progress
        # is present.
        result = map_deck_slice(deck, progress, card_count=25)

        assert result.status == "completed"
        assert result.completion_pct == 100
        assert result.cards_total == 10
        assert result.card_count == 25
        assert result.cards_new == 0
        assert result.cards_learning == 0
        assert result.cards_mastered == 10
        assert result.cards_review == 0
        assert result.due_today == 0
        assert result.last_studied_at == studied_at

    def test_in_progress_status_when_cards_studied_positive_but_not_complete(self) -> None:
        deck = _FakeDeck()
        progress = _progress(
            total_cards=10,
            cards_studied=4,
            cards_mastered=1,
            cards_due=3,
            completion_percentage=40.0,
        )
        result = map_deck_slice(deck, progress, card_count=10)

        assert result.status == "in-progress"
        assert result.completion_pct == 40  # round(4/10*100)
        assert result.cards_new == 6
        assert result.cards_learning == 3  # cards_studied - cards_mastered
        assert result.cards_mastered == 1
        assert result.cards_review == 3
        assert result.due_today == 3

    def test_completion_pct_is_computed_independently_of_completion_percentage(self) -> None:
        """CRITICAL parity guard: completion_pct = round(cards_studied /
        cards_total * 100) is a SEPARATE computation from the status gate's
        completion_percentage. A buggy mapper that reuses
        round(progress.completion_percentage) for completion_pct would
        produce 50 here instead of the correct 33."""
        deck = _FakeDeck()
        studied_at = datetime(2026, 2, 1, 9, 0, 0)
        progress = _progress(
            total_cards=3,
            cards_studied=1,
            cards_mastered=0,
            cards_due=2,
            completion_percentage=50.0,  # deliberately NOT round(1/3*100)
            last_studied_at=studied_at,
        )
        result = map_deck_slice(deck, progress, card_count=3)

        assert result.status == "in-progress"
        assert result.completion_pct == 33
        assert result.cards_review == 2
        assert result.due_today == 2
        assert result.cards_new == 2
        assert result.cards_learning == 1
        assert result.last_studied_at == studied_at

    def test_zero_cards_total_guards_division_but_still_reports_cards_due(self) -> None:
        deck = _FakeDeck()
        progress = _progress(
            total_cards=0,
            cards_studied=0,
            cards_mastered=0,
            cards_due=3,
            completion_percentage=0.0,
        )
        result = map_deck_slice(deck, progress, card_count=0)

        assert result.status == "not-started"
        assert result.completion_pct == 0  # no div-by-zero
        assert result.cards_total == 0
        assert result.cards_review == 3
        assert result.due_today == 3
        assert result.cards_new == 0
        assert result.cards_learning == 0

    def test_no_progress_deck_defaults_to_not_started_from_card_count(self) -> None:
        deck = _FakeDeck()
        result = map_deck_slice(deck, None, card_count=12)

        assert result.status == "not-started"
        assert result.cards_total == 12
        assert result.card_count == 12
        assert result.cards_new == 12
        assert result.cards_learning == 0
        assert result.cards_review == 0
        assert result.cards_mastered == 0
        assert result.due_today == 0
        assert result.completion_pct == 0
        assert result.last_studied_at is None


@pytest.mark.unit
class TestDeriveIsNewUser:
    """AC-4: new-user predicate — cards_due/current_streak/mastered all zero
    AND every deck_slice.last_studied_at is None."""

    def test_true_when_all_signals_zero_and_no_deck_studied(self) -> None:
        decks = [_deck_slice(last_studied_at=None), _deck_slice(last_studied_at=None)]
        result = derive_is_new_user(cards_due=0, current_streak=0, mastered=0, deck_slices=decks)
        assert result is True

    def test_true_when_deck_slices_empty(self) -> None:
        # Mirrors the frontend's Array.prototype.every on an empty array,
        # which is vacuously true.
        result = derive_is_new_user(cards_due=0, current_streak=0, mastered=0, deck_slices=[])
        assert result is True

    def test_false_when_mastered_nonzero(self) -> None:
        decks = [_deck_slice(last_studied_at=None)]
        result = derive_is_new_user(cards_due=0, current_streak=0, mastered=1, deck_slices=decks)
        assert result is False

    def test_false_when_one_deck_has_last_studied_at(self) -> None:
        decks = [
            _deck_slice(last_studied_at=None),
            _deck_slice(last_studied_at=datetime(2026, 3, 1)),
        ]
        result = derive_is_new_user(cards_due=0, current_streak=0, mastered=0, deck_slices=decks)
        assert result is False

    def test_false_when_cards_due_nonzero(self) -> None:
        decks = [_deck_slice(last_studied_at=None)]
        result = derive_is_new_user(cards_due=5, current_streak=0, mastered=0, deck_slices=decks)
        assert result is False

    def test_false_when_current_streak_nonzero(self) -> None:
        decks = [_deck_slice(last_studied_at=None)]
        result = derive_is_new_user(cards_due=0, current_streak=3, mastered=0, deck_slices=decks)
        assert result is False


@pytest.mark.unit
class TestPickResumeDeck:
    """AC-4: resume-deck priority — max last_studied_at (ties -> earliest in
    list order), else first due_today > 0, else first deck, else None."""

    def test_picks_deck_with_max_last_studied_at(self) -> None:
        id1, id2, id3 = uuid4(), uuid4(), uuid4()
        d1 = _deck_slice(deck_id=id1, last_studied_at=datetime(2026, 3, 1))
        d2 = _deck_slice(deck_id=id2, last_studied_at=datetime(2026, 3, 10))
        d3 = _deck_slice(deck_id=id3, last_studied_at=datetime(2026, 2, 20))

        result = pick_resume_deck([d1, d2, d3])

        assert result is not None
        assert result.deck_id == id2

    def test_tie_on_last_studied_at_picks_earliest_in_list_order(self) -> None:
        same_ts = datetime(2026, 3, 5)
        id1, id2 = uuid4(), uuid4()
        d1 = _deck_slice(deck_id=id1, last_studied_at=same_ts)
        d2 = _deck_slice(deck_id=id2, last_studied_at=same_ts)

        result = pick_resume_deck([d1, d2])

        assert result is not None
        assert result.deck_id == id1

    def test_falls_back_to_first_deck_with_due_today_when_none_studied(self) -> None:
        id1, id2, id3 = uuid4(), uuid4(), uuid4()
        d1 = _deck_slice(deck_id=id1, last_studied_at=None, due_today=0)
        d2 = _deck_slice(deck_id=id2, last_studied_at=None, due_today=3)
        d3 = _deck_slice(deck_id=id3, last_studied_at=None, due_today=5)

        result = pick_resume_deck([d1, d2, d3])

        assert result is not None
        assert result.deck_id == id2

    def test_falls_back_to_first_deck_in_list_when_none_studied_or_due(self) -> None:
        id1, id2 = uuid4(), uuid4()
        d1 = _deck_slice(deck_id=id1, last_studied_at=None, due_today=0)
        d2 = _deck_slice(deck_id=id2, last_studied_at=None, due_today=0)

        result = pick_resume_deck([d1, d2])

        assert result is not None
        assert result.deck_id == id1

    def test_empty_list_returns_none(self) -> None:
        result = pick_resume_deck([])
        assert result is None
