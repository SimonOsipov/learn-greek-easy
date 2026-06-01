"""Conftest for unit/scripts tests.

Pre-warms the src.services import chain so that spaCy's pydantic-v1 initialisation
(which fails on Python 3.14 but succeeds on Python 3.13 / CI) is resolved before
any test in this directory runs.  Without this, the very first test that imports
a script module would receive an ImportError on Python 3.14 local dev.
"""

try:
    import src.services.s3_service  # noqa: F401 — side-effect: warms src.services.__init__
except ImportError:
    # Python 3.14 + spaCy 3.8.x: pydantic v1 raises ConfigError during import.
    # The partial module state is cached in sys.modules so subsequent imports work.
    # CI uses Python 3.13 where this succeeds cleanly.
    pass
