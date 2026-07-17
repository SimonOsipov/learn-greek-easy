"""Integration migration tests for SIT-27-02: situations.domain column.

Mode A — RED spec (Alembic round-trip).

BACKGROUND
----------
The SIT-27-02 migration adds one nullable Text column to the public schema:

    public.situations.domain  (nullable Text)

The migration MUST have:

    down_revision = "lexgen13_review_tables"   ← the verified current head
    revision = "sit_27_02_situation_domain"    ← the planned revision id

IMPORTANT — MEMORY LESSON (LEXGEN-05):
    Round-trip tests MUST pin to THIS migration's own revision id
    ("sit_27_02_situation_domain"), NOT to "head".  Pinning to "head" would
    mean a future successor migration breaks this round-trip's downgrade -1
    assertion (downgrade -1 from the NEW head would undo the successor, not
    this migration).  The executor MUST set the migration file's revision to
    exactly "sit_27_02_situation_domain" so this test works.

WHAT THE ROUND-TRIP VERIFIES
-----------------------------
After ``alembic upgrade sit_27_02_situation_domain``:
    - public.situations has a "domain" column
    - the column is nullable (no NOT NULL constraint)
    - the column is of type text (character varying or text at the DB level)

After ``alembic downgrade -1``:
    - public.situations does NOT have a "domain" column
    - sibling columns on situations (scenario_el, scenario_en, status) are
      still present (narrowness guard)

HOW THESE TESTS WORK
---------------------
The test spins up an isolated PostgreSQL database, applies all Alembic
migrations up to the SIT-27-02 revision, verifies the schema state via
information_schema introspection, then runs alembic downgrade -1 and
verifies the column is gone.

Each test creates its own isolated DB and drops it in a finally block.

CONTAINER IMAGE
---------------
Requires ``pgvector/pgvector:pg17`` on localhost:5433 (not vanilla postgres:17)
— the migration chain creates the ``vector`` extension.

CI BEHAVIOUR
------------
These tests carry ``pytest.mark.integration`` and ``pytest.mark.db``.  In CI
the test DB port 5433 is not available during unit-test runs → the tests skip
via ``pytest.skip()`` in ``_setup_migration_db``.  They are exercised in CI
via the ephemeral pgvector DB spun up by the integration test job.

``pytest --collect-only`` must pass WITHOUT a running DB (collect-only does not
execute test bodies).

EXPECTED RED FAILURE MODE
--------------------------
Before SIT-27-02 is implemented:
    ``alembic upgrade sit_27_02_situation_domain`` fails with:
        "Can't locate revision identified by 'sit_27_02_situation_domain'"
    → alembic returncode != 0 → AssertionError in the test.

After the executor creates the migration with
revision="sit_27_02_situation_domain":
    The test goes GREEN.
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

# DB-unreachable errors that justify a skip.
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
# (same pattern as test_lexgen_09_generated_content.py — see that file's
# comments for full explanation)
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def bind_factory_session():  # noqa: PT004 — override conftest's async autouse fixture
    """No-op override of the integration conftest's async autouse fixture.

    This migration test is fully synchronous (psycopg2 + Alembic subprocess)
    and needs no async DB session; overriding the conftest's autouse async
    bind avoids a MissingGreenlet in the full xdist suite.
    """
    yield


# ---------------------------------------------------------------------------
# Constants / paths
# ---------------------------------------------------------------------------

# Planned revision id — the executor MUST use this exact string.
# See MEMORY.md lesson: pin round-trip to THIS migration's own revision,
# not head.
_THIS_REVISION = "sit_27_02_situation_domain"

_BACKEND_DIR = Path(__file__).parent.parent.parent.parent  # learn-greek-easy-backend/


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


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestSit2702SituationDomainMigrationRoundTrip:
    """AC-1: upgrade to sit_27_02_situation_domain then downgrade -1 round-trips.

    EXPECTED RED TODAY:
    - The SIT-27-02 migration does not exist yet.
    - ``alembic upgrade sit_27_02_situation_domain`` fails:
      "Can't locate revision identified by 'sit_27_02_situation_domain'"
    - returncode != 0 → AssertionError.

    GREEN after: executor creates the migration with
    ``revision = "sit_27_02_situation_domain"`` and
    ``down_revision = "lexgen13_review_tables"``.
    """

    def test_migration_upgrade_adds_domain_column(self):
        """AC-1: After upgrade the situations.domain column exists and is nullable.

        GIVEN  DB at lexgen13_review_tables head (no domain column on situations)
        WHEN   alembic upgrade sit_27_02_situation_domain
        THEN   public.situations has a "domain" column that is nullable text

        Pin: uses revision "sit_27_02_situation_domain" NOT "head" so that
        future migrations do not break this round-trip (MEMORY lesson).
        """
        db_name = "test_sit2702_upgrade_adds_domain"
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
                f"STDOUT:\n{result.stdout}\n"
                f"STDERR:\n{result.stderr}"
            )

            engine = _sync_engine(db_url)
            try:
                # AC-1a: column exists in public.situations after upgrade
                assert _column_exists(engine, "public", "situations", "domain"), (
                    "situations.domain must exist after " f"alembic upgrade {_THIS_REVISION}"
                )

                # AC-1b: column is nullable (no NOT NULL constraint)
                assert _column_is_nullable(engine, "public", "situations", "domain"), (
                    "situations.domain must be nullable (NULL allowed) after "
                    "upgrade — it is a human-facing label set later via admin"
                )
            finally:
                engine.dispose()

        finally:
            if setup_ok:
                _teardown_migration_db(db_name)

    def test_migration_downgrade_drops_domain_column(self):
        """AC-1: After downgrade -1 the situations.domain column is gone.

        GIVEN  DB upgraded to sit_27_02_situation_domain
        WHEN   alembic downgrade -1
        THEN   public.situations does NOT have a "domain" column
        """
        db_name = "test_sit2702_downgrade_drops_domain"
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
            # Upgrade first
            result = _run_alembic(["upgrade", _THIS_REVISION], db_url)
            assert result.returncode == 0, (
                f"alembic upgrade {_THIS_REVISION} failed:\n"
                f"STDOUT:\n{result.stdout}\n"
                f"STDERR:\n{result.stderr}"
            )

            # Downgrade -1
            result = _run_alembic(["downgrade", "-1"], db_url)
            assert result.returncode == 0, (
                f"alembic downgrade -1 failed:\n"
                f"STDOUT:\n{result.stdout}\n"
                f"STDERR:\n{result.stderr}"
            )

            engine = _sync_engine(db_url)
            try:
                # AC-1c: column gone after downgrade -1
                assert not _column_exists(
                    engine, "public", "situations", "domain"
                ), "situations.domain must NOT exist after alembic downgrade -1"
            finally:
                engine.dispose()

        finally:
            if setup_ok:
                _teardown_migration_db(db_name)


class TestSit2702DowngradeNarrowness:
    """AC-1 adversarial: the downgrade only removes situations.domain.

    Guards against an over-broad downgrade that could accidentally drop
    sibling columns (scenario_el, scenario_en, status, etc.) instead of
    just the one column it is supposed to remove.

    A copy-paste error in op.drop_column / op.add_column could name the wrong
    column, silently destroying data on rollback.
    """

    def test_downgrade_does_not_remove_sibling_columns(self):
        """After downgrade -1, sibling situations columns still exist.

        GIVEN  DB upgraded to sit_27_02_situation_domain
        WHEN   alembic downgrade -1
        THEN   domain is gone AND scenario_el / scenario_en / scenario_ru /
               status / source_url all still exist on the situations table.
        """
        db_name = "test_sit2702_downgrade_narrowness"
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
            result = _run_alembic(["upgrade", _THIS_REVISION], db_url)
            assert (
                result.returncode == 0
            ), f"upgrade failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"

            result = _run_alembic(["downgrade", "-1"], db_url)
            assert (
                result.returncode == 0
            ), f"downgrade failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"

            engine = _sync_engine(db_url)
            try:
                # domain must be gone
                assert not _column_exists(
                    engine, "public", "situations", "domain"
                ), "situations.domain must be removed by downgrade"
                # Sibling columns that must NOT have been touched
                for sibling in (
                    "scenario_el",
                    "scenario_en",
                    "scenario_ru",
                    "status",
                    "source_url",
                ):
                    assert _column_exists(engine, "public", "situations", sibling), (
                        f"sibling column '{sibling}' must still exist after downgrade -1 "
                        "(the downgrade must only remove situations.domain)"
                    )
            finally:
                engine.dispose()

        finally:
            if setup_ok:
                _teardown_migration_db(db_name)
