"""Conftest for integration/services tests.

Pre-mock spacy to work around the Python 3.14 / pydantic-v1 incompatibility
that causes a ConfigError when spacy attempts to introspect Cython types at
import time. This affects any test that transitively imports
src.services.morphology_service (via src.services.__init__).
"""

import sys
from unittest.mock import MagicMock

# spaCy fails on Python 3.14 with pydantic.v1.errors.ConfigError at import time.
# Replace it with a MagicMock so unit tests that don't need NLP can still run.
if "spacy" not in sys.modules:
    _spacy_mock = MagicMock()
    sys.modules["spacy"] = _spacy_mock
    sys.modules["spacy.pipeline"] = MagicMock()
    sys.modules["spacy.tokens"] = MagicMock()
    sys.modules["spacy.language"] = MagicMock()
    sys.modules["spacy.vocab"] = MagicMock()
