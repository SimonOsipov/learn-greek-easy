"""Card repository with deck relationships."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Card, CardDifficulty
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
            List of cards ordered by order_index

        Use Case:
            Study session, deck review
        """
        query = (
            select(Card)
            .where(Card.deck_id == deck_id)
            .order_by(Card.order_index)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_difficulty(
        self,
        deck_id: UUID,
        difficulty: CardDifficulty,
    ) -> list[Card]:
        """Get cards filtered by difficulty level.

        Args:
            deck_id: Deck UUID
            difficulty: Card difficulty (easy, medium, hard)

        Returns:
            List of cards with specified difficulty

        Use Case:
            Progressive learning (start with easy cards)
        """
        query = (
            select(Card)
            .where(Card.deck_id == deck_id)
            .where(Card.difficulty == difficulty)
            .order_by(Card.order_index)
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
