"""Service for interacting with the Claude API (Anthropic) for article analysis.

This service provides:
1. Analyze HTML content to discover articles suitable for Cypriot culture exam questions
2. Parse Claude's JSON response and validate article data
3. Normalize URLs (relative to absolute, remove tracking params)
4. Retry logic for rate limit errors with exponential backoff

Example Usage:
    from src.services.claude_service import claude_service

    articles, tokens_used = claude_service.analyze_html_for_articles(
        html_content="<html>...</html>",
        source_base_url="https://example.com"
    )
"""

import json
import re
from typing import List, Tuple
from urllib.parse import parse_qs, urlencode, urljoin, urlparse

from anthropic import Anthropic, APIError, APITimeoutError, RateLimitError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from src.config import settings
from src.core.logging import get_logger
from src.schemas.admin import DiscoveredArticle
from src.schemas.culture import GeneratedQuestionResponse

logger = get_logger(__name__)

# System prompt for Claude to analyze HTML and find articles about Cypriot culture
ARTICLE_DISCOVERY_SYSTEM_PROMPT = """You are an expert at identifying news articles suitable for a Cypriot culture exam.

Analyze the provided HTML from a news website and identify articles that would make good questions about CYPRUS specifically:
- Cypriot current events and politics
- Cypriot culture and traditions
- Cyprus history and historical commemorations
- Society and lifestyle in Cyprus
- Cultural events, festivals, and holidays in Cyprus

EXCLUDE articles about:
- Crime reports and accidents
- Weather forecasts
- Sponsored content and advertisements
- Photo galleries with minimal text
- Sports (unless culturally significant to Cyprus)
- News about Greece or other countries (unless directly related to Cyprus)

For each suitable article found, extract:
1. The full article URL
2. The article title/headline
3. Brief reasoning (1-2 sentences) explaining why it's good for Cypriot culture questions

Return ONLY a valid JSON array with objects containing "url", "title", and "reasoning" keys.
If no suitable articles found, return an empty array [].

Example response format:
[
  {
    "url": "/article/123",
    "title": "Cyprus Independence Day Celebrations",
    "reasoning": "Covers important national holiday and cultural traditions."
  }
]"""

# Tracking parameters to remove from URLs
TRACKING_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "ref",
    "fbclid",
    "gclid",
    "dclid",
    "msclkid",
    "twclid",
    "li_fat_id",
}

# System prompt for generating culture exam questions from article content
QUESTION_GENERATION_SYSTEM_PROMPT = """You are an expert at creating educational multiple-choice questions about Cypriot culture for an exam preparation application.

Given an article about Cyprus, generate a multiple-choice question that:
1. Tests knowledge that would be relevant for the Cypriot citizenship exam
2. Is based on factual information from the article
3. Has clear, unambiguous correct and incorrect answers
4. Is educational and helps learners understand Cypriot culture

CRITICAL REQUIREMENT - CONTEXTUAL INFORMATION:
Every question MUST include sufficient contextual information so that it stands alone without the article. Include:
- WHO: Name specific people, organizations, or groups involved
- WHEN: Include dates, time periods, or temporal context (e.g., "in 2024", "during the Ottoman period")
- WHERE: Name specific places in Cyprus (cities, regions, landmarks)
- WHAT: Clearly describe the event, tradition, or fact being asked about

BAD EXAMPLE (lacks context):
"What was announced at the event?"
- This is vague and meaningless without the article

GOOD EXAMPLE (includes context):
"What new initiative did the Cyprus Ministry of Education announce in January 2024 for schools in Nicosia?"
- WHO: Cyprus Ministry of Education
- WHEN: January 2024
- WHERE: Nicosia
- WHAT: New initiative for schools

IMPORTANT REQUIREMENTS:
- Generate EXACTLY 2 or 4 answer options (never 3)
- Use 2 options for True/False style questions
- Use 4 options for factual multiple-choice questions
- All text must be provided in three languages: Greek (el), English (en), and Russian (ru)
- The correct_option is 1-indexed (1 for first option, 2 for second, etc.)
- Category must be one of: history, geography, politics, culture, traditions, practical
- Difficulty must be one of: easy, medium, hard

Return ONLY a valid JSON object with this exact structure:
{
  "question_text": {
    "el": "Greek question text with WHO/WHEN/WHERE/WHAT context",
    "en": "English question text with WHO/WHEN/WHERE/WHAT context",
    "ru": "Russian question text with WHO/WHEN/WHERE/WHAT context"
  },
  "options": [
    {"el": "Option A in Greek", "en": "Option A in English", "ru": "Option A in Russian"},
    {"el": "Option B in Greek", "en": "Option B in English", "ru": "Option B in Russian"}
  ],
  "correct_option": 1,
  "category": "culture",
  "difficulty": "medium",
  "explanation": {
    "el": "Greek explanation of correct answer",
    "en": "English explanation of correct answer",
    "ru": "Russian explanation of correct answer"
  },
  "source_context": "Brief context about what aspect of the article was used"
}"""


class ClaudeServiceError(Exception):
    """Base exception for Claude service errors."""

    pass


class ClaudeService:
    """Service for analyzing HTML content using Claude API.

    Provides methods for:
    - Analyzing HTML to discover culture-related articles
    - Parsing and validating Claude's JSON responses
    - Normalizing and cleaning article URLs

    Attributes:
        client: Anthropic API client instance
    """

    def __init__(self) -> None:
        """Initialize the Claude service with Anthropic client."""
        self.client = Anthropic(api_key=settings.anthropic_api_key)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        retry=retry_if_exception_type(RateLimitError),
    )
    def analyze_html_for_articles(
        self,
        html_content: str,
        source_base_url: str,
    ) -> Tuple[List[DiscoveredArticle], int]:
        """Analyze HTML content to discover suitable articles.

        Uses Claude to analyze the provided HTML and extract articles
        that would be suitable for Cypriot culture exam questions.

        Args:
            html_content: Raw HTML content from a news source
            source_base_url: Base URL of the source for URL normalization

        Returns:
            Tuple of (list of discovered articles, tokens used)

        Raises:
            ClaudeServiceError: On API timeout or other API errors
            RateLimitError: On rate limit (will be retried by tenacity)
        """
        user_prompt = (
            "Analyze this HTML and find articles suitable for "
            f"Cypriot culture exam questions:\n\n<html>\n{html_content}\n</html>"
        )

        try:
            response = self.client.messages.create(
                model=settings.claude_model,
                max_tokens=settings.claude_max_tokens,
                temperature=settings.claude_temperature,
                timeout=settings.claude_timeout,
                system=ARTICLE_DISCOVERY_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )

            tokens_used = response.usage.input_tokens + response.usage.output_tokens
            content_block = response.content[0]
            if not hasattr(content_block, "text"):
                raise ClaudeServiceError("Unexpected response format from Claude API")
            content = content_block.text

            logger.info(
                "Claude API call successful",
                extra={
                    "model": settings.claude_model,
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                    "total_tokens": tokens_used,
                },
            )

            # Parse and validate JSON response
            articles = self._parse_response(content, source_base_url)

            return articles, tokens_used

        except APITimeoutError as e:
            logger.error(
                "Claude API timeout",
                extra={"timeout": settings.claude_timeout, "error": str(e)},
            )
            raise ClaudeServiceError(f"API timeout after {settings.claude_timeout} seconds") from e

        except RateLimitError:
            logger.warning("Claude API rate limit hit, will retry")
            raise  # Will be retried by tenacity

        except APIError as e:
            logger.error("Claude API error", extra={"error": str(e)})
            raise ClaudeServiceError(f"API error: {str(e)}") from e

    def _find_matching_bracket(self, content: str, start_idx: int = 0) -> str | None:
        """Find JSON array by matching brackets from start position.

        Args:
            content: String to search
            start_idx: Position of opening bracket

        Returns:
            Extracted JSON string or None if no match found
        """
        bracket_count = 0
        for i in range(start_idx, len(content)):
            if content[i] == "[":
                bracket_count += 1
            elif content[i] == "]":
                bracket_count -= 1
                if bracket_count == 0:
                    return content[start_idx : i + 1]
        return None

    def _extract_json_from_response(self, content: str) -> str:
        """Extract JSON array from Claude's response.

        Handles various response formats:
        1. Pure JSON array
        2. JSON within markdown code blocks (```json ... ```)
        3. JSON array embedded in natural language text

        Args:
            content: Raw response text from Claude

        Returns:
            Extracted JSON string
        """
        content = content.strip()

        # Try 1: Direct JSON array (starts with '[')
        if content.startswith("["):
            result = self._find_matching_bracket(content, 0)
            return result if result else content

        # Try 2: Extract from markdown code block
        code_block_pattern = r"```(?:json)?\s*\n?([\s\S]*?)\n?```"
        match = re.search(code_block_pattern, content)
        if match:
            extracted = match.group(1).strip()
            if extracted.startswith("["):
                return extracted

        # Try 3: Find JSON array anywhere in the text
        start_idx = content.find("[")
        if start_idx != -1:
            result = self._find_matching_bracket(content, start_idx)
            if result:
                return result

        # Fallback: return original content
        return content

    def _parse_response(
        self,
        content: str,
        source_base_url: str,
    ) -> List[DiscoveredArticle]:
        """Parse Claude's JSON response and validate/normalize URLs.

        Args:
            content: Raw response text from Claude
            source_base_url: Base URL for normalizing relative URLs

        Returns:
            List of validated DiscoveredArticle objects

        Raises:
            ClaudeServiceError: If JSON is invalid
        """
        # Extract JSON from response (handles markdown blocks, preamble text, etc.)
        json_content = self._extract_json_from_response(content)

        try:
            raw_articles = json.loads(json_content)
        except json.JSONDecodeError as e:
            logger.error(
                "Invalid JSON from Claude",
                extra={"content_preview": content[:500], "error": str(e)},
            )
            raise ClaudeServiceError(f"Invalid JSON response: {str(e)}") from e

        if not isinstance(raw_articles, list):
            logger.error(
                "Claude response is not a list",
                extra={"type": type(raw_articles).__name__},
            )
            raise ClaudeServiceError("Response is not a JSON array")

        articles: List[DiscoveredArticle] = []
        for item in raw_articles:
            # Validate required fields
            if not isinstance(item, dict):
                logger.warning("Skipping non-dict item in response", extra={"item": item})
                continue

            if not all(k in item for k in ["url", "title", "reasoning"]):
                logger.warning(
                    "Skipping article with missing fields",
                    extra={"item": item},
                )
                continue

            # Normalize URL
            url = self._normalize_url(str(item["url"]), source_base_url)

            articles.append(
                DiscoveredArticle(
                    url=url,
                    title=str(item["title"]),
                    reasoning=str(item["reasoning"]),
                )
            )

        logger.info(
            "Parsed articles from Claude response",
            extra={"article_count": len(articles)},
        )

        return articles

    def _normalize_url(self, url: str, base_url: str) -> str:
        """Convert relative URLs to absolute and remove tracking params.

        Args:
            url: URL to normalize (may be relative or absolute)
            base_url: Base URL for resolving relative URLs

        Returns:
            Normalized absolute URL without tracking parameters
        """
        # Convert relative to absolute
        if not url.startswith(("http://", "https://")):
            url = urljoin(base_url, url)

        # Parse URL and remove tracking parameters
        parsed = urlparse(url)
        params = parse_qs(parsed.query)

        # Filter out tracking parameters (case-insensitive)
        filtered_params = {k: v for k, v in params.items() if k.lower() not in TRACKING_PARAMS}

        # Rebuild URL
        clean_query = urlencode(filtered_params, doseq=True)
        clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if clean_query:
            clean_url += f"?{clean_query}"

        return clean_url

    def _find_matching_brace(self, content: str, start_idx: int = 0) -> str | None:
        """Find JSON object by matching braces from start position.

        Args:
            content: String to search
            start_idx: Position of opening brace

        Returns:
            Extracted JSON string or None if no match found
        """
        brace_count = 0
        in_string = False
        escape_next = False

        for i in range(start_idx, len(content)):
            char = content[i]

            if escape_next:
                escape_next = False
                continue

            if char == "\\" and in_string:
                escape_next = True
                continue

            if char == '"' and not escape_next:
                in_string = not in_string
                continue

            if in_string:
                continue

            if char == "{":
                brace_count += 1
            elif char == "}":
                brace_count -= 1
                if brace_count == 0:
                    return content[start_idx : i + 1]

        return None

    def _extract_json_object_from_response(self, content: str) -> str:
        """Extract JSON object from Claude's response.

        Handles various response formats:
        1. Pure JSON object
        2. JSON within markdown code blocks
        3. JSON object embedded in natural language text

        Args:
            content: Raw response text from Claude

        Returns:
            Extracted JSON string
        """
        content = content.strip()

        # Try 1: Direct JSON object (starts with '{')
        if content.startswith("{"):
            result = self._find_matching_brace(content, 0)
            return result if result else content

        # Try 2: Extract from markdown code block
        code_block_pattern = r"```(?:json)?\s*\n?([\s\S]*?)\n?```"
        match = re.search(code_block_pattern, content)
        if match:
            extracted = match.group(1).strip()
            if extracted.startswith("{"):
                return extracted

        # Try 3: Find JSON object anywhere in the text
        start_idx = content.find("{")
        if start_idx != -1:
            result = self._find_matching_brace(content, start_idx)
            if result:
                return result

        # Fallback: return original content
        return content

    def _parse_question_response(self, content: str) -> GeneratedQuestionResponse:
        """Parse Claude's JSON response for question generation.

        Args:
            content: Raw response text from Claude

        Returns:
            Validated GeneratedQuestionResponse object

        Raises:
            ClaudeServiceError: If JSON is invalid or doesn't match schema
        """
        json_content = self._extract_json_object_from_response(content)

        try:
            raw_question = json.loads(json_content)
        except json.JSONDecodeError as e:
            logger.error(
                "Invalid JSON from Claude for question generation",
                extra={"content_preview": content[:500], "error": str(e)},
            )
            raise ClaudeServiceError(f"Invalid JSON response: {str(e)}") from e

        if not isinstance(raw_question, dict):
            logger.error(
                "Claude question response is not an object",
                extra={"type": type(raw_question).__name__},
            )
            raise ClaudeServiceError("Response is not a JSON object")

        try:
            question = GeneratedQuestionResponse(**raw_question)
        except Exception as e:
            logger.error(
                "Failed to validate question response",
                extra={"error": str(e), "raw_question": raw_question},
            )
            raise ClaudeServiceError(f"Invalid question response: {str(e)}") from e

        logger.info(
            "Parsed question from Claude response",
            extra={
                "category": question.category,
                "difficulty": question.difficulty,
                "options_count": len(question.options),
            },
        )

        return question

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        retry=retry_if_exception_type(RateLimitError),
    )
    def generate_culture_question(
        self,
        html_content: str,
        article_url: str,
        article_title: str,
    ) -> tuple[GeneratedQuestionResponse, int]:
        """Generate a culture question from article HTML content.

        Uses Claude to analyze the article and create an educational
        multiple-choice question suitable for the Cypriot culture exam.

        Args:
            html_content: Raw HTML content of the article
            article_url: URL of the source article (for reference)
            article_title: Title of the article

        Returns:
            Tuple of (generated question response, tokens used)

        Raises:
            ClaudeServiceError: On API timeout, invalid response, or other API errors
            RateLimitError: On rate limit (will be retried by tenacity)
        """
        # Log warning for large HTML content
        html_size_kb = len(html_content.encode("utf-8")) / 1024
        if html_size_kb > 100:
            logger.warning(
                "Large HTML content for question generation",
                extra={
                    "html_size_kb": round(html_size_kb, 2),
                    "article_url": article_url,
                    "article_title": article_title,
                },
            )

        user_prompt = (
            f"Generate a culture exam question based on this article.\n\n"
            f"Article Title: {article_title}\n"
            f"Article URL: {article_url}\n\n"
            f"<article>\n{html_content}\n</article>"
        )

        try:
            response = self.client.messages.create(
                model=settings.claude_model,
                max_tokens=settings.claude_max_tokens,
                temperature=settings.claude_temperature,
                timeout=settings.claude_timeout,
                system=QUESTION_GENERATION_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )

            tokens_used = response.usage.input_tokens + response.usage.output_tokens
            content_block = response.content[0]
            if not hasattr(content_block, "text"):
                raise ClaudeServiceError("Unexpected response format from Claude API")
            content = content_block.text

            logger.info(
                "Claude question generation API call successful",
                extra={
                    "model": settings.claude_model,
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                    "total_tokens": tokens_used,
                    "article_url": article_url,
                },
            )

            question = self._parse_question_response(content)

            return question, tokens_used

        except APITimeoutError as e:
            logger.error(
                "Claude API timeout during question generation",
                extra={
                    "timeout": settings.claude_timeout,
                    "article_url": article_url,
                    "error": str(e),
                },
            )
            raise ClaudeServiceError(f"API timeout after {settings.claude_timeout} seconds") from e

        except RateLimitError:
            logger.warning(
                "Claude API rate limit hit during question generation, will retry",
                extra={"article_url": article_url},
            )
            raise  # Will be retried by tenacity

        except APIError as e:
            logger.error(
                "Claude API error during question generation",
                extra={"article_url": article_url, "error": str(e)},
            )
            raise ClaudeServiceError(f"API error: {str(e)}") from e


# Singleton instance for easy import
claude_service = ClaudeService()
