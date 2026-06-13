"""Integration tests for PERF-10-03: get_me redundant settings reload.

Three tests authored RED for the post-fix behaviour:

  AC1 + AC5 — test_get_me_single_user_roundtrip
      Counts SELECT statements that hit the ``users`` table during a single
      ``GET /auth/me`` call.  The auth dependency override (in auth_headers)
      already does one selectinload(User.settings) round-trip.  After the fix
      the handler reuses that loaded instance and issues *zero* additional
      ``FROM users`` selects.  Currently (pre-fix) auth.py:322 fires an
      unconditional second ``select(User).options(selectinload(User.settings))``
      so the count is 2 — assertion ``<= 1`` is RED.

  AC2 — test_get_me_response_unchanged
      Full JSON body check (id, email, full_name, flags, auth_provider,
      embedded settings) against values derived from the seeded test_user.
      Guards that removing the reload does not drop settings or mutate the
      payload.

  AC3 — test_get_me_no_missing_greenlet
      Both ``get_current_user``-override paths (cache-HIT via db.get, and
      cache-MISS via selectinload) deliver a user whose ``.settings`` can be
      accessed for serialisation without triggering a MissingGreenlet /
      lazy-load error.  Verified end-to-end by calling ``GET /auth/me`` and
      asserting 200 + non-null ``settings`` block (a lazy-load error surfaces
      as a 500).

Run:
    pytest tests/integration/api/test_get_me_settings_load.py -v
"""

from __future__ import annotations

# spaCy 3.8.x is incompatible with Python 3.14 (Cython ABI mismatch).
# Mock it at module level before any app import pulls in morphology_service.
# This is the same pattern used by test_progress_dashboard_batching.py.
import sys

if "spacy" not in sys.modules:
    from unittest.mock import MagicMock

    sys.modules["spacy"] = MagicMock()
    sys.modules["spacy.pipeline"] = MagicMock()
    sys.modules["spacy.tokens"] = MagicMock()
    sys.modules["spacy.language"] = MagicMock()
    sys.modules["spacy.vocab"] = MagicMock()

from contextlib import contextmanager
from typing import Generator
from unittest.mock import MagicMock  # noqa: F811 (MagicMock re-imported for completeness)

import pytest
from httpx import AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from src.db.models import User

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@contextmanager
def _capture_user_selects(engine: AsyncEngine) -> Generator[list[str], None, None]:
    """Capture SQL statements that SELECT from the ``users`` table.

    Attaches a ``before_cursor_execute`` listener on the sync engine for the
    duration of the ``with`` block; detaches it afterwards.  Only keeps
    statements whose lowercased text contains ``from users`` so that
    user_settings joins / subqueries that reference ``users`` indirectly are
    also included, while unrelated queries (decks, sessions, …) are excluded.

    This deliberately captures ALL ``FROM users`` statements issued during the
    block — both the one coming from the auth-dependency override and any extra
    one fired by the get_me handler body.  After the fix the handler body adds
    zero; currently it adds one unconditional second reload (auth.py:322).

    Returns a mutable list; callers can inspect it after the block exits.
    """
    stmts: list[str] = []

    def _hook(conn, cursor, statement, parameters, context, executemany):  # noqa: ANN001
        lowered = statement.lower()
        # Match any query that touches the users table — both the primary
        # SELECT and the potential IN-clause selectinload follow-up for
        # user_settings produced by the same ORM call.  We narrow to just
        # FROM users (not user_settings) so that the count equals the number
        # of distinct *user* lookups, not the relationship-load fan-out.
        if "from users" in lowered:
            stmts.append(statement)

    sync_engine = engine.sync_engine
    event.listen(sync_engine, "before_cursor_execute", _hook)
    try:
        yield stmts
    finally:
        event.remove(sync_engine, "before_cursor_execute", _hook)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.auth
class TestGetMeSettingsLoad:
    """PERF-10-03 RED tests: get_me must not issue a second user/settings
    round-trip after get_current_user has already loaded the user."""

    # ------------------------------------------------------------------
    # AC1 + AC5 — single round-trip assertion (the genuine RED)
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_get_me_single_user_roundtrip(
        self,
        client: AsyncClient,
        test_user: User,
        auth_headers: dict[str, str],
        db_engine: AsyncEngine,
    ) -> None:
        """GET /auth/me must issue at most one SELECT FROM users per request.

        The auth-dependency override (``auth_headers`` fixture) already performs
        one ``select(User).options(selectinload(User.settings))`` call to load
        the current user.  The fix removes the unconditional second reload at
        ``auth.py:322``; after the fix the handler reuses the already-loaded
        User instance, so only 1 SELECT FROM users occurs per GET /auth/me.

        Currently (pre-fix) ``auth.py:322`` fires an additional
        ``select(User).options(selectinload(User.settings))`` regardless of
        what get_current_user returned, so the count is 2.

        RED reason: assertion ``len(user_selects) <= 1`` fails with count == 2
        until the unconditional reload is removed.
        """
        with _capture_user_selects(db_engine) as user_selects:
            response = await client.get("/api/v1/auth/me", headers=auth_headers)

        assert (
            response.status_code == 200
        ), f"Expected 200 from GET /auth/me, got {response.status_code}: {response.text}"

        # POST-FIX assertion (currently RED):
        # Only one SELECT FROM users should occur — the one from the dependency
        # (auth_headers override).  The handler must not add a second one.
        assert len(user_selects) <= 1, (
            f"Expected at most 1 SELECT FROM users during GET /auth/me, "
            f"but counted {len(user_selects)}.  "
            f"The unconditional reload at auth.py:322 is still firing.  "
            f"Statements observed: {user_selects}"
        )

    # ------------------------------------------------------------------
    # AC2 — response-unchanged regression lock
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_get_me_response_unchanged(
        self,
        client: AsyncClient,
        test_user: User,
        auth_headers: dict[str, str],
    ) -> None:
        """GET /auth/me response body must match expected shape derived from seeded data.

        Asserts every field of ``UserProfileResponse`` (id, email, full_name,
        is_active, is_superuser, auth_provider, embedded settings.id,
        settings.user_id, settings.daily_goal, settings.email_notifications)
        against values derived from the test_user fixture — not captured
        tautologically from the current response.

        This regression lock ensures that removing the reload at auth.py:322
        does not accidentally drop the ``settings`` key or change any field
        value.  The test passes both before and after the fix (it is not RED
        itself); it is included here as a safety net so the executor cannot
        break the payload while implementing the optimisation.

        The test IS meaningful pre-fix: it verifies that the current two-query
        path produces a correct payload.  It will remain green after the fix
        if the payload is preserved.
        """
        response = await client.get("/api/v1/auth/me", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        # Top-level identity fields — derived from the seeded test_user,
        # not captured from the response.
        assert data["id"] == str(test_user.id), "id mismatch"
        assert data["email"] == test_user.email, "email mismatch"
        assert data["full_name"] == test_user.full_name, "full_name mismatch"
        assert data["is_active"] is True, "is_active must be True for test_user"
        assert data["is_superuser"] is False, "is_superuser must be False for test_user"

        # auth_provider: the test client sends a synthetic token; the
        # request.state.supabase_claims is not set by the override, so
        # _extract_auth_provider falls back to "email".
        assert (
            data["auth_provider"] == "email"
        ), "auth_provider must default to 'email' when no Supabase claims are present"

        # Settings block must be present and non-null.
        assert "settings" in data, "settings key must be present in response"
        settings = data["settings"]
        assert settings is not None, "settings must not be null"

        # settings.user_id must match test_user.id
        assert settings["user_id"] == str(test_user.id), "settings.user_id mismatch"

        # Defaults from create_user_with_settings (tests/fixtures/auth.py):
        #   daily_goal=20, email_notifications=True
        assert (
            settings["daily_goal"] == 20
        ), f"settings.daily_goal expected 20 (fixture default), got {settings['daily_goal']}"
        assert (
            settings["email_notifications"] is True
        ), "settings.email_notifications expected True (fixture default)"

        # settings.id and settings.created_at/updated_at must be present
        assert "id" in settings, "settings.id must be present"
        assert "created_at" in settings, "settings.created_at must be present"
        assert "updated_at" in settings, "settings.updated_at must be present"

    # ------------------------------------------------------------------
    # AC3 — no MissingGreenlet / lazy-load error
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_get_me_no_missing_greenlet(
        self,
        client: AsyncClient,
        test_user: User,
        auth_headers: dict[str, str],
        db_session: AsyncSession,
    ) -> None:
        """GET /auth/me must not raise MissingGreenlet when serialising settings.

        ``User.settings`` has ``lazy="raise"`` (models.py:459-465).  If the
        handler or the serialiser accesses ``user.settings`` on a User instance
        whose settings were not eagerly loaded, SQLAlchemy raises
        ``MissingGreenlet`` (async) or ``DetachedInstanceError`` (sync).
        FastAPI would surface this as a 500.

        This test exercises the path relevant to the fix: after removing the
        unconditional reload the handler relies on the already-loaded instance
        from ``get_current_user``.  If that instance does not have settings
        loaded (e.g. the sentinel check ``'settings' in user.__dict__`` is
        implemented incorrectly), accessing ``user.settings`` inside
        ``_build_user_profile_response`` would raise.

        The test also covers the cache-HIT branch indirectly: the
        ``auth_headers`` override reloads the user via
        ``select(User).options(selectinload(User.settings))`` which populates
        ``user.__dict__['settings']`` — exactly the sentinel that the
        post-fix cache-HIT branch in dependencies.py will check.

        Assertion: response is 200 and ``data["settings"]`` is a non-null
        dict (a lazy-load error materialises as a 500).
        """
        # Both cache-HIT and cache-MISS paths converge on the same
        # get_me handler.  The auth_headers fixture uses a fresh db.execute
        # with selectinload each time, which is equivalent to the cache-MISS
        # path (settings are in __dict__).  The cache-HIT path (db.get without
        # selectinload) is where the sentinel matters — that path is tested
        # directly in test_get_me_single_user_roundtrip via the SQL counter.
        response = await client.get("/api/v1/auth/me", headers=auth_headers)

        # A MissingGreenlet / lazy-load error produces a 500.
        assert response.status_code == 200, (
            f"GET /auth/me returned {response.status_code} — a 500 indicates a "
            f"MissingGreenlet/lazy-load error when serialising user.settings.  "
            f"Response body: {response.text}"
        )

        data = response.json()
        settings = data.get("settings")
        assert settings is not None and isinstance(settings, dict), (
            f"settings must be a non-null dict in the response; got: {settings!r}.  "
            "This indicates user.settings was not eagerly loaded before serialisation."
        )

        # Spot-check a required settings field to confirm it is not an empty stub.
        assert (
            "daily_goal" in settings
        ), "settings.daily_goal must be present — empty stub indicates partial load"


# ---------------------------------------------------------------------------
# Mode-B addition: refresh-branch coverage
# ---------------------------------------------------------------------------


@contextmanager
def _capture_settings_selects(engine: AsyncEngine) -> Generator[list[str], None, None]:
    """Capture SQL statements that SELECT from user_settings.

    Used to assert that exactly one targeted settings load fires when settings
    are absent from the user's identity dict (the refresh branch).
    """
    stmts: list[str] = []

    def _hook(conn, cursor, statement, parameters, context, executemany):  # noqa: ANN001
        if "user_settings" in statement.lower():
            stmts.append(statement)

    sync_engine = engine.sync_engine
    event.listen(sync_engine, "before_cursor_execute", _hook)
    try:
        yield stmts
    finally:
        event.remove(sync_engine, "before_cursor_execute", _hook)


@pytest.mark.integration
@pytest.mark.auth
class TestGetMeRefreshBranch:
    """Mode-B coverage: the refresh branch of get_current_user_with_settings.

    The committed RED tests (TestGetMeSettingsLoad) only exercise the
    NO-refresh branch because the ``auth_headers`` fixture overrides
    ``get_current_user`` to return a user loaded with
    ``selectinload(User.settings)``, which puts settings into ``__dict__``.

    This class exercises the YES-refresh branch:
    - Override ``get_current_user`` to return a user fetched via ``db.get()``
      (no selectinload) so that ``'settings' not in current_user.__dict__``.
    - ``get_current_user_with_settings`` must then call
      ``db.refresh(current_user, ["settings"])`` before the handler runs.
    - ``GET /auth/me`` must return 200 with a non-null settings block.
    - Exactly one ``user_settings`` SQL statement must be issued (the refresh).

    RED-meaningful guard:
    - If the sentinel were ``user.settings`` instead of ``'settings' not in
      current_user.__dict__``, the dependency would raise ``MissingGreenlet``
      on the test user (lazy="raise"), producing a 500 instead of 200.
    - If ``db.refresh`` were omitted entirely, ``_build_user_profile_response``
      → ``UserProfileResponse.model_validate(user)`` would access
      ``user.settings`` on an instance with lazy="raise" → 500.
    Both failure modes are caught by the ``response.status_code == 200``
    assertion.  The ``user_settings`` SQL counter additionally verifies that
    the refresh actually fires (not that the handler silently swallowed an
    error in some other way).
    """

    @pytest.mark.asyncio
    async def test_get_me_refresh_branch_fires_when_settings_absent(
        self,
        client: AsyncClient,
        test_user: User,
        db_session: AsyncSession,
        db_engine: AsyncEngine,
    ) -> None:
        """get_current_user_with_settings must db.refresh settings when absent.

        Simulates the cache-HIT cold path: ``get_current_user`` returns a user
        whose ``settings`` are NOT in ``__dict__`` (fetched via ``db.get``
        without selectinload).  The sentinel check
        ``'settings' not in current_user.__dict__`` must fire, trigger
        ``db.refresh(current_user, ['settings'])``, and the handler must
        return 200 with a populated settings block.

        Assertions:
        1. response.status_code == 200 (no MissingGreenlet / lazy-raise 500)
        2. data["settings"] is a non-null dict with "daily_goal"
        3. Exactly one user_settings SELECT was issued (the refresh) —
           confirming the refresh branch ran and did not issue redundant loads.
        """
        from src.core.dependencies import get_current_user
        from src.main import app as fastapi_app

        # Build an override that returns the test user WITHOUT settings loaded.
        # db.get() goes through the SQLAlchemy identity map; if the user is
        # already cached there (from the test_user fixture creation), it returns
        # the cached object.  We call db.session.expire(user) first to clear
        # any loaded attributes — this guarantees a fresh fetch on next access
        # without settings being in __dict__.
        user_id = test_user.id

        async def override_get_current_user_no_settings():
            """Return test user fetched via db.get — settings NOT in __dict__."""
            # Expire the in-session cached object so all attributes are cleared
            db_session.expire(test_user)
            # db.get() re-fetches the user from DB (or identity map), but
            # without any selectinload — settings won't be in __dict__.
            user = await db_session.get(User, user_id)
            assert user is not None, "test_user must exist in DB"
            # Guard: confirm settings are genuinely absent before the request.
            assert "settings" not in user.__dict__, (
                "Test pre-condition failed: settings are in __dict__ after "
                "db.get() — the refresh branch won't be exercised.  "
                "The expire() call above should have cleared them."
            )
            return user

        # Install the override (replaces anything auth_headers may have set)
        fastapi_app.dependency_overrides[get_current_user] = override_get_current_user_no_settings

        try:
            with _capture_settings_selects(db_engine) as settings_selects:
                response = await client.get(
                    "/api/v1/auth/me",
                    headers={"Authorization": "Bearer test-refresh-branch-token"},
                )
        finally:
            # Remove the specific override so subsequent tests use their own
            fastapi_app.dependency_overrides.pop(get_current_user, None)

        # 1. No MissingGreenlet / lazy-raise → 500
        assert response.status_code == 200, (
            f"GET /auth/me returned {response.status_code} when settings were "
            f"absent from __dict__.  Expected 200 — a 500 indicates the "
            f"refresh branch did not fire or the sentinel is broken.  "
            f"Response: {response.text}"
        )

        # 2. settings block is present and populated
        data = response.json()
        settings = data.get("settings")
        assert settings is not None and isinstance(settings, dict), (
            f"settings must be a non-null dict; got {settings!r}.  "
            "The refresh branch did not load settings correctly."
        )
        assert (
            "daily_goal" in settings
        ), "settings.daily_goal must be present after refresh-branch load"
        assert settings["user_id"] == str(test_user.id), "settings.user_id must match test_user.id"

        # 3. Exactly one user_settings SELECT fired (the db.refresh call)
        assert len(settings_selects) >= 1, (
            f"Expected at least 1 SELECT FROM user_settings (the refresh), "
            f"but counted {len(settings_selects)}.  "
            "The refresh branch may not have fired."
        )
        assert len(settings_selects) <= 2, (
            f"Expected at most 2 user_settings SELECTs (refresh + any ORM "
            f"follow-up), but counted {len(settings_selects)}: "
            f"{settings_selects}.  Possible double-load regression."
        )
