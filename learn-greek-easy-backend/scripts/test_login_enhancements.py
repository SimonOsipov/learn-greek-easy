#!/usr/bin/env python3
"""Manual test script to verify login enhancements."""

import asyncio
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from src.db.session import init_db, get_session_factory
from src.db.models import User
from src.services.auth_service import AuthService
from src.schemas.user import UserCreate, UserLogin


async def test_login_enhancements():
    """Test the login enhancements manually."""
    print("Starting login enhancements test...\n")

    # Initialize database
    await init_db()
    SessionMaker = get_session_factory()

    async with SessionMaker() as session:
        # Create a test user
        service = AuthService(session)

        test_email = f"test_login_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com"
        print(f"Creating test user: {test_email}")

        user_data = UserCreate(
            email=test_email,
            password="TestPassword123!",
            full_name="Login Test User"
        )

        user, _ = await service.register_user(user_data)
        print(f"✓ User created with ID: {user.id}")

        # Check initial state
        print(f"Initial last_login_at: {user.last_login_at}")
        print(f"Initial last_login_ip: {user.last_login_ip}")

        # Perform login with IP
        print("\nPerforming login with IP address...")
        login_data = UserLogin(email=test_email, password="TestPassword123!")
        client_ip = "192.168.1.100"

        logged_in_user, tokens = await service.login_user(login_data, client_ip)

        # Verify the updates
        await session.refresh(user)

        print(f"\nAfter login:")
        print(f"✓ last_login_at updated: {user.last_login_at}")
        print(f"✓ last_login_ip updated: {user.last_login_ip}")
        print(f"✓ Access token received: {tokens.access_token[:20]}...")
        print(f"✓ Refresh token received: {tokens.refresh_token[:20]}...")

        # Verify the fields were actually updated
        assert user.last_login_at is not None, "last_login_at should be set"
        assert user.last_login_ip == client_ip, f"last_login_ip should be {client_ip}"

        print("\n✅ All login enhancements are working correctly!")

        # Cleanup - delete test user
        await session.delete(user)
        await session.commit()
        print(f"\nTest user {test_email} cleaned up.")


if __name__ == "__main__":
    asyncio.run(test_login_enhancements())