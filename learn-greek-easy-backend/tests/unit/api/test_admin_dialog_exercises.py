"""Unit tests for exercise persistence in POST /api/v1/admin/listening-dialogs."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DialogExercise, ExerciseItem

ENDPOINT = "/api/v1/admin/listening-dialogs"

# ---------------------------------------------------------------------------
# Shared payload helpers
# ---------------------------------------------------------------------------

SPEAKERS = [
    {"speaker_index": 0, "character_name": "Άρης", "voice_id": "voice_1"},
    {"speaker_index": 1, "character_name": "Μαρία", "voice_id": "voice_2"},
]

LINES = [
    {"speaker_index": 0, "text": "Γεια σου!"},
    {"speaker_index": 1, "text": "Γεια!"},
]

FILL_GAP = {
    "line_index": 0,
    "correct_answer": "hello",
    "options": ["hello", "goodbye", "thanks"],
    "context_before": "",
    "context_after": "",
}

SELECT_HEARD = {
    "question_el": "τι;",
    "question_en": "what?",
    "question_ru": "что?",
    "correct_answer": "hello",
    "options": ["hello", "goodbye", "thanks"],
}

TRUE_FALSE = {
    "statement_el": "αλήθεια",
    "statement_en": "true",
    "statement_ru": "правда",
    "correct_answer": True,
    "explanation": "because",
}

EXERCISES_PAYLOAD = {
    "fill_gaps": [FILL_GAP],
    "select_heard": [SELECT_HEARD],
    "true_false": [TRUE_FALSE],
}


def _base_payload(**overrides) -> dict:
    payload = {
        "scenario_el": "Σενάριο",
        "scenario_en": "Scenario",
        "scenario_ru": "Сценарий",
        "cefr_level": "A1",
        "speakers": SPEAKERS,
        "lines": LINES,
    }
    payload.update(overrides)
    return payload


def _mock_elevenlabs():
    mock = MagicMock()
    mock.list_voices = AsyncMock(return_value=[{"voice_id": "voice_1"}, {"voice_id": "voice_2"}])
    return mock


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestDialogExercisePersistence:
    """Tests for exercise persistence in the dialog creation endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="Dialog creation endpoint requires situation_id after SIT-01 migration; endpoint updated in SIT-04",
        strict=True,
    )
    async def test_create_dialog_with_exercises(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """201 response and 3 DialogExercise rows + items created in DB."""
        payload = _base_payload(exercises=EXERCISES_PAYLOAD)

        with (
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=_mock_elevenlabs(),
            ),
            patch("src.api.v1.admin.settings") as mock_settings,
        ):
            mock_settings.elevenlabs_configured = True
            response = await client.post(ENDPOINT, json=payload, headers=superuser_auth_headers)

        assert response.status_code == 201

        dialog_id = response.json()["id"]

        exercise_count_result = await db_session.execute(
            select(func.count())
            .select_from(DialogExercise)
            .where(DialogExercise.dialog_id == dialog_id)
        )
        exercise_count = exercise_count_result.scalar_one()
        assert exercise_count == 3

        item_count_result = await db_session.execute(
            select(func.count())
            .select_from(ExerciseItem)
            .join(DialogExercise, ExerciseItem.exercise_id == DialogExercise.id)
            .where(DialogExercise.dialog_id == dialog_id)
        )
        item_count = item_count_result.scalar_one()
        assert item_count == 3  # 1 fill_gap + 1 select_heard + 1 true_false

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="Dialog creation endpoint requires situation_id after SIT-01 migration; endpoint updated in SIT-04",
        strict=True,
    )
    async def test_create_dialog_without_exercises(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """201 response and no exercise rows when exercises key is absent."""
        payload = _base_payload()

        with (
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=_mock_elevenlabs(),
            ),
            patch("src.api.v1.admin.settings") as mock_settings,
        ):
            mock_settings.elevenlabs_configured = True
            response = await client.post(ENDPOINT, json=payload, headers=superuser_auth_headers)

        assert response.status_code == 201

        dialog_id = response.json()["id"]

        exercise_count_result = await db_session.execute(
            select(func.count())
            .select_from(DialogExercise)
            .where(DialogExercise.dialog_id == dialog_id)
        )
        exercise_count = exercise_count_result.scalar_one()
        assert exercise_count == 0

    @pytest.mark.asyncio
    async def test_invalid_line_index(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ) -> None:
        """422 when fill_gaps line_index >= number of lines."""
        bad_fill_gap = {**FILL_GAP, "line_index": 99}
        payload = _base_payload(
            exercises={
                "fill_gaps": [bad_fill_gap],
                "select_heard": [SELECT_HEARD],
                "true_false": [TRUE_FALSE],
            }
        )

        with (
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=_mock_elevenlabs(),
            ),
            patch("src.api.v1.admin.settings") as mock_settings,
        ):
            mock_settings.elevenlabs_configured = True
            response = await client.post(ENDPOINT, json=payload, headers=superuser_auth_headers)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_empty_fill_gaps_list(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ) -> None:
        """422 when fill_gaps is an empty list (min_length=1)."""
        payload = _base_payload(
            exercises={
                "fill_gaps": [],
                "select_heard": [SELECT_HEARD],
                "true_false": [TRUE_FALSE],
            }
        )

        with (
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=_mock_elevenlabs(),
            ),
            patch("src.api.v1.admin.settings") as mock_settings,
        ):
            mock_settings.elevenlabs_configured = True
            response = await client.post(ENDPOINT, json=payload, headers=superuser_auth_headers)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_too_many_fill_gaps(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ) -> None:
        """422 when fill_gaps has 7 items (max_length=6)."""
        payload = _base_payload(
            exercises={
                "fill_gaps": [FILL_GAP] * 7,
                "select_heard": [SELECT_HEARD],
                "true_false": [TRUE_FALSE],
            }
        )

        with (
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=_mock_elevenlabs(),
            ),
            patch("src.api.v1.admin.settings") as mock_settings,
        ):
            mock_settings.elevenlabs_configured = True
            response = await client.post(ENDPOINT, json=payload, headers=superuser_auth_headers)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_correct_answer_not_in_options(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ) -> None:
        """422 when fill_gaps correct_answer is not in options."""
        bad_fill_gap = {
            "line_index": 0,
            "correct_answer": "missing",
            "options": ["hello", "goodbye", "thanks"],
            "context_before": "",
            "context_after": "",
        }
        payload = _base_payload(
            exercises={
                "fill_gaps": [bad_fill_gap],
                "select_heard": [SELECT_HEARD],
                "true_false": [TRUE_FALSE],
            }
        )

        with (
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=_mock_elevenlabs(),
            ),
            patch("src.api.v1.admin.settings") as mock_settings,
        ):
            mock_settings.elevenlabs_configured = True
            response = await client.post(ENDPOINT, json=payload, headers=superuser_auth_headers)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_payload_structure(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ) -> None:
        """422 when a required field is missing from a fill_gaps item."""
        incomplete_fill_gap = {
            "line_index": 0,
            "correct_answer": "hello",
            # missing: options, context_before, context_after
        }
        payload = _base_payload(
            exercises={
                "fill_gaps": [incomplete_fill_gap],
                "select_heard": [SELECT_HEARD],
                "true_false": [TRUE_FALSE],
            }
        )

        with (
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=_mock_elevenlabs(),
            ),
            patch("src.api.v1.admin.settings") as mock_settings,
        ):
            mock_settings.elevenlabs_configured = True
            response = await client.post(ENDPOINT, json=payload, headers=superuser_auth_headers)

        assert response.status_code == 422
