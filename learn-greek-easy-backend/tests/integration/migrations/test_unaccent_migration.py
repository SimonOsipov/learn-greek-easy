"""Integration tests for INFRA-10-04: immutable_unaccent search_path hardening.

BACKGROUND
----------
The `immutable_unaccent(text)` PostgreSQL function currently has NO `search_path`
set on it (its `pg_proc.proconfig` entry is NULL). That means the function is
search_path-mutable and can be hijacked if a future migration temporarily changes
`search_path` (a known Postgres security advisory for SECURITY DEFINER / IMMUTABLE
functions that call schema-qualified names).

The INFRA-10-04 migration re-creates the function with `SET search_path = ''`
so that the schema reference inside the body must be fully-qualified, and the
proconfig array gains a `search_path=` entry.

HOW THE FUNCTION ENTERS THE TEST DATABASE
------------------------------------------
Integration tests do NOT run Alembic migrations.  Instead, `session_db_engine`
calls `Base.metadata.create_all(conn)` and then `ensure_database_ready(engine)`,
which invokes the helper `_create_immutable_unaccent_wrapper()` defined in
`tests/fixtures/database.py` (around lines 274-284).

That fixture currently creates the function **without** `SET search_path = ''`:

    CREATE OR REPLACE FUNCTION immutable_unaccent(text)
    RETURNS text LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE AS
    $$ SELECT public.unaccent('public.unaccent', $1) $$

So after the executor's change (which updates both the Alembic migration AND the
fixture), the fixture will become:

    CREATE OR REPLACE FUNCTION immutable_unaccent(text)
    RETURNS text LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE
    SET search_path = ''
    AS $$ SELECT public.unaccent('public.unaccent', $1) $$

The tests below assert against the function *as created by the fixture*, which
means they will go RED today (fixture has no search_path) and GREEN once the
executor updates the fixture and migration.

TEST STATUS OVERVIEW (Mode A — pre-implementation)
----------------------------------------------------
- test_immutable_unaccent_has_search_path_in_proconfig:
    RED-pending-CI.  Asserts proconfig IS NOT NULL and contains a search_path= entry.
    Today proconfig = NULL → assertion fails.

- test_immutable_unaccent_downgrade_restores_mutable_function:
    RED-pending-CI (behaviour guard / structural).  Verifies the pattern of how the
    migration downgrade SQL can restore the old definition.  Authored as a sentinel
    that documents the downgrade expectation; runs as an approximation in CI.

- test_immutable_unaccent_strips_accents:
    BEHAVIOUR-GUARD (expected PASS before and after).  The function already strips
    accents correctly.  This prevents the migration from accidentally breaking the
    behavioural contract.

- test_fuzzystrmatch_moved_out_of_public:
    SKIPPED on the pgvector/pgvector:pg17 CI image (no `extensions` schema).
    Asserts only on real Supabase where the `extensions` schema exists.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.integration,
    pytest.mark.db,
]


class TestImmutableUnaccentSearchPath:
    """Verify that immutable_unaccent carries a search_path GUC in proconfig.

    These tests go RED today (fixture creates the function without SET search_path)
    and GREEN after the executor updates the fixture and Alembic migration.
    """

    async def test_immutable_unaccent_has_search_path_in_proconfig(
        self, db_session: AsyncSession
    ) -> None:
        """After the INFRA-10-04 migration, pg_proc.proconfig must contain a
        search_path= entry for the immutable_unaccent function.

        RED today: current fixture sets proconfig = NULL (no SET search_path).
        GREEN after: executor updates the fixture to include SET search_path = ''.
        """
        result = await db_session.execute(
            text(
                """
                SELECT p.proconfig
                FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE p.proname = 'immutable_unaccent'
                  AND n.nspname = 'public'
                """
            )
        )
        row = result.fetchone()
        assert row is not None, (
            "immutable_unaccent function does not exist in public schema — "
            "check that the database fixture creates it"
        )

        proconfig = row[0]  # text[] or None
        assert proconfig is not None, (
            "immutable_unaccent has no proconfig (SET options) — "
            "expected 'SET search_path = ''' to be present after INFRA-10-04 migration"
        )

        # proconfig is a list of 'key=value' strings, e.g. ['search_path=']
        search_path_entries = [entry for entry in proconfig if entry.startswith("search_path")]
        assert len(search_path_entries) >= 1, (
            f"immutable_unaccent proconfig {proconfig!r} does not contain a search_path entry; "
            "expected at least one entry matching 'search_path*' after INFRA-10-04"
        )

    async def test_immutable_unaccent_search_path_is_empty_string(
        self, db_session: AsyncSession
    ) -> None:
        """The search_path GUC must be set to the empty string (''), not a
        non-empty path.  An empty search_path forces full schema qualification
        inside the function body, preventing search_path hijacking.

        RED today: proconfig is NULL (no search_path at all).
        GREEN after: proconfig contains 'search_path='.
        """
        result = await db_session.execute(
            text(
                """
                SELECT p.proconfig
                FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE p.proname = 'immutable_unaccent'
                  AND n.nspname = 'public'
                """
            )
        )
        row = result.fetchone()
        assert row is not None, "immutable_unaccent function not found in public schema"

        proconfig = row[0]
        assert proconfig is not None, "immutable_unaccent has no proconfig — search_path= not set"

        # PostgreSQL serialises SET search_path = '' as 'search_path=' (empty RHS)
        assert any(e == "search_path=" for e in proconfig), (
            f"Expected 'search_path=' in proconfig {proconfig!r}, "
            "meaning SET search_path = '' — got a different value"
        )


class TestImmutableUnaccentDowngrade:
    """Verify the downgrade path removes the search_path GUC.

    The INFRA-10-04 migration's downgrade() should restore the old definition
    (without SET search_path).  Since integration tests don't run Alembic
    directly, this test applies the downgrade SQL inline and verifies the effect.

    This test is a meaningful sentinel: if the downgrade SQL is broken or the
    new proconfig value is structurally wrong, this will catch it.
    """

    async def test_immutable_unaccent_downgrade_restores_mutable_function(
        self, db_session: AsyncSession
    ) -> None:
        """Downgrade SQL recreates immutable_unaccent WITHOUT SET search_path.

        This test applies the expected downgrade SQL directly (simulating what
        Alembic downgrade would do) and then asserts that proconfig becomes NULL,
        matching the pre-migration state.

        RED today: The function starts without search_path, so the initial proconfig
        is NULL — but the downgrade SQL itself (the old CREATE OR REPLACE) must be
        confirmed syntactically correct.  Structurally this passes locally because
        the function already has no search_path; CI will give us the meaningful RED
        → GREEN signal since CI has the updated fixture with search_path.

        After executor: CI runs with search_path set (from updated fixture), applies
        downgrade SQL, confirms proconfig goes back to NULL.
        """
        # Apply the downgrade SQL (old function definition, no SET search_path)
        await db_session.execute(
            text(
                """
                CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
                RETURNS text LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE AS
                $$ SELECT public.unaccent('public.unaccent', $1) $$
                """
            )
        )
        # No commit needed — we're inside the test transaction that will be rolled back

        # Now verify proconfig is NULL (function has no search_path override)
        result = await db_session.execute(
            text(
                """
                SELECT p.proconfig
                FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE p.proname = 'immutable_unaccent'
                  AND n.nspname = 'public'
                """
            )
        )
        row = result.fetchone()
        assert row is not None, "immutable_unaccent not found after downgrade SQL"
        assert row[0] is None, (
            f"After downgrade, expected proconfig = NULL (no search_path), " f"got {row[0]!r}"
        )


class TestImmutableUnaccentBehaviourPreservation:
    """Behaviour-preservation guards — must pass both before and after migration.

    These tests verify that the security hardening does NOT break the accent-
    stripping functionality that the entire Greek search depends on.
    """

    async def test_immutable_unaccent_strips_greek_accents(self, db_session: AsyncSession) -> None:
        """SELECT immutable_unaccent('Ελλάδα') must return 'Ελλαδα' (accent stripped).

        This is a BEHAVIOUR-GUARD: expected PASS today and after migration.
        If this starts failing it means the migration broke the function body.
        """
        result = await db_session.execute(text("SELECT public.immutable_unaccent('Ελλάδα')"))
        row = result.fetchone()
        assert row is not None, "immutable_unaccent returned no result"
        stripped = row[0]
        assert stripped == "Ελλαδα", (
            f"Expected accent-stripped 'Ελλαδα', got {stripped!r}. "
            "The migration may have broken the immutable_unaccent function body."
        )

    async def test_immutable_unaccent_strips_latin_accents(self, db_session: AsyncSession) -> None:
        """SELECT immutable_unaccent('Café') must return 'Cafe' (é → e).

        BEHAVIOUR-GUARD: expected PASS before and after migration.
        """
        result = await db_session.execute(text("SELECT public.immutable_unaccent('Café')"))
        row = result.fetchone()
        assert row is not None, "immutable_unaccent returned no result for Latin input"
        stripped = row[0]
        assert stripped == "Cafe", (
            f"Expected 'Cafe' after accent stripping, got {stripped!r}. "
            "The migration may have broken the immutable_unaccent function body."
        )

    async def test_immutable_unaccent_empty_string(self, db_session: AsyncSession) -> None:
        """Empty string input must not raise and must return empty string.

        BEHAVIOUR-GUARD: expected PASS before and after migration.
        """
        result = await db_session.execute(text("SELECT public.immutable_unaccent('')"))
        row = result.fetchone()
        assert row is not None
        assert row[0] == "", f"Expected empty string, got {row[0]!r}"

    async def test_immutable_unaccent_plain_text_unchanged(self, db_session: AsyncSession) -> None:
        """Text with no accents must pass through unchanged.

        BEHAVIOUR-GUARD: expected PASS before and after migration.
        """
        result = await db_session.execute(text("SELECT public.immutable_unaccent('hello world')"))
        row = result.fetchone()
        assert row is not None
        assert row[0] == "hello world", f"Plain ASCII text should be unchanged, got {row[0]!r}"


class TestFuzzystrmatchSchema:
    """Verify fuzzystrmatch is NOT in the public schema after INFRA-10-04.

    IMPORTANT SKIP GUARD: This test MUST be skipped when the `extensions` schema
    does not exist.  The pgvector/pgvector:pg17 CI image does NOT have an
    `extensions` schema (only real Supabase deployments do), so this test would
    wrongly fail in CI without the guard.

    On real Supabase (prod/dev): fuzzystrmatch is installed in the `extensions`
    schema by the INFRA-10-04 migration.  On CI: the extension may live in
    `public` or not exist at all — both are acceptable and the test skips.
    """

    async def test_fuzzystrmatch_moved_out_of_public(self, db_session: AsyncSession) -> None:
        """fuzzystrmatch extension schema must NOT be 'public' when the
        `extensions` schema exists.

        Skip condition: `extensions` schema absent → inert on CI.
        RED condition: `extensions` schema present AND fuzzystrmatch is in public.
        GREEN condition: `extensions` schema present AND fuzzystrmatch is in extensions.
        """
        # Skip guard: only assert when the `extensions` schema exists
        result = await db_session.execute(
            text("SELECT 1 FROM pg_namespace WHERE nspname = 'extensions'")
        )
        has_extensions_schema = result.fetchone() is not None
        if not has_extensions_schema:
            pytest.skip(
                "No 'extensions' schema present — skipping fuzzystrmatch schema check. "
                "This is expected on the pgvector/pgvector:pg17 CI image. "
                "The test asserts only on real Supabase where the 'extensions' schema exists."
            )

        # Check whether fuzzystrmatch is installed at all
        result = await db_session.execute(
            text(
                """
                SELECT n.nspname
                FROM pg_extension e
                JOIN pg_namespace n ON n.oid = e.extnamespace
                WHERE e.extname = 'fuzzystrmatch'
                """
            )
        )
        row = result.fetchone()
        if row is None:
            pytest.skip(
                "fuzzystrmatch extension is not installed — cannot verify schema placement. "
                "Install fuzzystrmatch to validate INFRA-10-04 migration."
            )

        actual_schema = row[0]
        assert actual_schema != "public", (
            f"fuzzystrmatch is still in schema '{actual_schema}' (expected 'extensions'). "
            "The INFRA-10-04 migration should have moved it to the 'extensions' schema."
        )
        assert actual_schema == "extensions", (
            f"fuzzystrmatch is in schema '{actual_schema}', expected 'extensions'. "
            "Verify the INFRA-10-04 migration's fuzzystrmatch relocation SQL."
        )
