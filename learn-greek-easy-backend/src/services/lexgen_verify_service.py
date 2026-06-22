"""LEXGEN-10-03 — Verify service: gate orchestration.

This module runs the three deterministic gates on a GENERATING proposal's
content (Check E, target-attested, gloss-subset) and records the outcome.

Public surface:
    LexgenVerifyService(db, openrouter) — constructor
    async verify(proposal) -> VerifyOutcome — runs all gates
    _on_hard_fail(proposal, failing_gates) — injectable seam (10-04 replaces body)
    VerifyOutcome — result dataclass
    get_lexgen_verify_service(db) — factory

SEAM CONTRACT (pinned by RED tests — executor MUST honour):
1.  LexgenVerifyService(db: AsyncSession, openrouter: OpenRouterService)
    Single canonical constructor (same signature for 10-03 AND 10-04).
2.  async def verify(self, proposal: WordProposal) -> VerifyOutcome
3.  def _on_hard_fail(self, proposal, failing_gates) — injectable seam for 10-04.
4.  VerifyOutcome.status: Literal["PASS", "FLAGGED", "REJECTED"]
    VerifyOutcome.gate_results: list[GateResult]
    VerifyOutcome.check_e_regens: int  (default 0)
    VerifyOutcome.flagged: list[str]
5.  get_lexgen_verify_service(db) -> LexgenVerifyService

Invariants:
    - NEVER calls transition() on the proposal.
    - NEVER writes generated_fields / reconciliation_log / judge_scores /
      trust_score.
    - proposal.status stays GENERATING after verify() returns.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.lexgen_verify import (
    GateResult,
    check_e,
    check_gloss_subset,
    check_target_attested,
    normalize_lemma,
)
from src.schemas.lexgen import EvidencePacket, GeneratedLexContent
from src.services.cefr_vocabulary_service import CefrVocabularyService
from src.services.lexicon_service import LexiconService
from src.services.morphology_service import get_morphology_service
from src.services.openrouter_service import OpenRouterService, get_openrouter_service

if TYPE_CHECKING:
    from src.db.models import WordProposal
    from src.schemas.nlp import SentenceToken

# Map gate name → the proposal field name recorded in flagged_fields.
# "gloss_subset" is the gate; "gloss_en" is the data field that is flagged.
_GATE_TO_FIELD: dict[str, str] = {"gloss_subset": "gloss_en"}


@dataclass
class VerifyOutcome:
    """Result of LexgenVerifyService.verify().

    Attributes:
        status:          "PASS" — all gates passed (or only warns).
                         "FLAGGED" — hard gate failed after _on_hard_fail
                                     (proposal stays GENERATING, flagged_fields
                                     updated, no transition called).
                         "REJECTED" — generator transitioned proposal to
                                      REJECTED during the regeneration loop
                                      (10-04); returned as-is.
        gate_results:    One GateResult per gate that was evaluated.
        check_e_regens:  Number of outer regenerations consumed by Check E
                         (0 in the 10-03 stub; up to 2 in the 10-04 loop).
        flagged:         Gate / field names appended to proposal.flagged_fields
                         by this call (mirrors what was written).
    """

    status: Literal["PASS", "FLAGGED", "REJECTED"]
    gate_results: list[GateResult] = field(default_factory=list)
    check_e_regens: int = 0
    flagged: list[str] = field(default_factory=list)


class LexgenVerifyService:
    """Verify-stage orchestrator for the LEXGEN word-proposal pipeline.

    Constructor (SINGLE canonical shape — carries openrouter so 10-04
    needs no change to build the generator for the regeneration loop):
        db:          AsyncSession — injected per-request SQLAlchemy async session.
        openrouter:  OpenRouterService — singleton injected via factory (unused
                     by the 10-03 body; first read by 10-04's _on_hard_fail body).

    SEAM: _on_hard_fail(proposal, failing_gates) is an overridable method so
    the 10-04 implementation replaces only the body of that method without
    touching the public verify() flow.

    Invariants:
        - NEVER calls transition() on the proposal.
        - NEVER writes generated_fields / reconciliation_log / judge_scores /
          trust_score — those belong to LEXGEN-08 and LEXGEN-11.
    """

    def __init__(self, db: AsyncSession, openrouter: OpenRouterService) -> None:
        self.db = db
        self.openrouter = openrouter

    async def verify(self, proposal: "WordProposal") -> VerifyOutcome:
        """Run all deterministic gates on the proposal's generated content.

        Rebuilds EvidencePacket from JSONB (no re-assembly of sources), lemmatizes
        the example sentence via spaCy, runs check_e/target_attested/gloss_subset,
        and records the outcome. proposal.status stays GENERATING; no transition().
        """
        # Step 1 — rebuild EvidencePacket from JSONB snapshot (no re-assembly)
        packet = EvidencePacket.model_validate(proposal.evidence_packet)
        normalized_target = normalize_lemma(packet.normalized_lemma)

        # Step 2 — read generated content
        content = GeneratedLexContent.model_validate(proposal.generated_content)

        # Steps 3–6 — lemmatize + per-token resolution + contraction split
        checked_sub_lemmas, all_sub_lemmas = await self._resolve_token_lemmas(content.example_greek)

        # Step 7 — build the allowed set (CEFR + closed-class + target)
        cefr_lemmas = await CefrVocabularyService(self.db).allowed_lemmas()
        allowed: set[str] = {normalize_lemma(lem) for lem in cefr_lemmas} | {normalized_target}

        # Step 8–10 — run the three pure gates
        gate_results = [
            check_e(checked_sub_lemmas, allowed, normalized_target),
            check_target_attested(all_sub_lemmas, normalized_target),
            check_gloss_subset(
                content.gloss_en,
                packet.sources.wiktionary.glosses_en if packet.sources.wiktionary else None,
            ),
        ]

        # Step 11 — aggregate into outcome
        return await self._build_outcome(proposal, gate_results)

    async def _resolve_token_lemmas(self, sentence: str) -> tuple[list[str], list[str]]:
        """Lemmatize a sentence and return (checked_sub_lemmas, all_sub_lemmas).

        checked_sub_lemmas: normalized sub-lemmas for Check E (excludes unknown tokens).
        all_sub_lemmas:     all normalized sub-lemmas including unknown (for target-attested).

        Per-token logic:
        - Skip punct / space / like_num tokens.
        - If lemma != text: spaCy resolved it; use token.lemma.
        - If lemma == text: try LexiconService fallback; if None → unknown_to_analyzer.
          Unknown tokens are excluded from checked_sub_lemmas (D-UNKNOWN).
        - Split resolved lemma on whitespace (contraction: 'σε ο' → ['σε', 'ο']).
        """
        morphology_svc = get_morphology_service()
        tokens = morphology_svc.lemmatize_sentence(sentence)

        checked: list[str] = []
        all_lemmas: list[str] = []

        for token in tokens:
            if token.is_punct or token.is_space or token.like_num:
                continue
            resolved, is_unknown = await self._resolve_single_token(token)
            sub_lemmas = [normalize_lemma(part) for part in resolved.split()]
            all_lemmas.extend(sub_lemmas)
            if not is_unknown:
                checked.extend(sub_lemmas)

        return checked, all_lemmas

    async def _resolve_single_token(self, token: "SentenceToken") -> tuple[str, bool]:
        """Return (resolved_lemma, is_unknown) for a single non-skip token.

        Uses spaCy's lemma when it differs from the surface form. When they
        match (spaCy uncertain), falls back to LexiconService. Returns (lemma, True)
        when the lexicon has no entry (token is unknown_to_analyzer).
        """
        if token.lemma != token.text:
            return token.lemma, False

        # spaCy uncertain: lemma == text — try lexicon fallback.
        entry = await LexiconService(self.db).lookup(token.text)

        if entry is not None:
            return entry.lemma, False
        return token.lemma, True

    async def _build_outcome(
        self,
        proposal: "WordProposal",
        gate_results: list[GateResult],
    ) -> VerifyOutcome:
        """Translate gate results into a VerifyOutcome and mutate proposal.flagged_fields."""
        hard_fails = [r for r in gate_results if r.severity == "fail"]
        warns = [r for r in gate_results if r.severity == "warn"]
        flagged: list[str] = []

        if hard_fails:
            self._on_hard_fail(proposal, hard_fails)
            flagged = list(proposal.flagged_fields) if proposal.flagged_fields else []
            return VerifyOutcome(
                status="FLAGGED",
                gate_results=gate_results,
                flagged=flagged,
            )

        if warns:
            flagged = await self._record_warns(proposal, warns)

        return VerifyOutcome(
            status="PASS",
            gate_results=gate_results,
            flagged=flagged,
        )

    async def _record_warns(
        self,
        proposal: "WordProposal",
        warns: list[GateResult],
    ) -> list[str]:
        """Write warn field names to proposal.flagged_fields and flush.

        Returns the list of field names that were flagged.
        Maps gate names to data field names via _GATE_TO_FIELD.
        """
        warn_fields = [_GATE_TO_FIELD.get(r.gate, r.gate) for r in warns]
        existing = list(proposal.flagged_fields) if proposal.flagged_fields else []
        new_flagged = [n for n in warn_fields if n not in existing]
        if new_flagged:
            proposal.flagged_fields = existing + new_flagged
            await self.db.flush()
        return warn_fields

    def _on_hard_fail(
        self,
        proposal: "WordProposal",
        failing_gates: list[GateResult],
    ) -> None:
        """Handle a hard gate failure — injectable seam for 10-04.

        10-03 stub behavior: append each failing gate name to proposal.flagged_fields
        (no regen, no transition). proposal.status stays GENERATING.

        10-04 replaces this body with the bounded outer regeneration loop
        (≤ 2 regens → flag) WITHOUT changing the verify() orchestration.

        Args:
            proposal:      The WordProposal being verified (mutated in place).
            failing_gates: GateResult entries with severity="fail".
        """
        gate_names = [r.gate for r in failing_gates]
        existing = list(proposal.flagged_fields) if proposal.flagged_fields else []
        # Reassign (not append-in-place) so SQLAlchemy JSONB change detection fires.
        proposal.flagged_fields = existing + [n for n in gate_names if n not in existing]


def get_lexgen_verify_service(db: AsyncSession) -> LexgenVerifyService:
    """Factory: return a per-request LexgenVerifyService with the singleton OpenRouter.

    Mirrors get_lexgen_generator_service(db) (lexgen_generator_service.py).
    """
    return LexgenVerifyService(db, get_openrouter_service())
