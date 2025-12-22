"""Notification repository for database operations."""

from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Notification
from src.repositories.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):
    """Repository for notification CRUD operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(Notification, db)

    async def get_by_user(
        self,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0,
        include_read: bool = True,
    ) -> list[Notification]:
        """Get notifications for a user, ordered by created_at desc."""
        query = select(Notification).where(Notification.user_id == user_id)

        if not include_read:
            query = query.where(Notification.read == False)  # noqa: E712

        query = query.order_by(Notification.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_by_user(
        self,
        user_id: UUID,
        include_read: bool = True,
    ) -> int:
        """Count notifications for a user."""
        query = (
            select(func.count()).select_from(Notification).where(Notification.user_id == user_id)
        )

        if not include_read:
            query = query.where(Notification.read == False)  # noqa: E712

        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_unread_count(self, user_id: UUID) -> int:
        """Get count of unread notifications."""
        return await self.count_by_user(user_id, include_read=False)

    async def mark_as_read(self, notification_id: UUID, user_id: UUID) -> bool:
        """Mark a notification as read. Returns True if updated."""
        result = await self.db.execute(
            update(Notification)
            .where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
                Notification.read == False,  # noqa: E712
            )
            .values(read=True, read_at=func.now())
        )
        # CursorResult from UPDATE has rowcount, but Result[Any] type doesn't expose it
        return bool(result.rowcount > 0)  # type: ignore[attr-defined]

    async def mark_all_as_read(self, user_id: UUID) -> int:
        """Mark all notifications as read. Returns count updated."""
        result = await self.db.execute(
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.read == False,  # noqa: E712
            )
            .values(read=True, read_at=func.now())
        )
        # CursorResult from UPDATE has rowcount, but Result[Any] type doesn't expose it
        return int(result.rowcount) if result.rowcount else 0  # type: ignore[attr-defined]

    async def delete_by_id(self, notification_id: UUID, user_id: UUID) -> bool:
        """Delete a notification. Returns True if deleted."""
        result = await self.db.execute(
            delete(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        # CursorResult from DELETE has rowcount, but Result[Any] type doesn't expose it
        return bool(result.rowcount > 0)  # type: ignore[attr-defined]

    async def delete_all_by_user(self, user_id: UUID) -> int:
        """Delete all notifications for a user. Returns count deleted."""
        result = await self.db.execute(delete(Notification).where(Notification.user_id == user_id))
        # CursorResult from DELETE has rowcount, but Result[Any] type doesn't expose it
        return int(result.rowcount) if result.rowcount else 0  # type: ignore[attr-defined]

    async def delete_older_than(self, days: int) -> int:
        """Delete notifications older than N days. Returns count deleted."""
        cutoff = datetime.utcnow() - timedelta(days=days)
        result = await self.db.execute(delete(Notification).where(Notification.created_at < cutoff))
        # CursorResult from DELETE has rowcount, but Result[Any] type doesn't expose it
        return int(result.rowcount) if result.rowcount else 0  # type: ignore[attr-defined]
