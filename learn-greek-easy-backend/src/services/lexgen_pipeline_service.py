"""LexgenPipelineService — end-to-end word proposal pipeline (LEXGEN-14-01).

Chains EvidenceAssemblyService → generate → verify → reconcile → judge and
commits the result in a single transaction.

The never-invent gate (EvidenceAssemblyService.assemble) hard-rejects lemmas
absent from all references BEFORE any LLM call is made — the generator,
verifier, reconciler, and judge are only invoked for attested lemmas.

Binary routing invariant (Decision Record §3):
- The pipeline never transitions to AUTO_APPROVED.
- ``trust_score`` is never written.
- The terminal status for an attested lemma is always NEEDS_REVIEW.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import bind_log_context, get_logger
from src.db.models import WordProposalOrigin, WordProposalState

if TYPE_CHECKING:
    from src.db.models import WordProposal
    from src.services.openrouter_service import OpenRouterService


logger = get_logger(__name__)


def _get_openrouter() -> "OpenRouterService":
    """Return an OpenRouterService (or the test-only FakeOpenRouter).

    Identical pattern to lexgen_review_service._get_openrouter so that
    tests can monkeypatch ``src.services.lexgen_pipeline_service._get_openrouter``
    and inject FakeOpenRouter without needing a real API key.

    FAKE INJECTION
    --------------
    When BOTH conditions hold the deterministic FakeOpenRouter is returned:
      1. ``settings.lexgen_e2e_fake_llm is True``
      2. ``not settings.is_production``
    """
    from src.config import settings  # noqa: PLC0415

    if settings.lexgen_e2e_fake_llm and not settings.is_production:
        from src.services.lexgen_fake_openrouter import FakeOpenRouter  # noqa: PLC0415

        return FakeOpenRouter()  # type: ignore[return-value]

    from src.services.openrouter_service import OpenRouterService  # noqa: PLC0415

    return OpenRouterService()


def get_lexgen_pipeline_service(db: AsyncSession) -> "LexgenPipelineService":
    """Factory function — mirrors the existing service factory pattern."""
    return LexgenPipelineService(db)


class LexgenPipelineService:
    """Orchestrates the full LEXGEN word-proposal pipeline per lemma.

    Constructed per-request (one DB session per call).

    Chain:
        EvidenceAssemblyService.assemble()
        → (if not REJECTED) LexgenGeneratorService.generate()
          → (if not REJECTED after generate) LexgenVerifyService.verify()
          → LexgenReconcilerService.reconcile()
          → LexgenJudgeService.judge()
        → db.commit()  (single commit)

    Returns:
        (WordProposal, outcome) where outcome is:
            "queued"   — proposal reached NEEDS_REVIEW
            "rejected" — proposal was hard-rejected (never-invent gate or
                         generator exhausted 3 attempts)
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def run_for_lemma(
        self,
        lemma_input: str,
        *,
        pos: str = "noun",
        requested_by: UUID | None,
    ) -> tuple["WordProposal", str]:
        """Run the full pipeline for a single lemma and commit.

        Args:
            lemma_input: Raw lemma string.
            pos: Part-of-speech (default "noun").
            requested_by: User UUID or None.

        Returns:
            (WordProposal, outcome_str) — outcome is "queued" or "rejected".
        """
        from src.services.evidence_assembly_service import EvidenceAssemblyService  # noqa: PLC0415

        logger.info("lexgen.pipeline.start", lemma=lemma_input, pos=pos)

        # Step 1: assemble evidence and create the proposal.
        # Returns a WordProposal at GENERATING (attested) or REJECTED (never-invent).
        # The proposal is flushed but not committed.
        assembly_svc = EvidenceAssemblyService(self.db)
        proposal = await assembly_svc.assemble(
            lemma_input,
            pos,
            origin=WordProposalOrigin.ADMIN,
            requested_by=requested_by,
        )

        # Bind proposal_id so every downstream stage log — here and inside the
        # generator/verify/reconcile/judge services — is traceable end-to-end in
        # Sentry Logs (LEXGEN-15).
        bind_log_context(proposal_id=str(proposal.id))

        # Step 2: never-invent gate — short-circuit before any LLM call.
        if proposal.status == WordProposalState.REJECTED:
            logger.warning(
                "lexgen.pipeline.rejected",
                stage="assemble",
                reason="never_invent",
                rejection_reason=proposal.rejection_reason,
            )
            await self.db.commit()
            return (proposal, "rejected")

        logger.info("lexgen.pipeline.assembled", stage="assemble", status=proposal.status.value)

        # Step 3: attested path — run the chain exactly as regenerate() does,
        # but WITHOUT the attempt-snapshot / reject-log / needs_review→generating
        # transition (those are regenerate-only; assemble already left it at GENERATING).
        from src.services.lexgen_generator_service import LexgenGeneratorService  # noqa: PLC0415
        from src.services.lexgen_judge_service import LexgenJudgeService  # noqa: PLC0415
        from src.services.lexgen_reconciler_service import LexgenReconcilerService  # noqa: PLC0415
        from src.services.lexgen_verify_service import LexgenVerifyService  # noqa: PLC0415

        openrouter = _get_openrouter()

        await LexgenGeneratorService(self.db, openrouter).generate(proposal)

        # The generator can exhaust retries and transition GENERATING→REJECTED.
        # Commit and return early if that happened (no reconcile/judge on rejected).
        if proposal.status == WordProposalState.REJECTED:
            logger.warning(
                "lexgen.pipeline.rejected",
                stage="generate",
                reason="retries_exhausted",
                rejection_reason=proposal.rejection_reason,
            )
            await self.db.commit()
            return (proposal, "rejected")

        logger.info("lexgen.pipeline.generated", stage="generate", status=proposal.status.value)

        await LexgenVerifyService(self.db, openrouter).verify(proposal)
        # verify() returns a VerifyOutcome and never transitions status — no branch needed.
        logger.info("lexgen.pipeline.verified", stage="verify")

        await LexgenReconcilerService(self.db).reconcile(proposal)
        # reconcile() transitions GENERATING→SCORED.
        logger.info("lexgen.pipeline.reconciled", stage="reconcile", status=proposal.status.value)

        await LexgenJudgeService(self.db, openrouter).judge(proposal)
        # judge() transitions SCORED→NEEDS_REVIEW.

        await self.db.commit()
        logger.info("lexgen.pipeline.queued", stage="judge", status=proposal.status.value)
        return (proposal, "queued")
