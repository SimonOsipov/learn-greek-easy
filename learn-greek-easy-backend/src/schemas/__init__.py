"""Pydantic schemas for API request/response validation."""

# User schemas
# Card schemas
from src.schemas.card import (
    CardCreate,
    CardResponse,
    CardStudyResponse,
    CardStudyResultResponse,
    CardUpdate,
    CardWithStatisticsResponse,
)

# Deck schemas
from src.schemas.deck import (
    DeckCreate,
    DeckListResponse,
    DeckResponse,
    DeckUpdate,
    DeckWithProgressResponse,
)

# Progress schemas
from src.schemas.progress import (
    CardStatisticsResponse,
    ProgressSummaryResponse,
    StudySessionStatsResponse,
    UserDeckProgressResponse,
)

# Review schemas
from src.schemas.review import (
    BulkReviewResponse,
    BulkReviewSubmit,
    ReviewHistoryResponse,
    ReviewResponse,
    ReviewSubmit,
)

# SM-2 schemas
from src.schemas.sm2 import (
    CardInitializationRequest,
    CardInitializationResult,
    SM2BulkReviewResult,
    SM2CalculationResponse,
    SM2ReviewResult,
    StudyQueue,
    StudyQueueCard,
    StudyQueueRequest,
)
from src.schemas.user import (
    TokenPayload,
    TokenRefresh,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserProfileResponse,
    UserResponse,
    UserSettingsResponse,
    UserSettingsUpdate,
    UserUpdate,
)

__all__ = [
    # User
    "UserCreate",
    "UserLogin",
    "UserUpdate",
    "UserResponse",
    "UserProfileResponse",
    "UserSettingsUpdate",
    "UserSettingsResponse",
    "TokenResponse",
    "TokenRefresh",
    "TokenPayload",
    # Deck
    "DeckCreate",
    "DeckUpdate",
    "DeckResponse",
    "DeckWithProgressResponse",
    "DeckListResponse",
    # Card
    "CardCreate",
    "CardUpdate",
    "CardResponse",
    "CardStudyResponse",
    "CardStudyResultResponse",
    "CardWithStatisticsResponse",
    # Progress
    "UserDeckProgressResponse",
    "CardStatisticsResponse",
    "ProgressSummaryResponse",
    "StudySessionStatsResponse",
    # Review
    "ReviewSubmit",
    "ReviewResponse",
    "ReviewHistoryResponse",
    "BulkReviewSubmit",
    "BulkReviewResponse",
    # SM-2
    "SM2CalculationResponse",
    "SM2ReviewResult",
    "SM2BulkReviewResult",
    "StudyQueueCard",
    "StudyQueue",
    "StudyQueueRequest",
    "CardInitializationRequest",
    "CardInitializationResult",
]
