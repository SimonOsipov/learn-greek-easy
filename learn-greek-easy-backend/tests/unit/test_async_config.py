"""Tests to verify async configuration is working correctly.

These tests verify:
1. Async tests run without @pytest.mark.asyncio decorator
2. Event loop is available in async tests
3. Multiple async tests can run in sequence
4. Async fixtures work correctly
5. Test markers are properly applied
"""

import asyncio
from typing import Any

import pytest

# =============================================================================
# Basic Async Tests (no decorator needed with asyncio_mode="auto")
# =============================================================================


async def test_async_test_runs_without_decorator():
    """Verify async tests run without @pytest.mark.asyncio decorator."""
    await asyncio.sleep(0.001)
    assert True


async def test_async_sleep_works():
    """Verify asyncio.sleep works in tests."""
    start = asyncio.get_event_loop().time()
    await asyncio.sleep(0.01)
    end = asyncio.get_event_loop().time()
    assert end - start >= 0.01


async def test_multiple_awaits():
    """Verify multiple awaits work in a single test."""
    results: list[int] = []

    async def append_after_delay(value: int, delay: float) -> None:
        await asyncio.sleep(delay)
        results.append(value)

    await append_after_delay(1, 0.001)
    await append_after_delay(2, 0.001)
    await append_after_delay(3, 0.001)

    assert results == [1, 2, 3]


# =============================================================================
# Event Loop Tests
# =============================================================================


async def test_event_loop_is_available():
    """Verify event loop is available in async tests."""
    loop = asyncio.get_event_loop()
    assert loop is not None
    assert loop.is_running()


async def test_event_loop_is_same_within_test():
    """Verify same event loop is used throughout a single test."""
    loop1 = asyncio.get_event_loop()
    await asyncio.sleep(0.001)
    loop2 = asyncio.get_event_loop()
    assert loop1 is loop2


# =============================================================================
# Concurrent Async Operations
# =============================================================================


async def test_gather_works():
    """Verify asyncio.gather works in tests."""

    async def delayed_return(value: int, delay: float) -> int:
        await asyncio.sleep(delay)
        return value

    results = await asyncio.gather(
        delayed_return(1, 0.01),
        delayed_return(2, 0.01),
        delayed_return(3, 0.01),
    )

    assert results == [1, 2, 3]


async def test_create_task_works():
    """Verify asyncio.create_task works in tests."""
    results: list[int] = []

    async def append_value(value: int) -> None:
        await asyncio.sleep(0.001)
        results.append(value)

    task1 = asyncio.create_task(append_value(1))
    task2 = asyncio.create_task(append_value(2))

    await task1
    await task2

    assert sorted(results) == [1, 2]


# =============================================================================
# Async Fixtures Tests
# =============================================================================


@pytest.fixture
async def async_value():
    """Async fixture that provides a value after a delay."""
    await asyncio.sleep(0.001)
    return 42


@pytest.fixture
async def async_context():
    """Async fixture with setup and teardown."""
    # Setup
    data: dict[str, Any] = {"setup": True, "cleaned_up": False}
    await asyncio.sleep(0.001)

    yield data

    # Teardown
    data["cleaned_up"] = True
    await asyncio.sleep(0.001)


async def test_async_fixture_provides_value(async_value: int):
    """Verify async fixtures work correctly."""
    assert async_value == 42


async def test_async_fixture_with_context(async_context: dict[str, Any]):
    """Verify async fixtures with setup/teardown work."""
    assert async_context["setup"] is True
    assert async_context["cleaned_up"] is False  # Not yet


# =============================================================================
# Test Markers
# =============================================================================


@pytest.mark.unit
def test_unit_marker_works():
    """Verify @pytest.mark.unit works."""
    assert True


@pytest.mark.slow
async def test_slow_marker_works():
    """Verify @pytest.mark.slow works with async tests."""
    await asyncio.sleep(0.001)
    assert True


@pytest.mark.auth
async def test_auth_marker_works():
    """Verify @pytest.mark.auth works."""
    await asyncio.sleep(0.001)
    assert True


@pytest.mark.db
async def test_db_marker_works():
    """Verify @pytest.mark.db works."""
    await asyncio.sleep(0.001)
    assert True


@pytest.mark.api
async def test_api_marker_works():
    """Verify @pytest.mark.api works."""
    await asyncio.sleep(0.001)
    assert True


# =============================================================================
# Sync Tests Still Work
# =============================================================================


def test_sync_test_still_works():
    """Verify sync tests continue to work."""
    assert 1 + 1 == 2


def test_sync_with_assertion():
    """Verify sync tests with assertions work."""
    data = {"key": "value"}
    assert "key" in data
    assert data["key"] == "value"


class TestSyncClass:
    """Verify sync test classes work."""

    def test_method_works(self):
        """Verify sync test methods work."""
        assert True

    def test_with_fixture(self, sample_password: str):
        """Verify sync tests can use fixtures."""
        assert "Password" in sample_password


# =============================================================================
# Mixed Sync/Async Class
# =============================================================================


class TestMixedAsyncSync:
    """Test class with both sync and async tests."""

    def test_sync_method(self):
        """Sync test in mixed class."""
        assert True

    async def test_async_method(self):
        """Async test in mixed class."""
        await asyncio.sleep(0.001)
        assert True

    async def test_async_with_fixture(self, async_value: int):
        """Async test with async fixture in mixed class."""
        assert async_value == 42


# =============================================================================
# Error Handling in Async Tests
# =============================================================================


async def test_async_exception_handling():
    """Verify exceptions in async tests are properly caught."""

    async def raise_error():
        raise ValueError("Test error")

    with pytest.raises(ValueError, match="Test error"):
        await raise_error()


async def test_async_timeout_handling():
    """Verify timeout handling in async tests."""

    async def slow_operation():
        await asyncio.sleep(0.1)
        return "done"

    # This should complete without timeout
    result = await asyncio.wait_for(slow_operation(), timeout=1.0)
    assert result == "done"


# =============================================================================
# Global Fixtures Available
# =============================================================================


def test_sample_password_fixture(sample_password: str):
    """Verify sample_password fixture is available."""
    assert sample_password == "TestPassword123!"
    assert len(sample_password) >= 8


def test_sample_email_fixture(sample_email: str):
    """Verify sample_email fixture is available."""
    assert sample_email == "test@example.com"
    assert "@" in sample_email


def test_sample_user_data_fixture(sample_user_data: dict[str, Any]):
    """Verify sample_user_data fixture is available."""
    assert "email" in sample_user_data
    assert "password" in sample_user_data
    assert "display_name" in sample_user_data


def test_test_settings_fixture(test_settings: dict[str, Any]):
    """Verify test_settings fixture is available."""
    assert test_settings["testing"] is True
    assert "jwt_secret" in test_settings
