"""News Source Service for news source CRUD operations.

This service provides:
1. List news sources with pagination
2. Get source details
3. Create new sources with URL uniqueness validation
4. Update existing sources
5. Delete sources

Example Usage:
    async with get_db_session() as db:
        service = NewsSourceService(db)
        sources = await service.list_sources(page=1, page_size=10)
"""

from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundException
from src.core.logging import get_logger
from src.repositories import NewsSourceRepository
from src.schemas.admin import (
    NewsSourceCreate,
    NewsSourceListResponse,
    NewsSourceResponse,
    NewsSourceUpdate,
)

logger = get_logger(__name__)


class DuplicateURLException(Exception):
    """Raised when attempting to create/update with a duplicate URL."""

    def __init__(self, url: str):
        self.url = url
        super().__init__(f"URL already exists: {url}")


class NewsSourceService:
    """Service for news source operations.

    Provides business logic for news source management including
    CRUD operations and URL uniqueness validation.

    Attributes:
        db: Async database session
        repo: Repository for NewsSource operations
    """

    def __init__(self, db: AsyncSession):
        """Initialize the News Source service.

        Args:
            db: Async database session for persistence operations
        """
        self.db = db
        self.repo = NewsSourceRepository(db)

    async def list_sources(
        self,
        *,
        page: int = 1,
        page_size: int = 10,
        is_active: Optional[bool] = None,
    ) -> NewsSourceListResponse:
        """List news sources with pagination.

        Args:
            page: Page number (1-indexed)
            page_size: Number of items per page
            is_active: Optional filter by active status

        Returns:
            NewsSourceListResponse with paginated sources
        """
        skip = (page - 1) * page_size

        logger.debug(
            "Listing news sources",
            extra={
                "page": page,
                "page_size": page_size,
                "is_active": is_active,
            },
        )

        sources = await self.repo.list_all(
            skip=skip,
            limit=page_size,
            is_active=is_active,
        )
        total = await self.repo.count_all(is_active=is_active)

        source_responses = [
            NewsSourceResponse(
                id=source.id,
                name=source.name,
                url=source.url,
                is_active=source.is_active,
                created_at=source.created_at,
                updated_at=source.updated_at,
            )
            for source in sources
        ]

        logger.info(
            "News sources listed successfully",
            extra={"total": total, "returned": len(source_responses)},
        )

        return NewsSourceListResponse(
            sources=source_responses,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get_source(self, source_id: UUID) -> NewsSourceResponse:
        """Get a news source by ID.

        Args:
            source_id: Source UUID

        Returns:
            NewsSourceResponse with source details

        Raises:
            NotFoundException: If source doesn't exist
        """
        source = await self.repo.get(source_id)

        if source is None:
            raise NotFoundException(
                resource="NewsSource",
                detail=f"News source with ID '{source_id}' not found",
            )

        return NewsSourceResponse(
            id=source.id,
            name=source.name,
            url=source.url,
            is_active=source.is_active,
            created_at=source.created_at,
            updated_at=source.updated_at,
        )

    async def create_source(
        self,
        data: NewsSourceCreate,
    ) -> NewsSourceResponse:
        """Create a new news source.

        Args:
            data: Source creation data

        Returns:
            NewsSourceResponse with created source details

        Raises:
            DuplicateURLException: If URL already exists
        """
        url_str = str(data.url)

        logger.info(
            "Creating news source",
            extra={"name": data.name, "url": url_str},
        )

        # Check URL uniqueness
        if await self.repo.url_exists(url_str):
            raise DuplicateURLException(url_str)

        # Create source using repository
        source_dict = {
            "name": data.name,
            "url": url_str,
            "is_active": data.is_active,
        }
        source = await self.repo.create(source_dict)

        logger.info(
            "News source created",
            extra={"source_id": str(source.id), "name": source.name},
        )

        return NewsSourceResponse(
            id=source.id,
            name=source.name,
            url=source.url,
            is_active=source.is_active,
            created_at=source.created_at,
            updated_at=source.updated_at,
        )

    async def update_source(
        self,
        source_id: UUID,
        data: NewsSourceUpdate,
    ) -> NewsSourceResponse:
        """Update an existing news source.

        Args:
            source_id: UUID of source to update
            data: Fields to update (all optional)

        Returns:
            NewsSourceResponse with updated source details

        Raises:
            NotFoundException: If source doesn't exist
            DuplicateURLException: If new URL already exists
        """
        logger.debug(
            "Updating news source",
            extra={"source_id": str(source_id)},
        )

        # Get existing source
        source = await self.repo.get(source_id)
        if source is None:
            raise NotFoundException(
                resource="NewsSource",
                detail=f"News source with ID '{source_id}' not found",
            )

        # Check URL uniqueness if URL is being updated
        if data.url is not None:
            url_str = str(data.url)
            if await self.repo.url_exists(url_str, exclude_id=source_id):
                raise DuplicateURLException(url_str)

        # Build update dict from only the fields that were set
        update_dict = data.model_dump(exclude_unset=True)
        if "url" in update_dict and update_dict["url"] is not None:
            update_dict["url"] = str(update_dict["url"])

        # Update source using repository
        updated_source = await self.repo.update(source, update_dict)

        logger.info(
            "News source updated",
            extra={
                "source_id": str(source_id),
                "updated_fields": list(update_dict.keys()),
            },
        )

        return NewsSourceResponse(
            id=updated_source.id,
            name=updated_source.name,
            url=updated_source.url,
            is_active=updated_source.is_active,
            created_at=updated_source.created_at,
            updated_at=updated_source.updated_at,
        )

    async def delete_source(self, source_id: UUID) -> None:
        """Delete a news source.

        Args:
            source_id: UUID of source to delete

        Raises:
            NotFoundException: If source doesn't exist
        """
        logger.debug(
            "Deleting news source",
            extra={"source_id": str(source_id)},
        )

        source = await self.repo.get(source_id)
        if source is None:
            raise NotFoundException(
                resource="NewsSource",
                detail=f"News source with ID '{source_id}' not found",
            )

        await self.repo.delete(source)

        logger.info(
            "News source deleted",
            extra={"source_id": str(source_id)},
        )


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["NewsSourceService", "DuplicateURLException"]
