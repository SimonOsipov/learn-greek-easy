"""Integration tests for tag_culture_topics CLI (WEDGE-02-05) — run_tagging() against Postgres.

All specs from the Backlog task-1295 "expanded Test Specs, integration tier"
table (Architect Stage-1 patch), transcribed faithfully. These call
``run_tagging`` directly (the injectable, DB-session-testable core), never
``main()``/``_main_async()`` (the init_db/get_session_factory/close_db shell
— intentionally untested per the architect's note, mirroring
scheduler_main.py's untested main()).

Like tests/integration/services/test_culture_topic_tagger.py, every test
here injects its own small synthetic ``reviewed_fixture`` — dev/CI never
touches the real 19-row RESIDUE_TOPIC_FIXTURE.

Mode A (RED): authored before implementation. ``run_tagging`` is a
``NotImplementedError`` stub in ``src/scripts/tag_culture_topics.py`` —
every test below fails on that ``NotImplementedError`` (a valid RED: the
target assertion never gets a chance to run).

Covers (AC / Test Specs table id -> test name):
  AC3/AC2 test_run_tagging_default_dry_run_writes_nothing
  AC1/AC2 test_run_tagging_commit_true_writes_and_commits
  D-A10   test_run_tagging_commit_refused_when_count_mismatch
  D-A10   test_run_tagging_commit_refused_when_unmapped_nonempty
  D-A10   test_run_tagging_commit_refused_when_ambiguous_nonempty
  D-A10   test_run_tagging_commit_refused_when_fixture_unmatched_nonempty
  AC2     test_run_tagging_commit_twice_is_idempotent
  AC4/AC5 test_report_records_bank_version_and_four_provenance_classes
  ops     test_report_json_artifact_is_written_and_valid
"""

from __future__ import annotations

import json
from pathlib import Path
from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.culture_bank_version import CULTURE_BANK_VERSION
from src.core.culture_topic import CultureTopic
from src.core.culture_topic_reviewed_fixture import ReviewedTopic
from src.db.models import CultureQuestion
from src.scripts.tag_culture_topics import run_tagging
from tests.factories import CultureDeckFactory, CultureQuestionFactory

# ---------------------------------------------------------------------------
# Shared helpers (mirrors tests/integration/services/test_culture_topic_tagger.py)
# ---------------------------------------------------------------------------


def _qtext(el: str) -> dict:
    """Build a trilingual question_text dict from a plain-ASCII `el` string."""
    return {"el": el, "en": f"EN: {el}", "ru": f"RU: {el}"}


async def _topic_of(db_session: AsyncSession, question_id: UUID) -> str | None:
    """Fresh column-only SELECT — avoids stale-identity-map reads after an
    internal commit() (which expires previously loaded instances)."""
    result = await db_session.execute(
        select(CultureQuestion.topic).where(CultureQuestion.id == question_id)
    )
    return result.scalar_one()


# ===========================================================================
# AC3/AC2 — test_run_tagging_default_dry_run_writes_nothing
# ===========================================================================


@pytest.mark.integration
async def test_run_tagging_default_dry_run_writes_nothing(db_session: AsyncSession) -> None:
    """AC3/AC2 (Test Specs, integration tier — supersedes test_cli_dry_run_writes_nothing).

    GIVEN a seeded row with NULL topic, a clean synthetic fixture, and
          expected_count matching the seed count (guard would pass)
    WHEN  run_tagging(session, commit=False) runs
    THEN  the DB topic is unchanged (still NULL), exit_code==0, and the
          returned report.dry_run is True — commit=False always probes
          only, per design requirement #3 (dry-run always prints the full
          report but never writes, regardless of guard verdict).
    """
    deck = await CultureDeckFactory.create(session=db_session)
    question = await CultureQuestionFactory.create(
        session=db_session,
        deck_id=deck.id,
        question_text=_qtext("default dry run writes nothing text"),
    )

    report, text, exit_code = await run_tagging(
        db_session, commit=False, expected_count=1, reviewed_fixture={}
    )

    topic = await _topic_of(db_session, question.id)
    assert topic is None
    assert exit_code == 0
    assert report.dry_run is True
    assert isinstance(text, str) and text


# ===========================================================================
# AC1/AC2 — test_run_tagging_commit_true_writes_and_commits
# ===========================================================================


@pytest.mark.integration
async def test_run_tagging_commit_true_writes_and_commits(db_session: AsyncSession) -> None:
    """AC1/AC2 (Test Specs, integration tier) — the CLI's core "tags
    in-scope rows" happy path (AC1).

    GIVEN a seeded row, a clean synthetic fixture, and expected_count
          matching the seed count (guard passes)
    WHEN  run_tagging(session, commit=True, expected_count=1) runs
    THEN  the topic is written+committed (visible via a fresh SELECT) and
          exit_code==0.
    """
    deck = await CultureDeckFactory.create(session=db_session)  # default category="history"
    question = await CultureQuestionFactory.create(
        session=db_session,
        deck_id=deck.id,
        question_text=_qtext("commit true writes and commits text"),
    )

    report, text, exit_code = await run_tagging(
        db_session, commit=True, expected_count=1, reviewed_fixture={}
    )

    topic = await _topic_of(db_session, question.id)
    assert topic == "history"
    assert exit_code == 0
    assert report.dry_run is False
    assert report.total_tagged == 1
    assert isinstance(text, str) and text


# ===========================================================================
# D-A10 — test_run_tagging_commit_refused_when_count_mismatch
# ===========================================================================


@pytest.mark.integration
async def test_run_tagging_commit_refused_when_count_mismatch(db_session: AsyncSession) -> None:
    """D-A10 (Test Specs, integration tier).

    GIVEN a single seeded row (probe total_tagged will be 1) — no unmapped
          rows, so untagged_remaining stays 0 and only the count check can
          fire
    WHEN  run_tagging(session, commit=True, expected_count=2) runs
          (deliberate mismatch against a lone seeded row)
    THEN  the topic is NOT written (still NULL), exit_code==1, and the
          formatted report text mentions total_tagged (the guard reason).
    """
    deck = await CultureDeckFactory.create(session=db_session)
    question = await CultureQuestionFactory.create(
        session=db_session,
        deck_id=deck.id,
        question_text=_qtext("commit refused count mismatch text"),
    )

    report, text, exit_code = await run_tagging(
        db_session, commit=True, expected_count=2, reviewed_fixture={}
    )

    topic = await _topic_of(db_session, question.id)
    assert topic is None
    assert exit_code == 1
    assert "total_tagged" in text


# ===========================================================================
# D-A10 — test_run_tagging_commit_refused_when_unmapped_nonempty
# ===========================================================================


@pytest.mark.integration
async def test_run_tagging_commit_refused_when_unmapped_nonempty(
    db_session: AsyncSession,
) -> None:
    """D-A10 (Test Specs, integration tier).

    GIVEN one recognized row and one deckless (unmapped) row — total_tagged
          only counts the recognized row, so expected_count is set to match
          total_tagged exactly, neutralizing a coincidental count-based
          guard reason (untagged_remaining will still correctly fire
          alongside unmapped — same underlying "one row never got a topic"
          signal, not a testing artifact)
    WHEN  run_tagging(session, commit=True, expected_count=1) runs
    THEN  refused (exit_code==1), the deckless row's id appears in the
          report text, and NEITHER row's topic is written.
    """
    deck = await CultureDeckFactory.create(session=db_session)
    recognized_q = await CultureQuestionFactory.create(
        session=db_session,
        deck_id=deck.id,
        question_text=_qtext("unmapped guard recognized row text"),
    )
    deckless_q = await CultureQuestionFactory.create(
        session=db_session,
        deck_id=None,
        question_text=_qtext("unmapped guard deckless row text"),
    )

    report, text, exit_code = await run_tagging(
        db_session, commit=True, expected_count=1, reviewed_fixture={}
    )

    assert exit_code == 1
    assert str(deckless_q.id) in text
    assert await _topic_of(db_session, recognized_q.id) is None
    assert await _topic_of(db_session, deckless_q.id) is None


# ===========================================================================
# D-A10 — test_run_tagging_commit_refused_when_ambiguous_nonempty
# ===========================================================================


@pytest.mark.integration
async def test_run_tagging_commit_refused_when_ambiguous_nonempty(
    db_session: AsyncSession,
) -> None:
    """D-A10 (Test Specs, integration tier).

    GIVEN a culture-deck question el twinned by both a history and a
          politics question (defensive multi-topic-twin scenario) — every
          row still gets assigned a topic, so total_tagged==expected_count
          and untagged_remaining==0, isolating the ambiguous-nonempty guard
          reason
    WHEN  run_tagging(session, commit=True, expected_count=3) runs
    THEN  refused (exit_code==1), the report text mentions "ambiguous", and
          no row's topic is written (all three stay NULL).
    """
    shared_el = "run tagging ambiguous guard shared twin text"
    history_deck = await CultureDeckFactory.create(session=db_session)
    politics_deck = await CultureDeckFactory.create(session=db_session, politics=True)
    culture_deck = await CultureDeckFactory.create(session=db_session, culture=True)

    history_q = await CultureQuestionFactory.create(
        session=db_session, deck_id=history_deck.id, question_text=_qtext(shared_el)
    )
    politics_q = await CultureQuestionFactory.create(
        session=db_session, deck_id=politics_deck.id, question_text=_qtext(shared_el)
    )
    culture_q = await CultureQuestionFactory.create(
        session=db_session, deck_id=culture_deck.id, question_text=_qtext(shared_el)
    )

    report, text, exit_code = await run_tagging(
        db_session, commit=True, expected_count=3, reviewed_fixture={}
    )

    assert exit_code == 1
    assert "ambiguous" in text
    for question in (history_q, politics_q, culture_q):
        assert await _topic_of(db_session, question.id) is None


# ===========================================================================
# D-A10 — test_run_tagging_commit_refused_when_fixture_unmatched_nonempty
# ===========================================================================


@pytest.mark.integration
async def test_run_tagging_commit_refused_when_fixture_unmatched_nonempty(
    db_session: AsyncSession,
) -> None:
    """D-A10 (Test Specs, integration tier).

    GIVEN one seeded row and a synthetic reviewed_fixture whose key matches
          no seeded row (fixture_unmatched) — the seeded row is still
          assigned via the normal by-deck path, so total_tagged==
          expected_count and untagged_remaining==0, isolating the
          fixture_unmatched-nonempty guard reason
    WHEN  run_tagging(session, commit=True, expected_count=1,
          reviewed_fixture=<synthetic>) runs
    THEN  refused (exit_code==1), the report text mentions
          "fixture_unmatched", and the seeded row's topic is NOT written.
    """
    deck = await CultureDeckFactory.create(session=db_session)
    question = await CultureQuestionFactory.create(
        session=db_session,
        deck_id=deck.id,
        question_text=_qtext("fixture unmatched guard seeded row text"),
    )
    unmatched_key = "fixture key matching no seeded row at all"
    fixture = {unmatched_key: ReviewedTopic(topic=CultureTopic.HISTORY, rationale="unused")}

    report, text, exit_code = await run_tagging(
        db_session, commit=True, expected_count=1, reviewed_fixture=fixture
    )

    assert exit_code == 1
    assert "fixture_unmatched" in text
    assert await _topic_of(db_session, question.id) is None


# ===========================================================================
# AC2 — test_run_tagging_commit_twice_is_idempotent
# ===========================================================================


@pytest.mark.integration
async def test_run_tagging_commit_twice_is_idempotent(db_session: AsyncSession) -> None:
    """AC2 (Test Specs, integration tier — supersedes test_cli_main_run_twice_idempotent).

    GIVEN seeded rows and a clean synthetic fixture, expected_count matching
          the seed count
    WHEN  run_tagging(session, commit=True, expected_count=2) runs TWICE
          sequentially
    THEN  both calls exit 0, and the 2nd call's topic snapshot is identical
          to the 1st's — row count unchanged, 0 NULL.
    """
    history_deck = await CultureDeckFactory.create(session=db_session)
    culture_deck = await CultureDeckFactory.create(session=db_session, culture=True)

    q1 = await CultureQuestionFactory.create(
        session=db_session,
        deck_id=history_deck.id,
        question_text=_qtext("idempotent commit twice history text"),
    )
    q2 = await CultureQuestionFactory.create(
        session=db_session,
        deck_id=culture_deck.id,
        question_text=_qtext("idempotent commit twice culture text"),
    )

    report_1, _, exit_code_1 = await run_tagging(
        db_session, commit=True, expected_count=2, reviewed_fixture={}
    )
    snapshot_1 = {
        q1.id: await _topic_of(db_session, q1.id),
        q2.id: await _topic_of(db_session, q2.id),
    }

    report_2, _, exit_code_2 = await run_tagging(
        db_session, commit=True, expected_count=2, reviewed_fixture={}
    )
    snapshot_2 = {
        q1.id: await _topic_of(db_session, q1.id),
        q2.id: await _topic_of(db_session, q2.id),
    }

    assert exit_code_1 == 0
    assert exit_code_2 == 0
    assert snapshot_1 == snapshot_2
    assert None not in snapshot_2.values()
    assert report_1.total_tagged == report_2.total_tagged == 2


# ===========================================================================
# AC4/AC5 — test_report_records_bank_version_and_four_provenance_classes
# ===========================================================================


@pytest.mark.integration
async def test_report_records_bank_version_and_four_provenance_classes(
    db_session: AsyncSession,
) -> None:
    """AC4/AC5 (Test Specs, integration tier — supersedes
    test_cli_report_records_version_and_four_provenance_classes).

    GIVEN a mixed by-deck / twin / culture-default / fixture seed (5 rows,
          no unmapped rows) and expected_count matching the seeded total
    WHEN  run_tagging(session, commit=True, expected_count=5) runs
    THEN  report.bank_version == CULTURE_BANK_VERSION (the CLI stamps the
          frozen constant, overwriting the engine's own "unversioned"
          placeholder — see the culture_topic_tagger.py module note), all 4
          provenance fields sum to total_tagged, per_topic_totals is
          populated, and untagged_remaining == 0.
    """
    history_deck = await CultureDeckFactory.create(session=db_session)
    culture_deck = await CultureDeckFactory.create(session=db_session, culture=True)

    # by-deck (1)
    await CultureQuestionFactory.create(
        session=db_session,
        deck_id=history_deck.id,
        question_text=_qtext("version stamp by deck text"),
    )
    # by-twin (1): culture-deck copy of the same el as another history row
    twin_el = "version stamp twin shared text"
    await CultureQuestionFactory.create(
        session=db_session, deck_id=history_deck.id, question_text=_qtext(twin_el)
    )
    await CultureQuestionFactory.create(
        session=db_session, deck_id=culture_deck.id, question_text=_qtext(twin_el)
    )
    # genuine culture default (1)
    await CultureQuestionFactory.create(
        session=db_session,
        deck_id=culture_deck.id,
        question_text=_qtext("version stamp genuine default text"),
    )
    # fixture row (1)
    fixture_el = "version stamp fixture text"
    await CultureQuestionFactory.create(
        session=db_session, deck_id=culture_deck.id, question_text=_qtext(fixture_el)
    )
    fixture = {
        fixture_el: ReviewedTopic(topic=CultureTopic.GEOGRAPHY, rationale="version stamp test")
    }

    report, _, exit_code = await run_tagging(
        db_session, commit=True, expected_count=5, reviewed_fixture=fixture
    )

    assert exit_code == 0
    assert report.bank_version == CULTURE_BANK_VERSION
    computed_sum = (
        sum(report.assigned_by_deck.values())
        + report.inherited_by_twin
        + report.genuine_culture_default
        + len(report.judgment_fixture)
    )
    assert computed_sum == report.total_tagged == 5
    assert report.per_topic_totals
    assert sum(report.per_topic_totals.values()) == report.total_tagged
    assert report.untagged_remaining == 0


# ===========================================================================
# ops — test_report_json_artifact_is_written_and_valid
# ===========================================================================


@pytest.mark.integration
async def test_report_json_artifact_is_written_and_valid(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    """ops (Test Specs, integration tier).

    GIVEN a multi-topic-twin (ambiguous) scenario and a report_path pointing
          at a pytest tmp_path (never the tracked src/ tree)
    WHEN  run_tagging(session, commit=False, report_path=report_path) runs
    THEN  the JSON artifact exists, parses as valid JSON, has
          mode/guard_passed/bank_version/total_tagged keys, and the
          ambiguous entry's candidates serialize as a plain list of topic
          strings (e.g. ["geography", "history"]), NOT an unreadable
          frozenset repr.
    """
    shared_el = "json artifact ambiguous serialization shared text"
    history_deck = await CultureDeckFactory.create(session=db_session)
    geography_deck = await CultureDeckFactory.create(session=db_session, geography=True)
    culture_deck = await CultureDeckFactory.create(session=db_session, culture=True)

    await CultureQuestionFactory.create(
        session=db_session, deck_id=history_deck.id, question_text=_qtext(shared_el)
    )
    await CultureQuestionFactory.create(
        session=db_session, deck_id=geography_deck.id, question_text=_qtext(shared_el)
    )
    await CultureQuestionFactory.create(
        session=db_session, deck_id=culture_deck.id, question_text=_qtext(shared_el)
    )

    report_path = tmp_path / "r.json"

    report, _, exit_code = await run_tagging(
        db_session,
        commit=False,
        expected_count=3,
        reviewed_fixture={},
        report_path=report_path,
    )

    assert exit_code == 0
    assert report_path.exists()
    data = json.loads(report_path.read_text())
    for key in ("mode", "guard_passed", "bank_version", "total_tagged"):
        assert key in data, f"missing key {key!r} in JSON report artifact"

    assert len(report.ambiguous) == 1
    assert data["ambiguous"], "ambiguous entries must be serialized into the JSON artifact"
    candidates = data["ambiguous"][0]["candidates"]
    assert isinstance(candidates, list)
    assert all(isinstance(c, str) for c in candidates)
    assert "frozenset" not in str(candidates)
    assert set(candidates) == {"geography", "history"}
