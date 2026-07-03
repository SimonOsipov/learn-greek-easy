# -*- coding: utf-8 -*-
"""RED tests for GET /api/v1/auth/me response-body caching (PERF-16-03).

Mirrors tests/unit/api/test_dashboard_summary_cache.py: calls the get_me
endpoint function DIRECTLY (no HTTP test client / real DB) with a mocked
db + current_user + request, patching src.api.v1.auth.get_cache (the
endpoint already imports get_cache -- see auth.py's module imports --
even though it isn't called from get_me yet).

Where the dashboard test patches DashboardSummaryService.build() to
sidestep composing six real sub-services, most tests here patch
src.api.v1.auth._build_user_profile_response to sidestep ITS entanglement:
an unconditional get_s3_service() call (presigned avatar URL) and
get_effective_access_level() (subscription-status branching) -- neither
of which PERF-16-03 touches. PERF-16-03 only wraps the *reload + build*
step of get_me in cache-aside; it doesn't change what gets built.

test_get_me_cold_miss_returns_settings_populated is the one exception: it
builds a real (unpersisted, never added to a session) User + UserSettings
pair and does NOT patch _build_user_profile_response, so it exercises the
real reload-then-build contract shape end-to-end at the Python level --
guarding the MissingGreenlet-adjacent risk the endpoint's own docstring
already warns about ("Reloads user from database ... to avoid
MissingGreenlet errors"). Because get_me's reload+build already works
correctly pre-cache, that one test is expected to PASS today -- it is a
PRESERVATION GUARD, not a RED spec (see PERF-16-03 Mode A report).

Pre-implementation, get_me() never touches the cache -- every call
reloads the user from the DB and rebuilds the response from scratch, so
the loader-ran-once and get_or_set-was-called assertions below are RED.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.api.v1.auth import get_me
from src.db.models import SubscriptionStatus, User, UserSettings
from src.schemas.user import UserProfileResponse, UserSettingsResponse

# =============================================================================
# Helpers
# =============================================================================


class _StatefulFakeCache:
    """Minimal stateful cache: real get/set/delete/get_or_set semantics,
    no Redis. Mirrors the get/set/delete shape of the integration
    _FakeCache in tests/integration/api/test_auth_me_cache.py (which
    predates PERF-16-03 and doesn't implement get_or_set), plus a real
    cache-aside get_or_set on top of the same dict.
    """

    def __init__(self) -> None:
        self._store: dict[str, object] = {}

    async def get(self, key: str):
        return self._store.get(key)

    async def set(self, key: str, value, ttl: int | None = None) -> bool:
        self._store[key] = value
        return True

    async def delete(self, key: str) -> bool:
        self._store.pop(key, None)
        return True

    async def get_or_set(self, key: str, factory, ttl: int | None = None):
        if key in self._store:
            return self._store[key]
        value = factory()
        if hasattr(value, "__await__"):
            value = await value
        if value is not None:
            self._store[key] = value
        return value


def _make_mock_db():
    return AsyncMock()


def _make_mock_request():
    """A request double whose request.state.supabase_claims is explicitly
    None (matching a real, unauthenticated-via-claims Starlette Request,
    where getattr(state, "supabase_claims", None) returns None for an
    unset attribute) -- not a bare MagicMock(), whose auto-generated
    `.state.supabase_claims.auth_provider` is itself a truthy MagicMock,
    not a str. Tests that exercise the real _build_user_profile_response
    (not patched away) would otherwise get an unserializable auth_provider
    on model_dump(mode="json"), fail model_validate() on the read side,
    and silently fall through to get_me's ValidationError-fallback
    reload -- masking exactly the cache-hit path they intend to exercise.
    """
    request = MagicMock()
    request.state.supabase_claims = None
    return request


def _make_mock_reload_result(user_id):
    """A db.execute(...) return value whose .scalar_one() yields a
    placeholder user -- sufficient when _build_user_profile_response is
    patched away (the placeholder's fields are never actually read).
    """
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = MagicMock(id=user_id)
    return mock_result


def _make_valid_profile_response(user_id=None) -> UserProfileResponse:
    """A minimal, fully-valid UserProfileResponse."""
    now = datetime.now(timezone.utc)
    uid = user_id or uuid4()
    return UserProfileResponse(
        id=uid,
        email="cache-test@example.com",
        full_name="Cache Test User",
        is_active=True,
        is_superuser=False,
        avatar_url=None,
        effective_role="free",
        auth_provider="email",
        created_at=now,
        updated_at=now,
        settings=UserSettingsResponse(
            id=uuid4(),
            user_id=uid,
            daily_goal=20,
            email_notifications=True,
            created_at=now,
            updated_at=now,
        ),
    )


# =============================================================================
# PERF-16-03: GET /auth/me body cache tests (RED)
# =============================================================================


@pytest.mark.unit
class TestGetMeBodyCacheRed:
    """RED tests: caching not yet wired into src/api/v1/auth.py's get_me."""

    async def test_get_me_second_call_served_from_cache(self):
        """Two calls to get_me() against a stateful fake cache: the DB
        reload + response build must run exactly ONCE; both results are
        value-equal (the second is reconstructed from the cached
        model_dump(mode="json") via model_validate).

        RED: get_me() doesn't touch the cache today, so BOTH db.execute
        (the reload) and _build_user_profile_response run on every call
        -- call_count == 2 instead of the expected 1.
        """
        user_id = uuid4()
        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_make_mock_reload_result(user_id))

        current_user = MagicMock(id=user_id)
        request = _make_mock_request()
        valid_response = _make_valid_profile_response(user_id)
        fake_cache = _StatefulFakeCache()

        with (
            patch("src.api.v1.auth.get_cache", return_value=fake_cache),
            patch(
                "src.api.v1.auth._build_user_profile_response",
                return_value=valid_response,
            ) as build_spy,
        ):
            first = await get_me(request=request, current_user=current_user, db=db)
            second = await get_me(request=request, current_user=current_user, db=db)

        assert build_spy.call_count == 1, (
            "Expected the reload+build to run once (second call served "
            f"from cache), got {build_spy.call_count} call(s)"
        )
        assert (
            db.execute.call_count == 1
        ), f"Expected the DB reload to run once, got {db.execute.call_count} call(s)"
        assert first == second, f"Expected equal responses, got {first!r} != {second!r}"

    async def test_get_me_cold_miss_returns_settings_populated(self):
        """Empty cache: get_me() runs the real selectinload(User.settings)
        reload-then-build path and the response has settings populated.

        NOT patching _build_user_profile_response here (unlike the other
        tests in this class) -- this test exercises the real
        reload-then-build contract shape with a genuine (unpersisted)
        User + UserSettings pair, guarding the MissingGreenlet-adjacent
        risk get_me's own docstring warns about.

        PRESERVATION GUARD, not a RED spec: get_me's reload+build already
        works correctly pre-cache -- this is exactly what it does today
        -- so this test passes both before and after PERF-16-03. It
        exists to catch a regression where the caching wrapper
        accidentally serves an empty/partial settings object on the cold
        path.
        """
        user_id = uuid4()
        now = datetime.now(timezone.utc)

        user = User(
            id=user_id,
            email="cold-miss@example.com",
            full_name="Cold Miss User",
            is_active=True,
            is_superuser=False,
            avatar_url=None,
            subscription_status=SubscriptionStatus.NONE,
            created_at=now,
            updated_at=now,
        )
        user.settings = UserSettings(
            id=uuid4(),
            user_id=user_id,
            daily_goal=20,
            email_notifications=True,
            created_at=now,
            updated_at=now,
        )

        db = _make_mock_db()
        mock_result = MagicMock()
        mock_result.scalar_one.return_value = user
        db.execute = AsyncMock(return_value=mock_result)

        request = _make_mock_request()
        fake_cache = _StatefulFakeCache()

        with (
            patch("src.api.v1.auth.get_cache", return_value=fake_cache),
            patch("src.api.v1.auth.get_s3_service") as mock_get_s3,
        ):
            mock_get_s3.return_value = MagicMock()
            result = await get_me(request=request, current_user=user, db=db)

        assert isinstance(result, UserProfileResponse)
        assert result.settings is not None, "Expected settings to be populated on the cold path"
        assert result.settings.daily_goal == 20
        assert result.settings.user_id == user_id

    async def test_get_me_degrades_without_cache(self):
        """cache.get_or_set() returning None (cache disabled/unavailable,
        matching CacheService.get_or_set's own documented "or None if
        both fail" contract) must fall back to the direct reload+build
        path rather than crashing on model_validate(None).

        RED: get_me() never calls get_cache()/get_or_set() at all today
        -- the mock_cache.get_or_set spy sees zero calls instead of one.
        """
        user_id = uuid4()
        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_make_mock_reload_result(user_id))

        current_user = MagicMock(id=user_id)
        request = _make_mock_request()
        valid_response = _make_valid_profile_response(user_id)

        mock_cache = MagicMock()
        mock_cache.get_or_set = AsyncMock(return_value=None)

        with (
            patch("src.api.v1.auth.get_cache", return_value=mock_cache),
            patch(
                "src.api.v1.auth._build_user_profile_response",
                return_value=valid_response,
            ) as build_spy,
        ):
            result = await get_me(request=request, current_user=current_user, db=db)

        assert mock_cache.get_or_set.call_count == 1, (
            "Expected get_me to call cache.get_or_set once even on the "
            f"degraded path, got {mock_cache.get_or_set.call_count} call(s)"
        )
        assert isinstance(result, UserProfileResponse)
        assert build_spy.call_count == 1, (
            "Expected the direct build() fallback when get_or_set degrades "
            f"to None, got {build_spy.call_count} call(s)"
        )


# =============================================================================
# PERF-16-03: QA adversarial coverage (post-implementation, GREEN)
# =============================================================================


@pytest.mark.unit
class TestGetMeBodyCacheQAAdversarial:
    """QA-authored coverage added on top of the RED specs above (which only
    prove get_me() wires into the cache correctly). These prove the hit
    path is genuinely ORM-free/DB-free (a stronger MissingGreenlet-adjacent
    guard than a call-count assertion on a db that would happily respond),
    that a corrupted cache entry degrades safely instead of 500ing, and
    that the JSON round-trip preserves the nested settings object exactly.
    """

    async def test_cache_hit_never_touches_db_or_rebuilds(self):
        """A pre-warmed cache entry (as if set by a prior, unrelated
        request) must be served without calling db.execute or
        _build_user_profile_response at all -- not just "called once
        across two calls" (test_get_me_second_call_served_from_cache) but
        "called zero times when the entry is already warm". The db mock
        raises on any .execute() call, so a real touch fails loudly
        instead of silently succeeding against a permissive mock.
        """
        user_id = uuid4()
        valid_response = _make_valid_profile_response(user_id)
        cached_body = valid_response.model_dump(mode="json")

        fake_cache = _StatefulFakeCache()
        fake_cache._store[f"user:me:{user_id}"] = cached_body

        db = _make_mock_db()
        db.execute = AsyncMock(side_effect=AssertionError("db.execute must not run on a cache hit"))

        current_user = MagicMock(id=user_id)
        request = _make_mock_request()

        with (
            patch("src.api.v1.auth.get_cache", return_value=fake_cache),
            patch(
                "src.api.v1.auth._build_user_profile_response",
                side_effect=AssertionError(
                    "_build_user_profile_response must not run on a cache hit"
                ),
            ) as build_spy,
        ):
            result = await get_me(request=request, current_user=current_user, db=db)

        assert db.execute.call_count == 0, "Cache hit touched the DB"
        assert (
            build_spy.call_count == 0
        ), "Cache hit rebuilt the response instead of reusing the cached dict"
        assert result == valid_response

    async def test_get_me_validation_error_falls_back_to_reload(self):
        """A malformed cached dict (missing a required field) makes
        UserProfileResponse.model_validate(cached) raise ValidationError;
        get_me must catch it and fall back to the real reload+build path,
        returning a valid body instead of propagating a 500.
        """
        user_id = uuid4()
        malformed_cached = {"id": str(user_id), "email": "malformed@example.com"}
        # Missing is_active, is_superuser, created_at, updated_at, settings, ...
        # -> UserProfileResponse.model_validate() raises ValidationError.

        fake_cache = _StatefulFakeCache()
        fake_cache._store[f"user:me:{user_id}"] = malformed_cached

        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_make_mock_reload_result(user_id))

        current_user = MagicMock(id=user_id)
        request = _make_mock_request()
        valid_response = _make_valid_profile_response(user_id)

        with (
            patch("src.api.v1.auth.get_cache", return_value=fake_cache),
            patch(
                "src.api.v1.auth._build_user_profile_response",
                return_value=valid_response,
            ) as build_spy,
        ):
            result = await get_me(request=request, current_user=current_user, db=db)

        assert isinstance(result, UserProfileResponse)
        assert result == valid_response
        assert build_spy.call_count == 1, (
            "Expected the ValidationError fallback to reload+rebuild once, "
            f"got {build_spy.call_count} call(s)"
        )
        assert db.execute.call_count == 1

    async def test_cache_round_trip_preserves_settings_fields(self):
        """First call is a genuine cold miss (real reload+build, no mocked
        _build_user_profile_response -- same shape as
        test_get_me_cold_miss_returns_settings_populated); the second call
        must be served from the SAME fake-cache dict store, reconstructed
        via model_validate from the model_dump(mode="json") the first call
        produced. Locks in that the nested UserSettingsResponse survives
        the JSON round-trip with its exact field values, not just "settings
        is not None".
        """
        user_id = uuid4()
        settings_id = uuid4()
        now = datetime.now(timezone.utc)

        user = User(
            id=user_id,
            email="roundtrip@example.com",
            full_name="Round Trip User",
            is_active=True,
            is_superuser=False,
            avatar_url=None,
            subscription_status=SubscriptionStatus.NONE,
            created_at=now,
            updated_at=now,
        )
        user.settings = UserSettings(
            id=settings_id,
            user_id=user_id,
            daily_goal=42,
            email_notifications=False,
            created_at=now,
            updated_at=now,
        )

        db = _make_mock_db()
        mock_result = MagicMock()
        mock_result.scalar_one.return_value = user
        db.execute = AsyncMock(return_value=mock_result)

        request = _make_mock_request()
        fake_cache = _StatefulFakeCache()

        with (
            patch("src.api.v1.auth.get_cache", return_value=fake_cache),
            patch("src.api.v1.auth.get_s3_service") as mock_get_s3,
        ):
            mock_get_s3.return_value = MagicMock()
            first = await get_me(request=request, current_user=user, db=db)
            second = await get_me(request=request, current_user=user, db=db)

        assert db.execute.call_count == 1, "Expected the second call to be served from cache"
        assert second.settings is not None
        assert second.settings.id == settings_id
        assert second.settings.user_id == user_id
        assert second.settings.daily_goal == 42
        assert second.settings.email_notifications is False
        assert second.settings.created_at == first.settings.created_at
        assert second.settings.updated_at == first.settings.updated_at
        assert second == first
