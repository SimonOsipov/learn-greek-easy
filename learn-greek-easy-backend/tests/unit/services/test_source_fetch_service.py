"""Unit tests for SourceFetchService.

This module tests:
- fetch_source: Fetch HTML and store result (success and error cases)
- get_history: Get fetch history for a source
- get_history_html: Get specific history entry with HTML content

All tests use mocked dependencies for isolation.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import httpx
import pytest

from src.core.exceptions import NotFoundException
from src.services.source_fetch_service import SourceFetchService

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
    return source


@pytest.fixture
def mock_history_success():
    """Create a mock successful fetch history entry."""
    history = MagicMock()
    history.id = uuid4()
    history.source_id = uuid4()
    history.fetched_at = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
    history.status = "success"
    history.html_content = "<html><body>Test content</body></html>"
    history.html_size_bytes = 42
    history.trigger_type = "manual"
    history.final_url = "https://www.kathimerini.gr"
    history.error_message = None
    return history


@pytest.fixture
def mock_history_error():
    """Create a mock failed fetch history entry."""
    history = MagicMock()
    history.id = uuid4()
    history.source_id = uuid4()
    history.fetched_at = datetime(2024, 1, 15, 11, 0, 0, tzinfo=timezone.utc)
    history.status = "error"
    history.html_content = None
    history.html_size_bytes = None
    history.trigger_type = "scheduled"
    history.final_url = None
    history.error_message = "Connection timeout after 30.0s"
    return history


# =============================================================================
# Test fetch_source
# =============================================================================


@pytest.mark.unit
class TestFetchSource:
    """Tests for fetch_source method."""

    @pytest.mark.asyncio
    async def test_raises_not_found_when_source_missing(self, mock_db_session):
        """Should raise NotFoundException when source doesn't exist."""
        service = SourceFetchService(mock_db_session)
        source_id = uuid4()

        with patch.object(service.source_repo, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None

            with pytest.raises(NotFoundException) as exc_info:
                await service.fetch_source(source_id)

            assert "Source" in str(exc_info.value.detail)
            assert str(source_id) in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_creates_success_history_on_successful_fetch(self, mock_db_session, mock_source):
        """Should create success history entry when fetch succeeds."""
        service = SourceFetchService(mock_db_session)
        source_id = mock_source.id

        html_content = "<html><body>Test HTML</body></html>"
        final_url = "https://www.kathimerini.gr"

        with (
            patch.object(service.source_repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(service, "_fetch_html", new_callable=AsyncMock) as mock_fetch_html,
        ):
            mock_get.return_value = mock_source
            mock_fetch_html.return_value = (html_content, final_url, None)

            result = await service.fetch_source(source_id)

            assert result.status == "success"
            assert result.html_content == html_content
            assert result.html_size_bytes == len(html_content.encode("utf-8"))
            assert result.final_url == final_url
            assert result.error_message is None
            assert result.trigger_type == "manual"
            mock_db_session.add.assert_called_once()
            mock_db_session.flush.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_creates_error_history_on_failed_fetch(self, mock_db_session, mock_source):
        """Should create error history entry when fetch fails."""
        service = SourceFetchService(mock_db_session)
        source_id = mock_source.id

        error_message = "Connection timeout after 30.0s"

        with (
            patch.object(service.source_repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(service, "_fetch_html", new_callable=AsyncMock) as mock_fetch_html,
        ):
            mock_get.return_value = mock_source
            mock_fetch_html.return_value = (None, None, error_message)

            result = await service.fetch_source(source_id)

            assert result.status == "error"
            assert result.html_content is None
            assert result.html_size_bytes is None
            assert result.error_message == error_message
            assert result.final_url is None

    @pytest.mark.asyncio
    async def test_uses_scheduled_trigger_type(self, mock_db_session, mock_source):
        """Should use provided trigger_type."""
        service = SourceFetchService(mock_db_session)
        source_id = mock_source.id

        with (
            patch.object(service.source_repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(service, "_fetch_html", new_callable=AsyncMock) as mock_fetch_html,
        ):
            mock_get.return_value = mock_source
            mock_fetch_html.return_value = ("<html></html>", mock_source.url, None)

            result = await service.fetch_source(source_id, trigger_type="scheduled")

            assert result.trigger_type == "scheduled"


# =============================================================================
# Test _fetch_html
# =============================================================================


@pytest.mark.unit
class TestFetchHtml:
    """Tests for _fetch_html method."""

    @pytest.mark.asyncio
    async def test_returns_html_on_success(self, mock_db_session):
        """Should return HTML content and final URL on success."""
        service = SourceFetchService(mock_db_session)

        mock_response = MagicMock()
        mock_response.text = "<html><body>Test</body></html>"
        mock_response.url = "https://www.kathimerini.gr"

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_response.raise_for_status = MagicMock()
            mock_client_cls.return_value = mock_client

            html, final_url, error = await service._fetch_html("https://www.kathimerini.gr")

            assert html == "<html><body>Test</body></html>"
            assert final_url == "https://www.kathimerini.gr"
            assert error is None

    @pytest.mark.asyncio
    async def test_returns_error_on_timeout(self, mock_db_session):
        """Should return error message on timeout."""
        service = SourceFetchService(mock_db_session)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
            mock_client_cls.return_value = mock_client

            html, final_url, error = await service._fetch_html("https://www.kathimerini.gr")

            assert html is None
            assert final_url is None
            assert "timeout" in error.lower()

    @pytest.mark.asyncio
    async def test_returns_error_on_http_error(self, mock_db_session):
        """Should return HTTP status code on HTTP error."""
        service = SourceFetchService(mock_db_session)

        mock_response = MagicMock()
        mock_response.status_code = 404

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.get = AsyncMock(
                side_effect=httpx.HTTPStatusError(
                    "Not Found", request=MagicMock(), response=mock_response
                )
            )
            mock_client_cls.return_value = mock_client

            html, final_url, error = await service._fetch_html("https://www.kathimerini.gr")

            assert html is None
            assert final_url is None
            assert "404" in error

    @pytest.mark.asyncio
    async def test_returns_error_on_request_error(self, mock_db_session):
        """Should return error message on request error."""
        service = SourceFetchService(mock_db_session)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.get = AsyncMock(side_effect=httpx.RequestError("Connection refused"))
            mock_client_cls.return_value = mock_client

            html, final_url, error = await service._fetch_html("https://www.kathimerini.gr")

            assert html is None
            assert final_url is None
            assert error is not None


# =============================================================================
# Test get_history
# =============================================================================


@pytest.mark.unit
class TestGetHistory:
    """Tests for get_history method."""

    @pytest.mark.asyncio
    async def test_raises_not_found_when_source_missing(self, mock_db_session):
        """Should raise NotFoundException when source doesn't exist."""
        service = SourceFetchService(mock_db_session)
        source_id = uuid4()

        with patch.object(service.source_repo, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None

            with pytest.raises(NotFoundException) as exc_info:
                await service.get_history(source_id)

            assert "Source" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_returns_empty_history(self, mock_db_session, mock_source):
        """Should return empty list and zero count when no history exists."""
        service = SourceFetchService(mock_db_session)
        source_id = mock_source.id

        with (
            patch.object(service.source_repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(
                service.history_repo, "list_by_source", new_callable=AsyncMock
            ) as mock_list,
            patch.object(
                service.history_repo, "count_by_source", new_callable=AsyncMock
            ) as mock_count,
        ):
            mock_get.return_value = mock_source
            mock_list.return_value = []
            mock_count.return_value = 0

            items, total = await service.get_history(source_id)

            assert items == []
            assert total == 0

    @pytest.mark.asyncio
    async def test_returns_history_with_count(
        self, mock_db_session, mock_source, mock_history_success
    ):
        """Should return history items and total count."""
        service = SourceFetchService(mock_db_session)
        source_id = mock_source.id

        with (
            patch.object(service.source_repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(
                service.history_repo, "list_by_source", new_callable=AsyncMock
            ) as mock_list,
            patch.object(
                service.history_repo, "count_by_source", new_callable=AsyncMock
            ) as mock_count,
        ):
            mock_get.return_value = mock_source
            mock_list.return_value = [mock_history_success]
            mock_count.return_value = 1

            items, total = await service.get_history(source_id)

            assert len(items) == 1
            assert items[0].id == mock_history_success.id
            assert total == 1
            mock_list.assert_awaited_once_with(source_id, limit=10)

    @pytest.mark.asyncio
    async def test_respects_limit_parameter(self, mock_db_session, mock_source):
        """Should pass limit parameter to repository."""
        service = SourceFetchService(mock_db_session)
        source_id = mock_source.id

        with (
            patch.object(service.source_repo, "get", new_callable=AsyncMock) as mock_get,
            patch.object(
                service.history_repo, "list_by_source", new_callable=AsyncMock
            ) as mock_list,
            patch.object(
                service.history_repo, "count_by_source", new_callable=AsyncMock
            ) as mock_count,
        ):
            mock_get.return_value = mock_source
            mock_list.return_value = []
            mock_count.return_value = 0

            await service.get_history(source_id, limit=5)

            mock_list.assert_awaited_once_with(source_id, limit=5)


# =============================================================================
# Test get_history_html
# =============================================================================


@pytest.mark.unit
class TestGetHistoryHtml:
    """Tests for get_history_html method."""

    @pytest.mark.asyncio
    async def test_raises_not_found_when_history_missing(self, mock_db_session):
        """Should raise NotFoundException when history entry doesn't exist."""
        service = SourceFetchService(mock_db_session)
        history_id = uuid4()

        with patch.object(service.history_repo, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None

            with pytest.raises(NotFoundException) as exc_info:
                await service.get_history_html(history_id)

            assert "History" in str(exc_info.value.detail)
            assert str(history_id) in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_raises_not_found_when_no_html_content(self, mock_db_session, mock_history_error):
        """Should raise NotFoundException when history has no HTML (failed fetch)."""
        service = SourceFetchService(mock_db_session)
        history_id = mock_history_error.id

        with patch.object(service.history_repo, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_history_error

            with pytest.raises(NotFoundException) as exc_info:
                await service.get_history_html(history_id)

            assert "no HTML content" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_returns_history_with_html(self, mock_db_session, mock_history_success):
        """Should return history entry with HTML content."""
        service = SourceFetchService(mock_db_session)
        history_id = mock_history_success.id

        with patch.object(service.history_repo, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_history_success

            result = await service.get_history_html(history_id)

            assert result.id == history_id
            assert result.html_content is not None
            mock_get.assert_awaited_once_with(history_id)
