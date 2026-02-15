"""User and UserSettings repositories."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import User, UserSettings
from src.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository for User model with authentication queries."""

    def __init__(self, db: AsyncSession):
        super().__init__(User, db)

    async def get_by_email(self, email: str) -> User | None:
        """Get user by email address.

        Args:
            email: User's email address

        Returns:
            User instance or None if not found

        Use Case:
            Login, registration email uniqueness check
        """
        query = select(User).where(User.email == email)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_supabase_id(self, supabase_id: str) -> User | None:
        """Get user by Supabase ID.

        Args:
            supabase_id: Supabase user identifier (sub claim)

        Returns:
            User instance or None if not found

        Use Case:
            Supabase auth login/signup
        """
        query = select(User).where(User.supabase_id == supabase_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_with_settings(self, user_id: UUID) -> User | None:
        """Get user with settings eagerly loaded.

        Args:
            user_id: User's UUID

        Returns:
            User instance with settings relationship loaded

        Use Case:
            User profile endpoint, settings page
        """
        query = select(User).where(User.id == user_id).options(selectinload(User.settings))
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def deactivate(self, user_id: UUID) -> User:
        """Deactivate user account.

        Args:
            user_id: User's UUID

        Returns:
            Updated user (not yet committed)

        Use Case:
            Account deletion (soft delete)
        """
        user = await self.get_or_404(user_id)
        user.is_active = False
        self.db.add(user)
        await self.db.flush()
        return user


class UserSettingsRepository(BaseRepository[UserSettings]):
    """Repository for UserSettings model."""

    def __init__(self, db: AsyncSession):
        super().__init__(UserSettings, db)

    async def get_by_user_id(self, user_id: UUID) -> UserSettings | None:
        """Get settings for a specific user.

        Args:
            user_id: User's UUID

        Returns:
            UserSettings instance or None if not found

        Use Case:
            Settings page, daily goal checks
        """
        query = select(UserSettings).where(UserSettings.user_id == user_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
