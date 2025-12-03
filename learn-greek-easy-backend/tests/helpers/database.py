"""Database test utilities and helpers for PostgreSQL.

This module provides utility functions for database testing:
- Test database URL configuration
- Database state inspection utilities
- Connection testing helpers
- Test data timestamp utilities

Note: This project uses PostgreSQL exclusively for all tests.
      SQLite is not supported due to PostgreSQL-specific features
      (native enums, uuid_generate_v4, etc.).
"""

import os
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

# =============================================================================
# Test Database URL Configuration
# =============================================================================

# Default test database URL (PostgreSQL only)
# Port 5433 is the mapped host port from docker-compose (5433:5432)
DEFAULT_TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5433/test_learn_greek"


def get_test_database_url() -> str:
    """Get the test database URL.

    Priority:
    1. TEST_DATABASE_URL environment variable (if set)
    2. Default PostgreSQL test database URL

    Returns:
        str: PostgreSQL database URL for testing.

    Example:
        >>> url = get_test_database_url()
        >>> url.startswith("postgresql")
        True
    """
    return os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_DATABASE_URL)


# =============================================================================
# Database State Utilities
# =============================================================================


async def count_table_rows(session: AsyncSession, table_name: str) -> int:
    """Count rows in a table.

    Useful for verifying test data setup/cleanup.

    Args:
        session: Database session.
        table_name: Name of the table to count.

    Returns:
        int: Number of rows in the table.
    """
    result = await session.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
    return result.scalar() or 0


async def table_exists(session: AsyncSession, table_name: str) -> bool:
    """Check if a table exists in the database.

    Args:
        session: Database session.
        table_name: Name of the table to check.

    Returns:
        bool: True if table exists, False otherwise.
    """
    result = await session.execute(
        text(
            """
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = :table_name
            )
            """
        ),
        {"table_name": table_name},
    )
    return result.scalar() or False


async def clear_table(session: AsyncSession, table_name: str) -> None:
    """Delete all rows from a table using TRUNCATE.

    WARNING: Use with caution. Only for test cleanup.
    Uses TRUNCATE for better performance with PostgreSQL.

    Args:
        session: Database session.
        table_name: Name of the table to clear.
    """
    await session.execute(text(f"TRUNCATE TABLE {table_name} CASCADE"))
    await session.commit()


async def get_table_names(engine: AsyncEngine) -> list[str]:
    """Get all table names in the database.

    Args:
        engine: Database engine.

    Returns:
        list[str]: List of table names.
    """
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            )
        )
        return [row[0] for row in result.fetchall()]


# =============================================================================
# Connection Testing
# =============================================================================


async def verify_connection(engine: AsyncEngine) -> bool:
    """Verify that database connection works.

    Args:
        engine: Database engine to test.

    Returns:
        bool: True if connection successful, False otherwise.
    """
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


async def verify_extensions(engine: AsyncEngine) -> dict[str, bool]:
    """Verify required PostgreSQL extensions are installed.

    Args:
        engine: Database engine.

    Returns:
        dict: Extension name to installed status mapping.
    """
    extensions_to_check = ["uuid-ossp", "pg_stat_statements"]
    results = {}

    async with engine.connect() as conn:
        for ext in extensions_to_check:
            result = await conn.execute(
                text(
                    """
                    SELECT EXISTS (
                        SELECT 1 FROM pg_extension WHERE extname = :ext
                    )
                    """
                ),
                {"ext": ext},
            )
            results[ext] = result.scalar() or False

    return results


async def get_database_info(engine: AsyncEngine) -> dict[str, Any]:
    """Get information about the database connection.

    Args:
        engine: Database engine.

    Returns:
        dict: Database information including version, extensions, etc.
    """
    info: dict[str, Any] = {
        "dialect": engine.dialect.name,
        "driver": engine.dialect.driver,
    }

    async with engine.connect() as conn:
        # Get PostgreSQL version
        result = await conn.execute(text("SELECT version()"))
        info["version"] = result.scalar()

        # Get database name
        result = await conn.execute(text("SELECT current_database()"))
        info["database"] = result.scalar()

        # Get extensions
        info["extensions"] = await verify_extensions(engine)

    return info


# =============================================================================
# Test Data Timestamps
# =============================================================================


def utc_now() -> datetime:
    """Get current UTC datetime for test data.

    Returns:
        datetime: Current UTC datetime.
    """
    return datetime.utcnow()


def days_ago(days: int) -> datetime:
    """Get datetime for N days ago.

    Args:
        days: Number of days ago.

    Returns:
        datetime: Datetime for N days ago.
    """
    return datetime.utcnow() - timedelta(days=days)


def days_from_now(days: int) -> datetime:
    """Get datetime for N days from now.

    Args:
        days: Number of days from now.

    Returns:
        datetime: Datetime for N days from now.
    """
    return datetime.utcnow() + timedelta(days=days)


# =============================================================================
# PostgreSQL-Specific Utilities
# =============================================================================


async def reset_sequences(session: AsyncSession, table_name: str) -> None:
    """Reset auto-increment sequences for a table.

    Note: Not typically needed for UUID primary keys, but useful
    for tables with serial columns.

    Args:
        session: Database session.
        table_name: Name of the table.
    """
    await session.execute(
        text(
            f"""
            SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), 1, false)
            WHERE pg_get_serial_sequence('{table_name}', 'id') IS NOT NULL
            """
        )
    )


async def get_enum_values(session: AsyncSession, enum_name: str) -> list[str]:
    """Get values for a PostgreSQL enum type.

    Args:
        session: Database session.
        enum_name: Name of the enum type.

    Returns:
        list[str]: List of enum values.
    """
    result = await session.execute(
        text(
            """
            SELECT enumlabel FROM pg_enum
            WHERE enumtypid = (
                SELECT oid FROM pg_type WHERE typname = :enum_name
            )
            ORDER BY enumsortorder
            """
        ),
        {"enum_name": enum_name},
    )
    return [row[0] for row in result.fetchall()]
