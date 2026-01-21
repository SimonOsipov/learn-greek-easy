"""Unit tests for NewsSourceService.

This module tests:
- DuplicateURLException initialization
- list_sources: pagination, filtering by is_active
- get_source: success, not found
- create_source: success, duplicate URL
- update_source: success, not found, duplicate URL, exclude self
- delete_source: success, not found

All tests use mocked dependencies for isolation.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.core.exceptions import NotFoundException
from src.schemas.admin import NewsSourceCreate, NewsSourceUpdate
from src.services.news_source_service import DuplicateURLException, NewsSourceService

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def mock_source():
    """Create a mock news source object."""
    source = MagicMock()
    source.id = uuid4()
    source.name = "Kathimerini"
    source.url = "https://www.kathimerini.gr"
    source.is_active = True
    source.created_at = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    source.updated_at = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
    return source


@pytest.fixture
def mock_inactive_source():
    """Create a mock inactive news source object."""
    source = MagicMock()
    source.id = uuid4()
    source.name = "Archived News"
    source.url = "https://archived.example.com"
    source.is_active = False
    source.created_at = datetime(2023, 6, 1, 0, 0, 0, tzinfo=timezone.utc)
    source.updated_at = datetime(2023, 12, 1, 0, 0, 0, tzinfo=timezone.utc)
    return source


# =============================================================================
# Test DuplicateURLException
# =============================================================================


@pytest.mark.unit
class TestDuplicateURLException:
    """Tests for DuplicateURLException."""

    def test_exception_stores_url(self):
        """Should store the duplicate URL in exception."""
        url = "https://duplicate.example.com"
        exc = DuplicateURLException(url)

        assert exc.url == url

    def test_exception_message_contains_url(self):
        """Should include URL in exception message."""
        url = "https://duplicate.example.com"
        exc = DuplicateURLException(url)

        assert url in str(exc)
        assert "URL already exists" in str(exc)


# =============================================================================
# Test list_sources
# =============================================================================


@pytest.mark.unit
class TestListSources:
    """Tests for list_sources method."""

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_sources(self, mock_db_session):
        """Should return empty list when no sources exist."""
        service = NewsSourceService(mock_db_session)

        with (
            patch.object(service.repo, "list_all", new_callable=AsyncMock) as mock_list,
            patch.object(service.repo, "count_all", new_callable=AsyncMock) as mock_count,
        ):
            mock_list.return_value = []
            mock_count.return_value = 0

            result = await service.list_sources()

            assert result.sources == []
            assert result.total == 0
            assert result.page == 1
            assert result.page_size == 10
            mock_list.assert_awaited_once_with(skip=0, limit=10, is_active=None)
            mock_count.assert_awaited_once_with(is_active=None)

    @pytest.mark.asyncio
    async def test_returns_sources_with_pagination(self, mock_db_session, mock_source):
        """Should return paginated sources."""
        service = NewsSourceService(mock_db_session)

        with (
            patch.object(service.repo, "list_all", new_callable=AsyncMock) as mock_list,
            patch.object(service.repo, "count_all", new_callable=AsyncMock) as mock_count,
        ):
            mock_list.return_value = [mock_source]
            mock_count.return_value = 1

            result = await service.list_sources(page=1, page_size=20)

            assert len(result.sources) == 1
            assert result.sources[0].id == mock_source.id
            assert result.sources[0].name == mock_source.name
            assert result.sources[0].url == mock_source.url
            assert result.total == 1
            assert result.page == 1
            assert result.page_size == 20
            mock_list.assert_awaited_once_with(skip=0, limit=20, is_active=None)

    @pytest.mark.asyncio
    async def test_calculates_skip_correctly_for_page_2(self, mock_db_session):
        """Should calculate correct skip value for page 2."""
        service = NewsSourceService(mock_db_session)

        with (
            patch.object(service.repo, "list_all", new_callable=AsyncMock) as mock_list,
            patch.object(service.repo, "count_all", new_callable=AsyncMock) as mock_count,
        ):
            mock_list.return_value = []
            mock_count.return_value = 0

            await service.list_sources(page=2, page_size=15)

            # skip = (page - 1) * page_size = (2 - 1) * 15 = 15
            mock_list.assert_awaited_once_with(skip=15, limit=15, is_active=None)

    @pytest.mark.asyncio
    async def test_calculates_skip_correctly_for_page_3(self, mock_db_session):
        """Should calculate correct skip value for page 3."""
        service = NewsSourceService(mock_db_session)

        with (
            patch.object(service.repo, "list_all", new_callable=AsyncMock) as mock_list,
            patch.object(service.repo, "count_all", new_callable=AsyncMock) as mock_count,
        ):
            mock_list.return_value = []
            mock_count.return_value = 0

            await service.list_sources(page=3, page_size=10)

            # skip = (page - 1) * page_size = (3 - 1) * 10 = 20
            mock_list.assert_awaited_once_with(skip=20, limit=10, is_active=None)

    @pytest.mark.asyncio
    async def test_filters_by_is_active_true(self, mock_db_session, mock_source):
        """Should filter sources by is_active=True."""
        service = NewsSourceService(mock_db_session)

        with (
            patch.object(service.repo, "list_all", new_callable=AsyncMock) as mock_list,
            patch.object(service.repo, "count_all", new_callable=AsyncMock) as mock_count,
        ):
            mock_list.return_value = [mock_source]
            mock_count.return_value = 1

            result = await service.list_sources(is_active=True)

            assert len(result.sources) == 1
            mock_list.assert_awaited_once_with(skip=0, limit=10, is_active=True)
            mock_count.assert_awaited_once_with(is_active=True)

    @pytest.mark.asyncio
    async def test_filters_by_is_active_false(self, mock_db_session, mock_inactive_source):
        """Should filter sources by is_active=False."""
        service = NewsSourceService(mock_db_session)

        with (
            patch.object(service.repo, "list_all", new_callable=AsyncMock) as mock_list,
            patch.object(service.repo, "count_all", new_callable=AsyncMock) as mock_count,
        ):
            mock_list.return_value = [mock_inactive_source]
            mock_count.return_value = 1

            result = await service.list_sources(is_active=False)

            assert len(result.sources) == 1
            assert result.sources[0].is_active is False
            mock_list.assert_awaited_once_with(skip=0, limit=10, is_active=False)
            mock_count.assert_awaited_once_with(is_active=False)


# =============================================================================
# Test get_source
# =============================================================================


@pytest.mark.unit
class TestGetSource:
    """Tests for get_source method."""

    @pytest.mark.asyncio
    async def test_returns_source_when_found(self, mock_db_session, mock_source):
        """Should return source when found by ID."""
        service = NewsSourceService(mock_db_session)
        source_id = mock_source.id

        with patch.object(service.repo, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_source

            result = await service.get_source(source_id)

            assert result.id == source_id
            assert result.name == mock_source.name
            assert result.url == mock_source.url
            assert result.is_active == mock_source.is_active
            assert result.created_at == mock_source.created_at
            assert result.updated_at == mock_source.updated_at
            mock_get.assert_awaited_once_with(source_id)

    @pytest.mark.asyncio
    async def test_raises_not_found_when_source_missing(self, mock_db_session):
        """Should raise NotFoundException when source doesn't exist."""
        service = NewsSourceService(mock_db_session)
        source_id = uuid4()

        with patch.object(service.repo, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None

            with pytest.raises(NotFoundException) as exc_info:
                await service.get_source(source_id)

            assert "News source" in str(exc_info.value.detail)
            assert str(source_id) in str(exc_info.value.detail)


# =============================================================================
# Test create_source
# =============================================================================


@pytest.mark.unit
class TestCreateSource:
    """Tests for create_source method."""

    @pytest.mark.asyncio
    async def test_creates_source_successfully(self, mock_db_session, mock_source):
        """Should create source when URL is unique."""
        service = NewsSourceService(mock_db_session)

        create_data = NewsSourceCreate(
            name="Proto Thema",
            url="https://www.protothema.gr",
            is_active=True,
        )

        # Create mock for the created source
        created_source = MagicMock()
        created_source.id = uuid4()
        created_source.name = create_data.name
        created_source.url = str(create_data.url)
        created_source.is_active = create_data.is_active
        created_source.created_at = datetime.now(timezone.utc)
        created_source.updated_at = datetime.now(timezone.utc)

        with (
            patch.object(service.repo, "url_exists", new_callable=AsyncMock) as mock_exists,
            patch.object(service.repo, "create", new_callable=AsyncMock) as mock_create,
        ):
            mock_exists.return_value = False
            mock_create.return_value = created_source

            result = await service.create_source(create_data)

            assert result.name == create_data.name
            assert result.url == str(create_data.url)
            assert result.is_active == create_data.is_active
            mock_exists.assert_awaited_once_with(str(create_data.url))
            mock_create.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_raises_duplicate_url_exception(self, mock_db_session):
        """Should raise DuplicateURLException when URL exists."""
        service = NewsSourceService(mock_db_session)

        create_data = NewsSourceCreate(
            name="Duplicate Source",
            url="https://existing.example.com",
        )

        with patch.object(service.repo, "url_exists", new_callable=AsyncMock) as mock_exists:
            mock_exists.return_value = True

            with pytest.raises(DuplicateURLException) as exc_info:
                await service.create_source(create_data)

            assert str(create_data.url) in str(exc_info.value)
            mock_exists.assert_awaited_once_with(str(create_data.url))

    @pytest.mark.asyncio
    async def test_creates_inactive_source(self, mock_db_session):
        """Should create inactive source when is_active=False."""
        service = NewsSourceService(mock_db_session)

        create_data = NewsSourceCreate(
            name="Inactive Source",
            url="https://inactive.example.com",
            is_active=False,
        )

        created_source = MagicMock()
        created_source.id = uuid4()
        created_source.name = create_data.name
        created_source.url = str(create_data.url)
        created_source.is_active = False
        created_source.created_at = datetime.now(timezone.utc)
        created_source.updated_at = datetime.now(timezone.utc)

        with (
            patch.object(service.repo, "url_exists", new_callable=AsyncMock) as mock_exists,
            patch.object(service.repo, "create", new_callable=AsyncMock) as mock_create,
        ):
            mock_exists.return_value = False
            mock_create.return_value = created_source

            result = await service.create_source(create_data)

            assert result.is_active is False
            # Verify create was called with is_active=False
            call_args = mock_create.call_args[0][0]
            assert call_args["is_active"] is False


# =============================================================================
# Test update_source
# =============================================================================


@pytest.mark.unit
class TestUpdateSource:
    """Tests for update_source method."""

    @pytest.mark.asyncio
    async def test_updates_source_successfully(self, mock_db_session, mock_source):
        """Should update source when found."""
        service = NewsSourceService(mock_db_session)
        source_id = mock_source.id

        update_data = NewsSourceUpdate(
            name="Updated Name",
        )

        updated_source = MagicMock()
        updated_source.id = source_id
        updated_source.name = "Updated Name"
        updated_source.url = mock_source.url
        updated_source.is_active = mock_source.is_active
        updated_source.created_at = mock_source.created_at
        updated_source.updated_at = datetime.now(timezone.utc)

        with (
            patch.object(service.repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(service.repo, "update", new_callable=AsyncMock) as mock_update,
        ):
            mock_get.return_value = mock_source
            mock_update.return_value = updated_source

            result = await service.update_source(source_id, update_data)

            assert result.id == source_id
            assert result.name == "Updated Name"
            mock_get.assert_awaited_once_with(source_id)
            mock_update.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_raises_not_found_when_source_missing(self, mock_db_session):
        """Should raise NotFoundException when source doesn't exist."""
        service = NewsSourceService(mock_db_session)
        source_id = uuid4()

        update_data = NewsSourceUpdate(name="New Name")

        with patch.object(service.repo, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None

            with pytest.raises(NotFoundException) as exc_info:
                await service.update_source(source_id, update_data)

            assert "News source" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_raises_duplicate_url_on_update(self, mock_db_session, mock_source):
        """Should raise DuplicateURLException when updating to existing URL."""
        service = NewsSourceService(mock_db_session)
        source_id = mock_source.id

        update_data = NewsSourceUpdate(
            url="https://existing.example.com",
        )

        with (
            patch.object(service.repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(service.repo, "url_exists", new_callable=AsyncMock) as mock_exists,
        ):
            mock_get.return_value = mock_source
            mock_exists.return_value = True

            with pytest.raises(DuplicateURLException):
                await service.update_source(source_id, update_data)

            # Should check URL uniqueness excluding self
            mock_exists.assert_awaited_once_with(str(update_data.url), exclude_id=source_id)

    @pytest.mark.asyncio
    async def test_allows_update_with_same_url(self, mock_db_session, mock_source):
        """Should allow update when URL is same as current (exclude_id works)."""
        service = NewsSourceService(mock_db_session)
        source_id = mock_source.id

        # Use the same URL as mock_source (HttpUrl will normalize it)
        update_data = NewsSourceUpdate(
            url="https://www.kathimerini.gr",  # Same URL as mock_source
            name="Updated Name",
        )

        updated_source = MagicMock()
        updated_source.id = source_id
        updated_source.name = "Updated Name"
        updated_source.url = mock_source.url
        updated_source.is_active = mock_source.is_active
        updated_source.created_at = mock_source.created_at
        updated_source.updated_at = datetime.now(timezone.utc)

        with (
            patch.object(service.repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(service.repo, "url_exists", new_callable=AsyncMock) as mock_exists,
            patch.object(service.repo, "update", new_callable=AsyncMock) as mock_update,
        ):
            mock_get.return_value = mock_source
            mock_exists.return_value = False  # Excluded itself
            mock_update.return_value = updated_source

            result = await service.update_source(source_id, update_data)

            assert result.name == "Updated Name"
            # HttpUrl normalizes URL with trailing slash
            mock_exists.assert_awaited_once_with(str(update_data.url), exclude_id=source_id)

    @pytest.mark.asyncio
    async def test_partial_update_only_name(self, mock_db_session, mock_source):
        """Should update only provided fields."""
        service = NewsSourceService(mock_db_session)
        source_id = mock_source.id

        update_data = NewsSourceUpdate(name="Only Name Changed")

        updated_source = MagicMock()
        updated_source.id = source_id
        updated_source.name = "Only Name Changed"
        updated_source.url = mock_source.url
        updated_source.is_active = mock_source.is_active
        updated_source.created_at = mock_source.created_at
        updated_source.updated_at = datetime.now(timezone.utc)

        with (
            patch.object(service.repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(service.repo, "update", new_callable=AsyncMock) as mock_update,
        ):
            mock_get.return_value = mock_source
            mock_update.return_value = updated_source

            result = await service.update_source(source_id, update_data)

            # URL should not change
            assert result.url == mock_source.url
            # Verify update was called with only name
            call_args = mock_update.call_args[0][1]
            assert "name" in call_args
            assert "url" not in call_args

    @pytest.mark.asyncio
    async def test_update_is_active_to_false(self, mock_db_session, mock_source):
        """Should update is_active to False."""
        service = NewsSourceService(mock_db_session)
        source_id = mock_source.id

        update_data = NewsSourceUpdate(is_active=False)

        updated_source = MagicMock()
        updated_source.id = source_id
        updated_source.name = mock_source.name
        updated_source.url = mock_source.url
        updated_source.is_active = False
        updated_source.created_at = mock_source.created_at
        updated_source.updated_at = datetime.now(timezone.utc)

        with (
            patch.object(service.repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(service.repo, "update", new_callable=AsyncMock) as mock_update,
        ):
            mock_get.return_value = mock_source
            mock_update.return_value = updated_source

            result = await service.update_source(source_id, update_data)

            assert result.is_active is False


# =============================================================================
# Test delete_source
# =============================================================================


@pytest.mark.unit
class TestDeleteSource:
    """Tests for delete_source method."""

    @pytest.mark.asyncio
    async def test_deletes_source_successfully(self, mock_db_session, mock_source):
        """Should delete source when found."""
        service = NewsSourceService(mock_db_session)
        source_id = mock_source.id

        with (
            patch.object(service.repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(service.repo, "delete", new_callable=AsyncMock) as mock_delete,
        ):
            mock_get.return_value = mock_source

            await service.delete_source(source_id)

            mock_get.assert_awaited_once_with(source_id)
            mock_delete.assert_awaited_once_with(mock_source)

    @pytest.mark.asyncio
    async def test_raises_not_found_when_deleting_missing_source(self, mock_db_session):
        """Should raise NotFoundException when source doesn't exist."""
        service = NewsSourceService(mock_db_session)
        source_id = uuid4()

        with patch.object(service.repo, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None

            with pytest.raises(NotFoundException) as exc_info:
                await service.delete_source(source_id)

            assert "News source" in str(exc_info.value.detail)
            assert str(source_id) in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_delete_returns_none(self, mock_db_session, mock_source):
        """Should return None after successful deletion."""
        service = NewsSourceService(mock_db_session)
        source_id = mock_source.id

        with (
            patch.object(service.repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(service.repo, "delete", new_callable=AsyncMock),
        ):
            mock_get.return_value = mock_source

            result = await service.delete_source(source_id)

            assert result is None
