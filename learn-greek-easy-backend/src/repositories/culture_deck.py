"""CultureDeck repository with filtering and question relationships."""

from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import CultureDeck, CultureQuestion
from src.repositories.base import BaseRepository


class CultureDeckRepository(BaseRepository[CultureDeck]):
    """Repository for CultureDeck model with filtering and search.

    Provides database operations for culture exam decks including:
    - List active decks with optional category filter
    - Count decks for pagination
    - Get deck with questions eagerly loaded
    - Count questions in a deck
    """

    def __init__(self, db: AsyncSession):
        """Initialize the CultureDeck repository.

        Args:
            db: Async database session for persistence operations
        """
        super().__init__(CultureDeck, db)

    async def list_active(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        category: Optional[str] = None,
    ) -> list[CultureDeck]:
        """List active culture decks with optional category filter.

        Args:
            skip: Pagination offset
            limit: Max results
            category: Optional category filter (history, geography, politics, culture, traditions)

        Returns:
            List of active culture decks

        Use Case:
            Browse culture decks page
        """
        query = select(CultureDeck).where(CultureDeck.is_active.is_(True))

        if category is not None:
            query = query.where(CultureDeck.category == category)

        query = query.offset(skip).limit(limit).order_by(CultureDeck.created_at.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_active(self, category: Optional[str] = None) -> int:
        """Count all active culture decks, optionally filtered by category.

        Args:
            category: Optional category filter

        Returns:
            Total number of active decks matching criteria

        Use Case:
            Pagination total count for deck listings
        """
        query = select(func.count(CultureDeck.id)).where(CultureDeck.is_active.is_(True))
        if category is not None:
            query = query.where(CultureDeck.category == category)
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_with_questions(self, deck_id: UUID) -> Optional[CultureDeck]:
        """Get culture deck with all questions eagerly loaded.

        Args:
            deck_id: Deck UUID

        Returns:
            CultureDeck with questions relationship loaded

        Use Case:
            Deck detail page, practice session initialization

        Performance:
            Uses selectinload to prevent N+1 queries
        """
        query = (
            select(CultureDeck)
            .where(CultureDeck.id == deck_id)
            .options(selectinload(CultureDeck.questions))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def count_questions(self, deck_id: UUID) -> int:
        """Count total questions in a culture deck.

        Args:
            deck_id: Deck UUID

        Returns:
            Number of questions in deck

        Use Case:
            Deck metadata, progress calculations
        """
        query = (
            select(func.count())
            .select_from(CultureQuestion)
            .where(CultureQuestion.deck_id == deck_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_categories(self) -> list[str]:
        """Get list of all distinct categories with active decks.

        Returns:
            List of unique category names

        Use Case:
            Category filter dropdown in UI
        """
        query = (
            select(CultureDeck.category)
            .where(CultureDeck.is_active.is_(True))
            .distinct()
            .order_by(CultureDeck.category)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_batch_question_counts(self, deck_ids: list[UUID]) -> dict[UUID, int]:
        """Get total question counts for multiple culture decks.

        Args:
            deck_ids: List of culture deck UUIDs to count questions for

        Returns:
            Dict mapping deck_id to question count

        Use Case:
            Batch loading deck statistics to avoid N+1 queries
        """
        if not deck_ids:
            return {}

        query = (
            select(CultureQuestion.deck_id, func.count(CultureQuestion.id).label("count"))
            .where(CultureQuestion.deck_id.in_(deck_ids))
            .group_by(CultureQuestion.deck_id)
        )
        result = await self.db.execute(query)
        return {row[0]: row[1] for row in result.all()}


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["CultureDeckRepository"]
