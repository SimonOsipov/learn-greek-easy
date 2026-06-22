"""Conftest for unit/services tests.

Pre-mock spacy to work around the Python 3.14 / pydantic-v1 incompatibility
that causes a ConfigError when spacy attempts to introspect Cython types at
import time. This affects any test that transitively imports
src.services.morphology_service (via src.services.__init__).

If spaCy can be imported successfully (CI / Python 3.13, or environments where
the pydantic-v1 conflict is absent), real spaCy is left in place so that NLP
tests like test_morphology_lemmatize_sentence.py get real token output.
"""

import sys
from unittest.mock import MagicMock

# Only mock spaCy if importing it would fail.  On Python 3.13 (CI) spaCy loads
# cleanly; on some Python 3.14 builds a pydantic.v1 ConfigError fires at import
# time — in that case fall back to MagicMock so non-NLP unit tests can still run.
if "spacy" not in sys.modules:
    try:
        import spacy  # noqa: F401 — side-effect import; real module cached in sys.modules
    except Exception:
        _spacy_mock = MagicMock()
        sys.modules["spacy"] = _spacy_mock
        sys.modules["spacy.pipeline"] = MagicMock()
        sys.modules["spacy.tokens"] = MagicMock()
        sys.modules["spacy.language"] = MagicMock()
        sys.modules["spacy.vocab"] = MagicMock()
