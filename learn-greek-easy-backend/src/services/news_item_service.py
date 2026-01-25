"""News Item Service for news feed management.

This service handles:
- CRUD operations for news items
- S3 image lifecycle (download from URL, upload to S3, delete on cleanup)
- Presigned URL generation for responses

Example Usage:
    async with get_db_session() as db:
        service = NewsItemService(db)
        news_item = await service.create(create_data)
        print(f"Created news item: {news_item.id}")
"""

from typing import Any, Optional
from uuid import UUID, uuid4

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NewsItemNotFoundException
from src.core.logging import get_logger
from src.db.models import NewsItem
from src.repositories.news_item import NewsItemRepository
from src.schemas.news_item import (
    NewsItemCreate,
    NewsItemListResponse,
    NewsItemResponse,
    NewsItemUpdate,
)
from src.services.s3_service import S3Service, get_s3_service

logger = get_logger(__name__)

# Image download constraints
ALLOWED_IMAGE_CONTENT_TYPES = frozenset(["image/jpeg", "image/png", "image/webp"])
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB
IMAGE_DOWNLOAD_TIMEOUT_SECONDS = 30

# Content type to extension mapping
CONTENT_TYPE_TO_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

# S3 key prefix for news images
NEWS_IMAGES_PREFIX = "news-images"


class NewsItemService:
    """Service for news item operations with S3 image handling.

    This service orchestrates:
    1. CRUD operations via repository
    2. Image download from external URLs
    3. S3 upload/delete for images
    4. Presigned URL generation for responses
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
        """Create a new news item with image upload.

        Args:
            data: News item creation data including source_image_url

        Returns:
            NewsItemResponse with presigned image URL

        Raises:
            ValueError: If image download fails, content-type invalid, or size exceeds limit
        """
        logger.info(
            "Creating news item",
            extra={
                "original_article_url": str(data.original_article_url),
                "source_image_url": str(data.source_image_url),
            },
        )

        # Check for duplicate article URL
        if await self.repo.exists_by_url(str(data.original_article_url)):
            raise ValueError(f"News item with URL '{data.original_article_url}' already exists")

        # Download and validate image
        image_data, content_type = await self._download_image(str(data.source_image_url))

        # Generate S3 key
        ext = CONTENT_TYPE_TO_EXT.get(content_type, "jpg")
        s3_key = f"{NEWS_IMAGES_PREFIX}/{uuid4()}.{ext}"

        # Upload to S3
        upload_success = self.s3_service.upload_object(s3_key, image_data, content_type)
        if not upload_success:
            raise ValueError("Failed to upload image to S3")

        # Create news item in database
        news_item_dict = {
            "title_el": data.title_el,
            "title_en": data.title_en,
            "title_ru": data.title_ru,
            "description_el": data.description_el,
            "description_en": data.description_en,
            "description_ru": data.description_ru,
            "publication_date": data.publication_date,
            "original_article_url": str(data.original_article_url),
            "image_s3_key": s3_key,
        }

        news_item = await self.repo.create(news_item_dict)
        await self.db.commit()
        await self.db.refresh(news_item)

        logger.info(
            "News item created successfully",
            extra={
                "news_item_id": str(news_item.id),
                "s3_key": s3_key,
            },
        )

        return self._to_response(news_item)

    async def get_by_id(self, news_item_id: UUID) -> NewsItemResponse:
        """Get a news item by ID.

        Args:
            news_item_id: UUID of the news item

        Returns:
            NewsItemResponse with presigned image URL

        Raises:
            NewsItemNotFoundException: If news item doesn't exist
        """
        news_item = await self.repo.get(news_item_id)
        if news_item is None:
            raise NewsItemNotFoundException(news_item_id=str(news_item_id))

        return self._to_response(news_item)

    async def get_list(self, *, page: int = 1, page_size: int = 20) -> NewsItemListResponse:
        """Get paginated list of news items.

        Args:
            page: Page number (1-indexed)
            page_size: Number of items per page

        Returns:
            NewsItemListResponse with paginated news items
        """
        skip = (page - 1) * page_size
        news_items = await self.repo.get_list(skip=skip, limit=page_size)
        total = await self.repo.count_all()

        return NewsItemListResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=[self._to_response(item) for item in news_items],
        )

    async def get_recent(self, limit: int = 3) -> list[NewsItemResponse]:
        """Get most recent news items for homepage widget.

        Args:
            limit: Maximum number of news items to return

        Returns:
            List of most recent news items with presigned image URLs
        """
        news_items = await self.repo.get_recent(limit=limit)
        return [self._to_response(item) for item in news_items]

    async def update(self, news_item_id: UUID, data: NewsItemUpdate) -> NewsItemResponse:
        """Update a news item, optionally replacing the image.

        Args:
            news_item_id: UUID of the news item to update
            data: Fields to update (all optional)

        Returns:
            Updated NewsItemResponse

        Raises:
            NewsItemNotFoundException: If news item doesn't exist
            ValueError: If new image download fails
        """
        news_item = await self.repo.get(news_item_id)
        if news_item is None:
            raise NewsItemNotFoundException(news_item_id=str(news_item_id))

        logger.debug(
            "Updating news item",
            extra={"news_item_id": str(news_item_id)},
        )

        # Build update dict from data fields
        update_dict = self._build_update_dict(data)

        # Handle image replacement if source_image_url provided
        old_s3_key = await self._handle_image_update(data, news_item, update_dict)

        # Update database record
        updated_news_item = await self.repo.update(news_item, update_dict)
        await self.db.commit()
        await self.db.refresh(updated_news_item)

        # Delete old image after successful commit
        if old_s3_key:
            self.s3_service.delete_object(old_s3_key)
            logger.info(
                "Deleted old news item image from S3",
                extra={"old_s3_key": old_s3_key},
            )

        logger.info(
            "News item updated successfully",
            extra={
                "news_item_id": str(news_item_id),
                "updated_fields": list(update_dict.keys()),
            },
        )

        return self._to_response(updated_news_item)

    async def delete(self, news_item_id: UUID) -> None:
        """Delete a news item and its S3 image.

        Args:
            news_item_id: UUID of the news item to delete

        Raises:
            NewsItemNotFoundException: If news item doesn't exist
        """
        news_item = await self.repo.get(news_item_id)
        if news_item is None:
            raise NewsItemNotFoundException(news_item_id=str(news_item_id))

        logger.debug(
            "Deleting news item",
            extra={"news_item_id": str(news_item_id)},
        )

        # Store S3 key for cleanup
        s3_key = news_item.image_s3_key

        # Delete from database
        await self.repo.delete(news_item)
        await self.db.commit()

        # Delete S3 image
        if s3_key:
            self.s3_service.delete_object(s3_key)
            logger.info(
                "Deleted news item image from S3",
                extra={"s3_key": s3_key},
            )

        logger.info(
            "News item deleted successfully",
            extra={"news_item_id": str(news_item_id)},
        )

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _build_update_dict(self, data: NewsItemUpdate) -> dict[str, Any]:
        """Build update dictionary from NewsItemUpdate data.

        Args:
            data: Update data with optional fields

        Returns:
            Dictionary with only non-None fields to update
        """
        update_dict: dict[str, Any] = {}
        if data.title_el is not None:
            update_dict["title_el"] = data.title_el
        if data.title_en is not None:
            update_dict["title_en"] = data.title_en
        if data.title_ru is not None:
            update_dict["title_ru"] = data.title_ru
        if data.description_el is not None:
            update_dict["description_el"] = data.description_el
        if data.description_en is not None:
            update_dict["description_en"] = data.description_en
        if data.description_ru is not None:
            update_dict["description_ru"] = data.description_ru
        if data.publication_date is not None:
            update_dict["publication_date"] = data.publication_date
        if data.original_article_url is not None:
            update_dict["original_article_url"] = str(data.original_article_url)
        return update_dict

    async def _handle_image_update(
        self,
        data: NewsItemUpdate,
        news_item: NewsItem,
        update_dict: dict[str, Any],
    ) -> Optional[str]:
        """Handle image replacement if source_image_url is provided.

        Args:
            data: Update data with optional source_image_url
            news_item: Existing news item
            update_dict: Dictionary to add new image_s3_key to

        Returns:
            Old S3 key to delete after commit, or None if no image update
        """
        if data.source_image_url is None:
            return None

        # Download new image
        image_data, content_type = await self._download_image(str(data.source_image_url))

        # Generate new S3 key
        ext = CONTENT_TYPE_TO_EXT.get(content_type, "jpg")
        new_s3_key = f"{NEWS_IMAGES_PREFIX}/{uuid4()}.{ext}"

        # Upload new image
        upload_success = self.s3_service.upload_object(new_s3_key, image_data, content_type)
        if not upload_success:
            raise ValueError("Failed to upload new image to S3")

        # Add to update dict and return old key for cleanup
        update_dict["image_s3_key"] = new_s3_key
        return news_item.image_s3_key

    async def _download_image(self, url: str) -> tuple[bytes, str]:
        """Download image from URL and validate.

        Args:
            url: URL to download image from

        Returns:
            Tuple of (image_bytes, content_type)

        Raises:
            ValueError: If download fails, content-type invalid, or size exceeds limit
        """
        logger.debug(
            "Downloading image from URL",
            extra={"url": url},
        )

        try:
            async with httpx.AsyncClient(timeout=IMAGE_DOWNLOAD_TIMEOUT_SECONDS) as client:
                response = await client.get(url)
                response.raise_for_status()

                # Validate content-type
                content_type = response.headers.get("content-type", "").split(";")[0].strip()
                if content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
                    raise ValueError(
                        f"Invalid image content-type: {content_type}. "
                        f"Allowed: {', '.join(ALLOWED_IMAGE_CONTENT_TYPES)}"
                    )

                # Validate size
                image_data = response.content
                if len(image_data) > MAX_IMAGE_SIZE_BYTES:
                    raise ValueError(
                        f"Image size {len(image_data)} bytes exceeds maximum "
                        f"{MAX_IMAGE_SIZE_BYTES} bytes (5MB)"
                    )

                logger.debug(
                    "Image downloaded successfully",
                    extra={
                        "url": url,
                        "content_type": content_type,
                        "size_bytes": len(image_data),
                    },
                )

                return image_data, content_type

        except httpx.HTTPStatusError as e:
            raise ValueError(f"Failed to download image: HTTP {e.response.status_code}")
        except httpx.RequestError as e:
            raise ValueError(f"Failed to download image: {str(e)}")

    def _to_response(self, news_item: NewsItem) -> NewsItemResponse:
        """Convert NewsItem model to response schema with presigned URL.

        Args:
            news_item: NewsItem database model

        Returns:
            NewsItemResponse with presigned image URL
        """
        # Generate presigned URL for the image
        image_url = self.s3_service.generate_presigned_url(news_item.image_s3_key)

        return NewsItemResponse(
            id=news_item.id,
            title_el=news_item.title_el,
            title_en=news_item.title_en,
            title_ru=news_item.title_ru,
            description_el=news_item.description_el,
            description_en=news_item.description_en,
            description_ru=news_item.description_ru,
            publication_date=news_item.publication_date,
            original_article_url=news_item.original_article_url,
            image_url=image_url,
            created_at=news_item.created_at,
            updated_at=news_item.updated_at,
        )


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["NewsItemService"]
