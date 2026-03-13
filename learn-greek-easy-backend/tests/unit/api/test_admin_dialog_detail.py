"""Unit tests for GET /api/v1/admin/listening-dialogs/{dialog_id} endpoint."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DialogLine, DialogSpeaker, DialogStatus
from tests.factories.listening_dialog import ListeningDialogFactory


class TestGetDialogDetail:
    """Tests for GET /api/v1/admin/listening-dialogs/{dialog_id}."""

    ENDPOINT = "/api/v1/admin/listening-dialogs/{dialog_id}"

    @pytest.mark.asyncio
    async def test_get_dialog_detail(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """200 with speakers and lines ordered by index."""
        dialog = await ListeningDialogFactory.create(
            session=db_session, status=DialogStatus.AUDIO_READY
        )

        # Create 2 speakers (insert index 1 before 0 to verify sorting)
        speaker_b = DialogSpeaker(
            dialog_id=dialog.id,
            speaker_index=1,
            character_name="Μαρία",
            voice_id="voice-b",
        )
        speaker_a = DialogSpeaker(
            dialog_id=dialog.id,
            speaker_index=0,
            character_name="Άρης",
            voice_id="voice-a",
        )
        db_session.add_all([speaker_b, speaker_a])
        await db_session.flush()

        # Create 3 lines (insert index 2 before 0 to verify sorting)
        line_c = DialogLine(
            dialog_id=dialog.id,
            speaker_id=speaker_a.id,
            line_index=2,
            text="Πώς είστε;",
        )
        line_a = DialogLine(
            dialog_id=dialog.id,
            speaker_id=speaker_a.id,
            line_index=0,
            text="Γεια σας!",
        )
        line_b = DialogLine(
            dialog_id=dialog.id,
            speaker_id=speaker_b.id,
            line_index=1,
            text="Γεια σου!",
        )
        db_session.add_all([line_c, line_a, line_b])
        await db_session.flush()

        response = await client.get(
            self.ENDPOINT.format(dialog_id=dialog.id),
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(dialog.id)
        assert data["status"] == "audio_ready"

        # Speakers sorted by speaker_index
        assert len(data["speakers"]) == 2
        assert data["speakers"][0]["speaker_index"] == 0
        assert data["speakers"][0]["character_name"] == "Άρης"
        assert data["speakers"][1]["speaker_index"] == 1

        # Lines sorted by line_index
        assert len(data["lines"]) == 3
        assert data["lines"][0]["line_index"] == 0
        assert data["lines"][0]["text"] == "Γεια σας!"
        assert data["lines"][1]["line_index"] == 1
        assert data["lines"][2]["line_index"] == 2

    @pytest.mark.asyncio
    async def test_get_dialog_detail_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ) -> None:
        """404 for non-existent dialog_id."""
        response = await client.get(
            self.ENDPOINT.format(dialog_id=uuid4()),
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["message"] == "Dialog not found"

    @pytest.mark.asyncio
    async def test_get_dialog_detail_with_audio(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """audio_url populated when audio_s3_key is present."""
        dialog = await ListeningDialogFactory.create(
            session=db_session,
            status=DialogStatus.AUDIO_READY,
        )
        dialog.audio_s3_key = "dialogs/test-dialog.mp3"
        await db_session.flush()

        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.return_value = "https://s3.example.com/presigned"
            mock_get_s3.return_value = mock_s3

            response = await client.get(
                self.ENDPOINT.format(dialog_id=dialog.id),
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        assert response.json()["audio_url"] == "https://s3.example.com/presigned"

    @pytest.mark.asyncio
    async def test_get_dialog_detail_requires_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """403 for non-admin user."""
        dialog = await ListeningDialogFactory.create(session=db_session)

        response = await client.get(
            self.ENDPOINT.format(dialog_id=dialog.id),
            headers=auth_headers,
        )
        assert response.status_code == 403
