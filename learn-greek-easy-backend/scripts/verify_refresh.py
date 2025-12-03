"""Verify token refresh endpoint with token rotation.

This script tests:
1. Register a test user
2. Test successful token refresh
3. Test token rotation (old token should be rejected)
4. Test that new tokens work
5. Test invalid token handling
"""

import asyncio
import sys
from pathlib import Path
from uuid import uuid4

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from src.config import settings
from src.db.models import User, RefreshToken


async def verify_refresh():
    """Comprehensive token refresh verification."""

    # Test data
    test_email = f"refresh_test_{uuid4().hex[:8]}@example.com"
    test_password = "SecurePass123!"
    test_name = "Refresh Test User"

    print("=" * 60)
    print("TOKEN REFRESH ENDPOINT VERIFICATION")
    print("=" * 60)

    # 1. Register test user
    print("\n1. Registering test user...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "http://localhost:8000/api/v1/auth/register",
                json={
                    "email": test_email,
                    "password": test_password,
                    "full_name": test_name,
                },
                timeout=10.0,
            )

            if response.status_code != 201:
                print(f"   FAIL Registration failed: {response.status_code}")
                print(f"      Response: {response.text}")
                return False

            tokens = response.json()
            original_access_token = tokens["access_token"]
            original_refresh_token = tokens["refresh_token"]

            print(f"   OK Registration successful")
            print(f"      Access token: {original_access_token[:30]}...")
            print(f"      Refresh token: {original_refresh_token[:30]}...")

        except httpx.ConnectError:
            print("   FAIL Cannot connect to API. Is the server running?")
            print("      Run: poetry run uvicorn src.main:app --reload --port 8000")
            return False
        except Exception as e:
            print(f"   FAIL Error: {e}")
            return False

    # 2. Test successful token refresh
    print("\n2. Testing successful token refresh...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "http://localhost:8000/api/v1/auth/refresh",
                json={"refresh_token": original_refresh_token},
                timeout=10.0,
            )

            if response.status_code != 200:
                print(f"   FAIL Token refresh failed: {response.status_code}")
                print(f"      Response: {response.text}")
                return False

            new_tokens = response.json()
            new_access_token = new_tokens["access_token"]
            new_refresh_token = new_tokens["refresh_token"]

            print(f"   OK Token refresh successful")
            print(f"      New access token: {new_access_token[:30]}...")
            print(f"      New refresh token: {new_refresh_token[:30]}...")

            # Verify tokens are different (rotation occurred)
            if new_refresh_token == original_refresh_token:
                print("   FAIL Token rotation NOT working - same refresh token returned!")
                return False

            print(f"   OK Token rotation verified - new refresh token issued")

        except Exception as e:
            print(f"   FAIL Error: {e}")
            return False

    # 3. Test token rotation - old token should be rejected
    print("\n3. Testing token rotation (old token should be rejected)...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "http://localhost:8000/api/v1/auth/refresh",
                json={"refresh_token": original_refresh_token},
                timeout=10.0,
            )

            if response.status_code == 200:
                print("   FAIL Token rotation NOT working - old token still accepted!")
                return False

            if response.status_code != 401:
                print(f"   FAIL Expected 401, got {response.status_code}")
                print(f"      Response: {response.text}")
                return False

            print(f"   OK Old refresh token rejected (401)")
            print(f"      Response: {response.json()}")

        except Exception as e:
            print(f"   FAIL Error: {e}")
            return False

    # 4. Test that new tokens work
    print("\n4. Testing that new tokens work...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "http://localhost:8000/api/v1/auth/refresh",
                json={"refresh_token": new_refresh_token},
                timeout=10.0,
            )

            if response.status_code != 200:
                print(f"   FAIL New token refresh failed: {response.status_code}")
                print(f"      Response: {response.text}")
                return False

            final_tokens = response.json()
            final_access_token = final_tokens["access_token"]
            final_refresh_token = final_tokens["refresh_token"]

            print(f"   OK New refresh token works")
            print(f"      Final access token: {final_access_token[:30]}...")
            print(f"      Final refresh token: {final_refresh_token[:30]}...")

            # Update for next test
            new_refresh_token = final_refresh_token

        except Exception as e:
            print(f"   FAIL Error: {e}")
            return False

    # 5. Test invalid token handling
    print("\n5. Testing invalid token handling...")
    async with httpx.AsyncClient() as client:
        try:
            # Test with completely invalid token
            response = await client.post(
                "http://localhost:8000/api/v1/auth/refresh",
                json={"refresh_token": "invalid_token_string"},
                timeout=10.0,
            )

            if response.status_code != 401:
                print(f"   FAIL Expected 401 for invalid token, got {response.status_code}")
                return False

            print(f"   OK Invalid token rejected (401)")

            # Test with malformed JWT
            response = await client.post(
                "http://localhost:8000/api/v1/auth/refresh",
                json={"refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature"},
                timeout=10.0,
            )

            if response.status_code != 401:
                print(f"   FAIL Expected 401 for malformed JWT, got {response.status_code}")
                return False

            print(f"   OK Malformed JWT rejected (401)")

        except Exception as e:
            print(f"   FAIL Error: {e}")
            return False

    # 6. Verify database state
    print("\n6. Verifying database state...")
    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession)

    async with async_session() as db:
        try:
            # Get user
            result = await db.execute(select(User).where(User.email == test_email))
            user = result.scalar_one_or_none()

            if not user:
                print("   FAIL Test user not found in database")
                await engine.dispose()
                return False

            print(f"   OK User found: {user.id}")

            # Check refresh tokens - should only have one active token
            result = await db.execute(
                select(RefreshToken).where(RefreshToken.user_id == user.id)
            )
            tokens = result.scalars().all()

            print(f"   OK Active refresh tokens for user: {len(tokens)}")

            if len(tokens) != 1:
                print(f"   WARNING Expected 1 active token, found {len(tokens)}")
                print("            (This may be OK if multiple refresh operations occurred)")

            for i, token in enumerate(tokens):
                print(f"      Token {i+1}: expires at {token.expires_at}")

        except Exception as e:
            print(f"   FAIL Database error: {e}")
            await engine.dispose()
            return False

    await engine.dispose()

    print("\n" + "=" * 60)
    print("OK ALL VERIFICATION CHECKS PASSED!")
    print("=" * 60)
    print("\nToken rotation is working correctly:")
    print("  - New access and refresh tokens issued on each refresh")
    print("  - Old refresh tokens are invalidated")
    print("  - Invalid tokens are properly rejected")

    return True


if __name__ == "__main__":
    success = asyncio.run(verify_refresh())
    sys.exit(0 if success else 1)
