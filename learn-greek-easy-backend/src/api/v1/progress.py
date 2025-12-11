"""Progress API endpoints.

This module provides endpoints for progress tracking and analytics,
including dashboard statistics, deck progress, and learning trends.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.db.dependencies import get_db
from src.db.models import User
from src.schemas.progress import DashboardStatsResponse
from src.services.progress_service import ProgressService

router = APIRouter(
    # Note: prefix is set by parent router in v1/router.py
    # This router is mounted at /progress under the /api/v1 prefix
    tags=["Progress"],
    responses={
        401: {"description": "Not authenticated"},
        422: {"description": "Validation error"},
    },
)


@router.get(
    "/dashboard",
    response_model=DashboardStatsResponse,
    summary="Get dashboard statistics",
    description="""
    Get comprehensive dashboard statistics in a single API call.

    This endpoint provides:
    - **Overview**: Total cards studied, mastered, decks started, mastery percentage
    - **Today**: Reviews completed, cards due, daily goal progress, study time
    - **Streak**: Current and longest streak, last study date
    - **Cards by status**: Breakdown of new, learning, review, mastered cards
    - **Recent activity**: Last 7 days of activity with review counts and quality

    This is the primary endpoint for populating the frontend dashboard.
    """,
    responses={
        200: {
            "description": "Dashboard statistics retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "overview": {
                            "total_cards_studied": 150,
                            "total_cards_mastered": 45,
                            "total_decks_started": 3,
                            "overall_mastery_percentage": 30.0,
                        },
                        "today": {
                            "reviews_completed": 25,
                            "cards_due": 12,
                            "daily_goal": 20,
                            "goal_progress_percentage": 125.0,
                            "study_time_seconds": 1800,
                        },
                        "streak": {
                            "current_streak": 7,
                            "longest_streak": 14,
                            "last_study_date": "2024-01-15",
                        },
                        "cards_by_status": {
                            "new": 50,
                            "learning": 35,
                            "review": 45,
                            "mastered": 45,
                        },
                        "recent_activity": [
                            {
                                "date": "2024-01-15",
                                "reviews_count": 25,
                                "average_quality": 4.2,
                            }
                        ],
                    }
                }
            },
        },
    },
)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardStatsResponse:
    """Get comprehensive dashboard statistics.

    Returns all statistics needed for the dashboard view including
    overview stats, today's activity, streak information, card status
    breakdown, and recent activity.

    Args:
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        DashboardStatsResponse with all dashboard data
    """
    service = ProgressService(db)
    return await service.get_dashboard_stats(current_user.id)
