"""Progress API endpoints (V2 stats)."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.db.dependencies import get_db
from src.db.models import User
from src.schemas.progress import (
    DashboardStatsResponse,
    DeckProgressDetailResponse,
    DeckProgressListResponse,
    LearningTrendsResponse,
)
from src.services.progress_service import ProgressService

router = APIRouter()


@router.get(
    "/dashboard",
    response_model=DashboardStatsResponse,
    summary="Get dashboard stats",
)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardStatsResponse:
    service = ProgressService(db)
    return await service.get_dashboard_stats(current_user.id)


@router.get(
    "/trends",
    response_model=LearningTrendsResponse,
    summary="Get learning trends",
)
async def get_learning_trends(
    period: str = Query(default="week", pattern="^(week|month|quarter)$"),
    deck_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LearningTrendsResponse:
    service = ProgressService(db)
    return await service.get_learning_trends(current_user.id, period=period, deck_id=deck_id)


@router.get(
    "/decks",
    response_model=DeckProgressListResponse,
    summary="Get deck progress list",
)
async def get_deck_progress_list(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeckProgressListResponse:
    service = ProgressService(db)
    return await service.get_deck_progress_list(current_user.id, page=page, page_size=page_size)


@router.get(
    "/decks/{deck_id}",
    response_model=DeckProgressDetailResponse,
    summary="Get deck progress detail",
)
async def get_deck_progress_detail(
    deck_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeckProgressDetailResponse:
    service = ProgressService(db)
    return await service.get_deck_progress_detail(current_user.id, deck_id=deck_id)
