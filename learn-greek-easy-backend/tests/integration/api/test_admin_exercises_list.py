"""Integration tests for GET /api/v1/admin/exercises endpoint."""

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import ExerciseModality, ExerciseStatus, ExerciseType
from tests.factories import (
    DescriptionExerciseFactory,
    DescriptionExerciseItemFactory,
    DialogExerciseFactory,
    ListeningDialogFactory,
    PictureExerciseFactory,
    SituationDescriptionFactory,
    SituationFactory,
    SituationPictureFactory,
)

BASE_URL = "/api/v1/admin/exercises"


@pytest.fixture
def mock_s3_service():
    with patch("src.api.v1.admin.get_s3_service") as mock_get:
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = None
        mock_get.return_value = mock_s3
        yield mock_s3


@pytest.mark.integration
class TestAdminExercisesList:
    @pytest.mark.asyncio
    async def test_listening_returns_all_listening_sources(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        # Each exercise needs its own situation (1-to-1 description/dialog/picture per situation)
        sit1 = await SituationFactory.create()
        desc = await SituationDescriptionFactory.create(situation_id=sit1.id)
        await DescriptionExerciseFactory.create(
            description_id=desc.id, modality=ExerciseModality.LISTENING
        )

        sit2 = await SituationFactory.create()
        dialog = await ListeningDialogFactory.create(situation_id=sit2.id)
        await DialogExerciseFactory.create(dialog_id=dialog.id)

        sit3 = await SituationFactory.create()
        picture = await SituationPictureFactory.create(situation_id=sit3.id)
        await PictureExerciseFactory.create(picture_id=picture.id)

        # Description exercise with READING modality — should NOT appear
        sit4 = await SituationFactory.create()
        desc_reading = await SituationDescriptionFactory.create(situation_id=sit4.id)
        await DescriptionExerciseFactory.create(
            description_id=desc_reading.id, modality=ExerciseModality.READING
        )

        response = await client.get(
            BASE_URL, params={"modality": "listening"}, headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        source_types = {item["source_type"] for item in data["items"]}
        assert "description" in source_types
        assert "dialog" in source_types
        assert "picture" in source_types

        # Reading exercise must not be in results
        for item in data["items"]:
            assert item["modality"] == "listening"

    @pytest.mark.asyncio
    async def test_reading_returns_only_reading(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        # Description exercise with READING modality
        desc = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc.id, modality=ExerciseModality.READING
        )

        # Dialog exercise — should NOT appear (dialog is always listening)
        await DialogExerciseFactory.create()

        response = await client.get(
            BASE_URL, params={"modality": "reading"}, headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["source_type"] == "description"

    @pytest.mark.asyncio
    async def test_missing_modality_returns_422(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        response = await client.get(BASE_URL, headers=superuser_auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_pagination(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        # Each exercise needs its own situation+description (unique constraint on description_id+type+level+modality)
        for _ in range(3):
            sit = await SituationFactory.create()
            desc = await SituationDescriptionFactory.create(situation_id=sit.id)
            await DescriptionExerciseFactory.create(
                description_id=desc.id, modality=ExerciseModality.LISTENING
            )

        # Page 1: 2 items
        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "page": 1, "page_size": 2},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 3
        assert data["page"] == 1
        assert data["page_size"] == 2

        # Page 2: 1 item
        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "page": 2, "page_size": 2},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["total"] == 3
        assert data["page"] == 2

    @pytest.mark.asyncio
    async def test_exercise_type_filter(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        desc = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc.id,
            modality=ExerciseModality.LISTENING,
            exercise_type=ExerciseType.SELECT_CORRECT_ANSWER,
        )
        await DescriptionExerciseFactory.create(
            description_id=desc.id,
            modality=ExerciseModality.LISTENING,
            exercise_type=ExerciseType.FILL_GAPS,
        )

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "exercise_type": "select_correct_answer"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["exercise_type"] == "select_correct_answer"

    @pytest.mark.asyncio
    async def test_status_filter(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        # Separate descriptions to avoid unique constraint (description_id+type+level+modality)
        desc1 = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc1.id,
            modality=ExerciseModality.LISTENING,
            status=ExerciseStatus.DRAFT,
        )
        desc2 = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc2.id,
            modality=ExerciseModality.LISTENING,
            status=ExerciseStatus.APPROVED,
        )

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "status": "approved"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["status"] == "approved"

    @pytest.mark.asyncio
    async def test_search_filter(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        situation_court = await SituationFactory.create(
            scenario_el="Δικαστήριο", scenario_en="Court"
        )
        situation_market = await SituationFactory.create(scenario_el="Αγορά", scenario_en="Market")

        desc_court = await SituationDescriptionFactory.create(situation_id=situation_court.id)
        await DescriptionExerciseFactory.create(
            description_id=desc_court.id, modality=ExerciseModality.LISTENING
        )

        desc_market = await SituationDescriptionFactory.create(situation_id=situation_market.id)
        await DescriptionExerciseFactory.create(
            description_id=desc_market.id, modality=ExerciseModality.LISTENING
        )

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "search": "Δικαστ"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["situation_title_el"] == "Δικαστήριο"

    @pytest.mark.asyncio
    async def test_response_includes_situation_data(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        situation = await SituationFactory.create(
            scenario_el="Στο αεροδρόμιο", scenario_en="At the airport"
        )
        desc = await SituationDescriptionFactory.create(situation_id=situation.id)
        await DescriptionExerciseFactory.create(
            description_id=desc.id, modality=ExerciseModality.LISTENING
        )

        response = await client.get(
            BASE_URL, params={"modality": "listening"}, headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        item = data["items"][0]
        assert str(situation.id) == item["situation_id"]
        assert item["situation_title_el"] == "Στο αεροδρόμιο"
        assert item["situation_title_en"] == "At the airport"

    @pytest.mark.asyncio
    async def test_audio_url_for_dialog(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        situation = await SituationFactory.create()
        dialog = await ListeningDialogFactory.create(situation_id=situation.id)
        dialog.audio_s3_key = "test/audio.mp3"
        await db_session.flush()

        mock_s3_service.generate_presigned_url.return_value = (
            "https://s3.example.com/test/audio.mp3"
        )

        await DialogExerciseFactory.create(dialog_id=dialog.id)

        response = await client.get(
            BASE_URL, params={"modality": "listening"}, headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["source_type"] == "dialog"
        assert data["items"][0]["audio_url"] == "https://s3.example.com/test/audio.mp3"
        mock_s3_service.generate_presigned_url.assert_called_with("test/audio.mp3")

    @pytest.mark.asyncio
    async def test_reading_text_for_description(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
        db_session: AsyncSession,
    ):
        situation = await SituationFactory.create()
        desc = await SituationDescriptionFactory.create(situation_id=situation.id)
        desc.text_el = "Κείμενο"
        await db_session.flush()

        await DescriptionExerciseFactory.create(
            description_id=desc.id, modality=ExerciseModality.READING
        )

        response = await client.get(
            BASE_URL, params={"modality": "reading"}, headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["reading_text"] == "Κείμενο"

    @pytest.mark.asyncio
    async def test_items_included(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        desc = await SituationDescriptionFactory.create()
        exercise = await DescriptionExerciseFactory.create(
            description_id=desc.id, modality=ExerciseModality.LISTENING
        )
        await DescriptionExerciseItemFactory.create(description_exercise_id=exercise.id)
        await DescriptionExerciseItemFactory.create(description_exercise_id=exercise.id)

        response = await client.get(
            BASE_URL, params={"modality": "listening"}, headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        item = data["items"][0]
        assert item["item_count"] == 2
        assert len(item["items"]) == 2
        for exercise_item in item["items"]:
            assert "item_index" in exercise_item
            assert "payload" in exercise_item

    @pytest.mark.asyncio
    async def test_auth_required(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        # No auth → 401
        response = await client.get(BASE_URL, params={"modality": "listening"})
        assert response.status_code == 401

        # Non-superuser → 403
        response = await client.get(
            BASE_URL, params={"modality": "listening"}, headers=auth_headers
        )
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "FORBIDDEN"
