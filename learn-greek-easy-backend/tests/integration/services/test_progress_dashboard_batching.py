"""Integration tests for PERF-10-02: dashboard round-trip batching.

Two tests:
  AC1 — test_dashboard_roundtrip_count_reduced (RED pre-impl)
      Seeds a user with rows across all consolidated query groups and asserts
      that _compute_dashboard_stats issues <= 12 SQL statements.  Current code
      issues ~20, so this assertion FAILS until the executor lands the four new
      aggregate repo methods.

  AC2 — test_dashboard_output_unchanged_after_batching (golden-snapshot lock)
      Seeds the same representative dataset and asserts that every
      DashboardStatsResponse field fed by the four consolidated queries matches
      a deterministically-computed expected value.  This is NOT a test-first
      RED — it passes against both the current and post-consolidation code
      (same arithmetic, same values) and acts as a regression lock.

AC3 note (fan-out cap): N/A — the implementation plan uses query consolidation
only (no asyncio.gather, no new sessions, no extra connections).  The single
shared AsyncSession constraint (INFRA-01) is satisfied trivially.

Seeded data shape (one user, fixed timestamps):
  - 1 Deck + WordEntry + CardRecord (required FK chain for CardRecordReview)
  - 3 CardRecordReview rows:
      * 2 today, quality >=3 (correct), time_taken=10 each
      * 1 reviewed 15 days ago, quality=1 (incorrect), time_taken=20
  - 1 CardRecordStatistics (MASTERED status) — feeds count_by_status
  - 1 CultureDeck + 2 CultureQuestion rows
  - 1 CultureQuestionStats (MASTERED) — feeds count_all_by_status / count_mastered
  - 1 CultureAnswerHistory today, time_taken_seconds=30
  - 1 CultureAnswerHistory 10 days ago, time_taken_seconds=25 (outside this-week window)
  - 1 MockExamSession (COMPLETED), today, time_taken_seconds=60
"""

from __future__ import annotations

import sys
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Any, Generator
from uuid import UUID, uuid4

# Pre-mock spaCy before importing any service that pulls MorphologyService.
if "spacy" not in sys.modules:
    from unittest.mock import MagicMock

    sys.modules["spacy"] = MagicMock()
    sys.modules["spacy.pipeline"] = MagicMock()
    sys.modules["spacy.tokens"] = MagicMock()
    sys.modules["spacy.language"] = MagicMock()
    sys.modules["spacy.vocab"] = MagicMock()

import pytest
import pytest_asyncio
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from src.db.models import (
    CardRecord,
    CardRecordReview,
    CardRecordStatistics,
    CardStatus,
    CardType,
    CultureAnswerHistory,
    CultureDeck,
    CultureQuestion,
    CultureQuestionStats,
    Deck,
    DeckLevel,
    DeckWordEntry,
    MockExamSession,
    MockExamStatus,
    PartOfSpeech,
    User,
    WordEntry,
)
from src.services.progress_service import ProgressService

# ---------------------------------------------------------------------------
# Pre-computed counts that all AC2 assertions derive from.
# These are computed from the seeded data — not captured from current output.
# ---------------------------------------------------------------------------

# CardRecordReview seeding
_TODAY_START = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
_DAYS_AGO_15 = _TODAY_START - timedelta(days=15)
_DAYS_AGO_10 = _TODAY_START - timedelta(days=10)
_DAYS_AGO_2 = _TODAY_START - timedelta(days=2)

# Review rows:
#   review_a: today, quality=3, time_taken=10  -> correct (quality>=3)
#   review_b: today, quality=4, time_taken=10  -> correct
#   review_c: 15 days ago, quality=1, time_taken=20  -> incorrect
# For get_accuracy_stats(days=30): all 3 rows within 30d window
#   total=3, correct=2  ->  accuracy_pct = round(2/3 * 100, 1) = 66.7
_REVIEW_TOTAL_30D = 3
_REVIEW_CORRECT_30D = 2
_REVIEW_ACCURACY_PCT = round(_REVIEW_CORRECT_30D / _REVIEW_TOTAL_30D * 100, 1)

# get_total_study_time (vocab): sum of all time_taken for user = 10+10+20 = 40
_REVIEW_TOTAL_STUDY_TIME = 40

# get_last_review_date: max(reviewed_at).date() = today
_REVIEW_LAST_DATE: date = date.today()

# count_reviews_today: 2 (review_a and review_b)
_REVIEWS_TODAY = 2

# get_study_time_today (vocab): 10+10 = 20
_REVIEW_STUDY_TIME_TODAY = 20

# CultureAnswerHistory seeding:
#   answer_a: today, time_taken_seconds=30
#   answer_b: 10 days ago (outside 7-day window), time_taken_seconds=25
# get_total_study_time (culture):
#   both within cap (MAX_ANSWER_TIME_SECONDS is 600 or similar, both well below)
#   total = 30 + 25 = 55
_CULTURE_TOTAL_STUDY_TIME = 55

# get_study_time_this_week: rolling 7d window -> only answer_a qualifies (today)
#   total = 30
_CULTURE_WEEKLY_STUDY_TIME = 30

# count_answers_today: 1 (answer_a)
_CULTURE_ANSWERS_TODAY = 1

# get_study_time_today: today via func.date() match -> 30
_CULTURE_STUDY_TIME_TODAY = 30

# MockExamSession seeding:
#   session_a: COMPLETED today, time_taken_seconds=60
# get_total_study_time (mock): 60
_MOCK_TOTAL_STUDY_TIME = 60

# get_study_time_today (mock): 60
_MOCK_STUDY_TIME_TODAY = 60

# Combined overview fields
_TOTAL_STUDY_TIME = _REVIEW_TOTAL_STUDY_TIME + _CULTURE_TOTAL_STUDY_TIME + _MOCK_TOTAL_STUDY_TIME
# = 40 + 55 + 60 = 155


# ---------------------------------------------------------------------------
# SQL statement counter (mirrors capture_sql in test_deck_repository.py)
# ---------------------------------------------------------------------------


@contextmanager
def capture_sql(engine: AsyncEngine) -> Generator[list[str], None, None]:
    """Capture real SQL statements emitted on *engine* during the block.

    Attaches a ``before_cursor_execute`` listener to the underlying
    synchronous engine.  Only real cursor executions (not transaction
    control bookkeeping) are counted.  Fixture-setup SQL that runs
    outside the ``with`` body is excluded.

    Usage::

        with capture_sql(db_engine) as stmts:
            await service._compute_dashboard_stats(user_id)
        assert len(stmts) <= 12
    """
    stmts: list[str] = []

    def _hook(
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        stmts.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", _hook)
    try:
        yield stmts
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", _hook)


# ---------------------------------------------------------------------------
# Shared seeding helpers
# ---------------------------------------------------------------------------


async def _seed_user(db_session: AsyncSession) -> User:
    user = User(email=f"perf10_{uuid4().hex[:8]}@example.com", is_active=True)
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


async def _seed_deck_card_record(
    db_session: AsyncSession,
) -> tuple[Deck, WordEntry, CardRecord]:
    """Create the Deck → WordEntry → CardRecord FK chain required by CardRecordReview."""
    deck = Deck(
        name_en="PERF-10 Test Deck",
        name_el="Τεστ",
        name_ru="Тест",
        description_en="test",
        description_el="test",
        description_ru="test",
        level=DeckLevel.A1,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()

    word_entry = WordEntry(
        owner_id=None,
        lemma="λόγος",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="word",
        is_active=True,
    )
    db_session.add(word_entry)
    await db_session.flush()
    db_session.add(DeckWordEntry(deck_id=deck.id, word_entry_id=word_entry.id))
    await db_session.flush()

    card_record = CardRecord(
        word_entry_id=word_entry.id,
        deck_id=deck.id,
        card_type=CardType.MEANING_EL_TO_EN,
        variant_key="default",
        front_content={"card_type": "meaning_el_to_en", "prompt": "Translate", "main": "λόγος"},
        back_content={"card_type": "meaning_el_to_en", "answer": "word"},
    )
    db_session.add(card_record)
    await db_session.flush()
    await db_session.refresh(card_record)
    return deck, word_entry, card_record


async def _seed_culture_setup(
    db_session: AsyncSession,
) -> tuple[CultureDeck, CultureQuestion]:
    """Create a CultureDeck + two CultureQuestion rows."""
    culture_deck = CultureDeck(
        name_en="PERF-10 Culture Deck",
        name_el="Τεστ Κουλτούρα",
        name_ru="Тест Культура",
        description_en="test",
        description_el="test",
        description_ru="test",
        category="history",
        is_active=True,
    )
    db_session.add(culture_deck)
    await db_session.flush()

    def _make_question(deck_id: UUID) -> CultureQuestion:
        return CultureQuestion(
            deck_id=deck_id,
            question_text={"en": "Q?", "el": "Ε;"},
            option_a={"en": "A", "el": "Α"},
            option_b={"en": "B", "el": "Β"},
            option_c={"en": "C", "el": "Γ"},
            option_d={"en": "D", "el": "Δ"},
            correct_option=1,
        )

    q1 = _make_question(culture_deck.id)
    q2 = _make_question(culture_deck.id)
    db_session.add(q1)
    db_session.add(q2)
    await db_session.flush()
    await db_session.refresh(q1)
    return culture_deck, q1


async def _seed_all_dashboard_data(
    db_session: AsyncSession,
    user: User,
) -> None:
    """Seed data covering all four query groups that the executor will consolidate.

    Groups:
      NEW1 — CardRecordReview (accuracy, last_review, study_time, reviews_today, today_time)
      NEW2 — CultureAnswerHistory (total_time, weekly_time, answers_today, today_time)
      NEW3 — MockExamSession (total_time, today_time)
      NEW4 — CultureQuestionStats (count_all_by_status 3→2)
    """
    # --- CardRecord FK chain ---
    _deck, _word_entry, card_record = await _seed_deck_card_record(db_session)

    # --- CardRecordReview rows (Group NEW1) ---
    # review_a: today, quality=3 (correct), time_taken=10
    db_session.add(
        CardRecordReview(
            user_id=user.id,
            card_record_id=card_record.id,
            quality=3,
            time_taken=10,
            reviewed_at=_TODAY_START + timedelta(hours=9),
        )
    )
    # review_b: today, quality=4 (correct), time_taken=10
    db_session.add(
        CardRecordReview(
            user_id=user.id,
            card_record_id=card_record.id,
            quality=4,
            time_taken=10,
            reviewed_at=_TODAY_START + timedelta(hours=10),
        )
    )
    # review_c: 15 days ago, quality=1 (incorrect), time_taken=20
    db_session.add(
        CardRecordReview(
            user_id=user.id,
            card_record_id=card_record.id,
            quality=1,
            time_taken=20,
            reviewed_at=_DAYS_AGO_15 + timedelta(hours=9),
        )
    )

    # --- CardRecordStatistics (MASTERED, feeds count_by_status) ---
    db_session.add(
        CardRecordStatistics(
            user_id=user.id,
            card_record_id=card_record.id,
            status=CardStatus.MASTERED,
            next_review_date=date.today() + timedelta(days=30),
        )
    )

    # --- Culture setup ---
    _culture_deck, question = await _seed_culture_setup(db_session)

    # --- CultureQuestionStats (MASTERED, feeds count_all_by_status/count_mastered) ---
    db_session.add(
        CultureQuestionStats(
            user_id=user.id,
            question_id=question.id,
            status=CardStatus.MASTERED,
            next_review_date=date.today() + timedelta(days=30),
        )
    )

    # --- CultureAnswerHistory rows (Group NEW2) ---
    # answer_a: today
    db_session.add(
        CultureAnswerHistory(
            user_id=user.id,
            question_id=question.id,
            language="en",
            is_correct=True,
            selected_option=1,
            time_taken_seconds=30,
            deck_category="history",
            created_at=_TODAY_START + timedelta(hours=8),
        )
    )
    # answer_b: 10 days ago (outside 7-day rolling window for get_study_time_this_week)
    db_session.add(
        CultureAnswerHistory(
            user_id=user.id,
            question_id=question.id,
            language="en",
            is_correct=True,
            selected_option=1,
            time_taken_seconds=25,
            deck_category="history",
            created_at=_DAYS_AGO_10 + timedelta(hours=8),
        )
    )

    # --- MockExamSession (Group NEW3) ---
    # COMPLETED today, time_taken_seconds=60
    completed_at = _TODAY_START + timedelta(hours=11)
    db_session.add(
        MockExamSession(
            user_id=user.id,
            started_at=_TODAY_START + timedelta(hours=10),
            completed_at=completed_at,
            status=MockExamStatus.COMPLETED,
            score=20,
            total_questions=25,
            passed=True,
            time_taken_seconds=60,
        )
    )

    await db_session.flush()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def dashboard_user(db_session: AsyncSession) -> User:
    """Isolated user seeded with data exercising all consolidated query groups."""
    user = await _seed_user(db_session)
    await _seed_all_dashboard_data(db_session, user)
    return user


# ---------------------------------------------------------------------------
# AC1: Round-trip count test (RED pre-implementation)
# ---------------------------------------------------------------------------


# PRE-CHANGE STATEMENT COUNT (documented baseline)
_CURRENT_STATEMENT_COUNT = 20
# Target after consolidation (11 per architect plan, guard ≤12)
_TARGET_STATEMENT_COUNT = 12


@pytest.mark.asyncio
@pytest.mark.integration
class TestDashboardRoundtripCount:
    """AC1 — dashboard SQL round-trip count must be reduced.

    RED BEFORE implementation: current code issues ~20 statements, which
    exceeds the <=12 assertion.  This test turns GREEN when the executor
    adds the four new aggregate repo methods in PERF-10-02.

    The test calls _compute_dashboard_stats directly (bypassing the PERF-05
    Redis cache wrapper) so it always measures the full compute path.
    """

    async def test_dashboard_roundtrip_count_reduced(
        self,
        db_session: AsyncSession,
        db_engine: AsyncEngine,
        dashboard_user: User,
    ) -> None:
        """Assert _compute_dashboard_stats issues <=12 AND <20 SQL statements.

        RED reason (pre-implementation): current code issues 20 real SQL
        statements on _compute_dashboard_stats.  The <=12 assertion fails
        because 20 > 12.  This is the correct RED failure mode — not a
        collection/import error and not a wrong-reason failure.

        GREEN after: executor consolidates 11 statements using 4 new methods.
        """
        service = ProgressService(db_session)

        with capture_sql(db_engine) as stmts:
            await service._compute_dashboard_stats(dashboard_user.id)

        count = len(stmts)

        # The dual assertion:
        #   <=12  — the post-consolidation target (1 slot of headroom)
        #   <20   — strictly fewer than the measured pre-change baseline
        # Both must hold simultaneously for GREEN.
        assert count <= _TARGET_STATEMENT_COUNT, (
            f"Dashboard issued {count} SQL statements (baseline={_CURRENT_STATEMENT_COUNT}, "
            f"target<={_TARGET_STATEMENT_COUNT}).  "
            f"Executor must consolidate CardRecordReview (5→1), CultureAnswerHistory (4→1), "
            f"MockExamSession (2→1), and CultureQuestionStats count_all_by_status (3→2). "
            f"Statements captured:\n" + "\n---\n".join(stmts)
        )
        assert count < _CURRENT_STATEMENT_COUNT, (
            f"Dashboard issued {count} statements — not fewer than the pre-change "
            f"baseline of {_CURRENT_STATEMENT_COUNT}.  Consolidation had no effect."
        )


# ---------------------------------------------------------------------------
# AC2: Golden-snapshot output-identity test (regression lock)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
class TestDashboardOutputUnchangedAfterBatching:
    """AC2 — DashboardStatsResponse fields fed by the consolidated queries are
    byte-identical before and after the batching change.

    This test is NOT a test-first RED — it passes on both the current code and
    the post-consolidation code because the arithmetic is the same.  Its role
    is to catch any accidental semantic drift (wrong FILTER predicate, missing
    COALESCE, off-by-one in cutoff) introduced during the executor's rewrite.

    The expected values are derived deterministically from the seeded data
    (constants at the top of this file) — NOT captured from current output,
    which would make the assertion tautological.
    """

    async def test_dashboard_output_unchanged_after_batching(
        self,
        db_session: AsyncSession,
        dashboard_user: User,
    ) -> None:
        """Assert every DashboardStatsResponse field fed by the 4 new methods
        matches its deterministically-computed expected value.

        Fields under assertion (all fed by the consolidated groups):
          overview:
            accuracy_percentage          — NEW1 (correct_30d / total_30d)
            total_study_time_seconds     — NEW1 + NEW2 + NEW3 totals
            culture_weekly_study_time_seconds  — NEW2 (rolling 7d)
          today:
            reviews_completed            — NEW1 (reviews_today) + NEW2 (answers_today)
            study_time_seconds           — NEW1 + NEW2 + NEW3 today times
          streak:
            last_study_date              — NEW1 (max reviewed_at → date)
          culture stats (implicitly via count_all_by_status NEW4):
            culture mastered count in cards_by_status['mastered'] >= 1
        """
        service = ProgressService(db_session)
        result = await service._compute_dashboard_stats(dashboard_user.id)

        # --- overview.accuracy_percentage ---
        assert result.overview.accuracy_percentage == _REVIEW_ACCURACY_PCT, (
            f"accuracy_percentage mismatch: got {result.overview.accuracy_percentage}, "
            f"expected {_REVIEW_ACCURACY_PCT} "
            f"(correct={_REVIEW_CORRECT_30D}, total={_REVIEW_TOTAL_30D})"
        )

        # --- overview.total_study_time_seconds ---
        assert result.overview.total_study_time_seconds == _TOTAL_STUDY_TIME, (
            f"total_study_time_seconds mismatch: got {result.overview.total_study_time_seconds}, "
            f"expected {_TOTAL_STUDY_TIME} "
            f"(vocab={_REVIEW_TOTAL_STUDY_TIME} + culture={_CULTURE_TOTAL_STUDY_TIME} "
            f"+ mock={_MOCK_TOTAL_STUDY_TIME})"
        )

        # --- overview.culture_weekly_study_time_seconds ---
        assert result.overview.culture_weekly_study_time_seconds == _CULTURE_WEEKLY_STUDY_TIME, (
            f"culture_weekly_study_time_seconds mismatch: "
            f"got {result.overview.culture_weekly_study_time_seconds}, "
            f"expected {_CULTURE_WEEKLY_STUDY_TIME} "
            f"(only answer_a within rolling 7d window)"
        )

        # --- today.reviews_completed ---
        # reviews_completed = reviews_today + culture_answers_today
        expected_reviews_completed = _REVIEWS_TODAY + _CULTURE_ANSWERS_TODAY
        assert result.today.reviews_completed == expected_reviews_completed, (
            f"today.reviews_completed mismatch: got {result.today.reviews_completed}, "
            f"expected {expected_reviews_completed} "
            f"(vocab_today={_REVIEWS_TODAY} + culture_today={_CULTURE_ANSWERS_TODAY})"
        )

        # --- today.study_time_seconds ---
        expected_today_study_time = (
            _REVIEW_STUDY_TIME_TODAY + _CULTURE_STUDY_TIME_TODAY + _MOCK_STUDY_TIME_TODAY
        )
        assert result.today.study_time_seconds == expected_today_study_time, (
            f"today.study_time_seconds mismatch: got {result.today.study_time_seconds}, "
            f"expected {expected_today_study_time} "
            f"(vocab={_REVIEW_STUDY_TIME_TODAY} + culture={_CULTURE_STUDY_TIME_TODAY} "
            f"+ mock={_MOCK_STUDY_TIME_TODAY})"
        )

        # --- streak.last_study_date ---
        # max(reviewed_at) for the user is today's reviews → last_study_date = date.today()
        assert result.streak.last_study_date == _REVIEW_LAST_DATE, (
            f"streak.last_study_date mismatch: "
            f"got {result.streak.last_study_date}, expected {_REVIEW_LAST_DATE}"
        )

        # --- cards_by_status['mastered'] >= 1 (at least the 1 MASTERED culture stat) ---
        mastered_count = result.cards_by_status.get("mastered", 0)
        assert mastered_count >= 1, (
            f"cards_by_status['mastered'] must be >= 1 (seeded 1 MASTERED CultureQuestionStats "
            f"+ 1 MASTERED CardRecordStatistics), got {mastered_count}.  "
            f"count_all_by_status consolidation (NEW4) must preserve the mastered bucket."
        )
