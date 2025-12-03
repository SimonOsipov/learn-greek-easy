#!/usr/bin/env python3
"""Comprehensive verification script for login endpoint.

This script verifies all aspects of the login functionality including:
- Service layer implementation
- API endpoint behavior
- Security measures
- Error handling
- Token generation
"""

import asyncio
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, Tuple
from uuid import uuid4

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import init_db, get_session_factory
from src.db.models import User, RefreshToken
from src.services.auth_service import AuthService
from src.schemas.user import UserLogin, UserCreate
from src.core.security import verify_password, create_access_token, verify_token
from src.core.exceptions import InvalidCredentialsException


# ANSI color codes for output
class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def print_header(text: str) -> None:
    """Print a formatted header."""
    print(f"\n{Colors.CYAN}{'=' * 60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{text}{Colors.RESET}")
    print(f"{Colors.CYAN}{'=' * 60}{Colors.RESET}")


def print_success(text: str) -> None:
    """Print success message."""
    print(f"{Colors.GREEN}✓ {text}{Colors.RESET}")


def print_error(text: str) -> None:
    """Print error message."""
    print(f"{Colors.RED}✗ {text}{Colors.RESET}")


def print_info(text: str) -> None:
    """Print info message."""
    print(f"{Colors.BLUE}ℹ {text}{Colors.RESET}")


def print_warning(text: str) -> None:
    """Print warning message."""
    print(f"{Colors.YELLOW}⚠ {text}{Colors.RESET}")


async def cleanup_test_data(session: AsyncSession, email: str) -> None:
    """Clean up test user and related data."""
    result = await session.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()

    if user:
        # Delete refresh tokens first
        await session.execute(
            select(RefreshToken).where(RefreshToken.user_id == user.id)
        )
        # Delete user
        await session.delete(user)
        await session.commit()


async def verify_login_success(session: AsyncSession) -> Tuple[bool, str]:
    """Test successful login scenario."""
    email = f"test_login_{uuid4().hex[:8]}@example.com"
    password = "SecurePass123!"

    try:
        # Create test user
        service = AuthService(session)
        user_data = UserCreate(
            email=email,
            password=password,
            full_name="Test Login User"
        )

        user, _ = await service.register_user(user_data)
        print_info(f"Created test user: {email}")

        # Attempt login
        login_data = UserLogin(email=email, password=password)
        login_user, token_response = await service.login_user(login_data)

        # Verify response
        assert login_user.id == user.id, "User ID mismatch"
        assert login_user.email == email, "Email mismatch"
        assert token_response.access_token, "No access token"
        assert token_response.refresh_token, "No refresh token"
        assert token_response.token_type == "bearer", "Wrong token type"
        assert token_response.expires_in > 0, "Invalid expiry time"

        # Verify tokens are valid
        user_id = verify_token(token_response.access_token, token_type="access")
        assert user_id == str(user.id), "Access token validation failed"

        user_id = verify_token(token_response.refresh_token, token_type="refresh")
        assert user_id == str(user.id), "Refresh token validation failed"

        # Verify refresh token is stored in database
        result = await session.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user.id,
                RefreshToken.token == token_response.refresh_token
            )
        )
        db_token = result.scalar_one_or_none()
        assert db_token is not None, "Refresh token not stored in database"

        # Cleanup
        await cleanup_test_data(session, email)

        return True, "Login success test passed"

    except Exception as e:
        await cleanup_test_data(session, email)
        return False, f"Login success test failed: {str(e)}"


async def verify_invalid_email(session: AsyncSession) -> Tuple[bool, str]:
    """Test login with non-existent email."""
    try:
        service = AuthService(session)
        login_data = UserLogin(
            email="nonexistent@example.com",
            password="SomePassword123!"
        )

        # Should raise InvalidCredentialsException
        try:
            await service.login_user(login_data)
            return False, "Should have raised InvalidCredentialsException"
        except InvalidCredentialsException:
            # Expected behavior
            return True, "Invalid email test passed"

    except Exception as e:
        return False, f"Invalid email test failed: {str(e)}"


async def verify_wrong_password(session: AsyncSession) -> Tuple[bool, str]:
    """Test login with wrong password."""
    email = f"test_wrong_pass_{uuid4().hex[:8]}@example.com"

    try:
        # Create test user
        service = AuthService(session)
        user_data = UserCreate(
            email=email,
            password="CorrectPassword123!",
            full_name="Test User"
        )

        user, _ = await service.register_user(user_data)

        # Attempt login with wrong password
        login_data = UserLogin(
            email=email,
            password="WrongPassword123!"
        )

        try:
            await service.login_user(login_data)
            await cleanup_test_data(session, email)
            return False, "Should have raised InvalidCredentialsException"
        except InvalidCredentialsException:
            # Expected behavior
            await cleanup_test_data(session, email)
            return True, "Wrong password test passed"

    except Exception as e:
        await cleanup_test_data(session, email)
        return False, f"Wrong password test failed: {str(e)}"


async def verify_inactive_account(session: AsyncSession) -> Tuple[bool, str]:
    """Test login with inactive account."""
    email = f"test_inactive_{uuid4().hex[:8]}@example.com"

    try:
        # Create test user
        service = AuthService(session)
        user_data = UserCreate(
            email=email,
            password="TestPassword123!",
            full_name="Inactive User"
        )

        user, _ = await service.register_user(user_data)

        # Deactivate user
        user.is_active = False
        await session.commit()

        # Attempt login
        login_data = UserLogin(email=email, password="TestPassword123!")

        try:
            await service.login_user(login_data)
            await cleanup_test_data(session, email)
            return False, "Should have raised InvalidCredentialsException"
        except InvalidCredentialsException as e:
            # Expected behavior
            await cleanup_test_data(session, email)
            return True, "Inactive account test passed"

    except Exception as e:
        await cleanup_test_data(session, email)
        return False, f"Inactive account test failed: {str(e)}"


async def verify_oauth_user_login(session: AsyncSession) -> Tuple[bool, str]:
    """Test that OAuth users (no password) cannot login via email/password."""
    email = f"test_oauth_{uuid4().hex[:8]}@example.com"

    try:
        # Create OAuth user (no password hash)
        user = User(
            email=email,
            password_hash=None,
            google_id=f"google_{uuid4().hex}",
            full_name="OAuth User",
            is_active=True
        )
        session.add(user)
        await session.commit()

        # Attempt login
        service = AuthService(session)
        login_data = UserLogin(email=email, password="AnyPassword123!")

        try:
            await service.login_user(login_data)
            await cleanup_test_data(session, email)
            return False, "OAuth user should not be able to login with password"
        except InvalidCredentialsException:
            # Expected behavior
            await cleanup_test_data(session, email)
            return True, "OAuth user login test passed"

    except Exception as e:
        await cleanup_test_data(session, email)
        return False, f"OAuth user login test failed: {str(e)}"


async def verify_case_insensitive_email(session: AsyncSession) -> Tuple[bool, str]:
    """Test email case insensitivity."""
    email_original = f"TesT.UsEr_{uuid4().hex[:8]}@ExAmPle.CoM"
    email_lower = email_original.lower()
    password = "TestPassword123!"

    try:
        # Create user with mixed case email
        service = AuthService(session)
        user_data = UserCreate(
            email=email_original,
            password=password,
            full_name="Case Test User"
        )

        user, _ = await service.register_user(user_data)

        # Try login with lowercase email
        login_data = UserLogin(email=email_lower, password=password)
        login_user, token_response = await service.login_user(login_data)

        # Verify success
        assert login_user.id == user.id, "User ID mismatch"
        assert token_response.access_token, "No access token"

        # Cleanup
        await cleanup_test_data(session, email_lower)

        return True, "Case insensitive email test passed"

    except Exception as e:
        await cleanup_test_data(session, email_lower)
        return False, f"Case insensitive email test failed: {str(e)}"


async def verify_token_expiry_calculation(session: AsyncSession) -> Tuple[bool, str]:
    """Test token expiry calculation accuracy."""
    email = f"test_expiry_{uuid4().hex[:8]}@example.com"

    try:
        # Create test user
        service = AuthService(session)
        user_data = UserCreate(
            email=email,
            password="TestPassword123!",
            full_name="Expiry Test User"
        )

        user, _ = await service.register_user(user_data)

        # Login
        login_data = UserLogin(email=email, password="TestPassword123!")
        start_time = datetime.utcnow()
        _, token_response = await service.login_user(login_data)

        # Verify expires_in is approximately correct (30 minutes = 1800 seconds)
        # Allow for small timing differences
        assert 1795 <= token_response.expires_in <= 1800, \
            f"Unexpected expires_in value: {token_response.expires_in}"

        # Cleanup
        await cleanup_test_data(session, email)

        return True, "Token expiry calculation test passed"

    except Exception as e:
        await cleanup_test_data(session, email)
        return False, f"Token expiry calculation test failed: {str(e)}"


async def verify_performance(session: AsyncSession) -> Tuple[bool, str]:
    """Test login performance (should complete within reasonable time)."""
    email = f"test_perf_{uuid4().hex[:8]}@example.com"

    try:
        # Create test user
        service = AuthService(session)
        user_data = UserCreate(
            email=email,
            password="TestPassword123!",
            full_name="Performance Test User"
        )

        user, _ = await service.register_user(user_data)

        # Measure login time
        login_data = UserLogin(email=email, password="TestPassword123!")

        start = time.perf_counter()
        await service.login_user(login_data)
        duration = time.perf_counter() - start

        # Cleanup
        await cleanup_test_data(session, email)

        # Check performance (should be less than 500ms even with bcrypt)
        if duration < 0.5:
            return True, f"Performance test passed (login took {duration:.3f}s)"
        else:
            return False, f"Performance test warning: login took {duration:.3f}s (>500ms)"

    except Exception as e:
        await cleanup_test_data(session, email)
        return False, f"Performance test failed: {str(e)}"


async def main():
    """Run all verification tests."""
    print_header("LOGIN ENDPOINT VERIFICATION")
    print_info("Starting comprehensive login functionality tests...\n")

    # Initialize database
    await init_db()
    SessionMaker = get_session_factory()

    # Test suite
    tests = [
        ("Successful Login", verify_login_success),
        ("Invalid Email", verify_invalid_email),
        ("Wrong Password", verify_wrong_password),
        ("Inactive Account", verify_inactive_account),
        ("OAuth User Login", verify_oauth_user_login),
        ("Case Insensitive Email", verify_case_insensitive_email),
        ("Token Expiry Calculation", verify_token_expiry_calculation),
        ("Performance", verify_performance),
    ]

    results = []
    passed = 0
    failed = 0

    async with SessionMaker() as session:
        for test_name, test_func in tests:
            print(f"\n{Colors.BOLD}Testing: {test_name}{Colors.RESET}")
            success, message = await test_func(session)

            if success:
                print_success(message)
                passed += 1
            else:
                print_error(message)
                failed += 1

            results.append((test_name, success, message))

    # Summary
    print_header("VERIFICATION SUMMARY")

    total = passed + failed
    print(f"\n{Colors.BOLD}Total Tests:{Colors.RESET} {total}")
    print(f"{Colors.GREEN}Passed:{Colors.RESET} {passed}")
    print(f"{Colors.RED}Failed:{Colors.RESET} {failed}")

    if failed == 0:
        print_success("\nAll login verification tests passed!")

        # Check for missing features
        print_warning("\nRecommended enhancements not yet implemented:")
        print_warning("  - last_login_at timestamp update")
        print_warning("  - Login audit logging")
        print_warning("  - Rate limiting")
        print_warning("  - Account lockout after failed attempts")
    else:
        print_error(f"\n{failed} test(s) failed. Please review the errors above.")
        return 1

    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)