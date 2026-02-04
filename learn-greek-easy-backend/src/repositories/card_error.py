"""Card error report repository for database operations."""

from typing import Optional
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import CardErrorCardType, CardErrorReport, CardErrorStatus
from src.repositories.base import BaseRepository


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
        """Get error report by ID with user and resolver loaded."""
        query = (
            select(CardErrorReport)
            .options(
                selectinload(CardErrorReport.user),
                selectinload(CardErrorReport.resolver),
            )
            .where(CardErrorReport.id == report_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

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
