"""Integration migration tests for LEXGEN-04-01: cefr_lemma + cefr_lemma_review tables.

Mode A — RED spec (Alembic round-trip).

BACKGROUND
----------
The LEXGEN-04-01 migration creates two tables in the `reference` schema:
  - reference.cefr_lemma        (lemma, level, source, closed_class, created_at)
  - reference.cefr_lemma_review (raw_lemma, normalized_lemma, level, source,
                                  reason, created_at)

The migration must be down_revision == '5e8cc90e5bca' (LEXGEN-03 head).

INDEXES
-------
After upgrade, reference.cefr_lemma must have:
  - A UNIQUE index on (lemma) — the DB backstop for one-row-per-lemma invariant.
  - A NON-UNIQUE index on (level) — for gate queries loading lemmas <= target level.

After downgrade, both tables and both indexes must be gone.

HOW THESE TESTS WORK
---------------------
The test spins up an isolated PostgreSQL database, applies all Alembic migrations
from scratch via `alembic upgrade head` (subprocess), then verifies schema state
via pg_catalog introspection.  It then runs `alembic downgrade -1` and verifies
both tables are gone.

Each test creates its own isolated DB and drops it in a finally block so the
test is safe to run concurrently with other migration tests.

CONTAINER IMAGE
---------------
Requires `pgvector/pgvector:pg17` on localhost:5433 (not vanilla postgres:17) —
the migration chain creates the `vector` extension.

CI BEHAVIOUR
------------
These tests carry `pytest.mark.integration` and `pytest.mark.db`.  In CI the
test DB port 5433 is not available during unit-test runs → the tests are skipped
via `pytest.skip()` in `_setup_migration_db`.  They are exercised locally via
pgvector Docker (see LEXGEN-01 lesson in MEMORY.md).

The `pytest --collect-only` step must pass WITHOUT a running DB (collect-only
does not execute test bodies).

TEST STATUS — Mode A (pre-implementation)
------------------------------------------
test_migration_upgrade_downgrade_roundtrip:
    CI-gated RED today.  The LEXGEN-04-01 migration does not exist yet.
    `alembic upgrade head` stops at 5e8cc90e5bca (no cefr_lemma tables).
    The assertion that reference.cefr_lemma exists after upgrade fails.
    GREEN after: executor creates the migration and both models.
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

# DB-unreachable errors that justify a skip (PG not running on :5433 in CI). A real
# setup defect raises a different type and must fail loudly, not be masked as a skip.
_DB_UNREACHABLE_ERRORS = (OperationalError, ConnectionError)

# ---------------------------------------------------------------------------
# Markers — all tests in this file require a real PG on :5433
# ---------------------------------------------------------------------------

pytestmark = [
    pytest.mark.integration,
    pytest.mark.db,
]


# ---------------------------------------------------------------------------
# Override the integration conftest's autouse async fixture
# ---------------------------------------------------------------------------
# tests/integration/conftest.py defines `bind_factory_session` as autouse, and it
# requires the async `db_session` (-> db_engine -> session_db_engine). That chain
# runs for EVERY test under tests/integration/, including this FULLY SYNCHRONOUS
# migration test (psycopg2 + Alembic subprocess), which needs no async DB session.
# In the full xdist suite that pulls async DB IO into a non-greenlet context and
# raises sqlalchemy.exc.MissingGreenlet during fixture setup. Shadow it here with a
# no-op so this module's sync test is fully independent of the async session.


@pytest.fixture(autouse=True)
def bind_factory_session():  # noqa: PT004 — override conftest's async autouse fixture
    """No-op override of the integration conftest's async autouse fixture.

    This migration test is fully synchronous (psycopg2 + Alembic subprocess) and
    needs no async DB session; overriding the conftest's autouse async bind avoids
    a MissingGreenlet in the full xdist suite. Overriding `bind_factory_session`
    alone severs the entire async chain (db_session -> db_engine -> session_db_engine)
    for this module — no other autouse fixture in the integration conftest requires it.
    """
    yield


# ---------------------------------------------------------------------------
# Constants / paths
# ---------------------------------------------------------------------------

# Path to the backend directory (where alembic.ini lives)
_BACKEND_DIR = Path(__file__).parent.parent.parent.parent  # learn-greek-easy-backend/


def _coerce_to_psycopg2(url: str) -> str:
    """Force a SQLAlchemy URL onto the synchronous psycopg2 driver.

    Alembic and this round-trip test run fully synchronously, but CI sets
    ``TEST_DATABASE_URL`` to an ``asyncpg`` URL (for the async session engine the
    rest of the suite uses). Feeding a ``postgresql+asyncpg://`` URL into a
    synchronous ``create_engine`` raises ``MissingGreenlet`` on connect, because
    asyncpg attempts IO outside a greenlet. We rewrite the driver to psycopg2 so
    this test always talks to the same DB over a real sync driver, regardless of
    how ``TEST_DATABASE_URL`` is shaped.
    """
    if url.startswith("postgresql+asyncpg://"):
        return "postgresql+psycopg2://" + url[len("postgresql+asyncpg://") :]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg2://" + url[len("postgresql://") :]
    return url


# Database URL base — derive an isolated DB name per test to avoid
# collision with the shared test DB. Coerced to psycopg2 because Alembic + this
# round-trip run synchronously even when CI provides an asyncpg TEST_DATABASE_URL.
_BASE_DB_URL = _coerce_to_psycopg2(
    os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@localhost:5433/test_learn_greek",
    )
)

# Admin connection URL (connects to the `postgres` maintenance database)
_ADMIN_DB_URL = _BASE_DB_URL.rsplit("/", 1)[0] + "/postgres"


# ---------------------------------------------------------------------------
# Helpers (mirrors test_lexgen_03_wiktionary_pos.py pattern exactly)
# ---------------------------------------------------------------------------


def _replace_db_in_url(url: str, new_db_name: str) -> str:
    """Replace the database name at the tail of a SQLAlchemy URL."""
    return url.rsplit("/", 1)[0] + "/" + new_db_name


def _sync_engine(url: str) -> Engine:
    """Create a synchronous psycopg2 engine (Alembic runs synchronously)."""
    return create_engine(url, isolation_level="AUTOCOMMIT")


def _run_alembic(command: list[str], db_url: str) -> subprocess.CompletedProcess:
    """Run an alembic sub-command against *db_url* in the backend directory.

    Sets DATABASE_URL in the subprocess environment so alembic/env.py picks up
    the isolated DB (env.py reads settings.database_url_sync which derives from
    DATABASE_URL — it does NOT read -x db_url= arguments).

    Args:
        command: Alembic sub-command tokens, e.g. ["upgrade", "head"].
        db_url:  The synchronous (psycopg2) database URL to target.

    Returns:
        CompletedProcess — callers must check .returncode.
    """
    poetry = shutil.which("poetry")
    cmd = (
        [poetry, "run", "alembic", *command]
        if poetry
        else [sys.executable, "-m", "alembic", *command]
    )
    subprocess_env = os.environ.copy()
    subprocess_env["DATABASE_URL"] = db_url
    subprocess_env.setdefault("PICTURE_HOUSE_STYLE_DEFAULT", "test_house_style_default")
    return subprocess.run(
        cmd,
        cwd=str(_BACKEND_DIR),
        capture_output=True,
        text=True,
        env=subprocess_env,
        timeout=300,
    )


def _setup_migration_db(db_name: str) -> str:
    """Create an isolated database for a migration round-trip test.

    Returns the synchronous DATABASE_URL for the new DB.
    Raises if the PG server is not reachable (caller wraps in pytest.skip).
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
            text(
                """
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = :db AND pid <> pg_backend_pid()
                """
            ),
            {"db": db_name},
        )
        conn.execute(text(f'DROP DATABASE IF EXISTS "{db_name}"'))
    admin_engine.dispose()


def _get_unique_indexes(engine: Engine, schema: str, table: str) -> dict[str, list[str]]:
    """Return {index_name: [col, ...]} for all unique indexes on schema.table."""
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
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
                """
            ),
            {"table": table, "schema": schema},
        ).fetchall()

    result: dict[str, list[str]] = {}
    for row in rows:
        idx_name, col_name = row[0], row[1]
        result.setdefault(idx_name, []).append(col_name)
    return result


def _table_exists(engine: Engine, schema: str, table: str) -> bool:
    """Return True if schema.table exists."""
    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = :schema
                  AND table_name   = :table
                """
            ),
            {"schema": schema, "table": table},
        ).fetchone()
    return row is not None


def _get_non_unique_indexes_for_column(
    engine: Engine, schema: str, table: str, column: str
) -> list[str]:
    """Return index names of non-unique indexes on schema.table that cover column."""
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT i.relname AS idx_name
                FROM pg_class t
                JOIN pg_namespace n  ON n.oid = t.relnamespace
                JOIN pg_index ix     ON ix.indrelid = t.oid
                JOIN pg_class i      ON i.oid = ix.indexrelid
                JOIN pg_attribute a  ON a.attrelid = t.oid
                                    AND a.attnum = ANY(ix.indkey)
                WHERE t.relname   = :table
                  AND n.nspname   = :schema
                  AND ix.indisunique = FALSE
                  AND a.attname   = :column
                ORDER BY i.relname
                """
            ),
            {"table": table, "schema": schema, "column": column},
        ).fetchall()
    return [row[0] for row in rows]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestLexgen04CefrLemmaMigrationRoundTrip:
    """AC-9: upgrade head then downgrade -1 round-trips both tables and indexes.

    CI-gated RED today:
    - The LEXGEN-04-01 migration does not exist.
    - `alembic upgrade head` stops at 5e8cc90e5bca with no cefr_lemma tables.
    - The assertion that reference.cefr_lemma exists after upgrade fails.

    GREEN after: executor creates the migration (down_revision == '5e8cc90e5bca')
    and both CefrLemma / CefrLemmaReview models in models.py.
    """

    def test_migration_upgrade_downgrade_roundtrip(self):
        """AC-9: Full Alembic round-trip for LEXGEN-04-01.

        GIVEN  head at 5e8cc90e5bca (LEXGEN-03) on a real PG instance
        WHEN   alembic upgrade head
        THEN   reference.cefr_lemma exists with:
                 - a UNIQUE index on (lemma) alone (not on (lemma, level))
                 - a non-unique index on (level)
               reference.cefr_lemma_review exists
        WHEN   alembic downgrade -1
        THEN   reference.cefr_lemma does NOT exist
               reference.cefr_lemma_review does NOT exist
               both indexes are gone

        CI-gated RED today (migration not yet authored).
        GREEN after: executor creates the LEXGEN-04-01 migration.
        """
        db_name = "test_lexgen04_cefr_lemma"
        setup_ok = False
        try:
            db_url = _setup_migration_db(db_name)
            setup_ok = True
        except _DB_UNREACHABLE_ERRORS as exc:
            pytest.skip(
                f"Cannot create isolated migration DB '{db_name}': {exc}. "
                "Requires a reachable PostgreSQL on localhost:5433 "
                "(pgvector/pgvector:pg17). This test is CI-gated."
            )

        try:
            # ---- UPGRADE ----
            # Pin to 844af57c6ca2 (LEXGEN-04 head) so a successor migration doesn't
            # break this round-trip's downgrade -1 assertion.
            result = _run_alembic(["upgrade", "844af57c6ca2"], db_url)
            assert result.returncode == 0, (
                f"alembic upgrade 844af57c6ca2 failed:\nSTDOUT:\n{result.stdout}\n"
                f"STDERR:\n{result.stderr}"
            )

            engine = _sync_engine(db_url)
            try:
                # AC-9a: both tables exist after upgrade
                assert _table_exists(
                    engine, "reference", "cefr_lemma"
                ), "reference.cefr_lemma must exist after alembic upgrade 844af57c6ca2"
                assert _table_exists(
                    engine, "reference", "cefr_lemma_review"
                ), "reference.cefr_lemma_review must exist after alembic upgrade 844af57c6ca2"

                # AC-9b: UNIQUE index on (lemma) alone
                unique_indexes = _get_unique_indexes(engine, "reference", "cefr_lemma")
                unique_index_cols = list(unique_indexes.values())
                assert any(cols == ["lemma"] for cols in unique_index_cols), (
                    f"Expected a unique index covering exactly (lemma) on "
                    f"reference.cefr_lemma after upgrade; "
                    f"found unique indexes: {unique_indexes!r}"
                )
                # No UNIQUE(lemma, level) must exist
                assert not any(cols == ["lemma", "level"] for cols in unique_index_cols), (
                    "Found a forbidden UNIQUE(lemma, level) index — this would allow "
                    "two contradictory CEFR levels for the same lemma"
                )

                # AC-9c: non-unique index on (level)
                level_non_unique = _get_non_unique_indexes_for_column(
                    engine, "reference", "cefr_lemma", "level"
                )
                assert len(level_non_unique) >= 1, (
                    "Expected a non-unique index on (level) for "
                    "reference.cefr_lemma after upgrade; none found"
                )

            finally:
                engine.dispose()

            # ---- DOWNGRADE ----
            result = _run_alembic(["downgrade", "-1"], db_url)
            assert result.returncode == 0, (
                f"alembic downgrade -1 failed:\nSTDOUT:\n{result.stdout}\n"
                f"STDERR:\n{result.stderr}"
            )

            engine = _sync_engine(db_url)
            try:
                # AC-9d: both tables gone after downgrade
                assert not _table_exists(
                    engine, "reference", "cefr_lemma"
                ), "reference.cefr_lemma must NOT exist after alembic downgrade -1"
                assert not _table_exists(
                    engine, "reference", "cefr_lemma_review"
                ), "reference.cefr_lemma_review must NOT exist after alembic downgrade -1"

                # AC-9e: indexes gone after downgrade
                unique_indexes_after = _get_unique_indexes(engine, "reference", "cefr_lemma")
                assert unique_indexes_after == {}, (
                    f"No unique indexes must exist on reference.cefr_lemma after "
                    f"downgrade; found: {unique_indexes_after!r}"
                )
                level_non_unique_after = _get_non_unique_indexes_for_column(
                    engine, "reference", "cefr_lemma", "level"
                )
                assert level_non_unique_after == [], (
                    f"Non-unique level index must be gone after downgrade; "
                    f"found: {level_non_unique_after!r}"
                )
            finally:
                engine.dispose()

        finally:
            # Only tear down a DB that setup actually created — a skipped/failed setup
            # leaves nothing to drop, and running teardown then can itself error.
            if setup_ok:
                _teardown_migration_db(db_name)
