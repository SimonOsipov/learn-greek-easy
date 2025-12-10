"""Core module containing security utilities, authentication, and algorithms.

This module provides:
- Password hashing and verification (bcrypt)
- JWT token generation and validation
- Authentication dependencies for FastAPI routes
- SM-2 spaced repetition algorithm

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
        # SM-2 Algorithm
        calculate_sm2,
        SM2Calculation,
        DEFAULT_EASINESS_FACTOR,
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
from src.core.sm2 import (
    DEFAULT_EASINESS_FACTOR,
    LEARNING_REPETITIONS_THRESHOLD,
    MASTERY_EF_THRESHOLD,
    MASTERY_INTERVAL_THRESHOLD,
    MIN_EASINESS_FACTOR,
    SM2Calculation,
    calculate_easiness_factor,
    calculate_interval,
    calculate_next_review_date,
    calculate_sm2,
    determine_status,
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
    # SM-2 Algorithm (from sm2.py)
    "SM2Calculation",
    "calculate_sm2",
    "calculate_easiness_factor",
    "calculate_interval",
    "determine_status",
    "calculate_next_review_date",
    "MIN_EASINESS_FACTOR",
    "DEFAULT_EASINESS_FACTOR",
    "MASTERY_EF_THRESHOLD",
    "MASTERY_INTERVAL_THRESHOLD",
    "LEARNING_REPETITIONS_THRESHOLD",
]
