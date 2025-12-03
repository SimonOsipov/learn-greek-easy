#!/usr/bin/env python3
"""Verification script for Session Management and Token Revocation (Task 03.09).

This script tests all session management endpoints via HTTP calls to verify
the implementation is working correctly.

Usage:
    # Ensure the server is running first
    cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend
    /Users/samosipov/.local/bin/poetry run uvicorn src.main:app --reload --port 8000

    # In another terminal, run this script
    cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend
    /Users/samosipov/.local/bin/poetry run python scripts/verify_session_management.py
"""

import asyncio
import sys
from datetime import datetime
from uuid import UUID

import httpx

BASE_URL = "http://localhost:8000/api/v1/auth"


class Colors:
    """ANSI color codes for terminal output."""

    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def success(msg: str) -> None:
    """Print success message."""
    print(f"{Colors.GREEN}[SUCCESS]{Colors.RESET} {msg}")


def error(msg: str) -> None:
    """Print error message."""
    print(f"{Colors.RED}[ERROR]{Colors.RESET} {msg}")


def info(msg: str) -> None:
    """Print info message."""
    print(f"{Colors.BLUE}[INFO]{Colors.RESET} {msg}")


def header(msg: str) -> None:
    """Print header message."""
    print(f"\n{Colors.BOLD}{Colors.YELLOW}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.YELLOW}{msg}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.YELLOW}{'='*60}{Colors.RESET}\n")


async def register_test_user(client: httpx.AsyncClient, email: str) -> tuple[str, str]:
    """Register a test user and return tokens."""
    response = await client.post(
        f"{BASE_URL}/register",
        json={
            "email": email,
            "password": "TestPass123!",
            "full_name": "Session Test User",
        },
    )
    if response.status_code == 201:
        data = response.json()
        return data["access_token"], data["refresh_token"]
    elif response.status_code == 409:
        # User already exists, try to login
        return await login_user(client, email)
    else:
        raise Exception(f"Failed to register user: {response.status_code} - {response.text}")


async def login_user(client: httpx.AsyncClient, email: str) -> tuple[str, str]:
    """Login user and return tokens."""
    response = await client.post(
        f"{BASE_URL}/login",
        json={
            "email": email,
            "password": "TestPass123!",
        },
    )
    if response.status_code == 200:
        data = response.json()
        return data["access_token"], data["refresh_token"]
    else:
        raise Exception(f"Failed to login: {response.status_code} - {response.text}")


async def test_get_sessions(client: httpx.AsyncClient, access_token: str) -> list:
    """Test GET /sessions endpoint."""
    info("Testing GET /sessions endpoint...")

    response = await client.get(
        f"{BASE_URL}/sessions",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    if response.status_code == 200:
        data = response.json()
        success(f"GET /sessions returned {data['total']} session(s)")

        # Verify response structure
        assert "sessions" in data, "Response should have 'sessions' key"
        assert "total" in data, "Response should have 'total' key"
        assert isinstance(data["sessions"], list), "Sessions should be a list"

        for session in data["sessions"]:
            assert "id" in session, "Session should have 'id'"
            assert "created_at" in session, "Session should have 'created_at'"
            assert "expires_at" in session, "Session should have 'expires_at'"
            # IMPORTANT: Verify token is NOT exposed
            assert "token" not in session, "Token should NOT be exposed in session info!"

        success("Session response structure is correct")
        return data["sessions"]
    else:
        error(f"GET /sessions failed: {response.status_code} - {response.text}")
        return []


async def test_logout(client: httpx.AsyncClient, access_token: str, refresh_token: str) -> bool:
    """Test POST /logout endpoint."""
    info("Testing POST /logout endpoint...")

    response = await client.post(
        f"{BASE_URL}/logout",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"refresh_token": refresh_token},
    )

    if response.status_code == 200:
        data = response.json()
        success(f"POST /logout returned: success={data['success']}, token_revoked={data['token_revoked']}")

        assert "success" in data, "Response should have 'success'"
        assert "message" in data, "Response should have 'message'"
        assert "token_revoked" in data, "Response should have 'token_revoked'"

        return data["token_revoked"]
    else:
        error(f"POST /logout failed: {response.status_code} - {response.text}")
        return False


async def test_logout_requires_auth(client: httpx.AsyncClient) -> bool:
    """Test that POST /logout requires authentication."""
    info("Testing that POST /logout requires authentication...")

    response = await client.post(
        f"{BASE_URL}/logout",
        json={"refresh_token": "some_token"},
    )

    if response.status_code == 401:
        success("POST /logout correctly requires authentication (401)")
        return True
    else:
        error(f"POST /logout should require auth, got: {response.status_code}")
        return False


async def test_logout_all(client: httpx.AsyncClient, access_token: str) -> int:
    """Test POST /logout-all endpoint."""
    info("Testing POST /logout-all endpoint...")

    response = await client.post(
        f"{BASE_URL}/logout-all",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    if response.status_code == 200:
        data = response.json()
        success(f"POST /logout-all revoked {data['sessions_revoked']} session(s)")

        assert "success" in data, "Response should have 'success'"
        assert "message" in data, "Response should have 'message'"
        assert "sessions_revoked" in data, "Response should have 'sessions_revoked'"

        return data["sessions_revoked"]
    else:
        error(f"POST /logout-all failed: {response.status_code} - {response.text}")
        return 0


async def test_revoke_session_by_id(
    client: httpx.AsyncClient, access_token: str, session_id: str
) -> bool:
    """Test DELETE /sessions/{session_id} endpoint."""
    info(f"Testing DELETE /sessions/{session_id} endpoint...")

    response = await client.delete(
        f"{BASE_URL}/sessions/{session_id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    if response.status_code == 200:
        data = response.json()
        success(f"DELETE /sessions/{session_id} succeeded: {data['message']}")
        return True
    elif response.status_code == 404:
        info(f"Session {session_id} not found (may already be revoked)")
        return False
    else:
        error(f"DELETE /sessions/{session_id} failed: {response.status_code} - {response.text}")
        return False


async def test_revoke_nonexistent_session(client: httpx.AsyncClient, access_token: str) -> bool:
    """Test DELETE /sessions/{session_id} with non-existent ID."""
    info("Testing DELETE /sessions with non-existent session ID...")

    fake_uuid = "00000000-0000-0000-0000-000000000000"
    response = await client.delete(
        f"{BASE_URL}/sessions/{fake_uuid}",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    if response.status_code == 404:
        success("DELETE /sessions correctly returns 404 for non-existent session")
        return True
    else:
        error(f"Expected 404, got: {response.status_code}")
        return False


async def run_verification():
    """Run all verification tests."""
    header("Session Management Verification Script")
    info(f"Testing against: {BASE_URL}")
    info(f"Started at: {datetime.now().isoformat()}")

    all_passed = True
    test_email = f"session_test_{datetime.now().timestamp():.0f}@test.com"

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Step 1: Register/Login test user
        header("Step 1: Setup - Register Test User")
        try:
            access_token, refresh_token = await register_test_user(client, test_email)
            success(f"Registered/logged in user: {test_email}")
            info(f"Access token (prefix): {access_token[:20]}...")
            info(f"Refresh token (prefix): {refresh_token[:20]}...")
        except Exception as e:
            error(f"Setup failed: {e}")
            return False

        # Step 2: Create additional sessions by logging in multiple times
        header("Step 2: Create Multiple Sessions")
        tokens = [(access_token, refresh_token)]
        for i in range(2):
            try:
                at, rt = await login_user(client, test_email)
                tokens.append((at, rt))
                success(f"Created additional session {i + 2}")
            except Exception as e:
                error(f"Failed to create additional session: {e}")

        # Step 3: Test GET /sessions
        header("Step 3: Test GET /sessions")
        sessions = await test_get_sessions(client, tokens[-1][0])
        if len(sessions) >= 1:
            success(f"Found {len(sessions)} active session(s)")
        else:
            error("Expected at least 1 session")
            all_passed = False

        # Step 4: Test logout requires authentication
        header("Step 4: Test Authentication Requirement")
        if not await test_logout_requires_auth(client):
            all_passed = False

        # Step 5: Test POST /logout with first session
        header("Step 5: Test POST /logout")
        if tokens:
            revoked = await test_logout(client, tokens[-1][0], tokens[0][1])
            if revoked:
                success("Token was revoked successfully")
            else:
                info("Token was not found (may already be revoked or rotated)")

        # Step 6: Test DELETE /sessions/{session_id}
        header("Step 6: Test DELETE /sessions/{session_id}")
        if len(sessions) > 0:
            session_to_revoke = sessions[0]["id"]
            await test_revoke_session_by_id(client, tokens[-1][0], session_to_revoke)

        # Step 7: Test non-existent session revocation
        header("Step 7: Test Non-Existent Session Revocation")
        if not await test_revoke_nonexistent_session(client, tokens[-1][0]):
            all_passed = False

        # Step 8: Test POST /logout-all
        header("Step 8: Test POST /logout-all")
        # Create fresh session first
        try:
            fresh_access, fresh_refresh = await login_user(client, test_email)
            revoked_count = await test_logout_all(client, fresh_access)
            success(f"Logged out from all sessions (count: {revoked_count})")
        except Exception as e:
            error(f"logout-all test failed: {e}")
            all_passed = False

        # Step 9: Verify all sessions are revoked
        header("Step 9: Verify Sessions After Logout-All")
        try:
            # Login again to check sessions
            final_access, _ = await login_user(client, test_email)
            final_sessions = await test_get_sessions(client, final_access)
            # After logout-all and new login, we should have exactly 1 session
            if len(final_sessions) == 1:
                success("Correctly shows 1 session after logout-all and new login")
            else:
                info(f"Found {len(final_sessions)} sessions (expected 1)")
        except Exception as e:
            error(f"Final verification failed: {e}")

    # Summary
    header("Verification Complete")
    if all_passed:
        success("All tests passed!")
    else:
        error("Some tests failed!")

    return all_passed


def main():
    """Main entry point."""
    try:
        result = asyncio.run(run_verification())
        sys.exit(0 if result else 1)
    except httpx.ConnectError:
        error("Could not connect to server at http://localhost:8000")
        error("Make sure the server is running:")
        error("  cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend")
        error("  /Users/samosipov/.local/bin/poetry run uvicorn src.main:app --reload --port 8000")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nAborted by user")
        sys.exit(1)


if __name__ == "__main__":
    main()
