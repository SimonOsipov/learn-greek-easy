"""RED integration test for EMAIL-19-02: email reconciliation visible via GET /auth/me.

AC-5-int: When a user row has email='old@x.com' but the JWT carries 'new@x.com'
(cold identity cache), GET /api/v1/auth/me must return email='new@x.com' in the
response body.

Strategy: we bypass auth_headers (which short-circuits get_current_user via
dependency override) and instead stub verify_supabase_token to return claims
with the new email.  The cache is forced cold via a patched get_cache whose
get() returns None.  The full get_current_user → get_or_create_user path runs
against the real test database.

RED reason: the current get_or_create_user returns the user with the unchanged
DB email ('old@x.com'); the response body will contain 'old@x.com', not
'new@x.com', so the assertion fails.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.supabase_auth import SupabaseUserClaims
from src.db.models import User, UserSettings

# ============================================================================
# Fixture: a user in the DB whose stored email differs from the JWT
# ============================================================================


@pytest_asyncio.fixture
async def user_with_old_email(db_session: AsyncSession) -> tuple[User, str, str]:
    """Create a user whose DB email differs from the JWT claim email.

    Returns:
        (user, supabase_id, new_email) so the test can construct claims.
    """
    supabase_id = str(uuid4())
    old_email = f"old_{uuid4().hex[:8]}@reconcile-test.com"
    new_email = f"new_{uuid4().hex[:8]}@reconcile-test.com"

    user = User(
        supabase_id=supabase_id,
        email=old_email,
        full_name="Reconcile Integration Tester",
        is_active=True,
        is_superuser=False,
    )
    db_session.add(user)
    await db_session.flush()

    settings = UserSettings(
        user_id=user.id,
        daily_goal=20,
        email_notifications=True,
    )
    db_session.add(settings)
    await db_session.commit()

    # Reload with settings
    stmt = select(User).options(selectinload(User.settings)).where(User.id == user.id)
    result = await db_session.execute(stmt)
    user = result.scalar_one()

    return user, supabase_id, new_email


# ============================================================================
# AC-5-int: GET /api/v1/auth/me returns the reconciled (new) email
# ============================================================================


@pytest.mark.integration
@pytest.mark.auth
@pytest.mark.asyncio
async def test_ac5_int_get_me_returns_reconciled_email(
    client: AsyncClient,
    user_with_old_email: tuple,
) -> None:
    """AC-5-int: GET /api/v1/auth/me reflects the reconciled email after JWT carries new one.

    Setup:
    - User row in DB: email='old@...'
    - JWT (stubbed verify_supabase_token): email='new@...'
    - Identity cache: cold (cache.get returns None)

    Expected post-impl: response body email == new_email
    RED reason: current impl returns old email from DB without reconciling.
    """
    user, supabase_id, new_email = user_with_old_email

    # Build claims carrying the NEW email
    claims = SupabaseUserClaims(
        supabase_id=supabase_id,
        email=new_email,
        full_name="Reconcile Integration Tester",
    )

    # Cold identity cache: get returns None (miss)
    cold_cache = AsyncMock()
    cold_cache.get = AsyncMock(return_value=None)
    cold_cache.set = AsyncMock(return_value=True)
    cold_cache.delete = AsyncMock(return_value=True)
    mock_get_cache = MagicMock(return_value=cold_cache)

    with (
        # Stub token verification to return our controlled claims
        patch(
            "src.core.dependencies.verify_supabase_token",
            new_callable=AsyncMock,
            return_value=claims,
        ),
        # Force cold cache so reconciliation path is entered
        patch("src.core.dependencies.get_cache", mock_get_cache, create=True),
        # Stub propagate_email_change (EMAIL-19-03 not implemented yet)
        # create=True because the import does not exist in dependencies.py yet
        patch(
            "src.core.dependencies.propagate_email_change",
            new_callable=AsyncMock,
            create=True,
        ),
    ):
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer fake-token-for-stub"},
        )

    assert (
        response.status_code == 200
    ), f"Expected 200 from GET /auth/me, got {response.status_code}: {response.text}"

    data = response.json()
    assert (
        data["email"] == new_email
    ), f"Expected reconciled email '{new_email}' in response body, got '{data.get('email')}'"
