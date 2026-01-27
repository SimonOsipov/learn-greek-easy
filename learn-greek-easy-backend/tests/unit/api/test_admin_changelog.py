"""Unit tests for admin changelog API endpoints.

This module tests:
- All admin endpoints require superuser (403 for regular users, 401 without auth)
- GET /api/v1/admin/changelog list returns all language fields
- GET /api/v1/admin/changelog/{id} returns 404 if not found
- POST /api/v1/admin/changelog returns 201
- PUT /api/v1/admin/changelog/{id} updates, returns 404 if not found
- DELETE /api/v1/admin/changelog/{id} returns 204, returns 404 if not found

Tests use test client with auth fixtures.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import ChangelogEntry, ChangelogTag

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def changelog_entries(db_session: AsyncSession) -> list[ChangelogEntry]:
    """Create multiple changelog entries for testing."""
    entries = []

    for i in range(5):
        entry = ChangelogEntry(
            title_en=f"English Title {i + 1}",
            title_el=f"Greek Title {i + 1}",
            title_ru=f"Russian Title {i + 1}",
            content_en=f"English content {i + 1}",
            content_el=f"Greek content {i + 1}",
            content_ru=f"Russian content {i + 1}",
            tag=ChangelogTag.NEW_FEATURE,
        )
        db_session.add(entry)
        entries.append(entry)

    await db_session.commit()
    for entry in entries:
        await db_session.refresh(entry)

    return entries


@pytest.fixture
async def single_entry(db_session: AsyncSession) -> ChangelogEntry:
    """Create a single changelog entry for testing."""
    entry = ChangelogEntry(
        title_en="Test Entry",
        title_el="Δοκιμαστική Καταχώρηση",
        title_ru="Тестовая Запись",
        content_en="Test content in English",
        content_el="Δοκιμαστικό περιεχόμενο",
        content_ru="Тестовое содержание",
        tag=ChangelogTag.BUG_FIX,
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


# =============================================================================
# Test Authorization
# =============================================================================


class TestAuthorization:
    """Tests for authorization requirements on admin endpoints."""

    @pytest.mark.asyncio
    async def test_list_requires_auth(self, client: AsyncClient):
        """GET /admin/changelog should return 401 without auth."""
        response = await client.get("/api/v1/admin/changelog")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_requires_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ):
        """GET /admin/changelog should return 403 for regular users."""
        response = await client.get("/api/v1/admin/changelog", headers=auth_headers)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_requires_auth(self, client: AsyncClient):
        """GET /admin/changelog/{id} should return 401 without auth."""
        response = await client.get(f"/api/v1/admin/changelog/{uuid4()}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_requires_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ):
        """GET /admin/changelog/{id} should return 403 for regular users."""
        response = await client.get(
            f"/api/v1/admin/changelog/{uuid4()}",
            headers=auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_create_requires_auth(self, client: AsyncClient):
        """POST /admin/changelog should return 401 without auth."""
        response = await client.post(
            "/api/v1/admin/changelog",
            json={
                "title_en": "Test",
                "title_el": "Test",
                "title_ru": "Test",
                "content_en": "Content",
                "content_el": "Content",
                "content_ru": "Content",
                "tag": "new_feature",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_requires_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ):
        """POST /admin/changelog should return 403 for regular users."""
        response = await client.post(
            "/api/v1/admin/changelog",
            headers=auth_headers,
            json={
                "title_en": "Test",
                "title_el": "Test",
                "title_ru": "Test",
                "content_en": "Content",
                "content_el": "Content",
                "content_ru": "Content",
                "tag": "new_feature",
            },
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_requires_auth(self, client: AsyncClient):
        """PUT /admin/changelog/{id} should return 401 without auth."""
        response = await client.put(
            f"/api/v1/admin/changelog/{uuid4()}",
            json={"title_en": "Updated"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_update_requires_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ):
        """PUT /admin/changelog/{id} should return 403 for regular users."""
        response = await client.put(
            f"/api/v1/admin/changelog/{uuid4()}",
            headers=auth_headers,
            json={"title_en": "Updated"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_requires_auth(self, client: AsyncClient):
        """DELETE /admin/changelog/{id} should return 401 without auth."""
        response = await client.delete(f"/api/v1/admin/changelog/{uuid4()}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_requires_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
    ):
        """DELETE /admin/changelog/{id} should return 403 for regular users."""
        response = await client.delete(
            f"/api/v1/admin/changelog/{uuid4()}",
            headers=auth_headers,
        )
        assert response.status_code == 403


# =============================================================================
# Test GET /admin/changelog (List)
# =============================================================================


class TestAdminListChangelog:
    """Tests for GET /admin/changelog endpoint."""

    @pytest.mark.asyncio
    async def test_returns_all_language_fields(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        single_entry: ChangelogEntry,
    ):
        """Should return all language fields for each entry."""
        response = await client.get(
            "/api/v1/admin/changelog",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1

        item = data["items"][0]
        assert item["title_en"] == "Test Entry"
        assert item["title_el"] == "Δοκιμαστική Καταχώρηση"
        assert item["title_ru"] == "Тестовая Запись"
        assert "content_en" in item
        assert "content_el" in item
        assert "content_ru" in item

    @pytest.mark.asyncio
    async def test_pagination_works(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        changelog_entries: list[ChangelogEntry],
    ):
        """Should respect pagination parameters."""
        response = await client.get(
            "/api/v1/admin/changelog",
            params={"page": 1, "page_size": 2},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == len(changelog_entries)
        assert data["page"] == 1
        assert data["page_size"] == 2


# =============================================================================
# Test GET /admin/changelog/{id} (Get Single)
# =============================================================================


class TestAdminGetChangelog:
    """Tests for GET /admin/changelog/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_returns_entry(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        single_entry: ChangelogEntry,
    ):
        """Should return entry when it exists."""
        response = await client.get(
            f"/api/v1/admin/changelog/{single_entry.id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(single_entry.id)
        assert data["title_en"] == single_entry.title_en

    @pytest.mark.asyncio
    async def test_returns_404_when_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
    ):
        """Should return 404 for non-existent entry."""
        response = await client.get(
            f"/api/v1/admin/changelog/{uuid4()}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404


# =============================================================================
# Test POST /admin/changelog (Create)
# =============================================================================


class TestAdminCreateChangelog:
    """Tests for POST /admin/changelog endpoint."""

    @pytest.mark.asyncio
    async def test_creates_entry_returns_201(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
    ):
        """Should create entry and return 201."""
        response = await client.post(
            "/api/v1/admin/changelog",
            headers=superuser_auth_headers,
            json={
                "title_en": "New Feature Title",
                "title_el": "Νέο Χαρακτηριστικό",
                "title_ru": "Новая Функция",
                "content_en": "Description in English",
                "content_el": "Περιγραφή στα ελληνικά",
                "content_ru": "Описание на русском",
                "tag": "new_feature",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["title_en"] == "New Feature Title"
        assert data["tag"] == "new_feature"

    @pytest.mark.asyncio
    async def test_creates_with_bug_fix_tag(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
    ):
        """Should create entry with bug_fix tag."""
        response = await client.post(
            "/api/v1/admin/changelog",
            headers=superuser_auth_headers,
            json={
                "title_en": "Bug Fix",
                "title_el": "Διόρθωση",
                "title_ru": "Исправление",
                "content_en": "Fixed bug",
                "content_el": "Διορθώθηκε",
                "content_ru": "Исправлено",
                "tag": "bug_fix",
            },
        )

        assert response.status_code == 201
        assert response.json()["tag"] == "bug_fix"

    @pytest.mark.asyncio
    async def test_creates_with_announcement_tag(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
    ):
        """Should create entry with announcement tag."""
        response = await client.post(
            "/api/v1/admin/changelog",
            headers=superuser_auth_headers,
            json={
                "title_en": "Announcement",
                "title_el": "Ανακοίνωση",
                "title_ru": "Объявление",
                "content_en": "Important announcement",
                "content_el": "Σημαντική ανακοίνωση",
                "content_ru": "Важное объявление",
                "tag": "announcement",
            },
        )

        assert response.status_code == 201
        assert response.json()["tag"] == "announcement"

    @pytest.mark.asyncio
    async def test_validates_required_fields(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
    ):
        """Should return 422 when required fields are missing."""
        response = await client.post(
            "/api/v1/admin/changelog",
            headers=superuser_auth_headers,
            json={
                "title_en": "Only English",
                # Missing other required fields
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_validates_invalid_tag(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
    ):
        """Should return 422 for invalid tag value."""
        response = await client.post(
            "/api/v1/admin/changelog",
            headers=superuser_auth_headers,
            json={
                "title_en": "Test",
                "title_el": "Test",
                "title_ru": "Test",
                "content_en": "Content",
                "content_el": "Content",
                "content_ru": "Content",
                "tag": "invalid_tag",
            },
        )

        assert response.status_code == 422


# =============================================================================
# Test PUT /admin/changelog/{id} (Update)
# =============================================================================


class TestAdminUpdateChangelog:
    """Tests for PUT /admin/changelog/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_updates_entry(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        single_entry: ChangelogEntry,
    ):
        """Should update entry and return updated data."""
        response = await client.put(
            f"/api/v1/admin/changelog/{single_entry.id}",
            headers=superuser_auth_headers,
            json={
                "title_en": "Updated Title",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title_en"] == "Updated Title"
        # Other fields should be preserved
        assert data["title_el"] == single_entry.title_el

    @pytest.mark.asyncio
    async def test_partial_update(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        single_entry: ChangelogEntry,
    ):
        """Should allow partial updates."""
        original_content_ru = single_entry.content_ru

        response = await client.put(
            f"/api/v1/admin/changelog/{single_entry.id}",
            headers=superuser_auth_headers,
            json={
                "title_en": "Only English updated",
                "content_en": "Only English content updated",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title_en"] == "Only English updated"
        assert data["content_ru"] == original_content_ru

    @pytest.mark.asyncio
    async def test_updates_tag(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        single_entry: ChangelogEntry,
    ):
        """Should update tag field."""
        response = await client.put(
            f"/api/v1/admin/changelog/{single_entry.id}",
            headers=superuser_auth_headers,
            json={
                "tag": "announcement",
            },
        )

        assert response.status_code == 200
        assert response.json()["tag"] == "announcement"

    @pytest.mark.asyncio
    async def test_returns_404_when_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
    ):
        """Should return 404 for non-existent entry."""
        response = await client.put(
            f"/api/v1/admin/changelog/{uuid4()}",
            headers=superuser_auth_headers,
            json={"title_en": "Update attempt"},
        )

        assert response.status_code == 404


# =============================================================================
# Test DELETE /admin/changelog/{id} (Delete)
# =============================================================================


class TestAdminDeleteChangelog:
    """Tests for DELETE /admin/changelog/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_deletes_entry_returns_204(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        single_entry: ChangelogEntry,
    ):
        """Should delete entry and return 204 No Content."""
        response = await client.delete(
            f"/api/v1/admin/changelog/{single_entry.id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 204

        # Verify it's deleted
        get_response = await client.get(
            f"/api/v1/admin/changelog/{single_entry.id}",
            headers=superuser_auth_headers,
        )
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_returns_404_when_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
    ):
        """Should return 404 for non-existent entry."""
        response = await client.delete(
            f"/api/v1/admin/changelog/{uuid4()}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
