"""Tests for factory classes.

This module verifies that all factories:
- Create valid model instances
- Support traits correctly
- Handle async session properly
- Generate appropriate Greek vocabulary
- Create proper SM-2 statistics
"""

from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatus, DeckLevel, ReviewRating
from tests.factories import (
    SM2_DEFAULT_EASINESS_FACTOR,
    SM2_MIN_EASINESS_FACTOR,
    CardFactory,
    CardStatisticsFactory,
    DeckFactory,
    ReviewFactory,
    UserDeckProgressFactory,
    UserFactory,
    UserSettingsFactory,
)

# =============================================================================
# UserFactory Tests
# =============================================================================


class TestUserFactory:
    """Tests for UserFactory."""

    async def test_create_basic_user(self, db_session: AsyncSession):
        """Test creating a basic user."""
        user = await UserFactory.create(session=db_session)

        assert user is not None
        assert user.id is not None
        assert user.email is not None
        assert "@example.com" in user.email
        assert user.is_active is True
        assert user.is_superuser is False
        # Supabase users have supabase_id
        assert user.supabase_id is not None

    async def test_create_admin_user(self, db_session: AsyncSession):
        """Test creating an admin user with trait."""
        user = await UserFactory.create(session=db_session, admin=True)

        assert user.is_superuser is True

    async def test_create_inactive_user(self, db_session: AsyncSession):
        """Test creating an inactive user with trait."""
        user = await UserFactory.create(session=db_session, inactive=True)

        assert user.is_active is False

    async def test_create_with_settings(self, db_session: AsyncSession):
        """Test creating user with settings."""
        user = await UserFactory.create_with_settings(session=db_session, daily_goal=50)

        assert user is not None
        assert user.settings is not None
        assert user.settings.daily_goal == 50

    async def test_create_batch(self, db_session: AsyncSession):
        """Test creating multiple users."""
        users = await UserFactory.create_batch(3, session=db_session)

        assert len(users) == 3
        emails = [u.email for u in users]
        assert len(set(emails)) == 3  # All unique

    async def test_build_without_persist(self, db_session: AsyncSession):
        """Test building user without persisting."""
        user = UserFactory.build()

        assert user.id is None  # Not persisted
        assert user.email is not None


# =============================================================================
# UserSettingsFactory Tests
# =============================================================================


class TestUserSettingsFactory:
    """Tests for UserSettingsFactory."""

    async def test_create_settings(self, db_session: AsyncSession):
        """Test creating user settings."""
        user = await UserFactory.create(session=db_session)
        settings = await UserSettingsFactory.create(session=db_session, user_id=user.id)

        assert settings is not None
        assert settings.user_id == user.id
        assert settings.daily_goal == 20  # Default

    async def test_high_achiever_trait(self, db_session: AsyncSession):
        """Test high achiever settings trait."""
        user = await UserFactory.create(session=db_session)
        settings = await UserSettingsFactory.create(
            session=db_session, user_id=user.id, high_achiever=True
        )

        assert settings.daily_goal == 50

    async def test_quiet_trait(self, db_session: AsyncSession):
        """Test quiet settings trait."""
        user = await UserFactory.create(session=db_session)
        settings = await UserSettingsFactory.create(session=db_session, user_id=user.id, quiet=True)

        assert settings.email_notifications is False


# =============================================================================
# RefreshTokenFactory Tests - REMOVED (Supabase handles refresh tokens)
# =============================================================================
# The RefreshTokenFactory has been removed as part of Supabase migration.
# Supabase manages refresh tokens internally.


# =============================================================================
# DeckFactory Tests
# =============================================================================


class TestDeckFactory:
    """Tests for DeckFactory."""

    async def test_create_basic_deck(self, db_session: AsyncSession):
        """Test creating a basic deck with trilingual fields."""
        deck = await DeckFactory.create(session=db_session)

        assert deck is not None
        assert deck.id is not None
        # Check trilingual name fields
        assert deck.name_el is not None
        assert deck.name_en is not None
        assert deck.name_ru is not None
        # Check trilingual description fields
        assert deck.description_el is not None
        assert deck.description_en is not None
        assert deck.description_ru is not None
        assert deck.level == DeckLevel.A1  # Default
        assert deck.is_active is True
        assert deck.is_premium is False

    async def test_create_inactive_deck(self, db_session: AsyncSession):
        """Test creating an inactive deck."""
        deck = await DeckFactory.create(session=db_session, inactive=True)

        assert deck.is_active is False

    async def test_create_premium_deck(self, db_session: AsyncSession):
        """Test creating a premium deck."""
        deck = await DeckFactory.create(session=db_session, premium=True)

        assert deck.is_premium is True

    async def test_level_traits(self, db_session: AsyncSession):
        """Test CEFR level traits."""
        a2_deck = await DeckFactory.create(session=db_session, a2=True)
        b1_deck = await DeckFactory.create(session=db_session, b1=True)

        assert a2_deck.level == DeckLevel.A2
        assert b1_deck.level == DeckLevel.B1
        # Verify trilingual names exist for traits
        assert a2_deck.name_en is not None
        assert b1_deck.name_en is not None

    async def test_create_with_cards(self, db_session: AsyncSession):
        """Test creating a deck with cards."""
        deck, cards = await DeckFactory.create_with_cards(session=db_session, card_count=5)

        assert deck is not None
        assert len(cards) == 5
        for card in cards:
            assert card.deck_id == deck.id

    async def test_create_with_custom_multilingual_fields(self, db_session: AsyncSession):
        """Test creating a deck with custom trilingual values."""
        deck = await DeckFactory.create(
            session=db_session,
            name_el="Προσαρμοσμένο",
            name_en="Custom",
            name_ru="Пользовательский",
            description_el="Προσαρμοσμένη περιγραφή",
            description_en="Custom description",
            description_ru="Пользовательское описание",
        )

        assert deck.name_el == "Προσαρμοσμένο"
        assert deck.name_en == "Custom"
        assert deck.name_ru == "Пользовательский"
        assert deck.description_el == "Προσαρμοσμένη περιγραφή"
        assert deck.description_en == "Custom description"
        assert deck.description_ru == "Пользовательское описание"


# =============================================================================
# CardFactory Tests
# =============================================================================


class TestCardFactory:
    """Tests for CardFactory."""

    async def test_create_basic_card(self, db_session: AsyncSession):
        """Test creating a basic card."""
        deck = await DeckFactory.create(session=db_session)
        card = await CardFactory.create(session=db_session, deck_id=deck.id)

        assert card is not None
        assert card.deck_id == deck.id
        assert card.front_text is not None  # Greek word
        assert card.back_text_en is not None  # English translation

    async def test_minimal_trait(self, db_session: AsyncSession):
        """Test minimal card trait."""
        deck = await DeckFactory.create(session=db_session)
        card = await CardFactory.create(session=db_session, deck_id=deck.id, minimal=True)

        assert card.pronunciation is None
        assert card.example_sentence is None


# =============================================================================
# UserDeckProgressFactory Tests
# =============================================================================


class TestUserDeckProgressFactory:
    """Tests for UserDeckProgressFactory."""

    async def test_create_progress(self, db_session: AsyncSession):
        """Test creating deck progress."""
        user = await UserFactory.create(session=db_session)
        deck = await DeckFactory.create(session=db_session)

        progress = await UserDeckProgressFactory.create(
            session=db_session, user_id=user.id, deck_id=deck.id
        )

        assert progress is not None
        assert progress.user_id == user.id
        assert progress.deck_id == deck.id
        assert progress.cards_studied >= 0

    async def test_fresh_trait(self, db_session: AsyncSession):
        """Test fresh progress trait."""
        user = await UserFactory.create(session=db_session)
        deck = await DeckFactory.create(session=db_session)

        progress = await UserDeckProgressFactory.create(
            session=db_session, user_id=user.id, deck_id=deck.id, fresh=True
        )

        assert progress.cards_studied == 0
        assert progress.cards_mastered == 0
        assert progress.last_studied_at is None

    async def test_completed_trait(self, db_session: AsyncSession):
        """Test completed progress trait."""
        user = await UserFactory.create(session=db_session)
        deck = await DeckFactory.create(session=db_session)

        progress = await UserDeckProgressFactory.create(
            session=db_session, user_id=user.id, deck_id=deck.id, completed=True
        )

        assert progress.cards_studied == 50
        assert progress.cards_mastered == 50


# =============================================================================
# CardStatisticsFactory Tests
# =============================================================================


class TestCardStatisticsFactory:
    """Tests for CardStatisticsFactory (SM-2 algorithm)."""

    async def test_create_statistics(self, db_session: AsyncSession):
        """Test creating card statistics."""
        user = await UserFactory.create(session=db_session)
        deck = await DeckFactory.create(session=db_session)
        card = await CardFactory.create(session=db_session, deck_id=deck.id)

        stats = await CardStatisticsFactory.create(
            session=db_session, user_id=user.id, card_id=card.id
        )

        assert stats is not None
        assert stats.user_id == user.id
        assert stats.card_id == card.id

    async def test_new_trait(self, db_session: AsyncSession):
        """Test NEW status trait."""
        user = await UserFactory.create(session=db_session)
        deck = await DeckFactory.create(session=db_session)
        card = await CardFactory.create(session=db_session, deck_id=deck.id)

        stats = await CardStatisticsFactory.create(
            session=db_session, user_id=user.id, card_id=card.id, new=True
        )

        assert stats.status == CardStatus.NEW
        assert stats.easiness_factor == SM2_DEFAULT_EASINESS_FACTOR
        assert stats.interval == 0
        assert stats.repetitions == 0

    async def test_learning_trait(self, db_session: AsyncSession):
        """Test LEARNING status trait."""
        user = await UserFactory.create(session=db_session)
        deck = await DeckFactory.create(session=db_session)
        card = await CardFactory.create(session=db_session, deck_id=deck.id)

        stats = await CardStatisticsFactory.create(
            session=db_session, user_id=user.id, card_id=card.id, learning=True
        )

        assert stats.status == CardStatus.LEARNING
        assert stats.repetitions > 0

    async def test_mastered_trait(self, db_session: AsyncSession):
        """Test MASTERED status trait."""
        user = await UserFactory.create(session=db_session)
        deck = await DeckFactory.create(session=db_session)
        card = await CardFactory.create(session=db_session, deck_id=deck.id)

        stats = await CardStatisticsFactory.create(
            session=db_session, user_id=user.id, card_id=card.id, mastered=True
        )

        assert stats.status == CardStatus.MASTERED
        assert stats.easiness_factor > SM2_DEFAULT_EASINESS_FACTOR
        assert stats.interval >= 30
        assert stats.repetitions >= 10

    async def test_due_trait(self, db_session: AsyncSession):
        """Test due for review trait."""
        user = await UserFactory.create(session=db_session)
        deck = await DeckFactory.create(session=db_session)
        card = await CardFactory.create(session=db_session, deck_id=deck.id)

        stats = await CardStatisticsFactory.create(
            session=db_session, user_id=user.id, card_id=card.id, due=True
        )

        assert stats.next_review_date == date.today()

    async def test_overdue_trait(self, db_session: AsyncSession):
        """Test overdue trait."""
        user = await UserFactory.create(session=db_session)
        deck = await DeckFactory.create(session=db_session)
        card = await CardFactory.create(session=db_session, deck_id=deck.id)

        stats = await CardStatisticsFactory.create(
            session=db_session, user_id=user.id, card_id=card.id, overdue=True
        )

        assert stats.next_review_date < date.today()

    async def test_struggling_trait(self, db_session: AsyncSession):
        """Test struggling card trait."""
        user = await UserFactory.create(session=db_session)
        deck = await DeckFactory.create(session=db_session)
        card = await CardFactory.create(session=db_session, deck_id=deck.id)

        stats = await CardStatisticsFactory.create(
            session=db_session, user_id=user.id, card_id=card.id, struggling=True
        )

        assert stats.easiness_factor == SM2_MIN_EASINESS_FACTOR


# =============================================================================
# ReviewFactory Tests
# =============================================================================


class TestReviewFactory:
    """Tests for ReviewFactory."""

    async def test_create_review(self, db_session: AsyncSession):
        """Test creating a review."""
        user = await UserFactory.create(session=db_session)
        deck = await DeckFactory.create(session=db_session)
        card = await CardFactory.create(session=db_session, deck_id=deck.id)

        review = await ReviewFactory.create(session=db_session, user_id=user.id, card_id=card.id)

        assert review is not None
        assert review.user_id == user.id
        assert review.card_id == card.id
        assert 0 <= review.quality <= 5

    async def test_perfect_trait(self, db_session: AsyncSession):
        """Test perfect review trait."""
        user = await UserFactory.create(session=db_session)
        deck = await DeckFactory.create(session=db_session)
        card = await CardFactory.create(session=db_session, deck_id=deck.id)

        review = await ReviewFactory.create(
            session=db_session, user_id=user.id, card_id=card.id, perfect=True
        )

        assert review.quality == ReviewRating.PERFECT

    async def test_failed_trait(self, db_session: AsyncSession):
        """Test failed review trait."""
        user = await UserFactory.create(session=db_session)
        deck = await DeckFactory.create(session=db_session)
        card = await CardFactory.create(session=db_session, deck_id=deck.id)

        review = await ReviewFactory.create(
            session=db_session, user_id=user.id, card_id=card.id, failed=True
        )

        assert review.quality == ReviewRating.BLACKOUT

    async def test_create_history(self, db_session: AsyncSession):
        """Test creating review history."""
        user = await UserFactory.create(session=db_session)
        deck = await DeckFactory.create(session=db_session)
        card = await CardFactory.create(session=db_session, deck_id=deck.id)

        ratings = [3, 4, 4, 5, 5]  # Improving performance
        reviews = await ReviewFactory.create_history(
            user_id=user.id,
            card_id=card.id,
            ratings=ratings,
            session=db_session,
        )

        assert len(reviews) == 5
        for i, review in enumerate(reviews):
            assert review.quality == ratings[i]


# =============================================================================
# Integration Tests
# =============================================================================


class TestFactoryIntegration:
    """Integration tests for factory combinations."""

    async def test_complete_learning_scenario(self, db_session: AsyncSession):
        """Test creating a complete learning scenario."""
        # Create user with settings
        user = await UserFactory.create_with_settings(session=db_session)

        # Create deck with cards
        deck, cards = await DeckFactory.create_with_cards(session=db_session, card_count=5)

        # Create progress
        progress = await UserDeckProgressFactory.create(
            session=db_session,
            user_id=user.id,
            deck_id=deck.id,
            cards_studied=3,
            cards_mastered=1,
        )

        # Create statistics for each card
        stats_list = []
        for i, card in enumerate(cards):
            if i == 0:
                stats = await CardStatisticsFactory.create(
                    session=db_session, user_id=user.id, card_id=card.id, mastered=True
                )
            elif i < 3:
                stats = await CardStatisticsFactory.create(
                    session=db_session, user_id=user.id, card_id=card.id, learning=True
                )
            else:
                stats = await CardStatisticsFactory.create(
                    session=db_session, user_id=user.id, card_id=card.id, new=True
                )
            stats_list.append(stats)

        # Verify scenario
        assert user.settings is not None
        assert len(cards) == 5
        assert progress.cards_studied == 3
        assert stats_list[0].status == CardStatus.MASTERED
        assert stats_list[1].status == CardStatus.LEARNING
        assert stats_list[4].status == CardStatus.NEW
