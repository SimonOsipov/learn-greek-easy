"""Test factories package.

This package provides factory-boy based factories for test data generation:

Auth Factories:
    - UserFactory: User accounts with traits (admin, inactive, verified, oauth)
    - UserSettingsFactory: User preferences
    - RefreshTokenFactory: JWT refresh tokens

Content Factories:
    - DeckFactory: Flashcard decks with CEFR level traits
    - CardFactory: Flashcards with Greek vocabulary

Progress Factories:
    - UserDeckProgressFactory: User progress on decks
    - CardStatisticsFactory: SM-2 algorithm statistics with state traits
    - ReviewFactory: Individual review records

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

# Auth factories
from tests.factories.auth import RefreshTokenFactory, UserFactory, UserSettingsFactory

# Base factory
from tests.factories.base import BaseFactory, unique_email, unique_token, utc_now

# Content factories
from tests.factories.content import CardFactory, DeckFactory

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

__all__ = [
    # Base
    "BaseFactory",
    "unique_email",
    "unique_token",
    "utc_now",
    # Auth
    "UserFactory",
    "UserSettingsFactory",
    "RefreshTokenFactory",
    # Content
    "DeckFactory",
    "CardFactory",
    # Progress
    "UserDeckProgressFactory",
    "CardStatisticsFactory",
    "ReviewFactory",
    # Constants
    "SM2_DEFAULT_EASINESS_FACTOR",
    "SM2_MIN_EASINESS_FACTOR",
    "SM2_INTERVALS",
    # Providers
    "GreekProvider",
]
