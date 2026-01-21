"""NewsSource repository with filtering and uniqueness checks."""

from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import NewsSource
from src.repositories.base import BaseRepository


class NewsSourceRepository(BaseRepository[NewsSource]):
    """Repository for NewsSource model with filtering and URL uniqueness.

    Provides database operations for news sources including:
    - List all sources with optional active filter
    - Count sources for pagination
    - Check URL uniqueness
    - Get source by URL
    """

    def __init__(self, db: AsyncSession):
        """Initialize the NewsSource repository.

        Args:
            db: Async database session for persistence operations
        """
        super().__init__(NewsSource, db)

    async def list_all(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None,
    ) -> list[NewsSource]:
        """List news sources with optional active filter.

        Args:
            skip: Pagination offset
            limit: Max results
            is_active: Optional filter by active status

        Returns:
            List of news sources ordered by created_at descending
        """
        query = select(NewsSource)

        if is_active is not None:
            query = query.where(NewsSource.is_active.is_(is_active))

        query = query.offset(skip).limit(limit).order_by(NewsSource.created_at.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_all(self, is_active: Optional[bool] = None) -> int:
        """Count all news sources, optionally filtered by active status.

        Args:
            is_active: Optional filter by active status

        Returns:
            Total number of sources matching criteria
        """
        query = select(func.count(NewsSource.id))
        if is_active is not None:
            query = query.where(NewsSource.is_active.is_(is_active))
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_by_url(self, url: str) -> Optional[NewsSource]:
        """Get news source by URL.

        Args:
            url: Source URL to search for

        Returns:
            NewsSource if found, None otherwise
        """
        query = select(NewsSource).where(NewsSource.url == url)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def url_exists(self, url: str, exclude_id: Optional[UUID] = None) -> bool:
        """Check if URL already exists (for uniqueness validation).

        Args:
            url: URL to check
            exclude_id: Optional ID to exclude (for update operations)

        Returns:
            True if URL exists (and is not the excluded ID)
        """
        query = select(func.count(NewsSource.id)).where(NewsSource.url == url)
        if exclude_id is not None:
            query = query.where(NewsSource.id != exclude_id)
        result = await self.db.execute(query)
        count = result.scalar() or 0
        return count > 0


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["NewsSourceRepository"]
