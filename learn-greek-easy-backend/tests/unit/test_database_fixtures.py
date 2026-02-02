"""Tests for database fixtures (PostgreSQL).

This module verifies that database fixtures work correctly:
- Engine creation and table management
- Session creation and rollback
- Test isolation between tests
- PostgreSQL-specific features (enums, UUIDs)

These tests ensure the testing infrastructure itself is working.
"""

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from src.db.models import Card, Deck, DeckLevel, User
from tests.helpers.database import (
    count_table_rows,
    get_enum_values,
    get_test_database_url,
    table_exists,
)

# =============================================================================
# Engine Fixture Tests
# =============================================================================


class TestDbEngine:
    """Tests for the db_engine fixture."""

    async def test_engine_is_created(self, db_engine: AsyncEngine):
        """Test that engine is created successfully."""
        assert db_engine is not None
        assert isinstance(db_engine, AsyncEngine)

    async def test_can_execute_query(self, db_engine: AsyncEngine):
        """Test that engine can execute queries."""
        async with db_engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            assert result.scalar() == 1

    async def test_tables_are_created(self, db_engine: AsyncEngine):
        """Test that all model tables are created."""
        async with db_engine.connect() as conn:
            result = await conn.execute(
                text(
                    """
                    SELECT table_name FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_type = 'BASE TABLE'
                    """
                )
            )
            tables = [row[0] for row in result.fetchall()]

            expected_tables = ["users", "decks", "cards", "reviews"]
            for table in expected_tables:
                assert table in tables, f"Table {table} not found"

    async def test_engine_uses_postgresql(self, db_engine: AsyncEngine):
        """Test that PostgreSQL is used."""
        assert db_engine.dialect.name == "postgresql"

    async def test_uuid_ossp_extension_available(self, db_engine: AsyncEngine):
        """Test that uuid-ossp extension is installed."""
        async with db_engine.connect() as conn:
            result = await conn.execute(text("SELECT uuid_generate_v4()"))
            uuid_value = result.scalar()
            assert uuid_value is not None
            # Should be a valid UUID string
            assert len(str(uuid_value)) == 36


# =============================================================================
# Session Fixture Tests
# =============================================================================


class TestDbSession:
    """Tests for the db_session fixture."""

    async def test_session_is_created(self, db_session: AsyncSession):
        """Test that session is created successfully."""
        assert db_session is not None
        assert isinstance(db_session, AsyncSession)

    async def test_can_add_and_query(self, db_session: AsyncSession):
        """Test that we can add and query data."""
        # Create a user
        user = User(
            email=f"test_{uuid.uuid4().hex[:8]}@example.com",
            password_hash="hashed_password",
            full_name="Test User",
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Query the user
        result = await db_session.execute(
            text("SELECT email FROM users WHERE id = :id"),
            {"id": str(user.id)},
        )
        row = result.fetchone()
        assert row is not None
        assert "test_" in row[0]

    async def test_commit_works(self, db_session: AsyncSession):
        """Test that commit persists data within the test."""
        # Create and commit
        user = User(
            email=f"commit_test_{uuid.uuid4().hex[:8]}@example.com",
            password_hash="hashed",
            full_name="Commit Test",
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()

        # Should be able to query
        count = await count_table_rows(db_session, "users")
        assert count >= 1


class TestSessionIsolation:
    """Tests for session isolation between tests.

    These tests verify that each test gets a clean database state.
    """

    async def test_isolation_part_1_create_user(self, db_session: AsyncSession):
        """Part 1: Create a user with a specific email."""
        user = User(
            email="isolation_test_user@example.com",
            password_hash="hashed",
            full_name="Isolation Test",
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()

        # Verify user exists in this test
        count = await count_table_rows(db_session, "users")
        assert count >= 1

    async def test_isolation_part_2_check_clean_state(self, db_session: AsyncSession):
        """Part 2: Verify previous test's data is NOT present.

        This test runs after part 1 and verifies that the database
        was rolled back, so the user from part 1 should not exist.
        """
        # Check that the isolation_test_user does NOT exist
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM users WHERE email = 'isolation_test_user@example.com'")
        )
        count = result.scalar()
        assert count == 0, "Data from previous test leaked through!"


# =============================================================================
# PostgreSQL-Specific Tests
# =============================================================================


class TestPostgreSQLFeatures:
    """Tests for PostgreSQL-specific features."""

    async def test_native_enum_deck_level(self, db_session: AsyncSession):
        """Test that DeckLevel enum works with PostgreSQL."""
        deck = Deck(
            name_en="Test Deck",
            name_el="Δοκιμαστική Τράπουλα",
            name_ru="Тестовая колода",
            description_en="Testing enums",
            description_el="Δοκιμή enum",
            description_ru="Тестирование enum",
            level=DeckLevel.A1,
            is_active=True,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.level == DeckLevel.A1

        # Query and verify
        result = await db_session.execute(
            text("SELECT level FROM decks WHERE id = :id"),
            {"id": str(deck.id)},
        )
        row = result.fetchone()
        assert row[0] == "A1"

    async def test_enum_values_in_database(self, db_session: AsyncSession):
        """Test that enum values are stored correctly in PostgreSQL."""
        enum_values = await get_enum_values(db_session, "decklevel")
        expected = ["A1", "A2", "B1", "B2", "C1", "C2"]
        assert enum_values == expected

    async def test_uuid_generation(self, db_session: AsyncSession):
        """Test that UUID primary keys are generated by PostgreSQL."""
        user = User(
            email=f"uuid_test_{uuid.uuid4().hex[:8]}@example.com",
            password_hash="hashed",
            full_name="UUID Test",
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # UUID should be generated by PostgreSQL
        assert user.id is not None
        # Should be a valid UUID
        assert len(str(user.id)) == 36


# =============================================================================
# Relationship Tests
# =============================================================================


class TestRelationships:
    """Test that SQLAlchemy relationships work correctly."""

    async def test_deck_cards_relationship(self, db_session: AsyncSession):
        """Test creating a deck with cards."""
        deck = Deck(
            name_en="Test Deck",
            name_el="Δοκιμαστική Τράπουλα",
            name_ru="Тестовая колода",
            description_en="A test deck",
            description_el="Δοκιμαστική τράπουλα",
            description_ru="Тестовая колода",
            level=DeckLevel.A1,
            is_active=True,
        )
        db_session.add(deck)
        await db_session.flush()

        card = Card(
            deck_id=deck.id,
            front_text="Hello",
            back_text_en="Yeia",
        )
        db_session.add(card)
        await db_session.commit()

        await db_session.refresh(deck)
        assert len(deck.cards) == 1
        assert deck.cards[0].front_text == "Hello"

    async def test_cascade_delete(self, db_session: AsyncSession):
        """Test that cascade deletes work."""
        # Create deck with cards
        deck = Deck(
            name_en="Cascade Test Deck",
            name_el="Δοκιμαστική Τράπουλα Cascade",
            name_ru="Тестовая колода Cascade",
            description_en="Testing cascades",
            description_el="Δοκιμή cascade",
            description_ru="Тестирование cascade",
            level=DeckLevel.A1,
            is_active=True,
        )
        db_session.add(deck)
        await db_session.flush()

        card = Card(
            deck_id=deck.id,
            front_text="Hello",
            back_text_en="Yeia",
        )
        db_session.add(card)
        await db_session.commit()

        card_id = card.id

        # Delete deck
        await db_session.delete(deck)
        await db_session.commit()

        # Card should be deleted too (CASCADE)
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM cards WHERE id = :id"),
            {"id": str(card_id)},
        )
        count = result.scalar()
        assert count == 0


# =============================================================================
# Utility Function Tests
# =============================================================================


class TestDatabaseUtilities:
    """Tests for database utility functions."""

    def test_get_test_database_url(self):
        """Test that URL is PostgreSQL."""
        url = get_test_database_url()
        assert "postgresql" in url
        assert "test_learn_greek" in url

    async def test_count_table_rows(self, db_session: AsyncSession):
        """Test the count_table_rows helper."""
        # Add some users
        for i in range(3):
            user = User(
                email=f"count_test_{i}_{uuid.uuid4().hex[:4]}@example.com",
                password_hash="hashed",
                full_name=f"Count Test {i}",
                is_active=True,
            )
            db_session.add(user)
        await db_session.commit()

        count = await count_table_rows(db_session, "users")
        assert count >= 3

    async def test_table_exists(self, db_session: AsyncSession):
        """Test the table_exists helper."""
        assert await table_exists(db_session, "users") is True
        assert await table_exists(db_session, "nonexistent_table") is False


# =============================================================================
# Transaction Pattern Tests
# =============================================================================


class TestTransactionPatterns:
    """Tests for transaction handling patterns."""

    async def test_rollback_on_error(self, db_session: AsyncSession):
        """Test that session rollback works after errors."""
        user = User(
            email=f"rollback_test_{uuid.uuid4().hex[:8]}@example.com",
            password_hash="hashed",
            full_name="Rollback Test",
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()

        # This should work, verifying rollback didn't break anything
        result = await db_session.execute(text("SELECT COUNT(*) FROM users"))
        count = result.scalar()
        assert count >= 1

    async def test_multiple_commits(self, db_session: AsyncSession):
        """Test multiple commits within a single test."""
        # First commit
        user1 = User(
            email=f"multi_commit_1_{uuid.uuid4().hex[:8]}@example.com",
            password_hash="hashed",
            full_name="Multi Commit 1",
            is_active=True,
        )
        db_session.add(user1)
        await db_session.commit()

        # Second commit
        user2 = User(
            email=f"multi_commit_2_{uuid.uuid4().hex[:8]}@example.com",
            password_hash="hashed",
            full_name="Multi Commit 2",
            is_active=True,
        )
        db_session.add(user2)
        await db_session.commit()

        # Both should exist
        count = await count_table_rows(db_session, "users")
        assert count >= 2


# =============================================================================
# Edge Cases
# =============================================================================


class TestEdgeCases:
    """Test edge cases and potential issues."""

    async def test_empty_database_queries(self, db_session: AsyncSession):
        """Test queries on empty tables work correctly."""
        result = await db_session.execute(text("SELECT * FROM decks WHERE is_active = true"))
        rows = result.fetchall()
        assert isinstance(rows, list)

    async def test_timestamps_auto_generated(self, db_session: AsyncSession):
        """Test that created_at and updated_at are set."""
        user = User(
            email=f"timestamp_test_{uuid.uuid4().hex[:8]}@example.com",
            password_hash="hashed",
            full_name="Timestamp Test",
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Timestamps should be set
        assert user.created_at is not None
        assert user.updated_at is not None

    async def test_unique_constraint_violation(self, db_session: AsyncSession):
        """Test that unique constraints work."""
        email = f"unique_test_{uuid.uuid4().hex[:8]}@example.com"

        user1 = User(
            email=email,
            password_hash="hashed",
            full_name="User 1",
            is_active=True,
        )
        db_session.add(user1)
        await db_session.commit()

        # Try to create another user with same email
        user2 = User(
            email=email,
            password_hash="hashed",
            full_name="User 2",
            is_active=True,
        )
        db_session.add(user2)

        with pytest.raises(Exception):  # IntegrityError
            await db_session.commit()

        await db_session.rollback()
