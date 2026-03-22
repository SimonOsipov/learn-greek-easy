"""Integration tests for Situation CRUD admin endpoints."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    DialogLine,
    DialogSpeaker,
    ListeningDialog,
    SituationDescription,
    SituationPicture,
)
from tests.factories.listening_dialog import ListeningDialogFactory
from tests.factories.situation import SituationFactory
from tests.factories.situation_description import SituationDescriptionFactory
from tests.factories.situation_picture import SituationPictureFactory

BASE_URL = "/api/v1/admin/situations"

VALID_PAYLOAD = {
    "scenario_el": "Στο εστιατόριο",
    "scenario_en": "At the restaurant",
    "scenario_ru": "В ресторане",
    "cefr_level": "B1",
}


@pytest.fixture
def mock_s3_service():
    with patch("src.api.v1.admin.get_s3_service") as mock_get:
        mock_s3 = MagicMock()
        mock_s3.delete_object.return_value = True
        mock_get.return_value = mock_s3
        yield mock_s3


class TestSituationAuth:
    """Auth tests: 401 (no auth) and 403 (regular user) for all 5 endpoints."""

    @pytest.mark.asyncio
    async def test_post_no_auth_401(self, client: AsyncClient):
        response = await client.post(BASE_URL, json=VALID_PAYLOAD)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_post_regular_user_403(self, client: AsyncClient, auth_headers: dict):
        response = await client.post(BASE_URL, json=VALID_PAYLOAD, headers=auth_headers)
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "FORBIDDEN"

    @pytest.mark.asyncio
    async def test_patch_no_auth_401(self, client: AsyncClient):
        response = await client.patch(f"{BASE_URL}/{uuid4()}", json={"scenario_en": "x"})
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_patch_regular_user_403(self, client: AsyncClient, auth_headers: dict):
        response = await client.patch(
            f"{BASE_URL}/{uuid4()}", json={"scenario_en": "x"}, headers=auth_headers
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_no_auth_401(self, client: AsyncClient):
        response = await client.delete(f"{BASE_URL}/{uuid4()}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_regular_user_403(self, client: AsyncClient, auth_headers: dict):
        response = await client.delete(f"{BASE_URL}/{uuid4()}", headers=auth_headers)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_list_no_auth_401(self, client: AsyncClient):
        response = await client.get(BASE_URL)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_list_regular_user_403(self, client: AsyncClient, auth_headers: dict):
        response = await client.get(BASE_URL, headers=auth_headers)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_detail_no_auth_401(self, client: AsyncClient):
        response = await client.get(f"{BASE_URL}/{uuid4()}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_detail_regular_user_403(self, client: AsyncClient, auth_headers: dict):
        response = await client.get(f"{BASE_URL}/{uuid4()}", headers=auth_headers)
        assert response.status_code == 403


class TestCreateSituation:
    """Tests for POST /api/v1/admin/situations."""

    @pytest.mark.asyncio
    async def test_happy_path_201(self, client: AsyncClient, superuser_auth_headers: dict):
        response = await client.post(BASE_URL, json=VALID_PAYLOAD, headers=superuser_auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["scenario_el"] == VALID_PAYLOAD["scenario_el"]
        assert data["scenario_en"] == VALID_PAYLOAD["scenario_en"]
        assert data["scenario_ru"] == VALID_PAYLOAD["scenario_ru"]
        assert data["cefr_level"] == "B1"
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_status_defaults_to_draft(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        response = await client.post(BASE_URL, json=VALID_PAYLOAD, headers=superuser_auth_headers)
        assert response.status_code == 201
        assert response.json()["status"] == "draft"

    @pytest.mark.asyncio
    async def test_422_missing_fields(self, client: AsyncClient, superuser_auth_headers: dict):
        response = await client.post(BASE_URL, json={}, headers=superuser_auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_422_invalid_cefr_level(self, client: AsyncClient, superuser_auth_headers: dict):
        payload = {**VALID_PAYLOAD, "cefr_level": "C1"}
        response = await client.post(BASE_URL, json=payload, headers=superuser_auth_headers)
        assert response.status_code == 422


class TestUpdateSituation:
    """Tests for PATCH /api/v1/admin/situations/{id}."""

    @pytest.mark.asyncio
    async def test_single_field_update(self, client: AsyncClient, superuser_auth_headers: dict):
        situation = await SituationFactory.create()
        response = await client.patch(
            f"{BASE_URL}/{situation.id}",
            json={"scenario_en": "Updated English"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["scenario_en"] == "Updated English"
        assert data["scenario_el"] == situation.scenario_el  # unchanged

    @pytest.mark.asyncio
    async def test_multiple_fields_update(self, client: AsyncClient, superuser_auth_headers: dict):
        situation = await SituationFactory.create()
        response = await client.patch(
            f"{BASE_URL}/{situation.id}",
            json={"scenario_el": "Ενημερωμένο", "cefr_level": "A1"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["scenario_el"] == "Ενημερωμένο"
        assert data["cefr_level"] == "A1"

    @pytest.mark.asyncio
    async def test_404_nonexistent(self, client: AsyncClient, superuser_auth_headers: dict):
        response = await client.patch(
            f"{BASE_URL}/{uuid4()}",
            json={"scenario_en": "Updated"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_422_empty_body(self, client: AsyncClient, superuser_auth_headers: dict):
        situation = await SituationFactory.create()
        response = await client.patch(
            f"{BASE_URL}/{situation.id}",
            json={},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422


class TestDeleteSituation:
    """Tests for DELETE /api/v1/admin/situations/{id}."""

    @pytest.mark.asyncio
    async def test_happy_path_204(self, client: AsyncClient, superuser_auth_headers: dict):
        situation = await SituationFactory.create()
        response = await client.delete(f"{BASE_URL}/{situation.id}", headers=superuser_auth_headers)
        assert response.status_code == 204
        assert response.content == b""

    @pytest.mark.asyncio
    async def test_404_nonexistent(self, client: AsyncClient, superuser_auth_headers: dict):
        response = await client.delete(f"{BASE_URL}/{uuid4()}", headers=superuser_auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_cascade_deletes_children(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        situation = await SituationFactory.create()
        description = await SituationDescriptionFactory.create(situation_id=situation.id)
        picture = await SituationPictureFactory.create(situation_id=situation.id)
        dialog = await ListeningDialogFactory.create(situation_id=situation.id)

        description_id = description.id
        picture_id = picture.id
        dialog_id = dialog.id

        response = await client.delete(f"{BASE_URL}/{situation.id}", headers=superuser_auth_headers)
        assert response.status_code == 204

        # Verify all children are gone
        desc_result = await db_session.execute(
            select(SituationDescription).where(SituationDescription.id == description_id)
        )
        assert desc_result.scalar_one_or_none() is None

        pic_result = await db_session.execute(
            select(SituationPicture).where(SituationPicture.id == picture_id)
        )
        assert pic_result.scalar_one_or_none() is None

        dialog_result = await db_session.execute(
            select(ListeningDialog).where(ListeningDialog.id == dialog_id)
        )
        assert dialog_result.scalar_one_or_none() is None

    @pytest.mark.asyncio
    async def test_s3_cleanup_called(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        situation = await SituationFactory.create()
        await ListeningDialogFactory.create(
            situation_id=situation.id, audio_s3_key="dialog/audio.mp3"
        )
        await SituationDescriptionFactory.create(
            situation_id=situation.id,
            audio_s3_key="desc/audio.mp3",
            audio_a2_s3_key="desc/audio_a2.mp3",
        )
        await SituationPictureFactory.create(situation_id=situation.id, image_s3_key="pic/img.jpg")

        response = await client.delete(f"{BASE_URL}/{situation.id}", headers=superuser_auth_headers)
        assert response.status_code == 204

        assert mock_s3_service.delete_object.call_count == 4
        called_keys = [call.args[0] for call in mock_s3_service.delete_object.call_args_list]
        assert "dialog/audio.mp3" in called_keys
        assert "desc/audio.mp3" in called_keys
        assert "desc/audio_a2.mp3" in called_keys
        assert "pic/img.jpg" in called_keys


class TestListSituations:
    """Tests for GET /api/v1/admin/situations."""

    @pytest.mark.asyncio
    async def test_happy_path(self, client: AsyncClient, superuser_auth_headers: dict):
        for _ in range(3):
            await SituationFactory.create()
        response = await client.get(BASE_URL, headers=superuser_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 3
        assert len(data["items"]) >= 3
        assert data["page"] == 1
        assert data["page_size"] == 20
        item = data["items"][0]
        assert "id" in item
        assert "scenario_el" in item
        assert "has_dialog" in item

    @pytest.mark.asyncio
    async def test_filter_cefr_level(self, client: AsyncClient, superuser_auth_headers: dict):
        a1 = await SituationFactory.create(a1_level=True)
        b1 = await SituationFactory.create()  # default B1
        response = await client.get(f"{BASE_URL}?cefr_level=A1", headers=superuser_auth_headers)
        assert response.status_code == 200
        data = response.json()
        ids = [item["id"] for item in data["items"]]
        assert str(a1.id) in ids
        assert str(b1.id) not in ids

    @pytest.mark.asyncio
    async def test_filter_status(self, client: AsyncClient, superuser_auth_headers: dict):
        draft = await SituationFactory.create()
        ready = await SituationFactory.create(ready=True)
        response = await client.get(f"{BASE_URL}?status=draft", headers=superuser_auth_headers)
        assert response.status_code == 200
        data = response.json()
        ids = [item["id"] for item in data["items"]]
        assert str(draft.id) in ids
        assert str(ready.id) not in ids

    @pytest.mark.asyncio
    async def test_search_case_insensitive(self, client: AsyncClient, superuser_auth_headers: dict):
        situation = await SituationFactory.create()
        # Search for a portion of the scenario_en value
        search_term = situation.scenario_en[:10].lower()
        response = await client.get(
            f"{BASE_URL}?search={search_term}", headers=superuser_auth_headers
        )
        assert response.status_code == 200
        ids = [item["id"] for item in response.json()["items"]]
        assert str(situation.id) in ids

    @pytest.mark.asyncio
    async def test_boolean_flags_with_children(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        situation = await SituationFactory.create()
        await ListeningDialogFactory.create(situation_id=situation.id, audio_s3_key="d/audio.mp3")
        await SituationDescriptionFactory.create(
            situation_id=situation.id, audio_s3_key="d/desc.mp3"
        )
        await SituationPictureFactory.create(situation_id=situation.id)

        response = await client.get(
            f"{BASE_URL}?search={situation.scenario_en[:10]}", headers=superuser_auth_headers
        )
        assert response.status_code == 200
        items = response.json()["items"]
        item = next(i for i in items if i["id"] == str(situation.id))
        assert item["has_dialog"] is True
        assert item["has_description"] is True
        assert item["has_picture"] is True
        assert item["has_dialog_audio"] is True
        assert item["has_description_audio"] is True

    @pytest.mark.asyncio
    async def test_boolean_flags_no_children(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        situation = await SituationFactory.create()
        response = await client.get(
            f"{BASE_URL}?search={situation.scenario_en[:10]}", headers=superuser_auth_headers
        )
        assert response.status_code == 200
        items = response.json()["items"]
        item = next(i for i in items if i["id"] == str(situation.id))
        assert item["has_dialog"] is False
        assert item["has_description"] is False
        assert item["has_picture"] is False
        assert item["has_dialog_audio"] is False
        assert item["has_description_audio"] is False

    @pytest.mark.asyncio
    async def test_pagination(self, client: AsyncClient, superuser_auth_headers: dict):
        for _ in range(5):
            await SituationFactory.create()
        response = await client.get(
            f"{BASE_URL}?page=2&page_size=2", headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 5
        assert len(data["items"]) == 2
        assert data["page"] == 2
        assert data["page_size"] == 2

    @pytest.mark.asyncio
    async def test_empty_result(self, client: AsyncClient, superuser_auth_headers: dict):
        response = await client.get(
            f"{BASE_URL}?search=ZZZNOMATCH99999", headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []


class TestGetSituationDetail:
    """Tests for GET /api/v1/admin/situations/{id}."""

    @pytest.mark.asyncio
    async def test_with_all_children(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        situation = await SituationFactory.create()
        dialog = await ListeningDialogFactory.create(situation_id=situation.id)
        await SituationDescriptionFactory.create(situation_id=situation.id)
        await SituationPictureFactory.create(situation_id=situation.id)

        # Add speaker and line directly
        speaker = DialogSpeaker(
            dialog_id=dialog.id, speaker_index=0, character_name="Γιάννης", voice_id="v1"
        )
        db_session.add(speaker)
        await db_session.flush()

        line = DialogLine(
            dialog_id=dialog.id, speaker_id=speaker.id, line_index=0, text="Γεια σου!"
        )
        db_session.add(line)
        await db_session.flush()

        response = await client.get(f"{BASE_URL}/{situation.id}", headers=superuser_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(situation.id)
        assert data["dialog"] is not None
        assert len(data["dialog"]["speakers"]) == 1
        assert data["dialog"]["speakers"][0]["character_name"] == "Γιάννης"
        assert len(data["dialog"]["lines"]) == 1
        assert data["dialog"]["lines"][0]["text"] == "Γεια σου!"
        assert data["dialog"]["audio_url"] is None
        assert data["description"] is not None
        assert data["picture"] is not None

    @pytest.mark.asyncio
    async def test_no_children(self, client: AsyncClient, superuser_auth_headers: dict):
        situation = await SituationFactory.create()
        response = await client.get(f"{BASE_URL}/{situation.id}", headers=superuser_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["dialog"] is None
        assert data["description"] is None
        assert data["picture"] is None

    @pytest.mark.asyncio
    async def test_partial_children(self, client: AsyncClient, superuser_auth_headers: dict):
        situation = await SituationFactory.create()
        await ListeningDialogFactory.create(situation_id=situation.id)
        # No description, no picture
        response = await client.get(f"{BASE_URL}/{situation.id}", headers=superuser_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["dialog"] is not None
        assert data["description"] is None
        assert data["picture"] is None

    @pytest.mark.asyncio
    async def test_404_nonexistent(self, client: AsyncClient, superuser_auth_headers: dict):
        response = await client.get(f"{BASE_URL}/{uuid4()}", headers=superuser_auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_detail_dialog_audio_url(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        situation = await SituationFactory.create()
        dialog = await ListeningDialogFactory.create(situation_id=situation.id)
        dialog.audio_s3_key = "test-audio.mp3"
        await db_session.flush()

        mock_s3_service.generate_presigned_url.return_value = (
            "https://s3.example.com/test-audio.mp3"
        )

        response = await client.get(f"{BASE_URL}/{situation.id}", headers=superuser_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["dialog"]["audio_url"] == "https://s3.example.com/test-audio.mp3"
        mock_s3_service.generate_presigned_url.assert_called_once_with("test-audio.mp3")
