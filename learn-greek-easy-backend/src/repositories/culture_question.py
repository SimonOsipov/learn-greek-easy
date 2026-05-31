"""CultureQuestion repository with deck relationships."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

from src.db.models import CultureQuestion
from src.repositories.base import BaseRepository

# ---------------------------------------------------------------------------
# Columns projected by get_by_deck (admin list path, not the hot service path)
#
# EXCLUDED (proven unused by all callers of get_by_deck):
#   - embedding             1024-dim pgvector float[], biggest per-row cost
#   - embedding_model       small str, but safe to exclude
#   - embedding_updated_at  timestamp, unused by list callers
#   - source_article_url    unique AI-dedup field, not in any list schema
#
# INCLUDED (required by CultureQuestionAdminResponse and related callers):
#   id, deck_id, question_text, option_a, option_b, option_c, option_d,
#   correct_option, image_key, audio_s3_key, audio_a2_s3_key, order_index,
#   is_pending_review, original_article_url, created_at, updated_at
# ---------------------------------------------------------------------------
_GET_BY_DECK_COLUMNS = [
    CultureQuestion.id,
    CultureQuestion.deck_id,
    CultureQuestion.question_text,
    CultureQuestion.option_a,
    CultureQuestion.option_b,
    CultureQuestion.option_c,
    CultureQuestion.option_d,
    CultureQuestion.correct_option,
    CultureQuestion.image_key,
    CultureQuestion.audio_s3_key,
    CultureQuestion.audio_a2_s3_key,
    CultureQuestion.order_index,
    CultureQuestion.is_pending_review,
    CultureQuestion.original_article_url,
    CultureQuestion.created_at,
    CultureQuestion.updated_at,
]


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

        Column projection: excludes embedding (1024-dim vector), embedding_model,
        embedding_updated_at, and source_article_url — none are used by any caller
        of this method. All columns in _GET_BY_DECK_COLUMNS are included.

        Args:
            deck_id: Deck UUID
            skip: Pagination offset
            limit: Max results

        Returns:
            List of questions ordered by order_index

        Use Case:
            Admin question management, deck review

        MissingGreenlet safety:
            Only columns in _GET_BY_DECK_COLUMNS are loaded. Callers MUST NOT
            access embedding, embedding_model, embedding_updated_at, or
            source_article_url on the returned objects.
        """
        query = (
            select(CultureQuestion)
            .options(load_only(*_GET_BY_DECK_COLUMNS))
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
