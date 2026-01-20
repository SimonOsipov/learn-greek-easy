"""Pydantic schemas for API request/response validation."""

# Card schemas
from src.schemas.card import (
    CardCreate,
    CardResponse,
    CardStudyResponse,
    CardStudyResultResponse,
    CardUpdate,
    CardWithStatisticsResponse,
)

# Culture schemas
from src.schemas.culture import (
    CultureAnswerRequest,
    CultureAnswerResponse,
    CultureDeckDetailResponse,
    CultureDeckListResponse,
    CultureDeckProgress,
    CultureDeckResponse,
    CultureOverallProgress,
    CultureProgressResponse,
    CultureQuestionListResponse,
    CultureQuestionResponse,
    CultureQuestionStatsResponse,
    CultureSessionSummary,
    MultilingualText,
)

# Deck schemas
from src.schemas.deck import (
    DeckCreate,
    DeckListResponse,
    DeckResponse,
    DeckUpdate,
    DeckWithProgressResponse,
)

# Feedback schemas
from src.schemas.feedback import (
    AuthorBriefResponse,
    FeedbackCreate,
    FeedbackListResponse,
    FeedbackResponse,
    FeedbackUpdate,
    VoteRequest,
    VoteResponse,
)

# Mock Exam schemas
from src.schemas.mock_exam import (
    MockExamAnswerItem,
    MockExamAnswerResult,
    MockExamCreateResponse,
    MockExamHistoryItem,
    MockExamQuestionResponse,
    MockExamQueueResponse,
    MockExamSessionResponse,
    MockExamStatisticsResponse,
    MockExamSubmitAllRequest,
    MockExamSubmitAllResponse,
)

# Notification schemas
from src.schemas.notification import (
    ClearResponse,
    MarkReadResponse,
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
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

# Seed schemas
from src.schemas.seed import SeedOptions, SeedRequest, SeedResultResponse, SeedStatusResponse

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
    SupportedLanguage,
    TokenPayload,
    TokenRefresh,
    TokenResponse,
    UserProfileResponse,
    UserResponse,
    UserSettingsResponse,
    UserSettingsUpdate,
    UserUpdate,
    UserWithSettingsUpdate,
)

__all__ = [
    # User
    "UserUpdate",
    "UserResponse",
    "UserProfileResponse",
    "UserSettingsUpdate",
    "UserSettingsResponse",
    "UserWithSettingsUpdate",
    "SupportedLanguage",
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
    # Seed
    "SeedOptions",
    "SeedRequest",
    "SeedResultResponse",
    "SeedStatusResponse",
    # Feedback
    "AuthorBriefResponse",
    "FeedbackCreate",
    "FeedbackListResponse",
    "FeedbackResponse",
    "FeedbackUpdate",
    "VoteRequest",
    "VoteResponse",
    # Notification
    "NotificationResponse",
    "NotificationListResponse",
    "UnreadCountResponse",
    "MarkReadResponse",
    "ClearResponse",
    # Culture
    "MultilingualText",
    "CultureDeckProgress",
    "CultureDeckResponse",
    "CultureDeckDetailResponse",
    "CultureDeckListResponse",
    "CultureQuestionResponse",
    "CultureQuestionListResponse",
    "CultureQuestionStatsResponse",
    "CultureAnswerRequest",
    "CultureAnswerResponse",
    "CultureOverallProgress",
    "CultureProgressResponse",
    "CultureSessionSummary",
    # Mock Exam
    "MockExamQuestionResponse",
    "MockExamSessionResponse",
    "MockExamCreateResponse",
    "MockExamQueueResponse",
    "MockExamAnswerItem",
    "MockExamSubmitAllRequest",
    "MockExamAnswerResult",
    "MockExamSubmitAllResponse",
    "MockExamHistoryItem",
    "MockExamStatisticsResponse",
]
