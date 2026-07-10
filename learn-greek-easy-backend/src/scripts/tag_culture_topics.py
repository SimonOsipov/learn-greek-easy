"""Idempotent prod backfill CLI for the culture-question topic bank (WEDGE-02-05).

STUB (Mode A / RALPH Phase 1 Stage 2.5): this module lays down the CLI's
public surface — signatures, the safe-default argparse wiring, and the
result dataclass shape — so the AC-derived tests in
``tests/unit/scripts/test_tag_culture_topics.py`` and
``tests/integration/scripts/test_tag_culture_topics.py`` can import real
symbols and fail on ``NotImplementedError`` (RED), not ``ImportError``.
Logic-bearing functions (``run_tagging``, ``_verify_gate``,
``_format_report``, ``_main_async``) are intentionally unimplemented here.
The full post-merge, user-authorized prod ops runbook (D-A9/D-A10) lands
with the real implementation in Stage 3, alongside
``docs/wedge-02-topic-backfill.md``.

Entrypoint (once implemented):
    poetry run python -m src.scripts.tag_culture_topics [--dry-run | --no-dry-run]

Safe default: bare invocation (no flags) is a DRY RUN — writing the live
``culture_questions.topic`` column requires the explicit ``--no-dry-run``
flag (D-A9/D-A10: this CLI is never invoked against prod during /ralph
execution; a human operator runs it post-merge).
"""

from __future__ import annotations

import argparse
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.culture_bank_version import CULTURE_BANK_QUESTION_COUNT
from src.core.culture_topic_reviewed_fixture import RESIDUE_TOPIC_FIXTURE, ReviewedTopic
from src.services.culture_topic_tagger import TaggingReport

# Run-summary JSON artifact, written beside this script. Overwritten every
# run. Not gitignored — an operator may `git add` it after the real
# authorized prod commit run as a durable audit trail.
_REPORT_PATH = Path(__file__).parent / "tag_culture_topics_report.json"


def _verify_gate(report: TaggingReport, expected_count: int) -> tuple[bool, list[str]]:
    """490-verify guard (D-A10). See architect Stage-1 patch for the exact
    per-condition reason strings this must emit once implemented.

    Returns (guard_ok, reasons) — reasons is empty iff guard_ok is True.
    """
    raise NotImplementedError


def _format_report(
    report: TaggingReport,
    guard_ok: bool,
    guard_reasons: list[str],
    mode: str,
) -> str:
    """Human-readable report text: bank_version/date, totals, all 4
    provenance-class counts, per_topic_totals, and (only when non-empty)
    the actual unmapped/ambiguous/fixture_unmatched rows.
    """
    raise NotImplementedError


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
    and evaluates the 490-verify guard on the probe report. ``commit=False``
    never writes regardless of guard verdict. ``commit=True`` only proceeds
    to a real (``dry_run=False``) write+commit when the guard passes; a
    failed guard refuses the write and returns exit_code=1. Also writes the
    JSON run-summary artifact to ``report_path``.

    Returns (report, formatted_text, exit_code).
    """
    raise NotImplementedError


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
    raise NotImplementedError


def main() -> None:
    """CLI entrypoint: parse args, run the async shell, exit with its code."""
    import asyncio
    import sys

    args = _build_parser().parse_args()
    sys.exit(asyncio.run(_main_async(commit=not args.dry_run)))


if __name__ == "__main__":
    main()
