"""Unit tests for ClaudeService.generate_culture_question method.

Tests cover:
- Successful generation of 2-option (True/False) questions
- Successful generation of 4-option (multiple choice) questions
- Token usage tracking
- JSON extraction from markdown code blocks
- Error handling (invalid JSON, wrong option count)
- Warning logging for large HTML content
"""

import json
import logging
from unittest.mock import MagicMock, patch

import pytest

from src.services.claude_service import ClaudeService, ClaudeServiceError

# ============================================================================
# Valid Response Fixtures
# ============================================================================


VALID_2_OPTION_RESPONSE = {
    "question_text": {"el": "Σωστό ή λάθος;", "en": "True or false?", "ru": "Правда или ложь?"},
    "options": [
        {"el": "Σωστό", "en": "True", "ru": "Правда"},
        {"el": "Λάθος", "en": "False", "ru": "Ложь"},
    ],
    "correct_option": 1,
    "category": "history",
    "difficulty": "easy",
    "explanation": {"el": "Επεξήγηση", "en": "Explanation", "ru": "Объяснение"},
    "source_context": "From article about Cyprus",
}

VALID_4_OPTION_RESPONSE = {
    "question_text": {"el": "Ερώτηση;", "en": "Question?", "ru": "Вопрос?"},
    "options": [
        {"el": "Α", "en": "A", "ru": "А"},
        {"el": "Β", "en": "B", "ru": "Б"},
        {"el": "Γ", "en": "C", "ru": "В"},
        {"el": "Δ", "en": "D", "ru": "Г"},
    ],
    "correct_option": 3,
    "category": "geography",
    "difficulty": "medium",
    "explanation": {"el": "Επεξήγηση", "en": "Explanation", "ru": "Объяснение"},
    "source_context": "Geographic information",
}


# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def mock_anthropic():
    """Mock the Anthropic client."""
    with patch("src.services.claude_service.Anthropic") as mock:
        yield mock


def create_mock_response(content: str, input_tokens: int = 1000, output_tokens: int = 500):
    """Create a mock Claude API response."""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=content)]
    mock_response.usage = MagicMock(input_tokens=input_tokens, output_tokens=output_tokens)
    return mock_response


# ============================================================================
# Success Cases
# ============================================================================


class TestGenerateCultureQuestionSuccess:
    """Tests for successful question generation."""

    def test_generate_2_option_question_success(self, mock_anthropic):
        """Test successful generation of 2-option (True/False) question."""
        mock_client = MagicMock()
        mock_client.messages.create.return_value = create_mock_response(
            json.dumps(VALID_2_OPTION_RESPONSE)
        )
        mock_anthropic.return_value = mock_client

        service = ClaudeService()
        result, tokens = service.generate_culture_question(
            html_content="<html>Test content</html>",
            article_url="https://example.com/article",
            article_title="Test Article",
        )

        assert len(result.options) == 2
        assert result.correct_option == 1
        assert result.category == "history"
        assert result.difficulty == "easy"
        assert tokens == 1500

    def test_generate_4_option_question_success(self, mock_anthropic):
        """Test successful generation of 4-option question."""
        mock_client = MagicMock()
        mock_client.messages.create.return_value = create_mock_response(
            json.dumps(VALID_4_OPTION_RESPONSE),
            input_tokens=800,
            output_tokens=400,
        )
        mock_anthropic.return_value = mock_client

        service = ClaudeService()
        result, tokens = service.generate_culture_question(
            html_content="<html>Test</html>",
            article_url="https://example.com/geo",
            article_title="Geography Article",
        )

        assert len(result.options) == 4
        assert result.correct_option == 3
        assert result.category == "geography"
        assert tokens == 1200


class TestTokensUsed:
    """Tests for token usage tracking."""

    def test_returns_tokens_used(self, mock_anthropic):
        """Test that tokens used is correctly calculated."""
        mock_client = MagicMock()
        mock_client.messages.create.return_value = create_mock_response(
            json.dumps(VALID_2_OPTION_RESPONSE),
            input_tokens=2000,
            output_tokens=1000,
        )
        mock_anthropic.return_value = mock_client

        service = ClaudeService()
        _, tokens = service.generate_culture_question(
            html_content="<html>Test</html>",
            article_url="https://example.com",
            article_title="Test",
        )

        assert tokens == 3000  # 2000 + 1000

    def test_tokens_with_different_values(self, mock_anthropic):
        """Test token calculation with various input/output combinations."""
        mock_client = MagicMock()
        mock_client.messages.create.return_value = create_mock_response(
            json.dumps(VALID_2_OPTION_RESPONSE),
            input_tokens=5000,
            output_tokens=250,
        )
        mock_anthropic.return_value = mock_client

        service = ClaudeService()
        _, tokens = service.generate_culture_question(
            html_content="<html>Large content</html>",
            article_url="https://example.com",
            article_title="Test",
        )

        assert tokens == 5250


class TestJsonExtraction:
    """Tests for JSON extraction from various response formats."""

    def test_extracts_json_from_markdown_block(self, mock_anthropic):
        """Test extraction of JSON from markdown code block."""
        response_with_markdown = (
            f"Here's the question:\n```json\n{json.dumps(VALID_2_OPTION_RESPONSE)}\n```"
        )
        mock_client = MagicMock()
        mock_client.messages.create.return_value = create_mock_response(response_with_markdown)
        mock_anthropic.return_value = mock_client

        service = ClaudeService()
        result, _ = service.generate_culture_question(
            html_content="<html>Test</html>",
            article_url="https://example.com",
            article_title="Test",
        )

        assert len(result.options) == 2
        assert result.category == "history"

    def test_extracts_json_from_plain_markdown_block(self, mock_anthropic):
        """Test extraction from markdown block without json specifier."""
        response_with_markdown = f"```\n{json.dumps(VALID_4_OPTION_RESPONSE)}\n```"
        mock_client = MagicMock()
        mock_client.messages.create.return_value = create_mock_response(response_with_markdown)
        mock_anthropic.return_value = mock_client

        service = ClaudeService()
        result, _ = service.generate_culture_question(
            html_content="<html>Test</html>",
            article_url="https://example.com",
            article_title="Test",
        )

        assert len(result.options) == 4
        assert result.category == "geography"

    def test_extracts_json_from_preamble_text(self, mock_anthropic):
        """Test extraction when JSON is preceded by preamble text."""
        response_with_preamble = (
            f"I've analyzed the article and generated this question:\n\n"
            f"{json.dumps(VALID_2_OPTION_RESPONSE)}"
        )
        mock_client = MagicMock()
        mock_client.messages.create.return_value = create_mock_response(response_with_preamble)
        mock_anthropic.return_value = mock_client

        service = ClaudeService()
        result, _ = service.generate_culture_question(
            html_content="<html>Test</html>",
            article_url="https://example.com",
            article_title="Test",
        )

        assert result.category == "history"
        assert len(result.options) == 2


# ============================================================================
# Error Cases
# ============================================================================


class TestGenerateCultureQuestionErrors:
    """Tests for error handling in question generation."""

    def test_raises_error_on_invalid_json(self, mock_anthropic):
        """Test ClaudeServiceError raised for invalid JSON response."""
        mock_client = MagicMock()
        mock_client.messages.create.return_value = create_mock_response(
            "This is not valid JSON at all"
        )
        mock_anthropic.return_value = mock_client

        service = ClaudeService()
        with pytest.raises(ClaudeServiceError, match="Invalid JSON"):
            service.generate_culture_question(
                html_content="<html>Test</html>",
                article_url="https://example.com",
                article_title="Test",
            )

    def test_raises_error_on_3_options(self, mock_anthropic):
        """Test error raised when response has 3 options (invalid)."""
        invalid_response = {
            **VALID_4_OPTION_RESPONSE,
            "options": [
                {"el": "Α", "en": "A", "ru": "А"},
                {"el": "Β", "en": "B", "ru": "Б"},
                {"el": "Γ", "en": "C", "ru": "В"},
            ],
        }
        mock_client = MagicMock()
        mock_client.messages.create.return_value = create_mock_response(
            json.dumps(invalid_response)
        )
        mock_anthropic.return_value = mock_client

        service = ClaudeService()
        with pytest.raises(ClaudeServiceError) as exc_info:
            service.generate_culture_question(
                html_content="<html>Test</html>",
                article_url="https://example.com",
                article_title="Test",
            )

        assert "2" in str(exc_info.value) and "4" in str(exc_info.value)

    def test_raises_error_on_1_option(self, mock_anthropic):
        """Test error raised when response has only 1 option (invalid)."""
        invalid_response = {
            **VALID_2_OPTION_RESPONSE,
            "options": [
                {"el": "Σωστό", "en": "True", "ru": "Правда"},
            ],
        }
        mock_client = MagicMock()
        mock_client.messages.create.return_value = create_mock_response(
            json.dumps(invalid_response)
        )
        mock_anthropic.return_value = mock_client

        service = ClaudeService()
        with pytest.raises(ClaudeServiceError):
            service.generate_culture_question(
                html_content="<html>Test</html>",
                article_url="https://example.com",
                article_title="Test",
            )

    def test_raises_error_on_5_options(self, mock_anthropic):
        """Test error raised when response has 5 options (invalid)."""
        invalid_response = {
            **VALID_4_OPTION_RESPONSE,
            "options": [
                {"el": "Α", "en": "A", "ru": "А"},
                {"el": "Β", "en": "B", "ru": "Б"},
                {"el": "Γ", "en": "C", "ru": "В"},
                {"el": "Δ", "en": "D", "ru": "Г"},
                {"el": "Ε", "en": "E", "ru": "Д"},
            ],
        }
        mock_client = MagicMock()
        mock_client.messages.create.return_value = create_mock_response(
            json.dumps(invalid_response)
        )
        mock_anthropic.return_value = mock_client

        service = ClaudeService()
        with pytest.raises(ClaudeServiceError):
            service.generate_culture_question(
                html_content="<html>Test</html>",
                article_url="https://example.com",
                article_title="Test",
            )

    def test_raises_error_on_not_object(self, mock_anthropic):
        """Test ClaudeServiceError raised for non-object JSON response."""
        mock_client = MagicMock()
        mock_client.messages.create.return_value = create_mock_response('["array", "instead"]')
        mock_anthropic.return_value = mock_client

        service = ClaudeService()
        with pytest.raises(ClaudeServiceError, match="not a JSON object"):
            service.generate_culture_question(
                html_content="<html>Test</html>",
                article_url="https://example.com",
                article_title="Test",
            )

    def test_raises_error_on_missing_required_fields(self, mock_anthropic):
        """Test error raised when response missing required fields."""
        incomplete_response = {
            "question_text": {"el": "Q", "en": "Q", "ru": "Q"},
            "options": [
                {"el": "A", "en": "A", "ru": "A"},
                {"el": "B", "en": "B", "ru": "B"},
            ],
            # Missing: correct_option, category, difficulty, explanation, source_context
        }
        mock_client = MagicMock()
        mock_client.messages.create.return_value = create_mock_response(
            json.dumps(incomplete_response)
        )
        mock_anthropic.return_value = mock_client

        service = ClaudeService()
        with pytest.raises(ClaudeServiceError, match="Invalid question response"):
            service.generate_culture_question(
                html_content="<html>Test</html>",
                article_url="https://example.com",
                article_title="Test",
            )


# ============================================================================
# Logging Tests
# ============================================================================


class TestGenerateCultureQuestionLogging:
    """Tests for logging behavior in question generation."""

    def test_logs_warning_for_large_html(self, mock_anthropic, caplog_loguru):
        """Test warning is logged for HTML content over 100KB."""
        mock_client = MagicMock()
        mock_client.messages.create.return_value = create_mock_response(
            json.dumps(VALID_2_OPTION_RESPONSE),
            input_tokens=5000,
            output_tokens=500,
        )
        mock_anthropic.return_value = mock_client

        service = ClaudeService()
        # Create HTML content larger than 100KB
        large_html = "<html>" + "x" * 150000 + "</html>"

        with caplog_loguru.at_level(logging.WARNING):
            service.generate_culture_question(
                html_content=large_html,
                article_url="https://example.com",
                article_title="Test",
            )

        assert "Large HTML content" in caplog_loguru.text

    def test_no_warning_for_small_html(self, mock_anthropic, caplog_loguru):
        """Test no warning is logged for HTML content under 100KB."""
        mock_client = MagicMock()
        mock_client.messages.create.return_value = create_mock_response(
            json.dumps(VALID_2_OPTION_RESPONSE)
        )
        mock_anthropic.return_value = mock_client

        service = ClaudeService()
        small_html = "<html>Small content</html>"

        with caplog_loguru.at_level(logging.WARNING):
            service.generate_culture_question(
                html_content=small_html,
                article_url="https://example.com",
                article_title="Test",
            )

        assert "Large HTML content" not in caplog_loguru.text


# ============================================================================
# API Call Verification
# ============================================================================


class TestGenerateCultureQuestionApiCall:
    """Tests to verify correct API call parameters."""

    def test_api_called_with_correct_parameters(self, mock_anthropic):
        """Test that Claude API is called with correct parameters."""
        mock_client = MagicMock()
        mock_client.messages.create.return_value = create_mock_response(
            json.dumps(VALID_2_OPTION_RESPONSE)
        )
        mock_anthropic.return_value = mock_client

        service = ClaudeService()
        service.generate_culture_question(
            html_content="<html>Article content</html>",
            article_url="https://example.com/test",
            article_title="Test Title",
        )

        # Verify API was called
        mock_client.messages.create.assert_called_once()
        call_kwargs = mock_client.messages.create.call_args[1]

        # Verify messages contains user prompt with article info
        messages = call_kwargs["messages"]
        assert len(messages) == 1
        assert messages[0]["role"] == "user"
        assert "Test Title" in messages[0]["content"]
        assert "https://example.com/test" in messages[0]["content"]
        assert "<article>" in messages[0]["content"]
