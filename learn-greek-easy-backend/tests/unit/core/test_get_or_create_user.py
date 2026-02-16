"""Unit tests for get_or_create_user auto-provisioning logic.

Tests cover:
- Existing user returned without INSERT
- New user created with default UserSettings
- Email-based upsert (updates supabase_id if email exists)
- Missing email handled with placeholder
- Race condition handling (concurrent first-login)
- Settings relationship eagerly loaded
"""

from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_or_create_user
from src.core.supabase_auth import SupabaseUserClaims
from src.db.models import User, UserSettings

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def sample_claims():
    """Provide sample Supabase token claims."""
    return SupabaseUserClaims(
        supabase_id=str(uuid4()),
        email="newuser@example.com",
        full_name="New User",
    )


@pytest.fixture
def claims_without_email():
    """Provide claims without email (phone-only auth)."""
    return SupabaseUserClaims(
        supabase_id=str(uuid4()),
        email=None,
        full_name="Phone User",
    )


# =============================================================================
# Existing User Tests
# =============================================================================


class TestExistingUser:
    """Tests for returning existing users."""

    @pytest.mark.asyncio
    async def test_existing_user_returned_no_insert(self, db_session: AsyncSession, sample_claims):
        """Test that existing user is returned without creating new record."""
        # Create existing user
        existing_user = User(
            supabase_id=sample_claims.supabase_id,
            email="existing@example.com",
            full_name="Existing User",
            is_active=True,
            is_superuser=False,
        )
        db_session.add(existing_user)
        await db_session.flush()

        existing_settings = UserSettings(
            user_id=existing_user.id,
            daily_goal=20,
            email_notifications=True,
        )
        db_session.add(existing_settings)
        await db_session.commit()

        # Get initial count
        from sqlalchemy import func, select

        count_stmt = select(func.count()).select_from(User)
        result = await db_session.execute(count_stmt)
        initial_count = result.scalar()

        # Call get_or_create_user
        user = await get_or_create_user(db_session, sample_claims)

        # Verify no new user created
        result = await db_session.execute(count_stmt)
        final_count = result.scalar()
        assert final_count == initial_count

        # Verify same user returned
        assert user.id == existing_user.id
        assert user.supabase_id == sample_claims.supabase_id

    @pytest.mark.asyncio
    async def test_existing_user_settings_loaded(self, db_session: AsyncSession, sample_claims):
        """Test that settings relationship is eagerly loaded."""
        # Create existing user with settings
        existing_user = User(
            supabase_id=sample_claims.supabase_id,
            email="existing@example.com",
            full_name="Existing User",
            is_active=True,
            is_superuser=False,
        )
        db_session.add(existing_user)
        await db_session.flush()

        existing_settings = UserSettings(
            user_id=existing_user.id,
            daily_goal=30,
            email_notifications=False,
        )
        db_session.add(existing_settings)
        await db_session.commit()

        # Get user
        user = await get_or_create_user(db_session, sample_claims)

        # Verify settings loaded (no lazy load error)
        assert user.settings is not None
        assert user.settings.daily_goal == 30
        assert user.settings.email_notifications is False


# =============================================================================
# New User Tests
# =============================================================================


class TestNewUser:
    """Tests for creating new users."""

    @pytest.mark.asyncio
    async def test_new_user_created_with_default_settings(
        self, db_session: AsyncSession, sample_claims
    ):
        """Test new user is created with default UserSettings."""
        user = await get_or_create_user(db_session, sample_claims)

        assert user is not None
        assert user.id is not None
        assert user.supabase_id == sample_claims.supabase_id
        assert user.email == sample_claims.email
        assert user.full_name == sample_claims.full_name
        assert user.is_active is True
        assert user.is_superuser is False

        # Verify settings created with defaults
        assert user.settings is not None
        assert user.settings.daily_goal == 20
        assert user.settings.email_notifications is True

    @pytest.mark.asyncio
    async def test_new_user_fields_from_claims(self, db_session: AsyncSession, sample_claims):
        """Test that new user fields are populated from claims."""
        user = await get_or_create_user(db_session, sample_claims)

        assert user.supabase_id == sample_claims.supabase_id
        assert user.email == sample_claims.email
        assert user.full_name == sample_claims.full_name
        assert user.is_active is True
        assert user.is_superuser is False

    @pytest.mark.asyncio
    async def test_missing_email_uses_placeholder(
        self, db_session: AsyncSession, claims_without_email
    ):
        """Test that missing email results in placeholder email."""
        user = await get_or_create_user(db_session, claims_without_email)

        assert user is not None
        expected_email = f"{claims_without_email.supabase_id}@supabase.placeholder"
        assert user.email == expected_email


# =============================================================================
# Email-Based Upsert Tests
# =============================================================================


class TestEmailUpsert:
    """Tests for email-based upsert behavior."""

    @pytest.mark.asyncio
    async def test_email_match_updates_supabase_id(self, db_session: AsyncSession, sample_claims):
        """Test that user with same email gets supabase_id updated (upsert)."""
        # Create existing user with the same email but different supabase_id
        old_supabase_id = str(uuid4())
        existing_user = User(
            supabase_id=old_supabase_id,  # Different supabase_id
            email=sample_claims.email,  # Same email
            full_name="Other User",
            is_active=True,
            is_superuser=False,
        )
        db_session.add(existing_user)
        await db_session.flush()

        existing_settings = UserSettings(
            user_id=existing_user.id,
            daily_goal=20,
            email_notifications=True,
        )
        db_session.add(existing_settings)
        await db_session.commit()

        # Call get_or_create_user with same email but different supabase_id
        # Should update supabase_id (Supabase Auth is source of truth)
        user = await get_or_create_user(db_session, sample_claims)

        # Verify same user returned (by ID)
        assert user.id == existing_user.id
        # Verify supabase_id was updated
        assert user.supabase_id == sample_claims.supabase_id
        assert user.supabase_id != old_supabase_id
        # Verify email unchanged
        assert user.email == sample_claims.email
        # Verify settings relationship loaded
        assert user.settings is not None


# =============================================================================
# Race Condition Tests
# =============================================================================


class TestRaceConditions:
    """Tests for concurrent first-login race condition handling."""

    @pytest.mark.asyncio
    async def test_race_condition_on_supabase_id_requeues(
        self, db_session: AsyncSession, sample_claims
    ):
        """Test IntegrityError on supabase_id causes re-query."""
        # This test simulates the race condition where:
        # 1. Request A checks: user doesn't exist
        # 2. Request B checks: user doesn't exist
        # 3. Request B creates user and commits
        # 4. Request A tries to create user -> IntegrityError
        # 5. Request A re-queries and returns the user created by Request B

        # First, create a user "from another request" before calling get_or_create_user
        # We'll patch flush to raise IntegrityError on first call
        other_user = User(
            supabase_id=sample_claims.supabase_id,
            email="other_request@example.com",
            full_name="Other Request",
            is_active=True,
            is_superuser=False,
        )
        db_session.add(other_user)
        await db_session.flush()

        other_settings = UserSettings(
            user_id=other_user.id,
            daily_goal=20,
            email_notifications=True,
        )
        db_session.add(other_settings)
        await db_session.commit()

        # Now call get_or_create_user - it should find the existing user
        # We'll simulate the race by patching flush to raise IntegrityError
        original_flush = db_session.flush
        flush_called = False

        async def mock_flush_with_race():
            nonlocal flush_called
            if not flush_called:
                flush_called = True
                # Raise IntegrityError to simulate race condition
                raise IntegrityError("duplicate key", None, None)
            else:
                # Subsequent flushes: normal behavior
                await original_flush()

        with patch.object(db_session, "flush", side_effect=mock_flush_with_race):
            user = await get_or_create_user(db_session, sample_claims)

        # Verify we got the user created by "the other request"
        assert user is not None
        assert user.supabase_id == sample_claims.supabase_id
        assert user.email == "other_request@example.com"
        assert user.settings is not None

    @pytest.mark.asyncio
    async def test_unexpected_integrity_error_raises(self, db_session: AsyncSession, sample_claims):
        """Test that unexpected IntegrityError is re-raised."""

        # Simulate an unexpected IntegrityError (not from supabase_id constraint)
        # where re-query by supabase_id returns None
        async def mock_flush_with_unexpected_error():
            # Raise IntegrityError on an unexpected constraint
            raise IntegrityError("unexpected constraint violation", None, None)

        with patch.object(db_session, "flush", side_effect=mock_flush_with_unexpected_error):
            with pytest.raises(IntegrityError):
                await get_or_create_user(db_session, sample_claims)
