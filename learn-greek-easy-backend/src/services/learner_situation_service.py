"""Learner-facing situations list service (PERF-15-02).

STUB — PERF-15-02 executor replaces this with the logic extracted verbatim
from the inline handler in ``src.api.v1.situations.list_situations``
(situations.py:49-160): READY-only filter, ``created_at DESC`` ordering, the
per-situation exercise_total/exercise_completed correlated subqueries, and
search / has_audio filtering. The router will delegate to this service once
that lands; until then ``list_for_learner`` always returns an empty page so
callers/tests have a stable import seam to target.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.schemas.learner_situation import LearnerSituationListResponse


class LearnerSituationService:
    """Assembles the learner-facing paginated READY-situations list."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_learner(
        self,
        user_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        has_audio: bool | None = None,
    ) -> LearnerSituationListResponse:
        """STUB — PERF-15-02 executor replaces this with the extracted router
        logic (READY only, created_at DESC, exercise_total/completed
        subqueries scoped to ``user_id``)."""
        return LearnerSituationListResponse(items=[], total=0, page=page, page_size=page_size)


__all__ = ["LearnerSituationService"]
