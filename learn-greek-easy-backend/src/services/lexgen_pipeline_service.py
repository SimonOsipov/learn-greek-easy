"""LexgenPipelineService — end-to-end word proposal pipeline (LEXGEN-14-01).

Chains EvidenceAssemblyService → generate → verify → reconcile → judge and
commits the result in a single transaction.

STUB — body not yet implemented.  This file exists to allow RED tests to
import cleanly and fail on ``NotImplementedError`` rather than a collection
error.  The executor will replace the stub body.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


def get_lexgen_pipeline_service(db: AsyncSession) -> "LexgenPipelineService":
    """Factory function — mirrors the existing service factory pattern."""
    return LexgenPipelineService(db)


class LexgenPipelineService:
    """Orchestrates the full LEXGEN word-proposal pipeline per lemma.

    Constructed per-request (one DB session per call).

    Chain:
        EvidenceAssemblyService.assemble()
        → (if not REJECTED) LexgenGeneratorService.generate()
        → LexgenVerifyService.verify()
        → LexgenReconcilerService.reconcile()
        → LexgenJudgeService.judge()
        → db.commit()  (single commit)

    Returns:
        (WordProposal, outcome) where outcome is:
            "queued"   — proposal reached NEEDS_REVIEW
            "rejected" — proposal was hard-rejected by never-invent gate
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def run_for_lemma(
        self,
        lemma_input: str,
        *,
        pos: str = "noun",
        requested_by: UUID | None,
    ) -> tuple:
        """Run the full pipeline for a single lemma and commit.

        Args:
            lemma_input: Raw lemma string.
            pos: Part-of-speech (default "noun").
            requested_by: User UUID or None.

        Returns:
            (WordProposal, outcome_str) — outcome is "queued" or "rejected".

        Raises:
            NotImplementedError: Implementation pending (LEXGEN-14-01).
        """
        raise NotImplementedError("LEXGEN-14-01")
