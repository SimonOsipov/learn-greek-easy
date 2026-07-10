"""Integration tests for WEDGE-02-03: seed sets `topic` at question creation.

`SeedService.seed_culture_decks_and_questions`
(`src/services/seed_service.py:2361`) tags every `CultureQuestion` it
creates with `topic=str(resolve_topic_for_category(category))` in the
per-category loop (D-A4 — the seed must set `topic` at creation time; a
data-migration-only backfill would leave freshly-seeded dev rows NULL,
since `Deploy` (migrations) runs before `Seed Dev Database` in
release-verify's ordering):

    - test_seed_tags_every_culture_question_non_null (AC1)
        every seeded row's `topic` is non-NULL and in the closed
        `CultureTopic` set.
    - test_seed_thematic_decks_tagged_by_category (AC1/AC3)
        history/geography/politics decks -> `topic == category`.
    - test_seed_traditions_and_culture_decks_tagged_culture (AC3/D-A2)
        traditions/culture decks -> `topic == "culture"` (fold).

Scope note: seed decks are exactly {history, geography, politics, culture,
traditions} — no `practical` deck and no fixture rows in seed data. Those
paths (practical stays practical; fixture precedence) are already covered
by WEDGE-02-01/02's factory + fixture unit tests and are not duplicated
here (per the story's Test Specs scope for this subtask).

DB-backed (real Postgres via `db_session`, nested-transaction rollback per
test — see tests/fixtures/database.py). No local DB is started to confirm
green; this file is confirmed collect-clean locally and verified by CI.
"""

from __future__ import annotations

from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.culture_topic import CultureTopic
from src.core.culture_topic_mapping import resolve_topic_for_category
from src.db.models import CultureDeck, CultureQuestion
from src.services.seed_service import SeedService

# Seed decks are exactly this 5-set (src/services/seed_service.py CULTURE_DECKS,
# L732-773) — 10 questions each, 50 total (docstring of
# seed_culture_decks_and_questions, L2320-2325).
_SEED_CATEGORIES = ("history", "geography", "politics", "culture", "traditions")
_QUESTIONS_PER_DECK = 10


async def _run_seed(db_session: AsyncSession) -> tuple[dict, list[UUID]]:
    """Run the culture seed once and return (result, seeded deck ids)."""
    service = SeedService(db_session)
    result = await service.seed_culture_decks_and_questions()
    deck_ids = [UUID(deck["id"]) for deck in result["decks"]]
    return result, deck_ids


@pytest.mark.asyncio
@pytest.mark.integration
async def test_seed_tags_every_culture_question_non_null(db_session: AsyncSession) -> None:
    """AC1: after seed, every created CultureQuestion.topic is non-NULL and in
    the closed CultureTopic set (0 NULL, 0 out-of-set after seed)."""
    result, deck_ids = await _run_seed(db_session)

    questions = (
        (
            await db_session.execute(
                select(CultureQuestion).where(CultureQuestion.deck_id.in_(deck_ids))
            )
        )
        .scalars()
        .all()
    )

    # Guard against a vacuous pass: the seed must actually have created rows,
    # and exactly as many as seed_culture_decks_and_questions reported.
    assert len(questions) == result["total_questions"]
    assert len(questions) == len(_SEED_CATEGORIES) * _QUESTIONS_PER_DECK

    valid_topics = {topic.value for topic in CultureTopic}
    for question in questions:
        assert question.topic is not None, f"question {question.id} has NULL topic after seed"
        assert question.topic in valid_topics, (
            f"question {question.id} has topic {question.topic!r}, "
            f"outside the closed CultureTopic set {sorted(valid_topics)}"
        )


@pytest.mark.asyncio
@pytest.mark.integration
async def test_seed_thematic_decks_tagged_by_category(db_session: AsyncSession) -> None:
    """AC1/AC3: history/geography/politics seed decks -> topic == category."""
    await _run_seed(db_session)

    thematic_categories = ("history", "geography", "politics")
    rows = (
        await db_session.execute(
            select(CultureQuestion.topic, CultureDeck.category)
            .join(CultureDeck, CultureQuestion.deck_id == CultureDeck.id)
            .where(CultureDeck.category.in_(thematic_categories))
        )
    ).all()

    # Guard against a vacuous pass: 10 rows per thematic deck expected.
    counts: dict[str, int] = {category: 0 for category in thematic_categories}
    for topic, category in rows:
        assert topic == category, (
            f"expected topic == category for thematic deck {category!r}, " f"got topic={topic!r}"
        )
        assert topic == str(resolve_topic_for_category(category)), (
            f"topic {topic!r} does not match resolve_topic_for_category({category!r}) "
            f"== {resolve_topic_for_category(category)!r}"
        )
        counts[category] += 1

    for category, count in counts.items():
        assert count == _QUESTIONS_PER_DECK, (
            f"expected {_QUESTIONS_PER_DECK} tagged questions for deck "
            f"{category!r}, got {count}"
        )


@pytest.mark.asyncio
@pytest.mark.integration
async def test_seed_traditions_and_culture_decks_tagged_culture(
    db_session: AsyncSession,
) -> None:
    """AC3/D-A2: culture and traditions seed decks -> topic == "culture".

    Specifically exercises the traditions->culture fold guard (D-A2): the
    traditions deck's own `category` is "traditions", never "culture", so a
    naive `topic=category` seed would leave it out-of-set.
    """
    await _run_seed(db_session)

    fold_categories = ("culture", "traditions")
    rows = (
        await db_session.execute(
            select(CultureQuestion.topic, CultureDeck.category)
            .join(CultureDeck, CultureQuestion.deck_id == CultureDeck.id)
            .where(CultureDeck.category.in_(fold_categories))
        )
    ).all()

    counts: dict[str, int] = {category: 0 for category in fold_categories}
    for topic, category in rows:
        assert topic == CultureTopic.CULTURE.value, (
            f"expected topic == 'culture' for {category!r} deck (D-A2 fold), "
            f"got topic={topic!r}"
        )
        counts[category] += 1

    for category, count in counts.items():
        assert count == _QUESTIONS_PER_DECK, (
            f"expected {_QUESTIONS_PER_DECK} tagged questions for deck "
            f"{category!r}, got {count}"
        )
