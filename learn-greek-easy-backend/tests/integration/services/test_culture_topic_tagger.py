"""Integration tests for WEDGE-02-01: two-pass topic-tagging DB engine.

RED-state (RALPH Phase 1 Stage 2.5 / Mode A, test-first): ``TaggingReport``,
``JudgmentRow``, and ``AmbiguousResolution`` (``src/services/culture_topic_tagger.py``)
are fully-defined data containers already (pure structure), but
``tag_culture_questions`` itself is a signature-only stub that
``raise NotImplementedError``. Every test below drives the REAL JOIN+UPDATE
engine end to end against Postgres and currently fails on NotImplementedError
(confirmed by ``--collect-only`` — no import/collection error) because the
executor has not implemented Pass 1 / Pass 2 yet (Stage 3).

Dev/CI never touches the real 19-row RESIDUE_TOPIC_FIXTURE (that fixture is
populated in WEDGE-02-02): every test here injects its own small, synthetic
``reviewed_fixture`` dict, per the WEDGE-02 story's testing strategy
("Pass 2 / fixture-precedence / ambiguity / idempotency are covered with
factory synthetic data + injected synthetic fixtures").

All ``el`` text below is deliberately plain ASCII, already lowercase, single-
spaced, with no leading/trailing whitespace. That sidesteps a real ambiguity
in the mapping stub's docstring ("casefold()/lower") — Python's
``str.casefold()`` folds the Greek final sigma "ς" to "σ" while ``str.lower()``
does not, so a hand-picked Greek "expected normalized key" could silently
depend on which one Stage 3 picks. Plain ASCII text is a fixed point under
either transform, so fixture keys built directly from the literal ``el``
string are safe regardless of that implementation choice. The one place a
real Greek-text case/whitespace variant is exercised is the pure-function
unit test (``tests/unit/core/test_culture_topic_mapping.py``), which never
hand-predicts a key — it only compares ``normalize_twin_key(a) ==
normalize_twin_key(b)``.

Acceptance Criteria covered (WEDGE-02-01, per the architect's Test Specs
table — task-1291 — including the Gap-1 correction below):
  AC1  Every recognized question ends up non-NULL, in the closed 5-set;
       unrecognized category / deckless questions go to report.unmapped,
       NOT NULL-and-silently-dropped.
  AC2  Idempotent re-run + dry_run computes without writing.
  AC3  Pass-1 anti-fold guard (practical stays practical); Pass-2 order is
       fixture > clean single twin > culture default.
  AC4  TaggingReport's four provenance classes + guards (fixture_unmatched,
       ambiguous, unmapped) are all structurally present and sum correctly.

GAP-1 CORRECTION (architect, 2026-07-10): the original single spec
"test_unrecognized_or_deckless_goes_unmapped_not_null" is split into two
concrete tests — ``test_unrecognized_category_goes_unmapped_not_null`` and
``test_deckless_question_goes_unmapped_not_null`` — because the bulk-load
query must be a LEFT OUTER JOIN on CultureDeck, not the INNER JOIN reused
from ``_get_question_with_deck_category`` (culture_question_service.py:1317).
An INNER JOIN silently drops every ``deck_id IS NULL`` row from the result
set, so that row would never reach ``report.unmapped`` — only the deckless
case proves the outer-join fix; folding it into an "or" with the
unrecognized-category case would let that regression hide. This split is why
the file has 12 integration tests against an 11-row table slice — 16 test
functions total across both files, matching the architect's "16 Test Specs".
"""

from __future__ import annotations

from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.culture_topic import CultureTopic
from src.core.culture_topic_reviewed_fixture import ReviewedTopic
from src.db.models import CultureQuestion
from src.services.culture_topic_tagger import tag_culture_questions
from tests.factories import CultureDeckFactory, CultureQuestionFactory

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _qtext(el: str) -> dict:
    """Build a trilingual question_text dict from a plain-ASCII `el` string.

    See module docstring: `el` is deliberately ASCII/lowercase/single-spaced
    so it's a fixed point under either .lower() or .casefold() normalization,
    and can be used directly as a reviewed_fixture key.
    """
    return {"el": el, "en": f"EN: {el}", "ru": f"RU: {el}"}


async def _topic_of(db_session: AsyncSession, question_id: UUID) -> str | None:
    """Fresh column-only SELECT — avoids stale-identity-map reads after the
    engine's internal commit() (which expires previously loaded instances)."""
    result = await db_session.execute(
        select(CultureQuestion.topic).where(CultureQuestion.id == question_id)
    )
    return result.scalar_one()


# ===========================================================================
# AC1/AC3 — test_pass1_practical_deck_tags_practical_not_culture
# ===========================================================================


@pytest.mark.integration
async def test_pass1_practical_deck_tags_practical_not_culture(
    db_session: AsyncSession,
) -> None:
    """AC1/AC3 (WEDGE-02-01 Test Specs) — D-A1 anti-fold guard.

    GIVEN a category="practical" deck (the new factory trait) with one
          question
    WHEN  the real JOIN+UPDATE engine runs
    THEN  the question's topic == "practical", NEVER "culture" — the D-A1
          readiness fold (src/constants.py CATEGORY_DB_TO_LOGICAL) must not
          leak into this engine's Pass-1 branch.
    """
    deck = await CultureDeckFactory.create(session=db_session, practical=True)
    question = await CultureQuestionFactory.create(
        session=db_session,
        deck_id=deck.id,
        question_text=_qtext("unique practical anti fold guard question"),
    )

    await tag_culture_questions(db_session, reviewed_fixture={})

    topic = await _topic_of(db_session, question.id)
    assert topic == "practical"
    assert topic != "culture"


# ===========================================================================
# AC3/D-A11 — test_pass2_fixture_precedence_over_twin
# ===========================================================================


@pytest.mark.integration
async def test_pass2_fixture_precedence_over_twin(db_session: AsyncSession) -> None:
    """AC3/D-A11 (WEDGE-02-01 Test Specs).

    GIVEN a culture-deck row whose el is BOTH in an injected fixture
          (-> politics) AND has a clean history twin (same el, history deck)
    WHEN  the engine runs
    THEN  the culture row's topic == "politics" (fixture wins over the twin),
          counted in report.judgment_fixture — NOT "history".
    """
    shared_el = "shared exam paper text with a competing twin and fixture entry"
    history_deck = await CultureDeckFactory.create(session=db_session)  # default category="history"
    culture_deck = await CultureDeckFactory.create(session=db_session, culture=True)

    await CultureQuestionFactory.create(
        session=db_session, deck_id=history_deck.id, question_text=_qtext(shared_el)
    )
    culture_q = await CultureQuestionFactory.create(
        session=db_session, deck_id=culture_deck.id, question_text=_qtext(shared_el)
    )

    fixture = {
        shared_el: ReviewedTopic(
            topic=CultureTopic.POLITICS, rationale="fixture must win over an available twin"
        )
    }

    report = await tag_culture_questions(db_session, reviewed_fixture=fixture)

    topic = await _topic_of(db_session, culture_q.id)
    assert topic == "politics"
    assert len(report.judgment_fixture) == 1
    assert report.judgment_fixture[0].question_id == culture_q.id
    assert report.judgment_fixture[0].topic == CultureTopic.POLITICS


# ===========================================================================
# AC3 — test_pass2_clean_single_twin_inherits
# ===========================================================================


@pytest.mark.integration
async def test_pass2_clean_single_twin_inherits(db_session: AsyncSession) -> None:
    """AC3 (WEDGE-02-01 Test Specs).

    GIVEN a history-deck question and a culture-deck copy sharing the same
          el, not in any fixture
    WHEN  the engine runs
    THEN  the culture-deck copy inherits topic == "history" (both agree),
          counted in report.inherited_by_twin.
    """
    shared_el = "clean single twin match text with no fixture entry"
    history_deck = await CultureDeckFactory.create(session=db_session)
    culture_deck = await CultureDeckFactory.create(session=db_session, culture=True)

    await CultureQuestionFactory.create(
        session=db_session, deck_id=history_deck.id, question_text=_qtext(shared_el)
    )
    culture_copy = await CultureQuestionFactory.create(
        session=db_session, deck_id=culture_deck.id, question_text=_qtext(shared_el)
    )

    report = await tag_culture_questions(db_session, reviewed_fixture={})

    topic = await _topic_of(db_session, culture_copy.id)
    assert topic == "history"
    assert report.inherited_by_twin == 1


# ===========================================================================
# AC3 — test_pass2_no_twin_not_in_fixture_defaults_culture
# ===========================================================================


@pytest.mark.integration
async def test_pass2_no_twin_not_in_fixture_defaults_culture(
    db_session: AsyncSession,
) -> None:
    """AC3 (WEDGE-02-01 Test Specs).

    GIVEN a culture-deck question with a unique el (no thematic twin, not in
          any fixture)
    WHEN  the engine runs
    THEN  topic == "culture", counted in report.genuine_culture_default.
    """
    culture_deck = await CultureDeckFactory.create(session=db_session, culture=True)
    lone_q = await CultureQuestionFactory.create(
        session=db_session,
        deck_id=culture_deck.id,
        question_text=_qtext("unique culture only text with no thematic twin anywhere"),
    )

    report = await tag_culture_questions(db_session, reviewed_fixture={})

    topic = await _topic_of(db_session, lone_q.id)
    assert topic == "culture"
    assert report.genuine_culture_default == 1


# ===========================================================================
# AC4 — test_pass2_multi_topic_twin_falls_to_culture_and_flagged
# ===========================================================================


@pytest.mark.integration
async def test_pass2_multi_topic_twin_falls_to_culture_and_flagged(
    db_session: AsyncSession,
) -> None:
    """AC4 (WEDGE-02-01 Test Specs).

    GIVEN a culture-deck question el twinned by BOTH a history question and
          a politics question (defensive — 0 in prod)
    WHEN  the engine runs
    THEN  topic == "culture" AND report.ambiguous records it with
          candidates == {history, politics}.
    """
    shared_el = "multi topic twin text matched by both history and politics decks"
    history_deck = await CultureDeckFactory.create(session=db_session)
    politics_deck = await CultureDeckFactory.create(session=db_session, politics=True)
    culture_deck = await CultureDeckFactory.create(session=db_session, culture=True)

    await CultureQuestionFactory.create(
        session=db_session, deck_id=history_deck.id, question_text=_qtext(shared_el)
    )
    await CultureQuestionFactory.create(
        session=db_session, deck_id=politics_deck.id, question_text=_qtext(shared_el)
    )
    culture_q = await CultureQuestionFactory.create(
        session=db_session, deck_id=culture_deck.id, question_text=_qtext(shared_el)
    )

    report = await tag_culture_questions(db_session, reviewed_fixture={})

    topic = await _topic_of(db_session, culture_q.id)
    assert topic == "culture"
    assert len(report.ambiguous) == 1
    assert report.ambiguous[0].question_id == culture_q.id
    assert report.ambiguous[0].candidates == frozenset(
        {CultureTopic.HISTORY, CultureTopic.POLITICS}
    )


# ===========================================================================
# AC4/D-A11 — test_fixture_key_unmatched_is_reported_not_dropped
# ===========================================================================


@pytest.mark.integration
async def test_fixture_key_unmatched_is_reported_not_dropped(
    db_session: AsyncSession,
) -> None:
    """AC4/D-A11 (WEDGE-02-01 Test Specs).

    GIVEN an injected fixture key that matches no row in the DB
    WHEN  the engine runs
    THEN  report.fixture_unmatched contains that key, and the real question
          in scope is still tagged (tagged-count unaffected).
    """
    culture_deck = await CultureDeckFactory.create(session=db_session, culture=True)
    real_q = await CultureQuestionFactory.create(
        session=db_session,
        deck_id=culture_deck.id,
        question_text=_qtext("only real question text in this test case"),
    )
    unmatched_key = "fixture key that matches no row in the database at all"
    fixture = {unmatched_key: ReviewedTopic(topic=CultureTopic.HISTORY, rationale="unused")}

    report = await tag_culture_questions(db_session, reviewed_fixture=fixture)

    assert unmatched_key in report.fixture_unmatched
    assert report.total_tagged == 1
    topic = await _topic_of(db_session, real_q.id)
    assert topic == "culture"  # falls to default; unaffected by the unmatched fixture entry


# ===========================================================================
# AC1/AC4 — test_unrecognized_category_goes_unmapped_not_null
# (Gap-1 split, case a: unrecognized category)
# ===========================================================================


@pytest.mark.integration
async def test_unrecognized_category_goes_unmapped_not_null(
    db_session: AsyncSession,
) -> None:
    """AC1/AC4 (WEDGE-02-01 Test Specs, Gap-1 split case a).

    GIVEN a question under a deck whose category is unrecognized ("misc")
    WHEN  the engine runs
    THEN  topic stays NULL and the question's id is recorded in
          report.unmapped.
    """
    misc_deck = await CultureDeckFactory.create(session=db_session, category="misc")
    misc_q = await CultureQuestionFactory.create(
        session=db_session,
        deck_id=misc_deck.id,
        question_text=_qtext("question under an unrecognized deck category"),
    )

    report = await tag_culture_questions(db_session, reviewed_fixture={})

    topic = await _topic_of(db_session, misc_q.id)
    assert topic is None
    assert str(misc_q.id) in report.unmapped


# ===========================================================================
# AC1/AC4 — test_deckless_question_goes_unmapped_not_null
# (Gap-1 split, case b: deck_id IS NULL — the OUTER JOIN regression guard)
# ===========================================================================


@pytest.mark.integration
async def test_deckless_question_goes_unmapped_not_null(
    db_session: AsyncSession,
) -> None:
    """AC1/AC4 (WEDGE-02-01 Test Specs, Gap-1 split case b — the case that
    actually proves the outer-join fix).

    GIVEN a question with deck_id=None (no deck at all)
    WHEN  the engine runs
    THEN  topic stays NULL and the question's id is recorded in
          report.unmapped.

    This is the regression guard for the architect's Gap-1 correction: the
    engine's bulk-load query MUST be a LEFT OUTER JOIN on CultureDeck, not
    the INNER JOIN reused from `_get_question_with_deck_category`
    (culture_question_service.py:1317). A plain INNER JOIN silently drops any
    deck_id IS NULL row from the result set entirely, so this deckless
    question would never be visited by the tagging loop and would never
    reach report.unmapped — it would just stay silently NULL and
    unaccounted-for, contradicting D-A10/AC7.
    """
    deckless_q = await CultureQuestionFactory.create(
        session=db_session,
        deck_id=None,
        question_text=_qtext("deckless question with no deck at all"),
    )

    report = await tag_culture_questions(db_session, reviewed_fixture={})

    topic = await _topic_of(db_session, deckless_q.id)
    assert topic is None
    assert str(deckless_q.id) in report.unmapped


# ===========================================================================
# AC1 — test_every_recognized_question_non_null_in_set
# ===========================================================================


@pytest.mark.integration
async def test_every_recognized_question_non_null_in_set(
    db_session: AsyncSession,
) -> None:
    """AC1 (WEDGE-02-01 Test Specs).

    GIVEN mixed thematic + culture decks + a fixture entry
    WHEN  the engine runs
    THEN  every resulting topic is a non-NULL member of the closed 5-set and
          report.untagged_remaining == 0.
    """
    history_deck = await CultureDeckFactory.create(session=db_session)
    geography_deck = await CultureDeckFactory.create(session=db_session, geography=True)
    practical_deck = await CultureDeckFactory.create(session=db_session, practical=True)
    culture_deck = await CultureDeckFactory.create(session=db_session, culture=True)

    await CultureQuestionFactory.create(
        session=db_session, deck_id=history_deck.id, question_text=_qtext("history bucket text")
    )
    await CultureQuestionFactory.create(
        session=db_session,
        deck_id=geography_deck.id,
        question_text=_qtext("geography bucket text"),
    )
    await CultureQuestionFactory.create(
        session=db_session,
        deck_id=practical_deck.id,
        question_text=_qtext("practical bucket text"),
    )
    fixture_el = "genuine judgment fixture text with a rationale"
    await CultureQuestionFactory.create(
        session=db_session, deck_id=culture_deck.id, question_text=_qtext(fixture_el)
    )
    await CultureQuestionFactory.create(
        session=db_session,
        deck_id=culture_deck.id,
        question_text=_qtext("genuine culture default text with no twin"),
    )
    fixture = {fixture_el: ReviewedTopic(topic=CultureTopic.GEOGRAPHY, rationale="judgment call")}

    report = await tag_culture_questions(db_session, reviewed_fixture=fixture)

    result = await db_session.execute(select(CultureQuestion.topic))
    topics = result.scalars().all()
    valid_values = {t.value for t in CultureTopic}
    assert len(topics) == 5
    assert all(t is not None and t in valid_values for t in topics)
    assert report.untagged_remaining == 0


# ===========================================================================
# AC2 — test_engine_rerun_is_idempotent
# ===========================================================================


@pytest.mark.integration
async def test_engine_rerun_is_idempotent(db_session: AsyncSession) -> None:
    """AC2 (WEDGE-02-01 Test Specs).

    GIVEN a mix of by-deck, by-twin, and fixture rows (same frozen fixture
          across both runs)
    WHEN  the engine runs twice on the same db
    THEN  topics are identical, row count is unchanged, 0 NULL, no new rows.
    """
    history_deck = await CultureDeckFactory.create(session=db_session)
    culture_deck = await CultureDeckFactory.create(session=db_session, culture=True)
    shared_el = "idempotent rerun twin text shared across two decks"

    await CultureQuestionFactory.create(
        session=db_session, deck_id=history_deck.id, question_text=_qtext(shared_el)
    )
    await CultureQuestionFactory.create(
        session=db_session, deck_id=culture_deck.id, question_text=_qtext(shared_el)
    )
    fixture_el = "idempotent rerun fixture text"
    await CultureQuestionFactory.create(
        session=db_session, deck_id=culture_deck.id, question_text=_qtext(fixture_el)
    )
    fixture = {
        fixture_el: ReviewedTopic(
            topic=CultureTopic.POLITICS, rationale="frozen for idempotency test"
        )
    }

    ids_before = set((await db_session.execute(select(CultureQuestion.id))).scalars().all())

    report_1 = await tag_culture_questions(db_session, reviewed_fixture=fixture)
    topics_after_first = dict(
        (await db_session.execute(select(CultureQuestion.id, CultureQuestion.topic))).all()
    )

    report_2 = await tag_culture_questions(db_session, reviewed_fixture=fixture)
    topics_after_second = dict(
        (await db_session.execute(select(CultureQuestion.id, CultureQuestion.topic))).all()
    )

    assert topics_after_first == topics_after_second
    assert None not in topics_after_second.values()
    assert set(topics_after_second.keys()) == ids_before
    assert len(topics_after_second) == len(ids_before)
    assert report_1.total_tagged == report_2.total_tagged


# ===========================================================================
# AC4/AC2 — test_dry_run_computes_report_but_writes_nothing
# ===========================================================================


@pytest.mark.integration
async def test_dry_run_computes_report_but_writes_nothing(
    db_session: AsyncSession,
) -> None:
    """AC4/AC2 (WEDGE-02-01 Test Specs).

    GIVEN a row that is currently NULL
    WHEN  tag_culture_questions(db, dry_run=True) runs
    THEN  the report is populated with the WOULD-be assignment (matching the
          D-A9 ops runbook: `--dry-run` against prod is expected to report
          total_tagged == 490 without writing anything), but the DB row's
          topic is unchanged (still NULL).
    """
    history_deck = await CultureDeckFactory.create(session=db_session)
    q = await CultureQuestionFactory.create(
        session=db_session,
        deck_id=history_deck.id,
        question_text=_qtext("dry run should not write this topic"),
    )

    report = await tag_culture_questions(db_session, reviewed_fixture={}, dry_run=True)

    topic = await _topic_of(db_session, q.id)
    assert topic is None
    assert report.dry_run is True
    assert report.total_tagged == 1
    assert report.assigned_by_deck.get("history") == 1


# ===========================================================================
# AC4 — test_four_provenance_classes_sum_to_total
# ===========================================================================


@pytest.mark.integration
async def test_four_provenance_classes_sum_to_total(db_session: AsyncSession) -> None:
    """AC4 (WEDGE-02-01 Test Specs).

    GIVEN a fixture with known by-deck (2) + by-twin (1) + defaulted (1) +
          fixture (1) rows = 5 total
    WHEN  the engine runs
    THEN  sum(assigned_by_deck.values()) + inherited_by_twin +
          genuine_culture_default + len(judgment_fixture) == total_tagged,
          and per_topic_totals sums to total_tagged too.
    """
    history_deck = await CultureDeckFactory.create(session=db_session)
    geography_deck = await CultureDeckFactory.create(session=db_session, geography=True)
    culture_deck = await CultureDeckFactory.create(session=db_session, culture=True)

    # by-deck (2): one history, one geography
    await CultureQuestionFactory.create(
        session=db_session, deck_id=history_deck.id, question_text=_qtext("by deck history text")
    )
    await CultureQuestionFactory.create(
        session=db_session,
        deck_id=geography_deck.id,
        question_text=_qtext("by deck geography text"),
    )
    # by-twin (1): a culture-deck copy of the history question's exact text
    await CultureQuestionFactory.create(
        session=db_session, deck_id=culture_deck.id, question_text=_qtext("by deck history text")
    )
    # genuine culture default (1): unique, no twin, not in fixture
    await CultureQuestionFactory.create(
        session=db_session,
        deck_id=culture_deck.id,
        question_text=_qtext("genuine default unique text with no twin at all"),
    )
    # fixture row (1)
    fixture_el = "fixture provenance sum text"
    await CultureQuestionFactory.create(
        session=db_session, deck_id=culture_deck.id, question_text=_qtext(fixture_el)
    )
    fixture = {
        fixture_el: ReviewedTopic(topic=CultureTopic.POLITICS, rationale="provenance sum test")
    }

    report = await tag_culture_questions(db_session, reviewed_fixture=fixture)

    computed_sum = (
        sum(report.assigned_by_deck.values())
        + report.inherited_by_twin
        + report.genuine_culture_default
        + len(report.judgment_fixture)
    )
    assert report.total_tagged == 5
    assert computed_sum == report.total_tagged
    assert sum(report.per_topic_totals.values()) == report.total_tagged
