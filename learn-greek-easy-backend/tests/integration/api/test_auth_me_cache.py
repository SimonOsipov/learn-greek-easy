"""RED integration tests for PERF-16-02: identity-cache invalidation choke points.

Covers the auth-endpoint mutation points that must bust the supabase_id
identity cache after commit:
- PATCH /api/v1/auth/me (update_me)
- DELETE /api/v1/auth/avatar (delete_avatar)

Plus a TTL-independence regression guard proving deactivation is enforced
within a single request even when the identity cache is warm and was never
explicitly busted.

DB-BOUND: all tests here use the `client` fixture, which overrides get_db
with a real `db_session` against the test Postgres database. Per project
convention (no local Postgres/Docker), these are collect-only locally and
CI-verified only.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.supabase_auth import SupabaseUserClaims
from src.db.models import User
from tests.fixtures.auth import create_test_user_data, create_user_with_settings

# ============================================================================
# PATCH /api/v1/auth/me -> identity cache invalidation
# ============================================================================


@pytest.mark.integration
@pytest.mark.auth
class TestUpdateMeInvalidatesIdentityCache:
    """update_me() must bust the identity cache for the updated user after commit."""

    @pytest.mark.asyncio
    async def test_update_me_invalidates_after_commit(
        self,
        client: AsyncClient,
        test_user: User,
        auth_headers: dict[str, str],
    ) -> None:
        """PATCH /me calls invalidate_user_identity once with the user's ids, post-commit.

        RED reason: update_me() never calls the identity invalidation helper
        today -- invalidate_user_identity is never awaited.
        """
        mock_cache = AsyncMock()
        mock_cache.invalidate_user_identity = AsyncMock()

        with patch("src.api.v1.auth.get_cache", return_value=mock_cache, create=True):
            response = await client.patch(
                "/api/v1/auth/me",
                json={"full_name": "Updated Name PERF-16-02"},
                headers=auth_headers,
            )

        assert response.status_code == 200, response.text
        mock_cache.invalidate_user_identity.assert_awaited_once_with(
            test_user.supabase_id, test_user.id
        )


# ============================================================================
# DELETE /api/v1/auth/avatar -> identity cache invalidation
# ============================================================================


@pytest.mark.integration
@pytest.mark.auth
class TestDeleteAvatarInvalidatesIdentityCache:
    """delete_avatar() must bust the identity cache for the user after commit."""

    @pytest.mark.asyncio
    async def test_delete_avatar_invalidates(
        self,
        client: AsyncClient,
        test_user: User,
        auth_headers: dict[str, str],
    ) -> None:
        """DELETE /me/avatar calls invalidate_user_identity once, post-commit.

        RED reason: delete_avatar() never calls the identity invalidation
        helper today -- invalidate_user_identity is never awaited.
        """
        mock_cache = AsyncMock()
        mock_cache.invalidate_user_identity = AsyncMock()

        with (
            patch("src.api.v1.auth.get_s3_service") as mock_get_s3,
            patch("src.api.v1.auth.get_cache", return_value=mock_cache, create=True),
        ):
            mock_s3 = MagicMock()
            mock_s3.delete_object.return_value = True
            mock_get_s3.return_value = mock_s3

            response = await client.delete("/api/v1/auth/avatar", headers=auth_headers)

        assert response.status_code == 200, response.text
        mock_cache.invalidate_user_identity.assert_awaited_once_with(
            test_user.supabase_id, test_user.id
        )


# ============================================================================
# Deactivation enforced TTL-independently, even with a warm identity cache
# ============================================================================


@pytest.mark.integration
@pytest.mark.auth
class TestDeactivationEnforcedWithWarmIdentityCache:
    """Deactivation must be enforced within one request even if the identity
    cache entry is warm and was never explicitly busted -- important now that
    PERF-16-02 raises the identity TTL from 20s to 900s (a stale entry can
    live 15 minutes instead of 20 seconds).
    """

    @pytest.mark.asyncio
    async def test_deactivated_user_denied_with_warm_identity_cache(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Warm the identity cache via one GET /auth/me, then deactivate the
        user directly in the DB WITHOUT clearing the cache. A second
        GET /auth/me must still 401.

        Uses a small stateful fake cache (not real Redis) so the warm/cold
        state is deterministic regardless of whether Redis is configured in
        the test environment -- mirrors the pattern in
        test_auth_me_email_reconciliation.py.

        NOTE: this assertion already holds against the current implementation
        -- get_current_user checks user.is_active from the ORM object
        get_or_create_user's cache-hit path re-fetches via db.get(), not from
        the cached projection dict. It is a regression guard against a future
        "optimize by trusting the cached is_active" change, which becomes a
        materially bigger risk once the TTL is raised to 900s.
        """

        class _FakeCache:
            """Minimal stateful cache: real get/set/delete semantics, no Redis."""

            def __init__(self) -> None:
                self._store: dict[str, dict] = {}

            async def get(self, key: str):
                return self._store.get(key)

            async def set(self, key: str, value: dict, ttl: int | None = None) -> bool:
                self._store[key] = value
                return True

            async def delete(self, key: str) -> bool:
                self._store.pop(key, None)
                return True

        user_data = create_test_user_data(full_name="Warm Cache Deactivation Tester")
        user = await create_user_with_settings(db_session, user_data)
        supabase_id = user.supabase_id

        claims = SupabaseUserClaims(
            supabase_id=supabase_id, email=user.email, full_name=user.full_name
        )
        fake_cache = _FakeCache()

        with (
            patch(
                "src.core.dependencies.verify_supabase_token",
                new_callable=AsyncMock,
                return_value=claims,
            ),
            patch(
                "src.core.dependencies.get_cache",
                return_value=fake_cache,
                create=True,
            ),
        ):
            # 1. Warm the identity cache with a healthy (is_active=True) projection.
            first = await client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer fake-token-for-stub"},
            )
            assert first.status_code == 200, first.text
            identity_key = f"user:identity:{supabase_id}"
            assert identity_key in fake_cache._store, "Identity cache was not warmed"

            # 2. Deactivate directly in the DB, WITHOUT invalidating the cache.
            user.is_active = False
            db_session.add(user)
            await db_session.commit()

            # 3. Second request must still 401 despite the warm (not-busted) cache.
            second = await client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer fake-token-for-stub"},
            )

        assert second.status_code == 401, second.text
