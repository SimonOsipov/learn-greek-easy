"""Unit tests for public changelog API endpoint.

This module tests:
- GET /api/v1/changelog requires authentication (401)
- Pagination parameters work correctly
- Accept-Language header parsing
- parse_accept_language() function

Tests use test client with auth fixtures.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_locale_from_header
from src.db.models import ChangelogEntry, ChangelogTag

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def changelog_entries(db_session: AsyncSession) -> list[ChangelogEntry]:
    """Create multiple changelog entries for testing."""
    entries = []

    for i in range(10):
        entry = ChangelogEntry(
            title_en=f"English Title {i + 1}",
            title_el=f"Ελληνικός Τίτλος {i + 1}",
            title_ru=f"Русский Заголовок {i + 1}",
            content_en=f"English content {i + 1}",
            content_el=f"Greek content {i + 1}",
            content_ru=f"Russian content {i + 1}",
            tag=ChangelogTag.NEW_FEATURE if i % 2 == 0 else ChangelogTag.BUG_FIX,
        )
        db_session.add(entry)
        entries.append(entry)

    await db_session.commit()
    for entry in entries:
        await db_session.refresh(entry)

    return entries


# =============================================================================
# Test Authentication
# =============================================================================


class TestAuthentication:
    """Tests for authentication requirements."""

    @pytest.mark.asyncio
    async def test_requires_authentication(
        self,
        client: AsyncClient,
    ):
        """Should return 401 when no authentication provided."""
        response = await client.get("/api/v1/changelog")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_authenticated_user_can_access(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ):
        """Should allow access with valid authentication."""
        response = await client.get("/api/v1/changelog", headers=auth_headers)

        assert response.status_code == 200


# =============================================================================
# Test Pagination
# =============================================================================


class TestPagination:
    """Tests for pagination functionality."""

    @pytest.mark.asyncio
    async def test_default_pagination(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        changelog_entries: list[ChangelogEntry],
    ):
        """Should use default pagination (page=1, page_size=5)."""
        response = await client.get("/api/v1/changelog", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 5
        assert len(data["items"]) == 5
        assert data["total"] == len(changelog_entries)

    @pytest.mark.asyncio
    async def test_custom_page_size(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        changelog_entries: list[ChangelogEntry],
    ):
        """Should respect custom page_size parameter."""
        response = await client.get(
            "/api/v1/changelog",
            params={"page_size": 3},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page_size"] == 3
        assert len(data["items"]) == 3

    @pytest.mark.asyncio
    async def test_second_page(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        changelog_entries: list[ChangelogEntry],
    ):
        """Should return correct items for page 2."""
        response = await client.get(
            "/api/v1/changelog",
            params={"page": 2, "page_size": 3},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2
        assert len(data["items"]) == 3

    @pytest.mark.asyncio
    async def test_max_page_size_enforced(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ):
        """Should reject page_size > 50."""
        response = await client.get(
            "/api/v1/changelog",
            params={"page_size": 100},
            headers=auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_min_page_enforced(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ):
        """Should reject page < 1."""
        response = await client.get(
            "/api/v1/changelog",
            params={"page": 0},
            headers=auth_headers,
        )

        assert response.status_code == 422


# =============================================================================
# Test Accept-Language Header
# =============================================================================


class TestAcceptLanguageHeader:
    """Tests for Accept-Language header handling."""

    @pytest.mark.asyncio
    async def test_english_header(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        changelog_entries: list[ChangelogEntry],
    ):
        """Should return English content with Accept-Language: en."""
        headers = {**auth_headers, "Accept-Language": "en"}
        response = await client.get("/api/v1/changelog", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert "English Title" in data["items"][0]["title"]

    @pytest.mark.asyncio
    async def test_greek_header(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        changelog_entries: list[ChangelogEntry],
    ):
        """Should return Greek content with Accept-Language: el."""
        headers = {**auth_headers, "Accept-Language": "el"}
        response = await client.get("/api/v1/changelog", headers=headers)

        assert response.status_code == 200
        data = response.json()
        # Greek titles start with Greek text
        assert "Ελληνικός" in data["items"][0]["title"]

    @pytest.mark.asyncio
    async def test_russian_header(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        changelog_entries: list[ChangelogEntry],
    ):
        """Should return Russian content with Accept-Language: ru."""
        headers = {**auth_headers, "Accept-Language": "ru"}
        response = await client.get("/api/v1/changelog", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert "Русский" in data["items"][0]["title"]

    @pytest.mark.asyncio
    async def test_unsupported_language_fallback(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        changelog_entries: list[ChangelogEntry],
    ):
        """Should fall back to English for unsupported language."""
        headers = {**auth_headers, "Accept-Language": "de"}
        response = await client.get("/api/v1/changelog", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert "English Title" in data["items"][0]["title"]


# =============================================================================
# Test get_locale_from_header Function
# =============================================================================


class TestGetLocaleFromHeader:
    """Tests for get_locale_from_header utility function."""

    def test_simple_locale(self):
        """Should parse simple locale codes."""
        assert get_locale_from_header("en") == "en"
        assert get_locale_from_header("el") == "el"
        assert get_locale_from_header("ru") == "ru"

    def test_locale_with_region(self):
        """Should extract base language from locale with region."""
        assert get_locale_from_header("en-US") == "en"
        assert get_locale_from_header("el-GR") == "el"
        assert get_locale_from_header("ru-RU") == "ru"

    def test_multiple_languages_with_quality(self):
        """Should return highest priority language."""
        assert get_locale_from_header("el,en;q=0.9") == "el"
        assert get_locale_from_header("en;q=0.9,el") == "el"

    def test_quality_factors(self):
        """Should respect quality factors."""
        assert get_locale_from_header("en;q=0.5,el;q=0.9,ru;q=0.7") == "el"
        assert get_locale_from_header("ru;q=1.0,en;q=0.5") == "ru"

    def test_none_returns_english(self):
        """Should return 'en' when header is None."""
        assert get_locale_from_header(None) == "en"

    def test_empty_string_returns_english(self):
        """Should return 'en' for empty string."""
        assert get_locale_from_header("") == "en"

    def test_whitespace_handling(self):
        """Should handle whitespace in header."""
        assert get_locale_from_header("  en  ") == "en"
        assert get_locale_from_header("el , en ; q=0.9") == "el"

    def test_invalid_quality_defaults_to_one(self):
        """Should treat invalid quality factor as 1.0."""
        assert get_locale_from_header("en;q=invalid,el") == "en"

    def test_complex_header(self):
        """Should parse complex Accept-Language headers."""
        # Real-world example from browser
        header = "el-GR,el;q=0.9,en-US;q=0.8,en;q=0.7"
        assert get_locale_from_header(header) == "el"


# =============================================================================
# Test Response Structure
# =============================================================================


class TestResponseStructure:
    """Tests for correct response structure."""

    @pytest.mark.asyncio
    async def test_response_contains_required_fields(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        changelog_entries: list[ChangelogEntry],
    ):
        """Should include all required fields in response."""
        response = await client.get("/api/v1/changelog", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        # Check top-level structure
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "items" in data

        # Check item structure
        if data["items"]:
            item = data["items"][0]
            assert "id" in item
            assert "title" in item
            assert "content" in item
            assert "tag" in item
            assert "created_at" in item
            assert "updated_at" in item

    @pytest.mark.asyncio
    async def test_tag_is_valid_enum_value(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        changelog_entries: list[ChangelogEntry],
    ):
        """Should return valid tag enum values."""
        response = await client.get("/api/v1/changelog", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        valid_tags = {"new_feature", "bug_fix", "announcement"}
        for item in data["items"]:
            assert item["tag"] in valid_tags

    @pytest.mark.asyncio
    async def test_empty_changelog(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ):
        """Should return empty list when no entries exist."""
        response = await client.get("/api/v1/changelog", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0
