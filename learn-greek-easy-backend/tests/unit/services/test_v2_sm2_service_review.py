from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.db.models import CardRecord, CardRecordStatistics, CardStatus, CardType
from src.services.v2_sm2_service import V2SM2Service


def _make_mock_stats(status: CardStatus = CardStatus.NEW) -> MagicMock:
    stats = MagicMock(spec=CardRecordStatistics)
    stats.id = uuid4()
    stats.status = status
    stats.easiness_factor = 2.5
    stats.interval = 0
    stats.repetitions = 0
    stats.created_at = None
    return stats


def _make_mock_card_record() -> MagicMock:
    card_record = MagicMock(spec=CardRecord)
    card_record.id = uuid4()
    card_record.deck_id = uuid4()
    card_record.card_type = CardType.MEANING_EL_TO_EN
    return card_record


def _make_sm2_result(new_status: CardStatus = CardStatus.LEARNING) -> MagicMock:
    result = MagicMock()
    result.new_easiness_factor = 2.5
    result.new_interval = 1
    result.new_repetitions = 1
    result.new_status = new_status
    return result


@pytest.mark.unit
@pytest.mark.sm2
class TestV2SM2ServiceProcessReview:
    @pytest.mark.asyncio
    async def test_first_review_creates_stats_and_transitions_to_learning(self, mock_db_session):
        stats = _make_mock_stats(CardStatus.NEW)
        card_record = _make_mock_card_record()
        sm2_result = _make_sm2_result(CardStatus.LEARNING)
        user_id = uuid4()

        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_or_create = AsyncMock(return_value=stats)
        service.stats_repo.update_sm2_data = AsyncMock()
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()

        with (
            patch("src.services.v2_sm2_service.calculate_sm2", return_value=sm2_result),
            patch(
                "src.services.v2_sm2_service.calculate_next_review_date", return_value=date.today()
            ),
            patch("src.services.v2_sm2_service.capture_event") as mock_capture,
        ):

            result = await service.process_review(
                user_id=user_id,
                card_record=card_record,
                quality=4,
                time_taken=10,
            )

        service.stats_repo.get_or_create.assert_called_once_with(user_id, card_record.id)
        service.stats_repo.update_sm2_data.assert_called_once()
        mock_db_session.add.assert_called_once()
        mock_db_session.flush.assert_called_once()
        assert result.previous_status == CardStatus.NEW
        assert result.new_status == CardStatus.LEARNING
        mock_capture.assert_not_called()

    @pytest.mark.asyncio
    async def test_mastery_transition_fires_posthog_event(self, mock_db_session):
        stats = _make_mock_stats(CardStatus.REVIEW)
        card_record = _make_mock_card_record()
        sm2_result = _make_sm2_result(CardStatus.MASTERED)
        user_id = uuid4()
        user_email = "test@example.com"

        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_or_create = AsyncMock(return_value=stats)
        service.stats_repo.update_sm2_data = AsyncMock()
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()

        with (
            patch("src.services.v2_sm2_service.calculate_sm2", return_value=sm2_result),
            patch(
                "src.services.v2_sm2_service.calculate_next_review_date", return_value=date.today()
            ),
            patch("src.services.v2_sm2_service.capture_event") as mock_capture,
        ):

            await service.process_review(
                user_id=user_id,
                card_record=card_record,
                quality=5,
                time_taken=8,
                user_email=user_email,
            )

        mock_capture.assert_called_once()
        call_kwargs = mock_capture.call_args
        assert call_kwargs.kwargs["event"] == "card_mastered_v2"
        props = call_kwargs.kwargs["properties"]
        assert "deck_id" in props
        assert "card_record_id" in props
        assert "card_type" in props
        assert "reviews_to_master" in props
        assert "days_to_master" in props

    @pytest.mark.asyncio
    async def test_mastery_event_not_fired_when_already_mastered(self, mock_db_session):
        stats = _make_mock_stats(CardStatus.MASTERED)
        card_record = _make_mock_card_record()
        sm2_result = _make_sm2_result(CardStatus.MASTERED)
        user_id = uuid4()

        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_or_create = AsyncMock(return_value=stats)
        service.stats_repo.update_sm2_data = AsyncMock()
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()

        with (
            patch("src.services.v2_sm2_service.calculate_sm2", return_value=sm2_result),
            patch(
                "src.services.v2_sm2_service.calculate_next_review_date", return_value=date.today()
            ),
            patch("src.services.v2_sm2_service.capture_event") as mock_capture,
        ):

            await service.process_review(
                user_id=user_id,
                card_record=card_record,
                quality=5,
                time_taken=5,
            )

        mock_capture.assert_not_called()

    @pytest.mark.asyncio
    async def test_quality_0_drops_from_mastered_to_learning(self, mock_db_session):
        stats = _make_mock_stats(CardStatus.MASTERED)
        card_record = _make_mock_card_record()
        sm2_result = _make_sm2_result(CardStatus.LEARNING)
        user_id = uuid4()

        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_or_create = AsyncMock(return_value=stats)
        service.stats_repo.update_sm2_data = AsyncMock()
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()

        with (
            patch("src.services.v2_sm2_service.calculate_sm2", return_value=sm2_result),
            patch(
                "src.services.v2_sm2_service.calculate_next_review_date", return_value=date.today()
            ),
            patch("src.services.v2_sm2_service.capture_event"),
        ):

            result = await service.process_review(
                user_id=user_id,
                card_record=card_record,
                quality=0,
                time_taken=30,
            )

        assert result.new_status == CardStatus.LEARNING
        assert result.previous_status == CardStatus.MASTERED

    @pytest.mark.asyncio
    async def test_review_record_created_with_correct_fields(self, mock_db_session):
        stats = _make_mock_stats(CardStatus.LEARNING)
        card_record = _make_mock_card_record()
        sm2_result = _make_sm2_result(CardStatus.LEARNING)
        user_id = uuid4()

        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_or_create = AsyncMock(return_value=stats)
        service.stats_repo.update_sm2_data = AsyncMock()
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()

        with (
            patch("src.services.v2_sm2_service.calculate_sm2", return_value=sm2_result),
            patch(
                "src.services.v2_sm2_service.calculate_next_review_date", return_value=date.today()
            ),
            patch("src.services.v2_sm2_service.capture_event"),
        ):

            await service.process_review(
                user_id=user_id,
                card_record=card_record,
                quality=3,
                time_taken=15,
            )

        mock_db_session.add.assert_called_once()
        added_review = mock_db_session.add.call_args[0][0]
        assert added_review.user_id == user_id
        assert added_review.card_record_id == card_record.id
        assert added_review.quality == 3
        assert added_review.time_taken == 15
        assert added_review.reviewed_at is not None

    @pytest.mark.asyncio
    async def test_user_email_passed_to_posthog(self, mock_db_session):
        stats = _make_mock_stats(CardStatus.REVIEW)
        card_record = _make_mock_card_record()
        sm2_result = _make_sm2_result(CardStatus.MASTERED)
        user_id = uuid4()
        user_email = "user@example.com"

        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_or_create = AsyncMock(return_value=stats)
        service.stats_repo.update_sm2_data = AsyncMock()
        mock_db_session.add = MagicMock()
        mock_db_session.flush = AsyncMock()

        with (
            patch("src.services.v2_sm2_service.calculate_sm2", return_value=sm2_result),
            patch(
                "src.services.v2_sm2_service.calculate_next_review_date", return_value=date.today()
            ),
            patch("src.services.v2_sm2_service.capture_event") as mock_capture,
        ):

            await service.process_review(
                user_id=user_id,
                card_record=card_record,
                quality=5,
                time_taken=6,
                user_email=user_email,
            )

        mock_capture.assert_called_once()
        assert mock_capture.call_args.kwargs["user_email"] == user_email


@pytest.mark.unit
@pytest.mark.sm2
class TestV2SM2ServiceGetReviewMessage:
    def test_get_review_message_newly_mastered(self):
        service = V2SM2Service.__new__(V2SM2Service)
        result = service._get_review_message(
            quality=5, is_first_review=False, was_mastered=False, is_now_mastered=True
        )
        assert result == "Congratulations! Card mastered!"

    def test_get_review_message_lost_mastery(self):
        service = V2SM2Service.__new__(V2SM2Service)
        result = service._get_review_message(
            quality=2, is_first_review=False, was_mastered=True, is_now_mastered=False
        )
        assert result == "Card needs more practice."

    def test_get_review_message_perfect(self):
        service = V2SM2Service.__new__(V2SM2Service)
        result = service._get_review_message(
            quality=5, is_first_review=False, was_mastered=False, is_now_mastered=False
        )
        assert result == "Perfect!"

    def test_get_review_message_first_review_good(self):
        service = V2SM2Service.__new__(V2SM2Service)
        result = service._get_review_message(
            quality=3, is_first_review=True, was_mastered=False, is_now_mastered=False
        )
        assert result == "Good start!"

    def test_get_review_message_none(self):
        service = V2SM2Service.__new__(V2SM2Service)
        result = service._get_review_message(
            quality=3, is_first_review=False, was_mastered=False, is_now_mastered=False
        )
        assert result is None
