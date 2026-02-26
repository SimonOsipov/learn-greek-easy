"""Unit tests for admin endpoint audio task integration.

This module tests that the admin news endpoints correctly schedule
background audio generation tasks when appropriate.

Tests cover:
- POST /api/v1/admin/news - schedules audio task on creation
- PUT /api/v1/admin/news/{id} - schedules audio task when description_el changes
- PUT /api/v1/admin/news/{id} - skips audio task when description_el not in payload
"""

from datetime import date
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.schemas.news_item import NewsItemWithCardResponse
from tests.factories.news import NewsItemFactory


class TestAdminNewsAudioIntegration:
    """Unit tests for audio task scheduling in admin news endpoints."""

    # =========================================================================
    # Create News Item - Audio Task Scheduling
    # =========================================================================

    @pytest.mark.asyncio
    async def test_create_news_item_schedules_audio_task(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that creating a news item schedules audio generation task.

        POST /api/v1/admin/news should call generate_audio_for_news_item_task
        with the news item ID and Greek description.
        """
        # Mock NewsItemService to avoid real image downloads
        mock_service_instance = AsyncMock()
        mock_news_id = uuid4()

        # Construct a valid NewsItemWithCardResponse
        from src.schemas.news_item import NewsItemResponse

        mock_response = NewsItemWithCardResponse(
            news_item=NewsItemResponse(
                id=mock_news_id,
                title_el="Ελληνικός Τίτλος",
                title_en="English Title",
                title_ru="Русский заголовок",
                description_el="Ελληνική περιγραφή",
                description_en="English description",
                description_ru="Русское описание",
                publication_date=date(2024, 1, 15),
                original_article_url="https://example.com/article",
                country="cyprus",
                image_url="https://s3.amazonaws.com/test.jpg",
                audio_url=None,
                created_at="2024-01-15T10:30:00Z",
                updated_at="2024-01-15T10:30:00Z",
            ),
            card=None,
            message="News item created successfully",
        )

        mock_service_instance.create_with_question.return_value = mock_response

        # Mock generate_audio_for_news_item_task
        with (
            patch("src.api.v1.admin.NewsItemService") as MockService,
            patch("src.api.v1.admin.generate_audio_for_news_item_task") as mock_task,
        ):
            MockService.return_value = mock_service_instance

            payload = {
                "title_el": "Ελληνικός Τίτλος",
                "title_en": "English Title",
                "title_ru": "Русский заголовок",
                "description_el": "Ελληνική περιγραφή",
                "description_en": "English description",
                "description_ru": "Русское описание",
                "publication_date": "2024-01-15",
                "original_article_url": "https://example.com/article",
                "source_image_url": "https://example.com/image.jpg",
                "country": "cyprus",
            }

            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

            # Assert successful creation
            assert response.status_code == 201
            data = response.json()
            assert "news_item" in data
            assert data["news_item"]["id"] == str(mock_news_id)

            # Assert audio task was scheduled
            mock_task.assert_called_once()
            call_kwargs = mock_task.call_args.kwargs
            assert call_kwargs["news_item_id"] == mock_news_id
            assert call_kwargs["description_el"] == "Ελληνική περιγραφή"
            assert "db_url" in call_kwargs

    # =========================================================================
    # Update News Item - Audio Task Scheduling When description_el Changes
    # =========================================================================

    @pytest.mark.asyncio
    async def test_update_news_item_schedules_audio_when_description_el_changes(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that updating description_el schedules audio task.

        PUT /api/v1/admin/news/{id} with description_el should call
        generate_audio_for_news_item_task.
        """
        # Create a real news item in the DB
        news_item = await NewsItemFactory.create(session=db_session)

        # Mock generate_audio_for_news_item_task
        with patch("src.api.v1.admin.generate_audio_for_news_item_task") as mock_task:
            payload = {
                "description_el": "Νέα ελληνική περιγραφή",
            }

            response = await client.put(
                f"/api/v1/admin/news/{news_item.id}",
                json=payload,
                headers=superuser_auth_headers,
            )

            # Assert successful update
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == str(news_item.id)
            assert data["description_el"] == "Νέα ελληνική περιγραφή"

            # Assert audio task was scheduled
            mock_task.assert_called_once()
            call_kwargs = mock_task.call_args.kwargs
            assert call_kwargs["news_item_id"] == news_item.id
            assert call_kwargs["description_el"] == "Νέα ελληνική περιγραφή"
            assert "db_url" in call_kwargs

    # =========================================================================
    # Update News Item - No Audio Task When description_el Not in Payload
    # =========================================================================

    @pytest.mark.asyncio
    async def test_update_news_item_skips_audio_when_description_el_not_in_payload(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that updating without description_el does NOT schedule audio task.

        PUT /api/v1/admin/news/{id} with only other fields should NOT call
        generate_audio_for_news_item_task.
        """
        # Create a real news item in the DB
        news_item = await NewsItemFactory.create(session=db_session)

        # Mock generate_audio_for_news_item_task
        with patch("src.api.v1.admin.generate_audio_for_news_item_task") as mock_task:
            payload = {
                "title_el": "Νέος ελληνικός τίτλος",
            }

            response = await client.put(
                f"/api/v1/admin/news/{news_item.id}",
                json=payload,
                headers=superuser_auth_headers,
            )

            # Assert successful update
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == str(news_item.id)
            assert data["title_el"] == "Νέος ελληνικός τίτλος"

            # Assert audio task was NOT called
            mock_task.assert_not_called()


class TestAdminRegenerateAudio:
    """Unit tests for POST /api/v1/admin/news/{id}/regenerate-audio endpoint."""

    # =========================================================================
    # Regenerate Audio - Happy Path
    # =========================================================================

    @pytest.mark.asyncio
    async def test_regenerate_audio_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that regenerating audio schedules the task and returns 202.

        POST /api/v1/admin/news/{id}/regenerate-audio should schedule
        generate_audio_for_news_item_task and return 202 Accepted.
        """
        # Create a news item with Greek description
        news_item = await NewsItemFactory.create(
            session=db_session,
            description_el="Ελληνική περιγραφή για αναδημιουργία ήχου",
        )

        # Mock both gates as enabled
        from src.config import settings

        with (
            patch("src.api.v1.admin.is_background_tasks_enabled", return_value=True),
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
            patch("src.api.v1.admin.generate_audio_for_news_item_task") as mock_task,
        ):
            response = await client.post(
                f"/api/v1/admin/news/{news_item.id}/regenerate-audio",
                headers=superuser_auth_headers,
            )

            # Assert 202 Accepted
            assert response.status_code == 202
            data = response.json()
            assert data["message"] == "Audio regeneration started"

            # Assert audio task was scheduled
            mock_task.assert_called_once()
            call_kwargs = mock_task.call_args.kwargs
            assert call_kwargs["news_item_id"] == news_item.id
            assert call_kwargs["description_el"] == "Ελληνική περιγραφή για αναδημιουργία ήχου"
            assert "db_url" in call_kwargs

    # =========================================================================
    # Regenerate Audio - News Item Not Found
    # =========================================================================

    @pytest.mark.asyncio
    async def test_regenerate_audio_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that regenerating audio for nonexistent item returns 404.

        POST /api/v1/admin/news/{random-uuid}/regenerate-audio should return 404.
        """
        random_id = uuid4()

        # Mock gates as enabled (gates are checked BEFORE DB query)
        from src.config import settings

        with (
            patch("src.api.v1.admin.is_background_tasks_enabled", return_value=True),
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
            patch("src.api.v1.admin.generate_audio_for_news_item_task") as mock_task,
        ):
            response = await client.post(
                f"/api/v1/admin/news/{random_id}/regenerate-audio",
                headers=superuser_auth_headers,
            )

            # Assert 404
            assert response.status_code == 404
            data = response.json()
            assert data["success"] is False
            assert "not found" in data["error"]["message"].lower()

            # Task should not be called
            mock_task.assert_not_called()

    # =========================================================================
    # Regenerate Audio - Empty Greek Description
    # =========================================================================

    @pytest.mark.asyncio
    async def test_regenerate_audio_empty_description(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that regenerating audio with empty description_el returns 400.

        POST /api/v1/admin/news/{id}/regenerate-audio should return 400
        if description_el is empty or whitespace-only.
        """
        # Create news item with empty Greek description
        news_item = await NewsItemFactory.create(
            session=db_session,
            description_el="",
        )

        # Mock gates as enabled
        from src.config import settings

        with (
            patch("src.api.v1.admin.is_background_tasks_enabled", return_value=True),
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
            patch("src.api.v1.admin.generate_audio_for_news_item_task") as mock_task,
        ):
            response = await client.post(
                f"/api/v1/admin/news/{news_item.id}/regenerate-audio",
                headers=superuser_auth_headers,
            )

            # Assert 400
            assert response.status_code == 400
            data = response.json()
            assert data["success"] is False
            assert "no Greek description" in data["error"]["message"]

            # Task should not be called
            mock_task.assert_not_called()

    # =========================================================================
    # Regenerate Audio - Background Tasks Disabled
    # =========================================================================

    @pytest.mark.asyncio
    async def test_regenerate_audio_bg_tasks_disabled(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that regenerating audio returns 503 when background tasks disabled.

        POST /api/v1/admin/news/{id}/regenerate-audio should return 503
        if is_background_tasks_enabled() returns False.
        """
        # Create a valid news item (gate check happens before DB query)
        news_item = await NewsItemFactory.create(
            session=db_session,
            description_el="Ελληνική περιγραφή",
        )

        # Mock background tasks as disabled but ElevenLabs as enabled
        from src.config import settings

        with (
            patch("src.api.v1.admin.is_background_tasks_enabled", return_value=False),
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
            patch("src.api.v1.admin.generate_audio_for_news_item_task") as mock_task,
        ):
            response = await client.post(
                f"/api/v1/admin/news/{news_item.id}/regenerate-audio",
                headers=superuser_auth_headers,
            )

            # Assert 503
            assert response.status_code == 503
            data = response.json()
            assert data["success"] is False
            assert "not available" in data["error"]["message"].lower()

            # Task should not be called
            mock_task.assert_not_called()

    # =========================================================================
    # Regenerate Audio - ElevenLabs Not Configured
    # =========================================================================

    @pytest.mark.asyncio
    async def test_regenerate_audio_elevenlabs_not_configured(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that regenerating audio returns 503 when ElevenLabs not configured.

        POST /api/v1/admin/news/{id}/regenerate-audio should return 503
        if settings.elevenlabs_configured returns False.
        """
        # Create a valid news item
        news_item = await NewsItemFactory.create(
            session=db_session,
            description_el="Ελληνική περιγραφή",
        )

        # Mock ElevenLabs as not configured
        from src.config import settings

        with (
            patch("src.api.v1.admin.is_background_tasks_enabled", return_value=True),
            patch.object(settings, "elevenlabs_api_key", ""),  # Makes elevenlabs_configured False
            patch("src.api.v1.admin.generate_audio_for_news_item_task") as mock_task,
        ):
            response = await client.post(
                f"/api/v1/admin/news/{news_item.id}/regenerate-audio",
                headers=superuser_auth_headers,
            )

            # Assert 503
            assert response.status_code == 503
            data = response.json()
            assert data["success"] is False
            assert "not available" in data["error"]["message"].lower()

            # Task should not be called
            mock_task.assert_not_called()

    # =========================================================================
    # Regenerate Audio - Requires Superuser
    # =========================================================================

    @pytest.mark.asyncio
    async def test_regenerate_audio_requires_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that regenerating audio requires superuser privileges.

        POST /api/v1/admin/news/{id}/regenerate-audio with regular user
        auth should return 403.
        """
        # Create a news item
        news_item = await NewsItemFactory.create(
            session=db_session,
            description_el="Ελληνική περιγραφή",
        )

        # Use regular user auth headers
        response = await client.post(
            f"/api/v1/admin/news/{news_item.id}/regenerate-audio",
            headers=auth_headers,
        )

        # Assert 403 Forbidden
        assert response.status_code == 403

    # =========================================================================
    # Regenerate Audio - Requires Authentication
    # =========================================================================

    @pytest.mark.asyncio
    async def test_regenerate_audio_unauthenticated(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test that regenerating audio requires authentication.

        POST /api/v1/admin/news/{id}/regenerate-audio without auth
        should return 401.
        """
        # Create a news item
        news_item = await NewsItemFactory.create(
            session=db_session,
            description_el="Ελληνική περιγραφή",
        )

        # No auth headers
        response = await client.post(
            f"/api/v1/admin/news/{news_item.id}/regenerate-audio",
        )

        # Assert 401 Unauthorized
        assert response.status_code == 401
