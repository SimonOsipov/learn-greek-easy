"""News Item Service for news feed management.

This service handles:
- Read operations for news items via JOIN-based queries
- Presigned URL generation for responses
"""

from typing import NoReturn, Optional
from uuid import UUID

from sqlalchemy import String, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from src.core.exceptions import NewsItemNotFoundException, NotFoundException
from src.core.logging import get_logger
from src.db.models import CultureQuestion, NewsCountry, NewsItem, Situation, SituationDescription
from src.repositories.news_item import NewsItemRepository
from src.schemas.news_item import (
    NewsCardInfo,
    NewsItemCreate,
    NewsItemListResponse,
    NewsItemListWithCardsResponse,
    NewsItemResponse,
    NewsItemUpdate,
    NewsItemWithCardInfo,
)
from src.services.s3_service import S3Service, get_s3_service

logger = get_logger(__name__)


class NewsItemService:
    """Service for news item read operations using JOIN-based queries.

    This service orchestrates:
    1. Read operations via repository (JOIN-based)
    2. Presigned URL generation for responses
    """

    def __init__(
        self,
        db: AsyncSession,
        s3_service: Optional[S3Service] = None,
    ):
        """Initialize the News Item service.

        Args:
            db: Async database session for persistence operations
            s3_service: Optional S3 service for image operations (defaults to singleton)
        """
        self.db = db
        self.s3_service = s3_service or get_s3_service()
        self.repo = NewsItemRepository(db)

    # =========================================================================
    # CRUD Operations
    # =========================================================================

    async def create_with_question(self, data: NewsItemCreate) -> NewsItemResponse:
        """Create news item with optional linked culture question.

        Raises:
            NotImplementedError: Admin write operations disabled during thin-news migration
        """
        raise NotImplementedError("Admin write operations are disabled during thin-news migration")

    async def get_by_id(self, news_item_id: UUID) -> NewsItemResponse:
        """Get a news item by ID.

        Args:
            news_item_id: UUID of the news item

        Returns:
            NewsItemResponse with presigned image URL

        Raises:
            NewsItemNotFoundException: If news item doesn't exist
        """
        row = await self.repo.get_by_id_with_joins(news_item_id)
        if row is None:
            raise NewsItemNotFoundException(news_item_id=str(news_item_id))
        return self._to_response(row[0], row[1], row[2])

    async def get_list(
        self, *, page: int = 1, page_size: int = 20, country: NewsCountry | None = None
    ) -> NewsItemListResponse:
        """Get paginated list of news items.

        Args:
            page: Page number (1-indexed)
            page_size: Number of items per page
            country: Optional country filter

        Returns:
            NewsItemListResponse with paginated news items and country counts
        """
        skip = (page - 1) * page_size
        rows = await self.repo.get_list(skip=skip, limit=page_size, country=country)
        total = await self.repo.count_all(country=country)
        country_counts = await self.repo.count_by_country()

        return NewsItemListResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=[self._to_response(row[0], row[1], row[2]) for row in rows],
            country_counts=country_counts,
        )

    async def update(self, news_item_id: UUID, data: NewsItemUpdate) -> NoReturn:
        """Update a news item.

        Raises:
            NotImplementedError: Admin write operations disabled during thin-news migration
        """
        raise NotImplementedError("Admin write operations are disabled during thin-news migration")

    async def delete(self, news_item_id: UUID) -> NoReturn:
        """Delete a news item.

        Raises:
            NotImplementedError: Admin write operations disabled during thin-news migration
        """
        raise NotImplementedError("Admin write operations are disabled during thin-news migration")

    async def get_card_for_news(self, news_item_id: UUID) -> NewsCardInfo:
        """Get card associated with a news item.

        Args:
            news_item_id: UUID of the news item

        Returns:
            NewsCardInfo with card_id and deck_id

        Raises:
            NewsItemNotFoundException: If news item doesn't exist
            NotFoundException: If no associated card
        """
        row = await self.repo.get_by_id_with_joins(news_item_id)
        if row is None:
            raise NewsItemNotFoundException(news_item_id=str(news_item_id))
        news_item = row[0]

        card_info = await self.repo.get_card_for_news_item(news_item.original_article_url)
        if card_info is None:
            raise NotFoundException(
                resource="Card",
                detail=f"No card associated with news item '{news_item_id}'",
            )

        return NewsCardInfo(card_id=card_info[0], deck_id=card_info[1])

    async def get_list_with_cards(
        self, *, page: int = 1, page_size: int = 20, country: NewsCountry | None = None
    ) -> NewsItemListWithCardsResponse:
        """Get paginated list of news items with card associations."""
        skip = (page - 1) * page_size

        # Subquery: Get the first (MIN id) CultureQuestion per original_article_url
        first_question_subq = (
            select(
                CultureQuestion.original_article_url,
                func.min(CultureQuestion.id.cast(String)).label("first_question_id"),
            )
            .where(CultureQuestion.original_article_url.isnot(None))
            .group_by(CultureQuestion.original_article_url)
            .subquery()
        )

        QuestionAlias = aliased(CultureQuestion)

        query = (
            select(
                NewsItem,
                Situation,
                SituationDescription,
                QuestionAlias.id.label("card_id"),
                QuestionAlias.deck_id.label("deck_id"),
            )
            .join(Situation, Situation.id == NewsItem.situation_id)
            .join(SituationDescription, SituationDescription.situation_id == Situation.id)
            .outerjoin(
                first_question_subq,
                first_question_subq.c.original_article_url == NewsItem.original_article_url,
            )
            .outerjoin(
                QuestionAlias,
                QuestionAlias.id.cast(String) == first_question_subq.c.first_question_id,
            )
        )
        if country is not None:
            query = query.where(SituationDescription.country == country)
        query = (
            query.order_by(
                NewsItem.publication_date.desc(),
                NewsItem.created_at.desc(),
                NewsItem.id.desc(),
            )
            .offset(skip)
            .limit(page_size)
        )

        result = await self.db.execute(query)
        rows = result.all()

        total = await self.repo.count_all(country=country)
        audio_count = await self.repo.count_with_audio(country=country)
        country_counts = await self.repo.count_by_country()

        items = []
        for row in rows:
            news_item = row[0]
            situation = row[1]
            description = row[2]
            card_id = row[3]
            deck_id = row[4]

            response = self._to_response(news_item, situation, description)
            items.append(
                NewsItemWithCardInfo(
                    **response.model_dump(),
                    card_id=card_id,
                    deck_id=deck_id,
                )
            )

        return NewsItemListWithCardsResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=items,
            country_counts=country_counts,
            audio_count=audio_count,
        )

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _to_response(
        self, news_item: NewsItem, situation: Situation, description: SituationDescription
    ) -> NewsItemResponse:
        """Assemble NewsItemResponse from JOIN data."""
        image_url = self.s3_service.generate_presigned_url(situation.source_image_s3_key)
        audio_url = self.s3_service.generate_presigned_url(description.audio_s3_key)
        audio_a2_url = self.s3_service.generate_presigned_url(description.audio_a2_s3_key)

        return NewsItemResponse(
            id=news_item.id,
            title_el=situation.scenario_el or "",
            title_en=situation.scenario_en or "",
            title_ru=situation.scenario_ru or "",
            title_el_a2=situation.scenario_el_a2,
            description_el=description.text_el or "",
            description_el_a2=description.text_el_a2,
            description_en=None,
            description_ru=None,
            publication_date=news_item.publication_date,
            original_article_url=news_item.original_article_url,
            country=description.country.value if description.country else "cyprus",
            image_url=image_url,
            audio_url=audio_url,
            audio_generated_at=None,
            audio_duration_seconds=description.audio_duration_seconds,
            audio_file_size_bytes=None,
            audio_a2_url=audio_a2_url,
            audio_a2_generated_at=None,
            audio_a2_duration_seconds=description.audio_a2_duration_seconds,
            audio_a2_file_size_bytes=None,
            created_at=news_item.created_at,
            updated_at=news_item.updated_at,
        )


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["NewsItemService"]
