"""Verify JWT token generation and validation implementation."""

import sys
import time
from pathlib import Path

# Add parent directory to path to enable imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime, timedelta
from uuid import uuid4

from src.config import settings
from src.core.exceptions import TokenExpiredException, TokenInvalidException
from src.core.security import (
    create_access_token,
    create_refresh_token,
    verify_token,
)


def verify_jwt_implementation():
    """Verify JWT token implementation."""
    print("=" * 70)
    print("JWT TOKEN IMPLEMENTATION VERIFICATION")
    print("=" * 70)
    print()

    # Check 1: Configuration
    print("1. JWT Configuration:")
    print(f"   • Secret Key: {settings.jwt_secret_key[:20]}... (first 20 chars)")
    print(f"   • Algorithm: {settings.jwt_algorithm}")
    print(f"   • Access Token Expiry: {settings.jwt_access_token_expire_minutes} minutes")
    print(f"   • Refresh Token Expiry: {settings.jwt_refresh_token_expire_days} days")
    print("   [PASS] Configuration loaded")
    print()

    # Check 2: Access Token Generation
    print("2. Access Token Generation:")
    user_id = uuid4()
    access_token, access_expires_at = create_access_token(user_id)
    print(f"   • Token Length: {len(access_token)} characters")
    print(f"   • Token Preview: {access_token[:50]}...")
    print(f"   • Expires At: {access_expires_at}")

    # Verify expiry is ~30 minutes from now
    expected_expiry = datetime.utcnow() + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )
    expiry_diff = abs((access_expires_at - expected_expiry).total_seconds())
    assert expiry_diff < 5, f"Expiry time incorrect (diff: {expiry_diff}s)"
    print(f"   • Expiry Check: ✓ (~{settings.jwt_access_token_expire_minutes} min from now)")
    print("   [PASS] Access token generation works")
    print()

    # Check 3: Refresh Token Generation
    print("3. Refresh Token Generation:")
    refresh_token, refresh_expires_at = create_refresh_token(user_id)
    print(f"   • Token Length: {len(refresh_token)} characters")
    print(f"   • Token Preview: {refresh_token[:50]}...")
    print(f"   • Expires At: {refresh_expires_at}")

    # Verify expiry is ~30 days from now
    expected_expiry = datetime.utcnow() + timedelta(
        days=settings.jwt_refresh_token_expire_days
    )
    expiry_diff = abs((refresh_expires_at - expected_expiry).total_seconds())
    assert expiry_diff < 5, f"Expiry time incorrect (diff: {expiry_diff}s)"
    print(f"   • Expiry Check: ✓ (~{settings.jwt_refresh_token_expire_days} days from now)")
    print("   [PASS] Refresh token generation works")
    print()

    # Check 4: Access Token Verification
    print("4. Access Token Verification:")
    verified_user_id = verify_token(access_token, "access")
    print(f"   • Original User ID:  {user_id}")
    print(f"   • Verified User ID:  {verified_user_id}")
    assert verified_user_id == user_id, "User ID mismatch!"
    print("   • User ID Match: ✓")
    print("   [PASS] Access token verification works")
    print()

    # Check 5: Refresh Token Verification
    print("5. Refresh Token Verification:")
    verified_user_id = verify_token(refresh_token, "refresh")
    print(f"   • Original User ID:  {user_id}")
    print(f"   • Verified User ID:  {verified_user_id}")
    assert verified_user_id == user_id, "User ID mismatch!"
    print("   • User ID Match: ✓")
    print("   [PASS] Refresh token verification works")
    print()

    # Check 6: Token Type Validation
    print("6. Token Type Validation:")
    # Try to use refresh token as access token
    try:
        verify_token(refresh_token, "access")
        print("   [FAIL] Should have rejected refresh token used as access token")
        raise AssertionError("Token type validation failed")
    except TokenInvalidException as e:
        print(f"   • Refresh as Access: ✗ Rejected ({e.detail})")

    # Try to use access token as refresh token
    try:
        verify_token(access_token, "refresh")
        print("   [FAIL] Should have rejected access token used as refresh token")
        raise AssertionError("Token type validation failed")
    except TokenInvalidException as e:
        print(f"   • Access as Refresh: ✗ Rejected ({e.detail})")

    print("   [PASS] Token type validation works")
    print()

    # Check 7: Invalid Token Handling
    print("7. Invalid Token Handling:")
    invalid_tokens = [
        ("empty string", ""),
        ("malformed", "not-a-jwt-token"),
        ("invalid format", "header.payload"),
    ]

    for name, token in invalid_tokens:
        try:
            verify_token(token, "access")
            print(f"   • {name}: [FAIL] Should have raised exception")
            raise AssertionError(f"Invalid token not rejected: {name}")
        except TokenInvalidException:
            print(f"   • {name}: ✓ Rejected")

    print("   [PASS] Invalid tokens rejected")
    print()

    # Check 8: Token Uniqueness
    print("8. Token Uniqueness (Salt Generation):")
    token1, _ = create_access_token(user_id)
    time.sleep(1)  # Ensure different timestamp
    token2, _ = create_access_token(user_id)
    print(f"   • Token 1: {token1[:30]}...")
    print(f"   • Token 2: {token2[:30]}...")
    assert token1 != token2, "Tokens should be unique!"
    print("   • Tokens Different: ✓")

    # Both should verify to same user
    assert verify_token(token1, "access") == user_id
    assert verify_token(token2, "access") == user_id
    print("   • Both Verify to Same User: ✓")
    print("   [PASS] Token uniqueness works")
    print()

    print("=" * 70)
    print("ALL JWT TOKEN CHECKS PASSED!")
    print("=" * 70)
    print()
    print("Implementation Summary:")
    print(f"  • Access Tokens: {settings.jwt_access_token_expire_minutes} min expiry")
    print(f"  • Refresh Tokens: {settings.jwt_refresh_token_expire_days} day expiry")
    print(f"  • Algorithm: {settings.jwt_algorithm}")
    print("  • Token Type Validation: ✓ Enabled")
    print("  • User ID Extraction: ✓ Working")
    print("  • Invalid Token Rejection: ✓ Working")
    print()


if __name__ == "__main__":
    verify_jwt_implementation()
