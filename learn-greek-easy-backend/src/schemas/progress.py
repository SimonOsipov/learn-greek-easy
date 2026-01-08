"""Progress-related Pydantic schemas for API request/response validation.

This module contains schemas for:
- User deck progress tracking
- Card statistics (SM-2 algorithm data)
- Progress summaries
- Study session statistics
"""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.db.models import CardStatus

# ============================================================================
# Progress Schemas
# ============================================================================


class UserDeckProgressResponse(BaseModel):
    """Schema for user's progress on a specific deck."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    deck_id: UUID
    cards_studied: int
    cards_mastered: int
    last_studied_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class CardStatisticsResponse(BaseModel):
    """Schema for card statistics (SM-2 algorithm data)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    card_id: UUID
    easiness_factor: float = Field(..., ge=1.3, le=2.5)
    interval: int = Field(..., ge=0)
    repetitions: int = Field(..., ge=0)
    next_review_date: date
    status: CardStatus
    created_at: datetime
    updated_at: datetime


class ProgressSummaryResponse(BaseModel):
    """Schema for overall user progress summary."""

    total_decks_started: int
    total_cards_studied: int
    total_cards_mastered: int
    cards_due_today: int
    current_streak: int = 0
    longest_streak: int = 0
    total_study_time: int = 0  # seconds


class StudySessionStatsResponse(BaseModel):
    """Schema for study session statistics."""

    session_id: str
    deck_id: UUID
    cards_reviewed: int
    cards_correct: int
    cards_incorrect: int
    average_time_per_card: float
    total_time: int  # seconds
    started_at: datetime
    ended_at: Optional[datetime]


# ============================================================================
# Dashboard Schemas
# ============================================================================


class OverviewStats(BaseModel):
    """Overall progress statistics."""

    total_cards_studied: int
    total_cards_mastered: int
    total_decks_started: int
    overall_mastery_percentage: float = Field(..., ge=0, le=100)
    accuracy_percentage: float = Field(default=0.0, ge=0, le=100)
    culture_questions_mastered: int = Field(default=0, ge=0)


class TodayStats(BaseModel):
    """Today's activity statistics."""

    reviews_completed: int
    cards_due: int
    daily_goal: int
    goal_progress_percentage: float = Field(..., ge=0)
    study_time_seconds: int


class StreakStats(BaseModel):
    """Streak information."""

    current_streak: int
    longest_streak: int
    last_study_date: Optional[date]


class RecentActivity(BaseModel):
    """Single day activity summary."""

    date: date
    reviews_count: int
    average_quality: float = Field(..., ge=0, le=5)


class DashboardStatsResponse(BaseModel):
    """Complete dashboard statistics response."""

    overview: OverviewStats
    today: TodayStats
    streak: StreakStats
    cards_by_status: dict[str, int]
    recent_activity: list[RecentActivity]


# ============================================================================
# Deck Progress Schemas
# ============================================================================


class DeckProgressSummary(BaseModel):
    """Deck progress summary for list view."""

    model_config = ConfigDict(from_attributes=True)

    deck_id: UUID
    deck_name: str
    deck_level: str
    total_cards: int
    cards_studied: int
    cards_mastered: int
    cards_due: int
    mastery_percentage: float = Field(..., ge=0, le=100)
    completion_percentage: float = Field(..., ge=0, le=100)
    last_studied_at: Optional[datetime]
    average_easiness_factor: Optional[float]
    estimated_review_time_minutes: int


class DeckProgressListResponse(BaseModel):
    """Paginated list of deck progress."""

    total: int
    page: int
    page_size: int
    decks: list[DeckProgressSummary]


class DeckProgressMetrics(BaseModel):
    """Detailed progress metrics for a deck."""

    total_cards: int
    cards_studied: int
    cards_mastered: int
    cards_due: int
    cards_new: int
    cards_learning: int
    cards_review: int
    mastery_percentage: float = Field(..., ge=0, le=100)
    completion_percentage: float = Field(..., ge=0, le=100)


class DeckStatistics(BaseModel):
    """Study statistics for a deck."""

    total_reviews: int
    total_study_time_seconds: int
    average_quality: float = Field(..., ge=0, le=5)
    average_easiness_factor: float = Field(..., ge=1.3)
    average_interval_days: float = Field(..., ge=0)


class DeckTimeline(BaseModel):
    """Timeline information for deck progress."""

    first_studied_at: Optional[datetime]
    last_studied_at: Optional[datetime]
    days_active: int
    estimated_completion_days: Optional[int]


class DeckProgressDetailResponse(BaseModel):
    """Detailed progress for a single deck."""

    deck_id: UUID
    deck_name: str
    deck_level: str
    deck_description: Optional[str]
    progress: DeckProgressMetrics
    statistics: DeckStatistics
    timeline: DeckTimeline


# ============================================================================
# Learning Trends Schemas
# ============================================================================


class DailyStats(BaseModel):
    """Statistics for a single day."""

    date: date
    reviews_count: int
    cards_learned: int
    cards_learning: int = 0
    cards_mastered: int
    study_time_seconds: int
    average_quality: float = Field(..., ge=0, le=5)
    vocab_accuracy: float = Field(default=0.0, ge=0, le=100)
    culture_accuracy: float = Field(default=0.0, ge=0, le=100)
    combined_accuracy: float = Field(default=0.0, ge=0, le=100)


class TrendsSummary(BaseModel):
    """Summary of trends over the period."""

    total_reviews: int
    total_study_time_seconds: int
    cards_mastered: int
    average_daily_reviews: float = Field(..., ge=0)
    best_day: Optional[date]
    quality_trend: str  # "improving", "stable", "declining"


class LearningTrendsResponse(BaseModel):
    """Learning trends over a period."""

    period: str
    start_date: date
    end_date: date
    daily_stats: list[DailyStats]
    summary: TrendsSummary


# ============================================================================
# Achievements Schemas (Stretch Goal)
# ============================================================================


class Achievement(BaseModel):
    """Single achievement."""

    id: str
    name: str
    description: str
    icon: str
    unlocked: bool
    unlocked_at: Optional[datetime]
    progress: float = Field(..., ge=0, le=100)
    points: int = Field(..., ge=0)


class NextMilestone(BaseModel):
    """Next achievement to unlock."""

    id: str
    name: str
    progress: float = Field(..., ge=0, le=100)
    remaining: int = Field(..., ge=0)


class AchievementsResponse(BaseModel):
    """User achievements response."""

    achievements: list[Achievement]
    total_points: int = Field(..., ge=0)
    next_milestone: Optional[NextMilestone]
