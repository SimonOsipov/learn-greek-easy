"""Fixtures for tests/unit/api — guards against Redis cache pollution.

The ``list_decks`` endpoint (src/api/v1/decks.py) caches its response in Redis
under the key ``cache:decks:list:{locale}:{level}:{page}:{page_size}``.  In CI
a live Redis service container is available (``REDIS_URL: redis://localhost:6379/0``),
which means the cache is ENABLED when the ASGI lifespan runs during the test
session.  Two tests that call ``GET /api/v1/decks`` with the same default
parameters share the **same cache key**.  Whichever test runs first stores its
mocked response in Redis (TTL=300 s); the test that runs second gets a Redis
hit returning the first test's data — a cross-test bleed that causes
non-deterministic failures depending on xdist worker scheduling and Redis
container readiness.

This conftest adds an **autouse** fixture that replaces ``get_cache()`` in the
``src.api.v1.decks`` module with a pass-through stub for every test in this
directory.  The stub never reads from or writes to Redis; it always delegates
to the factory function so the real endpoint logic is exercised.

Tests in ``test_decks_list_cache.py`` that explicitly verify caching behaviour
supply their own ``with patch("src.api.v1.decks.get_cache", ...)`` blocks
inside the test body.  Those inner patches override this autouse fixture for
the duration of the test body (standard Python mock-patch stacking semantics),
so they are completely unaffected.
"""

import asyncio
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def _bypass_deck_api_redis_cache():
    """Replace src.api.v1.decks.get_cache with a Redis-free pass-through.

    Without this fixture the ``list_decks`` endpoint writes its response to
    the live CI Redis instance.  A subsequent test calling the same endpoint
    with different mock data then receives a Redis cache-hit from the previous
    test — causing the assertion to see the wrong deck (e.g. a deck with a
    cover image when the test expects no cover).

    The stub's ``get_or_set`` always awaits the factory and returns its result,
    which means the endpoint exercises its full computation path (repo calls,
    S3 presigned URLs, response serialization) on every invocation, preserving
    all meaningful test assertions.

    Test isolation guarantee: this patch is a *sync* function-scoped fixture
    whose ``with patch(...)`` wraps the entire test lifecycle.  Module-level
    patches applied in test bodies (``with patch(...)``) are nested inside it
    and therefore take precedence — the standard Python mock-stacking rule —
    so ``test_decks_list_cache.py`` tests that supply their own ``get_cache``
    patch are not affected.
    """

    async def _passthrough(key, factory, ttl=None):
        """Call factory directly, bypassing any Redis read/write."""
        result = factory()
        if asyncio.iscoroutine(result):
            return await result
        return result

    mock_cache = MagicMock(name="bypass_deck_api_cache")
    mock_cache.get_or_set = _passthrough

    with patch("src.api.v1.decks.get_cache", return_value=mock_cache):
        yield
