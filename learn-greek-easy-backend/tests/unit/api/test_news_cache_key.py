"""RED tests for the /news Redis cache-key helper (PERF-17-02, Backlog task-1245, T02-8).

Stage 2.5 Mode A (author-before-implement): `_news_cache_key` does not exist
yet in `src/api/v1/news.py`. Each test imports the helper LAZILY inside the
test body (not at module import time) so this file COLLECTS cleanly; the RED
failure surfaces as an ImportError at test-run time instead of a pytest
collection error (per the Stage 2.5 RED-semantics discipline).

F5 (Stage-1 Architecture validation, task-1245): the free-text `q` query
param must be HASHED into the cache key
(``news:list:{country}:{q_hash}:{page}:{page_size}``), never embedded
verbatim -- two distinct colon-laden `q` values must map to distinct keys
(no collision from naive string concatenation with the `:` key separator),
and a blank/None `q` collapses to the literal segment "none".
"""

import pytest


@pytest.mark.unit
class TestNewsCacheKeyHashesQuery:
    """RED: _news_cache_key doesn't exist yet in src/api/v1/news.py."""

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
