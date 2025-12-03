"""Verify pytest async configuration is working correctly.

This script tests:
1. pytest-asyncio is installed
2. asyncio_mode is set to "auto"
3. Async tests run without @pytest.mark.asyncio decorator
4. Event loop is properly configured
5. Test markers are registered

Usage:
    cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend
    /Users/samosipov/.local/bin/poetry run python scripts/verify_pytest_async.py
"""

import subprocess
import sys
import os
import tempfile


def run_command(cmd: list[str]) -> tuple[int, str, str]:
    """Run a command and return exit code, stdout, stderr."""
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode, result.stdout, result.stderr


def main() -> int:
    """Run all verification checks."""
    print("=" * 70)
    print("PYTEST ASYNC CONFIGURATION VERIFICATION")
    print("=" * 70)
    print()

    all_passed = True
    poetry_path = "/Users/samosipov/.local/bin/poetry"

    # Check 1: pytest-asyncio is installed
    print("Check 1: pytest-asyncio installation")
    code, out, err = run_command([poetry_path, "show", "pytest-asyncio"])
    if code == 0 and "pytest-asyncio" in out:
        print("  [PASS] pytest-asyncio is installed")
        # Extract version
        for line in out.split("\n"):
            if "version" in line.lower():
                print(f"  {line.strip()}")
                break
    else:
        print("  [FAIL] pytest-asyncio not found")
        all_passed = False
    print()

    # Check 2: asyncio_mode is set in pyproject.toml
    print("Check 2: asyncio_mode configuration")
    try:
        with open("pyproject.toml") as f:
            content = f.read()
        if 'asyncio_mode = "auto"' in content:
            print("  [PASS] asyncio_mode = 'auto' is configured")
        else:
            print("  [FAIL] asyncio_mode not set to 'auto' in pyproject.toml")
            all_passed = False

        if 'asyncio_default_fixture_loop_scope = "function"' in content:
            print("  [PASS] asyncio_default_fixture_loop_scope = 'function' is configured")
        else:
            print("  [WARN] asyncio_default_fixture_loop_scope not explicitly set")
    except FileNotFoundError:
        print("  [FAIL] pyproject.toml not found")
        all_passed = False
    print()

    # Check 3: Test markers are registered
    print("Check 3: Test markers registration")
    code, out, err = run_command([poetry_path, "run", "pytest", "--markers"])
    expected_markers = ["unit", "integration", "slow", "auth", "api", "db"]
    for marker in expected_markers:
        if marker in out:
            print(f"  [PASS] Marker '{marker}' is registered")
        else:
            print(f"  [FAIL] Marker '{marker}' not found")
            all_passed = False
    print()

    # Check 4: Collect tests without errors
    print("Check 4: Test collection")
    code, out, err = run_command([
        poetry_path, "run", "pytest", "--collect-only", "-q", "--no-cov"
    ])
    if code == 0:
        lines = out.strip().split("\n")
        last_line = lines[-1] if lines else ""
        print("  [PASS] Test collection successful")
        print(f"  {last_line}")
    else:
        print("  [FAIL] Test collection failed")
        print(f"  Error: {err}")
        all_passed = False
    print()

    # Check 5: Run a simple async test
    print("Check 5: Async test execution")
    test_code = '''
import pytest

async def test_async_works():
    """Test that async tests work without decorator."""
    import asyncio
    await asyncio.sleep(0.001)
    assert True

def test_sync_still_works():
    """Test that sync tests still work."""
    assert True
'''

    # Write temporary test file
    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix="_test.py",
        dir="tests/unit",
        delete=False
    ) as f:
        f.write(test_code)
        temp_file = f.name

    try:
        code, out, err = run_command([
            poetry_path, "run", "pytest", temp_file, "-v", "--no-cov"
        ])
        if code == 0 and "2 passed" in out:
            print("  [PASS] Async tests run without @pytest.mark.asyncio")
            print("  [PASS] Sync tests continue to work")
        else:
            print("  [FAIL] Test execution failed")
            print(f"  stdout: {out}")
            print(f"  stderr: {err}")
            all_passed = False
    finally:
        os.unlink(temp_file)
    print()

    # Check 6: Verify existing tests still pass (run a quick sample)
    print("Check 6: Sample existing tests pass")
    # Find an existing test file
    test_files = [
        "tests/unit/test_security.py",
        "tests/unit/test_jwt_tokens.py",
    ]

    for test_file in test_files:
        if os.path.exists(test_file):
            code, out, err = run_command([
                poetry_path, "run", "pytest", test_file, "-q", "--no-cov", "-x"
            ])
            if code == 0 and "passed" in out:
                print(f"  [PASS] {test_file} passes")
                # Extract pass count
                for line in out.split("\n"):
                    if "passed" in line:
                        print(f"         {line.strip()}")
                        break
                break
            else:
                print(f"  [FAIL] {test_file} failed")
                print(f"  {err[:200] if err else out[:200]}")
                all_passed = False
    print()

    # Check 7: Verify custom header appears
    print("Check 7: Custom pytest header")
    code, out, err = run_command([
        poetry_path, "run", "pytest", "--collect-only", "-q", "--no-cov"
    ])
    if "Learn Greek Easy Backend Test Suite" in out:
        print("  [PASS] Custom header appears in output")
    else:
        print("  [WARN] Custom header not found (may be filtered in quiet mode)")
    print()

    # Summary
    print("=" * 70)
    if all_passed:
        print("ALL CHECKS PASSED!")
        print("=" * 70)
        print()
        print("Summary:")
        print("  - pytest-asyncio is properly configured")
        print("  - asyncio_mode = 'auto' is enabled")
        print("  - Test markers are registered")
        print("  - Async tests work without decorators")
        print("  - Existing tests continue to pass")
        print()
        return 0
    else:
        print("SOME CHECKS FAILED!")
        print("=" * 70)
        print()
        print("Please review the failed checks above and fix the configuration.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
