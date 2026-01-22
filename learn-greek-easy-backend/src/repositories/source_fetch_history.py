"""SourceFetchHistory repository for fetch history operations."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import SourceFetchHistory
from src.repositories.base import BaseRepository


class SourceFetchHistoryRepository(BaseRepository[SourceFetchHistory]):
    """Repository for SourceFetchHistory model.

    Provides database operations for fetch history including:
    - List history for a source
    - Count history entries
    - Get latest fetch for a source
    """

    def __init__(self, db: AsyncSession):
        """Initialize the SourceFetchHistory repository.

        Args:
            db: Async database session for persistence operations
        """
        super().__init__(SourceFetchHistory, db)

    async def list_by_source(
        self,
        source_id: UUID,
        *,
        limit: int = 10,
    ) -> list[SourceFetchHistory]:
        """List fetch history for a source, most recent first.

        Args:
            source_id: Source UUID
            limit: Max results (default 10)

        Returns:
            List of fetch history entries
        """
        query = (
            select(SourceFetchHistory)
            .where(SourceFetchHistory.source_id == source_id)
            .order_by(SourceFetchHistory.fetched_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_by_source(self, source_id: UUID) -> int:
        """Count fetch history entries for a source.

        Args:
            source_id: Source UUID

        Returns:
            Total number of fetch history entries for the source
        """
        query = select(func.count(SourceFetchHistory.id)).where(
            SourceFetchHistory.source_id == source_id
        )
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_latest_by_source(self, source_id: UUID) -> SourceFetchHistory | None:
        """Get the most recent fetch for a source.

        Args:
            source_id: Source UUID

        Returns:
            Most recent fetch history entry, or None if no history exists
        """
        query = (
            select(SourceFetchHistory)
            .where(SourceFetchHistory.source_id == source_id)
            .order_by(SourceFetchHistory.fetched_at.desc())
            .limit(1)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["SourceFetchHistoryRepository"]
