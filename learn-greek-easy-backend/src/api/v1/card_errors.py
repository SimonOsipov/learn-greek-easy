"""Card Error Reporting API endpoints."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.db.dependencies import get_db
from src.db.models import User
from src.schemas.card_error import CardErrorReportCreate, CardErrorReportResponse
from src.services.card_error_service import CardErrorService

router = APIRouter(
    tags=["Card Errors"],
    responses={
        401: {"description": "Not authenticated"},
        422: {"description": "Validation error"},
    },
)


@router.post(
    "",
    response_model=CardErrorReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Report a card error",
    description="Submit an error report for a vocabulary card or culture question.",
    responses={
        201: {"description": "Error report created successfully"},
        409: {"description": "User already reported this card"},
    },
)
async def create_card_error(
    error_data: CardErrorReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CardErrorReportResponse:
    """Submit an error report for a card."""
    service = CardErrorService(db)

    report = await service.create_card_error_report(
        user_id=current_user.id,
        data=error_data,
    )

    await db.commit()

    return CardErrorReportResponse.model_validate(report)
