"""Adversarial / edge / negative tests for EMAIL-19-02 email reconciliation.

Mode B adversarial coverage added AFTER the AC tests (test_dependencies_email_reconciliation.py)
were confirmed green.  These tests probe the edges the AC tests did not explicitly cover:

1. claims.email is None   → no write, no propagation, no identity-cache invalidation
2. Whitespace-padded claim → documents the current impl behaviour
   (no .strip() call — spurious write if Supabase ever delivers a padded email).
3. propagate_email_change raises a non-IntegrityError → EXPECTED TO FAIL in current impl
   (the try/except only catches IntegrityError; a propagation failure escapes and breaks
   the user request — violates Core AC 6 / architecture doc "wrap propagation in try/except
   that logs and swallows").
4. flush-before-propagation ordering — db.flush() runs BEFORE propagate_email_change.
5. Case-only change → no redundant propagation call (already covered by AC-2b; noted here).
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_or_create_user
from src.core.supabase_auth import SupabaseUserClaims

# ============================================================================
# Shared helpers (mirror test_dependencies_email_reconciliation.py style)
# ============================================================================


def _make_claims(
    supabase_id: str | None = None,
    email: str | None = "new@x.com",
) -> SupabaseUserClaims:
    return SupabaseUserClaims(
        supabase_id=supabase_id or str(uuid4()),
        email=email,
        full_name="Adversarial Tester",
    )


def _make_db_user(supabase_id: str, email: str) -> MagicMock:
    user = MagicMock()
    user.id = uuid4()
    user.email = email
    user.supabase_id = supabase_id
    user.is_active = True
    user.is_superuser = False
    user.full_name = "Adversarial Tester"
    user.settings = MagicMock()
    return user


def _stub_execute_supabase_id_hit(db: AsyncMock, user: MagicMock) -> None:
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = user
    db.execute = AsyncMock(return_value=result_mock)


def _make_cold_cache() -> AsyncMock:
    cache = AsyncMock()
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock(return_value=True)
    cache.delete = AsyncMock(return_value=True)
    cache.invalidate_user_identity = AsyncMock(return_value=None)
    return cache


# ============================================================================
# ADV-1: claims.email is None → no write, no propagation, no cache delete
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_adv1_none_email_claim_no_reconciliation():
    """ADV-1: claims.email is None → reconciliation must never fire.

    A token without an email claim (e.g. phone-only auth stub) must never
    null or overwrite users.email.  The guard `if claims.email and ...` at
    dependencies.py:157 handles this.  Confirm no flush, no propagate, no
    identity-cache invalidation is triggered beyond what the normal
    warm-cache set does.
    """
    supabase_id = str(uuid4())
    user = _make_db_user(supabase_id=supabase_id, email="existing@x.com")
    claims = _make_claims(supabase_id=supabase_id, email=None)

    db = AsyncMock(spec=AsyncSession)
    _stub_execute_supabase_id_hit(db, user)

    cache = _make_cold_cache()
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

    # No propagation must occur
    mock_propagate.assert_not_called()
    # cache.invalidate_user_identity must NOT be called (it's only called
    # inside _reconcile_email, PERF-16-02)
    cache.invalidate_user_identity.assert_not_called()
    # db.flush must NOT be called for reconciliation (there's no email to reconcile)
    db.flush.assert_not_awaited()
    # user.email must be untouched
    assert returned.email == "existing@x.com"


# ============================================================================
# ADV-2: whitespace-padded claim — documents current impl behaviour
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_adv2_whitespace_padded_claim_triggers_spurious_write():
    """ADV-2: claims.email with surrounding whitespace triggers a write.

    The comparison at dependencies.py:157 is:
        claims.email.lower() != user.email.lower()
    There is NO .strip() call.  If claims.email is " new@x.com " (padded),
    it compares unequal to "new@x.com" and _reconcile_email fires, setting
    users.email to " new@x.com " (with whitespace) in the DB.

    This is a LATENT BUG documented here.  In practice Supabase normalises
    email addresses at auth time (the Supabase JWT will never deliver a
    padded email), so the risk is LOW — this test documents the edge rather
    than bouncing the story.  If Supabase validation is ever loosened, a
    spurious write would occur.

    Current expected behaviour (what the impl does TODAY): a write fires.
    """
    supabase_id = str(uuid4())
    user = _make_db_user(supabase_id=supabase_id, email="new@x.com")
    # Padded version — compare is case-insensitive but not strip-aware
    claims = _make_claims(supabase_id=supabase_id, email=" new@x.com ")

    db = AsyncMock(spec=AsyncSession)
    _stub_execute_supabase_id_hit(db, user)

    cache = _make_cold_cache()
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

    # Document current behaviour: flush IS called (spurious write fires)
    # If this assertion fails in the future, it means a .strip() guard was added — good.
    db.flush.assert_awaited()
    # propagate fires too (matching the write)
    mock_propagate.assert_called_once()
    # The stored email ends up with whitespace (latent data corruption risk)
    assert returned.email == " new@x.com ", (
        "Current impl stores the claim verbatim including whitespace. "
        "If Supabase ever delivers padded claims this becomes data corruption. "
        "Fix: add .strip() to the comparison and the assignment."
    )


# ============================================================================
# ADV-3: propagate_email_change raises a non-IntegrityError
# ============================================================================
#
# EXPECTED OUTCOME: FAIL in current impl.
#
# The _reconcile_email try/except ONLY catches IntegrityError (line 105).
# A non-IntegrityError from propagate_email_change escapes the except clause
# and propagates up through get_or_create_user — turning a best-effort mirror
# call into a request-killing exception.
#
# Design doc says: "wrap propagation in try/except that logs and swallows"
# (see Technical Design Document, "Implementation approach" section).
# Core AC 6: "Propagation failures are logged + swallowed; the email change
# itself … still succeeds."
#
# This test is EXPECTED TO FAIL until the executor adds a separate
# try/except around propagate_email_change inside _reconcile_email.
#
# When the fix is applied, this test must PASS (no exception escapes,
# returned user.email == new email, db.flush was called).
#
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_adv3_propagation_raise_does_not_break_request():
    """ADV-3 [DEFECT]: propagate_email_change raise must not escape to the caller.

    EXPECTED FAILURE in current impl — see module docstring for details.

    When EMAIL-19-03 implements the real Stripe/Resend logic, any network or
    API error from propagate_email_change must be caught inside _reconcile_email
    and swallowed (Core AC 6).  Today, only IntegrityError is caught; a plain
    RuntimeError (or httpx.HTTPError, StripeError, etc.) escapes.

    Post-fix contract:
    - get_or_create_user must NOT raise
    - returned user.email must equal the new email (flush already committed)
    - db.flush must have been called (email write happened)
    """
    supabase_id = str(uuid4())
    user = _make_db_user(supabase_id=supabase_id, email="old@x.com")
    claims = _make_claims(supabase_id=supabase_id, email="new@x.com")

    db = AsyncMock(spec=AsyncSession)
    _stub_execute_supabase_id_hit(db, user)

    cache = _make_cold_cache()
    mock_get_cache = MagicMock(return_value=cache)

    # propagate_email_change raises a generic (non-IntegrityError) exception,
    # simulating a Stripe network error or Resend API failure.
    propagation_error = RuntimeError("Stripe API unavailable")

    with (
        patch("src.core.dependencies.get_cache", mock_get_cache, create=True),
        patch(
            "src.core.dependencies.propagate_email_change",
            new_callable=AsyncMock,
            create=True,
            side_effect=propagation_error,
        ),
    ):
        # The request must NOT raise — propagation is best-effort
        returned = await get_or_create_user(db, claims)

    # The email write (flush) must have occurred before propagation was attempted
    db.flush.assert_awaited()
    # The returned user must have the reconciled email
    assert returned.email == "new@x.com", (
        f"Expected user.email='new@x.com' after reconciliation even when "
        f"propagation raises, got {returned.email!r}"
    )


# ============================================================================
# ADV-4: flush-before-propagation ordering
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_adv4_flush_called_before_propagation():
    """ADV-4: db.flush() must precede propagate_email_change.

    The DB write (flush) must complete before propagation is attempted so
    that a propagation failure cannot prevent the email from being persisted.
    Verified by recording call order via side_effect hooks.
    """
    supabase_id = str(uuid4())
    user = _make_db_user(supabase_id=supabase_id, email="old@x.com")
    claims = _make_claims(supabase_id=supabase_id, email="new@x.com")

    db = AsyncMock(spec=AsyncSession)
    _stub_execute_supabase_id_hit(db, user)

    call_order: list[str] = []

    async def record_flush() -> None:
        call_order.append("flush")

    async def record_propagate(u: object, email: str) -> None:
        call_order.append("propagate")

    db.flush = AsyncMock(side_effect=record_flush)

    cache = _make_cold_cache()
    mock_get_cache = MagicMock(return_value=cache)

    with (
        patch("src.core.dependencies.get_cache", mock_get_cache, create=True),
        patch(
            "src.core.dependencies.propagate_email_change",
            new_callable=AsyncMock,
            side_effect=record_propagate,
            create=True,
        ),
    ):
        await get_or_create_user(db, claims)

    assert "flush" in call_order, "db.flush must be called during reconciliation"
    assert "propagate" in call_order, "propagate_email_change must be called during reconciliation"
    flush_idx = call_order.index("flush")
    propagate_idx = call_order.index("propagate")
    assert (
        flush_idx < propagate_idx
    ), f"db.flush() must precede propagate_email_change; got order {call_order}"


# ============================================================================
# ADV-5: case-only change — no write, no propagation (guards existing AC-2b)
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_adv5_case_only_change_no_propagation_to_stripe_resend():
    """ADV-5: a pure case flip (Old@X.com → old@x.com) must not call propagation.

    The .lower() comparison means these are treated as equal, so no write
    and no downstream Stripe/Resend call fires for a case-only change.
    This guards that the case-insensitive guard is consistently applied
    BOTH to the reconciliation write AND to propagation.
    """
    supabase_id = str(uuid4())
    user = _make_db_user(supabase_id=supabase_id, email="Old@X.com")
    claims = _make_claims(supabase_id=supabase_id, email="old@x.com")

    db = AsyncMock(spec=AsyncSession)
    _stub_execute_supabase_id_hit(db, user)

    cache = _make_cold_cache()
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

    mock_propagate.assert_not_called()
    db.flush.assert_not_awaited()
    cache.invalidate_user_identity.assert_not_called()
    # Email must remain unchanged (the stored casing is preserved)
    assert returned.email == "Old@X.com"


# ============================================================================
# ADV-6: cache.invalidate_user_identity called AFTER flush, BEFORE propagation
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_adv6_cache_invalidate_after_flush_before_propagation():
    """ADV-6: identity-cache invalidation must happen after flush but before
    propagation.

    The correct order inside _reconcile_email is:
      1. user.email = new_email              (in-memory mutation)
      2. db.flush()                          (persist to DB)
      3. cache.invalidate_user_identity(...) (bust identity + /me caches, PERF-16-02)
      4. propagate_email_change              (best-effort mirror)

    If invalidation happens after propagation, a propagation error (ADV-3)
    could leave a stale cache entry.  Verify steps 2→3→4 are ordered.
    """
    supabase_id = str(uuid4())
    user = _make_db_user(supabase_id=supabase_id, email="old@x.com")
    claims = _make_claims(supabase_id=supabase_id, email="new@x.com")

    db = AsyncMock(spec=AsyncSession)
    _stub_execute_supabase_id_hit(db, user)

    call_order: list[str] = []

    async def record_flush() -> None:
        call_order.append("flush")

    cache = _make_cold_cache()

    async def record_invalidate(sb_id: str, user_id: object) -> None:
        call_order.append("invalidate")

    cache.invalidate_user_identity = AsyncMock(side_effect=record_invalidate)

    async def record_propagate(u: object, email: str) -> None:
        call_order.append("propagate")

    db.flush = AsyncMock(side_effect=record_flush)
    mock_get_cache = MagicMock(return_value=cache)

    with (
        patch("src.core.dependencies.get_cache", mock_get_cache, create=True),
        patch(
            "src.core.dependencies.propagate_email_change",
            new_callable=AsyncMock,
            side_effect=record_propagate,
            create=True,
        ),
    ):
        await get_or_create_user(db, claims)

    assert call_order == [
        "flush",
        "invalidate",
        "propagate",
    ], f"Expected order [flush, invalidate, propagate], got {call_order}"
