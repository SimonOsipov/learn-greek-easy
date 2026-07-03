"""RED tests for GET /api/v1/news HTTP + Redis read-through caching (PERF-17-02).

Mirrors tests/unit/api/test_decks_list_cache.py: calls the `list_news_items`
endpoint function DIRECTLY (no HTTP test client / DB), patching
`src.api.v1.news.get_cache` (which does not exist in that module today --
`create=True` is required, mirroring the decks/dashboard precedents) and
`src.api.v1.news.NewsItemService` so no Postgres connection is needed.

Stage 2.5 Mode A (author-before-implement): today `list_news_items` accepts
only `page/page_size/country/q/db` -- it has no `request`/`response`
parameters and sets no headers. These tests call it with the FUTURE
signature (`request: Request, response: Response, ...`) specified by the
Stage-1 Architecture validation note on Backlog task-1245 ("inject
request: Request AND response: Response"). RED surfaces as a clean
`TypeError: list_news_items() got an unexpected keyword argument ...` --
a not-implemented failure, not a collection error (the call happens inside
each test body, never at import time).

Covers Test Specs (Backlog task-1245):
- T02-1: Cache-Control: public, max-age=300 + ETag present; NO Vary (D6)
- T02-2: If-None-Match matching the current ETag -> 304, empty body, same ETag
- T02-3: Redis miss stores at the expected key; a hit skips the service call
- T02-6: Redis disabled -> still 200 + ETag (graceful pass-through)
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import Response

from src.core.cache import CacheService
from src.schemas.news_item import CountryCounts, NewsSlimListResponse

# =============================================================================
# Helpers
# =============================================================================


def _make_mock_db() -> MagicMock:
    return MagicMock()


def _make_mock_request(if_none_match: str | None = None) -> MagicMock:
    request = MagicMock()
    request.headers = MagicMock()
    request.headers.get = MagicMock(return_value=if_none_match)
    return request


def _make_slim_response(total: int = 1) -> NewsSlimListResponse:
    return NewsSlimListResponse(
        total=total,
        page=1,
        page_size=10,
        items=[],
        country_counts=CountryCounts(),
    )


def _make_cache_settings_patch():
    mock_settings = MagicMock()
    mock_settings.cache_enabled = True
    mock_settings.cache_key_prefix = "cache"
    mock_settings.cache_default_ttl = 300
    mock_settings.cache_news_list_ttl = 300
    return patch("src.core.cache.settings", mock_settings)


# =============================================================================
# T02-1 / T02-2: Cache-Control + ETag + If-None-Match -> 304 (RED)
# =============================================================================


@pytest.mark.unit
class TestNewsListHeadersRed:
    """RED: no header-setting / 304 logic exists yet in src/api/v1/news.py."""

    async def test_public_list_sets_cache_control_and_etag_no_vary(self) -> None:
        """AC#1: response carries Cache-Control: public, max-age=300 + ETag, no Vary.

        RED: TypeError -- list_news_items doesn't accept request/response kwargs yet.
        """
        from src.api.v1.news import list_news_items  # noqa: PLC0415

        response = Response()
        db = _make_mock_db()

        with patch("src.api.v1.news.NewsItemService") as mock_service_cls:
            mock_service_cls.return_value.get_list_slim = AsyncMock(
                return_value=_make_slim_response()
            )
            await list_news_items(
                request=_make_mock_request(),
                response=response,
                page=1,
                page_size=10,
                country=None,
                q=None,
                db=db,
            )

        assert (
            response.headers.get("cache-control") == "public, max-age=300"
        ), f"Expected Cache-Control header, got {response.headers.get('cache-control')!r}"
        assert response.headers.get("etag"), "Expected an ETag header to be set"
        assert (
            "vary" not in response.headers
        ), f"Expected NO Vary header (D6), got {response.headers.get('vary')!r}"

    async def test_if_none_match_matching_etag_returns_304_empty_body(self) -> None:
        """AC#2: a repeat request with If-None-Match: <etag> returns 304 + empty body + same ETag.

        RED: TypeError -- list_news_items doesn't accept request/response kwargs yet.
        """
        from src.api.v1.news import list_news_items  # noqa: PLC0415

        db = _make_mock_db()

        with patch("src.api.v1.news.NewsItemService") as mock_service_cls:
            mock_service_cls.return_value.get_list_slim = AsyncMock(
                return_value=_make_slim_response()
            )

            first_response = Response()
            await list_news_items(
                request=_make_mock_request(),
                response=first_response,
                page=1,
                page_size=10,
                country=None,
                q=None,
                db=db,
            )
            etag = first_response.headers.get("etag")
            assert etag, "Expected the first response to carry an ETag"

            second_response = Response()
            result = await list_news_items(
                request=_make_mock_request(if_none_match=etag),
                response=second_response,
                page=1,
                page_size=10,
                country=None,
                q=None,
                db=db,
            )

        assert isinstance(result, Response), f"Expected a bare Response for 304, got {type(result)}"
        assert (
            result.status_code == 304
        ), f"Expected 304, got {getattr(result, 'status_code', None)}"
        assert result.body in (b"", None), f"Expected an empty body on 304, got {result.body!r}"
        assert (
            result.headers.get("etag") == etag
        ), "Expected the 304 response to carry the same ETag"


# =============================================================================
# T02-3 / T02-6: Redis get_or_set + graceful degrade (RED)
# =============================================================================


@pytest.mark.unit
class TestNewsListRedisCacheRed:
    """RED: get_cache is not imported/wired in src/api/v1/news.py yet."""

    async def test_cache_miss_stores_at_expected_key(self) -> None:
        """AC#3/AC#5: miss path stores at cache:news:list:{country}:{q_hash}:{page}:{page_size}.

        RED: TypeError -- list_news_items doesn't accept request/response kwargs yet
        (and get_cache is not wired at all, so setex would never be called regardless).
        """
        from src.api.v1.news import list_news_items  # noqa: PLC0415

        mock_redis = AsyncMock()
        mock_redis.get.return_value = None  # force cache miss
        real_cache = CacheService(redis_client=mock_redis)
        db = _make_mock_db()

        with (
            _make_cache_settings_patch(),
            patch("src.api.v1.news.get_cache", return_value=real_cache, create=True),
            patch("src.api.v1.news.NewsItemService") as mock_service_cls,
        ):
            mock_service_cls.return_value.get_list_slim = AsyncMock(
                return_value=_make_slim_response()
            )
            await list_news_items(
                request=_make_mock_request(),
                response=Response(),
                page=1,
                page_size=10,
                country=None,
                q=None,
                db=db,
            )

        # RED: setex never called pre-impl (no Redis wiring exists) -> call_count == 0.
        assert (
            mock_redis.setex.call_count == 1
        ), f"Expected a single setex call for the public list, got {mock_redis.setex.call_count}"
        actual_key, actual_ttl, _payload = mock_redis.setex.call_args[0]
        assert actual_key == "cache:news:list:all:none:1:10", f"Wrong cache key: {actual_key!r}"
        assert actual_ttl == 300, f"Wrong TTL: {actual_ttl}"

    async def test_cache_hit_skips_service_call(self) -> None:
        """AC#3: a cache hit must not re-invoke NewsItemService.get_list_slim.

        RED: TypeError -- list_news_items doesn't accept request/response kwargs yet.
        """
        from src.api.v1.news import list_news_items  # noqa: PLC0415

        cached_dump = _make_slim_response().model_dump(mode="json")
        mock_cache = MagicMock()
        mock_cache.get_or_set = AsyncMock(return_value=cached_dump)
        db = _make_mock_db()

        with (
            patch("src.api.v1.news.get_cache", return_value=mock_cache, create=True),
            patch("src.api.v1.news.NewsItemService") as mock_service_cls,
        ):
            mock_service = mock_service_cls.return_value
            mock_service.get_list_slim = AsyncMock(return_value=_make_slim_response())

            result = await list_news_items(
                request=_make_mock_request(),
                response=Response(),
                page=1,
                page_size=10,
                country=None,
                q=None,
                db=db,
            )

        assert mock_service.get_list_slim.call_count == 0, (
            "Expected get_list_slim skipped on cache hit, "
            f"got {mock_service.get_list_slim.call_count} call(s)"
        )
        assert isinstance(
            result, NewsSlimListResponse
        ), f"Expected a validated NewsSlimListResponse from the cached payload, got {type(result)}"

    async def test_redis_disabled_still_returns_200_with_etag(self) -> None:
        """AC#3 graceful pass-through: Redis disabled -> still 200s with an ETag.

        Real CacheService with cache_enabled=False (CacheService.enabled degrades
        get_or_set to calling the factory directly with no Redis calls).
        RED: TypeError -- list_news_items doesn't accept request/response kwargs yet.
        """
        from src.api.v1.news import list_news_items  # noqa: PLC0415

        mock_settings = MagicMock()
        mock_settings.cache_enabled = False
        real_cache = CacheService(redis_client=AsyncMock())
        db = _make_mock_db()
        response = Response()

        with (
            patch("src.core.cache.settings", mock_settings),
            patch("src.api.v1.news.get_cache", return_value=real_cache, create=True),
            patch("src.api.v1.news.NewsItemService") as mock_service_cls,
        ):
            mock_service_cls.return_value.get_list_slim = AsyncMock(
                return_value=_make_slim_response()
            )
            result = await list_news_items(
                request=_make_mock_request(),
                response=response,
                page=1,
                page_size=10,
                country=None,
                q=None,
                db=db,
            )

        assert isinstance(
            result, NewsSlimListResponse
        ), f"Expected a NewsSlimListResponse even with Redis disabled, got {type(result)}"
        assert response.headers.get("etag"), "Expected an ETag even when Redis caching is disabled"
        assert response.headers.get("cache-control") == "public, max-age=300"
