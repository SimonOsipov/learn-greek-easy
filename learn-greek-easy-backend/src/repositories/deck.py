"""Deck repository with filtering and card relationships."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import Card, Deck, DeckLevel
from src.repositories.base import BaseRepository


class DeckRepository(BaseRepository[Deck]):
    """Repository for Deck model with filtering and search."""

    def __init__(self, db: AsyncSession):
        super().__init__(Deck, db)

    async def list_active(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        level: DeckLevel | None = None,
    ) -> list[Deck]:
        """List active system decks with optional level filter.

        Only returns system decks (owner_id=NULL). User-owned decks are
        excluded and should be accessed via list_user_owned().

        Args:
            skip: Pagination offset
            limit: Max results
            level: Optional CEFR level filter (A1, A2, B1, B2, C1, C2)

        Returns:
            List of active system decks

        Use Case:
            Browse decks page (public deck listing)
        """
        query = select(Deck).where(
            Deck.is_active.is_(True),
            Deck.owner_id.is_(None),  # Only system decks
        )

        if level is not None:
            query = query.where(Deck.level == level)

        query = query.offset(skip).limit(limit).order_by(Deck.created_at.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_active(self, level: DeckLevel | None = None) -> int:
        """Count all active system decks, optionally filtered by level.

        Only counts system decks (owner_id=NULL). User-owned decks are
        excluded and should be counted via count_user_owned().

        Args:
            level: Optional CEFR level filter (A1, A2, B1, B2, C1, C2)

        Returns:
            Total number of active system decks matching criteria

        Use Case:
            Pagination total count for deck listings
        """
        query = select(func.count(Deck.id)).where(
            Deck.is_active.is_(True),
            Deck.owner_id.is_(None),  # Only system decks
        )
        if level is not None:
            query = query.where(Deck.level == level)
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_with_cards(self, deck_id: UUID) -> Deck | None:
        """Get deck with all cards eagerly loaded.

        Args:
            deck_id: Deck UUID

        Returns:
            Deck with cards relationship loaded

        Use Case:
            Deck detail page, study session initialization

        Performance:
            Uses selectinload to prevent N+1 queries
        """
        query = select(Deck).where(Deck.id == deck_id).options(selectinload(Deck.cards))
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def count_cards(self, deck_id: UUID) -> int:
        """Count total cards in a deck.

        Args:
            deck_id: Deck UUID

        Returns:
            Number of cards in deck

        Use Case:
            Deck metadata, progress calculations
        """
        query = select(func.count()).select_from(Card).where(Card.deck_id == deck_id)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def search(
        self,
        query_text: str,
        *,
        skip: int = 0,
        limit: int = 20,
    ) -> list[Deck]:
        """Search system decks by name or description.

        Only searches system decks (owner_id=NULL). User-owned decks are
        excluded from search results.

        Args:
            query_text: Search query string
            skip: Pagination offset
            limit: Max results

        Returns:
            List of matching system decks

        Use Case:
            Search functionality (public deck search)

        Note:
            Uses case-insensitive ILIKE search (PostgreSQL)
        """
        search_pattern = f"%{query_text}%"
        query = (
            select(Deck)
            .where((Deck.name.ilike(search_pattern)) | (Deck.description.ilike(search_pattern)))
            .where(Deck.is_active.is_(True))
            .where(Deck.owner_id.is_(None))  # Only system decks
            .offset(skip)
            .limit(limit)
        )

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_search(self, query_text: str) -> int:
        """Count system decks matching search query.

        Only counts system decks (owner_id=NULL). User-owned decks are
        excluded from count.

        Args:
            query_text: Search query string

        Returns:
            Total number of matching active system decks

        Use Case:
            Pagination total count for search results
        """
        search_pattern = f"%{query_text}%"
        query = select(func.count(Deck.id)).where(
            Deck.is_active.is_(True),
            Deck.owner_id.is_(None),  # Only system decks
            (Deck.name.ilike(search_pattern)) | (Deck.description.ilike(search_pattern)),
        )
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def list_user_owned(
        self,
        user_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100,
        level: DeckLevel | None = None,
    ) -> list[Deck]:
        """List decks owned by a specific user.

        Args:
            user_id: Owner's user UUID
            skip: Pagination offset
            limit: Max results
            level: Optional CEFR level filter (A1, A2, B1, B2, C1, C2)

        Returns:
            List of active decks owned by the user

        Use Case:
            User's "My Decks" page
        """
        query = select(Deck).where(Deck.owner_id == user_id).where(Deck.is_active.is_(True))
        if level is not None:
            query = query.where(Deck.level == level)
        query = query.offset(skip).limit(limit).order_by(Deck.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_user_owned(
        self,
        user_id: UUID,
        level: DeckLevel | None = None,
    ) -> int:
        """Count decks owned by a specific user.

        Args:
            user_id: Owner's user UUID
            level: Optional CEFR level filter (A1, A2, B1, B2, C1, C2)

        Returns:
            Total number of active decks owned by the user

        Use Case:
            Pagination total count for user's deck listings
        """
        query = (
            select(func.count(Deck.id))
            .where(Deck.owner_id == user_id)
            .where(Deck.is_active.is_(True))
        )
        if level is not None:
            query = query.where(Deck.level == level)
        result = await self.db.execute(query)
        return result.scalar() or 0
