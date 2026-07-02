"""Mode A RED tests for PERF-15-03's compose_feed — the parity-critical
feed order/gating contract.

Oracle: src/components/dashboard/lib/composeFeed.ts (fixed emission order
resume -> review -> situation -> word_of_day -> deck -> milestone -> news ->
quick; every variant except word_of_day is presence-gated).

RED reason: compose_feed (src/services/dashboard_compose.py) is currently a
stub that unconditionally raises NotImplementedError, so every test below
fails on that exception (not an import/collection error) until the
PERF-15-03 executor implements the real logic.

All tests are pure unit tests — no DB, no AsyncSession.
"""

from __future__ import annotations

from datetime import date, datetime
from uuid import uuid4

import pytest

from src.schemas.dashboard import DashboardDeckSlice, SlimNews, SlimSituation
from src.services.dashboard_compose import ComposeFeedSignals, compose_feed


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


def _situation(**overrides) -> SlimSituation:
    kwargs: dict = dict(
        id=uuid4(),
        scenario_el="Στον καφέ",
        scenario_en="At the coffee shop",
        scenario_ru="В кофейне",
        status="ready",
        has_audio=False,
        has_dialog=False,
        exercise_total=3,
        exercise_completed=1,
        source_image_url=None,
        domain=None,
        description_source_type=None,
    )
    kwargs.update(overrides)
    return SlimSituation(**kwargs)


def _news(**overrides) -> SlimNews:
    kwargs: dict = dict(
        id=uuid4(),
        situation_id=uuid4(),
        title_el="Τίτλος",
        title_en="Title",
        title_ru="Заголовок",
        publication_date=date(2026, 3, 1),
        country="cyprus",
        audio_duration_seconds=30.0,
        image_url=None,
        image_variants=None,
    )
    kwargs.update(overrides)
    return SlimNews(**kwargs)


@pytest.mark.unit
class TestComposeFeedAllPresent:
    """AC-4: full fixed order + gating detail (siblings, due_deck_ids,
    resume-exclusion, item id formatting) when every source is populated."""

    def test_full_order_and_gating_detail(self) -> None:
        resume_id, other1, other2, other3 = uuid4(), uuid4(), uuid4(), uuid4()

        # Most-recently-studied -> the resume pick.
        resume_deck = _deck_slice(
            deck_id=resume_id,
            last_studied_at=datetime(2026, 3, 10),
            status="in-progress",
            due_today=0,
        )
        # Two OTHER decks that qualify for a 'deck' feed item.
        deck_a = _deck_slice(
            deck_id=other1, last_studied_at=None, status="in-progress", due_today=0
        )
        deck_b = _deck_slice(
            deck_id=other2, last_studied_at=None, status="not-started", due_today=2
        )
        # A non-qualifying deck, present only to prove sibling selection caps
        # at 2 and ignores qualification.
        deck_c = _deck_slice(
            deck_id=other3, last_studied_at=None, status="not-started", due_today=0
        )

        deck_slices = [resume_deck, deck_a, deck_b, deck_c]
        situation = _situation()
        news = [_news(), _news(), _news()]

        signals = ComposeFeedSignals(
            deck_slices=deck_slices,
            cards_due=4,
            situation=situation,
            news=news,
            current_streak=5,
            longest_streak=9,
            queue_count=2,
        )

        items = compose_feed(signals)
        types = [item.type for item in items]

        assert types == [
            "resume",
            "review",
            "situation",
            "word_of_day",
            "deck",
            "deck",
            "milestone",
            "news",
            "news",
            "news",
            "quick",
        ]

        resume_item = items[0]
        assert resume_item.deck_id == resume_id
        assert resume_item.id == f"resume-{resume_id}"
        # sibling_deck_ids = first 2 OTHER deck ids, in list order,
        # regardless of 'deck'-feed-item qualification (deck_c is excluded
        # only because of the slice(0, 2) cap, not because it's inactive).
        assert resume_item.sibling_deck_ids == [other1, other2]

        review_item = next(i for i in items if i.type == "review")
        assert review_item.cards_due == 4
        assert review_item.due_deck_ids == [other2]  # only deck_b has due_today > 0

        situation_item = next(i for i in items if i.type == "situation")
        assert situation_item.situation.id == situation.id

        word_of_day_item = next(i for i in items if i.type == "word_of_day")
        assert word_of_day_item.id == "word-of-day"

        deck_items = [i for i in items if i.type == "deck"]
        deck_item_ids = {i.deck_id for i in deck_items}
        assert deck_item_ids == {other1, other2}
        assert resume_id not in deck_item_ids  # resume deck excluded from 'deck' items

        milestone_item = next(i for i in items if i.type == "milestone")
        assert milestone_item.current_streak == 5
        assert milestone_item.longest_streak == 9

        news_items = [i for i in items if i.type == "news"]
        assert [i.news.id for i in news_items] == [n.id for n in news]

        quick_item = next(i for i in items if i.type == "quick")
        assert quick_item.queue_count == 2

    def test_deck_feed_items_preserve_input_list_order_not_recency(self) -> None:
        ids = [uuid4(), uuid4(), uuid4()]
        decks = [
            _deck_slice(deck_id=ids[0], last_studied_at=datetime(2026, 1, 1), status="in-progress"),
            # Most-recently-studied -> becomes the resume deck, excluded from
            # 'deck' items.
            _deck_slice(deck_id=ids[1], last_studied_at=datetime(2026, 3, 1), status="in-progress"),
            _deck_slice(deck_id=ids[2], last_studied_at=datetime(2026, 2, 1), status="in-progress"),
        ]

        signals = ComposeFeedSignals(
            deck_slices=decks,
            cards_due=0,
            situation=None,
            news=[],
            current_streak=0,
            longest_streak=0,
            queue_count=0,
        )

        items = compose_feed(signals)
        deck_items = [i for i in items if i.type == "deck"]

        # Remaining two decks (ids[0], ids[2]) must stay in list order, NOT
        # last-studied recency order (which would put ids[2] before ids[0]).
        assert [i.deck_id for i in deck_items] == [ids[0], ids[2]]


@pytest.mark.unit
class TestComposeFeedAllGatedOff:
    """AC-4: when every gated source is absent, only word_of_day (always
    emitted) — plus a resume item IFF pick_resume_deck still resolves one
    from a non-empty deck list — survives."""

    def test_single_non_qualifying_deck_still_yields_resume_plus_word_of_day(self) -> None:
        # Not-started, never studied, no cards due -> pick_resume_deck falls
        # back to decks[0] (rule c); the deck itself doesn't qualify for a
        # 'deck' feed item (not in-progress, due_today == 0), and it IS the
        # resume deck, so it's excluded from 'deck' items either way.
        only_deck = _deck_slice(
            deck_id=uuid4(), last_studied_at=None, status="not-started", due_today=0
        )

        signals = ComposeFeedSignals(
            deck_slices=[only_deck],
            cards_due=0,
            situation=None,
            news=[],
            current_streak=0,
            longest_streak=0,
            queue_count=0,
        )

        items = compose_feed(signals)
        types = [item.type for item in items]

        assert types == ["resume", "word_of_day"]
        assert items[0].deck_id == only_deck.deck_id
        assert items[0].sibling_deck_ids == []
        assert items[1].id == "word-of-day"

    def test_no_decks_at_all_yields_only_word_of_day(self) -> None:
        signals = ComposeFeedSignals(
            deck_slices=[],
            cards_due=0,
            situation=None,
            news=[],
            current_streak=0,
            longest_streak=0,
            queue_count=0,
        )

        items = compose_feed(signals)

        assert [item.type for item in items] == ["word_of_day"]
        assert items[0].id == "word-of-day"
