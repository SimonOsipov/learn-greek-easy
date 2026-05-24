"""Card error report repository for database operations."""

from typing import Optional
from uuid import UUID

from sqlalchemy import case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from src.core.logging import get_logger
from src.db.models import (
    CardErrorCardType,
    CardErrorReport,
    CardErrorStatus,
    CultureQuestion,
    WordEntry,
)
from src.repositories.base import BaseRepository

logger = get_logger(__name__)


class CardErrorReportRepository(BaseRepository[CardErrorReport]):
    """Repository for CardErrorReport model operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(CardErrorReport, db)

    async def list_with_filters(
        self,
        *,
        card_type: Optional[CardErrorCardType] = None,
        status: Optional[CardErrorStatus] = None,
        card_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> list[CardErrorReport]:
        """List error reports with filters and sorting."""
        query = select(CardErrorReport).options(
            selectinload(CardErrorReport.user),
            selectinload(CardErrorReport.resolver),
        )

        if card_type is not None:
            query = query.where(CardErrorReport.card_type == card_type)
        if status is not None:
            query = query.where(CardErrorReport.status == status)
        if card_id is not None:
            query = query.where(CardErrorReport.card_id == card_id)
        if user_id is not None:
            query = query.where(CardErrorReport.user_id == user_id)

        query = query.order_by(desc(CardErrorReport.created_at))
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_with_filters(
        self,
        *,
        card_type: Optional[CardErrorCardType] = None,
        status: Optional[CardErrorStatus] = None,
        card_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
    ) -> int:
        """Count error reports matching filters."""
        query = select(func.count()).select_from(CardErrorReport)

        if card_type is not None:
            query = query.where(CardErrorReport.card_type == card_type)
        if status is not None:
            query = query.where(CardErrorReport.status == status)
        if card_id is not None:
            query = query.where(CardErrorReport.card_id == card_id)
        if user_id is not None:
            query = query.where(CardErrorReport.user_id == user_id)

        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_with_relations(self, report_id: UUID) -> Optional[CardErrorReport]:
        """Get error report by ID with user, resolver, and card relations loaded."""
        query = (
            select(CardErrorReport)
            .options(
                selectinload(CardErrorReport.user),
                selectinload(CardErrorReport.resolver),
            )
            .where(CardErrorReport.id == report_id)
        )
        result = await self.db.execute(query)
        report = result.scalar_one_or_none()
        if report is not None:
            await self._hydrate_cards_and_decks([report])
        return report

    async def get_user_report_for_card(
        self, card_id: UUID, card_type: CardErrorCardType, user_id: UUID
    ) -> Optional[CardErrorReport]:
        """Get user's existing report for a specific card."""
        query = select(CardErrorReport).where(
            CardErrorReport.card_id == card_id,
            CardErrorReport.card_type == card_type,
            CardErrorReport.user_id == user_id,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_pending_report_for_card(
        self, card_id: UUID, card_type: CardErrorCardType, user_id: UUID
    ) -> Optional[CardErrorReport]:
        """Get user's existing PENDING report for a specific card.

        This method checks if the user has an unresolved (PENDING status) report
        for a specific card. Used to enforce the business rule that users cannot
        submit duplicate reports while one is still pending review.

        Args:
            card_id: The ID of the card being reported
            card_type: The type of card (WORD or CULTURE)
            user_id: The ID of the user who submitted the report

        Returns:
            The pending CardErrorReport if one exists, None otherwise
        """
        query = select(CardErrorReport).where(
            CardErrorReport.card_id == card_id,
            CardErrorReport.card_type == card_type,
            CardErrorReport.user_id == user_id,
            CardErrorReport.status == CardErrorStatus.PENDING,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_pending_count_for_card(self, card_id: UUID, card_type: CardErrorCardType) -> int:
        """Get count of pending error reports for a card."""
        query = (
            select(func.count())
            .select_from(CardErrorReport)
            .where(
                CardErrorReport.card_id == card_id,
                CardErrorReport.card_type == card_type,
                CardErrorReport.status == CardErrorStatus.PENDING,
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one()

    async def list_for_admin(
        self,
        *,
        card_type: Optional[CardErrorCardType] = None,
        status: Optional[CardErrorStatus] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> list[CardErrorReport]:
        """List error reports for admin view with PENDING-first sorting.

        Sorting: PENDING status items first (priority 0), all others second (priority 1),
        then by created_at DESC within each group.

        Card and deck content are hydrated via two batched IN-queries keyed on
        card_type (CER-43). Results are attached as transient attributes
        ``_card_obj`` on each report for the route layer to read.

        Args:
            card_type: Optional filter by card type (WORD or CULTURE)
            status: Optional filter by status
            skip: Number of records to skip (for pagination)
            limit: Maximum records to return

        Returns:
            List of CardErrorReport with user, resolver, and card relations loaded
        """
        query = select(CardErrorReport).options(
            selectinload(CardErrorReport.user),
            selectinload(CardErrorReport.resolver),
        )

        if card_type is not None:
            query = query.where(CardErrorReport.card_type == card_type)
        if status is not None:
            query = query.where(CardErrorReport.status == status)

        # Sort PENDING status first (0), all others second (1), then by created_at DESC
        status_priority = case(
            (CardErrorReport.status == CardErrorStatus.PENDING, 0),
            else_=1,
        )
        query = query.order_by(status_priority, desc(CardErrorReport.created_at))

        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        reports = list(result.scalars().all())
        await self._hydrate_cards_and_decks(reports)
        return reports

    async def _hydrate_cards_and_decks(self, reports: list[CardErrorReport]) -> None:
        """Attach card and deck objects to reports as transient ``_card_obj`` attributes.

        Partitions reports by card_type and issues at most two batched IN-queries
        (one for WordEntry rows, one for CultureQuestion rows) — O(1) round-trips
        per page regardless of page size. Missing/deleted cards set ``_card_obj``
        to None; a debug log line is emitted for each orphan.

        For WORD reports: WordEntry is loaded with its ``decks`` relationship (the
        first Deck in the list is used as context, if any).
        For CULTURE reports: CultureQuestion is loaded with its ``deck`` relationship.
        """
        if not reports:
            return

        word_ids = [r.card_id for r in reports if r.card_type == CardErrorCardType.WORD]
        culture_ids = [r.card_id for r in reports if r.card_type == CardErrorCardType.CULTURE]

        word_by_id: dict[UUID, WordEntry] = {}
        culture_by_id: dict[UUID, CultureQuestion] = {}

        if word_ids:
            word_rows: list[WordEntry] = list(
                (
                    await self.db.execute(
                        select(WordEntry)
                        .options(selectinload(WordEntry.decks))
                        .where(WordEntry.id.in_(word_ids))
                    )
                )
                .scalars()
                .all()
            )
            word_by_id = {w.id: w for w in word_rows}

        if culture_ids:
            culture_rows: list[CultureQuestion] = list(
                (
                    await self.db.execute(
                        select(CultureQuestion)
                        .options(joinedload(CultureQuestion.deck))
                        .where(CultureQuestion.id.in_(culture_ids))
                    )
                )
                .unique()
                .scalars()
                .all()
            )
            culture_by_id = {c.id: c for c in culture_rows}

        for r in reports:
            card_obj: WordEntry | CultureQuestion | None
            if r.card_type == CardErrorCardType.WORD:
                card_obj = word_by_id.get(r.card_id)
            else:
                card_obj = culture_by_id.get(r.card_id)

            if card_obj is None:
                logger.debug(
                    "CER orphan card_id — card may have been hard-deleted",
                    extra={"card_id": str(r.card_id), "card_type": r.card_type},
                )
            # Attach as transient attribute (not a mapped column)
            object.__setattr__(r, "_card_obj", card_obj)
