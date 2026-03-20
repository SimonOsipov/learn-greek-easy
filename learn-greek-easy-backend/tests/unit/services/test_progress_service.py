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


# ============================================================================
# TestGetDeckProgressList
# ============================================================================


@pytest.mark.unit
class TestGetDeckProgressList:
    """Tests for get_deck_progress_list including timezone-aware sorting."""

    def _make_deck_mock(self, deck_id, name="Test Deck", level="A1"):
        deck = MagicMock()
        deck.id = deck_id
        deck.name_en = name
        deck.level = MagicMock(value=level)
        return deck

    def _make_culture_deck_mock(self, deck_id, name="Culture Deck", category="history"):
        deck = MagicMock()
        deck.id = deck_id
        deck.name_en = name
        deck.category = category
        return deck

    async def test_mixed_studied_and_never_studied_decks(self, mock_db, mock_user_id):
        """Mixing tz-aware last_studied_at and None must not raise TypeError."""
        deck_id1, deck_id2 = uuid4(), uuid4()
        now = datetime.now(tz=timezone.utc)

        patches = _make_full_repo_patches()
        with (
            patches[0] as stats_cls,
            patches[1] as review_cls,
            patches[2] as culture_stats_cls,
            patches[3],
            patches[4],
            patches[5] as deck_cls,
            patches[6] as card_rec_cls,
            patches[7] as culture_deck_cls,
        ):
            stats_cls.return_value.get_deck_progress_summaries = AsyncMock(
                return_value=[
                    {
                        "deck_id": deck_id1,
                        "cards_mastered": 5,
                        "cards_studied": 10,
                        "cards_due": 2,
                        "avg_ef": 2.5,
                    },
                    {
                        "deck_id": deck_id2,
                        "cards_mastered": 0,
                        "cards_studied": 0,
                        "cards_due": 0,
                        "avg_ef": 2.5,
                    },
                ]
            )
            review_cls.return_value.get_last_review_by_deck = AsyncMock(
                return_value={deck_id1: now}
            )
            deck_cls.return_value.get_by_ids = AsyncMock(
                return_value=[
                    self._make_deck_mock(deck_id1, "Deck 1"),
                    self._make_deck_mock(deck_id2, "Deck 2"),
                ]
            )
            card_rec_cls.return_value.count_by_deck = AsyncMock(return_value=20)
            culture_deck_cls.return_value.list_active = AsyncMock(return_value=[])
            culture_stats_cls.return_value.get_batch_deck_stats = AsyncMock(return_value={})

            service = ProgressService(mock_db)
            result = await service.get_deck_progress_list(mock_user_id)

        assert len(result.decks) == 2
        assert result.decks[0].last_studied_at == now
        assert result.decks[1].last_studied_at is None

    async def test_all_decks_studied(self, mock_db, mock_user_id):
        """All decks with tz-aware timestamps sort descending."""
        deck_id1, deck_id2 = uuid4(), uuid4()
        t1 = datetime(2026, 1, 1, tzinfo=timezone.utc)
        t2 = datetime(2026, 2, 1, tzinfo=timezone.utc)

        patches = _make_full_repo_patches()
        with (
            patches[0] as stats_cls,
            patches[1] as review_cls,
            patches[2],
            patches[3],
            patches[4],
            patches[5] as deck_cls,
            patches[6] as card_rec_cls,
            patches[7] as culture_deck_cls,
        ):
            stats_cls.return_value.get_deck_progress_summaries = AsyncMock(
                return_value=[
                    {
                        "deck_id": deck_id1,
                        "cards_mastered": 3,
                        "cards_studied": 5,
                        "cards_due": 1,
                        "avg_ef": 2.5,
                    },
                    {
                        "deck_id": deck_id2,
                        "cards_mastered": 3,
                        "cards_studied": 5,
                        "cards_due": 1,
                        "avg_ef": 2.5,
                    },
                ]
            )
            review_cls.return_value.get_last_review_by_deck = AsyncMock(
                return_value={deck_id1: t1, deck_id2: t2}
            )
            deck_cls.return_value.get_by_ids = AsyncMock(
                return_value=[
                    self._make_deck_mock(deck_id1, "Deck 1"),
                    self._make_deck_mock(deck_id2, "Deck 2"),
                ]
            )
            card_rec_cls.return_value.count_by_deck = AsyncMock(return_value=20)
            culture_deck_cls.return_value.list_active = AsyncMock(return_value=[])

            service = ProgressService(mock_db)
            result = await service.get_deck_progress_list(mock_user_id)

        assert result.total == 2
        assert result.decks[0].deck_name == "Deck 2"  # t2 > t1
        assert result.decks[1].deck_name == "Deck 1"

    async def test_no_decks(self, mock_db, mock_user_id):
        """No vocab or culture decks returns empty list with total=0."""
        patches = _make_full_repo_patches()
        with (
            patches[0] as stats_cls,
            patches[1] as review_cls,
            patches[2],
            patches[3],
            patches[4],
            patches[5] as deck_cls,
            patches[6],
            patches[7] as culture_deck_cls,
        ):
            stats_cls.return_value.get_deck_progress_summaries = AsyncMock(return_value=[])
            review_cls.return_value.get_last_review_by_deck = AsyncMock(return_value={})
            deck_cls.return_value.get_by_ids = AsyncMock(return_value=[])
            culture_deck_cls.return_value.list_active = AsyncMock(return_value=[])

            service = ProgressService(mock_db)
            result = await service.get_deck_progress_list(mock_user_id)

        assert result.total == 0
        assert result.decks == []

    async def test_sorting_order_most_recent_first(self, mock_db, mock_user_id):
        """3 decks with known timestamps sort most-recent-first."""
        ids = [uuid4() for _ in range(3)]
        t1 = datetime(2026, 1, 1, tzinfo=timezone.utc)
        t2 = datetime(2026, 2, 1, tzinfo=timezone.utc)
        t3 = datetime(2026, 3, 1, tzinfo=timezone.utc)

        patches = _make_full_repo_patches()
        with (
            patches[0] as stats_cls,
            patches[1] as review_cls,
            patches[2],
            patches[3],
            patches[4],
            patches[5] as deck_cls,
            patches[6] as card_rec_cls,
            patches[7] as culture_deck_cls,
        ):
            stats_cls.return_value.get_deck_progress_summaries = AsyncMock(
                return_value=[
                    {
                        "deck_id": ids[0],
                        "cards_mastered": 1,
                        "cards_studied": 2,
                        "cards_due": 0,
                        "avg_ef": 2.5,
                    },
                    {
                        "deck_id": ids[1],
                        "cards_mastered": 1,
                        "cards_studied": 2,
                        "cards_due": 0,
                        "avg_ef": 2.5,
                    },
                    {
                        "deck_id": ids[2],
                        "cards_mastered": 1,
                        "cards_studied": 2,
                        "cards_due": 0,
                        "avg_ef": 2.5,
                    },
                ]
            )
            review_cls.return_value.get_last_review_by_deck = AsyncMock(
                return_value={ids[0]: t1, ids[1]: t2, ids[2]: t3}
            )
            deck_cls.return_value.get_by_ids = AsyncMock(
                return_value=[
                    self._make_deck_mock(ids[0], "Deck A"),
                    self._make_deck_mock(ids[1], "Deck B"),
                    self._make_deck_mock(ids[2], "Deck C"),
                ]
            )
            card_rec_cls.return_value.count_by_deck = AsyncMock(return_value=10)
            culture_deck_cls.return_value.list_active = AsyncMock(return_value=[])

            service = ProgressService(mock_db)
            result = await service.get_deck_progress_list(mock_user_id)

        assert [d.deck_name for d in result.decks] == ["Deck C", "Deck B", "Deck A"]

    async def test_vocab_and_culture_decks_combined(self, mock_db, mock_user_id):
        """Both vocab and culture decks appear with correct deck_type."""
        vocab_id = uuid4()
        culture_id = uuid4()
        t_vocab = datetime(2026, 3, 1, tzinfo=timezone.utc)
        t_culture = datetime(2026, 2, 1, tzinfo=timezone.utc)

        patches = _make_full_repo_patches()
        with (
            patches[0] as stats_cls,
            patches[1] as review_cls,
            patches[2] as culture_stats_cls,
            patches[3],
            patches[4],
            patches[5] as deck_cls,
            patches[6] as card_rec_cls,
            patches[7] as culture_deck_cls,
        ):
            stats_cls.return_value.get_deck_progress_summaries = AsyncMock(
                return_value=[
                    {
                        "deck_id": vocab_id,
                        "cards_mastered": 5,
                        "cards_studied": 10,
                        "cards_due": 2,
                        "avg_ef": 2.5,
                    },
                ]
            )
            review_cls.return_value.get_last_review_by_deck = AsyncMock(
                return_value={vocab_id: t_vocab}
            )
            deck_cls.return_value.get_by_ids = AsyncMock(
                return_value=[
                    self._make_deck_mock(vocab_id, "Vocab Deck"),
                ]
            )
            card_rec_cls.return_value.count_by_deck = AsyncMock(return_value=20)

            culture_mock = self._make_culture_deck_mock(culture_id, "Culture Deck")
            culture_deck_cls.return_value.list_active = AsyncMock(return_value=[culture_mock])
            culture_deck_cls.return_value.get_batch_question_counts = AsyncMock(
                return_value={culture_id: 15}
            )
            culture_stats_cls.return_value.get_batch_deck_stats = AsyncMock(
                return_value={
                    culture_id: {
                        "mastered": 3,
                        "learning": 2,
                        "due_count": 1,
                        "last_practiced": t_culture,
                    },
                }
            )

            service = ProgressService(mock_db)
            result = await service.get_deck_progress_list(mock_user_id)

        assert result.total == 2
        types = {d.deck_type for d in result.decks}
        assert types == {"vocabulary", "culture"}
        # Vocab (t_vocab=March) should sort before culture (t_culture=Feb)
        assert result.decks[0].deck_type == "vocabulary"
        assert result.decks[1].deck_type == "culture"
