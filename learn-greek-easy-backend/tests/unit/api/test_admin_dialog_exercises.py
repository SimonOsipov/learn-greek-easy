"""Unit tests for exercise persistence in POST /api/v1/admin/listening-dialogs."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

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
