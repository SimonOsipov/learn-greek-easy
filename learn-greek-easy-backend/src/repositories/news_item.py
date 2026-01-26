"""NewsItem repository for news feed operations."""

from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureQuestion, NewsItem
from src.repositories.base import BaseRepository


class NewsItemRepository(BaseRepository[NewsItem]):
    """Repository for news item operations.

    Provides database operations for news items including:
    - Get news items ordered by publication date
    - Get recent news for homepage widget
    - Check for duplicate articles by URL
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the NewsItem repository.

        Args:
            db: Async database session for persistence operations
        """
        super().__init__(NewsItem, db)

    async def get_list(self, *, skip: int = 0, limit: int = 20) -> list[NewsItem]:
        """Get news items ordered by publication_date DESC.

        Args:
            skip: Pagination offset
            limit: Max results

        Returns:
            List of news items ordered by publication date (newest first),
            then by created_at and id as tiebreakers for stable pagination
        """
        query = (
            select(NewsItem)
            .order_by(
                desc(NewsItem.publication_date),
                desc(NewsItem.created_at),
                desc(NewsItem.id),  # Final tiebreaker for stable ordering
            )
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_recent(self, limit: int = 3) -> list[NewsItem]:
        """Get most recent news items for homepage widget.

        Args:
            limit: Maximum number of news items to return (default: 3)

        Returns:
            List of most recent news items
        """
        query = (
            select(NewsItem)
            .order_by(
                desc(NewsItem.publication_date),
                desc(NewsItem.created_at),
                desc(NewsItem.id),  # Final tiebreaker for stable ordering
            )
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def exists_by_url(self, url: str) -> bool:
        """Check if news item exists by original_article_url.

        Args:
            url: The original article URL to check

        Returns:
            True if a news item with this URL exists, False otherwise
        """
        return await self.exists(original_article_url=url)

    async def count_all(self) -> int:
        """Count total news items.

        Returns:
            Total number of news items in the database
        """
        query = select(func.count()).select_from(NewsItem)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_card_for_news_item(
        self, original_article_url: str
    ) -> tuple[UUID, UUID | None] | None:
        """Find card associated with news item by URL match.

        Returns (card_id, deck_id) tuple if found, None otherwise.
        Uses LIMIT 1 ordered by created_at DESC for multiple matches.
        """
        result = await self.db.execute(
            select(CultureQuestion.id, CultureQuestion.deck_id)
            .where(CultureQuestion.original_article_url == original_article_url)
            .order_by(desc(CultureQuestion.created_at))
            .limit(1)
        )
        row = result.first()
        if row:
            return (row.id, row.deck_id)
        return None


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["NewsItemRepository"]
