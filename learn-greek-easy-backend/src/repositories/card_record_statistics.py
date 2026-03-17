"""CardRecordStatistics repository for SM-2 algorithm (V2 card system)."""

from datetime import date
from uuid import UUID

from sqlalchemy import delete, func, not_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import CardRecord, CardRecordStatistics, CardStatus
from src.repositories.base import BaseRepository


class CardRecordStatisticsRepository(BaseRepository[CardRecordStatistics]):
    """Repository for CardRecordStatistics model (SM-2 algorithm).

    Mirrors CardStatisticsRepository but operates on the V2 card_records system.
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(CardRecordStatistics, db)

    async def get_or_create(
        self,
        user_id: UUID,
        card_record_id: UUID,
    ) -> CardRecordStatistics:
        """Get existing statistics or create new one with defaults.

        Args:
            user_id: User UUID.
            card_record_id: CardRecord UUID.

        Returns:
            CardRecordStatistics instance (flushed but not committed if new).
        """
        query = (
            select(CardRecordStatistics)
            .where(CardRecordStatistics.user_id == user_id)
            .where(CardRecordStatistics.card_record_id == card_record_id)
        )
        result = await self.db.execute(query)
        stats = result.scalar_one_or_none()

        if stats is None:
            stats = CardRecordStatistics(
                user_id=user_id,
                card_record_id=card_record_id,
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
    ) -> list[CardRecordStatistics]:
        """Get card records due for review today or earlier.

        Args:
            user_id: User UUID.
            deck_id: Optional deck filter.
            limit: Max cards to return.

        Returns:
            List of CardRecordStatistics with card_record eagerly loaded.
        """
        query = (
            select(CardRecordStatistics)
            .join(CardRecord, CardRecordStatistics.card_record_id == CardRecord.id)
            .where(CardRecordStatistics.user_id == user_id)
            .where(CardRecordStatistics.next_review_date <= date.today())
            .where(CardRecord.is_active == True)  # noqa: E712
            .options(selectinload(CardRecordStatistics.card_record))
            .order_by(CardRecordStatistics.next_review_date)
            .limit(limit)
        )

        if deck_id is not None:
            query = query.where(CardRecord.deck_id == deck_id)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_new_cards_for_deck(
        self,
        user_id: UUID,
        deck_id: UUID,
        limit: int = 10,
    ) -> list[CardRecord]:
        """Get card records not yet studied by this user.

        Finds active CardRecords in the deck that have no statistics entry
        for this user, ordered by creation time.

        Args:
            user_id: User UUID.
            deck_id: Deck UUID.
            limit: Max cards to return.

        Returns:
            List of unstudied CardRecord objects.
        """
        studied_subq = (
            select(CardRecordStatistics.card_record_id)
            .where(CardRecordStatistics.user_id == user_id)
            .scalar_subquery()
        )

        query = (
            select(CardRecord)
            .where(CardRecord.deck_id == deck_id)
            .where(CardRecord.is_active == True)  # noqa: E712
            .where(not_(CardRecord.id.in_(studied_subq)))
            .order_by(CardRecord.created_at)
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
    ) -> CardRecordStatistics:
        """Update SM-2 algorithm fields after a review session.

        Args:
            stats_id: CardRecordStatistics UUID.
            easiness_factor: New EF value.
            interval: New interval in days.
            repetitions: New repetition count.
            next_review_date: Next scheduled review date.
            status: New card status.

        Returns:
            Updated statistics (flushed but not committed).
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

    async def count_by_status(
        self,
        user_id: UUID,
        deck_id: UUID | None = None,
    ) -> dict[str, int]:
        """Count card records grouped by SM-2 status.

        Args:
            user_id: User UUID.
            deck_id: Optional deck filter.

        Returns:
            Dict mapping status value strings to counts, plus "due" key.
        """
        query = (
            select(CardRecordStatistics.status, func.count().label("count"))
            .where(CardRecordStatistics.user_id == user_id)
            .group_by(CardRecordStatistics.status)
        )

        if deck_id is not None:
            query = query.join(
                CardRecord, CardRecordStatistics.card_record_id == CardRecord.id
            ).where(CardRecord.deck_id == deck_id)

        result = await self.db.execute(query)
        rows = result.all()

        counts: dict[str, int] = {
            "new": 0,
            "learning": 0,
            "review": 0,
            "mastered": 0,
        }
        for status, count in rows:
            counts[status.value] = count

        due_query = (
            select(func.count())
            .select_from(CardRecordStatistics)
            .where(CardRecordStatistics.user_id == user_id)
            .where(CardRecordStatistics.next_review_date <= date.today())
        )
        if deck_id is not None:
            due_query = due_query.join(
                CardRecord, CardRecordStatistics.card_record_id == CardRecord.id
            ).where(CardRecord.deck_id == deck_id)

        due_result = await self.db.execute(due_query)
        counts["due"] = due_result.scalar_one()

        return counts

    async def bulk_create_statistics(
        self,
        user_id: UUID,
        card_record_ids: list[UUID],
    ) -> list[CardRecordStatistics]:
        """Create statistics for multiple card records, skipping existing ones.

        Args:
            user_id: User UUID.
            card_record_ids: CardRecord UUIDs to initialize.

        Returns:
            List of newly created CardRecordStatistics (flushed, not committed).
        """
        if not card_record_ids:
            return []

        existing_result = await self.db.execute(
            select(CardRecordStatistics.card_record_id)
            .where(CardRecordStatistics.user_id == user_id)
            .where(CardRecordStatistics.card_record_id.in_(card_record_ids))
        )
        existing_ids = {row[0] for row in existing_result.all()}

        new_stats = []
        for card_record_id in card_record_ids:
            if card_record_id not in existing_ids:
                stats = CardRecordStatistics(
                    user_id=user_id,
                    card_record_id=card_record_id,
                    easiness_factor=2.5,
                    interval=0,
                    repetitions=0,
                    next_review_date=date.today(),
                    status=CardStatus.NEW,
                )
                self.db.add(stats)
                new_stats.append(stats)

        if new_stats:
            await self.db.flush()

        return new_stats

    async def delete_all_by_user_id(self, user_id: UUID) -> int:
        """Delete all card record statistics for a user.

        Args:
            user_id: User UUID.

        Returns:
            Number of deleted records.
        """
        result = await self.db.execute(
            delete(CardRecordStatistics).where(CardRecordStatistics.user_id == user_id)
        )
        return int(result.rowcount) if result.rowcount else 0  # type: ignore[attr-defined]
