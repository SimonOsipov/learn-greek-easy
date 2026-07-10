"""Two-pass topic-tagging engine + review record (WEDGE-02-01).

Public surface:
  TaggingReport        — the review record ("sign-off"), returned by every run
  JudgmentRow           — one structured judgment_fixture entry
  AmbiguousResolution   — one structured ambiguous entry
  tag_culture_questions(db, *, reviewed_fixture=RESIDUE_TOPIC_FIXTURE,
                         dry_run=False) -> TaggingReport

See the WEDGE-02 story System Design ("Tagging algorithm" + "Review record")
for the exact contract:

  - Bulk-load all in-scope questions with their deck category via a LEFT
    OUTER JOIN on CultureDeck (NOT the INNER JOIN reused from
    ``_get_question_with_deck_category`` — an INNER JOIN would silently drop
    every ``deck_id IS NULL`` row, per the architect's Gap-1 correction).
  - Dispatch (Gap-2 resolved rule): category == 'culture' -> Pass 2. Every
    other row (including deck_id IS NULL, i.e. category is None) ->
    resolve_topic_for_category(category) inside a try/except — success
    tallies assigned_by_deck[category] (Pass 1); ValueError (or a None
    category, guarded explicitly since passing None is a type violation, not
    a recoverable ValueError) routes to unmapped.
  - Pass 2 (category == 'culture'), in this exact order: (1) normalized el in
    reviewed_fixture -> fixture topic wins, tally judgment_fixture; (2) else
    exactly one distinct topic among Pass-1 rows sharing the same normalized
    el ("twin") -> inherit, tally inherited_by_twin; multiple distinct-topic
    twins -> culture + record in ambiguous (still tallied under
    genuine_culture_default — see System Design "Tagging algorithm" step 3);
    (3) else -> culture, tally genuine_culture_default.
  - Any reviewed_fixture key that matches no in-scope row -> fixture_unmatched
    (surfaced, not dropped).
  - Idempotency (D-A5): recompute every row's target topic unconditionally
    every run (never a ``WHERE topic IS NULL`` guard) and UPDATE it; skip all
    writes/commit only when dry_run=True.
  - Writes ONLY CultureQuestion.topic — no other column/table is touched.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import NamedTuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.culture_bank_version import CULTURE_BANK_VERSION
from src.core.culture_topic import CultureTopic
from src.core.culture_topic_mapping import normalize_twin_key, resolve_topic_for_category
from src.core.culture_topic_reviewed_fixture import RESIDUE_TOPIC_FIXTURE, ReviewedTopic
from src.db.models import CultureDeck, CultureQuestion


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


_Assignment = tuple[CultureQuestion, CultureTopic]
_Row = tuple[CultureQuestion, "str | None"]


def _resolve_pass1_topic(category: str | None) -> CultureTopic | None:
    """Resolve a non-culture row's topic, or None if it belongs in `unmapped`.

    A None category (deck_id IS NULL) is a type violation for
    ``resolve_topic_for_category`` — not a recoverable ValueError — so it's
    guarded explicitly rather than routed through the try/except.
    """
    if category is None:
        return None
    try:
        return resolve_topic_for_category(category)
    except ValueError:
        return None


def _run_pass1(
    rows: list[_Row],
) -> tuple[
    dict[str, int],
    list[str],
    list[_Assignment],
    dict[str, set[CultureTopic]],
    list[CultureQuestion],
]:
    """Pass 1: dispatch every non-culture row through ``resolve_topic_for_category``.

    Returns ``(assigned_by_deck, unmapped, pass1_assignments,
    twin_topics_by_key, culture_rows)`` — ``culture_rows`` (category ==
    'culture') are deferred to Pass 2. ``twin_topics_by_key`` indexes every
    Pass-1 assignment by normalized ``el`` for Pass 2's twin lookup.
    """
    assigned_by_deck: dict[str, int] = {}
    unmapped: list[str] = []
    pass1_assignments: list[_Assignment] = []
    twin_topics_by_key: dict[str, set[CultureTopic]] = {}
    culture_rows: list[CultureQuestion] = []

    for question, category in rows:
        if category == "culture":
            culture_rows.append(question)
            continue

        topic = _resolve_pass1_topic(category)
        if topic is None:
            unmapped.append(str(question.id))
            continue
        # _resolve_pass1_topic only returns non-None when category resolved
        # successfully, which requires category to not be None.
        assert category is not None

        assigned_by_deck[category] = assigned_by_deck.get(category, 0) + 1
        pass1_assignments.append((question, topic))
        if topic != CultureTopic.CULTURE:
            # Twin index is THEMATIC twins only (System Design: "a clean
            # distinct thematic twin"). traditions/news rows fold to CULTURE
            # in Pass 1 (D-A2) but carry no thematic signal of their own —
            # indexing them would let a coincidental traditions/news row
            # masquerade as an "inherited" twin (or manufacture false
            # {thematic, CULTURE} ambiguity against a real thematic twin) for
            # what Pass 2 would otherwise correctly resolve as its own
            # genuine_culture_default. 0 in prod either way (D-A2).
            key = normalize_twin_key(question.question_text)
            twin_topics_by_key.setdefault(key, set()).add(topic)

    return assigned_by_deck, unmapped, pass1_assignments, twin_topics_by_key, culture_rows


def _run_pass2(
    culture_rows: list[CultureQuestion],
    twin_topics_by_key: dict[str, set[CultureTopic]],
    reviewed_fixture: dict[str, ReviewedTopic],
) -> tuple[
    int,
    int,
    list[JudgmentRow],
    list[AmbiguousResolution],
    list[_Assignment],
    set[str],
]:
    """Pass 2 — fixture-precedence resolution for every category='culture' row,
    in the normative order: fixture > clean single twin > culture default.

    Returns ``(inherited_by_twin, genuine_culture_default, judgment_fixture,
    ambiguous, pass2_assignments, matched_fixture_keys)``.
    """
    inherited_by_twin = 0
    genuine_culture_default = 0
    judgment_fixture: list[JudgmentRow] = []
    ambiguous: list[AmbiguousResolution] = []
    matched_fixture_keys: set[str] = set()
    pass2_assignments: list[_Assignment] = []

    for question in culture_rows:
        el = question.question_text["el"]
        key = normalize_twin_key(question.question_text)

        if key in reviewed_fixture:
            reviewed = reviewed_fixture[key]
            matched_fixture_keys.add(key)
            judgment_fixture.append(
                JudgmentRow(
                    question_id=question.id,
                    el=el,
                    topic=reviewed.topic,
                    rationale=reviewed.rationale,
                )
            )
            pass2_assignments.append((question, reviewed.topic))
            continue

        twin_topics = twin_topics_by_key.get(key, set())
        if len(twin_topics) == 1:
            topic = next(iter(twin_topics))
            inherited_by_twin += 1
            pass2_assignments.append((question, topic))
            continue

        # No clean single twin: either no twin at all, or a multi-topic twin
        # (defensive — 0 in prod). Both default to culture; a multi-topic
        # twin is additionally flagged in `ambiguous`.
        genuine_culture_default += 1
        pass2_assignments.append((question, CultureTopic.CULTURE))
        if len(twin_topics) > 1:
            ambiguous.append(
                AmbiguousResolution(
                    question_id=question.id, el=el, candidates=frozenset(twin_topics)
                )
            )

    return (
        inherited_by_twin,
        genuine_culture_default,
        judgment_fixture,
        ambiguous,
        pass2_assignments,
        matched_fixture_keys,
    )


async def tag_culture_questions(
    db: AsyncSession,
    *,
    reviewed_fixture: dict[str, ReviewedTopic] = RESIDUE_TOPIC_FIXTURE,
    dry_run: bool = False,
) -> TaggingReport:
    """Two-pass topic-tagging engine. See module docstring for the algorithm."""
    # Bulk-load every in-scope question with its deck category via a LEFT
    # OUTER JOIN (Gap-1): deck_id IS NULL rows must be retained (category is
    # then None), not silently dropped the way an INNER JOIN would drop them.
    query = select(CultureQuestion, CultureDeck.category).join(
        CultureDeck, CultureQuestion.deck_id == CultureDeck.id, isouter=True
    )
    result = await db.execute(query)
    # SQLAlchemy infers CultureDeck.category as `str` from the column's own
    # (non-nullable) Mapped type, but the isouter=True join can and does
    # yield None for deckless rows at runtime — re-list into the honestly
    # `str | None`-typed alias the two passes below expect.
    rows: list[_Row] = [(question, category) for question, category in result.all()]

    assigned_by_deck, unmapped, pass1_assignments, twin_topics_by_key, culture_rows = _run_pass1(
        rows
    )
    (
        inherited_by_twin,
        genuine_culture_default,
        judgment_fixture,
        ambiguous,
        pass2_assignments,
        matched_fixture_keys,
    ) = _run_pass2(culture_rows, twin_topics_by_key, reviewed_fixture)

    fixture_unmatched = [key for key in reviewed_fixture if key not in matched_fixture_keys]

    # Assemble per-topic totals across both passes before touching the DB, so
    # dry_run reports the WOULD-be assignment without ever writing.
    all_assignments = pass1_assignments + pass2_assignments
    per_topic_totals: dict[str, int] = {}
    for _, topic in all_assignments:
        per_topic_totals[topic.value] = per_topic_totals.get(topic.value, 0) + 1

    if not dry_run:
        for question, topic in all_assignments:
            question.topic = str(topic)
        await db.commit()

    total_questions = len(rows)
    total_tagged = len(all_assignments)

    return TaggingReport(
        # bank_version is the FROZEN CULTURE_BANK_VERSION constant (D-A7,
        # WEDGE-02-04). Deliberately NOT date.today() here: bank_version is a
        # stable identifier, not a per-run timestamp — see bank_date below
        # for the per-run timestamp.
        bank_version=CULTURE_BANK_VERSION,
        bank_date=date.today().isoformat(),
        total_questions=total_questions,
        total_tagged=total_tagged,
        untagged_remaining=total_questions - total_tagged,
        assigned_by_deck=assigned_by_deck,
        inherited_by_twin=inherited_by_twin,
        genuine_culture_default=genuine_culture_default,
        judgment_fixture=judgment_fixture,
        fixture_unmatched=fixture_unmatched,
        ambiguous=ambiguous,
        unmapped=unmapped,
        per_topic_totals=per_topic_totals,
        dry_run=dry_run,
    )
