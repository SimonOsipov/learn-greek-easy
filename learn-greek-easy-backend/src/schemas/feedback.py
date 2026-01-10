"""Feedback-related Pydantic schemas for API request/response validation.

This module contains schemas for:
- Feedback CRUD operations
- Voting operations
- Paginated feedback listings
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.db.models import FeedbackCategory, FeedbackStatus, VoteType

# ============================================================================
# Author Schema (Brief User Info)
# ============================================================================


class AuthorBriefResponse(BaseModel):
    """Brief author information for feedback items."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: Optional[str] = None


# ============================================================================
# Feedback Schemas
# ============================================================================


class FeedbackCreate(BaseModel):
    """Schema for creating new feedback."""

    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=10, max_length=5000)
    category: FeedbackCategory


class FeedbackUpdate(BaseModel):
    """Schema for updating feedback (partial update)."""

    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = Field(None, min_length=10, max_length=5000)


class FeedbackResponse(BaseModel):
    """Schema for feedback response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    category: FeedbackCategory
    status: FeedbackStatus
    vote_count: int
    user_vote: Optional[VoteType] = None  # Current user's vote on this item
    admin_response: Optional[str] = None
    admin_response_at: Optional[datetime] = None
    author: AuthorBriefResponse
    created_at: datetime
    updated_at: datetime


class FeedbackListResponse(BaseModel):
    """Schema for paginated feedback list."""

    total: int
    page: int
    page_size: int
    items: List[FeedbackResponse]


# ============================================================================
# Vote Schemas
# ============================================================================


class VoteRequest(BaseModel):
    """Schema for voting on feedback."""

    vote_type: VoteType


class VoteResponse(BaseModel):
    """Schema for vote operation response."""

    feedback_id: UUID
    vote_type: Optional[VoteType]  # None if vote was removed
    new_vote_count: int


# ============================================================================
# Admin Feedback Schemas
# ============================================================================


class AdminFeedbackUpdate(BaseModel):
    """Schema for admin updating feedback (status and/or response)."""

    status: Optional[FeedbackStatus] = None
    admin_response: Optional[str] = Field(None, max_length=500)


class AdminFeedbackResponse(BaseModel):
    """Schema for admin feedback response with admin-specific fields."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    category: FeedbackCategory
    status: FeedbackStatus
    vote_count: int
    admin_response: Optional[str] = None
    admin_response_at: Optional[datetime] = None
    author: AuthorBriefResponse
    created_at: datetime
    updated_at: datetime


class AdminFeedbackListResponse(BaseModel):
    """Schema for paginated admin feedback list."""

    total: int
    page: int
    page_size: int
    items: List[AdminFeedbackResponse]
