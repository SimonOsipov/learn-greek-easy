"""Integration migration tests for LEXGEN-03-01: pos column + unique index change.

Mode A — RED specs (Alembic round-trip variant).

BACKGROUND
----------
The LEXGEN-03-01 migration adds a `pos` column (Text, NOT NULL, server_default
'noun') to `reference.wiktionary_morphology` and replaces the 2-column unique
index `uq_wiktionary_morphology_lemma_gender` on `(lemma, gender)` with a
3-column unique index `uq_wiktionary_morphology_lemma_pos_gender` on
`(lemma, pos, gender)`.

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

import os
import subprocess
from pathlib import Path

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
    poetry = "/Users/samosipov/.local/bin/poetry"
    # Build a subprocess environment that targets the isolated DB.
    # Inherit the current process env (for PATH, venv activation etc.) then
    # override DATABASE_URL so env.py / settings picks up the isolated DB.
    subprocess_env = os.environ.copy()
    subprocess_env["DATABASE_URL"] = db_url
    subprocess_env.setdefault("PICTURE_HOUSE_STYLE_DEFAULT", "test_house_style_default")
    return subprocess.run(
        [poetry, "run", "alembic", *command],
        cwd=str(_BACKEND_DIR),
        capture_output=True,
        text=True,
        env=subprocess_env,
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
                    ix.indkey_order         AS col_order
                FROM
                    pg_class t
                    JOIN pg_namespace n     ON n.oid = t.relnamespace
                    JOIN pg_index ix        ON ix.indrelid = t.oid
                    JOIN pg_class i         ON i.oid = ix.indexrelid
                    JOIN LATERAL UNNEST(
                        ARRAY(SELECT generate_subscripts(ix.indkey, 1))
                    ) WITH ORDINALITY AS ix(indkey_idx, indkey_order)
                        ON TRUE
                    JOIN pg_attribute a     ON a.attrelid = t.oid
                                           AND a.attnum = ix.indkey[ix.indkey_idx - 1]
                WHERE
                    t.relname   = :table
                    AND n.nspname = :schema
                    AND ix.indisunique = TRUE
                ORDER BY i.relname, ix.indkey_order
                """
            ),
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
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = :schema
                  AND table_name   = :table
                  AND column_name  = :column
                """
            ),
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
