"""Service for fetching HTML content from news sources.

This service provides:
1. Fetch HTML from news source URLs
2. Store fetch history with success/error status
3. Retrieve fetch history for a source
4. Get specific history entry with HTML content

Example Usage:
    async with get_db_session() as db:
        service = SourceFetchService(db)
        history = await service.fetch_source(source_id, trigger_type="manual")
"""

from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundException
from src.core.logging import get_logger
from src.db.models import SourceFetchHistory
from src.repositories.news_source import NewsSourceRepository
from src.repositories.source_fetch_history import SourceFetchHistoryRepository

logger = get_logger(__name__)

# HTTP client configuration
FETCH_TIMEOUT = 30.0
MAX_REDIRECTS = 5
USER_AGENT = "LearnGreekEasy/1.0 (News Scraper Bot)"


class SourceFetchService:
    """Service for fetching HTML from news sources.

    Provides business logic for HTML fetching including:
    - Fetch HTML and store results
    - Track fetch history
    - Handle errors gracefully

    Attributes:
        db: Async database session
        source_repo: Repository for NewsSource operations
        history_repo: Repository for SourceFetchHistory operations
    """

    def __init__(self, db: AsyncSession):
        """Initialize the Source Fetch service.

        Args:
            db: Async database session for persistence operations
        """
        self.db = db
        self.source_repo = NewsSourceRepository(db)
        self.history_repo = SourceFetchHistoryRepository(db)

    async def fetch_source(
        self,
        source_id: UUID,
        trigger_type: str = "manual",
    ) -> SourceFetchHistory:
        """Fetch HTML from a news source and store result.

        Args:
            source_id: UUID of the news source
            trigger_type: "manual" or "scheduled"

        Returns:
            SourceFetchHistory entry with result

        Raises:
            NotFoundException: If source not found
        """
        # Get source
        source = await self.source_repo.get(source_id)
        if not source:
            raise NotFoundException(
                resource="NewsSource",
                detail=f"Source with ID '{source_id}' not found",
            )

        logger.info(
            "Fetching HTML from source",
            extra={
                "source_id": str(source_id),
                "source_name": source.name,
                "url": source.url,
                "trigger_type": trigger_type,
            },
        )

        # Fetch HTML
        html_content, final_url, error_message = await self._fetch_html(source.url)

        # Create history entry
        if html_content is not None:
            history = SourceFetchHistory(
                source_id=source_id,
                fetched_at=datetime.now(timezone.utc),
                status="success",
                html_content=html_content,
                html_size_bytes=len(html_content.encode("utf-8")),
                trigger_type=trigger_type,
                final_url=final_url,
                # Set analysis as pending (will be triggered by API endpoint)
                analysis_status="pending",
            )
            logger.info(
                "Fetch successful",
                extra={
                    "source_id": str(source_id),
                    "html_size_bytes": history.html_size_bytes,
                    "final_url": final_url,
                },
            )
        else:
            history = SourceFetchHistory(
                source_id=source_id,
                fetched_at=datetime.now(timezone.utc),
                status="error",
                error_message=error_message,
                trigger_type=trigger_type,
            )
            logger.warning(
                "Fetch failed",
                extra={
                    "source_id": str(source_id),
                    "error_message": error_message,
                },
            )

        self.db.add(history)
        await self.db.flush()

        return history

    async def _fetch_html(self, url: str) -> tuple[str | None, str | None, str | None]:
        """Fetch HTML from URL.

        Args:
            url: The URL to fetch HTML from

        Returns:
            Tuple of (html_content, final_url, error_message)
            - On success: (html, final_url, None)
            - On error: (None, None, error_message)
        """
        async with httpx.AsyncClient(
            timeout=FETCH_TIMEOUT,
            follow_redirects=True,
            max_redirects=MAX_REDIRECTS,
            headers={"User-Agent": USER_AGENT},
        ) as client:
            try:
                response = await client.get(url)
                response.raise_for_status()
                return response.text, str(response.url), None
            except httpx.TimeoutException:
                return None, None, f"Connection timeout after {FETCH_TIMEOUT}s"
            except httpx.HTTPStatusError as e:
                return None, None, f"HTTP {e.response.status_code}"
            except httpx.RequestError as e:
                return None, None, str(e)

    async def get_history(
        self,
        source_id: UUID,
        limit: int = 10,
    ) -> tuple[list[SourceFetchHistory], int]:
        """Get fetch history for a source.

        Args:
            source_id: Source UUID
            limit: Max results

        Returns:
            Tuple of (history list, total count)

        Raises:
            NotFoundException: If source not found
        """
        # Verify source exists
        source = await self.source_repo.get(source_id)
        if not source:
            raise NotFoundException(
                resource="NewsSource",
                detail=f"Source with ID '{source_id}' not found",
            )

        items = await self.history_repo.list_by_source(source_id, limit=limit)
        total = await self.history_repo.count_by_source(source_id)
        return items, total

    async def get_history_html(self, history_id: UUID) -> SourceFetchHistory:
        """Get a specific history entry with HTML content.

        Args:
            history_id: History entry UUID

        Returns:
            SourceFetchHistory with html_content

        Raises:
            NotFoundException: If entry not found or has no HTML
        """
        history = await self.history_repo.get(history_id)
        if not history:
            raise NotFoundException(
                resource="SourceFetchHistory",
                detail=f"History entry with ID '{history_id}' not found",
            )
        if history.html_content is None:
            raise NotFoundException(
                resource="SourceFetchHistory",
                detail=f"History entry '{history_id}' has no HTML content (fetch failed)",
            )
        return history


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["SourceFetchService"]
