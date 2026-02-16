"""Core module containing authentication dependencies and algorithms.

This module provides:
- Authentication dependencies for FastAPI routes
- SM-2 spaced repetition algorithm

Example:
    from src.core import (
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
from src.core.posthog import (
    capture_event,
    get_posthog_client,
    identify_user,
    init_posthog,
    is_posthog_enabled,
    shutdown_posthog,
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
    # Authentication dependencies (from dependencies.py)
    "get_current_user",
    "get_current_superuser",
    "get_current_user_optional",
    # PostHog analytics (from posthog.py)
    "capture_event",
    "identify_user",
    "get_posthog_client",
    "init_posthog",
    "shutdown_posthog",
    "is_posthog_enabled",
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
