"""Culture Deck Service for culture exam deck operations.

This service provides:
1. List culture decks with optional filtering
2. Get deck details with question count
3. Progress tracking for authenticated users
4. Admin CRUD operations (create, update, soft delete)

Example Usage:
    async with get_db_session() as db:
        service = CultureDeckService(db)
        decks = await service.list_decks(user_id=user.id)

        # Admin operations
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

    async def _build_deck_response(
        self,
        deck: "CultureDeck",
        user_id: Optional[UUID] = None,
    ) -> CultureDeckResponse:
        """Build a CultureDeckResponse from a deck model.

        Args:
            deck: CultureDeck model instance
            user_id: Optional user UUID for progress

        Returns:
            CultureDeckResponse with all fields populated
        """
        # Get question count
        question_count = await self.deck_repo.count_questions(deck.id)

        # Get progress if user is authenticated
        progress = None
        if user_id:
            progress = await self._get_deck_progress(user_id, deck.id)

        return CultureDeckResponse(
            id=deck.id,
            name=deck.name,
            description=deck.description,
            icon=deck.icon,
            color_accent=deck.color_accent,
            category=deck.category,
            question_count=question_count,
            progress=progress,
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
    ) -> CultureDeckListResponse:
        """List culture decks with optional filtering and pagination.

        Args:
            page: Page number (1-indexed)
            page_size: Number of items per page
            category: Optional category filter
            user_id: Optional user UUID for progress data

        Returns:
            CultureDeckListResponse with paginated decks

        Note:
            - Only active decks are returned
            - If user_id provided, includes progress for each deck
            - Anonymous users receive decks without progress
        """
        skip = (page - 1) * page_size

        logger.debug(
            "Listing culture decks",
            extra={
                "page": page,
                "page_size": page_size,
                "category": category,
                "user_id": str(user_id) if user_id else None,
            },
        )

        # Get decks and total count
        decks = await self.deck_repo.list_active(
            skip=skip,
            limit=page_size,
            category=category,
        )
        total = await self.deck_repo.count_active(category=category)

        # Build response for each deck
        deck_responses = []
        for deck in decks:
            response = await self._build_deck_response(deck, user_id)
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
    ) -> CultureDeckDetailResponse:
        """Get a culture deck by ID with details.

        Args:
            deck_id: Deck UUID
            user_id: Optional user UUID for progress data

        Returns:
            CultureDeckDetailResponse with full deck details

        Raises:
            CultureDeckNotFoundException: If deck doesn't exist or is inactive
        """
        logger.debug(
            "Getting culture deck",
            extra={
                "deck_id": str(deck_id),
                "user_id": str(user_id) if user_id else None,
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

        return CultureDeckDetailResponse(
            id=deck.id,
            name=deck.name,
            description=deck.description,
            icon=deck.icon,
            color_accent=deck.color_accent,
            category=deck.category,
            question_count=question_count,
            progress=progress,
            is_active=deck.is_active,
            created_at=deck.created_at,
            updated_at=deck.updated_at,
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
    ) -> CultureDeckDetailResponse:
        """Create a new culture deck.

        Args:
            deck_data: Deck creation data with multilingual fields

        Returns:
            CultureDeckDetailResponse with created deck details

        Note:
            - Requires superuser privileges (enforced in router)
            - Transaction commit must be done by caller
        """
        logger.info(
            "Creating culture deck",
            extra={
                "category": deck_data.category,
                "icon": deck_data.icon,
            },
        )

        # Convert Pydantic model to dict, then MultilingualText to dict
        deck_dict = {
            "name": deck_data.name.model_dump(),
            "description": deck_data.description.model_dump(),
            "icon": deck_data.icon,
            "color_accent": deck_data.color_accent,
            "category": deck_data.category,
            "order_index": deck_data.order_index,
            "is_active": True,
        }

        # Create deck using repository
        deck = await self.deck_repo.create(deck_dict)

        logger.info(
            "Culture deck created",
            extra={
                "deck_id": str(deck.id),
                "category": deck.category,
            },
        )

        return CultureDeckDetailResponse(
            id=deck.id,
            name=deck.name,
            description=deck.description,
            icon=deck.icon,
            color_accent=deck.color_accent,
            category=deck.category,
            question_count=0,  # New deck has no questions
            progress=None,
            is_active=deck.is_active,
            created_at=deck.created_at,
            updated_at=deck.updated_at,
        )

    async def update_deck(
        self,
        deck_id: UUID,
        deck_data: CultureDeckUpdate,
    ) -> "CultureDeck":
        """Update an existing culture deck.

        Args:
            deck_id: UUID of deck to update
            deck_data: Fields to update (all optional)

        Returns:
            Updated CultureDeck SQLAlchemy model (not committed)

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

        # Build update dict, converting MultilingualText to dict
        update_dict = {}
        for field, value in deck_data.model_dump(exclude_unset=True).items():
            if field in ("name", "description") and value is not None:
                # MultilingualText needs to be converted to dict
                update_dict[field] = value
            else:
                update_dict[field] = value

        # Update deck using repository
        updated_deck = await self.deck_repo.update(deck, update_dict)

        logger.info(
            "Culture deck updated",
            extra={
                "deck_id": str(deck_id),
                "updated_fields": list(update_dict.keys()),
            },
        )

        return updated_deck

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
