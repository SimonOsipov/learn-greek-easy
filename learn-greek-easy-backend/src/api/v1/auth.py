"""Authentication API endpoints.

This module provides HTTP endpoints for user authentication and profile management.
Authentication is handled via Supabase Auth JWT tokens validated by the dependency layer.

Endpoints include logout acknowledgments (client-side token clearing), user profile
retrieval and updates, and avatar management (S3 presigned URLs).
"""

import uuid as uuid_module
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.dependencies import get_current_user
from src.core.logging import get_logger
from src.core.subscription import get_effective_access_level
from src.db.dependencies import get_db
from src.db.models import User
from src.repositories.user import UserSettingsRepository
from src.schemas.user import (
    AvatarDeleteResponse,
    AvatarUploadRequest,
    AvatarUploadResponse,
    LogoutAllResponse,
    LogoutResponse,
    UserProfileResponse,
    UserWithSettingsUpdate,
)
from src.services.s3_service import (
    ALLOWED_AVATAR_CONTENT_TYPES,
    AVATAR_UPLOAD_URL_EXPIRY,
    MAX_AVATAR_SIZE_BYTES,
    get_s3_service,
)

logger = get_logger(__name__)


def _extract_auth_provider(request: Request) -> str:
    """Extract auth provider from stored Supabase claims, defaulting to 'email'."""
    claims = getattr(request.state, "supabase_claims", None)
    if claims and claims.auth_provider:
        provider: str = claims.auth_provider
        return provider
    return "email"


def _build_user_profile_response(user: User, auth_provider: str = "email") -> UserProfileResponse:
    """Build UserProfileResponse with presigned avatar URL.

    Converts the raw avatar_url (S3 key) to a presigned GET URL
    so the frontend can display the avatar image.

    Args:
        user: User model with avatar_url as S3 key

    Returns:
        UserProfileResponse with avatar_url as presigned URL (or None)
    """
    s3_service = get_s3_service()

    # Convert S3 key to presigned URL if avatar exists
    avatar_presigned_url = None
    if user.avatar_url:
        avatar_presigned_url = s3_service.generate_presigned_url(
            user.avatar_url,
            expiry_seconds=2592000,  # 30 days expiry for avatar URLs
        )

    # Build response with presigned URL and auth_provider
    response = UserProfileResponse.model_validate(user)
    # Override avatar_url with presigned URL
    response.avatar_url = avatar_presigned_url
    # Set auth_provider
    response.auth_provider = auth_provider

    # Compute effective role from subscription status
    if user.is_superuser:
        response.effective_role = "admin"
    else:
        response.effective_role = get_effective_access_level(user).value

    return response


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
    current_user: User = Depends(get_current_user),
) -> LogoutResponse:
    """Logout user (acknowledgment only).

    This endpoint provides a logout acknowledgment for the client.
    Actual token invalidation happens client-side by discarding the JWT.
    Supabase Auth does not use server-side refresh token storage.

    Args:
        current_user: The authenticated user (injected via dependency)

    Returns:
        LogoutResponse with success status and message
    """
    return LogoutResponse(
        success=True,
        message="Successfully logged out",
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
                        "message": "Successfully logged out from all sessions",
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
) -> LogoutAllResponse:
    """Logout from all sessions (acknowledgment only).

    This endpoint provides a logout acknowledgment for the client.
    Actual token invalidation happens client-side by discarding all JWTs.
    Supabase Auth does not use server-side refresh token storage.

    Args:
        current_user: The authenticated user (injected via dependency)

    Returns:
        LogoutAllResponse with success status and message
    """
    return LogoutAllResponse(
        success=True,
        message="Successfully logged out from all sessions",
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
                        "auth_provider": "email",
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
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """Get the current authenticated user's profile.

    Returns the user's profile information including their settings.
    Requires a valid JWT access token in the Authorization header.

    Reloads user from database to ensure clean session state and avoid
    MissingGreenlet errors when serializing ORM objects across async contexts.

    The user's settings (daily_goal, email_notifications) are included
    in the response for convenience.

    Args:
        current_user: The authenticated user (injected via dependency)
        db: Database session (injected)

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
            "auth_provider": "email",
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
    # Reload user with settings to ensure clean session state
    stmt = select(User).options(selectinload(User.settings)).where(User.id == current_user.id)
    result = await db.execute(stmt)
    user = result.scalar_one()

    return _build_user_profile_response(user, auth_provider=_extract_auth_provider(request))


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
                        "auth_provider": "email",
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
    request: Request,
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
    s3_service = get_s3_service()

    # Separate user fields from settings fields
    user_fields: dict[str, Any] = {
        "full_name": update_data.full_name,
        "avatar_url": update_data.avatar_url,
    }
    settings_fields: dict[str, Any] = {
        "daily_goal": update_data.daily_goal,
        "email_notifications": update_data.email_notifications,
        "preferred_language": update_data.preferred_language,
        "theme": update_data.theme,
    }

    # Filter out None values (only update provided fields)
    user_updates: dict[str, Any] = {k: v for k, v in user_fields.items() if v is not None}
    settings_updates: dict[str, Any] = {k: v for k, v in settings_fields.items() if v is not None}

    # Handle avatar_url update with ownership validation and old avatar cleanup
    if "avatar_url" in user_updates:
        new_avatar_url = user_updates["avatar_url"]

        # Validate the avatar key belongs to this user
        expected_prefix = f"avatars/{current_user.id}/"
        if not new_avatar_url.startswith(expected_prefix):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid avatar URL: must be in user's avatar folder",
            )

        # Delete old avatar from S3 if replacing
        if current_user.avatar_url and current_user.avatar_url != new_avatar_url:
            s3_service.delete_object(current_user.avatar_url)

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

    # Reload user with settings to get updated timestamps
    # (required for lazy="raise" relationships)
    stmt = select(User).options(selectinload(User.settings)).where(User.id == current_user.id)
    result = await db.execute(stmt)
    updated_user = result.scalar_one()

    return _build_user_profile_response(updated_user, auth_provider=_extract_auth_provider(request))


@router.post(
    "/avatar/upload-url",
    response_model=AvatarUploadResponse,
    summary="Get presigned URL for avatar upload",
    responses={
        200: {"description": "Presigned upload URL generated"},
        400: {"description": "Invalid content type or file size"},
        401: {"description": "Authentication required"},
        503: {"description": "S3 service unavailable"},
    },
)
async def get_avatar_upload_url(
    request_data: AvatarUploadRequest,
    current_user: User = Depends(get_current_user),
) -> AvatarUploadResponse:
    """Generate a presigned URL for uploading a new avatar.

    The URL is valid for 10 minutes. After uploading to S3,
    call PATCH /me with the avatar_key to save it to your profile.
    """
    s3_service = get_s3_service()

    # Validate content type
    if not s3_service.validate_avatar_content_type(request_data.content_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid content type. Allowed: {', '.join(sorted(ALLOWED_AVATAR_CONTENT_TYPES))}",
        )

    # Validate file size
    if not s3_service.validate_avatar_size(request_data.file_size):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size must be between 1 byte and {MAX_AVATAR_SIZE_BYTES // (1024 * 1024)}MB",
        )

    # Generate S3 key
    ext = s3_service.get_extension_for_content_type(request_data.content_type)
    avatar_key = f"avatars/{current_user.id}/{uuid_module.uuid4()}.{ext}"

    # Generate presigned URL
    upload_url = s3_service.generate_presigned_upload_url(
        s3_key=avatar_key,
        content_type=request_data.content_type,
        expiry_seconds=AVATAR_UPLOAD_URL_EXPIRY,
    )

    if not upload_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to generate upload URL. S3 service may be unavailable.",
        )

    return AvatarUploadResponse(
        upload_url=upload_url,
        avatar_key=avatar_key,
        expires_in=AVATAR_UPLOAD_URL_EXPIRY,
    )


@router.delete(
    "/avatar",
    response_model=AvatarDeleteResponse,
    summary="Remove current avatar",
    responses={
        200: {"description": "Avatar removed successfully"},
        401: {"description": "Authentication required"},
    },
)
async def delete_avatar(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AvatarDeleteResponse:
    """Remove the current user's avatar.

    Deletes the avatar from S3 and clears avatar_url from the profile.
    """
    s3_service = get_s3_service()

    # Delete from S3 if exists
    if current_user.avatar_url:
        s3_service.delete_object(current_user.avatar_url)

    # Clear avatar_url
    current_user.avatar_url = None
    db.add(current_user)
    await db.commit()

    return AvatarDeleteResponse(
        success=True,
        message="Avatar removed successfully",
    )
