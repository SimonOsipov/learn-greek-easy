"""Progress tracking repositories for SM-2 algorithm."""

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Date, cast, delete, func, not_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import Card, CardStatistics, CardStatus, Deck, UserDeckProgress
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

    async def count_user_decks(self, user_id: UUID) -> int:
        """Count decks user has started.

        Args:
            user_id: User UUID

        Returns:
            Number of decks with progress records for this user
        """
        query = (
            select(func.count())
            .select_from(UserDeckProgress)
            .where(UserDeckProgress.user_id == user_id)
        )
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_total_cards_studied(self, user_id: UUID) -> int:
        """Get sum of cards_studied across all decks.

        Args:
            user_id: User UUID

        Returns:
            Total cards studied across all decks
        """
        query = select(func.coalesce(func.sum(UserDeckProgress.cards_studied), 0)).where(
            UserDeckProgress.user_id == user_id
        )
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_total_cards_mastered(self, user_id: UUID) -> int:
        """Get sum of cards_mastered across all decks.

        Args:
            user_id: User UUID

        Returns:
            Total cards mastered across all decks
        """
        query = select(func.coalesce(func.sum(UserDeckProgress.cards_mastered), 0)).where(
            UserDeckProgress.user_id == user_id
        )
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def delete_all_by_user_id(self, user_id: UUID) -> int:
        """Delete all deck progress records for a user.

        Args:
            user_id: User UUID

        Returns:
            Number of deleted records
        """
        result = await self.db.execute(
            delete(UserDeckProgress).where(UserDeckProgress.user_id == user_id)
        )
        return int(result.rowcount) if result.rowcount else 0  # type: ignore[attr-defined]


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

    async def get_early_practice_cards(
        self,
        user_id: UUID,
        deck_id: UUID | None = None,
        *,
        limit: int = 10,
    ) -> list[CardStatistics]:
        """Get cards not yet due for early practice.

        Returns cards that have been studied before but aren't due yet,
        allowing users to practice ahead of schedule.

        Args:
            user_id: User UUID
            deck_id: Optional deck filter
            limit: Max cards to return

        Returns:
            List of card statistics with card and deck info loaded

        Use Case:
            Flexible study - practice cards before they're due

        Performance:
            Uses next_review_date index, eager loads relationships
        """
        query = select(CardStatistics).where(CardStatistics.user_id == user_id)

        # Filter for future cards (not yet due)
        query = query.where(CardStatistics.next_review_date > date.today())

        # Only include cards in active learning phases
        query = query.where(CardStatistics.status.in_([CardStatus.LEARNING, CardStatus.REVIEW]))

        # Apply deck filter if specified (join before limit)
        if deck_id is not None:
            query = query.join(Card).where(Card.deck_id == deck_id)

        # Eager load relationships
        query = query.options(selectinload(CardStatistics.card).selectinload(Card.deck))

        # Order by next review date (closest first) and limit
        query = query.order_by(CardStatistics.next_review_date).limit(limit)

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

    async def get_new_cards_for_deck(
        self,
        user_id: UUID,
        deck_id: UUID | None = None,
        limit: int = 10,
    ) -> list[Card]:
        """Get cards that user hasn't studied yet.

        Finds cards that don't have CardStatistics records for this user.
        Returns Card objects (not CardStatistics) since stats don't exist yet.

        Args:
            user_id: User UUID
            deck_id: Optional deck filter
            limit: Maximum cards to return

        Returns:
            List of Card objects not yet studied by user

        Use Case:
            Study queue - include new cards alongside due cards
        """
        # Subquery to find card_ids that have statistics for this user
        studied_cards_subq = (
            select(CardStatistics.card_id)
            .where(CardStatistics.user_id == user_id)
            .scalar_subquery()
        )

        # Main query: cards NOT in studied_cards
        query = (
            select(Card)
            .join(Deck, Card.deck_id == Deck.id)
            .where(Deck.is_active == True)  # noqa: E712
            .where(not_(Card.id.in_(studied_cards_subq)))
            .order_by(Card.order_index, Card.created_at)
            .limit(limit)
        )

        if deck_id is not None:
            query = query.where(Card.deck_id == deck_id)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_new_cards_for_deck(
        self,
        user_id: UUID,
        deck_id: UUID,
    ) -> int:
        """Count cards not yet studied by user in a deck.

        Args:
            user_id: User UUID
            deck_id: Deck UUID

        Returns:
            Count of unstudied cards
        """
        # Subquery to find studied card_ids
        studied_cards_subq = (
            select(CardStatistics.card_id)
            .where(CardStatistics.user_id == user_id)
            .scalar_subquery()
        )

        # Count cards not in subquery
        query = (
            select(func.count())
            .select_from(Card)
            .where(Card.deck_id == deck_id)
            .where(not_(Card.id.in_(studied_cards_subq)))
        )

        result = await self.db.execute(query)
        return result.scalar_one()

    async def count_by_status(
        self,
        user_id: UUID,
        deck_id: UUID | None = None,
    ) -> dict[str, int]:
        """Count cards by status for a user.

        Args:
            user_id: User UUID
            deck_id: Optional deck filter

        Returns:
            Dict with status counts: {
                "new": int,
                "learning": int,
                "review": int,
                "mastered": int,
                "due": int,  # Cards due today or overdue
            }

        Use Case:
            Progress dashboard, deck statistics
        """
        # Base query
        query = (
            select(CardStatistics.status, func.count().label("count"))
            .where(CardStatistics.user_id == user_id)
            .group_by(CardStatistics.status)
        )

        if deck_id is not None:
            query = query.join(Card).where(Card.deck_id == deck_id)

        result = await self.db.execute(query)
        rows = result.all()

        # Initialize all statuses to 0
        counts: dict[str, int] = {
            "new": 0,
            "learning": 0,
            "review": 0,
            "mastered": 0,
        }

        # Fill in actual counts
        for status, count in rows:
            counts[status.value] = count

        # Count due cards (separate query)
        due_query = (
            select(func.count())
            .select_from(CardStatistics)
            .where(CardStatistics.user_id == user_id)
            .where(CardStatistics.next_review_date <= date.today())
        )

        if deck_id is not None:
            due_query = due_query.join(Card).where(Card.deck_id == deck_id)

        due_result = await self.db.execute(due_query)
        counts["due"] = due_result.scalar_one()

        return counts

    async def get_user_stats_for_deck(
        self,
        user_id: UUID,
        deck_id: UUID,
    ) -> list[CardStatistics]:
        """Get all statistics for a user in a specific deck.

        Args:
            user_id: User UUID
            deck_id: Deck UUID

        Returns:
            List of CardStatistics with card data loaded

        Use Case:
            Deck detail view, export progress
        """
        query = (
            select(CardStatistics)
            .join(Card)
            .where(CardStatistics.user_id == user_id)
            .where(Card.deck_id == deck_id)
            .options(selectinload(CardStatistics.card))
            .order_by(Card.order_index)
        )

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def bulk_create_statistics(
        self,
        user_id: UUID,
        card_ids: list[UUID],
    ) -> list[CardStatistics]:
        """Create statistics for multiple cards efficiently.

        Skips cards that already have statistics for this user.

        Args:
            user_id: User UUID
            card_ids: Card UUIDs to initialize

        Returns:
            List of newly created CardStatistics

        Use Case:
            Initialize deck for user, bulk operations
        """
        if not card_ids:
            return []

        # Find which cards already have statistics
        existing_query = (
            select(CardStatistics.card_id)
            .where(CardStatistics.user_id == user_id)
            .where(CardStatistics.card_id.in_(card_ids))
        )
        result = await self.db.execute(existing_query)
        existing_ids = {row[0] for row in result.all()}

        # Create statistics for new cards only
        new_stats = []
        for card_id in card_ids:
            if card_id not in existing_ids:
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
                new_stats.append(stats)

        if new_stats:
            await self.db.flush()

        return new_stats

    async def get_average_easiness_factor(
        self,
        user_id: UUID,
        deck_id: UUID | None = None,
    ) -> float:
        """Get average easiness factor for user's cards.

        Args:
            user_id: User UUID
            deck_id: Optional deck filter

        Returns:
            Average easiness factor (default 2.5 if no data)
        """
        query = select(func.avg(CardStatistics.easiness_factor)).where(
            CardStatistics.user_id == user_id
        )
        if deck_id:
            query = query.join(Card).where(Card.deck_id == deck_id)
        result = await self.db.execute(query)
        avg = result.scalar()
        return float(avg) if avg else 2.5

    async def get_average_interval(
        self,
        user_id: UUID,
        deck_id: UUID | None = None,
    ) -> float:
        """Get average interval in days for user's cards.

        Args:
            user_id: User UUID
            deck_id: Optional deck filter

        Returns:
            Average interval in days (default 0.0 if no data)
        """
        query = select(func.avg(CardStatistics.interval)).where(CardStatistics.user_id == user_id)
        if deck_id:
            query = query.join(Card).where(Card.deck_id == deck_id)
        result = await self.db.execute(query)
        avg = result.scalar()
        return float(avg) if avg else 0.0

    async def count_cards_mastered_in_range(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
    ) -> int:
        """Count cards that reached mastered status in date range.

        A card is considered mastered when status is MASTERED.
        Uses updated_at to approximate when mastery was achieved.

        Args:
            user_id: User UUID
            start_date: Start date (inclusive)
            end_date: End date (inclusive)

        Returns:
            Count of cards mastered in the date range

        Note:
            This is an approximation since CardStatistics doesn't track
            when a card first reached mastered status. Uses updated_at
            and status=MASTERED as proxy.
        """
        query = (
            select(func.count())
            .select_from(CardStatistics)
            .where(CardStatistics.user_id == user_id)
            .where(CardStatistics.status == CardStatus.MASTERED)
            .where(func.date(CardStatistics.updated_at) >= start_date)
            .where(func.date(CardStatistics.updated_at) <= end_date)
        )
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def count_cards_by_status_per_day(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
    ) -> dict[date, dict[str, int]]:
        """Count cards in each status per day based on updated_at.

        Groups cards by the date they were last updated and their current status.
        Learning includes both LEARNING and REVIEW statuses.

        Args:
            user_id: User UUID
            start_date: Start date (inclusive)
            end_date: End date (inclusive)

        Returns:
            Dict of {date: {learning: count, mastered: count}}

        Use Case:
            Progress Over Time chart - show learning/mastered counts per day
        """
        result = await self.db.execute(
            select(
                cast(CardStatistics.updated_at, Date).label("day"),
                CardStatistics.status,
                func.count(CardStatistics.id).label("count"),
            )
            .where(CardStatistics.user_id == user_id)
            .where(cast(CardStatistics.updated_at, Date) >= start_date)
            .where(cast(CardStatistics.updated_at, Date) <= end_date)
            .group_by(cast(CardStatistics.updated_at, Date), CardStatistics.status)
        )
        rows = result.all()

        counts: dict[date, dict[str, int]] = {}
        for row in rows:
            day = row.day
            count_val: int = int(row[2])  # count column is at index 2
            if day not in counts:
                counts[day] = {"learning": 0, "mastered": 0}
            if row.status == CardStatus.LEARNING or row.status == CardStatus.REVIEW:
                counts[day]["learning"] += count_val
            elif row.status == CardStatus.MASTERED:
                counts[day]["mastered"] += count_val
        return counts

    async def delete_all_by_user_id(self, user_id: UUID) -> int:
        """Delete all card statistics for a user.

        Args:
            user_id: User UUID

        Returns:
            Number of deleted records
        """
        result = await self.db.execute(
            delete(CardStatistics).where(CardStatistics.user_id == user_id)
        )
        return int(result.rowcount) if result.rowcount else 0  # type: ignore[attr-defined]

    async def get_batch_stats_by_deck(
        self, user_id: UUID, deck_ids: list[UUID]
    ) -> dict[UUID, dict]:
        """Get aggregated stats for multiple decks in one query.

        IMPORTANT: Must JOIN Card table to access deck_id since CardStatistics
        only has card_id, not deck_id directly.

        Args:
            user_id: User UUID
            deck_ids: List of deck UUIDs to get stats for

        Returns:
            Dict mapping deck_id to stats dict with keys:
            - total: total cards with stats
            - new: count of NEW status cards
            - learning: count of LEARNING status cards
            - mastered: count of MASTERED status cards
            - due: count of cards due for review (next_review_date <= today)
            - avg_ef: average easiness factor

        Use Case:
            Batch loading deck statistics to avoid N+1 queries
        """
        if not deck_ids:
            return {}

        today = date.today()

        query = (
            select(
                Card.deck_id,
                func.count(CardStatistics.id).label("total"),
                func.count().filter(CardStatistics.status == CardStatus.NEW).label("new_count"),
                func.count()
                .filter(CardStatistics.status == CardStatus.LEARNING)
                .label("learning_count"),
                func.count()
                .filter(CardStatistics.status == CardStatus.MASTERED)
                .label("mastered_count"),
                func.count().filter(CardStatistics.next_review_date <= today).label("due_count"),
                func.avg(CardStatistics.easiness_factor).label("avg_ef"),
            )
            .join(Card, CardStatistics.card_id == Card.id)
            .where(CardStatistics.user_id == user_id)
            .where(Card.deck_id.in_(deck_ids))
            .group_by(Card.deck_id)
        )

        result = await self.db.execute(query)
        return {
            row.deck_id: {
                "total": row.total,
                "new": row.new_count,
                "learning": row.learning_count,
                "mastered": row.mastered_count,
                "due": row.due_count,
                "avg_ef": float(row.avg_ef) if row.avg_ef else 2.5,
            }
            for row in result.all()
        }
