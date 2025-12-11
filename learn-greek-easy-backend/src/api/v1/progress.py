"""Progress API endpoints.

This module provides endpoints for progress tracking and analytics,
including dashboard statistics, deck progress, and learning trends.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.db.dependencies import get_db
from src.db.models import User
from src.schemas.progress import (
    AchievementsResponse,
    DashboardStatsResponse,
    DeckProgressDetailResponse,
    DeckProgressListResponse,
    LearningTrendsResponse,
)
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


@router.get(
    "/decks",
    response_model=DeckProgressListResponse,
    summary="List deck progress",
    description="""
    Get paginated list of progress for all decks the user has started studying.

    Each deck includes:
    - Basic deck info (name, level)
    - Progress metrics (studied, mastered, due)
    - Percentage completion and mastery
    - Estimated review time
    - Average easiness factor

    Use `page` and `page_size` query parameters for pagination.
    """,
    responses={
        200: {
            "description": "Deck progress list retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "total": 3,
                        "page": 1,
                        "page_size": 20,
                        "decks": [
                            {
                                "deck_id": "550e8400-e29b-41d4-a716-446655440000",
                                "deck_name": "Greek A1 Vocabulary",
                                "deck_level": "A1",
                                "total_cards": 100,
                                "cards_studied": 75,
                                "cards_mastered": 30,
                                "cards_due": 15,
                                "mastery_percentage": 30.0,
                                "completion_percentage": 75.0,
                                "last_studied_at": "2024-01-15T10:30:00Z",
                                "average_easiness_factor": 2.35,
                                "estimated_review_time_minutes": 8,
                            }
                        ],
                    }
                }
            },
        },
    },
)
async def get_deck_progress_list(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (1-100)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeckProgressListResponse:
    """Get paginated list of deck progress.

    Returns progress for all decks the user has started studying,
    with pagination support.

    Args:
        page: Page number starting from 1
        page_size: Number of items per page (1-100)
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        DeckProgressListResponse with total count and paginated deck list
    """
    service = ProgressService(db)
    return await service.get_deck_progress_list(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/decks/{deck_id}",
    response_model=DeckProgressDetailResponse,
    summary="Get deck progress details",
    description="""
    Get detailed progress for a specific deck.

    Includes:
    - **Progress metrics**: Cards studied, mastered, due, by status
    - **Statistics**: Total reviews, study time, average quality/EF/interval
    - **Timeline**: First/last studied, days active, estimated completion

    Returns 404 if:
    - Deck doesn't exist
    - User has no progress for the deck
    """,
    responses={
        200: {
            "description": "Deck progress details retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "deck_id": "550e8400-e29b-41d4-a716-446655440000",
                        "deck_name": "Greek A1 Vocabulary",
                        "deck_level": "A1",
                        "deck_description": "Essential Greek vocabulary for beginners",
                        "progress": {
                            "total_cards": 100,
                            "cards_studied": 75,
                            "cards_mastered": 30,
                            "cards_due": 15,
                            "cards_new": 25,
                            "cards_learning": 20,
                            "cards_review": 25,
                            "mastery_percentage": 30.0,
                            "completion_percentage": 75.0,
                        },
                        "statistics": {
                            "total_reviews": 250,
                            "total_study_time_seconds": 7500,
                            "average_quality": 3.8,
                            "average_easiness_factor": 2.35,
                            "average_interval_days": 4.5,
                        },
                        "timeline": {
                            "first_studied_at": "2024-01-01T10:00:00Z",
                            "last_studied_at": "2024-01-15T10:30:00Z",
                            "days_active": 15,
                            "estimated_completion_days": 10,
                        },
                    }
                }
            },
        },
        404: {
            "description": "Deck not found or no progress exists",
            "content": {
                "application/json": {
                    "example": {"detail": "Deck not found", "error_code": "NOT_FOUND"}
                }
            },
        },
    },
)
async def get_deck_progress_detail(
    deck_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeckProgressDetailResponse:
    """Get detailed progress for a specific deck.

    Returns comprehensive progress information including metrics,
    statistics, and timeline for the specified deck.

    Args:
        deck_id: UUID of the deck to get progress for
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        DeckProgressDetailResponse with detailed deck progress

    Raises:
        DeckNotFoundException: If deck doesn't exist
        NotFoundException: If user has no progress for deck
    """
    service = ProgressService(db)
    return await service.get_deck_progress_detail(
        user_id=current_user.id,
        deck_id=deck_id,
    )


@router.get(
    "/trends",
    response_model=LearningTrendsResponse,
    summary="Get learning trends",
    description="""
    Get historical learning trends and analytics for charts and graphs.

    This endpoint provides:
    - **Daily statistics**: Reviews count, cards learned/mastered, study time, quality per day
    - **Summary**: Total reviews, study time, cards mastered, average daily reviews, best day, quality trend

    **Period options**:
    - `week`: Last 7 days (default)
    - `month`: Last 30 days
    - `year`: Last 365 days

    Daily stats are zero-filled for days with no activity, ensuring consistent chart data.

    Quality trend is calculated by comparing the first half vs second half of the period:
    - `improving`: Second half average quality > first half + 0.3
    - `declining`: Second half average quality < first half - 0.3
    - `stable`: Within 0.3 of first half
    """,
    responses={
        200: {
            "description": "Learning trends retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "period": "week",
                        "start_date": "2024-01-08",
                        "end_date": "2024-01-15",
                        "daily_stats": [
                            {
                                "date": "2024-01-15",
                                "reviews_count": 25,
                                "cards_learned": 5,
                                "cards_mastered": 2,
                                "study_time_seconds": 1800,
                                "average_quality": 4.2,
                            },
                            {
                                "date": "2024-01-14",
                                "reviews_count": 0,
                                "cards_learned": 0,
                                "cards_mastered": 0,
                                "study_time_seconds": 0,
                                "average_quality": 0.0,
                            },
                        ],
                        "summary": {
                            "total_reviews": 150,
                            "total_study_time_seconds": 10800,
                            "cards_mastered": 12,
                            "average_daily_reviews": 21.4,
                            "best_day": "2024-01-12",
                            "quality_trend": "improving",
                        },
                    }
                }
            },
        },
        401: {"description": "Not authenticated - missing or invalid token"},
        422: {
            "description": "Validation error - invalid period value",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {
                                "type": "string_pattern_mismatch",
                                "loc": ["query", "period"],
                                "msg": "String should match pattern '^(week|month|year)$'",
                                "input": "invalid",
                                "ctx": {"pattern": "^(week|month|year)$"},
                            }
                        ]
                    }
                }
            },
        },
    },
)
async def get_learning_trends(
    period: str = Query(
        default="week",
        pattern="^(week|month|year)$",
        description="Time period for trends: 'week' (7 days), 'month' (30 days), or 'year' (365 days)",
    ),
    deck_id: Optional[UUID] = Query(
        default=None,
        description="Optional deck UUID to filter trends for a specific deck",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LearningTrendsResponse:
    """Get learning trends for charts and analytics.

    Retrieves historical learning data aggregated by day for the specified
    period. Supports optional filtering by deck.

    The quality_trend in the summary indicates whether the user's recall
    quality is improving, stable, or declining over the period.

    Args:
        period: Time period - "week" (7 days), "month" (30 days), or "year" (365 days)
        deck_id: Optional deck UUID to filter trends
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        LearningTrendsResponse with daily stats and summary

    Raises:
        ValidationError (422): If period is not week/month/year
    """
    service = ProgressService(db)
    return await service.get_learning_trends(
        user_id=current_user.id,
        period=period,
        deck_id=deck_id,
    )


@router.get(
    "/achievements",
    response_model=AchievementsResponse,
    summary="Get user achievements",
    description="""
    Get user achievements and gamification progress.

    This endpoint returns:
    - **Achievements**: All available achievements with unlock status and progress
    - **Total points**: Sum of points from unlocked achievements
    - **Next milestone**: The closest achievement to being unlocked

    Achievements are calculated in real-time based on user statistics including:
    - **Streak achievements**: Based on longest consecutive study days
    - **Mastery achievements**: Based on total cards mastered
    - **Review achievements**: Based on total reviews completed
    - **Time achievements**: Based on total study time
    - **Deck achievements**: Based on number of decks started

    Progress percentage shows how close the user is to unlocking each achievement.
    """,
    responses={
        200: {
            "description": "Achievements retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "achievements": [
                            {
                                "id": "streak_7",
                                "name": "Week Warrior",
                                "description": "Maintain a 7-day study streak",
                                "icon": "flame",
                                "unlocked": True,
                                "unlocked_at": None,
                                "progress": 100.0,
                                "points": 50,
                            },
                            {
                                "id": "mastered_100",
                                "name": "Century Club",
                                "description": "Master 100 flashcards",
                                "icon": "medal",
                                "unlocked": False,
                                "unlocked_at": None,
                                "progress": 45.0,
                                "points": 0,
                            },
                        ],
                        "total_points": 145,
                        "next_milestone": {
                            "id": "mastered_100",
                            "name": "Century Club",
                            "progress": 45.0,
                            "remaining": 55,
                        },
                    }
                }
            },
        },
        401: {"description": "Not authenticated - missing or invalid token"},
    },
)
async def get_achievements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AchievementsResponse:
    """Get user achievements and gamification progress.

    Returns all available achievements with their unlock status, progress
    percentage, total points earned, and the next milestone to unlock.

    Args:
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        AchievementsResponse with achievements, total points, and next milestone
    """
    service = ProgressService(db)
    return await service.get_achievements(current_user.id)
