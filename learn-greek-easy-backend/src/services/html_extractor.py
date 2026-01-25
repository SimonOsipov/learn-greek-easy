"""Service for extracting clean content from HTML articles.

This service provides:
1. Extract article content from HTML (title, body text, metadata)
2. Remove noise elements (scripts, ads, navigation, social widgets)
3. Site-specific selectors for known Greek/Cypriot news sites
4. Fallback extraction using semantic HTML elements
5. Token estimation for Claude API budgeting

Example Usage:
    from src.services.html_extractor import html_extractor

    result = html_extractor.extract(
        html_content="<html>...</html>",
        source_url="https://sigmalive.com/article"
    )
    print(f"Title: {result.title}")
    print(f"Tokens: {result.estimated_tokens}")
"""

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

from bs4 import BeautifulSoup, Tag

from src.core.logging import get_logger

logger = get_logger(__name__)

# Approximate characters per token for English (Greek text is denser)
CHARS_PER_TOKEN_ENGLISH = 4
CHARS_PER_TOKEN_GREEK = 3

# Tags that contain noise/non-content elements
NOISE_TAGS = [
    "script",
    "style",
    "noscript",
    "svg",
    "iframe",
    "canvas",
    "video",
    "audio",
    "form",
    "button",
    "input",
    "select",
    "textarea",
]

# CSS selectors for noise elements to remove
NOISE_SELECTORS = [
    "nav",
    "header",
    "footer",
    "aside",
    ".advertisement",
    ".ad",
    ".ads",
    "[class*='ad-']",
    "[class*='-ad']",
    "[id*='ad-']",
    "[id*='-ad']",
    ".social-share",
    ".social-buttons",
    ".share-buttons",
    ".related-articles",
    ".related-posts",
    ".recommended",
    ".comments",
    ".comment-section",
    ".newsletter",
    ".subscribe",
    ".sidebar",
    ".widget",
    ".breadcrumb",
    ".breadcrumbs",
    ".pagination",
    ".cookie-banner",
    ".popup",
    ".modal",
    ".menu",
    ".navigation",
    "[role='navigation']",
    "[role='banner']",
    "[role='contentinfo']",
    "[role='complementary']",
]

# Common date formats for parsing
DATE_FORMATS = [
    "%Y-%m-%dT%H:%M:%S%z",  # ISO 8601 with timezone
    "%Y-%m-%dT%H:%M:%S.%f%z",  # ISO 8601 with microseconds
    "%Y-%m-%dT%H:%M:%SZ",  # ISO 8601 UTC
    "%Y-%m-%dT%H:%M:%S",  # ISO 8601 without timezone
    "%Y-%m-%d %H:%M:%S",  # Standard datetime
    "%Y-%m-%d",  # Date only
    "%d/%m/%Y %H:%M",  # European format with time
    "%d/%m/%Y",  # European date
    "%d-%m-%Y",  # European with dashes
    "%B %d, %Y",  # Month name format
    "%d %B %Y",  # Day Month Year
]


@dataclass
class ExtractedContent:
    """Container for extracted article content.

    Attributes:
        title: Article title/headline
        main_text: Cleaned article body text
        publication_date: Parsed publication datetime if found
        author: Article author name if found
        estimated_tokens: Approximate token count for Claude API
        extraction_method: Method used ("site_specific" or "fallback")
    """

    title: str
    main_text: str
    publication_date: Optional[datetime]
    author: Optional[str]
    estimated_tokens: int
    extraction_method: str  # "site_specific" or "fallback"


@dataclass
class SiteConfig:
    """Configuration for site-specific content extraction.

    Attributes:
        domain: Domain name to match (e.g., "sigmalive.com")
        article_container: CSS selector for article container
        title_selector: CSS selector for article title
        content_selector: CSS selector for article body
        date_selector: CSS selector for publication date (optional)
        author_selector: CSS selector for author name (optional)
        date_format: strptime format for date parsing (optional)
    """

    domain: str
    article_container: str
    title_selector: str
    content_selector: str
    date_selector: Optional[str] = None
    author_selector: Optional[str] = None
    date_format: Optional[str] = None


class HTMLContentExtractorError(Exception):
    """Exception raised when HTML content extraction fails."""

    pass


class HTMLContentExtractor:
    """Service for extracting clean content from HTML articles.

    Provides site-specific extraction for known news sites and
    fallback extraction using semantic HTML elements.

    Attributes:
        site_configs: Dictionary mapping domains to SiteConfig
    """

    def __init__(self) -> None:
        """Initialize the extractor with site configurations."""
        self.site_configs: dict[str, SiteConfig] = self._build_site_configs()

    def _build_site_configs(self) -> dict[str, SiteConfig]:
        """Build site-specific configuration dictionary.

        Returns:
            Dictionary mapping domains to their extraction configs
        """
        configs = [
            SiteConfig(
                domain="sigmalive.com",
                article_container="article, .article-content, .story-content",
                title_selector="h1, .article-title, .story-title",
                content_selector=".article-body, .story-body, .article-text, article p",
                date_selector=".article-date, .story-date, time[datetime]",
                author_selector=".article-author, .author-name, .byline",
                date_format=None,  # Will try common formats
            ),
            SiteConfig(
                domain="philenews.com",
                article_container="article, .article, .news-article",
                title_selector="h1, .article-title, .news-title",
                content_selector=".article-content, .article-body, .news-body, article p",
                date_selector=".article-date, .publish-date, time[datetime]",
                author_selector=".author, .article-author, .journalist",
                date_format=None,
            ),
            SiteConfig(
                domain="cyprus-mail.com",
                article_container="article, .post-content, .entry-content",
                title_selector="h1.entry-title, h1, .post-title",
                content_selector=".entry-content, .post-body, article p",
                date_selector=".post-date, .entry-date, time[datetime]",
                author_selector=".author, .post-author, .byline",
                date_format=None,
            ),
            SiteConfig(
                domain="politis.com.cy",
                article_container="article, .article-wrapper, .news-article",
                title_selector="h1, .article-title, .news-headline",
                content_selector=".article-content, .article-body, .news-text, article p",
                date_selector=".article-date, .news-date, time",
                author_selector=".author-name, .article-author",
                date_format=None,
            ),
            SiteConfig(
                domain="reporter.com.cy",
                article_container="article, .article, .report-content",
                title_selector="h1, .article-title, .report-title",
                content_selector=".article-body, .report-body, .article-text, article p",
                date_selector=".article-date, .report-date, time[datetime]",
                author_selector=".author, .reporter-name",
                date_format=None,
            ),
        ]

        return {config.domain: config for config in configs}

    def extract(self, html_content: str, source_url: str) -> ExtractedContent:
        """Extract clean content from HTML.

        First attempts site-specific extraction if the domain is known,
        then falls back to generic extraction using semantic HTML.

        Args:
            html_content: Raw HTML content to extract from
            source_url: URL of the source for domain detection

        Returns:
            ExtractedContent with cleaned article content

        Raises:
            HTMLContentExtractorError: If extraction completely fails
        """
        if not html_content or not html_content.strip():
            raise HTMLContentExtractorError("Empty HTML content provided")

        soup = BeautifulSoup(html_content, "html.parser")

        # Remove noise elements first
        self._remove_noise_elements(soup)

        # Get site config if available
        config = self._get_site_config(source_url)

        if config:
            logger.debug(
                "Using site-specific extraction",
                extra={"domain": config.domain, "url": source_url},
            )
            try:
                result = self._extract_with_config(soup, config)
                if result and result.main_text.strip():
                    return result
            except Exception as e:
                logger.warning(
                    "Site-specific extraction failed, falling back",
                    extra={"domain": config.domain, "error": str(e)},
                )

        # Fallback extraction
        logger.debug(
            "Using fallback extraction",
            extra={"url": source_url},
        )
        return self._extract_fallback(soup)

    def _get_site_config(self, url: str) -> Optional[SiteConfig]:
        """Get site configuration for a URL's domain.

        Args:
            url: URL to extract domain from

        Returns:
            SiteConfig if domain is known, None otherwise
        """
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            # Remove www. prefix if present
            if domain.startswith("www."):
                domain = domain[4:]

            # Check for exact match or subdomain match
            for config_domain, config in self.site_configs.items():
                if domain == config_domain or domain.endswith(f".{config_domain}"):
                    return config

            return None
        except Exception:
            return None

    def _extract_with_config(
        self, soup: BeautifulSoup, config: SiteConfig
    ) -> Optional[ExtractedContent]:
        """Extract content using site-specific configuration.

        Args:
            soup: Parsed HTML document
            config: Site-specific extraction configuration

        Returns:
            ExtractedContent if extraction succeeds, None otherwise
        """
        # Extract title
        title = self._extract_title_with_config(soup, config)

        # Try to find article container first
        container = soup.select_one(config.article_container)
        search_context = container if container else soup

        # Extract main content
        main_text = self._extract_content_with_config(search_context, config, container)

        if not main_text.strip():
            return None

        # Extract date and author
        publication_date = self._extract_date_with_config(search_context, config)
        author = self._extract_author_with_config(search_context, config)

        # Fall back to title from <title> tag if not found
        if not title:
            title = self._extract_title_from_tag(soup)

        return ExtractedContent(
            title=title or "Untitled",
            main_text=main_text,
            publication_date=publication_date,
            author=author,
            estimated_tokens=self._estimate_tokens(f"{title}\n\n{main_text}"),
            extraction_method="site_specific",
        )

    def _extract_title_with_config(self, soup: BeautifulSoup, config: SiteConfig) -> str:
        """Extract title using site-specific selector."""
        title_element = soup.select_one(config.title_selector)
        if title_element:
            return self._extract_text_from_element(title_element)
        return ""

    def _extract_title_from_tag(self, soup: BeautifulSoup) -> str:
        """Extract and clean title from <title> tag."""
        title_tag = soup.find("title")
        if title_tag:
            title: str = title_tag.get_text(strip=True)
            # Clean up common title suffixes
            for separator in [" | ", " - ", " :: ", " // "]:
                if separator in title:
                    title = title.split(separator)[0].strip()
            return title
        return ""

    def _extract_content_with_config(
        self,
        search_context: BeautifulSoup | Tag,
        config: SiteConfig,
        container: Optional[Tag],
    ) -> str:
        """Extract main content using site-specific selectors."""
        # First try to find a content container (div with article body)
        content_container = self._find_content_container(search_context, config)

        if content_container:
            main_text = self._extract_paragraphs_deduped(content_container, min_length=30)
        else:
            main_text = self._extract_from_selectors(search_context, config)

        # If no content found, try container paragraphs
        if not main_text.strip() and container:
            main_text = self._extract_paragraphs_deduped(container, min_length=20)

        return main_text

    def _find_content_container(
        self, search_context: BeautifulSoup | Tag, config: SiteConfig
    ) -> Optional[Tag]:
        """Find content container from selector."""
        for selector_part in config.content_selector.split(","):
            selector_part = selector_part.strip()
            # Only check for container selectors (class-based, not tag-based)
            if selector_part.startswith(".") or selector_part.startswith("#"):
                content_container = search_context.select_one(selector_part)
                if content_container:
                    return content_container
        return None

    def _extract_paragraphs_deduped(self, element: Tag, min_length: int = 20) -> str:
        """Extract paragraphs with deduplication."""
        paragraphs = []
        seen_text: set[str] = set()
        for p in element.find_all("p"):
            text = self._extract_text_from_element(p)
            if text and len(text) > min_length and text not in seen_text:
                paragraphs.append(text)
                seen_text.add(text)
        return "\n\n".join(paragraphs)

    def _extract_from_selectors(
        self, search_context: BeautifulSoup | Tag, config: SiteConfig
    ) -> str:
        """Extract content from CSS selectors directly."""
        content_elements = search_context.select(config.content_selector)
        paragraphs = []
        seen_text: set[str] = set()
        for element in content_elements:
            if element.name in ("div", "section", "article"):
                for p in element.find_all("p"):
                    text = self._extract_text_from_element(p)
                    if text and len(text) > 30 and text not in seen_text:
                        paragraphs.append(text)
                        seen_text.add(text)
            else:
                text = self._extract_text_from_element(element)
                if text and len(text) > 30 and text not in seen_text:
                    paragraphs.append(text)
                    seen_text.add(text)
        return "\n\n".join(paragraphs)

    def _extract_date_with_config(
        self, search_context: BeautifulSoup | Tag, config: SiteConfig
    ) -> Optional[datetime]:
        """Extract publication date using config selector."""
        if not config.date_selector:
            return None
        date_element = search_context.select_one(config.date_selector)
        if date_element:
            date_str = date_element.get("datetime") or date_element.get_text(strip=True)
            if date_str:
                return self._parse_date(str(date_str), config.date_format)
        return None

    def _extract_author_with_config(
        self, search_context: BeautifulSoup | Tag, config: SiteConfig
    ) -> Optional[str]:
        """Extract author using config selector."""
        if not config.author_selector:
            return None
        author_element = search_context.select_one(config.author_selector)
        if author_element:
            return self._extract_text_from_element(author_element)
        return None

    def _extract_fallback(self, soup: BeautifulSoup) -> ExtractedContent:
        """Extract content using fallback strategies.

        Tries multiple strategies in order:
        1. Look for <article> tag
        2. Look for <main> tag
        3. Look for common article class names
        4. Find largest text block

        Args:
            soup: Parsed HTML document

        Returns:
            ExtractedContent with extracted content
        """
        title = self._extract_fallback_title(soup)
        main_text = self._try_fallback_strategies(soup)

        return ExtractedContent(
            title=title or "Untitled",
            main_text=main_text or "",
            publication_date=self._extract_date_from_soup(soup) if main_text else None,
            author=self._extract_author_from_soup(soup) if main_text else None,
            estimated_tokens=self._estimate_tokens(f"{title}\n\n{main_text}"),
            extraction_method="fallback",
        )

    def _extract_fallback_title(self, soup: BeautifulSoup) -> str:
        """Extract title using fallback methods."""
        title = self._extract_title_from_tag(soup)

        # Try <h1> if <title> is generic or missing
        if not title or len(title) < 10:
            h1 = soup.find("h1")
            if h1:
                h1_text = self._extract_text_from_element(h1)
                if h1_text and len(h1_text) > len(title):
                    title = h1_text

        return title

    def _try_fallback_strategies(self, soup: BeautifulSoup) -> str:
        """Try various fallback strategies to extract content."""
        # Strategy 1: Look for <article> tag
        article = soup.find("article")
        if article:
            main_text = self._extract_paragraphs(article)
            if main_text:
                return main_text

        # Strategy 2: Look for <main> tag
        main = soup.find("main")
        if main:
            main_text = self._extract_paragraphs(main)
            if main_text:
                return main_text

        # Strategy 3: Look for common article classes
        main_text = self._try_common_selectors(soup)
        if main_text:
            return main_text

        # Strategy 4: Find largest text block
        largest_block = self._find_largest_text_block(soup)
        if largest_block:
            main_text = self._extract_paragraphs(largest_block)
            if main_text:
                return main_text

        # Last resort: Get all paragraphs from body
        body = soup.find("body")
        if body:
            return self._extract_paragraphs(body)

        return ""

    def _try_common_selectors(self, soup: BeautifulSoup) -> str:
        """Try common article CSS selectors."""
        common_selectors = [
            ".article-content",
            ".article-body",
            ".post-content",
            ".entry-content",
            ".story-content",
            ".news-content",
            ".content-body",
        ]
        for selector in common_selectors:
            content_div = soup.select_one(selector)
            if content_div:
                main_text = self._extract_paragraphs(content_div)
                if main_text:
                    return main_text
        return ""

    def _extract_paragraphs(self, element: Tag) -> str:
        """Extract text from all paragraph elements.

        Args:
            element: BeautifulSoup element to extract from

        Returns:
            Joined paragraph texts
        """
        paragraphs = []
        for p in element.find_all("p"):
            text = self._extract_text_from_element(p)
            if text and len(text) > 20:  # Skip very short paragraphs (likely noise)
                paragraphs.append(text)

        return "\n\n".join(paragraphs)

    def _remove_noise_elements(self, soup: BeautifulSoup) -> None:
        """Remove noise elements from the parsed HTML.

        Modifies the soup in-place to remove scripts, ads, navigation,
        and other non-content elements.

        Args:
            soup: BeautifulSoup object to clean
        """
        # Remove noise tags
        for tag_name in NOISE_TAGS:
            for element in soup.find_all(tag_name):
                element.decompose()

        # Remove elements matching noise selectors
        for selector in NOISE_SELECTORS:
            try:
                for element in soup.select(selector):
                    element.decompose()
            except Exception:
                # Some selectors may not be valid for all parsers
                pass

        # Remove HTML comments
        from bs4 import Comment

        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            comment.extract()

    def _extract_text_from_element(self, element: Tag) -> str:
        """Extract clean text from a BeautifulSoup element.

        Args:
            element: BeautifulSoup Tag to extract text from

        Returns:
            Cleaned text content
        """
        if not element:
            return ""

        # Get text with whitespace handling
        raw_text: str = element.get_text(separator=" ", strip=True)

        # Normalize whitespace
        text = re.sub(r"\s+", " ", raw_text)

        return text.strip()

    def _parse_date(self, date_str: str, date_format: Optional[str] = None) -> Optional[datetime]:
        """Parse a date string into a datetime object.

        Args:
            date_str: Date string to parse
            date_format: Optional specific format to try first

        Returns:
            Parsed datetime or None if parsing fails
        """
        if not date_str:
            return None

        date_str = date_str.strip()

        # Try specific format first if provided
        if date_format:
            try:
                return datetime.strptime(date_str, date_format)
            except ValueError:
                pass

        # Try common formats
        for fmt in DATE_FORMATS:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        # Try dateutil as last resort if available
        try:
            from dateutil import parser as date_parser

            return date_parser.parse(date_str)
        except Exception:
            pass

        return None

    def _extract_date_from_soup(self, soup: BeautifulSoup) -> Optional[datetime]:
        """Try to extract publication date from common locations.

        Args:
            soup: Parsed HTML document

        Returns:
            Parsed datetime or None
        """
        # Try time[datetime] first
        time_tag = soup.find("time", attrs={"datetime": True})
        if time_tag:
            date_str = time_tag.get("datetime")
            if date_str:
                result = self._parse_date(str(date_str))
                if result:
                    return result

        # Try meta tags
        for meta_name in ["article:published_time", "date", "DC.date", "pubdate"]:
            meta = soup.find("meta", attrs={"property": meta_name}) or soup.find(
                "meta", attrs={"name": meta_name}
            )
            if meta and meta.get("content"):
                result = self._parse_date(str(meta.get("content")))
                if result:
                    return result

        return None

    def _extract_author_from_soup(self, soup: BeautifulSoup) -> Optional[str]:
        """Try to extract author from common locations.

        Args:
            soup: Parsed HTML document

        Returns:
            Author name or None
        """
        # Try meta tags first
        for meta_name in ["author", "article:author", "DC.creator"]:
            meta = soup.find("meta", attrs={"property": meta_name}) or soup.find(
                "meta", attrs={"name": meta_name}
            )
            if meta and meta.get("content"):
                return str(meta.get("content")).strip()

        # Try common author selectors
        for selector in [".author", ".byline", '[rel="author"]', ".article-author"]:
            try:
                author_elem = soup.select_one(selector)
                if author_elem:
                    author = self._extract_text_from_element(author_elem)
                    if author and len(author) < 100:  # Sanity check
                        return author
            except Exception:
                pass

        return None

    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count for Claude API.

        Uses a simple character-based estimation:
        - ~4 characters per token for English
        - ~3 characters per token for Greek

        Analyzes text to detect primary language and applies
        appropriate ratio.

        Args:
            text: Text to estimate tokens for

        Returns:
            Estimated token count
        """
        if not text:
            return 0

        # Simple heuristic: count Greek characters
        greek_chars = sum(1 for c in text if "\u0370" <= c <= "\u03ff")
        total_chars = len(text)

        # If more than 30% Greek, use Greek ratio
        if greek_chars / max(total_chars, 1) > 0.3:
            return total_chars // CHARS_PER_TOKEN_GREEK
        else:
            return total_chars // CHARS_PER_TOKEN_ENGLISH

    def _find_largest_text_block(self, soup: BeautifulSoup) -> Optional[Tag]:
        """Find the element with the most text content.

        Looks for div/section elements with substantial paragraph content.

        Args:
            soup: Parsed HTML document

        Returns:
            Element with most text content or None
        """
        best_element: Optional[Tag] = None
        best_score = 0

        for element in soup.find_all(["div", "section"]):
            if not isinstance(element, Tag):
                continue

            # Skip elements that are too shallow (likely wrappers)
            paragraphs = element.find_all("p")
            if len(paragraphs) < 2:
                continue

            # Calculate score based on paragraph count and text length
            text_length = sum(len(self._extract_text_from_element(p)) for p in paragraphs)
            score = len(paragraphs) * text_length

            if score > best_score:
                best_score = score
                best_element = element

        return best_element


# Singleton instance for easy import
html_extractor = HTMLContentExtractor()

__all__ = [
    "HTMLContentExtractor",
    "HTMLContentExtractorError",
    "ExtractedContent",
    "html_extractor",
]
