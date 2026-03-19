"""CardRecordStatistics repository for SM-2 algorithm (V2 card system)."""

from datetime import date
from uuid import UUID

from sqlalchemy import Date, cast, delete, func, not_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import CardRecord, CardRecordStatistics, CardStatus, CardType, Deck
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
        card_type: CardType | None = None,
        limit: int = 20,
        exclude_premium_decks: bool = False,
    ) -> list[CardRecordStatistics]:
        """Get card records due for review today or earlier.

        Args:
            user_id: User UUID.
            deck_id: Optional deck filter.
            card_type: Optional card type filter.
            limit: Max cards to return.
            exclude_premium_decks: If True, exclude cards from premium decks.

        Returns:
            List of CardRecordStatistics with card_record eagerly loaded.
        """
        query = (
            select(CardRecordStatistics)
            .join(CardRecord, CardRecordStatistics.card_record_id == CardRecord.id)
            .join(Deck, CardRecord.deck_id == Deck.id)
            .where(CardRecordStatistics.user_id == user_id)
            .where(CardRecordStatistics.next_review_date <= date.today())
            .where(CardRecord.is_active == True)  # noqa: E712
            .where(Deck.is_active == True)  # noqa: E712
            .options(selectinload(CardRecordStatistics.card_record))
            .order_by(CardRecordStatistics.next_review_date)
            .limit(limit)
        )
        if deck_id is not None:
            query = query.where(CardRecord.deck_id == deck_id)
        if card_type is not None:
            query = query.where(CardRecord.card_type == card_type)
        if exclude_premium_decks:
            query = query.where(Deck.is_premium == False)  # noqa: E712
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_new_cards(
        self,
        user_id: UUID,
        deck_id: UUID | None = None,
        limit: int = 10,
        *,
        card_type: CardType | None = None,
        exclude_premium_decks: bool = False,
    ) -> list[CardRecord]:
        """Get card records not yet studied by this user.

        Finds active CardRecords that have no statistics entry for this user,
        ordered by creation time.

        Args:
            user_id: User UUID.
            deck_id: Optional deck filter.
            limit: Max cards to return.
            card_type: Optional card type filter.
            exclude_premium_decks: If True, exclude cards from premium decks.

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
            .join(Deck, CardRecord.deck_id == Deck.id)
            .where(CardRecord.is_active == True)  # noqa: E712
            .where(Deck.is_active == True)  # noqa: E712
            .where(not_(CardRecord.id.in_(studied_subq)))
            .order_by(CardRecord.created_at)
            .limit(limit)
        )
        if deck_id is not None:
            query = query.where(CardRecord.deck_id == deck_id)
        if card_type is not None:
            query = query.where(CardRecord.card_type == card_type)
        if exclude_premium_decks:
            query = query.where(Deck.is_premium == False)  # noqa: E712
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_early_practice_cards(
        self,
        user_id: UUID,
        deck_id: UUID | None = None,
        *,
        card_type: CardType | None = None,
        limit: int = 10,
        exclude_premium_decks: bool = False,
    ) -> list[CardRecordStatistics]:
        """Get card records not yet due but eligible for early practice.

        Returns LEARNING and REVIEW cards whose next review date is in the
        future, ordered by soonest due first.

        Args:
            user_id: User UUID.
            deck_id: Optional deck filter.
            card_type: Optional card type filter.
            limit: Max cards to return.
            exclude_premium_decks: If True, exclude cards from premium decks.

        Returns:
            List of CardRecordStatistics with card_record eagerly loaded.
        """
        query = (
            select(CardRecordStatistics)
            .join(CardRecord, CardRecordStatistics.card_record_id == CardRecord.id)
            .join(Deck, CardRecord.deck_id == Deck.id)
            .where(CardRecordStatistics.user_id == user_id)
            .where(CardRecordStatistics.next_review_date > date.today())
            .where(CardRecordStatistics.status.in_([CardStatus.LEARNING, CardStatus.REVIEW]))
            .where(CardRecord.is_active == True)  # noqa: E712
            .where(Deck.is_active == True)  # noqa: E712
            .options(selectinload(CardRecordStatistics.card_record))
            .order_by(CardRecordStatistics.next_review_date)
            .limit(limit)
        )
        if deck_id is not None:
            query = query.where(CardRecord.deck_id == deck_id)
        if card_type is not None:
            query = query.where(CardRecord.card_type == card_type)
        if exclude_premium_decks:
            query = query.where(Deck.is_premium == False)  # noqa: E712
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
            .join(CardRecord, CardRecordStatistics.card_record_id == CardRecord.id)
            .where(CardRecordStatistics.user_id == user_id)
            .where(CardRecord.is_active.is_(True))
            .group_by(CardRecordStatistics.status)
        )

        if deck_id is not None:
            query = query.where(CardRecord.deck_id == deck_id)

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
            .join(CardRecord, CardRecordStatistics.card_record_id == CardRecord.id)
            .where(CardRecordStatistics.user_id == user_id)
            .where(CardRecordStatistics.next_review_date <= date.today())
            .where(CardRecord.is_active.is_(True))
        )
        if deck_id is not None:
            due_query = due_query.where(CardRecord.deck_id == deck_id)

        due_result = await self.db.execute(due_query)
        counts["due"] = due_result.scalar_one()

        return counts

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

    async def count_cards_by_status_per_day(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """Count card statistics grouped by day and status within a date range.

        Args:
            user_id: User UUID.
            start_date: Start of date range (inclusive).
            end_date: End of date range (inclusive).

        Returns:
            List of dicts with date, status, count.
        """
        query = (
            select(
                cast(CardRecordStatistics.updated_at, Date).label("day"),
                CardRecordStatistics.status,
                func.count().label("count"),
            )
            .where(
                CardRecordStatistics.user_id == user_id,
                cast(CardRecordStatistics.updated_at, Date) >= start_date,
                cast(CardRecordStatistics.updated_at, Date) <= end_date,
            )
            .group_by(
                cast(CardRecordStatistics.updated_at, Date),
                CardRecordStatistics.status,
            )
            .order_by(cast(CardRecordStatistics.updated_at, Date))
        )
        result = await self.db.execute(query)
        rows = result.all()
        return [
            {
                "date": row.day,
                "status": row.status.value if hasattr(row.status, "value") else row.status,
                "count": row.count,
            }
            for row in rows
        ]

    async def count_cards_mastered_in_range(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
    ) -> int:
        """Count cards that reached MASTERED status within a date range.

        Args:
            user_id: User UUID.
            start_date: Start of date range (inclusive).
            end_date: End of date range (inclusive).

        Returns:
            Number of mastered cards updated in range.
        """
        query = (
            select(func.count())
            .select_from(CardRecordStatistics)
            .where(
                CardRecordStatistics.user_id == user_id,
                CardRecordStatistics.status == CardStatus.MASTERED,
                cast(CardRecordStatistics.updated_at, Date) >= start_date,
                cast(CardRecordStatistics.updated_at, Date) <= end_date,
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_batch_stats_by_deck(
        self,
        user_id: UUID,
        deck_ids: list[UUID],
    ) -> dict[UUID, dict[str, int]]:
        """Get card status counts per deck for a list of deck IDs.

        Args:
            user_id: User UUID.
            deck_ids: List of deck UUIDs to query.

        Returns:
            Dict mapping deck_id to status count dict.
        """
        if not deck_ids:
            return {}
        query = (
            select(
                CardRecord.deck_id,
                CardRecordStatistics.status,
                func.count().label("status_count"),
            )
            .join(CardRecord, CardRecordStatistics.card_record_id == CardRecord.id)
            .where(
                CardRecordStatistics.user_id == user_id,
                CardRecord.deck_id.in_(deck_ids),
            )
            .group_by(CardRecord.deck_id, CardRecordStatistics.status)
        )
        result = await self.db.execute(query)
        rows = result.all()
        # Initialize all decks with zero counts
        output: dict[UUID, dict[str, int]] = {
            deck_id: {"new": 0, "learning": 0, "review": 0, "mastered": 0} for deck_id in deck_ids
        }
        for row in rows:
            status_val = row.status.value if hasattr(row.status, "value") else row.status
            if status_val in output[row.deck_id]:
                output[row.deck_id][status_val] = row.status_count
        return output

    async def get_average_easiness_factor(
        self,
        user_id: UUID,
        deck_id: UUID | None = None,
    ) -> float:
        """Get average easiness factor for a user, optionally scoped to a deck.

        Args:
            user_id: User UUID.
            deck_id: Optional deck filter.

        Returns:
            Average easiness factor (2.5 if no records).
        """
        conditions = [CardRecordStatistics.user_id == user_id]
        query = select(func.avg(CardRecordStatistics.easiness_factor))
        if deck_id is not None:
            query = query.join(CardRecord, CardRecordStatistics.card_record_id == CardRecord.id)
            conditions.append(CardRecord.deck_id == deck_id)
        query = query.where(*conditions)
        result = await self.db.execute(query)
        val = result.scalar_one()
        return float(val) if val is not None else 2.5

    async def get_average_interval(
        self,
        user_id: UUID,
        deck_id: UUID | None = None,
    ) -> float:
        """Get average review interval in days for a user, optionally scoped to a deck.

        Args:
            user_id: User UUID.
            deck_id: Optional deck filter.

        Returns:
            Average interval in days (0.0 if no records).
        """
        conditions = [CardRecordStatistics.user_id == user_id]
        query = select(func.avg(CardRecordStatistics.interval))
        if deck_id is not None:
            query = query.join(CardRecord, CardRecordStatistics.card_record_id == CardRecord.id)
            conditions.append(CardRecord.deck_id == deck_id)
        query = query.where(*conditions)
        result = await self.db.execute(query)
        val = result.scalar_one()
        return float(val) if val is not None else 0.0

    async def count_distinct_decks(self, user_id: UUID) -> int:
        """Count the number of distinct decks a user has card statistics in.

        Args:
            user_id: User UUID.

        Returns:
            Number of distinct decks.
        """
        query = (
            select(func.count(func.distinct(CardRecord.deck_id)))
            .select_from(CardRecordStatistics)
            .join(CardRecord, CardRecordStatistics.card_record_id == CardRecord.id)
            .where(CardRecordStatistics.user_id == user_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one()
