"""Integration migration tests for WEDGE-01-02: culture_questions.topic column.

Regression guard for the merged migration (Alembic round-trip).

BACKGROUND
----------
The WEDGE-01-02 migration adds one nullable, indexed String(50) column to the
public schema:

    public.culture_questions.topic  (nullable String(50), indexed, no backfill)

`topic` classifies a culture question into one of the closed CultureTopic
values (WEDGE-01-01), but the closed vocabulary is enforced in Python — not
via a PostgreSQL native enum (Architect D1) — so this column is a plain
VARCHAR(50) at the DB level.

The migration has:

    down_revision = "sit_27_02_situation_domain"  ← the head it was built on
    revision = "wedge_01_02_culture_topic"

IMPORTANT — MEMORY LESSON (LEXGEN-05 / SIT-27-02):
    The round-trip test pins `alembic upgrade` to THIS migration's own
    revision id ("wedge_01_02_culture_topic"), NOT to "head". Pinning to
    "head" would mean a future successor migration breaks this round-trip's
    downgrade -1 assertion (downgrade -1 from the NEW head would undo the
    successor, not this migration).

WHAT THE ROUND-TRIP VERIFIES
-----------------------------
After ``alembic upgrade sit_27_02_situation_domain`` (the migration BEFORE
this one), we insert one minimal `culture_questions` row directly via SQL.

After ``alembic upgrade wedge_01_02_culture_topic``:
    - public.culture_questions has a "topic" column
    - the column is nullable (no NOT NULL constraint)
    - a NON-unique index named "ix_culture_questions_topic" exists over
      exactly (topic)
    - the pre-existing row's topic IS NULL — proves the migration performs
      NO backfill (no UPDATE, no server_default/DEFAULT clause)

After ``alembic downgrade -1``:
    - public.culture_questions does NOT have a "topic" column
    - the "ix_culture_questions_topic" index is gone

HOW THESE TESTS WORK
---------------------
The test spins up an isolated PostgreSQL database, applies all Alembic
migrations up to sit_27_02_situation_domain (the pre-existing head), inserts
one row, then applies wedge_01_02_culture_topic and verifies schema state via
information_schema/pg_catalog introspection. It then runs
`alembic downgrade -1` and verifies the column and index are gone.

Each test creates its own isolated DB and drops it in a finally block so the
test is safe to run concurrently with other migration tests.

CONTAINER IMAGE
---------------
Requires ``pgvector/pgvector:pg17`` on localhost:5433 (not vanilla postgres:17)
— the migration chain creates the ``vector`` extension.

CI BEHAVIOUR
------------
These tests carry ``pytest.mark.integration`` and ``pytest.mark.db``. The
`_DB_UNREACHABLE_ERRORS` skip guard below is a LOCAL-CONVENIENCE fallback
only, for a genuinely unreachable DB on a dev machine (no PG on :5433). It is
NOT a reason these tests should be excluded from CI — the `backend-tests` CI
job provisions a real `pgvector/pgvector:pg17` on port 5433, so these tests
run (and must stay green) there.

``pytest --collect-only`` must pass WITHOUT a running DB (collect-only does
not execute test bodies).
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

# DB-unreachable errors that justify a skip (PG not running on :5433 locally).
# A real setup defect raises a different type and must fail loudly, not be
# masked as a skip. This is a LOCAL-only convenience — see module docstring's
# "CI BEHAVIOUR" section: the backend-tests CI job provides PG on :5433, so
# these tests run for real (and must go green) in CI.
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

# Migration BEFORE this one (down_revision of wedge_01_02_culture_topic).
_PRIOR_REVISION = "sit_27_02_situation_domain"

# This migration's revision id.
# See MEMORY.md lesson: pin round-trip to THIS migration's own revision,
# not head.
_THIS_REVISION = "wedge_01_02_culture_topic"

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
# Helpers (mirrors test_lexgen_05_frequency_rank.py / test_sit_27_02_situation_domain.py)
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
            text("""
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = :db AND pid <> pg_backend_pid()
                """),
            {"db": db_name},
        )
        conn.execute(text(f'DROP DATABASE IF EXISTS "{db_name}"'))
    admin_engine.dispose()


def _column_exists(engine: Engine, schema: str, table: str, column: str) -> bool:
    """Return True if schema.table.column exists in information_schema.columns."""
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


def _column_is_nullable(engine: Engine, schema: str, table: str, column: str) -> bool:
    """Return True if the column allows NULLs (is_nullable = 'YES')."""
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT is_nullable
                FROM information_schema.columns
                WHERE table_schema = :schema
                  AND table_name   = :table
                  AND column_name  = :column
                """),
            {"schema": schema, "table": table, "column": column},
        ).fetchone()
    if row is None:
        return False
    return row[0] == "YES"


def _get_index_columns(engine: Engine, schema: str, table: str, index_name: str) -> list[str]:
    """Return ordered column names for *index_name* on schema.table, or [] if absent."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT a.attname AS col_name
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
                    AND i.relname = :index_name
                ORDER BY k.col_order
                """),
            {"table": table, "schema": schema, "index_name": index_name},
        ).fetchall()
    return [row[0] for row in rows]


def _index_is_unique(engine: Engine, schema: str, index_name: str) -> bool | None:
    """Return whether *index_name* is unique, or None if it does not exist."""
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT ix.indisunique
                FROM pg_class i
                JOIN pg_namespace n ON n.oid = i.relnamespace
                JOIN pg_index ix    ON ix.indexrelid = i.oid
                WHERE i.relname = :index_name
                  AND n.nspname = :schema
                """),
            {"index_name": index_name, "schema": schema},
        ).fetchone()
    return None if row is None else bool(row[0])


def _insert_minimal_culture_question(engine: Engine) -> None:
    """Insert one minimal, valid culture_questions row via raw SQL.

    Supplies every NOT-NULL column that has no DB-level server_default:
    question_text/option_a/option_b (JSON), correct_option (Integer),
    order_index (Integer — only has a Python-side ORM default, not a
    server_default, so raw SQL must supply it explicitly). deck_id is left
    NULL (nullable FK, per CultureQuestion's comment: "nullable for
    AI-generated questions pending review").
    """
    with engine.connect() as conn:
        conn.execute(
            text("""
                INSERT INTO culture_questions
                    (deck_id, question_text, option_a, option_b, correct_option, order_index)
                VALUES
                    (NULL, :question_text, :option_a, :option_b, 1, 0)
                """),
            {
                "question_text": '{"en": "Q?", "el": "\\u0395;", "ru": "\\u0412?"}',
                "option_a": '{"en": "A", "el": "\\u0391", "ru": "\\u0410"}',
                "option_b": '{"en": "B", "el": "\\u0392", "ru": "\\u0411"}',
            },
        )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestWedge0102CultureTopicMigrationRoundTrip:
    """AC-1/AC-2/AC-4: upgrade to wedge_01_02_culture_topic, then downgrade -1
    round-trips the column and index, with NO backfill of existing rows.

    Regression guard: the WEDGE-01-02 migration
    (``revision = "wedge_01_02_culture_topic"``,
    ``down_revision = "sit_27_02_situation_domain"``) must keep applying and
    reversing cleanly.
    """

    def test_migration_adds_nullable_indexed_topic_no_backfill(self):
        """AC-1/AC-2/AC-4: after upgrade, topic exists, is nullable, is indexed,
        and the pre-existing row's topic is NULL (no backfill).

        GIVEN  DB at sit_27_02_situation_domain (no topic column), with one
               pre-existing culture_questions row inserted directly via SQL
        WHEN   alembic upgrade wedge_01_02_culture_topic
        THEN   public.culture_questions has a "topic" column that is nullable
               AND a non-unique index "ix_culture_questions_topic" over (topic) exists
               AND the pre-existing row's topic IS NULL (no backfill ran)

        Pin: uses revision "wedge_01_02_culture_topic" NOT "head" so that
        future migrations do not break this round-trip (MEMORY lesson from
        LEXGEN-05 / SIT-27-02).
        """
        db_name = "test_wedge0102_upgrade_adds_topic"
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
            # ---- Get to the prior head, insert a pre-existing row ----
            result = _run_alembic(["upgrade", _PRIOR_REVISION], db_url)
            assert result.returncode == 0, (
                f"alembic upgrade {_PRIOR_REVISION} failed:\n"
                f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
            )

            engine = _sync_engine(db_url)
            try:
                _insert_minimal_culture_question(engine)
            finally:
                engine.dispose()

            # ---- UPGRADE to this migration ----
            result = _run_alembic(["upgrade", _THIS_REVISION], db_url)
            assert result.returncode == 0, (
                f"alembic upgrade {_THIS_REVISION} failed:\n"
                f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
            )

            engine = _sync_engine(db_url)
            try:
                # AC-1a: column exists in public.culture_questions after upgrade
                assert _column_exists(engine, "public", "culture_questions", "topic"), (
                    "culture_questions.topic must exist after " f"alembic upgrade {_THIS_REVISION}"
                )

                # AC-1b: column is nullable (no NOT NULL constraint)
                assert _column_is_nullable(
                    engine, "public", "culture_questions", "topic"
                ), "culture_questions.topic must be nullable (NULL allowed) after upgrade"

                # AC-2: non-unique index on (topic) named ix_culture_questions_topic
                index_cols = _get_index_columns(
                    engine, "public", "culture_questions", "ix_culture_questions_topic"
                )
                assert index_cols == ["topic"], (
                    "Expected index 'ix_culture_questions_topic' covering exactly "
                    f"(topic) on culture_questions after upgrade; found columns: {index_cols!r}"
                )
                is_unique = _index_is_unique(engine, "public", "ix_culture_questions_topic")
                assert is_unique is False, (
                    "'ix_culture_questions_topic' must be non-unique "
                    f"(many questions share a topic); indisunique={is_unique!r}"
                )

                # AC-4: the pre-existing row's topic is NULL — proves NO backfill ran
                with engine.connect() as conn:
                    row = conn.execute(
                        text("SELECT topic FROM culture_questions LIMIT 1")
                    ).fetchone()
                assert (
                    row is not None
                ), "Expected the pre-existing culture_questions row to survive the upgrade"
                assert row[0] is None, (
                    "The pre-existing culture_questions row's topic must be NULL after "
                    f"upgrade — the migration must NOT backfill existing rows, got {row[0]!r}"
                )
            finally:
                engine.dispose()

        finally:
            # Only tear down a DB that setup actually created — a skipped/failed setup
            # leaves nothing to drop, and running teardown then can itself error.
            if setup_ok:
                _teardown_migration_db(db_name)

    def test_migration_downgrade_removes_topic(self):
        """AC-1/AC-2: after downgrade -1, both the topic column and its index
        are gone.

        GIVEN  DB upgraded to wedge_01_02_culture_topic
        WHEN   alembic downgrade -1
        THEN   public.culture_questions does NOT have a "topic" column
               AND "ix_culture_questions_topic" does not exist
        """
        db_name = "test_wedge0102_downgrade_removes_topic"
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
            result = _run_alembic(["upgrade", _THIS_REVISION], db_url)
            assert result.returncode == 0, (
                f"alembic upgrade {_THIS_REVISION} failed:\n"
                f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
            )

            result = _run_alembic(["downgrade", "-1"], db_url)
            assert (
                result.returncode == 0
            ), f"alembic downgrade -1 failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"

            engine = _sync_engine(db_url)
            try:
                assert not _column_exists(
                    engine, "public", "culture_questions", "topic"
                ), "culture_questions.topic must NOT exist after alembic downgrade -1"
                index_cols_after = _get_index_columns(
                    engine, "public", "culture_questions", "ix_culture_questions_topic"
                )
                assert index_cols_after == [], (
                    "'ix_culture_questions_topic' must be gone after downgrade -1; "
                    f"found columns: {index_cols_after!r}"
                )
            finally:
                engine.dispose()

        finally:
            if setup_ok:
                _teardown_migration_db(db_name)
