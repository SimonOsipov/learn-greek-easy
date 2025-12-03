"""Time manipulation utilities for testing.

This module provides helpers for testing time-dependent logic:
- freeze_time context manager for fixed timestamps
- advance_time helper for SM-2 interval testing
- Token expiration helpers
- Due date calculation helpers

Usage:
    from tests.helpers.time import freeze_time, create_expired_token

    async def test_token_expiration():
        token = create_expired_token(user.id, hours_ago=1)
        # Token should be rejected

    async def test_scheduling():
        with freeze_time("2025-01-15"):
            # All datetime calls return 2025-01-15
            due_cards = await service.get_due_cards()
"""

from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Generator
from unittest.mock import patch
from uuid import UUID

# Check if freezegun is available (optional dependency)
try:
    from freezegun import freeze_time as freezegun_freeze_time

    FREEZEGUN_AVAILABLE = True
except ImportError:
    FREEZEGUN_AVAILABLE = False


# =============================================================================
# Time Freezing
# =============================================================================


@contextmanager
def freeze_time(
    frozen_time: str | datetime | date,
) -> Generator[datetime, None, None]:
    """Context manager to freeze time for testing.

    Uses freezegun if available, otherwise provides basic mocking.

    Args:
        frozen_time: Time to freeze to (ISO string, datetime, or date)

    Yields:
        datetime: The frozen datetime

    Example:
        with freeze_time("2025-01-15 10:30:00"):
            now = datetime.utcnow()
            assert now.date() == date(2025, 1, 15)

        # Or with a datetime object
        with freeze_time(datetime(2025, 1, 15, 10, 30)):
            ...
    """
    if FREEZEGUN_AVAILABLE:
        with freezegun_freeze_time(frozen_time) as frozen:
            yield frozen
    else:
        # Basic fallback without freezegun
        if isinstance(frozen_time, str):
            if "T" in frozen_time or " " in frozen_time:
                frozen_dt = datetime.fromisoformat(frozen_time.replace("Z", "+00:00"))
            else:
                frozen_dt = datetime.fromisoformat(frozen_time)
        elif isinstance(frozen_time, date) and not isinstance(frozen_time, datetime):
            frozen_dt = datetime.combine(frozen_time, datetime.min.time())
        else:
            frozen_dt = frozen_time

        # Mock datetime.utcnow and datetime.now
        class FrozenDatetime(datetime):
            @classmethod
            def utcnow(cls) -> datetime:
                return frozen_dt

            @classmethod
            def now(cls, tz=None) -> datetime:
                if tz:
                    return frozen_dt.replace(tzinfo=tz)
                return frozen_dt

        with patch("datetime.datetime", FrozenDatetime):
            yield frozen_dt


def advance_time(days: int = 0, hours: int = 0, minutes: int = 0) -> datetime:
    """Calculate a future datetime from now.

    Args:
        days: Days to advance
        hours: Hours to advance
        minutes: Minutes to advance

    Returns:
        datetime: Future timestamp

    Example:
        future_date = advance_time(days=7)
        assert future_date > datetime.utcnow()
    """
    return datetime.utcnow() + timedelta(days=days, hours=hours, minutes=minutes)


def past_time(days: int = 0, hours: int = 0, minutes: int = 0) -> datetime:
    """Calculate a past datetime from now.

    Args:
        days: Days ago
        hours: Hours ago
        minutes: Minutes ago

    Returns:
        datetime: Past timestamp

    Example:
        past_date = past_time(days=30)
        assert past_date < datetime.utcnow()
    """
    return datetime.utcnow() - timedelta(days=days, hours=hours, minutes=minutes)


# =============================================================================
# Token Expiration Helpers
# =============================================================================


def create_expired_token(
    user_id: UUID,
    *,
    hours_ago: int = 1,
    token_type: str = "access",
) -> str:
    """Create an expired JWT token for testing expiration handling.

    Args:
        user_id: User ID to embed in token
        hours_ago: How many hours ago the token expired
        token_type: Token type ("access" or "refresh")

    Returns:
        str: Expired JWT token

    Example:
        expired_token = create_expired_token(user.id, hours_ago=2)
        response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
        assert response.status_code == 401
    """
    from jose import jwt

    from src.config import settings

    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() - timedelta(hours=hours_ago),
        "iat": datetime.utcnow() - timedelta(hours=hours_ago + 1),
        "type": token_type,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_future_token(
    user_id: UUID,
    *,
    expires_in_hours: int = 24,
    token_type: str = "access",
) -> str:
    """Create a JWT token that expires in the future.

    Args:
        user_id: User ID to embed in token
        expires_in_hours: Hours until expiration
        token_type: Token type ("access" or "refresh")

    Returns:
        str: Valid JWT token

    Example:
        token = create_future_token(user.id, expires_in_hours=1)
        # Use for testing near-expiration scenarios
    """
    from jose import jwt

    from src.config import settings

    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(hours=expires_in_hours),
        "iat": datetime.utcnow(),
        "type": token_type,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def get_token_expiration(token: str) -> datetime:
    """Extract expiration time from a JWT token.

    Args:
        token: JWT token string

    Returns:
        datetime: Token expiration time

    Example:
        exp = get_token_expiration(access_token)
        assert exp > datetime.utcnow()
    """
    from jose import jwt

    from src.config import settings

    payload = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
        options={"verify_exp": False},  # Don't verify, just extract
    )
    return datetime.fromtimestamp(payload["exp"], tz=timezone.utc)


# =============================================================================
# SM-2 Due Date Helpers
# =============================================================================


def create_due_date(
    days_from_today: int = 0,
) -> date:
    """Create a date for testing card scheduling.

    Args:
        days_from_today: Days relative to today (negative for past)

    Returns:
        date: Calculated date

    Example:
        due_today = create_due_date(0)
        due_tomorrow = create_due_date(1)
        overdue = create_due_date(-3)
    """
    return date.today() + timedelta(days=days_from_today)


def create_overdue_date(days_overdue: int = 1) -> date:
    """Create a date in the past for overdue cards.

    Args:
        days_overdue: How many days overdue

    Returns:
        date: Past date

    Example:
        overdue = create_overdue_date(5)  # 5 days overdue
    """
    return date.today() - timedelta(days=days_overdue)


def create_future_date(days_ahead: int = 1) -> date:
    """Create a date in the future for not-yet-due cards.

    Args:
        days_ahead: How many days until due

    Returns:
        date: Future date

    Example:
        future = create_future_date(7)  # Due in 7 days
    """
    return date.today() + timedelta(days=days_ahead)


def calculate_sm2_interval(
    repetitions: int,
    easiness_factor: float = 2.5,
    previous_interval: int = 0,
) -> int:
    """Calculate expected SM-2 interval.

    Args:
        repetitions: Number of successful repetitions
        easiness_factor: Current EF value
        previous_interval: Previous interval (for rep > 2)

    Returns:
        int: Expected interval in days

    Example:
        # First successful review
        interval = calculate_sm2_interval(1)
        assert interval == 1

        # Second successful review
        interval = calculate_sm2_interval(2)
        assert interval == 6
    """
    if repetitions == 0:
        return 0
    elif repetitions == 1:
        return 1
    elif repetitions == 2:
        return 6
    else:
        return round(previous_interval * easiness_factor)


# =============================================================================
# Time Range Helpers
# =============================================================================


def get_today_range() -> tuple[datetime, datetime]:
    """Get datetime range for today (00:00:00 to 23:59:59).

    Returns:
        tuple: (start_of_day, end_of_day)

    Example:
        start, end = get_today_range()
        # Query reviews from today
    """
    today = date.today()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())
    return start, end


def get_week_range(weeks_ago: int = 0) -> tuple[datetime, datetime]:
    """Get datetime range for a week.

    Args:
        weeks_ago: Number of weeks in the past (0 = current week)

    Returns:
        tuple: (start_of_week, end_of_week)

    Example:
        start, end = get_week_range(1)  # Last week
    """
    today = date.today()
    start_of_current_week = today - timedelta(days=today.weekday())
    target_start = start_of_current_week - timedelta(weeks=weeks_ago)
    target_end = target_start + timedelta(days=6)

    return (
        datetime.combine(target_start, datetime.min.time()),
        datetime.combine(target_end, datetime.max.time()),
    )


def get_month_range(months_ago: int = 0) -> tuple[datetime, datetime]:
    """Get datetime range for a month.

    Args:
        months_ago: Number of months in the past (0 = current month)

    Returns:
        tuple: (start_of_month, end_of_month)
    """
    today = date.today()

    # Calculate target month
    target_year = today.year
    target_month = today.month - months_ago

    while target_month <= 0:
        target_month += 12
        target_year -= 1

    # Start of month
    start = datetime(target_year, target_month, 1)

    # End of month
    if target_month == 12:
        end = datetime(target_year + 1, 1, 1) - timedelta(seconds=1)
    else:
        end = datetime(target_year, target_month + 1, 1) - timedelta(seconds=1)

    return start, end


# =============================================================================
# Module Exports
# =============================================================================

__all__ = [
    # Time Freezing
    "freeze_time",
    "advance_time",
    "past_time",
    "FREEZEGUN_AVAILABLE",
    # Token Expiration Helpers
    "create_expired_token",
    "create_future_token",
    "get_token_expiration",
    # SM-2 Due Date Helpers
    "create_due_date",
    "create_overdue_date",
    "create_future_date",
    "calculate_sm2_interval",
    # Time Range Helpers
    "get_today_range",
    "get_week_range",
    "get_month_range",
]
