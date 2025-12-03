"""Verify user registration endpoint is working correctly."""

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
from src.db.models import User, UserSettings, RefreshToken


async def verify_registration():
    """Comprehensive registration verification."""

    # Test data
    test_email = f"test_{uuid4().hex[:8]}@example.com"
    test_password = "SecurePass123!"
    test_name = "Test User"

    print("=" * 60)
    print("USER REGISTRATION VERIFICATION")
    print("=" * 60)

    # 1. Test API endpoint
    print("\n1. Testing API endpoint...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "http://localhost:8000/api/v1/auth/register",
                json={
                    "email": test_email,
                    "password": test_password,
                    "full_name": test_name
                },
                timeout=10.0
            )

            if response.status_code != 201:
                print(f"   ❌ Registration failed: {response.status_code}")
                print(f"      Response: {response.text}")
                return False

            tokens = response.json()
            print(f"   ✅ Registration successful")
            print(f"      Access token: {tokens['access_token'][:20]}...")
            print(f"      Expires in: {tokens['expires_in']} seconds")

        except httpx.ConnectError:
            print("   ❌ Cannot connect to API. Is the server running?")
            print("      Run: poetry run uvicorn src.main:app --reload --port 8000")
            return False
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return False

    # 2. Verify database records
    print("\n2. Verifying database records...")

    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession)

    async with async_session() as db:
        # Check user
        result = await db.execute(
            select(User).where(User.email == test_email)
        )
        user = result.scalar_one_or_none()

        if not user:
            print("   ❌ User not found in database")
            await engine.dispose()
            return False

        print(f"   ✅ User created: {user.id}")
        print(f"      Email: {user.email}")
        print(f"      Name: {user.full_name}")
        print(f"      Active: {user.is_active}")

        # Check user settings
        result = await db.execute(
            select(UserSettings).where(UserSettings.user_id == user.id)
        )
        settings_obj = result.scalar_one_or_none()

        if not settings_obj:
            print("   ❌ UserSettings not found")
            await engine.dispose()
            return False

        print(f"   ✅ UserSettings created")
        print(f"      Daily goal: {settings_obj.daily_goal}")
        print(f"      Email notifications: {settings_obj.email_notifications}")

        # Check refresh token
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user.id,
            )
        )
        refresh_token = result.scalar_one_or_none()

        if not refresh_token:
            print("   ❌ RefreshToken not found")
            await engine.dispose()
            return False

        print(f"   ✅ RefreshToken stored")
        print(f"      Expires at: {refresh_token.expires_at}")

    # 3. Test duplicate registration
    print("\n3. Testing duplicate email prevention...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "http://localhost:8000/api/v1/auth/register",
                json={
                    "email": test_email,
                    "password": test_password,
                    "full_name": test_name
                },
                timeout=10.0
            )

            if response.status_code != 409:
                print(f"   ❌ Expected 409, got {response.status_code}")
                await engine.dispose()
                return False

            print(f"   ✅ Duplicate email rejected (409)")

        except Exception as e:
            print(f"   ❌ Error: {e}")
            await engine.dispose()
            return False

    # 4. Test validation
    print("\n4. Testing password validation...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "http://localhost:8000/api/v1/auth/register",
                json={
                    "email": f"weak_{uuid4().hex[:8]}@example.com",
                    "password": "weak",  # Too short
                    "full_name": "Test User"
                },
                timeout=10.0
            )

            if response.status_code != 422:
                print(f"   ❌ Expected 422, got {response.status_code}")
                await engine.dispose()
                return False

            print(f"   ✅ Weak password rejected (422)")

        except Exception as e:
            print(f"   ❌ Error: {e}")
            await engine.dispose()
            return False

    print("\n" + "=" * 60)
    print("✅ ALL VERIFICATION CHECKS PASSED!")
    print("=" * 60)

    await engine.dispose()
    return True


if __name__ == "__main__":
    success = asyncio.run(verify_registration())
    sys.exit(0 if success else 1)