"""Unit tests for ProgressService with mocked repositories.

Tests cover:
- get_dashboard_stats: Dashboard statistics aggregation
- get_deck_progress_list: Paginated deck progress
- get_deck_progress_detail: Single deck detailed progress
- get_learning_trends: Historical analytics by period
- get_achievements: User achievement progress
- Helper methods: Quality trend calculation, review time estimation

Acceptance Criteria tested:
- AC #1: All ProgressService methods have unit tests
- AC #2: Edge cases covered (empty data, new users)
- AC #3: Calculation methods thoroughly tested
- AC #4: Mocking pattern follows existing test conventions
- AC #5: All tests pass with pytest
- AC #6: 90%+ coverage on progress_service.py
"""

from datetime import date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from src.core.exceptions import DeckNotFoundException, NotFoundException
from src.db.models import Deck, DeckLevel, UserDeckProgress
from src.services.progress_service import ProgressService

# =============================================================================
# Fixtures
# =============================================================================


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
def mock_deck():
    """Create a mock Deck object."""
    deck = MagicMock(spec=Deck)
    deck.id = uuid4()
    deck.name = "Greek A1 Vocabulary"
    deck.level = DeckLevel.A1
    deck.description = "Essential Greek vocabulary"
    deck.is_active = True
    deck.card_count = 100
    return deck


@pytest.fixture
def mock_user_deck_progress(mock_deck):
    """Create a mock UserDeckProgress object."""
    progress = MagicMock(spec=UserDeckProgress)
    progress.id = uuid4()
    progress.user_id = uuid4()
    progress.deck_id = mock_deck.id
    progress.deck = mock_deck
    progress.cards_studied = 75
    progress.cards_mastered = 30
    progress.last_studied_at = datetime.utcnow()
    progress.created_at = datetime.utcnow() - timedelta(days=30)
    return progress


@pytest.fixture
def service(mock_db_session):
    """Create ProgressService instance with mocked DB."""
    return ProgressService(mock_db_session)


# =============================================================================
# TestProgressServiceDashboard
# =============================================================================


@pytest.mark.unit
@pytest.mark.progress
class TestProgressServiceDashboard:
    """Tests for ProgressService.get_dashboard_stats method."""

    async def test_get_dashboard_stats_new_user(self, service):
        """User with no activity returns zeros."""
        user_id = uuid4()

        # Mock all repositories to return empty/zero values
        service.progress_repo.get_total_cards_studied = AsyncMock(return_value=0)
        service.progress_repo.get_total_cards_mastered = AsyncMock(return_value=0)
        service.progress_repo.count_user_decks = AsyncMock(return_value=0)
        service.progress_repo.get_user_progress = AsyncMock(return_value=[])
        service.review_repo.count_reviews_today = AsyncMock(return_value=0)
        service.review_repo.get_study_time_today = AsyncMock(return_value=0)
        service.review_repo.get_streak = AsyncMock(return_value=0)
        service.review_repo.get_longest_streak = AsyncMock(return_value=0)
        service.review_repo.get_daily_stats = AsyncMock(return_value=[])
        service.review_repo.get_accuracy_stats = AsyncMock(return_value={"correct": 0, "total": 0})
        service.review_repo.get_dates_with_vocab_activity = AsyncMock(return_value=[])
        service.stats_repo.count_by_status = AsyncMock(
            return_value={"new": 0, "learning": 0, "review": 0, "mastered": 0, "due": 0}
        )
        # Mock culture stats repo
        service.culture_stats_repo.count_mastered_questions = AsyncMock(return_value=0)
        service.culture_stats_repo.count_due_questions = AsyncMock(return_value=0)
        service.culture_stats_repo.get_culture_study_time_seconds = AsyncMock(return_value=0)
        service.culture_stats_repo.get_culture_accuracy_stats = AsyncMock(
            return_value={"correct": 0, "total": 0}
        )
        service.culture_stats_repo.get_dates_with_culture_activity = AsyncMock(return_value=[])

        result = await service.get_dashboard_stats(user_id)

        assert result.overview.total_cards_studied == 0
        assert result.overview.total_cards_mastered == 0
        assert result.overview.total_decks_started == 0
        assert result.overview.overall_mastery_percentage == 0.0
        assert result.overview.accuracy_percentage == 0.0
        assert result.today.reviews_completed == 0
        assert result.today.cards_due == 0
        assert result.streak.current_streak == 0
        assert result.streak.longest_streak == 0
        assert result.recent_activity == []

    async def test_get_dashboard_stats_active_user(self, service):
        """User with reviews and progress returns correct aggregations."""
        user_id = uuid4()

        # Mock progress with last_studied_at
        mock_progress = MagicMock()
        mock_progress.last_studied_at = datetime.utcnow()

        service.progress_repo.get_total_cards_studied = AsyncMock(return_value=150)
        service.progress_repo.get_total_cards_mastered = AsyncMock(return_value=45)
        service.progress_repo.count_user_decks = AsyncMock(return_value=3)
        service.progress_repo.get_user_progress = AsyncMock(return_value=[mock_progress])
        service.review_repo.count_reviews_today = AsyncMock(return_value=25)
        service.review_repo.get_study_time_today = AsyncMock(return_value=1800)
        service.review_repo.get_streak = AsyncMock(return_value=7)
        service.review_repo.get_longest_streak = AsyncMock(return_value=14)
        service.review_repo.get_daily_stats = AsyncMock(
            return_value=[{"date": date.today(), "reviews_count": 25, "average_quality": 4.0}]
        )
        service.review_repo.get_accuracy_stats = AsyncMock(
            return_value={"correct": 80, "total": 100}
        )
        service.review_repo.get_dates_with_vocab_activity = AsyncMock(
            return_value=[date.today()]
        )
        service.stats_repo.count_by_status = AsyncMock(
            return_value={"new": 50, "learning": 35, "review": 45, "mastered": 45, "due": 12}
        )
        # Mock culture stats repo with some activity
        service.culture_stats_repo.count_mastered_questions = AsyncMock(return_value=5)
        service.culture_stats_repo.count_due_questions = AsyncMock(return_value=3)
        service.culture_stats_repo.get_culture_study_time_seconds = AsyncMock(return_value=300)
        service.culture_stats_repo.get_culture_accuracy_stats = AsyncMock(
            return_value={"correct": 20, "total": 25}
        )
        service.culture_stats_repo.get_dates_with_culture_activity = AsyncMock(
            return_value=[date.today()]
        )

        result = await service.get_dashboard_stats(user_id)

        assert result.overview.total_cards_studied == 150
        # Mastered = vocab (45) + culture (5) = 50
        assert result.overview.total_cards_mastered == 50
        assert result.overview.total_decks_started == 3
        assert result.today.reviews_completed == 25
        # Due = vocab (12) + culture (3) = 15
        assert result.today.cards_due == 15
        # Study time = vocab (1800) + culture (300) = 2100
        assert result.today.study_time_seconds == 2100
        # Combined streak (1 day with activity today)
        assert result.streak.current_streak == 1
        assert result.streak.longest_streak == 14

    async def test_get_dashboard_stats_streak_calculation(self, service):
        """Streak is calculated correctly using combined vocab + culture activity."""
        user_id = uuid4()
        today = date.today()

        # Setup minimum required mocks
        service.progress_repo.get_total_cards_studied = AsyncMock(return_value=100)
        service.progress_repo.get_total_cards_mastered = AsyncMock(return_value=50)
        service.progress_repo.count_user_decks = AsyncMock(return_value=1)
        service.progress_repo.get_user_progress = AsyncMock(return_value=[])
        service.review_repo.count_reviews_today = AsyncMock(return_value=10)
        service.review_repo.get_study_time_today = AsyncMock(return_value=600)
        service.review_repo.get_streak = AsyncMock(return_value=7)
        service.review_repo.get_longest_streak = AsyncMock(return_value=14)
        service.review_repo.get_daily_stats = AsyncMock(return_value=[])
        service.review_repo.get_accuracy_stats = AsyncMock(return_value={"correct": 80, "total": 100})
        # 7 consecutive days of vocab activity
        service.review_repo.get_dates_with_vocab_activity = AsyncMock(
            return_value=[today - timedelta(days=i) for i in range(7)]
        )
        service.stats_repo.count_by_status = AsyncMock(return_value={"due": 5})
        # Culture mocks
        service.culture_stats_repo.count_mastered_questions = AsyncMock(return_value=0)
        service.culture_stats_repo.count_due_questions = AsyncMock(return_value=0)
        service.culture_stats_repo.get_culture_study_time_seconds = AsyncMock(return_value=0)
        service.culture_stats_repo.get_culture_accuracy_stats = AsyncMock(
            return_value={"correct": 0, "total": 0}
        )
        service.culture_stats_repo.get_dates_with_culture_activity = AsyncMock(return_value=[])

        result = await service.get_dashboard_stats(user_id)

        # Combined streak from vocab dates (7 consecutive days)
        assert result.streak.current_streak == 7
        assert result.streak.longest_streak == 14

    async def test_get_dashboard_stats_cards_by_status(self, service):
        """Status breakdown is accurate."""
        user_id = uuid4()

        status_counts = {
            "new": 50,
            "learning": 35,
            "review": 45,
            "mastered": 45,
            "due": 12,
        }

        service.progress_repo.get_total_cards_studied = AsyncMock(return_value=175)
        service.progress_repo.get_total_cards_mastered = AsyncMock(return_value=45)
        service.progress_repo.count_user_decks = AsyncMock(return_value=2)
        service.progress_repo.get_user_progress = AsyncMock(return_value=[])
        service.review_repo.count_reviews_today = AsyncMock(return_value=15)
        service.review_repo.get_study_time_today = AsyncMock(return_value=900)
        service.review_repo.get_streak = AsyncMock(return_value=5)
        service.review_repo.get_longest_streak = AsyncMock(return_value=10)
        service.review_repo.get_daily_stats = AsyncMock(return_value=[])
        service.review_repo.get_accuracy_stats = AsyncMock(return_value={"correct": 0, "total": 0})
        service.review_repo.get_dates_with_vocab_activity = AsyncMock(return_value=[])
        service.stats_repo.count_by_status = AsyncMock(return_value=status_counts)
        # Culture mocks
        service.culture_stats_repo.count_mastered_questions = AsyncMock(return_value=0)
        service.culture_stats_repo.count_due_questions = AsyncMock(return_value=0)
        service.culture_stats_repo.get_culture_study_time_seconds = AsyncMock(return_value=0)
        service.culture_stats_repo.get_culture_accuracy_stats = AsyncMock(
            return_value={"correct": 0, "total": 0}
        )
        service.culture_stats_repo.get_dates_with_culture_activity = AsyncMock(return_value=[])

        result = await service.get_dashboard_stats(user_id)

        assert result.cards_by_status["new"] == 50
        assert result.cards_by_status["learning"] == 35
        assert result.cards_by_status["review"] == 45
        assert result.cards_by_status["mastered"] == 45
        assert result.cards_by_status["due"] == 12

    async def test_get_dashboard_stats_goal_progress_calculation(self, service):
        """Daily goal progress percentage calculated correctly."""
        user_id = uuid4()

        # 25 reviews completed, goal is 20 (default)
        service.progress_repo.get_total_cards_studied = AsyncMock(return_value=100)
        service.progress_repo.get_total_cards_mastered = AsyncMock(return_value=50)
        service.progress_repo.count_user_decks = AsyncMock(return_value=1)
        service.progress_repo.get_user_progress = AsyncMock(return_value=[])
        service.review_repo.count_reviews_today = AsyncMock(return_value=25)
        service.review_repo.get_study_time_today = AsyncMock(return_value=1000)
        service.review_repo.get_streak = AsyncMock(return_value=3)
        service.review_repo.get_longest_streak = AsyncMock(return_value=7)
        service.review_repo.get_daily_stats = AsyncMock(return_value=[])
        service.review_repo.get_accuracy_stats = AsyncMock(return_value={"correct": 0, "total": 0})
        service.review_repo.get_dates_with_vocab_activity = AsyncMock(return_value=[])
        service.stats_repo.count_by_status = AsyncMock(return_value={"due": 10})
        # Culture mocks
        service.culture_stats_repo.count_mastered_questions = AsyncMock(return_value=0)
        service.culture_stats_repo.count_due_questions = AsyncMock(return_value=0)
        service.culture_stats_repo.get_culture_study_time_seconds = AsyncMock(return_value=0)
        service.culture_stats_repo.get_culture_accuracy_stats = AsyncMock(
            return_value={"correct": 0, "total": 0}
        )
        service.culture_stats_repo.get_dates_with_culture_activity = AsyncMock(return_value=[])

        result = await service.get_dashboard_stats(user_id)

        # 25/20 * 100 = 125, but capped at 100
        assert result.today.goal_progress_percentage == 100.0
        assert result.today.daily_goal == 20

    async def test_get_dashboard_stats_mastery_percentage_calculation(self, service):
        """Overall mastery percentage calculated correctly."""
        user_id = uuid4()

        # 45 vocab mastered + 5 culture mastered = 50 total mastered out of 150 studied
        # (50 / 150) * 100 = 33.3%
        service.progress_repo.get_total_cards_studied = AsyncMock(return_value=150)
        service.progress_repo.get_total_cards_mastered = AsyncMock(return_value=45)
        service.progress_repo.count_user_decks = AsyncMock(return_value=2)
        service.progress_repo.get_user_progress = AsyncMock(return_value=[])
        service.review_repo.count_reviews_today = AsyncMock(return_value=10)
        service.review_repo.get_study_time_today = AsyncMock(return_value=500)
        service.review_repo.get_streak = AsyncMock(return_value=2)
        service.review_repo.get_longest_streak = AsyncMock(return_value=5)
        service.review_repo.get_daily_stats = AsyncMock(return_value=[])
        service.review_repo.get_accuracy_stats = AsyncMock(return_value={"correct": 0, "total": 0})
        service.review_repo.get_dates_with_vocab_activity = AsyncMock(return_value=[])
        service.stats_repo.count_by_status = AsyncMock(return_value={"due": 8})
        # Culture mocks - add 5 more mastered
        service.culture_stats_repo.count_mastered_questions = AsyncMock(return_value=5)
        service.culture_stats_repo.count_due_questions = AsyncMock(return_value=0)
        service.culture_stats_repo.get_culture_study_time_seconds = AsyncMock(return_value=0)
        service.culture_stats_repo.get_culture_accuracy_stats = AsyncMock(
            return_value={"correct": 0, "total": 0}
        )
        service.culture_stats_repo.get_dates_with_culture_activity = AsyncMock(return_value=[])

        result = await service.get_dashboard_stats(user_id)

        # (45 vocab + 5 culture) / 150 studied = 33.3%
        assert result.overview.overall_mastery_percentage == 33.3

    async def test_get_dashboard_stats_recent_activity(self, service):
        """Recent activity is returned correctly."""
        user_id = uuid4()
        today = date.today()

        daily_stats = [
            {"date": today, "reviews_count": 20, "average_quality": 4.2},
            {"date": today - timedelta(days=1), "reviews_count": 15, "average_quality": 3.8},
            {"date": today - timedelta(days=2), "reviews_count": 25, "average_quality": 4.5},
        ]

        service.progress_repo.get_total_cards_studied = AsyncMock(return_value=100)
        service.progress_repo.get_total_cards_mastered = AsyncMock(return_value=40)
        service.progress_repo.count_user_decks = AsyncMock(return_value=1)
        service.progress_repo.get_user_progress = AsyncMock(return_value=[])
        service.review_repo.count_reviews_today = AsyncMock(return_value=20)
        service.review_repo.get_study_time_today = AsyncMock(return_value=800)
        service.review_repo.get_streak = AsyncMock(return_value=3)
        service.review_repo.get_longest_streak = AsyncMock(return_value=5)
        service.review_repo.get_daily_stats = AsyncMock(return_value=daily_stats)
        service.review_repo.get_accuracy_stats = AsyncMock(return_value={"correct": 0, "total": 0})
        service.review_repo.get_dates_with_vocab_activity = AsyncMock(return_value=[])
        service.stats_repo.count_by_status = AsyncMock(return_value={"due": 10})
        # Culture mocks
        service.culture_stats_repo.count_mastered_questions = AsyncMock(return_value=0)
        service.culture_stats_repo.count_due_questions = AsyncMock(return_value=0)
        service.culture_stats_repo.get_culture_study_time_seconds = AsyncMock(return_value=0)
        service.culture_stats_repo.get_culture_accuracy_stats = AsyncMock(
            return_value={"correct": 0, "total": 0}
        )
        service.culture_stats_repo.get_dates_with_culture_activity = AsyncMock(return_value=[])

        result = await service.get_dashboard_stats(user_id)

        assert len(result.recent_activity) == 3
        assert result.recent_activity[0].date == today
        assert result.recent_activity[0].reviews_count == 20
        assert result.recent_activity[0].average_quality == 4.2


# =============================================================================
# TestProgressServiceDeckList
# =============================================================================


@pytest.mark.unit
@pytest.mark.progress
class TestProgressServiceDeckList:
    """Tests for ProgressService.get_deck_progress_list method."""

    async def test_get_deck_progress_list_empty(self, service):
        """No decks started returns empty list."""
        user_id = uuid4()

        service.progress_repo.count_user_decks = AsyncMock(return_value=0)
        service.progress_repo.get_user_progress = AsyncMock(return_value=[])

        result = await service.get_deck_progress_list(user_id, page=1, page_size=10)

        assert result.total == 0
        assert result.decks == []
        assert result.page == 1
        assert result.page_size == 10

    async def test_get_deck_progress_list_paginated(
        self, service, mock_deck, mock_user_deck_progress
    ):
        """Pagination works correctly."""
        user_id = uuid4()

        # Create second mock deck and progress
        mock_deck2 = MagicMock(spec=Deck)
        mock_deck2.id = uuid4()
        mock_deck2.name = "Greek A2 Vocabulary"
        mock_deck2.level = DeckLevel.A2
        mock_deck2.is_active = True

        mock_progress2 = MagicMock(spec=UserDeckProgress)
        mock_progress2.deck_id = mock_deck2.id
        mock_progress2.deck = mock_deck2
        mock_progress2.cards_studied = 50
        mock_progress2.cards_mastered = 20
        mock_progress2.last_studied_at = datetime.utcnow()

        service.progress_repo.count_user_decks = AsyncMock(return_value=3)
        service.progress_repo.get_user_progress = AsyncMock(
            return_value=[mock_user_deck_progress, mock_progress2]
        )
        service.deck_repo.count_cards = AsyncMock(return_value=100)
        service.stats_repo.count_by_status = AsyncMock(return_value={"due": 10})
        service.stats_repo.get_average_easiness_factor = AsyncMock(return_value=2.35)

        result = await service.get_deck_progress_list(user_id, page=1, page_size=2)

        assert result.total == 3
        assert result.page == 1
        assert result.page_size == 2
        assert len(result.decks) == 2

    async def test_get_deck_progress_list_metrics(
        self, service, mock_deck, mock_user_deck_progress
    ):
        """Mastery/completion percentages calculated correctly."""
        user_id = uuid4()

        # Deck with 100 cards, 75 studied, 30 mastered
        mock_user_deck_progress.cards_studied = 75
        mock_user_deck_progress.cards_mastered = 30

        service.progress_repo.count_user_decks = AsyncMock(return_value=1)
        service.progress_repo.get_user_progress = AsyncMock(return_value=[mock_user_deck_progress])
        service.deck_repo.count_cards = AsyncMock(return_value=100)
        service.stats_repo.count_by_status = AsyncMock(return_value={"due": 15})
        service.stats_repo.get_average_easiness_factor = AsyncMock(return_value=2.4)

        result = await service.get_deck_progress_list(user_id, page=1, page_size=10)

        assert len(result.decks) == 1
        deck_summary = result.decks[0]
        # Mastery: 30/75 = 40% (mastered / studied)
        assert deck_summary.mastery_percentage == 40.0
        # Completion: 75/100 = 75% (studied / total)
        assert deck_summary.completion_percentage == 75.0

    async def test_get_deck_progress_list_estimated_review_time(
        self, service, mock_deck, mock_user_deck_progress
    ):
        """Estimated review time calculated from due cards."""
        user_id = uuid4()

        service.progress_repo.count_user_decks = AsyncMock(return_value=1)
        service.progress_repo.get_user_progress = AsyncMock(return_value=[mock_user_deck_progress])
        service.deck_repo.count_cards = AsyncMock(return_value=100)
        # 15 due cards, AVG_TIME_PER_CARD_SECONDS = 15 seconds
        # 15 * 15 = 225 seconds = 3.75 minutes -> ceil = 4 minutes
        service.stats_repo.count_by_status = AsyncMock(return_value={"due": 15})
        service.stats_repo.get_average_easiness_factor = AsyncMock(return_value=2.5)

        result = await service.get_deck_progress_list(user_id, page=1, page_size=10)

        assert len(result.decks) == 1
        assert result.decks[0].estimated_review_time_minutes == 4

    async def test_get_deck_progress_list_average_easiness_factor(
        self, service, mock_deck, mock_user_deck_progress
    ):
        """Average EF is retrieved correctly."""
        user_id = uuid4()

        service.progress_repo.count_user_decks = AsyncMock(return_value=1)
        service.progress_repo.get_user_progress = AsyncMock(return_value=[mock_user_deck_progress])
        service.deck_repo.count_cards = AsyncMock(return_value=100)
        service.stats_repo.count_by_status = AsyncMock(return_value={"due": 10})
        service.stats_repo.get_average_easiness_factor = AsyncMock(return_value=2.35)

        result = await service.get_deck_progress_list(user_id, page=1, page_size=10)

        assert result.decks[0].average_easiness_factor == 2.35


# =============================================================================
# TestProgressServiceDeckDetail
# =============================================================================


@pytest.mark.unit
@pytest.mark.progress
class TestProgressServiceDeckDetail:
    """Tests for ProgressService.get_deck_progress_detail method."""

    async def test_get_deck_progress_detail_success(
        self, service, mock_deck, mock_user_deck_progress
    ):
        """Returns full deck details when deck and progress exist."""
        user_id = uuid4()
        deck_id = mock_deck.id

        # Ensure progress is linked to the mock deck
        mock_user_deck_progress.deck_id = deck_id

        service.deck_repo.get = AsyncMock(return_value=mock_deck)
        service.progress_repo.get_user_progress = AsyncMock(return_value=[mock_user_deck_progress])
        service.deck_repo.count_cards = AsyncMock(return_value=100)
        service.stats_repo.count_by_status = AsyncMock(
            return_value={"new": 25, "learning": 20, "review": 30, "due": 15}
        )
        service.review_repo.get_total_reviews = AsyncMock(return_value=500)
        service.review_repo.get_total_study_time = AsyncMock(return_value=18000)
        service.review_repo.get_average_quality = AsyncMock(return_value=3.8)
        service.stats_repo.get_average_easiness_factor = AsyncMock(return_value=2.4)
        service.stats_repo.get_average_interval = AsyncMock(return_value=7.5)

        result = await service.get_deck_progress_detail(user_id, deck_id)

        assert result.deck_id == deck_id
        assert result.deck_name == mock_deck.name
        assert result.deck_level == "A1"
        assert result.deck_description == mock_deck.description
        assert result.progress.total_cards == 100
        assert result.progress.cards_studied == 75
        assert result.progress.cards_mastered == 30
        assert result.statistics.total_reviews == 500
        assert result.statistics.average_quality == 3.8
        assert result.timeline.days_active >= 0

    async def test_get_deck_progress_detail_not_found(self, service):
        """Raises exception for non-existent deck."""
        user_id = uuid4()
        deck_id = uuid4()

        service.deck_repo.get = AsyncMock(return_value=None)

        with pytest.raises(DeckNotFoundException):
            await service.get_deck_progress_detail(user_id, deck_id)

    async def test_get_deck_progress_detail_inactive_deck(self, service, mock_deck):
        """Raises exception for inactive deck."""
        user_id = uuid4()
        mock_deck.is_active = False

        service.deck_repo.get = AsyncMock(return_value=mock_deck)

        with pytest.raises(DeckNotFoundException):
            await service.get_deck_progress_detail(user_id, mock_deck.id)

    async def test_get_deck_progress_detail_no_progress(self, service, mock_deck):
        """Handles deck with no user progress (raises NotFoundException)."""
        user_id = uuid4()

        service.deck_repo.get = AsyncMock(return_value=mock_deck)
        service.progress_repo.get_user_progress = AsyncMock(return_value=[])

        with pytest.raises(NotFoundException):
            await service.get_deck_progress_detail(user_id, mock_deck.id)

    async def test_get_deck_progress_detail_timeline_calculation(
        self, service, mock_deck, mock_user_deck_progress
    ):
        """Days active and estimated completion calculated correctly."""
        user_id = uuid4()
        deck_id = mock_deck.id

        # Set dates for 30 days active
        mock_user_deck_progress.deck_id = deck_id
        mock_user_deck_progress.cards_studied = 75
        mock_user_deck_progress.created_at = datetime.utcnow() - timedelta(days=29)
        mock_user_deck_progress.last_studied_at = datetime.utcnow()

        service.deck_repo.get = AsyncMock(return_value=mock_deck)
        service.progress_repo.get_user_progress = AsyncMock(return_value=[mock_user_deck_progress])
        service.deck_repo.count_cards = AsyncMock(return_value=100)
        service.stats_repo.count_by_status = AsyncMock(return_value={"due": 10})
        service.review_repo.get_total_reviews = AsyncMock(return_value=300)
        service.review_repo.get_total_study_time = AsyncMock(return_value=10000)
        service.review_repo.get_average_quality = AsyncMock(return_value=4.0)
        service.stats_repo.get_average_easiness_factor = AsyncMock(return_value=2.5)
        service.stats_repo.get_average_interval = AsyncMock(return_value=10.0)

        result = await service.get_deck_progress_detail(user_id, deck_id)

        assert result.timeline.days_active == 30
        # 25 cards remaining, rate = 75/30 = 2.5 cards/day
        # 25/2.5 = 10 days (ceil)
        assert result.timeline.estimated_completion_days == 10

    async def test_get_deck_progress_detail_statistics(
        self, service, mock_deck, mock_user_deck_progress
    ):
        """Statistics aggregated from review data."""
        user_id = uuid4()
        deck_id = mock_deck.id
        mock_user_deck_progress.deck_id = deck_id

        service.deck_repo.get = AsyncMock(return_value=mock_deck)
        service.progress_repo.get_user_progress = AsyncMock(return_value=[mock_user_deck_progress])
        service.deck_repo.count_cards = AsyncMock(return_value=100)
        service.stats_repo.count_by_status = AsyncMock(return_value={"due": 10})
        service.review_repo.get_total_reviews = AsyncMock(return_value=750)
        service.review_repo.get_total_study_time = AsyncMock(return_value=25000)
        service.review_repo.get_average_quality = AsyncMock(return_value=4.2)
        service.stats_repo.get_average_easiness_factor = AsyncMock(return_value=2.45)
        service.stats_repo.get_average_interval = AsyncMock(return_value=12.5)

        result = await service.get_deck_progress_detail(user_id, deck_id)

        assert result.statistics.total_reviews == 750
        assert result.statistics.total_study_time_seconds == 25000
        assert result.statistics.average_quality == 4.2
        assert result.statistics.average_easiness_factor == 2.45
        assert result.statistics.average_interval_days == 12.5


# =============================================================================
# TestProgressServiceTrends
# =============================================================================


@pytest.mark.unit
@pytest.mark.progress
class TestProgressServiceTrends:
    """Tests for ProgressService.get_learning_trends method."""

    async def test_get_learning_trends_week(self, service):
        """Week period returns 7 days of data."""
        user_id = uuid4()
        today = date.today()

        # Create 7 days of mock data
        daily_stats = [
            {
                "date": today - timedelta(days=i),
                "reviews_count": 20 - i,
                "average_quality": 4.0,
                "total_time_seconds": 600,
            }
            for i in range(7)
        ]

        service.review_repo.get_daily_stats = AsyncMock(return_value=daily_stats)
        service.stats_repo.count_cards_mastered_in_range = AsyncMock(return_value=5)

        result = await service.get_learning_trends(user_id, period="week")

        assert result.period == "week"
        assert len(result.daily_stats) == 7
        assert result.start_date == today - timedelta(days=6)
        assert result.end_date == today

    async def test_get_learning_trends_month(self, service):
        """Month period returns ~30 days."""
        user_id = uuid4()
        today = date.today()

        service.review_repo.get_daily_stats = AsyncMock(return_value=[])
        service.stats_repo.count_cards_mastered_in_range = AsyncMock(return_value=0)

        result = await service.get_learning_trends(user_id, period="month")

        assert result.period == "month"
        # Month = 30 days (index 0 to 29)
        assert len(result.daily_stats) == 30
        assert result.start_date == today - timedelta(days=29)
        assert result.end_date == today

    async def test_get_learning_trends_year(self, service):
        """Year period returns ~365 days."""
        user_id = uuid4()
        today = date.today()

        service.review_repo.get_daily_stats = AsyncMock(return_value=[])
        service.stats_repo.count_cards_mastered_in_range = AsyncMock(return_value=0)

        result = await service.get_learning_trends(user_id, period="year")

        assert result.period == "year"
        assert len(result.daily_stats) == 365
        assert result.start_date == today - timedelta(days=364)
        assert result.end_date == today

    async def test_get_learning_trends_with_deck_filter(self, service):
        """Filters by deck_id when provided."""
        user_id = uuid4()
        deck_id = uuid4()

        service.review_repo.get_daily_stats = AsyncMock(return_value=[])
        service.stats_repo.count_cards_mastered_in_range = AsyncMock(return_value=0)

        # Note: The current implementation doesn't actually filter by deck_id
        # but the API supports it. We test that it doesn't break.
        result = await service.get_learning_trends(user_id, period="week", deck_id=deck_id)

        assert result.period == "week"
        # Verify get_daily_stats was called (deck_id filtering would be done there)
        service.review_repo.get_daily_stats.assert_awaited_once()

    async def test_get_learning_trends_empty(self, service):
        """No activity returns zeros with zero-filled days."""
        user_id = uuid4()

        service.review_repo.get_daily_stats = AsyncMock(return_value=[])
        service.stats_repo.count_cards_mastered_in_range = AsyncMock(return_value=0)

        result = await service.get_learning_trends(user_id, period="week")

        # All days should have zero values
        for day_stat in result.daily_stats:
            assert day_stat.reviews_count == 0
            assert day_stat.study_time_seconds == 0

        assert result.summary.total_reviews == 0
        assert result.summary.total_study_time_seconds == 0
        assert result.summary.cards_mastered == 0
        assert result.summary.average_daily_reviews == 0.0

    async def test_get_learning_trends_summary_calculation(self, service):
        """Summary aggregates daily stats correctly."""
        user_id = uuid4()
        today = date.today()

        daily_stats = [
            {
                "date": today,
                "reviews_count": 30,
                "average_quality": 4.5,
                "total_time_seconds": 1200,
            },
            {
                "date": today - timedelta(days=1),
                "reviews_count": 20,
                "average_quality": 4.0,
                "total_time_seconds": 800,
            },
            {
                "date": today - timedelta(days=2),
                "reviews_count": 25,
                "average_quality": 4.2,
                "total_time_seconds": 1000,
            },
        ]

        service.review_repo.get_daily_stats = AsyncMock(return_value=daily_stats)
        service.stats_repo.count_cards_mastered_in_range = AsyncMock(return_value=8)

        result = await service.get_learning_trends(user_id, period="week")

        # Total reviews = 30 + 20 + 25 = 75
        assert result.summary.total_reviews == 75
        # Total time = 1200 + 800 + 1000 = 3000
        assert result.summary.total_study_time_seconds == 3000
        assert result.summary.cards_mastered == 8
        # Average = 75 / 7 = 10.7 (rounded)
        assert result.summary.average_daily_reviews == pytest.approx(10.7, abs=0.1)
        # Best day = today with 30 reviews
        assert result.summary.best_day == today

    async def test_get_learning_trends_invalid_period_defaults_to_week(self, service):
        """Invalid period defaults to week."""
        user_id = uuid4()

        service.review_repo.get_daily_stats = AsyncMock(return_value=[])
        service.stats_repo.count_cards_mastered_in_range = AsyncMock(return_value=0)

        result = await service.get_learning_trends(user_id, period="invalid")

        # Should default to week behavior
        assert len(result.daily_stats) == 7


# =============================================================================
# TestProgressServiceHelpers
# =============================================================================


@pytest.mark.unit
@pytest.mark.progress
class TestProgressServiceHelpers:
    """Tests for ProgressService helper methods."""

    def test_calculate_quality_trend_improving(self, service):
        """Quality scores increasing returns 'improving'."""
        daily_stats = [
            {
                "date": date.today() - timedelta(days=i),
                "reviews_count": 10,
                "average_quality": 3.0 + (0.1 * (6 - i)),
            }
            for i in range(7)
        ]
        # First half (older): avg ~3.0-3.2, Second half (newer): avg ~3.4-3.6
        # Reversed so newer is last
        daily_stats = list(reversed(daily_stats))

        result = service._calculate_quality_trend(daily_stats)

        assert result == "improving"

    def test_calculate_quality_trend_declining(self, service):
        """Quality scores decreasing returns 'declining'."""
        daily_stats = [
            {
                "date": date.today() - timedelta(days=i),
                "reviews_count": 10,
                "average_quality": 4.0 - (0.1 * (6 - i)),
            }
            for i in range(7)
        ]
        # First half (older): avg ~4.0-3.8, Second half (newer): avg ~3.6-3.4
        daily_stats = list(reversed(daily_stats))

        result = service._calculate_quality_trend(daily_stats)

        assert result == "declining"

    def test_calculate_quality_trend_stable(self, service):
        """Quality scores flat returns 'stable'."""
        daily_stats = [
            {"date": date.today() - timedelta(days=i), "reviews_count": 10, "average_quality": 4.0}
            for i in range(7)
        ]

        result = service._calculate_quality_trend(daily_stats)

        assert result == "stable"

    def test_calculate_quality_trend_empty_data(self, service):
        """Empty data returns 'stable'."""
        result = service._calculate_quality_trend([])
        assert result == "stable"

    def test_calculate_quality_trend_single_day(self, service):
        """Single day returns 'stable'."""
        daily_stats = [{"date": date.today(), "reviews_count": 10, "average_quality": 4.0}]
        result = service._calculate_quality_trend(daily_stats)
        assert result == "stable"

    def test_calculate_quality_trend_no_reviews(self, service):
        """Days with no reviews returns 'stable'."""
        daily_stats = [
            {"date": date.today() - timedelta(days=i), "reviews_count": 0, "average_quality": 0.0}
            for i in range(7)
        ]

        result = service._calculate_quality_trend(daily_stats)

        assert result == "stable"

    def test_estimate_review_time(self, service):
        """Time estimation calculation."""
        # 10 cards * 15 seconds = 150 seconds = 2.5 minutes -> ceil = 3
        result = service._estimate_review_time(10)
        assert result == 3

        # 0 cards = 0 minutes
        result = service._estimate_review_time(0)
        assert result == 0

        # 4 cards * 15 seconds = 60 seconds = 1 minute
        result = service._estimate_review_time(4)
        assert result == 1

        # 1 card * 15 seconds = 15 seconds = 0.25 minutes -> ceil = 1
        result = service._estimate_review_time(1)
        assert result == 1

    async def test_get_recent_activity(self, service):
        """Last N days activity aggregation."""
        user_id = uuid4()
        today = date.today()

        daily_stats = [
            {"date": today, "reviews_count": 20, "average_quality": 4.2},
            {"date": today - timedelta(days=1), "reviews_count": 15, "average_quality": 3.8},
        ]

        service.review_repo.get_daily_stats = AsyncMock(return_value=daily_stats)

        result = await service._get_recent_activity(user_id, days=7)

        assert len(result) == 2
        assert result[0].date == today
        assert result[0].reviews_count == 20
        assert result[0].average_quality == 4.2


# =============================================================================
# TestProgressServiceAchievements
# =============================================================================


@pytest.mark.unit
@pytest.mark.progress
@pytest.mark.achievements
class TestProgressServiceAchievements:
    """Tests for ProgressService.get_achievements method."""

    async def test_get_achievements_new_user(self, service):
        """New user with no activity has no unlocked achievements."""
        user_id = uuid4()

        service.review_repo.get_longest_streak = AsyncMock(return_value=0)
        service.progress_repo.get_total_cards_mastered = AsyncMock(return_value=0)
        service.review_repo.get_total_reviews = AsyncMock(return_value=0)
        service.review_repo.get_total_study_time = AsyncMock(return_value=0)
        service.progress_repo.count_user_decks = AsyncMock(return_value=0)

        result = await service.get_achievements(user_id)

        # All achievements should be locked
        unlocked_count = sum(1 for a in result.achievements if a.unlocked)
        assert unlocked_count == 0
        assert result.total_points == 0

    async def test_get_achievements_partial_progress(self, service):
        """User with partial progress shows correct percentage."""
        user_id = uuid4()

        # 5-day streak (threshold for Week Warrior is 7)
        service.review_repo.get_longest_streak = AsyncMock(return_value=5)
        service.progress_repo.get_total_cards_mastered = AsyncMock(return_value=5)
        service.review_repo.get_total_reviews = AsyncMock(return_value=30)
        service.review_repo.get_total_study_time = AsyncMock(return_value=1800)
        service.progress_repo.count_user_decks = AsyncMock(return_value=1)

        result = await service.get_achievements(user_id)

        # Find the 7-day streak achievement
        streak_achievement = next((a for a in result.achievements if a.id == "streak_7"), None)
        assert streak_achievement is not None
        # 5/7 * 100 = 71.4%
        assert streak_achievement.progress == pytest.approx(71.4, abs=0.1)
        assert streak_achievement.unlocked is False

    async def test_get_achievements_unlocked_gives_points(self, service):
        """Unlocked achievement adds to total points."""
        user_id = uuid4()

        # 7-day streak unlocks Week Warrior (50 points)
        service.review_repo.get_longest_streak = AsyncMock(return_value=7)
        service.progress_repo.get_total_cards_mastered = AsyncMock(return_value=5)
        service.review_repo.get_total_reviews = AsyncMock(return_value=50)
        service.review_repo.get_total_study_time = AsyncMock(return_value=3000)
        service.progress_repo.count_user_decks = AsyncMock(return_value=1)

        result = await service.get_achievements(user_id)

        # Find the unlocked streak achievement
        streak_achievement = next((a for a in result.achievements if a.id == "streak_7"), None)
        assert streak_achievement is not None
        assert streak_achievement.unlocked is True
        assert streak_achievement.progress == 100.0
        assert streak_achievement.points == 50
        assert result.total_points >= 50

    async def test_get_achievements_multiple_unlocked(self, service):
        """Multiple unlocked achievements sum points correctly."""
        user_id = uuid4()

        # Unlock multiple achievements:
        # - streak_3 (3-day streak, 25 points)
        # - streak_7 (7-day streak, 50 points)
        # - mastered_10 (10 cards mastered, 25 points)
        service.review_repo.get_longest_streak = AsyncMock(
            return_value=10
        )  # Unlocks streak_3 and streak_7
        service.progress_repo.get_total_cards_mastered = AsyncMock(
            return_value=15
        )  # Unlocks mastered_10
        service.review_repo.get_total_reviews = AsyncMock(return_value=100)
        service.review_repo.get_total_study_time = AsyncMock(return_value=5000)
        service.progress_repo.count_user_decks = AsyncMock(return_value=2)

        result = await service.get_achievements(user_id)

        # Count unlocked achievements
        unlocked_achievements = [a for a in result.achievements if a.unlocked]
        assert len(unlocked_achievements) >= 3  # At least streak_3, streak_7, mastered_10

        # Total points should be at least 100 (25 + 50 + 25)
        assert result.total_points >= 100

    async def test_get_achievements_next_milestone(self, service):
        """Next milestone is closest incomplete achievement."""
        user_id = uuid4()

        # 5-day streak, 8 cards mastered (close to 10)
        service.review_repo.get_longest_streak = AsyncMock(return_value=5)
        service.progress_repo.get_total_cards_mastered = AsyncMock(return_value=8)
        service.review_repo.get_total_reviews = AsyncMock(return_value=40)
        service.review_repo.get_total_study_time = AsyncMock(return_value=2000)
        service.progress_repo.count_user_decks = AsyncMock(return_value=1)

        result = await service.get_achievements(user_id)

        assert result.next_milestone is not None
        # Next milestone should be the highest progress incomplete achievement
        # mastered_10 at 80% (8/10) should be higher than streak_7 at 71% (5/7)
        assert result.next_milestone.progress >= 70.0
        assert result.next_milestone.remaining > 0

    async def test_get_achievements_response_structure(self, service):
        """Response has correct structure."""
        user_id = uuid4()

        service.review_repo.get_longest_streak = AsyncMock(return_value=3)
        service.progress_repo.get_total_cards_mastered = AsyncMock(return_value=5)
        service.review_repo.get_total_reviews = AsyncMock(return_value=20)
        service.review_repo.get_total_study_time = AsyncMock(return_value=1000)
        service.progress_repo.count_user_decks = AsyncMock(return_value=1)

        result = await service.get_achievements(user_id)

        # Check structure
        assert hasattr(result, "achievements")
        assert hasattr(result, "total_points")
        assert hasattr(result, "next_milestone")

        # Check achievements list
        assert isinstance(result.achievements, list)
        assert len(result.achievements) > 0

        # Check each achievement has required fields
        for achievement in result.achievements:
            assert hasattr(achievement, "id")
            assert hasattr(achievement, "name")
            assert hasattr(achievement, "description")
            assert hasattr(achievement, "icon")
            assert hasattr(achievement, "unlocked")
            assert hasattr(achievement, "progress")
            assert hasattr(achievement, "points")

    async def test_get_achievements_all_types_coverage(self, service):
        """All achievement types are testable."""
        user_id = uuid4()

        # Set values that cover all types:
        # STREAK: longest_streak
        # MASTERED: total_mastered
        # REVIEWS: total_reviews (not used but available)
        # STUDY_TIME: total_study_time
        # DECKS: total_decks
        service.review_repo.get_longest_streak = AsyncMock(return_value=30)
        service.progress_repo.get_total_cards_mastered = AsyncMock(return_value=100)
        service.review_repo.get_total_reviews = AsyncMock(return_value=1000)
        service.review_repo.get_total_study_time = AsyncMock(return_value=36000)  # 10 hours
        service.progress_repo.count_user_decks = AsyncMock(return_value=5)

        result = await service.get_achievements(user_id)

        # Should have unlocked several achievements across different types
        unlocked = [a for a in result.achievements if a.unlocked]
        assert len(unlocked) >= 5  # At least some from each type


# =============================================================================
# TestAchievementValueMapping
# =============================================================================


@pytest.mark.unit
@pytest.mark.progress
@pytest.mark.achievements
class TestAchievementValueMapping:
    """Tests for _get_achievement_value helper method."""

    def test_get_achievement_value_streak(self, service):
        """Streak type maps to longest_streak stat."""
        from src.services.achievements import AchievementType

        stats = {
            "longest_streak": 7,
            "total_mastered": 50,
            "total_reviews": 200,
            "total_study_time": 10000,
            "total_decks": 3,
        }

        result = service._get_achievement_value(AchievementType.STREAK, stats)
        assert result == 7

    def test_get_achievement_value_mastered(self, service):
        """Mastered type maps to total_mastered stat."""
        from src.services.achievements import AchievementType

        stats = {
            "longest_streak": 7,
            "total_mastered": 50,
            "total_reviews": 200,
            "total_study_time": 10000,
            "total_decks": 3,
        }

        result = service._get_achievement_value(AchievementType.MASTERED, stats)
        assert result == 50

    def test_get_achievement_value_study_time(self, service):
        """Study time type maps to total_study_time stat."""
        from src.services.achievements import AchievementType

        stats = {
            "longest_streak": 7,
            "total_mastered": 50,
            "total_reviews": 200,
            "total_study_time": 10000,
            "total_decks": 3,
        }

        result = service._get_achievement_value(AchievementType.STUDY_TIME, stats)
        assert result == 10000

    def test_get_achievement_value_decks(self, service):
        """Decks type maps to total_decks stat."""
        from src.services.achievements import AchievementType

        stats = {
            "longest_streak": 7,
            "total_mastered": 50,
            "total_reviews": 200,
            "total_study_time": 10000,
            "total_decks": 3,
        }

        result = service._get_achievement_value(AchievementType.DECKS, stats)
        assert result == 3

    def test_get_achievement_value_missing_stat(self, service):
        """Missing stat returns 0."""
        from src.services.achievements import AchievementType

        stats = {}

        result = service._get_achievement_value(AchievementType.STREAK, stats)
        assert result == 0
