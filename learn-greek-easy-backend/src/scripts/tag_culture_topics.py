"""Idempotent prod backfill CLI for the culture-question topic bank (WEDGE-02-05).

Runs the WEDGE-02 two-pass topic-tagging engine (``src.services.
culture_topic_tagger.tag_culture_questions``) against the live
``culture_questions.topic`` column, gated behind a 490-verify guard
(D-A10) so a mismatched/incomplete bank refuses to write rather than
silently mis-tagging or under-tagging rows.

Usage:
    # Dry-run (default, no flags needed) — computes and prints the report,
    # writes the JSON artifact, never touches the DB.
    railway run python -m src.scripts.tag_culture_topics

    # Live run — commits the tagging pass IF the verify gate passes.
    railway run python -m src.scripts.tag_culture_topics --no-dry-run

MANUAL POST-DEPLOY STEP, human-authorized (D-A9). Not wired into the
automated deploy pipeline / no GHA / no Dockerfile CMD. This CLI is NEVER
invoked against prod during /ralph execution — see
``docs/wedge-02-topic-backfill.md`` for the full gated operator procedure
(mirrors ``scripts/backfill_sit_27_02_situation_domain.sql``'s manual
post-deploy-step precedent, but as a doc since this procedure has more
steps than a SQL comment block affords).

Safe default (deviates from this repo's two S3 backfill-script precedents,
which default to LIVE): bare invocation (no flags) is a DRY RUN — writing
the live ``culture_questions.topic`` column requires the explicit
``--no-dry-run`` flag. This CLI writes live, user-facing exam content (not
S3 object metadata), so an opt-in-to-WRITE default encodes "explicit
authorization" at the CLI-ergonomics level.

Idempotent (D-A5): the engine recomputes every row's target topic
unconditionally on every run (never a ``WHERE topic IS NULL`` guard) —
re-running a live commit is a safe no-op once the bank is correctly tagged.

No force-override flag: a guard failure must be fixed at the mapping/
fixture level and re-run, never bypassed (D-A10 — "strays surface, not
silently guessed").
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.culture_bank_version import CULTURE_BANK_QUESTION_COUNT
from src.core.culture_topic_reviewed_fixture import RESIDUE_TOPIC_FIXTURE, ReviewedTopic
from src.db import close_db, get_session_factory, init_db
from src.services.culture_topic_tagger import TaggingReport, tag_culture_questions

# Run-summary JSON artifact, written beside this script. Overwritten every
# run. Not gitignored — an operator may `git add` it after the real
# authorized prod commit run as a durable audit trail.
_REPORT_PATH = Path(__file__).parent / "tag_culture_topics_report.json"


def _verify_gate(report: TaggingReport, expected_count: int) -> tuple[bool, list[str]]:
    """490-verify guard (D-A10).

    Each condition is checked independently so a caller can isolate exactly
    which reason(s) fired. ``untagged_remaining`` is checked separately from
    ``total_tagged`` because a coincidentally-matching total could still hide
    rows that silently entered/left scope.

    Returns (guard_ok, reasons) — reasons is empty iff guard_ok is True.
    """
    reasons: list[str] = []
    if report.total_tagged != expected_count:
        reasons.append(f"total_tagged={report.total_tagged} != expected_count={expected_count}")
    if report.untagged_remaining != 0:
        reasons.append(f"untagged_remaining={report.untagged_remaining} != 0")
    if report.unmapped:
        reasons.append(f"unmapped: {len(report.unmapped)} question(s) — {report.unmapped}")
    if report.ambiguous:
        reasons.append(f"ambiguous: {len(report.ambiguous)} resolution(s)")
    if report.fixture_unmatched:
        reasons.append(
            f"fixture_unmatched: {len(report.fixture_unmatched)} key(s) — "
            f"{report.fixture_unmatched}"
        )
    return (not reasons, reasons)


def _format_report(
    report: TaggingReport,
    guard_ok: bool,
    guard_reasons: list[str],
    mode: str,
) -> str:
    """Human-readable report text: bank_version/date, totals, all 4
    provenance-class counts, per_topic_totals, the verify-gate verdict, and
    (only when non-empty) the actual unmapped/ambiguous/fixture_unmatched
    rows — including their ``el`` where the report tracks it (ambiguous
    rows carry ``el`` directly; fixture_unmatched keys ARE the normalized
    ``el`` text; unmapped rows only carry a question id — public exam
    content, never PII, safe to print/log per CLAUDE.md rule 3).
    """
    lines = [
        f"=== Culture topic tagging report ({mode}) ===",
        f"bank_version: {report.bank_version}",
        f"bank_date: {report.bank_date}",
        f"total_questions: {report.total_questions}",
        f"total_tagged: {report.total_tagged}",
        f"untagged_remaining: {report.untagged_remaining}",
        "",
        "-- provenance (sums to total_tagged) --",
        f"assigned_by_deck: {report.assigned_by_deck}",
        f"inherited_by_twin: {report.inherited_by_twin}",
        f"genuine_culture_default: {report.genuine_culture_default}",
        f"judgment_fixture: {len(report.judgment_fixture)} entries",
        "",
        "-- per_topic_totals --",
        f"{report.per_topic_totals}",
        "",
        f"verify gate: {'PASS' if guard_ok else 'FAIL'}",
    ]
    if guard_reasons:
        lines.append("guard reasons:")
        for reason in guard_reasons:
            lines.append(f"  - {reason}")

    if report.unmapped:
        lines.append("")
        lines.append(f"unmapped ({len(report.unmapped)}) — question id only, no el tracked:")
        for question_id in report.unmapped:
            lines.append(f"  - {question_id}")

    if report.ambiguous:
        lines.append("")
        lines.append(f"ambiguous ({len(report.ambiguous)}):")
        for row in report.ambiguous:
            candidates = ", ".join(sorted(c.value for c in row.candidates))
            lines.append(f"  - {row.question_id} el={row.el!r} candidates=[{candidates}]")

    if report.fixture_unmatched:
        lines.append("")
        lines.append(f"fixture_unmatched ({len(report.fixture_unmatched)}) — unmatched el keys:")
        for key in report.fixture_unmatched:
            lines.append(f"  - {key!r}")

    return "\n".join(lines)


def _report_to_json_dict(
    report: TaggingReport,
    guard_ok: bool,
    guard_reasons: list[str],
    mode: str,
) -> dict[str, object]:
    """Explicit JSON-serializable dict for the run-summary artifact.

    Built field-by-field (UUID -> str, CultureTopic -> str via its own
    ``.value``, ``frozenset[CultureTopic]`` -> sorted list of str) rather
    than ``json.dumps(..., default=str)``, which would render
    ``ambiguous[].candidates`` as an unreadable frozenset repr.
    """
    return {
        "mode": mode,
        "guard_passed": guard_ok,
        "guard_reasons": list(guard_reasons),
        "bank_version": report.bank_version,
        "bank_date": report.bank_date,
        "total_questions": report.total_questions,
        "total_tagged": report.total_tagged,
        "untagged_remaining": report.untagged_remaining,
        "assigned_by_deck": dict(report.assigned_by_deck),
        "inherited_by_twin": report.inherited_by_twin,
        "genuine_culture_default": report.genuine_culture_default,
        "judgment_fixture": [
            {
                "question_id": str(row.question_id),
                "el": row.el,
                "topic": row.topic.value,
                "rationale": row.rationale,
            }
            for row in report.judgment_fixture
        ],
        "fixture_unmatched": list(report.fixture_unmatched),
        "ambiguous": [
            {
                "question_id": str(row.question_id),
                "el": row.el,
                "candidates": sorted(candidate.value for candidate in row.candidates),
            }
            for row in report.ambiguous
        ],
        "unmapped": list(report.unmapped),
        "per_topic_totals": dict(report.per_topic_totals),
        "dry_run": report.dry_run,
    }


async def run_tagging(
    session: AsyncSession,
    *,
    commit: bool,
    expected_count: int = CULTURE_BANK_QUESTION_COUNT,
    reviewed_fixture: dict[str, ReviewedTopic] = RESIDUE_TOPIC_FIXTURE,
    report_path: Path = _REPORT_PATH,
) -> tuple[TaggingReport, str, int]:
    """Injectable, DB-session-testable core of the backfill CLI.

    Always probes via ``tag_culture_questions(session, dry_run=True)`` first
    (a SELECT-only pass, no writes) and evaluates the 490-verify guard
    (``_verify_gate``) on that probe report:

      - ``commit=False`` (dry-run): never writes, regardless of guard
        verdict — the probe report + guard verdict are printed/serialized
        and returned, exit_code=0.
      - ``commit=True`` and the guard FAILS: refuses to write — the engine
        is never called with ``dry_run=False``. Probe report + FAIL verdict
        + reasons are printed/serialized and returned, exit_code=1.
      - ``commit=True`` and the guard PASSES: calls
        ``tag_culture_questions(session, dry_run=False)`` for real — the
        ONLY call that writes+commits (via the engine's own
        ``await db.commit()``). Post-write report is printed/serialized and
        returned, exit_code=0.

    Also writes the JSON run-summary artifact to ``report_path`` on every
    call, regardless of mode.

    Returns (report, formatted_text, exit_code).
    """
    probe_report = await tag_culture_questions(
        session, reviewed_fixture=reviewed_fixture, dry_run=True
    )
    guard_ok, guard_reasons = _verify_gate(probe_report, expected_count)

    if not commit:
        mode = "dry-run"
        final_report = probe_report
        exit_code = 0
    elif not guard_ok:
        mode = "refused"
        final_report = probe_report
        exit_code = 1
    else:
        mode = "commit"
        final_report = await tag_culture_questions(
            session, reviewed_fixture=reviewed_fixture, dry_run=False
        )
        exit_code = 0

    text = _format_report(final_report, guard_ok, guard_reasons, mode)

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(
            _report_to_json_dict(final_report, guard_ok, guard_reasons, mode),
            indent=2,
            ensure_ascii=False,
        )
    )

    return final_report, text, exit_code


def _build_parser() -> argparse.ArgumentParser:
    """Real (not stubbed): argparse wiring is pure, no DB/business logic.

    ``--dry-run`` uses ``BooleanOptionalAction`` with ``default=True`` — a
    deliberate SAFE-DEFAULT deviation from this repo's two S3 backfill
    script precedents (which default to live). See the architect Stage-1
    patch ("flag default DEVIATION JUSTIFICATION") for the full rationale:
    this CLI writes live user-facing exam content, not S3 object metadata.
    """
    parser = argparse.ArgumentParser(
        description=(
            "Back-fill the `topic` column on culture_questions via the WEDGE-02 "
            "two-pass tagging engine. Defaults to a DRY RUN — pass --no-dry-run "
            "to commit."
        )
    )
    parser.add_argument(
        "--dry-run",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Compute and print the report without writing (default: True). "
        "Pass --no-dry-run to commit the tagging pass.",
    )
    return parser


async def _main_async(*, commit: bool) -> int:
    """Thin shell: init_db(warm_min=0) -> run_tagging -> close_db(), print
    the report text, return the exit code. Mirrors src/scheduler_main.py's
    init_db/close_db-in-finally shell pattern. Not separately DB-tested —
    see architect Stage-1 patch note (no branching logic beyond run_tagging
    + argparse, already covered elsewhere).
    """
    await init_db(warm_min=0)
    try:
        session_factory = get_session_factory()
        async with session_factory() as session:
            _, text, exit_code = await run_tagging(session, commit=commit)
    finally:
        await close_db()

    print(text)
    return exit_code


def main() -> None:
    """CLI entrypoint: parse args, run the async shell, exit with its code."""
    import asyncio
    import sys

    args = _build_parser().parse_args()
    sys.exit(asyncio.run(_main_async(commit=not args.dry_run)))


if __name__ == "__main__":
    main()
