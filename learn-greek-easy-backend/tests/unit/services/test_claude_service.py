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


# ============================================================================
# Test: Question Generation Helpers
# ============================================================================


class TestFindMatchingBrace:
    """Tests for ClaudeService._find_matching_brace method."""

    def test_find_simple_object(self, claude_service):
        """Simple JSON object is extracted correctly."""
        content = '{"key": "value"}'
        result = claude_service._find_matching_brace(content, 0)
        assert result == '{"key": "value"}'

    def test_find_nested_object(self, claude_service):
        """Nested JSON objects are extracted correctly."""
        content = '{"outer": {"inner": "value"}}'
        result = claude_service._find_matching_brace(content, 0)
        assert result == '{"outer": {"inner": "value"}}'

    def test_find_object_with_string_braces(self, claude_service):
        """Braces inside strings are ignored."""
        content = '{"key": "value with { and }"}'
        result = claude_service._find_matching_brace(content, 0)
        assert result == '{"key": "value with { and }"}'

    def test_find_object_with_escaped_quotes(self, claude_service):
        """Escaped quotes in strings are handled correctly."""
        content = '{"key": "value with \\"escaped\\" quotes"}'
        result = claude_service._find_matching_brace(content, 0)
        assert result == '{"key": "value with \\"escaped\\" quotes"}'

    def test_find_object_with_backslash(self, claude_service):
        """Backslashes in strings are handled correctly."""
        content = '{"path": "C:\\\\Users\\\\test"}'
        result = claude_service._find_matching_brace(content, 0)
        assert result == '{"path": "C:\\\\Users\\\\test"}'

    def test_find_no_matching_brace(self, claude_service):
        """Returns None when no matching brace found."""
        content = '{"incomplete": "object"'
        result = claude_service._find_matching_brace(content, 0)
        assert result is None


class TestExtractJsonObjectFromResponse:
    """Tests for ClaudeService._extract_json_object_from_response method."""

    def test_extract_direct_json(self, claude_service):
        """Direct JSON object is extracted correctly."""
        content = '{"question": "What is Cyprus known for?"}'
        result = claude_service._extract_json_object_from_response(content)
        assert result == '{"question": "What is Cyprus known for?"}'

    def test_extract_from_markdown_block(self, claude_service):
        """JSON is extracted from markdown code block."""
        content = """```json
{"question": "What is the capital?"}
```"""
        result = claude_service._extract_json_object_from_response(content)
        assert result == '{"question": "What is the capital?"}'

    def test_extract_from_plain_markdown(self, claude_service):
        """JSON is extracted from plain markdown block."""
        content = """```
{"answer": "Nicosia"}
```"""
        result = claude_service._extract_json_object_from_response(content)
        assert result == '{"answer": "Nicosia"}'

    def test_extract_from_preamble(self, claude_service):
        """JSON is extracted when preceded by preamble text."""
        content = """Here is the generated question:

{"category": "history"}"""
        result = claude_service._extract_json_object_from_response(content)
        assert result == '{"category": "history"}'

    def test_extract_from_preamble_with_markdown(self, claude_service):
        """JSON is extracted from markdown after preamble text."""
        content = """I've analyzed the article and generated this question:

```json
{"difficulty": "medium"}
```

Let me know if you need adjustments."""
        result = claude_service._extract_json_object_from_response(content)
        assert result == '{"difficulty": "medium"}'

    def test_extract_complex_nested_json(self, claude_service):
        """Complex nested JSON objects are extracted correctly."""
        content = (
            """{"question_text": {"el": "Greek", "en": "English"}, "options": [{"el": "A"}]}"""
        )
        result = claude_service._extract_json_object_from_response(content)
        assert '"question_text"' in result
        assert '"options"' in result


class TestParseQuestionResponse:
    """Tests for ClaudeService._parse_question_response method."""

    def test_parse_valid_2_option_question(self, claude_service):
        """Valid 2-option question is parsed correctly."""
        content = """{
            "question_text": {"el": "Greek Q", "en": "English Q", "ru": "Russian Q"},
            "options": [
                {"el": "True", "en": "True", "ru": "True"},
                {"el": "False", "en": "False", "ru": "False"}
            ],
            "correct_option": 1,
            "category": "history",
            "difficulty": "easy",
            "explanation": {"el": "E", "en": "E", "ru": "E"},
            "source_context": "From article about Cyprus"
        }"""

        result = claude_service._parse_question_response(content)

        assert len(result.options) == 2
        assert result.correct_option == 1
        assert result.category == "history"
        assert result.difficulty == "easy"

    def test_parse_valid_4_option_question(self, claude_service):
        """Valid 4-option question is parsed correctly."""
        content = """{
            "question_text": {"el": "Q", "en": "Q", "ru": "Q"},
            "options": [
                {"el": "A", "en": "A", "ru": "A"},
                {"el": "B", "en": "B", "ru": "B"},
                {"el": "C", "en": "C", "ru": "C"},
                {"el": "D", "en": "D", "ru": "D"}
            ],
            "correct_option": 3,
            "category": "geography",
            "difficulty": "hard",
            "explanation": {"el": "E", "en": "E", "ru": "E"},
            "source_context": "Geographic facts"
        }"""

        result = claude_service._parse_question_response(content)

        assert len(result.options) == 4
        assert result.correct_option == 3
        assert result.category == "geography"

    def test_parse_invalid_3_option_question(self, claude_service):
        """3-option question raises ClaudeServiceError."""
        content = """{
            "question_text": {"el": "Q", "en": "Q", "ru": "Q"},
            "options": [
                {"el": "A", "en": "A", "ru": "A"},
                {"el": "B", "en": "B", "ru": "B"},
                {"el": "C", "en": "C", "ru": "C"}
            ],
            "correct_option": 2,
            "category": "culture",
            "difficulty": "medium",
            "explanation": {"el": "E", "en": "E", "ru": "E"},
            "source_context": "Test"
        }"""

        with pytest.raises(ClaudeServiceError) as exc_info:
            claude_service._parse_question_response(content)

        assert "Options must be exactly 2" in str(exc_info.value)

    def test_parse_correct_option_exceeds_count(self, claude_service):
        """correct_option exceeding options count raises ClaudeServiceError."""
        content = """{
            "question_text": {"el": "Q", "en": "Q", "ru": "Q"},
            "options": [
                {"el": "A", "en": "A", "ru": "A"},
                {"el": "B", "en": "B", "ru": "B"}
            ],
            "correct_option": 3,
            "category": "politics",
            "difficulty": "easy",
            "explanation": {"el": "E", "en": "E", "ru": "E"},
            "source_context": "Test"
        }"""

        with pytest.raises(ClaudeServiceError) as exc_info:
            claude_service._parse_question_response(content)

        assert "correct_option" in str(exc_info.value)
        assert "exceeds" in str(exc_info.value)

    def test_parse_invalid_json(self, claude_service):
        """Invalid JSON raises ClaudeServiceError."""
        content = "not valid json {"

        with pytest.raises(ClaudeServiceError) as exc_info:
            claude_service._parse_question_response(content)

        assert "Invalid JSON response" in str(exc_info.value)

    def test_parse_not_object(self, claude_service):
        """Non-object JSON raises ClaudeServiceError."""
        content = '["array", "instead", "of", "object"]'

        with pytest.raises(ClaudeServiceError) as exc_info:
            claude_service._parse_question_response(content)

        assert "not a JSON object" in str(exc_info.value)

    def test_parse_missing_required_field(self, claude_service):
        """Missing required field raises ClaudeServiceError."""
        content = """{
            "question_text": {"el": "Q", "en": "Q", "ru": "Q"},
            "options": [
                {"el": "A", "en": "A", "ru": "A"},
                {"el": "B", "en": "B", "ru": "B"}
            ],
            "correct_option": 1,
            "category": "history"
        }"""
        # Missing: difficulty, explanation, source_context

        with pytest.raises(ClaudeServiceError) as exc_info:
            claude_service._parse_question_response(content)

        assert "Invalid question response" in str(exc_info.value)

    def test_parse_invalid_category(self, claude_service):
        """Invalid category value raises ClaudeServiceError."""
        content = """{
            "question_text": {"el": "Q", "en": "Q", "ru": "Q"},
            "options": [
                {"el": "A", "en": "A", "ru": "A"},
                {"el": "B", "en": "B", "ru": "B"}
            ],
            "correct_option": 1,
            "category": "invalid_category",
            "difficulty": "easy",
            "explanation": {"el": "E", "en": "E", "ru": "E"},
            "source_context": "Test"
        }"""

        with pytest.raises(ClaudeServiceError) as exc_info:
            claude_service._parse_question_response(content)

        assert "Invalid question response" in str(exc_info.value)

    def test_parse_invalid_difficulty(self, claude_service):
        """Invalid difficulty value raises ClaudeServiceError."""
        content = """{
            "question_text": {"el": "Q", "en": "Q", "ru": "Q"},
            "options": [
                {"el": "A", "en": "A", "ru": "A"},
                {"el": "B", "en": "B", "ru": "B"}
            ],
            "correct_option": 1,
            "category": "history",
            "difficulty": "super_hard",
            "explanation": {"el": "E", "en": "E", "ru": "E"},
            "source_context": "Test"
        }"""

        with pytest.raises(ClaudeServiceError) as exc_info:
            claude_service._parse_question_response(content)

        assert "Invalid question response" in str(exc_info.value)

    def test_parse_from_markdown_with_preamble(self, claude_service):
        """JSON in markdown block after preamble is parsed correctly."""
        content = """Here is the generated culture question based on the article:

```json
{
    "question_text": {"el": "G", "en": "E", "ru": "R"},
    "options": [
        {"el": "O1", "en": "O1", "ru": "O1"},
        {"el": "O2", "en": "O2", "ru": "O2"}
    ],
    "correct_option": 2,
    "category": "traditions",
    "difficulty": "medium",
    "explanation": {"el": "Ex", "en": "Ex", "ru": "Ex"},
    "source_context": "From the traditional festivals section"
}
```

I hope this question captures the cultural significance described in the article."""

        result = claude_service._parse_question_response(content)

        assert len(result.options) == 2
        assert result.correct_option == 2
        assert result.category == "traditions"
        assert result.source_context == "From the traditional festivals section"

    def test_parse_all_valid_categories(self, claude_service):
        """All valid category values are accepted."""
        valid_categories = [
            "history",
            "geography",
            "politics",
            "culture",
            "traditions",
            "practical",
        ]

        for category in valid_categories:
            content = f"""{{
                "question_text": {{"el": "Q", "en": "Q", "ru": "Q"}},
                "options": [
                    {{"el": "A", "en": "A", "ru": "A"}},
                    {{"el": "B", "en": "B", "ru": "B"}}
                ],
                "correct_option": 1,
                "category": "{category}",
                "difficulty": "easy",
                "explanation": {{"el": "E", "en": "E", "ru": "E"}},
                "source_context": "Test"
            }}"""

            result = claude_service._parse_question_response(content)
            assert result.category == category

    def test_parse_all_valid_difficulties(self, claude_service):
        """All valid difficulty values are accepted."""
        valid_difficulties = ["easy", "medium", "hard"]

        for difficulty in valid_difficulties:
            content = f"""{{
                "question_text": {{"el": "Q", "en": "Q", "ru": "Q"}},
                "options": [
                    {{"el": "A", "en": "A", "ru": "A"}},
                    {{"el": "B", "en": "B", "ru": "B"}}
                ],
                "correct_option": 1,
                "category": "history",
                "difficulty": "{difficulty}",
                "explanation": {{"el": "E", "en": "E", "ru": "E"}},
                "source_context": "Test"
            }}"""

            result = claude_service._parse_question_response(content)
            assert result.difficulty == difficulty


# ============================================================================
# Test: Question Generation System Prompt
# ============================================================================


class TestQuestionGenerationPrompt:
    """Tests for QUESTION_GENERATION_SYSTEM_PROMPT constant."""

    def test_prompt_is_defined(self):
        """System prompt constant is defined."""
        from src.services.claude_service import QUESTION_GENERATION_SYSTEM_PROMPT

        assert QUESTION_GENERATION_SYSTEM_PROMPT is not None
        assert len(QUESTION_GENERATION_SYSTEM_PROMPT) > 100

    def test_prompt_specifies_option_count_rule(self):
        """Prompt specifies the 2 or 4 options rule."""
        from src.services.claude_service import QUESTION_GENERATION_SYSTEM_PROMPT

        assert (
            "2 or 4" in QUESTION_GENERATION_SYSTEM_PROMPT
            or "EXACTLY 2 or 4" in QUESTION_GENERATION_SYSTEM_PROMPT
        )

    def test_prompt_specifies_multilingual(self):
        """Prompt specifies multilingual requirements."""
        from src.services.claude_service import QUESTION_GENERATION_SYSTEM_PROMPT

        assert "Greek" in QUESTION_GENERATION_SYSTEM_PROMPT
        assert "English" in QUESTION_GENERATION_SYSTEM_PROMPT
        assert "Russian" in QUESTION_GENERATION_SYSTEM_PROMPT

    def test_prompt_specifies_categories(self):
        """Prompt specifies valid category values."""
        from src.services.claude_service import QUESTION_GENERATION_SYSTEM_PROMPT

        assert "history" in QUESTION_GENERATION_SYSTEM_PROMPT
        assert "geography" in QUESTION_GENERATION_SYSTEM_PROMPT
        assert "politics" in QUESTION_GENERATION_SYSTEM_PROMPT
        assert "culture" in QUESTION_GENERATION_SYSTEM_PROMPT
        assert "traditions" in QUESTION_GENERATION_SYSTEM_PROMPT
        assert "practical" in QUESTION_GENERATION_SYSTEM_PROMPT

    def test_prompt_specifies_difficulties(self):
        """Prompt specifies valid difficulty values."""
        from src.services.claude_service import QUESTION_GENERATION_SYSTEM_PROMPT

        assert "easy" in QUESTION_GENERATION_SYSTEM_PROMPT
        assert "medium" in QUESTION_GENERATION_SYSTEM_PROMPT
        assert "hard" in QUESTION_GENERATION_SYSTEM_PROMPT

    def test_prompt_specifies_1_indexed_correct_option(self):
        """Prompt specifies that correct_option is 1-indexed."""
        from src.services.claude_service import QUESTION_GENERATION_SYSTEM_PROMPT

        assert (
            "1-indexed" in QUESTION_GENERATION_SYSTEM_PROMPT
            or "1 for first" in QUESTION_GENERATION_SYSTEM_PROMPT
        )
