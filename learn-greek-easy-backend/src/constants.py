"""Application constants and enumerations."""

from enum import Enum


class UserRole(str, Enum):
    """User role enumeration."""

    USER = "user"
    ADMIN = "admin"
    PREMIUM = "premium"


class DeckLevel(str, Enum):
    """Deck difficulty level (CEFR)."""

    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class CardStage(str, Enum):
    """Card learning stage in SRS system."""

    NEW = "new"
    LEARNING = "learning"
    REVIEW = "review"
    RELEARNING = "relearning"
    MASTERED = "mastered"


class DeckStatus(str, Enum):
    """User's deck status."""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class ResponseMessages:
    """Standard API response messages."""

    # Success
    SUCCESS = "Operation completed successfully"
    CREATED = "Resource created successfully"
    UPDATED = "Resource updated successfully"
    DELETED = "Resource deleted successfully"

    # Authentication
    LOGIN_SUCCESS = "Login successful"
    LOGOUT_SUCCESS = "Logout successful"
    REGISTER_SUCCESS = "Registration successful"
    TOKEN_REFRESHED = "Token refreshed successfully"

    # Errors
    NOT_FOUND = "Resource not found"
    UNAUTHORIZED = "Authentication required"
    FORBIDDEN = "Access forbidden"
    BAD_REQUEST = "Invalid request"
    INTERNAL_ERROR = "Internal server error"

    # Validation
    INVALID_CREDENTIALS = "Invalid email or password"
    EMAIL_ALREADY_EXISTS = "Email already registered"
    WEAK_PASSWORD = "Password does not meet requirements"
    TOKEN_EXPIRED = "Token has expired"
    TOKEN_INVALID = "Invalid token"


# Spaced Repetition System Constants
class SRSConstants:
    """Constants for SM-2 spaced repetition algorithm."""

    # Quality ratings (1-5)
    QUALITY_BLACKOUT = 1  # Complete blackout
    QUALITY_INCORRECT = 2  # Incorrect response with correct answer seeming familiar
    QUALITY_RECALL_HARD = 3  # Correct response with difficulty
    QUALITY_RECALL_OK = 4  # Correct response with hesitation
    QUALITY_PERFECT = 5  # Perfect response

    # Initial values
    INITIAL_EASE_FACTOR = 2.5
    INITIAL_INTERVAL = 1
    INITIAL_REPETITIONS = 0

    # Constraints
    MIN_EASE_FACTOR = 1.3
    MAX_EASE_FACTOR = 3.0

    # Stage thresholds (days)
    LEARNING_THRESHOLD = 1
    REVIEW_THRESHOLD = 7
    MASTERED_THRESHOLD = 21


# Culture Exam Readiness Constants
class ReadinessConstants:
    """Constants for culture exam readiness calculation."""

    # Weighted contribution of each SRS stage to readiness score
    WEIGHT_LEARNING = 0.25
    WEIGHT_REVIEW = 0.5
    WEIGHT_MASTERED = 1.0

    # Verdict thresholds: (min_percent, verdict_key)
    # Ordered descending for first-match lookup
    VERDICT_THRESHOLDS: list[tuple[int, str]] = [
        (85, "thoroughly_prepared"),
        (60, "ready"),
        (40, "getting_there"),
        (0, "not_ready"),
    ]

    # Categories included in readiness calculation
    # Excludes "traditions" which is not part of the official exam
    INCLUDED_CATEGORIES = ("history", "geography", "politics", "culture", "practical")


# Category mapping: DB categories → logical UI categories
CATEGORY_DB_TO_LOGICAL: dict[str, str] = {
    "history": "history",
    "geography": "geography",
    "politics": "politics",
    "culture": "culture",
    "practical": "culture",
}
LOGICAL_CATEGORIES = ("history", "geography", "politics", "culture")


# Pagination
DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# Cache TTL (seconds)
CACHE_DECK_LIST = 3600  # 1 hour
CACHE_DECK_DETAIL = 1800  # 30 minutes
CACHE_USER_PROGRESS = 300  # 5 minutes

# Rate Limiting
RATE_LIMIT_GENERAL = "60/minute"
RATE_LIMIT_AUTH = "5/minute"
RATE_LIMIT_REVIEW = "120/minute"

# Answer Time Limits
MAX_ANSWER_TIME_SECONDS = 180  # Cap per-answer time at 3 minutes
