from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.db.models import CardSystemVersion, Deck
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
        assert "Either deck_id or card_type" in message

    @pytest.mark.asyncio
    async def test_400_for_v1_deck(self, client, auth_headers):
        deck_id = uuid4()
        mock_deck = MagicMock(spec=Deck)
        mock_deck.is_active = True
        mock_deck.card_system = CardSystemVersion.V1

        mock_repo = MagicMock()
        mock_repo.get = AsyncMock(return_value=mock_deck)

        with patch("src.api.v1.study_v2.DeckRepository", return_value=mock_repo):
            response = await client.get(
                f"/api/v1/study/queue/v2?deck_id={deck_id}",
                headers=auth_headers,
            )

        assert response.status_code == 400
        body = response.json()
        message = body.get("detail") or body.get("error", {}).get("message", "")
        assert "V2 card system" in message

    @pytest.mark.asyncio
    async def test_403_for_premium_deck_free_user(self, client, auth_headers):
        from fastapi import HTTPException

        deck_id = uuid4()
        mock_deck = MagicMock(spec=Deck)
        mock_deck.is_active = True
        mock_deck.card_system = CardSystemVersion.V2
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
