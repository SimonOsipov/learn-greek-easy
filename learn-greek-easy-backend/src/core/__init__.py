"""Core module containing security utilities and authentication dependencies.

This module provides:
- Password hashing and verification (bcrypt)
- JWT token generation and validation
- Authentication dependencies for FastAPI routes

Example:
    from src.core import (
        # Password utilities
        hash_password,
        verify_password,
        validate_password_strength,
        # JWT utilities
        create_access_token,
        create_refresh_token,
        verify_token,
        # Auth dependencies
        get_current_user,
        get_current_superuser,
        get_current_user_optional,
    )
"""

from src.core.dependencies import get_current_superuser, get_current_user, get_current_user_optional
from src.core.security import (
    create_access_token,
    create_refresh_token,
    extract_token_from_header,
    hash_password,
    validate_password_strength,
    verify_password,
    verify_token,
)

__all__ = [
    # Password hashing (from security.py)
    "hash_password",
    "verify_password",
    "validate_password_strength",
    # JWT token management (from security.py)
    "create_access_token",
    "create_refresh_token",
    "verify_token",
    "extract_token_from_header",
    # Authentication dependencies (from dependencies.py)
    "get_current_user",
    "get_current_superuser",
    "get_current_user_optional",
]
