"""Conftest for integration/services tests.

Pre-mock spacy to work around the Python 3.14 / pydantic-v1 incompatibility
that causes a ConfigError when spacy attempts to introspect Cython types at
import time. This affects any test that transitively imports
src.services.morphology_service (via src.services.__init__).
"""

import sys
from unittest.mock import MagicMock

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

# spaCy fails on Python 3.14 with pydantic.v1.errors.ConfigError at import time.
# Replace it with a MagicMock so unit tests that don't need NLP can still run.
if "spacy" not in sys.modules:
    _spacy_mock = MagicMock()
    sys.modules["spacy"] = _spacy_mock
    sys.modules["spacy.pipeline"] = MagicMock()
    sys.modules["spacy.tokens"] = MagicMock()
    sys.modules["spacy.language"] = MagicMock()
    sys.modules["spacy.vocab"] = MagicMock()


# =============================================================================
# Pipeline fixtures
# =============================================================================


@pytest_asyncio.fixture
async def test_factory(db_engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Async sessionmaker built from the same engine as db_session.

    Used by pipeline-core tests (Bucket C) that need to pass an
    async_sessionmaker to run_description_audio_pipeline directly.

    The sessionmaker shares the underlying engine with the db_session fixture,
    so rows committed inside the pipeline's own factory.begin() sessions are
    visible to subsequent db_session queries within the same test (both point
    at the same Postgres connection pool / schema).
    """
    return async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
