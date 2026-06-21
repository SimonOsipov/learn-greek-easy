"""Integration migration tests for LEXGEN-05-01: frequency_rank table.

Mode A — RED spec (Alembic round-trip).

BACKGROUND
----------
The LEXGEN-05-01 migration creates one table in the `reference` schema:
  - reference.frequency_rank  (id, lemma, source, rank, created_at)

The migration must have down_revision == '844af57c6ca2' (LEXGEN-04 head).

INDEXES
-------
After upgrade, reference.frequency_rank must have:
  - A UNIQUE index on (lemma) — DB backstop for one-row-per-lemma invariant.
  - A NON-UNIQUE index on (rank) — for range lookups by rank order.

After downgrade, the table and both indexes must be gone.

HOW THESE TESTS WORK
---------------------
The test spins up an isolated PostgreSQL database, applies all Alembic migrations
from scratch via `alembic upgrade head` (subprocess), then verifies schema state
via pg_catalog introspection.  It then runs `alembic downgrade -1` and verifies
the table is gone.

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
    CI-gated RED today.  The LEXGEN-05-01 migration does not exist yet.
    `alembic upgrade head` stops at 844af57c6ca2 (no frequency_rank table).
    The assertion that reference.frequency_rank exists after upgrade fails.
    GREEN after: executor creates the migration and the FrequencyRank model.
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
# Helpers (mirrors test_lexgen_04_cefr_lemma.py pattern exactly)
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


class TestLexgen05FrequencyRankMigrationRoundTrip:
    """AC-5: upgrade head then downgrade -1 round-trips the table and indexes.

    CI-gated RED today:
    - The LEXGEN-05-01 migration does not exist.
    - `alembic upgrade head` stops at 844af57c6ca2 with no frequency_rank table.
    - The assertion that reference.frequency_rank exists after upgrade fails.

    GREEN after: executor creates the migration (down_revision == '844af57c6ca2')
    and the FrequencyRank model in models.py.
    """

    def test_migration_upgrade_downgrade_roundtrip(self):
        """AC-5: Full Alembic round-trip for LEXGEN-05-01.

        GIVEN  head at 844af57c6ca2 (LEXGEN-04) on a real PG instance
        WHEN   alembic upgrade head
        THEN   reference.frequency_rank exists with:
                 - a UNIQUE index on (lemma) alone (not on (lemma, rank))
                 - a non-unique index on (rank)
        WHEN   alembic downgrade -1
        THEN   reference.frequency_rank does NOT exist
               both indexes are gone

        CI-gated RED today (migration not yet authored).
        GREEN after: executor creates the LEXGEN-05-01 migration.
        """
        db_name = "test_lexgen05_frequency_rank"
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
            # Pin to 6b8e5cdc102f (LEXGEN-05 head) so a successor migration doesn't
            # break this round-trip's downgrade -1 assertion.
            result = _run_alembic(["upgrade", "6b8e5cdc102f"], db_url)
            assert result.returncode == 0, (
                f"alembic upgrade 6b8e5cdc102f failed:\nSTDOUT:\n{result.stdout}\n"
                f"STDERR:\n{result.stderr}"
            )

            engine = _sync_engine(db_url)
            try:
                # AC-5a: table exists after upgrade
                assert _table_exists(
                    engine, "reference", "frequency_rank"
                ), "reference.frequency_rank must exist after alembic upgrade 6b8e5cdc102f"

                # AC-5b: UNIQUE index on (lemma) alone
                unique_indexes = _get_unique_indexes(engine, "reference", "frequency_rank")
                unique_index_cols = list(unique_indexes.values())
                assert any(cols == ["lemma"] for cols in unique_index_cols), (
                    f"Expected a unique index covering exactly (lemma) on "
                    f"reference.frequency_rank after upgrade; "
                    f"found unique indexes: {unique_indexes!r}"
                )
                # No UNIQUE(lemma, rank) must exist
                assert not any(cols == ["lemma", "rank"] for cols in unique_index_cols), (
                    "Found a forbidden UNIQUE(lemma, rank) index — this would allow "
                    "two contradictory frequency ranks for the same lemma"
                )

                # AC-5c: non-unique index on (rank)
                rank_non_unique = _get_non_unique_indexes_for_column(
                    engine, "reference", "frequency_rank", "rank"
                )
                assert len(rank_non_unique) >= 1, (
                    "Expected a non-unique index on (rank) for "
                    "reference.frequency_rank after upgrade; none found"
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
                # AC-5d: table gone after downgrade
                assert not _table_exists(
                    engine, "reference", "frequency_rank"
                ), "reference.frequency_rank must NOT exist after alembic downgrade -1"

                # AC-5e: indexes gone after downgrade
                unique_indexes_after = _get_unique_indexes(engine, "reference", "frequency_rank")
                assert unique_indexes_after == {}, (
                    f"No unique indexes must exist on reference.frequency_rank after "
                    f"downgrade; found: {unique_indexes_after!r}"
                )
                rank_non_unique_after = _get_non_unique_indexes_for_column(
                    engine, "reference", "frequency_rank", "rank"
                )
                assert rank_non_unique_after == [], (
                    f"Non-unique rank index must be gone after downgrade; "
                    f"found: {rank_non_unique_after!r}"
                )
            finally:
                engine.dispose()

        finally:
            # Only tear down a DB that setup actually created — a skipped/failed setup
            # leaves nothing to drop, and running teardown then can itself error.
            if setup_ok:
                _teardown_migration_db(db_name)


# ---------------------------------------------------------------------------
# Mode B adversarial / edge / boundary coverage (LEXGEN-05-01 QA, post-impl)
# ---------------------------------------------------------------------------


class TestLexgen05FrequencyRankConstraintEnforcement:
    """Adversarial DB-level constraint tests for reference.frequency_rank.

    The AC round-trip test (above) proves the UNIQUE index on (lemma) *exists*
    after migration.  These tests prove the constraints are *enforced* by
    PostgreSQL — i.e. they raise real IntegrityErrors when violated.  This is
    the gap the round-trip cannot close on its own.

    Three scenarios:
      1. Duplicate lemma (same lemma, different rank) → IntegrityError (UNIQUE).
      2. Duplicate rank (same rank, different lemma) → NO error (rank is non-unique).
      3. NULL lemma insert → IntegrityError (NOT NULL).

    Each test uses its own isolated DB to avoid cross-test interference.
    """

    def _upgraded_engine(self, db_name: str):
        """Return (engine, db_url) for a fresh DB at head, or skip if PG unreachable.

        Caller must call engine.dispose() and _teardown_migration_db(db_name) in a
        finally block.
        """
        try:
            db_url = _setup_migration_db(db_name)
        except _DB_UNREACHABLE_ERRORS as exc:
            pytest.skip(
                f"Cannot create isolated migration DB '{db_name}': {exc}. "
                "Requires a reachable PostgreSQL on localhost:5433 "
                "(pgvector/pgvector:pg17). This test is CI-gated."
            )

        try:
            result = _run_alembic(["upgrade", "head"], db_url)
            assert result.returncode == 0, (
                f"alembic upgrade head failed:\nSTDOUT:\n{result.stdout}\n"
                f"STDERR:\n{result.stderr}"
            )
            engine = _sync_engine(db_url)
        except Exception:
            _teardown_migration_db(db_name)
            raise
        return engine, db_url

    def test_unique_lemma_violation_raises_integrity_error(self):
        """AC-2 adversarial: DB rejects a second row with the same lemma.

        GIVEN  reference.frequency_rank has one row (lemma='αγαπώ', rank=1)
        WHEN   we INSERT a second row with the same lemma but a different rank (rank=2)
        THEN   PostgreSQL raises a UNIQUE constraint violation (IntegrityError)

        This test is NOT redundant with the round-trip: the round-trip verifies the
        index EXISTS; this test verifies it is ENFORCED.  A migration that creates the
        index as DEFERRABLE INITIALLY DEFERRED would pass the round-trip but not this.
        """
        from sqlalchemy.exc import IntegrityError

        db_name = "test_lexgen05_unique_lemma"
        setup_ok = False
        engine = None
        try:
            engine, _db_url = self._upgraded_engine(db_name)
            setup_ok = True

            insert_sql = text(
                "INSERT INTO reference.frequency_rank (lemma, rank, source) "
                "VALUES (:lemma, :rank, :source)"
            )

            # First insert must succeed
            with engine.connect() as conn:
                conn.execute(insert_sql, {"lemma": "αγαπώ", "rank": 1, "source": "wordfreq"})

            # Second insert with same lemma, different rank must fail
            with pytest.raises(IntegrityError, match="uq_frequency_rank_lemma"):
                with engine.connect() as conn:
                    conn.execute(insert_sql, {"lemma": "αγαπώ", "rank": 2, "source": "wordfreq"})
        finally:
            if engine is not None:
                engine.dispose()
            if setup_ok:
                _teardown_migration_db(db_name)

    def test_shared_rank_value_is_allowed(self):
        """AC-2/AC-3 adversarial: two different lemmas may share the same rank.

        GIVEN  reference.frequency_rank is empty
        WHEN   we INSERT two rows with different lemmas but the same rank value (1)
        THEN   both inserts succeed (rank index is NON-unique)

        This guards against a regression where someone tightens the rank index to
        UNIQUE — which would break many real frequency lists that use banded ranks.
        """
        db_name = "test_lexgen05_shared_rank"
        setup_ok = False
        engine = None
        try:
            engine, _db_url = self._upgraded_engine(db_name)
            setup_ok = True

            insert_sql = text(
                "INSERT INTO reference.frequency_rank (lemma, rank, source) "
                "VALUES (:lemma, :rank, :source)"
            )

            # Both inserts must succeed — no unique constraint on rank
            with engine.connect() as conn:
                conn.execute(insert_sql, {"lemma": "αγαπώ", "rank": 1, "source": "wordfreq"})
                conn.execute(insert_sql, {"lemma": "είμαι", "rank": 1, "source": "wordfreq"})

            # Verify both rows are present
            with engine.connect() as conn:
                row_count = conn.execute(
                    text("SELECT COUNT(*) FROM reference.frequency_rank WHERE rank = 1")
                ).scalar()
            assert (
                row_count == 2
            ), f"Expected 2 rows with rank=1 (shared rank is allowed), got {row_count}"
        finally:
            if engine is not None:
                engine.dispose()
            if setup_ok:
                _teardown_migration_db(db_name)

    def test_null_lemma_raises_integrity_error(self):
        """AC-1 adversarial: DB rejects a NULL lemma (NOT NULL enforced at DB level).

        GIVEN  reference.frequency_rank is empty
        WHEN   we INSERT a row with lemma=NULL
        THEN   PostgreSQL raises an IntegrityError (NOT NULL violation)

        The unit test (test_frequency_rank.py) verifies the SQLAlchemy mapping
        carries `nullable=False`, but that only protects ORM-level inserts.  A raw
        SQL insert bypasses ORM-level validation; this test confirms the DB column
        itself is NOT NULL.
        """
        from sqlalchemy.exc import IntegrityError

        db_name = "test_lexgen05_null_lemma"
        setup_ok = False
        engine = None
        try:
            engine, _db_url = self._upgraded_engine(db_name)
            setup_ok = True

            with pytest.raises(IntegrityError):
                with engine.connect() as conn:
                    conn.execute(
                        text(
                            "INSERT INTO reference.frequency_rank (lemma, rank, source) "
                            "VALUES (NULL, 1, 'wordfreq')"
                        )
                    )
        finally:
            if engine is not None:
                engine.dispose()
            if setup_ok:
                _teardown_migration_db(db_name)
