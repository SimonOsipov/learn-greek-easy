"""Repository layer for database operations."""

from src.repositories.announcement import AnnouncementCampaignRepository
from src.repositories.base import BaseRepository
from src.repositories.card import CardRepository
from src.repositories.card_error import CardErrorReportRepository
from src.repositories.card_record import CardRecordRepository
from src.repositories.changelog import ChangelogRepository
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
from src.repositories.user import UserRepository, UserSettingsRepository
from src.repositories.webhook_event import WebhookEventRepository
from src.repositories.word_entry import WordEntryRepository

__all__ = [
    # Announcement
    "AnnouncementCampaignRepository",
    # Base
    "BaseRepository",
    # Changelog
    "ChangelogRepository",
    # User
    "UserRepository",
    "UserSettingsRepository",
    # Content
    "DeckRepository",
    "CardRepository",
    "CardRecordRepository",
    # Progress
    "UserDeckProgressRepository",
    "CardStatisticsRepository",
    # Review
    "ReviewRepository",
    # Session (Redis)
    "SessionRepository",
    # Feedback
    "FeedbackRepository",
    # Card Error
    "CardErrorReportRepository",
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
    # Webhook Event
    "WebhookEventRepository",
    # Word Entry
    "WordEntryRepository",
]
