"""User, UserSettings, and RefreshToken repositories."""

from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import RefreshToken, User, UserSettings
from src.repositories.base import BaseRepository
from src.schemas.user import UserCreate


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

    async def get_by_google_id(self, google_id: str) -> User | None:
        """Get user by Google OAuth ID.

        Args:
            google_id: Google OAuth user ID

        Returns:
            User instance or None if not found

        Use Case:
            Google OAuth login/signup
        """
        query = select(User).where(User.google_id == google_id)
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
        query = (
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.settings))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_with_settings(
        self,
        user_in: UserCreate,
        password_hash: str,
    ) -> User:
        """Create user with default settings in one transaction.

        Args:
            user_in: User creation schema
            password_hash: Hashed password from security module

        Returns:
            Created user with settings (not yet committed)

        Use Case:
            User registration
        """
        # Create user
        db_user = User(
            email=user_in.email,
            password_hash=password_hash,
            full_name=user_in.full_name,
        )
        self.db.add(db_user)
        await self.db.flush()

        # Create default settings
        db_settings = UserSettings(
            user_id=db_user.id,
            daily_goal=20,
            email_notifications=True,
        )
        self.db.add(db_settings)
        await self.db.flush()

        return db_user

    async def verify_email(self, user_id: UUID) -> User:
        """Mark user's email as verified.

        Args:
            user_id: User's UUID

        Returns:
            Updated user (not yet committed)

        Use Case:
            Email verification flow
        """
        user = await self.get_or_404(user_id)
        user.email_verified_at = datetime.utcnow()
        self.db.add(user)
        await self.db.flush()
        return user

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


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    """Repository for RefreshToken model with cleanup operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(RefreshToken, db)

    async def get_by_token(self, token: str) -> RefreshToken | None:
        """Get refresh token by token string.

        Args:
            token: JWT refresh token string

        Returns:
            RefreshToken instance or None if not found

        Use Case:
            Token refresh endpoint
        """
        query = (
            select(RefreshToken)
            .where(RefreshToken.token == token)
            .options(selectinload(RefreshToken.user))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def delete_expired(self) -> int:
        """Delete all expired refresh tokens.

        Returns:
            Number of deleted tokens

        Use Case:
            Scheduled cleanup job
        """
        query = delete(RefreshToken).where(
            RefreshToken.expires_at < datetime.utcnow()
        )
        result = await self.db.execute(query)
        await self.db.flush()
        return result.rowcount

    async def delete_user_tokens(self, user_id: UUID) -> int:
        """Delete all refresh tokens for a specific user.

        Args:
            user_id: User's UUID

        Returns:
            Number of deleted tokens

        Use Case:
            Logout all devices, password change
        """
        query = delete(RefreshToken).where(RefreshToken.user_id == user_id)
        result = await self.db.execute(query)
        await self.db.flush()
        return result.rowcount

    async def cleanup(self, days_old: int = 30) -> int:
        """Delete old expired tokens (expired > N days ago).

        Args:
            days_old: Only delete tokens expired this many days ago

        Returns:
            Number of deleted tokens

        Use Case:
            Database maintenance
        """
        cutoff = datetime.utcnow() - timedelta(days=days_old)
        query = delete(RefreshToken).where(RefreshToken.expires_at < cutoff)
        result = await self.db.execute(query)
        await self.db.flush()
        return result.rowcount


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
