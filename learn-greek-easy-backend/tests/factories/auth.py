"""Authentication model factories.

This module provides factories for authentication-related models:
- UserFactory: User accounts with various traits
- UserSettingsFactory: User preferences
- RefreshTokenFactory: JWT refresh tokens

All users are now created as Auth0-style users (no password hash)
since password-based authentication has been removed.

Usage:
    # Create a regular user
    user = await UserFactory.create()

    # Create an admin user
    admin = await UserFactory.create(admin=True)

    # Create an inactive user
    inactive = await UserFactory.create(inactive=True)

    # Create user with custom settings
    user = await UserFactory.create()
    settings = await UserSettingsFactory.create(user_id=user.id, daily_goal=50)
"""

from datetime import timedelta
from uuid import uuid4

import factory
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.security import create_refresh_token
from src.db.models import RefreshToken, User, UserSettings
from tests.factories.base import BaseFactory, unique_email, unique_token, utc_now


class UserFactory(BaseFactory):
    """Factory for User model.

    Creates test users with configurable attributes.
    All users are created as Auth0-style users (no password hash).

    Traits:
        admin: Superuser with verified email
        inactive: Deactivated account
        verified: Email verified

    Example:
        user = await UserFactory.create()
        admin = await UserFactory.create(admin=True)
        inactive_admin = await UserFactory.create(admin=True, inactive=True)
    """

    class Meta:
        model = User

    # Default values - all users are Auth0-style (no password)
    email = factory.LazyFunction(unique_email)
    password_hash = None  # Auth0 users don't have password
    full_name = factory.Faker("name")
    is_active = True
    is_superuser = False
    email_verified_at = None
    google_id = None
    auth0_id = factory.LazyFunction(lambda: f"auth0|test_{uuid4().hex[:16]}")
    last_login_at = None
    last_login_ip = None

    class Params:
        """Factory traits for common variations."""

        # Admin/superuser trait
        admin = factory.Trait(
            is_superuser=True,
            email_verified_at=factory.LazyFunction(utc_now),
            full_name="Admin User",
        )

        # Inactive user trait
        inactive = factory.Trait(
            is_active=False,
        )

        # Verified email trait
        verified = factory.Trait(
            email_verified_at=factory.LazyFunction(utc_now),
        )

        # Recently logged in
        logged_in = factory.Trait(
            last_login_at=factory.LazyFunction(utc_now),
            last_login_ip="127.0.0.1",
        )

    @classmethod
    async def create_with_settings(
        cls,
        session: AsyncSession | None = None,
        daily_goal: int = 20,
        email_notifications: bool = True,
        **kwargs,
    ) -> User:
        """Create a user with associated settings.

        This is a convenience method that creates both User and UserSettings.

        Args:
            session: Database session
            daily_goal: User's daily goal
            email_notifications: Email notification preference
            **kwargs: User field overrides

        Returns:
            User with settings relationship populated
        """
        user = await cls.create(session=session, **kwargs)

        db_session = session or cls._session
        settings = UserSettings(
            user_id=user.id,
            daily_goal=daily_goal,
            email_notifications=email_notifications,
        )
        db_session.add(settings)
        await db_session.flush()

        # Reload user with settings using selectinload (required for lazy="raise")
        stmt = select(User).options(selectinload(User.settings)).where(User.id == user.id)
        result = await db_session.execute(stmt)
        user = result.scalar_one()

        return user


class UserSettingsFactory(BaseFactory):
    """Factory for UserSettings model.

    Creates user preference records.

    Note: Usually created via UserFactory.create_with_settings()
          for proper User-Settings relationship.

    Example:
        settings = await UserSettingsFactory.create(user_id=user.id)
    """

    class Meta:
        model = UserSettings

    # Required: Must be provided or use SubFactory
    user_id = None  # Must be set explicitly

    # Default settings
    daily_goal = 20
    email_notifications = True

    class Params:
        """Factory traits for common variations."""

        # High achiever - increased daily goal
        high_achiever = factory.Trait(
            daily_goal=50,
        )

        # No notifications
        quiet = factory.Trait(
            email_notifications=False,
        )


class RefreshTokenFactory(BaseFactory):
    """Factory for RefreshToken model.

    Creates JWT refresh tokens for session management testing.

    Traits:
        expired: Token with past expiration

    Example:
        token = await RefreshTokenFactory.create(user_id=user.id)
        expired_token = await RefreshTokenFactory.create(user_id=user.id, expired=True)
    """

    class Meta:
        model = RefreshToken

    # Required: Must be provided
    user_id = None  # Must be set explicitly

    # Token data
    token = factory.LazyFunction(unique_token)
    expires_at = factory.LazyFunction(lambda: utc_now() + timedelta(days=7))

    class Params:
        """Factory traits for common variations."""

        # Expired token
        expired = factory.Trait(
            expires_at=factory.LazyFunction(lambda: utc_now() - timedelta(hours=1)),
        )

        # Soon to expire (within 1 hour)
        expiring_soon = factory.Trait(
            expires_at=factory.LazyFunction(lambda: utc_now() + timedelta(minutes=30)),
        )

    @classmethod
    async def create_for_user(
        cls,
        user: User,
        session: AsyncSession | None = None,
        **kwargs,
    ) -> tuple[RefreshToken, str]:
        """Create a refresh token for a user with the actual JWT.

        Uses the application's create_refresh_token function.

        Args:
            user: User to create token for
            session: Database session
            **kwargs: Field overrides

        Returns:
            Tuple of (RefreshToken model, JWT string)
        """
        jwt_token, expires_at = create_refresh_token(user.id)

        db_token = await cls.create(
            session=session,
            user_id=user.id,
            token=jwt_token,
            expires_at=expires_at,
            **kwargs,
        )

        return db_token, jwt_token
