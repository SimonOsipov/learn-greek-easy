"""Unit tests for ProgressService."""

from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.schemas.progress import DailyStats
from src.services.progress_service import ProgressService


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def mock_user_id():
    return uuid4()


def _make_full_repo_patches():
    """Return the full set of context manager patches for all repos used by ProgressService."""
    return (
        patch("src.services.progress_service.CardRecordStatisticsRepository"),
        patch("src.services.progress_service.CardRecordReviewRepository"),
        patch("src.services.progress_service.CultureQuestionStatsRepository"),
        patch("src.services.progress_service.CultureAnswerHistoryRepository"),
        patch("src.services.progress_service.MockExamRepository"),
        patch("src.services.progress_service.DeckRepository"),
        patch("src.services.progress_service.CardRecordRepository"),
        patch("src.services.progress_service.CultureDeckRepository"),
    )


def _setup_dashboard_mocks(
    stats_cls,
    review_cls,
    culture_stats_cls,
    culture_answer_cls,
    mock_exam_cls,
    *_rest,
    vocab_status=None,
    culture_status=None,
    accuracy_stats=None,
    reviews_today=0,
    culture_answers_today=0,
    distinct_decks=0,
    culture_mastered=0,
    last_review_date=None,
    daily_stats=None,
):
    """Wire default AsyncMock return values on mocked repo instances."""
    if vocab_status is None:
        vocab_status = {"new": 0, "due": 0}
    if culture_status is None:
        culture_status = {"new": 0, "due": 0}
    if accuracy_stats is None:
        accuracy_stats = {"correct": 0, "total": 0}
    if daily_stats is None:
        daily_stats = []

    stats = stats_cls.return_value
    stats.count_by_status = AsyncMock(return_value=vocab_status)
    stats.count_distinct_decks = AsyncMock(return_value=distinct_decks)
    stats.count_cards_mastered_in_range = AsyncMock(return_value=0)

    review = review_cls.return_value
    review.count_reviews_today = AsyncMock(return_value=reviews_today)
    review.get_total_study_time = AsyncMock(return_value=0)
    review.get_study_time_today = AsyncMock(return_value=0)
    review.get_accuracy_stats = AsyncMock(return_value=accuracy_stats)
    review.get_last_review_date = AsyncMock(return_value=last_review_date)
    review.get_unique_dates = AsyncMock(return_value=[])
    review.get_all_unique_dates = AsyncMock(return_value=[])
    review.get_daily_stats = AsyncMock(return_value=daily_stats)

    cstats = culture_stats_cls.return_value
    cstats.count_all_by_status = AsyncMock(return_value=culture_status)
    cstats.count_mastered_questions = AsyncMock(return_value=culture_mastered)
    cstats.count_due_questions = AsyncMock(return_value=0)

    canswer = culture_answer_cls.return_value
    canswer.count_answers_today = AsyncMock(return_value=culture_answers_today)
    canswer.get_total_study_time = AsyncMock(return_value=0)
    canswer.get_study_time_today = AsyncMock(return_value=0)
    canswer.get_unique_dates = AsyncMock(return_value=[])
    canswer.get_all_unique_dates = AsyncMock(return_value=[])

    mexam = mock_exam_cls.return_value
    mexam.get_total_study_time = AsyncMock(return_value=0)
    mexam.get_study_time_today = AsyncMock(return_value=0)
    mexam.get_unique_dates = AsyncMock(return_value=[])
    mexam.get_all_unique_dates = AsyncMock(return_value=[])


# ============================================================================
# TestGetDashboardStats
# ============================================================================


@pytest.mark.unit
class TestGetDashboardStats:
    async def test_returns_zero_stats_for_new_user(self, mock_db, mock_user_id):
        """Dashboard returns zeros when user has no reviews."""
        patches = _make_full_repo_patches()
        with (
            patches[0] as s_cls,
            patches[1] as r_cls,
            patches[2] as cs_cls,
            patches[3] as ca_cls,
            patches[4] as me_cls,
            patches[5],
            patches[6],
            patches[7],
        ):
            _setup_dashboard_mocks(s_cls, r_cls, cs_cls, ca_cls, me_cls)
            service = ProgressService(mock_db)
            result = await service.get_dashboard_stats(mock_user_id)

        assert result.overview.total_cards_studied == 0
        assert result.overview.total_cards_mastered == 0
        assert result.streak.current_streak == 0
        assert result.streak.last_study_date is None
        assert result.recent_activity == []

    async def test_total_cards_studied_excludes_new_and_due(self, mock_db, mock_user_id):
        """total_cards_studied = sum of status counts excluding 'new' and 'due'."""
        patches = _make_full_repo_patches()
        with (
            patches[0] as s_cls,
            patches[1] as r_cls,
            patches[2] as cs_cls,
            patches[3] as ca_cls,
            patches[4] as me_cls,
            patches[5],
            patches[6],
            patches[7],
        ):
            _setup_dashboard_mocks(
                s_cls,
                r_cls,
                cs_cls,
                ca_cls,
                me_cls,
                vocab_status={"new": 5, "learning": 3, "review": 2, "mastered": 10, "due": 1},
                distinct_decks=2,
            )
            service = ProgressService(mock_db)
            result = await service.get_dashboard_stats(mock_user_id)

        # 3 (learning) + 2 (review) + 10 (mastered) = 15, excludes new=5 and due=1
        assert result.overview.total_cards_studied == 15

    async def test_mastery_percentage_calculation(self, mock_db, mock_user_id):
        """overall_mastery_percentage = (mastered / studied) * 100."""
        patches = _make_full_repo_patches()
        with (
            patches[0] as s_cls,
            patches[1] as r_cls,
            patches[2] as cs_cls,
            patches[3] as ca_cls,
            patches[4] as me_cls,
            patches[5],
            patches[6],
            patches[7],
        ):
            _setup_dashboard_mocks(
                s_cls,
                r_cls,
                cs_cls,
                ca_cls,
                me_cls,
                vocab_status={"new": 0, "learning": 0, "review": 0, "mastered": 50, "due": 0},
                culture_mastered=0,
            )
            service = ProgressService(mock_db)
            result = await service.get_dashboard_stats(mock_user_id)

        # 50 mastered out of 50 studied = 100%
        assert result.overview.overall_mastery_percentage == 100.0

    async def test_recent_activity_built_from_daily_stats(self, mock_db, mock_user_id):
        """recent_activity list is built from card_review_repo.get_daily_stats rows."""
        today = date.today()
        daily_rows = [
            {"date": today, "reviews_count": 5, "avg_quality": 3.5},
        ]
        patches = _make_full_repo_patches()
        with (
            patches[0] as s_cls,
            patches[1] as r_cls,
            patches[2] as cs_cls,
            patches[3] as ca_cls,
            patches[4] as me_cls,
            patches[5],
            patches[6],
            patches[7],
        ):
            _setup_dashboard_mocks(s_cls, r_cls, cs_cls, ca_cls, me_cls, daily_stats=daily_rows)
            service = ProgressService(mock_db)
            result = await service.get_dashboard_stats(mock_user_id)

        assert len(result.recent_activity) == 1
        assert result.recent_activity[0].reviews_count == 5
        assert result.recent_activity[0].average_quality == 3.5

    async def test_cards_due_combines_vocab_and_culture(self, mock_db, mock_user_id):
        """today.cards_due sums vocab due + culture due."""
        patches = _make_full_repo_patches()
        with (
            patches[0] as s_cls,
            patches[1] as r_cls,
            patches[2] as cs_cls,
            patches[3] as ca_cls,
            patches[4] as me_cls,
            patches[5],
            patches[6],
            patches[7],
        ):
            _setup_dashboard_mocks(
                s_cls,
                r_cls,
                cs_cls,
                ca_cls,
                me_cls,
                vocab_status={"new": 0, "due": 7},
                culture_status={"new": 0, "due": 3},
            )
            service = ProgressService(mock_db)
            result = await service.get_dashboard_stats(mock_user_id)

        assert result.today.cards_due == 10


# ============================================================================
# TestComputeQualityTrend
# ============================================================================


@pytest.mark.unit
class TestComputeQualityTrend:
    def _make_stat(self, quality: float, reviews: int = 5) -> DailyStats:
        return DailyStats(
            date=date.today(),
            reviews_count=reviews,
            cards_learned=0,
            cards_mastered=0,
            study_time_seconds=0,
            average_quality=quality,
        )

    def test_stable_when_no_reviews(self):
        stats = [self._make_stat(0.0, reviews=0)]
        assert ProgressService._compute_quality_trend(stats) == "stable"

    def test_stable_when_single_entry(self):
        # half = 0, returns "stable" immediately
        stats = [self._make_stat(4.0)]
        assert ProgressService._compute_quality_trend(stats) == "stable"

    def test_improving_when_second_half_better(self):
        stats = [
            self._make_stat(2.0),
            self._make_stat(2.0),
            self._make_stat(4.5),
            self._make_stat(4.5),
        ]
        assert ProgressService._compute_quality_trend(stats) == "improving"

    def test_declining_when_second_half_worse(self):
        stats = [
            self._make_stat(4.5),
            self._make_stat(4.5),
            self._make_stat(2.0),
            self._make_stat(2.0),
        ]
        assert ProgressService._compute_quality_trend(stats) == "declining"

    def test_stable_within_threshold(self):
        # Difference < 0.2 → stable
        stats = [
            self._make_stat(3.0),
            self._make_stat(3.0),
            self._make_stat(3.1),
            self._make_stat(3.1),
        ]
        assert ProgressService._compute_quality_trend(stats) == "stable"


# ============================================================================
# TestAggregatedStreak
# ============================================================================


@pytest.mark.unit
class TestAggregatedStreak:
    async def test_streak_zero_when_no_dates(self, mock_db, mock_user_id):
        with (
            patch("src.services.progress_service.CardRecordStatisticsRepository"),
            patch("src.services.progress_service.CardRecordReviewRepository") as mock_review_cls,
            patch("src.services.progress_service.CultureQuestionStatsRepository"),
            patch("src.services.progress_service.CultureAnswerHistoryRepository") as mock_ca_cls,
            patch("src.services.progress_service.MockExamRepository") as mock_me_cls,
            patch("src.services.progress_service.DeckRepository"),
            patch("src.services.progress_service.CardRecordRepository"),
            patch("src.services.progress_service.CultureDeckRepository"),
        ):
            mock_review_cls.return_value.get_unique_dates = AsyncMock(return_value=[])
            mock_ca_cls.return_value.get_unique_dates = AsyncMock(return_value=[])
            mock_me_cls.return_value.get_unique_dates = AsyncMock(return_value=[])

            service = ProgressService(mock_db)
            result = await service._get_aggregated_streak(mock_user_id)

        assert result == 0

    async def test_streak_one_when_studied_today(self, mock_db, mock_user_id):
        today = date.today()
        with (
            patch("src.services.progress_service.CardRecordStatisticsRepository"),
            patch("src.services.progress_service.CardRecordReviewRepository") as mock_review_cls,
            patch("src.services.progress_service.CultureQuestionStatsRepository"),
            patch("src.services.progress_service.CultureAnswerHistoryRepository") as mock_ca_cls,
            patch("src.services.progress_service.MockExamRepository") as mock_me_cls,
            patch("src.services.progress_service.DeckRepository"),
            patch("src.services.progress_service.CardRecordRepository"),
            patch("src.services.progress_service.CultureDeckRepository"),
        ):
            mock_review_cls.return_value.get_unique_dates = AsyncMock(return_value=[today])
            mock_ca_cls.return_value.get_unique_dates = AsyncMock(return_value=[])
            mock_me_cls.return_value.get_unique_dates = AsyncMock(return_value=[])

            service = ProgressService(mock_db)
            result = await service._get_aggregated_streak(mock_user_id)

        assert result == 1

    async def test_streak_merges_all_sources(self, mock_db, mock_user_id):
        """Dates from vocab, culture, and mock exam are unioned for streak calc."""
        today = date.today()
        yesterday = today - timedelta(days=1)
        with (
            patch("src.services.progress_service.CardRecordStatisticsRepository"),
            patch("src.services.progress_service.CardRecordReviewRepository") as mock_review_cls,
            patch("src.services.progress_service.CultureQuestionStatsRepository"),
            patch("src.services.progress_service.CultureAnswerHistoryRepository") as mock_ca_cls,
            patch("src.services.progress_service.MockExamRepository") as mock_me_cls,
            patch("src.services.progress_service.DeckRepository"),
            patch("src.services.progress_service.CardRecordRepository"),
            patch("src.services.progress_service.CultureDeckRepository"),
        ):
            # Only vocab has today, only culture has yesterday — combined = 2 days
            mock_review_cls.return_value.get_unique_dates = AsyncMock(return_value=[today])
            mock_ca_cls.return_value.get_unique_dates = AsyncMock(return_value=[yesterday])
            mock_me_cls.return_value.get_unique_dates = AsyncMock(return_value=[])

            service = ProgressService(mock_db)
            result = await service._get_aggregated_streak(mock_user_id)

        assert result == 2
