#!/usr/bin/env python3
"""Verify coverage configuration is working correctly.

Run:
    cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && \
    /Users/samosipov/.local/bin/poetry run python scripts/verify_coverage_config.py
"""

import shutil
import subprocess
import sys
import os
from pathlib import Path


def print_header(text: str) -> None:
    """Print a section header."""
    print()
    print("=" * 70)
    print(text)
    print("=" * 70)


def print_result(check: str, passed: bool, details: str = "") -> None:
    """Print a check result."""
    status = "[PASS]" if passed else "[FAIL]"
    print(f"  {status} {check}")
    if details:
        print(f"         {details}")


def get_poetry_path() -> str:
    """Get the path to poetry executable."""
    # Try common locations
    common_paths = [
        "/Users/samosipov/.local/bin/poetry",
        os.path.expanduser("~/.local/bin/poetry"),
    ]
    for path in common_paths:
        if os.path.exists(path):
            return path
    # Fall back to PATH
    poetry = shutil.which("poetry")
    if poetry:
        return poetry
    return "poetry"


def run_command(cmd: list[str], cwd: str = None) -> tuple[int, str, str]:
    """Run a command and return exit code, stdout, stderr."""
    # Replace 'poetry' with full path if it's the first argument
    if cmd and cmd[0] == "poetry":
        cmd = [get_poetry_path()] + cmd[1:]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=cwd or os.getcwd(),
    )
    return result.returncode, result.stdout, result.stderr


def main() -> int:
    """Run all verification checks."""
    print_header("COVERAGE CONFIGURATION VERIFICATION")
    print()

    all_passed = True
    backend_dir = Path(__file__).parent.parent

    # Check 1: pytest-cov installed
    print_header("Check 1: pytest-cov Installation")
    code, out, err = run_command(["poetry", "show", "pytest-cov"], cwd=str(backend_dir))
    if code == 0 and "pytest-cov" in out:
        version = out.split()[1] if len(out.split()) > 1 else "unknown"
        print_result("pytest-cov installed", True, f"Version: {version}")
    else:
        print_result("pytest-cov installed", False, err)
        all_passed = False

    # Check 2: pyproject.toml has coverage config
    print_header("Check 2: Coverage Configuration in pyproject.toml")
    pyproject_path = backend_dir / "pyproject.toml"
    if pyproject_path.exists():
        content = pyproject_path.read_text()
        checks = [
            ("[tool.coverage.run]", "coverage.run section"),
            ("[tool.coverage.report]", "coverage.report section"),
            ("[tool.coverage.html]", "coverage.html section"),
            ("[tool.coverage.xml]", "coverage.xml section"),
            ("branch = true", "branch coverage enabled"),
            ("fail_under = 90", "fail_under threshold set to 90"),
            ("show_missing = true", "show_missing enabled"),
            ("--cov-branch", "cov-branch in pytest addopts"),
            ("--cov-fail-under=90", "cov-fail-under in pytest addopts"),
        ]
        for pattern, desc in checks:
            if pattern in content:
                print_result(desc, True)
            else:
                print_result(desc, False, f"Missing: {pattern}")
                all_passed = False
    else:
        print_result("pyproject.toml exists", False)
        all_passed = False

    # Check 3: Run coverage and verify output
    print_header("Check 3: Coverage Report Generation")
    code, out, err = run_command(
        ["poetry", "run", "pytest", "tests/unit/test_security.py",
         "--cov=src.core.security", "--cov-report=term", "-q", "--tb=no", "--no-cov-on-fail"],
        cwd=str(backend_dir),
    )
    combined_output = out + err
    if code == 0 or "passed" in combined_output.lower():
        print_result("Tests run with coverage", True)
        if "src/core/security.py" in combined_output or "security" in combined_output.lower():
            print_result("Coverage report generated", True)
        else:
            print_result("Coverage report generated", False, "Module not in output")
            all_passed = False
    else:
        print_result("Tests run with coverage", False, err[:200] if err else "Unknown error")
        all_passed = False

    # Check 4: HTML report generation
    print_header("Check 4: HTML Report Generation")
    code, out, err = run_command(
        ["poetry", "run", "pytest", "tests/unit/test_security.py",
         "--cov=src.core.security", "--cov-report=html", "-q", "--tb=no", "--no-cov-on-fail"],
        cwd=str(backend_dir),
    )
    html_index = backend_dir / "htmlcov" / "index.html"
    if html_index.exists():
        print_result("HTML report created", True, str(html_index))
    else:
        print_result("HTML report created", False, "htmlcov/index.html not found")
        all_passed = False

    # Check 5: XML report generation
    print_header("Check 5: XML Report Generation")
    code, out, err = run_command(
        ["poetry", "run", "pytest", "tests/unit/test_security.py",
         "--cov=src.core.security", "--cov-report=xml", "-q", "--tb=no", "--no-cov-on-fail"],
        cwd=str(backend_dir),
    )
    xml_file = backend_dir / "coverage.xml"
    if xml_file.exists():
        print_result("XML report created", True, str(xml_file))
    else:
        print_result("XML report created", False, "coverage.xml not found")
        all_passed = False

    # Check 6: Fail-under enforcement
    # Note: pyproject.toml has --cov=src in addopts, so coverage is measured over all src/
    # even when running a subset of tests. We test that the threshold mechanism works.
    print_header("Check 6: Fail-Under Enforcement")

    # Test that a high threshold (99%) fails - this should always fail
    code, out, err = run_command(
        ["poetry", "run", "pytest", "tests/unit/test_security.py",
         "--cov=src.core.security", "--cov-fail-under=99", "-q", "--tb=no"],
        cwd=str(backend_dir),
    )
    if code != 0:
        print_result("fail_under=99 correctly fails", True)
    else:
        print_result("fail_under=99 correctly fails", False, "Should have failed")
        all_passed = False

    # Test that a very low threshold (1%) passes - the 25% coverage should exceed this
    code, out, err = run_command(
        ["poetry", "run", "pytest", "tests/unit/test_security.py",
         "--cov=src.core.security", "--cov-fail-under=1", "-q", "--tb=no"],
        cwd=str(backend_dir),
    )
    if code == 0:
        print_result("fail_under=1 correctly passes (coverage > 1%)", True)
    else:
        print_result("fail_under=1 correctly passes", False, err[:200] if err else "Unknown error")
        all_passed = False

    # Check 7: Branch coverage verification
    print_header("Check 7: Branch Coverage")
    code, out, err = run_command(
        ["poetry", "run", "pytest", "tests/unit/test_security.py",
         "--cov=src.core.security", "--cov-branch", "--cov-report=term", "-q", "--tb=no", "--no-cov-on-fail"],
        cwd=str(backend_dir),
    )
    combined_output = out + err
    # Branch coverage output typically shows "Branch" in headers or has different coverage numbers
    if code == 0 or "passed" in combined_output.lower():
        print_result("Branch coverage runs successfully", True)
    else:
        print_result("Branch coverage runs successfully", False, err[:200] if err else "Unknown error")
        all_passed = False

    # Summary
    print_header("VERIFICATION SUMMARY")
    if all_passed:
        print()
        print("  ALL CHECKS PASSED!")
        print()
        print("  Coverage is properly configured:")
        print("  - pytest-cov is installed")
        print("  - pyproject.toml has coverage settings")
        print("  - Branch coverage is enabled")
        print("  - HTML/XML reports generate correctly")
        print("  - Fail-under threshold enforcement works")
        print()
        return 0
    else:
        print()
        print("  SOME CHECKS FAILED!")
        print()
        print("  Review the failed checks above and update configuration.")
        print()
        return 1


if __name__ == "__main__":
    sys.exit(main())
