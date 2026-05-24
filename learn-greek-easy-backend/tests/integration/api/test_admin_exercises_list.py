"""Integration tests for GET /api/v1/admin/exercises endpoint."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, call, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.v1.admin import ADMIN_AUDIO_PRESIGN_TTL_SECONDS
from src.db.models import DeckLevel, ExerciseModality, ExerciseStatus, ExerciseType, PictureStatus
from tests.factories import (
    DescriptionExerciseFactory,
    DescriptionExerciseItemFactory,
    DialogExerciseFactory,
    ListeningDialogFactory,
    PictureExerciseFactory,
    PictureExerciseItemFactory,
    SituationDescriptionFactory,
    SituationFactory,
    SituationPictureFactory,
    WordOrderExerciseFactory,
    WordOrderExerciseItemFactory,
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
        mock_s3_service.generate_presigned_url.assert_called_with(
            "test/audio.mp3", expiry_seconds=ADMIN_AUDIO_PRESIGN_TTL_SECONDS
        )

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

    # -----------------------------------------------------------------------
    # EXR-57: PENDING status
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_status_filter_pending(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        desc = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc.id,
            modality=ExerciseModality.LISTENING,
            status=ExerciseStatus.PENDING,
        )
        # Another exercise with DRAFT status — should not appear
        desc2 = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc2.id,
            modality=ExerciseModality.LISTENING,
            status=ExerciseStatus.DRAFT,
        )

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "status": "pending"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["status"] == "pending"

    # -----------------------------------------------------------------------
    # EXR-53: word_order exercise type
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_word_order_exercise_appears_in_listening(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        desc = await SituationDescriptionFactory.create()
        wo_exercise = await WordOrderExerciseFactory.create(description_id=desc.id)
        await WordOrderExerciseItemFactory.create(word_order_exercise_id=wo_exercise.id)

        response = await client.get(
            BASE_URL,
            params={"modality": "listening"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        item = data["items"][0]
        assert item["exercise_type"] == "word_order"
        assert item["source_type"] == "word_order"
        assert item["correct_order"] == [2, 1, 0, 4, 3]
        assert item["answer_el"] == "ο Γιάννης πάει στο σχολείο"

    # -----------------------------------------------------------------------
    # EXR-50: payload fields
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_search_matches_question_text(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
        db_session: AsyncSession,
    ):
        # Exercise with unique question_en text
        desc = await SituationDescriptionFactory.create()
        exercise = await DescriptionExerciseFactory.create(
            description_id=desc.id,
            modality=ExerciseModality.LISTENING,
        )
        exercise.question_en = "Unique banana test phrase"
        await db_session.flush()

        # Another exercise without that question text — must not appear
        desc2 = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc2.id,
            modality=ExerciseModality.LISTENING,
        )

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "search": "banana"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["question_en"] == "Unique banana test phrase"

    @pytest.mark.asyncio
    async def test_payload_includes_all_design_fields(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        desc = await SituationDescriptionFactory.create()
        exercise = await DescriptionExerciseFactory.create(
            description_id=desc.id,
            modality=ExerciseModality.LISTENING,
        )
        await DescriptionExerciseItemFactory.create(description_exercise_id=exercise.id)

        response = await client.get(
            BASE_URL,
            params={"modality": "listening"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        item = data["items"][0]

        required_keys = {
            "id",
            "exercise_type",
            "status",
            "source_type",
            "modality",
            "audio_level",
            "situation_id",
            "situation_title_el",
            "situation_title_en",
            "audio_url",
            "item_count",
            "items",
            "question_el",
            "question_en",
            "correct_idx",
        }
        for key in required_keys:
            assert key in item, f"Missing key in response: {key}"

    # -----------------------------------------------------------------------
    # EXR-51: source + level filters
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_source_filter(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        # Description exercise
        desc = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc.id, modality=ExerciseModality.LISTENING
        )

        # Dialog exercise
        await DialogExerciseFactory.create()

        # Filter to only description source
        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "source": "description"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["source_type"] == "description"

        # Filter to only dialog source
        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "source": "dialog"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["source_type"] == "dialog"

    @pytest.mark.asyncio
    async def test_level_filter(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        desc = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc.id,
            modality=ExerciseModality.LISTENING,
            audio_level=DeckLevel.A2,
        )
        desc2 = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc2.id,
            modality=ExerciseModality.LISTENING,
            audio_level=DeckLevel.B2,
        )

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "level": "A2"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["audio_level"] == "A2"

    @pytest.mark.asyncio
    async def test_source_and_level_combine(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        # Description A2 — should appear
        desc_a2 = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc_a2.id,
            modality=ExerciseModality.LISTENING,
            audio_level=DeckLevel.A2,
        )
        # Description B2 — should NOT appear
        desc_b2 = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc_b2.id,
            modality=ExerciseModality.LISTENING,
            audio_level=DeckLevel.B2,
        )
        # Dialog — should NOT appear (source filter excludes it)
        await DialogExerciseFactory.create()

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "source": "description", "level": "A2"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["source_type"] == "description"
        assert data["items"][0]["audio_level"] == "A2"

    # -----------------------------------------------------------------------
    # EXR-58: lazy presigning (only page rows get presigned URLs)
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_presigning_lazy(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Presigning should only happen for the page returned, not all matching rows."""
        mock_s3_service.generate_presigned_url.return_value = "https://s3.example.com/audio.mp3"

        # Create 30 dialog exercises (each has a potential audio URL to presign).
        for _ in range(30):
            sit = await SituationFactory.create()
            dialog = await ListeningDialogFactory.create(situation_id=sit.id)
            dialog.audio_s3_key = "test/audio.mp3"
            await db_session.flush()
            await DialogExerciseFactory.create(dialog_id=dialog.id)

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "page": 1, "page_size": 10},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 30
        assert len(data["items"]) == 10
        # At most 10 presign calls — one per page row (some rows may have no key → 0 calls).
        assert mock_s3_service.generate_presigned_url.call_count <= 10

    # -----------------------------------------------------------------------
    # EXR-59: sort param
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_sort_oldest_pending(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Default sort: PENDING first, then DRAFT, then APPROVED; ties broken by created_at ASC."""
        t0 = datetime(2024, 1, 1, tzinfo=timezone.utc)
        t1 = datetime(2024, 6, 1, tzinfo=timezone.utc)
        t2 = datetime(2025, 1, 1, tzinfo=timezone.utc)

        desc_approved = await SituationDescriptionFactory.create()
        ex_approved = await DescriptionExerciseFactory.create(
            description_id=desc_approved.id,
            modality=ExerciseModality.LISTENING,
            status=ExerciseStatus.APPROVED,
        )
        ex_approved.created_at = t2
        await db_session.flush()

        desc_draft = await SituationDescriptionFactory.create()
        ex_draft = await DescriptionExerciseFactory.create(
            description_id=desc_draft.id,
            modality=ExerciseModality.LISTENING,
            status=ExerciseStatus.DRAFT,
        )
        ex_draft.created_at = t1
        await db_session.flush()

        desc_pending = await SituationDescriptionFactory.create()
        ex_pending = await DescriptionExerciseFactory.create(
            description_id=desc_pending.id,
            modality=ExerciseModality.LISTENING,
            status=ExerciseStatus.PENDING,
        )
        ex_pending.created_at = t0
        await db_session.flush()

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "sort": "oldest_pending"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        statuses = [item["status"] for item in data["items"]]
        assert statuses == ["pending", "draft", "approved"]

    @pytest.mark.asyncio
    async def test_sort_newest(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Sort newest: most recently created exercise first."""
        t_old = datetime(2024, 1, 1, tzinfo=timezone.utc)
        t_mid = datetime(2024, 6, 1, tzinfo=timezone.utc)
        t_new = datetime(2025, 1, 1, tzinfo=timezone.utc)

        desc1 = await SituationDescriptionFactory.create()
        ex1 = await DescriptionExerciseFactory.create(
            description_id=desc1.id, modality=ExerciseModality.LISTENING
        )
        ex1.created_at = t_old
        await db_session.flush()

        desc2 = await SituationDescriptionFactory.create()
        ex2 = await DescriptionExerciseFactory.create(
            description_id=desc2.id, modality=ExerciseModality.LISTENING
        )
        ex2.created_at = t_new
        await db_session.flush()

        desc3 = await SituationDescriptionFactory.create()
        ex3 = await DescriptionExerciseFactory.create(
            description_id=desc3.id, modality=ExerciseModality.LISTENING
        )
        ex3.created_at = t_mid
        await db_session.flush()

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "sort": "newest"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        ids = [item["id"] for item in data["items"]]
        assert ids == [str(ex2.id), str(ex3.id), str(ex1.id)]

    @pytest.mark.asyncio
    async def test_sort_title(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """Sort title: alphabetically by scenario_el (case-insensitive) ASC."""
        sit_z = await SituationFactory.create(scenario_el="Ζωολογικός", scenario_en="Zoo")
        sit_a = await SituationFactory.create(scenario_el="Αεροδρόμιο", scenario_en="Airport")
        sit_m = await SituationFactory.create(scenario_el="Μουσείο", scenario_en="Museum")

        desc_z = await SituationDescriptionFactory.create(situation_id=sit_z.id)
        await DescriptionExerciseFactory.create(
            description_id=desc_z.id, modality=ExerciseModality.LISTENING
        )
        desc_a = await SituationDescriptionFactory.create(situation_id=sit_a.id)
        await DescriptionExerciseFactory.create(
            description_id=desc_a.id, modality=ExerciseModality.LISTENING
        )
        desc_m = await SituationDescriptionFactory.create(situation_id=sit_m.id)
        await DescriptionExerciseFactory.create(
            description_id=desc_m.id, modality=ExerciseModality.LISTENING
        )

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "sort": "title"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        titles = [item["situation_title_el"] for item in data["items"]]
        assert titles == sorted(titles, key=str.casefold)

    # -----------------------------------------------------------------------
    # EXR-62: extended admin TTL
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_admin_audio_url_uses_extended_ttl(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Audio presign calls must use ADMIN_AUDIO_PRESIGN_TTL_SECONDS (7200), not the default."""
        mock_s3_service.generate_presigned_url.return_value = "https://s3.example.com/audio.mp3"

        sit = await SituationFactory.create()
        dialog = await ListeningDialogFactory.create(situation_id=sit.id)
        dialog.audio_s3_key = "admin/test-audio.mp3"
        await db_session.flush()
        await DialogExerciseFactory.create(dialog_id=dialog.id)

        response = await client.get(
            BASE_URL,
            params={"modality": "listening"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

        # At least one call must have used the admin TTL.
        admin_ttl_calls = [
            c
            for c in mock_s3_service.generate_presigned_url.call_args_list
            if c == call("admin/test-audio.mp3", expiry_seconds=ADMIN_AUDIO_PRESIGN_TTL_SECONDS)
        ]
        assert len(admin_ttl_calls) >= 1

    # -----------------------------------------------------------------------
    # EXR-61: per-source payload completeness
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_payload_per_source_completeness(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
        db_session: AsyncSession,
    ):
        """EXR-61: each source type surfaces its relevant fields in the response.

        EXR-61 Audit summary (PictureExerciseItem):
        - PictureExerciseItem has NO per-item image_s3_key column.
        - The parent SituationPicture has a single image_s3_key (anchor picture).
        - PictureExerciseItem.payload carries option text dicts, NOT per-option image URLs.
        - anchor_picture_url + items[] payload is sufficient for the 4-option grid.
        - No new schema fields are needed for EXR-33's 4-option grid.
        """
        mock_s3_service.generate_presigned_url.return_value = "https://s3.example.com/presigned"

        # Description (listening) — should have items[]
        sit_desc = await SituationFactory.create()
        desc = await SituationDescriptionFactory.create(situation_id=sit_desc.id)
        desc_ex = await DescriptionExerciseFactory.create(
            description_id=desc.id, modality=ExerciseModality.LISTENING
        )
        await DescriptionExerciseItemFactory.create(description_exercise_id=desc_ex.id)

        # Dialog — should have audio_url populated when audio_s3_key is set
        sit_dialog = await SituationFactory.create()
        dialog = await ListeningDialogFactory.create(situation_id=sit_dialog.id)
        dialog.audio_s3_key = "dialogs/test.mp3"
        await db_session.flush()
        await DialogExerciseFactory.create(dialog_id=dialog.id)

        # Picture — should have anchor_picture_url + items[] when image_s3_key is set
        sit_pic = await SituationFactory.create()
        picture = await SituationPictureFactory.create(
            situation_id=sit_pic.id,
            image_s3_key="pictures/test.jpg",
            status=PictureStatus.GENERATED,
        )
        pic_ex = await PictureExerciseFactory.create(picture_id=picture.id)
        await PictureExerciseItemFactory.create(picture_exercise_id=pic_ex.id)

        # Word-order — should have correct_order + answer_el
        sit_wo = await SituationFactory.create()
        wo_desc = await SituationDescriptionFactory.create(situation_id=sit_wo.id)
        wo_ex = await WordOrderExerciseFactory.create(description_id=wo_desc.id)
        await WordOrderExerciseItemFactory.create(word_order_exercise_id=wo_ex.id)

        response = await client.get(
            BASE_URL,
            params={"modality": "listening"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 4

        items_by_source = {item["source_type"]: item for item in data["items"]}

        # Description: items array populated
        desc_item = items_by_source["description"]
        assert len(desc_item["items"]) == 1
        assert "payload" in desc_item["items"][0]

        # Dialog: audio_url populated (s3 key present)
        dialog_item = items_by_source["dialog"]
        assert dialog_item["audio_url"] is not None

        # Picture: anchor_picture_url populated + items array populated
        pic_item = items_by_source["picture"]
        assert pic_item["anchor_picture_url"] is not None
        assert len(pic_item["items"]) == 1
        assert "payload" in pic_item["items"][0]

        # Word-order: correct_order + answer_el populated from first item payload
        wo_item = items_by_source["word_order"]
        assert wo_item["correct_order"] == [2, 1, 0, 4, 3]
        assert wo_item["answer_el"] == "ο Γιάννης πάει στο σχολείο"


# ===========================================================================
# EXR-64: parametrized filter matrix tests
# ===========================================================================


@pytest.mark.integration
class TestAdminExercisesFilterMatrix:
    """Parametrized tests covering every filter axis and combinations.

    Each test seeds the minimum rows needed to verify that the filter returns
    exactly the expected subset.  Tests are isolated via the per-test DB
    transaction rollback provided by the integration test conftest.
    """

    # -----------------------------------------------------------------------
    # 1. Single-axis parametrized tests
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "exercise_type",
        [
            ExerciseType.SELECT_CORRECT_ANSWER,
            ExerciseType.FILL_GAPS,
            ExerciseType.SELECT_HEARD,
            ExerciseType.TRUE_FALSE,
            ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION,
            ExerciseType.SELECT_DESCRIPTION_FROM_PICTURE,
            ExerciseType.WORD_ORDER,
        ],
    )
    async def test_exercise_type_filter_single_axis(
        self,
        exercise_type: ExerciseType,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """Each exercise_type filter returns exactly the matching row."""
        # WORD_ORDER and PICTURE types use different source tables.
        if exercise_type == ExerciseType.WORD_ORDER:
            desc_a = await SituationDescriptionFactory.create()
            await WordOrderExerciseFactory.create(description_id=desc_a.id)
            desc_b = await SituationDescriptionFactory.create()
            await DescriptionExerciseFactory.create(
                description_id=desc_b.id,
                modality=ExerciseModality.LISTENING,
                exercise_type=ExerciseType.SELECT_CORRECT_ANSWER,
            )
        elif exercise_type in (
            ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION,
            ExerciseType.SELECT_DESCRIPTION_FROM_PICTURE,
        ):
            await PictureExerciseFactory.create(exercise_type=exercise_type)
            # Second row: different type on another picture
            other_type = (
                ExerciseType.SELECT_DESCRIPTION_FROM_PICTURE
                if exercise_type == ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION
                else ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION
            )
            # Use a description exercise as the "other" row so we don't violate
            # the unique constraint on (picture_id, exercise_type).
            desc_other = await SituationDescriptionFactory.create()
            await DescriptionExerciseFactory.create(
                description_id=desc_other.id,
                modality=ExerciseModality.LISTENING,
                exercise_type=ExerciseType.SELECT_CORRECT_ANSWER,
            )
            _ = other_type  # used only for documentation
        else:
            # Description exercises — two rows differing only on exercise_type
            desc_a = await SituationDescriptionFactory.create()
            await DescriptionExerciseFactory.create(
                description_id=desc_a.id,
                modality=ExerciseModality.LISTENING,
                exercise_type=exercise_type,
            )
            desc_b = await SituationDescriptionFactory.create()
            # Use the next type in the list so it's always different
            other_type = (
                ExerciseType.FILL_GAPS
                if exercise_type != ExerciseType.FILL_GAPS
                else ExerciseType.SELECT_HEARD
            )
            await DescriptionExerciseFactory.create(
                description_id=desc_b.id,
                modality=ExerciseModality.LISTENING,
                exercise_type=other_type,
            )

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "exercise_type": exercise_type.value},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["exercise_type"] == exercise_type.value

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "status",
        [ExerciseStatus.DRAFT, ExerciseStatus.PENDING, ExerciseStatus.APPROVED],
    )
    async def test_status_filter_single_axis(
        self,
        status: ExerciseStatus,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """Each status filter returns exactly the matching row."""
        other_status = (
            ExerciseStatus.APPROVED if status == ExerciseStatus.DRAFT else ExerciseStatus.DRAFT
        )
        desc_a = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc_a.id,
            modality=ExerciseModality.LISTENING,
            status=status,
        )
        desc_b = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc_b.id,
            modality=ExerciseModality.LISTENING,
            status=other_status,
        )

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "status": status.value},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["status"] == status.value

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "source,factory_fn_name",
        [
            ("description", "description"),
            ("dialog", "dialog"),
            ("picture", "picture"),
        ],
    )
    async def test_source_filter_single_axis(
        self,
        source: str,
        factory_fn_name: str,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """Each source filter returns only the matching source row."""
        # Seed one row for the target source and one for a different source.
        if source == "description":
            desc_match = await SituationDescriptionFactory.create()
            await DescriptionExerciseFactory.create(
                description_id=desc_match.id, modality=ExerciseModality.LISTENING
            )
            await DialogExerciseFactory.create()
        elif source == "dialog":
            await DialogExerciseFactory.create()
            desc_other = await SituationDescriptionFactory.create()
            await DescriptionExerciseFactory.create(
                description_id=desc_other.id, modality=ExerciseModality.LISTENING
            )
        else:  # picture
            await PictureExerciseFactory.create()
            desc_other = await SituationDescriptionFactory.create()
            await DescriptionExerciseFactory.create(
                description_id=desc_other.id, modality=ExerciseModality.LISTENING
            )

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "source": source},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["source_type"] == source

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "level",
        [DeckLevel.A2, DeckLevel.B1],
    )
    async def test_level_filter_single_axis(
        self,
        level: DeckLevel,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """Level filter returns only description exercises at the matching level."""
        other_level = DeckLevel.B2 if level != DeckLevel.B2 else DeckLevel.A2
        desc_a = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc_a.id,
            modality=ExerciseModality.LISTENING,
            audio_level=level,
        )
        desc_b = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc_b.id,
            modality=ExerciseModality.LISTENING,
            audio_level=other_level,
        )

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "level": level.value},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["audio_level"] == level.value

    # -----------------------------------------------------------------------
    # 2. AND-combination: four axes at once
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_and_combination_four_axes(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """Filter on source+level+status+exercise_type simultaneously returns 1 row."""
        # Target: dialog, B1 (level skipped for dialog), approved, true_false
        # Seed 4 description rows each differing on one axis so none of them match all four.
        # Plus one dialog row that matches all four axes.
        sit_target = await SituationFactory.create()
        dialog_target = await ListeningDialogFactory.create(situation_id=sit_target.id)
        await DialogExerciseFactory.create(
            dialog_id=dialog_target.id,
            exercise_type=ExerciseType.TRUE_FALSE,
            status=ExerciseStatus.APPROVED,
        )

        # Distractor 1: dialog but wrong type
        sit_d1 = await SituationFactory.create()
        dialog_d1 = await ListeningDialogFactory.create(situation_id=sit_d1.id)
        await DialogExerciseFactory.create(
            dialog_id=dialog_d1.id,
            exercise_type=ExerciseType.FILL_GAPS,
            status=ExerciseStatus.APPROVED,
        )

        # Distractor 2: dialog + true_false but wrong status
        sit_d2 = await SituationFactory.create()
        dialog_d2 = await ListeningDialogFactory.create(situation_id=sit_d2.id)
        await DialogExerciseFactory.create(
            dialog_id=dialog_d2.id,
            exercise_type=ExerciseType.TRUE_FALSE,
            status=ExerciseStatus.DRAFT,
        )

        # Distractor 3: description (wrong source) + true_false + approved
        desc_d3 = await SituationDescriptionFactory.create()
        await DescriptionExerciseFactory.create(
            description_id=desc_d3.id,
            modality=ExerciseModality.LISTENING,
            exercise_type=ExerciseType.TRUE_FALSE,
            status=ExerciseStatus.APPROVED,
        )

        response = await client.get(
            BASE_URL,
            params={
                "modality": "listening",
                "source": "dialog",
                "status": "approved",
                "exercise_type": "true_false",
            },
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        item = data["items"][0]
        assert item["source_type"] == "dialog"
        assert item["exercise_type"] == "true_false"
        assert item["status"] == "approved"

    # -----------------------------------------------------------------------
    # 3. Search + filter combined
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_search_and_filter_combined(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """Both rows match the search query but only one matches the status filter."""
        sit_a = await SituationFactory.create(
            scenario_el="Βιβλιοθήκη", scenario_en="Library search test"
        )
        desc_a = await SituationDescriptionFactory.create(situation_id=sit_a.id)
        await DescriptionExerciseFactory.create(
            description_id=desc_a.id,
            modality=ExerciseModality.LISTENING,
            status=ExerciseStatus.APPROVED,
        )

        sit_b = await SituationFactory.create(
            scenario_el="Βιβλιοθήκη 2", scenario_en="Library search test 2"
        )
        desc_b = await SituationDescriptionFactory.create(situation_id=sit_b.id)
        await DescriptionExerciseFactory.create(
            description_id=desc_b.id,
            modality=ExerciseModality.LISTENING,
            status=ExerciseStatus.DRAFT,
        )

        response = await client.get(
            BASE_URL,
            params={
                "modality": "listening",
                "search": "Library search test",
                "status": "approved",
            },
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["status"] == "approved"

    # -----------------------------------------------------------------------
    # 4. Pagination boundary: 25 rows, page 2 of page_size 20 → 5 rows
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_pagination_boundary_page2(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """Page 2 of a 25-row set with page_size=20 returns exactly 5 rows and total=25."""
        for _ in range(25):
            sit = await SituationFactory.create()
            desc = await SituationDescriptionFactory.create(situation_id=sit.id)
            await DescriptionExerciseFactory.create(
                description_id=desc.id, modality=ExerciseModality.LISTENING
            )

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "page": 2, "page_size": 20},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 25
        assert len(data["items"]) == 5
        assert data["page"] == 2
        assert data["page_size"] == 20

    # -----------------------------------------------------------------------
    # 5. Total-count consistency: filtered total ≤ unfiltered total
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_total_count_consistency(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """Filtered total (status=approved) ≤ unfiltered total and equals seeded count."""
        # Seed 3 approved + 2 draft description exercises
        for _ in range(3):
            sit = await SituationFactory.create()
            desc = await SituationDescriptionFactory.create(situation_id=sit.id)
            await DescriptionExerciseFactory.create(
                description_id=desc.id,
                modality=ExerciseModality.LISTENING,
                status=ExerciseStatus.APPROVED,
            )
        for _ in range(2):
            sit = await SituationFactory.create()
            desc = await SituationDescriptionFactory.create(situation_id=sit.id)
            await DescriptionExerciseFactory.create(
                description_id=desc.id,
                modality=ExerciseModality.LISTENING,
                status=ExerciseStatus.DRAFT,
            )

        unfiltered = await client.get(
            BASE_URL, params={"modality": "listening"}, headers=superuser_auth_headers
        )
        filtered = await client.get(
            BASE_URL,
            params={"modality": "listening", "status": "approved"},
            headers=superuser_auth_headers,
        )

        assert unfiltered.status_code == 200
        assert filtered.status_code == 200
        unfiltered_total = unfiltered.json()["total"]
        filtered_total = filtered.json()["total"]

        assert filtered_total <= unfiltered_total
        assert filtered_total == 3  # exactly the 3 approved rows seeded above

    # -----------------------------------------------------------------------
    # 6. Payload shape per source
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_payload_shape_description(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """Description source: question_el, items list present."""
        desc = await SituationDescriptionFactory.create()
        ex = await DescriptionExerciseFactory.create(
            description_id=desc.id, modality=ExerciseModality.LISTENING
        )
        await DescriptionExerciseItemFactory.create(description_exercise_id=ex.id)

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "source": "description"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        item = response.json()["items"][0]
        assert item["source_type"] == "description"
        # question fields (may be None if not set, but key must be present)
        assert "question_el" in item
        assert "question_en" in item
        # items array is required
        assert "items" in item
        assert isinstance(item["items"], list)

    @pytest.mark.asyncio
    async def test_payload_shape_dialog(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
        db_session: AsyncSession,
    ):
        """Dialog source: audio_url present when audio_s3_key is set."""
        mock_s3_service.generate_presigned_url.return_value = "https://s3.test/dialog.mp3"

        sit = await SituationFactory.create()
        dialog = await ListeningDialogFactory.create(situation_id=sit.id)
        dialog.audio_s3_key = "dialogs/payload-shape-test.mp3"
        await db_session.flush()
        await DialogExerciseFactory.create(dialog_id=dialog.id)

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "source": "dialog"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        item = response.json()["items"][0]
        assert item["source_type"] == "dialog"
        assert item["audio_url"] == "https://s3.test/dialog.mp3"
        assert "items" in item

    @pytest.mark.asyncio
    async def test_payload_shape_picture(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
        db_session: AsyncSession,
    ):
        """Picture source: anchor_picture_url present when image_s3_key is set."""
        mock_s3_service.generate_presigned_url.return_value = "https://s3.test/picture.jpg"

        sit = await SituationFactory.create()
        picture = await SituationPictureFactory.create(
            situation_id=sit.id,
            image_s3_key="pictures/payload-shape-test.jpg",
            status=PictureStatus.GENERATED,
        )
        ex = await PictureExerciseFactory.create(picture_id=picture.id)
        await PictureExerciseItemFactory.create(picture_exercise_id=ex.id)

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "source": "picture"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        item = response.json()["items"][0]
        assert item["source_type"] == "picture"
        assert item["anchor_picture_url"] == "https://s3.test/picture.jpg"
        assert "items" in item

    @pytest.mark.asyncio
    async def test_payload_shape_word_order(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """Word-order source: correct_order and answer_el present from first item payload."""
        desc = await SituationDescriptionFactory.create()
        wo_ex = await WordOrderExerciseFactory.create(description_id=desc.id)
        await WordOrderExerciseItemFactory.create(word_order_exercise_id=wo_ex.id)

        response = await client.get(
            BASE_URL,
            params={"modality": "listening", "source": "word_order"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        item = response.json()["items"][0]
        assert item["source_type"] == "word_order"
        assert item["exercise_type"] == "word_order"
        assert item["correct_order"] is not None
        assert item["answer_el"] is not None
