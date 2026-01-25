"""Unit tests for Deck and CultureDeck models.

Tests the is_premium field on both Deck and CultureDeck models:
- Default value is False
- Can be set to True
- is_premium is independent of is_active

Tests the owner_id field on Deck models:
- Default value is None (system decks)
- Can be set to a user UUID (user-created decks)
- Cascade delete when owner is deleted
"""

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureDeck, Deck, DeckLevel, User, UserSettings


class TestDeckModelIsPremium:
    """Test Deck model is_premium field."""

    def test_deck_is_premium_with_explicit_false(self):
        """Test is_premium can be explicitly set to False when creating a Deck."""
        # Note: SQLAlchemy's `default=False` only applies on database INSERT.
        # In-memory model instances need explicit values for non-nullable fields.
        deck = Deck(
            name="Test Deck",
            description="Test description",
            level=DeckLevel.A1,
            is_premium=False,
        )
        assert deck.is_premium is False

    def test_deck_is_premium_can_be_true(self):
        """Test is_premium can be set to True."""
        deck = Deck(
            name="Premium Deck",
            description="Premium content",
            level=DeckLevel.B1,
            is_premium=True,
        )
        assert deck.is_premium is True

    def test_deck_is_premium_explicit_false(self):
        """Test is_premium can be explicitly set to False."""
        deck = Deck(
            name="Free Deck",
            description="Free content",
            level=DeckLevel.A2,
            is_premium=False,
        )
        assert deck.is_premium is False

    def test_deck_is_premium_independent_of_is_active(self):
        """Test is_premium and is_active are independent."""
        # Active and premium
        deck1 = Deck(
            name="Active Premium",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=True,
        )
        assert deck1.is_active is True
        assert deck1.is_premium is True

        # Active and not premium
        deck2 = Deck(
            name="Active Free",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=False,
        )
        assert deck2.is_active is True
        assert deck2.is_premium is False

        # Inactive and premium
        deck3 = Deck(
            name="Inactive Premium",
            level=DeckLevel.A1,
            is_active=False,
            is_premium=True,
        )
        assert deck3.is_active is False
        assert deck3.is_premium is True

        # Inactive and not premium
        deck4 = Deck(
            name="Inactive Free",
            level=DeckLevel.A1,
            is_active=False,
            is_premium=False,
        )
        assert deck4.is_active is False
        assert deck4.is_premium is False


class TestDeckModelIsPremiumDatabase:
    """Integration tests for Deck model is_premium with database."""

    @pytest.mark.asyncio
    async def test_deck_is_premium_persists_false(self, db_session: AsyncSession):
        """Test is_premium=False is persisted to database."""
        deck = Deck(
            name="Free DB Deck",
            description="Test persistence",
            level=DeckLevel.A1,
            is_premium=False,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.id is not None
        assert deck.is_premium is False

    @pytest.mark.asyncio
    async def test_deck_is_premium_persists_true(self, db_session: AsyncSession):
        """Test is_premium=True is persisted to database."""
        deck = Deck(
            name="Premium DB Deck",
            description="Premium test",
            level=DeckLevel.B2,
            is_premium=True,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.id is not None
        assert deck.is_premium is True

    @pytest.mark.asyncio
    async def test_deck_is_premium_default_persists(self, db_session: AsyncSession):
        """Test default is_premium=False when not specified."""
        deck = Deck(
            name="Default Premium Deck",
            description="Default test",
            level=DeckLevel.A1,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.is_premium is False

    @pytest.mark.asyncio
    async def test_deck_is_premium_update_independent(self, db_session: AsyncSession):
        """Test updating is_premium does not affect is_active."""
        deck = Deck(
            name="Update Test Deck",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=False,
        )
        db_session.add(deck)
        await db_session.commit()

        # Update is_premium only
        deck.is_premium = True
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.is_premium is True
        assert deck.is_active is True  # Should remain unchanged

    @pytest.mark.asyncio
    async def test_deck_is_active_update_independent(self, db_session: AsyncSession):
        """Test updating is_active does not affect is_premium."""
        deck = Deck(
            name="Active Update Test Deck",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=True,
        )
        db_session.add(deck)
        await db_session.commit()

        # Update is_active only
        deck.is_active = False
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.is_active is False
        assert deck.is_premium is True  # Should remain unchanged


class TestCultureDeckModelIsPremium:
    """Test CultureDeck model is_premium field."""

    def test_culture_deck_is_premium_with_explicit_false(self):
        """Test is_premium can be explicitly set to False when creating a CultureDeck."""
        # Note: SQLAlchemy's `default=False` only applies on database INSERT.
        # In-memory model instances need explicit values for non-nullable fields.
        deck = CultureDeck(
            name="Culture Test",
            description="Culture test description",
            category="history",
            is_premium=False,
        )
        assert deck.is_premium is False

    def test_culture_deck_is_premium_can_be_true(self):
        """Test is_premium can be set to True."""
        deck = CultureDeck(
            name="Premium Culture Deck",
            description="Premium culture content",
            category="traditions",
            is_premium=True,
        )
        assert deck.is_premium is True

    def test_culture_deck_is_premium_explicit_false(self):
        """Test is_premium can be explicitly set to False."""
        deck = CultureDeck(
            name="Free Culture Deck",
            description="Free culture content",
            category="geography",
            is_premium=False,
        )
        assert deck.is_premium is False

    def test_culture_deck_is_premium_independent_of_is_active(self):
        """Test is_premium and is_active are independent."""
        # Active and premium
        deck1 = CultureDeck(
            name="Active Premium Culture",
            category="history",
            is_active=True,
            is_premium=True,
        )
        assert deck1.is_active is True
        assert deck1.is_premium is True

        # Active and not premium
        deck2 = CultureDeck(
            name="Active Free Culture",
            category="history",
            is_active=True,
            is_premium=False,
        )
        assert deck2.is_active is True
        assert deck2.is_premium is False

        # Inactive and premium
        deck3 = CultureDeck(
            name="Inactive Premium Culture",
            category="history",
            is_active=False,
            is_premium=True,
        )
        assert deck3.is_active is False
        assert deck3.is_premium is True

        # Inactive and not premium
        deck4 = CultureDeck(
            name="Inactive Free Culture",
            category="history",
            is_active=False,
            is_premium=False,
        )
        assert deck4.is_active is False
        assert deck4.is_premium is False


class TestCultureDeckModelIsPremiumDatabase:
    """Integration tests for CultureDeck model is_premium with database."""

    @pytest.mark.asyncio
    async def test_culture_deck_is_premium_persists_false(self, db_session: AsyncSession):
        """Test is_premium=False is persisted to database."""
        deck = CultureDeck(
            name="Free Culture DB",
            description="Test persistence",
            category="history",
            is_premium=False,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.id is not None
        assert deck.is_premium is False

    @pytest.mark.asyncio
    async def test_culture_deck_is_premium_persists_true(self, db_session: AsyncSession):
        """Test is_premium=True is persisted to database."""
        deck = CultureDeck(
            name="Premium Culture DB",
            description="Premium test",
            category="traditions",
            is_premium=True,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.id is not None
        assert deck.is_premium is True

    @pytest.mark.asyncio
    async def test_culture_deck_is_premium_default_persists(self, db_session: AsyncSession):
        """Test default is_premium=False when not specified."""
        deck = CultureDeck(
            name="Default Premium Culture",
            description="Default test",
            category="geography",
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.is_premium is False

    @pytest.mark.asyncio
    async def test_culture_deck_is_premium_update_independent(self, db_session: AsyncSession):
        """Test updating is_premium does not affect is_active."""
        deck = CultureDeck(
            name="Update Culture Test",
            category="history",
            is_active=True,
            is_premium=False,
        )
        db_session.add(deck)
        await db_session.commit()

        # Update is_premium only
        deck.is_premium = True
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.is_premium is True
        assert deck.is_active is True  # Should remain unchanged

    @pytest.mark.asyncio
    async def test_culture_deck_is_active_update_independent(self, db_session: AsyncSession):
        """Test updating is_active does not affect is_premium."""
        deck = CultureDeck(
            name="Active Culture Update Test",
            category="traditions",
            is_active=True,
            is_premium=True,
        )
        db_session.add(deck)
        await db_session.commit()

        # Update is_active only
        deck.is_active = False
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.is_active is False
        assert deck.is_premium is True  # Should remain unchanged


class TestDeckModelOwnerId:
    """Test Deck model owner_id field."""

    def test_deck_owner_id_default_none(self):
        """Test owner_id defaults to None (system deck)."""
        deck = Deck(
            name="System Deck",
            description="System-created deck",
            level=DeckLevel.A1,
            is_premium=False,
        )
        assert deck.owner_id is None

    def test_deck_owner_id_can_be_set(self):
        """Test owner_id can be set to a UUID."""
        user_id = uuid4()
        deck = Deck(
            name="User Deck",
            description="User-created deck",
            level=DeckLevel.A1,
            is_premium=False,
            owner_id=user_id,
        )
        assert deck.owner_id == user_id

    def test_deck_owner_id_explicit_none(self):
        """Test owner_id can be explicitly set to None."""
        deck = Deck(
            name="Explicit System Deck",
            description="Explicitly system deck",
            level=DeckLevel.A2,
            is_premium=False,
            owner_id=None,
        )
        assert deck.owner_id is None

    def test_deck_owner_id_independent_of_is_premium(self):
        """Test owner_id and is_premium are independent."""
        user_id = uuid4()

        # System deck (no owner), free
        deck1 = Deck(
            name="System Free",
            level=DeckLevel.A1,
            is_premium=False,
            owner_id=None,
        )
        assert deck1.owner_id is None
        assert deck1.is_premium is False

        # System deck (no owner), premium
        deck2 = Deck(
            name="System Premium",
            level=DeckLevel.A1,
            is_premium=True,
            owner_id=None,
        )
        assert deck2.owner_id is None
        assert deck2.is_premium is True

        # User deck, free
        deck3 = Deck(
            name="User Free",
            level=DeckLevel.A1,
            is_premium=False,
            owner_id=user_id,
        )
        assert deck3.owner_id == user_id
        assert deck3.is_premium is False

        # User deck, premium
        deck4 = Deck(
            name="User Premium",
            level=DeckLevel.A1,
            is_premium=True,
            owner_id=user_id,
        )
        assert deck4.owner_id == user_id
        assert deck4.is_premium is True


class TestDeckModelOwnerIdDatabase:
    """Integration tests for Deck model owner_id with database."""

    @pytest.mark.asyncio
    async def test_deck_owner_id_persists_none(self, db_session: AsyncSession):
        """Test owner_id=None is persisted to database (system deck)."""
        deck = Deck(
            name="System DB Deck",
            description="Test persistence",
            level=DeckLevel.A1,
            is_premium=False,
            owner_id=None,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.id is not None
        assert deck.owner_id is None

    @pytest.mark.asyncio
    async def test_deck_owner_id_default_persists(self, db_session: AsyncSession):
        """Test default owner_id=None when not specified."""
        deck = Deck(
            name="Default Owner Deck",
            description="Default test",
            level=DeckLevel.A1,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.owner_id is None

    @pytest.mark.asyncio
    async def test_deck_owner_id_persists_with_user(
        self, db_session: AsyncSession, test_user: User
    ):
        """Test owner_id is persisted when set to a user ID."""
        deck = Deck(
            name="User Owned Deck",
            description="User-created deck",
            level=DeckLevel.A1,
            is_premium=False,
            owner_id=test_user.id,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.id is not None
        assert deck.owner_id == test_user.id

    @pytest.mark.asyncio
    async def test_deck_owner_relationship_loads(self, db_session: AsyncSession, test_user: User):
        """Test owner relationship loads correctly."""
        deck = Deck(
            name="Owned Deck",
            description="User-created deck",
            level=DeckLevel.A1,
            is_premium=False,
            owner_id=test_user.id,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        # The owner relationship should load the user
        assert deck.owner is not None
        assert deck.owner.id == test_user.id
        assert deck.owner.email == test_user.email

    @pytest.mark.asyncio
    async def test_deck_owner_relationship_none_for_system_deck(self, db_session: AsyncSession):
        """Test owner relationship is None for system decks."""
        deck = Deck(
            name="System Deck",
            description="System deck",
            level=DeckLevel.A1,
            is_premium=False,
            owner_id=None,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.owner is None

    @pytest.mark.asyncio
    async def test_deck_cascade_delete_when_owner_deleted(self, db_session: AsyncSession):
        """Test deck is deleted when owner user is deleted (CASCADE)."""
        from sqlalchemy import select

        # Create a user specifically for this test
        user = User(
            email=f"cascade_test_{uuid4().hex[:8]}@example.com",
            password_hash=None,
            full_name="Cascade Test User",
            is_active=True,
            is_superuser=False,
            auth0_id=f"auth0|cascade_test_{uuid4().hex[:16]}",
        )
        db_session.add(user)
        await db_session.flush()

        # Create settings for the user
        settings = UserSettings(
            user_id=user.id,
            daily_goal=20,
            email_notifications=True,
        )
        db_session.add(settings)
        await db_session.commit()
        await db_session.refresh(user)

        # Create a deck owned by this user
        deck = Deck(
            name="Cascade Test Deck",
            description="Will be deleted with owner",
            level=DeckLevel.A1,
            is_premium=False,
            owner_id=user.id,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)
        deck_id = deck.id

        # Delete the user
        await db_session.delete(user)
        await db_session.commit()

        # Expire all objects in session to force fresh query from database
        db_session.expire_all()

        # Verify deck was deleted via cascade - query database directly
        result = await db_session.execute(select(Deck).where(Deck.id == deck_id))
        deleted_deck = result.scalar_one_or_none()
        assert deleted_deck is None

    @pytest.mark.asyncio
    async def test_deck_owner_id_update_independent(
        self, db_session: AsyncSession, test_user: User
    ):
        """Test updating owner_id does not affect is_premium or is_active."""
        deck = Deck(
            name="Update Owner Test Deck",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=True,
            owner_id=None,
        )
        db_session.add(deck)
        await db_session.commit()

        # Update owner_id only
        deck.owner_id = test_user.id
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.owner_id == test_user.id
        assert deck.is_active is True  # Should remain unchanged
        assert deck.is_premium is True  # Should remain unchanged
