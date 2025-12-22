"""Notification API endpoints.

Provides endpoints for:
- GET /notifications - List notifications (paginated)
- GET /notifications/unread-count - Get unread count
- PUT /notifications/read-all - Mark all as read
- PUT /notifications/{id}/read - Mark single as read
- DELETE /notifications/clear - Clear all notifications
- DELETE /notifications/{id} - Delete single notification

CRITICAL: Route order matters! Specific paths MUST come before parameterized paths
to prevent FastAPI from matching '/read-all' as '/{notification_id}'.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.db.dependencies import get_db
from src.db.models import User
from src.schemas.notification import (
    ClearResponse,
    MarkReadResponse,
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from src.services.notification_service import NotificationService

router = APIRouter(
    tags=["Notifications"],
    responses={
        401: {"description": "Not authenticated"},
        422: {"description": "Validation error"},
    },
)


# =============================================================================
# Collection Operations (no path params)
# =============================================================================


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="List notifications",
    description="Get paginated list of user notifications, ordered by most recent first.",
)
async def list_notifications(
    limit: int = Query(default=20, ge=1, le=50, description="Max notifications to return"),
    offset: int = Query(default=0, ge=0, description="Number to skip"),
    include_read: bool = Query(default=True, description="Include read notifications"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationListResponse:
    """Get paginated notifications for current user."""
    service = NotificationService(db)
    notifications, unread_count, total_count = await service.get_notifications(
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        include_read=include_read,
    )

    has_more = offset + len(notifications) < total_count

    return NotificationListResponse(
        notifications=[
            NotificationResponse(
                id=n.id,
                type=n.type.value,
                title=n.title,
                message=n.message,
                icon=n.icon,
                action_url=n.action_url,
                extra_data=n.extra_data,
                read=n.read,
                read_at=n.read_at,
                created_at=n.created_at,
            )
            for n in notifications
        ],
        unread_count=unread_count,
        total_count=total_count,
        has_more=has_more,
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Get unread count",
    description="Get the count of unread notifications for the current user.",
)
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UnreadCountResponse:
    """Get unread notification count."""
    service = NotificationService(db)
    count = await service.get_unread_count(current_user.id)
    return UnreadCountResponse(count=count)


# =============================================================================
# Bulk Operations (specific paths BEFORE parameterized)
# =============================================================================


@router.put(
    "/read-all",
    response_model=MarkReadResponse,
    summary="Mark all as read",
    description="Mark all notifications as read for the current user.",
)
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MarkReadResponse:
    """Mark all notifications as read."""
    service = NotificationService(db)
    count = await service.mark_all_as_read(current_user.id)
    await db.commit()
    return MarkReadResponse(success=True, marked_count=count)


@router.delete(
    "/clear",
    response_model=ClearResponse,
    summary="Clear all notifications",
    description="Delete all notifications for the current user.",
)
async def clear_all_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClearResponse:
    """Clear all notifications."""
    service = NotificationService(db)
    count = await service.clear_all(current_user.id)
    await db.commit()
    return ClearResponse(success=True, deleted_count=count)


# =============================================================================
# Item Operations (parameterized paths LAST)
# =============================================================================


@router.put(
    "/{notification_id}/read",
    response_model=MarkReadResponse,
    summary="Mark notification as read",
    description="Mark a specific notification as read.",
)
async def mark_as_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MarkReadResponse:
    """Mark a notification as read."""
    service = NotificationService(db)
    success = await service.mark_as_read(notification_id, current_user.id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or already read",
        )

    await db.commit()
    return MarkReadResponse(success=True, marked_count=1)


@router.delete(
    "/{notification_id}",
    response_model=ClearResponse,
    summary="Delete notification",
    description="Delete a specific notification.",
)
async def delete_notification(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClearResponse:
    """Delete a notification."""
    service = NotificationService(db)
    success = await service.delete_notification(notification_id, current_user.id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    await db.commit()
    return ClearResponse(success=True, deleted_count=1)
