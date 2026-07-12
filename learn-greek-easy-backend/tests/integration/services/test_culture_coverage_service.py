"""Mode A RED tests for WEDGE-05-01: CultureCoverageService.get_coverage.

Integration tests against a real seeded DB -- no CultureQuestionFactory (it
leaves `topic=None`, unusable for the per-topic bucket assertions here);
questions are seeded via direct `CultureQuestion(...)` construction, mirroring
tests/integration/services/test_mock_exam_submit_all_batching.py:622-654.

RED reason: `CultureCoverageService.get_coverage` currently unconditionally
raises NotImplementedError (src/services/culture_coverage_service.py), so
every test below fails on that exception -- not an import/collection error --
until the WEDGE-05-01 executor implements the real whole-table aggregate
read: COUNT(*), MAX(updated_at), and per-topic GROUP BY counts, all over the
ENTIRE culture_questions table.
"""

from __future__ import annotations

import sys
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Generator

# Pre-mock spaCy before importing any service that pulls MorphologyService
# (same guard as test_mock_exam_submit_all_batching.py -- CultureQuestionRepository
# sits behind src.services import chains that eventually touch it).
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

from src.core.culture_topic import CultureTopic
from src.db.models import CultureDeck, CultureQuestion
from src.services.culture_coverage_service import CultureCoverageService

# ---------------------------------------------------------------------------
# SQL statement counter (verbatim copy of the helper in
# tests/integration/services/test_mock_exam_submit_all_batching.py:88-119,
# itself copied from test_progress_dashboard_batching.py:147-178 -- not
# importable, duplicated across the suite by established convention).
# ---------------------------------------------------------------------------


@contextmanager
def capture_sql(engine: AsyncEngine) -> Generator[list[str], None, None]:
    """Capture real SQL statements emitted on *engine* during the block.

    Attaches a ``before_cursor_execute`` listener to the underlying
    synchronous engine. Only real cursor executions (not transaction
    control bookkeeping) are counted. Fixture-setup SQL that runs outside
    the ``with`` body is excluded.

    Usage::

        with capture_sql(db_engine) as stmts:
            await service.get_coverage()
        assert len(stmts) == 1
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
# Shared seeding fixture (local to this file, by established convention --
# see test_mock_exam_submit_all_batching.py:151-157 for the same rationale).
# ---------------------------------------------------------------------------


@pytest.fixture
async def culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active culture deck for testing."""
    deck = CultureDeck(
        name_en="WEDGE-05 Coverage Deck",
        name_el="Τεστ Κάλυψη",
        name_ru="Тест Покрытие",
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


def _make_question(
    deck_id, order_index: int, topic: str | None, updated_at: datetime | None = None
) -> CultureQuestion:
    kwargs: dict[str, Any] = dict(
        deck_id=deck_id,
        question_text={"en": f"Question {order_index}?", "el": f"Ερώτηση {order_index};"},
        option_a={"en": "Option A", "el": "Επιλογή Α"},
        option_b={"en": "Option B", "el": "Επιλογή Β"},
        correct_option=1,
        order_index=order_index,
        topic=topic,
    )
    if updated_at is not None:
        kwargs["updated_at"] = updated_at
    return CultureQuestion(**kwargs)


@pytest.mark.asyncio
@pytest.mark.integration
async def test_get_coverage_total_and_max_live(
    db_session: AsyncSession,
    culture_deck: CultureDeck,
) -> None:
    """question_count == COUNT(*) over the WHOLE culture_questions table
    (including the untagged/NULL-topic row) and updated_at ==
    MAX(updated_at) over that same whole-table population.

    The NULL-topic row carries the latest timestamp of the whole set, so
    this simultaneously proves NULL-topic rows are NOT excluded from the
    population-wide count/max, even though (per
    test_get_coverage_topics_order_and_flags below) they never land in a
    per-topic bucket.
    """
    topic_timestamps = {
        CultureTopic.HISTORY: datetime(2026, 1, 1, tzinfo=timezone.utc),
        CultureTopic.GEOGRAPHY: datetime(2026, 1, 5, tzinfo=timezone.utc),
        CultureTopic.POLITICS: datetime(2026, 1, 10, tzinfo=timezone.utc),
        CultureTopic.CULTURE: datetime(2026, 1, 3, tzinfo=timezone.utc),
        CultureTopic.PRACTICAL: datetime(2026, 1, 2, tzinfo=timezone.utc),
    }
    for i, (topic, ts) in enumerate(topic_timestamps.items()):
        db_session.add(_make_question(culture_deck.id, i, topic.value, updated_at=ts))

    null_topic_ts = datetime(2026, 1, 15, tzinfo=timezone.utc)
    db_session.add(_make_question(culture_deck.id, 99, None, updated_at=null_topic_ts))

    await db_session.flush()

    service = CultureCoverageService(db_session)
    result = await service.get_coverage()

    assert result.question_count == 6
    assert result.updated_at == null_topic_ts


@pytest.mark.asyncio
@pytest.mark.integration
async def test_get_coverage_topics_order_and_flags(
    db_session: AsyncSession,
    culture_deck: CultureDeck,
) -> None:
    """topics is exactly 5 items in canonical CultureTopic order (history,
    geography, politics, culture, practical); thin = count < 0.5 * best.

    Seeded counts: history=2, geography=2, politics=8, culture=8,
    practical=8 -- best=8, threshold=4 (strict <) -> history & geography
    (2 < 4) are thin, the other three (8 >= 4, one of them IS best) are not.
    """
    counts_by_topic = {
        CultureTopic.HISTORY: 2,
        CultureTopic.GEOGRAPHY: 2,
        CultureTopic.POLITICS: 8,
        CultureTopic.CULTURE: 8,
        CultureTopic.PRACTICAL: 8,
    }
    order_index = 0
    for topic, count in counts_by_topic.items():
        for _ in range(count):
            db_session.add(_make_question(culture_deck.id, order_index, topic.value))
            order_index += 1

    await db_session.flush()

    service = CultureCoverageService(db_session)
    result = await service.get_coverage()

    assert [item.topic for item in result.topics] == [
        "history",
        "geography",
        "politics",
        "culture",
        "practical",
    ]
    thin_by_topic = {item.topic: item.thin for item in result.topics}
    assert thin_by_topic == {
        "history": True,
        "geography": True,
        "politics": False,
        "culture": False,
        "practical": False,
    }


@pytest.mark.asyncio
@pytest.mark.integration
async def test_coverage_is_single_query(
    db_session: AsyncSession,
    db_engine: AsyncEngine,
    culture_deck: CultureDeck,
) -> None:
    """get_coverage() issues exactly ONE SQL statement for the coverage
    read, invariant to row count -- COUNT(*), MAX(updated_at), and the
    per-topic GROUP BY counts must all be expressed in a single aggregate
    query (e.g. one SELECT with FILTER/CASE-WHEN branches per topic), not
    N separate round-trips.

    RED (Mode A): get_coverage() is currently a NotImplementedError stub,
    so this fails on that exception before the len(stmts) assertion is ever
    reached -- an acceptable not-implemented red per the WEDGE-05-01 spec.
    """
    topics = list(CultureTopic)
    for i in range(15):
        db_session.add(_make_question(culture_deck.id, i, topics[i % 5].value))
    await db_session.flush()

    service = CultureCoverageService(db_session)

    with capture_sql(db_engine) as stmts:
        await service.get_coverage()

    assert len(stmts) == 1, (
        f"Expected exactly 1 SQL statement for the coverage read, found "
        f"{len(stmts)}:\n" + "\n---\n".join(stmts)
    )
