"""QA Mode B integration tests for PERF-15-03: DashboardSummaryService.build().

The pure-function unit tests (test_dashboard_derivations.py, test_compose_feed.py)
already lock byte-parity for each derivation helper in isolation. This file
exercises the DB-touching wiring build() adds around them end-to-end against a
real session:
    - deck_repo.list_active() order (created_at DESC) feeding both `decks` and
      the feed's deck-gate/resume/sibling selection
    - the progress_map merge (_compute_deck_progress_list keyed onto
      active_decks by deck_id) including the "no progress row" fallback
    - today_utc (datetime.now(timezone.utc).date()) anchoring recent_activity
      into week_heat end-to-end (not just the pure build_week_heat contract)
    - all 9 required DashboardSummaryResponse fields populated on both the
      brand-new-user and returning-user paths

Two scenarios:
  (a) brand-new user — no decks, no progress, no activity at all.
  (b) returning user — two vocab decks (one resume-eligible via a review
      today, one active-but-never-studied), due cards on both, and a 1-day
      streak from today's review.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CardRecord,
    CardRecordReview,
    CardRecordStatistics,
    CardStatus,
    CardType,
    Deck,
    DeckLevel,
    DeckWordEntry,
    PartOfSpeech,
    WordEntry,
)
from src.services.dashboard_summary_service import DashboardSummaryService

_TODAY_START = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)


async def _seed_word_entry(db_session: AsyncSession, *, deck: Deck) -> WordEntry:
    word_entry = WordEntry(
        owner_id=None,
        lemma=f"τεστ-{uuid4().hex[:8]}",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="test word",
        is_active=True,
    )
    db_session.add(word_entry)
    await db_session.flush()
    db_session.add(DeckWordEntry(deck_id=deck.id, word_entry_id=word_entry.id))
    await db_session.flush()
    return word_entry


async def _seed_card(
    db_session: AsyncSession, *, deck: Deck, word_entry: WordEntry, variant_key: str
) -> CardRecord:
    card = CardRecord(
        word_entry_id=word_entry.id,
        deck_id=deck.id,
        card_type=CardType.MEANING_EL_TO_EN,
        variant_key=variant_key,
        front_content={"card_type": "meaning_el_to_en", "prompt": "Translate", "main": "λόγος"},
        back_content={"card_type": "meaning_el_to_en", "answer": "word"},
    )
    db_session.add(card)
    await db_session.flush()
    await db_session.refresh(card)
    return card


@pytest.mark.integration
class TestDashboardSummaryBuildNewUser:
    """(a) Brand-new user: no decks, no progress, no activity anywhere."""

    @pytest.mark.asyncio
    async def test_build_brand_new_user(self, db_session: AsyncSession, test_user) -> None:
        result = await DashboardSummaryService(db_session).build(test_user.id)

        # AC-4/AC-5: is_new_user derives from cards_due/streak/mastered/decks,
        # all zero/empty for a never-studied account.
        assert result.is_new_user is True
        assert result.mastered == 0
        assert result.decks == []

        # All 9 required core fields populated (AC schema contract).
        assert result.today.cards_due == 0
        assert result.today.reviews_completed == 0
        assert result.streak.current_streak == 0
        assert result.streak.longest_streak == 0
        assert result.week_heat.heat == [0, 0, 0, 0, 0, 0, 0]
        assert result.week_heat.today_idx == 6
        assert result.whats_new_count == 0
        assert result.queue_count == 0

        # AC-4: only the always-on word_of_day item — no decks means
        # pick_resume_deck returns None (empty list -> no resume item).
        assert [item.type for item in result.feed] == ["word_of_day"]
        assert result.feed[0].id == "word-of-day"


@pytest.mark.integration
class TestDashboardSummaryBuildReturningUser:
    """(b) Returning user: 2 vocab decks, due cards on both, a review today
    (1-day streak + resume pick), and one deck that's active but never
    directly studied (deck-gate + no-progress-row-adjacent coverage)."""

    @pytest.mark.asyncio
    async def test_build_returning_user_with_progress_due_and_streak(
        self, db_session: AsyncSession, test_user
    ) -> None:
        # ── Deck 1 (older, created first) — studied today: becomes resume ──
        deck1 = Deck(
            name_en="PERF-15-03 Deck One",
            name_el="Ντεκ Ένα",
            name_ru="Колода Один",
            description_en="test",
            description_el="test",
            description_ru="test",
            level=DeckLevel.A1,
            is_active=True,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        db_session.add(deck1)
        await db_session.flush()
        we1 = await _seed_word_entry(db_session, deck=deck1)
        c1 = await _seed_card(
            db_session, deck=deck1, word_entry=we1, variant_key="v1"
        )  # due, studied
        c2 = await _seed_card(
            db_session, deck=deck1, word_entry=we1, variant_key="v2"
        )  # mastered, not due
        # c3: untouched (NEW) -- deliberately no CardRecordStatistics row below.
        await _seed_card(db_session, deck=deck1, word_entry=we1, variant_key="v3")

        db_session.add(
            CardRecordStatistics(
                user_id=test_user.id,
                card_record_id=c1.id,
                status=CardStatus.LEARNING,
                next_review_date=date.today(),
                easiness_factor=2.36,
            )
        )
        db_session.add(
            CardRecordStatistics(
                user_id=test_user.id,
                card_record_id=c2.id,
                status=CardStatus.MASTERED,
                next_review_date=date.today() + timedelta(days=30),
                easiness_factor=2.7,
            )
        )
        # c3 gets no CardRecordStatistics row at all -> stays "new"/untouched.

        # A review TODAY on c1 -> deck1.last_studied_at set, 1-day streak,
        # and a week_heat bump at index 6 (today).
        db_session.add(
            CardRecordReview(
                user_id=test_user.id,
                card_record_id=c1.id,
                quality=4,
                time_taken=8,
                reviewed_at=_TODAY_START + timedelta(hours=9),
            )
        )

        # ── Deck 2 (newer, created after deck1) — active but NEVER reviewed:
        # must still surface as a plain 'deck' feed item (not resume). ──
        deck2 = Deck(
            name_en="PERF-15-03 Deck Two",
            name_el="Ντεκ Δύο",
            name_ru="Колода Два",
            description_en="test",
            description_el="test",
            description_ru="test",
            level=DeckLevel.A1,
            is_active=True,
            created_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
        )
        db_session.add(deck2)
        await db_session.flush()
        we2 = await _seed_word_entry(db_session, deck=deck2)
        c4 = await _seed_card(
            db_session, deck=deck2, word_entry=we2, variant_key="v1"
        )  # due, studied
        # c5: untouched (NEW) -- no CardRecordStatistics row.
        await _seed_card(db_session, deck=deck2, word_entry=we2, variant_key="v2")

        db_session.add(
            CardRecordStatistics(
                user_id=test_user.id,
                card_record_id=c4.id,
                status=CardStatus.LEARNING,
                next_review_date=date.today(),
                easiness_factor=2.5,
            )
        )
        # No CardRecordReview for deck2 -> last_studied_at stays None.

        await db_session.flush()

        result = await DashboardSummaryService(db_session).build(test_user.id)

        # ── is_new_user: due cards alone already force False ───────────────
        assert result.is_new_user is False

        # ── mastered: only c2 (deck1) is MASTERED ───────────────────────────
        assert result.mastered == 1

        # ── today/streak: due = c1 + c4 (both LEARNING, next_review_date<=today)
        assert result.today.cards_due == 2
        assert result.streak.current_streak == 1
        assert result.streak.longest_streak == 1

        # ── week_heat: exactly 1 review today (index 6), nothing else ───────
        assert result.week_heat.heat[6] == 1  # bucket_heatmap_intensity(1) == 1
        assert result.week_heat.heat[:6] == [0, 0, 0, 0, 0, 0]
        assert result.week_heat.today_idx == 6

        # ── decks: list_active order = created_at DESC -> deck2 THEN deck1 ──
        assert [d.deck_id for d in result.decks] == [deck2.id, deck1.id]

        deck1_slice = next(d for d in result.decks if d.deck_id == deck1.id)
        deck2_slice = next(d for d in result.decks if d.deck_id == deck2.id)

        # deck1: 3 total cards (c1/c2/c3), 2 studied (c1 LEARNING + c2 MASTERED),
        # 1 mastered (c2), 1 due (c1 only -- c2 is MASTERED, excluded from due).
        assert deck1_slice.status == "in-progress"
        assert deck1_slice.cards_total == 3
        assert deck1_slice.cards_new == 1  # c3, never touched
        assert deck1_slice.cards_learning == 1  # cards_studied(2) - cards_mastered(1)
        assert deck1_slice.cards_mastered == 1
        assert deck1_slice.cards_review == 1
        assert deck1_slice.due_today == 1
        assert deck1_slice.completion_pct == round(2 / 3 * 100)  # 67, independent formula
        assert deck1_slice.last_studied_at is not None
        # card_count (word-entry count) is a SEPARATE stat from cards_total (SRS
        # card-record count) -- deck1 has exactly 1 linked WordEntry.
        assert deck1_slice.card_count == 1

        # deck2: 2 total cards (c4/c5), 1 studied (c4 LEARNING), 0 mastered,
        # 1 due, never reviewed -> not-resume-eligible but still "in-progress".
        assert deck2_slice.status == "in-progress"
        assert deck2_slice.cards_total == 2
        assert deck2_slice.cards_new == 1  # c5, never touched
        assert deck2_slice.cards_mastered == 0
        assert deck2_slice.cards_review == 1
        assert deck2_slice.due_today == 1
        assert deck2_slice.last_studied_at is None

        # ── feed: resume(deck1) -> review -> word_of_day -> deck(deck2) -> milestone
        # (no situation/news/quick seeded -> all three gated off).
        assert [item.type for item in result.feed] == [
            "resume",
            "review",
            "word_of_day",
            "deck",
            "milestone",
        ]

        resume_item = result.feed[0]
        assert resume_item.deck_id == deck1.id
        assert resume_item.id == f"resume-{deck1.id}"
        assert resume_item.sibling_deck_ids == [deck2.id]

        review_item = result.feed[1]
        assert review_item.cards_due == 2
        assert set(review_item.due_deck_ids) == {deck1.id, deck2.id}

        deck_item = next(i for i in result.feed if i.type == "deck")
        assert deck_item.deck_id == deck2.id  # deck1 excluded: it IS the resume deck

        milestone_item = next(i for i in result.feed if i.type == "milestone")
        assert milestone_item.current_streak == 1
        assert milestone_item.longest_streak == 1

        # ── non-critical sources gracefully empty (no news/situations/queue seeded)
        assert result.whats_new_count == 0
        assert result.queue_count == 0
