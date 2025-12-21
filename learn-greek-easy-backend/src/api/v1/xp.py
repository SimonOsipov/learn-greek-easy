"""XP and Achievements API endpoints.

This module provides endpoints for:
- GET /xp/stats - User XP statistics and level
- GET /xp/achievements - All achievements with progress
- GET /xp/achievements/unnotified - Newly unlocked, not yet notified
- POST /xp/achievements/notified - Mark achievements as notified
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.db.dependencies import get_db
from src.db.models import User
from src.schemas.xp import (
    AchievementResponse,
    AchievementsListResponse,
    MarkNotifiedRequest,
    MarkNotifiedResponse,
    UnnotifiedAchievementResponse,
    UnnotifiedAchievementsResponse,
    XPStatsResponse,
)
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


@router.get(
    "/achievements/unnotified",
    response_model=UnnotifiedAchievementsResponse,
    summary="Get unnotified achievements",
    description="""
    Get achievements that have been unlocked but not yet shown to the user.

    Frontend should call this endpoint:
    - On app load
    - After completing reviews
    - When navigating to achievements page

    Use this to trigger achievement celebration animations.
    After showing the celebration, call POST /achievements/notified.
    """,
    responses={
        200: {
            "description": "Unnotified achievements retrieved",
            "content": {
                "application/json": {
                    "example": {
                        "achievements": [
                            {
                                "id": "streak_7",
                                "name": "Week Warrior",
                                "icon": "medal",
                                "xp_reward": 100,
                            }
                        ],
                        "count": 1,
                    }
                }
            },
        },
    },
)
async def get_unnotified_achievements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UnnotifiedAchievementsResponse:
    """Get newly unlocked achievements that haven't been notified."""
    service = AchievementService(db)
    unnotified = await service.get_unnotified_achievements(current_user.id)

    return UnnotifiedAchievementsResponse(
        achievements=[
            UnnotifiedAchievementResponse(
                id=a["id"],
                name=a["name"],
                icon=a["icon"],
                xp_reward=a["xp_reward"],
            )
            for a in unnotified
        ],
        count=len(unnotified),
    )


@router.post(
    "/achievements/notified",
    response_model=MarkNotifiedResponse,
    summary="Mark achievements as notified",
    description="""
    Mark achievements as having been shown to the user.

    Call this after displaying the achievement celebration animation
    to prevent showing the same achievement notification again.

    This is idempotent - marking already-notified achievements has no effect.
    """,
    responses={
        200: {
            "description": "Achievements marked as notified",
            "content": {
                "application/json": {
                    "example": {
                        "marked_count": 2,
                        "success": True,
                    }
                }
            },
        },
    },
)
async def mark_achievements_notified(
    request: MarkNotifiedRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MarkNotifiedResponse:
    """Mark achievements as notified after showing to user."""
    service = AchievementService(db)
    await service.mark_achievements_notified(
        user_id=current_user.id,
        achievement_ids=request.achievement_ids,
    )
    await db.commit()

    return MarkNotifiedResponse(
        marked_count=len(request.achievement_ids),
        success=True,
    )
