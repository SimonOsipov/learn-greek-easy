"""Unit tests for culture question audio generation endpoints."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.culture import CultureDeckFactory, CultureQuestionFactory
from tests.factories.news import NewsItemFactory

FAKE_AUDIO = b"\xff\xfb\x90\x00" + b"\x00" * 16000


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
        from src.config import settings

        with (
            patch(
                "src.api.v1.culture.router.is_background_tasks_enabled",
                return_value=True,
            ),
            patch.object(settings, "elevenlabs_api_key", ""),
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

    @pytest.mark.asyncio
    async def test_generate_audio_news_linked_question_returns_409(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """409 — question linked to a news item cannot have audio regenerated."""
        news_item = await NewsItemFactory.create(session=db_session)
        deck = await CultureDeckFactory.create(session=db_session)
        question = await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
            news_item_id=news_item.id,
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

            assert response.status_code == 409
            data = response.json()
            assert "news" in data["detail"].lower()


class TestCreateQuestionAudioGeneration:
    """Tests for auto-audio generation on POST /api/v1/culture/questions."""

    @pytest.mark.asyncio
    async def test_create_question_generates_audio_when_elevenlabs_configured(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Audio generated and audio_s3_key set when ElevenLabs is configured."""
        deck = await CultureDeckFactory.create(session=db_session)

        from src.config import settings

        mock_elevenlabs = MagicMock()
        mock_elevenlabs.generate_speech = AsyncMock(return_value=FAKE_AUDIO)
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        with (
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch(
                "src.services.s3_service.get_s3_service",
                return_value=mock_s3,
            ),
        ):
            response = await client.post(
                "/api/v1/culture/questions",
                json={
                    "deck_id": str(deck.id),
                    "question_text": {
                        "el": "Ποια είναι η πρωτεύουσα;",
                        "en": "What is the capital?",
                        "ru": "Какая столица?",
                    },
                    "option_a": {"el": "Αθήνα", "en": "Athens", "ru": "Афины"},
                    "option_b": {
                        "el": "Θεσσαλονίκη",
                        "en": "Thessaloniki",
                        "ru": "Салоники",
                    },
                    "correct_option": 1,
                },
                headers=superuser_auth_headers,
            )

            assert response.status_code == 201
            data = response.json()
            assert data["audio_s3_key"] is not None
            assert data["audio_s3_key"].startswith("culture/audio/")

            mock_elevenlabs.generate_speech.assert_awaited_once()
            mock_s3.upload_object.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_question_skips_audio_when_elevenlabs_not_configured(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """No audio generated when ElevenLabs not configured."""
        deck = await CultureDeckFactory.create(session=db_session)

        response = await client.post(
            "/api/v1/culture/questions",
            json={
                "deck_id": str(deck.id),
                "question_text": {
                    "el": "Ποια είναι η πρωτεύουσα;",
                    "en": "What is the capital?",
                    "ru": "Какая столица?",
                },
                "option_a": {"el": "Αθήνα", "en": "Athens", "ru": "Афины"},
                "option_b": {
                    "el": "Θεσσαλονίκη",
                    "en": "Thessaloniki",
                    "ru": "Салоники",
                },
                "correct_option": 1,
            },
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["audio_s3_key"] is None

    @pytest.mark.asyncio
    async def test_create_question_fails_when_tts_fails(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """502 returned when TTS generation fails."""
        deck = await CultureDeckFactory.create(session=db_session)

        from src.config import settings

        mock_elevenlabs = MagicMock()
        mock_elevenlabs.generate_speech = AsyncMock(side_effect=RuntimeError("TTS API error"))

        with (
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
        ):
            response = await client.post(
                "/api/v1/culture/questions",
                json={
                    "deck_id": str(deck.id),
                    "question_text": {
                        "el": "Ποια είναι η πρωτεύουσα;",
                        "en": "What is the capital?",
                        "ru": "Какая столица?",
                    },
                    "option_a": {"el": "Αθήνα", "en": "Athens", "ru": "Афины"},
                    "option_b": {
                        "el": "Θεσσαλονίκη",
                        "en": "Thessaloniki",
                        "ru": "Салоники",
                    },
                    "correct_option": 1,
                },
                headers=superuser_auth_headers,
            )

            assert response.status_code == 502

    @pytest.mark.asyncio
    async def test_create_question_fails_when_s3_upload_fails(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """502 returned when S3 upload fails."""
        deck = await CultureDeckFactory.create(session=db_session)

        from src.config import settings

        mock_elevenlabs = MagicMock()
        mock_elevenlabs.generate_speech = AsyncMock(return_value=FAKE_AUDIO)
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=False)

        with (
            patch.object(settings, "elevenlabs_api_key", "test-api-key"),
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch(
                "src.services.s3_service.get_s3_service",
                return_value=mock_s3,
            ),
        ):
            response = await client.post(
                "/api/v1/culture/questions",
                json={
                    "deck_id": str(deck.id),
                    "question_text": {
                        "el": "Ποια είναι η πρωτεύουσα;",
                        "en": "What is the capital?",
                        "ru": "Какая столица?",
                    },
                    "option_a": {"el": "Αθήνα", "en": "Athens", "ru": "Афины"},
                    "option_b": {
                        "el": "Θεσσαλονίκη",
                        "en": "Thessaloniki",
                        "ru": "Салоники",
                    },
                    "correct_option": 1,
                },
                headers=superuser_auth_headers,
            )

            assert response.status_code == 502


class TestAdminCultureQuestionItemSchema:
    """Tests for AdminCultureQuestionItem schema."""

    def test_audio_s3_key_included_in_schema(self):
        """audio_s3_key field exists in schema."""
        from src.schemas.admin import AdminCultureQuestionItem

        fields = AdminCultureQuestionItem.model_fields
        assert "audio_s3_key" in fields

    def test_audio_s3_key_defaults_to_none(self):
        """audio_s3_key defaults to None."""
        from src.schemas.admin import AdminCultureQuestionItem

        fields = AdminCultureQuestionItem.model_fields
        assert fields["audio_s3_key"].default is None
