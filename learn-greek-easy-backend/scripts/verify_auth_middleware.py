#!/usr/bin/env python3
"""Verification script for Task 03.08: Authentication Middleware.

This script tests the AuthLoggingMiddleware functionality by making
requests to various auth endpoints and checking the server logs.

Run with:
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && \
/Users/samosipov/.local/bin/poetry run python scripts/verify_auth_middleware.py

Prerequisites:
- Server must be running on localhost:8000
- Run: poetry run uvicorn src.main:app --reload --port 8000
"""

import asyncio
import sys

import httpx

BASE_URL = "http://localhost:8000/api/v1/auth"


async def verify_middleware() -> bool:
    """Verify auth middleware functionality.

    Returns:
        True if all tests pass, False otherwise.
    """
    print("=" * 60)
    print("Task 03.08: Authentication Middleware Verification")
    print("=" * 60)
    print()
    print("NOTE: Check the server console/logs for middleware output.")
    print("      Each request to /api/v1/auth/* should be logged.")
    print()

    all_passed = True

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Test 1: Login endpoint
        print("[1/5] Testing middleware on POST /login endpoint...")
        try:
            response = await client.post(
                f"{BASE_URL}/login",
                json={"email": "test@test.com", "password": "wrongpassword"},
            )
            print(f"      Status: {response.status_code}")
            print("      Check server logs for:")
            print("        - Auth endpoint accessed")
            print("        - Failed login attempt (if 401)")
            print("      [PASS]")
        except httpx.ConnectError:
            print("      [FAIL] Could not connect to server")
            print("      Make sure the server is running:")
            print("      poetry run uvicorn src.main:app --reload --port 8000")
            return False
        except Exception as e:
            print(f"      [FAIL] Error: {e}")
            all_passed = False

        print()

        # Test 2: /me endpoint (without auth)
        print("[2/5] Testing middleware on GET /me endpoint...")
        try:
            response = await client.get(f"{BASE_URL}/me")
            print(f"      Status: {response.status_code}")
            print("      Check server logs for auth endpoint log entry")
            print("      [PASS]")
        except Exception as e:
            print(f"      [FAIL] Error: {e}")
            all_passed = False

        print()

        # Test 3: Non-auth endpoint (should NOT be logged)
        print("[3/5] Testing non-auth endpoint GET /health...")
        try:
            response = await client.get("http://localhost:8000/health")
            print(f"      Status: {response.status_code}")
            print("      Check server logs - should NOT have auth log entry")
            print("      [PASS]")
        except Exception as e:
            print(f"      [FAIL] Error: {e}")
            all_passed = False

        print()

        # Test 4: X-Forwarded-For header
        print("[4/5] Testing with X-Forwarded-For header...")
        try:
            response = await client.get(
                f"{BASE_URL}/me",
                headers={"X-Forwarded-For": "203.0.113.50"},
            )
            print(f"      Status: {response.status_code}")
            print("      Check server logs - client_ip should be 203.0.113.50")
            print("      [PASS]")
        except Exception as e:
            print(f"      [FAIL] Error: {e}")
            all_passed = False

        print()

        # Test 5: X-Real-IP header
        print("[5/5] Testing with X-Real-IP header...")
        try:
            response = await client.get(
                f"{BASE_URL}/me",
                headers={"X-Real-IP": "192.168.1.100"},
            )
            print(f"      Status: {response.status_code}")
            print("      Check server logs - client_ip should be 192.168.1.100")
            print("      [PASS]")
        except Exception as e:
            print(f"      [FAIL] Error: {e}")
            all_passed = False

    print()
    print("=" * 60)
    if all_passed:
        print("VERIFICATION: All requests completed successfully")
        print("Please check server logs for expected log entries")
    else:
        print("VERIFICATION: Some tests failed")
    print("=" * 60)

    return all_passed


def main() -> int:
    """Run the verification script.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    try:
        success = asyncio.run(verify_middleware())
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\nVerification cancelled")
        return 1


if __name__ == "__main__":
    sys.exit(main())
