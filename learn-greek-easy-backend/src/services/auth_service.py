"""Authentication service for user management.

This service handles all authentication-related business logic including
user registration, login, token management, and password operations.
"""

import logging
from datetime import datetime
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.exceptions import (
    EmailAlreadyExistsException,
    InvalidCredentialsException,
    TokenExpiredException,
    TokenInvalidException,
    UserNotFoundException,
)
from src.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    verify_token,
)
from src.db.models import RefreshToken, User, UserSettings
from src.schemas.user import TokenResponse, UserCreate, UserLogin

logger = logging.getLogger(__name__)


class AuthService:
    """Service for handling authentication operations.

    This service encapsulates all authentication business logic,
    coordinating between the database, security utilities, and
    API responses.
    """

    def __init__(self, db: AsyncSession):
        """Initialize the authentication service.

        Args:
            db: Async database session for persistence operations
        """
        self.db = db

    async def register_user(self, user_data: UserCreate) -> Tuple[User, TokenResponse]:
        """Register a new user account.

        Creates a new user with hashed password, initializes default
        settings, generates JWT tokens, and stores refresh token.

        Args:
            user_data: User registration data (email, password, full_name)

        Returns:
            Tuple of (created User model, TokenResponse with JWT tokens)

        Raises:
            EmailAlreadyExistsException: If email is already registered
            IntegrityError: If database constraints are violated
        """
        # Check if email already exists
        existing_user = await self._get_user_by_email(user_data.email)
        if existing_user:
            raise EmailAlreadyExistsException(email=user_data.email)

        # Hash the password
        password_hash = hash_password(user_data.password)

        # Start transaction for atomicity
        try:
            # Create user
            user = User(
                email=user_data.email,
                password_hash=password_hash,
                full_name=user_data.full_name,
                is_active=True,
                is_superuser=False,
                email_verified_at=None,  # Email verification not yet implemented
            )

            self.db.add(user)
            await self.db.flush()  # Get user.id without committing

            # Create default user settings
            settings = UserSettings(
                user_id=user.id,
                daily_goal=20,  # Default daily goal
                email_notifications=True,  # Default to enabled
            )

            self.db.add(settings)

            # Generate JWT tokens
            access_token, access_expires = create_access_token(user.id)
            refresh_token, refresh_expires = create_refresh_token(user.id)

            # Store refresh token in database for session management
            db_refresh_token = RefreshToken(
                user_id=user.id,
                token=refresh_token,
                expires_at=refresh_expires,
            )

            self.db.add(db_refresh_token)

            # Commit all changes atomically
            await self.db.commit()

            # Refresh user to get all fields including timestamps
            await self.db.refresh(user)

            # Calculate expiry in seconds for response
            expires_in = int((access_expires - datetime.utcnow()).total_seconds())

            # Create token response
            token_response = TokenResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                token_type="bearer",
                expires_in=expires_in,
            )

            return user, token_response

        except IntegrityError as e:
            await self.db.rollback()
            # Handle rare race condition where email was inserted between check and create
            if "unique" in str(e.orig).lower() and "email" in str(e.orig).lower():
                raise EmailAlreadyExistsException(email=user_data.email)
            raise  # Re-raise other integrity errors

    async def _get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email address.

        Args:
            email: Email address to search for

        Returns:
            User model if found, None otherwise
        """
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def login_user(
        self, login_data: UserLogin, client_ip: str | None = None
    ) -> Tuple[User, TokenResponse]:
        """Authenticate user and generate tokens.

        Args:
            login_data: Login credentials (email, password)
            client_ip: Client IP address for tracking (optional)

        Returns:
            Tuple of (authenticated User, TokenResponse with JWT tokens)

        Raises:
            InvalidCredentialsException: If email or password is incorrect
        """
        # Get user by email
        user = await self._get_user_by_email(login_data.email)
        if not user:
            logger.warning(
                "Failed login attempt - user not found",
                extra={"email": login_data.email, "ip": client_ip},
            )
            raise InvalidCredentialsException()

        # Verify password (password_hash is None for OAuth-only users)
        if not user.password_hash or not verify_password(login_data.password, user.password_hash):
            logger.warning(
                "Failed login attempt - invalid password",
                extra={"email": login_data.email, "user_id": str(user.id), "ip": client_ip},
            )
            raise InvalidCredentialsException()

        # Check if user is active
        if not user.is_active:
            logger.warning(
                "Failed login attempt - inactive account",
                extra={"email": login_data.email, "user_id": str(user.id), "ip": client_ip},
            )
            raise InvalidCredentialsException("Account is deactivated")

        # Update last login information
        user.last_login_at = datetime.utcnow()
        if client_ip:
            user.last_login_ip = client_ip

        # Generate JWT tokens
        access_token, access_expires = create_access_token(user.id)
        refresh_token, refresh_expires = create_refresh_token(user.id)

        # Store refresh token
        db_refresh_token = RefreshToken(
            user_id=user.id,
            token=refresh_token,
            expires_at=refresh_expires,
        )

        self.db.add(db_refresh_token)
        await self.db.commit()

        # Calculate expiry in seconds
        expires_in = int((access_expires - datetime.utcnow()).total_seconds())

        # Create token response
        token_response = TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=expires_in,
        )

        # Log successful login
        logger.info(
            "Successful login",
            extra={
                "user_id": str(user.id),
                "email": user.email,
                "ip": client_ip,
            },
        )

        return user, token_response

    async def refresh_access_token(self, refresh_token: str) -> Tuple[str, str, User]:
        """Generate new access and refresh tokens using refresh token.

        Implements token rotation: the old refresh token is deleted and
        a new one is issued. This provides better security as each refresh
        token can only be used once.

        Args:
            refresh_token: Valid refresh token

        Returns:
            Tuple of (new_access_token, new_refresh_token, user)

        Raises:
            TokenExpiredException: If the refresh token JWT has expired
            TokenInvalidException: If refresh token is invalid, revoked, or user is inactive
            UserNotFoundException: If the user associated with the token no longer exists
        """
        # Step 1: Verify JWT signature and extract user_id
        try:
            user_id = verify_token(refresh_token, token_type="refresh")
        except TokenExpiredException:
            # Clean up expired token from database if it exists
            await self._cleanup_token(refresh_token)
            raise TokenExpiredException("Refresh token has expired")
        except TokenInvalidException as e:
            raise TokenInvalidException(f"Invalid refresh token: {e.detail}")
        except Exception as e:
            logger.error(f"Unexpected error verifying refresh token: {e}")
            raise TokenInvalidException("Invalid refresh token")

        # Step 2: Check if refresh token exists in database (not revoked)
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.token == refresh_token,
            )
        )
        db_token = result.scalar_one_or_none()

        if not db_token:
            # Token not in database - it was revoked or never existed
            logger.warning(
                "Refresh token not found in database (possibly revoked)",
                extra={"user_id": str(user_id)},
            )
            raise TokenInvalidException("Refresh token has been revoked")

        # Step 3: Check if token is expired in database
        if db_token.expires_at <= datetime.utcnow():
            # Clean up expired token
            await self.db.delete(db_token)
            await self.db.commit()
            raise TokenExpiredException("Refresh token has expired")

        # Step 4: Load user with settings using selectinload
        user_result = await self.db.execute(
            select(User).options(selectinload(User.settings)).where(User.id == user_id)
        )
        user: Optional[User] = user_result.scalar_one_or_none()

        # Step 5: Validate user exists
        if not user:
            # User was deleted after token was issued - clean up token
            await self.db.delete(db_token)
            await self.db.commit()
            logger.warning("User not found for refresh token", extra={"user_id": str(user_id)})
            raise UserNotFoundException(user_id=str(user_id))

        # Step 6: Validate user is active
        if not user.is_active:
            # User is deactivated - revoke all tokens
            await self.db.delete(db_token)
            await self.db.commit()
            logger.warning(
                "Inactive user attempted to refresh token",
                extra={"user_id": str(user_id), "email": user.email},
            )
            raise TokenInvalidException("User account is deactivated")

        # Step 7: Generate new tokens (token rotation)
        new_access_token, access_expires = create_access_token(user.id)
        new_refresh_token, refresh_expires = create_refresh_token(user.id)

        # Step 8: Delete old refresh token (rotation - invalidate old token)
        await self.db.delete(db_token)

        # Step 9: Insert new refresh token
        new_db_refresh_token = RefreshToken(
            user_id=user.id,
            token=new_refresh_token,
            expires_at=refresh_expires,
        )
        self.db.add(new_db_refresh_token)

        # Step 10: Commit changes atomically
        await self.db.commit()

        logger.info(
            "Token refreshed successfully", extra={"user_id": str(user.id), "email": user.email}
        )

        return new_access_token, new_refresh_token, user

    async def _cleanup_token(self, token: str) -> None:
        """Remove a refresh token from the database if it exists.

        This is a helper method used to clean up expired or invalid tokens
        from the database without raising errors if the token doesn't exist.

        Args:
            token: The refresh token string to remove
        """
        try:
            result = await self.db.execute(select(RefreshToken).where(RefreshToken.token == token))
            db_token = result.scalar_one_or_none()
            if db_token:
                await self.db.delete(db_token)
                await self.db.commit()
        except Exception as e:
            logger.error(f"Error cleaning up token: {e}")
            # Don't raise - this is a cleanup operation

    async def logout_user(self, refresh_token: str) -> None:
        """Logout user by invalidating refresh token.

        Args:
            refresh_token: Refresh token to invalidate (delete it)
        """
        # Delete the refresh token
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.token == refresh_token,
            )
        )
        db_token = result.scalar_one_or_none()

        if db_token:
            await self.db.delete(db_token)
            await self.db.commit()

    # ========================================================================
    # Session Management Methods
    # ========================================================================

    async def revoke_refresh_token(self, refresh_token_str: str) -> bool:
        """Revoke a single refresh token.

        Args:
            refresh_token_str: The refresh token string to revoke

        Returns:
            True if the token was found and revoked, False if not found
        """
        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.token == refresh_token_str)
        )
        db_token = result.scalar_one_or_none()

        if db_token:
            await self.db.delete(db_token)
            await self.db.commit()
            logger.info(
                "Refresh token revoked",
                extra={"token_id": str(db_token.id), "user_id": str(db_token.user_id)},
            )
            return True

        logger.warning(
            "Attempted to revoke non-existent token",
            extra={
                "token_prefix": (
                    refresh_token_str[:20] + "..."
                    if len(refresh_token_str) > 20
                    else refresh_token_str
                )
            },
        )
        return False

    async def revoke_all_user_tokens(self, user_id: UUID) -> int:
        """Revoke all refresh tokens for a user.

        This effectively logs out the user from all sessions/devices.

        Args:
            user_id: The user's UUID

        Returns:
            Number of tokens revoked
        """
        result = await self.db.execute(select(RefreshToken).where(RefreshToken.user_id == user_id))
        tokens = result.scalars().all()

        count = len(tokens)
        for token in tokens:
            await self.db.delete(token)

        if count > 0:
            await self.db.commit()
            logger.info(
                "All user tokens revoked", extra={"user_id": str(user_id), "tokens_revoked": count}
            )

        return count

    async def cleanup_expired_tokens(self) -> int:
        """Remove all expired refresh tokens from the database.

        This is a maintenance method that should be called periodically
        to clean up expired tokens and keep the database tidy.

        Returns:
            Number of expired tokens removed
        """
        now = datetime.utcnow()
        result = await self.db.execute(select(RefreshToken).where(RefreshToken.expires_at <= now))
        expired_tokens = result.scalars().all()

        count = len(expired_tokens)
        for token in expired_tokens:
            await self.db.delete(token)

        if count > 0:
            await self.db.commit()
            logger.info("Expired tokens cleaned up", extra={"tokens_removed": count})

        return count

    async def get_user_sessions(self, user_id: UUID) -> List[dict]:
        """Get all active sessions for a user.

        Returns session information without exposing the actual token values
        for security reasons.

        Args:
            user_id: The user's UUID

        Returns:
            List of session dictionaries with id, created_at, and expires_at
        """
        now = datetime.utcnow()
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.expires_at > now,  # Only active (non-expired) sessions
            )
        )
        tokens = result.scalars().all()

        # Return session info without exposing the actual token
        sessions = [
            {
                "id": token.id,
                "created_at": token.created_at,
                "expires_at": token.expires_at,
            }
            for token in tokens
        ]

        logger.debug(
            "User sessions retrieved",
            extra={"user_id": str(user_id), "session_count": len(sessions)},
        )

        return sessions

    async def revoke_session_by_id(self, user_id: UUID, session_id: UUID) -> bool:
        """Revoke a specific session by its ID.

        Users can only revoke their own sessions. This method ensures
        that a user cannot revoke another user's session.

        Args:
            user_id: The user's UUID (for authorization check)
            session_id: The session (refresh token) ID to revoke

        Returns:
            True if the session was found and revoked, False if not found
            or belongs to another user
        """
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.id == session_id,
                RefreshToken.user_id == user_id,  # Authorization check
            )
        )
        db_token = result.scalar_one_or_none()

        if db_token:
            await self.db.delete(db_token)
            await self.db.commit()
            logger.info(
                "Session revoked by ID",
                extra={"session_id": str(session_id), "user_id": str(user_id)},
            )
            return True

        logger.warning(
            "Attempted to revoke non-existent or unauthorized session",
            extra={"session_id": str(session_id), "user_id": str(user_id)},
        )
        return False
