"""Unit tests for password hashing and security utilities.

Tests cover:
- Password hashing with bcrypt
- Password verification (correct and incorrect)
- Hash uniqueness (salt generation)
- Password strength validation
- Edge cases (empty passwords, invalid hashes, etc.)
"""

import pytest

from src.core.security import hash_password, validate_password_strength, verify_password

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def sample_password() -> str:
    """Provide a sample strong password for testing."""
    return "MySecurePassword123!"


@pytest.fixture
def sample_hashed_password(sample_password: str) -> str:
    """Provide a hashed version of the sample password."""
    return hash_password(sample_password)


# ============================================================================
# Password Hashing Tests
# ============================================================================


class TestPasswordHashing:
    """Tests for password hashing functionality."""

    def test_hash_password_returns_string(self, sample_password: str) -> None:
        """Test that hash_password returns a string."""
        hashed = hash_password(sample_password)
        assert isinstance(hashed, str)

    def test_hash_password_returns_60_chars(self, sample_password: str) -> None:
        """Test that bcrypt hash is exactly 60 characters (standard length)."""
        hashed = hash_password(sample_password)
        assert len(hashed) == 60

    def test_hash_password_starts_with_bcrypt_prefix(self, sample_password: str) -> None:
        """Test that hash starts with bcrypt $2b$12$ prefix."""
        hashed = hash_password(sample_password)
        assert hashed.startswith("$2b$12$")

    def test_hash_password_produces_unique_hashes(self, sample_password: str) -> None:
        """Test that hashing the same password twice produces different hashes (unique salts)."""
        hashed1 = hash_password(sample_password)
        hashed2 = hash_password(sample_password)
        assert hashed1 != hashed2

    def test_hash_password_raises_on_empty_string(self) -> None:
        """Test that hashing an empty password raises ValueError."""
        with pytest.raises(ValueError, match="Password cannot be empty"):
            hash_password("")

    def test_hash_password_raises_on_none(self) -> None:
        """Test that hashing None raises ValueError."""
        with pytest.raises(ValueError, match="Password cannot be empty"):
            hash_password(None)  # type: ignore

    def test_hash_password_handles_special_characters(self) -> None:
        """Test that passwords with special characters are hashed correctly."""
        password = "P@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?"
        hashed = hash_password(password)
        assert len(hashed) == 60
        assert hashed.startswith("$2b$12$")

    def test_hash_password_handles_unicode(self) -> None:
        """Test that passwords with unicode characters are hashed correctly."""
        password = "Пароль123!日本語"
        hashed = hash_password(password)
        assert len(hashed) == 60
        assert hashed.startswith("$2b$12$")

    def test_hash_password_handles_long_passwords(self) -> None:
        """Test that long passwords (up to 72 chars) are hashed correctly."""
        password = "A" * 72  # bcrypt max is 72 bytes
        hashed = hash_password(password)
        assert len(hashed) == 60


# ============================================================================
# Password Verification Tests
# ============================================================================


class TestPasswordVerification:
    """Tests for password verification functionality."""

    def test_verify_password_correct_password(
        self, sample_password: str, sample_hashed_password: str
    ) -> None:
        """Test that correct password verification returns True."""
        assert verify_password(sample_password, sample_hashed_password) is True

    def test_verify_password_incorrect_password(self, sample_hashed_password: str) -> None:
        """Test that incorrect password verification returns False."""
        assert verify_password("WrongPassword123!", sample_hashed_password) is False

    def test_verify_password_case_sensitive(self, sample_hashed_password: str) -> None:
        """Test that password verification is case-sensitive."""
        assert verify_password("mysecurepassword123!", sample_hashed_password) is False
        assert verify_password("MYSECUREPASSWORD123!", sample_hashed_password) is False

    def test_verify_password_empty_password(self, sample_hashed_password: str) -> None:
        """Test that verifying empty password returns False (not exception)."""
        assert verify_password("", sample_hashed_password) is False

    def test_verify_password_none_password(self, sample_hashed_password: str) -> None:
        """Test that verifying None password returns False (not exception)."""
        assert verify_password(None, sample_hashed_password) is False  # type: ignore

    def test_verify_password_invalid_hash(self, sample_password: str) -> None:
        """Test that invalid hash returns False (not exception)."""
        assert verify_password(sample_password, "invalid_hash") is False

    def test_verify_password_empty_hash(self, sample_password: str) -> None:
        """Test that empty hash returns False (not exception)."""
        assert verify_password(sample_password, "") is False

    def test_verify_password_none_hash(self, sample_password: str) -> None:
        """Test that None hash returns False (not exception)."""
        assert verify_password(sample_password, None) is False  # type: ignore

    def test_verify_password_both_hashes_verify(self, sample_password: str) -> None:
        """Test that two different hashes of the same password both verify."""
        hashed1 = hash_password(sample_password)
        hashed2 = hash_password(sample_password)
        assert hashed1 != hashed2  # Different hashes
        assert verify_password(sample_password, hashed1) is True
        assert verify_password(sample_password, hashed2) is True

    def test_verify_password_with_special_characters(self) -> None:
        """Test verification with special characters in password."""
        password = "P@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True
        assert verify_password(password + "x", hashed) is False


# ============================================================================
# Password Strength Validation Tests
# ============================================================================


class TestPasswordStrengthValidation:
    """Tests for password strength validation."""

    def test_validate_strong_password(self) -> None:
        """Test that a strong password passes all validations."""
        is_valid, errors = validate_password_strength("SecureP@ss9word!")
        assert is_valid is True
        assert errors == []

    def test_validate_weak_password_too_short(self) -> None:
        """Test that password under 8 characters is rejected."""
        is_valid, errors = validate_password_strength("Pass1!")
        assert is_valid is False
        assert "at least 8 characters long" in errors[0]

    def test_validate_weak_password_too_long(self) -> None:
        """Test that password over 128 characters is rejected."""
        is_valid, errors = validate_password_strength("A" * 129)
        assert is_valid is False
        assert "at most 128 characters" in " ".join(errors)

    def test_validate_password_no_uppercase(self) -> None:
        """Test that password without uppercase is rejected."""
        is_valid, errors = validate_password_strength("securepass123!")
        assert is_valid is False
        assert any("uppercase" in err for err in errors)

    def test_validate_password_no_lowercase(self) -> None:
        """Test that password without lowercase is rejected."""
        is_valid, errors = validate_password_strength("SECUREPASS123!")
        assert is_valid is False
        assert any("lowercase" in err for err in errors)

    def test_validate_password_no_digit(self) -> None:
        """Test that password without digit is rejected."""
        is_valid, errors = validate_password_strength("SecurePassword!")
        assert is_valid is False
        assert any("digit" in err for err in errors)

    def test_validate_password_no_special_char(self) -> None:
        """Test that password without special character is rejected."""
        is_valid, errors = validate_password_strength("SecurePassword123")
        assert is_valid is False
        assert any("special character" in err for err in errors)

    def test_validate_common_password(self) -> None:
        """Test that common passwords are rejected."""
        common_passwords = ["password", "123456", "qwerty", "Password123"]
        for pwd in common_passwords:
            is_valid, errors = validate_password_strength(pwd)
            # Should fail for being common (might also fail other checks)
            assert is_valid is False

    def test_validate_sequential_chars(self) -> None:
        """Test that passwords with sequential characters are rejected."""
        is_valid, errors = validate_password_strength("Abcdef123!")
        assert is_valid is False
        assert any("sequential" in err.lower() for err in errors)

    def test_validate_sequential_numbers(self) -> None:
        """Test that passwords with sequential numbers are rejected."""
        is_valid, errors = validate_password_strength("SecurePass123!")
        # This might pass or fail depending on other factors
        # Let's test an obvious sequential pattern
        is_valid, errors = validate_password_strength("Password0123!")
        assert is_valid is False
        assert any("sequential" in err.lower() for err in errors)

    def test_validate_repeated_characters(self) -> None:
        """Test that passwords with too many repeated characters are rejected."""
        is_valid, errors = validate_password_strength("Passwordaaaa1!")
        assert is_valid is False
        assert any("repeated" in err.lower() for err in errors)

    def test_validate_multiple_errors(self) -> None:
        """Test that multiple validation errors are all returned."""
        is_valid, errors = validate_password_strength("weak")
        assert is_valid is False
        assert len(errors) > 1  # Should have multiple errors


# ============================================================================
# Integration Tests
# ============================================================================


class TestPasswordHashingIntegration:
    """Integration tests combining hashing and verification."""

    def test_full_password_lifecycle(self) -> None:
        """Test complete password lifecycle: validate -> hash -> verify."""
        password = "SecureP@ss9word!"

        # Step 1: Validate password strength
        is_valid, errors = validate_password_strength(password)
        assert is_valid is True
        assert errors == []

        # Step 2: Hash the password
        hashed = hash_password(password)
        assert len(hashed) == 60

        # Step 3: Verify the password
        assert verify_password(password, hashed) is True
        assert verify_password("WrongPassword", hashed) is False

    def test_multiple_users_same_password(self) -> None:
        """Test that multiple users with the same password get unique hashes."""
        password = "CommonPassword123!"

        # Simulate 5 users registering with the same password
        hashes = [hash_password(password) for _ in range(5)]

        # All hashes should be unique
        assert len(set(hashes)) == 5

        # But all should verify the same password
        for hashed in hashes:
            assert verify_password(password, hashed) is True


# ============================================================================
# Performance Tests (Optional)
# ============================================================================


class TestPasswordHashingPerformance:
    """Performance tests to ensure hashing isn't too fast (security) or too slow (UX)."""

    def test_hashing_takes_reasonable_time(self, sample_password: str) -> None:
        """Test that hashing takes 100-1000ms (cost factor 12 should be ~300ms)."""
        import time

        start = time.time()
        hash_password(sample_password)
        duration = time.time() - start

        # Should take between 0.1s and 1.0s (cost factor 12 is ~300ms)
        assert 0.1 < duration < 1.0, f"Hashing took {duration:.3f}s (expected 0.1-1.0s)"

    def test_verification_takes_reasonable_time(
        self, sample_password: str, sample_hashed_password: str
    ) -> None:
        """Test that verification takes 100-1000ms."""
        import time

        start = time.time()
        verify_password(sample_password, sample_hashed_password)
        duration = time.time() - start

        # Should take between 0.1s and 1.0s
        assert 0.1 < duration < 1.0, f"Verification took {duration:.3f}s (expected 0.1-1.0s)"
