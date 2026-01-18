"""XP and Achievements API endpoints.

This module provides endpoints for:
- GET /xp/stats - User XP statistics and level
- GET /xp/achievements - All achievements with progress
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.db.dependencies import get_db
from src.db.models import User
from src.schemas.xp import AchievementResponse, AchievementsListResponse, XPStatsResponse
from src.services.achievement_service import AchievementService
from src.services.xp_service import XPService

router = APIRouter(
    tags=["XP & Achievements"],
    responses={
        401: {"description": "Not authenticated"},
        422: {"description": "Validation error"},
    },
)


@router.get(
    "/stats",
    response_model=XPStatsResponse,
    summary="Get user XP statistics",
    description="""
    Get the current user's XP statistics including:
    - Total XP earned
    - Current level (1-15) with Greek and English names
    - Progress within current level
    - XP needed for next level

    Used by the XP Card component in the frontend.
    """,
    responses={
        200: {
            "description": "XP statistics retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "total_xp": 1250,
                        "current_level": 5,
                        "level_name_greek": "Γνώστης",
                        "level_name_english": "Knower",
                        "xp_in_level": 650,
                        "xp_for_next_level": 1000,
                        "progress_percentage": 65.0,
                    }
                }
            },
        },
    },
)
async def get_xp_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> XPStatsResponse:
    """Get XP statistics for the current user."""
    service = XPService(db)
    stats = await service.get_user_xp_stats(current_user.id)

    return XPStatsResponse(
        total_xp=stats["total_xp"],
        current_level=stats["current_level"],
        level_name_greek=stats["level_name_greek"],
        level_name_english=stats["level_name_english"],
        xp_in_level=stats["xp_in_level"],
        xp_for_next_level=stats["xp_for_next_level"],
        progress_percentage=stats["progress_percentage"],
    )


@router.get(
    "/achievements",
    response_model=AchievementsListResponse,
    summary="Get all achievements with progress",
    description="""
    Get all available achievements with the user's unlock status and progress.

    Each achievement includes:
    - Basic info (name, description, icon, category)
    - Requirements (threshold, metric type)
    - User status (unlocked, progress percentage, current value)
    - Reward (XP amount)

    Achievements are organized by category:
    - STREAK: Daily streak achievements
    - LEARNING: Cards learned/mastered
    - SESSION: Study session achievements
    - ACCURACY: Review accuracy achievements
    - CEFR: CEFR level progression
    - SPECIAL: Special/hidden achievements
    """,
    responses={
        200: {
            "description": "Achievements retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "achievements": [
                            {
                                "id": "streak_3",
                                "name": "Getting Started",
                                "description": "Maintain a 3-day study streak",
                                "category": "STREAK",
                                "icon": "flame",
                                "hint": "Study for 3 days in a row",
                                "threshold": 3,
                                "xp_reward": 50,
                                "unlocked": True,
                                "unlocked_at": "2024-01-15T10:30:00Z",
                                "progress": 100.0,
                                "current_value": 7,
                            }
                        ],
                        "total_count": 35,
                        "unlocked_count": 5,
                        "total_xp_earned": 250,
                    }
                }
            },
        },
    },
)
async def get_achievements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AchievementsListResponse:
    """Get all achievements with user's progress."""
    service = AchievementService(db)
    achievements = await service.get_user_achievements(current_user.id)

    # Calculate summary stats
    unlocked = [a for a in achievements if a["unlocked"]]
    total_xp = sum(a["xp_reward"] for a in unlocked)

    return AchievementsListResponse(
        achievements=[
            AchievementResponse(
                id=a["id"],
                name=a["name"],
                description=a["description"],
                category=a["category"],
                icon=a["icon"],
                hint=a["hint"],
                threshold=a["threshold"],
                xp_reward=a["xp_reward"],
                unlocked=a["unlocked"],
                unlocked_at=a["unlocked_at"],
                progress=a["progress"],
                current_value=a["current_value"],
            )
            for a in achievements
        ],
        total_count=len(achievements),
        unlocked_count=len(unlocked),
        total_xp_earned=total_xp,
    )
