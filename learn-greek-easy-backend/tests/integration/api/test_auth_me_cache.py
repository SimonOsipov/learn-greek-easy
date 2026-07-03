"""RED integration tests for PERF-16-02/03: identity + /auth/me body cache
choke points.

Covers the auth-endpoint mutation points that must bust the supabase_id
identity cache after commit:
- PATCH /api/v1/auth/me (update_me)
- DELETE /api/v1/auth/avatar (delete_avatar)

Plus a TTL-independence regression guard proving deactivation is enforced
within a single request even when the identity cache is warm and was never
explicitly busted.

PERF-16-03 adds the /auth/me response-BODY cache (user:me:{user_id},
distinct from the user:identity:{sub} projection above) and proves it is
busted by the SAME invalidate_user_identity() choke points already wired
in PERF-16-02 -- no new invalidation call sites needed (see
CacheService.invalidate_user_identity in src/core/cache.py, which already
deletes both user:identity:{sub} and user:me:{uid}).

DB-BOUND: all tests here use the `client` fixture, which overrides get_db
with a real `db_session` against the test Postgres database. Per project
convention (no local Postgres/Docker), these are collect-only locally and
CI-verified only.
"""

import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.cache import get_cache
from src.core.dependencies import get_current_user
from src.core.redis import close_redis, get_redis, init_redis
from src.core.supabase_auth import SupabaseUserClaims
from src.db.models import SubscriptionStatus, SubscriptionTier, User
from src.main import app
from tests.factories.auth import UserFactory
from tests.fixtures.auth import (
    _get_override_function,
    _test_user_registry,
    create_test_user_data,
    create_user_with_settings,
)

# =============================================================================
# Module-level Helpers
# =============================================================================


async def _register_user(user: User, label: str = "user") -> dict[str, str]:
    """Register a manually-created user in the test auth registry and
    return Authorization headers, bypassing real Supabase token
    verification.

    Duplicated per-file convention (see the identical private helper in
    tests/integration/test_trial_lifecycle.py and
    tests/integration/api/test_premium_deck_enforcement.py) -- needed
    here because the `auth_headers`/`test_user` fixtures always create a
    fixed default user with no way to set stripe_customer_id /
    subscription_status for the webhook-driven test below.
    """
    token = f"test-{label}-{user.id}"
    _test_user_registry[token] = user
    if get_current_user not in app.dependency_overrides:
        app.dependency_overrides[get_current_user] = _get_override_function()
    return {"Authorization": f"Bearer {token}"}


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


# ============================================================================
# PERF-16-03: GET /auth/me response-body cache (user:me:{user_id})
# ============================================================================


@pytest.fixture
async def live_redis():
    """Wire a real Redis connection so get_cache() is enabled for the
    duration of the test.

    The default `client` fixture (tests/conftest.py) mounts the app via
    plain ASGITransport with no lifespan, so init_redis() never runs and
    the endpoint's cache stays inert. These body-cache tests need the
    /auth/me handler's cache writes (and this test's own cache reads) to
    actually hit Redis, so they wire it directly -- same pattern as
    tests/integration/test_cache_integration.py's `redis_client` fixture.

    Skips (rather than failing) if no Redis is reachable, matching the
    project convention that these tests require CI's Redis and are not
    runnable against a bare local environment.
    """
    await init_redis()
    if get_redis() is None:
        pytest.skip("Redis not available (no local Redis; CI provides one)")
    yield
    await close_redis()


@pytest.mark.integration
@pytest.mark.auth
class TestGetMeBodyCacheKeyIsolation:
    """F6: every test in this module uses a fresh uuid4()-backed user (via
    UserFactory / the test_user fixture), so the user:me:{user_id} cache
    key is unique per test by construction -- this proves that invariant
    actually holds against the real shared CI Redis (no cross-test bleed)
    rather than trusting it holds "by construction", and that the first
    GET /auth/me actually warms that exact key.
    """

    @pytest.mark.asyncio
    async def test_get_me_cache_key_cleared_in_setup(
        self,
        client: AsyncClient,
        test_user: User,
        auth_headers: dict[str, str],
        live_redis: None,
    ) -> None:
        """Setup clears user:me:{user_id} on the real shared CI Redis
        before the first request (proving no cross-test bleed), then the
        first GET /auth/me must warm that exact key.

        RED reason: pre-implementation, GET /auth/me never touches the
        cache at all, so the post-request assertion (cache.get(key) is
        not None) fails -- the key stays cold forever.
        """
        cache = get_cache()
        key = f"user:me:{test_user.id}"

        # 1. Cold before the first request -- no cross-test bleed.
        await cache.delete(key)
        assert await cache.get(key) is None, "Expected no cross-test cache bleed"

        # 2. First GET /auth/me must warm the body cache at that exact key.
        response = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200, response.text
        assert await cache.get(key) is not None, "Expected GET /auth/me to warm user:me:{uid}"


@pytest.mark.integration
@pytest.mark.auth
class TestPatchMeInvalidatesBodyCache:
    """update_me()'s existing post-commit invalidate_user_identity() call
    (PERF-16-02) must bust the /auth/me response-BODY cache PERF-16-03
    introduces, not just the identity projection.
    """

    @pytest.mark.asyncio
    async def test_patch_me_reflected_on_next_get(
        self,
        client: AsyncClient,
        test_user: User,
        auth_headers: dict[str, str],
        live_redis: None,
    ) -> None:
        """GET /auth/me caches full_name="Regular Test User"; PATCH /me
        changes it; the next GET must reflect the new value.

        RED reason: pre-implementation there is no /auth/me body cache to
        bust -- but this test also protects the post-implementation
        behavior against a regression where invalidate_user_identity()
        stops clearing user:me:{uid} (e.g. if a future refactor splits it
        back into two independently-scoped methods).
        """
        first = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert first.status_code == 200, first.text
        assert first.json()["full_name"] == "Regular Test User"

        patch_response = await client.patch(
            "/api/v1/auth/me",
            json={"full_name": "PERF-16-03 Patched Name"},
            headers=auth_headers,
        )
        assert patch_response.status_code == 200, patch_response.text

        second = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert second.status_code == 200, second.text
        assert second.json()["full_name"] == "PERF-16-03 Patched Name", (
            "Expected the cached /auth/me body to be busted by update_me's "
            "post-commit invalidate_user_identity() call"
        )


@pytest.mark.integration
@pytest.mark.stripe
class TestSubscriptionChangeInvalidatesBodyCache:
    """webhook_service.process_event's existing post-commit
    invalidate_user_identity() call (PERF-16-02, src/services/
    webhook_service.py ~line 120) must bust the /auth/me response-BODY
    cache too, so a subscription change is visible on the very next GET
    /auth/me instead of staying stale for up to cache_auth_me_body_ttl
    seconds.
    """

    @pytest.mark.asyncio
    async def test_subscription_change_updates_effective_role_on_next_me(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        live_redis: None,
    ) -> None:
        """Cache /auth/me with effective_role="free" (FREE/NONE
        subscription), then drive a customer.subscription.updated webhook
        that activates the subscription (status -> ACTIVE, which
        get_effective_access_level maps to PREMIUM); the next GET
        /auth/me must show effective_role="premium".

        Mocks only stripe.Webhook.construct_event to bypass signature
        verification, matching tests/integration/test_webhook_integration.py's
        pattern (real routing/service/repository/DB underneath).

        NOTE (D-7 caveat): under real concurrency there is a bounded
        (<=cache_auth_me_body_ttl) pre-commit race between the webhook's
        DB commit and its post-commit cache bust -- a request landing in
        that exact window could still observe the stale cached role. This
        test is strictly sequential (the webhook call fully completes,
        including its post-commit invalidation, before the next GET
        fires), so it is deterministic and does not exercise that race.

        RED reason: pre-implementation there is no /auth/me body cache to
        go stale in the first place, so the first GET's effective_role is
        always freshly computed -- but the SECOND GET's assertion is what
        actually pins the post-implementation contract: once the body
        cache exists, it must be busted by the webhook's invalidation
        call, not silently serve the pre-upgrade "free" snapshot for the
        remainder of the TTL.
        """
        user = await UserFactory.create_with_settings(
            session=db_session,
            subscription_tier=SubscriptionTier.FREE,
            subscription_status=SubscriptionStatus.NONE,
            stripe_customer_id="cus_perf16_03_role_test",
            stripe_subscription_id=None,
        )
        headers = await _register_user(user, "role-change")

        first = await client.get("/api/v1/auth/me", headers=headers)
        assert first.status_code == 200, first.text
        assert first.json()["effective_role"] == "free"

        event_id = "evt_perf16_03_sub_updated"
        payload = {
            "id": event_id,
            "object": "event",
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": "sub_perf16_03_role_test",
                    "customer": "cus_perf16_03_role_test",
                    "status": "active",
                    "items": {"data": [{"price": {"id": "price_test"}}]},
                    "current_period_end": int(time.time()) + 30 * 24 * 3600,
                    "cancel_at_period_end": False,
                }
            },
        }
        raw_body = json.dumps(payload).encode()

        with (
            patch("stripe.Webhook.construct_event") as mock_construct,
            patch("src.api.v1.webhooks.settings") as mock_settings,
        ):
            mock_construct.return_value = MagicMock()
            mock_settings.stripe_webhook_secret = "whsec_test"

            webhook_response = await client.post(
                "/api/v1/webhooks/stripe",
                content=raw_body,
                headers={
                    "stripe-signature": "t=123,v1=fakesig",
                    "content-type": "application/json",
                },
            )
        assert webhook_response.status_code == 200, webhook_response.text
        assert webhook_response.json() == {"received": True}

        second = await client.get("/api/v1/auth/me", headers=headers)
        assert second.status_code == 200, second.text
        assert second.json()["effective_role"] == "premium", (
            "Expected the webhook's post-commit invalidate_user_identity() "
            "to bust the cached /auth/me body so the next GET recomputes "
            "effective_role from the updated subscription_status"
        )
