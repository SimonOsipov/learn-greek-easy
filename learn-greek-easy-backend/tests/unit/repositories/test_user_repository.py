"""Unit tests for UserRepository and UserSettingsRepository.

This module tests the auth-to-user bridge that runs on every authenticated
request. Identity correctness must be pinned to prevent denying valid users
or leaking data across accounts.

UserRepository:
- get_by_supabase_id: Returns correct user by exact supabase_id, None for unknown
  (a second user is seeded to rule out cross-row leakage)
- get_by_email: Exact-match (case-sensitive) lookup behavior
- get_with_settings: Eagerly loads the settings relationship (lazy="raise")
- deactivate: Flips is_active on the target only; raises NotFoundException on 404

UserSettingsRepository:
- get_by_user_id: Returns settings for a specific user, None when none exist

Tests use real database fixtures to verify SQL queries work correctly.
"""

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundException
from src.db.models import User, UserSettings
from src.repositories.user import UserRepository, UserSettingsRepository

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def supabase_user(db_session: AsyncSession) -> User:
    """Create a user with a supabase_id for auth-bridge testing."""
    user = User(
        email="supabase_user@example.com",
        full_name="Supabase User",
        is_active=True,
        supabase_id="sub-aaaa-1111",
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def other_supabase_user(db_session: AsyncSession) -> User:
    """Create a second distinct user to rule out cross-row leakage."""
    user = User(
        email="other_supabase_user@example.com",
        full_name="Other Supabase User",
        is_active=True,
        supabase_id="sub-bbbb-2222",
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


# =============================================================================
# Test get_by_supabase_id
# =============================================================================


class TestGetBySupabaseId:
    """Tests for get_by_supabase_id method."""

    @pytest.mark.asyncio
    async def test_returns_correct_user_by_exact_supabase_id(
        self,
        db_session: AsyncSession,
        supabase_user: User,
        other_supabase_user: User,
    ):
        """Should return the user matching the exact supabase_id, not a sibling row."""
        repo = UserRepository(db_session)

        result = await repo.get_by_supabase_id("sub-aaaa-1111")

        assert result is not None
        assert result.id == supabase_user.id
        assert result.supabase_id == "sub-aaaa-1111"
        # Rule out cross-row leakage: must not be the other seeded user
        assert result.id != other_supabase_user.id

    @pytest.mark.asyncio
    async def test_returns_none_for_unknown_supabase_id(
        self,
        db_session: AsyncSession,
        supabase_user: User,
        other_supabase_user: User,
    ):
        """Should return None when no user matches, even with other users present."""
        repo = UserRepository(db_session)

        result = await repo.get_by_supabase_id("sub-does-not-exist")

        assert result is None

    @pytest.mark.asyncio
    async def test_supabase_id_match_is_exact(
        self,
        db_session: AsyncSession,
        supabase_user: User,
    ):
        """Should not match on a substring or differently-cased supabase_id."""
        repo = UserRepository(db_session)

        assert await repo.get_by_supabase_id("sub-aaaa") is None
        assert await repo.get_by_supabase_id("SUB-AAAA-1111") is None


# =============================================================================
# Test get_by_email
# =============================================================================


class TestGetByEmail:
    """Tests for get_by_email method."""

    @pytest.mark.asyncio
    async def test_returns_user_for_exact_email(
        self,
        db_session: AsyncSession,
        supabase_user: User,
        other_supabase_user: User,
    ):
        """Should return the user matching the exact email."""
        repo = UserRepository(db_session)

        result = await repo.get_by_email("supabase_user@example.com")

        assert result is not None
        assert result.id == supabase_user.id
        assert result.id != other_supabase_user.id

    @pytest.mark.asyncio
    async def test_returns_none_for_unknown_email(
        self,
        db_session: AsyncSession,
        supabase_user: User,
    ):
        """Should return None when no user has the given email."""
        repo = UserRepository(db_session)

        result = await repo.get_by_email("nobody@example.com")

        assert result is None

    @pytest.mark.asyncio
    async def test_email_match_is_case_sensitive(
        self,
        db_session: AsyncSession,
        supabase_user: User,
    ):
        """Pins current behavior: email lookup is case-sensitive (exact match).

        The query uses a plain equality on the email column, so a
        differently-cased address does not match.
        """
        repo = UserRepository(db_session)

        result = await repo.get_by_email("Supabase_User@Example.com")

        assert result is None


# =============================================================================
# Test get_with_settings
# =============================================================================


class TestGetWithSettings:
    """Tests for get_with_settings method."""

    @pytest.mark.asyncio
    async def test_populates_settings_relationship(
        self,
        db_session: AsyncSession,
        sample_user_with_settings: User,
    ):
        """Should eagerly load the settings relationship without triggering lazy='raise'."""
        repo = UserRepository(db_session)

        result = await repo.get_with_settings(sample_user_with_settings.id)

        assert result is not None
        assert result.id == sample_user_with_settings.id
        # settings is lazy="raise"; accessing it only works because it was
        # eagerly loaded via selectinload in the repository method.
        assert result.settings is not None
        assert result.settings.daily_goal == 25

    @pytest.mark.asyncio
    async def test_settings_is_none_when_user_has_no_settings(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ):
        """Should load a None settings relationship for a user without settings."""
        repo = UserRepository(db_session)

        result = await repo.get_with_settings(sample_user.id)

        assert result is not None
        assert result.id == sample_user.id
        # One-to-one relationship resolves to None when no row exists.
        assert result.settings is None

    @pytest.mark.asyncio
    async def test_returns_none_for_nonexistent_user(
        self,
        db_session: AsyncSession,
    ):
        """Should return None when the user does not exist."""
        repo = UserRepository(db_session)

        result = await repo.get_with_settings(uuid4())

        assert result is None


# =============================================================================
# Test deactivate
# =============================================================================


class TestDeactivate:
    """Tests for deactivate method."""

    @pytest.mark.asyncio
    async def test_deactivates_target_user(
        self,
        db_session: AsyncSession,
        supabase_user: User,
    ):
        """Should set is_active to False on the target user."""
        repo = UserRepository(db_session)
        assert supabase_user.is_active is True

        result = await repo.deactivate(supabase_user.id)

        assert result.id == supabase_user.id
        assert result.is_active is False

    @pytest.mark.asyncio
    async def test_deactivate_touches_only_target(
        self,
        db_session: AsyncSession,
        supabase_user: User,
        other_supabase_user: User,
    ):
        """Should not affect any other user's is_active flag."""
        repo = UserRepository(db_session)

        await repo.deactivate(supabase_user.id)

        # The other user must remain active.
        untouched = await repo.get(other_supabase_user.id)
        assert untouched is not None
        assert untouched.is_active is True

    @pytest.mark.asyncio
    async def test_deactivate_raises_for_nonexistent_user(
        self,
        db_session: AsyncSession,
    ):
        """Should raise NotFoundException when the user does not exist."""
        repo = UserRepository(db_session)

        with pytest.raises(NotFoundException):
            await repo.deactivate(uuid4())


# =============================================================================
# Test UserSettingsRepository.get_by_user_id
# =============================================================================


class TestUserSettingsGetByUserId:
    """Tests for UserSettingsRepository.get_by_user_id method."""

    @pytest.mark.asyncio
    async def test_returns_settings_for_user(
        self,
        db_session: AsyncSession,
        sample_user_with_settings: User,
    ):
        """Should return the settings row belonging to the user."""
        repo = UserSettingsRepository(db_session)

        result = await repo.get_by_user_id(sample_user_with_settings.id)

        assert result is not None
        assert isinstance(result, UserSettings)
        assert result.user_id == sample_user_with_settings.id
        assert result.daily_goal == 25

    @pytest.mark.asyncio
    async def test_returns_none_when_no_settings(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ):
        """Should return None when the user has no settings row."""
        repo = UserSettingsRepository(db_session)

        result = await repo.get_by_user_id(sample_user.id)

        assert result is None
