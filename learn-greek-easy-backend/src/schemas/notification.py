"""Notification API schemas.

Pydantic schemas for notification request/response validation.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class NotificationResponse(BaseModel):
    """Single notification in API response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Notification UUID")
    type: str = Field(
        ...,
        description=(
            "Notification type: achievement_unlocked, daily_goal_complete, "
            "level_up, streak_at_risk, streak_lost, welcome"
        ),
    )
    title: str = Field(..., description="Notification title")
    message: str = Field(..., description="Notification message")
    icon: str = Field(..., description="Icon identifier")
    action_url: Optional[str] = Field(None, description="Navigation URL on click")
    extra_data: Optional[dict[str, Any]] = Field(None, description="Additional context data")
    read: bool = Field(..., description="Read status")
    read_at: Optional[datetime] = Field(None, description="When notification was read")
    created_at: datetime = Field(..., description="Creation timestamp")


class NotificationListResponse(BaseModel):
    """Response for GET /notifications endpoint."""

    notifications: list[NotificationResponse] = Field(..., description="List of notifications")
    unread_count: int = Field(..., ge=0, description="Number of unread notifications")
    total_count: int = Field(..., ge=0, description="Total notifications count")
    has_more: bool = Field(..., description="Whether more notifications exist")


class UnreadCountResponse(BaseModel):
    """Response for GET /notifications/unread-count endpoint."""

    count: int = Field(..., ge=0, description="Number of unread notifications")


class MarkReadResponse(BaseModel):
    """Response for mark as read operations."""

    success: bool = Field(..., description="Operation success status")
    marked_count: int = Field(default=1, ge=0, description="Number marked as read")


class ClearResponse(BaseModel):
    """Response for clear/delete operations."""

    success: bool = Field(..., description="Operation success status")
    deleted_count: int = Field(..., ge=0, description="Number of notifications deleted")
