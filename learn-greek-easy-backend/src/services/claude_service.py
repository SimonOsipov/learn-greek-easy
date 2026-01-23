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
from typing import List, Tuple
from urllib.parse import parse_qs, urlencode, urljoin, urlparse

from anthropic import Anthropic, APIError, APITimeoutError, RateLimitError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from src.config import settings
from src.core.logging import get_logger
from src.schemas.admin import DiscoveredArticle

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
        # Strip markdown code blocks if present
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        try:
            raw_articles = json.loads(content)
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


# Singleton instance for easy import
claude_service = ClaudeService()
