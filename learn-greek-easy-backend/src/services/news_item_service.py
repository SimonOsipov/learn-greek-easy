"""News Item Service for news feed management.

This service handles:
- Read operations for news items via JOIN-based queries
- Presigned URL generation for responses
"""

from typing import Optional
from uuid import UUID, uuid4

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.exceptions import NewsItemNotFoundException
from src.core.logging import get_logger
from src.db.models import (
    DescriptionSourceType,
    NewsCountry,
    NewsItem,
    PictureStatus,
    Situation,
    SituationDescription,
    SituationPicture,
)
from src.repositories.news_item import NewsItemRepository
from src.schemas.news_item import (
    NewsItemCreate,
    NewsItemListResponse,
    NewsItemResponse,
    NewsItemUpdate,
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

    async def create(self, data: NewsItemCreate) -> NewsItemResponse:
        """Create a news item, building the full Situation tree.

        Downloads the image from source_image_url, uploads to S3, then creates:
        Situation + SituationDescription + SituationPicture + NewsItem.

        Raises:
            ValueError: If original_article_url already exists (duplicate)
            ValueError: If image download or S3 upload fails
        """
        url_str = str(data.original_article_url)
        if await self.repo.exists_by_url(url_str):
            raise ValueError(f"News item with URL '{url_str}' already exists")

        image_bytes, content_type = await self._download_image(str(data.source_image_url))
        s3_key = await self._upload_image_to_s3(image_bytes, content_type)

        situation = Situation(
            scenario_el=data.scenario_el,
            scenario_en=data.scenario_en,
            scenario_ru=data.scenario_ru,
            scenario_el_a2=data.scenario_el_a2,
            source_image_s3_key=s3_key,
        )
        self.db.add(situation)
        await self.db.flush()

        description = SituationDescription(
            situation_id=situation.id,
            text_el=data.text_el,
            text_el_a2=data.text_el_a2,
            country=data.country,
            source_type=DescriptionSourceType.NEWS,
            source_url=url_str,
        )
        self.db.add(description)

        # Resolve scene_* fields: use admin-provided pair, or fall back to scenario_*.
        # Schema validation has already enforced the paired rule, so if scene_en is
        # truthy, scene_el is too (and vice versa).
        scene_en = data.scene_en if (data.scene_en and data.scene_en.strip()) else data.scenario_en
        scene_el = data.scene_el if (data.scene_el and data.scene_el.strip()) else data.scenario_el

        # Resolve style_en: use admin-provided value, or fall back to env-var default.
        # settings.picture_house_style_default is guaranteed non-empty (Pydantic
        # Settings raises at startup if unset).
        style_en = (
            data.style_en
            if (data.style_en and data.style_en.strip())
            else settings.picture_house_style_default
        )

        # Compose image_prompt for SIT-08 backwards compatibility.
        image_prompt = f"{scene_en}\n\n{style_en}"

        picture = SituationPicture(
            situation_id=situation.id,
            image_prompt=image_prompt,
            scene_en=scene_en,
            scene_el=scene_el,
            style_en=style_en,
            status=PictureStatus.DRAFT,
        )
        self.db.add(picture)

        news_item = NewsItem(
            situation_id=situation.id,
            publication_date=data.publication_date,
            original_article_url=url_str,
        )
        self.db.add(news_item)
        await self.db.flush()

        return self._to_response(news_item, situation, description)

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
        audio_count = await self.repo.count_with_audio(country=country)
        country_counts = await self.repo.count_by_country()

        return NewsItemListResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=[self._to_response(row[0], row[1], row[2]) for row in rows],
            country_counts=country_counts,
            audio_count=audio_count,
        )

    async def update(self, news_item_id: UUID, data: NewsItemUpdate) -> NewsItemResponse:
        """Update a news item, writing through to the Situation tree.

        All fields are optional — only provided fields are updated.

        Raises:
            NewsItemNotFoundException: If news item not found
            ValueError: If new image download or S3 upload fails
        """
        row = await self.repo.get_by_id_with_joins(news_item_id)
        if row is None:
            raise NewsItemNotFoundException(str(news_item_id))

        news_item, situation, description = row

        if data.source_image_url is not None:
            await self._replace_image(situation, str(data.source_image_url))
        self._patch_situation(situation, data)
        self._patch_description(description, data)
        self._patch_news_item(news_item, description, data)

        await self.db.flush()
        return self._to_response(news_item, situation, description)

    async def _replace_image(self, situation: Situation, image_url: str) -> None:
        """Download a new image, upload to S3, and replace the existing one."""
        old_s3_key = situation.source_image_s3_key
        image_bytes, content_type = await self._download_image(image_url)
        new_s3_key = await self._upload_image_to_s3(image_bytes, content_type)
        situation.source_image_s3_key = new_s3_key
        if old_s3_key:
            self.s3_service.delete_object(old_s3_key)

    @staticmethod
    def _patch_situation(situation: Situation, data: NewsItemUpdate) -> None:
        """Apply scenario field updates to a Situation."""
        if data.scenario_el is not None:
            situation.scenario_el = data.scenario_el
        if data.scenario_en is not None:
            situation.scenario_en = data.scenario_en
        if data.scenario_ru is not None:
            situation.scenario_ru = data.scenario_ru
        if data.scenario_el_a2 is not None:
            situation.scenario_el_a2 = data.scenario_el_a2

    @staticmethod
    def _patch_description(description: SituationDescription, data: NewsItemUpdate) -> None:
        """Apply text/country field updates to a SituationDescription."""
        if data.text_el is not None:
            description.text_el = data.text_el
        if data.text_el_a2 is not None:
            description.text_el_a2 = data.text_el_a2
        if data.country is not None:
            description.country = data.country

    @staticmethod
    def _patch_news_item(
        news_item: NewsItem, description: SituationDescription, data: NewsItemUpdate
    ) -> None:
        """Apply URL and date field updates to a NewsItem (and linked description)."""
        if data.original_article_url is not None:
            url_str = str(data.original_article_url)
            description.source_url = url_str
            news_item.original_article_url = url_str
        if data.publication_date is not None:
            news_item.publication_date = data.publication_date

    async def delete(self, news_item_id: UUID) -> None:
        """Delete a news item by ID.

        Only the NewsItem row is deleted — the Situation tree is preserved.

        Raises:
            NewsItemNotFoundException: If news item not found
        """
        news_item = await self.repo.get(news_item_id)
        if news_item is None:
            raise NewsItemNotFoundException(str(news_item_id))
        await self.db.delete(news_item)
        await self.db.flush()

    # =========================================================================
    # Helper Methods
    # =========================================================================

    async def _download_image(self, url: str) -> tuple[bytes, str]:
        """Download an image from a URL and return (bytes, content_type).

        Raises:
            ValueError: If the download fails
        """
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise ValueError(f"Failed to download image from {url}: {exc}") from exc

        raw_content_type = response.headers.get("content-type", "image/jpeg")
        content_type = raw_content_type.split(";")[0].strip()
        return response.content, content_type

    async def _upload_image_to_s3(self, image_bytes: bytes, content_type: str) -> str:
        """Upload image bytes to S3 and return the S3 key.

        Raises:
            ValueError: If the upload fails
        """
        ext = S3Service.get_extension_for_content_type(content_type) or "jpg"
        s3_key = f"situations/images/{uuid4()}.{ext}"
        success = self.s3_service.upload_object(s3_key, image_bytes, content_type)
        if not success:
            raise ValueError("Failed to upload image to S3")
        return s3_key

    def _to_response(
        self, news_item: NewsItem, situation: Situation, description: SituationDescription
    ) -> NewsItemResponse:
        """Assemble NewsItemResponse from JOIN data."""
        image_url = self.s3_service.generate_presigned_url(situation.source_image_s3_key)
        audio_url = self.s3_service.generate_presigned_url(description.audio_s3_key)
        audio_a2_url = self.s3_service.generate_presigned_url(description.audio_a2_s3_key)

        return NewsItemResponse(
            id=news_item.id,
            situation_id=news_item.situation_id,
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
