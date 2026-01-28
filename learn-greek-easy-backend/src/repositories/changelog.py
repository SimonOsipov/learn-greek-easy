"""Repository for changelog entries."""

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import ChangelogEntry
from src.repositories.base import BaseRepository


class ChangelogRepository(BaseRepository[ChangelogEntry]):
    """Repository for changelog entry operations.

    Provides database operations for changelog entries including:
    - Get entries ordered by creation date (newest first)
    - Count total entries for pagination
    - Inherits CRUD operations from BaseRepository
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the ChangelogEntry repository.

        Args:
            db: Async database session for persistence operations
        """
        super().__init__(ChangelogEntry, db)

    async def get_list(self, *, skip: int = 0, limit: int = 20) -> list[ChangelogEntry]:
        """Get changelog entries ordered by created_at DESC.

        Args:
            skip: Pagination offset
            limit: Max results

        Returns:
            List of changelog entries ordered by created_at (newest first)
        """
        query = (
            select(ChangelogEntry)
            .order_by(
                desc(ChangelogEntry.created_at),
                desc(ChangelogEntry.id),  # Tiebreaker for stable ordering
            )
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_all(self) -> int:
        """Count total changelog entries.

        Returns:
            Total number of entries
        """
        query = select(func.count()).select_from(ChangelogEntry)
        result = await self.db.execute(query)
        return result.scalar_one()


__all__ = ["ChangelogRepository"]
