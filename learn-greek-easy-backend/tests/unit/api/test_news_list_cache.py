"""Tests for GET /api/v1/news HTTP + Redis read-through caching (PERF-17-02).

Mirrors tests/unit/api/test_decks_list_cache.py: calls the `list_news_items`
endpoint function DIRECTLY (no HTTP test client / DB), patching
`src.api.v1.news.get_cache` (`create=True` is required since the patch target
doesn't exist as a module-level name until imported, mirroring the
decks/dashboard precedents) and `src.api.v1.news.NewsItemService` so no
Postgres connection is needed.

Covers Test Specs (Backlog task-1245):
- T02-1: Cache-Control: public, max-age=300 + ETag present; NO Vary (D6)
- T02-2: If-None-Match matching the current ETag -> 304, empty body, same ETag
- T02-3: Redis miss stores at the expected key; a hit skips the service call
- T02-6: Redis disabled -> still 200 + ETag (graceful pass-through)

Plus QA-added (Mode B) adversarial coverage: ETag determinism across the
Redis JSON round-trip (cache-miss body vs. cache-hit body must hash
identically, or If-None-Match silently stops matching after a cache
turnover) and 304/200 header parity.
"""

import json
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
    """Header-setting / 304 logic in src/api/v1/news.py (AC#1/AC#2)."""

    async def test_public_list_sets_cache_control_and_etag_no_vary(self) -> None:
        """AC#1: response carries Cache-Control: public, max-age=300 + ETag, no Vary."""
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
        """AC#2: a repeat request with If-None-Match: <etag> returns 304 + empty body + same ETag."""
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
    """get_cache wiring in src/api/v1/news.py (AC#3/AC#5/AC#6)."""

    async def test_cache_miss_stores_at_expected_key(self) -> None:
        """AC#3/AC#5: miss path stores at cache:news:list:{country}:{q_hash}:{page}:{page_size}."""
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

        assert (
            mock_redis.setex.call_count == 1
        ), f"Expected a single setex call for the public list, got {mock_redis.setex.call_count}"
        actual_key, actual_ttl, _payload = mock_redis.setex.call_args[0]
        assert actual_key == "cache:news:list:all:none:1:10", f"Wrong cache key: {actual_key!r}"
        assert actual_ttl == 300, f"Wrong TTL: {actual_ttl}"

    async def test_cache_hit_skips_service_call(self) -> None:
        """AC#3: a cache hit must not re-invoke NewsItemService.get_list_slim."""
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


# =============================================================================
# QA-added (Mode B) adversarial: ETag determinism across the Redis JSON
# round-trip -- the highest-risk correctness item for AC#2's 304 short-circuit.
# =============================================================================
#
# `CacheService.set()` serializes the factory's dict via
# `json.dumps(value, default=str)` (src/core/cache.py); a subsequent
# `CacheService.get()` (cache HIT) deserializes it back via `json.loads(...)`.
# `list_news_items` then feeds that dict straight into `_news_etag()` -- the
# exact same function it uses for a fresh cache-MISS dict. If the JSON
# round-trip changed anything a plain equality/`sort_keys=True` re-dump
# wouldn't reproduce, a client's `If-None-Match` computed against a MISS
# response would stop matching once the entry falls to a HIT, and AC#2's 304
# short-circuit would silently never fire again for that key until the TTL
# expires and the cycle repeats.


@pytest.mark.unit
class TestNewsEtagDeterminism:
    """AC#2 guard: _news_etag must be identical for a body dict computed fresh
    (cache-miss path) and the same dict after a Redis JSON round-trip
    (cache-hit path)."""

    def test_etag_stable_across_redis_json_round_trip(self) -> None:
        """Reproduces the exact hit-path transform (`json.loads(json.dumps(...,
        default=str))`) that `CacheService.get()`/`set()` apply, and asserts the
        ETag doesn't change."""
        from src.api.v1.news import _news_etag  # noqa: PLC0415

        body = _make_slim_response(total=3).model_dump(mode="json")
        etag_fresh = _news_etag(body)

        # Mirrors CacheService.set() -> CacheService.get(): json.dumps(default=str)
        # then json.loads(), exactly as a real cache-hit would deliver the value.
        round_tripped = json.loads(json.dumps(body, default=str))
        etag_round_tripped = _news_etag(round_tripped)

        assert etag_fresh == etag_round_tripped, (
            "ETag differs between a freshly-computed body (cache-miss path) and "
            "the same body after a Redis JSON round-trip (cache-hit path) -- "
            "If-None-Match would silently stop matching after a cache turnover"
        )

    def test_etag_deterministic_for_independent_computations(self) -> None:
        """Two independent computations of the ETag for an equal-but-distinct
        dict object must agree (guards against any hidden mutation/identity
        dependence in `_news_etag`)."""
        from src.api.v1.news import _news_etag  # noqa: PLC0415

        body = _make_slim_response(total=2).model_dump(mode="json")
        etag_1 = _news_etag(dict(body))
        etag_2 = _news_etag(dict(body))

        assert etag_1 == etag_2

    async def test_cache_hit_via_round_tripped_dict_matches_original_miss_etag(
        self,
    ) -> None:
        """End-to-end through the router: a cache HIT whose `get_or_set` return
        value has been through a real JSON round-trip (mimicking a genuine
        Redis GET) must yield the identical ETag/If-None-Match behavior as the
        original MISS response for the same underlying content."""
        from src.api.v1.news import _news_etag, list_news_items  # noqa: PLC0415

        slim = _make_slim_response(total=5)
        fresh_dict = slim.model_dump(mode="json")
        expected_etag = _news_etag(fresh_dict)

        # Simulate exactly what a real Redis HIT hands back: json.loads(json.dumps(...)).
        hit_dict = json.loads(json.dumps(fresh_dict, default=str))
        mock_cache = MagicMock()
        mock_cache.get_or_set = AsyncMock(return_value=hit_dict)
        db = _make_mock_db()
        response = Response()

        with (
            patch("src.api.v1.news.get_cache", return_value=mock_cache, create=True),
            patch("src.api.v1.news.NewsItemService") as mock_service_cls,
        ):
            mock_service_cls.return_value.get_list_slim = AsyncMock(return_value=slim)
            result = await list_news_items(
                request=_make_mock_request(if_none_match=expected_etag),
                response=response,
                page=1,
                page_size=10,
                country=None,
                q=None,
                db=db,
            )

        assert isinstance(result, Response), (
            "A pre-computed If-None-Match should 304 even when served from a "
            f"round-tripped cache HIT, got {type(result)}"
        )
        assert result.status_code == 304, (
            "ETag mismatch between the cache-miss ETag and the round-tripped "
            f"cache-hit ETag broke the 304 short-circuit: got {result.status_code}"
        )
        assert result.headers.get("etag") == expected_etag


# =============================================================================
# QA-added (Mode B) adversarial: 304 response must carry the same ETag +
# Cache-Control it would carry on 200 (some clients require both on 304 too).
# =============================================================================


@pytest.mark.unit
class TestNewsList304HeaderParity:
    """The 304 response must be a valid substitute for the 200 it short-circuits:
    same ETag, same Cache-Control."""

    async def test_304_carries_same_cache_control_as_200(self) -> None:
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
            expected_cache_control = first_response.headers.get("cache-control")
            assert etag and expected_cache_control

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
        assert result.status_code == 304
        assert result.headers.get("cache-control") == expected_cache_control, (
            "304 response must carry the same Cache-Control as the 200 it "
            f"short-circuits, got {result.headers.get('cache-control')!r}"
        )
