"""Two-pass topic-tagging engine + review record (WEDGE-02-01).

Public surface:
  TaggingReport        — the review record ("sign-off"), returned by every run
  JudgmentRow           — one structured judgment_fixture entry
  AmbiguousResolution   — one structured ambiguous entry
  tag_culture_questions(db, *, reviewed_fixture=RESIDUE_TOPIC_FIXTURE,
                         dry_run=False) -> TaggingReport

STAGE 2.5 SCAFFOLD: ``TaggingReport`` / ``JudgmentRow`` / ``AmbiguousResolution``
are fully-defined data containers (pure structure, no logic — they ARE the
tests' assertion contract). ``tag_culture_questions`` is a signature-only stub
that ``raise NotImplementedError``; the executor implements the real two-pass
engine in Stage 3.

See the WEDGE-02 story System Design ("Tagging algorithm" + "Review record")
for the exact contract:

  - Bulk-load all in-scope questions with their deck category via a LEFT
    OUTER JOIN on CultureDeck (NOT the INNER JOIN reused from
    ``_get_question_with_deck_category`` — an INNER JOIN would silently drop
    every ``deck_id IS NULL`` row, per the architect's Gap-1 correction).
  - Pass 1 (category != 'culture'): resolve_topic_for_category(category)
    inside a try/except — success tallies assigned_by_deck[category];
    ValueError (including the deck_id IS NULL / category is None case)
    routes to unmapped.
  - Pass 2 (category == 'culture'), in this exact order: (1) normalized el in
    reviewed_fixture -> fixture topic wins, tally judgment_fixture; (2) else
    exactly one clean distinct thematic twin -> inherit, tally
    inherited_by_twin; multiple distinct-topic twins -> culture + record in
    ambiguous; (3) else -> culture, tally genuine_culture_default.
  - Any reviewed_fixture key matching no row -> fixture_unmatched (surfaced,
    not dropped).
  - Idempotency: recompute + UPDATE unconditionally every run (never a
    ``WHERE topic IS NULL`` guard); skip the UPDATE only when dry_run=True.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import NamedTuple
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.culture_topic import CultureTopic
from src.core.culture_topic_reviewed_fixture import RESIDUE_TOPIC_FIXTURE, ReviewedTopic


class JudgmentRow(NamedTuple):
    """One Pass-2 fixture-precedence resolution (report.judgment_fixture entry)."""

    question_id: UUID
    el: str
    topic: CultureTopic
    rationale: str


class AmbiguousResolution(NamedTuple):
    """One defensive multi-topic-twin resolution (report.ambiguous entry)."""

    question_id: UUID
    el: str
    candidates: frozenset[CultureTopic]


@dataclass
class TaggingReport:
    """The automated review record ("sign-off") returned by every tagging run.

    Four provenance classes (assigned_by_deck + inherited_by_twin +
    genuine_culture_default + len(judgment_fixture)) must sum to
    total_tagged. fixture_unmatched / ambiguous / unmapped are guards,
    surfaced (not dropped) even though they are 0 in prod.
    """

    bank_version: str
    bank_date: str
    total_questions: int
    total_tagged: int
    untagged_remaining: int
    # --- four provenance classes (sum == total_tagged) ---
    assigned_by_deck: dict[str, int]
    inherited_by_twin: int
    genuine_culture_default: int
    judgment_fixture: list[JudgmentRow]
    # --- guards (0 in prod, surfaced not dropped) ---
    fixture_unmatched: list[str]
    ambiguous: list[AmbiguousResolution]
    unmapped: list[str]
    per_topic_totals: dict[str, int]
    dry_run: bool


async def tag_culture_questions(
    db: AsyncSession,
    *,
    reviewed_fixture: dict[str, ReviewedTopic] = RESIDUE_TOPIC_FIXTURE,
    dry_run: bool = False,
) -> TaggingReport:
    """Two-pass topic-tagging engine.

    Stub (WEDGE-02-01 Stage 2.5) — implemented in Stage 3.
    """
    raise NotImplementedError("tag_culture_questions is not implemented yet (WEDGE-02-01 Stage 3).")
