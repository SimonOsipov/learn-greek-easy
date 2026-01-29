"""Card repository with deck relationships."""

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Card
from src.repositories.base import BaseRepository


class CardRepository(BaseRepository[Card]):
    """Repository for Card model with deck filtering."""

    def __init__(self, db: AsyncSession):
        super().__init__(Card, db)

    async def get_by_deck(
        self,
        deck_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Card]:
        """Get all cards for a specific deck.

        Args:
            deck_id: Deck UUID
            skip: Pagination offset
            limit: Max results

        Returns:
            List of cards ordered by created_at

        Use Case:
            Study session, deck review
        """
        query = (
            select(Card)
            .where(Card.deck_id == deck_id)
            .order_by(Card.created_at)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def bulk_create(self, cards_data: list[dict]) -> list[Card]:
        """Create multiple cards in one transaction.

        Args:
            cards_data: List of card dictionaries

        Returns:
            List of created cards (not yet committed)

        Use Case:
            Deck import, bulk card creation
        """
        cards = [Card(**card_data) for card_data in cards_data]
        self.db.add_all(cards)
        await self.db.flush()
        return cards

    async def count_by_deck(self, deck_id: UUID) -> int:
        """Count total cards in a deck.

        Args:
            deck_id: Deck UUID

        Returns:
            Total number of cards in the deck

        Use Case:
            Pagination for card listing
        """
        query = select(func.count()).select_from(Card).where(Card.deck_id == deck_id)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def search(
        self,
        query_text: str,
        deck_id: UUID | None = None,
        *,
        skip: int = 0,
        limit: int = 50,
    ) -> list[Card]:
        """Search cards by text in front_text, back_text_en, back_text_ru, example_sentence.

        Args:
            query_text: Search query (case-insensitive)
            deck_id: Optional deck filter
            skip: Pagination offset
            limit: Max results

        Returns:
            List of matching cards ordered by created_at

        Use Case:
            Search functionality for finding cards by Greek, English, or Russian text
        """
        search_pattern = f"%{query_text}%"
        query = select(Card).where(
            or_(
                Card.front_text.ilike(search_pattern),
                Card.back_text_en.ilike(search_pattern),
                Card.back_text_ru.ilike(search_pattern),
                Card.example_sentence.ilike(search_pattern),
            )
        )

        if deck_id:
            query = query.where(Card.deck_id == deck_id)

        query = query.order_by(Card.created_at).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_search(
        self,
        query_text: str,
        deck_id: UUID | None = None,
    ) -> int:
        """Count cards matching search query.

        Args:
            query_text: Search query (case-insensitive)
            deck_id: Optional deck filter

        Returns:
            Total count of matching cards

        Use Case:
            Pagination total count for search results
        """
        search_pattern = f"%{query_text}%"
        query = (
            select(func.count())
            .select_from(Card)
            .where(
                or_(
                    Card.front_text.ilike(search_pattern),
                    Card.back_text_en.ilike(search_pattern),
                    Card.back_text_ru.ilike(search_pattern),
                    Card.example_sentence.ilike(search_pattern),
                )
            )
        )

        if deck_id:
            query = query.where(Card.deck_id == deck_id)

        result = await self.db.execute(query)
        return result.scalar_one()
