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
from src.schemas.progress import (  # Existing; Dashboard schemas; Deck Progress schemas; Learning Trends schemas; Achievements schemas
    Achievement,
    AchievementsResponse,
    CardStatisticsResponse,
    DailyStats,
    DashboardStatsResponse,
    DeckProgressDetailResponse,
    DeckProgressListResponse,
    DeckProgressMetrics,
    DeckProgressSummary,
    DeckStatistics,
    DeckTimeline,
    LearningTrendsResponse,
    NextMilestone,
    OverviewStats,
    ProgressSummaryResponse,
    RecentActivity,
    StreakStats,
    StudySessionStatsResponse,
    TodayStats,
    TrendsSummary,
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
    # Dashboard
    "OverviewStats",
    "TodayStats",
    "StreakStats",
    "RecentActivity",
    "DashboardStatsResponse",
    # Deck Progress
    "DeckProgressSummary",
    "DeckProgressListResponse",
    "DeckProgressMetrics",
    "DeckStatistics",
    "DeckTimeline",
    "DeckProgressDetailResponse",
    # Learning Trends
    "DailyStats",
    "TrendsSummary",
    "LearningTrendsResponse",
    # Achievements
    "Achievement",
    "NextMilestone",
    "AchievementsResponse",
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
