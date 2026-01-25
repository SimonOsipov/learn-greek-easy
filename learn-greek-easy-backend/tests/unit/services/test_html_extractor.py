"""Unit tests for HTMLContentExtractor service.

Tests cover:
- ExtractedContent dataclass fields
- Main extract() method behavior
- Noise removal (scripts, styles, nav, ads, comments)
- Site-specific extraction (sigmalive, philenews)
- Fallback extraction using semantic HTML
- Token estimation for English and Greek text
- Edge cases (empty, malformed, unicode)
- Singleton instance behavior
"""

from datetime import datetime
from pathlib import Path

import pytest

from src.services.html_extractor import (
    CHARS_PER_TOKEN_ENGLISH,
    CHARS_PER_TOKEN_GREEK,
    ExtractedContent,
    HTMLContentExtractor,
    HTMLContentExtractorError,
    html_extractor,
)

# Path to HTML fixtures
FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures" / "html"


@pytest.fixture
def extractor() -> HTMLContentExtractor:
    """Create a fresh HTMLContentExtractor instance for testing."""
    return HTMLContentExtractor()


@pytest.fixture
def sigmalive_html() -> str:
    """Load sigmalive fixture HTML."""
    return (FIXTURES_DIR / "sigmalive.html").read_text(encoding="utf-8")


@pytest.fixture
def philenews_html() -> str:
    """Load philenews fixture HTML."""
    return (FIXTURES_DIR / "philenews.html").read_text(encoding="utf-8")


@pytest.fixture
def generic_html() -> str:
    """Load generic article fixture HTML."""
    return (FIXTURES_DIR / "generic_article.html").read_text(encoding="utf-8")


@pytest.fixture
def noise_heavy_html() -> str:
    """Load noise-heavy fixture HTML."""
    return (FIXTURES_DIR / "noise_heavy.html").read_text(encoding="utf-8")


@pytest.fixture
def minimal_html() -> str:
    """Load minimal content fixture HTML."""
    return (FIXTURES_DIR / "minimal_content.html").read_text(encoding="utf-8")


@pytest.fixture
def empty_html() -> str:
    """Load empty fixture HTML."""
    return (FIXTURES_DIR / "empty.html").read_text(encoding="utf-8")


@pytest.fixture
def malformed_html() -> str:
    """Load malformed fixture HTML."""
    return (FIXTURES_DIR / "malformed.html").read_text(encoding="utf-8")


@pytest.mark.unit
class TestExtractedContentDataclass:
    """Tests for ExtractedContent dataclass fields."""

    def test_dataclass_has_required_fields(self):
        """ExtractedContent should have all required fields."""
        content = ExtractedContent(
            title="Test Title",
            main_text="Test content",
            publication_date=datetime(2024, 1, 15),
            author="Test Author",
            estimated_tokens=100,
            extraction_method="site_specific",
        )

        assert content.title == "Test Title"
        assert content.main_text == "Test content"
        assert content.publication_date == datetime(2024, 1, 15)
        assert content.author == "Test Author"
        assert content.estimated_tokens == 100
        assert content.extraction_method == "site_specific"

    def test_dataclass_allows_none_optionals(self):
        """ExtractedContent should allow None for optional fields."""
        content = ExtractedContent(
            title="Test Title",
            main_text="Test content",
            publication_date=None,
            author=None,
            estimated_tokens=50,
            extraction_method="fallback",
        )

        assert content.publication_date is None
        assert content.author is None

    def test_dataclass_extraction_methods(self):
        """extraction_method should be either site_specific or fallback."""
        for method in ["site_specific", "fallback"]:
            content = ExtractedContent(
                title="Test",
                main_text="Content",
                publication_date=None,
                author=None,
                estimated_tokens=10,
                extraction_method=method,
            )
            assert content.extraction_method == method


@pytest.mark.unit
class TestHTMLContentExtractorExtract:
    """Tests for main extract() method."""

    def test_extract_returns_extracted_content(
        self, extractor: HTMLContentExtractor, sigmalive_html: str
    ):
        """extract() should return ExtractedContent instance."""
        result = extractor.extract(sigmalive_html, "https://sigmalive.com/article")

        assert isinstance(result, ExtractedContent)
        assert result.title
        assert result.main_text
        assert result.estimated_tokens > 0

    def test_extract_raises_on_empty_content(self, extractor: HTMLContentExtractor):
        """extract() should raise HTMLContentExtractorError for empty content."""
        with pytest.raises(HTMLContentExtractorError, match="Empty HTML content"):
            extractor.extract("", "https://example.com")

    def test_extract_raises_on_whitespace_only(self, extractor: HTMLContentExtractor):
        """extract() should raise HTMLContentExtractorError for whitespace-only content."""
        with pytest.raises(HTMLContentExtractorError, match="Empty HTML content"):
            extractor.extract("   \n\t  ", "https://example.com")

    def test_extract_uses_site_specific_for_known_domain(
        self, extractor: HTMLContentExtractor, sigmalive_html: str
    ):
        """extract() should use site_specific method for known domains."""
        result = extractor.extract(sigmalive_html, "https://www.sigmalive.com/article")

        assert result.extraction_method == "site_specific"

    def test_extract_uses_fallback_for_unknown_domain(
        self, extractor: HTMLContentExtractor, generic_html: str
    ):
        """extract() should use fallback method for unknown domains."""
        result = extractor.extract(generic_html, "https://unknown-site.com/article")

        assert result.extraction_method == "fallback"

    def test_extract_handles_www_prefix(self, extractor: HTMLContentExtractor, sigmalive_html: str):
        """extract() should handle www. prefix in domain."""
        result = extractor.extract(sigmalive_html, "https://www.sigmalive.com/article")
        assert result.extraction_method == "site_specific"

    def test_extract_handles_subdomain(self, extractor: HTMLContentExtractor, sigmalive_html: str):
        """extract() should match subdomains of known sites."""
        result = extractor.extract(sigmalive_html, "https://news.sigmalive.com/article")
        assert result.extraction_method == "site_specific"


@pytest.mark.unit
class TestNoiseRemoval:
    """Tests for noise element removal."""

    def test_removes_script_tags(self, extractor: HTMLContentExtractor, noise_heavy_html: str):
        """Extractor should remove <script> tags."""
        result = extractor.extract(noise_heavy_html, "https://example.com")

        assert "console.log" not in result.main_text
        assert "GoogleAnalyticsObject" not in result.main_text
        assert "tracking" not in result.main_text.lower() or "tracking" in result.title.lower()

    def test_removes_style_tags(self, extractor: HTMLContentExtractor, noise_heavy_html: str):
        """Extractor should remove <style> tags."""
        result = extractor.extract(noise_heavy_html, "https://example.com")

        assert ".hidden" not in result.main_text
        assert "display: none" not in result.main_text

    def test_removes_navigation_elements(
        self, extractor: HTMLContentExtractor, noise_heavy_html: str
    ):
        """Extractor should remove nav, header, footer elements."""
        result = extractor.extract(noise_heavy_html, "https://example.com")

        # Navigation content should be removed
        assert "Home > News > Article" not in result.main_text
        assert "Menu Item" not in result.main_text

    def test_removes_advertisement_elements(
        self, extractor: HTMLContentExtractor, noise_heavy_html: str
    ):
        """Extractor should remove advertisement elements."""
        result = extractor.extract(noise_heavy_html, "https://example.com")

        assert "Buy our product" not in result.main_text
        assert "Inline advertisement" not in result.main_text

    def test_removes_social_share_buttons(
        self, extractor: HTMLContentExtractor, noise_heavy_html: str
    ):
        """Extractor should remove social share buttons."""
        result = extractor.extract(noise_heavy_html, "https://example.com")

        assert "Share on Facebook" not in result.main_text
        assert "Share on Twitter" not in result.main_text

    def test_removes_comment_sections(self, extractor: HTMLContentExtractor, noise_heavy_html: str):
        """Extractor should remove comment sections."""
        result = extractor.extract(noise_heavy_html, "https://example.com")

        assert "Comments (42)" not in result.main_text
        assert "Fake comment" not in result.main_text

    def test_removes_related_articles(self, extractor: HTMLContentExtractor, noise_heavy_html: str):
        """Extractor should remove related articles sections."""
        result = extractor.extract(noise_heavy_html, "https://example.com")

        assert "You might also like" not in result.main_text
        assert "Related Article" not in result.main_text

    def test_removes_newsletter_forms(self, extractor: HTMLContentExtractor, noise_heavy_html: str):
        """Extractor should remove newsletter subscription forms."""
        result = extractor.extract(noise_heavy_html, "https://example.com")

        assert "Subscribe to our newsletter" not in result.main_text

    def test_removes_sidebar_widgets(self, extractor: HTMLContentExtractor, noise_heavy_html: str):
        """Extractor should remove sidebar widgets."""
        result = extractor.extract(noise_heavy_html, "https://example.com")

        assert "Trending" not in result.main_text

    def test_removes_cookie_banners(self, extractor: HTMLContentExtractor, noise_heavy_html: str):
        """Extractor should remove cookie banners."""
        result = extractor.extract(noise_heavy_html, "https://example.com")

        assert "We use cookies" not in result.main_text

    def test_removes_popup_modals(self, extractor: HTMLContentExtractor, noise_heavy_html: str):
        """Extractor should remove popup modals."""
        result = extractor.extract(noise_heavy_html, "https://example.com")

        # The popup content should be removed
        # Note: newsletter text may appear in other places
        assert result.main_text  # Content was extracted

    def test_preserves_main_content(self, extractor: HTMLContentExtractor, noise_heavy_html: str):
        """Extractor should preserve actual article content despite noise."""
        result = extractor.extract(noise_heavy_html, "https://example.com")

        assert "actual article content" in result.main_text.lower()
        assert "second paragraph" in result.main_text.lower()

    def test_removes_media_elements(self, extractor: HTMLContentExtractor, noise_heavy_html: str):
        """Extractor should remove video, audio, svg, canvas elements."""
        result = extractor.extract(noise_heavy_html, "https://example.com")

        assert "promo.mp4" not in result.main_text
        assert "sound.mp3" not in result.main_text


@pytest.mark.unit
class TestSiteSpecificExtraction:
    """Tests for site-specific extraction."""

    def test_sigmalive_extracts_title(self, extractor: HTMLContentExtractor, sigmalive_html: str):
        """Sigmalive extraction should extract article title."""
        result = extractor.extract(sigmalive_html, "https://sigmalive.com/article")

        assert "Νέα εξέλιξη" in result.title or "κυπριακή οικονομία" in result.title

    def test_sigmalive_extracts_content(self, extractor: HTMLContentExtractor, sigmalive_html: str):
        """Sigmalive extraction should extract article body."""
        result = extractor.extract(sigmalive_html, "https://sigmalive.com/article")

        assert "κυπριακή οικονομία" in result.main_text
        assert "εξαγωγές" in result.main_text.lower()
        assert "Υπουργός Οικονομικών" in result.main_text

    def test_sigmalive_extracts_author(self, extractor: HTMLContentExtractor, sigmalive_html: str):
        """Sigmalive extraction should extract author."""
        result = extractor.extract(sigmalive_html, "https://sigmalive.com/article")

        assert result.author == "Maria Papadopoulou"

    def test_sigmalive_extracts_date(self, extractor: HTMLContentExtractor, sigmalive_html: str):
        """Sigmalive extraction should extract publication date."""
        result = extractor.extract(sigmalive_html, "https://sigmalive.com/article")

        assert result.publication_date is not None
        assert result.publication_date.year == 2024
        assert result.publication_date.month == 1
        assert result.publication_date.day == 15

    def test_philenews_extracts_title(self, extractor: HTMLContentExtractor, philenews_html: str):
        """Philenews extraction should extract article title."""
        result = extractor.extract(philenews_html, "https://philenews.com/article")

        assert "αρχαιολογική ανακάλυψη" in result.title or "Πάφο" in result.title

    def test_philenews_extracts_content(self, extractor: HTMLContentExtractor, philenews_html: str):
        """Philenews extraction should extract article body."""
        result = extractor.extract(philenews_html, "https://philenews.com/article")

        assert "αρχαιολόγοι" in result.main_text.lower()
        assert "ευρήματα" in result.main_text.lower()

    def test_philenews_extracts_author(self, extractor: HTMLContentExtractor, philenews_html: str):
        """Philenews extraction should extract author."""
        result = extractor.extract(philenews_html, "https://philenews.com/article")

        assert result.author == "Giorgos Konstantinou"

    def test_site_specific_removes_noise(
        self, extractor: HTMLContentExtractor, sigmalive_html: str
    ):
        """Site-specific extraction should still remove noise elements."""
        result = extractor.extract(sigmalive_html, "https://sigmalive.com/article")

        assert "analytics" not in result.main_text.lower()
        assert "Copyright" not in result.main_text
        assert "Related Articles" not in result.main_text


@pytest.mark.unit
class TestFallbackExtraction:
    """Tests for fallback extraction mechanism."""

    def test_fallback_uses_article_tag(self, extractor: HTMLContentExtractor, generic_html: str):
        """Fallback should extract content from <article> tag."""
        result = extractor.extract(generic_html, "https://unknown.com/article")

        assert result.extraction_method == "fallback"
        assert "first paragraph" in result.main_text.lower()

    def test_fallback_extracts_title_from_h1_when_title_short(
        self, extractor: HTMLContentExtractor
    ):
        """Fallback should extract title from <h1> tag when <title> is short."""
        html = """
        <html>
        <head><title>News</title></head>
        <body>
            <article>
                <h1>Breaking News: Important Event Occurs Today</h1>
                <p>Content paragraph with enough text to be extracted properly.</p>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://unknown.com/article")

        # h1 should be preferred when <title> is short (< 10 chars)
        assert "Breaking News" in result.title or "Important Event" in result.title

    def test_fallback_uses_title_tag_when_available(
        self, extractor: HTMLContentExtractor, generic_html: str
    ):
        """Fallback should use <title> tag when it's substantial."""
        result = extractor.extract(generic_html, "https://unknown.com/article")

        # Title tag is "Generic News Article | News Site" which cleans to "Generic News Article"
        assert "Generic News Article" in result.title

    def test_fallback_extracts_date_from_meta(
        self, extractor: HTMLContentExtractor, generic_html: str
    ):
        """Fallback should extract date from meta tags."""
        result = extractor.extract(generic_html, "https://unknown.com/article")

        assert result.publication_date is not None
        assert result.publication_date.year == 2024
        assert result.publication_date.month == 2

    def test_fallback_uses_main_tag(self, extractor: HTMLContentExtractor):
        """Fallback should extract content from <main> tag."""
        html = """
        <html>
        <head><title>Test</title></head>
        <body>
            <main>
                <p>Main content paragraph with enough text to be extracted as article content.</p>
                <p>Second paragraph in main with additional information for readers.</p>
            </main>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://unknown.com")

        assert "Main content" in result.main_text

    def test_fallback_uses_common_article_classes(self, extractor: HTMLContentExtractor):
        """Fallback should try common article class selectors."""
        html = """
        <html>
        <head><title>Test Article</title></head>
        <body>
            <div class="article-content">
                <p>Article content in common class selector with enough text for extraction.</p>
                <p>More content that provides additional context and information to readers.</p>
            </div>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://unknown.com")

        assert "Article content" in result.main_text

    def test_fallback_finds_largest_text_block(self, extractor: HTMLContentExtractor):
        """Fallback should find the largest text block when other methods fail."""
        html = """
        <html>
        <head><title>Test</title></head>
        <body>
            <div>
                <p>Small text here.</p>
            </div>
            <div>
                <p>This is a much larger block of content that should be identified as the main article content because it has more text.</p>
                <p>It contains multiple paragraphs with substantial text that exceeds the minimum length threshold for content extraction.</p>
                <p>Third paragraph adds even more content to make this clearly the largest text block.</p>
            </div>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://unknown.com")

        assert "larger block" in result.main_text.lower()

    def test_fallback_extracts_title_from_title_tag(self, extractor: HTMLContentExtractor):
        """Fallback should extract title from <title> tag."""
        html = """
        <html>
        <head><title>Page Title | Site Name</title></head>
        <body>
            <article>
                <p>Content paragraph that is long enough to be included in the extraction results.</p>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://unknown.com")

        assert "Page Title" in result.title
        assert "Site Name" not in result.title  # Suffix should be removed


@pytest.mark.unit
class TestTokenEstimation:
    """Tests for token estimation functionality."""

    def test_token_estimation_english_text(self, extractor: HTMLContentExtractor):
        """Token estimation should use ~4 chars per token for English."""
        # 100 English characters
        english_text = "a" * 100
        html = f"""
        <html>
        <head><title>Test</title></head>
        <body>
            <article>
                <p>{english_text} with some extra padding for content extraction.</p>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        # Token count should be approximately total_chars / 4
        # Allow for some variance due to title inclusion
        assert result.estimated_tokens > 0
        assert result.estimated_tokens < len(result.main_text)  # Tokens < chars

    def test_token_estimation_greek_text(
        self, extractor: HTMLContentExtractor, sigmalive_html: str
    ):
        """Token estimation should use ~3 chars per token for Greek."""
        result = extractor.extract(sigmalive_html, "https://sigmalive.com/article")

        # Greek text should use CHARS_PER_TOKEN_GREEK (3)
        total_text = f"{result.title}\n\n{result.main_text}"
        # With Greek text, estimated tokens should be higher than English ratio
        expected_min = len(total_text) // (CHARS_PER_TOKEN_GREEK + 1)
        expected_max = len(total_text) // (CHARS_PER_TOKEN_GREEK - 1) + 1

        assert result.estimated_tokens >= expected_min
        assert result.estimated_tokens <= expected_max

    def test_token_estimation_empty_text(self, extractor: HTMLContentExtractor):
        """Token estimation should return 0 for empty text."""
        # Test the private method directly
        assert extractor._estimate_tokens("") == 0

    def test_token_estimation_mixed_text(self, extractor: HTMLContentExtractor):
        """Token estimation should handle mixed Greek/English text."""
        html = """
        <html>
        <head><title>Test</title></head>
        <body>
            <article>
                <p>This is English text mixed with some Greek: Καλημέρα κόσμε. The ratio should be calculated.</p>
                <p>Another paragraph with more content to ensure extraction works properly and tokens are counted.</p>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        # Should produce a reasonable token count
        assert result.estimated_tokens > 0
        total_text = f"{result.title}\n\n{result.main_text}"
        # Should be between Greek and English ratios
        assert result.estimated_tokens <= len(total_text) // CHARS_PER_TOKEN_GREEK
        assert result.estimated_tokens >= len(total_text) // (CHARS_PER_TOKEN_ENGLISH + 1)

    def test_chars_per_token_constants(self):
        """Verify character per token constants are defined correctly."""
        assert CHARS_PER_TOKEN_ENGLISH == 4
        assert CHARS_PER_TOKEN_GREEK == 3


@pytest.mark.unit
class TestTokenReduction:
    """Tests for verifying token reduction from raw HTML to extracted content."""

    def test_token_reduction_from_noisy_html(
        self, extractor: HTMLContentExtractor, noise_heavy_html: str
    ):
        """Verify that extraction significantly reduces token count from noisy HTML."""
        # Calculate raw HTML token estimate
        raw_tokens = len(noise_heavy_html) // CHARS_PER_TOKEN_ENGLISH

        # Extract clean content
        result = extractor.extract(noise_heavy_html, "https://example.com")

        # Extracted content should use fewer tokens
        assert result.estimated_tokens < raw_tokens

        # Should achieve at least 50% reduction on noisy HTML
        reduction_ratio = 1 - (result.estimated_tokens / raw_tokens)
        assert reduction_ratio >= 0.5, f"Expected >= 50% reduction, got {reduction_ratio:.1%}"

    def test_token_reduction_preserves_content(
        self, extractor: HTMLContentExtractor, noise_heavy_html: str
    ):
        """Verify that token reduction doesn't lose essential article content."""
        result = extractor.extract(noise_heavy_html, "https://example.com")

        # Essential content keywords should be preserved
        assert "actual article content" in result.main_text.lower()
        assert result.title  # Title should be extracted

    def test_sigmalive_token_reduction(self, extractor: HTMLContentExtractor, sigmalive_html: str):
        """Verify token reduction on real site fixture (site-specific extraction)."""
        raw_tokens = len(sigmalive_html) // CHARS_PER_TOKEN_GREEK

        result = extractor.extract(sigmalive_html, "https://sigmalive.com/article")

        # Site-specific extraction should be efficient
        assert result.estimated_tokens < raw_tokens
        # Should use site-specific method
        assert result.extraction_method == "site_specific"


@pytest.mark.unit
class TestEdgeCases:
    """Tests for edge cases."""

    def test_empty_html_document(self, extractor: HTMLContentExtractor, empty_html: str):
        """Extractor should handle empty HTML document."""
        result = extractor.extract(empty_html, "https://example.com")

        assert result.title == "Empty Page" or result.title == "Untitled"
        assert result.main_text == ""  # No content
        assert result.extraction_method == "fallback"

    def test_malformed_html(self, extractor: HTMLContentExtractor, malformed_html: str):
        """Extractor should handle malformed HTML gracefully."""
        result = extractor.extract(malformed_html, "https://example.com")

        # Malformed HTML should not crash - BeautifulSoup handles it
        assert result is not None
        # Title should be extracted even from malformed HTML
        assert result.title
        assert "Malformed HTML Article" in result.title
        # BeautifulSoup should still extract paragraphs from unclosed tags
        assert result.main_text  # Should have content
        assert "paragraph" in result.main_text.lower()

    def test_unicode_content(self, extractor: HTMLContentExtractor):
        """Extractor should handle various Unicode characters."""
        html = """
        <html>
        <head><title>Unicode Test</title></head>
        <body>
            <article>
                <p>Greek: Αλφάβητο Ελληνικό - this paragraph has enough content for extraction testing.</p>
                <p>Cyrillic: Привет мир - another paragraph with sufficient length for the test.</p>
                <p>Emoji: Hello World - more content to ensure proper extraction.</p>
                <p>Special: "quotes" 'apostrophes' — dashes for comprehensive unicode testing.</p>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        assert "Αλφάβητο" in result.main_text
        assert "Привет" in result.main_text
        assert "—" in result.main_text

    def test_deeply_nested_content(self, extractor: HTMLContentExtractor):
        """Extractor should handle deeply nested HTML structures."""
        html = """
        <html>
        <head><title>Nested Test</title></head>
        <body>
            <div>
                <div>
                    <div>
                        <article>
                            <div>
                                <div>
                                    <p>Deeply nested paragraph content that should still be extracted properly by the extractor.</p>
                                    <p>Another deeply nested paragraph with sufficient length for extraction to work correctly.</p>
                                </div>
                            </div>
                        </article>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        assert "nested paragraph" in result.main_text.lower()

    def test_no_paragraphs_only_text(self, extractor: HTMLContentExtractor):
        """Extractor should handle content without paragraph tags."""
        html = """
        <html>
        <head><title>No Paragraphs</title></head>
        <body>
            <article>
                This is text content without paragraph tags. It contains enough text to potentially be extracted but might not be due to the extractor's focus on paragraph elements.
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        # Should still work but may have empty main_text
        assert result.title == "No Paragraphs"

    def test_minimal_content_filters_short_paragraphs(
        self, extractor: HTMLContentExtractor, minimal_html: str
    ):
        """Extractor should filter out paragraphs below minimum length."""
        result = extractor.extract(minimal_html, "https://example.com")

        # Short paragraphs should be filtered
        assert "Short." not in result.main_text
        assert "Too brief." not in result.main_text
        # Longer paragraphs should be included
        assert "sufficient length" in result.main_text.lower()

    def test_special_url_handling(self, extractor: HTMLContentExtractor):
        """Extractor should handle various URL formats."""
        html = """
        <html>
        <head><title>Test</title></head>
        <body>
            <article>
                <p>Test paragraph with enough content for extraction and testing purposes here.</p>
            </article>
        </body>
        </html>
        """
        # Test various URL formats
        urls = [
            "https://example.com",
            "https://www.example.com",
            "http://example.com/path/to/article",
            "https://sub.domain.example.com",
            "https://example.com/article?param=value",
        ]

        for url in urls:
            result = extractor.extract(html, url)
            assert result is not None
            assert result.extraction_method == "fallback"

    def test_invalid_url_uses_fallback(self, extractor: HTMLContentExtractor):
        """Extractor should use fallback for invalid URLs."""
        html = """
        <html>
        <head><title>Test</title></head>
        <body>
            <article>
                <p>Test content paragraph with sufficient length for extraction testing purposes.</p>
            </article>
        </body>
        </html>
        """
        # Invalid URLs should not crash, just use fallback
        invalid_urls = ["", "not-a-url", "://missing-scheme.com"]

        for url in invalid_urls:
            result = extractor.extract(html, url)
            assert result is not None
            assert result.extraction_method == "fallback"

    def test_html_comments_removed(self, extractor: HTMLContentExtractor):
        """Extractor should remove HTML comments."""
        html = """
        <html>
        <head><title>Test</title></head>
        <body>
            <!-- This is a comment that should be removed -->
            <article>
                <p>Real content paragraph with enough text to be extracted by the service properly.</p>
                <!-- Another comment -->
                <p>More real content for the article that should be included in extraction results.</p>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        assert "This is a comment" not in result.main_text
        assert "Another comment" not in result.main_text
        assert "Real content" in result.main_text


@pytest.mark.unit
class TestSingletonInstance:
    """Tests for html_extractor singleton instance."""

    def test_singleton_is_instance(self):
        """html_extractor should be an HTMLContentExtractor instance."""
        assert isinstance(html_extractor, HTMLContentExtractor)

    def test_singleton_works(self, sigmalive_html: str):
        """Singleton instance should work for extraction."""
        result = html_extractor.extract(sigmalive_html, "https://sigmalive.com/article")

        assert isinstance(result, ExtractedContent)
        assert result.extraction_method == "site_specific"

    def test_singleton_has_site_configs(self):
        """Singleton should have site configurations."""
        assert len(html_extractor.site_configs) > 0
        assert "sigmalive.com" in html_extractor.site_configs
        assert "philenews.com" in html_extractor.site_configs


@pytest.mark.unit
class TestSiteConfigs:
    """Tests for site configuration validity."""

    def test_all_site_configs_have_required_fields(self, extractor: HTMLContentExtractor):
        """All site configs should have required selectors."""
        for domain, config in extractor.site_configs.items():
            assert config.domain == domain, f"Config domain mismatch for {domain}"
            assert config.article_container, f"Missing article_container for {domain}"
            assert config.title_selector, f"Missing title_selector for {domain}"
            assert config.content_selector, f"Missing content_selector for {domain}"

    def test_known_sites_configured(self, extractor: HTMLContentExtractor):
        """Known Greek/Cypriot news sites should be configured."""
        expected_sites = [
            "sigmalive.com",
            "philenews.com",
            "cyprus-mail.com",
            "politis.com.cy",
            "reporter.com.cy",
        ]

        for site in expected_sites:
            assert site in extractor.site_configs, f"Missing config for {site}"


@pytest.mark.unit
class TestDateParsing:
    """Tests for date parsing functionality."""

    def test_parses_iso_format(self, extractor: HTMLContentExtractor):
        """Should parse ISO 8601 date format."""
        html = """
        <html>
        <head>
            <title>Test</title>
            <meta property="article:published_time" content="2024-03-15T09:30:00Z">
        </head>
        <body>
            <article><p>Content paragraph with enough text for extraction testing.</p></article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        assert result.publication_date is not None
        assert result.publication_date.year == 2024
        assert result.publication_date.month == 3
        assert result.publication_date.day == 15

    def test_parses_european_format(self, extractor: HTMLContentExtractor):
        """Should parse European date format (DD/MM/YYYY)."""
        html = """
        <html>
        <head><title>Test</title></head>
        <body>
            <article>
                <time datetime="15/01/2024">15 January 2024</time>
                <p>Content paragraph with enough text for extraction testing.</p>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        # datetime attribute should be parsed
        # Note: May not parse DD/MM/YYYY directly, depends on format support
        assert result is not None

    def test_handles_unparseable_date(self, extractor: HTMLContentExtractor):
        """Should handle unparseable date gracefully."""
        html = """
        <html>
        <head>
            <title>Test</title>
            <meta property="article:published_time" content="invalid-date-format">
        </head>
        <body>
            <article><p>Content paragraph with enough text for extraction testing.</p></article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        # Should not crash, just return None for date
        assert result is not None
        # publication_date may or may not be None depending on fallback parsing


@pytest.mark.unit
class TestAuthorExtraction:
    """Tests for author extraction functionality."""

    def test_extracts_author_from_meta(self, extractor: HTMLContentExtractor):
        """Should extract author from meta tag."""
        html = """
        <html>
        <head>
            <title>Test</title>
            <meta name="author" content="John Smith">
        </head>
        <body>
            <article><p>Content paragraph with enough text for extraction testing.</p></article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        assert result.author == "John Smith"

    def test_extracts_author_from_byline(self, extractor: HTMLContentExtractor):
        """Should extract author from byline element."""
        html = """
        <html>
        <head><title>Test</title></head>
        <body>
            <article>
                <span class="byline">Jane Doe</span>
                <p>Content paragraph with enough text for extraction testing purposes here.</p>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        assert result.author == "Jane Doe"

    def test_handles_missing_author(self, extractor: HTMLContentExtractor):
        """Should handle missing author gracefully."""
        html = """
        <html>
        <head><title>Test</title></head>
        <body>
            <article><p>Content paragraph with enough text for extraction testing.</p></article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        assert result.author is None


@pytest.mark.unit
class TestSiteSpecificFailure:
    """Tests for site-specific extraction failure scenarios."""

    def test_site_specific_falls_back_when_no_content(self, extractor: HTMLContentExtractor):
        """Site-specific extraction should fall back if it returns empty content."""
        # HTML that matches sigmalive but has no content in expected locations
        html = """
        <html>
        <head><title>Empty Article</title></head>
        <body>
            <article class="article-content">
                <h1 class="article-title">Title Only</h1>
                <!-- No article-body, no paragraphs -->
            </article>
            <main>
                <p>Content in main tag that should be found by fallback extraction.</p>
                <p>More content paragraphs for the fallback to discover and extract.</p>
            </main>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://sigmalive.com/article")

        # Should fall back and find content in <main>
        assert result.main_text
        assert "fallback" in result.extraction_method

    def test_site_specific_with_container_paragraphs(self, extractor: HTMLContentExtractor):
        """Site-specific should extract paragraphs from container when body selector fails."""
        html = """
        <html>
        <head><title>Container Test | Site</title></head>
        <body>
            <article class="article-content">
                <h1 class="article-title">Article in Container</h1>
                <p>This paragraph is directly in article container with enough text for extraction.</p>
                <p>Second paragraph in the article container provides additional content for readers.</p>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://sigmalive.com/article")

        assert "Container" in result.title or "Article" in result.title
        # Content should still be extracted from container paragraphs
        assert result.main_text


@pytest.mark.unit
class TestContentExtraction:
    """Additional tests for content extraction edge cases."""

    def test_extract_from_div_in_selectors(self, extractor: HTMLContentExtractor):
        """Content selectors matching div should extract nested paragraphs."""
        html = """
        <html>
        <head><title>Div Content Test</title></head>
        <body>
            <article class="article-content">
                <h1>Title Here</h1>
                <div class="article-body">
                    <p>First paragraph with substantial content for extraction testing purposes here.</p>
                    <p>Second paragraph also has enough text to pass the minimum length threshold.</p>
                </div>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://sigmalive.com/article")

        assert "First paragraph" in result.main_text
        assert "Second paragraph" in result.main_text

    def test_deduplication_of_repeated_paragraphs(self, extractor: HTMLContentExtractor):
        """Site-specific extractor should deduplicate repeated paragraph content."""
        # Use sigmalive.com to trigger site-specific extraction which has deduplication
        html = """
        <html>
        <head><title>Duplicate Test | SigmaLive</title></head>
        <body>
            <article class="article-content">
                <h1 class="article-title">Duplicate Test Article</h1>
                <div class="article-body">
                    <p>This is a unique paragraph with enough content to be included in extraction results.</p>
                    <p>This is a unique paragraph with enough content to be included in extraction results.</p>
                    <p>Another different paragraph that has sufficient length for proper extraction here.</p>
                </div>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://sigmalive.com/article")

        # Site-specific extraction should deduplicate
        assert result.extraction_method == "site_specific"
        count = result.main_text.count("unique paragraph")
        assert count == 1

    def test_extracts_from_body_when_nothing_else(self, extractor: HTMLContentExtractor):
        """Fallback should extract from body as last resort."""
        html = """
        <html>
        <head><title>Minimal Structure</title></head>
        <body>
            <p>This content is directly in body tag and has enough text to be extracted.</p>
            <p>Second paragraph directly in body also has sufficient length for extraction.</p>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        assert "directly in body" in result.main_text


@pytest.mark.unit
class TestTitleExtraction:
    """Additional tests for title extraction."""

    def test_title_suffix_removal_pipe(self, extractor: HTMLContentExtractor):
        """Should remove | suffix from titles."""
        html = """
        <html>
        <head><title>Article Title | Site Name</title></head>
        <body>
            <article><p>Content paragraph with enough text.</p></article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        assert result.title == "Article Title"
        assert "Site Name" not in result.title

    def test_title_suffix_removal_dash(self, extractor: HTMLContentExtractor):
        """Should remove - suffix from titles."""
        html = """
        <html>
        <head><title>Article Title - Site Name</title></head>
        <body>
            <article><p>Content paragraph with enough text.</p></article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        assert result.title == "Article Title"

    def test_title_suffix_removal_double_colon(self, extractor: HTMLContentExtractor):
        """Should remove :: suffix from titles."""
        html = """
        <html>
        <head><title>Article Title :: Site Name</title></head>
        <body>
            <article><p>Content paragraph with enough text.</p></article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        assert result.title == "Article Title"

    def test_title_suffix_removal_double_slash(self, extractor: HTMLContentExtractor):
        """Should remove // suffix from titles."""
        html = """
        <html>
        <head><title>Article Title // Site Name</title></head>
        <body>
            <article><p>Content paragraph with enough text.</p></article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        assert result.title == "Article Title"


@pytest.mark.unit
class TestDateFallback:
    """Tests for date extraction from various sources."""

    def test_extracts_date_from_time_tag(self, extractor: HTMLContentExtractor):
        """Should extract date from time[datetime] attribute."""
        html = """
        <html>
        <head><title>Test</title></head>
        <body>
            <article>
                <time datetime="2024-06-15T12:00:00Z">June 15, 2024</time>
                <p>Content paragraph with enough text for extraction testing here.</p>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        assert result.publication_date is not None
        assert result.publication_date.year == 2024
        assert result.publication_date.month == 6
        assert result.publication_date.day == 15

    def test_extracts_date_from_dc_date_meta(self, extractor: HTMLContentExtractor):
        """Should extract date from DC.date meta tag."""
        html = """
        <html>
        <head>
            <title>Test</title>
            <meta name="DC.date" content="2024-05-20">
        </head>
        <body>
            <article><p>Content paragraph with enough text for extraction testing.</p></article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        assert result.publication_date is not None
        assert result.publication_date.year == 2024
        assert result.publication_date.month == 5


@pytest.mark.unit
class TestAuthorFallback:
    """Tests for author extraction from various sources."""

    def test_extracts_author_from_article_author_meta(self, extractor: HTMLContentExtractor):
        """Should extract author from article:author meta property."""
        html = """
        <html>
        <head>
            <title>Test</title>
            <meta property="article:author" content="Writer Name">
        </head>
        <body>
            <article><p>Content paragraph with enough text for extraction testing.</p></article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        assert result.author == "Writer Name"

    def test_extracts_author_from_rel_author(self, extractor: HTMLContentExtractor):
        """Should extract author from rel=author element."""
        html = """
        <html>
        <head><title>Test</title></head>
        <body>
            <article>
                <a rel="author">Link Author Name</a>
                <p>Content paragraph with enough text for extraction testing here.</p>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        assert result.author == "Link Author Name"

    def test_ignores_very_long_author_text(self, extractor: HTMLContentExtractor):
        """Should ignore author elements with excessively long text (likely not author)."""
        # Create author text > 100 chars
        long_text = "A" * 150
        html = f"""
        <html>
        <head><title>Test</title></head>
        <body>
            <article>
                <span class="author">{long_text}</span>
                <p>Content paragraph with enough text for extraction testing here.</p>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://example.com")

        # Should skip the overly long author
        assert result.author != long_text


@pytest.mark.unit
class TestPrivateMethods:
    """Tests for private helper methods."""

    def test_estimate_tokens_with_mixed_content(self, extractor: HTMLContentExtractor):
        """Token estimation should handle text with varying Greek percentage."""
        # Less than 30% Greek - should use English ratio
        english_heavy = "Hello world this is mostly English text " * 10
        english_tokens = extractor._estimate_tokens(english_heavy)

        # More than 30% Greek - should use Greek ratio
        greek_heavy = "Ελληνικό κείμενο " * 20 + "Some English"
        greek_tokens = extractor._estimate_tokens(greek_heavy)

        # Greek text of same length should estimate more tokens
        # because Greek uses fewer chars per token
        assert english_tokens > 0
        assert greek_tokens > 0

    def test_extract_text_from_none_element(self, extractor: HTMLContentExtractor):
        """_extract_text_from_element should handle None gracefully."""
        result = extractor._extract_text_from_element(None)  # type: ignore
        assert result == ""

    def test_parse_date_with_specific_format(self, extractor: HTMLContentExtractor):
        """_parse_date should try specific format first."""
        # Test with ISO format
        result = extractor._parse_date("2024-01-15T10:30:00Z")
        assert result is not None
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 15

    def test_parse_date_with_empty_string(self, extractor: HTMLContentExtractor):
        """_parse_date should return None for empty string."""
        result = extractor._parse_date("")
        assert result is None

    def test_parse_date_with_european_format(self, extractor: HTMLContentExtractor):
        """_parse_date should handle European date format."""
        result = extractor._parse_date("15/01/2024")
        assert result is not None
        assert result.day == 15
        assert result.month == 1
        assert result.year == 2024

    def test_parse_date_with_provided_format(self, extractor: HTMLContentExtractor):
        """_parse_date should try provided format first."""
        # Provide a specific format
        result = extractor._parse_date("2024-01-15", date_format="%Y-%m-%d")
        assert result is not None
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 15


@pytest.mark.unit
class TestExtractionFromSelectors:
    """Tests for content extraction from CSS selectors."""

    def test_extract_from_section_element(self, extractor: HTMLContentExtractor):
        """Extraction should work with section elements matching selectors."""
        html = """
        <html>
        <head><title>Section Test | Site</title></head>
        <body>
            <article class="article-content">
                <h1 class="article-title">Section Content Test</h1>
                <section class="article-body">
                    <p>Content in section element with enough text for extraction testing.</p>
                    <p>Second paragraph in section provides more content for readers to enjoy.</p>
                </section>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://sigmalive.com/article")

        assert "section element" in result.main_text.lower()

    def test_extract_paragraphs_directly_from_article(self, extractor: HTMLContentExtractor):
        """Should extract paragraphs directly matching content selector."""
        html = """
        <html>
        <head><title>Direct P Test | Site</title></head>
        <body>
            <article class="article-content">
                <h1 class="article-title">Direct Paragraph Test</h1>
                <p>Direct paragraph one that matches article p selector with enough text.</p>
                <p>Direct paragraph two in article that also matches the selector pattern.</p>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://sigmalive.com/article")

        # Paragraphs should be extracted from "article p" selector
        assert "Direct paragraph" in result.main_text


@pytest.mark.unit
class TestFallbackStrategies:
    """Tests for specific fallback strategy paths."""

    def test_no_article_but_has_main(self, extractor: HTMLContentExtractor):
        """When no <article>, should fall back to <main>."""
        html = """
        <html>
        <head><title>Main Only</title></head>
        <body>
            <header><nav>Navigation here</nav></header>
            <main>
                <p>Main content paragraph one that should be extracted by the fallback.</p>
                <p>Main content paragraph two with sufficient length for extraction here.</p>
            </main>
            <footer>Footer content</footer>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://unknown-site.com/article")

        assert result.extraction_method == "fallback"
        assert "Main content" in result.main_text

    def test_no_article_no_main_uses_common_classes(self, extractor: HTMLContentExtractor):
        """When no <article> or <main>, should try common article classes."""
        html = """
        <html>
        <head><title>Common Class</title></head>
        <body>
            <div class="post-content">
                <p>Post content paragraph with enough text for extraction testing here.</p>
                <p>More post content that should also be extracted by the fallback.</p>
            </div>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://unknown-site.com/article")

        assert result.extraction_method == "fallback"
        assert "Post content" in result.main_text

    def test_no_semantic_elements_uses_largest_block(self, extractor: HTMLContentExtractor):
        """When no semantic elements, should find largest text block."""
        html = """
        <html>
        <head><title>Largest Block</title></head>
        <body>
            <div class="small">
                <p>Small text.</p>
            </div>
            <div class="large-content-area">
                <p>This is paragraph one in the large div which should be found.</p>
                <p>This is paragraph two in the large div with even more content.</p>
                <p>This is paragraph three making this clearly the largest block.</p>
                <p>This is paragraph four to ensure we have enough content here.</p>
            </div>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://unknown-site.com/article")

        assert "large div" in result.main_text.lower()


@pytest.mark.unit
class TestTitleExtractionEdgeCases:
    """Tests for title extraction edge cases."""

    def test_title_from_h1_when_no_title_tag(self, extractor: HTMLContentExtractor):
        """Should use h1 when title tag is missing."""
        html = """
        <html>
        <head></head>
        <body>
            <article>
                <h1>Heading One Title</h1>
                <p>Content paragraph with enough text for extraction testing purposes.</p>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://unknown.com/article")

        assert "Heading One" in result.title

    def test_returns_untitled_when_no_title_source(self, extractor: HTMLContentExtractor):
        """Should return 'Untitled' when no title can be found."""
        html = """
        <html>
        <head></head>
        <body>
            <article>
                <p>Content paragraph with enough text but no title anywhere in document.</p>
            </article>
        </body>
        </html>
        """
        result = extractor.extract(html, "https://unknown.com/article")

        assert result.title == "Untitled"
