"""NewsItem repository for news feed operations."""

from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import NewsCountry, NewsItem, Situation, SituationDescription
from src.repositories.base import BaseRepository


class NewsItemRepository(BaseRepository[NewsItem]):
    """Repository for news item operations.

    Provides database operations for news items including:
    - Get news items ordered by publication date
    - Check for duplicate articles by URL
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the NewsItem repository.

        Args:
            db: Async database session for persistence operations
        """
        super().__init__(NewsItem, db)

    async def get_list(
        self, *, skip: int = 0, limit: int = 20, country: NewsCountry | None = None
    ) -> list[Row]:
        """Get news items with situation/description via JOIN, ordered by publication_date DESC."""
        query = (
            select(NewsItem, Situation, SituationDescription)
            .join(Situation, Situation.id == NewsItem.situation_id)
            .join(SituationDescription, SituationDescription.situation_id == Situation.id)
        )
        if country is not None:
            query = query.where(SituationDescription.country == country)
        query = (
            query.order_by(
                desc(NewsItem.publication_date),
                desc(NewsItem.created_at),
                desc(NewsItem.id),
            )
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.all())

    async def exists_by_url(self, url: str) -> bool:
        """Check if news item exists by original_article_url.

        Args:
            url: The original article URL to check

        Returns:
            True if a news item with this URL exists, False otherwise
        """
        return await self.exists(original_article_url=url)

    async def count_all(self, country: NewsCountry | None = None) -> int:
        """Count news items (only those with situation/description via JOIN).

        Args:
            country: Optional country filter

        Returns:
            Total number of news items in the database (filtered if country provided)
        """
        query = (
            select(func.count())
            .select_from(NewsItem)
            .join(Situation, Situation.id == NewsItem.situation_id)
            .join(SituationDescription, SituationDescription.situation_id == Situation.id)
        )
        if country is not None:
            query = query.where(SituationDescription.country == country)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def count_with_audio(self, country: NewsCountry | None = None) -> int:
        """Count news items that have B2 audio generated (via SituationDescription).

        Args:
            country: Optional country filter

        Returns:
            Number of news items with a non-null audio_s3_key
        """
        query = (
            select(func.count())
            .select_from(NewsItem)
            .join(Situation, Situation.id == NewsItem.situation_id)
            .join(SituationDescription, SituationDescription.situation_id == Situation.id)
            .where(SituationDescription.audio_s3_key.isnot(None))
        )
        if country is not None:
            query = query.where(SituationDescription.country == country)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def count_by_country(self) -> dict[str, int]:
        """Count news items grouped by SituationDescription.country.

        Returns:
            Dict mapping country value strings to counts, e.g. {"cyprus": 5, "greece": 3, "world": 2}
        """
        query = (
            select(SituationDescription.country, func.count())
            .select_from(NewsItem)
            .join(Situation, Situation.id == NewsItem.situation_id)
            .join(SituationDescription, SituationDescription.situation_id == Situation.id)
            .group_by(SituationDescription.country)
        )
        result = await self.db.execute(query)
        rows = result.all()
        counts = {c.value: 0 for c in NewsCountry}
        for country_enum, count in rows:
            if country_enum is not None:
                key = country_enum.value if hasattr(country_enum, "value") else str(country_enum)
                counts[key] = count
            else:
                counts[NewsCountry.CYPRUS.value] += count
        return counts

    async def get_by_id_with_joins(self, news_item_id: UUID) -> Row | None:
        """Fetch a single NewsItem with its Situation and SituationDescription via JOIN."""
        query = (
            select(NewsItem, Situation, SituationDescription)
            .join(Situation, Situation.id == NewsItem.situation_id)
            .join(SituationDescription, SituationDescription.situation_id == Situation.id)
            .where(NewsItem.id == news_item_id)
        )
        result = await self.db.execute(query)
        return result.first()


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["NewsItemRepository"]
