"""Database models for Greeklish application.

This module contains all SQLAlchemy models for the application:
- User management (User, UserSettings)
- Content (Deck)
- Progress tracking (CardRecordStatistics, CardRecordReview)
- Feedback (Feedback, FeedbackVote)
- Card Error Reports (CardErrorReport)
- XP and Achievements (UserXP, XPTransaction, Achievement, UserAchievement)
- Notifications (Notification)
- Culture Exam (CultureDeck, CultureQuestion, CultureQuestionStats, CultureAnswerHistory)
- Announcement Campaigns (AnnouncementCampaign)
- Changelog (ChangelogEntry)
- Situations (Situation, SituationDescription, DescriptionExercise, DescriptionExerciseItem, SituationPicture, PictureExercise, PictureExerciseItem)
- Listening Dialogs (ListeningDialog, DialogSpeaker, DialogLine, DialogExercise, ExerciseItem)
- Exercise Tracking (Exercise, ExerciseRecord, ExerciseReview, ExerciseSourceType)

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
from sqlalchemy import JSON, Boolean, CheckConstraint, Date, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import (
    Float,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
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


class PartOfSpeech(str, enum.Enum):
    """Part of speech classification for vocabulary cards."""

    NOUN = "noun"
    VERB = "verb"
    ADJECTIVE = "adjective"
    ADVERB = "adverb"
    PHRASE = "phrase"


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


class Visibility(str, enum.Enum):
    """Visibility level for word entries."""

    SHARED = "shared"
    PRIVATE = "private"


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


class CardErrorCardType(str, enum.Enum):
    """Type of card being reported for errors."""

    WORD = "WORD"  # Word flashcard (Card model)
    CULTURE = "CULTURE"  # Culture question (CultureQuestion model)


class CardErrorStatus(str, enum.Enum):
    """Status of a card error report (admin-managed workflow)."""

    PENDING = "PENDING"  # New report, awaiting admin review
    REVIEWED = "REVIEWED"  # Admin has reviewed, no action taken
    FIXED = "FIXED"  # Error was confirmed and fixed
    DISMISSED = "DISMISSED"  # Report was invalid/spam


class CardType(str, enum.Enum):
    """Type of flashcard exercise generated from a word entry."""

    MEANING_EL_TO_EN = "meaning_el_to_en"
    MEANING_EN_TO_EL = "meaning_en_to_el"
    CONJUGATION = "conjugation"
    DECLENSION = "declension"
    CLOZE = "cloze"
    SENTENCE_TRANSLATION = "sentence_translation"
    PLURAL_FORM = "plural_form"
    ARTICLE = "article"


class SubscriptionTier(str, enum.Enum):
    """Subscription tier for user billing."""

    FREE = "free"
    PREMIUM = "premium"


class SubscriptionStatus(str, enum.Enum):
    """Stripe subscription lifecycle status."""

    NONE = "none"
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    INCOMPLETE = "incomplete"
    UNPAID = "unpaid"


class BillingCycle(str, enum.Enum):
    """Billing cycle frequency for subscriptions."""

    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    SEMI_ANNUAL = "semi_annual"
    LIFETIME = "lifetime"


class WebhookProcessingStatus(str, enum.Enum):
    """Processing status for Stripe webhook events."""

    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AudioStatus(str, enum.Enum):
    """Audio generation lifecycle status for word entries and examples."""

    MISSING = "missing"
    GENERATING = "generating"
    READY = "ready"
    FAILED = "failed"


class NewsCountry(str, enum.Enum):
    """Country/region classification for news items."""

    CYPRUS = "cyprus"
    GREECE = "greece"
    WORLD = "world"


class DialogStatus(str, enum.Enum):
    """Status of a listening dialog exercise."""

    DRAFT = "draft"
    AUDIO_READY = "audio_ready"
    EXERCISES_READY = "exercises_ready"


class SituationStatus(str, enum.Enum):
    """Status of a listening situation (auto-computed from children in later stories)."""

    DRAFT = "draft"
    PARTIAL_READY = "partial_ready"
    READY = "ready"


class DescriptionStatus(str, enum.Enum):
    """Status of a situation description."""

    DRAFT = "draft"
    AUDIO_READY = "audio_ready"


class DescriptionSourceType(str, enum.Enum):
    """Source type discriminator for situation descriptions."""

    ORIGINAL = "original"
    NEWS = "news"


class PictureStatus(str, enum.Enum):
    """Status of a situation picture."""

    DRAFT = "draft"
    GENERATED = "generated"


class ExerciseType(str, enum.Enum):
    """Type of exercise within a listening dialog."""

    FILL_GAPS = "fill_gaps"
    SELECT_HEARD = "select_heard"
    TRUE_FALSE = "true_false"
    SELECT_CORRECT_ANSWER = "select_correct_answer"


class ExerciseSourceType(str, enum.Enum):
    """Source type discriminator for the unified Exercise supertable."""

    DESCRIPTION = "description"
    DIALOG = "dialog"
    PICTURE = "picture"


class ExerciseStatus(str, enum.Enum):
    """Approval status of a dialog exercise."""

    DRAFT = "draft"
    APPROVED = "approved"


class ExerciseModality(str, enum.Enum):
    """Modality of an exercise — listening or reading."""

    LISTENING = "listening"
    READING = "reading"


# ============================================================================
# User Models
# ============================================================================


class User(Base, TimestampMixin):
    """User account model.

    Authentication is handled by Supabase Auth via the supabase_id field.
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

    # Supabase Auth
    supabase_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
        index=True,
        comment="Supabase Auth user identifier (sub claim, UUID format)",
    )

    # Subscription & Billing
    subscription_tier: Mapped[SubscriptionTier] = mapped_column(
        nullable=False,
        default=SubscriptionTier.FREE,
        server_default=text("'FREE'"),
        index=True,
        comment="User subscription tier: free, premium, founders",
    )
    subscription_status: Mapped[SubscriptionStatus] = mapped_column(
        nullable=False,
        default=SubscriptionStatus.NONE,
        server_default=text("'NONE'"),
        index=True,
        comment="Stripe subscription lifecycle status",
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
        index=True,
        comment="Stripe customer ID (cus_xxx)",
    )
    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
        index=True,
        comment="Stripe subscription ID (sub_xxx)",
    )
    trial_start_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the user's trial period started",
    )
    trial_end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the user's trial period ends/ended",
    )
    subscription_created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the subscription was first created",
    )
    subscription_resubscribed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the user last resubscribed after cancellation",
    )
    subscription_current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="End of current billing period (from Stripe)",
    )
    subscription_cancel_at_period_end: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        comment="Whether subscription cancels at period end",
    )
    billing_cycle: Mapped[BillingCycle | None] = mapped_column(
        nullable=True,
        comment="Current billing cycle: monthly, quarterly, semi_annual, lifetime",
    )
    grandfathered_price_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Stripe price ID locked in for grandfathered users",
    )
    grandfathered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the user was grandfathered into their price",
    )
    grandfathered_amount: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Grandfathered price amount in EUR cents",
    )

    # Relationships (lazy="raise" to prevent accidental lazy loading)
    # Use selectinload() explicitly when relationships are needed
    settings: Mapped["UserSettings"] = relationship(
        back_populates="user",
        lazy="raise",
        cascade="all, delete-orphan",
        uselist=False,  # One-to-one relationship
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
    card_record_statistics: Mapped[List["CardRecordStatistics"]] = relationship(
        back_populates="user",
        lazy="raise",
        cascade="all, delete-orphan",
    )
    card_record_reviews: Mapped[List["CardRecordReview"]] = relationship(
        back_populates="user",
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
        comment="ISO 639-1 language code (e.g., 'en', 'ru')",
    )

    # Theme preference
    theme: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        default=None,
        comment="User's preferred theme: 'light' or 'dark'",
    )

    # Tour completion
    tour_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        comment="When the user completed the onboarding tour",
    )

    # Relationship
    user: Mapped["User"] = relationship(
        back_populates="settings",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<UserSettings(user_id={self.user_id}, daily_goal={self.daily_goal})>"


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

    # Multilingual name fields
    name_el: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Deck name in Greek",
    )
    name_en: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Deck name in English",
    )
    name_ru: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Deck name in Russian",
    )

    # Multilingual description fields
    description_el: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Deck description in Greek",
    )
    description_en: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Deck description in English",
    )
    description_ru: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Deck description in Russian",
    )
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

    # Cover image
    cover_image_s3_key: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="S3 object key for deck cover image",
    )

    # Relationships
    owner: Mapped["User | None"] = relationship(
        lazy="selectin",
        foreign_keys=[owner_id],
    )
    word_entries: Mapped[List["WordEntry"]] = relationship(
        secondary="deck_word_entries",
        lazy="selectin",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return f"<Deck(id={self.id}, name_en={self.name_en}, level={self.level})>"


class WordEntry(Base, TimestampMixin):
    """Linguistic source of truth for vocabulary data.

    Stores lexicographic information (lemma, part of speech, translations,
    grammar data) separate from flashcard presentation. Enables dictionary
    lookup, grammar drills, and multi-context vocabulary features.
    """

    __tablename__ = "word_entries"
    __table_args__ = (
        UniqueConstraint(
            "owner_id",
            "lemma",
            "part_of_speech",
            "gender",
            name="uq_word_entry_owner_lemma_pos_gender",
            postgresql_nulls_not_distinct=True,
        ),
        Index("ix_word_entries_owner_id", "owner_id"),
        Index("ix_word_entries_visibility", "visibility"),
        Index("ix_word_entries_is_active", "is_active"),
        Index("ix_word_entries_lemma", "lemma"),
    )

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Owner (nullable for admin/system-created entries)
    owner_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="User who created this entry (NULL for admin/system-created)",
    )

    # Visibility
    visibility: Mapped[Visibility] = mapped_column(
        SAEnum(
            Visibility,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="visibility",
            create_type=False,
        ),
        nullable=False,
        server_default=text("'shared'"),
        comment="shared = visible to all users; private = only visible to owner",
    )

    # Core lexicographic fields
    lemma: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Dictionary form (base form) of the word in Greek",
    )
    part_of_speech: Mapped[PartOfSpeech] = mapped_column(
        nullable=False,
        comment="Part of speech classification",
    )
    gender: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        default=None,
        comment="Grammatical gender: masculine, feminine, neuter (NULL for non-nouns / legacy)",
    )

    # Translations
    translation_en: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="English translation(s), comma-separated for multiple meanings",
    )
    translation_en_plural: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="English plural translation(s), comma-separated for multiple meanings",
    )
    translation_ru: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Russian translation(s), comma-separated for multiple meanings",
    )
    translation_ru_plural: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Russian plural translation(s), comma-separated for multiple meanings",
    )

    # Pronunciation
    pronunciation: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="IPA or simplified pronunciation guide",
    )

    # Structured grammar data (JSONB for flexibility)
    grammar_data: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        server_default=text("'{}'::jsonb"),
        comment="Part-of-speech specific grammar data",
    )

    # Usage examples (JSONB array)
    examples: Mapped[list[dict] | None] = mapped_column(
        JSON,
        nullable=True,
        server_default=text("'[]'::jsonb"),
        comment="Usage examples: [{id?, greek, english, russian?, context?}, ...]",
    )

    # Audio reference
    audio_key: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="S3 key for audio pronunciation file",
    )

    # Audio generation status
    audio_status: Mapped[AudioStatus] = mapped_column(
        nullable=False,
        default=AudioStatus.MISSING,
        server_default=text("'MISSING'"),
        index=True,
        comment="Audio generation lifecycle status: missing, generating, ready, failed",
    )
    audio_generating_since: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when current audio generation started (for stale detection)",
    )

    # Status flag
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
        comment="Soft delete flag - inactive entries are hidden from users",
    )

    # Relationships
    owner: Mapped["User | None"] = relationship(
        lazy="selectin",
        foreign_keys=[owner_id],
    )
    decks: Mapped[List["Deck"]] = relationship(
        secondary="deck_word_entries",
        lazy="selectin",
        viewonly=True,
    )
    card_records: Mapped[List["CardRecord"]] = relationship(
        back_populates="word_entry", lazy="selectin", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<WordEntry(id={self.id}, lemma={self.lemma}, pos={self.part_of_speech})>"


class DeckWordEntry(Base, TimestampMixin):
    """Junction table for many-to-many Deck <-> WordEntry relationship."""

    __tablename__ = "deck_word_entries"
    __table_args__ = (Index("ix_deck_word_entries_word_entry_id", "word_entry_id"),)

    deck_id: Mapped[UUID] = mapped_column(
        ForeignKey("decks.id", ondelete="CASCADE"),
        primary_key=True,
    )
    word_entry_id: Mapped[UUID] = mapped_column(
        ForeignKey("word_entries.id", ondelete="CASCADE"),
        primary_key=True,
    )


# ============================================================================
# Card Record Models (V2 Card System)
# ============================================================================


class CardRecord(Base, TimestampMixin):
    """Individual flashcard generated from a word entry.

    Each word entry can produce multiple card records of different types
    (meaning, conjugation, declension, cloze, sentence translation).
    """

    __tablename__ = "card_records"
    __table_args__ = (
        UniqueConstraint(
            "deck_id",
            "word_entry_id",
            "card_type",
            "variant_key",
            name="uq_card_record_deck_entry_type_variant",
        ),
        Index("ix_card_records_word_entry_id", "word_entry_id"),
        Index("ix_card_records_deck_id", "deck_id"),
        Index("ix_card_records_card_type", "card_type"),
        Index("ix_card_records_is_active", "is_active"),
        Index("ix_card_records_tier", "tier"),
        Index("ix_card_records_variant_key", "variant_key"),
        Index("ix_card_records_deck_type", "deck_id", "card_type"),
        Index("ix_card_records_deck_active", "deck_id", "is_active"),
    )

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Foreign keys
    word_entry_id: Mapped[UUID] = mapped_column(
        ForeignKey("word_entries.id", ondelete="CASCADE"),
        nullable=False,
    )
    deck_id: Mapped[UUID] = mapped_column(
        ForeignKey("decks.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Card type and tier
    card_type: Mapped[CardType] = mapped_column(
        SAEnum(
            CardType,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="cardtype",
            create_type=False,
        ),
        nullable=False,
    )
    tier: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    variant_key: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    # Content (JSONB)
    front_content: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )
    back_content: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )

    # Status flag
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
    )

    # Relationships
    word_entry: Mapped["WordEntry"] = relationship(back_populates="card_records", lazy="selectin")
    deck: Mapped["Deck"] = relationship(
        lazy="selectin",
        foreign_keys=[deck_id],
    )

    def __repr__(self) -> str:
        return f"<CardRecord(id={self.id}, type={self.card_type}, variant_key={self.variant_key})>"


# ============================================================================
# Progress Tracking Models
# ============================================================================


class CardRecordStatistics(Base, TimestampMixin):
    """SM-2 spaced repetition data for user-card_record pair (V2 card system)."""

    __tablename__ = "card_record_statistics"
    __table_args__ = (
        UniqueConstraint("user_id", "card_record_id", name="uq_user_card_record"),
        Index("ix_crs_user_next_review", "user_id", "next_review_date"),
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
    )
    card_record_id: Mapped[UUID] = mapped_column(
        ForeignKey("card_records.id", ondelete="CASCADE"),
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
        server_default=func.current_date(),
    )

    # Status
    status: Mapped[CardStatus] = mapped_column(
        nullable=False,
        default=CardStatus.NEW,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        back_populates="card_record_statistics",
        lazy="raise",
    )
    card_record: Mapped["CardRecord"] = relationship(
        lazy="raise",
    )

    def __repr__(self) -> str:
        return (
            f"<CardRecordStatistics(user_id={self.user_id}, "
            f"card_record_id={self.card_record_id}, "
            f"status={self.status}, next_review={self.next_review_date})>"
        )


class CardRecordReview(Base, TimestampMixin):
    """Individual review session record for V2 card system analytics."""

    __tablename__ = "card_record_reviews"
    __table_args__ = (
        CheckConstraint(
            "quality >= 0 AND quality <= 5",
            name="ck_crr_quality_range",
        ),
        CheckConstraint(
            "time_taken >= 0",
            name="ck_crr_time_taken_non_negative",
        ),
        Index("ix_crr_user_reviewed_at", "user_id", "reviewed_at"),
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
    )
    card_record_id: Mapped[UUID] = mapped_column(
        ForeignKey("card_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Review data
    quality: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    time_taken: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # Timestamp
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    user: Mapped["User"] = relationship(
        back_populates="card_record_reviews",
        lazy="raise",
    )
    card_record: Mapped["CardRecord"] = relationship(
        lazy="raise",
    )

    def __repr__(self) -> str:
        return (
            f"<CardRecordReview(id={self.id}, user_id={self.user_id}, "
            f"card_record_id={self.card_record_id}, quality={self.quality})>"
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
# Card Error Report Models
# ============================================================================


class CardErrorReport(Base, TimestampMixin):
    """User-submitted error report for vocabulary cards or culture questions.

    Allows users to report errors (typos, incorrect translations, wrong answers)
    on flashcards or culture questions. Admins can review and resolve reports.
    """

    __tablename__ = "card_error_reports"
    __table_args__ = (
        Index("ix_card_error_reports_card_type_status", "card_type", "status"),
        Index("ix_card_error_reports_created_at", "created_at"),
        Index("ix_card_error_reports_status_created_at", "status", text("created_at DESC")),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    card_type: Mapped[CardErrorCardType] = mapped_column(
        nullable=False,
        comment="Type of card: word (Card) or culture (CultureQuestion)",
    )
    card_id: Mapped[UUID] = mapped_column(
        nullable=False,
        index=True,
        comment="UUID of the Card or CultureQuestion being reported",
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="User's description of the error (max 1000 chars enforced at API level)",
    )

    status: Mapped[CardErrorStatus] = mapped_column(
        nullable=False,
        server_default=text("'PENDING'"),
        index=True,
        comment="Report status: pending, reviewed, fixed, dismissed",
    )

    admin_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Internal admin notes about the resolution",
    )
    resolved_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Admin user who resolved the report",
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when report was resolved",
    )

    user: Mapped["User"] = relationship(
        lazy="selectin",
        foreign_keys=[user_id],
    )
    resolver: Mapped["User | None"] = relationship(
        lazy="selectin",
        foreign_keys=[resolved_by],
    )

    def __repr__(self) -> str:
        return (
            f"<CardErrorReport(id={self.id}, card_type={self.card_type}, "
            f"card_id={self.card_id}, status={self.status})>"
        )


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

    # Multilingual name fields
    name_el: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Deck name in Greek",
    )
    name_en: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Deck name in English",
    )
    name_ru: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Deck name in Russian",
    )

    # Multilingual description fields
    description_el: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Deck description in Greek",
    )
    description_en: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Deck description in English",
    )
    description_ru: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Deck description in Russian",
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

    # Cover image
    cover_image_s3_key: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="S3 key for deck cover image",
    )

    # Relationships
    questions: Mapped[List["CultureQuestion"]] = relationship(
        back_populates="deck",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<CultureDeck(id={self.id}, name_en={self.name_en[:30] if self.name_en else ''}, category={self.category})>"


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

    # Audio file reference
    audio_s3_key: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="S3 key for TTS-generated audio file (e.g., culture/audio/{uuid}.mp3)",
    )

    # A2-level audio file reference
    audio_a2_s3_key: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="S3 key for A2-level TTS-generated audio file (e.g., culture/audio/a2/{uuid}.mp3)",
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
    """Thin join record linking a news article URL to its Situation.

    Content, audio, and media now live on Situation and its children.
    Retains publication_date and original_article_url for provenance.
    """

    __tablename__ = "news_items"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
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

    # Link to Situation (required)
    situation_id: Mapped[UUID] = mapped_column(
        ForeignKey("situations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    situation: Mapped["Situation"] = relationship(lazy="raise")

    def __repr__(self) -> str:
        return f"<NewsItem(id={self.id}, situation_id={self.situation_id}, publication_date={self.publication_date})>"


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

    Stores multilingual content (EN, RU) for title and content.
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


# ============================================================================
# Stripe Webhook Models
# ============================================================================


class WebhookEvent(Base, TimestampMixin):
    """Stripe webhook event for idempotency and audit logging.

    Ensures duplicate webhook deliveries are detected and skipped.
    Tracks processing status for debugging and monitoring.
    """

    __tablename__ = "webhook_events"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.uuid_generate_v4(),
    )

    # Stripe event identifier (globally unique from Stripe)
    event_id: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
        comment="Stripe event ID (evt_xxx) - unique for idempotency",
    )

    # Event classification
    event_type: Mapped[str] = mapped_column(
        String(255),
        index=True,
        nullable=False,
        comment="Stripe event type (e.g., customer.subscription.updated)",
    )

    # Raw webhook payload for audit/debugging
    raw_payload: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        comment="Complete Stripe webhook event payload",
    )

    # Processing tracking
    processing_status: Mapped[WebhookProcessingStatus] = mapped_column(
        nullable=False,
        default=WebhookProcessingStatus.PROCESSING,
        server_default=text("'PROCESSING'"),
        index=True,
        comment="Webhook processing status: processing, completed, failed",
    )

    # Error tracking
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Error message if processing failed",
    )

    # Processing completion timestamp
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When webhook processing completed (success or failure)",
    )

    def __repr__(self) -> str:
        return (
            f"<WebhookEvent(id={self.id}, event_id={self.event_id}, "
            f"type={self.event_type}, status={self.processing_status})>"
        )


# ============================================================================
# Reference Data (separate PostgreSQL schema)
# ============================================================================


class GreekLexicon(Base):
    """Greek morphological dictionary entry from eellak/gsoc2019-greek-morpho.

    Stored in the 'reference' PostgreSQL schema, separate from application tables.
    Contains 902K morphological entries covering 518K distinct surface forms.
    Used for local morphological verification of generated noun data.
    """

    __tablename__ = "greek_lexicon"
    __table_args__ = {"schema": "reference"}

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Auto-incrementing primary key",
    )
    form: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True,
        comment="Surface form (inflected word as it appears in text)",
    )
    lemma: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True,
        comment="Dictionary form (lemma/base form)",
    )
    pos: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Part of speech tag (e.g., NOUN, VERB, ADJ)",
    )
    gender: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Grammatical gender (Masc, Fem, Neut)",
    )
    ptosi: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Grammatical case (Nom, Gen, Acc, Voc)",
    )
    number: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Grammatical number (Sing, Plur)",
    )
    person: Mapped[int | None] = mapped_column(
        SmallInteger,
        nullable=True,
        comment="Grammatical person (1, 2, 3) for verb forms",
    )
    tense: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Verb tense (Past, Pres, Fut)",
    )
    aspect: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Verb aspect (Imp, Perf)",
    )
    mood: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Verb mood (Ind, Sub, Imp)",
    )
    verbform: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Verb form type (Fin, Inf, Part, Conv, Ger)",
    )
    voice: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Verb voice (Act, Pass)",
    )
    degree: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Adjective degree (Pos, Comp, Sup)",
    )

    def __repr__(self) -> str:
        return (
            f"<GreekLexicon(id={self.id}, form={self.form!r}, "
            f"lemma={self.lemma!r}, pos={self.pos!r})>"
        )


# ---------------------------------------------------------------------------
# Listening Dialog Models
# ---------------------------------------------------------------------------


class Situation(Base, TimestampMixin):
    """Parent entity for listening content.

    Groups one or more dialogs under a shared scenario context.
    Owns a description and picture as children.
    Status is auto-computed from children state in later stories;
    SIT-01 just creates the enum with default 'draft'.
    """

    __tablename__ = "situations"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuid_generate_v4())
    scenario_el: Mapped[str] = mapped_column(Text, nullable=False)
    scenario_en: Mapped[str] = mapped_column(Text, nullable=False)
    scenario_ru: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[SituationStatus] = mapped_column(
        SAEnum(
            SituationStatus,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="situationstatus",
            create_type=False,
        ),
        nullable=False,
        server_default=text("'draft'"),
    )
    # One-to-one with ListeningDialog (uselist=False).
    dialog: Mapped["ListeningDialog | None"] = relationship(
        back_populates="situation", lazy="raise", uselist=False, cascade="all, delete-orphan"
    )
    # One-to-one with SituationDescription (uselist=False).
    description: Mapped["SituationDescription | None"] = relationship(
        back_populates="situation",
        lazy="raise",
        uselist=False,
        cascade="all, delete-orphan",
    )
    # One-to-one with SituationPicture (uselist=False).
    picture: Mapped["SituationPicture | None"] = relationship(
        back_populates="situation",
        lazy="raise",
        uselist=False,
        cascade="all, delete-orphan",
    )
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_image_s3_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_title_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_title_el: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_title_ru: Mapped[str | None] = mapped_column(Text, nullable=True)
    scenario_el_a2: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Situation id={self.id} status={self.status}>"


class SituationDescription(Base, TimestampMixin):
    """Narrative description of a situation — single-narrator text."""

    __tablename__ = "situation_descriptions"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuid_generate_v4())
    situation_id: Mapped[UUID] = mapped_column(
        ForeignKey("situations.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    text_el: Mapped[str] = mapped_column(Text, nullable=False)
    text_el_a2: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_type: Mapped[DescriptionSourceType] = mapped_column(
        SAEnum(
            DescriptionSourceType,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="descriptionsourcetype",
        ),
        nullable=False,
        server_default=text("'original'"),
    )
    audio_s3_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_a2_s3_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    audio_a2_duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    word_timestamps: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=None)
    word_timestamps_a2: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=None)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    country: Mapped[NewsCountry | None] = mapped_column(
        SAEnum(
            NewsCountry,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="newscountry",
            create_type=False,
        ),
        nullable=True,
    )
    status: Mapped[DescriptionStatus] = mapped_column(
        SAEnum(
            DescriptionStatus,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="descriptionstatus",
        ),
        nullable=False,
        server_default=text("'draft'"),
    )

    # Relationships
    situation: Mapped["Situation"] = relationship(back_populates="description", lazy="raise")
    exercises: Mapped[List["DescriptionExercise"]] = relationship(
        back_populates="description", lazy="raise", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<SituationDescription id={self.id} situation_id={self.situation_id} status={self.status}>"


class DescriptionExercise(Base, TimestampMixin):
    """Exercise associated with a situation description."""

    __tablename__ = "description_exercises"
    __table_args__ = (
        UniqueConstraint(
            "description_id",
            "exercise_type",
            "audio_level",
            "modality",
            name="uq_desc_exercise_type_level_modality",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuid_generate_v4())
    description_id: Mapped[UUID] = mapped_column(
        ForeignKey("situation_descriptions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    exercise_type: Mapped[ExerciseType] = mapped_column(
        SAEnum(
            ExerciseType,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="exercisetype",
            create_type=False,
        ),
        nullable=False,
    )
    audio_level: Mapped[DeckLevel] = mapped_column(
        SAEnum(
            DeckLevel,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="decklevel",
            create_type=False,
        ),
        nullable=False,
    )
    status: Mapped[ExerciseStatus] = mapped_column(
        SAEnum(
            ExerciseStatus,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="exercisestatus",
            create_type=False,
        ),
        nullable=False,
        server_default=text("'draft'"),
    )
    modality: Mapped[ExerciseModality] = mapped_column(
        SAEnum(
            ExerciseModality,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="exercisemodality",
            create_type=False,
        ),
        nullable=False,
    )

    # Relationships
    description: Mapped["SituationDescription"] = relationship(
        back_populates="exercises", lazy="raise"
    )
    items: Mapped[List["DescriptionExerciseItem"]] = relationship(
        back_populates="exercise",
        lazy="raise",
        cascade="all, delete-orphan",
        order_by="DescriptionExerciseItem.item_index",
    )
    exercise: Mapped["Exercise | None"] = relationship(
        back_populates="description_exercise", uselist=False, lazy="raise"
    )

    def __repr__(self) -> str:
        return (
            f"<DescriptionExercise id={self.id} type={self.exercise_type} level={self.audio_level}>"
        )


class DescriptionExerciseItem(Base):
    """Individual item within a description exercise. NO TimestampMixin — only created_at."""

    __tablename__ = "description_exercise_items"
    __table_args__ = (
        UniqueConstraint(
            "description_exercise_id", "item_index", name="uq_desc_exercise_item_index"
        ),
        CheckConstraint("item_index >= 0", name="ck_desc_exercise_item_index_non_negative"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuid_generate_v4())
    description_exercise_id: Mapped[UUID] = mapped_column(
        ForeignKey("description_exercises.id", ondelete="CASCADE"), index=True, nullable=False
    )
    item_index: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    exercise: Mapped["DescriptionExercise"] = relationship(back_populates="items", lazy="raise")

    def __repr__(self) -> str:
        return f"<DescriptionExerciseItem id={self.id} index={self.item_index}>"


class SituationPicture(Base, TimestampMixin):
    """Picture associated with a situation — image prompt + generated image."""

    __tablename__ = "situation_pictures"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuid_generate_v4())
    situation_id: Mapped[UUID] = mapped_column(
        ForeignKey("situations.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    image_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    image_s3_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[PictureStatus] = mapped_column(
        SAEnum(
            PictureStatus,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="picturestatus",
        ),
        nullable=False,
        server_default=text("'draft'"),
    )

    # Relationships
    situation: Mapped["Situation"] = relationship(back_populates="picture", lazy="raise")
    exercises: Mapped[List["PictureExercise"]] = relationship(
        back_populates="picture", lazy="raise", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<SituationPicture id={self.id} situation_id={self.situation_id} status={self.status}>"
        )


class PictureExercise(Base, TimestampMixin):
    """Exercise associated with a situation picture."""

    __tablename__ = "picture_exercises"
    __table_args__ = (UniqueConstraint("picture_id", "exercise_type", name="uq_pic_exercise_type"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuid_generate_v4())
    picture_id: Mapped[UUID] = mapped_column(
        ForeignKey("situation_pictures.id", ondelete="CASCADE"), index=True, nullable=False
    )
    exercise_type: Mapped[ExerciseType] = mapped_column(
        SAEnum(
            ExerciseType,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="exercisetype",
            create_type=False,
        ),
        nullable=False,
    )
    status: Mapped[ExerciseStatus] = mapped_column(
        SAEnum(
            ExerciseStatus,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="exercisestatus",
            create_type=False,
        ),
        nullable=False,
        server_default=text("'draft'"),
    )

    # Relationships
    picture: Mapped["SituationPicture"] = relationship(back_populates="exercises", lazy="raise")
    items: Mapped[List["PictureExerciseItem"]] = relationship(
        back_populates="exercise",
        lazy="raise",
        cascade="all, delete-orphan",
        order_by="PictureExerciseItem.item_index",
    )
    exercise: Mapped["Exercise | None"] = relationship(
        back_populates="picture_exercise", uselist=False, lazy="raise"
    )

    def __repr__(self) -> str:
        return f"<PictureExercise id={self.id} type={self.exercise_type}>"


class PictureExerciseItem(Base):
    """Individual item within a picture exercise. NO TimestampMixin — only created_at."""

    __tablename__ = "picture_exercise_items"
    __table_args__ = (
        UniqueConstraint("picture_exercise_id", "item_index", name="uq_pic_exercise_item_index"),
        CheckConstraint("item_index >= 0", name="ck_pic_exercise_item_index_non_negative"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuid_generate_v4())
    picture_exercise_id: Mapped[UUID] = mapped_column(
        ForeignKey("picture_exercises.id", ondelete="CASCADE"), index=True, nullable=False
    )
    item_index: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    exercise: Mapped["PictureExercise"] = relationship(back_populates="items", lazy="raise")

    def __repr__(self) -> str:
        return f"<PictureExerciseItem id={self.id} index={self.item_index}>"


class Exercise(Base, TimestampMixin):
    """Unified exercise record linking to exactly one source exercise."""

    __tablename__ = "exercises"
    __table_args__ = (
        CheckConstraint(
            "(description_exercise_id IS NOT NULL)::int"
            " + (dialog_exercise_id IS NOT NULL)::int"
            " + (picture_exercise_id IS NOT NULL)::int = 1",
            name="ck_exercises_exactly_one_source",
        ),
        Index(
            "uq_exercises_description_exercise_id",
            "description_exercise_id",
            unique=True,
            postgresql_where=text("description_exercise_id IS NOT NULL"),
        ),
        Index(
            "uq_exercises_dialog_exercise_id",
            "dialog_exercise_id",
            unique=True,
            postgresql_where=text("dialog_exercise_id IS NOT NULL"),
        ),
        Index(
            "uq_exercises_picture_exercise_id",
            "picture_exercise_id",
            unique=True,
            postgresql_where=text("picture_exercise_id IS NOT NULL"),
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuid_generate_v4())
    source_type: Mapped["ExerciseSourceType"] = mapped_column(
        SAEnum(
            ExerciseSourceType,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="exercisesourcetype",
            create_type=False,
        ),
        nullable=False,
        index=True,
    )
    description_exercise_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("description_exercises.id", ondelete="CASCADE"), nullable=True, index=True
    )
    dialog_exercise_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("dialog_exercises.id", ondelete="CASCADE"), nullable=True, index=True
    )
    picture_exercise_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("picture_exercises.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # Relationships
    description_exercise: Mapped["DescriptionExercise | None"] = relationship(
        back_populates="exercise", lazy="raise"
    )
    dialog_exercise: Mapped["DialogExercise | None"] = relationship(
        back_populates="exercise", lazy="raise"
    )
    picture_exercise: Mapped["PictureExercise | None"] = relationship(
        back_populates="exercise", lazy="raise"
    )
    records: Mapped[List["ExerciseRecord"]] = relationship(
        back_populates="exercise", lazy="raise", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Exercise id={self.id} source_type={self.source_type}>"


class ExerciseRecord(Base, TimestampMixin):
    """SM-2 spaced repetition state for a user-exercise pair."""

    __tablename__ = "exercise_records"
    __table_args__ = (
        UniqueConstraint("user_id", "exercise_id", name="uq_exercise_record_user_exercise"),
        Index("ix_exercise_records_user_next_review", "user_id", "next_review_date"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuid_generate_v4())
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    exercise_id: Mapped[UUID] = mapped_column(
        ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True
    )
    easiness_factor: Mapped[float] = mapped_column(Float, nullable=False, default=2.5)
    interval: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    repetitions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_review_date: Mapped[date] = mapped_column(
        Date, nullable=False, server_default=func.current_date()
    )
    status: Mapped[CardStatus] = mapped_column(nullable=False, default=CardStatus.NEW)

    # Relationships
    user: Mapped["User"] = relationship(lazy="raise")
    exercise: Mapped["Exercise"] = relationship(back_populates="records", lazy="raise")
    reviews: Mapped[List["ExerciseReview"]] = relationship(
        back_populates="exercise_record", lazy="raise", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<ExerciseRecord user_id={self.user_id} exercise_id={self.exercise_id}"
            f" status={self.status} next_review={self.next_review_date}>"
        )


class ExerciseReview(Base):
    """Immutable per-review audit log for exercise SM-2. No TimestampMixin."""

    __tablename__ = "exercise_reviews"
    __table_args__ = (
        Index("ix_exercise_reviews_user_reviewed_at", "user_id", "reviewed_at"),
        CheckConstraint("quality >= 0 AND quality <= 5", name="ck_exercise_reviews_quality_range"),
        CheckConstraint("score >= 0", name="ck_exercise_reviews_score_non_negative"),
        CheckConstraint("max_score > 0", name="ck_exercise_reviews_max_score_positive"),
        CheckConstraint("score <= max_score", name="ck_exercise_reviews_score_lte_max"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuid_generate_v4())
    exercise_record_id: Mapped[UUID] = mapped_column(
        ForeignKey("exercise_records.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    quality: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    max_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    easiness_factor_before: Mapped[float] = mapped_column(Float, nullable=False)
    easiness_factor_after: Mapped[float] = mapped_column(Float, nullable=False)
    interval_before: Mapped[int] = mapped_column(Integer, nullable=False)
    interval_after: Mapped[int] = mapped_column(Integer, nullable=False)
    repetitions_before: Mapped[int] = mapped_column(Integer, nullable=False)
    repetitions_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    exercise_record: Mapped["ExerciseRecord"] = relationship(back_populates="reviews", lazy="raise")
    user: Mapped["User"] = relationship(lazy="raise")

    def __repr__(self) -> str:
        return f"<ExerciseReview id={self.id} exercise_record_id={self.exercise_record_id} quality={self.quality}>"


class ListeningDialog(Base, TimestampMixin):
    """Top-level listening dialog entity with audio metadata."""

    __tablename__ = "listening_dialogs"
    __table_args__ = (
        CheckConstraint(
            "num_speakers >= 2 AND num_speakers <= 4", name="ck_listening_dialogs_num_speakers"
        ),
        Index("ix_listening_dialogs_status", "status"),
        Index("ix_listening_dialogs_cefr_level", "cefr_level"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuid_generate_v4())
    scenario_el: Mapped[str] = mapped_column(Text, nullable=False)
    scenario_en: Mapped[str] = mapped_column(Text, nullable=False)
    scenario_ru: Mapped[str] = mapped_column(Text, nullable=False)
    cefr_level: Mapped[DeckLevel] = mapped_column(nullable=False)
    num_speakers: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    status: Mapped[DialogStatus] = mapped_column(
        SAEnum(
            DialogStatus,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="dialog_status",
            create_type=False,
        ),
        nullable=False,
        server_default=text("'draft'"),
    )
    created_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    situation_id: Mapped[UUID] = mapped_column(
        ForeignKey("situations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    audio_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    audio_generated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    audio_file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audio_duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    speakers: Mapped[List["DialogSpeaker"]] = relationship(
        back_populates="dialog", lazy="raise", cascade="all, delete-orphan"
    )
    lines: Mapped[List["DialogLine"]] = relationship(
        back_populates="dialog", lazy="raise", cascade="all, delete-orphan"
    )
    exercises: Mapped[List["DialogExercise"]] = relationship(
        back_populates="dialog", lazy="raise", cascade="all, delete-orphan"
    )
    situation: Mapped["Situation"] = relationship(back_populates="dialog", lazy="raise")

    def __repr__(self) -> str:
        return f"<ListeningDialog id={self.id} cefr_level={self.cefr_level} status={self.status}>"


class DialogSpeaker(Base):
    """A speaker slot within a listening dialog."""

    __tablename__ = "dialog_speakers"
    __table_args__ = (
        UniqueConstraint("dialog_id", "speaker_index", name="uq_dialog_speaker_index"),
        CheckConstraint(
            "speaker_index >= 0 AND speaker_index < 4", name="ck_dialog_speakers_speaker_index"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuid_generate_v4())
    dialog_id: Mapped[UUID] = mapped_column(
        ForeignKey("listening_dialogs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    speaker_index: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    character_name: Mapped[str] = mapped_column(String(100), nullable=False)
    voice_id: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    dialog: Mapped["ListeningDialog"] = relationship(back_populates="speakers", lazy="raise")
    lines: Mapped[List["DialogLine"]] = relationship(
        back_populates="speaker", lazy="raise", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<DialogSpeaker id={self.id} dialog_id={self.dialog_id} index={self.speaker_index}>"


class DialogLine(Base):
    """A single line of dialogue in a listening dialog exercise."""

    __tablename__ = "dialog_lines"
    __table_args__ = (
        UniqueConstraint("dialog_id", "line_index", name="uq_dialog_line_index"),
        Index("ix_dialog_lines_dialog_id", "dialog_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuid_generate_v4())
    dialog_id: Mapped[UUID] = mapped_column(
        ForeignKey("listening_dialogs.id", ondelete="CASCADE"), nullable=False
    )
    speaker_id: Mapped[UUID] = mapped_column(
        ForeignKey("dialog_speakers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    line_index: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    start_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    word_timestamps: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    dialog: Mapped["ListeningDialog"] = relationship(back_populates="lines", lazy="raise")
    speaker: Mapped["DialogSpeaker"] = relationship(back_populates="lines", lazy="raise")

    def __repr__(self) -> str:
        return f"<DialogLine id={self.id} dialog_id={self.dialog_id} index={self.line_index}>"


class DialogExercise(Base, TimestampMixin):
    """Exercise associated with a listening dialog."""

    __tablename__ = "dialog_exercises"
    __table_args__ = (
        UniqueConstraint("dialog_id", "exercise_type", name="uq_dialog_exercise_type"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuid_generate_v4())
    dialog_id: Mapped[UUID] = mapped_column(
        ForeignKey("listening_dialogs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exercise_type: Mapped[ExerciseType] = mapped_column(
        SAEnum(
            ExerciseType,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="exercisetype",
            create_type=False,
        ),
        nullable=False,
    )
    status: Mapped[ExerciseStatus] = mapped_column(
        SAEnum(
            ExerciseStatus,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="exercisestatus",
            create_type=False,
        ),
        nullable=False,
        server_default=text("'draft'"),
    )

    dialog: Mapped["ListeningDialog"] = relationship(back_populates="exercises", lazy="raise")
    items: Mapped[List["ExerciseItem"]] = relationship(
        back_populates="exercise",
        lazy="raise",
        cascade="all, delete-orphan",
        order_by="ExerciseItem.item_index",
    )
    exercise: Mapped["Exercise | None"] = relationship(
        back_populates="dialog_exercise", uselist=False, lazy="raise"
    )


class ExerciseItem(Base):
    """Individual item within a dialog exercise. Delete-and-recreate pattern."""

    __tablename__ = "exercise_items"
    __table_args__ = (
        UniqueConstraint("exercise_id", "item_index", name="uq_exercise_item_index"),
        CheckConstraint("item_index >= 0", name="ck_exercise_items_item_index"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuid_generate_v4())
    exercise_id: Mapped[UUID] = mapped_column(
        ForeignKey("dialog_exercises.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_index: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    exercise: Mapped["DialogExercise"] = relationship(back_populates="items", lazy="raise")


class Translation(Base):
    """Bilingual translation entry for Greek lemmas.

    Stored in the 'reference' PostgreSQL schema alongside greek_lexicon.
    Contains translations from multiple sources (kaikki, freedict, pivot).
    """

    __tablename__ = "translations"
    __table_args__ = {"schema": "reference"}

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Auto-incrementing primary key",
    )
    lemma: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Greek lemma (dictionary form)",
    )
    language: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Target language code (en, ru)",
    )
    sense_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Sense ordering index (0-based) for multi-sense lemmas",
    )
    translation: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Translation text in the target language",
    )
    part_of_speech: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Part of speech (noun, verb, adj, etc.)",
    )
    source: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Data source identifier (kaikki, freedict, pivot)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Row creation timestamp",
    )

    def __repr__(self) -> str:
        return (
            f"<Translation(id={self.id}, lemma={self.lemma!r}, "
            f"language={self.language!r}, source={self.source!r})>"
        )


class WiktionaryMorphology(Base):
    """Wiktionary noun morphological data (declension forms, gender, IPA, glosses).

    Stored in the 'reference' PostgreSQL schema alongside greek_lexicon and translations.
    Contains ~14,360 Greek nouns with declension forms extracted from Kaikki JSONL.
    """

    __tablename__ = "wiktionary_morphology"
    __table_args__ = {"schema": "reference"}

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Auto-incrementing primary key",
    )
    lemma: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Greek lemma (dictionary form)",
    )
    gender: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Grammatical gender (masculine, feminine, neuter)",
    )
    forms: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
        comment="Flat JSONB of declension forms: {nominative_singular: ..., genitive_singular: ..., ...}",
    )
    pronunciation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="IPA pronunciation from first sounds entry",
    )
    glosses_en: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="English glosses (semicolon-separated, first gloss per sense)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Row creation timestamp",
    )

    def __repr__(self) -> str:
        return (
            f"<WiktionaryMorphology(id={self.id}, lemma={self.lemma!r}, "
            f"gender={self.gender!r})>"
        )
