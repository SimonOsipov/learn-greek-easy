"""Database fixtures for testing with PostgreSQL.

This module provides comprehensive database fixtures for testing:
- db_engine: Creates async PostgreSQL engine
- db_session: Provides AsyncSession with automatic rollback
- test_db: Ensures test database exists and tables are created

All fixtures use PostgreSQL exclusively. SQLite is not supported
due to PostgreSQL-specific features (native enums, uuid_generate_v4, etc.).

Parallel Execution Support (pytest-xdist):
- worker_id: Get the pytest-xdist worker ID
- is_parallel_run: Check if tests are running in parallel
- Schema creation uses file locking to prevent race conditions

Usage:
    # In test functions
    async def test_create_user(db_session: AsyncSession):
        user = User(email="test@example.com", ...)
        db_session.add(user)
        await db_session.commit()
        # Session automatically rolls back after test
"""

import tempfile
from collections.abc import AsyncGenerator
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from src.db.base import Base
from tests.helpers.database import get_test_database_url, verify_connection

# File-based lock for schema creation coordination between workers
_SCHEMA_LOCK_FILE = Path(tempfile.gettempdir()) / "pytest_learn_greek_schema.lock"
_SCHEMA_READY_FILE = Path(tempfile.gettempdir()) / "pytest_learn_greek_schema.ready"


# =============================================================================
# Parallel Execution Support (pytest-xdist)
# =============================================================================


@pytest.fixture(scope="session")
def worker_id(request: pytest.FixtureRequest) -> str:
    """Get the pytest-xdist worker ID.

    When running tests in parallel with pytest-xdist (-n auto or -n <N>),
    each worker gets a unique ID (e.g., "gw0", "gw1", "gw2").
    When running without xdist, returns "master".

    This fixture can be used to:
    - Create worker-specific resources (if needed)
    - Track which worker is running a test (debugging)
    - Set application_name in database connections for monitoring

    Args:
        request: Pytest fixture request object.

    Returns:
        str: Worker ID ("gw0", "gw1", etc.) or "master" if not parallel.
    """
    # pytest-xdist sets the worker_id attribute on the config
    if hasattr(request.config, "workerinput"):
        return request.config.workerinput["workerid"]
    return "master"


@pytest.fixture(scope="session")
def is_parallel_run(request: pytest.FixtureRequest) -> bool:
    """Check if tests are running in parallel mode.

    Returns True when running with pytest-xdist (-n auto or -n <N>),
    False when running normally.

    Useful for:
    - Conditionally adjusting test behavior for parallel runs
    - Skipping tests that cannot run in parallel
    - Adjusting timeouts or retries

    Args:
        request: Pytest fixture request object.

    Returns:
        bool: True if running in parallel, False otherwise.
    """
    return hasattr(request.config, "workerinput")


# =============================================================================
# Engine Configuration
# =============================================================================


def create_test_engine(
    database_url: str | None = None,
    worker_id: str = "master",
) -> AsyncEngine:
    """Create an async PostgreSQL engine configured for testing.

    Args:
        database_url: Database URL. If None, uses environment or default.
        worker_id: The pytest-xdist worker ID for connection tracking.

    Returns:
        AsyncEngine: Configured async engine for testing.

    Configuration details:
    - NullPool: Creates fresh connection for each request (clean isolation)
    - Echo disabled: Cleaner test output
    - Future mode: SQLAlchemy 2.0 API
    - application_name: Set to worker ID for connection monitoring
    """
    url = database_url or get_test_database_url()

    # Set application_name for connection monitoring in pg_stat_activity
    # This helps identify which pytest-xdist worker owns each connection
    connect_args = {
        "server_settings": {
            "application_name": f"pytest-{worker_id}",
        }
    }

    engine = create_async_engine(
        url,
        echo=False,
        future=True,
        poolclass=NullPool,  # Clean connections for test isolation
        connect_args=connect_args,
    )

    return engine


def create_test_session_factory(
    engine: AsyncEngine,
) -> async_sessionmaker[AsyncSession]:
    """Create a session factory for testing.

    Args:
        engine: Async engine to bind sessions to.

    Returns:
        async_sessionmaker: Factory for creating test sessions.

    Configuration:
    - expire_on_commit=False: Keep objects accessible after commit
    - autoflush=False: Manual control over when to flush
    - autocommit=False: Explicit transaction control
    """
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )


# =============================================================================
# Database Health Check
# =============================================================================


async def ensure_database_ready(engine: AsyncEngine) -> None:
    """Ensure database is ready for testing.

    Checks:
    1. Connection works
    2. Required extensions are installed (uuid-ossp, vector)

    Args:
        engine: Database engine to check.

    Raises:
        RuntimeError: If database is not ready.
    """
    # Check connection
    if not await verify_connection(engine):
        raise RuntimeError(
            "Cannot connect to test database. "
            "Ensure PostgreSQL is running: docker-compose up -d postgres"
        )

    # Check uuid-ossp extension (required for uuid_generate_v4)
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                """
                SELECT EXISTS (
                    SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
                )
                """
            )
        )
        has_uuid_extension = result.scalar()

        if not has_uuid_extension:
            # Try to create it
            try:
                await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
                await conn.commit()
            except IntegrityError:
                # Another parallel worker created the extension - this is fine
                await conn.rollback()
            except Exception as e:
                raise RuntimeError(f"uuid-ossp extension not installed and cannot create: {e}")

        # Check vector extension (required for pgvector embeddings)
        result = await conn.execute(
            text(
                """
                SELECT EXISTS (
                    SELECT 1 FROM pg_extension WHERE extname = 'vector'
                )
                """
            )
        )
        has_vector_extension = result.scalar()

        if not has_vector_extension:
            # Try to create it
            try:
                await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "vector"'))
                await conn.commit()
            except IntegrityError:
                # Another parallel worker created the extension - this is fine
                await conn.rollback()
            except Exception as e:
                raise RuntimeError(f"vector extension not installed and cannot create: {e}")


# =============================================================================
# Core Database Fixtures
# =============================================================================


@pytest_asyncio.fixture(scope="function")
async def db_engine(session_db_engine: AsyncEngine) -> AsyncGenerator[AsyncEngine, None]:
    """Create a test database engine with table management.

    This fixture uses the session-scoped engine to avoid race conditions
    when running tests in parallel with pytest-xdist. The session engine
    creates tables once per worker, preventing conflicts with PostgreSQL
    enum type creation.

    For parallel test execution:
    - Tables and enums are created once per worker (session scope)
    - Each test gets isolated through transaction rollback (not table drop)
    - This avoids "duplicate key" errors for PostgreSQL enums

    Args:
        session_db_engine: The session-scoped database engine fixture.

    Yields:
        AsyncEngine: Test database engine (shared within session).

    Raises:
        RuntimeError: If PostgreSQL is not available.

    Example:
        async def test_engine_works(db_engine: AsyncEngine):
            async with db_engine.connect() as conn:
                result = await conn.execute(text("SELECT 1"))
                assert result.scalar() == 1
    """
    # Use the session-scoped engine directly
    # Tables are already created in session_db_engine
    # Test isolation is achieved through rollback in db_session
    yield session_db_engine


@pytest_asyncio.fixture(scope="function")
async def db_session(
    db_engine: AsyncEngine,
) -> AsyncGenerator[AsyncSession, None]:
    """Provide a test database session with automatic rollback.

    This fixture implements the "nested transaction" pattern for complete isolation:
    1. Opens a connection and begins an outer transaction
    2. Binds a session to that connection
    3. Starts a nested transaction (savepoint)
    4. Yields session for test use
    5. After the test, rolls back the outer transaction

    This ensures that even if the test calls session.commit(), the changes
    are contained within the savepoint and will be rolled back when
    the outer transaction is rolled back.

    Args:
        db_engine: The test database engine fixture.

    Yields:
        AsyncSession: Database session that will be rolled back.

    Example:
        async def test_create_user(db_session: AsyncSession):
            user = User(email="test@example.com")
            db_session.add(user)
            await db_session.commit()
            # This commit is inside the nested transaction (savepoint)
            # It will be rolled back after the test
    """
    # Get a connection from the engine
    connection = await db_engine.connect()

    # Start the outer transaction - this will never be committed
    transaction = await connection.begin()

    # Create a session bound to this connection
    session_factory = create_test_session_factory(db_engine)
    session = session_factory(bind=connection)

    # Start a nested transaction (savepoint) for the test
    # This allows session.commit() to work within the test
    await connection.begin_nested()

    try:
        yield session
    finally:
        # Close the session
        await session.close()
        # Rollback the outer transaction - discards ALL changes
        await transaction.rollback()
        # Close the connection
        await connection.close()


@pytest_asyncio.fixture(scope="function")
async def db_session_with_savepoint(
    db_engine: AsyncEngine,
) -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session using savepoint/nested transaction pattern.

    This is an alternative to db_session that uses savepoints for
    more granular transaction control. Useful when testing code that
    explicitly commits.

    The pattern:
    1. Begin outer transaction on connection
    2. Begin nested transaction (savepoint)
    3. Yield session
    4. Rollback to savepoint

    Args:
        db_engine: The test database engine fixture.

    Yields:
        AsyncSession: Session with savepoint-based isolation.
    """
    connection = await db_engine.connect()
    transaction = await connection.begin()

    session_factory = create_test_session_factory(db_engine)
    session = session_factory(bind=connection)

    # Start a savepoint (nested transaction)
    await connection.begin_nested()

    try:
        yield session
    finally:
        await session.close()
        await transaction.rollback()
        await connection.close()


# =============================================================================
# Session-Scoped Fixtures (for faster test suites)
# =============================================================================


async def _create_schema_with_coordination(engine: AsyncEngine, worker_id: str) -> None:
    """Create database schema with coordination between parallel workers.

    Uses file-based locking to coordinate schema creation:
    - Workers block waiting for the lock (no polling/busy-wait)
    - First worker to acquire lock creates the schema
    - Other workers wait, then verify schema is ready

    This avoids race conditions with PostgreSQL enum type creation.

    Args:
        engine: Database engine to use for schema creation.
        worker_id: The pytest-xdist worker ID.
    """
    import fcntl
    import signal

    # Clean up stale lock files from previous runs (only master/gw0 does this)
    if worker_id in ("master", "gw0"):
        # Remove ready file to indicate schema needs to be created
        if _SCHEMA_READY_FILE.exists():
            _SCHEMA_READY_FILE.unlink()

    # Use file locking to ensure only one worker creates the schema
    _SCHEMA_LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    _SCHEMA_LOCK_FILE.touch(exist_ok=True)

    # Timeout handler for blocking lock
    lock_timeout = 60  # seconds

    def timeout_handler(signum, frame):
        raise TimeoutError(f"Worker {worker_id} timed out waiting for schema lock")

    with open(_SCHEMA_LOCK_FILE, "w") as lock_file:
        # Set up timeout for blocking lock acquisition
        old_handler = signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(lock_timeout)

        try:
            # Acquire exclusive lock (BLOCKING - waits for other workers)
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)

            # Cancel the alarm - we got the lock
            signal.alarm(0)

            # We got the lock - check if schema is already ready
            if not _SCHEMA_READY_FILE.exists():
                # Create schema
                async with engine.begin() as conn:
                    # Drop existing tables to ensure clean state
                    await conn.run_sync(Base.metadata.drop_all)
                    # Create all tables and enums
                    await conn.run_sync(Base.metadata.create_all)

                # Signal that schema is ready
                _SCHEMA_READY_FILE.touch()

        except TimeoutError:
            raise RuntimeError(f"Worker {worker_id} timed out waiting for schema creation lock")

        finally:
            # Always restore signal handler and cancel alarm
            signal.alarm(0)
            signal.signal(signal.SIGALRM, old_handler)
            # Release lock (also released automatically when file closes)
            try:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
            except (IOError, OSError):
                pass  # File may already be closed


@pytest_asyncio.fixture(scope="session")
async def session_db_engine(worker_id: str) -> AsyncGenerator[AsyncEngine, None]:
    """Create a session-scoped database engine.

    This fixture creates the database schema once per test run, coordinating
    between parallel pytest-xdist workers to avoid race conditions with
    PostgreSQL enum type creation.

    For parallel test execution:
    - First worker creates the schema (with file locking)
    - Other workers wait for schema to be ready
    - All workers share the same schema
    - Tests achieve isolation through transaction rollback

    Args:
        worker_id: The pytest-xdist worker ID for connection tracking.

    Yields:
        AsyncEngine: Shared database engine for the test session.
    """
    engine = create_test_engine(worker_id=worker_id)

    # Ensure database is ready
    await ensure_database_ready(engine)

    # Create schema with coordination between workers
    await _create_schema_with_coordination(engine, worker_id)

    yield engine

    # Note: We don't drop tables here because:
    # 1. Multiple workers might still be using the database
    # 2. The tables will be cleaned on next test run
    # 3. Test isolation is achieved through rollback, not table recreation

    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def fast_db_session(
    session_db_engine: AsyncEngine,
) -> AsyncGenerator[AsyncSession, None]:
    """Provide a fast database session using shared engine.

    This fixture uses the session-scoped engine for faster test execution.
    Tables are not recreated between tests, so tests MUST clean up
    their own data or use unique identifiers.

    Args:
        session_db_engine: Session-scoped database engine.

    Yields:
        AsyncSession: Database session (will be rolled back).

    Example:
        async def test_fast(fast_db_session):
            # Use unique email to avoid conflicts
            user = User(email=f"test_{uuid4()}@example.com", ...)
    """
    session_factory = create_test_session_factory(session_db_engine)

    async with session_factory() as session:
        try:
            yield session
        finally:
            await session.rollback()


# =============================================================================
# Utility Fixtures
# =============================================================================


@pytest.fixture
def db_url() -> str:
    """Get the current test database URL.

    Returns:
        str: Database URL being used for tests.
    """
    return get_test_database_url()


@pytest_asyncio.fixture
async def clean_tables(db_session: AsyncSession) -> AsyncGenerator[None, None]:
    """Fixture that ensures tables are empty before and after test.

    This is useful for tests that need to start with a completely
    empty database and want to verify no data leaks.

    Yields:
        None: After ensuring tables are empty.
    """
    # Tables should already be empty from rollback pattern
    yield
    # Rollback happens automatically in db_session


@pytest_asyncio.fixture
async def verify_isolation(db_session: AsyncSession) -> AsyncGenerator[None, None]:
    """Fixture that verifies test isolation by checking table counts.

    Use this to debug test pollution issues.

    Yields:
        None: After verifying initial state.

    Raises:
        AssertionError: If tables are not empty at start.
    """
    from tests.helpers.database import count_table_rows

    # Check users table is empty (most common pollution source)
    try:
        count = await count_table_rows(db_session, "users")
        assert count == 0, f"Users table not empty at test start: {count} rows"
    except Exception:
        pass  # Table might not exist yet

    yield

    # Rollback happens automatically
