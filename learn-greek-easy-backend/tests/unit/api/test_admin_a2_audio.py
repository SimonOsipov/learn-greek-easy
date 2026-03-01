"""Unit tests for admin endpoint A2 audio task integration.

This module tests:
- POST /api/v1/admin/news/{id}/regenerate-a2-audio endpoint
- A2 audio task scheduling in create_news_item
- A2 audio task scheduling in update_news_item
- Regression: B2 regenerate-audio does not trigger A2 task
"""

from datetime import date
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.schemas.news_item import NewsItemResponse, NewsItemWithCardResponse
from tests.factories.news import NewsItemFactory

# ============================================================================
# TestAdminRegenerateA2Audio
# ============================================================================


class TestAdminRegenerateA2Audio:
    """Unit tests for POST /api/v1/admin/news/{id}/regenerate-a2-audio endpoint."""

    @pytest.mark.asyncio
    async def test_regenerate_a2_audio_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """202 — news item with A2 description, task scheduled."""
        news_item = await NewsItemFactory.create(
            session=db_session,
            description_el_a2="Απλοποιημένη ελληνική περιγραφή Α2",
        )

        from src.config import settings

        with (
            patch("src.api.v1.admin.is_background_tasks_enabled", return_value=True),
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
            patch("src.api.v1.admin.generate_a2_audio_for_news_item_task") as mock_task,
        ):
            response = await client.post(
                f"/api/v1/admin/news/{news_item.id}/regenerate-a2-audio",
                headers=superuser_auth_headers,
            )

            assert response.status_code == 202
            data = response.json()
            assert data["message"] == "A2 audio regeneration started"

            mock_task.assert_called_once()
            call_kwargs = mock_task.call_args.kwargs
            assert call_kwargs["news_item_id"] == news_item.id
            assert call_kwargs["description_el_a2"] == "Απλοποιημένη ελληνική περιγραφή Α2"
            assert "db_url" in call_kwargs

    @pytest.mark.asyncio
    async def test_regenerate_a2_audio_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """404 — random UUID not in database."""
        random_id = uuid4()

        from src.config import settings

        with (
            patch("src.api.v1.admin.is_background_tasks_enabled", return_value=True),
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
            patch("src.api.v1.admin.generate_a2_audio_for_news_item_task") as mock_task,
        ):
            response = await client.post(
                f"/api/v1/admin/news/{random_id}/regenerate-a2-audio",
                headers=superuser_auth_headers,
            )

            assert response.status_code == 404
            data = response.json()
            assert data["success"] is False
            assert "not found" in data["error"]["message"].lower()

            mock_task.assert_not_called()

    @pytest.mark.asyncio
    async def test_regenerate_a2_audio_no_a2_description_null(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """404 — news item exists but has no A2 description (None)."""
        news_item = await NewsItemFactory.create(session=db_session)
        # Factory sets description_el_a2=None by default

        from src.config import settings

        with (
            patch("src.api.v1.admin.is_background_tasks_enabled", return_value=True),
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
            patch("src.api.v1.admin.generate_a2_audio_for_news_item_task") as mock_task,
        ):
            response = await client.post(
                f"/api/v1/admin/news/{news_item.id}/regenerate-a2-audio",
                headers=superuser_auth_headers,
            )

            assert response.status_code == 404
            data = response.json()
            assert data["success"] is False
            assert "no A2 Greek description" in data["error"]["message"]

            mock_task.assert_not_called()

    @pytest.mark.asyncio
    async def test_regenerate_a2_audio_no_a2_description_empty(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """404 — news item exists but A2 description is whitespace-only."""
        news_item = await NewsItemFactory.create(
            session=db_session,
            description_el_a2="   ",
        )

        from src.config import settings

        with (
            patch("src.api.v1.admin.is_background_tasks_enabled", return_value=True),
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
            patch("src.api.v1.admin.generate_a2_audio_for_news_item_task") as mock_task,
        ):
            response = await client.post(
                f"/api/v1/admin/news/{news_item.id}/regenerate-a2-audio",
                headers=superuser_auth_headers,
            )

            assert response.status_code == 404
            data = response.json()
            assert data["success"] is False
            assert "no A2 Greek description" in data["error"]["message"]

            mock_task.assert_not_called()

    @pytest.mark.asyncio
    async def test_regenerate_a2_audio_bg_tasks_disabled(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """503 — background tasks disabled."""
        news_item = await NewsItemFactory.create(
            session=db_session,
            description_el_a2="Απλοποιημένη περιγραφή",
        )

        from src.config import settings

        with (
            patch("src.api.v1.admin.is_background_tasks_enabled", return_value=False),
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
            patch("src.api.v1.admin.generate_a2_audio_for_news_item_task") as mock_task,
        ):
            response = await client.post(
                f"/api/v1/admin/news/{news_item.id}/regenerate-a2-audio",
                headers=superuser_auth_headers,
            )

            assert response.status_code == 503
            data = response.json()
            assert data["success"] is False
            assert "not available" in data["error"]["message"].lower()

            mock_task.assert_not_called()

    @pytest.mark.asyncio
    async def test_regenerate_a2_audio_elevenlabs_not_configured(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """503 — ElevenLabs not configured."""
        news_item = await NewsItemFactory.create(
            session=db_session,
            description_el_a2="Απλοποιημένη περιγραφή",
        )

        from src.config import settings

        with (
            patch("src.api.v1.admin.is_background_tasks_enabled", return_value=True),
            patch.object(settings, "elevenlabs_api_key", ""),  # Makes elevenlabs_configured False
            patch("src.api.v1.admin.generate_a2_audio_for_news_item_task") as mock_task,
        ):
            response = await client.post(
                f"/api/v1/admin/news/{news_item.id}/regenerate-a2-audio",
                headers=superuser_auth_headers,
            )

            assert response.status_code == 503
            data = response.json()
            assert data["success"] is False
            assert "not available" in data["error"]["message"].lower()

            mock_task.assert_not_called()

    @pytest.mark.asyncio
    async def test_regenerate_a2_audio_requires_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """403 — regular user cannot access endpoint."""
        news_item = await NewsItemFactory.create(
            session=db_session,
            description_el_a2="Απλοποιημένη περιγραφή",
        )

        response = await client.post(
            f"/api/v1/admin/news/{news_item.id}/regenerate-a2-audio",
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_regenerate_a2_audio_unauthenticated(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """401 — no auth token."""
        news_item = await NewsItemFactory.create(
            session=db_session,
            description_el_a2="Απλοποιημένη περιγραφή",
        )

        response = await client.post(
            f"/api/v1/admin/news/{news_item.id}/regenerate-a2-audio",
        )

        assert response.status_code == 401


# ============================================================================
# TestAdminNewsA2AudioCreateTrigger
# ============================================================================


class TestAdminNewsA2AudioCreateTrigger:
    """Tests that A2 audio task is scheduled correctly from create_news_item."""

    @pytest.mark.asyncio
    async def test_create_news_item_schedules_a2_audio_when_provided(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Both B2 and A2 tasks scheduled when description_el_a2 is provided."""
        mock_service_instance = AsyncMock()
        mock_news_id = uuid4()

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
                title_el_a2="Τίτλος Α2",
                description_el_a2="Απλή περιγραφή Α2",
            ),
            card=None,
            message="News item created successfully",
        )

        mock_service_instance.create_with_question.return_value = mock_response

        with (
            patch("src.api.v1.admin.NewsItemService") as MockService,
            patch("src.api.v1.admin.generate_audio_for_news_item_task") as mock_b2_task,
            patch("src.api.v1.admin.generate_a2_audio_for_news_item_task") as mock_a2_task,
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
                "title_el_a2": "Τίτλος Α2",
                "description_el_a2": "Απλή περιγραφή Α2",
            }

            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

            assert response.status_code == 201

            # B2 audio task must be called
            mock_b2_task.assert_called_once()
            b2_kwargs = mock_b2_task.call_args.kwargs
            assert b2_kwargs["news_item_id"] == mock_news_id
            assert b2_kwargs["description_el"] == "Ελληνική περιγραφή"

            # A2 audio task must also be called
            mock_a2_task.assert_called_once()
            a2_kwargs = mock_a2_task.call_args.kwargs
            assert a2_kwargs["news_item_id"] == mock_news_id
            assert a2_kwargs["description_el_a2"] == "Απλή περιγραφή Α2"
            assert "db_url" in a2_kwargs

    @pytest.mark.asyncio
    async def test_create_news_item_skips_a2_audio_when_absent(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """A2 task not scheduled when description_el_a2 is absent from payload."""
        mock_service_instance = AsyncMock()
        mock_news_id = uuid4()

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

        with (
            patch("src.api.v1.admin.NewsItemService") as MockService,
            patch("src.api.v1.admin.generate_audio_for_news_item_task") as mock_b2_task,
            patch("src.api.v1.admin.generate_a2_audio_for_news_item_task") as mock_a2_task,
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
                # No title_el_a2 or description_el_a2
            }

            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

            assert response.status_code == 201

            # B2 audio task must be called
            mock_b2_task.assert_called_once()

            # A2 audio task must NOT be called
            mock_a2_task.assert_not_called()


# ============================================================================
# TestAdminNewsA2AudioUpdateTrigger
# ============================================================================


class TestAdminNewsA2AudioUpdateTrigger:
    """Tests that A2 audio task is scheduled correctly from update_news_item."""

    @pytest.mark.asyncio
    async def test_update_news_item_schedules_a2_audio_when_description_el_a2_changes(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """A2 task scheduled when description_el_a2 is included in update payload."""
        news_item = await NewsItemFactory.create(session=db_session)

        with (
            patch("src.api.v1.admin.generate_audio_for_news_item_task") as mock_b2_task,
            patch("src.api.v1.admin.generate_a2_audio_for_news_item_task") as mock_a2_task,
        ):
            payload = {
                "title_el_a2": "Νέος τίτλος Α2",
                "description_el_a2": "Νέα απλή περιγραφή Α2",
            }

            response = await client.put(
                f"/api/v1/admin/news/{news_item.id}",
                json=payload,
                headers=superuser_auth_headers,
            )

            assert response.status_code == 200

            # B2 audio task must NOT be called (description_el not in payload)
            mock_b2_task.assert_not_called()

            # A2 audio task must be called
            mock_a2_task.assert_called_once()
            a2_kwargs = mock_a2_task.call_args.kwargs
            assert a2_kwargs["news_item_id"] == news_item.id
            assert a2_kwargs["description_el_a2"] == "Νέα απλή περιγραφή Α2"
            assert "db_url" in a2_kwargs

    @pytest.mark.asyncio
    async def test_update_news_item_skips_a2_audio_when_other_fields_change(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """A2 task not scheduled when description_el_a2 is not in update payload."""
        news_item = await NewsItemFactory.create(session=db_session)

        with (
            patch("src.api.v1.admin.generate_audio_for_news_item_task") as mock_b2_task,
            patch("src.api.v1.admin.generate_a2_audio_for_news_item_task") as mock_a2_task,
        ):
            payload = {
                "title_el": "Νέος ελληνικός τίτλος",
            }

            response = await client.put(
                f"/api/v1/admin/news/{news_item.id}",
                json=payload,
                headers=superuser_auth_headers,
            )

            assert response.status_code == 200

            # Neither B2 nor A2 audio task should be called
            mock_b2_task.assert_not_called()
            mock_a2_task.assert_not_called()


# ============================================================================
# TestB2AudioUnchanged
# ============================================================================


class TestB2AudioUnchanged:
    """Regression tests ensuring B2 regenerate-audio does not touch A2."""

    @pytest.mark.asyncio
    async def test_b2_regenerate_audio_does_not_trigger_a2(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """POST /regenerate-audio should NOT call generate_a2_audio_for_news_item_task."""
        news_item = await NewsItemFactory.create(
            session=db_session,
            description_el="Ελληνική περιγραφή",
            description_el_a2="Απλή περιγραφή Α2",
        )

        from src.config import settings

        with (
            patch("src.api.v1.admin.is_background_tasks_enabled", return_value=True),
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
            patch("src.api.v1.admin.generate_audio_for_news_item_task") as mock_b2_task,
            patch("src.api.v1.admin.generate_a2_audio_for_news_item_task") as mock_a2_task,
        ):
            response = await client.post(
                f"/api/v1/admin/news/{news_item.id}/regenerate-audio",
                headers=superuser_auth_headers,
            )

            assert response.status_code == 202
            data = response.json()
            assert data["message"] == "Audio regeneration started"

            # B2 task must be called
            mock_b2_task.assert_called_once()

            # A2 task must NOT be called
            mock_a2_task.assert_not_called()
