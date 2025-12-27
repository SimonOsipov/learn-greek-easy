"""CultureQuestion repository with deck relationships."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureQuestion
from src.repositories.base import BaseRepository


class CultureQuestionRepository(BaseRepository[CultureQuestion]):
    """Repository for CultureQuestion model with deck filtering.

    Provides database operations for culture questions including:
    - Get questions by deck
    - Bulk create questions
    - Count questions by deck
    """

    def __init__(self, db: AsyncSession):
        """Initialize the CultureQuestion repository.

        Args:
            db: Async database session for persistence operations
        """
        super().__init__(CultureQuestion, db)

    async def get_by_deck(
        self,
        deck_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[CultureQuestion]:
        """Get all questions for a specific deck.

        Args:
            deck_id: Deck UUID
            skip: Pagination offset
            limit: Max results

        Returns:
            List of questions ordered by order_index

        Use Case:
            Admin question management, deck review
        """
        query = (
            select(CultureQuestion)
            .where(CultureQuestion.deck_id == deck_id)
            .order_by(CultureQuestion.order_index)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def bulk_create(self, questions_data: list[dict]) -> list[CultureQuestion]:
        """Create multiple questions in one transaction.

        Args:
            questions_data: List of question dictionaries

        Returns:
            List of created questions (not yet committed)

        Use Case:
            Deck import, bulk question creation
        """
        questions = [CultureQuestion(**question_data) for question_data in questions_data]
        self.db.add_all(questions)
        await self.db.flush()
        return questions

    async def count_by_deck(self, deck_id: UUID) -> int:
        """Count total questions in a deck.

        Args:
            deck_id: Deck UUID

        Returns:
            Total number of questions in the deck

        Use Case:
            Pagination for question listing
        """
        query = (
            select(func.count())
            .select_from(CultureQuestion)
            .where(CultureQuestion.deck_id == deck_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one()


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["CultureQuestionRepository"]
