"""Tests for the /news Redis cache-key helper (PERF-17-02, Backlog task-1245, T02-8).

`_news_cache_key` lives in `src/api/v1/news.py`. Each test imports the helper
lazily inside the test body (matches the original Stage 2.5 RED-authoring
convention for this file; kept for consistency even now that the helper is
implemented).

F5 (Stage-1 Architecture validation, task-1245): the free-text `q` query
param must be HASHED into the cache key
(``news:list:{country}:{q_hash}:{page}:{page_size}``), never embedded
verbatim -- two distinct colon-laden `q` values must map to distinct keys
(no collision from naive string concatenation with the `:` key separator),
and a blank/None `q` collapses to the literal segment "none".
"""

import pytest

from src.db.models import NewsCountry


@pytest.mark.unit
class TestNewsCacheKeyHashesQuery:
    """F5: _news_cache_key hashes q so colon-laden values can't collide."""

    def test_distinct_colon_laden_q_values_produce_distinct_keys(self) -> None:
        """F5: q='a:b:c' and q='a:b' must NOT collide once q is hashed."""
        from src.api.v1.news import _news_cache_key  # noqa: PLC0415

        key_1 = _news_cache_key(country=None, q="a:b:c", page=1, page_size=6)
        key_2 = _news_cache_key(country=None, q="a:b", page=1, page_size=6)

        assert (
            key_1 != key_2
        ), f"Expected distinct keys for distinct q values, got identical key {key_1!r}"

    def test_blank_q_maps_to_none_segment(self) -> None:
        """Blank/None q collapses to the literal 'none' key segment."""
        from src.api.v1.news import _news_cache_key  # noqa: PLC0415

        key = _news_cache_key(country=None, q=None, page=1, page_size=6)

        assert key == "news:list:all:none:1:6", f"Unexpected key: {key!r}"

    def test_raw_q_never_appears_verbatim_in_key(self) -> None:
        """The raw q string is HASHED -- it must never leak as a literal substring."""
        from src.api.v1.news import _news_cache_key  # noqa: PLC0415

        q = "a:b:c"
        key = _news_cache_key(country=None, q=q, page=1, page_size=6)

        assert q not in key, f"Raw q {q!r} leaked verbatim into cache key {key!r}"


# =============================================================================
# QA-added adversarial coverage (Mode B): unicode q + page/page_size boundaries
# =============================================================================


@pytest.mark.unit
class TestNewsCacheKeyAdversarial:
    """Edge cases the Mode A RED authoring didn't cover: non-ASCII q input and
    the page/page_size boundary values allowed by the endpoint's Query bounds
    (page>=1, 1<=page_size<=50)."""

    def test_unicode_q_produces_stable_ascii_key(self) -> None:
        """Greek q must hash to a stable, pure-ASCII key -- no UnicodeEncodeError,
        no raw non-ASCII bytes leaking into the Redis key."""
        from src.api.v1.news import _news_cache_key  # noqa: PLC0415

        q = "ελληνικά νέα"
        key_1 = _news_cache_key(country=None, q=q, page=1, page_size=10)
        key_2 = _news_cache_key(country=None, q=q, page=1, page_size=10)

        assert key_1 == key_2, "Same unicode q must hash deterministically across calls"
        assert key_1.isascii(), f"Expected a pure-ASCII cache key, got {key_1!r}"
        assert q not in key_1, f"Raw unicode q {q!r} leaked verbatim into cache key {key_1!r}"

    def test_unicode_q_casing_and_whitespace_normalize_to_same_key(self) -> None:
        """q is .strip().lower()'d before hashing -- casing/whitespace variants
        of the same query must collapse to one cache entry, not fragment it."""
        from src.api.v1.news import _news_cache_key  # noqa: PLC0415

        key_1 = _news_cache_key(country=None, q="Ελληνικά", page=1, page_size=10)
        key_2 = _news_cache_key(country=None, q="  ελληνικά  ", page=1, page_size=10)

        assert key_1 == key_2, "Casing/whitespace variants of the same q must share a cache key"

    def test_page_and_page_size_boundaries_are_distinct_keys(self) -> None:
        """page/page_size sit at the extremes the endpoint's Query bounds allow
        (page>=1, 1<=page_size<=50) -- each combination must be its own key so
        pagination never collides on a shared cache entry."""
        from src.api.v1.news import _news_cache_key  # noqa: PLC0415

        key_min = _news_cache_key(country=None, q=None, page=1, page_size=1)
        key_max = _news_cache_key(country=None, q=None, page=1, page_size=50)
        key_other_page = _news_cache_key(country=None, q=None, page=999, page_size=1)

        assert key_min == "news:list:all:none:1:1"
        assert key_max == "news:list:all:none:1:50"
        assert key_other_page == "news:list:all:none:999:1"
        assert (
            len({key_min, key_max, key_other_page}) == 3
        ), "Boundary combinations must not collide"

    def test_country_segment_uses_enum_value(self) -> None:
        """country is embedded via .value (not str(enum)) -- guards against a
        regression that would leak 'NewsCountry.CYPRUS' into the Redis key."""
        from src.api.v1.news import _news_cache_key  # noqa: PLC0415

        key = _news_cache_key(country=NewsCountry.CYPRUS, q=None, page=1, page_size=10)

        assert key == "news:list:cyprus:none:1:10", f"Unexpected key: {key!r}"
