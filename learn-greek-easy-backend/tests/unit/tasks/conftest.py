"""Conftest for unit/tasks tests.

Pre-mock stripe so that importing src.services doesn't fail
when the stripe package is not installed (dev-only dependency).
"""

import sys
from unittest.mock import MagicMock

if "stripe" not in sys.modules:
    sys.modules["stripe"] = MagicMock()
