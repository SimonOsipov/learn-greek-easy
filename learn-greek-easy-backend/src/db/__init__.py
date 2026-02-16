"""Database package exports."""

from src.db.base import Base, SoftDeleteMixin, TimestampMixin
from src.db.dependencies import get_db, get_db_transactional
from src.db.models import (
    Card,
    CardStatistics,
    CardStatus,
    Deck,
    DeckLevel,
    PartOfSpeech,
    Review,
    ReviewRating,
    User,
    UserDeckProgress,
    UserSettings,
    WordEntry,
)
from src.db.session import close_db, get_session, get_session_factory, init_db

__all__ = [
    # Session management
    "init_db",
    "close_db",
    "get_session",
    "get_session_factory",
    # Base classes
    "Base",
    "TimestampMixin",
    "SoftDeleteMixin",
    # Dependencies
    "get_db",
    "get_db_transactional",
    # Enums
    "DeckLevel",
    "PartOfSpeech",
    "CardStatus",
    "ReviewRating",
    # Models - User
    "User",
    "UserSettings",
    # Models - Content
    "Deck",
    "Card",
    "WordEntry",
    # Models - Progress
    "UserDeckProgress",
    "CardStatistics",
    "Review",
]
