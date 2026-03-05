"""Unit tests for culture question audio generation endpoints."""

from unittest.mock import patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.culture import CultureDeckFactory, CultureQuestionFactory


class TestGenerateCultureQuestionAudio:
    """Unit tests for POST /api/v1/culture/questions/{id}/generate-audio endpoint."""

    @pytest.mark.asyncio
    async def test_generate_audio_success_202(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """202 — question with Greek text, task scheduled."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
        )

        from src.config import settings

        with (
            patch(
                "src.api.v1.culture.router.is_background_tasks_enabled",
                return_value=True,
            ),
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
            patch(
                "src.api.v1.culture.router.generate_audio_for_culture_question_task",
            ) as mock_task,
        ):
            response = await client.post(
                f"/api/v1/culture/questions/{question.id}/generate-audio",
                headers=superuser_auth_headers,
            )

            assert response.status_code == 202
            data = response.json()
            assert data["message"] == "Audio generation started"

            mock_task.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_audio_question_not_found_404(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """404 — random UUID not in database."""
        random_id = uuid4()

        from src.config import settings

        with (
            patch(
                "src.api.v1.culture.router.is_background_tasks_enabled",
                return_value=True,
            ),
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
        ):
            response = await client.post(
                f"/api/v1/culture/questions/{random_id}/generate-audio",
                headers=superuser_auth_headers,
            )

            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_generate_audio_elevenlabs_not_configured_503(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """503 — ElevenLabs not configured."""
        with (
            patch(
                "src.api.v1.culture.router.is_background_tasks_enabled",
                return_value=True,
            ),
        ):
            response = await client.post(
                f"/api/v1/culture/questions/{uuid4()}/generate-audio",
                headers=superuser_auth_headers,
            )

            assert response.status_code == 503

    @pytest.mark.asyncio
    async def test_generate_audio_background_tasks_disabled_503(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """503 — background tasks disabled."""
        from src.config import settings

        with (
            patch(
                "src.api.v1.culture.router.is_background_tasks_enabled",
                return_value=False,
            ),
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
        ):
            response = await client.post(
                f"/api/v1/culture/questions/{uuid4()}/generate-audio",
                headers=superuser_auth_headers,
            )

            assert response.status_code == 503

    @pytest.mark.asyncio
    async def test_generate_audio_requires_superuser_401(
        self,
        client: AsyncClient,
    ):
        """401 — no auth headers."""
        response = await client.post(
            f"/api/v1/culture/questions/{uuid4()}/generate-audio",
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_generate_audio_no_greek_text_400(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """400 — question has no Greek text."""
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
            question_text={"en": "What is the capital?", "ru": "Какая столица?"},
        )

        from src.config import settings

        with (
            patch(
                "src.api.v1.culture.router.is_background_tasks_enabled",
                return_value=True,
            ),
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
        ):
            response = await client.post(
                f"/api/v1/culture/questions/{question.id}/generate-audio",
                headers=superuser_auth_headers,
            )

            assert response.status_code == 400
