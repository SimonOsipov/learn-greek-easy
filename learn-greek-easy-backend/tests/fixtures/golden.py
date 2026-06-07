"""Golden-test seed fixture and equality oracle for PERF-03 SQL consolidation.

This module provides:

1. ``assert_session_utc`` — reusable async helper that verifies the Postgres
   session timezone is UTC.  Call it at the top of any test that depends on
   date-bucketing so timezone drift is detected before it causes a spurious
   failure.

2. ``GoldenSeed`` — NamedTuple that bundles all rows inserted by
   ``golden_seed_fixture`` so downstream tests can reference them without
   re-querying.

3. ``golden_seed_fixture`` — pytest_asyncio fixture that inserts one user with
   data from all four activity sources (vocab / culture / exercise / mock-exam)
   including ≥1 UTC day-boundary pair.  Downstream SQLCON subtasks import this
   fixture and assert that their consolidated SQL produces value-identical
   results to the legacy N-query approach.

4. ``assert_rows_equal`` — the equality oracle.  Compares two sequences of
   result rows / dicts by VALUE, wrapping floats in ``pytest.approx``.  Do NOT
   use ``repr`` or ``str`` comparison — use this helper.

Usage (in a downstream SQLCON subtask test)::

    from tests.fixtures.golden import golden_seed_fixture, assert_rows_equal  # noqa: F401

    async def test_consolidated_query_matches_legacy(
        db_session: AsyncSession,
        golden_seed_fixture: GoldenSeed,
    ):
        legacy_rows   = await legacy_query(db_session, golden_seed_fixture.user.id)
        new_rows      = await consolidated_query(db_session, golden_seed_fixture.user.id)
        assert_rows_equal(legacy_rows, new_rows)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, NamedTuple
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CardRecord,
    CardRecordReview,
    CardRecordStatistics,
    CardStatus,
    CardType,
    CultureAnswerHistory,
    CultureDeck,
    CultureQuestion,
    Deck,
    ExerciseReview,
    MockExamSession,
    MockExamStatus,
    PartOfSpeech,
    ReviewRating,
    User,
    WordEntry,
)
from tests.factories.auth import UserFactory
from tests.factories.content import DeckFactory
from tests.factories.culture import (
    CultureAnswerHistoryFactory,
    CultureDeckFactory,
    CultureQuestionFactory,
)
from tests.factories.exercise import ExerciseReviewFactory
from tests.factories.mock_exam import MockExamSessionFactory

# =============================================================================
# UTC session assert helper
# =============================================================================


async def assert_session_utc(session: AsyncSession) -> None:
    """Assert that the Postgres session timezone is UTC.

    This is a reusable helper — call it at the start of any test that relies
    on date-bucketing logic so that timezone drift (e.g., a connection pool
    re-using a session whose server_settings were not pinned) is detected
    immediately with a clear message rather than a spurious assertion failure
    deep inside the test.

    Args:
        session: An open AsyncSession (must have an active connection).

    Raises:
        AssertionError: If TimeZone != 'UTC'.
    """
    result = await session.execute(text("SELECT current_setting('TimeZone')"))
    tz = result.scalar_one()
    assert tz == "UTC", (
        f"Postgres session timezone is '{tz}', expected 'UTC'. "
        "Check create_test_engine server_settings and production session config."
    )


# =============================================================================
# GoldenSeed container
# =============================================================================


class GoldenSeed(NamedTuple):
    """All rows seeded by ``golden_seed_fixture``.

    Attributes:
        user: The seeded User.
        card_record: The CardRecord (vocabulary flashcard).
        card_record_stats: SM-2 statistics for the card record.
        vocab_reviews: Two CardRecordReview rows — one before and one after a
            UTC midnight boundary to expose timezone-bucketing bugs.
        culture_deck: The CultureDeck used for culture questions.
        culture_question: The CultureQuestion used for answer history.
        culture_answers: Two CultureAnswerHistory rows — same UTC boundary pair.
        exercise_review: One ExerciseReview row (before midnight).
        exercise_review_next: One ExerciseReview row (after midnight).
        mock_session: One MockExamSession (before midnight).
        mock_session_next: One MockExamSession (after midnight).
    """

    user: User
    card_record: CardRecord
    card_record_stats: CardRecordStatistics
    vocab_reviews: list[CardRecordReview]
    culture_deck: CultureDeck
    culture_question: CultureQuestion
    culture_answers: list[CultureAnswerHistory]
    exercise_review: ExerciseReview
    exercise_review_next: ExerciseReview
    mock_session: MockExamSession
    mock_session_next: MockExamSession


# UTC timestamps that straddle a calendar-day boundary.
# "evening" = 2024-03-15 23:30 UTC (still March 15)
# "morning" = 2024-03-16 00:30 UTC (already March 16)
# Any query that buckets by date(AT TIME ZONE 'UTC') must produce two distinct
# day buckets for these two timestamps.
_DAY_BOUNDARY_EVENING = datetime(2024, 3, 15, 23, 30, 0, tzinfo=timezone.utc)
_DAY_BOUNDARY_MORNING = datetime(2024, 3, 16, 0, 30, 0, tzinfo=timezone.utc)


# =============================================================================
# Golden seed fixture
# =============================================================================


@pytest_asyncio.fixture
async def golden_seed_fixture(db_session: AsyncSession) -> GoldenSeed:
    """Seed one user with data from all four activity sources.

    Seeded data:
    - Vocab: 1 WordEntry → 1 CardRecord → 1 CardRecordStatistics → 2 CardRecordReview
      (one at 23:30 UTC, one at 00:30 UTC the next day)
    - Culture: 1 CultureDeck → 1 CultureQuestion → 2 CultureAnswerHistory
      (same UTC day-boundary timestamps)
    - Exercise: 2 ExerciseReview rows (same UTC day-boundary timestamps)
    - Mock exam: 2 MockExamSession rows (same UTC day-boundary timestamps)

    The UTC day-boundary pair in every source means that any query which
    incorrectly applies a non-UTC timezone will produce wrong bucketing and
    fail the downstream oracle assertion.

    Yields:
        GoldenSeed: All inserted rows, ready for assertions.
    """
    # ------------------------------------------------------------------
    # User
    # ------------------------------------------------------------------
    user: User = await UserFactory.create(session=db_session)

    # ------------------------------------------------------------------
    # Vocab source: WordEntry → CardRecord → CardRecordStatistics → reviews
    # ------------------------------------------------------------------
    word_entry = WordEntry(
        owner_id=None,
        lemma=f"λόγος_{uuid4().hex[:6]}",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="word, speech",
        is_active=True,
    )
    db_session.add(word_entry)
    await db_session.flush()
    await db_session.refresh(word_entry)

    # CardRecord requires a deck; use DeckFactory for correct multilingual fields.
    deck: Deck = await DeckFactory.create(session=db_session)

    card_record = CardRecord(
        word_entry_id=word_entry.id,
        deck_id=deck.id,
        card_type=CardType.MEANING_EL_TO_EN,
        variant_key="golden_default",
        is_active=True,
        front_content={"card_type": "meaning_el_to_en", "main": "λόγος"},
        back_content={"card_type": "meaning_el_to_en", "answer": "word"},
    )
    db_session.add(card_record)
    await db_session.flush()
    await db_session.refresh(card_record)

    card_record_stats = CardRecordStatistics(
        user_id=user.id,
        card_record_id=card_record.id,
        easiness_factor=2.5,
        interval=1,
        repetitions=1,
        status=CardStatus.LEARNING,
    )
    db_session.add(card_record_stats)
    await db_session.flush()
    await db_session.refresh(card_record_stats)

    # Two vocab reviews straddling UTC midnight
    vocab_review_evening = CardRecordReview(
        user_id=user.id,
        card_record_id=card_record.id,
        quality=ReviewRating.CORRECT_HESITANT,
        time_taken=5,
        reviewed_at=_DAY_BOUNDARY_EVENING,
    )
    vocab_review_morning = CardRecordReview(
        user_id=user.id,
        card_record_id=card_record.id,
        quality=ReviewRating.PERFECT,
        time_taken=3,
        reviewed_at=_DAY_BOUNDARY_MORNING,
    )
    db_session.add(vocab_review_evening)
    db_session.add(vocab_review_morning)
    await db_session.flush()
    await db_session.refresh(vocab_review_evening)
    await db_session.refresh(vocab_review_morning)

    # ------------------------------------------------------------------
    # Culture source: CultureDeck → CultureQuestion → 2 CultureAnswerHistory
    # ------------------------------------------------------------------
    culture_deck: CultureDeck = await CultureDeckFactory.create(session=db_session)
    culture_question: CultureQuestion = await CultureQuestionFactory.create(
        session=db_session, deck_id=culture_deck.id
    )

    culture_answer_evening: CultureAnswerHistory = await CultureAnswerHistoryFactory.create(
        session=db_session,
        user_id=user.id,
        question_id=culture_question.id,
        created_at=_DAY_BOUNDARY_EVENING,
    )
    culture_answer_morning: CultureAnswerHistory = await CultureAnswerHistoryFactory.create(
        session=db_session,
        user_id=user.id,
        question_id=culture_question.id,
        is_correct=False,
        selected_option=1,
        created_at=_DAY_BOUNDARY_MORNING,
    )

    # ------------------------------------------------------------------
    # Exercise source: 2 ExerciseReview rows (auto-creates ExerciseRecord)
    # ------------------------------------------------------------------
    exercise_review_evening: ExerciseReview = await ExerciseReviewFactory.create(
        session=db_session,
        user_id=user.id,
        reviewed_at=_DAY_BOUNDARY_EVENING,
    )
    exercise_review_morning: ExerciseReview = await ExerciseReviewFactory.create(
        session=db_session,
        user_id=user.id,
        reviewed_at=_DAY_BOUNDARY_MORNING,
    )

    # ------------------------------------------------------------------
    # Mock exam source: 2 MockExamSession rows
    # ------------------------------------------------------------------
    mock_session_evening: MockExamSession = await MockExamSessionFactory.create(
        session=db_session,
        user_id=user.id,
        status=MockExamStatus.COMPLETED,
        score=18,
        passed=False,
        time_taken_seconds=900,
        started_at=_DAY_BOUNDARY_EVENING,
        completed_at=_DAY_BOUNDARY_EVENING,
    )
    mock_session_morning: MockExamSession = await MockExamSessionFactory.create(
        session=db_session,
        user_id=user.id,
        status=MockExamStatus.COMPLETED,
        score=22,
        passed=True,
        time_taken_seconds=720,
        started_at=_DAY_BOUNDARY_MORNING,
        completed_at=_DAY_BOUNDARY_MORNING,
    )

    return GoldenSeed(
        user=user,
        card_record=card_record,
        card_record_stats=card_record_stats,
        vocab_reviews=[vocab_review_evening, vocab_review_morning],
        culture_deck=culture_deck,
        culture_question=culture_question,
        culture_answers=[culture_answer_evening, culture_answer_morning],
        exercise_review=exercise_review_evening,
        exercise_review_next=exercise_review_morning,
        mock_session=mock_session_evening,
        mock_session_next=mock_session_morning,
    )


# =============================================================================
# Equality oracle
# =============================================================================


def assert_rows_equal(
    expected: list[Any],
    actual: list[Any],
    *,
    msg: str = "",
) -> None:
    """Value-based equality oracle for SQL result comparison.

    Compares two sequences of result rows or dicts by VALUE, not by identity,
    repr, or string rendering.  Floats are wrapped in ``pytest.approx`` to
    handle floating-point precision differences (e.g., easiness_factor 2.5
    computed via two different code paths).

    Rules:
    - Order matters: index 0 vs index 0, etc.  Sort both sides before calling
      if order is undefined.
    - Each element may be a dict, a SQLAlchemy Row / RowMapping, or any object
      with a ``_asdict()`` / ``__dict__`` method.
    - Floats are compared with relative tolerance 1e-6 via ``pytest.approx``.
    - ``None`` == ``None`` (not NaN).

    Args:
        expected: The reference result (e.g., legacy query output).
        actual:   The new result (e.g., consolidated query output).
        msg:      Optional context prefix added to the assertion message.

    Raises:
        AssertionError: On length mismatch or any value difference.

    Example::

        assert_rows_equal(legacy_rows, new_rows, msg="get_dashboard_stats")
    """
    prefix = f"[{msg}] " if msg else ""

    assert len(expected) == len(
        actual
    ), f"{prefix}Row count mismatch: expected {len(expected)}, got {len(actual)}"

    for i, (exp_row, act_row) in enumerate(zip(expected, actual)):
        exp_dict = _row_to_dict(exp_row)
        act_dict = _row_to_dict(act_row)

        assert set(exp_dict.keys()) == set(act_dict.keys()), (
            f"{prefix}Row {i}: key mismatch.\n"
            f"  Expected keys: {sorted(exp_dict.keys())}\n"
            f"  Actual keys:   {sorted(act_dict.keys())}"
        )

        for key in exp_dict:
            exp_val = exp_dict[key]
            act_val = act_dict[key]

            if isinstance(exp_val, float) or isinstance(act_val, float):
                assert act_val == pytest.approx(exp_val, rel=1e-6), (
                    f"{prefix}Row {i}, key '{key}': "
                    f"float mismatch: expected {exp_val!r}, got {act_val!r}"
                )
            else:
                assert act_val == exp_val, (
                    f"{prefix}Row {i}, key '{key}': "
                    f"value mismatch: expected {exp_val!r}, got {act_val!r}"
                )


def _row_to_dict(row: Any) -> dict[str, Any]:
    """Coerce a result row to a plain dict for comparison.

    Handles: plain dict, SQLAlchemy Row / RowMapping (``_mapping`` /
    ``_asdict``), NamedTuple with ``_asdict``, and arbitrary objects with
    ``__dict__``.
    """
    if isinstance(row, dict):
        return row
    if hasattr(row, "_mapping"):
        # SQLAlchemy 2.x Row object
        return dict(row._mapping)
    if hasattr(row, "_asdict"):
        # NamedTuple or SQLAlchemy KeyedTuple
        return row._asdict()
    if hasattr(row, "__dict__"):
        # Dataclass / model instance — exclude private SQLAlchemy attrs
        return {k: v for k, v in row.__dict__.items() if not k.startswith("_")}
    raise TypeError(f"Cannot convert result row of type {type(row)!r} to dict")
