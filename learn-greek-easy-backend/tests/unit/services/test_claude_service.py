"""Unit tests for Claude Service.

Tests cover:
- JSON response parsing (valid, with markdown, invalid)
- URL normalization (relative URLs, tracking params)
- Error handling for missing fields
"""

import pytest

from src.services.claude_service import ClaudeService, ClaudeServiceError

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def claude_service():
    """Create a ClaudeService instance for testing."""
    # We only test internal methods that don't require API calls
    return ClaudeService()


# ============================================================================
# Test: _parse_response
# ============================================================================


class TestParseResponse:
    """Tests for ClaudeService._parse_response method."""

    def test_parse_response_valid_json(self, claude_service):
        """Valid JSON array is parsed correctly."""
        content = """[
            {
                "url": "https://example.com/article/1",
                "title": "Cyprus Independence Day",
                "reasoning": "Covers national holiday traditions."
            },
            {
                "url": "https://example.com/article/2",
                "title": "Cypriot Easter Customs",
                "reasoning": "Important religious and cultural celebration."
            }
        ]"""

        articles = claude_service._parse_response(content, "https://example.com")

        assert len(articles) == 2
        assert articles[0].url == "https://example.com/article/1"
        assert articles[0].title == "Cyprus Independence Day"
        assert articles[0].reasoning == "Covers national holiday traditions."
        assert articles[1].url == "https://example.com/article/2"
        assert articles[1].title == "Cypriot Easter Customs"

    def test_parse_response_with_markdown_blocks(self, claude_service):
        """Strips markdown code blocks from response."""
        content = """```json
[
    {
        "url": "/article/test",
        "title": "Test Article",
        "reasoning": "Test reasoning."
    }
]
```"""

        articles = claude_service._parse_response(content, "https://example.com")

        assert len(articles) == 1
        assert articles[0].title == "Test Article"

    def test_parse_response_with_plain_code_blocks(self, claude_service):
        """Strips plain code blocks without json specifier."""
        content = """```
[
    {
        "url": "/article/plain",
        "title": "Plain Block",
        "reasoning": "Works too."
    }
]
```"""

        articles = claude_service._parse_response(content, "https://example.com")

        assert len(articles) == 1
        assert articles[0].title == "Plain Block"

    def test_parse_response_empty_array(self, claude_service):
        """Empty array returns empty list."""
        content = "[]"

        articles = claude_service._parse_response(content, "https://example.com")

        assert len(articles) == 0

    def test_parse_response_invalid_json(self, claude_service):
        """Invalid JSON raises ClaudeServiceError."""
        content = "not valid json {"

        with pytest.raises(ClaudeServiceError) as exc_info:
            claude_service._parse_response(content, "https://example.com")

        assert "Invalid JSON response" in str(exc_info.value)

    def test_parse_response_not_array(self, claude_service):
        """Non-array JSON raises ClaudeServiceError."""
        content = '{"url": "/test", "title": "Test", "reasoning": "test"}'

        with pytest.raises(ClaudeServiceError) as exc_info:
            claude_service._parse_response(content, "https://example.com")

        assert "not a JSON array" in str(exc_info.value)

    def test_parse_response_missing_fields(self, claude_service):
        """Articles with missing fields are skipped."""
        content = """[
            {
                "url": "/article/1",
                "title": "Valid Article",
                "reasoning": "Has all fields."
            },
            {
                "url": "/article/2",
                "title": "Missing Reasoning"
            },
            {
                "url": "/article/3",
                "reasoning": "Missing Title"
            },
            {
                "title": "Missing URL",
                "reasoning": "No URL field."
            }
        ]"""

        articles = claude_service._parse_response(content, "https://example.com")

        # Only the first article has all required fields
        assert len(articles) == 1
        assert articles[0].title == "Valid Article"

    def test_parse_response_skips_non_dict_items(self, claude_service):
        """Non-dict items in array are skipped."""
        content = """[
            "string item",
            123,
            {
                "url": "/valid",
                "title": "Valid",
                "reasoning": "OK"
            },
            null
        ]"""

        articles = claude_service._parse_response(content, "https://example.com")

        assert len(articles) == 1
        assert articles[0].title == "Valid"


# ============================================================================
# Test: _normalize_url
# ============================================================================


class TestNormalizeUrl:
    """Tests for ClaudeService._normalize_url method."""

    def test_normalize_url_relative(self, claude_service):
        """Relative URLs are converted to absolute."""
        result = claude_service._normalize_url(
            "/article/123",
            "https://example.com",
        )

        assert result == "https://example.com/article/123"

    def test_normalize_url_relative_with_path(self, claude_service):
        """Relative URLs work with base URL that has a path."""
        result = claude_service._normalize_url(
            "article/456",
            "https://example.com/news/",
        )

        assert result == "https://example.com/news/article/456"

    def test_normalize_url_absolute_unchanged(self, claude_service):
        """Absolute URLs are kept as-is (except tracking params)."""
        result = claude_service._normalize_url(
            "https://other.com/article/789",
            "https://example.com",
        )

        assert result == "https://other.com/article/789"

    def test_normalize_url_removes_tracking(self, claude_service):
        """UTM and other tracking parameters are removed."""
        url = (
            "https://example.com/article?id=123"
            "&utm_source=facebook"
            "&utm_medium=social"
            "&utm_campaign=test"
            "&utm_content=link"
            "&utm_term=keyword"
        )

        result = claude_service._normalize_url(url, "https://example.com")

        assert result == "https://example.com/article?id=123"

    def test_normalize_url_removes_all_tracking_types(self, claude_service):
        """All known tracking parameters are removed."""
        url = (
            "https://example.com/article"
            "?page=1"
            "&ref=homepage"
            "&fbclid=abc123"
            "&gclid=def456"
            "&dclid=ghi789"
            "&msclkid=jkl012"
            "&twclid=mno345"
            "&li_fat_id=pqr678"
        )

        result = claude_service._normalize_url(url, "https://example.com")

        assert result == "https://example.com/article?page=1"

    def test_normalize_url_preserves_valid_params(self, claude_service):
        """Non-tracking query parameters are preserved."""
        url = "https://example.com/search?q=cyprus&page=2&sort=date&lang=el"

        result = claude_service._normalize_url(url, "https://example.com")

        # All params should be preserved
        assert "q=cyprus" in result
        assert "page=2" in result
        assert "sort=date" in result
        assert "lang=el" in result

    def test_normalize_url_no_query_string(self, claude_service):
        """URLs without query strings work correctly."""
        result = claude_service._normalize_url(
            "https://example.com/article/clean-url",
            "https://example.com",
        )

        assert result == "https://example.com/article/clean-url"

    def test_normalize_url_only_tracking_params(self, claude_service):
        """URL with only tracking params has no query string after normalization."""
        url = "https://example.com/article?utm_source=test&fbclid=abc"

        result = claude_service._normalize_url(url, "https://example.com")

        assert result == "https://example.com/article"
        assert "?" not in result

    def test_normalize_url_case_insensitive_tracking(self, claude_service):
        """Tracking param removal is case-insensitive."""
        url = "https://example.com/article?UTM_SOURCE=test&Utm_Medium=email&id=1"

        result = claude_service._normalize_url(url, "https://example.com")

        assert "utm" not in result.lower()
        assert "id=1" in result

    def test_normalize_url_http_preserved(self, claude_service):
        """HTTP scheme is preserved (not forced to HTTPS)."""
        result = claude_service._normalize_url(
            "http://example.com/article",
            "https://base.com",
        )

        assert result.startswith("http://")
        assert result == "http://example.com/article"
