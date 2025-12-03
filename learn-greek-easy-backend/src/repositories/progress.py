"""Progress tracking repositories for SM-2 algorithm."""

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import Card, CardStatistics, CardStatus, UserDeckProgress
from src.repositories.base import BaseRepository


class UserDeckProgressRepository(BaseRepository[UserDeckProgress]):
    """Repository for UserDeckProgress model."""

    def __init__(self, db: AsyncSession):
        super().__init__(UserDeckProgress, db)

    async def get_or_create(
        self,
        user_id: UUID,
        deck_id: UUID,
    ) -> UserDeckProgress:
        """Get existing progress or create new one.

        Args:
            user_id: User UUID
            deck_id: Deck UUID

        Returns:
            UserDeckProgress instance (not yet committed if new)

        Use Case:
            Starting a new deck, tracking progress
        """
        query = (
            select(UserDeckProgress)
            .where(UserDeckProgress.user_id == user_id)
            .where(UserDeckProgress.deck_id == deck_id)
        )
        result = await self.db.execute(query)
        progress = result.scalar_one_or_none()

        if progress is None:
            progress = UserDeckProgress(
                user_id=user_id,
                deck_id=deck_id,
                cards_studied=0,
                cards_mastered=0,
            )
            self.db.add(progress)
            await self.db.flush()

        return progress

    async def get_user_progress(
        self,
        user_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[UserDeckProgress]:
        """Get all deck progress for a user.

        Args:
            user_id: User UUID
            skip: Pagination offset
            limit: Max results

        Returns:
            List of user's deck progress with deck info loaded

        Use Case:
            Dashboard, progress overview
        """
        query = (
            select(UserDeckProgress)
            .where(UserDeckProgress.user_id == user_id)
            .options(selectinload(UserDeckProgress.deck))
            .order_by(UserDeckProgress.last_studied_at.desc().nullslast())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_progress_metrics(
        self,
        progress_id: UUID,
        cards_studied_delta: int = 0,
        cards_mastered_delta: int = 0,
    ) -> UserDeckProgress:
        """Update progress metrics.

        Args:
            progress_id: UserDeckProgress UUID
            cards_studied_delta: Change in cards_studied count
            cards_mastered_delta: Change in cards_mastered count

        Returns:
            Updated progress (not yet committed)

        Use Case:
            After completing a review
        """
        progress = await self.get_or_404(progress_id)
        progress.cards_studied += cards_studied_delta
        progress.cards_mastered += cards_mastered_delta
        progress.last_studied_at = datetime.utcnow()

        self.db.add(progress)
        await self.db.flush()
        return progress


class CardStatisticsRepository(BaseRepository[CardStatistics]):
    """Repository for CardStatistics model (SM-2 algorithm)."""

    def __init__(self, db: AsyncSession):
        super().__init__(CardStatistics, db)

    async def get_or_create(
        self,
        user_id: UUID,
        card_id: UUID,
    ) -> CardStatistics:
        """Get existing statistics or create new one.

        Args:
            user_id: User UUID
            card_id: Card UUID

        Returns:
            CardStatistics instance (not yet committed if new)

        Use Case:
            First time reviewing a card
        """
        query = (
            select(CardStatistics)
            .where(CardStatistics.user_id == user_id)
            .where(CardStatistics.card_id == card_id)
        )
        result = await self.db.execute(query)
        stats = result.scalar_one_or_none()

        if stats is None:
            stats = CardStatistics(
                user_id=user_id,
                card_id=card_id,
                easiness_factor=2.5,
                interval=0,
                repetitions=0,
                next_review_date=date.today(),
                status=CardStatus.NEW,
            )
            self.db.add(stats)
            await self.db.flush()

        return stats

    async def get_due_cards(
        self,
        user_id: UUID,
        deck_id: UUID | None = None,
        *,
        limit: int = 20,
    ) -> list[CardStatistics]:
        """Get cards due for review today.

        Args:
            user_id: User UUID
            deck_id: Optional deck filter
            limit: Max cards to return

        Returns:
            List of card statistics with card and deck info loaded

        Use Case:
            Study session - get cards to review

        Performance:
            Uses next_review_date index, eager loads relationships
        """
        query = (
            select(CardStatistics)
            .where(CardStatistics.user_id == user_id)
            .where(CardStatistics.next_review_date <= date.today())
            .options(selectinload(CardStatistics.card).selectinload(Card.deck))
            .order_by(CardStatistics.next_review_date)
            .limit(limit)
        )

        if deck_id is not None:
            # Join with Card to filter by deck_id
            query = query.join(Card).where(Card.deck_id == deck_id)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_status(
        self,
        user_id: UUID,
        status: CardStatus,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[CardStatistics]:
        """Get cards filtered by status.

        Args:
            user_id: User UUID
            status: Card status (new, learning, review, mastered)
            skip: Pagination offset
            limit: Max results

        Returns:
            List of card statistics with specified status

        Use Case:
            Show new cards, show mastered cards
        """
        query = (
            select(CardStatistics)
            .where(CardStatistics.user_id == user_id)
            .where(CardStatistics.status == status)
            .options(selectinload(CardStatistics.card))
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_sm2_data(
        self,
        stats_id: UUID,
        easiness_factor: float,
        interval: int,
        repetitions: int,
        next_review_date: date,
        status: CardStatus,
    ) -> CardStatistics:
        """Update SM-2 algorithm data after review.

        Args:
            stats_id: CardStatistics UUID
            easiness_factor: New EF value (1.3-2.5+)
            interval: New interval in days
            repetitions: New repetition count
            next_review_date: Next scheduled review date
            status: New card status

        Returns:
            Updated statistics (not yet committed)

        Use Case:
            After processing a review with SM-2 algorithm
        """
        stats = await self.get_or_404(stats_id)
        stats.easiness_factor = easiness_factor
        stats.interval = interval
        stats.repetitions = repetitions
        stats.next_review_date = next_review_date
        stats.status = status

        self.db.add(stats)
        await self.db.flush()
        return stats
