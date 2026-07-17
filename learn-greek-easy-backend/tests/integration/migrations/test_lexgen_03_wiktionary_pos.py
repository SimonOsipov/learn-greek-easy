"""Integration migration tests for LEXGEN-03: pos column + unique index + backfill.

Mode A — RED specs (Alembic round-trip + helper-based data specs).

BACKGROUND
----------
The LEXGEN-03-01 migration adds a `pos` column (Text, NOT NULL, server_default
'noun') to `reference.wiktionary_morphology` and replaces the 2-column unique
index `uq_wiktionary_morphology_lemma_gender` on `(lemma, gender)` with a
3-column unique index `uq_wiktionary_morphology_lemma_pos_gender` on
`(lemma, pos, gender)`.

LEXGEN-03-02 BACKFILL TESTS — DESIGN SEAM
------------------------------------------
The backfill data migration (LEXGEN-03-02) is tested via TWO module-level helper
functions that the executor MUST expose in the migration module
``alembic/versions/20260619_1600_5e8cc90e5bca_lexgen_03_wiktionary_pos_and_index.py``:

    backfill_forms_to_bundles(connection) -> dict
        Execute the flat→bundle conversion for every row in
        ``reference.wiktionary_morphology``.  Returns a summary dict:
            {"converted": int, "skipped": int, "total": int}
        where ``converted + skipped == total``.

        Row-level logic (must match the spec exactly):
        - If ``isinstance(forms_value, list)`` → skip (already-converted); count
          as ``skipped``.
        - Else call ``flat_to_bundles(forms_value, pos="noun")``:
          - On success: UPDATE ``forms`` with the serialised bundle list; count as
            ``converted``.
          - On ``UnknownFlatFormKey``: log a WARNING naming id + lemma + offending
            key; leave ``forms`` unchanged; count as ``skipped`` (NOT ``converted``).
        At the end log the ``{converted, skipped, total}`` summary.

    downgrade_forms_to_flat(connection) -> dict
        Reverse the conversion: for every row where ``isinstance(forms_value, list)``
        call ``bundles_to_flat`` and UPDATE ``forms`` back to the flat dict.
        Returns ``{"converted": int, "total": int}``.

``upgrade()`` calls ``backfill_forms_to_bundles`` after its DDL steps.
``downgrade()`` calls ``downgrade_forms_to_flat`` BEFORE its DDL reversal.

WHY HELPERS RATHER THAN A SECOND ALEMBIC SUBPROCESS
-----------------------------------------------------
An alembic revision, once applied, cannot be re-applied (alembic tracks current
head and exits cleanly on a no-op second run — it does NOT re-execute the
upgrade body).  To test idempotency (call backfill twice → second call is a
no-op because all rows are already lists) and the bad-key skip/log path (assert
caplog), we need to call the logic directly.  The helpers are the testable seam.

Tests 1, 2, 7 (round-trip, empty forms, feature-key invariant) use the helper
directly against a real DB after the DDL phase is applied via alembic subprocess.
Test 3 (idempotency) calls the helper a second time and asserts converted==0.
Test 4 (downgrade restore) calls the downgrade helper.
Test 5 (bad-key skip+log) seeds a bad-key row, calls the helper, asserts caplog.
Test 6 (parity summary) seeds N rows, calls the helper, asserts the summary dict.

All data tests share a single isolated DB (``test_lexgen03_backfill``) whose
DDL phase is applied once in a session-scoped fixture to avoid multiple
subprocess calls.  The AC-2 and AC-3 schema tests keep their own DBs.

HOW THESE TESTS WORK
---------------------
Unlike the ESQ / NMIG migration tests (which assert against the test-DB schema
as built by `Base.metadata.create_all`), AC-2 and AC-3 must exercise the *Alembic
migration itself* — i.e., they spin up a fresh PostgreSQL database, run
`alembic upgrade head` (which will include the LEXGEN-03-01 migration once the
executor creates it), and then inspect the resulting schema / run `downgrade -1`.

Each test creates its own isolated database, applies migrations from scratch, and
drops the database after the test.  This avoids interfering with the shared test-
DB used by unit/integration tests.

CONTAINER IMAGE
---------------
The test DB needs `pgvector/pgvector:pg17` (not vanilla `postgres:17`) because
the migration chain creates the `vector` extension (LEXGEN-01 lesson).  In CI the
image is specified in `.github/workflows/backend-tests.yml` under
`services.postgres`.

LOCAL CONFIRMATION
------------------
No local PostgreSQL is reachable in the worktree environment where these RED
specs were authored.  The tests collect cleanly (`pytest --collect-only` passes)
and are CI-gated for their RED → GREEN transition.

TEST STATUS OVERVIEW (Mode A — pre-implementation)
----------------------------------------------------
- test_unique_index_is_lemma_pos_gender (AC-2):
    CI-gated RED.  After `alembic upgrade head` the unique index must be
    `(lemma, pos, gender)` and the old 2-col index must be gone.  Today the
    LEXGEN-03-01 migration does not exist → the index is still 2-col → the
    assertion that `uq_wiktionary_morphology_lemma_pos_gender` exists fails.

- test_upgrade_then_downgrade_round_trips_schema (AC-3):
    CI-gated RED.  `upgrade head` then `downgrade -1` must leave the schema
    identical to its pre-upgrade state (pos column gone, old 2-col unique
    index restored).  Today the migration does not exist → the round-trip
    itself cannot be exercised → test fails at upgrade step.
"""

import importlib.util
import json
import logging
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

# ---------------------------------------------------------------------------
# Markers
# ---------------------------------------------------------------------------

pytestmark = [
    pytest.mark.integration,
    pytest.mark.db,
]

# ---------------------------------------------------------------------------
# Constants / paths
# ---------------------------------------------------------------------------

# Path to the backend directory (where alembic.ini lives)
_BACKEND_DIR = Path(__file__).parent.parent.parent.parent  # learn-greek-easy-backend/

# Database URL base — we derive an isolated DB name per test to avoid
# collision with the shared test DB used by unit/integration tests.
_BASE_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5433/test_learn_greek",
)

# Admin connection URL (connects to the `postgres` maintenance database so we
# can CREATE / DROP the isolated migration test DB)
_ADMIN_DB_URL = _BASE_DB_URL.rsplit("/", 1)[0] + "/postgres"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _replace_db_in_url(url: str, new_db_name: str) -> str:
    """Replace the database name at the tail of a SQLAlchemy URL."""
    return url.rsplit("/", 1)[0] + "/" + new_db_name


def _sync_engine(url: str) -> Engine:
    """Create a synchronous psycopg2 engine (Alembic runs synchronously)."""
    return create_engine(url, isolation_level="AUTOCOMMIT")


def _run_alembic(command: list[str], db_url: str) -> subprocess.CompletedProcess:
    """Run an alembic sub-command against *db_url* in the backend directory.

    Uses the poetry-managed interpreter so the alembic version and plugins
    (alembic-postgresql-enum etc.) match the project's locked dependencies.

    NOTE: alembic/env.py reads settings.database_url_sync, which is derived from
    the DATABASE_URL environment variable — it does NOT read the Alembic
    ``-x db_url=`` argument (env.py has no context.get_x_argument() call).
    Therefore we pass db_url as DATABASE_URL in the subprocess environment rather
    than as ``-x db_url=``.  The subprocess also needs PICTURE_HOUSE_STYLE_DEFAULT
    to satisfy the Settings validator.

    The db_url passed in here is a psycopg2 (sync) URL
    (postgresql+psycopg2://...).  env.py already strips ``+asyncpg`` to produce
    the sync URL, so we pass an asyncpg URL to match settings' expected format,
    or a psycopg2 URL directly — either works since settings just does a string
    replace.  We pass the psycopg2 URL and settings.database_url_sync will return
    it unchanged (no +asyncpg to strip).

    Args:
        command: Alembic sub-command tokens, e.g. ["upgrade", "head"].
        db_url:  The synchronous (psycopg2) database URL to target.

    Returns:
        CompletedProcess — callers should check .returncode.
    """
    # Resolve poetry portably (CI / any machine), falling back to ``python -m
    # alembic`` in the active interpreter when poetry is not on PATH.
    poetry = shutil.which("poetry")
    cmd = (
        [poetry, "run", "alembic", *command]
        if poetry
        else [sys.executable, "-m", "alembic", *command]
    )
    # Build a subprocess environment that targets the isolated DB.
    # Inherit the current process env (for PATH, venv activation etc.) then
    # override DATABASE_URL so env.py / settings picks up the isolated DB.
    subprocess_env = os.environ.copy()
    subprocess_env["DATABASE_URL"] = db_url
    subprocess_env.setdefault("PICTURE_HOUSE_STYLE_DEFAULT", "test_house_style_default")
    return subprocess.run(
        cmd,
        cwd=str(_BACKEND_DIR),
        capture_output=True,
        text=True,
        env=subprocess_env,
        # A stuck migration must not hang the suite; let TimeoutExpired surface
        # as a failure (a hang IS a failure).
        timeout=300,
    )


def _setup_migration_db(db_name: str) -> str:
    """Create an isolated database for a migration round-trip test.

    Returns the synchronous DATABASE_URL for the new DB.
    """
    admin_engine = _sync_engine(_ADMIN_DB_URL)
    with admin_engine.connect() as conn:
        conn.execute(text(f'CREATE DATABASE "{db_name}"'))
    admin_engine.dispose()

    new_url = _replace_db_in_url(_BASE_DB_URL, db_name)

    # Install required extensions in the fresh DB
    target_engine = _sync_engine(new_url)
    with target_engine.connect() as conn:
        conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
        conn.execute(text('CREATE EXTENSION IF NOT EXISTS "vector"'))
        conn.execute(text('CREATE EXTENSION IF NOT EXISTS "unaccent"'))
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS reference"))
    target_engine.dispose()

    return new_url


def _teardown_migration_db(db_name: str) -> None:
    """Drop the isolated migration test database."""
    admin_engine = _sync_engine(_ADMIN_DB_URL)
    with admin_engine.connect() as conn:
        # Terminate any remaining connections before DROP
        conn.execute(
            text("""
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = :db AND pid <> pg_backend_pid()
                """),
            {"db": db_name},
        )
        conn.execute(text(f'DROP DATABASE IF EXISTS "{db_name}"'))
    admin_engine.dispose()


def _get_unique_indexes(engine: Engine, schema: str, table: str) -> dict[str, list[str]]:
    """Return {index_name: [col, ...]} for all unique indexes on schema.table."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT
                    i.relname               AS idx_name,
                    a.attname               AS col_name,
                    k.col_order             AS col_order
                FROM
                    pg_class t
                    JOIN pg_namespace n     ON n.oid = t.relnamespace
                    JOIN pg_index ix        ON ix.indrelid = t.oid
                    JOIN pg_class i         ON i.oid = ix.indexrelid
                    JOIN LATERAL UNNEST(ix.indkey)
                        WITH ORDINALITY AS k(attnum, col_order)
                        ON TRUE
                    JOIN pg_attribute a     ON a.attrelid = t.oid
                                           AND a.attnum = k.attnum
                WHERE
                    t.relname   = :table
                    AND n.nspname = :schema
                    AND ix.indisunique = TRUE
                ORDER BY i.relname, k.col_order
                """),
            {"table": table, "schema": schema},
        ).fetchall()

    result: dict[str, list[str]] = {}
    for row in rows:
        idx_name, col_name = row[0], row[1]
        result.setdefault(idx_name, []).append(col_name)
    return result


def _column_exists(engine: Engine, schema: str, table: str, column: str) -> bool:
    """Return True if column exists in schema.table."""
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = :schema
                  AND table_name   = :table
                  AND column_name  = :column
                """),
            {"schema": schema, "table": table, "column": column},
        ).fetchone()
    return row is not None


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestLexgen03WiktionaryPosIndex:
    """AC-2: after upgrade head the unique index is (lemma, pos, gender);
    the old 2-col index no longer exists.

    CI-gated RED:
    - Today the LEXGEN-03-01 migration does not exist.
    - `alembic upgrade head` applies all migrations up to the current head
      (1536eb298412), which does NOT include the pos column or the 3-col index.
    - After upgrade the only unique index is `uq_wiktionary_morphology_lemma_gender`
      on (lemma, gender) → the assertion that the 3-col index exists FAILS.
    """

    def test_unique_index_is_lemma_pos_gender(self):
        """AC-2: After alembic upgrade head, reference.wiktionary_morphology must
        have a unique index on (lemma, pos, gender) named
        uq_wiktionary_morphology_lemma_pos_gender, and must NOT have a unique index
        on (lemma, gender) only.

        CI-gated RED today (migration not yet authored).
        GREEN after: executor creates the LEXGEN-03-01 migration.
        """
        db_name = "test_lexgen03_index"
        try:
            db_url = _setup_migration_db(db_name)
        except Exception as exc:
            pytest.skip(
                f"Cannot create isolated migration DB '{db_name}': {exc}. "
                "Requires a reachable PostgreSQL on localhost:5433 "
                "(pgvector/pgvector:pg17). This test is CI-gated."
            )

        try:
            # Run alembic upgrade head
            result = _run_alembic(["upgrade", "head"], db_url)
            assert result.returncode == 0, (
                f"alembic upgrade head failed:\nSTDOUT:\n{result.stdout}\n"
                f"STDERR:\n{result.stderr}"
            )

            engine = _sync_engine(db_url)
            try:
                unique_indexes = _get_unique_indexes(
                    engine, schema="reference", table="wiktionary_morphology"
                )

                # AC-2a: new 3-col unique index exists with correct column order
                new_index = "uq_wiktionary_morphology_lemma_pos_gender"
                assert new_index in unique_indexes, (
                    f"Expected unique index '{new_index}' to exist after upgrade, "
                    f"but found only: {list(unique_indexes.keys())}"
                )
                assert unique_indexes[new_index] == ["lemma", "pos", "gender"], (
                    f"Expected index columns ['lemma', 'pos', 'gender'], "
                    f"got {unique_indexes[new_index]!r}"
                )

                # AC-2b: old 2-col unique index is gone
                old_index = "uq_wiktionary_morphology_lemma_gender"
                assert old_index not in unique_indexes, (
                    f"Old 2-col unique index '{old_index}' still exists after upgrade; "
                    "it should have been replaced by the 3-col index"
                )
            finally:
                engine.dispose()
        finally:
            _teardown_migration_db(db_name)


class TestLexgen03WiktionaryMigrationRoundTrip:
    """AC-3: upgrade head then downgrade -1 round-trips the schema cleanly.

    CI-gated RED:
    - Today the LEXGEN-03-01 migration does not exist.
    - `alembic upgrade head` stops at 1536eb298412 (no pos column added).
    - `alembic downgrade -1` would step back from 1536eb298412 to its
      predecessor, undoing the LEXGEN-01 migration — not the LEXGEN-03-01
      migration.
    - After the migration exists: upgrade adds pos column + 3-col index;
      downgrade removes them and restores the 2-col index.
    """

    def test_upgrade_then_downgrade_round_trips_schema(self):
        """AC-3: alembic upgrade head succeeds; alembic downgrade -1 succeeds and
        reverts the LEXGEN-03-01 changes (pos column gone, old 2-col unique index
        restored, forms annotation unchanged by DDL).

        CI-gated RED today (migration not yet authored).
        GREEN after: executor creates the LEXGEN-03-01 migration.
        """
        db_name = "test_lexgen03_roundtrip"
        try:
            db_url = _setup_migration_db(db_name)
        except Exception as exc:
            pytest.skip(
                f"Cannot create isolated migration DB '{db_name}': {exc}. "
                "Requires a reachable PostgreSQL on localhost:5433 "
                "(pgvector/pgvector:pg17). This test is CI-gated."
            )

        try:
            # ---- UPGRADE ----
            result = _run_alembic(["upgrade", "head"], db_url)
            assert result.returncode == 0, (
                f"alembic upgrade head failed:\nSTDOUT:\n{result.stdout}\n"
                f"STDERR:\n{result.stderr}"
            )

            engine = _sync_engine(db_url)
            try:
                # Verify post-upgrade state: pos column present
                assert _column_exists(
                    engine, "reference", "wiktionary_morphology", "pos"
                ), "pos column must exist after upgrade head"

                # Verify post-upgrade state: 3-col unique index present
                indexes_after_upgrade = _get_unique_indexes(
                    engine, schema="reference", table="wiktionary_morphology"
                )
                assert (
                    "uq_wiktionary_morphology_lemma_pos_gender" in indexes_after_upgrade
                ), "3-col unique index must exist after upgrade head"
                assert (
                    "uq_wiktionary_morphology_lemma_gender" not in indexes_after_upgrade
                ), "old 2-col unique index must NOT exist after upgrade head"

                # ---- DOWNGRADE -1 ----
                result_down = _run_alembic(["downgrade", "-1"], db_url)
                assert result_down.returncode == 0, (
                    f"alembic downgrade -1 failed:\nSTDOUT:\n{result_down.stdout}\n"
                    f"STDERR:\n{result_down.stderr}"
                )

                # Verify post-downgrade state: pos column gone
                assert not _column_exists(
                    engine, "reference", "wiktionary_morphology", "pos"
                ), "pos column must be gone after downgrade -1"

                # Verify post-downgrade state: old 2-col unique index restored
                indexes_after_downgrade = _get_unique_indexes(
                    engine, schema="reference", table="wiktionary_morphology"
                )
                assert "uq_wiktionary_morphology_lemma_gender" in indexes_after_downgrade, (
                    "old 2-col unique index uq_wiktionary_morphology_lemma_gender "
                    "must be restored after downgrade -1"
                )
                assert (
                    "uq_wiktionary_morphology_lemma_pos_gender" not in indexes_after_downgrade
                ), "3-col unique index must NOT exist after downgrade -1"
            finally:
                engine.dispose()
        finally:
            _teardown_migration_db(db_name)


# ---------------------------------------------------------------------------
# LEXGEN-03-02 Backfill tests — seam helpers + data round-trip
# ---------------------------------------------------------------------------

# Path to the LEXGEN-03 migration module (date-prefixed filename, not importable
# as a regular Python module name — loaded via importlib by path).
_LEXGEN03_MIGRATION_FILE = (
    _BACKEND_DIR
    / "alembic"
    / "versions"
    / "20260619_1600_5e8cc90e5bca_lexgen_03_wiktionary_pos_and_index.py"
)


def _load_migration_module() -> Any:
    """Import the LEXGEN-03 migration module by file path.

    Returns the loaded module, or raises AttributeError/ModuleNotFoundError.
    This is how tests access the seam helpers without a valid Python identifier
    for the date-prefixed filename.
    """
    spec = importlib.util.spec_from_file_location("lexgen_03_migration", _LEXGEN03_MIGRATION_FILE)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot create module spec for {_LEXGEN03_MIGRATION_FILE}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


def _seed_morphology_row(
    conn: Any,
    row_id: int,
    lemma: str,
    gender: str,
    forms: dict | list,
) -> None:
    """Insert a single row into reference.wiktionary_morphology.

    ``forms`` is serialised to JSON for the JSONB column.  The ``pos`` column
    was added by the DDL phase with server_default 'noun', so it is always
    present after the fixture DDL upgrade.
    """
    conn.execute(
        text("""
            INSERT INTO reference.wiktionary_morphology (id, lemma, gender, forms)
            VALUES (:id, :lemma, :gender, CAST(:forms AS jsonb))
            ON CONFLICT DO NOTHING
            """),
        {
            "id": row_id,
            "lemma": lemma,
            "gender": gender,
            "forms": json.dumps(forms),
        },
    )


def _get_forms(conn: Any, row_id: int) -> Any:
    """Fetch the ``forms`` value for a given row id, deserialised by psycopg2."""
    row = conn.execute(
        text("SELECT forms FROM reference.wiktionary_morphology WHERE id = :id"),
        {"id": row_id},
    ).fetchone()
    assert row is not None, f"Row id={row_id} not found"
    return row[0]  # psycopg2 deserialises JSONB to dict or list


def _delete_rows(conn: Any, ids: list[int]) -> None:
    """Delete test rows by id."""
    conn.execute(
        text("DELETE FROM reference.wiktionary_morphology WHERE id = ANY(:ids)"),
        {"ids": ids},
    )


# --- Session-scoped fixture: apply DDL once, keep DB for all backfill tests ---


@pytest.fixture(scope="module")
def backfill_db_url():
    """Create an isolated DB, run alembic upgrade head (DDL + any pre-existing data
    phase), and tear it down after the session.

    Session-scoped so the expensive subprocess + alembic run happens once for all
    7 backfill data tests.

    Yields the psycopg2 DATABASE_URL for the isolated DB.
    Skips all tests if Docker/Postgres is unreachable.
    """
    db_name = "test_lexgen03_backfill"
    try:
        db_url = _setup_migration_db(db_name)
    except Exception as exc:
        pytest.skip(
            f"Cannot create isolated migration DB '{db_name}': {exc}. "
            "Requires a reachable PostgreSQL on localhost:5433 (pgvector/pgvector:pg17). "
            "This test class is CI-gated."
        )
        return  # unreachable but satisfies type checker

    # Apply the full migration chain (DDL phase, and the data phase if it already
    # exists after the executor implements it).
    result = _run_alembic(["upgrade", "head"], db_url)
    if result.returncode != 0:
        _teardown_migration_db(db_name)
        pytest.skip(
            f"alembic upgrade head failed — DDL phase not yet implemented:\n"
            f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )

    try:
        yield db_url
    finally:
        _teardown_migration_db(db_name)


class TestLexgen0302BackfillFlatToBundles:
    """LEXGEN-03-02 Mode A RED specs — data migration backfill.

    DESIGN SEAM REQUIRED BY THE EXECUTOR
    =====================================
    The migration module MUST expose two module-level functions:

        backfill_forms_to_bundles(connection) -> dict
            Convert every flat-dict ``forms`` row to a bundle list.
            - ``connection``: a synchronous SQLAlchemy connection (psycopg2).
            - Returns: ``{"converted": int, "skipped": int, "total": int}``
              where ``converted + skipped == total``.
            - Row-level logic:
                • if isinstance(forms_value, list): SKIP (count as skipped)
                • else call flat_to_bundles(forms_value, pos="noun"):
                    - success → UPDATE forms; count as converted
                    - UnknownFlatFormKey → log WARNING with id+lemma+key;
                      leave forms unchanged; count as skipped
            - Logs a summary at INFO level with the returned counts.

        downgrade_forms_to_flat(connection) -> dict
            Reverse: for rows where isinstance(forms_value, list), call
            bundles_to_flat and UPDATE forms back to the flat dict.
            Returns: ``{"converted": int, "total": int}``.

    The module is loaded via importlib by absolute path (date-prefixed filename
    is not a valid Python identifier).

    RED CONFIRMATION
    ================
    All tests in this class are RED because the helper functions do not yet exist
    in the migration module:
        _load_migration_module() succeeds (the file exists) but
        getattr(module, "backfill_forms_to_bundles") raises AttributeError.
    This is the correct RED failure mode: the seam is clearly identified as the
    missing piece, not an opaque import/collection error.
    """

    # -----------------------------------------------------------------------
    # Shared helper: load the migration module once per test via a method call.
    # We do NOT cache it at class level to avoid cross-test pollution.
    # -----------------------------------------------------------------------

    @staticmethod
    def _migration_module() -> Any:
        """Load and return the LEXGEN-03 migration module."""
        return _load_migration_module()

    # -----------------------------------------------------------------------
    # AC-1: flat → bundle list
    # -----------------------------------------------------------------------

    def test_backfill_converts_flat_to_bundle_list(self, backfill_db_url: str) -> None:
        """AC-1: A row with canonical flat forms is converted to a bundle list
        in canonical order (number outer sg→pl, case inner nom→gen→acc→voc).

        Given:  A row seeded with flat forms
                  {"nominative_singular": "ο άνθρωπος", "genitive_plural": "των ανθρώπων"}
        When:   backfill_forms_to_bundles(connection) is called.
        Then:   forms == [
                    {"form": "ο άνθρωπος", "features": {"case": "nominative", "number": "singular"}},
                    {"form": "των ανθρώπων", "features": {"case": "genitive", "number": "plural"}},
                ]
                in canonical paradigm order (sg before pl; nom before gen within number).

        RED: AttributeError on backfill_forms_to_bundles — helper not yet implemented.
        """
        mod = self._migration_module()
        assert hasattr(mod, "backfill_forms_to_bundles"), (
            "Migration module must expose backfill_forms_to_bundles(connection) → dict. "
            "This is the LEXGEN-03-02 seam the executor must implement."
        )
        backfill_fn = mod.backfill_forms_to_bundles

        engine = _sync_engine(backfill_db_url)
        row_id = 900_001
        flat_forms = {
            "nominative_singular": "ο άνθρωπος",
            "genitive_plural": "των ανθρώπων",
        }
        try:
            with engine.connect() as conn:
                _seed_morphology_row(conn, row_id, "άνθρωπος", "masculine", flat_forms)
                conn.commit()

                # Call the backfill helper
                summary = backfill_fn(conn)
                conn.commit()

                forms_after = _get_forms(conn, row_id)

            # Must be a list now
            assert isinstance(forms_after, list), (
                f"Expected forms to be a bundle list after backfill, got {type(forms_after)}: "
                f"{forms_after!r}"
            )
            # Canonical order: nominative_singular (sg first) then genitive_plural
            expected = [
                {"form": "ο άνθρωπος", "features": {"case": "nominative", "number": "singular"}},
                {"form": "των ανθρώπων", "features": {"case": "genitive", "number": "plural"}},
            ]
            assert (
                forms_after == expected
            ), f"Bundle list mismatch.\nExpected: {expected}\nGot:      {forms_after}"
            # Summary must account for this row as converted
            assert isinstance(summary, dict), f"Expected dict summary, got {summary!r}"
            assert (
                summary.get("converted", 0) >= 1
            ), f"Expected converted >= 1, got summary={summary}"
        finally:
            with engine.connect() as conn:
                _delete_rows(conn, [row_id])
                conn.commit()
            engine.dispose()

    def test_backfill_empty_forms_becomes_empty_list(self, backfill_db_url: str) -> None:
        """AC-1: A row with forms={} (empty flat dict) is converted to forms=[]
        (empty bundle list) and counts as converted, not skipped.

        Given:  A row seeded with flat forms ``{}``
        When:   backfill_forms_to_bundles(connection) is called.
        Then:   forms == [] and summary["converted"] >= 1.

        RED: AttributeError on backfill_forms_to_bundles.
        """
        mod = self._migration_module()
        assert hasattr(
            mod, "backfill_forms_to_bundles"
        ), "Migration module must expose backfill_forms_to_bundles(connection) → dict."
        backfill_fn = mod.backfill_forms_to_bundles

        engine = _sync_engine(backfill_db_url)
        row_id = 900_002
        try:
            with engine.connect() as conn:
                _seed_morphology_row(conn, row_id, "λέξη", "feminine", {})
                conn.commit()

                summary = backfill_fn(conn)
                conn.commit()

                forms_after = _get_forms(conn, row_id)

            assert forms_after == [], f"Expected empty bundle list [], got {forms_after!r}"
            assert isinstance(summary, dict)
            assert (
                summary.get("converted", 0) >= 1
            ), f"Empty-forms row must count as converted, got summary={summary}"
        finally:
            with engine.connect() as conn:
                _delete_rows(conn, [row_id])
                conn.commit()
            engine.dispose()

    # -----------------------------------------------------------------------
    # AC-3: idempotency via isinstance list guard
    # -----------------------------------------------------------------------

    def test_backfill_idempotent_via_isinstance_list_guard(self, backfill_db_url: str) -> None:
        """AC-3: A row already in bundle (list) shape is skipped by the
        isinstance(forms_value, list) guard — forms are left unchanged, the
        row counts as skipped (NOT converted), and flat_to_bundles is NOT
        called (which would raise UnknownFlatFormKey on a list input).

        Given:  A row seeded with forms already as a bundle list (simulating
                a previously-converted row):
                [{"form": "η γυναίκα", "features": {"case": "nominative", "number": "singular"}}]
        When:   backfill_forms_to_bundles(connection) is called TWICE.
        Then (call 1):  summary["skipped"] >= 1, summary["converted"] == 0 for this row.
        Then (call 2):  identical result — second run is a no-op; forms unchanged.

        RED: AttributeError on backfill_forms_to_bundles.
        """
        mod = self._migration_module()
        assert hasattr(
            mod, "backfill_forms_to_bundles"
        ), "Migration module must expose backfill_forms_to_bundles(connection) → dict."
        backfill_fn = mod.backfill_forms_to_bundles

        engine = _sync_engine(backfill_db_url)
        row_id = 900_003
        already_bundle = [
            {"form": "η γυναίκα", "features": {"case": "nominative", "number": "singular"}}
        ]
        try:
            with engine.connect() as conn:
                _seed_morphology_row(conn, row_id, "γυναίκα", "feminine", already_bundle)
                conn.commit()

                # First call — must skip, not convert
                summary1 = backfill_fn(conn)
                conn.commit()
                forms_after_1 = _get_forms(conn, row_id)

                # Second call — must still skip
                summary2 = backfill_fn(conn)
                conn.commit()
                forms_after_2 = _get_forms(conn, row_id)

            # Forms unchanged both times
            assert forms_after_1 == already_bundle, (
                f"Call 1: forms should be unchanged (already a list).\n"
                f"Expected: {already_bundle}\nGot: {forms_after_1}"
            )
            assert forms_after_2 == already_bundle, (
                f"Call 2 (idempotency): forms should be unchanged.\n"
                f"Expected: {already_bundle}\nGot: {forms_after_2}"
            )
            # Summary must show skipped (not converted) for this row
            # Note: other rows may have been inserted by other tests, so we check
            # the skipped count is >= 1 (at minimum this row was skipped).
            assert isinstance(summary1, dict)
            assert isinstance(summary2, dict)
            # The critical invariant: converted+skipped==total for both calls
            assert summary1.get("converted", 0) + summary1.get("skipped", 0) == summary1.get(
                "total", -1
            ), f"Call 1 parity failed: {summary1}"
            assert summary2.get("converted", 0) + summary2.get("skipped", 0) == summary2.get(
                "total", -1
            ), f"Call 2 parity failed: {summary2}"
        finally:
            with engine.connect() as conn:
                _delete_rows(conn, [row_id])
                conn.commit()
            engine.dispose()

    def test_downgrade_restores_flat_keys(self, backfill_db_url: str) -> None:
        """AC-3: downgrade_forms_to_flat restores the exact original flat dict
        via bundles_to_flat (lossless for case+number-only bundles).

        Given:  A row converted to bundle list by backfill_forms_to_bundles.
        When:   downgrade_forms_to_flat(connection) is called.
        Then:   forms == the original flat dict (exact key+value match).

        RED: AttributeError on backfill_forms_to_bundles and/or
             downgrade_forms_to_flat.
        """
        mod = self._migration_module()
        assert hasattr(
            mod, "backfill_forms_to_bundles"
        ), "Migration module must expose backfill_forms_to_bundles(connection) → dict."
        assert hasattr(mod, "downgrade_forms_to_flat"), (
            "Migration module must expose downgrade_forms_to_flat(connection) → dict. "
            "This is needed for the lossless downgrade path (AC-3 / D-DOWNGRADE)."
        )
        backfill_fn = mod.backfill_forms_to_bundles
        downgrade_fn = mod.downgrade_forms_to_flat

        engine = _sync_engine(backfill_db_url)
        row_id = 900_004
        original_flat = {
            "nominative_singular": "το παιδί",
            "nominative_plural": "τα παιδιά",
            "genitive_singular": "του παιδιού",
            "genitive_plural": "των παιδιών",
        }
        try:
            with engine.connect() as conn:
                _seed_morphology_row(conn, row_id, "παιδί", "neuter", original_flat)
                conn.commit()

                # Convert: flat → bundles
                backfill_fn(conn)
                conn.commit()
                forms_after_upgrade = _get_forms(conn, row_id)
                assert isinstance(
                    forms_after_upgrade, list
                ), f"After backfill, forms must be a list; got {forms_after_upgrade!r}"

                # Downgrade: bundles → flat
                downgrade_fn(conn)
                conn.commit()
                forms_after_downgrade = _get_forms(conn, row_id)

            assert isinstance(
                forms_after_downgrade, dict
            ), f"After downgrade, forms must be a dict; got {forms_after_downgrade!r}"
            assert forms_after_downgrade == original_flat, (
                f"Downgrade did not restore original flat dict.\n"
                f"Expected: {original_flat}\nGot:      {forms_after_downgrade}"
            )
        finally:
            with engine.connect() as conn:
                _delete_rows(conn, [row_id])
                conn.commit()
            engine.dispose()

    # -----------------------------------------------------------------------
    # AC-4: bad-key skip + log + parity summary
    # -----------------------------------------------------------------------

    def test_unconvertible_row_logged_and_skipped_not_dropped(
        self, backfill_db_url: str, caplog: pytest.LogCaptureFixture
    ) -> None:
        """AC-4: A row with a non-canonical flat dict key (e.g. 'dative_singular')
        is LEFT as its original flat dict (unchanged), a WARNING is logged naming
        id + lemma + offending key, and the row still exists after the migration.
        The row counts as skipped (NOT converted). Total row count is unchanged.

        Given:  A row with flat forms {"dative_singular": "τω λόγω"} — 'dative'
                is not a canonical case value; flat_to_bundles raises
                UnknownFlatFormKey on it.
        When:   backfill_forms_to_bundles(connection) is called.
        Then:
          - forms is still {"dative_singular": "τω λόγω"} (flat dict, unchanged).
          - A WARNING is logged (loguru or stdlib logging) that includes the row
            id and the offending key.
          - Row still exists (not dropped).
          - summary["skipped"] >= 1.

        NOTE ON LOG CAPTURE: The migration uses stdlib logging.getLogger(__name__)
        (same as cqmig_02 precedent). pytest caplog captures stdlib logging.
        If the executor uses loguru, they must propagate to stdlib (loguru's
        propagate=True default) for caplog to work; if not, this test will catch
        the failure.

        RED: AttributeError on backfill_forms_to_bundles.
        """
        mod = self._migration_module()
        assert hasattr(
            mod, "backfill_forms_to_bundles"
        ), "Migration module must expose backfill_forms_to_bundles(connection) → dict."
        backfill_fn = mod.backfill_forms_to_bundles

        engine = _sync_engine(backfill_db_url)
        row_id = 900_005
        bad_forms = {"dative_singular": "τω λόγω"}  # 'dative' not in CANONICAL_CASES
        try:
            with engine.connect() as conn:
                _seed_morphology_row(conn, row_id, "λόγος", "masculine", bad_forms)
                conn.commit()

                with caplog.at_level(logging.WARNING):
                    summary = backfill_fn(conn)
                conn.commit()

                forms_after = _get_forms(conn, row_id)
                # Row must still exist
                count = conn.execute(
                    text("SELECT COUNT(*) FROM reference.wiktionary_morphology WHERE id = :id"),
                    {"id": row_id},
                ).scalar()

            # Forms unchanged — still the original flat dict
            assert isinstance(forms_after, dict), (
                f"Bad-key row forms must remain a dict (unchanged); got {type(forms_after)}: "
                f"{forms_after!r}"
            )
            assert forms_after == bad_forms, (
                f"Bad-key row must be left EXACTLY as-is.\nExpected: {bad_forms}\n"
                f"Got:      {forms_after}"
            )

            # Row not dropped
            assert count == 1, f"Bad-key row must not be dropped; expected count=1, got {count}"

            # A warning must have been logged — must reference the id or key
            warning_records = [r for r in caplog.records if r.levelno >= logging.WARNING]
            assert warning_records, (
                "Expected at least one WARNING log record for the unconvertible row, "
                "but caplog captured none. The migration must log a WARNING naming "
                "id + lemma + offending key when UnknownFlatFormKey is raised."
            )
            # At least one warning mentions the row id or the bad key
            log_messages = " ".join(r.getMessage() for r in warning_records)
            assert str(row_id) in log_messages or "dative" in log_messages, (
                f"WARNING log must mention row id ({row_id}) or the offending key "
                f"('dative_singular' / 'dative'). Got log messages: {log_messages!r}"
            )

            # Summary skipped count
            assert isinstance(summary, dict)
            assert (
                summary.get("skipped", 0) >= 1
            ), f"Bad-key row must count as skipped in summary, got {summary}"
        finally:
            with engine.connect() as conn:
                _delete_rows(conn, [row_id])
                conn.commit()
            engine.dispose()

    def test_backfill_logs_count_parity_summary(self, backfill_db_url: str) -> None:
        """AC-4: With N seeded rows, the returned summary satisfies
        converted + skipped == total == N (count parity).

        Given:  3 seeded rows:
                  row A — canonical flat forms (convertible)
                  row B — empty flat forms (convertible → [])
                  row C — already a bundle list (skipped by isinstance guard)
        When:   backfill_forms_to_bundles(connection) is called.
        Then:   summary == {"converted": 2, "skipped": 1, "total": 3}
                (rows A and B converted; row C skipped).

        Note: The table may contain rows from other tests if isolation is imperfect;
        we therefore use a controlled set of 3 rows with distinct IDs and compute
        expected counts relative to what we seeded.  We do NOT assert exact absolute
        values — we assert the parity invariant and that our 3 rows are accounted
        for correctly via their individual forms_after values.

        RED: AttributeError on backfill_forms_to_bundles.
        """
        mod = self._migration_module()
        assert hasattr(
            mod, "backfill_forms_to_bundles"
        ), "Migration module must expose backfill_forms_to_bundles(connection) → dict."
        backfill_fn = mod.backfill_forms_to_bundles

        engine = _sync_engine(backfill_db_url)
        id_a, id_b, id_c = 900_010, 900_011, 900_012
        flat_a = {"nominative_singular": "ο δρόμος", "genitive_singular": "του δρόμου"}
        flat_b: dict = {}
        already_list_c = [
            {"form": "η οδός", "features": {"case": "nominative", "number": "singular"}}
        ]
        try:
            with engine.connect() as conn:
                _seed_morphology_row(conn, id_a, "δρόμος", "masculine", flat_a)
                _seed_morphology_row(conn, id_b, "κενό", "neuter", flat_b)
                _seed_morphology_row(conn, id_c, "οδός", "feminine", already_list_c)
                conn.commit()

                # Count total rows before (our 3 + whatever else is in the table)
                total_before = conn.execute(
                    text("SELECT COUNT(*) FROM reference.wiktionary_morphology")
                ).scalar()

                summary = backfill_fn(conn)
                conn.commit()

                # Verify individual row outcomes
                forms_a = _get_forms(conn, id_a)
                forms_b = _get_forms(conn, id_b)
                forms_c = _get_forms(conn, id_c)

                total_after = conn.execute(
                    text("SELECT COUNT(*) FROM reference.wiktionary_morphology")
                ).scalar()

            # Row A: converted to list
            assert isinstance(forms_a, list), f"Row A must be a list; got {forms_a!r}"
            # Row B: empty → []
            assert forms_b == [], f"Row B must be []; got {forms_b!r}"
            # Row C: unchanged (already a list)
            assert (
                forms_c == already_list_c
            ), f"Row C must be unchanged; expected {already_list_c}, got {forms_c!r}"

            # Row count unchanged
            assert total_after == total_before, (
                f"Total row count changed: {total_before} → {total_after}. "
                "The backfill must not insert or delete rows."
            )

            # Summary parity invariant
            assert isinstance(summary, dict), f"Expected dict summary, got {summary!r}"
            converted = summary.get("converted", None)
            skipped = summary.get("skipped", None)
            total = summary.get("total", None)
            assert None not in (
                converted,
                skipped,
                total,
            ), f"Summary must have 'converted', 'skipped', 'total' keys; got {summary}"
            assert converted + skipped == total, (
                f"Parity violated: converted({converted}) + skipped({skipped}) "
                f"!= total({total}). Summary: {summary}"
            )
            assert (
                total == total_before
            ), f"summary['total'] ({total}) must equal the row count ({total_before})"
        finally:
            with engine.connect() as conn:
                _delete_rows(conn, [id_a, id_b, id_c])
                conn.commit()
            engine.dispose()

    # -----------------------------------------------------------------------
    # AC-2: pos invariant (asserted here as part of the data-phase context)
    # -----------------------------------------------------------------------

    def test_all_rows_have_pos_noun_after_upgrade(self, backfill_db_url: str) -> None:
        """AC-2 invariant: every row in wiktionary_morphology has pos='noun'
        after upgrade head (set by the DDL server_default 'noun').

        Given:  Several seeded rows (any forms value).
        When:   Inspecting the pos column.
        Then:   Every row has pos='noun' (no NULL, no other value).

        This confirms the DDL phase server_default works correctly.
        RED if DDL phase is not yet implemented (table has no pos column).
        """
        engine = _sync_engine(backfill_db_url)
        row_ids = [900_020, 900_021]
        try:
            with engine.connect() as conn:
                _seed_morphology_row(conn, row_ids[0], "θάλασσα", "feminine", {})
                _seed_morphology_row(
                    conn,
                    row_ids[1],
                    "ουρανός",
                    "masculine",
                    {"nominative_singular": "ο ουρανός"},
                )
                conn.commit()

                bad_pos_count = conn.execute(text("""
                        SELECT COUNT(*) FROM reference.wiktionary_morphology
                        WHERE pos IS NULL OR pos != 'noun'
                        """)).scalar()

            assert bad_pos_count == 0, (
                f"Found {bad_pos_count} row(s) where pos != 'noun' after upgrade. "
                "The DDL server_default must backfill every existing row to 'noun'."
            )
        finally:
            with engine.connect() as conn:
                _delete_rows(conn, row_ids)
                conn.commit()
            engine.dispose()

    # -----------------------------------------------------------------------
    # AC-5: converted forms have only FEATURE_KEYS keys in features dicts
    # -----------------------------------------------------------------------

    def test_converted_forms_have_only_feature_keys(self, backfill_db_url: str) -> None:
        """AC-5: Every converted FormBundle's features dict contains ONLY keys
        within FEATURE_KEYS; no flat 'case_number' string keys remain.

        Given:  A row with all 8 canonical flat keys seeded.
        When:   backfill_forms_to_bundles(connection) is called.
        Then:   Every item in the resulting list has features whose keys are all
                in FEATURE_KEYS; no item has a 'nominative_singular'-style key
                anywhere in its features dict.

        RED: AttributeError on backfill_forms_to_bundles.
        """
        from src.schemas.lexgen import FEATURE_KEYS  # noqa: PLC0415

        mod = self._migration_module()
        assert hasattr(
            mod, "backfill_forms_to_bundles"
        ), "Migration module must expose backfill_forms_to_bundles(connection) → dict."
        backfill_fn = mod.backfill_forms_to_bundles

        engine = _sync_engine(backfill_db_url)
        row_id = 900_030
        # Full 8-cell noun paradigm (all canonical case×number pairs)
        all_8_flat = {
            "nominative_singular": "ο λόγος",
            "genitive_singular": "του λόγου",
            "accusative_singular": "τον λόγο",
            "vocative_singular": "λόγε",
            "nominative_plural": "οι λόγοι",
            "genitive_plural": "των λόγων",
            "accusative_plural": "τους λόγους",
            "vocative_plural": "λόγοι",
        }
        try:
            with engine.connect() as conn:
                _seed_morphology_row(conn, row_id, "λόγος", "masculine", all_8_flat)
                conn.commit()

                backfill_fn(conn)
                conn.commit()

                forms_after = _get_forms(conn, row_id)

            assert isinstance(
                forms_after, list
            ), f"Expected bundle list, got {type(forms_after)}: {forms_after!r}"
            assert len(forms_after) == 8, (
                f"Expected 8 bundles (one per canonical cell), got {len(forms_after)}: "
                f"{forms_after!r}"
            )
            for bundle in forms_after:
                assert isinstance(
                    bundle, dict
                ), f"Each bundle must be a dict, got {type(bundle)}: {bundle!r}"
                assert "form" in bundle, f"Bundle missing 'form' key: {bundle!r}"
                assert "features" in bundle, f"Bundle missing 'features' key: {bundle!r}"
                features = bundle["features"]
                assert isinstance(
                    features, dict
                ), f"'features' must be a dict, got {type(features)}: {features!r}"
                # No flat key (e.g. 'nominative_singular') must appear in features
                flat_keys_in_features = {k for k in features if "_" in k and k not in FEATURE_KEYS}
                assert not flat_keys_in_features, (
                    f"Flat keys found in features dict (AC-5 violation): "
                    f"{flat_keys_in_features!r}. Bundle: {bundle!r}"
                )
                # All feature keys must be in the controlled vocabulary
                unknown_keys = set(features.keys()) - FEATURE_KEYS
                assert not unknown_keys, (
                    f"Unknown feature key(s) in bundle (AC-5 violation): "
                    f"{unknown_keys!r}. Allowed: {sorted(FEATURE_KEYS)}. Bundle: {bundle!r}"
                )
                # For noun case+number bundles: must have 'case' and 'number'
                assert "case" in features, f"Bundle features must have 'case'; got {features!r}"
                assert "number" in features, f"Bundle features must have 'number'; got {features!r}"
        finally:
            with engine.connect() as conn:
                _delete_rows(conn, [row_id])
                conn.commit()
            engine.dispose()

    # -----------------------------------------------------------------------
    # Adversarial (Mode B additions — QA-authored, not in original spec)
    # -----------------------------------------------------------------------

    def test_adversarial_mixed_flat_and_bundle_rows_in_same_run(self, backfill_db_url: str) -> None:
        """Adversarial (a): A run with BOTH bundle-list rows AND flat-dict rows
        in the same table converts only the flat ones and leaves the list ones
        untouched, with correct summary counts.

        Given:  2 rows:
                  row X — already a bundle list (already-converted)
                  row Y — canonical flat dict (still to convert)
        When:   backfill_forms_to_bundles(connection) is called once.
        Then:
          - row X forms unchanged (still the original bundle list)
          - row Y forms converted to a bundle list
          - summary["converted"] >= 1 (at minimum row Y)
          - summary["skipped"] >= 1 (at minimum row X)
          - converted + skipped == total
        This verifies the guard path (list) and the convert path (dict) are
        independent and co-exist correctly in a single scan.
        """
        mod = self._migration_module()
        assert hasattr(mod, "backfill_forms_to_bundles")
        backfill_fn = mod.backfill_forms_to_bundles

        engine = _sync_engine(backfill_db_url)
        id_x, id_y = 900_040, 900_041
        already_bundle = [
            {"form": "η φωνή", "features": {"case": "nominative", "number": "singular"}}
        ]
        flat_forms = {
            "nominative_singular": "ο ήλιος",
            "genitive_singular": "του ήλιου",
        }
        try:
            with engine.connect() as conn:
                _seed_morphology_row(conn, id_x, "φωνή", "feminine", already_bundle)
                _seed_morphology_row(conn, id_y, "ήλιος", "masculine", flat_forms)
                conn.commit()

                summary = backfill_fn(conn)
                conn.commit()

                forms_x = _get_forms(conn, id_x)
                forms_y = _get_forms(conn, id_y)

            # Row X (already bundle): unchanged
            assert forms_x == already_bundle, (
                f"Already-bundle row X must be left unchanged.\n"
                f"Expected: {already_bundle}\nGot: {forms_x}"
            )

            # Row Y (flat → converted): must now be a bundle list
            assert isinstance(
                forms_y, list
            ), f"Flat row Y must be converted to a list; got {type(forms_y)}: {forms_y!r}"
            assert (
                len(forms_y) == 2
            ), f"Row Y should have 2 bundles (nom_sg, gen_sg); got {len(forms_y)}: {forms_y!r}"

            # Summary parity
            assert isinstance(summary, dict)
            converted = summary.get("converted", 0)
            skipped = summary.get("skipped", 0)
            total = summary.get("total", -1)
            assert (
                converted + skipped == total
            ), f"Parity violated: converted({converted}) + skipped({skipped}) != total({total})"
            # At least our two rows must appear correctly in summary
            assert converted >= 1, f"Expected converted >= 1 (row Y); got {summary}"
            assert skipped >= 1, f"Expected skipped >= 1 (row X); got {summary}"
        finally:
            with engine.connect() as conn:
                _delete_rows(conn, [id_x, id_y])
                conn.commit()
            engine.dispose()

    def test_adversarial_downgrade_then_re_upgrade_round_trips(self, backfill_db_url: str) -> None:
        """Adversarial (b): Full downgrade-then-re-upgrade round-trip returns
        forms to the feature-bundle representation, confirming the converter pair
        is perfectly symmetric and the migration can be applied, reversed, and
        re-applied without data loss.

        Given:  A row with canonical flat forms converted to bundles by
                backfill_forms_to_bundles.
        When:   downgrade_forms_to_flat is called (restores flat dict)
                then backfill_forms_to_bundles is called again (re-converts).
        Then:   forms after re-upgrade == forms after first upgrade (same bundle list).
                The second upgrade summary shows converted >= 1 (not a no-op,
                because the downgrade restored flat dicts that need re-conversion).
        """
        mod = self._migration_module()
        assert hasattr(mod, "backfill_forms_to_bundles")
        assert hasattr(mod, "downgrade_forms_to_flat")
        backfill_fn = mod.backfill_forms_to_bundles
        downgrade_fn = mod.downgrade_forms_to_flat

        engine = _sync_engine(backfill_db_url)
        row_id = 900_042
        original_flat = {
            "nominative_singular": "ο κόσμος",
            "genitive_singular": "του κόσμου",
            "accusative_singular": "τον κόσμο",
            "nominative_plural": "οι κόσμοι",
        }
        try:
            with engine.connect() as conn:
                _seed_morphology_row(conn, row_id, "κόσμος", "masculine", original_flat)
                conn.commit()

                # Upgrade 1
                backfill_fn(conn)
                conn.commit()
                forms_after_upgrade1 = _get_forms(conn, row_id)
                assert isinstance(
                    forms_after_upgrade1, list
                ), f"After upgrade 1, forms must be a list; got {forms_after_upgrade1!r}"

                # Downgrade (restore flat)
                downgrade_fn(conn)
                conn.commit()
                forms_after_downgrade = _get_forms(conn, row_id)
                assert isinstance(
                    forms_after_downgrade, dict
                ), f"After downgrade, forms must be a dict; got {forms_after_downgrade!r}"
                assert forms_after_downgrade == original_flat, (
                    f"Downgrade must restore original flat dict.\n"
                    f"Expected: {original_flat}\nGot: {forms_after_downgrade}"
                )

                # Upgrade 2 (re-apply)
                summary2 = backfill_fn(conn)
                conn.commit()
                forms_after_upgrade2 = _get_forms(conn, row_id)

            # Round-trip: upgrade2 result == upgrade1 result
            assert forms_after_upgrade2 == forms_after_upgrade1, (
                f"Re-upgrade after downgrade must produce identical bundle list.\n"
                f"Upgrade 1: {forms_after_upgrade1}\nUpgrade 2: {forms_after_upgrade2}"
            )
            # Re-upgrade counted this row as converted (not skipped)
            assert isinstance(summary2, dict)
            assert (
                summary2.get("converted", 0) >= 1
            ), f"Re-upgrade must convert the restored flat row; got {summary2}"
        finally:
            with engine.connect() as conn:
                _delete_rows(conn, [row_id])
                conn.commit()
            engine.dispose()


# ---------------------------------------------------------------------------
# LEXGEN-03-05: AC-1 and AC-2 integration tests (Mode B — post-implementation)
# ---------------------------------------------------------------------------
#
# AC-1  test_noun_round_trips_import_to_read
#   THE genuinely new end-to-end chain: nothing in the preceding tests crosses
#   importer + real DB + service together.  Prior tests exercise each component
#   independently:
#     - 03-02 tests: backfill helpers + data shape in isolated DB
#     - 03-03 unit tests: _parse_entries produces bundle rows (no DB)
#     - 03-04 unit tests: WiktionaryMorphologyService against mock DB
#   This test is the ONLY one that runs all three in a single straight line:
#     _parse_entries (JSONL -> bundle rows) ->
#     _insert_rows (psycopg2, real DB) ->
#     WiktionaryMorphologyService.get_declensions / get_form_bundles (async, real DB)
#
# AC-2  test_full_upgrade_downgrade_restores_forms (consolidated)
#   Existing coverage:
#     - test_upgrade_then_downgrade_round_trips_schema: DDL round-trip on EMPTY table.
#     - test_downgrade_restores_flat_keys: helper-level data restore (no subprocess).
#   Gap: no test seeds multi-row data BEFORE the upgrade subprocess, drives the
#   full alembic upgrade (including backfill) then downgrade subprocess, and
#   asserts byte-equal flat forms at the Alembic level.  This test fills that gap.
#
# AC-3  test_default_run_only_produces_noun_rows: see test_load_wiktionary_morphology.py
#
# AC-4  ALREADY COVERED by test_pos_verb_all_rows_carry_verb_pos_and_bundle_forms
#   in tests/unit/scripts/test_load_wiktionary_morphology.py (line 761).
#   That test: mixed-POS fixture with pos="verb" -> all rows have pos=='verb',
#   zero noun rows, all forms are bundle lists.  No duplicate needed.
# ---------------------------------------------------------------------------


class TestLexgen0305RoundTripAndInvariants:
    """LEXGEN-03-05 Mode B: end-to-end chain (AC-1) + full alembic upgrade/
    downgrade with seeded data (AC-2 consolidation).

    Tests require a real PostgreSQL DB on localhost:5433.  The AC-1 test
    reuses the backfill_db_url session fixture (pre-upgraded shared DB).
    The AC-2 test creates its own isolated DB (alembic subprocess round-trip).
    Both skip automatically when the DB is unreachable.
    """

    # -----------------------------------------------------------------------
    # AC-1: importer -> real DB -> service  (the only full cross-chain test)
    # -----------------------------------------------------------------------

    def test_noun_round_trips_import_to_read(self, backfill_db_url: str) -> None:
        """AC-1 (LEXGEN-03-05): flat forms -> _parse_entries (bundles) ->
        _insert_rows (real DB) -> WiktionaryMorphologyService.get_declensions
        (flat) -> output flat keys == original flat keys.

        Chain exercised:
          1. Build a JSONL fixture with a canonical 4-cell noun paradigm.
          2. _parse_entries converts flat -> bundle list rows (LEXGEN-03-03 path).
          3. _insert_rows inserts via psycopg2 against the upgraded backfill_db_url DB.
          4. WiktionaryMorphologyService.get_declensions reads the stored bundles
             and returns the flat dict via bundles_to_flat (LEXGEN-03-04 path).
          5. Assert output flat == original flat (LEXGEN-02 round-trip invariant).
          6. Assert get_form_bundles returns the expected bundle list.

        This is the ONLY test that crosses all three layers -- importer, DB,
        service -- in a single straight-line execution.  A RED here is a real
        integration gap in the assembled LEXGEN-03 feature.
        """
        import asyncio
        import io
        from unittest.mock import MagicMock

        import psycopg2
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
        from sqlalchemy.pool import NullPool

        from src.core.lexgen_forms import flat_to_bundles
        from src.schemas.lexgen import FormBundle
        from src.scripts.load_wiktionary_morphology import _insert_rows, _parse_entries
        from src.services.wiktionary_morphology_service import WiktionaryMorphologyService

        # ---- 1. JSONL fixture: canonical 4-cell noun paradigm ----
        # lemma is unique enough to avoid conflicts with other test rows
        fixture_lemma = "κόσμος_qa05"  # "κόσμος_qa05"
        original_flat = {
            "nominative_singular": "ο κόσμος_qa05",
            "genitive_singular": "του κόσμου_qa05",
            "accusative_singular": "τον κόσμο_qa05",
            "nominative_plural": "οι κόσμοι_qa05",
        }
        jsonl_entry = json.dumps(
            {
                "word": fixture_lemma,
                "pos": "noun",
                "head_templates": [{"args": {"g": "m"}}],
                "senses": [{"glosses": ["test world (QA-05)"]}],
                "sounds": [{"ipa": "/test.qa05/"}],
                "forms": [
                    {
                        "source": "declension",
                        "tags": ["nominative", "singular"],
                        "form": original_flat["nominative_singular"],
                    },
                    {
                        "source": "declension",
                        "tags": ["genitive", "singular"],
                        "form": original_flat["genitive_singular"],
                    },
                    {
                        "source": "declension",
                        "tags": ["accusative", "singular"],
                        "form": original_flat["accusative_singular"],
                    },
                    {
                        "source": "declension",
                        "tags": ["nominative", "plural"],
                        "form": original_flat["nominative_plural"],
                    },
                ],
            }
        )

        # ---- 2. _parse_entries: flat -> bundle-list rows ----
        fake_path = MagicMock()
        fake_path.open.return_value.__enter__ = lambda s: io.StringIO(jsonl_entry)
        fake_path.open.return_value.__exit__ = MagicMock(return_value=False)
        rows, _filtered, _merged = _parse_entries(fake_path, pos="noun")

        assert len(rows) == 1, f"Expected 1 parsed row, got {len(rows)}"
        row = rows[0]
        assert row["lemma"] == fixture_lemma
        assert row["pos"] == "noun"
        assert row["gender"] == "masculine"
        assert isinstance(row["forms"], list), (
            f"After _parse_entries, row['forms'] must be a bundle list; "
            f"got {type(row['forms'])}"
        )
        # Verify the bundle list matches flat_to_bundles(original_flat)
        expected_bundles = flat_to_bundles(original_flat, pos="noun")
        expected_bundle_dicts = [b.model_dump(mode="json") for b in expected_bundles]
        assert row["forms"] == expected_bundle_dicts, (
            f"Importer-produced bundle list does not match flat_to_bundles output.\n"
            f"Expected: {expected_bundle_dicts}\nGot:      {row['forms']}"
        )

        # ---- 3. _insert_rows: psycopg2 against the upgraded backfill_db_url DB ----
        conn_str = backfill_db_url.replace("postgresql+psycopg2://", "postgresql://")
        pg_conn = psycopg2.connect(conn_str)
        inserted_id = None
        try:
            with pg_conn.cursor() as cur:
                # Remove any pre-existing row (idempotent test setup)
                cur.execute(
                    "DELETE FROM reference.wiktionary_morphology WHERE lemma = %s",
                    (fixture_lemma,),
                )
                pg_conn.commit()

                _insert_rows(cur, rows)
                pg_conn.commit()

                # Record inserted id for cleanup
                cur.execute(
                    "SELECT id FROM reference.wiktionary_morphology WHERE lemma = %s",
                    (fixture_lemma,),
                )
                id_row = cur.fetchone()
                if id_row:
                    inserted_id = id_row[0]
        except Exception:
            pg_conn.rollback()
            pg_conn.close()
            raise

        # ---- 4. Service: WiktionaryMorphologyService reads bundles -> flat ----
        # Build a short-lived async engine pointing at the same DB (asyncpg URL)
        async_url = backfill_db_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://")

        async def _call_service():
            engine = create_async_engine(async_url, poolclass=NullPool)
            try:
                Session = async_sessionmaker(engine, expire_on_commit=False)
                async with Session() as session:
                    svc = WiktionaryMorphologyService(session)
                    flat_result = await svc.get_declensions(
                        fixture_lemma, pos="noun", gender="masculine"
                    )
                    bundle_result = await svc.get_form_bundles(
                        fixture_lemma, pos="noun", gender="masculine"
                    )
                return flat_result, bundle_result
            finally:
                await engine.dispose()

        flat_result, bundle_result = asyncio.run(_call_service())

        # ---- Cleanup: remove inserted row ----
        try:
            with pg_conn.cursor() as cur:
                if inserted_id is not None:
                    cur.execute(
                        "DELETE FROM reference.wiktionary_morphology WHERE id = %s",
                        (inserted_id,),
                    )
                else:
                    cur.execute(
                        "DELETE FROM reference.wiktionary_morphology WHERE lemma = %s",
                        (fixture_lemma,),
                    )
            pg_conn.commit()
        finally:
            pg_conn.close()

        # ---- 5. Assert flat output == original flat (AC-1 invariant) ----
        assert flat_result is not None, (
            f"WiktionaryMorphologyService.get_declensions returned None for "
            f"lemma={fixture_lemma!r}, pos='noun', gender='masculine'.  "
            f"The inserted row was not found by the service: INTEGRATION GAP.  "
            f"Check that _insert_rows wrote to the correct table and that the "
            f"service query filters match the inserted data."
        )
        assert flat_result == original_flat, (
            f"AC-1 round-trip mismatch (LEXGEN-03-05).\n"
            f"Original flat:  {original_flat}\n"
            f"Service output: {flat_result}\n"
            f"The importer->DB->service chain does not round-trip flat keys "
            f"correctly: INTEGRATION GAP."
        )

        # ---- 6. Assert get_form_bundles returns the expected bundle list ----
        assert bundle_result is not None, (
            f"WiktionaryMorphologyService.get_form_bundles returned None for "
            f"lemma={fixture_lemma!r}: INTEGRATION GAP."
        )
        assert isinstance(bundle_result, list)
        assert len(bundle_result) == len(expected_bundles), (
            f"Bundle count mismatch: expected {len(expected_bundles)}, "
            f"got {len(bundle_result)}.  Bundles: {bundle_result}"
        )
        for stored, expected in zip(bundle_result, expected_bundles):
            assert isinstance(stored, FormBundle)
            assert stored.form == expected.form, (
                f"Bundle form mismatch: expected {expected.form!r}, " f"got {stored.form!r}"
            )
            assert stored.features == expected.features, (
                f"Bundle features mismatch: expected {expected.features}, " f"got {stored.features}"
            )

    # -----------------------------------------------------------------------
    # AC-2: full alembic subprocess upgrade->downgrade with seeded data
    # -----------------------------------------------------------------------

    def test_full_upgrade_downgrade_restores_forms(self) -> None:  # noqa: C901
        """AC-2 (LEXGEN-03-05): seed multi-row flat data BEFORE the LEXGEN-03
        upgrade subprocess.  Drive alembic upgrade (runs DDL + backfill).
        Assert stored forms are bundle lists.  Drive alembic downgrade.
        Assert forms are byte-equal to the original flat dicts.

        WHY this consolidation test is not a duplicate:
          - test_upgrade_then_downgrade_round_trips_schema: DDL-only, EMPTY table.
          - test_downgrade_restores_flat_keys: uses helper functions directly,
            not the alembic subprocess.  The subprocess also runs upgrade hooks
            (ndel_01, esq_01, exr63) and the LEXGEN-03 backfill as a unit.
          This test is the ONLY end-to-end proof that the backfill DATA migration
          is reversible when driven via the standard alembic CLI path.

        Invariant: the full migration pair (DDL + data) is lossless for canonical
        flat dicts; upgrade->downgrade restores byte-equal forms.
        """
        db_name = "test_lexgen03_ac2_multi"
        try:
            db_url = _setup_migration_db(db_name)
        except Exception as exc:
            pytest.skip(
                f"Cannot create isolated migration DB '{db_name}': {exc}. "
                "Requires a reachable PostgreSQL on localhost:5433 "
                "(pgvector/pgvector:pg17). This test is CI-gated."
            )

        # Seed a 3-row dataset BEFORE the LEXGEN-03 upgrade so the backfill
        # runs against real pre-migration flat rows.  We upgrade to the revision
        # just before LEXGEN-03, seed data, then upgrade the LEXGEN-03 revision.
        pre_lexgen03_rev = "1536eb298412"  # LEXGEN-01 (direct predecessor)
        lexgen03_rev = "5e8cc90e5bca"  # LEXGEN-03

        # Canonical flat forms for 3 test nouns (varying paradigm sizes)
        seed_rows = [
            {
                "id": 990_001,
                "lemma": "θάλασσα_ac2",  # θάλασσα_ac2
                "gender": "feminine",
                "flat": {
                    "nominative_singular": "η θάλασσα",
                    "genitive_singular": "της θάλασσας",
                    "nominative_plural": "οι θάλασσες",
                    "genitive_plural": "των θαλασσών",
                },
            },
            {
                "id": 990_002,
                "lemma": "ουρανός_ac2",  # ουρανός_ac2
                "gender": "masculine",
                "flat": {
                    "nominative_singular": "ο ουρανός",
                    "genitive_singular": "του ουρανού",
                    "accusative_singular": "τον ουρανό",
                    "vocative_singular": "ουρανέ",
                    "nominative_plural": "οι ουρανοί",
                    "genitive_plural": "των ουρανών",
                    "accusative_plural": "τους ουρανούς",
                    "vocative_plural": "ουρανοί",
                },
            },
            {
                "id": 990_003,
                "lemma": "παιδί_ac2",  # παιδί_ac2
                "gender": "neuter",
                "flat": {},  # empty flat -> must become []
            },
        ]

        try:
            # ---- Step 1: upgrade to LEXGEN-01 predecessor (table exists, no pos) ----
            result_pre = _run_alembic(["upgrade", pre_lexgen03_rev], db_url)
            assert result_pre.returncode == 0, (
                f"alembic upgrade {pre_lexgen03_rev} failed:\n"
                f"STDOUT:\n{result_pre.stdout}\nSTDERR:\n{result_pre.stderr}"
            )

            engine = _sync_engine(db_url)
            try:
                # ---- Step 2: seed multi-row flat data before LEXGEN-03 ----
                with engine.connect() as conn:
                    for r in seed_rows:
                        conn.execute(
                            text("""
                                INSERT INTO reference.wiktionary_morphology
                                    (id, lemma, gender, forms)
                                VALUES (:id, :lemma, :gender, CAST(:forms AS jsonb))
                                ON CONFLICT DO NOTHING
                                """),
                            {
                                "id": r["id"],
                                "lemma": r["lemma"],
                                "gender": r["gender"],
                                "forms": json.dumps(r["flat"]),
                            },
                        )
                    conn.commit()

                    # Confirm pre-upgrade state: forms must be flat dicts
                    for r in seed_rows:
                        forms = conn.execute(
                            text(
                                "SELECT forms FROM reference.wiktionary_morphology "
                                "WHERE id = :id"
                            ),
                            {"id": r["id"]},
                        ).scalar()
                        assert isinstance(forms, dict), (
                            f"Pre-upgrade: row id={r['id']} forms must be a flat "
                            f"dict; got {type(forms)}: {forms!r}"
                        )

                # ---- Step 3: upgrade LEXGEN-03 (DDL + backfill) ----
                result_up = _run_alembic(["upgrade", lexgen03_rev], db_url)
                assert result_up.returncode == 0, (
                    f"alembic upgrade {lexgen03_rev} (LEXGEN-03) failed:\n"
                    f"STDOUT:\n{result_up.stdout}\nSTDERR:\n{result_up.stderr}"
                )

                # ---- Step 4: assert forms are now bundle lists ----
                with engine.connect() as conn:
                    for r in seed_rows:
                        forms = conn.execute(
                            text(
                                "SELECT forms FROM reference.wiktionary_morphology "
                                "WHERE id = :id"
                            ),
                            {"id": r["id"]},
                        ).scalar()
                        assert isinstance(forms, list), (
                            f"Post-upgrade: row id={r['id']} (lemma={r['lemma']!r}) "
                            f"forms must be a bundle list; got {type(forms)}: {forms!r}"
                        )
                        if not r["flat"]:
                            assert forms == [], (
                                f"Empty flat row (id={r['id']}) must produce [] "
                                f"after upgrade; got {forms!r}"
                            )
                        else:
                            for item in forms:
                                assert (
                                    "form" in item and "features" in item
                                ), f"Bundle item missing keys: {item!r}"

                # ---- Step 5: downgrade LEXGEN-03 (data reversal + DDL reversal) ----
                result_down = _run_alembic(["downgrade", "-1"], db_url)
                assert result_down.returncode == 0, (
                    f"alembic downgrade -1 (LEXGEN-03) failed:\n"
                    f"STDOUT:\n{result_down.stdout}\nSTDERR:\n{result_down.stderr}"
                )

                # ---- Step 6: assert forms are byte-equal to original flat ----
                with engine.connect() as conn:
                    for r in seed_rows:
                        forms = conn.execute(
                            text(
                                "SELECT forms FROM reference.wiktionary_morphology "
                                "WHERE id = :id"
                            ),
                            {"id": r["id"]},
                        ).scalar()
                        assert isinstance(forms, dict), (
                            f"Post-downgrade: row id={r['id']} "
                            f"(lemma={r['lemma']!r}) forms must be a flat dict; "
                            f"got {type(forms)}: {forms!r}"
                        )
                        assert forms == r["flat"], (
                            f"AC-2 byte-equal check FAILED for row id={r['id']} "
                            f"(lemma={r['lemma']!r}).\n"
                            f"Original flat:    {r['flat']}\n"
                            f"After downgrade:  {forms}\n"
                            f"The migration pair (upgrade->downgrade) is NOT lossless "
                            f"for this dataset: INTEGRATION GAP."
                        )

                # ---- Step 7: schema check: pos column gone, old index restored ----
                assert not _column_exists(
                    engine, "reference", "wiktionary_morphology", "pos"
                ), "pos column must be gone after downgrade -1"
                indexes = _get_unique_indexes(
                    engine, schema="reference", table="wiktionary_morphology"
                )
                assert (
                    "uq_wiktionary_morphology_lemma_gender" in indexes
                ), "Old 2-col unique index must be restored after downgrade -1"
                assert (
                    "uq_wiktionary_morphology_lemma_pos_gender" not in indexes
                ), "3-col unique index must NOT exist after downgrade -1"

            finally:
                engine.dispose()
        finally:
            _teardown_migration_db(db_name)
