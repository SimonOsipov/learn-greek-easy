"""Unit tests for authentication dependencies.

Tests cover:
- get_current_user: Supabase token verification + auto-provisioning
- get_current_superuser: Superuser privilege check
- get_current_user_optional: Optional authentication for mixed endpoints
- get_or_create_user (cache): read-through cache over supabase_id resolution (PERF-05-05)
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.dependencies import (
    get_current_superuser,
    get_current_user,
    get_current_user_optional,
    get_or_create_user,
)
from src.core.exceptions import ForbiddenException, UnauthorizedException
from src.core.supabase_auth import SupabaseUserClaims


class _FakeState:
    """Minimal request.state stand-in: getattr raises AttributeError for missing keys."""

    pass


# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def mock_request():
    """Create a mock FastAPI request with a real State-like object.

    Using _FakeState (a plain object) instead of MagicMock() ensures that
    getattr(request.state, "current_user", None) returns None until the
    dependency explicitly writes it — matching FastAPI's runtime behaviour.
    """
    request = MagicMock(spec=Request)
    request.state = _FakeState()
    return request


@pytest.fixture
def mock_user():
    """Create a mock user object."""
    user = MagicMock()
    user.id = uuid4()
    user.email = "test@example.com"
    user.full_name = "Test User"
    user.is_active = True
    user.is_superuser = False
    return user


@pytest.fixture
def mock_superuser():
    """Create a mock superuser object."""
    user = MagicMock()
    user.id = uuid4()
    user.email = "admin@example.com"
    user.full_name = "Admin User"
    user.is_active = True
    user.is_superuser = True
    return user


@pytest.fixture
def mock_inactive_user():
    """Create a mock inactive user."""
    user = MagicMock()
    user.id = uuid4()
    user.email = "inactive@example.com"
    user.full_name = "Inactive User"
    user.is_active = False
    user.is_superuser = False
    return user


@pytest.fixture
def valid_credentials():
    """Create valid HTTP authorization credentials."""
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")


@pytest.fixture
def valid_claims():
    """Create valid Supabase user claims."""
    return SupabaseUserClaims(
        supabase_id=str(uuid4()), email="test@example.com", full_name="Test User"
    )


# ============================================================================
# get_current_user Tests
# ============================================================================


class TestGetCurrentUser:
    """Tests for get_current_user dependency."""

    @pytest.mark.asyncio
    async def test_no_credentials_raises_401(self, mock_request):
        """Test that missing credentials raises UnauthorizedException."""
        mock_db = AsyncMock()

        with pytest.raises(UnauthorizedException) as exc_info:
            await get_current_user(mock_request, None, mock_db)

        assert "authentication required" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_invalid_token_raises_401(self, mock_request, valid_credentials):
        """Test that invalid token raises UnauthorizedException."""
        mock_db = AsyncMock()

        with patch("src.core.dependencies.verify_supabase_token") as mock_verify:
            from src.core.exceptions import TokenInvalidException

            mock_verify.side_effect = TokenInvalidException("Invalid token")

            with pytest.raises(UnauthorizedException):
                await get_current_user(mock_request, valid_credentials, mock_db)

    @pytest.mark.asyncio
    async def test_valid_token_returns_user(
        self, mock_request, valid_credentials, valid_claims, mock_user
    ):
        """Test that valid token returns user."""
        mock_db = AsyncMock()

        with (
            patch("src.core.dependencies.verify_supabase_token") as mock_verify,
            patch("src.core.dependencies.get_or_create_user") as mock_get_or_create,
        ):
            mock_verify.return_value = valid_claims
            mock_get_or_create.return_value = mock_user

            user = await get_current_user(mock_request, valid_credentials, mock_db)

            assert user == mock_user
            mock_verify.assert_called_once()
            mock_get_or_create.assert_called_once_with(mock_db, valid_claims)

    @pytest.mark.asyncio
    async def test_inactive_user_raises_401(
        self, mock_request, valid_credentials, valid_claims, mock_inactive_user
    ):
        """Test that inactive user raises UnauthorizedException."""
        mock_db = AsyncMock()

        with (
            patch("src.core.dependencies.verify_supabase_token") as mock_verify,
            patch("src.core.dependencies.get_or_create_user") as mock_get_or_create,
        ):
            mock_verify.return_value = valid_claims
            mock_get_or_create.return_value = mock_inactive_user

            with pytest.raises(UnauthorizedException) as exc_info:
                await get_current_user(mock_request, valid_credentials, mock_db)

            assert "deactivated" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_sets_request_state_user_email(
        self, mock_request, valid_credentials, valid_claims, mock_user
    ):
        """Test that user email is set in request.state."""
        mock_db = AsyncMock()

        with (
            patch("src.core.dependencies.verify_supabase_token") as mock_verify,
            patch("src.core.dependencies.get_or_create_user") as mock_get_or_create,
        ):
            mock_verify.return_value = valid_claims
            mock_get_or_create.return_value = mock_user

            await get_current_user(mock_request, valid_credentials, mock_db)

            assert mock_request.state.user_email == mock_user.email

    @pytest.mark.asyncio
    async def test_memoizes_user_on_request_state(
        self, mock_request, valid_credentials, valid_claims, mock_user
    ):
        """Two resolutions on the SAME request invoke get_or_create_user exactly once.

        The second call short-circuits at the request.state.current_user check
        and never touches the DB or token verification again.
        """
        mock_db = AsyncMock()

        with (
            patch("src.core.dependencies.verify_supabase_token") as mock_verify,
            patch("src.core.dependencies.get_or_create_user") as mock_get_or_create,
        ):
            mock_verify.return_value = valid_claims
            mock_get_or_create.return_value = mock_user

            # First resolution: full path through token verify + DB lookup
            user1 = await get_current_user(mock_request, valid_credentials, mock_db)
            # Second resolution on the SAME request object: short-circuit fires
            user2 = await get_current_user(mock_request, valid_credentials, mock_db)

        assert user1 is mock_user
        assert user2 is mock_user
        # get_or_create_user must have been called exactly once
        mock_get_or_create.assert_called_once()

    @pytest.mark.asyncio
    async def test_distinct_requests_resolve_independently(
        self, valid_credentials, valid_claims, mock_user
    ):
        """Two DISTINCT request objects each resolve the user independently.

        Per-request memo must NOT leak across request boundaries.
        """
        mock_db = AsyncMock()

        request_a = MagicMock(spec=Request)
        request_a.state = _FakeState()
        request_b = MagicMock(spec=Request)
        request_b.state = _FakeState()

        with (
            patch("src.core.dependencies.verify_supabase_token") as mock_verify,
            patch("src.core.dependencies.get_or_create_user") as mock_get_or_create,
        ):
            mock_verify.return_value = valid_claims
            mock_get_or_create.return_value = mock_user

            user_a = await get_current_user(request_a, valid_credentials, mock_db)
            user_b = await get_current_user(request_b, valid_credentials, mock_db)

        assert user_a is mock_user
        assert user_b is mock_user
        # Each distinct request triggers its own DB lookup
        assert mock_get_or_create.call_count == 2

    @pytest.mark.asyncio
    async def test_sets_current_user_on_request_state(
        self, mock_request, valid_credentials, valid_claims, mock_user
    ):
        """Resolved user is stored on request.state.current_user after first resolution."""
        mock_db = AsyncMock()

        with (
            patch("src.core.dependencies.verify_supabase_token") as mock_verify,
            patch("src.core.dependencies.get_or_create_user") as mock_get_or_create,
        ):
            mock_verify.return_value = valid_claims
            mock_get_or_create.return_value = mock_user

            await get_current_user(mock_request, valid_credentials, mock_db)

        assert mock_request.state.current_user is mock_user


# ============================================================================
# get_current_user_optional Tests
# ============================================================================


class TestGetCurrentUserOptional:
    """Tests for get_current_user_optional dependency."""

    @pytest.mark.asyncio
    async def test_no_credentials_returns_none(self, mock_request):
        """Test that missing credentials returns None."""
        mock_db = AsyncMock()

        user = await get_current_user_optional(mock_request, None, mock_db)

        assert user is None

    @pytest.mark.asyncio
    async def test_invalid_token_returns_none(self, mock_request, valid_credentials):
        """Test that invalid token returns None (doesn't raise)."""
        mock_db = AsyncMock()

        with patch("src.core.dependencies.verify_supabase_token") as mock_verify:
            from src.core.exceptions import TokenInvalidException

            mock_verify.side_effect = TokenInvalidException("Invalid token")

            user = await get_current_user_optional(mock_request, valid_credentials, mock_db)

            assert user is None

    @pytest.mark.asyncio
    async def test_valid_token_returns_user(
        self, mock_request, valid_credentials, valid_claims, mock_user
    ):
        """Test that valid token returns user."""
        mock_db = AsyncMock()

        with (
            patch("src.core.dependencies.verify_supabase_token") as mock_verify,
            patch("src.core.dependencies.get_or_create_user") as mock_get_or_create,
        ):
            mock_verify.return_value = valid_claims
            mock_get_or_create.return_value = mock_user

            user = await get_current_user_optional(mock_request, valid_credentials, mock_db)

            assert user == mock_user

    @pytest.mark.asyncio
    async def test_inactive_user_returns_none(
        self, mock_request, valid_credentials, valid_claims, mock_inactive_user
    ):
        """Test that inactive user returns None (doesn't raise)."""
        mock_db = AsyncMock()

        with (
            patch("src.core.dependencies.verify_supabase_token") as mock_verify,
            patch("src.core.dependencies.get_or_create_user") as mock_get_or_create,
        ):
            mock_verify.return_value = valid_claims
            mock_get_or_create.return_value = mock_inactive_user

            user = await get_current_user_optional(mock_request, valid_credentials, mock_db)

            assert user is None


# ============================================================================
# get_current_superuser Tests
# ============================================================================


class TestGetCurrentSuperuser:
    """Tests for get_current_superuser dependency."""

    @pytest.mark.asyncio
    async def test_superuser_allowed(self, mock_superuser):
        """Test that superuser is allowed."""
        # Should not raise
        result = await get_current_superuser(mock_superuser)
        assert result == mock_superuser

    @pytest.mark.asyncio
    async def test_regular_user_forbidden(self, mock_user):
        """Test that regular user is forbidden."""
        with pytest.raises(ForbiddenException) as exc_info:
            await get_current_superuser(mock_user)

        assert "superuser" in str(exc_info.value.detail).lower()


# ============================================================================
# get_or_create_user — Cache Tests (PERF-05-05)
# ============================================================================
#
# These tests verify the read-through cache layer that will be added to
# get_or_create_user in src/core/dependencies.py.
#
# Implementation contract (executor builds exactly this):
#   - At TOP of get_or_create_user: await get_cache().get("user:identity:{supabase_id}")
#     * Hit + db.get returns user  → return that user, skip the WHERE supabase_id SELECT
#     * Hit + db.get returns None  → fall through to existing query (self-heal)
#   - On EXISTING-USER return path (after real query): await get_cache().set(
#       "user:identity:{supabase_id}", {"id": ..., "is_active": ..., "is_superuser": ...},
#       ttl=settings.cache_user_identity_ttl)
#
# Patch strategy:
#   - patch("src.core.dependencies.get_cache", create=True) — create=True because the
#     import does not yet exist in dependencies.py pre-implementation.  The RED comes from
#     the LOGIC assertions, not from import/collection errors.
#   - db is AsyncMock(spec=AsyncSession); cache is AsyncMock().
# ============================================================================


def _make_claims(supabase_id: str | None = None) -> SupabaseUserClaims:
    """Build a SupabaseUserClaims with a deterministic or random supabase_id."""
    return SupabaseUserClaims(
        supabase_id=supabase_id or str(uuid4()),
        email="cache-test@example.com",
        full_name="Cache Tester",
    )


def _make_db_user(user_id: UUID | None = None) -> MagicMock:
    """Return a MagicMock that looks like an ORM User row."""
    user = MagicMock()
    user.id = user_id or uuid4()
    user.is_active = True
    user.is_superuser = False
    user.email = "cache-test@example.com"
    user.full_name = "Cache Tester"
    user.supabase_id = None  # will be set per test if needed
    user.settings = MagicMock()
    return user


def _stub_execute_for_existing_user(db: AsyncMock, user: MagicMock) -> None:
    """Wire db.execute so the first SELECT returns `user` via scalar_one_or_none().

    Mirrors the pattern used in the existing TestGetCurrentUser tests where
    db.execute is an AsyncMock and result.scalar_one_or_none() returns the user.
    """
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = user
    db.execute = AsyncMock(return_value=result_mock)


class TestGetOrCreateUserCache:
    """Tests for the read-through cache layer in get_or_create_user (PERF-05-05).

    All tests use create=True on the get_cache patch because the import statement
    (from src.core.cache import get_cache) does not exist in dependencies.py yet.
    The RED condition for each test is a logic assertion failure, not a collection error.
    """

    # -------------------------------------------------------------------------
    # i. Cache miss → DB query runs → projection stored
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_cache_miss_queries_db_and_stores_projection(self):
        """Cache miss: real supabase_id SELECT runs and the projection is stored.

        Expected (post-impl):
          - cache.get called once with the identity key
          - db.execute called (real query ran)
          - cache.set called once with key "user:identity:{supabase_id}" and a
            dict containing {"id", "is_active", "is_superuser"} matching the user

        RED reason: cache.set is never called in the current implementation.
        """
        supabase_id = str(uuid4())
        claims = _make_claims(supabase_id)
        user = _make_db_user()
        user.id = uuid4()

        db = AsyncMock(spec=AsyncSession)
        _stub_execute_for_existing_user(db, user)

        cache = AsyncMock()
        cache.get = AsyncMock(return_value=None)  # cache miss
        cache.set = AsyncMock(return_value=True)

        mock_get_cache = MagicMock(return_value=cache)

        with patch("src.core.dependencies.get_cache", mock_get_cache, create=True):
            await get_or_create_user(db, claims)

        # Real query must have run
        db.execute.assert_called()

        # Projection must be stored
        cache.set.assert_called_once()
        set_call = cache.set.call_args
        assert (
            set_call[0][0] == f"user:identity:{supabase_id}"
        ), f"Expected key 'user:identity:{supabase_id}', got {set_call[0][0]!r}"
        stored_value = set_call[0][1]
        assert "id" in stored_value, "Projection dict must include 'id'"
        assert "is_active" in stored_value, "Projection dict must include 'is_active'"
        assert "is_superuser" in stored_value, "Projection dict must include 'is_superuser'"
        assert stored_value["id"] == str(user.id), "Stored id must match user.id as string"
        assert stored_value["is_active"] == user.is_active
        assert stored_value["is_superuser"] == user.is_superuser

    # -------------------------------------------------------------------------
    # ii. Cache hit → supabase_id SELECT skipped, db.get used
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_cache_hit_skips_supabase_id_select_and_uses_db_get(self):
        """Cache hit: supabase_id WHERE SELECT is NOT executed; db.get is used instead.

        Expected (post-impl):
          - db.execute NOT called
          - db.get awaited once with (User, UUID(<uuid-str>))
          - returned object is the db.get result

        RED reason: pre-impl, db.execute is always called; db.get is never called.
        """
        from src.db.models import User  # import here to avoid collection-time side effects

        user_id = uuid4()
        supabase_id = str(uuid4())
        claims = _make_claims(supabase_id)

        cached_projection = {
            "id": str(user_id),
            "is_active": True,
            "is_superuser": False,
        }

        fetched_user = _make_db_user(user_id)

        db = AsyncMock(spec=AsyncSession)
        db.get = AsyncMock(return_value=fetched_user)

        cache = AsyncMock()
        cache.get = AsyncMock(return_value=cached_projection)
        cache.set = AsyncMock(return_value=True)

        mock_get_cache = MagicMock(return_value=cache)

        with patch("src.core.dependencies.get_cache", mock_get_cache, create=True):
            returned = await get_or_create_user(db, claims)

        # The supabase_id WHERE SELECT must NOT have run
        db.execute.assert_not_called()

        # db.get must have been called with (User, UUID(user_id_str))
        db.get.assert_awaited_once()
        get_args = db.get.call_args[0]
        assert get_args[0] is User, "db.get first arg must be the User model class"
        assert get_args[1] == user_id, f"db.get second arg must be UUID({user_id!r})"

        assert returned is fetched_user, "Returned value must be the db.get result"

    # -------------------------------------------------------------------------
    # iii. Cache hit → returned object fields match the db.get row
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_cache_hit_returns_correct_identity(self):
        """Cache hit path returns the live ORM object, not a reconstruction from the blob.

        Verifies that the returned user's id, is_active, is_superuser all come from
        the db.get ORM row — not from re-building something from the cache dict.

        RED reason: pre-impl, db.get is never called; we fall into the supabase_id path.
        """
        user_id = uuid4()
        supabase_id = str(uuid4())
        claims = _make_claims(supabase_id)

        # db.get will return a user with specific, distinct values
        orm_user = _make_db_user(user_id)
        orm_user.is_active = True
        orm_user.is_superuser = True  # non-default to ensure we're reading the ORM obj

        cached_projection = {
            "id": str(user_id),
            "is_active": True,
            "is_superuser": True,
        }

        db = AsyncMock(spec=AsyncSession)
        db.get = AsyncMock(return_value=orm_user)

        cache = AsyncMock()
        cache.get = AsyncMock(return_value=cached_projection)
        cache.set = AsyncMock(return_value=True)

        mock_get_cache = MagicMock(return_value=cache)

        with patch("src.core.dependencies.get_cache", mock_get_cache, create=True):
            returned = await get_or_create_user(db, claims)

        # Must be the exact ORM object, not a proxy or reconstruction
        assert returned is orm_user, "Must return the live ORM object from db.get"
        assert returned.id == user_id
        assert returned.is_active is True
        assert returned.is_superuser is True

    # -------------------------------------------------------------------------
    # iv. Cache miss → cache.set called with the configured TTL and full payload
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_identity_cache_set_uses_configured_ttl(self):
        """Cold miss on an existing user: cache.set gets settings.cache_user_identity_ttl
        and the {id, is_active, is_superuser} payload (PERF-16-02).

        This pins BOTH the TTL source (must read the live setting, not a hardcoded
        number -- important now that PERF-16-02 raises the default from 20s to
        900s) and the payload shape, in one assertion. Overlaps in intent with
        test_cache_miss_queries_db_and_stores_projection (payload) and
        test_projection_stored_with_short_ttl (TTL) above -- kept as a combined
        regression guard so a future change can't satisfy one half while
        breaking the other.
        """
        supabase_id = str(uuid4())
        claims = _make_claims(supabase_id)
        user = _make_db_user()

        db = AsyncMock(spec=AsyncSession)
        _stub_execute_for_existing_user(db, user)

        cache = AsyncMock()
        cache.get = AsyncMock(return_value=None)
        cache.set = AsyncMock(return_value=True)

        mock_get_cache = MagicMock(return_value=cache)

        with patch("src.core.dependencies.get_cache", mock_get_cache, create=True):
            await get_or_create_user(db, claims)

        cache.set.assert_called_once_with(
            f"user:identity:{supabase_id}",
            {"id": str(user.id), "is_active": user.is_active, "is_superuser": user.is_superuser},
            ttl=settings.cache_user_identity_ttl,
        )

    # -------------------------------------------------------------------------
    # v. Projection stored with the configured TTL (settings-bound, not a range)
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_projection_stored_with_short_ttl(self):
        """Cache miss + existing user: cache.set TTL equals settings.cache_user_identity_ttl.

        PERF-16-02 (F1): re-pinned to the live setting instead of a loose [15, 30]
        range. The setting now exists (it shipped in PERF-05-05 and PERF-16-02
        raises its default from 20s to 900s), so referencing it directly is safe
        and makes this test immune to future TTL-default changes.

        RED reason (pre-PERF-16-02): none -- get_or_create_user already reads
        settings.cache_user_identity_ttl, so this assertion holds against the
        current implementation. It is a regression guard, not a not-implemented
        red.
        """
        supabase_id = str(uuid4())
        claims = _make_claims(supabase_id)
        user = _make_db_user()

        db = AsyncMock(spec=AsyncSession)
        _stub_execute_for_existing_user(db, user)

        cache = AsyncMock()
        cache.get = AsyncMock(return_value=None)
        cache.set = AsyncMock(return_value=True)

        mock_get_cache = MagicMock(return_value=cache)

        with patch("src.core.dependencies.get_cache", mock_get_cache, create=True):
            await get_or_create_user(db, claims)

        cache.set.assert_called_once()
        # Extract the ttl keyword or positional argument
        set_call = cache.set.call_args
        # cache.set(key, value, ttl=N) or cache.set(key, value, N)
        ttl_value = (
            set_call.kwargs.get("ttl")
            if set_call.kwargs.get("ttl") is not None
            else (set_call[0][2] if len(set_call[0]) > 2 else None)
        )
        assert ttl_value is not None, "cache.set must be called with a ttl argument"
        assert (
            ttl_value == settings.cache_user_identity_ttl
        ), f"TTL must equal settings.cache_user_identity_ttl ({settings.cache_user_identity_ttl}); got {ttl_value}"

    # -------------------------------------------------------------------------
    # v. Cache disabled (get→None, set→False) → existing query runs, no db.get
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_cache_disabled_falls_back_to_query(self):
        """When cache is effectively disabled (get returns None), the existing DB path runs.

        This simulates cache unavailability by returning None from cache.get and False
        from cache.set (same as what CacheService does when Redis is down).

        - db.execute must be called (real supabase_id lookup)
        - db.get must NOT be called (that's the cache-hit fast path)
        - No exception raised; valid user returned

        NOTE: This is expected to be GREEN pre-implementation because the current code
        does not call get_cache at all — the supabase_id query always runs and db.get
        is never used.  This test is a regression guard ensuring the fallback path
        remains correct after caching is introduced.
        """
        supabase_id = str(uuid4())
        claims = _make_claims(supabase_id)
        user = _make_db_user()

        db = AsyncMock(spec=AsyncSession)
        _stub_execute_for_existing_user(db, user)

        cache = AsyncMock()
        cache.get = AsyncMock(return_value=None)  # disabled / miss
        cache.set = AsyncMock(return_value=False)  # disabled / fail

        mock_get_cache = MagicMock(return_value=cache)

        with patch("src.core.dependencies.get_cache", mock_get_cache, create=True):
            returned = await get_or_create_user(db, claims)

        # Existing query must have run
        db.execute.assert_called()

        # Fast path (db.get) must NOT have been used
        db.get.assert_not_called()

        # Must return a valid user without raising
        assert returned is not None

    # -------------------------------------------------------------------------
    # vi. Cache hit + db.get → None → self-heal: fall through to db.execute
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_cache_hit_with_deleted_user_falls_back(self):
        """Cache hit but db.get returns None (user deleted) → falls back to supabase_id SELECT.

        Expected (post-impl):
          - db.get called first (returns None)
          - db.execute then called (supabase_id WHERE fallback)

        RED reason: pre-impl, db.get is never called; db.execute always runs without
        the cache-hit branch existing.  The assertion db.get.assert_called() will fail.
        """
        user_id = uuid4()
        supabase_id = str(uuid4())
        claims = _make_claims(supabase_id)

        # User that will be found on the fallback query
        fallback_user = _make_db_user(user_id)

        db = AsyncMock(spec=AsyncSession)
        db.get = AsyncMock(return_value=None)  # user deleted from DB
        _stub_execute_for_existing_user(db, fallback_user)  # fallback finds the user

        cache = AsyncMock()
        cache.get = AsyncMock(
            return_value={
                "id": str(user_id),
                "is_active": True,
                "is_superuser": False,
            }
        )
        cache.set = AsyncMock(return_value=True)

        mock_get_cache = MagicMock(return_value=cache)

        with patch("src.core.dependencies.get_cache", mock_get_cache, create=True):
            returned = await get_or_create_user(db, claims)

        # db.get must have been attempted (cache hit fast path entered)
        db.get.assert_called()

        # db.execute must have been called (self-heal: fallback to real query)
        db.execute.assert_called()

        # Returned user is the fallback result, not None
        assert returned is not None

    # -------------------------------------------------------------------------
    # vii. Hit path: returned user is a real mutable ORM instance (regression)
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_returned_user_is_session_attached_mutable(self):
        """On cache hit, the returned object is a live ORM instance that supports mutation.

        Guards against a regression where the cache hit path returns a detached projection
        (e.g. a plain dict or a reconstructed dataclass) rather than an actual SQLAlchemy
        ORM object.  If a route handler or post-dependency code tries to:
          - set an attribute on the user (user.last_seen = now)
          - add it to the session (db.add(user))
        …it must not raise.

        NOTE: This test is expected to be GREEN pre-implementation because the existing
        code always goes through db.execute and returns the real ORM MagicMock.  It is a
        regression guard: once caching is wired in, the hit path must still return an
        object that behaves like an ORM instance.
        """
        user_id = uuid4()
        supabase_id = str(uuid4())
        claims = _make_claims(supabase_id)

        orm_user = _make_db_user(user_id)

        db = AsyncMock(spec=AsyncSession)
        # Stub both paths:
        #   - pre-impl (no cache): db.execute is used → stub it to return orm_user
        #   - post-impl (cache hit): db.get is used → stub it to return orm_user
        _stub_execute_for_existing_user(db, orm_user)
        db.get = AsyncMock(return_value=orm_user)

        cache = AsyncMock()
        cache.get = AsyncMock(
            return_value={
                "id": str(user_id),
                "is_active": True,
                "is_superuser": False,
            }
        )
        cache.set = AsyncMock(return_value=True)

        mock_get_cache = MagicMock(return_value=cache)

        with patch("src.core.dependencies.get_cache", mock_get_cache, create=True):
            returned = await get_or_create_user(db, claims)

        # Must be mutable — setting an attribute must not raise
        try:
            returned.last_seen = "2026-01-01T00:00:00Z"
        except (AttributeError, TypeError) as exc:
            pytest.fail(f"Setting attribute on returned user raised {type(exc).__name__}: {exc}")

        # Must be session-attachable — db.add must not raise
        try:
            db.add(returned)
        except Exception as exc:
            pytest.fail(f"db.add(returned_user) raised {type(exc).__name__}: {exc}")


# ============================================================================
# C5 — Malformed identity cache guard: corrupt entry falls through to real query
# ============================================================================


class TestGetOrCreateUserMalformedCache:
    """Tests for the malformed-cache guard added to get_or_create_user (C5 CodeRabbit fix).

    Verifies that a corrupt cached entry (bad UUID, missing key, wrong type)
    does NOT raise an exception — it falls through to the real supabase_id query.
    """

    @pytest.mark.asyncio
    async def test_malformed_uuid_in_cache_falls_through_to_db_query(self):
        """cache.get returns {"id": "not-a-uuid"} → UUID() raises → falls through.

        Expected:
          - db.get is NOT called (malformed, so cached_user_id is None)
          - db.execute IS called (the real supabase_id SELECT runs)
          - No exception raised; valid user returned
        """
        supabase_id = str(uuid4())
        claims = _make_claims(supabase_id)
        user = _make_db_user()

        db = AsyncMock(spec=AsyncSession)
        _stub_execute_for_existing_user(db, user)

        cache = AsyncMock()
        cache.get = AsyncMock(return_value={"id": "not-a-uuid"})  # malformed UUID
        cache.set = AsyncMock(return_value=True)

        mock_get_cache = MagicMock(return_value=cache)

        with patch("src.core.dependencies.get_cache", mock_get_cache, create=True):
            returned = await get_or_create_user(db, claims)

        # db.get must NOT be called (malformed → cached_user_id is None)
        db.get.assert_not_called()
        # The real supabase_id SELECT must have run
        db.execute.assert_called()
        # Must return the valid user from the DB query
        assert returned is user

    @pytest.mark.asyncio
    async def test_missing_id_key_in_cache_falls_through_to_db_query(self):
        """cache.get returns {} (missing 'id' key) → KeyError → falls through.

        Expected:
          - db.get is NOT called
          - db.execute IS called (real query)
          - No exception raised
        """
        supabase_id = str(uuid4())
        claims = _make_claims(supabase_id)
        user = _make_db_user()

        db = AsyncMock(spec=AsyncSession)
        _stub_execute_for_existing_user(db, user)

        cache = AsyncMock()
        cache.get = AsyncMock(return_value={})  # missing 'id' key
        cache.set = AsyncMock(return_value=True)

        mock_get_cache = MagicMock(return_value=cache)

        with patch("src.core.dependencies.get_cache", mock_get_cache, create=True):
            returned = await get_or_create_user(db, claims)

        db.get.assert_not_called()
        db.execute.assert_called()
        assert returned is user
