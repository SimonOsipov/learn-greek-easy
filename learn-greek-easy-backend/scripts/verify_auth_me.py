#!/usr/bin/env python3
"""Verification script for Task 03.07: /auth/me Endpoint.

This script verifies:
1. src/core/dependencies.py exists and has required functions
2. get_current_user dependency is properly implemented
3. get_current_superuser dependency is properly implemented
4. get_current_user_optional dependency is properly implemented
5. GET /auth/me endpoint is defined in auth router
6. Endpoint returns UserProfileResponse
7. All imports work correctly

Run this script from the backend directory:
    cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend
    poetry run python scripts/verify_auth_me.py
"""

import inspect
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


def print_check(check_num: int, description: str, passed: bool, details: str = "") -> None:
    """Print a check result with consistent formatting."""
    status = "PASS" if passed else "FAIL"
    status_symbol = "[OK]" if passed else "[X]"
    print(f"\n{status_symbol} Check {check_num}: {description}")
    if details:
        print(f"    Details: {details}")


def check_dependencies_file_exists() -> bool:
    """Check 1: Verify src/core/dependencies.py exists."""
    dependencies_path = Path(__file__).parent.parent / "src" / "core" / "dependencies.py"
    exists = dependencies_path.exists()
    print_check(
        1,
        "src/core/dependencies.py exists",
        exists,
        str(dependencies_path) if exists else "File not found"
    )
    return exists


def check_dependencies_exports() -> bool:
    """Check 2: Verify all required functions are exported."""
    try:
        from src.core.dependencies import (
            get_current_user,
            get_current_superuser,
            get_current_user_optional,
            security_scheme,
        )

        # Check they are callable (except security_scheme)
        all_callable = (
            callable(get_current_user)
            and callable(get_current_superuser)
            and callable(get_current_user_optional)
        )

        print_check(
            2,
            "All required functions exported from dependencies.py",
            all_callable,
            "get_current_user, get_current_superuser, get_current_user_optional, security_scheme"
        )
        return all_callable
    except ImportError as e:
        print_check(2, "All required functions exported", False, f"Import error: {e}")
        return False


def check_core_init_exports() -> bool:
    """Check 3: Verify src/core/__init__.py exports dependencies."""
    try:
        from src.core import (
            get_current_user,
            get_current_superuser,
            get_current_user_optional,
        )

        print_check(
            3,
            "src/core/__init__.py exports dependencies",
            True,
            "Can import from src.core directly"
        )
        return True
    except ImportError as e:
        print_check(3, "src/core/__init__.py exports dependencies", False, f"Import error: {e}")
        return False


def check_get_current_user_signature() -> bool:
    """Check 4: Verify get_current_user has correct signature."""
    try:
        from src.core.dependencies import get_current_user

        sig = inspect.signature(get_current_user)
        params = list(sig.parameters.keys())

        has_credentials = "credentials" in params
        has_db = "db" in params

        passed = has_credentials and has_db

        print_check(
            4,
            "get_current_user has correct parameters",
            passed,
            f"Parameters: {params}"
        )
        return passed
    except Exception as e:
        print_check(4, "get_current_user signature", False, str(e))
        return False


def check_auth_me_endpoint_exists() -> bool:
    """Check 5: Verify GET /me endpoint is defined in auth router."""
    try:
        from src.api.v1.auth import router, get_me

        # Check that get_me function exists and is callable
        if not callable(get_me):
            print_check(5, "GET /me endpoint exists", False, "get_me is not callable")
            return False

        # Find the /me endpoint in router routes
        me_endpoint = None
        for route in router.routes:
            path = getattr(route, 'path', None)
            # Router prefix is /api/v1/auth, so route path will be /me
            if path == "/me":
                me_endpoint = route
                break

        if me_endpoint is None:
            # Try checking by endpoint function name
            for route in router.routes:
                endpoint = getattr(route, 'endpoint', None)
                if endpoint and endpoint.__name__ == 'get_me':
                    me_endpoint = route
                    break

        if me_endpoint is None:
            print_check(5, "GET /me endpoint exists", False, "Endpoint not found in router routes")
            return False

        # Check it's a GET endpoint
        methods = getattr(me_endpoint, 'methods', set())
        is_get = "GET" in methods

        print_check(
            5,
            "GET /me endpoint exists in auth router",
            is_get,
            f"Path: {getattr(me_endpoint, 'path', 'N/A')}, Methods: {methods}"
        )
        return is_get
    except Exception as e:
        print_check(5, "GET /me endpoint exists", False, str(e))
        return False


def check_me_endpoint_response_model() -> bool:
    """Check 6: Verify /me endpoint uses UserProfileResponse."""
    try:
        from src.api.v1.auth import router, get_me
        from src.schemas.user import UserProfileResponse

        # Find the /me endpoint by endpoint function
        me_endpoint = None
        for route in router.routes:
            endpoint = getattr(route, 'endpoint', None)
            if endpoint and endpoint.__name__ == 'get_me':
                me_endpoint = route
                break

        if me_endpoint is None:
            # Try by path
            for route in router.routes:
                path = getattr(route, 'path', None)
                if path == "/me":
                    me_endpoint = route
                    break

        if me_endpoint is None:
            print_check(6, "/me endpoint response model", False, "Endpoint not found")
            return False

        # Check response_model
        response_model = getattr(me_endpoint, 'response_model', None)
        correct_model = response_model == UserProfileResponse

        print_check(
            6,
            "/me endpoint uses UserProfileResponse",
            correct_model,
            f"Response model: {response_model.__name__ if response_model else 'None'}"
        )
        return correct_model
    except Exception as e:
        print_check(6, "/me endpoint response model", False, str(e))
        return False


def check_exception_imports() -> bool:
    """Check 7: Verify all exceptions are properly imported."""
    try:
        from src.core.dependencies import (
            UnauthorizedException,
            UserNotFoundException,
            ForbiddenException,
        )

        # These should be imported but let's verify they work
        from src.core.exceptions import (
            UnauthorizedException as UE,
            UserNotFoundException as UNF,
            ForbiddenException as FE,
        )

        print_check(
            7,
            "All exceptions properly imported in dependencies",
            True,
            "UnauthorizedException, UserNotFoundException, ForbiddenException"
        )
        return True
    except ImportError as e:
        print_check(7, "Exception imports", False, str(e))
        return False


def main() -> int:
    """Run all verification checks."""
    print("=" * 60)
    print("Task 03.07: /auth/me Endpoint Verification")
    print("=" * 60)

    checks = [
        check_dependencies_file_exists,
        check_dependencies_exports,
        check_core_init_exports,
        check_get_current_user_signature,
        check_auth_me_endpoint_exists,
        check_me_endpoint_response_model,
        check_exception_imports,
    ]

    results = []
    for check in checks:
        try:
            results.append(check())
        except Exception as e:
            print(f"\nUnexpected error in check: {e}")
            results.append(False)

    # Summary
    passed = sum(results)
    total = len(results)

    print("\n" + "=" * 60)
    print(f"SUMMARY: {passed}/{total} checks passed")
    print("=" * 60)

    if passed == total:
        print("\nAll checks passed! Task 03.07 implementation verified.")
        return 0
    else:
        print(f"\n{total - passed} check(s) failed. Please review the implementation.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
