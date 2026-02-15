"""Test factories package.

This package provides factory-boy based factories for test data generation:

Announcement Factories:
    - AnnouncementCampaignFactory: Admin announcement campaigns

Auth Factories:
    - UserFactory: User accounts with traits (admin, inactive, verified, oauth)
    - UserSettingsFactory: User preferences

Content Factories:
    - DeckFactory: Flashcard decks with CEFR level traits
    - CardFactory: Flashcards with Greek vocabulary

Progress Factories:
    - UserDeckProgressFactory: User progress on decks
    - CardStatisticsFactory: SM-2 algorithm statistics with state traits
    - ReviewFactory: Individual review records

XP & Achievements Factories:
    - UserXPFactory: User XP and level tracking
    - XPTransactionFactory: XP transaction history
    - AchievementFactory: Achievement definitions
    - UserAchievementFactory: User's unlocked achievements

Culture Factories:
    - CultureDeckFactory: Culture exam decks
    - CultureQuestionFactory: Multiple-choice culture questions
    - CultureQuestionStatsFactory: SM-2 stats for culture questions
    - CultureAnswerHistoryFactory: Answer history for analytics

Custom Providers:
    - GreekProvider: Faker provider for Greek vocabulary

Usage:
    from tests.factories import UserFactory, DeckFactory, CardFactory

    # Create a user
    user = await UserFactory.create()

    # Create an admin
    admin = await UserFactory.create(admin=True)

    # Create a deck with cards
    deck, cards = await DeckFactory.create_with_cards(card_count=10)

    # Create SM-2 statistics
    stats = await CardStatisticsFactory.create(
        user_id=user.id, card_id=card.id, mastered=True
    )

Note: All factories require a database session. Either pass it explicitly
or use the factory_session fixture which binds the session automatically.
"""

# Announcement factories
from tests.factories.announcement import AnnouncementCampaignFactory

# Auth factories
from tests.factories.auth import UserFactory, UserSettingsFactory

# Base factory
from tests.factories.base import BaseFactory, unique_email, unique_token, utc_now

# Card error factories
from tests.factories.card_error import CardErrorReportFactory

# Card record factories
from tests.factories.card_record import CardRecordFactory

# Content factories
from tests.factories.content import CardFactory, DeckFactory

# Culture factories
from tests.factories.culture import (
    CultureAnswerHistoryFactory,
    CultureDeckFactory,
    CultureQuestionFactory,
    CultureQuestionStatsFactory,
)

# Feedback factories
from tests.factories.feedback import FeedbackFactory, FeedbackVoteFactory

# News factories
from tests.factories.news import NewsItemFactory

# Notification factories
from tests.factories.notification import NotificationFactory

# Progress factories
from tests.factories.progress import (
    SM2_DEFAULT_EASINESS_FACTOR,
    SM2_INTERVALS,
    SM2_MIN_EASINESS_FACTOR,
    CardStatisticsFactory,
    ReviewFactory,
    UserDeckProgressFactory,
)

# Custom Faker providers
from tests.factories.providers import GreekProvider

# XP & Achievements factories
from tests.factories.xp_achievements import (
    XP_PER_LEVEL,
    XP_REASONS,
    AchievementFactory,
    UserAchievementFactory,
    UserXPFactory,
    XPTransactionFactory,
)

__all__ = [
    # Base
    "BaseFactory",
    "unique_email",
    "unique_token",
    "utc_now",
    # Announcements
    "AnnouncementCampaignFactory",
    # Auth
    "UserFactory",
    "UserSettingsFactory",
    # Card Errors
    "CardErrorReportFactory",
    # Card Records
    "CardRecordFactory",
    # Content
    "DeckFactory",
    "CardFactory",
    # Feedback
    "FeedbackFactory",
    "FeedbackVoteFactory",
    # News
    "NewsItemFactory",
    # Progress
    "UserDeckProgressFactory",
    "CardStatisticsFactory",
    "ReviewFactory",
    # XP & Achievements
    "UserXPFactory",
    "XPTransactionFactory",
    "AchievementFactory",
    "UserAchievementFactory",
    # Notifications
    "NotificationFactory",
    # Culture
    "CultureDeckFactory",
    "CultureQuestionFactory",
    "CultureQuestionStatsFactory",
    "CultureAnswerHistoryFactory",
    # Constants
    "SM2_DEFAULT_EASINESS_FACTOR",
    "SM2_MIN_EASINESS_FACTOR",
    "SM2_INTERVALS",
    "XP_PER_LEVEL",
    "XP_REASONS",
    # Providers
    "GreekProvider",
]
