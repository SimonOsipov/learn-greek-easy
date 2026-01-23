"""Integration tests for admin article analysis API endpoints.

This module tests the admin article analysis endpoints:
- POST /api/v1/admin/culture/sources/history/{id}/analyze - Trigger AI analysis
- GET /api/v1/admin/culture/sources/history/{id}/articles - Get analysis results

Tests cover:
- Authentication requirements (401 without auth)
- Authorization (403 for non-superusers)
- Success cases with proper response structures
- Error handling (404 not found, 400 bad request)
"""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import NewsSourceFactory, SourceFetchHistoryFactory

# =============================================================================
# Trigger Analysis Endpoint Tests
# =============================================================================


class TestTriggerAnalysisEndpoint:
    """Test suite for POST /api/v1/admin/culture/sources/history/{id}/analyze endpoint."""

    @pytest.mark.asyncio
    async def test_trigger_analysis_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        fake_id = uuid4()
        response = await client.post(f"/api/v1/admin/culture/sources/history/{fake_id}/analyze")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_trigger_analysis_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        fake_id = uuid4()
        response = await client.post(
            f"/api/v1/admin/culture/sources/history/{fake_id}/analyze",
            headers=auth_headers,
        )

        assert response.status_code == 403
        error = response.json()
        assert error.get("success") is False
        assert error.get("error", {}).get("code") == "FORBIDDEN"

    @pytest.mark.asyncio
    async def test_trigger_analysis_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that analyzing non-existent history returns 404."""
        fake_id = uuid4()
        response = await client.post(
            f"/api/v1/admin/culture/sources/history/{fake_id}/analyze",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_trigger_analysis_no_html_returns_400(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that analyzing history with no HTML content returns 400."""
        # Arrange - Create a source with error fetch history (no HTML)
        source = await NewsSourceFactory.create(name="No HTML Test Source")
        history = await SourceFetchHistoryFactory.create(
            source_id=source.id,
            error=True,  # This sets html_content to None
        )

        # Act
        response = await client.post(
            f"/api/v1/admin/culture/sources/history/{history.id}/analyze",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 400
        data = response.json()
        # Application uses custom error format
        assert data.get("success") is False
        error = data.get("error", {})
        assert "No HTML content available" in error.get("message", "")

    @pytest.mark.asyncio
    async def test_trigger_analysis_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that triggering analysis returns 202 and sets pending status."""
        # Arrange - Create a source with successful fetch history
        source = await NewsSourceFactory.create(name="Analysis Test Source")
        history = await SourceFetchHistoryFactory.create(
            source_id=source.id,
            html_content="<html><body><a href='/article'>Test Article</a></body></html>",
        )

        # Act
        response = await client.post(
            f"/api/v1/admin/culture/sources/history/{history.id}/analyze",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 202
        data = response.json()
        assert data["message"] == "Analysis started"
        assert data["history_id"] == str(history.id)

    @pytest.mark.asyncio
    async def test_trigger_analysis_sets_pending_status(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that triggering analysis sets the status to pending."""
        # Arrange - Create history with previous failed status
        source = await NewsSourceFactory.create(name="Status Test Source")
        history = await SourceFetchHistoryFactory.create(
            source_id=source.id,
            html_content="<html><body>Content</body></html>",
        )
        # Manually set previous analysis state
        history.analysis_status = "failed"
        history.analysis_error = "Previous error"
        await db_session.commit()
        await db_session.refresh(history)

        # Act
        response = await client.post(
            f"/api/v1/admin/culture/sources/history/{history.id}/analyze",
            headers=superuser_auth_headers,
        )

        # Assert - Response is 202
        assert response.status_code == 202

        # Verify status was updated in database
        await db_session.refresh(history)
        assert history.analysis_status == "pending"
        assert history.analysis_error is None

    @pytest.mark.asyncio
    async def test_trigger_analysis_response_structure(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that response matches expected schema structure."""
        # Arrange - Create a source with history
        source = await NewsSourceFactory.create(name="Schema Test Source")
        history = await SourceFetchHistoryFactory.create(source_id=source.id)

        # Act
        response = await client.post(
            f"/api/v1/admin/culture/sources/history/{history.id}/analyze",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 202
        data = response.json()

        # Verify all expected fields are present
        assert "message" in data
        assert "history_id" in data
        assert isinstance(data["message"], str)
        assert isinstance(data["history_id"], str)


# =============================================================================
# Get Analysis Results Endpoint Tests
# =============================================================================


class TestGetAnalysisResultsEndpoint:
    """Test suite for GET /api/v1/admin/culture/sources/history/{id}/articles endpoint."""

    @pytest.mark.asyncio
    async def test_get_articles_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        fake_id = uuid4()
        response = await client.get(f"/api/v1/admin/culture/sources/history/{fake_id}/articles")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_articles_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        fake_id = uuid4()
        response = await client.get(
            f"/api/v1/admin/culture/sources/history/{fake_id}/articles",
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_articles_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that getting articles for non-existent history returns 404."""
        fake_id = uuid4()
        response = await client.get(
            f"/api/v1/admin/culture/sources/history/{fake_id}/articles",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_articles_pending_status(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test getting articles when analysis is pending."""
        # Arrange - Create history with pending analysis
        source = await NewsSourceFactory.create(name="Pending Test Source")
        history = await SourceFetchHistoryFactory.create(source_id=source.id)
        history.analysis_status = "pending"
        await db_session.commit()
        await db_session.refresh(history)

        # Act
        response = await client.get(
            f"/api/v1/admin/culture/sources/history/{history.id}/articles",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["analysis_status"] == "pending"
        assert data["discovered_articles"] is None or data["discovered_articles"] == []

    @pytest.mark.asyncio
    async def test_get_articles_completed_with_results(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test getting articles when analysis is completed with results."""
        # Arrange - Create history with completed analysis
        source = await NewsSourceFactory.create(name="Completed Test Source")
        history = await SourceFetchHistoryFactory.create(source_id=source.id)

        # Set completed analysis state with discovered articles
        history.analysis_status = "completed"
        history.analyzed_at = datetime.now(timezone.utc)
        history.analysis_tokens_used = 1500
        history.discovered_articles = [
            {
                "url": "https://example.com/article1",
                "title": "Cyprus History Article",
                "reasoning": "Relevant to Cypriot culture and history",
            },
            {
                "url": "https://example.com/article2",
                "title": "Greek Traditions",
                "reasoning": "Covers traditional Greek customs",
            },
        ]
        await db_session.commit()
        await db_session.refresh(history)

        # Act
        response = await client.get(
            f"/api/v1/admin/culture/sources/history/{history.id}/articles",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["analysis_status"] == "completed"
        assert data["analysis_tokens_used"] == 1500
        assert data["analyzed_at"] is not None
        assert len(data["discovered_articles"]) == 2

        # Verify article structure
        article = data["discovered_articles"][0]
        assert article["url"] == "https://example.com/article1"
        assert article["title"] == "Cyprus History Article"
        assert article["reasoning"] == "Relevant to Cypriot culture and history"

    @pytest.mark.asyncio
    async def test_get_articles_failed_status(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test getting articles when analysis failed."""
        # Arrange - Create history with failed analysis
        source = await NewsSourceFactory.create(name="Failed Test Source")
        history = await SourceFetchHistoryFactory.create(source_id=source.id)
        history.analysis_status = "failed"
        history.analysis_error = "Claude API rate limit exceeded"
        await db_session.commit()
        await db_session.refresh(history)

        # Act
        response = await client.get(
            f"/api/v1/admin/culture/sources/history/{history.id}/articles",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["analysis_status"] == "failed"
        assert data["analysis_error"] == "Claude API rate limit exceeded"

    @pytest.mark.asyncio
    async def test_get_articles_no_analysis_yet(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test getting articles when analysis hasn't been triggered yet."""
        # Arrange - Create history without any analysis state
        source = await NewsSourceFactory.create(name="No Analysis Test Source")
        history = await SourceFetchHistoryFactory.create(source_id=source.id)

        # Act
        response = await client.get(
            f"/api/v1/admin/culture/sources/history/{history.id}/articles",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["analysis_status"] is None
        assert data["discovered_articles"] is None or data["discovered_articles"] == []

    @pytest.mark.asyncio
    async def test_get_articles_response_structure(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that response matches expected schema structure."""
        # Arrange - Create a source with history
        source = await NewsSourceFactory.create(name="Schema Articles Test Source")
        history = await SourceFetchHistoryFactory.create(source_id=source.id)

        # Act
        response = await client.get(
            f"/api/v1/admin/culture/sources/history/{history.id}/articles",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()

        # Verify all expected fields are present (from SourceFetchHistoryDetailResponse)
        assert "id" in data
        assert "source_id" in data
        assert "fetched_at" in data
        assert "status" in data
        assert "trigger_type" in data
        assert "analysis_status" in data
        assert "discovered_articles" in data
        assert "analysis_error" in data
        assert "analysis_tokens_used" in data
        assert "analyzed_at" in data
        assert "created_at" in data
        assert "updated_at" in data
