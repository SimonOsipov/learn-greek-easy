#!/usr/bin/env python3
"""Verify database fixtures are working correctly with PostgreSQL.

This script tests:
1. PostgreSQL connection
2. Test database exists
3. Required extensions are installed
4. Table creation/teardown
5. Session management
6. Test isolation

Run:
    cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && \
    /Users/samosipov/.local/bin/poetry run python scripts/verify_database_fixtures.py
"""

import asyncio
import subprocess
import sys
from uuid import uuid4


def print_header(text: str) -> None:
    """Print a section header."""
    print()
    print("=" * 70)
    print(text)
    print("=" * 70)


def print_result(check: str, passed: bool, details: str = "") -> None:
    """Print a check result."""
    status = "[PASS]" if passed else "[FAIL]"
    print(f"  {status} {check}")
    if details:
        print(f"         {details}")


async def main() -> int:
    """Run all verification checks."""
    print_header("DATABASE FIXTURES VERIFICATION (PostgreSQL)")
    print()
    print("This script verifies the test database infrastructure is working.")
    print("Note: PostgreSQL must be running (docker-compose up -d postgres)")
    print()

    all_passed = True

    # Check 1: Import fixtures
    print_header("Check 1: Import Database Fixtures")
    try:
        from tests.fixtures.database import (
            create_test_engine,
            create_test_session_factory,
        )
        from tests.helpers.database import (
            count_table_rows,
            get_test_database_url,
            verify_connection,
            verify_extensions,
        )

        print_result("Import fixtures", True)
    except ImportError as e:
        print_result("Import fixtures", False, str(e))
        all_passed = False
        return 1

    # Check 2: Test database URL configuration
    print_header("Check 2: Database URL Configuration")
    url = get_test_database_url()
    print_result(
        "Get test URL", True, f"URL: ...{url.split('@')[1] if '@' in url else url}"
    )

    if "postgresql" in url:
        print_result("PostgreSQL detected", True)
    else:
        print_result("PostgreSQL detected", False, f"Unexpected: {url}")
        all_passed = False
        return 1

    if "test_learn_greek" in url:
        print_result("Test database name", True)
    else:
        print_result("Test database name", False, "Expected 'test_learn_greek'")
        all_passed = False

    # Check 3: Create engine and verify connection
    print_header("Check 3: Create Test Engine")
    try:
        engine = create_test_engine()
        print_result("Create engine", True, f"Dialect: {engine.dialect.name}")

        if await verify_connection(engine):
            print_result("Database connection", True)
        else:
            print_result("Database connection", False, "Cannot connect to database")
            print()
            print("  HINT: Ensure PostgreSQL is running:")
            print("    docker-compose up -d postgres")
            print()
            print("  HINT: Create test database if needed:")
            print(
                '    docker exec learn-greek-postgres psql -U postgres -c "CREATE DATABASE test_learn_greek;"'
            )
            all_passed = False
            return 1

    except Exception as e:
        print_result("Create engine", False, str(e))
        all_passed = False
        return 1

    # Check 4: Verify extensions
    print_header("Check 4: Verify PostgreSQL Extensions")
    try:
        extensions = await verify_extensions(engine)
        for ext, installed in extensions.items():
            print_result(f"Extension: {ext}", installed)
            if not installed and ext == "uuid-ossp":
                print("  HINT: Create extension:")
                print(
                    '    docker exec learn-greek-postgres psql -U postgres -d test_learn_greek -c "CREATE EXTENSION IF NOT EXISTS \\"uuid-ossp\\";"'
                )
                all_passed = False
    except Exception as e:
        print_result("Check extensions", False, str(e))
        all_passed = False

    # Check 5: Create tables
    print_header("Check 5: Create Tables")
    try:
        from src.db.base import Base

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print_result("Create tables", True)
    except Exception as e:
        print_result("Create tables", False, str(e))
        all_passed = False

    # Check 6: Create session and insert data
    print_header("Check 6: Session Operations")
    try:
        session_factory = create_test_session_factory(engine)
        async with session_factory() as session:
            print_result("Create session", True)

            # Execute simple query
            from sqlalchemy import text

            result = await session.execute(text("SELECT 1"))
            assert result.scalar() == 1
            print_result("Execute query", True)

            # Insert and query user
            from src.db.models import User

            user = User(
                email=f"verify_test_{uuid4().hex[:8]}@example.com",
                password_hash="hashed_password",
                full_name="Verify Test User",
                is_active=True,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            print_result("Insert user", True, f"User ID: {user.id}")

            # Count rows
            count = await count_table_rows(session, "users")
            print_result("Count rows", True, f"Users: {count}")

    except Exception as e:
        print_result("Session operations", False, str(e))
        all_passed = False

    # Check 7: Drop tables
    print_header("Check 7: Drop Tables")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        print_result("Drop tables", True)
    except Exception as e:
        print_result("Drop tables", False, str(e))
        all_passed = False

    # Check 8: Dispose engine
    print_header("Check 8: Dispose Engine")
    try:
        await engine.dispose()
        print_result("Dispose engine", True)
    except Exception as e:
        print_result("Dispose engine", False, str(e))
        all_passed = False

    # Check 9: Run actual fixture tests
    print_header("Check 9: Run Database Fixture Tests")
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/unit/test_database_fixtures.py",
            "-v",
            "--tb=short",
            "-q",
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        lines = result.stdout.split("\n")
        for line in lines:
            if "passed" in line:
                print_result("Run fixture tests", True, line.strip())
                break
    else:
        print_result("Run fixture tests", False)
        print("Output:")
        print(result.stdout)
        print(result.stderr)
        all_passed = False

    # Summary
    print_header("VERIFICATION SUMMARY")
    if all_passed:
        print()
        print("  ALL CHECKS PASSED!")
        print()
        print("  Database fixtures are properly configured:")
        print("  - PostgreSQL connection works")
        print("  - Test database (test_learn_greek) accessible")
        print("  - Required extensions installed (uuid-ossp)")
        print("  - Table creation/teardown works")
        print("  - Session management works")
        print("  - All fixture tests pass")
        print()
        return 0
    else:
        print()
        print("  SOME CHECKS FAILED!")
        print()
        print("  Common fixes:")
        print("  1. Start PostgreSQL: docker-compose up -d postgres")
        print(
            '  2. Create test database: docker exec learn-greek-postgres psql -U postgres -c "CREATE DATABASE test_learn_greek;"'
        )
        print(
            '  3. Create extension: docker exec learn-greek-postgres psql -U postgres -d test_learn_greek -c "CREATE EXTENSION IF NOT EXISTS \\"uuid-ossp\\";"'
        )
        print()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
