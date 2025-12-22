"""Authentication service for user management.

This service handles all authentication-related business logic including
user registration, login, token management, and password operations.

Session Storage Strategy:
    - Redis is the ONLY storage for refresh token sessions
    - If Redis is unavailable, operations fail (no PostgreSQL fallback)
    - Legacy tokens (without jti claim) are rejected - users must re-login
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
    AccountLinkingConflictException,
    EmailAlreadyExistsException,
    GoogleOAuthDisabledException,
    InvalidCredentialsException,
    TokenExpiredException,
    TokenInvalidException,
    UserNotFoundException,
)
from src.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_google_id_token,
    verify_password,
    verify_refresh_token_with_jti,
)
from src.db.models import User, UserSettings
from src.repositories.session import SessionRepository
from src.schemas.user import GoogleUserInfo, TokenResponse, UserCreate, UserLogin

logger = logging.getLogger(__name__)


class AuthService:
    """Service for handling authentication operations.

    This service encapsulates all authentication business logic,
    coordinating between the database, security utilities, and
    API responses.

    Session Storage:
        Uses Redis exclusively for refresh token sessions. The session_repo
        handles all Redis operations. PostgreSQL is used only for user data,
        not for session storage.
    """

    def __init__(
        self,
        db: AsyncSession,
        session_repo: Optional[SessionRepository] = None,
    ):
        """Initialize the authentication service.

        Args:
            db: Async database session for persistence operations
            session_repo: Optional SessionRepository for Redis sessions.
                If not provided, a default instance will be created.
        """
        self.db = db
        self.session_repo = session_repo or SessionRepository()

    async def register_user(
        self,
        user_data: UserCreate,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[User, TokenResponse]:
        """Register a new user account.

        Creates a new user with hashed password, initializes default
        settings, generates JWT tokens, and stores refresh token in Redis.

        Session Storage:
            Redis only - if Redis is unavailable, registration will still
            succeed but the session will not be stored (user may need to
            login again once Redis is available).

        Args:
            user_data: User registration data (email, password, full_name)
            client_ip: Optional client IP address for session tracking
            user_agent: Optional user agent for session tracking

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
            user_settings = UserSettings(
                user_id=user.id,
                daily_goal=20,  # Default daily goal
                email_notifications=True,  # Default to enabled
            )

            self.db.add(user_settings)

            # Generate JWT tokens (now returns 3-tuple with token_id)
            access_token, access_expires = create_access_token(user.id)
            refresh_token, refresh_expires, token_id = create_refresh_token(user.id)

            # Store session in Redis
            redis_stored = await self.session_repo.create_session(
                user_id=user.id,
                token_id=token_id,
                token=refresh_token,
                expires_at=refresh_expires,
                ip_address=client_ip,
                user_agent=user_agent,
            )

            if not redis_stored:
                logger.warning(
                    "Redis unavailable, session not stored. User may need to re-login.",
                    extra={"user_id": str(user.id)},
                )

            # Commit all changes atomically
            await self.db.commit()

            # Create welcome notification for new user
            await self._create_welcome_notification(user.id)

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
        self,
        login_data: UserLogin,
        client_ip: str | None = None,
        user_agent: str | None = None,
    ) -> Tuple[User, TokenResponse]:
        """Authenticate user and generate tokens.

        Session Storage:
            Redis only - sessions are stored exclusively in Redis.

        Args:
            login_data: Login credentials (email, password)
            client_ip: Client IP address for tracking (optional)
            user_agent: User agent string for session tracking (optional)

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

        # Generate JWT tokens (now returns 3-tuple with token_id)
        access_token, access_expires = create_access_token(user.id)
        refresh_token, refresh_expires, token_id = create_refresh_token(user.id)

        # Store session in Redis
        redis_stored = await self.session_repo.create_session(
            user_id=user.id,
            token_id=token_id,
            token=refresh_token,
            expires_at=refresh_expires,
            ip_address=client_ip,
            user_agent=user_agent,
        )

        if not redis_stored:
            logger.warning(
                "Redis unavailable, session not stored. User may need to re-login.",
                extra={"user_id": str(user.id)},
            )

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

    async def authenticate_google(
        self,
        id_token: str,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[User, TokenResponse]:
        """Authenticate user with Google OAuth ID token.

        This method handles the complete Google OAuth flow:
        1. Verify Google ID token
        2. Find existing user by google_id or email
        3. Create new user or link Google account
        4. Generate JWT tokens
        5. Store session in Redis

        Account Linking Logic:
        - If user exists with this google_id -> login that user
        - If user exists with this email but no google_id -> link Google account
        - If user exists with this email AND different google_id -> error (conflict)
        - If no user exists -> create new user

        Args:
            id_token: Google ID token from frontend
            client_ip: Optional client IP for session tracking
            user_agent: Optional user agent for session tracking

        Returns:
            Tuple of (User, TokenResponse)

        Raises:
            GoogleOAuthDisabledException: Google OAuth not configured
            GoogleTokenInvalidException: Invalid or expired Google token
            AccountLinkingConflictException: Email exists with different Google account
            InvalidCredentialsException: User account is deactivated
        """
        from src.config import settings

        # Check if Google OAuth is enabled and configured
        if not settings.google_oauth_configured:
            raise GoogleOAuthDisabledException()

        # google_oauth_configured ensures google_client_id is set
        assert settings.google_client_id is not None

        # Step 1: Verify Google ID token
        google_user = verify_google_id_token(
            token=id_token,
            client_id=settings.google_client_id,
        )

        # Step 2: Find or create user, returns (user, is_new_user)
        user, is_new_user = await self._find_or_create_google_user(google_user)

        # Step 3: Validate user is active
        if not user.is_active:
            logger.warning(
                "Google OAuth attempt by inactive user",
                extra={"user_id": str(user.id), "email": user.email},
            )
            raise InvalidCredentialsException("Account is deactivated")

        # Step 4: Update last login
        user.last_login_at = datetime.utcnow()
        if client_ip:
            user.last_login_ip = client_ip

        # Step 5: Generate JWT tokens (reuse existing functions)
        access_token, access_expires = create_access_token(user.id)
        refresh_token, refresh_expires, token_id = create_refresh_token(user.id)

        # Step 6: Store session in Redis (reuse existing SessionRepository)
        redis_stored = await self.session_repo.create_session(
            user_id=user.id,
            token_id=token_id,
            token=refresh_token,
            expires_at=refresh_expires,
            ip_address=client_ip,
            user_agent=user_agent,
        )

        if not redis_stored:
            logger.warning(
                "Redis unavailable for Google OAuth session",
                extra={"user_id": str(user.id)},
            )

        # Commit all changes
        await self.db.commit()

        # Create welcome notification for new Google OAuth users
        if is_new_user:
            await self._create_welcome_notification(user.id)

        # Calculate expiry in seconds
        expires_in = int((access_expires - datetime.utcnow()).total_seconds())

        # Create token response (reuse existing schema)
        token_response = TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=expires_in,
        )

        return user, token_response

    async def _get_user_by_google_id(self, google_id: str) -> Optional[User]:
        """Get user by Google ID.

        Args:
            google_id: Google's unique user identifier (sub claim)

        Returns:
            User model if found, None otherwise
        """
        result = await self.db.execute(
            select(User).where(User.google_id == google_id).options(selectinload(User.settings))
        )
        return result.scalar_one_or_none()

    async def _create_google_user(self, google_user: GoogleUserInfo) -> User:
        """Create a new user from Google OAuth data.

        Args:
            google_user: Verified Google user information

        Returns:
            Created User model with settings
        """
        # Create user without password (OAuth-only user)
        user = User(
            email=google_user.email,
            password_hash=None,  # No password for OAuth users
            full_name=google_user.full_name,
            google_id=google_user.google_id,
            is_active=True,
            is_superuser=False,
            # Auto-verify email if Google says it's verified
            email_verified_at=datetime.utcnow() if google_user.email_verified else None,
        )

        self.db.add(user)
        await self.db.flush()  # Get user.id

        # Create default user settings (same as email registration)
        user_settings = UserSettings(
            user_id=user.id,
            daily_goal=20,
            email_notifications=True,
        )

        self.db.add(user_settings)

        return user

    async def _find_or_create_google_user(self, google_user: GoogleUserInfo) -> Tuple[User, bool]:
        """Find existing user or create new one for Google OAuth.

        Handles the user lookup/creation logic for Google OAuth authentication.
        Extracted to reduce complexity of authenticate_google.

        Args:
            google_user: Verified Google user information

        Returns:
            Tuple of (User, is_new_user) where is_new_user indicates if this
            is a newly created user (for welcome notification).

        Raises:
            AccountLinkingConflictException: If email exists with different Google account
        """
        # Check by google_id first
        user = await self._get_user_by_google_id(google_user.google_id)

        if user:
            # User found by google_id - this is a returning Google user
            logger.info(
                "Google OAuth login - existing user",
                extra={"user_id": str(user.id), "email": user.email},
            )
            return user, False

        # No user with this google_id, check by email
        user = await self._get_user_by_email(google_user.email)

        if user:
            # User exists with this email - attempt to link Google account
            if user.google_id is not None and user.google_id != google_user.google_id:
                # Email linked to a DIFFERENT Google account - conflict
                logger.warning(
                    "Google OAuth conflict - email linked to different Google account",
                    extra={
                        "email": google_user.email,
                        "existing_google_id": user.google_id[:10] + "...",
                        "new_google_id": google_user.google_id[:10] + "...",
                    },
                )
                raise AccountLinkingConflictException()

            # Link Google account to existing user
            user.google_id = google_user.google_id

            # Auto-verify email if Google says it's verified
            if google_user.email_verified and user.email_verified_at is None:
                user.email_verified_at = datetime.utcnow()

            # Update name if not set
            if user.full_name is None and google_user.full_name:
                user.full_name = google_user.full_name

            logger.info(
                "Google OAuth - linked to existing email account",
                extra={"user_id": str(user.id), "email": user.email},
            )
            return user, False

        # No user exists - create new user
        user = await self._create_google_user(google_user)
        logger.info(
            "Google OAuth - new user created",
            extra={"user_id": str(user.id), "email": user.email},
        )
        return user, True

    async def _create_welcome_notification(self, user_id: UUID) -> None:
        """Create welcome notification for a new user.

        This is a helper method to keep the main authentication methods simpler.
        Failures are logged but don't affect the parent operation.

        Args:
            user_id: The new user's UUID
        """
        try:
            from src.services.notification_service import NotificationService

            notification_service = NotificationService(self.db)
            await notification_service.notify_welcome(user_id=user_id)
            await self.db.commit()
        except Exception as e:
            logger.warning(
                "Failed to create welcome notification",
                extra={"user_id": str(user_id), "error": str(e)},
            )
            # Don't fail if notification fails

    async def refresh_access_token(
        self,
        refresh_token: str,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[str, str, User]:
        """Generate new access and refresh tokens using refresh token.

        Implements token rotation: the old refresh token is deleted and
        a new one is issued. This provides better security as each refresh
        token can only be used once.

        Session Verification:
            Redis only - tokens must have jti claim and exist in Redis.
            Legacy tokens (without jti) are rejected - users must re-login.

        Args:
            refresh_token: Valid refresh token
            client_ip: Optional client IP for new session
            user_agent: Optional user agent for new session

        Returns:
            Tuple of (new_access_token, new_refresh_token, user)

        Raises:
            TokenExpiredException: If the refresh token JWT has expired
            TokenInvalidException: If refresh token is invalid, revoked, or user is inactive
            UserNotFoundException: If the user associated with the token no longer exists
        """
        # Step 1: Verify JWT signature and extract user_id + jti (token_id)
        try:
            user_id, token_id = verify_refresh_token_with_jti(refresh_token)
        except TokenExpiredException:
            raise TokenExpiredException("Refresh token has expired")
        except TokenInvalidException as e:
            raise TokenInvalidException(f"Invalid refresh token: {e.detail}")
        except Exception as e:
            logger.error(f"Unexpected error verifying refresh token: {e}")
            raise TokenInvalidException("Invalid refresh token")

        # Step 2: Reject legacy tokens without jti
        if not token_id:
            logger.warning(
                "Legacy token detected (no jti), rejecting - user must re-login",
                extra={"user_id": str(user_id)},
            )
            raise TokenInvalidException(
                "Token format is outdated. Please login again to get a new token."
            )

        # Step 3: Validate session exists in Redis
        session_valid = await self.session_repo.validate_session(
            user_id=user_id,
            token_id=token_id,
            token=refresh_token,
        )

        if not session_valid:
            logger.warning(
                "Refresh token not found in Redis (revoked or expired)",
                extra={"user_id": str(user_id), "token_id": token_id},
            )
            raise TokenInvalidException("Refresh token has been revoked")

        # Step 4: Load user with settings
        user_result = await self.db.execute(
            select(User).options(selectinload(User.settings)).where(User.id == user_id)
        )
        user: Optional[User] = user_result.scalar_one_or_none()

        # Step 5: Validate user exists
        if not user:
            # User was deleted - clean up session from Redis
            await self.session_repo.delete_session(user_id, token_id)
            logger.warning("User not found for refresh token", extra={"user_id": str(user_id)})
            raise UserNotFoundException(user_id=str(user_id))

        # Step 6: Validate user is active
        if not user.is_active:
            # User is deactivated - clean up session from Redis
            await self.session_repo.delete_session(user_id, token_id)
            logger.warning(
                "Inactive user attempted to refresh token",
                extra={"user_id": str(user_id), "email": user.email},
            )
            raise TokenInvalidException("User account is deactivated")

        # Step 7: Generate new tokens (token rotation)
        new_access_token, _ = create_access_token(user.id)
        new_refresh_token, new_refresh_expires, new_token_id = create_refresh_token(user.id)

        # Step 8: Rotate session in Redis (atomic delete old + create new)
        rotation_success = await self.session_repo.rotate_session(
            user_id=user.id,
            old_token_id=token_id,
            new_token_id=new_token_id,
            new_token=new_refresh_token,
            new_expires_at=new_refresh_expires,
            ip_address=client_ip,
            user_agent=user_agent,
        )

        if not rotation_success:
            logger.warning(
                "Redis rotation failed. Token refresh may have issues.",
                extra={"user_id": str(user.id)},
            )
            # Still return new tokens - the old token validation already passed
            # The new session might not be stored, but at least the user gets tokens

        logger.info(
            "Token refreshed successfully",
            extra={"user_id": str(user.id), "email": user.email},
        )

        return new_access_token, new_refresh_token, user

    async def logout_user(self, refresh_token: str) -> None:
        """Logout user by invalidating refresh token.

        Deletes the session from Redis. If the token is invalid or expired,
        logout still succeeds (no error is raised).

        Args:
            refresh_token: Refresh token to invalidate (delete from Redis)
        """
        # Try to extract user_id and token_id from the token
        try:
            user_id, token_id = verify_refresh_token_with_jti(refresh_token)

            # Delete from Redis if token has jti
            if token_id:
                await self.session_repo.delete_session(user_id, token_id)

        except (TokenExpiredException, TokenInvalidException):
            # Token is invalid/expired - logout still succeeds
            pass
        except Exception as e:
            logger.debug(f"Could not extract jti from token for logout: {e}")

    # ========================================================================
    # Session Management Methods
    # ========================================================================

    async def revoke_refresh_token(self, refresh_token_str: str) -> bool:
        """Revoke a single refresh token from Redis.

        Args:
            refresh_token_str: The refresh token string to revoke

        Returns:
            True if the token was found and revoked, False if not found or invalid
        """
        try:
            user_id, token_id = verify_refresh_token_with_jti(refresh_token_str)

            if not token_id:
                logger.warning("Cannot revoke legacy token without jti")
                return False

            deleted = await self.session_repo.delete_session(user_id, token_id)
            if deleted:
                logger.info(
                    "Refresh token revoked",
                    extra={"token_id": token_id, "user_id": str(user_id)},
                )
                return True

            logger.warning(
                "Attempted to revoke non-existent token",
                extra={"token_id": token_id, "user_id": str(user_id)},
            )
            return False

        except (TokenExpiredException, TokenInvalidException) as e:
            logger.warning(f"Cannot revoke invalid/expired token: {e}")
            return False
        except Exception as e:
            logger.error(f"Error revoking token: {e}")
            return False

    async def revoke_all_user_tokens(self, user_id: UUID) -> int:
        """Revoke all refresh tokens for a user.

        This effectively logs out the user from all sessions/devices.
        All sessions are stored in Redis.

        Args:
            user_id: The user's UUID

        Returns:
            Number of tokens revoked from Redis
        """
        count = await self.session_repo.revoke_all_user_sessions(user_id)

        if count > 0:
            logger.info(
                "All user tokens revoked",
                extra={
                    "user_id": str(user_id),
                    "sessions_revoked": count,
                },
            )

        return count

    async def cleanup_expired_tokens(self) -> int:
        """Cleanup expired tokens.

        NOTE: This method is no longer needed as Redis handles token expiry
        automatically via TTL. Kept for backwards compatibility.

        Returns:
            Always returns 0 as Redis handles expiry automatically
        """
        # Redis automatically expires sessions via TTL
        # No manual cleanup needed
        logger.debug("cleanup_expired_tokens called - Redis handles expiry automatically via TTL")
        return 0

    async def get_user_sessions(self, user_id: UUID) -> List[dict]:
        """Get all active sessions for a user.

        Returns session information from Redis,
        without exposing the actual token values for security reasons.

        Args:
            user_id: The user's UUID

        Returns:
            List of session dictionaries with session info
        """
        redis_sessions = await self.session_repo.get_user_sessions(user_id)

        sessions: List[dict] = []
        for session in redis_sessions:
            sessions.append(
                {
                    "id": session.get("token_id"),  # Use token_id as session identifier
                    "created_at": session.get("created_at"),
                    "expires_at": session.get("expires_at"),
                    "ip_address": session.get("ip_address"),
                    "user_agent": session.get("user_agent"),
                }
            )

        logger.debug(
            "User sessions retrieved",
            extra={
                "user_id": str(user_id),
                "session_count": len(sessions),
            },
        )

        return sessions

    async def revoke_session_by_id(self, user_id: UUID, session_id: str) -> bool:
        """Revoke a specific session by its token ID.

        Users can only revoke their own sessions. The session_id is the
        token_id (jti) from the JWT, not a database UUID.

        Args:
            user_id: The user's UUID (for authorization check)
            session_id: The session token ID (jti) to revoke

        Returns:
            True if the session was found and revoked, False if not found
        """
        deleted = await self.session_repo.delete_session(user_id, session_id)

        if deleted:
            logger.info(
                "Session revoked by ID",
                extra={"session_id": session_id, "user_id": str(user_id)},
            )
            return True

        logger.warning(
            "Attempted to revoke non-existent session",
            extra={"session_id": session_id, "user_id": str(user_id)},
        )
        return False
