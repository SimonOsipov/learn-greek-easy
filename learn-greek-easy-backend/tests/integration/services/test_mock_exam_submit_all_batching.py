"""Integration tests for PERF-18-04: mock-exam submit-all one-IN-query batching.

RED status per test (pre-implementation, current code =
`mock_exam_service.py:178-387`):

  TRUE RED (mechanism does not exist today, fails on the target assertion):
    - test_submit_all_fetches_questions_in_one_in_query (AC1)
        Today's per-answer loop (mock_exam_service.py:247) calls
        `_get_question(question_id)` (mock_exam_service.py:535-546) once per
        NEW answer via the main-branch call site (mock_exam_service.py:279).
        For a 25-new-answer submission (no duplicates in this fixture) that's
        25 single-row `culture_questions.id = <param>` SELECTs and 0
        `IN (...)` SELECTs — so both "exactly 1 IN query" and "0 single-id
        SELECTs" fail today. GREEN after: executor replaces both
        `_get_question` call sites (mock_exam_service.py:262, :279) with a
        `questions_by_id.get(question_id)` dict lookup fed by one
        `_get_questions_by_ids` (mock_exam_service.py:587-604) IN-query
        issued before the loop.

  GOLDEN-SNAPSHOT / REGRESSION LOCK (byte-identical to today per story D9 —
  expected to pass under BOTH the current per-answer implementation and the
  post-batching `_get_questions_by_ids` implementation; guards against the
  read-batching rewrite silently changing scoring, XP, or None-handling
  semantics):
    - test_submit_all_scoring_identical_fixture (AC2)
        A fixed 25-answer payload (22 unique new answers with a known
        16-correct/6-wrong split, 2 intra-payload duplicates of
        already-answered questions, 1 unknown question_id absent from the
        DB). Expected score/percentage/passed/answer_results/counts are
        derived deterministically from the fixture composition below — not
        captured from `submit_all_answers`' own output.

Both tests call `MockExamService.submit_all_answers` directly against a real
seeded session (no cache wrapper sits in front of this write path).

Test 3 of the PERF-18-04 Test Specs (`test_submit_all_handles_missing_question`,
AC2, "unit" level) lives in `tests/unit/services/test_mock_exam_service.py`
(`TestSubmitAllAnswers`) instead — it needs no `capture_sql`/query-count
infra, and that file already has the exact fixtures (`culture_questions`,
`active_mock_exam`, `mock_s3_service`, `test_user`) it needs, so appending
there avoids duplicating them a third time.
"""

from __future__ import annotations

import sys
from contextlib import contextmanager
from typing import Any, Generator
from uuid import uuid4

# Pre-mock spaCy before importing any service that pulls MorphologyService.
if "spacy" not in sys.modules:
    from unittest.mock import MagicMock

    sys.modules["spacy"] = MagicMock()
    sys.modules["spacy.pipeline"] = MagicMock()
    sys.modules["spacy.tokens"] = MagicMock()
    sys.modules["spacy.language"] = MagicMock()
    sys.modules["spacy.vocab"] = MagicMock()

import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from src.db.models import CultureDeck, CultureQuestion, MockExamSession, MockExamStatus, User
from src.services.mock_exam_service import MockExamService

# ---------------------------------------------------------------------------
# SQL statement counter (verbatim copy of the helper in
# tests/integration/services/test_progress_dashboard_batching.py:147-178 —
# not importable, duplicated across the suite by convention).
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
            await service.submit_all_answers(...)
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


def _is_single_id_question_select(stmt: str) -> bool:
    """True if *stmt* is a single-row SELECT on `culture_questions.id = <param>`.

    This is the compiled shape of `MockExamService._get_question`
    (mock_exam_service.py:535-546) — the per-answer read this subtask
    batches away. Scoped to the literal `culture_questions.id =` substring
    (bare equality, not `IN (`) so a batched IN-query never matches here.
    """
    s = stmt.lower()
    return "from culture_questions" in s and "culture_questions.id =" in s


def _is_in_query_question_select(stmt: str) -> bool:
    """True if *stmt* is a batched `IN (...)` SELECT on `culture_questions.id`.

    This is the compiled shape of `MockExamService._get_questions_by_ids`
    (mock_exam_service.py:587-604) — the target replacement mechanism.

    Both predicates are scoped to the literal `culture_questions` table name,
    which is NOT a substring of `culture_question_stats` (the table
    `_update_sm2_stats`, mock_exam_service.py:606-656, reads/writes) —
    "culture_questions" ends in a plural "s" directly after "question",
    whereas "culture_question_stats" has an underscore there instead. So
    `_update_sm2_stats` traffic can never false-trip either predicate.
    """
    s = stmt.lower()
    return "from culture_questions" in s and "culture_questions.id in" in s


# ---------------------------------------------------------------------------
# Shared seeding fixtures (local to this file — mirrors the `mock_s3_service`
# / `culture_deck` / `culture_questions` fixtures already duplicated per-file
# across tests/unit/services/test_mock_exam_service.py and friends, by
# established convention: see also test_progress_deck_list_batching.py and
# test_progress_dashboard_batching.py for the same `capture_sql`-file shape).
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_s3_service():
    """Create a mock S3 service (submit_all_answers never calls it, but
    `MockExamService.__init__` requires one)."""
    from unittest.mock import MagicMock

    mock = MagicMock()
    mock.generate_presigned_url.return_value = "https://s3.example.com/presigned-url"
    return mock


@pytest.fixture
async def culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active culture deck for testing."""
    deck = CultureDeck(
        name_en="PERF-18-04 Culture Deck",
        name_el="Τεστ Κουλτούρα",
        name_ru="Тест Культура",
        description_en="test",
        description_el="test",
        description_ru="test",
        category="history",
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def culture_questions(
    db_session: AsyncSession, culture_deck: CultureDeck
) -> list[CultureQuestion]:
    """Create 30 culture questions (more than needed for a 25-answer payload)."""
    questions = []
    for i in range(30):
        question = CultureQuestion(
            deck_id=culture_deck.id,
            question_text={"en": f"Question {i + 1}?", "el": f"Ερώτηση {i + 1};"},
            option_a={"en": "Option A", "el": "Επιλογή Α"},
            option_b={"en": "Option B", "el": "Επιλογή Β"},
            option_c={"en": "Option C", "el": "Επιλογή Γ"},
            option_d={"en": "Option D", "el": "Επιλογή Δ"},
            correct_option=(i % 4) + 1,
            order_index=i,
        )
        db_session.add(question)
        questions.append(question)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)
    return questions


@pytest.fixture
async def active_mock_exam(db_session: AsyncSession, test_user: User) -> MockExamSession:
    """Create an active mock exam session (25 questions, no answers yet)."""
    session = MockExamSession(
        user_id=test_user.id,
        total_questions=25,
        status=MockExamStatus.ACTIVE,
        score=0,
        passed=False,
        time_taken_seconds=0,
    )
    db_session.add(session)
    await db_session.flush()
    await db_session.refresh(session)
    return session


# ---------------------------------------------------------------------------
# AC1 — test_submit_all_fetches_questions_in_one_in_query (TRUE RED)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_submit_all_fetches_questions_in_one_in_query(
    db_session: AsyncSession,
    db_engine: AsyncEngine,
    test_user: User,
    active_mock_exam: MockExamSession,
    culture_questions: list[CultureQuestion],
    mock_s3_service,
) -> None:
    """AC1 — questions fetched via one IN query; zero single-id question SELECTs.

    RED reason: today's per-answer loop (mock_exam_service.py:247) calls
    `_get_question(question_id)` once per NEW answer at the main-branch call
    site (mock_exam_service.py:279). For 25 NEW answers (no duplicates in
    this payload) that's 25 single-id `culture_questions.id = <param>`
    SELECTs and 0 `IN (...)` SELECTs — so both `len(in_selects) == 1` and
    `single_id_selects == []` fail today. GREEN after: the executor's
    `_get_questions_by_ids` prefetch lands.
    """
    service = MockExamService(db_session, s3_service=mock_s3_service)

    answers = [
        {
            "question_id": q.id,
            "selected_option": q.correct_option,
            "time_taken_seconds": 10,
        }
        for q in culture_questions[:25]
    ]

    with capture_sql(db_engine) as stmts:
        result = await service.submit_all_answers(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
            answers=answers,
            total_time_seconds=250,
        )

    # Sanity: the fixture actually exercised the per-answer loop (all 25 new,
    # no duplicates, no unknowns) before trusting the SQL-shape assertions.
    assert result["new_answers_count"] == 25
    assert result["duplicate_answers_count"] == 0

    single_id_selects = [s for s in stmts if _is_single_id_question_select(s)]
    in_selects = [s for s in stmts if _is_in_query_question_select(s)]

    assert single_id_selects == [], (
        f"Found {len(single_id_selects)} single-id `culture_questions.id =` SELECT(s) — "
        f"the per-answer N+1 `_get_question` loop is still present:\n"
        + "\n---\n".join(single_id_selects)
    )
    assert len(in_selects) == 1, (
        f"Expected exactly 1 batched `IN (...)` question SELECT, found {len(in_selects)}. "
        f"Captured statements ({len(stmts)}):\n" + "\n---\n".join(stmts)
    )


# ---------------------------------------------------------------------------
# AC2 — test_submit_all_scoring_identical_fixture (golden-snapshot lock)
# ---------------------------------------------------------------------------

# XP amounts, mirrored from src/services/xp_constants.py (not imported
# directly — this test locks the *behavioural* contract of submit_all_answers,
# so a constants-file edit should surface here as a mismatch rather than
# silently pass via a shared import).
_XP_CORRECT = 10  # XP_CORRECT_ANSWER (not "perfect": time_taken > 2s)
_XP_WRONG = 2  # XP_CULTURE_WRONG (mandatory encouragement XP)

_NEW_ANSWER_COUNT = 22
_CORRECT_COUNT = 16
_WRONG_COUNT = _NEW_ANSWER_COUNT - _CORRECT_COUNT  # 6
_DUPLICATE_INDICES = (0, 5)  # indices into the 22 new questions, re-answered as duplicates


def _wrong_option(correct_option: int) -> int:
    """Any option != correct_option (matches test_mock_exam_service.py:395's
    existing convention for constructing a deliberately-wrong answer)."""
    return (correct_option % 4) + 1


@pytest.mark.asyncio
@pytest.mark.integration
async def test_submit_all_scoring_identical_fixture(
    db_session: AsyncSession,
    test_user: User,
    active_mock_exam: MockExamSession,
    culture_questions: list[CultureQuestion],
    mock_s3_service,
) -> None:
    """AC2 — scoring/results byte-identical on a fixed 25-answer fixture.

    NOT a test-first RED (see module docstring) — a golden-snapshot lock that
    must pass on both today's per-answer `_get_question` implementation and
    the post-batching `_get_questions_by_ids` implementation, per story D9
    ("scoring/write semantics untouched"). Expected values are derived from
    the fixture composition below, not captured from `submit_all_answers`'
    own output.

    Fixture (25 answers total):
      - answers[0:16]  -> culture_questions[0:16],  selected_option = correct_option (CORRECT)
      - answers[16:22] -> culture_questions[16:22], selected_option = wrong option   (INCORRECT)
      - answers[22]    -> culture_questions[0].id again  (DUPLICATE, was_duplicate=True)
      - answers[23]    -> culture_questions[5].id again  (DUPLICATE, was_duplicate=True)
      - answers[24]    -> a fresh uuid4() absent from `culture_questions`    (UNKNOWN, silently
                           skipped per mock_exam_service.py:280-289 — produces NO answer_results
                           entry and is not counted as new or duplicate)
    """
    service = MockExamService(db_session, s3_service=mock_s3_service)

    new_questions = culture_questions[:_NEW_ANSWER_COUNT]
    answers: list[dict] = []
    for i, q in enumerate(new_questions):
        is_correct = i < _CORRECT_COUNT
        selected = q.correct_option if is_correct else _wrong_option(q.correct_option)
        answers.append(
            {
                "question_id": q.id,
                "selected_option": selected,
                # > PERFECT_RECALL_THRESHOLD_SECONDS (2s) so no answer is "perfect" XP.
                "time_taken_seconds": 10,
            }
        )

    duplicate_questions = [new_questions[i] for i in _DUPLICATE_INDICES]
    for q in duplicate_questions:
        answers.append(
            {
                "question_id": q.id,
                "selected_option": q.correct_option,
                "time_taken_seconds": 5,
            }
        )

    unknown_question_id = uuid4()
    answers.append(
        {
            "question_id": unknown_question_id,
            "selected_option": 1,
            "time_taken_seconds": 5,
        }
    )

    assert len(answers) == 25  # sanity: fixture composition matches the AC2 spec (22 + 2 + 1)

    result = await service.submit_all_answers(
        user_id=test_user.id,
        session_id=active_mock_exam.id,
        answers=answers,
        total_time_seconds=300,
    )

    # --- Top-level scoring fields ---
    assert result["new_answers_count"] == _NEW_ANSWER_COUNT
    assert result["duplicate_answers_count"] == len(_DUPLICATE_INDICES)
    assert result["score"] == _CORRECT_COUNT
    assert result["total_questions"] == 25

    expected_percentage = round(_CORRECT_COUNT / 25 * 100, 1)  # 64.0
    assert result["percentage"] == expected_percentage

    expected_passed = expected_percentage >= 60  # True (pass threshold)
    assert result["passed"] is expected_passed

    expected_xp = _CORRECT_COUNT * _XP_CORRECT + _WRONG_COUNT * _XP_WRONG  # 160 + 12 = 172
    assert result["total_xp_earned"] == expected_xp

    assert result["session"].status == MockExamStatus.COMPLETED

    # --- Per-answer results (order + content) ---
    answer_results = result["answer_results"]
    # 22 new + 2 duplicates; the unknown question_id produces NO entry.
    assert len(answer_results) == _NEW_ANSWER_COUNT + len(_DUPLICATE_INDICES)

    for i, q in enumerate(new_questions):
        is_correct = i < _CORRECT_COUNT
        entry = answer_results[i]
        assert entry["question_id"] == q.id, f"answer_results[{i}].question_id mismatch"
        assert entry["is_correct"] is is_correct, f"answer_results[{i}].is_correct mismatch"
        assert (
            entry["correct_option"] == q.correct_option
        ), f"answer_results[{i}].correct_option mismatch"
        expected_selected = q.correct_option if is_correct else _wrong_option(q.correct_option)
        assert (
            entry["selected_option"] == expected_selected
        ), f"answer_results[{i}].selected_option mismatch"
        assert entry["xp_earned"] == (
            _XP_CORRECT if is_correct else _XP_WRONG
        ), f"answer_results[{i}].xp_earned mismatch"
        assert entry["was_duplicate"] is False, f"answer_results[{i}].was_duplicate mismatch"

    for offset, q in enumerate(duplicate_questions):
        idx = _NEW_ANSWER_COUNT + offset
        entry = answer_results[idx]
        assert entry["question_id"] == q.id, f"answer_results[{idx}].question_id mismatch"
        # Duplicates are never re-scored — is_correct is hardcoded False regardless
        # of the actual selected_option (mock_exam_service.py:268).
        assert entry["is_correct"] is False, f"answer_results[{idx}].is_correct mismatch"
        assert (
            entry["correct_option"] == q.correct_option
        ), f"answer_results[{idx}].correct_option mismatch"
        assert (
            entry["selected_option"] == q.correct_option
        ), f"answer_results[{idx}].selected_option mismatch"
        assert entry["xp_earned"] == 0, f"answer_results[{idx}].xp_earned mismatch"
        assert entry["was_duplicate"] is True, f"answer_results[{idx}].was_duplicate mismatch"

    # No result entry references the unknown question_id — it was silently skipped.
    assert all(
        entry["question_id"] != unknown_question_id for entry in answer_results
    ), "Unknown question_id leaked into answer_results (should have been skipped)"
