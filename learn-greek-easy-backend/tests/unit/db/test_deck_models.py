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
            name_en="Test Deck",
            name_el="Test Deck",
            name_ru="Test Deck",
            description_en="Test description",
            description_el="Test description",
            description_ru="Test description",
            level=DeckLevel.A1,
            is_premium=False,
        )
        assert deck.is_premium is False

    def test_deck_is_premium_can_be_true(self):
        """Test is_premium can be set to True."""
        deck = Deck(
            name_en="Premium Deck",
            name_el="Premium Deck",
            name_ru="Premium Deck",
            description_en="Premium content",
            description_el="Premium content",
            description_ru="Premium content",
            level=DeckLevel.B1,
            is_premium=True,
        )
        assert deck.is_premium is True

    def test_deck_is_premium_explicit_false(self):
        """Test is_premium can be explicitly set to False."""
        deck = Deck(
            name_en="Free Deck",
            name_el="Free Deck",
            name_ru="Free Deck",
            description_en="Free content",
            description_el="Free content",
            description_ru="Free content",
            level=DeckLevel.A2,
            is_premium=False,
        )
        assert deck.is_premium is False

    def test_deck_is_premium_independent_of_is_active(self):
        """Test is_premium and is_active are independent."""
        # Active and premium
        deck1 = Deck(
            name_en="Active Premium",
            name_el="Active Premium",
            name_ru="Active Premium",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=True,
        )
        assert deck1.is_active is True
        assert deck1.is_premium is True

        # Active and not premium
        deck2 = Deck(
            name_en="Active Free",
            name_el="Active Free",
            name_ru="Active Free",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=False,
        )
        assert deck2.is_active is True
        assert deck2.is_premium is False

        # Inactive and premium
        deck3 = Deck(
            name_en="Inactive Premium",
            name_el="Inactive Premium",
            name_ru="Inactive Premium",
            level=DeckLevel.A1,
            is_active=False,
            is_premium=True,
        )
        assert deck3.is_active is False
        assert deck3.is_premium is True

        # Inactive and not premium
        deck4 = Deck(
            name_en="Inactive Free",
            name_el="Inactive Free",
            name_ru="Inactive Free",
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
            name_en="Free DB Deck",
            name_el="Free DB Deck",
            name_ru="Free DB Deck",
            description_en="Test persistence",
            description_el="Test persistence",
            description_ru="Test persistence",
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
            name_en="Premium DB Deck",
            name_el="Premium DB Deck",
            name_ru="Premium DB Deck",
            description_en="Premium test",
            description_el="Premium test",
            description_ru="Premium test",
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
            name_en="Default Premium Deck",
            name_el="Default Premium Deck",
            name_ru="Default Premium Deck",
            description_en="Default test",
            description_el="Default test",
            description_ru="Default test",
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
            name_en="Update Test Deck",
            name_el="Update Test Deck",
            name_ru="Update Test Deck",
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
            name_en="Active Update Test Deck",
            name_el="Active Update Test Deck",
            name_ru="Active Update Test Deck",
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
            name_en="Culture Test",
            name_el="Culture Test",
            name_ru="Culture Test",
            description_en="Culture test description",
            description_el="Culture test description",
            description_ru="Culture test description",
            category="history",
            is_premium=False,
        )
        assert deck.is_premium is False

    def test_culture_deck_is_premium_can_be_true(self):
        """Test is_premium can be set to True."""
        deck = CultureDeck(
            name_en="Premium Culture Deck",
            name_el="Premium Culture Deck",
            name_ru="Premium Culture Deck",
            description_en="Premium culture content",
            description_el="Premium culture content",
            description_ru="Premium culture content",
            category="traditions",
            is_premium=True,
        )
        assert deck.is_premium is True

    def test_culture_deck_is_premium_explicit_false(self):
        """Test is_premium can be explicitly set to False."""
        deck = CultureDeck(
            name_en="Free Culture Deck",
            name_el="Free Culture Deck",
            name_ru="Free Culture Deck",
            description_en="Free culture content",
            description_el="Free culture content",
            description_ru="Free culture content",
            category="geography",
            is_premium=False,
        )
        assert deck.is_premium is False

    def test_culture_deck_is_premium_independent_of_is_active(self):
        """Test is_premium and is_active are independent."""
        # Active and premium
        deck1 = CultureDeck(
            name_en="Active Premium Culture",
            name_el="Active Premium Culture",
            name_ru="Active Premium Culture",
            category="history",
            is_active=True,
            is_premium=True,
        )
        assert deck1.is_active is True
        assert deck1.is_premium is True

        # Active and not premium
        deck2 = CultureDeck(
            name_en="Active Free Culture",
            name_el="Active Free Culture",
            name_ru="Active Free Culture",
            category="history",
            is_active=True,
            is_premium=False,
        )
        assert deck2.is_active is True
        assert deck2.is_premium is False

        # Inactive and premium
        deck3 = CultureDeck(
            name_en="Inactive Premium Culture",
            name_el="Inactive Premium Culture",
            name_ru="Inactive Premium Culture",
            category="history",
            is_active=False,
            is_premium=True,
        )
        assert deck3.is_active is False
        assert deck3.is_premium is True

        # Inactive and not premium
        deck4 = CultureDeck(
            name_en="Inactive Free Culture",
            name_el="Inactive Free Culture",
            name_ru="Inactive Free Culture",
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
            name_en="Free Culture DB",
            name_el="Free Culture DB",
            name_ru="Free Culture DB",
            description_en="Test persistence",
            description_el="Test persistence",
            description_ru="Test persistence",
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
            name_en="Premium Culture DB",
            name_el="Premium Culture DB",
            name_ru="Premium Culture DB",
            description_en="Premium test",
            description_el="Premium test",
            description_ru="Premium test",
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
            name_en="Default Premium Culture",
            name_el="Default Premium Culture",
            name_ru="Default Premium Culture",
            description_en="Default test",
            description_el="Default test",
            description_ru="Default test",
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
            name_en="Update Culture Test",
            name_el="Update Culture Test",
            name_ru="Update Culture Test",
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
            name_en="Active Culture Update Test",
            name_el="Active Culture Update Test",
            name_ru="Active Culture Update Test",
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
            name_en="System Deck",
            name_el="System Deck",
            name_ru="System Deck",
            description_en="System-created deck",
            description_el="System-created deck",
            description_ru="System-created deck",
            level=DeckLevel.A1,
            is_premium=False,
        )
        assert deck.owner_id is None

    def test_deck_owner_id_can_be_set(self):
        """Test owner_id can be set to a UUID."""
        user_id = uuid4()
        deck = Deck(
            name_en="User Deck",
            name_el="User Deck",
            name_ru="User Deck",
            description_en="User-created deck",
            description_el="User-created deck",
            description_ru="User-created deck",
            level=DeckLevel.A1,
            is_premium=False,
            owner_id=user_id,
        )
        assert deck.owner_id == user_id

    def test_deck_owner_id_explicit_none(self):
        """Test owner_id can be explicitly set to None."""
        deck = Deck(
            name_en="Explicit System Deck",
            name_el="Explicit System Deck",
            name_ru="Explicit System Deck",
            description_en="Explicitly system deck",
            description_el="Explicitly system deck",
            description_ru="Explicitly system deck",
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
            name_en="System Free",
            name_el="System Free",
            name_ru="System Free",
            level=DeckLevel.A1,
            is_premium=False,
            owner_id=None,
        )
        assert deck1.owner_id is None
        assert deck1.is_premium is False

        # System deck (no owner), premium
        deck2 = Deck(
            name_en="System Premium",
            name_el="System Premium",
            name_ru="System Premium",
            level=DeckLevel.A1,
            is_premium=True,
            owner_id=None,
        )
        assert deck2.owner_id is None
        assert deck2.is_premium is True

        # User deck, free
        deck3 = Deck(
            name_en="User Free",
            name_el="User Free",
            name_ru="User Free",
            level=DeckLevel.A1,
            is_premium=False,
            owner_id=user_id,
        )
        assert deck3.owner_id == user_id
        assert deck3.is_premium is False

        # User deck, premium
        deck4 = Deck(
            name_en="User Premium",
            name_el="User Premium",
            name_ru="User Premium",
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
            name_en="System DB Deck",
            name_el="System DB Deck",
            name_ru="System DB Deck",
            description_en="Test persistence",
            description_el="Test persistence",
            description_ru="Test persistence",
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
            name_en="Default Owner Deck",
            name_el="Default Owner Deck",
            name_ru="Default Owner Deck",
            description_en="Default test",
            description_el="Default test",
            description_ru="Default test",
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
            name_en="User Owned Deck",
            name_el="User Owned Deck",
            name_ru="User Owned Deck",
            description_en="User-created deck",
            description_el="User-created deck",
            description_ru="User-created deck",
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
            name_en="Owned Deck",
            name_el="Owned Deck",
            name_ru="Owned Deck",
            description_en="User-created deck",
            description_el="User-created deck",
            description_ru="User-created deck",
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
            name_en="System Deck",
            name_el="System Deck",
            name_ru="System Deck",
            description_en="System deck",
            description_el="System deck",
            description_ru="System deck",
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
            full_name="Cascade Test User",
            is_active=True,
            is_superuser=False,
            supabase_id=f"supabase_cascade_test_{uuid4().hex[:16]}",
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
            name_en="Cascade Test Deck",
            name_el="Cascade Test Deck",
            name_ru="Cascade Test Deck",
            description_en="Will be deleted with owner",
            description_el="Will be deleted with owner",
            description_ru="Will be deleted with owner",
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
            name_en="Update Owner Test Deck",
            name_el="Update Owner Test Deck",
            name_ru="Update Owner Test Deck",
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


class TestDeckModelCardSystem:
    """Test Deck model card_system field (Dual Card System feature)."""

    def test_deck_card_system_can_be_v1(self):
        """Test card_system can be set to V1."""
        from src.db.models import CardSystemVersion

        deck = Deck(
            name_en="V1 Deck",
            name_el="V1 Deck",
            name_ru="V1 Deck",
            description_en="V1 card system",
            description_el="V1 card system",
            description_ru="V1 card system",
            level=DeckLevel.A1,
            is_premium=False,
            card_system=CardSystemVersion.V1,
        )
        assert deck.card_system == CardSystemVersion.V1
        assert deck.card_system == "V1"

    def test_deck_card_system_can_be_v2(self):
        """Test card_system can be set to V2."""
        from src.db.models import CardSystemVersion

        deck = Deck(
            name_en="V2 Deck",
            name_el="V2 Deck",
            name_ru="V2 Deck",
            description_en="V2 card system",
            description_el="V2 card system",
            description_ru="V2 card system",
            level=DeckLevel.A1,
            is_premium=False,
            card_system=CardSystemVersion.V2,
        )
        assert deck.card_system == CardSystemVersion.V2
        assert deck.card_system == "V2"

    def test_deck_card_system_independent_of_is_premium(self):
        """Test card_system and is_premium are independent."""
        from src.db.models import CardSystemVersion

        # V1 free deck
        deck1 = Deck(
            name_en="V1 Free",
            name_el="V1 Free",
            name_ru="V1 Free",
            level=DeckLevel.A1,
            is_premium=False,
            card_system=CardSystemVersion.V1,
        )
        assert deck1.card_system == CardSystemVersion.V1
        assert deck1.is_premium is False

        # V1 premium deck
        deck2 = Deck(
            name_en="V1 Premium",
            name_el="V1 Premium",
            name_ru="V1 Premium",
            level=DeckLevel.A1,
            is_premium=True,
            card_system=CardSystemVersion.V1,
        )
        assert deck2.card_system == CardSystemVersion.V1
        assert deck2.is_premium is True

        # V2 free deck
        deck3 = Deck(
            name_en="V2 Free",
            name_el="V2 Free",
            name_ru="V2 Free",
            level=DeckLevel.A1,
            is_premium=False,
            card_system=CardSystemVersion.V2,
        )
        assert deck3.card_system == CardSystemVersion.V2
        assert deck3.is_premium is False

        # V2 premium deck
        deck4 = Deck(
            name_en="V2 Premium",
            name_el="V2 Premium",
            name_ru="V2 Premium",
            level=DeckLevel.A1,
            is_premium=True,
            card_system=CardSystemVersion.V2,
        )
        assert deck4.card_system == CardSystemVersion.V2
        assert deck4.is_premium is True

    def test_deck_card_system_independent_of_is_active(self):
        """Test card_system and is_active are independent."""
        from src.db.models import CardSystemVersion

        # V1 active deck
        deck1 = Deck(
            name_en="V1 Active",
            name_el="V1 Active",
            name_ru="V1 Active",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=False,
            card_system=CardSystemVersion.V1,
        )
        assert deck1.card_system == CardSystemVersion.V1
        assert deck1.is_active is True

        # V1 inactive deck
        deck2 = Deck(
            name_en="V1 Inactive",
            name_el="V1 Inactive",
            name_ru="V1 Inactive",
            level=DeckLevel.A1,
            is_active=False,
            is_premium=False,
            card_system=CardSystemVersion.V1,
        )
        assert deck2.card_system == CardSystemVersion.V1
        assert deck2.is_active is False

        # V2 active deck
        deck3 = Deck(
            name_en="V2 Active",
            name_el="V2 Active",
            name_ru="V2 Active",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=False,
            card_system=CardSystemVersion.V2,
        )
        assert deck3.card_system == CardSystemVersion.V2
        assert deck3.is_active is True

        # V2 inactive deck
        deck4 = Deck(
            name_en="V2 Inactive",
            name_el="V2 Inactive",
            name_ru="V2 Inactive",
            level=DeckLevel.A1,
            is_active=False,
            is_premium=False,
            card_system=CardSystemVersion.V2,
        )
        assert deck4.card_system == CardSystemVersion.V2
        assert deck4.is_active is False


class TestDeckModelCardSystemDatabase:
    """Integration tests for Deck model card_system with database."""

    @pytest.mark.asyncio
    async def test_deck_card_system_persists_v1(self, db_session: AsyncSession):
        """Test card_system=V1 is persisted to database."""
        from src.db.models import CardSystemVersion

        deck = Deck(
            name_en="V1 DB Deck",
            name_el="V1 DB Deck",
            name_ru="V1 DB Deck",
            description_en="V1 card system persistence test",
            description_el="V1 card system persistence test",
            description_ru="V1 card system persistence test",
            level=DeckLevel.A1,
            is_premium=False,
            card_system=CardSystemVersion.V1,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.id is not None
        assert deck.card_system == CardSystemVersion.V1
        assert deck.card_system == "V1"

    @pytest.mark.asyncio
    async def test_deck_card_system_persists_v2(self, db_session: AsyncSession):
        """Test card_system=V2 is persisted to database."""
        from src.db.models import CardSystemVersion

        deck = Deck(
            name_en="V2 DB Deck",
            name_el="V2 DB Deck",
            name_ru="V2 DB Deck",
            description_en="V2 card system persistence test",
            description_el="V2 card system persistence test",
            description_ru="V2 card system persistence test",
            level=DeckLevel.A1,
            is_premium=False,
            card_system=CardSystemVersion.V2,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.id is not None
        assert deck.card_system == CardSystemVersion.V2
        assert deck.card_system == "V2"

    @pytest.mark.asyncio
    async def test_deck_card_system_default_is_v2(self, db_session: AsyncSession):
        """Test card_system defaults to V2 when not specified."""
        from src.db.models import CardSystemVersion

        deck = Deck(
            name_en="Default Card System Deck",
            name_el="Default Card System Deck",
            name_ru="Default Card System Deck",
            description_en="Default card system test",
            description_el="Default card system test",
            description_ru="Default card system test",
            level=DeckLevel.A1,
            is_premium=False,
            # card_system not specified - should default to V2
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.card_system == CardSystemVersion.V2
        assert deck.card_system == "V2"

    @pytest.mark.asyncio
    async def test_deck_card_system_update_v1_to_v2(self, db_session: AsyncSession):
        """Test updating card_system from V1 to V2."""
        from src.db.models import CardSystemVersion

        deck = Deck(
            name_en="Update Card System Deck",
            name_el="Update Card System Deck",
            name_ru="Update Card System Deck",
            level=DeckLevel.A1,
            is_premium=False,
            card_system=CardSystemVersion.V1,
        )
        db_session.add(deck)
        await db_session.commit()

        # Update card_system
        deck.card_system = CardSystemVersion.V2
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.card_system == CardSystemVersion.V2
        assert deck.card_system == "V2"

    @pytest.mark.asyncio
    async def test_deck_card_system_update_independent(self, db_session: AsyncSession):
        """Test updating card_system does not affect other fields."""
        from src.db.models import CardSystemVersion

        deck = Deck(
            name_en="Independence Test Deck",
            name_el="Independence Test Deck",
            name_ru="Independence Test Deck",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=True,
            card_system=CardSystemVersion.V1,
        )
        db_session.add(deck)
        await db_session.commit()

        # Update card_system only
        deck.card_system = CardSystemVersion.V2
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.card_system == CardSystemVersion.V2
        assert deck.is_active is True  # Should remain unchanged
        assert deck.is_premium is True  # Should remain unchanged
        assert deck.level == DeckLevel.A1  # Should remain unchanged
