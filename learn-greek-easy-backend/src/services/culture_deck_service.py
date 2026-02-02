"""Culture Deck Service for culture exam deck operations.

This service provides:
1. List culture decks with optional filtering and localization
2. Get deck details with question count and localization
3. Progress tracking for authenticated users
4. Admin CRUD operations (create, update, soft delete)

Example Usage:
    async with get_db_session() as db:
        service = CultureDeckService(db)
        # Public endpoints with localization
        decks = await service.list_decks(user_id=user.id, locale="el")

        # Admin operations (return all languages)
        deck = await service.create_deck(deck_data)
        updated = await service.update_deck(deck_id, update_data)
        await service.soft_delete_deck(deck_id)
"""

from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import CultureDeckNotFoundException
from src.core.logging import get_logger
from src.repositories import CultureDeckRepository, CultureQuestionStatsRepository
from src.schemas.culture import (
    CultureDeckAdminResponse,
    CultureDeckCreate,
    CultureDeckDetailResponse,
    CultureDeckListResponse,
    CultureDeckProgress,
    CultureDeckResponse,
    CultureDeckUpdate,
)

if TYPE_CHECKING:
    from src.db.models import CultureDeck

logger = get_logger(__name__)

# Supported locales with English as fallback (matches ChangelogService pattern)
SUPPORTED_LOCALES = frozenset(["en", "el", "ru"])
DEFAULT_LOCALE = "en"


class CultureDeckService:
    """Service for culture deck operations.

    Provides business logic for culture exam deck management including
    deck listing, detail retrieval, and progress tracking.

    Attributes:
        db: Async database session
        deck_repo: Repository for CultureDeck operations
        stats_repo: Repository for CultureQuestionStats operations
    """

    def __init__(self, db: AsyncSession):
        """Initialize the Culture Deck service.

        Args:
            db: Async database session for persistence operations
        """
        self.db = db
        self.deck_repo = CultureDeckRepository(db)
        self.stats_repo = CultureQuestionStatsRepository(db)

    # =========================================================================
    # Helper Methods
    # =========================================================================

    async def _get_deck_progress(
        self,
        user_id: UUID,
        deck_id: UUID,
    ) -> Optional[CultureDeckProgress]:
        """Get progress for a specific deck and user.

        Args:
            user_id: User UUID
            deck_id: Deck UUID

        Returns:
            CultureDeckProgress if user has started the deck, None otherwise
        """
        # Check if user has any progress for this deck
        has_started = await self.stats_repo.has_user_started_deck(user_id, deck_id)
        if not has_started:
            return None

        # Get progress stats
        progress_data = await self.stats_repo.get_deck_progress(user_id, deck_id)
        last_practiced = await self.stats_repo.get_last_practiced_at(user_id, deck_id)

        return CultureDeckProgress(
            questions_total=progress_data["questions_total"],
            questions_mastered=progress_data["questions_mastered"],
            questions_learning=progress_data["questions_learning"],
            questions_new=progress_data["questions_new"],
            last_practiced_at=last_practiced,
        )

    def _get_localized_text(
        self,
        field_en: Optional[str],
        field_el: Optional[str],
        field_ru: Optional[str],
        locale: str,
    ) -> Optional[str]:
        """Get text for the specified locale with English fallback.

        Args:
            field_en: English text
            field_el: Greek text
            field_ru: Russian text
            locale: Target locale (en, el, ru)

        Returns:
            Localized text or None if all fields are None
        """
        if locale == "el":
            return field_el or field_en
        elif locale == "ru":
            return field_ru or field_en
        return field_en

    async def _build_localized_deck_response(
        self,
        deck: "CultureDeck",
        locale: str,
        user_id: Optional[UUID] = None,
    ) -> CultureDeckResponse:
        """Build a localized CultureDeckResponse from a deck model.

        Args:
            deck: CultureDeck model instance
            locale: Target locale (en, el, ru)
            user_id: Optional user UUID for progress

        Returns:
            CultureDeckResponse with single-language content
        """
        # Get question count
        question_count = await self.deck_repo.count_questions(deck.id)

        # Get progress if user is authenticated
        progress = None
        if user_id:
            progress = await self._get_deck_progress(user_id, deck.id)

        return CultureDeckResponse(
            id=deck.id,
            name=self._get_localized_text(deck.name_en, deck.name_el, deck.name_ru, locale),
            description=self._get_localized_text(
                deck.description_en, deck.description_el, deck.description_ru, locale
            ),
            category=deck.category,
            question_count=question_count,
            is_premium=deck.is_premium,
            progress=progress,
        )

    def _build_localized_detail_response(
        self,
        deck: "CultureDeck",
        question_count: int,
        progress: Optional[CultureDeckProgress],
        locale: str,
    ) -> CultureDeckDetailResponse:
        """Build a localized CultureDeckDetailResponse.

        Args:
            deck: CultureDeck model instance
            question_count: Number of questions in deck
            progress: User progress (if authenticated)
            locale: Target locale (en, el, ru)

        Returns:
            CultureDeckDetailResponse with single-language content
        """
        return CultureDeckDetailResponse(
            id=deck.id,
            name=self._get_localized_text(deck.name_en, deck.name_el, deck.name_ru, locale),
            description=self._get_localized_text(
                deck.description_en, deck.description_el, deck.description_ru, locale
            ),
            category=deck.category,
            question_count=question_count,
            is_premium=deck.is_premium,
            progress=progress,
            is_active=deck.is_active,
            created_at=deck.created_at,
            updated_at=deck.updated_at,
        )

    # =========================================================================
    # Public Methods
    # =========================================================================

    async def list_decks(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        category: Optional[str] = None,
        user_id: Optional[UUID] = None,
        locale: str = "en",
    ) -> CultureDeckListResponse:
        """List culture decks with optional filtering, pagination, and localization.

        Args:
            page: Page number (1-indexed)
            page_size: Number of items per page
            category: Optional category filter
            user_id: Optional user UUID for progress data
            locale: Language code (en, el, ru). Falls back to 'en' if unsupported.

        Returns:
            CultureDeckListResponse with paginated localized decks

        Note:
            - Only active decks are returned
            - If user_id provided, includes progress for each deck
            - Anonymous users receive decks without progress
        """
        # Normalize locale with fallback
        normalized_locale = locale if locale in SUPPORTED_LOCALES else DEFAULT_LOCALE

        skip = (page - 1) * page_size

        logger.debug(
            "Listing culture decks",
            extra={
                "page": page,
                "page_size": page_size,
                "category": category,
                "user_id": str(user_id) if user_id else None,
                "locale": normalized_locale,
            },
        )

        # Get decks and total count
        decks = await self.deck_repo.list_active(
            skip=skip,
            limit=page_size,
            category=category,
        )
        total = await self.deck_repo.count_active(category=category)

        # Build response for each deck with locale
        deck_responses = []
        for deck in decks:
            response = await self._build_localized_deck_response(deck, normalized_locale, user_id)
            deck_responses.append(response)

        logger.info(
            "Culture decks listed successfully",
            extra={
                "total": total,
                "returned": len(deck_responses),
                "category": category,
            },
        )

        return CultureDeckListResponse(
            total=total,
            decks=deck_responses,
        )

    async def get_deck(
        self,
        deck_id: UUID,
        user_id: Optional[UUID] = None,
        locale: str = "en",
    ) -> CultureDeckDetailResponse:
        """Get a culture deck by ID with localized details.

        Args:
            deck_id: Deck UUID
            user_id: Optional user UUID for progress data
            locale: Language code (en, el, ru). Falls back to 'en' if unsupported.

        Returns:
            CultureDeckDetailResponse with localized content

        Raises:
            CultureDeckNotFoundException: If deck doesn't exist or is inactive
        """
        # Normalize locale with fallback
        normalized_locale = locale if locale in SUPPORTED_LOCALES else DEFAULT_LOCALE

        logger.debug(
            "Getting culture deck",
            extra={
                "deck_id": str(deck_id),
                "user_id": str(user_id) if user_id else None,
                "locale": normalized_locale,
            },
        )

        # Get deck
        deck = await self.deck_repo.get(deck_id)

        # Return 404 for non-existent or inactive decks
        if deck is None or not deck.is_active:
            raise CultureDeckNotFoundException(deck_id=str(deck_id))

        # Get question count
        question_count = await self.deck_repo.count_questions(deck_id)

        # Get progress if user is authenticated
        progress = None
        if user_id:
            progress = await self._get_deck_progress(user_id, deck_id)

        logger.info(
            "Culture deck retrieved successfully",
            extra={
                "deck_id": str(deck_id),
                "question_count": question_count,
                "has_progress": progress is not None,
            },
        )

        return self._build_localized_detail_response(
            deck, question_count, progress, normalized_locale
        )

    async def get_categories(self) -> list[str]:
        """Get all available culture deck categories.

        Returns:
            List of unique category names

        Use Case:
            Populate category filter dropdown in UI
        """
        categories = await self.deck_repo.get_categories()
        logger.debug(
            "Retrieved culture categories",
            extra={"count": len(categories)},
        )
        return categories

    # =========================================================================
    # Admin CRUD Methods
    # =========================================================================

    async def create_deck(
        self,
        deck_data: CultureDeckCreate,
    ) -> CultureDeckAdminResponse:
        """Create a new culture deck.

        Args:
            deck_data: Deck creation data with all language fields

        Returns:
            CultureDeckAdminResponse with all language fields

        Note:
            - Requires superuser privileges (enforced in router)
            - Transaction commit must be done by caller
        """
        logger.info(
            "Creating culture deck",
            extra={
                "category": deck_data.category,
            },
        )

        # Convert Pydantic model to dict with multilingual fields
        deck_dict = {
            "name_en": deck_data.name_en,
            "name_el": deck_data.name_el,
            "name_ru": deck_data.name_ru,
            "description_en": deck_data.description_en,
            "description_el": deck_data.description_el,
            "description_ru": deck_data.description_ru,
            "category": deck_data.category,
            "order_index": deck_data.order_index,
            "is_active": True,
            "is_premium": deck_data.is_premium,
        }

        # Create deck using repository
        deck = await self.deck_repo.create(deck_dict)

        # Refresh to get database-generated values (e.g., created_at, updated_at)
        await self.db.refresh(deck)

        logger.info(
            "Culture deck created",
            extra={
                "deck_id": str(deck.id),
                "category": deck.category,
            },
        )

        return CultureDeckAdminResponse(
            id=deck.id,
            name_en=deck.name_en,
            name_el=deck.name_el,
            name_ru=deck.name_ru,
            description_en=deck.description_en,
            description_el=deck.description_el,
            description_ru=deck.description_ru,
            category=deck.category,
            question_count=0,  # New deck has no questions
            is_premium=deck.is_premium,
            is_active=deck.is_active,
            order_index=deck.order_index,
            created_at=deck.created_at,
            updated_at=deck.updated_at,
        )

    async def update_deck(
        self,
        deck_id: UUID,
        deck_data: CultureDeckUpdate,
    ) -> CultureDeckAdminResponse:
        """Update an existing culture deck.

        Args:
            deck_id: UUID of deck to update
            deck_data: Fields to update (all optional)

        Returns:
            CultureDeckAdminResponse with all language fields

        Raises:
            CultureDeckNotFoundException: If deck doesn't exist

        Note:
            - Requires superuser privileges (enforced in router)
            - Can update inactive decks (admin privilege)
            - Caller must commit and refresh
        """
        logger.debug(
            "Updating culture deck",
            extra={"deck_id": str(deck_id)},
        )

        # Get existing deck (don't filter by is_active)
        deck = await self.deck_repo.get(deck_id)
        if deck is None:
            raise CultureDeckNotFoundException(deck_id=str(deck_id))

        # Build update dict from only the fields that were set
        update_dict = deck_data.model_dump(exclude_unset=True)

        # Update deck using repository
        updated_deck = await self.deck_repo.update(deck, update_dict)

        # Refresh to get database-generated values (e.g., updated_at)
        await self.db.refresh(updated_deck)

        # Get question count for response
        question_count = await self.deck_repo.count_questions(deck_id)

        logger.info(
            "Culture deck updated",
            extra={
                "deck_id": str(deck_id),
                "updated_fields": list(update_dict.keys()),
            },
        )

        return CultureDeckAdminResponse(
            id=updated_deck.id,
            name_en=updated_deck.name_en,
            name_el=updated_deck.name_el,
            name_ru=updated_deck.name_ru,
            description_en=updated_deck.description_en,
            description_el=updated_deck.description_el,
            description_ru=updated_deck.description_ru,
            category=updated_deck.category,
            question_count=question_count,
            is_premium=updated_deck.is_premium,
            is_active=updated_deck.is_active,
            order_index=updated_deck.order_index,
            created_at=updated_deck.created_at,
            updated_at=updated_deck.updated_at,
        )

    async def soft_delete_deck(self, deck_id: UUID) -> None:
        """Soft delete a culture deck by setting is_active to False.

        Args:
            deck_id: UUID of deck to delete

        Raises:
            CultureDeckNotFoundException: If deck doesn't exist

        Note:
            - Requires superuser privileges (enforced in router)
            - Idempotent: deleting already-inactive deck is allowed
            - Does NOT physically delete - preserves data
        """
        logger.debug(
            "Soft deleting culture deck",
            extra={"deck_id": str(deck_id)},
        )

        # Get existing deck (don't filter by is_active)
        deck = await self.deck_repo.get(deck_id)
        if deck is None:
            raise CultureDeckNotFoundException(deck_id=str(deck_id))

        # Soft delete by setting is_active to False
        deck.is_active = False

        logger.info(
            "Culture deck soft deleted",
            extra={"deck_id": str(deck_id)},
        )


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["CultureDeckService"]
