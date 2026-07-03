"""Integration tests for PERF-18-01: /progress/decks batch total_cards + SQL pagination.

RED status per test (pre-implementation, current code = `progress_service.py:532-636`):

  TRUE RED (mechanism does not exist today, fails on the target assertion):
    - test_deck_list_query_count_is_constant_in_deck_count (AC1)
        Today's `count_by_deck` N+1 loop (progress_service.py:551-556) makes the
        statement count scale with the *vocab* deck count, so 1-vocab-deck and
        3-vocab-deck seedings issue a *different* number of statements.
    - test_deck_list_paginates_in_sql (AC1)
        Today's code never emits a `UNION ALL` anywhere — pagination happens in
        Python via list slicing (progress_service.py:628-629), not SQL.
    - test_deck_list_tiebreaker_is_deterministic (AC2 / D1)
        Today's Python `sorted(..., key=lambda x: x.last_studied_at or
        _DATETIME_MIN_UTC)` has no `deck_id` tiebreaker; ties are ordered by
        the *stable input order* of `vocab_deck_summaries + culture_deck_summaries`
        (vocab items always precede culture items within a tie, regardless of
        UUID value). The fixture uses explicit `id=uuid.UUID(int=N)` values
        chosen so the expected `deck_id ASC` order is *structurally*
        impossible to satisfy under today's vocab-first tie order (not a
        probabilistic UUID-luck argument).

  GOLDEN-SNAPSHOT / REGRESSION LOCK (byte-identical to today per story D13 /
  AC3 — expected to pass under BOTH the current implementation and the
  post-rewrite Phase A/B implementation; guards against the SQL rewrite
  silently changing output, e.g. an accidental INNER JOIN dropping
  0-progress culture decks, or the culture cap moving off `created_at DESC`):
    - test_deck_list_parity_ordering_and_contents (AC2/AC3)
    - test_deck_list_excludes_inactive_and_unstudied_vocab (AC2)
    - test_deck_list_reproduces_culture_100_cap (AC2, D13)
        `culture_deck_repo.list_active()` is already called with its default
        `limit=100` (culture_deck.py:36) ordered by `created_at.desc()`, so
        the 100-cap already holds under current code. D13 requires the new
        Phase A SQL to *reproduce* this — not change it — so this test is a
        parity lock, mirroring the AC2 golden-snapshot pattern established in
        `test_progress_dashboard_batching.py` (TestDashboardOutputUnchangedAfterBatching).

All tests call `ProgressService._compute_deck_progress_list` directly (the
loader), never the cached `get_deck_progress_list` wrapper — the 60s Redis
cache (`progress:user:{id}:decks:{page}:{size}`) would otherwise mask both
the query-count and parity assertions on a cache hit.
"""

from __future__ import annotations

import sys
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable, Generator
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
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from src.db.models import (
    CardRecord,
    CardRecordReview,
    CardRecordStatistics,
    CardStatus,
    CardType,
    CultureDeck,
    CultureQuestion,
    CultureQuestionStats,
    Deck,
    DeckLevel,
    DeckWordEntry,
    PartOfSpeech,
    User,
    WordEntry,
)
from src.schemas.progress import DeckProgressSummary
from src.services.progress_service import ProgressService

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


def _is_single_deck_count_query(stmt: str) -> bool:
    """True if *stmt* matches the shape of `CardRecordRepository.count_by_deck`.

    That method (card_record.py:118-143) compiles to roughly::

        SELECT count(*) AS count_1 FROM card_records
        WHERE card_records.deck_id = $1 AND card_records.is_active IS true

    i.e. a single-equality filter on `card_records.deck_id`.  The new batched
    `count_active_by_decks` uses an `IN (...)` filter instead, which never
    matches `"card_records.deck_id ="` (no bare `=` before an IN-list).
    """
    s = stmt.lower()
    return "count(" in s and "from card_records" in s and "card_records.deck_id =" in s


# ---------------------------------------------------------------------------
# Shared seeding helpers
# ---------------------------------------------------------------------------


async def _seed_user(db_session: AsyncSession) -> User:
    user = User(email=f"perf18_{uuid4().hex[:8]}@example.com", is_active=True)
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


async def _seed_vocab_deck_studied(
    db_session: AsyncSession,
    user: User,
    *,
    suffix: str,
    last_studied: datetime | None,
    status: CardStatus = CardStatus.LEARNING,
    next_review_date: date | None = None,
    deck_is_active: bool = True,
    card_is_active: bool = True,
    level: DeckLevel = DeckLevel.A1,
    deck_id: UUID | None = None,
) -> Deck:
    """Seed one Deck + WordEntry + CardRecord + CardRecordStatistics (+ optional review).

    `last_studied=None` seeds stats without a CardRecordReview row (so the
    deck has progress but no review timestamp — `last_studied_at` stays None,
    matching `get_last_review_by_deck`'s dict-lookup-miss semantics).
    """
    deck_kwargs: dict[str, Any] = dict(
        name_en=f"PERF-18 Vocab {suffix}",
        name_el="Τεστ",
        name_ru="Тест",
        description_en="test",
        description_el="test",
        description_ru="test",
        level=level,
        is_active=deck_is_active,
    )
    if deck_id is not None:
        deck_kwargs["id"] = deck_id
    deck = Deck(**deck_kwargs)
    db_session.add(deck)
    await db_session.flush()

    word_entry = WordEntry(
        owner_id=None,
        lemma=f"λέξη-{suffix}",
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
        front_content={"card_type": "meaning_el_to_en", "prompt": "Translate", "main": "λέξη"},
        back_content={"card_type": "meaning_el_to_en", "answer": "word"},
        is_active=card_is_active,
    )
    db_session.add(card_record)
    await db_session.flush()

    db_session.add(
        CardRecordStatistics(
            user_id=user.id,
            card_record_id=card_record.id,
            status=status,
            next_review_date=next_review_date or date.today(),
        )
    )
    if last_studied is not None:
        db_session.add(
            CardRecordReview(
                user_id=user.id,
                card_record_id=card_record.id,
                quality=4,
                time_taken=10,
                reviewed_at=last_studied,
            )
        )
    await db_session.flush()
    return deck


async def _seed_culture_deck_studied(
    db_session: AsyncSession,
    user: User | None,
    *,
    suffix: str,
    last_studied: datetime | None,
    status: CardStatus = CardStatus.LEARNING,
    next_review_date: date | None = None,
    is_active: bool = True,
    category: str = "history",
    created_at: datetime | None = None,
    deck_id: UUID | None = None,
    with_stats: bool = True,
) -> CultureDeck:
    """Seed one CultureDeck + CultureQuestion (+ optional CultureQuestionStats).

    `with_stats=False` seeds a deck with zero progress (no stats row at all —
    `get_batch_deck_stats` returns `{}` for it, so all metrics zero out).
    """
    deck_kwargs: dict[str, Any] = dict(
        name_en=f"PERF-18 Culture {suffix}",
        name_el="Τεστ Κουλτούρα",
        name_ru="Тест Культура",
        description_en="test",
        description_el="test",
        description_ru="test",
        category=category,
        is_active=is_active,
    )
    if created_at is not None:
        deck_kwargs["created_at"] = created_at
    if deck_id is not None:
        deck_kwargs["id"] = deck_id
    cdeck = CultureDeck(**deck_kwargs)
    db_session.add(cdeck)
    await db_session.flush()

    question = CultureQuestion(
        deck_id=cdeck.id,
        question_text={"en": "Q?", "el": "Ε;"},
        option_a={"en": "A", "el": "Α"},
        option_b={"en": "B", "el": "Β"},
        option_c={"en": "C", "el": "Γ"},
        option_d={"en": "D", "el": "Δ"},
        correct_option=1,
    )
    db_session.add(question)
    await db_session.flush()

    if with_stats and user is not None and last_studied is not None:
        db_session.add(
            CultureQuestionStats(
                user_id=user.id,
                question_id=question.id,
                status=status,
                next_review_date=next_review_date or date.today(),
                updated_at=last_studied,
            )
        )
    await db_session.flush()
    return cdeck


async def _seed_many_vocab_decks_studied(
    db_session: AsyncSession,
    user: User,
    *,
    count: int,
    suffix_prefix: str,
    last_studied_fn: Callable[[int], datetime],
    status: CardStatus = CardStatus.LEARNING,
) -> list[Deck]:
    """Batch-seed `count` vocab decks (one flush per entity type, not per deck).

    Used for larger fixtures (test 2, test 6) where per-deck flushing would
    be slow. `last_studied_fn(i)` returns the reviewed_at datetime for deck i.
    """
    decks = [
        Deck(
            name_en=f"PERF-18 Vocab {suffix_prefix}{i:03d}",
            name_el="Τεστ",
            name_ru="Тест",
            description_en="test",
            description_el="test",
            description_ru="test",
            level=DeckLevel.A1,
            is_active=True,
        )
        for i in range(count)
    ]
    db_session.add_all(decks)
    await db_session.flush()

    word_entries = [
        WordEntry(
            owner_id=None,
            lemma=f"λέξη-{suffix_prefix}{i:03d}",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="word",
            is_active=True,
        )
        for i in range(count)
    ]
    db_session.add_all(word_entries)
    await db_session.flush()

    db_session.add_all(
        [DeckWordEntry(deck_id=d.id, word_entry_id=w.id) for d, w in zip(decks, word_entries)]
    )
    await db_session.flush()

    card_records = [
        CardRecord(
            word_entry_id=w.id,
            deck_id=d.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            front_content={"card_type": "meaning_el_to_en", "prompt": "Translate", "main": "λέξη"},
            back_content={"card_type": "meaning_el_to_en", "answer": "word"},
            is_active=True,
        )
        for d, w in zip(decks, word_entries)
    ]
    db_session.add_all(card_records)
    await db_session.flush()

    db_session.add_all(
        [
            CardRecordStatistics(
                user_id=user.id,
                card_record_id=cr.id,
                status=status,
                next_review_date=date.today(),
            )
            for cr in card_records
        ]
    )
    db_session.add_all(
        [
            CardRecordReview(
                user_id=user.id,
                card_record_id=cr.id,
                quality=4,
                time_taken=10,
                reviewed_at=last_studied_fn(i),
            )
            for i, cr in enumerate(card_records)
        ]
    )
    await db_session.flush()
    return decks


async def _seed_many_culture_decks(
    db_session: AsyncSession,
    *,
    count: int,
    suffix_prefix: str,
    created_at_fn: Callable[[int], datetime],
    category: str = "history",
) -> list[CultureDeck]:
    """Batch-seed `count` active, zero-progress CultureDecks (+1 question each)."""
    decks = [
        CultureDeck(
            name_en=f"PERF-18 Culture {suffix_prefix}{i:03d}",
            name_el="Τεστ Κουλτούρα",
            name_ru="Тест Культура",
            description_en="test",
            description_el="test",
            description_ru="test",
            category=category,
            is_active=True,
            created_at=created_at_fn(i),
        )
        for i in range(count)
    ]
    db_session.add_all(decks)
    await db_session.flush()

    questions = [
        CultureQuestion(
            deck_id=d.id,
            question_text={"en": "Q?", "el": "Ε;"},
            option_a={"en": "A", "el": "Α"},
            option_b={"en": "B", "el": "Β"},
            option_c={"en": "C", "el": "Γ"},
            option_d={"en": "D", "el": "Δ"},
            correct_option=1,
        )
        for d in decks
    ]
    db_session.add_all(questions)
    await db_session.flush()
    return decks


def _expected_vocab_summary(
    deck: Deck,
    *,
    total_cards: int,
    cards_studied: int,
    cards_mastered: int,
    cards_due: int,
    last_studied_at: datetime | None,
    avg_ef: float = 2.5,
) -> dict[str, Any]:
    """Expected DeckProgressSummary fields for a vocab deck, matching today's
    exact arithmetic in `_compute_deck_progress_list` (progress_service.py:562-577)."""
    mastery_pct = round(cards_mastered / total_cards * 100, 1) if total_cards > 0 else 0.0
    completion_pct = round(cards_studied / total_cards * 100, 1) if total_cards > 0 else 0.0
    return dict(
        deck_id=deck.id,
        deck_name=deck.name_en,
        deck_level=deck.level.value,
        total_cards=total_cards,
        cards_studied=cards_studied,
        cards_mastered=cards_mastered,
        cards_due=cards_due,
        mastery_percentage=mastery_pct,
        completion_percentage=completion_pct,
        last_studied_at=last_studied_at,
        average_easiness_factor=avg_ef,
        estimated_review_time_minutes=max(1, cards_due * 2 // 60),
        deck_type="vocabulary",
    )


def _expected_culture_summary(
    cdeck: CultureDeck,
    *,
    total_cards: int,
    mastered: int,
    due: int,
    last_studied_at: datetime | None,
) -> dict[str, Any]:
    """Expected DeckProgressSummary fields for a culture deck, matching today's
    exact arithmetic in `_compute_deck_progress_list` (progress_service.py:604-620).

    NOTE (intentional quirk, preserved for byte-identical parity): `studied =
    mastered + stats.get("learning", 0)`, but `get_batch_deck_stats` never
    returns a `"learning"` key (culture_question_stats.py:674-682) — so
    `studied` always equals `mastered` for culture decks, regardless of the
    actual CultureQuestionStats.status distribution. This is today's real
    behavior, not a test bug — AC3 requires byte-identical output.
    """
    studied = mastered  # "learning" key never populated — see docstring
    mastery_pct = round(mastered / total_cards * 100, 1) if total_cards > 0 else 0.0
    completion_pct = round(studied / total_cards * 100, 1) if total_cards > 0 else 0.0
    return dict(
        deck_id=cdeck.id,
        deck_name=cdeck.name_en,
        deck_level=cdeck.category,
        total_cards=total_cards,
        cards_studied=studied,
        cards_mastered=mastered,
        cards_due=due,
        mastery_percentage=mastery_pct,
        completion_percentage=completion_pct,
        last_studied_at=last_studied_at,
        average_easiness_factor=None,
        estimated_review_time_minutes=max(1, due * 2 // 60),
        deck_type="culture",
    )


def _assert_summary_matches(
    actual: DeckProgressSummary, expected: dict[str, Any], *, label: str
) -> None:
    for field, exp_value in expected.items():
        got = getattr(actual, field)
        assert got == exp_value, f"{label}.{field} mismatch: got {got!r}, expected {exp_value!r}"


# ---------------------------------------------------------------------------
# AC1 — test_deck_list_query_count_is_constant_in_deck_count
# ---------------------------------------------------------------------------

_QUERY_COUNT_CEILING = 10


@pytest.mark.asyncio
@pytest.mark.integration
async def test_deck_list_query_count_is_constant_in_deck_count(
    db_session: AsyncSession,
    db_engine: AsyncEngine,
) -> None:
    """AC1 — statement count must be invariant to deck count (no per-deck N+1).

    RED reason: today's `count_by_deck` loop (progress_service.py:551-556)
    issues one SELECT per *vocab* deck. Seeding 1 vocab + 1 culture deck
    ("small") vs 3 vocab + 3 culture decks ("large") makes today's statement
    count scale with the vocab-deck count (7 vs 9 — computed from the fixed
    6 non-loop queries + N `count_by_deck` calls), so `count_small ==
    count_large` fails. GREEN after: Phase A/B hydration uses batched
    `IN (...)` queries scoped to the *page*, not a per-deck loop, so both
    seedings issue the same ~8 statements regardless of vocab-deck count.
    """
    user_small = await _seed_user(db_session)
    await _seed_vocab_deck_studied(
        db_session,
        user_small,
        suffix="small-v0",
        last_studied=datetime(2026, 3, 1, 9, tzinfo=timezone.utc),
    )
    await _seed_culture_deck_studied(
        db_session,
        user_small,
        suffix="small-c0",
        last_studied=datetime(2026, 3, 1, 10, tzinfo=timezone.utc),
    )

    user_large = await _seed_user(db_session)
    for i in range(3):
        await _seed_vocab_deck_studied(
            db_session,
            user_large,
            suffix=f"large-v{i}",
            last_studied=datetime(2026, 3, 2, 9 + i, tzinfo=timezone.utc),
        )
    for i in range(3):
        await _seed_culture_deck_studied(
            db_session,
            user_large,
            suffix=f"large-c{i}",
            last_studied=datetime(2026, 3, 2, 13 + i, tzinfo=timezone.utc),
        )

    service = ProgressService(db_session)

    with capture_sql(db_engine) as stmts_small:
        await service._compute_deck_progress_list(user_small.id, page=1, page_size=20)
    count_small = len(stmts_small)

    with capture_sql(db_engine) as stmts_large:
        await service._compute_deck_progress_list(user_large.id, page=1, page_size=20)
    count_large = len(stmts_large)

    single_deck_count_selects = [
        s for s in stmts_small + stmts_large if _is_single_deck_count_query(s)
    ]
    assert single_deck_count_selects == [], (
        f"Found {len(single_deck_count_selects)} single-deck 'count_by_deck'-shaped "
        f"SELECT(s) — the per-deck N+1 loop is still present:\n"
        + "\n---\n".join(single_deck_count_selects)
    )

    assert count_small == count_large, (
        f"Statement count is not invariant to deck count: "
        f"small (1 vocab + 1 culture) issued {count_small}, "
        f"large (3 vocab + 3 culture) issued {count_large}. "
        f"Small statements:\n{chr(10).join(stmts_small)}\n"
        f"Large statements:\n{chr(10).join(stmts_large)}"
    )
    assert count_small <= _QUERY_COUNT_CEILING and count_large <= _QUERY_COUNT_CEILING, (
        f"Statement count exceeds ceiling of {_QUERY_COUNT_CEILING}: "
        f"small={count_small}, large={count_large}"
    )


# ---------------------------------------------------------------------------
# AC1 — test_deck_list_paginates_in_sql
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_deck_list_paginates_in_sql(
    db_session: AsyncSession,
    db_engine: AsyncEngine,
) -> None:
    """AC1 — pagination (LIMIT/OFFSET) must be executed in SQL, not Python.

    RED reason: today's code has no `UNION ALL` anywhere — vocab and culture
    summaries are computed independently, concatenated, Python-sorted, then
    Python-sliced (progress_service.py:622-629). The primary assertion looks
    for a captured statement that is *both* a `UNION ALL` (the vocab ∪
    culture ordering query — this specific shape can't be satisfied by an
    unrelated, pre-existing LIMIT/OFFSET query like `list_active()`'s default
    `limit=100`, which contains LIMIT/OFFSET but no UNION ALL) *and* carries
    LIMIT + OFFSET. GREEN after: Phase A's ordering query is exactly this
    shape.
    """
    user = await _seed_user(db_session)
    for i in range(15):
        await _seed_vocab_deck_studied(
            db_session,
            user,
            suffix=f"pg-v{i:02d}",
            last_studied=datetime(2026, 4, 1, tzinfo=timezone.utc) + timedelta(hours=i),
        )
    for i in range(10):
        await _seed_culture_deck_studied(
            db_session,
            user,
            suffix=f"pg-c{i:02d}",
            last_studied=datetime(2026, 4, 2, tzinfo=timezone.utc) + timedelta(hours=i),
        )

    service = ProgressService(db_session)

    with capture_sql(db_engine) as stmts:
        result = await service._compute_deck_progress_list(user.id, page=2, page_size=10)

    union_all_paginated = [
        s
        for s in stmts
        if "union all" in s.lower() and "limit" in s.lower() and "offset" in s.lower()
    ]
    assert len(union_all_paginated) >= 1, (
        "Expected a single UNION ALL ordering query (vocab ∪ culture) carrying "
        "SQL-side LIMIT/OFFSET pagination (Phase A). None found — current "
        "implementation paginates in Python via list slicing "
        "(progress_service.py:628-629), not SQL.\n"
        f"Captured statements ({len(stmts)}):\n" + "\n---\n".join(stmts)
    )

    assert len(result.decks) == 10, f"Expected 10 decks on page 2/size 10, got {len(result.decks)}"
    assert result.total == 25, f"Expected total=25, got {result.total}"


# ---------------------------------------------------------------------------
# AC2 — test_deck_list_parity_ordering_and_contents (golden-snapshot lock)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_deck_list_parity_ordering_and_contents(
    db_session: AsyncSession,
) -> None:
    """AC2/AC3 — DTO fields + order + page slices byte-identical to today.

    NOT a test-first RED (see module docstring) — a golden-snapshot lock akin
    to `test_dashboard_output_unchanged_after_batching` in
    test_progress_dashboard_batching.py. The 6 seeded decks (3 vocab + 3
    culture) have distinct, deliberately-scrambled `last_studied` timestamps
    (not matching insertion order or type-grouping) so that a correct
    newest-first ordering is a nontrivial, verifiable claim rather than an
    accident of insertion order.
    """
    user = await _seed_user(db_session)
    base = datetime(2026, 5, 1, tzinfo=timezone.utc)

    # Scrambled ranks (newest first): C1, V2, C3, V1, C2, V3
    v1 = await _seed_vocab_deck_studied(
        db_session,
        user,
        suffix="parity-v1",
        last_studied=base + timedelta(hours=3),
        status=CardStatus.MASTERED,
        next_review_date=date.today() + timedelta(days=30),
        level=DeckLevel.A1,
    )
    v2 = await _seed_vocab_deck_studied(
        db_session,
        user,
        suffix="parity-v2",
        last_studied=base + timedelta(hours=5),
        status=CardStatus.LEARNING,
        next_review_date=date.today(),
        level=DeckLevel.A2,
    )
    v3 = await _seed_vocab_deck_studied(
        db_session,
        user,
        suffix="parity-v3",
        last_studied=base + timedelta(hours=1),
        status=CardStatus.REVIEW,
        next_review_date=date.today() + timedelta(days=5),
        level=DeckLevel.B1,
    )
    c1 = await _seed_culture_deck_studied(
        db_session,
        user,
        suffix="parity-c1",
        last_studied=base + timedelta(hours=6),
        status=CardStatus.MASTERED,
        next_review_date=date.today() + timedelta(days=30),
        category="history",
    )
    c2 = await _seed_culture_deck_studied(
        db_session,
        user,
        suffix="parity-c2",
        last_studied=base + timedelta(hours=2),
        status=CardStatus.LEARNING,
        next_review_date=date.today(),
        category="geography",
    )
    c3 = await _seed_culture_deck_studied(
        db_session,
        user,
        suffix="parity-c3",
        last_studied=base + timedelta(hours=4),
        status=CardStatus.REVIEW,
        next_review_date=date.today() + timedelta(days=5),
        category="politics",
    )

    expected = [
        _expected_culture_summary(
            c1, total_cards=1, mastered=1, due=0, last_studied_at=base + timedelta(hours=6)
        ),
        _expected_vocab_summary(
            v2,
            total_cards=1,
            cards_studied=1,
            cards_mastered=0,
            cards_due=1,
            last_studied_at=base + timedelta(hours=5),
        ),
        _expected_culture_summary(
            c3, total_cards=1, mastered=0, due=0, last_studied_at=base + timedelta(hours=4)
        ),
        _expected_vocab_summary(
            v1,
            total_cards=1,
            cards_studied=1,
            cards_mastered=1,
            cards_due=0,
            last_studied_at=base + timedelta(hours=3),
        ),
        _expected_culture_summary(
            c2, total_cards=1, mastered=0, due=1, last_studied_at=base + timedelta(hours=2)
        ),
        _expected_vocab_summary(
            v3,
            total_cards=1,
            cards_studied=1,
            cards_mastered=0,
            cards_due=0,
            last_studied_at=base + timedelta(hours=1),
        ),
    ]

    service = ProgressService(db_session)
    page_size = 2
    all_returned: list[DeckProgressSummary] = []
    for page in range(1, 4):  # 3 pages of 2 = 6
        result = await service._compute_deck_progress_list(user.id, page=page, page_size=page_size)
        assert result.total == 6, f"page {page}: expected total=6, got {result.total}"
        expected_slice = expected[(page - 1) * page_size : page * page_size]
        assert len(result.decks) == len(
            expected_slice
        ), f"page {page}: expected {len(expected_slice)} decks, got {len(result.decks)}"
        for i, (actual, exp) in enumerate(zip(result.decks, expected_slice)):
            _assert_summary_matches(actual, exp, label=f"page{page}[{i}]")
        all_returned.extend(result.decks)

    all_ids = [d.deck_id for d in all_returned]
    expected_ids = [e["deck_id"] for e in expected]
    assert all_ids == expected_ids, (
        f"Union of pages does not match expected full ordering.\n"
        f"got:      {all_ids}\nexpected: {expected_ids}"
    )
    assert len(set(all_ids)) == 6, "Duplicate deck_id across pages"


# ---------------------------------------------------------------------------
# AC2 — test_deck_list_tiebreaker_is_deterministic (D1)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_deck_list_tiebreaker_is_deterministic(
    db_session: AsyncSession,
) -> None:
    """AC2/D1 — ties on `last_studied` (incl. None) break deterministically by `deck_id ASC`.

    RED reason (structural, not probabilistic): explicit `id=uuid.UUID(int=N)`
    values are assigned so that, within each tie group, the *culture* deck's
    UUID sorts lowest. Today's Python `sorted(vocab_deck_summaries +
    culture_deck_summaries, key=..., reverse=True)` is stable, and vocab
    summaries are concatenated *before* culture summaries
    (progress_service.py:622-626) — so within any tie, today's order is
    always "vocab-decks-then-culture-decks", which can never equal a true
    `deck_id ASC` order that places the (lowest-UUID) culture deck first.
    This mismatch is guaranteed by construction, not by UUID-randomness luck.

    GREEN after: Phase A's `ORDER BY last_studied DESC NULLS LAST, deck_id ASC`
    produces the true ascending-UUID order within each tie group.
    """
    user = await _seed_user(db_session)
    t_real = datetime(2026, 6, 1, 9, tzinfo=timezone.utc)

    # Group A: 3 decks tied at t_real. Ascending id order: c1, v1, v2.
    a_c1 = await _seed_culture_deck_studied(
        db_session,
        user,
        suffix="tie-a-c1",
        last_studied=t_real,
        deck_id=UUID(int=1),
    )
    a_v1 = await _seed_vocab_deck_studied(
        db_session,
        user,
        suffix="tie-a-v1",
        last_studied=t_real,
        deck_id=UUID(int=2),
    )
    a_v2 = await _seed_vocab_deck_studied(
        db_session,
        user,
        suffix="tie-a-v2",
        last_studied=t_real,
        deck_id=UUID(int=3),
    )

    # Group B: 2 decks tied at None (NULLS LAST, must sort after Group A).
    # Ascending id order: c1, v1.
    b_c1 = await _seed_culture_deck_studied(
        db_session,
        user,
        suffix="tie-b-c1",
        last_studied=None,
        with_stats=False,
        deck_id=UUID(int=4),
    )
    b_v1 = await _seed_vocab_deck_studied(
        db_session,
        user,
        suffix="tie-b-v1",
        last_studied=None,
        deck_id=UUID(int=5),
    )

    expected_order = [a_c1.id, a_v1.id, a_v2.id, b_c1.id, b_v1.id]

    service = ProgressService(db_session)
    result_1 = await service._compute_deck_progress_list(user.id, page=1, page_size=20)
    result_2 = await service._compute_deck_progress_list(user.id, page=1, page_size=20)

    ids_1 = [d.deck_id for d in result_1.decks]
    ids_2 = [d.deck_id for d in result_2.decks]

    assert (
        ids_1 == ids_2
    ), f"Order is not deterministic across repeated calls:\ncall 1: {ids_1}\ncall 2: {ids_2}"
    assert ids_1 == expected_order, (
        f"Tie order does not follow 'last_studied DESC NULLS LAST, deck_id ASC':\n"
        f"got:      {ids_1}\nexpected: {expected_order}\n"
        f"(Group A tied @ {t_real.isoformat()}: expected [c1, v1, v2] by ascending id; "
        f"Group B tied @ None: expected [c1, v1] by ascending id, ordered after Group A)"
    )


# ---------------------------------------------------------------------------
# AC2 — test_deck_list_excludes_inactive_and_unstudied_vocab (golden-snapshot lock)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_deck_list_excludes_inactive_and_unstudied_vocab(
    db_session: AsyncSession,
) -> None:
    """AC2 — inactive vocab decks absent; 0-progress culture decks present with zeroed metrics.

    NOT a test-first RED (see module docstring) — a golden-snapshot lock.
    `deck_repo.get_by_ids` already filters `Deck.is_active.is_(True)`
    (deck.py:274), so a studied-but-inactive deck is already excluded today
    (`deck_info_map.get(deck_id) is None` → skip, progress_service.py:553-555).
    Guards against the SQL rewrite accidentally dropping the `d.is_active`
    predicate from the Phase A vocab branch, or turning the culture branch's
    LEFT JOIN into an INNER JOIN (which would silently drop 0-progress decks).
    """
    user = await _seed_user(db_session)

    vocab_active = await _seed_vocab_deck_studied(
        db_session,
        user,
        suffix="excl-active",
        last_studied=datetime(2026, 7, 1, tzinfo=timezone.utc),
    )
    await _seed_vocab_deck_studied(
        db_session,
        user,
        suffix="excl-inactive",
        last_studied=datetime(2026, 7, 1, 1, tzinfo=timezone.utc),
        deck_is_active=False,
    )
    culture_zero = await _seed_culture_deck_studied(
        db_session,
        user,
        suffix="excl-culture-zero",
        last_studied=None,
        with_stats=False,
    )

    service = ProgressService(db_session)
    result = await service._compute_deck_progress_list(user.id, page=1, page_size=20)

    assert (
        result.total == 2
    ), f"Expected total=2 (1 active vocab + 1 zero-progress culture), got {result.total}"

    by_id = {d.deck_id: d for d in result.decks}
    assert vocab_active.id in by_id, "Active, studied vocab deck missing from result"
    assert culture_zero.id in by_id, "Zero-progress culture deck missing from result"
    assert len(by_id) == 2, f"Expected exactly 2 decks, got {len(by_id)}: {list(by_id)}"

    culture_summary = by_id[culture_zero.id]
    assert culture_summary.cards_studied == 0
    assert culture_summary.cards_mastered == 0
    assert culture_summary.cards_due == 0
    assert culture_summary.mastery_percentage == 0.0
    assert culture_summary.completion_percentage == 0.0
    assert culture_summary.last_studied_at is None
    assert culture_summary.total_cards == 1
    assert culture_summary.deck_type == "culture"


# ---------------------------------------------------------------------------
# AC2/D13 — test_deck_list_reproduces_culture_100_cap (golden-snapshot lock)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_deck_list_reproduces_culture_100_cap(
    db_session: AsyncSession,
) -> None:
    """AC2/D13 — culture candidate set stays capped at the newest 100 by created_at DESC.

    NOT a test-first RED (see module docstring) — a golden-snapshot lock.
    `culture_deck_repo.list_active()` is already called with its default
    `limit=100` (culture_deck.py:36) ordered by `created_at.desc()`
    (progress_service.py:581), so this cap already holds under current code.
    D13 requires the Phase A SQL cap to *reproduce* this exactly (byte-identical
    page contents/total) — this test locks that invariant through the rewrite,
    guarding against e.g. the cap moving to a different ordering column, or
    being dropped entirely (which would let all 105 culture decks surface).
    """
    user = await _seed_user(db_session)
    base = datetime(2026, 8, 1, tzinfo=timezone.utc)

    culture_decks = await _seed_many_culture_decks(
        db_session,
        count=105,
        suffix_prefix="cap",
        created_at_fn=lambda i: base + timedelta(minutes=i),  # i=0 oldest ... i=104 newest
    )
    oldest_5_ids = {culture_decks[i].id for i in range(5)}
    newest_100_ids = {culture_decks[i].id for i in range(5, 105)}

    vocab_decks = await _seed_many_vocab_decks_studied(
        db_session,
        user,
        count=2,
        suffix_prefix="cap",
        last_studied_fn=lambda i: base + timedelta(days=1, hours=i),
    )
    vocab_ids = {d.id for d in vocab_decks}

    service = ProgressService(db_session)
    page_size = 50
    collected: list[DeckProgressSummary] = []
    total: int | None = None
    page = 1
    while page <= 10:  # safety guard against a non-terminating pagination bug
        result = await service._compute_deck_progress_list(user.id, page=page, page_size=page_size)
        if total is None:
            total = result.total
        if not result.decks:
            break
        collected.extend(result.decks)
        if len(collected) >= total:
            break
        page += 1
    else:
        pytest.fail("Pagination did not terminate within 10 pages")

    assert total == 102, f"Expected total=102 (100 capped culture + 2 vocab), got {total}"

    collected_ids = [d.deck_id for d in collected]
    assert len(collected_ids) == len(set(collected_ids)), "Duplicate deck_id across pages"
    assert (
        len(collected_ids) == total
    ), f"Paginated union has {len(collected_ids)} decks, expected total={total}"

    culture_ids_surfaced = {d.deck_id for d in collected if d.deck_type == "culture"}
    vocab_ids_surfaced = {d.deck_id for d in collected if d.deck_type == "vocabulary"}

    assert vocab_ids_surfaced == vocab_ids, "Vocab decks did not all surface"
    assert (
        len(culture_ids_surfaced) == 100
    ), f"Expected exactly 100 culture decks to surface, got {len(culture_ids_surfaced)}"
    assert oldest_5_ids.isdisjoint(culture_ids_surfaced), (
        f"The 5 oldest culture decks (by created_at) leaked into the result: "
        f"{oldest_5_ids & culture_ids_surfaced}"
    )
    assert (
        culture_ids_surfaced == newest_100_ids
    ), "Surfaced culture decks are not exactly the newest 100 by created_at DESC"
