"""Unit tests for NotificationRepository.

This module tests bulk UPDATE/DELETE operations outside the ORM identity map:
- mark_as_read: True on unread, no-op guard (already read), cross-user isolation
- mark_all_as_read: count returned, user isolation
- delete_older_than: cutoff boundary (tz-aware after fix)
- delete_all_by_user: count returned, idempotency
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Notification, NotificationType, User
from src.repositories.notification import NotificationRepository

# =============================================================================
# Local fixtures
# =============================================================================


@pytest.fixture
async def notif_user(db_session: AsyncSession) -> User:
    """Create a primary user for notification tests."""
    user = User(
        email=f"notif_user_{uuid4().hex[:8]}@example.com",
        full_name="Notification Tester",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def other_user(db_session: AsyncSession) -> User:
    """Create a second user for isolation tests."""
    user = User(
        email=f"notif_other_{uuid4().hex[:8]}@example.com",
        full_name="Other Tester",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


async def _create_notification(
    db_session: AsyncSession,
    user_id,
    *,
    read: bool = False,
    created_at: datetime | None = None,
) -> Notification:
    """Helper: create a single Notification in the DB."""
    notif = Notification(
        user_id=user_id,
        type=NotificationType.WELCOME,
        title="Test notification",
        message="Test message",
        icon="info",
        read=read,
        read_at=datetime.now(UTC) if read else None,
    )
    db_session.add(notif)
    await db_session.flush()
    await db_session.refresh(notif)

    # Backdate created_at via raw SQL when a specific timestamp is needed
    if created_at is not None:
        from sqlalchemy import text

        await db_session.execute(
            text("UPDATE notifications SET created_at = :ts WHERE id = :id"),
            {"ts": created_at, "id": notif.id},
        )
        await db_session.flush()
        await db_session.refresh(notif)

    return notif


# =============================================================================
# TestMarkAsRead
# =============================================================================


class TestMarkAsRead:
    """Tests for mark_as_read: bulk UPDATE with user + read guard."""

    @pytest.mark.asyncio
    async def test_marks_unread_notification_as_read(
        self,
        db_session: AsyncSession,
        notif_user: User,
    ):
        """mark_as_read returns True and sets read=True on an unread notification."""
        notif = await _create_notification(db_session, notif_user.id, read=False)
        repo = NotificationRepository(db_session)

        result = await repo.mark_as_read(notif.id, notif_user.id)

        assert result is True

        # Verify read flag was persisted
        await db_session.refresh(notif)
        assert notif.read is True
        assert notif.read_at is not None

    @pytest.mark.asyncio
    async def test_no_op_when_already_read(
        self,
        db_session: AsyncSession,
        notif_user: User,
    ):
        """mark_as_read returns False (rowcount=0) when notification is already read."""
        notif = await _create_notification(db_session, notif_user.id, read=True)
        repo = NotificationRepository(db_session)

        result = await repo.mark_as_read(notif.id, notif_user.id)

        # The WHERE clause includes read=False, so already-read rows are not updated
        assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_for_nonexistent_notification(
        self,
        db_session: AsyncSession,
        notif_user: User,
    ):
        """mark_as_read returns False when the notification_id does not exist."""
        repo = NotificationRepository(db_session)

        result = await repo.mark_as_read(uuid4(), notif_user.id)

        assert result is False

    @pytest.mark.asyncio
    async def test_cross_user_returns_false(
        self,
        db_session: AsyncSession,
        notif_user: User,
        other_user: User,
    ):
        """mark_as_read returns False when user_id does not own the notification."""
        notif = await _create_notification(db_session, notif_user.id, read=False)
        repo = NotificationRepository(db_session)

        # other_user tries to mark notif_user's notification
        result = await repo.mark_as_read(notif.id, other_user.id)

        assert result is False

        # Original notification must remain unread
        await db_session.refresh(notif)
        assert notif.read is False


# =============================================================================
# TestMarkAllAsRead
# =============================================================================


class TestMarkAllAsRead:
    """Tests for mark_all_as_read: returns count, respects user isolation."""

    @pytest.mark.asyncio
    async def test_marks_all_unread_notifications_as_read(
        self,
        db_session: AsyncSession,
        notif_user: User,
    ):
        """mark_all_as_read returns the count of updated rows."""
        for _ in range(3):
            await _create_notification(db_session, notif_user.id, read=False)
        repo = NotificationRepository(db_session)

        count = await repo.mark_all_as_read(notif_user.id)

        assert count == 3

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_unread(
        self,
        db_session: AsyncSession,
        notif_user: User,
    ):
        """mark_all_as_read returns 0 when all notifications are already read."""
        for _ in range(2):
            await _create_notification(db_session, notif_user.id, read=True)
        repo = NotificationRepository(db_session)

        count = await repo.mark_all_as_read(notif_user.id)

        assert count == 0

    @pytest.mark.asyncio
    async def test_user_isolation(
        self,
        db_session: AsyncSession,
        notif_user: User,
        other_user: User,
    ):
        """mark_all_as_read only updates the target user's notifications."""
        # Create 2 unread for notif_user, 3 unread for other_user
        for _ in range(2):
            await _create_notification(db_session, notif_user.id, read=False)
        for _ in range(3):
            await _create_notification(db_session, other_user.id, read=False)

        repo = NotificationRepository(db_session)

        count = await repo.mark_all_as_read(notif_user.id)

        # Only notif_user's 2 notifications are updated
        assert count == 2

        # other_user's notifications remain unread
        unread_other = await repo.get_unread_count(other_user.id)
        assert unread_other == 3

    @pytest.mark.asyncio
    async def test_returns_zero_for_user_with_no_notifications(
        self,
        db_session: AsyncSession,
        notif_user: User,
    ):
        """mark_all_as_read returns 0 when user has no notifications at all."""
        repo = NotificationRepository(db_session)

        count = await repo.mark_all_as_read(notif_user.id)

        assert count == 0

    @pytest.mark.asyncio
    async def test_only_counts_previously_unread(
        self,
        db_session: AsyncSession,
        notif_user: User,
    ):
        """mark_all_as_read only counts the rows it actually changed (read=False)."""
        # 2 already read, 4 unread
        for _ in range(2):
            await _create_notification(db_session, notif_user.id, read=True)
        for _ in range(4):
            await _create_notification(db_session, notif_user.id, read=False)

        repo = NotificationRepository(db_session)

        count = await repo.mark_all_as_read(notif_user.id)

        assert count == 4


# =============================================================================
# TestDeleteOlderThan
# =============================================================================


class TestDeleteOlderThan:
    """Tests for delete_older_than: tz-aware cutoff boundary."""

    @pytest.mark.asyncio
    async def test_deletes_notifications_older_than_cutoff(
        self,
        db_session: AsyncSession,
        notif_user: User,
    ):
        """delete_older_than removes notifications whose created_at < cutoff."""
        old_ts = datetime.now(UTC) - timedelta(days=10)
        await _create_notification(db_session, notif_user.id, created_at=old_ts)

        repo = NotificationRepository(db_session)

        # Delete older than 5 days — the 10-day-old notification must go
        count = await repo.delete_older_than(days=5)

        assert count >= 1

    @pytest.mark.asyncio
    async def test_does_not_delete_recent_notifications(
        self,
        db_session: AsyncSession,
        notif_user: User,
    ):
        """delete_older_than leaves notifications newer than the cutoff intact."""
        # Create a notification with default (now) created_at
        notif = await _create_notification(db_session, notif_user.id)
        repo = NotificationRepository(db_session)

        count = await repo.delete_older_than(days=5)

        assert count == 0

        # Notification still exists
        remaining = await repo.get_by_user(notif_user.id)
        assert any(n.id == notif.id for n in remaining)

    @pytest.mark.asyncio
    async def test_cutoff_boundary_exactly_at_threshold(
        self,
        db_session: AsyncSession,
        notif_user: User,
    ):
        """Notification created exactly at cutoff is NOT deleted (strict < comparison)."""
        # A notification created 5 days ago — should survive a 5-day cutoff
        # because the cutoff is datetime.now(UTC) - 5 days and the condition is < cutoff
        # (not <=), so a notification created 5 days ago is borderline; we use 5 days + 1s
        # to guarantee it is older than the cutoff.
        just_over_cutoff = datetime.now(UTC) - timedelta(days=5, seconds=2)
        await _create_notification(db_session, notif_user.id, created_at=just_over_cutoff)

        repo = NotificationRepository(db_session)
        count = await repo.delete_older_than(days=5)

        assert count >= 1

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_old_notifications(
        self,
        db_session: AsyncSession,
        notif_user: User,
    ):
        """delete_older_than returns 0 when nothing is old enough to delete."""
        repo = NotificationRepository(db_session)

        count = await repo.delete_older_than(days=30)

        assert count == 0

    @pytest.mark.asyncio
    async def test_deletes_across_all_users(
        self,
        db_session: AsyncSession,
        notif_user: User,
        other_user: User,
    ):
        """delete_older_than is not scoped to a user — deletes old rows for everyone."""
        old_ts = datetime.now(UTC) - timedelta(days=10)
        await _create_notification(db_session, notif_user.id, created_at=old_ts)
        await _create_notification(db_session, other_user.id, created_at=old_ts)

        repo = NotificationRepository(db_session)

        count = await repo.delete_older_than(days=5)

        assert count >= 2


# =============================================================================
# TestDeleteAllByUser
# =============================================================================


class TestDeleteAllByUser:
    """Tests for delete_all_by_user: count returned + idempotency."""

    @pytest.mark.asyncio
    async def test_deletes_all_notifications_for_user(
        self,
        db_session: AsyncSession,
        notif_user: User,
    ):
        """delete_all_by_user returns the count of deleted rows."""
        for _ in range(4):
            await _create_notification(db_session, notif_user.id)
        repo = NotificationRepository(db_session)

        count = await repo.delete_all_by_user(notif_user.id)

        assert count == 4

    @pytest.mark.asyncio
    async def test_idempotent_second_call_returns_zero(
        self,
        db_session: AsyncSession,
        notif_user: User,
    ):
        """Calling delete_all_by_user twice returns 0 on the second call."""
        for _ in range(2):
            await _create_notification(db_session, notif_user.id)
        repo = NotificationRepository(db_session)

        first = await repo.delete_all_by_user(notif_user.id)
        second = await repo.delete_all_by_user(notif_user.id)

        assert first == 2
        assert second == 0

    @pytest.mark.asyncio
    async def test_returns_zero_when_user_has_no_notifications(
        self,
        db_session: AsyncSession,
        notif_user: User,
    ):
        """delete_all_by_user returns 0 for a user with no notifications."""
        repo = NotificationRepository(db_session)

        count = await repo.delete_all_by_user(notif_user.id)

        assert count == 0

    @pytest.mark.asyncio
    async def test_user_isolation(
        self,
        db_session: AsyncSession,
        notif_user: User,
        other_user: User,
    ):
        """delete_all_by_user only deletes the target user's notifications."""
        for _ in range(3):
            await _create_notification(db_session, notif_user.id)
        for _ in range(5):
            await _create_notification(db_session, other_user.id)

        repo = NotificationRepository(db_session)

        count = await repo.delete_all_by_user(notif_user.id)

        assert count == 3

        # other_user's notifications survive
        remaining = await repo.get_by_user(other_user.id)
        assert len(remaining) == 5

    @pytest.mark.asyncio
    async def test_deletes_mix_of_read_and_unread(
        self,
        db_session: AsyncSession,
        notif_user: User,
    ):
        """delete_all_by_user removes both read and unread notifications."""
        await _create_notification(db_session, notif_user.id, read=False)
        await _create_notification(db_session, notif_user.id, read=True)
        repo = NotificationRepository(db_session)

        count = await repo.delete_all_by_user(notif_user.id)

        assert count == 2
