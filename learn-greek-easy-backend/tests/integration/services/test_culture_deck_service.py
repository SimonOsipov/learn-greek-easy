"""Integration tests for PERF-18-02: culture deck list — one progress batch.

RED status per test (pre-implementation, current code =
`culture_deck_service.py:87` `_get_deck_progress`, called per-deck from the
`list_decks` loop at `:307-313`):

  TRUE RED (mechanism does not exist today, fails on the target assertion):
    - test_culture_list_single_progress_query (AC4)
        `get_batch_deck_progress` does not exist yet on
        `CultureQuestionStatsRepository` (grep-confirmed against
        `src/repositories/culture_question_stats.py`). Today `list_decks`
        loops over every deck and calls `_get_deck_progress` per deck, which
        itself fires 4 SELECTs (`has_user_started_deck`,
        `count_by_status_for_deck`'s two internal queries folded via
        `get_deck_progress`, `get_last_practiced_at`) — every one of them
        shaped as a bare `culture_questions.deck_id = :N` equality. So today:
        zero statements match the new batched (`deck_id IN (...) GROUP BY
        deck_id, status`) shape, and >=1 statement matches the per-deck shape
        — both assertions fail for the right reason.

  PARITY / GOLDEN-SNAPSHOT LOCK (byte-identical to today, expected to pass
  under BOTH the current per-deck implementation and the post-batch
  implementation per story AC4 / D3 — mirrors the pattern established in
  `test_progress_deck_list_batching.py`'s `test_deck_list_parity_ordering_and_
  contents`):
    - test_culture_list_progress_parity
        Compares `list_decks(...)`'s `progress` field per deck against an
        independent oracle: `CultureDeckService._get_deck_progress` called
        directly (that helper is NOT deleted by this subtask — it stays in
        place for the single-deck `get_deck` path, culture_deck_service.py:374
        — so it remains a valid, code-path-independent source of truth after
        the batch rewrite).
    - test_culture_list_locale_parity_en_ru
        Same oracle, exercised across `locale="en"` and `locale="ru"` to prove
        the progress-batching change is orthogonal to locale selection.

All tests call `CultureDeckService.list_decks` directly (never through any
cache wrapper), matching the story's cold-path/Redis-masking convention
established in `test_progress_deck_list_batching.py`'s module docstring.
"""

from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime, timezone
from typing import Any, Generator, Optional
from uuid import UUID, uuid4

import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from src.db.models import (
    CardStatus,
    CultureDeck,
    CultureQuestion,
    CultureQuestionStats,
    User,
)
from src.schemas.culture import CultureDeckProgress
from src.services.culture_deck_service import CultureDeckService

# ---------------------------------------------------------------------------
# SQL statement counter (verbatim copy of the helper in
# tests/integration/services/test_progress_dashboard_batching.py:147-178 and
# tests/integration/services/test_progress_deck_list_batching.py:92-124 — not
# importable, duplicated across the suite by convention).
# ---------------------------------------------------------------------------


@contextmanager
def capture_sql(engine: AsyncEngine) -> Generator[list[str], None, None]:
    """Capture real SQL statements emitted on *engine* during the block.

    Attaches a ``before_cursor_execute`` listener to the underlying
    synchronous engine.  Only real cursor executions (not transaction
    control bookkeeping) are counted.  Fixture-setup SQL that runs
    outside the ``with`` body is excluded.
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


def _is_per_deck_culture_progress_query(stmt: str) -> bool:
    """True if *stmt* filters on a single culture deck id via bare ``=``.

    Matches the shape of all 4 statements fired per-deck by
    `_get_deck_progress` (culture_deck_service.py:87) today:
    `has_user_started_deck`, the `total_questions_query` + `status_query`
    inside `count_by_status_for_deck` / `get_deck_progress`, and
    `get_last_practiced_at` (culture_question_stats.py:124-178, 180-211,
    213-242, 244-271) — every one of them filters
    `culture_questions.deck_id = :deck_id_N` (bare equality). The new batched
    `get_batch_deck_progress` filters `culture_questions.deck_id IN (...)`,
    which never contains a bare ``=`` immediately after `deck_id`, so this
    substring is disjoint from the batch query's shape (mirrors the
    `_is_single_deck_count_query` convention in
    test_progress_deck_list_batching.py:126-139).
    """
    return "culture_questions.deck_id =" in stmt.lower()


def _is_batch_culture_progress_query(stmt: str) -> bool:
    """True if *stmt* matches the shape of the new `get_batch_deck_progress` query.

    Per the plan (task-1253): one `GROUP BY (deck_id, status)` over
    `culture_question_stats` JOIN `culture_questions`, scoped to an
    `IN (...)` deck_id list.
    """
    s = stmt.lower()
    return (
        "from culture_question_stats" in s
        and "culture_questions.deck_id in" in s
        and "group by" in s
    )


# ---------------------------------------------------------------------------
# Shared seeding helpers
# ---------------------------------------------------------------------------


async def _seed_user(db_session: AsyncSession) -> User:
    user = User(email=f"perf1802_{uuid4().hex[:8]}@example.com", is_active=True)
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


async def _seed_culture_deck(
    db_session: AsyncSession,
    *,
    suffix: str,
    category: str = "history",
    is_active: bool = True,
) -> CultureDeck:
    """Seed one active CultureDeck (no questions yet — add via `_seed_culture_question`)."""
    deck = CultureDeck(
        name_en=f"PERF-18-02 {suffix} EN",
        name_el=f"PERF-18-02 {suffix} EL",
        name_ru=f"PERF-18-02 {suffix} RU",
        description_en=f"desc-{suffix}-en",
        description_el=f"desc-{suffix}-el",
        description_ru=f"desc-{suffix}-ru",
        category=category,
        is_active=is_active,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


async def _seed_culture_question(db_session: AsyncSession, deck: CultureDeck) -> CultureQuestion:
    question = CultureQuestion(
        deck_id=deck.id,
        question_text={"en": "Q?", "el": "Ε;", "ru": "В?"},
        option_a={"en": "A", "el": "Α", "ru": "А"},
        option_b={"en": "B", "el": "Β", "ru": "Б"},
        option_c={"en": "C", "el": "Γ", "ru": "В"},
        option_d={"en": "D", "el": "Δ", "ru": "Г"},
        correct_option=1,
    )
    db_session.add(question)
    await db_session.flush()
    await db_session.refresh(question)
    return question


async def _seed_stat(
    db_session: AsyncSession,
    user: User,
    question: CultureQuestion,
    *,
    status: CardStatus,
    updated_at: datetime,
    next_review_date: Optional[date] = None,
) -> CultureQuestionStats:
    """Seed one CultureQuestionStats row for `user` x `question`."""
    stat = CultureQuestionStats(
        user_id=user.id,
        question_id=question.id,
        status=status,
        next_review_date=next_review_date or date.today(),
        updated_at=updated_at,
    )
    db_session.add(stat)
    await db_session.flush()
    return stat


def _assert_progress_matches(
    actual: Optional[CultureDeckProgress],
    expected: Optional[CultureDeckProgress],
    *,
    label: str,
) -> None:
    if expected is None:
        assert actual is None, f"{label}: expected progress=None, got {actual!r}"
        return
    assert actual is not None, f"{label}: expected progress={expected!r}, got None"
    assert (
        actual.questions_total == expected.questions_total
    ), f"{label}.questions_total: got {actual.questions_total}, expected {expected.questions_total}"
    assert actual.questions_mastered == expected.questions_mastered, (
        f"{label}.questions_mastered: got {actual.questions_mastered}, "
        f"expected {expected.questions_mastered}"
    )
    assert actual.questions_learning == expected.questions_learning, (
        f"{label}.questions_learning: got {actual.questions_learning}, "
        f"expected {expected.questions_learning}"
    )
    assert (
        actual.questions_new == expected.questions_new
    ), f"{label}.questions_new: got {actual.questions_new}, expected {expected.questions_new}"
    assert actual.last_practiced_at == expected.last_practiced_at, (
        f"{label}.last_practiced_at: got {actual.last_practiced_at}, "
        f"expected {expected.last_practiced_at}"
    )


# ---------------------------------------------------------------------------
# AC4 — test_culture_list_single_progress_query (TRUE RED)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_culture_list_single_progress_query(
    db_session: AsyncSession,
    db_engine: AsyncEngine,
) -> None:
    """AC4 — TRUE RED: one batched progress SELECT for the whole page, invariant to deck count.

    RED reason: `get_batch_deck_progress` does not exist yet (grep-confirmed).
    Today `list_decks` (culture_deck_service.py:252-327) loops over every deck
    and calls `_build_localized_deck_response` (:307-313), which calls
    `_get_deck_progress` (:87) per deck — every resulting SELECT is shaped as
    a bare `culture_questions.deck_id = :N` equality. So today:
      - `_is_per_deck_culture_progress_query` matches >=1 statement (fails the
        "zero per-deck" assertion below)
      - `_is_batch_culture_progress_query` matches 0 statements (fails the
        "exactly one" assertion below — the IN/GROUP BY shape doesn't exist)

    GREEN after: `list_decks` calls `get_batch_deck_progress(user_id,
    page_deck_ids)` once before the loop; the per-deck calls are removed.

    Two independent seedings (3 decks vs a full 20-deck page) prove the
    assertion holds regardless of page deck count, not just for one
    arbitrary N.
    """
    page_size = 20
    for deck_count in (3, 20):
        user = await _seed_user(db_session)
        for i in range(deck_count):
            deck = await _seed_culture_deck(db_session, suffix=f"n{deck_count}-{i}")
            question = await _seed_culture_question(db_session, deck)
            await _seed_stat(
                db_session,
                user,
                question,
                status=CardStatus.LEARNING,
                updated_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
            )

        service = CultureDeckService(db_session)

        with capture_sql(db_engine) as stmts:
            await service.list_decks(user_id=user.id, page=1, page_size=page_size)

        per_deck = [s for s in stmts if _is_per_deck_culture_progress_query(s)]
        batch = [s for s in stmts if _is_batch_culture_progress_query(s)]

        assert per_deck == [], (
            f"[{deck_count} decks] Found {len(per_deck)} per-deck culture-progress "
            f"SELECT(s) — the N+1 loop is still present:\n" + "\n---\n".join(per_deck)
        )
        assert len(batch) == 1, (
            f"[{deck_count} decks] Expected exactly 1 batched culture-progress SELECT, "
            f"got {len(batch)}. Captured statements ({len(stmts)}):\n" + "\n---\n".join(stmts)
        )


# ---------------------------------------------------------------------------
# AC4 — test_culture_list_progress_parity (parity / golden-snapshot lock)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_culture_list_progress_parity(
    db_session: AsyncSession,
) -> None:
    """AC4 — PARITY LOCK: batched `progress` field byte-identical to `_get_deck_progress`.

    NOT a test-first RED (see module docstring) — passes under BOTH today's
    per-deck implementation (list_decks still calls `_get_deck_progress` per
    deck, so this is a trivial self-comparison today) AND the post-batch
    implementation (list_decks will compute `progress` from
    `get_batch_deck_progress` + the already-batched question count;
    `_get_deck_progress` stays in place — untouched — as the `get_deck`
    single-deck path, so calling it directly here remains a valid,
    code-path-independent oracle after the rewrite). Locks in the exact
    arithmetic the plan specifies: questions_mastered=mastered,
    questions_learning=learning+review,
    questions_new=total-(mastered+learning+review),
    last_practiced_at=max(updated_at) across all the user's stats for the deck.
    """
    user = await _seed_user(db_session)

    # Deck with a mixed status distribution: 1 mastered, 1 learning, 1 review, 1 new (no stats).
    deck_mixed = await _seed_culture_deck(db_session, suffix="mixed")
    q_mastered = await _seed_culture_question(db_session, deck_mixed)
    q_learning = await _seed_culture_question(db_session, deck_mixed)
    q_review = await _seed_culture_question(db_session, deck_mixed)
    await _seed_culture_question(db_session, deck_mixed)  # q_new: no stats row
    await _seed_stat(
        db_session,
        user,
        q_mastered,
        status=CardStatus.MASTERED,
        updated_at=datetime(2026, 6, 1, 9, tzinfo=timezone.utc),
    )
    await _seed_stat(
        db_session,
        user,
        q_learning,
        status=CardStatus.LEARNING,
        updated_at=datetime(2026, 6, 1, 11, tzinfo=timezone.utc),  # latest -> last_practiced_at
    )
    await _seed_stat(
        db_session,
        user,
        q_review,
        status=CardStatus.REVIEW,
        updated_at=datetime(2026, 6, 1, 10, tzinfo=timezone.utc),
    )

    # Fully mastered deck: 2/2 mastered, no learning/review/new.
    deck_mastered = await _seed_culture_deck(db_session, suffix="all-mastered")
    q_m1 = await _seed_culture_question(db_session, deck_mastered)
    q_m2 = await _seed_culture_question(db_session, deck_mastered)
    await _seed_stat(
        db_session,
        user,
        q_m1,
        status=CardStatus.MASTERED,
        updated_at=datetime(2026, 6, 2, tzinfo=timezone.utc),
    )
    await _seed_stat(
        db_session,
        user,
        q_m2,
        status=CardStatus.MASTERED,
        updated_at=datetime(2026, 6, 2, 1, tzinfo=timezone.utc),
    )

    # Unstarted deck: has questions, but zero stats rows for this user -> progress=None.
    deck_unstarted = await _seed_culture_deck(db_session, suffix="unstarted")
    await _seed_culture_question(db_session, deck_unstarted)
    await _seed_culture_question(db_session, deck_unstarted)

    decks = (deck_mixed, deck_mastered, deck_unstarted)

    service = CultureDeckService(db_session)

    # Independent oracle: the untouched per-deck helper (still used by get_deck).
    expected: dict[UUID, Optional[CultureDeckProgress]] = {
        deck.id: await service._get_deck_progress(user.id, deck.id) for deck in decks
    }

    # Sanity-check the oracle itself is non-degenerate (guards a vacuous pass).
    exp_mixed = expected[deck_mixed.id]
    assert exp_mixed is not None
    assert exp_mixed.questions_total == 4
    assert exp_mixed.questions_mastered == 1
    assert exp_mixed.questions_learning == 2  # learning + review
    assert exp_mixed.questions_new == 1
    assert exp_mixed.last_practiced_at == datetime(2026, 6, 1, 11, tzinfo=timezone.utc)

    exp_mastered = expected[deck_mastered.id]
    assert exp_mastered is not None
    assert exp_mastered.questions_total == 2
    assert exp_mastered.questions_mastered == 2
    assert exp_mastered.questions_learning == 0
    assert exp_mastered.questions_new == 0

    assert expected[deck_unstarted.id] is None

    result = await service.list_decks(user_id=user.id, page=1, page_size=20)
    by_id = {d.id: d for d in result.decks}
    assert set(by_id) == {deck.id for deck in decks}

    for deck in decks:
        _assert_progress_matches(by_id[deck.id].progress, expected[deck.id], label=deck.id.hex)


# ---------------------------------------------------------------------------
# AC4 — test_culture_list_locale_parity_en_ru (parity / golden-snapshot lock)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_culture_list_locale_parity_en_ru(
    db_session: AsyncSession,
) -> None:
    """AC4 — PARITY LOCK: localized fields + progress identical to today for EN and RU.

    NOT a test-first RED (see module docstring) — a golden-snapshot lock (same
    rationale as `test_culture_list_progress_parity` above). Guards that the
    progress-batching change is orthogonal to locale selection:
    `_get_localized_text` (untouched by this subtask) and the assembled
    `progress` must produce byte-identical output whether `list_decks` is
    called with locale="en" or locale="ru", both today (trivial
    self-comparison, since both locale calls exercise the same per-deck
    `_get_deck_progress` path today) and after the batch rewrite (where both
    locale calls must read from the same batched `progress` dict).
    """
    user = await _seed_user(db_session)

    deck = await _seed_culture_deck(db_session, suffix="locale", category="geography")
    # Force distinct EN vs RU text so a locale mixup is observable.
    deck.name_en = "Greek Geography"
    deck.name_el = "Ελληνική Γεωγραφία"
    deck.name_ru = "Греческая география"
    deck.description_en = "English description"
    deck.description_el = "Ελληνική περιγραφή"
    deck.description_ru = "Русское описание"
    await db_session.flush()

    q1 = await _seed_culture_question(db_session, deck)
    q2 = await _seed_culture_question(db_session, deck)
    await _seed_stat(
        db_session,
        user,
        q1,
        status=CardStatus.MASTERED,
        updated_at=datetime(2026, 6, 3, tzinfo=timezone.utc),
    )
    await _seed_stat(
        db_session,
        user,
        q2,
        status=CardStatus.LEARNING,
        updated_at=datetime(2026, 6, 3, 1, tzinfo=timezone.utc),
    )

    service = CultureDeckService(db_session)
    expected_progress = await service._get_deck_progress(user.id, deck.id)
    assert expected_progress is not None
    assert expected_progress.questions_total == 2
    assert expected_progress.questions_mastered == 1
    assert expected_progress.questions_learning == 1
    assert expected_progress.questions_new == 0

    result_en = await service.list_decks(user_id=user.id, page=1, page_size=20, locale="en")
    result_ru = await service.list_decks(user_id=user.id, page=1, page_size=20, locale="ru")

    assert len(result_en.decks) == 1
    assert len(result_ru.decks) == 1
    resp_en = result_en.decks[0]
    resp_ru = result_ru.decks[0]

    assert resp_en.name == "Greek Geography"
    assert resp_en.description == "English description"
    assert resp_ru.name == "Греческая география"
    assert resp_ru.description == "Русское описание"

    # All-language fields present regardless of locale (client-side resolution).
    for label, resp in (("en", resp_en), ("ru", resp_ru)):
        assert resp.name_en == "Greek Geography", f"{label}.name_en"
        assert resp.name_ru == "Греческая география", f"{label}.name_ru"
        assert resp.description_en == "English description", f"{label}.description_en"
        assert resp.description_ru == "Русское описание", f"{label}.description_ru"
        assert resp.category == "geography", f"{label}.category"
        assert resp.question_count == 2, f"{label}.question_count"

    # Progress is locale-independent and byte-identical to the oracle.
    _assert_progress_matches(resp_en.progress, expected_progress, label="en")
    _assert_progress_matches(resp_ru.progress, expected_progress, label="ru")
