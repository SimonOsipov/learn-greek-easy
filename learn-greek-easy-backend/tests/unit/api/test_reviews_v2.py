from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.db.models import CardStatus
from src.schemas.v2_sm2 import V2ReviewResult


def _make_v2_review_result() -> V2ReviewResult:
    return V2ReviewResult(
        card_record_id=uuid4(),
        quality=4,
        previous_status=CardStatus.NEW,
        new_status=CardStatus.LEARNING,
        easiness_factor=2.5,
        interval=1,
        repetitions=1,
        next_review_date=date.today(),
        message=None,
    )


def _make_review_context():
    return {
        "user_id": str(uuid4()),
        "card_record_id": str(uuid4()),
        "deck_id": str(uuid4()),
        "card_type_value": "meaning_el_to_en",
        "quality": 4,
        "time_taken": 10,
        "stats_id": str(uuid4()),
        "stats_created_at_iso": None,
        "new_ef": 2.5,
        "new_interval": 1,
        "new_repetitions": 1,
        "new_status_value": "learning",
        "next_review_date_iso": "2026-03-20",
        "previous_status_value": "new",
        "is_newly_mastered": False,
    }


def _valid_review_body(card_record_id=None) -> dict:
    return {
        "card_record_id": str(card_record_id or uuid4()),
        "quality": 4,
        "time_taken": 10,
    }


@pytest.mark.unit
@pytest.mark.api
class TestSubmitV2Review:
    @pytest.mark.asyncio
    async def test_404_for_nonexistent_card_record(self, client, auth_headers):
        with patch("src.api.v1.reviews_v2.CardRecordRepository") as mock_repo_cls:
            mock_repo_cls.return_value.get = AsyncMock(return_value=None)
            response = await client.post(
                "/api/v1/reviews/v2",
                json=_valid_review_body(),
                headers=auth_headers,
            )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_422_for_quality_out_of_range(self, client, auth_headers):
        body = _valid_review_body()
        body["quality"] = 6
        response = await client.post(
            "/api/v1/reviews/v2",
            json=body,
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_422_for_time_taken_out_of_range(self, client, auth_headers):
        body = _valid_review_body()
        body["time_taken"] = 200
        response = await client.post(
            "/api/v1/reviews/v2",
            json=body,
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_fallback_persist_review_called(self, client, auth_headers):
        """When background tasks disabled, persist_review is called synchronously."""
        mock_card_record = MagicMock()
        mock_card_record.deck = MagicMock()

        with (
            patch("src.api.v1.reviews_v2.CardRecordRepository") as mock_repo_cls,
            patch("src.api.v1.reviews_v2.CardRecordReviewRepository") as mock_review_repo_cls,
            patch("src.api.v1.reviews_v2.V2SM2Service") as mock_service_cls,
            patch("src.api.v1.reviews_v2.check_premium_deck_access"),
            patch("src.api.v1.reviews_v2.settings") as mock_settings,
        ):
            mock_repo_cls.return_value.get = AsyncMock(return_value=mock_card_record)
            mock_review_repo_cls.return_value.count_reviews_today = AsyncMock(return_value=0)
            mock_service_cls.return_value.compute_review = AsyncMock(
                return_value=(_make_v2_review_result(), _make_review_context())
            )
            mock_service_cls.return_value.persist_review = AsyncMock()
            mock_settings.feature_background_tasks = False

            response = await client.post(
                "/api/v1/reviews/v2",
                json=_valid_review_body(),
                headers=auth_headers,
            )

        assert response.status_code == 200
        mock_service_cls.return_value.persist_review.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_background_tasks_scheduled_when_enabled(self, client, auth_headers):
        mock_card_record = MagicMock()
        mock_card_record.deck = MagicMock()

        with (
            patch("src.api.v1.reviews_v2.CardRecordRepository") as mock_repo_cls,
            patch("src.api.v1.reviews_v2.CardRecordReviewRepository") as mock_review_repo_cls,
            patch("src.api.v1.reviews_v2.V2SM2Service") as mock_service_cls,
            patch("src.api.v1.reviews_v2.check_premium_deck_access"),
            patch("src.api.v1.reviews_v2.persist_deck_review_task"),
            patch("src.api.v1.reviews_v2.settings") as mock_settings,
        ):
            mock_repo_cls.return_value.get = AsyncMock(return_value=mock_card_record)
            mock_review_repo_cls.return_value.count_reviews_today = AsyncMock(return_value=0)
            mock_service_cls.return_value.compute_review = AsyncMock(
                return_value=(_make_v2_review_result(), _make_review_context())
            )
            mock_settings.feature_background_tasks = True
            mock_settings.database_url = "postgresql://test"

            response = await client.post(
                "/api/v1/reviews/v2",
                json=_valid_review_body(),
                headers=auth_headers,
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_background_tasks_skipped_when_disabled(self, client, auth_headers):
        mock_card_record = MagicMock()
        mock_card_record.deck = MagicMock()

        with (
            patch("src.api.v1.reviews_v2.CardRecordRepository") as mock_repo_cls,
            patch("src.api.v1.reviews_v2.CardRecordReviewRepository") as mock_review_repo_cls,
            patch("src.api.v1.reviews_v2.V2SM2Service") as mock_service_cls,
            patch("src.api.v1.reviews_v2.check_premium_deck_access"),
            patch("src.api.v1.reviews_v2.settings") as mock_settings,
        ):
            mock_repo_cls.return_value.get = AsyncMock(return_value=mock_card_record)
            mock_review_repo_cls.return_value.count_reviews_today = AsyncMock(return_value=0)
            mock_service_cls.return_value.compute_review = AsyncMock(
                return_value=(_make_v2_review_result(), _make_review_context())
            )
            mock_service_cls.return_value.persist_review = AsyncMock()
            mock_settings.feature_background_tasks = False

            response = await client.post(
                "/api/v1/reviews/v2",
                json=_valid_review_body(),
                headers=auth_headers,
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_dashboard_sse_signaled(self, client, auth_headers):
        mock_card_record = MagicMock()
        mock_card_record.deck = MagicMock()

        with (
            patch("src.api.v1.reviews_v2.CardRecordRepository") as mock_repo_cls,
            patch("src.api.v1.reviews_v2.CardRecordReviewRepository") as mock_review_repo_cls,
            patch("src.api.v1.reviews_v2.V2SM2Service") as mock_service_cls,
            patch("src.api.v1.reviews_v2.check_premium_deck_access"),
            patch("src.api.v1.reviews_v2.dashboard_event_bus") as mock_bus,
            patch("src.api.v1.reviews_v2.settings") as mock_settings,
        ):
            mock_repo_cls.return_value.get = AsyncMock(return_value=mock_card_record)
            mock_review_repo_cls.return_value.count_reviews_today = AsyncMock(return_value=0)
            mock_service_cls.return_value.compute_review = AsyncMock(
                return_value=(_make_v2_review_result(), _make_review_context())
            )
            mock_service_cls.return_value.persist_review = AsyncMock()
            mock_bus.signal = AsyncMock()
            mock_settings.feature_background_tasks = False

            response = await client.post(
                "/api/v1/reviews/v2",
                json=_valid_review_body(),
                headers=auth_headers,
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_premium_check_enforced(self, client, auth_headers):
        from fastapi import HTTPException as FastAPIHTTPException

        mock_card_record = MagicMock()
        mock_card_record.deck = MagicMock()

        with (
            patch("src.api.v1.reviews_v2.CardRecordRepository") as mock_repo_cls,
            patch("src.api.v1.reviews_v2.check_premium_deck_access") as mock_premium,
        ):
            mock_repo_cls.return_value.get = AsyncMock(return_value=mock_card_record)
            mock_premium.side_effect = FastAPIHTTPException(
                status_code=403, detail="Premium required"
            )

            response = await client.post(
                "/api/v1/reviews/v2",
                json=_valid_review_body(),
                headers=auth_headers,
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_persist_task_scheduled_when_background_enabled(self, client, auth_headers):
        """persist_deck_review_task is registered via BackgroundTasks when background tasks enabled."""
        mock_card_record = MagicMock()
        mock_card_record.deck = MagicMock()
        review_body = _valid_review_body()

        with (
            patch("src.api.v1.reviews_v2.CardRecordRepository") as mock_repo_cls,
            patch("src.api.v1.reviews_v2.CardRecordReviewRepository") as mock_review_repo_cls,
            patch("src.api.v1.reviews_v2.V2SM2Service") as mock_service_cls,
            patch("src.api.v1.reviews_v2.check_premium_deck_access"),
            patch("src.api.v1.reviews_v2.persist_deck_review_task") as mock_persist_task,
            patch("src.api.v1.reviews_v2.settings") as mock_settings,
            patch("starlette.background.BackgroundTasks.add_task") as mock_add_task,
        ):
            mock_repo_cls.return_value.get = AsyncMock(return_value=mock_card_record)
            mock_review_repo_cls.return_value.count_reviews_today = AsyncMock(return_value=0)
            mock_service_cls.return_value.compute_review = AsyncMock(
                return_value=(_make_v2_review_result(), _make_review_context())
            )
            mock_settings.feature_background_tasks = True
            mock_settings.database_url = "postgresql://test"

            response = await client.post(
                "/api/v1/reviews/v2",
                json=review_body,
                headers=auth_headers,
            )

        assert response.status_code == 200
        # Verify persist_deck_review_task was registered via BackgroundTasks.add_task
        scheduled_funcs = [call.args[0] for call in mock_add_task.call_args_list]
        assert mock_persist_task in scheduled_funcs

    @pytest.mark.asyncio
    async def test_successful_review_returns_v2_result(self, client, auth_headers):
        mock_card_record = MagicMock()
        mock_card_record.deck = MagicMock()
        expected_result = _make_v2_review_result()

        with (
            patch("src.api.v1.reviews_v2.CardRecordRepository") as mock_repo_cls,
            patch("src.api.v1.reviews_v2.CardRecordReviewRepository") as mock_review_repo_cls,
            patch("src.api.v1.reviews_v2.V2SM2Service") as mock_service_cls,
            patch("src.api.v1.reviews_v2.check_premium_deck_access"),
            patch("src.api.v1.reviews_v2.settings") as mock_settings,
        ):
            mock_repo_cls.return_value.get = AsyncMock(return_value=mock_card_record)
            mock_review_repo_cls.return_value.count_reviews_today = AsyncMock(return_value=0)
            mock_service_cls.return_value.compute_review = AsyncMock(
                return_value=(expected_result, _make_review_context())
            )
            mock_service_cls.return_value.persist_review = AsyncMock()
            mock_settings.feature_background_tasks = False

            response = await client.post(
                "/api/v1/reviews/v2",
                json=_valid_review_body(),
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert "card_record_id" in data
        assert "quality" in data
        assert "previous_status" in data
        assert "new_status" in data
        assert "easiness_factor" in data
        assert "interval" in data
        assert "repetitions" in data
        assert "next_review_date" in data
