"""Supply-chain gate: no python-jose imports must exist anywhere in src/ or tests/.

RED before INFRA-10-01 (jose imports still in tests/helpers/time.py).
GREEN after the executor removes python-jose and rewrites the helpers.
"""

import re
from pathlib import Path

import pytest

# Patterns that indicate python-jose usage
_JOSE_PATTERNS = re.compile(r"\bfrom jose\b|\bimport jose\b")

# Roots to scan: src/ and tests/ relative to the backend package root
_BACKEND_ROOT = Path(__file__).parents[2]  # learn-greek-easy-backend/


def _python_files():
    """Yield all .py files under src/ and tests/, excluding this file."""
    this_file = Path(__file__).resolve()
    for root in (_BACKEND_ROOT / "src", _BACKEND_ROOT / "tests"):
        for py_file in root.rglob("*.py"):
            if py_file.resolve() != this_file:
                yield py_file


@pytest.mark.unit
def test_no_jose_imports_in_repo():
    """Assert that no Python file in src/ or tests/ contains 'from jose' or 'import jose'.

    This test is RED before INFRA-10-01 and GREEN after the executor removes
    python-jose and rewrites the three helpers in tests/helpers/time.py.
    """
    offenders: list[str] = []

    for py_file in _python_files():
        try:
            source = py_file.read_text(encoding="utf-8")
        except OSError:
            continue
        if _JOSE_PATTERNS.search(source):
            # Record path relative to backend root for readable output
            offenders.append(str(py_file.relative_to(_BACKEND_ROOT)))

    assert offenders == [], (
        f"Found python-jose imports in {len(offenders)} file(s) — "
        f"python-jose must be removed (INFRA-10-01):\n"
        + "\n".join(f"  {f}" for f in sorted(offenders))
    )
