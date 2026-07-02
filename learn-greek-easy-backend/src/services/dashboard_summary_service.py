"""Dashboard summary gather-layer service (PERF-15-02).

STUB — the PERF-15-02 executor wires this up to replace the eight separate
dashboard calls with a single gather pass that composes a
``DashboardSummaryResponse`` (see src/schemas/dashboard.py, PERF-15-01) from
decks, situations, news, the exercise queue, and gamification data.

Until that lands, ``gather`` only reports ``queue_count`` (sourced from
``ExerciseSM2Service.get_study_queue(...).total_in_queue``) so the
PERF-15-02 gather-layer contract test has a stable seam to target.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


class DashboardSummaryService:
    """Gathers and composes the single-call dashboard summary payload."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def gather(self, user_id: UUID) -> dict:
        """STUB — PERF-15-02 executor replaces this with the real gather pass
        (composes DashboardSummaryResponse from decks/situations/news/queue/
        gamification data). Currently a placeholder that always reports zero
        queue items, regardless of ``user_id``.
        """
        return {"queue_count": 0}


__all__ = ["DashboardSummaryService"]
