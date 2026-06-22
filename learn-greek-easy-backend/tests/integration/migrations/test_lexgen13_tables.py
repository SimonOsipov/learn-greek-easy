"""Integration migration tests for LEXGEN-13-01: review_log & proposal_attempt tables.

Mode A — RED spec (Alembic round-trip).

BACKGROUND
----------
The LEXGEN-13-01 migration creates two new tables in the public schema:

    public.word_proposal_review_log   — per-field reviewer decision log
    public.proposal_attempt           — snapshot of a single pipeline run

The migration MUST have:

    revision      = "lexgen13_review_tables"
    down_revision = "lexgen09_generated_content"   ← verified current head

IMPORTANT — MEMORY LESSON (LEXGEN-05 / LEXGEN-09):
    Round-trip tests pin to THIS migration's own revision id
    ("lexgen13_review_tables"), NOT to "head".  Pinning to "head" means a
    future successor migration would break the downgrade -1 assertion.
    The executor MUST set the migration file's revision to exactly
    "lexgen13_review_tables" so this test works.

WHAT THE ROUND-TRIP VERIFIES (AC-5)
-------------------------------------
After ``alembic upgrade lexgen13_review_tables``:
    - public.word_proposal_review_log exists with all required columns
    - public.proposal_attempt exists with all required columns
    - proposal_id indexes exist on both tables

After ``alembic downgrade -1``:
    - both tables are gone

AC-6: SINGLE ALEMBIC HEAD
--------------------------
After all migrations are applied there is exactly one head in the Alembic
revision map.  A split head (two competing tails) causes upgrade/downgrade
ambiguity and fails CI.

HOW THESE TESTS WORK
---------------------
Each test spins up an isolated PG database, applies all Alembic migrations
up to the LEXGEN-13-01 revision via subprocess, verifies the schema via
information_schema, then downgrades and verifies the tables are gone.

The isolated-DB pattern is identical to test_lexgen_09_generated_content.py.
Each test creates its own DB and drops it in a finally block.

CONTAINER IMAGE
---------------
Requires ``pgvector/pgvector:pg17`` on localhost:5433.

CI BEHAVIOUR
------------
These tests carry ``pytest.mark.integration`` and ``pytest.mark.db``.
In CI the test DB port 5433 is not available during unit-test runs → the
tests skip via ``pytest.skip()`` in ``_setup_migration_db``.

EXPECTED RED FAILURE MODE (before executor creates the migration)
-----------------------------------------------------------------
``alembic upgrade lexgen13_review_tables`` fails with:
    "Can't locate revision identified by 'lexgen13_review_tables'"
→ alembic returncode != 0 → AssertionError in the test.

After the executor creates the migration with
``revision="lexgen13_review_tables"`` the test goes GREEN.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

# ---------------------------------------------------------------------------
# Markers — all tests in this file require a real PG on :5433
# ---------------------------------------------------------------------------

pytestmark = [
    pytest.mark.integration,
    pytest.mark.db,
]

# ---------------------------------------------------------------------------
# Override the integration conftest's autouse async fixture
# (same pattern as test_lexgen_09_generated_content.py)
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def bind_factory_session():  # noqa: PT004 — override conftest's async autouse fixture
    """No-op override of the integration conftest's async autouse fixture.

    This migration test is fully synchronous (psycopg2 + Alembic subprocess) and
    needs no async DB session; overriding the conftest's autouse async bind avoids
    a MissingGreenlet in the full xdist suite.
    """
    yield


# ---------------------------------------------------------------------------
# Constants / paths
# ---------------------------------------------------------------------------

# Planned revision id — the executor MUST use this exact string.
_THIS_REVISION = "lexgen13_review_tables"

_BACKEND_DIR = Path(__file__).parent.parent.parent.parent  # learn-greek-easy-backend/

# DB-unreachable errors that justify a skip.
_DB_UNREACHABLE_ERRORS = (OperationalError, ConnectionError)


def _coerce_to_psycopg2(url: str) -> str:
    """Force a SQLAlchemy URL onto the synchronous psycopg2 driver."""
    if url.startswith("postgresql+asyncpg://"):
        return "postgresql+psycopg2://" + url[len("postgresql+asyncpg://") :]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg2://" + url[len("postgresql://") :]
    return url


_BASE_DB_URL = _coerce_to_psycopg2(
    os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@localhost:5433/test_learn_greek",
    )
)

_ADMIN_DB_URL = _BASE_DB_URL.rsplit("/", 1)[0] + "/postgres"


# ---------------------------------------------------------------------------
# Helpers (mirrors test_lexgen_09_generated_content.py pattern exactly)
# ---------------------------------------------------------------------------


def _replace_db_in_url(url: str, new_db_name: str) -> str:
    return url.rsplit("/", 1)[0] + "/" + new_db_name


def _sync_engine(url: str) -> Engine:
    return create_engine(url, isolation_level="AUTOCOMMIT")


def _run_alembic(command: list[str], db_url: str) -> subprocess.CompletedProcess:
    """Run an alembic sub-command against *db_url* in the backend directory."""
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


def _table_exists(engine: Engine, schema: str, table: str) -> bool:
    """Return True if schema.table exists in information_schema.tables."""
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


def _column_exists(engine: Engine, schema: str, table: str, column: str) -> bool:
    """Return True if schema.table.column exists in information_schema.columns."""
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


def _index_exists(engine: Engine, schema: str, table: str, index_name_fragment: str) -> bool:
    """Return True if any index on schema.table contains index_name_fragment."""
    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT 1
                FROM pg_indexes
                WHERE schemaname = :schema
                  AND tablename  = :table
                  AND indexname ILIKE :fragment
                """
            ),
            {"schema": schema, "table": table, "fragment": f"%{index_name_fragment}%"},
        ).fetchone()
    return row is not None


# ---------------------------------------------------------------------------
# AC-5: Upgrade / downgrade round-trip
# ---------------------------------------------------------------------------


class TestLexgen13MigrationRoundTrip:
    """AC-5: Upgrade to lexgen13_review_tables creates both tables; downgrade -1 drops them."""

    def test_migration_upgrade_downgrade_roundtrip(self):
        """AC-5: Full Alembic round-trip for LEXGEN-13-01.

        GIVEN  DB at lexgen09_generated_content (no review tables)
        WHEN   alembic upgrade lexgen13_review_tables
        THEN   word_proposal_review_log and proposal_attempt exist
               AND proposal_id indexes exist on both tables
        WHEN   alembic downgrade -1
        THEN   both tables do NOT exist

        Pin: uses revision "lexgen13_review_tables" NOT "head" (MEMORY lesson
        from LEXGEN-05/09: future successors must not break this round-trip).
        """
        db_name = "test_lexgen13_review_tables"
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
            result = _run_alembic(["upgrade", _THIS_REVISION], db_url)
            assert result.returncode == 0, (
                f"alembic upgrade {_THIS_REVISION} failed:\n"
                f"STDOUT:\n{result.stdout}\n"
                f"STDERR:\n{result.stderr}"
            )

            engine = _sync_engine(db_url)
            try:
                # AC-5a: both tables exist
                assert _table_exists(engine, "public", "word_proposal_review_log"), (
                    "word_proposal_review_log must exist after " f"alembic upgrade {_THIS_REVISION}"
                )
                assert _table_exists(
                    engine, "public", "proposal_attempt"
                ), f"proposal_attempt must exist after alembic upgrade {_THIS_REVISION}"

                # AC-5b: key columns present on word_proposal_review_log
                for col in ("id", "proposal_id", "action", "reviewer_id", "created_at"):
                    assert _column_exists(
                        engine, "public", "word_proposal_review_log", col
                    ), f"word_proposal_review_log.{col} must exist after upgrade"

                # AC-5c: key columns present on proposal_attempt
                for col in (
                    "id",
                    "proposal_id",
                    "attempt_no",
                    "generated_content",
                    "generated_fields",
                    "reconciliation_log",
                    "judge_scores",
                    "flagged_fields",
                    "created_at",
                ):
                    assert _column_exists(
                        engine, "public", "proposal_attempt", col
                    ), f"proposal_attempt.{col} must exist after upgrade"

                # AC-5d: proposal_id indexes exist on both tables
                assert _index_exists(
                    engine, "public", "word_proposal_review_log", "proposal_id"
                ), "An index on word_proposal_review_log.proposal_id must exist after upgrade"
                assert _index_exists(
                    engine, "public", "proposal_attempt", "proposal_id"
                ), "An index on proposal_attempt.proposal_id must exist after upgrade"

            finally:
                engine.dispose()

            # ---- DOWNGRADE ----
            result = _run_alembic(["downgrade", "-1"], db_url)
            assert result.returncode == 0, (
                f"alembic downgrade -1 failed:\n"
                f"STDOUT:\n{result.stdout}\n"
                f"STDERR:\n{result.stderr}"
            )

            engine = _sync_engine(db_url)
            try:
                # AC-5e: both tables gone after downgrade
                assert not _table_exists(
                    engine, "public", "word_proposal_review_log"
                ), "word_proposal_review_log must NOT exist after alembic downgrade -1"
                assert not _table_exists(
                    engine, "public", "proposal_attempt"
                ), "proposal_attempt must NOT exist after alembic downgrade -1"
            finally:
                engine.dispose()

        finally:
            if setup_ok:
                _teardown_migration_db(db_name)


# ---------------------------------------------------------------------------
# AC-6: Exactly one Alembic head
# ---------------------------------------------------------------------------


class TestSingleAlembicHead:
    """AC-6: After applying all migrations there is exactly one Alembic head.

    A split head means two migrations both claim to be the chain tip, causing
    ambiguous ``alembic upgrade head`` and CI failures.

    EXPECTED RED TODAY:
    The lexgen13_review_tables migration file does not exist yet.
    Running ``alembic upgrade head`` followed by ``alembic heads`` will list
    only the existing head (lexgen09_generated_content).  The assertion
    "word_proposal_review_log must exist" will fail (AC-5 RED), not this test.
    This test goes RED once the executor creates the migration file with an
    incorrect down_revision that creates a branch, OR goes GREEN immediately
    if the executor sets down_revision = "lexgen09_generated_content" correctly.

    In practice this test mainly guards against accidental branch points at
    review time, not as a RED spec — it is complementary to AC-5.
    """

    def test_single_alembic_head(self):
        """After upgrading to head, Alembic reports exactly one head revision."""
        db_name = "test_lexgen13_single_head"
        setup_ok = False
        try:
            db_url = _setup_migration_db(db_name)
            setup_ok = True
        except _DB_UNREACHABLE_ERRORS as exc:
            pytest.skip(
                f"Cannot create isolated migration DB '{db_name}': {exc}. "
                "Requires a reachable PostgreSQL on localhost:5433."
            )

        try:
            # Upgrade all the way to head
            result = _run_alembic(["upgrade", "head"], db_url)
            assert result.returncode == 0, (
                f"alembic upgrade head failed:\n"
                f"STDOUT:\n{result.stdout}\n"
                f"STDERR:\n{result.stderr}"
            )

            # Ask Alembic how many heads exist (must be exactly 1)
            result = _run_alembic(["heads"], db_url)
            assert result.returncode == 0, (
                f"alembic heads failed:\n" f"STDOUT:\n{result.stdout}\n" f"STDERR:\n{result.stderr}"
            )
            head_lines = [
                line.strip()
                for line in result.stdout.splitlines()
                if line.strip() and "(head)" in line
            ]
            assert len(head_lines) == 1, (
                f"Expected exactly 1 Alembic head, got {len(head_lines)}: "
                f"{head_lines}\n"
                "A split head means two migrations compete for the chain tip — "
                "fix by setting down_revision = 'lexgen09_generated_content' "
                "on the LEXGEN-13-01 migration."
            )

            # Also confirm the new tables are actually present (AC-6 + AC-5 combined)
            engine = _sync_engine(db_url)
            try:
                assert _table_exists(
                    engine, "public", "word_proposal_review_log"
                ), "word_proposal_review_log must exist after upgrade head"
                assert _table_exists(
                    engine, "public", "proposal_attempt"
                ), "proposal_attempt must exist after upgrade head"
            finally:
                engine.dispose()

        finally:
            if setup_ok:
                _teardown_migration_db(db_name)
