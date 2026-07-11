"""Unit tests for tag_culture_topics CLI (WEDGE-02-05) — pure functions + argparse only.

No database. All specs from the Backlog task-1295 "expanded Test Specs, unit
tier" table (Architect Stage-1 patch), transcribed faithfully.

Mode A (RED): authored before implementation. ``_verify_gate`` and
``_format_report`` are ``NotImplementedError`` stubs in
``src/scripts/tag_culture_topics.py`` — every test targeting them fails on
that ``NotImplementedError`` (a valid RED: the target assertion never even
gets a chance to run). ``_build_parser`` is a REAL stub (pure argparse
wiring, no business logic) per the story's flag-default deviation, so its
two tests already pass cleanly today — that is expected, not a bug in the
RED authoring (see module docstring precedent in
tests/unit/scripts/test_backfill_s3_cache_control.py, which mixes RED and
already-green dry-run-contract tests the same way).

Covers (AC / Test Specs table id -> test name):
  D-A10        test_verify_gate_all_pass
  D-A10        test_verify_gate_each_fail_reason_isolated
  AC5          test_format_report_includes_version_and_provenance_summary
  flag-default test_parser_default_is_dry_run_true
  flag-default test_parser_no_dry_run_flag_sets_false
  ops          test_default_expected_count_is_bank_question_count
"""

from __future__ import annotations

import inspect
from uuid import UUID, uuid4

import pytest

from src.core.culture_bank_version import CULTURE_BANK_QUESTION_COUNT
from src.core.culture_topic import CultureTopic
from src.scripts.tag_culture_topics import (
    _build_parser,
    _format_report,
    _verify_gate,
    run_tagging,
)
from src.services.culture_topic_tagger import AmbiguousResolution, JudgmentRow, TaggingReport

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _clean_report(**overrides: object) -> TaggingReport:
    """A synthetic, internally-consistent TaggingReport that passes the
    490-verify guard against expected_count=5 unless overridden.

    assigned_by_deck sum (2) + inherited_by_twin (1) + genuine_culture_default
    (1) + len(judgment_fixture) (1) == total_tagged (5), matching the real
    engine's invariant — callers override individual fields to isolate one
    guard violation at a time.
    """
    defaults: dict[str, object] = dict(
        bank_version="test-bank-version",
        bank_date="2099-01-01",
        total_questions=5,
        total_tagged=5,
        untagged_remaining=0,
        assigned_by_deck={"history": 2},
        inherited_by_twin=1,
        genuine_culture_default=1,
        judgment_fixture=[
            JudgmentRow(
                question_id=uuid4(),
                el="synthetic fixture question text",
                topic=CultureTopic.POLITICS,
                rationale="synthetic clean-report fixture entry",
            )
        ],
        fixture_unmatched=[],
        ambiguous=[],
        unmapped=[],
        per_topic_totals={"history": 2, "politics": 1, "geography": 1, "culture": 1},
        dry_run=False,
    )
    defaults.update(overrides)
    return TaggingReport(**defaults)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# D-A10 — _verify_gate
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_verify_gate_all_pass() -> None:
    """D-A10 (Test Specs, unit tier).

    GIVEN a synthetic TaggingReport where total_tagged==expected_count,
          untagged_remaining==0, and unmapped/ambiguous/fixture_unmatched
          are all empty
    WHEN  _verify_gate(report, expected_count) runs
    THEN  it returns (True, [])
    """
    report = _clean_report()

    guard_ok, reasons = _verify_gate(report, expected_count=5)

    assert guard_ok is True
    assert reasons == []


@pytest.mark.unit
@pytest.mark.parametrize(
    "overrides,expected_count,expected_reason",
    [
        pytest.param(
            {"total_tagged": 4},
            5,
            "total_tagged=4 != expected_count=5",
            id="total_tagged_mismatch",
        ),
        pytest.param(
            {"untagged_remaining": 2},
            5,
            "untagged_remaining=2 != 0",
            id="untagged_remaining_nonzero",
        ),
        pytest.param(
            {"unmapped": ["11111111-1111-1111-1111-111111111111"]},
            5,
            "unmapped: 1 question(s) — ['11111111-1111-1111-1111-111111111111']",
            id="unmapped_nonempty",
        ),
        pytest.param(
            {
                "ambiguous": [
                    AmbiguousResolution(
                        question_id=UUID("22222222-2222-2222-2222-222222222222"),
                        el="ambiguous synthetic text",
                        candidates=frozenset({CultureTopic.HISTORY, CultureTopic.POLITICS}),
                    )
                ]
            },
            5,
            "ambiguous: 1 resolution(s)",
            id="ambiguous_nonempty",
        ),
        pytest.param(
            {"fixture_unmatched": ["unmatched key"]},
            5,
            "fixture_unmatched: 1 key(s) — ['unmatched key']",
            id="fixture_unmatched_nonempty",
        ),
    ],
)
def test_verify_gate_each_fail_reason_isolated(
    overrides: dict[str, object], expected_count: int, expected_reason: str
) -> None:
    """D-A10 (Test Specs, unit tier).

    GIVEN 5 synthetic TaggingReports, each violating exactly ONE guard
          condition (count mismatch / untagged_remaining!=0 / unmapped /
          ambiguous / fixture_unmatched) — all other fields clean
    WHEN  _verify_gate(report, expected_count) runs
    THEN  it returns (False, [<exactly one reason>]) for each case
    """
    report = _clean_report(**overrides)

    guard_ok, reasons = _verify_gate(report, expected_count=expected_count)

    assert guard_ok is False
    assert reasons == [expected_reason]


# ---------------------------------------------------------------------------
# AC5 — _format_report
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_format_report_includes_version_and_provenance_summary() -> None:
    """AC5 (Test Specs, unit tier).

    GIVEN a synthetic TaggingReport + guard verdict
    WHEN  _format_report(...) runs
    THEN  the resulting string contains bank_version, bank_date, and all 4
          provenance-class counts (assigned_by_deck, inherited_by_twin,
          genuine_culture_default, len(judgment_fixture))
    """
    report = _clean_report()

    text = _format_report(report, guard_ok=True, guard_reasons=[], mode="dry-run")

    assert report.bank_version in text
    assert report.bank_date in text
    assert "history" in text  # assigned_by_deck key
    assert str(report.inherited_by_twin) in text
    assert str(report.genuine_culture_default) in text
    assert str(len(report.judgment_fixture)) in text


# ---------------------------------------------------------------------------
# flag-default — _build_parser (REAL, not a stub — pure argparse wiring)
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_parser_default_is_dry_run_true() -> None:
    """flag-default (Test Specs, unit tier) — locks in the safe-default flip.

    GIVEN no CLI flags
    WHEN  _build_parser().parse_args([]) runs
    THEN  args.dry_run is True (bare invocation never writes)
    """
    args = _build_parser().parse_args([])

    assert args.dry_run is True


@pytest.mark.unit
def test_parser_no_dry_run_flag_sets_false() -> None:
    """flag-default (Test Specs, unit tier).

    GIVEN --no-dry-run
    WHEN  _build_parser().parse_args(["--no-dry-run"]) runs
    THEN  args.dry_run is False (explicit opt-in to write)
    """
    args = _build_parser().parse_args(["--no-dry-run"])

    assert args.dry_run is False


# ---------------------------------------------------------------------------
# ops — run_tagging's default expected_count must track the real constant
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_default_expected_count_is_bank_question_count() -> None:
    """ops (Test Specs, unit tier).

    GIVEN run_tagging's signature (inspected, not called — the function
          body is a NotImplementedError stub at this stage)
    WHEN  its `expected_count` parameter default is read
    THEN  it equals CULTURE_BANK_QUESTION_COUNT — guards against the
          production default silently drifting from the real constant.
    """
    sig = inspect.signature(run_tagging)

    assert sig.parameters["expected_count"].default == CULTURE_BANK_QUESTION_COUNT
