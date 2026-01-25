"""Repository layer for database operations."""

from src.repositories.base import BaseRepository
from src.repositories.card import CardRepository
from src.repositories.culture_answer_history import CultureAnswerHistoryRepository
from src.repositories.culture_deck import CultureDeckRepository
from src.repositories.culture_question import CultureQuestionRepository
from src.repositories.culture_question_stats import CultureQuestionStatsRepository
from src.repositories.deck import DeckRepository
from src.repositories.feedback import FeedbackRepository
from src.repositories.mock_exam import MockExamRepository
from src.repositories.news_item import NewsItemRepository
from src.repositories.notification import NotificationRepository
from src.repositories.progress import CardStatisticsRepository, UserDeckProgressRepository
from src.repositories.review import ReviewRepository
from src.repositories.session import SessionRepository
from src.repositories.user import RefreshTokenRepository, UserRepository, UserSettingsRepository

__all__ = [
    # Base
    "BaseRepository",
    # User
    "UserRepository",
    "UserSettingsRepository",
    "RefreshTokenRepository",
    # Content
    "DeckRepository",
    "CardRepository",
    # Progress
    "UserDeckProgressRepository",
    "CardStatisticsRepository",
    # Review
    "ReviewRepository",
    # Session (Redis)
    "SessionRepository",
    # Feedback
    "FeedbackRepository",
    # Notification
    "NotificationRepository",
    # Culture
    "CultureDeckRepository",
    "CultureQuestionRepository",
    "CultureQuestionStatsRepository",
    "CultureAnswerHistoryRepository",
    # Mock Exam
    "MockExamRepository",
    # News Feed
    "NewsItemRepository",
]
