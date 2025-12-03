"""Pydantic schemas for API request/response validation."""

# User schemas
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

# Deck schemas
from src.schemas.deck import (
    DeckCreate,
    DeckListResponse,
    DeckResponse,
    DeckUpdate,
    DeckWithProgressResponse,
)

# Card schemas
from src.schemas.card import (
    CardCreate,
    CardResponse,
    CardStudyResponse,
    CardStudyResultResponse,
    CardUpdate,
    CardWithStatisticsResponse,
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
]
