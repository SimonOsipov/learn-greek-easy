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
