"""Fixtures for tests/integration/api — guards against Redis cache pollution.

Both ``GET /api/v1/news`` (src/api/v1/news.py) and ``GET /api/v1/decks``
(src/api/v1/decks.py) cache their list responses in Redis under shared keys
(``news:list:{country}:{q_hash}:{page}:{page_size}`` and
``decks:list:{locale}:{level}:{page}:{page_size}`` respectively).  In CI a live
Redis service container is available (``REDIS_URL: redis://localhost:6379/0``),
so the cache is ENABLED when the ASGI lifespan runs during the test session.

The per-test DB transaction is rolled back between tests, but **Redis is not**:
whichever integration test hits a list endpoint first writes its response to
Redis (TTL 60-300 s), and the next test calling the same endpoint with the same
default params gets a stale Redis hit carrying the *previous* test's rows — a
cross-test bleed that fails non-deterministically depending on xdist scheduling
and Redis readiness.  ``tests/unit/api/conftest.py`` already fixes this for the
unit API tests (deck endpoint only); this conftest mirrors that fix for the
integration API tests and additionally covers the news endpoint.

This adds an **autouse** fixture that replaces ``get_cache()`` in BOTH the
``src.api.v1.news`` and ``src.api.v1.decks`` modules with a Redis-free
pass-through stub for every test in this directory.  The stub never reads from
or writes to Redis; it always delegates to the factory so each request computes
fresh, killing the bleed while still exercising the real endpoint logic (repo
calls, S3 presigned URLs, response serialization) on every invocation.

Tests that patch ``get_cache`` in their own body — e.g.
``test_news_cache.py`` patches ``src.api.v1.admin.get_cache`` to spy on
``delete_pattern`` during an admin write — are unaffected: those inner patches
target a *different* module (``admin``) and/or nest inside this autouse fixture,
so standard Python mock-stacking makes them take precedence for the duration of
the test body.
"""

import asyncio
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def _bypass_list_api_redis_cache():
    """Replace get_cache in src.api.v1.news + src.api.v1.decks with a pass-through.

    Without this fixture the ``list_news_items`` and ``list_decks`` endpoints
    write their responses to the live CI Redis instance.  A subsequent
    integration test calling the same endpoint then receives a Redis cache-hit
    carrying the previous test's rows — e.g. a stale news list missing the
    freshly-seeded item, or a stale deck list missing the just-uploaded cover.

    The stub's ``get_or_set`` always awaits the factory and returns its result,
    so the endpoint follows its full compute path on every call, preserving all
    meaningful assertions.

    Test isolation guarantee: this is a *sync* function-scoped fixture whose
    ``with patch(...)`` wraps the entire test lifecycle.  Module-level patches
    applied inside test bodies (``with patch("src.api.v1.admin.get_cache", ...)``
    in test_news_cache.py) are nested inside it and therefore take precedence —
    the standard Python mock-stacking rule.
    """

    async def _passthrough(key, factory, ttl=None):
        """Call factory directly, bypassing any Redis read/write.

        Mirrors ``CacheService.get_or_set`` cache-miss semantics: a factory
        exception returns ``None`` (so the caller follows its real
        ``cached is None`` fall-through path) rather than propagating.
        """
        try:
            result = factory()
            if asyncio.iscoroutine(result):
                return await result
            return result
        except Exception:
            return None

    mock_cache = MagicMock(name="bypass_list_api_cache")
    mock_cache.get_or_set = _passthrough

    with (
        patch("src.api.v1.news.get_cache", return_value=mock_cache),
        patch("src.api.v1.decks.get_cache", return_value=mock_cache),
    ):
        yield
