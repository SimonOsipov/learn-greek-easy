"""Authentication API endpoints.

This module provides HTTP endpoints for user authentication including
Auth0 login, token refresh, logout, and session management.

Legacy email/password and Google OAuth endpoints have been removed.
All authentication now flows through Auth0.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.dependencies import get_current_user
from src.core.exceptions import (
    AccountLinkingConflictException,
    Auth0DisabledException,
    Auth0TokenExpiredException,
    Auth0TokenInvalidException,
    InvalidCredentialsException,
    TokenExpiredException,
    TokenInvalidException,
    UserNotFoundException,
)
from src.core.logging import get_logger
from src.db.dependencies import get_db
from src.db.models import User
from src.repositories.user import UserSettingsRepository
from src.schemas.user import (
    Auth0AuthRequest,
    Auth0LoginResponse,
    LogoutAllResponse,
    LogoutResponse,
    SessionInfo,
    SessionListResponse,
    TokenRefresh,
    TokenResponse,
    UserProfileResponse,
    UserWithSettingsUpdate,
)
from src.services.auth_service import AuthService

logger = get_logger(__name__)

router = APIRouter(
    # Note: prefix is set by parent router in v1/router.py
    # This router is mounted at /auth under the /api/v1 prefix
    tags=["Authentication"],
    responses={
        401: {"description": "Authentication failed"},
        422: {"description": "Validation error"},
    },
)


@router.post(
    "/auth0",
    response_model=Auth0LoginResponse,
    summary="Login with Auth0",
    description="Authenticate using Auth0 access token",
    responses={
        200: {
            "description": "Successfully authenticated with Auth0",
            "content": {
                "application/json": {
                    "example": {
                        "access_token": "eyJhbGciOiJIUzI1NiIs...",
                        "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
                        "token_type": "bearer",
                        "expires_in": 1800,
                        "user": {
                            "id": "550e8400-e29b-41d4-a716-446655440000",
                            "email": "user@example.com",
                            "full_name": "John Doe",
                            "is_active": True,
                            "is_superuser": False,
                            "email_verified_at": "2024-11-25T10:30:00Z",
                            "created_at": "2024-11-25T10:30:00Z",
                            "updated_at": "2024-11-25T10:30:00Z",
                            "settings": {
                                "id": "660e8400-e29b-41d4-a716-446655440001",
                                "user_id": "550e8400-e29b-41d4-a716-446655440000",
                                "daily_goal": 20,
                                "email_notifications": True,
                                "preferred_language": None,
                                "created_at": "2024-11-25T10:30:00Z",
                                "updated_at": "2024-11-25T10:30:00Z",
                            },
                        },
                    }
                }
            },
        },
        401: {
            "description": "Invalid Auth0 token",
            "content": {
                "application/json": {
                    "examples": {
                        "invalid": {
                            "summary": "Invalid token",
                            "value": {"detail": "Invalid Auth0 token"},
                        },
                        "expired": {
                            "summary": "Token expired",
                            "value": {"detail": "Auth0 token has expired"},
                        },
                    }
                }
            },
        },
        409: {
            "description": "Account linking conflict",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "This email is already registered with a different Auth0 account."
                    }
                }
            },
        },
        503: {
            "description": "Auth0 not enabled",
            "content": {
                "application/json": {"example": {"detail": "Auth0 authentication is not enabled"}}
            },
        },
    },
)
async def auth0_login(
    auth_data: Auth0AuthRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Auth0LoginResponse:
    """Authenticate with Auth0.

    This endpoint accepts an Auth0 access token obtained from the Auth0 SDK
    or Universal Login on the frontend. The token is verified against Auth0's
    JWKS, and if valid, the user is authenticated.

    **New Users**: A new account is created automatically with the email
    and name from Auth0 (if available). The email is auto-verified if Auth0
    indicates it is verified.

    **Existing Users (by email)**: If an account exists with the same email
    but no Auth0 account linked, the Auth0 account is automatically linked.

    **Existing Auth0 Users**: If the user has previously logged in with Auth0,
    they are authenticated to their existing account.

    Args:
        auth_data: Auth0 access token from frontend
        request: FastAPI request object for client IP
        db: Database session (injected)

    Returns:
        Auth0LoginResponse containing access/refresh tokens and user profile

    Raises:
        HTTPException(401): If Auth0 token is invalid or expired
        HTTPException(409): If email is registered with a different Auth0 account
        HTTPException(503): If Auth0 is not enabled
    """
    service = AuthService(db)

    # Extract client info for session tracking
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        user, token_response = await service.authenticate_auth0(
            access_token=auth_data.access_token,
            client_ip=client_ip,
            user_agent=user_agent,
        )
        return Auth0LoginResponse(
            access_token=token_response.access_token,
            refresh_token=token_response.refresh_token,
            token_type=token_response.token_type,
            expires_in=token_response.expires_in,
            user=UserProfileResponse.model_validate(user),
        )

    except Auth0DisabledException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=e.detail,
        )

    except Auth0TokenExpiredException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.detail,
        )

    except Auth0TokenInvalidException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.detail,
        )

    except AccountLinkingConflictException as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.detail,
        )

    except InvalidCredentialsException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.detail,
        )

    except Exception as e:
        # Catch-all for debugging unexpected errors
        logger.error(
            "Unexpected error in Auth0 login endpoint",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
            },
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Auth0 login error: {type(e).__name__}: {str(e)}",
        )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    responses={
        200: {
            "description": "New access and refresh tokens generated",
            "content": {
                "application/json": {
                    "example": {
                        "access_token": "eyJhbGciOiJIUzI1NiIs...",
                        "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
                        "token_type": "bearer",
                        "expires_in": 1800,
                    }
                }
            },
        },
        401: {
            "description": "Invalid or expired refresh token",
            "content": {
                "application/json": {
                    "examples": {
                        "expired": {
                            "summary": "Token expired",
                            "value": {"detail": "Refresh token has expired"},
                        },
                        "invalid": {
                            "summary": "Invalid token",
                            "value": {"detail": "Invalid refresh token"},
                        },
                        "revoked": {
                            "summary": "Token revoked",
                            "value": {"detail": "Refresh token has been revoked"},
                        },
                        "inactive_user": {
                            "summary": "User deactivated",
                            "value": {"detail": "User account is deactivated"},
                        },
                    }
                }
            },
        },
        404: {
            "description": "User not found",
            "content": {"application/json": {"example": {"detail": "User not found"}}},
        },
    },
)
async def refresh_token(
    token_data: TokenRefresh,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Generate new access and refresh tokens using refresh token.

    Implements token rotation: each refresh token can only be used once.
    The old refresh token is invalidated and a new one is issued.

    Args:
        token_data: Contains refresh token
        db: Database session (injected)

    Returns:
        TokenResponse with new access and refresh tokens

    Raises:
        HTTPException(401): If refresh token is invalid, expired, or revoked
        HTTPException(404): If user associated with token no longer exists
    """
    service = AuthService(db)

    try:
        # Service now returns tuple: (access_token, refresh_token, user)
        new_access_token, new_refresh_token, user = await service.refresh_access_token(
            token_data.refresh_token
        )

        # Calculate expires_in from settings
        expires_in = settings.jwt_access_token_expire_minutes * 60

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=expires_in,
        )

    except TokenExpiredException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.detail,
        )

    except TokenInvalidException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.detail,
        )

    except UserNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.detail,
        )

    except Exception:
        # Catch any unexpected errors and return generic message
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )


@router.post(
    "/logout",
    response_model=LogoutResponse,
    summary="Logout user",
    responses={
        200: {
            "description": "Successfully logged out",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "Successfully logged out",
                        "token_revoked": True,
                    }
                }
            },
        },
        401: {
            "description": "Authentication required",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Authentication required. Please provide a valid access token."
                    }
                }
            },
        },
    },
)
async def logout(
    token_data: TokenRefresh,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LogoutResponse:
    """Logout user by invalidating refresh token.

    Requires authentication to ensure only the token owner can revoke it.

    Args:
        token_data: Contains refresh token to invalidate
        current_user: The authenticated user (injected via dependency)
        db: Database session (injected)

    Returns:
        LogoutResponse with success status and message
    """
    service = AuthService(db)
    token_revoked = await service.revoke_refresh_token(token_data.refresh_token)

    return LogoutResponse(
        success=True,
        message="Successfully logged out" if token_revoked else "Logout processed",
        token_revoked=token_revoked,
    )


@router.post(
    "/logout-all",
    response_model=LogoutAllResponse,
    summary="Logout from all sessions",
    responses={
        200: {
            "description": "Successfully logged out from all sessions",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "Logged out from 3 sessions",
                        "sessions_revoked": 3,
                    }
                }
            },
        },
        401: {
            "description": "Authentication required",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Authentication required. Please provide a valid access token."
                    }
                }
            },
        },
    },
)
async def logout_all(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LogoutAllResponse:
    """Logout from all active sessions.

    Revokes all refresh tokens for the current user, effectively
    logging them out from all devices/sessions.

    Args:
        current_user: The authenticated user (injected via dependency)
        db: Database session (injected)

    Returns:
        LogoutAllResponse with count of revoked sessions
    """
    service = AuthService(db)
    sessions_revoked = await service.revoke_all_user_tokens(current_user.id)

    return LogoutAllResponse(
        success=True,
        message=f"Logged out from {sessions_revoked} session(s)",
        sessions_revoked=sessions_revoked,
    )


@router.get(
    "/sessions",
    response_model=SessionListResponse,
    summary="List active sessions",
    responses={
        200: {
            "description": "List of active sessions",
            "content": {
                "application/json": {
                    "example": {
                        "sessions": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "created_at": "2024-11-25T10:30:00Z",
                                "expires_at": "2024-12-25T10:30:00Z",
                            }
                        ],
                        "total": 1,
                    }
                }
            },
        },
        401: {
            "description": "Authentication required",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Authentication required. Please provide a valid access token."
                    }
                }
            },
        },
    },
)
async def get_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionListResponse:
    """Get all active sessions for the current user.

    Returns a list of active sessions (refresh tokens) without exposing
    the actual token values for security.

    Args:
        current_user: The authenticated user (injected via dependency)
        db: Database session (injected)

    Returns:
        SessionListResponse with list of sessions and total count
    """
    service = AuthService(db)
    sessions_data = await service.get_user_sessions(current_user.id)

    sessions = [
        SessionInfo(
            id=session["id"],
            created_at=session["created_at"],
            expires_at=session["expires_at"],
        )
        for session in sessions_data
    ]

    return SessionListResponse(
        sessions=sessions,
        total=len(sessions),
    )


@router.delete(
    "/sessions/{session_id}",
    response_model=LogoutResponse,
    summary="Revoke a specific session",
    responses={
        200: {
            "description": "Session revoked successfully",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "Session revoked successfully",
                        "token_revoked": True,
                    }
                }
            },
        },
        401: {
            "description": "Authentication required",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Authentication required. Please provide a valid access token."
                    }
                }
            },
        },
        404: {
            "description": "Session not found",
            "content": {
                "application/json": {"example": {"detail": "Session not found or already revoked"}}
            },
        },
    },
)
async def revoke_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LogoutResponse:
    """Revoke a specific session by its ID.

    Users can only revoke their own sessions. Attempting to revoke
    another user's session will return a 404 error.

    Args:
        session_id: The UUID of the session to revoke
        current_user: The authenticated user (injected via dependency)
        db: Database session (injected)

    Returns:
        LogoutResponse with success status

    Raises:
        HTTPException(404): If session not found or belongs to another user
    """
    service = AuthService(db)
    token_revoked = await service.revoke_session_by_id(current_user.id, str(session_id))

    if not token_revoked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or already revoked",
        )

    return LogoutResponse(
        success=True,
        message="Session revoked successfully",
        token_revoked=True,
    )


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Get current user profile",
    responses={
        200: {
            "description": "Current user profile with settings",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "email": "user@example.com",
                        "full_name": "John Doe",
                        "is_active": True,
                        "is_superuser": False,
                        "email_verified_at": None,
                        "created_at": "2024-11-25T10:30:00Z",
                        "updated_at": "2024-11-25T10:30:00Z",
                        "settings": {
                            "id": "660e8400-e29b-41d4-a716-446655440001",
                            "user_id": "550e8400-e29b-41d4-a716-446655440000",
                            "daily_goal": 20,
                            "email_notifications": True,
                            "created_at": "2024-11-25T10:30:00Z",
                            "updated_at": "2024-11-25T10:30:00Z",
                        },
                    }
                }
            },
        },
        401: {
            "description": "Authentication required or token invalid",
            "content": {
                "application/json": {
                    "examples": {
                        "missing_token": {
                            "summary": "No token provided",
                            "value": {
                                "detail": "Authentication required. Please provide a valid access token."
                            },
                        },
                        "expired_token": {
                            "summary": "Token expired",
                            "value": {
                                "detail": "Access token has expired. Please refresh your token."
                            },
                        },
                        "invalid_token": {
                            "summary": "Invalid token",
                            "value": {"detail": "Invalid access token: Invalid token"},
                        },
                        "inactive_user": {
                            "summary": "User deactivated",
                            "value": {"detail": "User account has been deactivated."},
                        },
                    }
                }
            },
        },
        404: {
            "description": "User not found",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "User with ID '550e8400-e29b-41d4-a716-446655440000' not found"
                    }
                }
            },
        },
    },
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserProfileResponse:
    """Get the current authenticated user's profile.

    Returns the user's profile information including their settings.
    Requires a valid JWT access token in the Authorization header.

    The user's settings (daily_goal, email_notifications) are included
    in the response for convenience.

    Args:
        current_user: The authenticated user (injected via dependency)

    Returns:
        UserProfileResponse: User profile with embedded settings

    Raises:
        HTTPException(401): If not authenticated or token invalid
        HTTPException(404): If user no longer exists (rare edge case)

    Example Request:
        GET /api/v1/auth/me
        Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

    Example Response:
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "email": "user@example.com",
            "full_name": "John Doe",
            "is_active": true,
            "is_superuser": false,
            "email_verified_at": null,
            "created_at": "2024-11-25T10:30:00Z",
            "updated_at": "2024-11-25T10:30:00Z",
            "settings": {
                "id": "660e8400-e29b-41d4-a716-446655440001",
                "user_id": "550e8400-e29b-41d4-a716-446655440000",
                "daily_goal": 20,
                "email_notifications": true,
                "created_at": "2024-11-25T10:30:00Z",
                "updated_at": "2024-11-25T10:30:00Z"
            }
        }
    """
    return UserProfileResponse.model_validate(current_user)


@router.patch(
    "/me",
    response_model=UserProfileResponse,
    summary="Update current user profile and settings",
    responses={
        200: {
            "description": "Profile updated successfully",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "email": "user@example.com",
                        "full_name": "John Doe Updated",
                        "is_active": True,
                        "is_superuser": False,
                        "email_verified_at": None,
                        "created_at": "2024-11-25T10:30:00Z",
                        "updated_at": "2024-11-25T12:00:00Z",
                        "settings": {
                            "id": "660e8400-e29b-41d4-a716-446655440001",
                            "user_id": "550e8400-e29b-41d4-a716-446655440000",
                            "daily_goal": 30,
                            "email_notifications": False,
                            "preferred_language": "el",
                            "created_at": "2024-11-25T10:30:00Z",
                            "updated_at": "2024-11-25T12:00:00Z",
                        },
                    }
                }
            },
        },
        401: {"description": "Authentication required"},
        422: {
            "description": "Validation error (e.g., invalid language code)",
        },
    },
)
async def update_me(
    update_data: UserWithSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """Update the current user's profile and/or settings.

    Supports partial updates - only provided fields are updated.
    Can update user profile (full_name) and settings (daily_goal,
    email_notifications, preferred_language) in a single request.

    Args:
        update_data: Fields to update (all optional)
        current_user: The authenticated user (injected via dependency)
        db: Database session (injected)

    Returns:
        UserProfileResponse with updated profile and settings

    Raises:
        HTTPException(401): If not authenticated
        HTTPException(422): If validation fails (e.g., invalid language code)
    """
    settings_repo = UserSettingsRepository(db)

    # Separate user fields from settings fields
    user_fields: dict[str, Any] = {"full_name": update_data.full_name}
    settings_fields: dict[str, Any] = {
        "daily_goal": update_data.daily_goal,
        "email_notifications": update_data.email_notifications,
        "preferred_language": update_data.preferred_language,
    }

    # Filter out None values (only update provided fields)
    user_updates: dict[str, Any] = {k: v for k, v in user_fields.items() if v is not None}
    settings_updates: dict[str, Any] = {k: v for k, v in settings_fields.items() if v is not None}

    # Update user if there are user field changes
    if user_updates:
        for field, value in user_updates.items():
            setattr(current_user, field, value)
        db.add(current_user)

    # Update settings if there are settings field changes
    if settings_updates:
        settings = await settings_repo.get_by_user_id(current_user.id)
        if settings:
            for field, value in settings_updates.items():
                setattr(settings, field, value)
            db.add(settings)

    await db.commit()

    # Refresh to get updated timestamps
    await db.refresh(current_user)
    if current_user.settings:
        await db.refresh(current_user.settings)

    return UserProfileResponse.model_validate(current_user)
