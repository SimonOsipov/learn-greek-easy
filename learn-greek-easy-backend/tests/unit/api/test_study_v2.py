from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.db.models import Deck
from src.schemas.v2_sm2 import V2StudyQueue


def _make_mock_queue() -> MagicMock:
    mock_queue = MagicMock(spec=V2StudyQueue)
    mock_queue.model_dump.return_value = {
        "total_due": 0,
        "total_new": 0,
        "total_early_practice": 0,
        "total_in_queue": 0,
        "cards": [],
    }
    return mock_queue


@pytest.mark.unit
@pytest.mark.api
class TestStudyV2Route:
    @pytest.mark.asyncio
    async def test_400_when_neither_deck_id_nor_card_type(self, client, auth_headers):
        response = await client.get("/api/v1/study/queue/v2", headers=auth_headers)
        assert response.status_code == 400
        body = response.json()
        message = body.get("detail") or body.get("error", {}).get("message", "")
        assert "At least one of" in message

    @pytest.mark.asyncio
    async def test_403_for_premium_deck_free_user(self, client, auth_headers):
        from fastapi import HTTPException

        deck_id = uuid4()
        mock_deck = MagicMock(spec=Deck)
        mock_deck.is_active = True
        mock_deck.is_premium = True

        mock_repo = MagicMock()
        mock_repo.get = AsyncMock(return_value=mock_deck)

        def raise_403(user, deck):
            raise HTTPException(status_code=403, detail="Premium subscription required")

        with patch("src.api.v1.study_v2.DeckRepository", return_value=mock_repo):
            with patch("src.api.v1.study_v2.check_premium_deck_access", side_effect=raise_403):
                response = await client.get(
                    f"/api/v1/study/queue/v2?deck_id={deck_id}",
                    headers=auth_headers,
                )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_200_with_word_entry_id_only(self, client, auth_headers):
        word_entry_id = uuid4()
        mock_queue = _make_mock_queue()
        with patch("src.api.v1.study_v2.V2SM2Service") as MockService:
            mock_instance = MockService.return_value
            mock_instance.get_study_queue = AsyncMock(return_value=mock_queue)
            response = await client.get(
                f"/api/v1/study/queue/v2?word_entry_id={word_entry_id}",
                headers=auth_headers,
            )
        assert response.status_code == 200
        kwargs = mock_instance.get_study_queue.await_args.kwargs
        assert kwargs["word_entry_id"] == word_entry_id
        assert kwargs["deck_id"] is None

    @pytest.mark.asyncio
    async def test_200_with_word_entry_id_and_deck_id(self, client, auth_headers):
        word_entry_id = uuid4()
        deck_id = uuid4()
        mock_deck = MagicMock(spec=Deck)
        mock_deck.is_premium = False
        mock_repo = MagicMock()
        mock_repo.get = AsyncMock(return_value=mock_deck)
        mock_queue = _make_mock_queue()
        with (
            patch("src.api.v1.study_v2.DeckRepository", return_value=mock_repo),
            patch("src.api.v1.study_v2.V2SM2Service") as MockService,
        ):
            mock_instance = MockService.return_value
            mock_instance.get_study_queue = AsyncMock(return_value=mock_queue)
            response = await client.get(
                f"/api/v1/study/queue/v2?deck_id={deck_id}&word_entry_id={word_entry_id}",
                headers=auth_headers,
            )
        assert response.status_code == 200
        kwargs = mock_instance.get_study_queue.await_args.kwargs
        assert kwargs["word_entry_id"] == word_entry_id
        assert kwargs["deck_id"] == deck_id
