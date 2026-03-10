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

from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from src.core.dependencies import SSEAuthResult, get_current_user, get_sse_auth
from src.core.event_bus import notification_event_bus
from src.db.dependencies import get_db
from src.db.models import User
from src.db.session import get_session_factory
from src.schemas.notification import (
    ClearResponse,
    MarkReadResponse,
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from src.services.notification_service import NotificationService
from src.utils.sse import create_sse_response, format_sse_error, format_sse_event, sse_stream

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
# SSE Stream (specific path BEFORE parameterized)
# =============================================================================


@router.get("/stream", summary="SSE notification stream")
async def notification_stream(
    request: Request,
    sse_auth: SSEAuthResult = Depends(get_sse_auth),
) -> StreamingResponse:
    """Stream real-time notification events via SSE.

    Authenticates via query parameter token or Authorization header.
    Sends initial unread count, then forwards events from the event bus.
    Heartbeats prevent Railway proxy from closing idle connections.
    """
    if not sse_auth.is_authenticated:

        async def auth_error_gen() -> AsyncGenerator[str, None]:
            yield format_sse_error(
                sse_auth.error_code or "auth_required",
                sse_auth.error_message or "Authentication required",
            )

        return create_sse_response(auth_error_gen())

    assert sse_auth.user is not None
    user = sse_auth.user

    # Subscribe BEFORE taking the unread count snapshot so no notification
    # committed between the two operations is missed.
    queue = await notification_event_bus.subscribe(user.id)

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            factory = get_session_factory()
            async with factory.begin() as db:
                notification_service = NotificationService(db)
                initial_count = await notification_service.get_unread_count(user.id)

            yield format_sse_event({"count": initial_count}, event="unread_count")
            while True:
                event = await queue.get()
                yield format_sse_event(event.payload, event=event.event_type)
        finally:
            await notification_event_bus.unsubscribe(user.id, queue)

    return create_sse_response(sse_stream(event_generator()))


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
