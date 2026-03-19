"""Tests for factory classes.

This module verifies that all factories:
- Create valid model instances
- Support traits correctly
- Handle async session properly
- Generate appropriate Greek vocabulary
- Create proper SM-2 statistics
"""

from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DeckLevel
from tests.factories import DeckFactory, UserFactory, UserSettingsFactory

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
