"""LexgenReviewService — four reviewer actions on needs_review proposals.

LEXGEN-13-02: NOT YET IMPLEMENTED.

This file is a minimal stub so that RED integration tests can COLLECT and fail on
NotImplementedError (the correct RED failure mode) rather than ModuleNotFoundError
(a collection error, which is the wrong RED failure mode).

The real implementation is authored by the executor in the next RALPH stage.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


class LexgenReviewService:
    """Stub — four methods raise NotImplementedError until the executor implements them."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def approve(
        self,
        proposal: object,
        *,
        deck_id: UUID,
        reviewer_id: UUID,
    ) -> None:
        raise NotImplementedError("LexgenReviewService.approve() is not implemented yet")

    async def edit(
        self,
        proposal: object,
        *,
        field_edits: dict,
        reviewer_id: UUID,
    ) -> None:
        raise NotImplementedError("LexgenReviewService.edit() is not implemented yet")

    async def regenerate(
        self,
        proposal: object,
        *,
        reviewer_id: UUID,
    ) -> None:
        raise NotImplementedError("LexgenReviewService.regenerate() is not implemented yet")

    async def reject(
        self,
        proposal: object,
        *,
        rejection_reason: str,
        reviewer_id: UUID,
    ) -> None:
        raise NotImplementedError("LexgenReviewService.reject() is not implemented yet")
