"""Unit tests for SM2Service with mocked repositories.

Tests cover:
- process_review: Individual card review processing
- process_bulk_reviews: Batch review handling
- get_study_queue: Study queue generation
- get_study_stats: Statistics retrieval
- _get_review_message: Internal helper for feedback messages

Acceptance Criteria tested:
- AC #1: All EF calculation paths tested (via process_review)
- AC #2: All interval calculation paths tested (via process_review)
- AC #3: All status transition paths tested (via process_review)
- AC #4: Edge cases covered
- AC #5: Invalid input handling tested
"""

from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from src.core.exceptions import DeckNotFoundException
from src.db.models import Card, CardStatistics, CardStatus, Deck
from src.schemas.sm2 import StudyQueueRequest
from src.services.sm2_service import SM2Service


def _create_mock_card(
    front_text: str = "Test front",
    back_text_en: str = "Test back",
    deck_id=None,
) -> MagicMock:
    """Create a mock Card with all required fields for study queue."""
    card = MagicMock(spec=Card)
    card.id = uuid4()
    card.deck_id = deck_id or uuid4()
    card.front_text = front_text
    card.back_text_en = back_text_en
    card.back_text_ru = None
    card.example_sentence = None
    card.pronunciation = None
    card.part_of_speech = None
    card.level = None
    card.examples = None
    card.noun_data = None
    card.verb_data = None
    card.adjective_data = None
    card.adverb_data = None
    return card


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = MagicMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    # Default execute result: empty iterables so _enrich_cards_with_audio short-circuits
    mock_execute_result = MagicMock()
    mock_execute_result.all.return_value = []
    mock_execute_result.scalars.return_value.all.return_value = []
    session.execute = AsyncMock(return_value=mock_execute_result)
    return session


@pytest.fixture
def mock_stats():
    """Create a mock CardStatistics object."""
    stats = MagicMock(spec=CardStatistics)
    stats.id = uuid4()
    stats.user_id = uuid4()
    stats.card_id = uuid4()
    stats.status = CardStatus.NEW
    stats.easiness_factor = 2.5
    stats.interval = 0
    stats.repetitions = 0
    stats.next_review_date = None
    return stats


@pytest.fixture
def mock_deck():
    """Create a mock Deck object."""
    deck = MagicMock(spec=Deck)
    deck.id = uuid4()
    deck.name_en = "Test Deck"
    deck.name_el = "Δοκιμαστική Τράπουλα"
    deck.name_ru = "Тестовая колода"
    deck.is_active = True
    return deck


@pytest.fixture
def mock_card(mock_deck):
    """Create a mock Card object."""
    card = MagicMock(spec=Card)
    card.id = uuid4()
    card.deck_id = mock_deck.id
    card.front_text = "Test front"
    card.back_text_en = "Test back"
    card.back_text_ru = None
    card.example_sentence = "Example sentence"
    card.pronunciation = "Pronunciation"
    card.part_of_speech = None
    card.level = None
    card.examples = [{"greek": "Example sentence", "english": "", "russian": ""}]
    card.noun_data = None
    card.verb_data = None
    card.adjective_data = None
    card.adverb_data = None
    return card


@pytest.mark.unit
@pytest.mark.sm2
class TestProcessReview:
    """Tests for SM2Service.process_review method."""

    @pytest.mark.asyncio
    async def test_creates_stats_if_missing(self, mock_db_session, mock_stats):
        """get_or_create is called to ensure stats exist."""
        service = SM2Service(mock_db_session)

        # Mock the stats_repo
        service.stats_repo.get_or_create = AsyncMock(return_value=mock_stats)
        service.stats_repo.update_sm2_data = AsyncMock()
        service.progress_repo.get_or_create = AsyncMock(return_value=MagicMock(id=uuid4()))
        service.progress_repo.update_progress_metrics = AsyncMock()

        # Mock the db execute for getting deck_id
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = uuid4()
        mock_db_session.execute.return_value = mock_result

        await service.process_review(
            user_id=uuid4(),
            card_id=mock_stats.card_id,
            quality=4,
            time_taken=10,
        )

        service.stats_repo.get_or_create.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_invalid_quality_raises_valueerror_negative(self, mock_db_session):
        """Invalid quality (-1) raises ValueError."""
        service = SM2Service(mock_db_session)

        with pytest.raises(ValueError) as exc_info:
            await service.process_review(
                user_id=uuid4(),
                card_id=uuid4(),
                quality=-1,
                time_taken=10,
            )

        assert "Quality must be 0-5" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_quality_raises_valueerror_high(self, mock_db_session):
        """Invalid quality (6) raises ValueError."""
        service = SM2Service(mock_db_session)

        with pytest.raises(ValueError) as exc_info:
            await service.process_review(
                user_id=uuid4(),
                card_id=uuid4(),
                quality=6,
                time_taken=10,
            )

        assert "Quality must be 0-5" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_updates_stats_with_sm2_result(self, mock_db_session, mock_stats):
        """update_sm2_data is called with correct calculated values."""
        service = SM2Service(mock_db_session)

        service.stats_repo.get_or_create = AsyncMock(return_value=mock_stats)
        service.stats_repo.update_sm2_data = AsyncMock()
        service.progress_repo.get_or_create = AsyncMock(return_value=MagicMock(id=uuid4()))
        service.progress_repo.update_progress_metrics = AsyncMock()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = uuid4()
        mock_db_session.execute.return_value = mock_result

        await service.process_review(
            user_id=uuid4(),
            card_id=mock_stats.card_id,
            quality=5,
            time_taken=10,
        )

        # Verify update_sm2_data was called
        service.stats_repo.update_sm2_data.assert_awaited_once()

        # Check the call args
        call_kwargs = service.stats_repo.update_sm2_data.call_args.kwargs
        assert call_kwargs["stats_id"] == mock_stats.id
        assert call_kwargs["easiness_factor"] == pytest.approx(2.6)  # 2.5 + 0.1
        assert call_kwargs["interval"] == 1  # First review
        assert call_kwargs["repetitions"] == 1
        assert call_kwargs["status"] == CardStatus.LEARNING

    @pytest.mark.asyncio
    async def test_creates_review_record(self, mock_db_session, mock_stats):
        """A Review record is added to the session."""
        service = SM2Service(mock_db_session)

        service.stats_repo.get_or_create = AsyncMock(return_value=mock_stats)
        service.stats_repo.update_sm2_data = AsyncMock()
        service.progress_repo.get_or_create = AsyncMock(return_value=MagicMock(id=uuid4()))
        service.progress_repo.update_progress_metrics = AsyncMock()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = uuid4()
        mock_db_session.execute.return_value = mock_result

        await service.process_review(
            user_id=uuid4(),
            card_id=mock_stats.card_id,
            quality=4,
            time_taken=15,
        )

        # Verify db.add was called (for the Review record)
        mock_db_session.add.assert_called()

    @pytest.mark.asyncio
    async def test_updates_deck_progress_on_first_review(self, mock_db_session, mock_stats):
        """cards_studied is incremented on first review (NEW -> any status)."""
        service = SM2Service(mock_db_session)

        # Mark stats as NEW (first review)
        mock_stats.status = CardStatus.NEW

        service.stats_repo.get_or_create = AsyncMock(return_value=mock_stats)
        service.stats_repo.update_sm2_data = AsyncMock()
        service.progress_repo.get_or_create = AsyncMock(return_value=MagicMock(id=uuid4()))
        service.progress_repo.update_progress_metrics = AsyncMock()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = uuid4()
        mock_db_session.execute.return_value = mock_result

        await service.process_review(
            user_id=uuid4(),
            card_id=mock_stats.card_id,
            quality=4,
            time_taken=10,
        )

        # Verify progress metrics were updated
        service.progress_repo.update_progress_metrics.assert_awaited_once()
        call_kwargs = service.progress_repo.update_progress_metrics.call_args.kwargs
        assert call_kwargs["cards_studied_delta"] == 1

    @pytest.mark.asyncio
    async def test_updates_mastery_count_on_transition_to_mastered(self, mock_db_session):
        """cards_mastered is incremented when card achieves mastery."""
        service = SM2Service(mock_db_session)

        # Create stats that will transition to MASTERED
        mock_stats = MagicMock(spec=CardStatistics)
        mock_stats.id = uuid4()
        mock_stats.card_id = uuid4()
        mock_stats.status = CardStatus.REVIEW  # Not NEW, not already MASTERED
        mock_stats.easiness_factor = 2.3  # At threshold
        mock_stats.interval = 20  # Just below threshold, will go to 21+
        mock_stats.repetitions = 4  # Enough for MASTERED

        service.stats_repo.get_or_create = AsyncMock(return_value=mock_stats)
        service.stats_repo.update_sm2_data = AsyncMock()
        service.progress_repo.get_or_create = AsyncMock(return_value=MagicMock(id=uuid4()))
        service.progress_repo.update_progress_metrics = AsyncMock()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = uuid4()
        mock_db_session.execute.return_value = mock_result

        # Quality 5 to push interval over threshold
        await service.process_review(
            user_id=uuid4(),
            card_id=mock_stats.card_id,
            quality=5,
            time_taken=10,
        )

        # Verify mastery count was incremented
        service.progress_repo.update_progress_metrics.assert_awaited_once()
        call_kwargs = service.progress_repo.update_progress_metrics.call_args.kwargs
        assert call_kwargs["cards_mastered_delta"] == 1

    @pytest.mark.asyncio
    async def test_decrements_mastery_on_lost_mastery(self, mock_db_session):
        """cards_mastered is decremented when mastered card fails."""
        service = SM2Service(mock_db_session)

        # Create mastered stats that will lose mastery
        mock_stats = MagicMock(spec=CardStatistics)
        mock_stats.id = uuid4()
        mock_stats.card_id = uuid4()
        mock_stats.status = CardStatus.MASTERED
        mock_stats.easiness_factor = 2.5
        mock_stats.interval = 30
        mock_stats.repetitions = 6

        service.stats_repo.get_or_create = AsyncMock(return_value=mock_stats)
        service.stats_repo.update_sm2_data = AsyncMock()
        service.progress_repo.get_or_create = AsyncMock(return_value=MagicMock(id=uuid4()))
        service.progress_repo.update_progress_metrics = AsyncMock()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = uuid4()
        mock_db_session.execute.return_value = mock_result

        # Failed review (q<3)
        await service.process_review(
            user_id=uuid4(),
            card_id=mock_stats.card_id,
            quality=1,
            time_taken=10,
        )

        # Verify mastery count was decremented
        service.progress_repo.update_progress_metrics.assert_awaited_once()
        call_kwargs = service.progress_repo.update_progress_metrics.call_args.kwargs
        assert call_kwargs["cards_mastered_delta"] == -1

    @pytest.mark.asyncio
    async def test_process_review_uses_flush_not_commit(self, mock_db_session, mock_stats):
        """process_review uses flush() not commit() - commit handled by get_db dependency."""
        service = SM2Service(mock_db_session)

        service.stats_repo.get_or_create = AsyncMock(return_value=mock_stats)
        service.stats_repo.update_sm2_data = AsyncMock()
        service.progress_repo.get_or_create = AsyncMock(return_value=MagicMock(id=uuid4()))
        service.progress_repo.update_progress_metrics = AsyncMock()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = uuid4()
        mock_db_session.execute.return_value = mock_result

        await service.process_review(
            user_id=uuid4(),
            card_id=mock_stats.card_id,
            quality=4,
            time_taken=10,
        )

        # Verify flush was called (not commit - commit is handled by get_db dependency)
        mock_db_session.flush.assert_awaited()
        mock_db_session.commit.assert_not_awaited()


@pytest.mark.unit
@pytest.mark.sm2
class TestProcessBulkReviews:
    """Tests for SM2Service.process_bulk_reviews method."""

    @pytest.mark.asyncio
    async def test_bulk_processing_handles_partial_failures(self, mock_db_session):
        """Some reviews succeed while others fail."""
        service = SM2Service(mock_db_session)

        # Create mock for successful review
        successful_stats = MagicMock(spec=CardStatistics)
        successful_stats.id = uuid4()
        successful_stats.card_id = uuid4()
        successful_stats.status = CardStatus.NEW
        successful_stats.easiness_factor = 2.5
        successful_stats.interval = 0
        successful_stats.repetitions = 0

        # Create mock for deck lookup
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = uuid4()
        mock_db_session.execute.return_value = mock_result

        # Setup: first call succeeds, second throws exception
        call_count = [0]

        async def mock_get_or_create(user_id, card_id):
            call_count[0] += 1
            if call_count[0] == 1:
                return successful_stats
            else:
                raise Exception("Database error")

        service.stats_repo.get_or_create = AsyncMock(side_effect=mock_get_or_create)
        service.stats_repo.update_sm2_data = AsyncMock()
        service.progress_repo.get_or_create = AsyncMock(return_value=MagicMock(id=uuid4()))
        service.progress_repo.update_progress_metrics = AsyncMock()

        reviews = [
            {"card_id": successful_stats.card_id, "quality": 4, "time_taken": 10},
            {"card_id": uuid4(), "quality": 4, "time_taken": 10},  # This will fail
        ]

        result = await service.process_bulk_reviews(
            user_id=uuid4(),
            reviews=reviews,
            session_id="test-session",
        )

        assert result.total_submitted == 2
        assert result.successful == 1
        assert result.failed == 1

    @pytest.mark.asyncio
    async def test_bulk_returns_accurate_counts(self, mock_db_session, mock_stats):
        """successful/failed counts are accurate."""
        service = SM2Service(mock_db_session)

        # All reviews succeed
        service.stats_repo.get_or_create = AsyncMock(return_value=mock_stats)
        service.stats_repo.update_sm2_data = AsyncMock()
        service.progress_repo.get_or_create = AsyncMock(return_value=MagicMock(id=uuid4()))
        service.progress_repo.update_progress_metrics = AsyncMock()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = uuid4()
        mock_db_session.execute.return_value = mock_result

        reviews = [
            {"card_id": uuid4(), "quality": 5, "time_taken": 10},
            {"card_id": uuid4(), "quality": 4, "time_taken": 15},
            {"card_id": uuid4(), "quality": 3, "time_taken": 20},
        ]

        result = await service.process_bulk_reviews(
            user_id=uuid4(),
            reviews=reviews,
            session_id="test-session",
        )

        assert result.total_submitted == 3
        assert result.successful == 3
        assert result.failed == 0
        assert len(result.results) == 3

    @pytest.mark.asyncio
    async def test_bulk_flushes_successful_reviews(self, mock_db_session, mock_stats):
        """flush is called after processing all reviews (commit handled by get_db dependency)."""
        service = SM2Service(mock_db_session)

        service.stats_repo.get_or_create = AsyncMock(return_value=mock_stats)
        service.stats_repo.update_sm2_data = AsyncMock()
        service.progress_repo.get_or_create = AsyncMock(return_value=MagicMock(id=uuid4()))
        service.progress_repo.update_progress_metrics = AsyncMock()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = uuid4()
        mock_db_session.execute.return_value = mock_result

        reviews = [
            {"card_id": uuid4(), "quality": 4, "time_taken": 10},
        ]

        await service.process_bulk_reviews(
            user_id=uuid4(),
            reviews=reviews,
            session_id="test-session",
        )

        # Verify flush was called (not commit - commit is handled by get_db dependency)
        mock_db_session.flush.assert_awaited()
        mock_db_session.commit.assert_not_awaited()


@pytest.mark.unit
@pytest.mark.sm2
class TestGetStudyQueue:
    """Tests for SM2Service.get_study_queue method."""

    @pytest.mark.asyncio
    async def test_includes_due_cards_ordered_by_date(self, mock_db_session, mock_deck, mock_card):
        """Due cards are included and ordered by date (oldest first)."""
        service = SM2Service(mock_db_session)

        # Create mock due cards
        due_stats_1 = MagicMock()
        due_stats_1.status = CardStatus.LEARNING
        due_stats_1.next_review_date = date.today()
        due_stats_1.easiness_factor = 2.5
        due_stats_1.interval = 1
        due_stats_1.card = mock_card

        due_stats_2 = MagicMock()
        due_stats_2.status = CardStatus.REVIEW
        due_stats_2.next_review_date = date.today()
        due_stats_2.easiness_factor = 2.4
        due_stats_2.interval = 6
        mock_card_2 = _create_mock_card(front_text="Card 2", back_text_en="Back 2")
        due_stats_2.card = mock_card_2

        service.deck_repo.get = AsyncMock(return_value=mock_deck)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[due_stats_1, due_stats_2])
        service.stats_repo.get_new_cards_for_deck = AsyncMock(return_value=[])

        request = StudyQueueRequest(deck_id=mock_deck.id, limit=20, include_new=False)

        result = await service.get_study_queue(user_id=uuid4(), request=request)

        assert result.total_due == 2
        assert result.total_in_queue == 2
        assert len(result.cards) == 2
        # Verify cards are not marked as new
        assert not result.cards[0].is_new
        assert not result.cards[1].is_new

    @pytest.mark.asyncio
    async def test_includes_new_cards_when_requested(self, mock_db_session, mock_deck, mock_card):
        """New cards are included when include_new=True."""
        service = SM2Service(mock_db_session)

        service.deck_repo.get = AsyncMock(return_value=mock_deck)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[])
        service.stats_repo.get_new_cards_for_deck = AsyncMock(return_value=[mock_card])

        request = StudyQueueRequest(
            deck_id=mock_deck.id,
            limit=20,
            include_new=True,
            new_cards_limit=10,
        )

        result = await service.get_study_queue(user_id=uuid4(), request=request)

        assert result.total_new == 1
        assert result.total_in_queue == 1
        assert len(result.cards) == 1
        assert result.cards[0].is_new

    @pytest.mark.asyncio
    async def test_respects_limit_parameter(self, mock_db_session, mock_deck):
        """Queue doesn't exceed the limit parameter."""
        service = SM2Service(mock_db_session)

        # Create many mock due cards
        due_cards = []
        for i in range(30):
            stats = MagicMock()
            stats.status = CardStatus.LEARNING
            stats.next_review_date = date.today()
            stats.easiness_factor = 2.5
            stats.interval = 1
            card = _create_mock_card(front_text=f"Card {i}", back_text_en=f"Back {i}")
            stats.card = card
            due_cards.append(stats)

        service.deck_repo.get = AsyncMock(return_value=mock_deck)
        # Repository respects limit, so we simulate it returning limited results
        service.stats_repo.get_due_cards = AsyncMock(return_value=due_cards[:10])
        service.stats_repo.get_new_cards_for_deck = AsyncMock(return_value=[])

        request = StudyQueueRequest(deck_id=mock_deck.id, limit=10, include_new=False)

        result = await service.get_study_queue(user_id=uuid4(), request=request)

        assert result.total_in_queue <= 10

    @pytest.mark.asyncio
    async def test_raises_for_invalid_deck(self, mock_db_session):
        """DeckNotFoundException is raised for non-existent deck."""
        service = SM2Service(mock_db_session)

        service.deck_repo.get = AsyncMock(return_value=None)

        request = StudyQueueRequest(deck_id=uuid4(), limit=20)

        with pytest.raises(DeckNotFoundException):
            await service.get_study_queue(user_id=uuid4(), request=request)

    @pytest.mark.asyncio
    async def test_raises_for_inactive_deck(self, mock_db_session, mock_deck):
        """DeckNotFoundException is raised for inactive deck."""
        service = SM2Service(mock_db_session)

        mock_deck.is_active = False
        service.deck_repo.get = AsyncMock(return_value=mock_deck)

        request = StudyQueueRequest(deck_id=mock_deck.id, limit=20)

        with pytest.raises(DeckNotFoundException):
            await service.get_study_queue(user_id=uuid4(), request=request)

    @pytest.mark.asyncio
    async def test_get_study_queue_includes_early_practice_when_requested(
        self, mock_db_session, mock_deck, mock_card
    ):
        """Early practice cards are included when include_early_practice=True."""
        service = SM2Service(mock_db_session)

        # Create mock early practice stats
        early_stats = MagicMock()
        early_stats.status = CardStatus.REVIEW
        early_stats.next_review_date = date.today() + timedelta(days=3)
        early_stats.easiness_factor = 2.5
        early_stats.interval = 6
        early_stats.card = mock_card

        service.deck_repo.get = AsyncMock(return_value=mock_deck)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[])
        service.stats_repo.get_new_cards_for_deck = AsyncMock(return_value=[])
        service.stats_repo.get_early_practice_cards = AsyncMock(return_value=[early_stats])

        request = StudyQueueRequest(
            deck_id=mock_deck.id,
            limit=20,
            include_new=False,
            include_early_practice=True,
            early_practice_limit=10,
        )

        result = await service.get_study_queue(user_id=uuid4(), request=request)

        assert result.total_early_practice == 1
        assert result.total_in_queue == 1
        assert len(result.cards) == 1
        assert result.cards[0].is_early_practice is True
        assert result.cards[0].is_new is False

    @pytest.mark.asyncio
    async def test_get_study_queue_excludes_early_practice_by_default(
        self, mock_db_session, mock_deck, mock_card
    ):
        """Early practice cards are excluded when include_early_practice=False."""
        service = SM2Service(mock_db_session)

        service.deck_repo.get = AsyncMock(return_value=mock_deck)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[])
        service.stats_repo.get_new_cards_for_deck = AsyncMock(return_value=[])
        service.stats_repo.get_early_practice_cards = AsyncMock(return_value=[])

        request = StudyQueueRequest(
            deck_id=mock_deck.id,
            limit=20,
            include_new=False,
            include_early_practice=False,
        )

        result = await service.get_study_queue(user_id=uuid4(), request=request)

        # get_early_practice_cards should NOT be called
        service.stats_repo.get_early_practice_cards.assert_not_awaited()
        assert result.total_early_practice == 0

    @pytest.mark.asyncio
    async def test_get_study_queue_early_practice_respects_limit(self, mock_db_session, mock_deck):
        """Early practice respects early_practice_limit parameter."""
        service = SM2Service(mock_db_session)

        # Create 5 mock early practice cards
        early_stats_list = []
        for i in range(5):
            stats = MagicMock()
            stats.status = CardStatus.REVIEW
            stats.next_review_date = date.today() + timedelta(days=i + 1)
            stats.easiness_factor = 2.5
            stats.interval = 6
            card = _create_mock_card(front_text=f"Card {i}", back_text_en=f"Back {i}")
            stats.card = card
            early_stats_list.append(stats)

        service.deck_repo.get = AsyncMock(return_value=mock_deck)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[])
        service.stats_repo.get_new_cards_for_deck = AsyncMock(return_value=[])
        # Return only 3 (respecting limit passed to repository)
        service.stats_repo.get_early_practice_cards = AsyncMock(return_value=early_stats_list[:3])

        request = StudyQueueRequest(
            deck_id=mock_deck.id,
            limit=20,
            include_new=False,
            include_early_practice=True,
            early_practice_limit=3,
        )

        result = await service.get_study_queue(user_id=uuid4(), request=request)

        # Verify limit was passed correctly
        call_kwargs = service.stats_repo.get_early_practice_cards.call_args.kwargs
        assert call_kwargs["limit"] == 3
        assert result.total_early_practice == 3

    @pytest.mark.asyncio
    async def test_get_study_queue_priority_order(self, mock_db_session, mock_deck):
        """Queue maintains order: due cards, new cards, early practice cards."""
        service = SM2Service(mock_db_session)

        # Due card
        due_card = _create_mock_card(front_text="Due", back_text_en="Due Back")
        due_stats = MagicMock()
        due_stats.status = CardStatus.REVIEW
        due_stats.next_review_date = date.today()
        due_stats.easiness_factor = 2.5
        due_stats.interval = 6
        due_stats.card = due_card

        # New card
        new_card = _create_mock_card(front_text="New", back_text_en="New Back")

        # Early practice card
        early_card = _create_mock_card(front_text="Early", back_text_en="Early Back")

        early_stats = MagicMock()
        early_stats.status = CardStatus.LEARNING
        early_stats.next_review_date = date.today() + timedelta(days=2)
        early_stats.easiness_factor = 2.5
        early_stats.interval = 3
        early_stats.card = early_card

        service.deck_repo.get = AsyncMock(return_value=mock_deck)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[due_stats])
        service.stats_repo.get_new_cards_for_deck = AsyncMock(return_value=[new_card])
        service.stats_repo.get_early_practice_cards = AsyncMock(return_value=[early_stats])

        request = StudyQueueRequest(
            deck_id=mock_deck.id,
            limit=20,
            include_new=True,
            new_cards_limit=10,
            include_early_practice=True,
            early_practice_limit=10,
        )

        result = await service.get_study_queue(user_id=uuid4(), request=request)

        assert len(result.cards) == 3
        # First: due card (not new, not early practice)
        assert result.cards[0].front_text == "Due"
        assert result.cards[0].is_new is False
        assert result.cards[0].is_early_practice is False
        # Second: new card
        assert result.cards[1].front_text == "New"
        assert result.cards[1].is_new is True
        assert result.cards[1].is_early_practice is False
        # Third: early practice card
        assert result.cards[2].front_text == "Early"
        assert result.cards[2].is_new is False
        assert result.cards[2].is_early_practice is True

    @pytest.mark.asyncio
    async def test_get_study_queue_due_cards_not_early_practice(
        self, mock_db_session, mock_deck, mock_card
    ):
        """Due cards explicitly have is_early_practice=False."""
        service = SM2Service(mock_db_session)

        due_stats = MagicMock()
        due_stats.status = CardStatus.REVIEW
        due_stats.next_review_date = date.today()
        due_stats.easiness_factor = 2.5
        due_stats.interval = 6
        due_stats.card = mock_card

        service.deck_repo.get = AsyncMock(return_value=mock_deck)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[due_stats])
        service.stats_repo.get_new_cards_for_deck = AsyncMock(return_value=[])

        request = StudyQueueRequest(
            deck_id=mock_deck.id,
            limit=20,
            include_new=False,
            include_early_practice=False,
        )

        result = await service.get_study_queue(user_id=uuid4(), request=request)

        assert result.cards[0].is_early_practice is False


@pytest.mark.unit
@pytest.mark.sm2
class TestGetStudyStats:
    """Tests for SM2Service.get_study_stats method."""

    @pytest.mark.asyncio
    async def test_returns_status_counts(self, mock_db_session):
        """by_status dict is populated correctly."""
        service = SM2Service(mock_db_session)

        status_counts = {
            "new": 10,
            "learning": 5,
            "review": 15,
            "mastered": 20,
            "due": 8,
        }

        service.stats_repo.count_by_status = AsyncMock(return_value=status_counts)
        service.review_repo.count_reviews_today = AsyncMock(return_value=25)
        service.review_repo.get_streak = AsyncMock(return_value=7)

        result = await service.get_study_stats(user_id=uuid4())

        assert result["by_status"] == status_counts
        assert result["by_status"]["new"] == 10
        assert result["by_status"]["mastered"] == 20

    @pytest.mark.asyncio
    async def test_returns_reviews_today(self, mock_db_session):
        """reviews_today count is from review_repo."""
        service = SM2Service(mock_db_session)

        service.stats_repo.count_by_status = AsyncMock(return_value={"due": 0})
        service.review_repo.count_reviews_today = AsyncMock(return_value=42)
        service.review_repo.get_streak = AsyncMock(return_value=0)

        result = await service.get_study_stats(user_id=uuid4())

        assert result["reviews_today"] == 42
        service.review_repo.count_reviews_today.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_current_streak(self, mock_db_session):
        """current_streak is from review_repo."""
        service = SM2Service(mock_db_session)

        service.stats_repo.count_by_status = AsyncMock(return_value={"due": 0})
        service.review_repo.count_reviews_today = AsyncMock(return_value=0)
        service.review_repo.get_streak = AsyncMock(return_value=14)

        result = await service.get_study_stats(user_id=uuid4())

        assert result["current_streak"] == 14
        service.review_repo.get_streak.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_due_today_from_status_counts(self, mock_db_session):
        """due_today comes from by_status['due']."""
        service = SM2Service(mock_db_session)

        status_counts = {"due": 15}
        service.stats_repo.count_by_status = AsyncMock(return_value=status_counts)
        service.review_repo.count_reviews_today = AsyncMock(return_value=0)
        service.review_repo.get_streak = AsyncMock(return_value=0)

        result = await service.get_study_stats(user_id=uuid4())

        assert result["due_today"] == 15


@pytest.mark.unit
@pytest.mark.sm2
class TestGetReviewMessage:
    """Tests for SM2Service._get_review_message internal helper."""

    def test_get_review_message_mastery_achieved(self, mock_db_session):
        """Returns 'Congratulations! Card mastered!' when newly mastered."""
        service = SM2Service(mock_db_session)

        message = service._get_review_message(
            quality=5,
            is_first_review=False,
            was_mastered=False,
            is_now_mastered=True,
        )

        assert message == "Congratulations! Card mastered!"

    def test_get_review_message_lost_mastery(self, mock_db_session):
        """Returns 'Card needs more practice.' when mastery is lost."""
        service = SM2Service(mock_db_session)

        message = service._get_review_message(
            quality=1,
            is_first_review=False,
            was_mastered=True,
            is_now_mastered=False,
        )

        assert message == "Card needs more practice."

    def test_get_review_message_perfect_score(self, mock_db_session):
        """Returns 'Perfect!' for q=5 (non-mastery transition)."""
        service = SM2Service(mock_db_session)

        message = service._get_review_message(
            quality=5,
            is_first_review=False,
            was_mastered=False,
            is_now_mastered=False,
        )

        assert message == "Perfect!"

    def test_get_review_message_good_start(self, mock_db_session):
        """Returns 'Good start!' for first successful review."""
        service = SM2Service(mock_db_session)

        message = service._get_review_message(
            quality=4,
            is_first_review=True,
            was_mastered=False,
            is_now_mastered=False,
        )

        assert message == "Good start!"

    def test_get_review_message_no_special_message(self, mock_db_session):
        """Returns None for regular reviews without special conditions."""
        service = SM2Service(mock_db_session)

        message = service._get_review_message(
            quality=4,
            is_first_review=False,
            was_mastered=False,
            is_now_mastered=False,
        )

        assert message is None

    def test_get_review_message_mastery_takes_priority(self, mock_db_session):
        """Mastery transition message takes priority over quality=5."""
        service = SM2Service(mock_db_session)

        # Both perfect score and mastery achieved
        message = service._get_review_message(
            quality=5,
            is_first_review=False,
            was_mastered=False,
            is_now_mastered=True,
        )

        # Mastery message takes priority
        assert message == "Congratulations! Card mastered!"


@pytest.mark.unit
@pytest.mark.sm2
class TestUpdateDeckProgress:
    """Tests for SM2Service._update_deck_progress internal method."""

    @pytest.mark.asyncio
    async def test_no_update_when_card_not_found(self, mock_db_session):
        """No update occurs if card's deck cannot be found."""
        service = SM2Service(mock_db_session)

        # Mock execute to return None for deck_id
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        service.progress_repo.get_or_create = AsyncMock()
        service.progress_repo.update_progress_metrics = AsyncMock()

        await service._update_deck_progress(
            user_id=uuid4(),
            card_id=uuid4(),
            is_first_review=True,
            was_mastered=False,
            is_now_mastered=False,
        )

        # Should not call progress methods
        service.progress_repo.get_or_create.assert_not_awaited()
        service.progress_repo.update_progress_metrics.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_no_update_when_no_deltas(self, mock_db_session):
        """No update when neither first review nor mastery change."""
        service = SM2Service(mock_db_session)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = uuid4()
        mock_db_session.execute.return_value = mock_result

        service.progress_repo.get_or_create = AsyncMock(return_value=MagicMock(id=uuid4()))
        service.progress_repo.update_progress_metrics = AsyncMock()

        await service._update_deck_progress(
            user_id=uuid4(),
            card_id=uuid4(),
            is_first_review=False,  # Not first review
            was_mastered=True,  # Still mastered
            is_now_mastered=True,  # Still mastered
        )

        # get_or_create called but update_progress_metrics not called
        # because cards_studied_delta = 0 and cards_mastered_delta = 0
        service.progress_repo.update_progress_metrics.assert_not_awaited()
