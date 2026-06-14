"""RED tests for EMAIL-19-02: email reconciliation in get_or_create_user.

These tests are authored BEFORE the implementation (Mode A / Test-Spec phase).
They must FAIL with an assertion error (not an import/collection error) because
the reconciliation branch has not been added to get_or_create_user yet.

The patch target for propagate_email_change is
``src.core.dependencies.propagate_email_change`` with ``create=True`` — the same
technique used by existing PERF-05-05 tests for get_cache — so the patch resolves
even though the import does not exist in dependencies.py yet.

The minimal importable no-op stub in src/core/billing_utils.py exists solely so
the symbol is importable; the real Stripe/Resend logic is EMAIL-19-03.

Reconciliation contract (EMAIL-19-02, supabase_id cold-path only):
  - On supabase_id hit + claims.email differs case-insensitively from user.email:
      1. user.email = claims.email
      2. db.flush()
      3. cache.delete("user:identity:{supabase_id}")
      4. best-effort call to propagate_email_change(user, new_email)
  - On IntegrityError (duplicate email): rollback, log, keep old email, no raise.
  - Warm cache hit (cache.get returns a projection): returns cached user early,
    reconciliation NEVER fires (bounded staleness — by design).
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_or_create_user
from src.core.supabase_auth import SupabaseUserClaims

# ============================================================================
# Shared helpers — mirror style from test_dependencies.py
# ============================================================================


def _make_claims(supabase_id: str | None = None, email: str = "new@x.com") -> SupabaseUserClaims:
    return SupabaseUserClaims(
        supabase_id=supabase_id or str(uuid4()),
        email=email,
        full_name="Reconciliation Tester",
    )


def _make_db_user(supabase_id: str, email: str) -> MagicMock:
    """Return a MagicMock that looks like an ORM User row."""
    user = MagicMock()
    user.id = uuid4()
    user.email = email
    user.supabase_id = supabase_id
    user.is_active = True
    user.is_superuser = False
    user.full_name = "Reconciliation Tester"
    user.settings = MagicMock()
    return user


def _stub_execute_supabase_id_hit(db: AsyncMock, user: MagicMock) -> None:
    """Wire db.execute so the supabase_id SELECT returns `user`."""
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = user
    db.execute = AsyncMock(return_value=result_mock)


# ============================================================================
# AC-1: cold path + email mismatch → user.email updated and flush called
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ac1_cold_path_email_mismatch_updates_user_email():
    """AC-1: supabase_id hit on cold cache + claims email differs → user.email reconciled.

    Expected post-impl: returned user.email == claims.email (new email).

    RED reason: the current get_or_create_user returns the user unchanged;
    user.email stays "old@x.com" — the assertion fails.
    """
    supabase_id = str(uuid4())
    user = _make_db_user(supabase_id=supabase_id, email="old@x.com")
    claims = _make_claims(supabase_id=supabase_id, email="new@x.com")

    db = AsyncMock(spec=AsyncSession)
    _stub_execute_supabase_id_hit(db, user)

    # Cold cache: get returns None (miss)
    cache = AsyncMock()
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock(return_value=True)
    cache.delete = AsyncMock(return_value=True)
    mock_get_cache = MagicMock(return_value=cache)

    with (
        patch("src.core.dependencies.get_cache", mock_get_cache, create=True),
        patch(
            "src.core.dependencies.propagate_email_change",
            new_callable=AsyncMock,
            create=True,
        ),
    ):
        returned = await get_or_create_user(db, claims)

    # After reconciliation the returned user's email must be the NEW email
    assert (
        returned.email == "new@x.com"
    ), f"Expected user.email='new@x.com' after reconciliation, got {returned.email!r}"
    # flush must have been called (to persist the change)
    db.flush.assert_awaited()


# ============================================================================
# AC-2: identical email → no write, no propagation
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ac2_identical_email_no_write_no_propagation():
    """AC-2: claims email == user.email (exact match) → no write, no propagation.

    Expected post-impl: propagate_email_change NOT called; flush NOT called for
    reconciliation.

    NOTE: This test is expected to be GREEN pre-impl (no reconciliation fires);
    it is a regression guard to ensure identical emails are never reconciled.
    """
    supabase_id = str(uuid4())
    email = "same@x.com"
    user = _make_db_user(supabase_id=supabase_id, email=email)
    claims = _make_claims(supabase_id=supabase_id, email=email)

    db = AsyncMock(spec=AsyncSession)
    _stub_execute_supabase_id_hit(db, user)

    cache = AsyncMock()
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock(return_value=True)
    cache.delete = AsyncMock(return_value=True)
    mock_get_cache = MagicMock(return_value=cache)

    with (
        patch("src.core.dependencies.get_cache", mock_get_cache, create=True),
        patch(
            "src.core.dependencies.propagate_email_change",
            new_callable=AsyncMock,
            create=True,
        ) as mock_propagate,
    ):
        await get_or_create_user(db, claims)

    mock_propagate.assert_not_called()
    # user.email must NOT have been changed
    assert user.email == email


# ============================================================================
# AC-2b: case-only difference → treated equal (no write, no propagation)
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ac2b_case_insensitive_equal_no_write():
    """AC-2b: user.email='Old@X.com', claims email='old@x.com' → treated equal.

    The reconciliation check must be case-insensitive; different case alone
    must NOT trigger a write.

    NOTE: This test is expected to be GREEN pre-impl; regression guard.
    """
    supabase_id = str(uuid4())
    user = _make_db_user(supabase_id=supabase_id, email="Old@X.com")
    claims = _make_claims(supabase_id=supabase_id, email="old@x.com")

    db = AsyncMock(spec=AsyncSession)
    _stub_execute_supabase_id_hit(db, user)

    cache = AsyncMock()
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock(return_value=True)
    cache.delete = AsyncMock(return_value=True)
    mock_get_cache = MagicMock(return_value=cache)

    with (
        patch("src.core.dependencies.get_cache", mock_get_cache, create=True),
        patch(
            "src.core.dependencies.propagate_email_change",
            new_callable=AsyncMock,
            create=True,
        ) as mock_propagate,
    ):
        await get_or_create_user(db, claims)

    mock_propagate.assert_not_called()
    # email must NOT have been overwritten
    assert user.email == "Old@X.com"


# ============================================================================
# AC-3: cold path + mismatch → cache.delete called with correct key
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ac3_cold_path_reconciliation_deletes_identity_cache():
    """AC-3: reconciliation fires on cold path → cache.delete("user:identity:{sub}") called.

    The identity-cache key must be deleted so the next warm-hit can't serve
    stale identity data.

    RED reason: the current code never calls cache.delete; the assertion fails.
    """
    supabase_id = str(uuid4())
    user = _make_db_user(supabase_id=supabase_id, email="old@x.com")
    claims = _make_claims(supabase_id=supabase_id, email="new@x.com")

    db = AsyncMock(spec=AsyncSession)
    _stub_execute_supabase_id_hit(db, user)

    cache = AsyncMock()
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock(return_value=True)
    cache.delete = AsyncMock(return_value=True)
    mock_get_cache = MagicMock(return_value=cache)

    expected_key = f"user:identity:{supabase_id}"

    with (
        patch("src.core.dependencies.get_cache", mock_get_cache, create=True),
        patch(
            "src.core.dependencies.propagate_email_change",
            new_callable=AsyncMock,
            create=True,
        ),
    ):
        await get_or_create_user(db, claims)

    # cache.delete must have been called with the exact identity key
    cache.delete.assert_awaited_once_with(expected_key)


# ============================================================================
# AC-3b: bounded-staleness contract — warm hit never reconciles
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ac3b_warm_cache_hit_skips_reconciliation():
    """AC-3b: warm identity-cache hit → function returns early, no reconciliation.

    When cache.get returns a valid projection dict, the function returns the
    db.get user immediately, before reaching the supabase_id SELECT branch
    where reconciliation lives.  Therefore propagate_email_change must NOT be
    called and the user's email in the DB must NOT be written.

    NOTE: Expected GREEN pre-impl; regression guard only.
    """
    user_id = uuid4()
    supabase_id = str(uuid4())

    # Warm-cache projection (does NOT include email — intentional)
    cached_projection = {
        "id": str(user_id),
        "is_active": True,
        "is_superuser": False,
    }

    # The ORM object that db.get returns on the warm path
    orm_user = _make_db_user(supabase_id=supabase_id, email="old@x.com")
    orm_user.id = user_id

    # Claims carry a NEW email — reconciliation would fire if we reached the cold path
    claims = _make_claims(supabase_id=supabase_id, email="new@x.com")

    db = AsyncMock(spec=AsyncSession)
    db.get = AsyncMock(return_value=orm_user)

    cache = AsyncMock()
    cache.get = AsyncMock(return_value=cached_projection)  # WARM HIT
    cache.set = AsyncMock(return_value=True)
    cache.delete = AsyncMock(return_value=True)
    mock_get_cache = MagicMock(return_value=cache)

    with (
        patch("src.core.dependencies.get_cache", mock_get_cache, create=True),
        patch(
            "src.core.dependencies.propagate_email_change",
            new_callable=AsyncMock,
            create=True,
        ) as mock_propagate,
    ):
        returned = await get_or_create_user(db, claims)

    # Warm hit must return the cached user without touching email
    assert returned is orm_user
    # Reconciliation (propagate) must NOT have been called on the warm path
    mock_propagate.assert_not_called()
    # The email on the returned object must be unchanged
    assert returned.email == "old@x.com"


# ============================================================================
# AC-3b (cold side): cold path + mismatch → reconciles email
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ac3b_cold_path_mismatch_reconciles():
    """AC-3b (cold side): cold cache + email mismatch → user.email set to new value.

    This is the affirmative side of AC-3b: on the cold path, when the email
    differs, reconciliation must fire and the email must be updated.

    RED reason: current implementation never updates user.email on the supabase_id
    hit path — the assertion fails.
    """
    supabase_id = str(uuid4())
    user = _make_db_user(supabase_id=supabase_id, email="old@x.com")
    claims = _make_claims(supabase_id=supabase_id, email="new@x.com")

    db = AsyncMock(spec=AsyncSession)
    _stub_execute_supabase_id_hit(db, user)

    cache = AsyncMock()
    cache.get = AsyncMock(return_value=None)  # COLD MISS
    cache.set = AsyncMock(return_value=True)
    cache.delete = AsyncMock(return_value=True)
    mock_get_cache = MagicMock(return_value=cache)

    with (
        patch("src.core.dependencies.get_cache", mock_get_cache, create=True),
        patch(
            "src.core.dependencies.propagate_email_change",
            new_callable=AsyncMock,
            create=True,
        ),
    ):
        returned = await get_or_create_user(db, claims)

    assert (
        returned.email == "new@x.com"
    ), f"Cold path + mismatch must reconcile email to 'new@x.com', got {returned.email!r}"


# ============================================================================
# AC-4: IntegrityError on flush → rollback, log, keep old email, no raise
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ac4_integrity_error_on_email_update_is_swallowed():
    """AC-4: flush raises IntegrityError (duplicate email) → rollback, old email kept, no raise.

    When the new email is already taken by another row, the reconciliation flush
    must be caught, db.rollback() called, and the function must return the user
    without raising.

    RED reason: the current code has no reconciliation path; it never calls flush
    for email changes, so db.rollback is never called on the supabase_id hit path.
    The assertion db.rollback.assert_awaited() fails.
    """
    supabase_id = str(uuid4())
    user = _make_db_user(supabase_id=supabase_id, email="old@x.com")
    claims = _make_claims(supabase_id=supabase_id, email="taken@x.com")

    db = AsyncMock(spec=AsyncSession)
    _stub_execute_supabase_id_hit(db, user)

    # flush raises IntegrityError on the email reconciliation write
    db.flush = AsyncMock(
        side_effect=IntegrityError(
            statement="UPDATE users SET email = ...",
            params={},
            orig=Exception("unique constraint violation"),
        )
    )
    db.rollback = AsyncMock()

    cache = AsyncMock()
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock(return_value=True)
    cache.delete = AsyncMock(return_value=True)
    mock_get_cache = MagicMock(return_value=cache)

    with (
        patch("src.core.dependencies.get_cache", mock_get_cache, create=True),
        patch(
            "src.core.dependencies.propagate_email_change",
            new_callable=AsyncMock,
            create=True,
        ) as mock_propagate,
    ):
        # Must NOT raise
        returned = await get_or_create_user(db, claims)

    # rollback must have been called to undo the failed email write
    db.rollback.assert_awaited()

    # No exception must propagate
    assert returned is not None

    # propagate_email_change must NOT be called after a failed reconciliation
    mock_propagate.assert_not_called()


# ============================================================================
# AC-5 (unit): cold path + mismatch → returned user.email == new email
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ac5_unit_returned_user_has_new_email():
    """AC-5 (unit): cold cache + claims email differs → returned user carries new email.

    Verifies the function's public contract (what callers observe).

    RED reason: get_or_create_user currently returns the user with the unchanged
    email from the DB; the assertion fails.
    """
    supabase_id = str(uuid4())
    user = _make_db_user(supabase_id=supabase_id, email="old@x.com")
    claims = _make_claims(supabase_id=supabase_id, email="new@x.com")

    db = AsyncMock(spec=AsyncSession)
    _stub_execute_supabase_id_hit(db, user)

    cache = AsyncMock()
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock(return_value=True)
    cache.delete = AsyncMock(return_value=True)
    mock_get_cache = MagicMock(return_value=cache)

    with (
        patch("src.core.dependencies.get_cache", mock_get_cache, create=True),
        patch(
            "src.core.dependencies.propagate_email_change",
            new_callable=AsyncMock,
            create=True,
        ),
    ):
        returned = await get_or_create_user(db, claims)

    assert (
        returned.email == "new@x.com"
    ), f"Returned user must have the reconciled email 'new@x.com', got {returned.email!r}"
