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

from datetime import date
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from src.core.exceptions import DeckNotFoundException
from src.db.models import Card, CardDifficulty, CardStatistics, CardStatus, Deck
from src.schemas.sm2 import StudyQueueRequest
from src.services.sm2_service import SM2Service


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = MagicMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.execute = AsyncMock()
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
    deck.name = "Test Deck"
    deck.is_active = True
    return deck


@pytest.fixture
def mock_card(mock_deck):
    """Create a mock Card object."""
    card = MagicMock(spec=Card)
    card.id = uuid4()
    card.deck_id = mock_deck.id
    card.front_text = "Test front"
    card.back_text = "Test back"
    card.example_sentence = "Example sentence"
    card.pronunciation = "Pronunciation"
    card.difficulty = CardDifficulty.EASY
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
    async def test_bulk_commits_successful_reviews(self, mock_db_session, mock_stats):
        """commit is called after processing all reviews."""
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

        # Verify commit was called
        mock_db_session.commit.assert_awaited()


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
        mock_card_2 = MagicMock(spec=Card)
        mock_card_2.id = uuid4()
        mock_card_2.front_text = "Card 2"
        mock_card_2.back_text = "Back 2"
        mock_card_2.example_sentence = None
        mock_card_2.pronunciation = None
        mock_card_2.difficulty = CardDifficulty.EASY
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
            card = MagicMock(spec=Card)
            card.id = uuid4()
            card.front_text = f"Card {i}"
            card.back_text = f"Back {i}"
            card.example_sentence = None
            card.pronunciation = None
            card.difficulty = CardDifficulty.EASY
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
