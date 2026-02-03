"""Service layer for changelog operations.

This service handles:
- Public changelog listing with localization
- Admin CRUD operations
- Pagination with page-based interface
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundException
from src.core.logging import get_logger
from src.db.models import ChangelogEntry
from src.repositories.changelog import ChangelogRepository
from src.schemas.changelog import (
    ChangelogAdminListResponse,
    ChangelogEntryAdminResponse,
    ChangelogEntryCreate,
    ChangelogEntryUpdate,
    ChangelogItemResponse,
    ChangelogListResponse,
)

logger = get_logger(__name__)

# Supported locales with English as fallback
SUPPORTED_LOCALES = frozenset(["en", "ru"])
DEFAULT_LOCALE = "en"


class ChangelogService:
    """Service for changelog business logic.

    Provides:
    - Public list with localization (single language based on locale)
    - Admin list with all language fields
    - CRUD operations for admin management
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the Changelog service.

        Args:
            db: Async database session for persistence operations
        """
        self.db = db
        self.repo = ChangelogRepository(db)

    # =========================================================================
    # Public Operations
    # =========================================================================

    async def get_public_list(
        self,
        *,
        page: int = 1,
        page_size: int = 5,
        locale: str = "en",
    ) -> ChangelogListResponse:
        """Get paginated changelog entries with localized content.

        Args:
            page: Page number (1-indexed)
            page_size: Items per page (default 5 for public view)
            locale: Language code (en, ru). Falls back to 'en' if unsupported.

        Returns:
            Paginated list of localized changelog entries
        """
        # Normalize locale with fallback
        normalized_locale = locale if locale in SUPPORTED_LOCALES else DEFAULT_LOCALE

        # Convert page to skip/limit for repository
        skip = (page - 1) * page_size
        entries = await self.repo.get_list(skip=skip, limit=page_size)
        total = await self.repo.count_all()

        # Map entries to localized response
        items = [self._to_public_response(entry, normalized_locale) for entry in entries]

        return ChangelogListResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=items,
        )

    def _to_public_response(
        self,
        entry: ChangelogEntry,
        locale: str,
    ) -> ChangelogItemResponse:
        """Convert ChangelogEntry to localized public response."""
        title, content = self._get_localized_content(entry, locale)
        return ChangelogItemResponse(
            id=entry.id,
            title=title,
            content=content,
            tag=entry.tag,
            created_at=entry.created_at,
            updated_at=entry.updated_at,
        )

    def _get_localized_content(
        self,
        entry: ChangelogEntry,
        locale: str,
    ) -> tuple[str, str]:
        """Get title and content for the specified locale."""
        if locale == "ru":
            return entry.title_ru, entry.content_ru
        return entry.title_en, entry.content_en

    # =========================================================================
    # Admin Operations
    # =========================================================================

    async def get_admin_list(
        self,
        *,
        page: int = 1,
        page_size: int = 10,
    ) -> ChangelogAdminListResponse:
        """Get paginated changelog entries with all language fields (admin).

        Args:
            page: Page number (1-indexed)
            page_size: Items per page (default 10 for admin view)

        Returns:
            Paginated list of full changelog entries with all languages
        """
        skip = (page - 1) * page_size
        entries = await self.repo.get_list(skip=skip, limit=page_size)
        total = await self.repo.count_all()

        items = [ChangelogEntryAdminResponse.model_validate(entry) for entry in entries]

        return ChangelogAdminListResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=items,
        )

    async def get_by_id(self, entry_id: UUID) -> ChangelogEntryAdminResponse:
        """Get a single changelog entry by ID.

        Args:
            entry_id: UUID of the entry

        Returns:
            Full changelog entry with all languages

        Raises:
            NotFoundException: If entry doesn't exist
        """
        entry = await self.repo.get(entry_id)
        if entry is None:
            raise NotFoundException(
                resource="ChangelogEntry",
                detail=f"Changelog entry with ID '{entry_id}' not found",
            )
        return ChangelogEntryAdminResponse.model_validate(entry)

    async def create(
        self,
        data: ChangelogEntryCreate,
    ) -> ChangelogEntryAdminResponse:
        """Create a new changelog entry.

        Args:
            data: Creation data with all language fields and tag

        Returns:
            Created changelog entry
        """
        logger.info(
            "Creating changelog entry",
            extra={"tag": data.tag.value},
        )

        # Pass dict to BaseRepository.create()
        entry_dict = {
            "title_en": data.title_en,
            "title_ru": data.title_ru,
            "content_en": data.content_en,
            "content_ru": data.content_ru,
            "tag": data.tag,
        }
        entry = await self.repo.create(entry_dict)
        await self.db.commit()
        await self.db.refresh(entry)

        logger.info(
            "Changelog entry created",
            extra={"entry_id": str(entry.id)},
        )

        return ChangelogEntryAdminResponse.model_validate(entry)

    async def update(
        self,
        entry_id: UUID,
        data: ChangelogEntryUpdate,
    ) -> ChangelogEntryAdminResponse:
        """Update an existing changelog entry.

        Only fields present in data (non-None) are updated.

        Args:
            entry_id: UUID of the entry to update
            data: Update data (all fields optional)

        Returns:
            Updated changelog entry

        Raises:
            NotFoundException: If entry doesn't exist
        """
        entry = await self.repo.get(entry_id)
        if entry is None:
            raise NotFoundException(
                resource="ChangelogEntry",
                detail=f"Changelog entry with ID '{entry_id}' not found",
            )

        logger.debug(
            "Updating changelog entry",
            extra={"entry_id": str(entry_id)},
        )

        # BaseRepository.update() handles partial updates via exclude_unset
        update_data = data.model_dump(exclude_unset=True)
        updated = await self.repo.update(entry, update_data)
        await self.db.commit()
        await self.db.refresh(updated)

        logger.info(
            "Changelog entry updated",
            extra={"entry_id": str(entry_id)},
        )

        return ChangelogEntryAdminResponse.model_validate(updated)

    async def delete(self, entry_id: UUID) -> None:
        """Delete a changelog entry.

        Args:
            entry_id: UUID of the entry to delete

        Raises:
            NotFoundException: If entry doesn't exist
        """
        entry = await self.repo.get(entry_id)
        if entry is None:
            raise NotFoundException(
                resource="ChangelogEntry",
                detail=f"Changelog entry with ID '{entry_id}' not found",
            )

        logger.debug(
            "Deleting changelog entry",
            extra={"entry_id": str(entry_id)},
        )

        await self.repo.delete(entry)
        await self.db.commit()

        logger.info(
            "Changelog entry deleted",
            extra={"entry_id": str(entry_id)},
        )


__all__ = ["ChangelogService"]
