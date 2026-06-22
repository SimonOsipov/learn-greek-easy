"""LEXGEN-11-02 — Ensemble-judge service (Stage 5 of the LEXGEN pipeline).

Two independent LLM judges score a SCORED proposal's generated content against
the five-dimension :class:`JudgeRubric`. Their rubrics are diffed for
disagreement, the union of their concerns is appended to ``flagged_fields``, the
per-judge detail is persisted to ``judge_scores`` JSONB, and the proposal is
routed SCORED → NEEDS_REVIEW.

Cardinal invariants (Decision Record §1/§3):
    - The judge reads/criticizes ONLY the four generated content fields. It NEVER
      writes ``generated_fields`` / ``reconciliation_log`` (LEXGEN-08-owned) or
      morphology of any kind — it has no authority over those.
    - There is NO aggregate / overall / numeric trust score anywhere: the five
      rubric dimensions are the only numeric surface and ``trust_score`` stays
      NULL. The ``auto_approved`` edge exists in the state machine (LEXGEN-01) but
      is GATED OFF / never taken in v1 — the auto-approval threshold is the OUTPUT
      of a future calibration (Decision Record §3), so v1 routing is binary:
      every judged proposal goes to NEEDS_REVIEW.
    - ``transition(proposal, NEEDS_REVIEW)`` is the ONLY status mutation; an
      illegal entry state (non-SCORED) surfaces as ``IllegalProposalTransition``,
      it is NOT swallowed.

Degraded path: a single judge failing (≤3 invalid JSON responses, or its
OpenRouter call raising) is recorded as an ``errored`` :class:`JudgeResult` and
does NOT abort the whole ``judge()`` — the surviving judge's concerns are still
applied. An errored judge means agreement cannot be confirmed, so the outcome is
treated as ``disagreed=True`` (with no dimension names, since there is nothing to
diff against).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Literal, cast

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.logging import get_logger
from src.core.word_proposal_state import transition
from src.db.models import WordProposal, WordProposalState
from src.schemas.lexgen import (
    JUDGE_RUBRIC_DIMENSIONS,
    EvidencePacket,
    GeneratedLexContent,
    JudgeRubric,
)
from src.services.openrouter_service import OpenRouterService, get_openrouter_service

logger = get_logger(__name__)

# Per-call disagreement threshold: two judges disagree on a dimension when their
# integer scores differ by 2 or more on the 1–5 scale (D1, branch (a)).
_DIMENSION_DELTA_THRESHOLD = 2

_SYSTEM_PROMPT = """You are an expert evaluator of Greek-language learning content for
beginner (A1–A2) students. You are given a Greek lemma's generated learning content and
the supporting evidence it was built from. Score the content on five dimensions and
raise blocking issues where warranted.

You evaluate ONLY the four content fields (gloss_en, gloss_ru, example_greek,
example_translation). You have NO authority over morphology (gender, case, declension,
IPA) — do not comment on those.

Score each of these five dimensions as an INTEGER from 1 (worst) to 5 (best):
  - naturalness:            Is example_greek natural, idiomatic Modern Greek?
  - sense_fit:              Do the glosses match the lemma's actual meaning given the evidence?
  - translation_faith_en:  Does example_translation faithfully render example_greek into English?
  - translation_faith_ru:  Does gloss_ru faithfully render the meaning into Russian?
  - a2_appropriateness:    Is the content appropriate for an A1–A2 learner (vocabulary, length)?

A blocking issue names exactly ONE of the four content fields and a short reason. Only
raise a blocking issue for a genuine, must-fix problem. Use an EMPTY list when there is none.

Your response MUST be a JSON object with EXACTLY these keys and no others:
{
  "naturalness": <1-5>,
  "sense_fit": <1-5>,
  "translation_faith_en": <1-5>,
  "translation_faith_ru": <1-5>,
  "a2_appropriateness": <1-5>,
  "blocking_issues": [
    {"field": "<gloss_en|gloss_ru|example_greek|example_translation>", "issue": "<short reason>"}
  ]
}"""


def _build_messages(
    content: GeneratedLexContent,
    packet: EvidencePacket,
    *,
    prior_error: str | None = None,
) -> list[dict[str, str]]:
    """Construct the system + user messages for one judge call.

    ``content`` is the generated content under review; ``packet`` is the evidence
    it was built from (read-only context for the judge). ``prior_error`` is echoed
    into the user message on retry attempts so the judge can self-correct an
    invalid prior response (mirrors the generator's retry-echo pattern, D5).
    """
    lines: list[str] = [
        f"Lemma: {packet.normalized_lemma}",
        f"POS: {packet.pos}",
    ]

    wikt = packet.sources.wiktionary
    if wikt.present and wikt.glosses_en:
        lines.append(f"Wiktionary gloss candidates (evidence): {wikt.glosses_en}")

    freq = packet.sources.frequency
    if freq.present and freq.band:
        lines.append(f"Frequency band: {freq.band} (rank {freq.rank})")

    lines.append("\nGenerated content under review:")
    lines.append(f"  gloss_en: {content.gloss_en}")
    lines.append(f"  gloss_ru: {content.gloss_ru}")
    lines.append(f"  example_greek: {content.example_greek}")
    lines.append(f"  example_translation: {content.example_translation}")

    if prior_error is not None:
        lines.append(
            "\n\nPREVIOUS ATTEMPT FAILED — your last response was rejected with this error:\n"
            f"  {prior_error}\n"
            "Please correct the problem and return valid JSON with exactly the required keys."
        )

    return [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": "\n".join(lines)},
    ]


@dataclass
class JudgeResult:
    """The outcome of a single judge (one model slug).

    ``status`` is ``"ok"`` when the judge returned a valid rubric within the
    retry budget, ``"errored"`` when it exhausted its attempts on invalid JSON or
    its OpenRouter call raised. ``rubric`` is the validated rubric on success and
    ``None`` on error; ``error`` carries the failure reason on error and ``None``
    on success.
    """

    model: str
    rubric: JudgeRubric | None
    status: Literal["ok", "errored"]
    error: str | None


@dataclass
class JudgeOutcome:
    """The aggregate result of ``LexgenJudgeService.judge()``.

    Attributes:
        judges:                 One :class:`JudgeResult` per configured slug (two).
        disagreed:              True when the judges disagree on any dimension
                                (delta ≥2), their blocking-issue field sets differ,
                                OR a judge errored (agreement cannot be confirmed).
        disagreeing_dimensions: Dimension names with a per-dimension delta ≥2
                                (branch (a) only); ``[]`` when disagreement comes
                                solely from a blocking-set mismatch or an errored
                                judge.
        flagged:               The full ``flagged_fields`` list after the
                                append-merge (mirrors ``proposal.flagged_fields``).
        routed_to:             The state the proposal was routed to (always
                                NEEDS_REVIEW in v1 — binary routing).
    """

    judges: list[JudgeResult]
    disagreed: bool
    disagreeing_dimensions: list[str]
    flagged: list[str]
    routed_to: WordProposalState


class LexgenJudgeService:
    """Ensemble judge for the LEXGEN word-proposal pipeline (Stage 5).

    Per-request (NOT a singleton): instantiated with an injected ``db`` session
    and ``openrouter`` service, mirroring ``LexgenGeneratorService`` /
    ``LexgenVerifyService``.

    The judge reads/criticizes ONLY the four generated content fields. It NEVER
    writes ``generated_fields`` / ``reconciliation_log`` / morphology, and never
    reads or writes ``trust_score`` (INERT in v1). The single status mutation is
    ``transition(proposal, NEEDS_REVIEW)``.
    """

    def __init__(self, db: AsyncSession, openrouter: OpenRouterService) -> None:
        self.db = db
        self.openrouter = openrouter

    async def judge(self, proposal: WordProposal) -> JudgeOutcome:
        """Run the two-judge ensemble over a SCORED proposal and route it.

        Reads ``generated_content`` (asserts it is present — a SCORED proposal
        always has it; fails loud like the verify service) and ``evidence_packet``
        from JSONB, runs one judge per ``settings.lexgen_judge_models`` slug,
        computes disagreement, append-merges the union of concerns into
        ``flagged_fields``, persists ``judge_scores``, transitions
        SCORED → NEEDS_REVIEW, flushes once, and returns the :class:`JudgeOutcome`.

        ``IllegalProposalTransition`` (non-SCORED entry) propagates — it is NOT
        swallowed. A single judge failing is recorded as ``errored`` and does NOT
        abort the whole call (degraded path).
        """
        # A scored proposal always has generated content. Fail loud, before any
        # LLM call, if it is missing (mirrors LexgenVerifyService).
        assert proposal.generated_content is not None  # noqa: S101

        content = GeneratedLexContent.model_validate(proposal.generated_content)
        packet = EvidencePacket.model_validate(proposal.evidence_packet)

        # Run each configured judge sequentially (exactly two slugs in v1).
        # NOTE (LEXGEN-11-03): the three ``settings.lexgen_judge_*`` reads in this
        # service go through ``getattr`` + ``cast`` because those fields are added
        # to config.py only in LEXGEN-11-03 (the FINAL subtask) — a direct dotted
        # read would trip mypy's ``attr-defined`` until then. Once the fields land,
        # simplify these to plain ``settings.lexgen_judge_models`` etc.
        judge_models = cast(list[str], getattr(settings, "lexgen_judge_models"))
        judges: list[JudgeResult] = [
            await self._run_one_judge(slug, content, packet) for slug in judge_models
        ]
        rubric_a = judges[0].rubric if judges else None
        rubric_b = judges[1].rubric if len(judges) > 1 else None

        # Disagreement (D1).
        disagreed, disagreeing_dimensions = self._determine_disagreement(rubric_a, rubric_b)

        # Append-merge the union of concerns into flagged_fields (reassign, de-dupe).
        flagged = self._merge_flagged(proposal, judges, disagreeing_dimensions)

        # Persist per-judge detail — NO aggregate/overall/score/trust_score key.
        proposal.judge_scores = {
            "schema_version": "lexgen.judge.v1",
            "judges": [self._judge_entry(r) for r in judges],
            "disagreement": {
                "disagreed": disagreed,
                "dimensions": disagreeing_dimensions,
                "rule": "per_dimension_delta>=2 OR blocking_issue_field_mismatch",
            },
        }

        # Binary routing — the ONLY status mutation. The auto_approved edge exists
        # (LEXGEN-01) but is GATED OFF / never taken in v1: the auto-approval
        # threshold is the output of calibration (Decision Record §3). Never read
        # or write trust_score. IllegalProposalTransition propagates for a
        # non-SCORED entry state (not swallowed).
        transition(proposal, WordProposalState.NEEDS_REVIEW)

        await self.db.flush()

        return JudgeOutcome(
            judges=judges,
            disagreed=disagreed,
            disagreeing_dimensions=disagreeing_dimensions,
            flagged=flagged,
            routed_to=WordProposalState.NEEDS_REVIEW,
        )

    async def _run_one_judge(
        self,
        model: str,
        content: GeneratedLexContent,
        packet: EvidencePacket,
    ) -> JudgeResult:
        """Score the content with a single judge model (≤N-attempt retry loop).

        Returns ``JudgeResult(status="ok", rubric=...)`` on a valid rubric within
        ``settings.lexgen_judge_max_attempts``. Returns
        ``JudgeResult(status="errored", rubric=None, error=...)`` when the budget
        is exhausted on invalid JSON OR when an OpenRouter call raises — a single
        judge failure NEVER raises out of ``judge()`` (degraded path).
        """
        # getattr+cast: field added in LEXGEN-11-03 (see judge() note).
        max_attempts = cast(int, getattr(settings, "lexgen_judge_max_attempts"))
        max_tokens = cast(int, getattr(settings, "lexgen_judge_max_tokens"))
        last_error: str | None = None

        for attempt in range(1, max_attempts + 1):
            messages = _build_messages(content, packet, prior_error=last_error)
            try:
                resp = await self.openrouter.complete(
                    messages=messages,
                    model=model,
                    response_format={"type": "json_object"},
                    temperature=0.0,
                    max_tokens=max_tokens,
                    reasoning={"type": "disabled"},
                )
            except (
                Exception
            ) as exc:  # noqa: BLE001 — degraded path: any call failure errors this judge
                last_error = f"openrouter_call_failed: {exc}"
                logger.warning(
                    "LexgenJudgeService: judge %s call failed on attempt %d/%d — %s",
                    model,
                    attempt,
                    max_attempts,
                    str(exc)[:200],
                )
                continue

            try:
                rubric = JudgeRubric.model_validate(json.loads(resp.content))
            except (json.JSONDecodeError, ValidationError) as exc:
                last_error = str(exc)
                logger.warning(
                    "LexgenJudgeService: judge %s invalid response on attempt %d/%d — %s",
                    model,
                    attempt,
                    max_attempts,
                    last_error[:200],
                )
                continue

            return JudgeResult(model=model, rubric=rubric, status="ok", error=None)

        return JudgeResult(model=model, rubric=None, status="errored", error=last_error)

    @staticmethod
    def _determine_disagreement(
        rubric_a: JudgeRubric | None,
        rubric_b: JudgeRubric | None,
    ) -> tuple[bool, list[str]]:
        """Compute (disagreed, disagreeing_dimensions) from two judges' rubrics (D1).

        - branch (a): a dimension with a per-dimension delta ≥2 is a disagreeing
          dimension.
        - branch (b): the SET of blocking-issue fields differing between the two
          judges signals disagreement but contributes NO dimension name.
        - DEGRADED: if either rubric is None (an errored judge), agreement cannot
          be confirmed → disagreed=True with disagreeing_dimensions=[].

        ``disagreed`` is True when any dimension disagrees, branch (b) fires, or a
        rubric is missing. ``disagreeing_dimensions`` is the branch-(a) list only
        (``[]`` when only branch (b) or the degraded path fired).
        """
        if rubric_a is None or rubric_b is None:
            # Cannot confirm agreement against a missing rubric.
            return True, []

        disagreeing_dimensions = [
            dim
            for dim in JUDGE_RUBRIC_DIMENSIONS
            if abs(getattr(rubric_a, dim) - getattr(rubric_b, dim)) >= _DIMENSION_DELTA_THRESHOLD
        ]

        blocking_fields_a = {bi.field for bi in rubric_a.blocking_issues}
        blocking_fields_b = {bi.field for bi in rubric_b.blocking_issues}
        branch_b_fired = blocking_fields_a != blocking_fields_b

        disagreed = bool(disagreeing_dimensions) or branch_b_fired
        return disagreed, disagreeing_dimensions

    @staticmethod
    def _merge_flagged(
        proposal: WordProposal,
        judges: list[JudgeResult],
        disagreeing_dimensions: list[str],
    ) -> list[str]:
        """Append-merge concerns into ``proposal.flagged_fields`` (reassign, de-dupe).

        The new flags are the union of the disagreeing dimension names and every
        blocking-issue ``field`` from BOTH judges' rubrics (a None rubric from an
        errored judge is skipped). Pre-existing flags are preserved and order is
        stable; duplicates are not added. Reassigns the list (does not mutate in
        place) so SQLAlchemy JSONB change detection fires. Returns the full list.
        """
        new_flags: list[str] = list(disagreeing_dimensions)
        for result in judges:
            if result.rubric is None:
                continue
            new_flags.extend(bi.field for bi in result.rubric.blocking_issues)

        existing = list(proposal.flagged_fields) if proposal.flagged_fields else []
        merged = list(existing)
        for flag in new_flags:
            if flag not in merged:
                merged.append(flag)

        proposal.flagged_fields = merged
        return merged

    @staticmethod
    def _judge_entry(result: JudgeResult) -> dict:
        """Serialize one :class:`JudgeResult` for the ``judge_scores`` JSONB.

        Always carries ``model``, ``status``, and ``rubric`` (the rubric's
        ``model_dump()`` or ``None``). The ``error`` key is included only for an
        errored judge. Deliberately emits NO aggregate/overall/score key.
        """
        entry: dict = {
            "model": result.model,
            "status": result.status,
            "rubric": result.rubric.model_dump() if result.rubric is not None else None,
        }
        if result.status == "errored":
            entry["error"] = result.error
        return entry


def get_lexgen_judge_service(db: AsyncSession) -> LexgenJudgeService:
    """Factory: return a per-request LexgenJudgeService with the singleton OpenRouter.

    Mirrors ``get_lexgen_generator_service(db)`` / ``get_lexgen_verify_service(db)``.
    """
    return LexgenJudgeService(db, get_openrouter_service())
