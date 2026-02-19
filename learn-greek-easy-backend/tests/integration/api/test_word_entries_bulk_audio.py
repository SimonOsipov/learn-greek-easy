"""Integration tests for word entry bulk upload audio task scheduling."""

from unittest.mock import patch

import pytest
from httpx import AsyncClient


class TestBulkUploadAudioScheduling:
    """Verify bulk upload endpoint schedules audio generation tasks correctly."""

    @pytest.fixture
    async def active_deck(self, db_session, test_deck):
        """Use the shared test_deck fixture."""
        return test_deck

    async def test_bulk_upload_schedules_audio_tasks(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        active_deck,
    ):
        """Endpoint schedules one audio task per word entry when BG tasks enabled."""
        scheduled_tasks = []

        def capture_task(func, **kwargs):
            scheduled_tasks.append((func, kwargs))

        with (
            patch("src.api.v1.word_entries.is_background_tasks_enabled", return_value=True),
            patch("src.api.v1.word_entries.settings") as mock_settings,
        ):
            mock_settings.database_url = "postgresql+asyncpg://test:test@localhost/test"

            # Patch BackgroundTasks.add_task to capture calls
            with patch("fastapi.BackgroundTasks.add_task", side_effect=capture_task):
                response = await client.post(
                    "/api/v1/word-entries/bulk",
                    json={
                        "deck_id": str(active_deck.id),
                        "word_entries": [
                            {
                                "lemma": "σπίτι",
                                "part_of_speech": "noun",
                                "translation_en": "house",
                            },
                            {
                                "lemma": "γάτα",
                                "part_of_speech": "noun",
                                "translation_en": "cat",
                            },
                        ],
                    },
                    headers=superuser_auth_headers,
                )

        assert response.status_code == 201
        # One task scheduled per word entry
        assert len(scheduled_tasks) == 2

    async def test_bulk_upload_no_tasks_when_disabled(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        active_deck,
    ):
        """Endpoint schedules no tasks when background tasks disabled; still returns 201."""
        with patch("src.api.v1.word_entries.is_background_tasks_enabled", return_value=False):
            with patch("fastapi.BackgroundTasks.add_task") as mock_add_task:
                response = await client.post(
                    "/api/v1/word-entries/bulk",
                    json={
                        "deck_id": str(active_deck.id),
                        "word_entries": [
                            {
                                "lemma": "σπίτι",
                                "part_of_speech": "noun",
                                "translation_en": "house",
                            },
                        ],
                    },
                    headers=superuser_auth_headers,
                )

        assert response.status_code == 201
        mock_add_task.assert_not_called()
