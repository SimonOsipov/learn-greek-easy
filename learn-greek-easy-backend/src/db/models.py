"""Database models for Learn Greek Easy application.

This module contains all SQLAlchemy models for the application:
- User management (User, UserSettings, RefreshToken)
- Content (Deck, Card)
- Progress tracking (UserDeckProgress, CardStatistics, Review)
- Feedback (Feedback, FeedbackVote)
- XP and Achievements (UserXP, XPTransaction, Achievement, UserAchievement)
- Notifications (Notification)

All models use:
- UUID primary keys with server-side generation
- TimestampMixin for created_at/updated_at
- SQLAlchemy 2.0 async with Mapped, mapped_column
- Proper relationships with lazy="selectin" for async queries
"""

import enum
from datetime import date, datetime
from typing import List
from uuid import UUID

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base, TimestampMixin

# ============================================================================
# Enums
# ============================================================================


class DeckLevel(str, enum.Enum):
    """CEFR language proficiency levels for decks."""

    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class CardDifficulty(str, enum.Enum):
    """Difficulty level of individual cards."""

    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class CardStatus(str, enum.Enum):
    """Learning status of a card for a specific user (SM-2 algorithm)."""

    NEW = "new"  # Never reviewed
    LEARNING = "learning"  # In initial learning phase
    REVIEW = "review"  # In review phase
    MASTERED = "mastered"  # Successfully mastered


class ReviewRating(int, enum.Enum):
    """SM-2 quality rating (0-5) for card reviews."""

    BLACKOUT = 0  # Complete blackout
    INCORRECT_HARD = 1  # Incorrect, felt difficult
    INCORRECT_EASY = 2  # Incorrect, but easy to recall correct answer
    CORRECT_HARD = 3  # Correct, but difficult
    CORRECT_HESITANT = 4  # Correct, with hesitation
    PERFECT = 5  # Perfect response


class FeedbackCategory(str, enum.Enum):
    """Category of feedback submission."""

    FEATURE_REQUEST = "feature_request"
    BUG_INCORRECT_DATA = "bug_incorrect_data"


class FeedbackStatus(str, enum.Enum):
    """Status of feedback item (admin-managed)."""

    NEW = "new"
    UNDER_REVIEW = "under_review"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class VoteType(str, enum.Enum):
    """Type of vote on feedback."""

    UP = "up"
    DOWN = "down"


class AchievementCategory(str, enum.Enum):
    """Category of achievement."""

    STREAK = "streak"
    LEARNING = "learning"
    SESSION = "session"
    ACCURACY = "accuracy"
    CEFR = "cefr"
    SPECIAL = "special"


class NotificationType(str, enum.Enum):
    """Types of in-app notifications."""

    ACHIEVEMENT_UNLOCKED = "achievement_unlocked"
    DAILY_GOAL_COMPLETE = "daily_goal_complete"
    LEVEL_UP = "level_up"
    STREAK_AT_RISK = "streak_at_risk"
    STREAK_LOST = "streak_lost"
    WELCOME = "welcome"


# ============================================================================
# User Models
# ============================================================================


class User(Base, TimestampMixin):
    """User account model with authentication fields.

    Supports both email/password and Google OAuth authentication.
    """

    __tablename__ = "users"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Authentication
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,  # Nullable for OAuth users
    )

    # Profile
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Status flags
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # OAuth
    google_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
        index=True,
    )

    # Tracking
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp of last successful login",
    )
    last_login_ip: Mapped[str | None] = mapped_column(
        String(45),  # Supports both IPv4 and IPv6
        nullable=True,
        comment="IP address of last successful login",
    )

    # Relationships (lazy="selectin" for async queries)
    settings: Mapped["UserSettings"] = relationship(
        back_populates="user",
        lazy="selectin",
        cascade="all, delete-orphan",
        uselist=False,  # One-to-one relationship
    )
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        back_populates="user",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    deck_progress: Mapped[List["UserDeckProgress"]] = relationship(
        back_populates="user",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    card_statistics: Mapped[List["CardStatistics"]] = relationship(
        back_populates="user",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    reviews: Mapped[List["Review"]] = relationship(
        back_populates="user",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    feedback_items: Mapped[List["Feedback"]] = relationship(
        back_populates="user",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    feedback_votes: Mapped[List["FeedbackVote"]] = relationship(
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    xp: Mapped["UserXP"] = relationship(
        back_populates="user",
        lazy="selectin",
        cascade="all, delete-orphan",
        uselist=False,  # One-to-one relationship
    )
    achievements: Mapped[List["UserAchievement"]] = relationship(
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    xp_transactions: Mapped[List["XPTransaction"]] = relationship(
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    notifications: Mapped[List["Notification"]] = relationship(
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"


class UserSettings(Base, TimestampMixin):
    """User preferences and settings."""

    __tablename__ = "user_settings"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Foreign key
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,  # One-to-one relationship
        nullable=False,
        index=True,
    )

    # Settings
    daily_goal: Mapped[int] = mapped_column(
        Integer,
        default=20,
        nullable=False,
    )
    email_notifications: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Language preference
    preferred_language: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        default=None,
        comment="ISO 639-1 language code (e.g., 'en', 'el')",
    )

    # Relationship
    user: Mapped["User"] = relationship(
        back_populates="settings",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<UserSettings(user_id={self.user_id}, daily_goal={self.daily_goal})>"


class RefreshToken(Base, TimestampMixin):
    """JWT refresh token for session management."""

    __tablename__ = "refresh_tokens"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Foreign key
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Token data
    token: Mapped[str] = mapped_column(
        String(500),
        unique=True,
        nullable=False,
        index=True,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,  # For cleanup queries
    )

    # Relationship
    user: Mapped["User"] = relationship(
        back_populates="refresh_tokens",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<RefreshToken(id={self.id}, user_id={self.user_id})>"


# ============================================================================
# Content Models
# ============================================================================


class Deck(Base, TimestampMixin):
    """Flashcard deck (e.g., Greek A1 Vocabulary)."""

    __tablename__ = "decks"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Deck information
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    level: Mapped[DeckLevel] = mapped_column(
        nullable=False,
        index=True,
    )

    # Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    # Relationships
    cards: Mapped[List["Card"]] = relationship(
        back_populates="deck",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    user_progress: Mapped[List["UserDeckProgress"]] = relationship(
        back_populates="deck",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Deck(id={self.id}, name={self.name}, level={self.level})>"


class Card(Base, TimestampMixin):
    """Individual flashcard with Greek/English content."""

    __tablename__ = "cards"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Foreign key
    deck_id: Mapped[UUID] = mapped_column(
        ForeignKey("decks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Card content
    front_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )  # Greek text
    back_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )  # English translation
    example_sentence: Mapped[str | None] = mapped_column(Text, nullable=True)
    pronunciation: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Metadata
    difficulty: Mapped[CardDifficulty] = mapped_column(
        nullable=False,
        default=CardDifficulty.MEDIUM,
        index=True,
    )
    order_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )  # For sequential display within deck

    # Relationships
    deck: Mapped["Deck"] = relationship(
        back_populates="cards",
        lazy="selectin",
    )
    statistics: Mapped[List["CardStatistics"]] = relationship(
        back_populates="card",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    reviews: Mapped[List["Review"]] = relationship(
        back_populates="card",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Card(id={self.id}, front={self.front_text[:20]})>"


# ============================================================================
# Progress Tracking Models
# ============================================================================


class UserDeckProgress(Base, TimestampMixin):
    """Tracks user progress for a specific deck."""

    __tablename__ = "user_deck_progress"
    __table_args__ = (UniqueConstraint("user_id", "deck_id", name="uq_user_deck"),)

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Foreign keys
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    deck_id: Mapped[UUID] = mapped_column(
        ForeignKey("decks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Progress metrics
    cards_studied: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    cards_mastered: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    last_studied_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        back_populates="deck_progress",
        lazy="selectin",
    )
    deck: Mapped["Deck"] = relationship(
        back_populates="user_progress",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<UserDeckProgress(user_id={self.user_id}, deck_id={self.deck_id}, "
            f"studied={self.cards_studied}, mastered={self.cards_mastered})>"
        )


class CardStatistics(Base, TimestampMixin):
    """SM-2 spaced repetition algorithm data for user-card pair."""

    __tablename__ = "card_statistics"
    __table_args__ = (UniqueConstraint("user_id", "card_id", name="uq_user_card"),)

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Foreign keys
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    card_id: Mapped[UUID] = mapped_column(
        ForeignKey("cards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # SM-2 Algorithm fields
    easiness_factor: Mapped[float] = mapped_column(
        Float,
        default=2.5,
        nullable=False,
    )  # SM-2 EF (1.3 to 2.5+)
    interval: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )  # Days until next review
    repetitions: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )  # Successful reviews count

    # Scheduling
    next_review_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,  # Critical for "get due cards" queries
        server_default=func.current_date(),
    )

    # Status
    status: Mapped[CardStatus] = mapped_column(
        nullable=False,
        default=CardStatus.NEW,
        index=True,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        back_populates="card_statistics",
        lazy="selectin",
    )
    card: Mapped["Card"] = relationship(
        back_populates="statistics",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<CardStatistics(user_id={self.user_id}, card_id={self.card_id}, "
            f"status={self.status}, next_review={self.next_review_date})>"
        )


class Review(Base, TimestampMixin):
    """Individual review session record for analytics."""

    __tablename__ = "reviews"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Foreign keys
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    card_id: Mapped[UUID] = mapped_column(
        ForeignKey("cards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Review data
    quality: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )  # 0-5 (SM-2 quality rating)
    time_taken: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )  # Seconds spent on review

    # Timestamp
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,  # For analytics queries
        server_default=func.now(),
    )

    # Relationships
    user: Mapped["User"] = relationship(
        back_populates="reviews",
        lazy="selectin",
    )
    card: Mapped["Card"] = relationship(
        back_populates="reviews",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Review(id={self.id}, user_id={self.user_id}, "
            f"card_id={self.card_id}, quality={self.quality})>"
        )


# ============================================================================
# Feedback Models
# ============================================================================


class Feedback(Base, TimestampMixin):
    """User-submitted feedback or bug report."""

    __tablename__ = "feedback"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Foreign key - author
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Content
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # Classification
    category: Mapped[FeedbackCategory] = mapped_column(
        nullable=False,
        index=True,
    )
    status: Mapped[FeedbackStatus] = mapped_column(
        nullable=False,
        default=FeedbackStatus.NEW,
        index=True,
    )

    # Denormalized vote count for efficient sorting
    vote_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        index=True,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        back_populates="feedback_items",
        lazy="selectin",
    )
    votes: Mapped[List["FeedbackVote"]] = relationship(
        back_populates="feedback",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Feedback(id={self.id}, title={self.title[:30]}, category={self.category})>"


class FeedbackVote(Base, TimestampMixin):
    """Vote on a feedback item (one per user per feedback)."""

    __tablename__ = "feedback_votes"
    __table_args__ = (UniqueConstraint("user_id", "feedback_id", name="uq_user_feedback_vote"),)

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Foreign keys
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    feedback_id: Mapped[UUID] = mapped_column(
        ForeignKey("feedback.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Vote type
    vote_type: Mapped[VoteType] = mapped_column(
        nullable=False,
    )

    # Relationships
    feedback: Mapped["Feedback"] = relationship(
        back_populates="votes",
        lazy="selectin",
    )
    user: Mapped["User"] = relationship(
        lazy="selectin",
        overlaps="feedback_votes",
    )

    def __repr__(self) -> str:
        return f"<FeedbackVote(user_id={self.user_id}, feedback_id={self.feedback_id}, type={self.vote_type})>"


# ============================================================================
# XP & Achievement Models
# ============================================================================


class UserXP(Base, TimestampMixin):
    """User XP and level tracking.

    Stores total XP, current level, and tracks XP history.
    """

    __tablename__ = "user_xp"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Foreign key
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,  # One-to-one relationship
        nullable=False,
        index=True,
    )

    # XP data
    total_xp: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    current_level: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )

    # Track daily first review bonus
    last_daily_bonus_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    # Relationship
    user: Mapped["User"] = relationship(
        back_populates="xp",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<UserXP(user_id={self.user_id}, total_xp={self.total_xp}, level={self.current_level})>"


class XPTransaction(Base, TimestampMixin):
    """Record of XP earned for analytics and debugging.

    Each XP earning event creates a transaction record.
    """

    __tablename__ = "xp_transactions"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Foreign key
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Transaction data
    amount: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )  # e.g., "correct_answer", "daily_goal", "streak_bonus"
    source_id: Mapped[UUID | None] = mapped_column(
        nullable=True,
    )  # Optional reference to review/card/etc

    # Timestamp
    earned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    # Relationship
    user: Mapped["User"] = relationship(
        lazy="selectin",
        overlaps="xp_transactions",
    )

    def __repr__(self) -> str:
        return (
            f"<XPTransaction(user_id={self.user_id}, amount={self.amount}, reason={self.reason})>"
        )


class Achievement(Base, TimestampMixin):
    """Achievement definition (static data).

    Stores achievement metadata. Can be seeded or managed by admin.
    """

    __tablename__ = "achievements"

    # Primary key - human-readable ID
    id: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
    )  # e.g., "streak_3", "learning_100"

    # Achievement info
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    category: Mapped[AchievementCategory] = mapped_column(
        nullable=False,
        index=True,
    )
    icon: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )  # Emoji or icon identifier

    # Requirements
    threshold: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    xp_reward: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    # Display order
    sort_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Achievement(id={self.id}, name={self.name})>"


class UserAchievement(Base, TimestampMixin):
    """User's unlocked achievements.

    Links users to achievements they've earned.
    """

    __tablename__ = "user_achievements"
    __table_args__ = (UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),)

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Foreign keys
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    achievement_id: Mapped[str] = mapped_column(
        ForeignKey("achievements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Unlock data
    unlocked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    notified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )  # Track if user has been notified

    # Relationships
    achievement: Mapped["Achievement"] = relationship(
        lazy="selectin",
    )
    user: Mapped["User"] = relationship(
        lazy="selectin",
        overlaps="achievements",
    )

    def __repr__(self) -> str:
        return f"<UserAchievement(user_id={self.user_id}, achievement_id={self.achievement_id})>"


# ============================================================================
# Notification Models
# ============================================================================


class Notification(Base, TimestampMixin):
    """User notification record.

    Stores in-app notifications for achievements, daily goals, level ups, etc.
    """

    __tablename__ = "notifications"
    __table_args__ = (
        # Composite index for filtering user's unread notifications
        Index("idx_notifications_user_read", "user_id", "read"),
        # Composite index for fetching user's notifications sorted by creation date (newest first)
        Index("idx_notifications_user_created", "user_id", text("created_at DESC")),
        # Index for cleanup queries (delete old notifications)
        Index("idx_notifications_created_at", "created_at"),
    )

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Foreign key
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Notification content
    type: Mapped[NotificationType] = mapped_column(
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    icon: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="info",
    )

    # Navigation
    action_url: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # Extra context data
    extra_data: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )  # Extra data: achievement_id, xp_amount, streak_days, etc.

    # Status
    read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        lazy="selectin",
        overlaps="notifications",
    )

    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, type={self.type}, user_id={self.user_id})>"
