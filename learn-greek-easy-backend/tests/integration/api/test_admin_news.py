"""Integration tests for admin news API endpoints."""

import json
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    DeckLevel,
    DescriptionExercise,
    DescriptionExerciseItem,
    Exercise,
    ExerciseModality,
    ExerciseSourceType,
    ExerciseStatus,
    ExerciseType,
    NewsItem,
    PictureStatus,
    Situation,
    SituationDescription,
    SituationPicture,
)
from tests.factories.news import NewsItemFactory

# =============================================================================
# Helpers
# =============================================================================

VALID_CREATE_PAYLOAD = {
    "scenario_el": "Τίτλος ειδήσεων",
    "scenario_en": "News Title",
    "scenario_ru": "Заголовок новости",
    "text_el": "Κείμενο περιγραφής των ειδήσεων.",
    "country": "cyprus",
    "publication_date": str(date.today()),
    "original_article_url": "https://example.com/unique-article-12345",
    "source_image_url": "https://example.com/image.jpg",
}


def make_mock_httpx(image_bytes: bytes = b"fake_image"):
    """Return (mock_cls, mock_client) for patching httpx.AsyncClient."""
    mock_response = MagicMock()
    mock_response.content = image_bytes
    mock_response.headers = {"content-type": "image/jpeg"}
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_response

    mock_cls = MagicMock()
    mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
    mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
    return mock_cls, mock_client


def make_mock_s3():
    """Return mock S3 service."""
    mock = MagicMock()
    mock.upload_object.return_value = True
    mock.delete_object.return_value = True
    mock.generate_presigned_url.return_value = "https://s3.example.com/presigned"
    mock.get_extension_for_content_type = MagicMock(return_value="jpg")
    return mock


def _valid_exercise_payload() -> dict:
    """Canonical 4-option, 3-language exercise payload with correct_answer_index=1."""
    return {
        "prompt": {
            "el": "Πόσοι Κύπριοι έχουν δυσκολία να πληρώσουν τη θέρμανση;",
            "en": "How many Cypriots struggle to pay for heating?",
            "ru": "Сколько киприотов с трудом оплачивают отопление?",
        },
        "options": [
            {"el": "1 στους 4", "en": "1 in 4", "ru": "1 из 4"},
            {"el": "1 στους 6", "en": "1 in 6", "ru": "1 из 6"},
            {"el": "1 στους 10", "en": "1 in 10", "ru": "1 из 10"},
            {"el": "1 στους 20", "en": "1 in 20", "ru": "1 из 20"},
        ],
        "correct_answer_index": 1,
    }


# =============================================================================
# Create News Item Endpoint Tests
# =============================================================================


class TestCreateNewsItemEndpoint:
    """Test suite for POST /api/v1/admin/news endpoint."""

    @pytest.mark.asyncio
    async def test_create_builds_all_four_records(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Successful POST builds Situation+SituationDescription+SituationPicture+NewsItem."""
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            payload = {
                **VALID_CREATE_PAYLOAD,
                "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
            }
            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

        assert response.status_code == 201
        data = response.json()
        news_item_id = data["id"]

        # Verify NewsItem exists
        news_item = await db_session.get(NewsItem, news_item_id)
        assert news_item is not None

        # Verify Situation exists with correct fields
        situation = await db_session.get(Situation, news_item.situation_id)
        assert situation is not None
        assert situation.scenario_el == payload["scenario_el"]
        assert situation.scenario_en == payload["scenario_en"]
        assert situation.scenario_ru == payload["scenario_ru"]
        assert situation.source_image_s3_key is not None

        # Verify SituationDescription exists
        desc_result = await db_session.execute(
            select(SituationDescription).where(SituationDescription.situation_id == situation.id)
        )
        description = desc_result.scalar_one_or_none()
        assert description is not None
        assert description.text_el == payload["text_el"]

        # Verify SituationPicture exists in DRAFT state — the row is reserved
        # for the future generated picture, distinct from the source news image.
        pic_result = await db_session.execute(
            select(SituationPicture).where(SituationPicture.situation_id == situation.id)
        )
        picture = pic_result.scalar_one_or_none()
        assert picture is not None
        assert picture.image_s3_key is None
        assert picture.status == PictureStatus.DRAFT

    @pytest.mark.asyncio
    async def test_create_duplicate_url_returns_409(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """POST with an already-used original_article_url returns 409."""
        existing = await NewsItemFactory.create(session=db_session)
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            payload = {
                **VALID_CREATE_PAYLOAD,
                "original_article_url": existing.original_article_url,
            }
            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_create_bad_image_url_returns_400(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """POST with an image URL that fails to download returns 400."""
        import httpx as httpx_lib

        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx_lib.ConnectError("Connection refused")

        mock_httpx_cls = MagicMock()
        mock_httpx_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_httpx_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        mock_s3 = make_mock_s3()

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            payload = {
                **VALID_CREATE_PAYLOAD,
                "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
            }
            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

        assert response.status_code == 400


# =============================================================================
# Background-Dispatch Tests
# =============================================================================


class TestCreateNewsItemBackgroundDispatch:
    """Assert BackgroundTasks.add_task dispatch behaviour for POST /api/v1/admin/news.

    Patches the import-site name ``src.api.v1.admin.generate_description_audio_task``
    (NOT the definition site) because the endpoint captured the local binding at
    import time via ``from src.tasks.description_audio import generate_description_audio_task``.
    """

    @pytest.mark.asyncio
    async def test_b1_only_dispatch_when_no_a2_fields(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        monkeypatch,
        mocker,
    ):
        """B1-only payload dispatches exactly one BG task with level='b1'."""
        monkeypatch.setattr("src.api.v1.admin.settings.feature_background_tasks", True)
        mock_task = mocker.patch("src.api.v1.admin.generate_description_audio_task")
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            payload = {
                **VALID_CREATE_PAYLOAD,
                "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
            }
            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

        assert response.status_code == 201
        data = response.json()
        situation_id = data["situation_id"]

        assert mock_task.call_count == 1
        kwargs = mock_task.call_args_list[0].kwargs
        assert str(kwargs["situation_id"]) == situation_id
        assert kwargs["level"] == "b1"
        assert kwargs["db_url"] is not None

    @pytest.mark.asyncio
    async def test_b1_and_a2_dispatch_when_both_a2_fields_present(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        monkeypatch,
        mocker,
    ):
        """B1+A2 payload dispatches two BG tasks — one per level."""
        monkeypatch.setattr("src.api.v1.admin.settings.feature_background_tasks", True)
        mock_task = mocker.patch("src.api.v1.admin.generate_description_audio_task")
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            payload = {
                **VALID_CREATE_PAYLOAD,
                "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
                "scenario_el_a2": "Α2 τίτλος",
                "text_el_a2": "Α2 κείμενο περιγραφής.",
            }
            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

        assert response.status_code == 201
        data = response.json()
        situation_id = data["situation_id"]

        assert mock_task.call_count == 2
        calls_kwargs = [c.kwargs for c in mock_task.call_args_list]
        levels = {kw["level"] for kw in calls_kwargs}
        assert levels == {"b1", "a2"}
        for kw in calls_kwargs:
            assert str(kw["situation_id"]) == situation_id
            assert kw["db_url"] is not None

    @pytest.mark.asyncio
    async def test_bad_image_url_does_not_dispatch(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mocker,
    ):
        """400 from image-download failure means no BG task is dispatched."""
        import httpx as httpx_lib

        mock_task = mocker.patch("src.api.v1.admin.generate_description_audio_task")

        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx_lib.ConnectError("Connection refused")

        mock_httpx_cls = MagicMock()
        mock_httpx_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_httpx_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        mock_s3 = make_mock_s3()

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            payload = {
                **VALID_CREATE_PAYLOAD,
                "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
            }
            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

        assert response.status_code == 400
        assert mock_task.call_count == 0

    @pytest.mark.asyncio
    async def test_feature_flag_off_does_not_dispatch(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        monkeypatch,
        mocker,
    ):
        """When feature_background_tasks=False, 201 is returned but no BG task dispatched."""
        monkeypatch.setattr("src.api.v1.admin.settings.feature_background_tasks", False)
        mock_task = mocker.patch("src.api.v1.admin.generate_description_audio_task")
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            payload = {
                **VALID_CREATE_PAYLOAD,
                "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
            }
            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

        assert response.status_code == 201
        assert mock_task.call_count == 0

    @pytest.mark.asyncio
    async def test_bg_task_exception_does_not_break_response(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        caplog_loguru,
        monkeypatch,
        mocker,
    ):
        """Exception inside the BG task wrapper must not poison the 201 response.

        The real generate_description_audio_task already swallows exceptions and
        logs ERROR via loguru.  Here we replace it with a wrapper that mirrors
        that exact contract so caplog_loguru can assert on the log record.
        """
        import logging

        from loguru import logger as loguru_logger

        monkeypatch.setattr("src.api.v1.admin.settings.feature_background_tasks", True)
        situation_id_holder: list = []

        def fake_task(situation_id, level, db_url):
            situation_id_holder.append(situation_id)
            loguru_logger.error(
                "description-audio BG task failed",
                extra={"situation_id": str(situation_id), "level": level},
            )

        mocker.patch("src.api.v1.admin.generate_picture_task")
        mocker.patch("src.api.v1.admin.generate_description_audio_task", side_effect=fake_task)
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        caplog_loguru.set_level(logging.ERROR)

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            payload = {
                **VALID_CREATE_PAYLOAD,
                "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
            }
            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

        assert response.status_code == 201
        # News item was persisted (response body sanity check)
        data = response.json()
        assert data.get("id") is not None

        # ERROR log was emitted with the right extras
        error_records = [r for r in caplog_loguru.records if r.levelname == "ERROR"]
        assert len(error_records) >= 1
        # loguru routes extras via the record's message or extra dict; verify presence
        record = error_records[0]
        assert "description-audio BG task failed" in record.getMessage()

    @pytest.mark.asyncio
    async def test_picture_task_dispatched_on_create(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        monkeypatch,
        mocker,
    ):
        """B1-only POST dispatches generate_picture_task once and still dispatches description-audio."""
        monkeypatch.setattr("src.api.v1.admin.settings.feature_background_tasks", True)
        mock_picture_task = mocker.patch("src.api.v1.admin.generate_picture_task")
        mock_description_audio_task = mocker.patch(
            "src.api.v1.admin.generate_description_audio_task"
        )
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            payload = {
                **VALID_CREATE_PAYLOAD,
                "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
            }
            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

        assert response.status_code == 201
        situation_id = response.json()["situation_id"]

        assert mock_picture_task.call_count == 1
        kwargs = mock_picture_task.call_args_list[0].kwargs
        assert str(kwargs["situation_id"]) == situation_id
        assert kwargs["db_url"] is not None
        # Regression guard: description-audio b1 still dispatched
        assert mock_description_audio_task.call_count >= 1

    @pytest.mark.asyncio
    async def test_picture_task_dispatched_alongside_b1_and_a2(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        monkeypatch,
        mocker,
    ):
        """B1+A2 payload dispatches picture task once and description-audio task twice."""
        monkeypatch.setattr("src.api.v1.admin.settings.feature_background_tasks", True)
        mock_picture_task = mocker.patch("src.api.v1.admin.generate_picture_task")
        mock_description_audio_task = mocker.patch(
            "src.api.v1.admin.generate_description_audio_task"
        )
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            payload = {
                **VALID_CREATE_PAYLOAD,
                "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
                "text_el_a2": "Απλό κείμενο.",
                "scenario_el_a2": "Απλός τίτλος.",
            }
            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

        assert response.status_code == 201
        situation_id = response.json()["situation_id"]

        assert mock_picture_task.call_count == 1
        assert mock_description_audio_task.call_count == 2

        # All calls reference the same situation_id
        picture_kwargs = mock_picture_task.call_args_list[0].kwargs
        assert str(picture_kwargs["situation_id"]) == situation_id

        for call in mock_description_audio_task.call_args_list:
            assert str(call.kwargs["situation_id"]) == situation_id

    @pytest.mark.asyncio
    async def test_picture_task_not_dispatched_when_feature_flag_off(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        monkeypatch,
        mocker,
    ):
        """When feature_background_tasks=False, picture task is not dispatched."""
        monkeypatch.setattr("src.api.v1.admin.settings.feature_background_tasks", False)
        mock_picture_task = mocker.patch("src.api.v1.admin.generate_picture_task")
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            payload = {
                **VALID_CREATE_PAYLOAD,
                "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
            }
            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

        assert response.status_code == 201
        assert mock_picture_task.call_count == 0

    @pytest.mark.asyncio
    async def test_picture_task_exception_does_not_break_response(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        caplog_loguru,
        monkeypatch,
        mocker,
    ):
        """Exception inside the picture BG task wrapper must not poison the 201 response.

        Mirrors test_bg_task_exception_does_not_break_response. The picture task
        emits an ERROR log and the SituationPicture row must remain in DRAFT state.
        """
        import logging

        from loguru import logger as loguru_logger

        monkeypatch.setattr("src.api.v1.admin.settings.feature_background_tasks", True)

        def fake_task(situation_id, db_url):
            loguru_logger.error(
                "picture-generation BG task failed",
                extra={"situation_id": str(situation_id)},
            )

        mocker.patch("src.api.v1.admin.generate_picture_task", side_effect=fake_task)
        mocker.patch("src.api.v1.admin.generate_description_audio_task")
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        caplog_loguru.set_level(logging.ERROR)

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            payload = {
                **VALID_CREATE_PAYLOAD,
                "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
            }
            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

        assert response.status_code == 201
        data = response.json()
        assert data.get("id") is not None

        # ERROR log was emitted
        error_records = [r for r in caplog_loguru.records if r.levelname == "ERROR"]
        assert len(error_records) >= 1
        record = error_records[0]
        assert "picture-generation BG task failed" in record.getMessage()

        # DB verification: SituationPicture row remains in DRAFT state
        situation_id = data["situation_id"]
        picture_stmt = select(SituationPicture).where(SituationPicture.situation_id == situation_id)
        picture = (await db_session.execute(picture_stmt)).scalar_one()
        assert picture.status == PictureStatus.DRAFT
        assert picture.image_s3_key is None

    @pytest.mark.asyncio
    async def test_picture_task_not_dispatched_on_update(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        monkeypatch,
        mocker,
    ):
        """Regression guard: PUT /news/{id} must never dispatch the picture task."""
        monkeypatch.setattr("src.api.v1.admin.settings.feature_background_tasks", True)
        mock_picture_task = mocker.patch("src.api.v1.admin.generate_picture_task")
        mocker.patch("src.api.v1.admin.generate_description_audio_task")
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            payload = {
                **VALID_CREATE_PAYLOAD,
                "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
            }
            response = await client.post(
                "/api/v1/admin/news",
                json=payload,
                headers=superuser_auth_headers,
            )

        assert response.status_code == 201
        news_item_id = response.json()["id"]

        # Clear the dispatch recorded during create so the update assertion is clean
        mock_picture_task.reset_mock()

        with patch("src.services.news_item_service.get_s3_service", return_value=mock_s3):
            put_response = await client.put(
                f"/api/v1/admin/news/{news_item_id}",
                json={"scenario_en": "updated title"},
                headers=superuser_auth_headers,
            )

        assert put_response.status_code == 200
        assert mock_picture_task.call_count == 0


# =============================================================================
# Update News Item Endpoint Tests
# =============================================================================


class TestUpdateNewsItemEndpoint:
    """Test suite for PUT /api/v1/admin/news/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_update_modifies_situation_and_description(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """PUT with scenario_el and text_el updates Situation and SituationDescription."""
        news_item = await NewsItemFactory.create(session=db_session)
        mock_s3 = make_mock_s3()

        with patch("src.services.news_item_service.get_s3_service", return_value=mock_s3):
            response = await client.put(
                f"/api/v1/admin/news/{news_item.id}",
                json={"scenario_el": "Νέος τίτλος", "text_el": "Νέα περιγραφή"},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200

        await db_session.refresh(news_item)
        situation = await db_session.get(Situation, news_item.situation_id)
        assert situation.scenario_el == "Νέος τίτλος"

        desc_result = await db_session.execute(
            select(SituationDescription).where(SituationDescription.situation_id == situation.id)
        )
        description = desc_result.scalar_one_or_none()
        assert description.text_el == "Νέα περιγραφή"

    @pytest.mark.asyncio
    async def test_partial_update_leaves_other_fields_unchanged(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """PUT with only scenario_el leaves other Situation fields unchanged."""
        news_item = await NewsItemFactory.create(session=db_session)
        situation = await db_session.get(Situation, news_item.situation_id)
        original_scenario_en = situation.scenario_en
        mock_s3 = make_mock_s3()

        with patch("src.services.news_item_service.get_s3_service", return_value=mock_s3):
            response = await client.put(
                f"/api/v1/admin/news/{news_item.id}",
                json={"scenario_el": "Ενημερωμένος τίτλος"},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200

        await db_session.refresh(situation)
        assert situation.scenario_el == "Ενημερωμένος τίτλος"
        assert situation.scenario_en == original_scenario_en

    @pytest.mark.asyncio
    async def test_update_nonexistent_returns_404(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """PUT with unknown ID returns 404."""
        mock_s3 = make_mock_s3()
        with patch("src.services.news_item_service.get_s3_service", return_value=mock_s3):
            response = await client.put(
                f"/api/v1/admin/news/{uuid4()}",
                json={"scenario_el": "Τίτλος"},
                headers=superuser_auth_headers,
            )
        assert response.status_code == 404


# =============================================================================
# Delete News Item Endpoint Tests
# =============================================================================


class TestDeleteNewsItemEndpoint:
    """Test suite for DELETE /api/v1/admin/news/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_news_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Unauthenticated request returns 401 Unauthorized."""
        response = await client.delete(f"/api/v1/admin/news/{uuid4()}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_news_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Non-superuser gets 403 Forbidden."""
        response = await client.delete(
            f"/api/v1/admin/news/{uuid4()}",
            headers=auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_returns_204_preserves_situation_tree(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """DELETE removes NewsItem but Situation+SituationDescription remain."""
        news_item = await NewsItemFactory.create(session=db_session)
        news_item_id = news_item.id
        situation_id = news_item.situation_id

        response = await client.delete(
            f"/api/v1/admin/news/{news_item_id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 204

        deleted = await db_session.get(NewsItem, news_item_id)
        assert deleted is None

        situation = await db_session.get(Situation, situation_id)
        assert situation is not None

        desc_result = await db_session.execute(
            select(SituationDescription).where(SituationDescription.situation_id == situation_id)
        )
        assert desc_result.scalar_one_or_none() is not None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_returns_404(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """DELETE with unknown UUID returns 404."""
        response = await client.delete(
            f"/api/v1/admin/news/{uuid4()}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404


# =============================================================================
# Exercise Fan-out Tests
# =============================================================================

EXPECTED_SLOTS = {
    (ExerciseModality.READING, DeckLevel.A2),
    (ExerciseModality.READING, DeckLevel.B1),
    (ExerciseModality.LISTENING, DeckLevel.A2),
    (ExerciseModality.LISTENING, DeckLevel.B1),
}


class TestCreateNewsItemExerciseFanout:
    """Validates POST /api/v1/admin/news exercise fan-out (4 rows per submission)."""

    # -------------------------------------------------------------------------
    # Test 1: Four DescriptionExercise rows with correct type/status/slots
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_post_with_exercise_creates_four_description_exercises(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """POST with exercise creates exactly 4 DescriptionExercise rows covering all (modality, level) slots."""
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        payload = {
            **VALID_CREATE_PAYLOAD,
            "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
            "exercise": _valid_exercise_payload(),
        }

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            response = await client.post(
                "/api/v1/admin/news", json=payload, headers=superuser_auth_headers
            )

        assert response.status_code == 201
        body = response.json()
        situation_id = body["situation_id"]

        description_id = (
            await db_session.execute(
                select(SituationDescription.id).where(
                    SituationDescription.situation_id == situation_id
                )
            )
        ).scalar_one()

        rows = (
            (
                await db_session.execute(
                    select(DescriptionExercise).where(
                        DescriptionExercise.description_id == description_id
                    )
                )
            )
            .scalars()
            .all()
        )

        assert len(rows) == 4
        for row in rows:
            assert row.exercise_type == ExerciseType.SELECT_CORRECT_ANSWER
            assert row.status == ExerciseStatus.APPROVED

        actual = {(r.modality, r.audio_level) for r in rows}
        assert actual == EXPECTED_SLOTS

    # -------------------------------------------------------------------------
    # Test 2: Four DescriptionExerciseItem rows with identical payload
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_post_with_exercise_creates_four_items_with_identical_payload(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """POST with exercise creates 4 DescriptionExerciseItem rows, all item_index=0, all identical payload."""
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        payload = {
            **VALID_CREATE_PAYLOAD,
            "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
            "exercise": _valid_exercise_payload(),
        }

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            response = await client.post(
                "/api/v1/admin/news", json=payload, headers=superuser_auth_headers
            )

        assert response.status_code == 201
        situation_id = response.json()["situation_id"]

        description_id = (
            await db_session.execute(
                select(SituationDescription.id).where(
                    SituationDescription.situation_id == situation_id
                )
            )
        ).scalar_one()

        rows = (
            (
                await db_session.execute(
                    select(DescriptionExerciseItem)
                    .join(
                        DescriptionExercise,
                        DescriptionExerciseItem.description_exercise_id == DescriptionExercise.id,
                    )
                    .where(DescriptionExercise.description_id == description_id)
                )
            )
            .scalars()
            .all()
        )

        assert len(rows) == 4
        assert all(r.item_index == 0 for r in rows)

        serialized = {json.dumps(r.payload, sort_keys=True) for r in rows}
        assert len(serialized) == 1, "All four items must carry identical payload"

        actual_payload = json.loads(next(iter(serialized)))
        assert actual_payload == _valid_exercise_payload()

    # -------------------------------------------------------------------------
    # Test 3: Four supertable Exercise rows linked to DescriptionExercise rows
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_post_with_exercise_creates_four_supertable_exercises(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """POST with exercise creates 4 Exercise supertable rows with source_type=DESCRIPTION."""
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        payload = {
            **VALID_CREATE_PAYLOAD,
            "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
            "exercise": _valid_exercise_payload(),
        }

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            response = await client.post(
                "/api/v1/admin/news", json=payload, headers=superuser_auth_headers
            )

        assert response.status_code == 201
        situation_id = response.json()["situation_id"]

        description_id = (
            await db_session.execute(
                select(SituationDescription.id).where(
                    SituationDescription.situation_id == situation_id
                )
            )
        ).scalar_one()

        de_ids = (
            (
                await db_session.execute(
                    select(DescriptionExercise.id).where(
                        DescriptionExercise.description_id == description_id
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(de_ids) == 4

        supertable_rows = (
            (
                await db_session.execute(
                    select(Exercise)
                    .join(
                        DescriptionExercise,
                        Exercise.description_exercise_id == DescriptionExercise.id,
                    )
                    .where(DescriptionExercise.description_id == description_id)
                )
            )
            .scalars()
            .all()
        )

        assert len(supertable_rows) == 4
        de_id_set = set(de_ids)
        for row in supertable_rows:
            assert row.source_type == ExerciseSourceType.DESCRIPTION
            assert row.dialog_exercise_id is None
            assert row.picture_exercise_id is None
            assert row.description_exercise_id is not None
            assert row.description_exercise_id in de_id_set

    # -------------------------------------------------------------------------
    # Test 4: No exercise in payload — zero rows in all three tables
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_post_without_exercise_creates_no_exercise_rows(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """POST without exercise returns 201; zero rows in DescriptionExercise/Item/Exercise for that description."""
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        payload = {
            **VALID_CREATE_PAYLOAD,
            "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
        }

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            response = await client.post(
                "/api/v1/admin/news", json=payload, headers=superuser_auth_headers
            )

        assert response.status_code == 201
        body = response.json()
        news_item_id = body["id"]
        situation_id = body["situation_id"]

        # Regression guard: all four parent records created
        news_item = await db_session.get(NewsItem, news_item_id)
        assert news_item is not None

        situation = await db_session.get(Situation, situation_id)
        assert situation is not None

        description_id = (
            await db_session.execute(
                select(SituationDescription.id).where(
                    SituationDescription.situation_id == situation_id
                )
            )
        ).scalar_one()
        assert description_id is not None

        pic_result = await db_session.execute(
            select(SituationPicture).where(SituationPicture.situation_id == situation_id)
        )
        assert pic_result.scalar_one_or_none() is not None

        # No exercise rows
        de_rows = (
            (
                await db_session.execute(
                    select(DescriptionExercise).where(
                        DescriptionExercise.description_id == description_id
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(de_rows) == 0

        item_rows = (
            (
                await db_session.execute(
                    select(DescriptionExerciseItem)
                    .join(
                        DescriptionExercise,
                        DescriptionExerciseItem.description_exercise_id == DescriptionExercise.id,
                    )
                    .where(DescriptionExercise.description_id == description_id)
                )
            )
            .scalars()
            .all()
        )
        assert len(item_rows) == 0

        super_rows = (
            (
                await db_session.execute(
                    select(Exercise)
                    .join(
                        DescriptionExercise,
                        Exercise.description_exercise_id == DescriptionExercise.id,
                    )
                    .where(DescriptionExercise.description_id == description_id)
                )
            )
            .scalars()
            .all()
        )
        assert len(super_rows) == 0

    # -------------------------------------------------------------------------
    # Test 5: Malformed exercise payload → 422 and no DB rows
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "mutator,case_id",
        [
            (lambda ex: {**ex, "options": ex["options"][:3]}, "options-3-items"),
            (lambda ex: {**ex, "correct_answer_index": 4}, "index-out-of-range"),
            (
                lambda ex: {
                    **ex,
                    "prompt": {k: v for k, v in ex["prompt"].items() if k != "ru"},
                },
                "prompt-missing-ru",
            ),
            (
                lambda ex: {
                    **ex,
                    "options": [
                        *ex["options"][:2],
                        {**ex["options"][2], "en": ""},
                        *ex["options"][3:],
                    ],
                },
                "option-empty-en",
            ),
        ],
    )
    async def test_post_with_malformed_exercise_returns_422(
        self,
        mutator,
        case_id,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Malformed exercise field returns 422 and creates no NewsItem row."""
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        url = f"https://example.com/article-{uuid4().hex[:8]}"
        payload = {
            **VALID_CREATE_PAYLOAD,
            "original_article_url": url,
            "exercise": mutator(_valid_exercise_payload()),
        }

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            response = await client.post(
                "/api/v1/admin/news", json=payload, headers=superuser_auth_headers
            )

        assert response.status_code == 422, case_id

        row = (
            await db_session.execute(select(NewsItem).where(NewsItem.original_article_url == url))
        ).scalar_one_or_none()
        assert row is None, case_id

    # -------------------------------------------------------------------------
    # Test 6: Exercise present — audio and picture BG tasks still dispatched
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_post_with_exercise_does_not_break_audio_dispatch(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        monkeypatch,
        mocker,
    ):
        """POST with exercise + A2 fields dispatches audio task twice and picture task once."""
        monkeypatch.setattr("src.api.v1.admin.settings.feature_background_tasks", True)
        mock_audio_task = mocker.patch("src.api.v1.admin.generate_description_audio_task")
        mock_picture_task = mocker.patch("src.api.v1.admin.generate_picture_task")
        mock_httpx_cls, _ = make_mock_httpx()
        mock_s3 = make_mock_s3()

        payload = {
            **VALID_CREATE_PAYLOAD,
            "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
            "scenario_el_a2": "Σενάριο A2",
            "text_el_a2": "Κείμενο A2",
            "exercise": _valid_exercise_payload(),
        }

        with (
            patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls),
            patch("src.services.news_item_service.get_s3_service", return_value=mock_s3),
        ):
            response = await client.post(
                "/api/v1/admin/news", json=payload, headers=superuser_auth_headers
            )

        assert response.status_code == 201
        assert (
            mock_audio_task.call_count == 2
        ), f"Expected 2 audio dispatch calls (b1 + a2), got {mock_audio_task.call_count}"
        assert (
            mock_picture_task.call_count == 1
        ), f"Expected 1 picture dispatch call, got {mock_picture_task.call_count}"
