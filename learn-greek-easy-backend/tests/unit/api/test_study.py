"""Unit tests for study API endpoints.

These tests mock the SM2Service and ReviewRepository to test endpoint logic in isolation.
For full integration tests, see tests/integration/api/test_study.py
"""

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient

from src.core.exceptions import DeckNotFoundException
from src.db.models import CardStatus
from src.schemas.sm2 import CardInitializationResult, StudyQueue, StudyQueueCard


class TestGetStudyStatsUnit:
    """Unit tests for GET /api/v1/study/stats endpoint."""

    @pytest.mark.asyncio
    async def test_get_study_stats_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        response = await client.get("/api/v1/study/stats")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_get_study_stats_returns_correct_structure(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that endpoint returns correct response structure."""
        mock_stats = {
            "by_status": {"new": 10, "learning": 5, "review": 20, "mastered": 15, "due": 8},
            "reviews_today": 12,
            "current_streak": 5,
            "due_today": 8,
        }

        with (
            patch("src.api.v1.study.SM2Service") as mock_service_class,
            patch("src.api.v1.study.ReviewRepository") as mock_repo_class,
        ):
            mock_service = AsyncMock()
            mock_service.get_study_stats.return_value = mock_stats
            mock_service_class.return_value = mock_service

            mock_repo = AsyncMock()
            mock_repo.get_total_reviews.return_value = 150
            mock_repo.get_total_study_time.return_value = 3600
            mock_repo.get_average_quality.return_value = 3.8
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/study/stats", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert "by_status" in data
            assert "reviews_today" in data
            assert "current_streak" in data
            assert "due_today" in data
            assert "total_reviews" in data
            assert "total_study_time" in data
            assert "average_quality" in data
            assert data["total_reviews"] == 150
            assert data["total_study_time"] == 3600
            assert data["average_quality"] == 3.8

    @pytest.mark.asyncio
    async def test_get_study_stats_with_deck_id_filter(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that deck_id filter is passed to service."""
        deck_id = uuid4()
        mock_stats = {
            "by_status": {"new": 5, "learning": 3, "review": 10, "mastered": 7, "due": 4},
            "reviews_today": 5,
            "current_streak": 3,
            "due_today": 4,
        }

        with (
            patch("src.api.v1.study.SM2Service") as mock_service_class,
            patch("src.api.v1.study.ReviewRepository") as mock_repo_class,
        ):
            mock_service = AsyncMock()
            mock_service.get_study_stats.return_value = mock_stats
            mock_service_class.return_value = mock_service

            mock_repo = AsyncMock()
            mock_repo.get_total_reviews.return_value = 50
            mock_repo.get_total_study_time.return_value = 1200
            mock_repo.get_average_quality.return_value = 4.0
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                f"/api/v1/study/stats?deck_id={deck_id}",
                headers=auth_headers,
            )

            assert response.status_code == 200
            mock_service.get_study_stats.assert_called_once()
            call_args = mock_service.get_study_stats.call_args
            assert call_args[0][1] == deck_id  # Second positional arg is deck_id

    @pytest.mark.asyncio
    async def test_get_study_stats_invalid_deck_id_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that invalid deck_id format returns 422."""
        response = await client.get(
            "/api/v1/study/stats?deck_id=invalid-uuid",
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_get_study_stats_calls_repository_methods(
        self, client: AsyncClient, auth_headers: dict, test_user
    ):
        """Test that repository analytics methods are called with correct user_id."""
        mock_stats = {
            "by_status": {"new": 10, "learning": 5, "review": 20, "mastered": 15, "due": 8},
            "reviews_today": 12,
            "current_streak": 5,
            "due_today": 8,
        }

        with (
            patch("src.api.v1.study.SM2Service") as mock_service_class,
            patch("src.api.v1.study.ReviewRepository") as mock_repo_class,
        ):
            mock_service = AsyncMock()
            mock_service.get_study_stats.return_value = mock_stats
            mock_service_class.return_value = mock_service

            mock_repo = AsyncMock()
            mock_repo.get_total_reviews.return_value = 100
            mock_repo.get_total_study_time.return_value = 5000
            mock_repo.get_average_quality.return_value = 4.2
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/study/stats", headers=auth_headers)

            assert response.status_code == 200

            # Verify all repository methods were called with user_id
            mock_repo.get_total_reviews.assert_called_once_with(test_user.id)
            mock_repo.get_total_study_time.assert_called_once_with(test_user.id)
            mock_repo.get_average_quality.assert_called_once_with(test_user.id)

    @pytest.mark.asyncio
    async def test_get_study_stats_empty_stats_returns_zeros(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that empty stats return zero values."""
        mock_stats = {
            "by_status": {"new": 0, "learning": 0, "review": 0, "mastered": 0, "due": 0},
            "reviews_today": 0,
            "current_streak": 0,
            "due_today": 0,
        }

        with (
            patch("src.api.v1.study.SM2Service") as mock_service_class,
            patch("src.api.v1.study.ReviewRepository") as mock_repo_class,
        ):
            mock_service = AsyncMock()
            mock_service.get_study_stats.return_value = mock_stats
            mock_service_class.return_value = mock_service

            mock_repo = AsyncMock()
            mock_repo.get_total_reviews.return_value = 0
            mock_repo.get_total_study_time.return_value = 0
            mock_repo.get_average_quality.return_value = 0.0
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/study/stats", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert data["reviews_today"] == 0
            assert data["current_streak"] == 0
            assert data["due_today"] == 0
            assert data["total_reviews"] == 0
            assert data["total_study_time"] == 0
            assert data["average_quality"] == 0.0


class TestGetStudyQueueUnit:
    """Unit tests for GET /api/v1/study/queue endpoint."""

    @pytest.mark.asyncio
    async def test_get_study_queue_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        response = await client.get("/api/v1/study/queue")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_get_study_queue_returns_correct_structure(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that endpoint returns correct response structure."""
        all_decks_id = UUID("00000000-0000-0000-0000-000000000000")
        card_id = uuid4()

        mock_queue = StudyQueue(
            deck_id=all_decks_id,
            deck_name="All Decks",
            total_due=5,
            total_new=3,
            total_in_queue=8,
            cards=[
                StudyQueueCard(
                    card_id=card_id,
                    front_text="kalimera",
                    back_text="good morning",
                    example_sentence="Kalimera, ti kaneis?",
                    pronunciation="kah-lee-MEH-rah",
                    status=CardStatus.REVIEW,
                    is_new=False,
                    due_date=date.today(),
                    easiness_factor=2.5,
                    interval=6,
                )
            ],
        )

        with patch("src.api.v1.study.SM2Service") as mock_class:
            mock_service = AsyncMock()
            mock_service.get_study_queue.return_value = mock_queue
            mock_class.return_value = mock_service

            response = await client.get("/api/v1/study/queue", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert data["deck_name"] == "All Decks"
            assert data["total_due"] == 5
            assert data["total_new"] == 3
            assert data["total_in_queue"] == 8
            assert "cards" in data
            assert len(data["cards"]) == 1
            assert data["cards"][0]["front_text"] == "kalimera"

    @pytest.mark.asyncio
    async def test_get_study_queue_with_params(self, client: AsyncClient, auth_headers: dict):
        """Test that query parameters are passed to service."""
        all_decks_id = UUID("00000000-0000-0000-0000-000000000000")

        mock_queue = StudyQueue(
            deck_id=all_decks_id,
            deck_name="All Decks",
            total_due=2,
            total_new=1,
            total_in_queue=3,
            cards=[],
        )

        with patch("src.api.v1.study.SM2Service") as mock_class:
            mock_service = AsyncMock()
            mock_service.get_study_queue.return_value = mock_queue
            mock_class.return_value = mock_service

            response = await client.get(
                "/api/v1/study/queue?limit=10&include_new=false&new_cards_limit=5",
                headers=auth_headers,
            )

            assert response.status_code == 200

            # Verify service was called with correct request parameters
            mock_service.get_study_queue.assert_called_once()
            call_args = mock_service.get_study_queue.call_args
            request = call_args[0][1]  # Second positional argument is request
            assert request.limit == 10
            assert request.include_new is False
            assert request.new_cards_limit == 5

    @pytest.mark.asyncio
    async def test_get_study_queue_invalid_limit_too_high_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that limit > 100 returns 422."""
        response = await client.get("/api/v1/study/queue?limit=101", headers=auth_headers)

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_get_study_queue_invalid_limit_zero_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that limit = 0 returns 422."""
        response = await client.get("/api/v1/study/queue?limit=0", headers=auth_headers)

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_get_study_queue_invalid_new_cards_limit_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that new_cards_limit > 50 returns 422."""
        response = await client.get("/api/v1/study/queue?new_cards_limit=51", headers=auth_headers)

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_get_study_queue_empty_returns_empty_list(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that empty queue returns correctly structured empty response."""
        all_decks_id = UUID("00000000-0000-0000-0000-000000000000")

        mock_queue = StudyQueue(
            deck_id=all_decks_id,
            deck_name="All Decks",
            total_due=0,
            total_new=0,
            total_in_queue=0,
            cards=[],
        )

        with patch("src.api.v1.study.SM2Service") as mock_class:
            mock_service = AsyncMock()
            mock_service.get_study_queue.return_value = mock_queue
            mock_class.return_value = mock_service

            response = await client.get("/api/v1/study/queue", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert data["total_due"] == 0
            assert data["total_new"] == 0
            assert data["total_in_queue"] == 0
            assert data["cards"] == []

    @pytest.mark.asyncio
    async def test_get_study_queue_with_early_practice_params(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that early practice parameters are passed to service."""
        all_decks_id = UUID("00000000-0000-0000-0000-000000000000")

        mock_queue = StudyQueue(
            deck_id=all_decks_id,
            deck_name="All Decks",
            total_due=2,
            total_new=1,
            total_early_practice=3,
            total_in_queue=6,
            cards=[],
        )

        with patch("src.api.v1.study.SM2Service") as mock_class:
            mock_service = AsyncMock()
            mock_service.get_study_queue.return_value = mock_queue
            mock_class.return_value = mock_service

            response = await client.get(
                "/api/v1/study/queue?include_early_practice=true&early_practice_limit=15",
                headers=auth_headers,
            )

            assert response.status_code == 200

            # Verify service was called with correct request parameters
            mock_service.get_study_queue.assert_called_once()
            call_args = mock_service.get_study_queue.call_args
            request = call_args[0][1]  # Second positional argument is request
            assert request.include_early_practice is True
            assert request.early_practice_limit == 15

    @pytest.mark.asyncio
    async def test_get_study_queue_early_practice_default_values(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that early practice parameters have correct defaults."""
        all_decks_id = UUID("00000000-0000-0000-0000-000000000000")

        mock_queue = StudyQueue(
            deck_id=all_decks_id,
            deck_name="All Decks",
            total_due=0,
            total_new=0,
            total_early_practice=0,
            total_in_queue=0,
            cards=[],
        )

        with patch("src.api.v1.study.SM2Service") as mock_class:
            mock_service = AsyncMock()
            mock_service.get_study_queue.return_value = mock_queue
            mock_class.return_value = mock_service

            response = await client.get("/api/v1/study/queue", headers=auth_headers)

            assert response.status_code == 200

            # Verify defaults
            mock_service.get_study_queue.assert_called_once()
            call_args = mock_service.get_study_queue.call_args
            request = call_args[0][1]
            assert request.include_early_practice is False  # Default
            assert request.early_practice_limit == 10  # Default

    @pytest.mark.asyncio
    async def test_get_study_queue_invalid_early_practice_limit_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that early_practice_limit > 50 returns 422."""
        response = await client.get(
            "/api/v1/study/queue?early_practice_limit=51",
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"


class TestGetDeckStudyQueueUnit:
    """Unit tests for GET /api/v1/study/queue/{deck_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_deck_study_queue_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        deck_id = uuid4()
        response = await client.get(f"/api/v1/study/queue/{deck_id}")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_get_deck_study_queue_success(self, client: AsyncClient, auth_headers: dict):
        """Test successful deck study queue retrieval."""
        deck_id = uuid4()
        card_id = uuid4()

        mock_queue = StudyQueue(
            deck_id=deck_id,
            deck_name="Greek Basics A1",
            total_due=3,
            total_new=2,
            total_in_queue=5,
            cards=[
                StudyQueueCard(
                    card_id=card_id,
                    front_text="efcharisto",
                    back_text="thank you",
                    example_sentence="Efcharisto poli!",
                    pronunciation="ef-hah-ree-STOH",
                    status=CardStatus.LEARNING,
                    is_new=False,
                    due_date=date.today(),
                    easiness_factor=2.36,
                    interval=3,
                )
            ],
        )

        mock_deck = MagicMock()
        mock_deck.is_premium = False
        mock_deck.is_active = True

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_class:
                mock_service = AsyncMock()
                mock_service.get_study_queue.return_value = mock_queue
                mock_class.return_value = mock_service

                response = await client.get(
                    f"/api/v1/study/queue/{deck_id}",
                    headers=auth_headers,
                )

                assert response.status_code == 200
                data = response.json()
                assert data["deck_id"] == str(deck_id)
                assert data["deck_name"] == "Greek Basics A1"
                assert data["total_due"] == 3
                assert data["total_new"] == 2
                assert len(data["cards"]) == 1

    @pytest.mark.asyncio
    async def test_get_deck_study_queue_not_found_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that non-existent deck returns 404."""
        deck_id = uuid4()

        with patch("src.api.v1.study.SM2Service") as mock_class:
            mock_service = AsyncMock()
            mock_service.get_study_queue.side_effect = DeckNotFoundException(deck_id=str(deck_id))
            mock_class.return_value = mock_service

            response = await client.get(
                f"/api/v1/study/queue/{deck_id}",
                headers=auth_headers,
            )

            assert response.status_code == 404
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_get_deck_study_queue_invalid_uuid_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that invalid deck_id UUID format returns 422."""
        response = await client.get(
            "/api/v1/study/queue/not-a-valid-uuid",
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_get_deck_study_queue_with_params(self, client: AsyncClient, auth_headers: dict):
        """Test that query parameters are passed to service for deck queue."""
        deck_id = uuid4()

        mock_queue = StudyQueue(
            deck_id=deck_id,
            deck_name="Greek Basics",
            total_due=0,
            total_new=0,
            total_in_queue=0,
            cards=[],
        )

        mock_deck = MagicMock()
        mock_deck.is_premium = False
        mock_deck.is_active = True

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_class:
                mock_service = AsyncMock()
                mock_service.get_study_queue.return_value = mock_queue
                mock_class.return_value = mock_service

                response = await client.get(
                    f"/api/v1/study/queue/{deck_id}?limit=15&include_new=true&new_cards_limit=8",
                    headers=auth_headers,
                )

                assert response.status_code == 200

                # Verify service was called with correct parameters
                mock_service.get_study_queue.assert_called_once()
                call_args = mock_service.get_study_queue.call_args
                request = call_args[0][1]
                assert request.deck_id == deck_id
                assert request.limit == 15
                assert request.include_new is True
                assert request.new_cards_limit == 8

    @pytest.mark.asyncio
    async def test_get_deck_study_queue_with_early_practice_params(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that early practice parameters are passed to service for deck queue."""
        deck_id = uuid4()

        mock_queue = StudyQueue(
            deck_id=deck_id,
            deck_name="Greek Basics",
            total_due=2,
            total_new=1,
            total_early_practice=3,
            total_in_queue=6,
            cards=[],
        )

        mock_deck = MagicMock()
        mock_deck.is_premium = False
        mock_deck.is_active = True

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_class:
                mock_service = AsyncMock()
                mock_service.get_study_queue.return_value = mock_queue
                mock_class.return_value = mock_service

                response = await client.get(
                    f"/api/v1/study/queue/{deck_id}?include_early_practice=true&early_practice_limit=20",
                    headers=auth_headers,
                )

                assert response.status_code == 200

                # Verify service was called with correct parameters
                mock_service.get_study_queue.assert_called_once()
                call_args = mock_service.get_study_queue.call_args
                request = call_args[0][1]
                assert request.deck_id == deck_id
                assert request.include_early_practice is True
                assert request.early_practice_limit == 20

    @pytest.mark.asyncio
    async def test_get_deck_study_queue_invalid_early_practice_limit_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that early_practice_limit > 50 returns 422 for deck queue."""
        deck_id = uuid4()
        response = await client.get(
            f"/api/v1/study/queue/{deck_id}?early_practice_limit=51",
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"


class TestInitializeCardsUnit:
    """Unit tests for POST /api/v1/study/initialize endpoint."""

    @pytest.mark.asyncio
    async def test_initialize_cards_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        response = await client.post(
            "/api/v1/study/initialize",
            json={"deck_id": str(uuid4()), "card_ids": [str(uuid4())]},
        )

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_initialize_cards_success(self, client: AsyncClient, auth_headers: dict):
        """Test successful card initialization."""
        deck_id = uuid4()
        card_id_1 = uuid4()
        card_id_2 = uuid4()

        mock_result = CardInitializationResult(
            initialized_count=2,
            already_exists_count=0,
            card_ids=[card_id_1, card_id_2],
        )

        mock_deck = MagicMock()
        mock_deck.is_premium = False

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_class:
                mock_service = AsyncMock()
                mock_service.initialize_cards_for_user.return_value = mock_result
                mock_class.return_value = mock_service

                response = await client.post(
                    "/api/v1/study/initialize",
                    json={
                        "deck_id": str(deck_id),
                        "card_ids": [str(card_id_1), str(card_id_2)],
                    },
                    headers=auth_headers,
                )

                assert response.status_code == 200
                data = response.json()
                assert data["initialized_count"] == 2
                assert data["already_exists_count"] == 0
                assert len(data["card_ids"]) == 2

    @pytest.mark.asyncio
    async def test_initialize_cards_deck_not_found_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that non-existent deck returns 404."""
        deck_id = uuid4()

        with patch("src.api.v1.study.SM2Service") as mock_class:
            mock_service = AsyncMock()
            mock_service.initialize_cards_for_user.side_effect = DeckNotFoundException(
                deck_id=str(deck_id)
            )
            mock_class.return_value = mock_service

            response = await client.post(
                "/api/v1/study/initialize",
                json={"deck_id": str(deck_id), "card_ids": [str(uuid4())]},
                headers=auth_headers,
            )

            assert response.status_code == 404
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_initialize_cards_empty_card_ids_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that empty card_ids returns 422."""
        response = await client.post(
            "/api/v1/study/initialize",
            json={"deck_id": str(uuid4()), "card_ids": []},
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_initialize_cards_too_many_card_ids_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that more than 100 card_ids returns 422."""
        card_ids = [str(uuid4()) for _ in range(101)]

        response = await client.post(
            "/api/v1/study/initialize",
            json={"deck_id": str(uuid4()), "card_ids": card_ids},
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"


class TestInitializeDeckUnit:
    """Unit tests for POST /api/v1/study/initialize/{deck_id} endpoint."""

    @pytest.mark.asyncio
    async def test_initialize_deck_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        deck_id = uuid4()
        response = await client.post(f"/api/v1/study/initialize/{deck_id}")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_initialize_deck_success(self, client: AsyncClient, auth_headers: dict):
        """Test successful deck initialization."""
        deck_id = uuid4()
        card_ids = [uuid4(), uuid4(), uuid4()]

        mock_result = CardInitializationResult(
            initialized_count=3,
            already_exists_count=0,
            card_ids=card_ids,
        )

        with (
            patch("src.api.v1.study.DeckRepository") as mock_deck_repo_class,
            patch("src.api.v1.study.SM2Service") as mock_class,
        ):
            mock_deck_repo = AsyncMock()
            mock_deck = MagicMock()
            mock_deck.is_active = True
            mock_deck.is_premium = False
            mock_deck_repo.get.return_value = mock_deck
            mock_deck_repo_class.return_value = mock_deck_repo

            mock_service = AsyncMock()
            mock_service.initialize_deck_for_user.return_value = mock_result
            mock_class.return_value = mock_service

            response = await client.post(
                f"/api/v1/study/initialize/{deck_id}",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["initialized_count"] == 3
            assert data["already_exists_count"] == 0
            assert len(data["card_ids"]) == 3

    @pytest.mark.asyncio
    async def test_initialize_deck_not_found_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that non-existent deck returns 404."""
        deck_id = uuid4()

        with patch("src.api.v1.study.SM2Service") as mock_class:
            mock_service = AsyncMock()
            mock_service.initialize_deck_for_user.side_effect = DeckNotFoundException(
                deck_id=str(deck_id)
            )
            mock_class.return_value = mock_service

            response = await client.post(
                f"/api/v1/study/initialize/{deck_id}",
                headers=auth_headers,
            )

            assert response.status_code == 404
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_initialize_deck_invalid_uuid_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that invalid deck_id UUID format returns 422."""
        response = await client.post(
            "/api/v1/study/initialize/not-a-valid-uuid",
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_initialize_deck_partial_initialization(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test deck initialization when some cards already exist."""
        deck_id = uuid4()
        new_card_ids = [uuid4(), uuid4()]

        mock_result = CardInitializationResult(
            initialized_count=2,
            already_exists_count=5,
            card_ids=new_card_ids,
        )

        with (
            patch("src.api.v1.study.DeckRepository") as mock_deck_repo_class,
            patch("src.api.v1.study.SM2Service") as mock_class,
        ):
            mock_deck_repo = AsyncMock()
            mock_deck = MagicMock()
            mock_deck.is_active = True
            mock_deck.is_premium = False
            mock_deck_repo.get.return_value = mock_deck
            mock_deck_repo_class.return_value = mock_deck_repo

            mock_service = AsyncMock()
            mock_service.initialize_deck_for_user.return_value = mock_result
            mock_class.return_value = mock_service

            response = await client.post(
                f"/api/v1/study/initialize/{deck_id}",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["initialized_count"] == 2
            assert data["already_exists_count"] == 5
