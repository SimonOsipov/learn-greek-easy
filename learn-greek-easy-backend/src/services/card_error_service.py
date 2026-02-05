"""Card Error Report Service for user-facing card error submissions."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import ConflictException
from src.core.logging import get_logger
from src.db.models import CardErrorReport
from src.repositories.card_error import CardErrorReportRepository
from src.schemas.card_error import CardErrorReportCreate

logger = get_logger(__name__)


class CardErrorService:
    """Service for card error report operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CardErrorReportRepository(db)

    async def create_card_error_report(
        self,
        user_id: UUID,
        data: CardErrorReportCreate,
    ) -> CardErrorReport:
        """Create a new card error report.

        Args:
            user_id: ID of user submitting the report
            data: Report details (card_id, card_type, description)

        Returns:
            Created CardErrorReport

        Raises:
            ConflictException: If user has a pending (unreviewed) report for this card
        """
        # Check for pending report - allow re-submission after resolution
        existing = await self.repo.get_pending_report_for_card(
            card_id=data.card_id,
            card_type=data.card_type,
            user_id=user_id,
        )

        if existing:
            raise ConflictException(
                resource="CardErrorReport",
                detail="Admin yet to review your previous feedback",
            )

        # Create the report
        report = await self.repo.create(
            {
                "user_id": user_id,
                "card_id": data.card_id,
                "card_type": data.card_type,
                "description": data.description,
            }
        )

        logger.info(
            "Card error report created",
            extra={
                "report_id": str(report.id),
                "user_id": str(user_id),
                "card_id": str(data.card_id),
                "card_type": data.card_type.value,
            },
        )

        return report
