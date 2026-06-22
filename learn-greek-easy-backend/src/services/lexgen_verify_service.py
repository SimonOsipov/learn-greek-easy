"""LEXGEN-10-03 — Verify service stub (RED scaffold only).

This module defines the public surface for the verify-stage gate orchestration.
The real implementation (10-03 full + 10-04 regeneration loop) is NOT yet written.

- LexgenVerifyService(db, openrouter) — constructor
- async verify(proposal) -> VerifyOutcome — raises NotImplementedError (stub)
- _on_hard_fail(proposal, failing_gates) — raises NotImplementedError (stub)
- VerifyOutcome — result dataclass (concrete shape so tests can assert on it)
- get_lexgen_verify_service(db) — factory

SEAM CONTRACT (pinned by RED tests — executor MUST honour):
1.  LexgenVerifyService(db: AsyncSession, openrouter: OpenRouterService)
    Single canonical constructor (same signature for 10-03 AND 10-04; the openrouter
    attribute is carried here so 10-04 needs no constructor change).
2.  async def verify(self, proposal: WordProposal) -> VerifyOutcome
3.  def _on_hard_fail(self, proposal, failing_gates) — injectable seam for 10-04.
4.  VerifyOutcome.status: Literal["PASS", "FLAGGED", "REJECTED"]
    VerifyOutcome.gate_results: list[GateResult]
    VerifyOutcome.check_e_regens: int  (default 0)
    VerifyOutcome.flagged: list[str]
5.  get_lexgen_verify_service(db) -> LexgenVerifyService
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.lexgen_verify import GateResult
from src.services.openrouter_service import OpenRouterService, get_openrouter_service

if TYPE_CHECKING:
    from src.db.models import WordProposal


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
                     by the 10-03 stub; first read by 10-04's _on_hard_fail body).

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

        Steps (10-03 full implementation — NOT YET WRITTEN):
        1. Rebuild EvidencePacket from proposal.evidence_packet (no re-query).
        2. Read GeneratedLexContent from proposal.generated_content.
        3. Lemmatize example_greek via morphology_service.lemmatize_sentence().
        4. For uncertain tokens: async LexiconService(db).lookup(form).lemma fallback.
        5. Split each resolved lemma on whitespace (contraction handling).
        6. normalize_lemma() each sub-lemma.
        7. Build allowed set = {normalize_lemma(l) for l in
           await CefrVocabularyService(db).allowed_lemmas()} | {normalize_lemma(target)}.
        8. Run check_e(), check_target_attested(), check_gloss_subset().
        9. Apply failure policy via _on_hard_fail (seam).
        10. Return VerifyOutcome.

        Raises:
            NotImplementedError: Always (stub — implementation is LEXGEN-10-03 work).
        """
        raise NotImplementedError(
            "LexgenVerifyService.verify() is not yet implemented (LEXGEN-10-03 stub)"
        )

    def _on_hard_fail(
        self,
        proposal: "WordProposal",
        failing_gates: list[GateResult],
    ) -> None:
        """Handle a hard gate failure — injectable seam for 10-04.

        10-03 stub: flags immediately (no regen). 10-04 replaces this body
        with the bounded outer regeneration loop (≤ 2 regens → flag).

        Raises:
            NotImplementedError: Always (stub — implementation is LEXGEN-10-03 work).
        """
        raise NotImplementedError(
            "LexgenVerifyService._on_hard_fail() is not yet implemented (LEXGEN-10-03 stub)"
        )


def get_lexgen_verify_service(db: AsyncSession) -> LexgenVerifyService:
    """Factory: return a per-request LexgenVerifyService with the singleton OpenRouter.

    Mirrors get_lexgen_generator_service(db) (lexgen_generator_service.py:237).
    """
    return LexgenVerifyService(db, get_openrouter_service())
