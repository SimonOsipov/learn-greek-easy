"""Database models for Learn Greek Easy application.

This module contains all SQLAlchemy models for the application:
- User management (User, UserSettings, RefreshToken)
- Content (Deck, Card)
- Progress tracking (UserDeckProgress, CardStatistics, Review)
- Feedback (Feedback, FeedbackVote)
- XP and Achievements (UserXP, XPTransaction, Achievement, UserAchievement)
- Notifications (Notification)
- Culture Exam (CultureDeck, CultureQuestion, CultureQuestionStats, CultureAnswerHistory)
- Announcement Campaigns (AnnouncementCampaign)
- Changelog (ChangelogEntry)

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

from pgvector.sqlalchemy import Vector
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
from sqlalchemy.dialects.postgresql import ARRAY
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


class PartOfSpeech(str, enum.Enum):
    """Part of speech classification for vocabulary cards."""

    NOUN = "noun"
    VERB = "verb"
    ADJECTIVE = "adjective"
    ADVERB = "adverb"


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
    CULTURE = "culture"


class NotificationType(str, enum.Enum):
    """Types of in-app notifications."""

    ACHIEVEMENT_UNLOCKED = "achievement_unlocked"
    ADMIN_ANNOUNCEMENT = "admin_announcement"
    DAILY_GOAL_COMPLETE = "daily_goal_complete"
    LEVEL_UP = "level_up"
    STREAK_AT_RISK = "streak_at_risk"
    STREAK_LOST = "streak_lost"
    WELCOME = "welcome"
    FEEDBACK_RESPONSE = "feedback_response"
    FEEDBACK_STATUS_CHANGE = "feedback_status_change"


class MockExamStatus(str, enum.Enum):
    """Status of a mock exam session."""

    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class ChangelogTag(str, enum.Enum):
    """Tag type for changelog entries."""

    NEW_FEATURE = "new_feature"
    BUG_FIX = "bug_fix"
    ANNOUNCEMENT = "announcement"


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
    avatar_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="S3 key for user avatar (e.g., avatars/{user_id}/{uuid}.jpg)",
    )

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

    # Auth0
    auth0_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
        index=True,
        comment="Auth0 user identifier (sub claim)",
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

    # Relationships (lazy="raise" to prevent accidental lazy loading)
    # Use selectinload() explicitly when relationships are needed
    settings: Mapped["UserSettings"] = relationship(
        back_populates="user",
        lazy="raise",
        cascade="all, delete-orphan",
        uselist=False,  # One-to-one relationship
    )
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        back_populates="user",
        lazy="raise",
        cascade="all, delete-orphan",
    )
    deck_progress: Mapped[List["UserDeckProgress"]] = relationship(
        back_populates="user",
        lazy="raise",
        cascade="all, delete-orphan",
    )
    card_statistics: Mapped[List["CardStatistics"]] = relationship(
        back_populates="user",
        lazy="raise",
        cascade="all, delete-orphan",
    )
    reviews: Mapped[List["Review"]] = relationship(
        back_populates="user",
        lazy="raise",
        cascade="all, delete-orphan",
    )
    feedback_items: Mapped[List["Feedback"]] = relationship(
        back_populates="user",
        lazy="raise",
        cascade="all, delete-orphan",
    )
    feedback_votes: Mapped[List["FeedbackVote"]] = relationship(
        lazy="raise",
        cascade="all, delete-orphan",
    )
    xp: Mapped["UserXP"] = relationship(
        back_populates="user",
        lazy="raise",
        cascade="all, delete-orphan",
        uselist=False,  # One-to-one relationship
    )
    achievements: Mapped[List["UserAchievement"]] = relationship(
        lazy="raise",
        cascade="all, delete-orphan",
    )
    xp_transactions: Mapped[List["XPTransaction"]] = relationship(
        lazy="raise",
        cascade="all, delete-orphan",
    )
    notifications: Mapped[List["Notification"]] = relationship(
        lazy="raise",
        cascade="all, delete-orphan",
    )
    mock_exam_sessions: Mapped[List["MockExamSession"]] = relationship(
        lazy="raise",
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

    # Theme preference
    theme: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        default=None,
        comment="User's preferred theme: 'light' or 'dark'",
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
    is_premium: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        index=True,
        comment="Premium decks require a subscription to access",
    )

    # Owner (for user-created decks)
    owner_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="Owner user ID (NULL for system decks, UUID for user-created decks)",
    )

    # Relationships
    owner: Mapped["User | None"] = relationship(
        lazy="selectin",
        foreign_keys=[owner_id],
    )
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
    back_text_en: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )  # English translation
    back_text_ru: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Russian translation",
    )  # Russian translation
    example_sentence: Mapped[str | None] = mapped_column(Text, nullable=True)
    pronunciation: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Structured examples (replaces example_sentence)
    examples: Mapped[list[dict] | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Structured examples: [{greek, english, russian, tense?}, ...]",
    )

    # Classification fields
    part_of_speech: Mapped[PartOfSpeech | None] = mapped_column(
        nullable=True,
        index=True,
        comment="Part of speech: noun, verb, adjective, adverb",
    )
    level: Mapped[DeckLevel | None] = mapped_column(
        nullable=True,
        index=True,
        comment="CEFR level override (A1-C2), defaults to deck level if not set",
    )

    # Grammar data fields (JSONB)
    noun_data: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Noun grammar: gender + 8 case forms",
    )
    verb_data: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Verb grammar: voice + 30 conjugations + 2 imperative",
    )
    adjective_data: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Adjective grammar: 24 declensions + 2 comparison forms",
    )
    adverb_data: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Adverb grammar: comparative + superlative",
    )

    # Search fields
    searchable_forms: Mapped[list[str] | None] = mapped_column(
        ARRAY(String),
        nullable=True,
        comment="All inflected forms for exact matching",
    )
    searchable_forms_normalized: Mapped[list[str] | None] = mapped_column(
        ARRAY(String),
        nullable=True,
        comment="Accent-stripped forms for fuzzy matching",
    )

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

    # Admin response fields
    admin_response: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Admin's public response to the feedback",
    )
    admin_response_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when admin responded",
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


# ============================================================================
# Culture Exam Models
# ============================================================================


class CultureDeck(Base, TimestampMixin):
    """Culture exam deck (e.g., Greek History, Geography, Politics).

    Stores deck name and description in English.
    """

    __tablename__ = "culture_decks"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Deck information (English only - simplified from multilingual JSON)
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Deck name (English)",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Deck description (English, optional)",
    )

    # Classification
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Category: history, geography, politics, culture, etc.",
    )

    # Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )
    is_premium: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        index=True,
        comment="Premium decks require a subscription to access",
    )

    # Display order
    order_index: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Display order within category",
    )

    # Relationships
    questions: Mapped[List["CultureQuestion"]] = relationship(
        back_populates="deck",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<CultureDeck(id={self.id}, category={self.category})>"


class CultureQuestion(Base, TimestampMixin):
    """Culture exam multiple-choice question.

    Stores multilingual question text and answer options.
    """

    __tablename__ = "culture_questions"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Foreign key (nullable for AI-generated questions pending review)
    deck_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("culture_decks.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Question text (multilingual JSON)
    question_text: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        comment="Multilingual question text: {el, en, ru}",
    )

    # Answer options (multilingual JSON)
    option_a: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        comment="Option A: {el, en, ru}",
    )
    option_b: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        comment="Option B: {el, en, ru}",
    )
    option_c: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Option C: {el, en, ru} - optional for 2-option questions",
    )
    option_d: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Option D: {el, en, ru} - optional for 2-3 option questions",
    )

    # Correct answer (1=A, 2=B, 3=C, 4=D)
    correct_option: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Correct option: 1=A, 2=B, 3=C, 4=D",
    )

    # Optional image reference
    image_key: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="S3 key for question image (optional)",
    )

    # Display order
    order_index: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Display order within deck",
    )

    # Vector embedding for semantic similarity search
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(1024),
        nullable=True,
        comment="Voyage AI voyage-3 embedding (1024 dimensions) for semantic similarity",
    )
    embedding_model: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Embedding model used (e.g., 'voyage-3')",
    )
    embedding_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when embedding was last generated/updated",
    )

    # Pending review status for AI-generated questions
    is_pending_review: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        index=True,
        comment="True for AI-generated questions awaiting admin review",
    )

    # Source article URL for duplicate prevention (unique constraint for AI deduplication)
    source_article_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        unique=True,
        index=True,
        comment="URL of the source article used to generate this question",
    )

    # Source news article URL for displaying link during review
    # NOTE: Different from source_article_url which is unique and used for AI deduplication.
    # This field stores the news article URL for cards created from news items.
    original_article_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        index=False,  # Index created in migration with partial condition
        comment="URL of source news article for cards created from news items",
    )

    # Relationships
    # Note: lazy="raise" prevents N+1 queries by forcing explicit loading.
    # Use selectinload() or joinedload() when you actually need these relationships.
    deck: Mapped["CultureDeck | None"] = relationship(
        back_populates="questions",
        lazy="raise",
    )
    statistics: Mapped[List["CultureQuestionStats"]] = relationship(
        back_populates="question",
        lazy="raise",
        cascade="all, delete-orphan",
    )
    answer_history: Mapped[List["CultureAnswerHistory"]] = relationship(
        back_populates="question",
        lazy="raise",
        cascade="all, delete-orphan",
    )

    @property
    def option_count(self) -> int:
        """Count of available options (2, 3, or 4)."""
        count = 2  # option_a and option_b always present
        if self.option_c is not None:
            count += 1
        if self.option_d is not None:
            count += 1
        return count

    def __repr__(self) -> str:
        return f"<CultureQuestion(id={self.id}, deck_id={self.deck_id})>"


class CultureQuestionStats(Base, TimestampMixin):
    """SM-2 spaced repetition statistics for culture questions.

    Tracks user progress on individual culture questions.
    """

    __tablename__ = "culture_question_stats"
    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_user_culture_question"),
        Index(
            "ix_culture_question_stats_user_due_questions",
            "user_id",
            "next_review_date",
            "status",
        ),
    )

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
    question_id: Mapped[UUID] = mapped_column(
        ForeignKey("culture_questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # SM-2 Algorithm fields
    easiness_factor: Mapped[float] = mapped_column(
        Float,
        default=2.5,
        nullable=False,
    )
    interval: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    repetitions: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    # Scheduling
    next_review_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
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
        lazy="selectin",
    )
    question: Mapped["CultureQuestion"] = relationship(
        back_populates="statistics",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<CultureQuestionStats(user_id={self.user_id}, "
            f"question_id={self.question_id}, status={self.status})>"
        )


class CultureAnswerHistory(Base, TimestampMixin):
    """History of culture question answers for analytics and achievements.

    Tracks each answer with language used, enabling:
    - Language diversity achievements (answer in all 3 languages)
    - Consecutive streak tracking per category
    - Analytics on language preferences
    """

    __tablename__ = "culture_answer_history"

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
    question_id: Mapped[UUID] = mapped_column(
        ForeignKey("culture_questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Answer details
    language: Mapped[str] = mapped_column(
        String(2),
        nullable=False,
        index=True,
        comment="Language used: el, en, ru",
    )
    is_correct: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        index=True,
    )
    selected_option: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Selected option: 1=A, 2=B, 3=C, 4=D",
    )
    time_taken_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Time taken to answer in seconds",
    )

    # Denormalized for efficient queries
    deck_category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Deck category for streak queries",
    )

    # Relationships
    user: Mapped["User"] = relationship(
        lazy="selectin",
    )
    question: Mapped["CultureQuestion"] = relationship(
        back_populates="answer_history",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<CultureAnswerHistory(user_id={self.user_id}, "
            f"question_id={self.question_id}, correct={self.is_correct})>"
        )


# ============================================================================
# Mock Exam Models
# ============================================================================


class MockExamSession(Base, TimestampMixin):
    """Mock exam session tracking."""

    __tablename__ = "mock_exam_sessions"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    score: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    total_questions: Mapped[int] = mapped_column(
        Integer,
        default=25,
        nullable=False,
    )
    passed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    time_taken_seconds: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    status: Mapped[MockExamStatus] = mapped_column(
        nullable=False,
        default=MockExamStatus.ACTIVE,
        index=True,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        lazy="selectin",
        overlaps="mock_exam_sessions",
    )
    answers: Mapped[List["MockExamAnswer"]] = relationship(
        back_populates="session",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<MockExamSession(id={self.id}, user_id={self.user_id}, status={self.status}, score={self.score}/{self.total_questions})>"


class MockExamAnswer(Base, TimestampMixin):
    """Individual answer in a mock exam session."""

    __tablename__ = "mock_exam_answers"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )
    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("mock_exam_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[UUID] = mapped_column(
        ForeignKey("culture_questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    selected_option: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    is_correct: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        index=True,
    )
    time_taken_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    answered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    session: Mapped["MockExamSession"] = relationship(
        back_populates="answers",
        lazy="selectin",
    )
    question: Mapped["CultureQuestion"] = relationship(lazy="selectin")

    def __repr__(self) -> str:
        return f"<MockExamAnswer(id={self.id}, session_id={self.session_id}, question_id={self.question_id}, correct={self.is_correct})>"


# ============================================================================
# News Feed Models
# ============================================================================


class NewsItem(Base, TimestampMixin):
    """News item for the Greek news feed.

    Stores bilingual news articles (Greek/English) with image references.
    Articles are displayed in the news feed, sorted by publication date.
    """

    __tablename__ = "news_items"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Greek content
    title_el: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Article title in Greek",
    )
    description_el: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Article description in Greek (max 1000 chars enforced at app level)",
    )

    # English content
    title_en: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Article title in English",
    )
    description_en: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Article description in English (max 1000 chars enforced at app level)",
    )

    # Russian content
    title_ru: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Article title in Russian",
    )
    description_ru: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Article description in Russian (max 1000 chars enforced at app level)",
    )

    # Media
    image_s3_key: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="S3 key for news item image (e.g., news/{uuid}.jpg)",
    )

    # Publication metadata
    publication_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Date the article was published",
    )
    original_article_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        unique=True,
        index=True,
        comment="URL of the original source article",
    )

    def __repr__(self) -> str:
        return f"<NewsItem(id={self.id}, title_en={self.title_en[:30] if self.title_en else ''}, publication_date={self.publication_date})>"


# ============================================================================
# Announcement Campaign Models
# ============================================================================


class AnnouncementCampaign(Base, TimestampMixin):
    """Admin announcement campaign for broadcasting messages to users.

    Tracks announcement broadcasts with recipient and read statistics.
    Each campaign creates individual Notification records for each recipient.
    """

    __tablename__ = "announcement_campaigns"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Content
    title: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Announcement title (max 100 chars)",
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Announcement message content",
    )
    link_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Optional URL for users to click",
    )

    # Author
    created_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Admin user who created the announcement",
    )

    # Statistics (denormalized for efficient queries)
    total_recipients: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
        nullable=False,
        comment="Total number of users who received the announcement",
    )
    read_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
        nullable=False,
        comment="Number of users who read the announcement",
    )

    # Relationships
    creator: Mapped["User"] = relationship(
        lazy="selectin",
        foreign_keys=[created_by],
    )

    def __repr__(self) -> str:
        return (
            f"<AnnouncementCampaign(id={self.id}, title={self.title[:30] if self.title else ''})>"
        )


# ============================================================================
# Changelog Models
# ============================================================================


class ChangelogEntry(Base, TimestampMixin):
    """Changelog entry for app updates and announcements.

    Stores multilingual content (EN, EL, RU) for title and content.
    Content supports basic markdown (bold/italic).
    """

    __tablename__ = "changelog_entries"
    __table_args__ = (Index("ix_changelog_entries_created_at_desc", text("created_at DESC")),)

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # English content
    title_en: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Title in English",
    )
    content_en: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Content in English (supports bold/italic markdown)",
    )

    # Greek content
    title_el: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Title in Greek",
    )
    content_el: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Content in Greek (supports bold/italic markdown)",
    )

    # Russian content
    title_ru: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Title in Russian",
    )
    content_ru: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Content in Russian (supports bold/italic markdown)",
    )

    # Tag classification
    tag: Mapped[ChangelogTag] = mapped_column(
        nullable=False,
        index=True,
        comment="Entry type: new_feature, bug_fix, announcement",
    )

    def __repr__(self) -> str:
        return f"<ChangelogEntry(id={self.id}, tag={self.tag}, title_en={self.title_en[:30] if self.title_en else ''})>"
