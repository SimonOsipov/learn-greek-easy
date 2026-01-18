"""XP and Achievement API schemas.

Pydantic models for request/response validation of XP and achievement endpoints.
"""

from typing import List, Optional

from pydantic import BaseModel, Field

# =============================================================================
# XP Stats Schemas
# =============================================================================


class XPStatsResponse(BaseModel):
    """Response for GET /xp/stats endpoint.

    Maps to XPService.get_user_xp_stats() return type.
    """

    total_xp: int = Field(..., ge=0, description="Total XP earned by the user")
    current_level: int = Field(..., ge=1, le=15, description="Current level (1-15)")
    level_name_greek: str = Field(..., description="Level name in Greek")
    level_name_english: str = Field(..., description="Level name in English")
    xp_in_level: int = Field(..., ge=0, description="XP progress within current level")
    xp_for_next_level: int = Field(..., ge=0, description="Total XP needed for next level")
    progress_percentage: float = Field(
        ..., ge=0, le=100, description="Progress to next level as percentage"
    )


# =============================================================================
# Achievement Schemas
# =============================================================================


class AchievementResponse(BaseModel):
    """Single achievement with user progress.

    Maps to AchievementService.get_user_achievements() list items.
    """

    id: str = Field(..., description="Unique achievement identifier")
    name: str = Field(..., description="Achievement name")
    description: str = Field(..., description="Achievement description")
    category: str = Field(..., description="Achievement category (STREAK, LEARNING, etc.)")
    icon: str = Field(..., description="Icon identifier for frontend")
    hint: str = Field(..., description="Hint for how to unlock")
    threshold: int = Field(..., ge=0, description="Value needed to unlock")
    xp_reward: int = Field(..., ge=0, description="XP awarded on unlock")
    unlocked: bool = Field(..., description="Whether user has unlocked this")
    unlocked_at: Optional[str] = Field(None, description="ISO timestamp when unlocked")
    progress: float = Field(..., ge=0, le=100, description="Progress percentage")
    current_value: int = Field(..., ge=0, description="User's current value for metric")


class AchievementsListResponse(BaseModel):
    """Response for GET /xp/achievements endpoint."""

    achievements: List[AchievementResponse] = Field(
        ..., description="All achievements with progress"
    )
    total_count: int = Field(..., ge=0, description="Total number of achievements")
    unlocked_count: int = Field(..., ge=0, description="Number unlocked by user")
    total_xp_earned: int = Field(..., ge=0, description="Total XP from achievements")
