"""Adversarial / edge coverage for the daily scheduler jobs (OPS-01-04).

Complements the AC smoke + row-flow tests in ``test_scheduled_tasks_schema.py``.
Those prove the reconciled SQL *plans* (no ``UndefinedTableError``) and that a
single seeded row *flows through* each job. This file proves the reconciled
COLUMNS resolve to the RIGHT DATA — a wrong-but-existing column that still
"doesn't raise" (e.g. ``COUNT(DISTINCT r.user_id)`` pasted where
``COUNT(DISTINCT r.card_record_id)`` was intended) passes every "no-raise" check
yet counts wrong. Only asserting the exact aggregate VALUES catches it.

Oracle — why we spy the logger instead of reading caplog
--------------------------------------------------------
The AC tests read ``caplog_loguru``, which formats records as ``{message}`` only,
so the structured aggregate payload (``unique_cards`` / ``review_count`` /
``cards_mastered`` / per-user ``user_id``) is INVISIBLE there — you can see THAT a
"Daily user stats" line fired, not WHAT it counted. To assert on those values we
patch the module-level logger (``src.tasks.scheduled.logger``) with a MagicMock and
read the ``extra=`` dict of each ``logger.info(...)`` call. This is backend-agnostic
(independent of whether logging routes through loguru or stdlib) and lets a single
task run be interrogated per-user. The tasks use ``logger`` only for output — never
for control flow — so replacing it changes nothing about the SQL under test, and
the try/except still re-raises, so a genuinely broken query surfaces as an error.

Two-session note — identical to the AC file
-------------------------------------------
Each task opens its OWN session via ``get_session_factory()()``. We patch that onto
the test's savepoint-isolated ``db_session`` (``_patch_shared_db_session``) so seeded
rows are visible in the SAME transaction, and each test triggers exactly ONE task
``commit`` — within ``db_session``'s documented one-commit contract. Seeding is
flush-only (never commits). Timestamps are seeded at NOON UTC, matching the AC file
and the gamification precedent, so ``DATE()`` bucketing does not straddle a day
boundary.

The ``_patch_shared_db_session`` / ``_utc_noon`` helpers are re-declared here (not
imported from the sibling test module) to keep this file independent — mirroring how
the gamification precedent owns its own helpers.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import MagicMock, patch
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
from src.tasks.scheduled import stats_aggregate_task, streak_reset_task
from tests.factories.auth import UserFactory

_SCHEDULED = "src.tasks.scheduled.get_session_factory"
_LOGGER = "src.tasks.scheduled.logger"


# ---------------------------------------------------------------------------
# Session / time helpers (mirror the AC file, kept local for independence)
# ---------------------------------------------------------------------------


def _utc_noon(day: date) -> datetime:
    """Noon (UTC) on ``day`` — avoids day-boundary flakiness in DATE() bucketing."""
    return datetime.combine(day, time(12, 0, 0), tzinfo=timezone.utc)


def _patch_shared_db_session(db_session: AsyncSession):
    """Route the task onto the test's own db_session (seeded rows are visible).

    Yields the REAL db_session and does NOT close it, so the task's single commit
    lands inside the test's savepoint. Matches the AC file's helper exactly.
    """

    @asynccontextmanager
    async def _ctx():
        yield db_session

    factory = MagicMock(return_value=_ctx())
    return patch(_SCHEDULED, return_value=factory)


# ---------------------------------------------------------------------------
# Logger-spy readers
# ---------------------------------------------------------------------------


def _extras_for(mock_logger: MagicMock, message: str) -> list[dict]:
    """All ``extra=`` payloads from ``logger.info`` calls whose message == ``message``."""
    out: list[dict] = []
    for c in mock_logger.info.call_args_list:
        if c.args and c.args[0] == message:
            out.append(c.kwargs["extra"])
    return out


def _daily_stats_by_user(mock_logger: MagicMock) -> dict[str, dict]:
    """Map ``user_id`` -> the "Daily user stats" ``extra`` payload for that user."""
    return {e["user_id"]: e for e in _extras_for(mock_logger, "Daily user stats")}


def _broken_streaks_by_user(mock_logger: MagicMock) -> dict[str, dict]:
    """Map ``user_id`` -> the "User streak broken" ``extra`` payload for that user."""
    return {e["user_id"]: e for e in _extras_for(mock_logger, "User streak broken")}


# ---------------------------------------------------------------------------
# Seeding helpers — decomposed so multiple cards/reviews can attach to ONE user
# (the AC file's _seed_review always makes a fresh user, which the multi-card /
# mastery-filter assertions below cannot use).
# ---------------------------------------------------------------------------


async def _make_user_and_deck(db_session: AsyncSession):
    """Create a fresh User + active Deck. Returns (user, deck)."""
    user = await UserFactory.create()
    deck = Deck(
        name_en=f"Sched Deck {uuid4().hex[:6]}",
        name_el="Τεστ",
        name_ru="Тест",
        description_en="Test",
        description_el="Τεστ",
        description_ru="Тест",
        level=DeckLevel.A1,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    return user, deck


async def _add_card(db_session: AsyncSession, deck: Deck) -> CardRecord:
    """Create WordEntry -> DeckWordEntry -> CardRecord in ``deck``. Returns the card."""
    word = WordEntry(
        owner_id=None,
        lemma=f"λέξη_{uuid4().hex[:4]}",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="word",
        is_active=True,
    )
    db_session.add(word)
    await db_session.flush()

    db_session.add(DeckWordEntry(deck_id=deck.id, word_entry_id=word.id))
    await db_session.flush()

    card = CardRecord(
        word_entry_id=word.id,
        deck_id=deck.id,
        card_type=CardType.MEANING_EL_TO_EN,
        variant_key=f"sched_adv_{uuid4().hex[:8]}",
        front_content={"card_type": "meaning_el_to_en", "prompt": "Translate", "main": "λέξη"},
        back_content={"card_type": "meaning_el_to_en", "answer": "word"},
    )
    db_session.add(card)
    await db_session.flush()
    return card


async def _add_review(
    db_session: AsyncSession,
    user,
    card: CardRecord,
    *,
    reviewed_at: datetime,
    quality: int = 4,
    time_taken: int = 3000,
) -> None:
    """Seed one CardRecordReview (flush only)."""
    db_session.add(
        CardRecordReview(
            user_id=user.id,
            card_record_id=card.id,
            quality=quality,
            time_taken=time_taken,
            reviewed_at=reviewed_at,
        )
    )
    await db_session.flush()


async def _add_stat(
    db_session: AsyncSession,
    user,
    card: CardRecord,
    *,
    status: CardStatus,
    updated_at: datetime,
) -> None:
    """Seed one CardRecordStatistics with an explicit ``updated_at`` (flush only).

    ``updated_at`` has ``onupdate=func.now()`` (fires on UPDATE only) and a
    ``server_default`` (suppressed when a value is supplied), so on this single
    INSERT the explicit value persists verbatim — the mastery date-filter assertion
    depends on that.
    """
    db_session.add(
        CardRecordStatistics(
            user_id=user.id,
            card_record_id=card.id,
            easiness_factor=2.5,
            interval=1,
            repetitions=2,
            next_review_date=date.today(),
            status=status,
            updated_at=updated_at,
        )
    )
    await db_session.flush()


# ===========================================================================
# stats_aggregate_task — review-query column correctness
# ===========================================================================


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.timeout(60)
class TestStatsAggregateReviewColumns:
    async def test_unique_cards_counts_distinct_card_records_not_rows_or_users(
        self,
        db_session: AsyncSession,
    ) -> None:
        """``unique_cards`` == COUNT(DISTINCT card_record_id), distinct from COUNT(*) and users.

        Seeds 3 reviews for ONE user across 2 DISTINCT cards (cardA twice, cardB
        once), all on the target date. The three candidate SQL expressions give
        three different numbers, so the assertions pin the correct column:

            COUNT(*)                        -> 3   (review_count)
            COUNT(DISTINCT r.card_record_id)-> 2   (unique_cards)      <- correct
            COUNT(DISTINCT r.user_id)       -> 1   (silent wrong-column trap)

        A "no-raise" smoke cannot tell these apart (user_id is a real column);
        asserting unique_cards == 2 does. Also pins AVG(quality) and SUM(time_taken)
        to real seeded values so a wrong column on those raises the count, not a
        false green.
        """
        target = datetime.now(timezone.utc).date() - timedelta(days=1)
        user, deck = await _make_user_and_deck(db_session)
        card_a = await _add_card(db_session, deck)
        card_b = await _add_card(db_session, deck)

        # cardA reviewed twice, cardB once -> 3 rows, 2 distinct cards.
        await _add_review(
            db_session, user, card_a, reviewed_at=_utc_noon(target), quality=5, time_taken=1000
        )
        await _add_review(
            db_session, user, card_a, reviewed_at=_utc_noon(target), quality=4, time_taken=2000
        )
        await _add_review(
            db_session, user, card_b, reviewed_at=_utc_noon(target), quality=4, time_taken=3000
        )

        with _patch_shared_db_session(db_session), patch(_LOGGER) as mock_logger:
            await stats_aggregate_task()

        stats = _daily_stats_by_user(mock_logger)
        assert str(user.id) in stats, "seeded user did not appear in the review aggregate"
        row = stats[str(user.id)]

        assert row["review_count"] == 3, f"COUNT(*) wrong: {row['review_count']}"
        assert row["unique_cards"] == 2, (
            f"unique_cards={row['unique_cards']} — expected 2 distinct card_record_ids; "
            "1 would mean COUNT(DISTINCT user_id), 3 would mean COUNT(*)"
        )
        # SUM(time_taken) and AVG(quality) must resolve to the seeded values.
        assert row["study_time_seconds"] == 6000, "SUM(time_taken) wrong column/value"
        assert row["avg_quality"] == pytest.approx(
            4.33, abs=0.01
        ), "AVG(quality) wrong column/value"

    async def test_stats_aggregate_groups_independently_per_user(
        self,
        db_session: AsyncSession,
    ) -> None:
        """GROUP BY r.user_id — each user's aggregate is computed independently.

        Two users on the same target date: userA has 2 reviews / 2 cards, userB has
        1 review / 1 card. A correct GROUP BY yields two rows with each user's own
        totals; a missing/incorrect grouping either raises (non-aggregated user_id)
        or cross-contaminates the counts.
        """
        target = datetime.now(timezone.utc).date() - timedelta(days=1)

        user_a, deck_a = await _make_user_and_deck(db_session)
        a1 = await _add_card(db_session, deck_a)
        a2 = await _add_card(db_session, deck_a)
        await _add_review(db_session, user_a, a1, reviewed_at=_utc_noon(target))
        await _add_review(db_session, user_a, a2, reviewed_at=_utc_noon(target))

        user_b, deck_b = await _make_user_and_deck(db_session)
        b1 = await _add_card(db_session, deck_b)
        await _add_review(db_session, user_b, b1, reviewed_at=_utc_noon(target))

        with _patch_shared_db_session(db_session), patch(_LOGGER) as mock_logger:
            await stats_aggregate_task()

        stats = _daily_stats_by_user(mock_logger)
        assert set(stats) == {
            str(user_a.id),
            str(user_b.id),
        }, f"expected exactly one aggregate row per user, got {set(stats)}"
        assert stats[str(user_a.id)]["review_count"] == 2
        assert stats[str(user_a.id)]["unique_cards"] == 2
        assert stats[str(user_b.id)]["review_count"] == 1
        assert stats[str(user_b.id)]["unique_cards"] == 1

    async def test_stats_aggregate_includes_only_target_date_reviews(
        self,
        db_session: AsyncSession,
    ) -> None:
        """WHERE DATE(r.reviewed_at) = :target_date — strict single-day boundary.

        One user with three reviews on three distinct cards dated: the target
        (yesterday), the day before, and today. Only the yesterday review must be
        counted (review_count == 1); a ``>=`` or off-by-one date filter would
        inflate the count.
        """
        today = datetime.now(timezone.utc).date()
        target = today - timedelta(days=1)

        user, deck = await _make_user_and_deck(db_session)
        c_in = await _add_card(db_session, deck)
        c_before = await _add_card(db_session, deck)
        c_after = await _add_card(db_session, deck)

        await _add_review(db_session, user, c_in, reviewed_at=_utc_noon(target))
        await _add_review(
            db_session, user, c_before, reviewed_at=_utc_noon(target - timedelta(days=1))
        )
        await _add_review(db_session, user, c_after, reviewed_at=_utc_noon(today))

        with _patch_shared_db_session(db_session), patch(_LOGGER) as mock_logger:
            await stats_aggregate_task()

        stats = _daily_stats_by_user(mock_logger)
        assert str(user.id) in stats
        row = stats[str(user.id)]
        assert (
            row["review_count"] == 1
        ), f"review_count={row['review_count']} — only the target-date review must count"
        assert row["unique_cards"] == 1


# ===========================================================================
# stats_aggregate_task — mastery-query filter correctness
# ===========================================================================


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.timeout(60)
class TestStatsAggregateMasteryFilter:
    async def test_mastery_counts_only_mastered_on_target_date(
        self,
        db_session: AsyncSession,
    ) -> None:
        """cards_mastered == COUNT of status='MASTERED' AND DATE(updated_at)=:target_date.

        The AC row-flow test only proves the mastery query does not raise; it never
        checks the COUNT (``cards_mastered`` lives in the ``extra`` payload, invisible
        to caplog). Here one user is seeded with:

            - a review on the target date (so the user appears in daily_review_stats,
              which is the only place cards_mastered is emitted),
            - card M1: MASTERED, updated_at = target date        -> COUNTS
            - card M2: MASTERED, updated_at = target - 2 days     -> wrong date, excluded
            - card M3: status=REVIEW, updated_at = target date    -> wrong status, excluded

        Correct filter -> cards_mastered == 1. Dropping the date predicate -> 2;
        dropping the status predicate -> 2. Either regression is caught.
        """
        target = datetime.now(timezone.utc).date() - timedelta(days=1)

        user, deck = await _make_user_and_deck(db_session)

        # Review on the target date so this user is emitted at all.
        review_card = await _add_card(db_session, deck)
        await _add_review(db_session, user, review_card, reviewed_at=_utc_noon(target))

        # The one that should count.
        m1 = await _add_card(db_session, deck)
        await _add_stat(
            db_session, user, m1, status=CardStatus.MASTERED, updated_at=_utc_noon(target)
        )
        # MASTERED but wrong date.
        m2 = await _add_card(db_session, deck)
        await _add_stat(
            db_session,
            user,
            m2,
            status=CardStatus.MASTERED,
            updated_at=_utc_noon(target - timedelta(days=2)),
        )
        # Right date but not mastered.
        m3 = await _add_card(db_session, deck)
        await _add_stat(
            db_session, user, m3, status=CardStatus.REVIEW, updated_at=_utc_noon(target)
        )

        with _patch_shared_db_session(db_session), patch(_LOGGER) as mock_logger:
            await stats_aggregate_task()

        stats = _daily_stats_by_user(mock_logger)
        assert str(user.id) in stats
        assert stats[str(user.id)]["cards_mastered"] == 1, (
            f"cards_mastered={stats[str(user.id)]['cards_mastered']} — only the MASTERED "
            "row dated on target_date must count (2 => date or status filter dropped)"
        )


# ===========================================================================
# streak_reset_task — HAVING MAX(DATE(reviewed_at)) < :yesterday boundary
# ===========================================================================


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.timeout(60)
class TestStreakResetBoundary:
    async def test_streak_reset_boundary_is_strict_less_than_yesterday(
        self,
        db_session: AsyncSession,
    ) -> None:
        """HAVING MAX(DATE(reviewed_at)) < :yesterday — strict, not <=.

        Two users:
            - user_intact: last review EXACTLY on yesterday -> MAX == yesterday,
              NOT < yesterday -> streak intact, NOT flagged.
            - user_broken: last review the day before yesterday -> MAX < yesterday
              -> flagged, with days_since_review == 2.

        The intact user's absence from the flagged set proves the boundary is a
        strict ``<`` (a ``<=`` bug would wrongly flag a user who studied yesterday).
        Asserting days_since_review == 2 also proves ``last_review_date`` resolves to
        the real seeded value rather than null/garbage.
        """
        today = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)

        user_intact, deck_i = await _make_user_and_deck(db_session)
        card_i = await _add_card(db_session, deck_i)
        await _add_review(db_session, user_intact, card_i, reviewed_at=_utc_noon(yesterday))

        user_broken, deck_b = await _make_user_and_deck(db_session)
        card_b = await _add_card(db_session, deck_b)
        await _add_review(
            db_session, user_broken, card_b, reviewed_at=_utc_noon(today - timedelta(days=2))
        )

        with _patch_shared_db_session(db_session), patch(_LOGGER) as mock_logger:
            await streak_reset_task()

        flagged = _broken_streaks_by_user(mock_logger)
        assert str(user_broken.id) in flagged, "user with a stale streak was not flagged"
        assert (
            str(user_intact.id) not in flagged
        ), "user who studied EXACTLY yesterday was wrongly flagged — boundary must be strict <"
        assert (
            flagged[str(user_broken.id)]["days_since_review"] == 2
        ), "last_review_date did not resolve to the seeded value"
