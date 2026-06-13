"""Unit tests for ProgressService."""

from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.core.cache import CacheService
from src.schemas.progress import DailyStats, DashboardStatsResponse, DeckProgressListResponse
from src.services.progress_service import ProgressService


@pytest.fixture
def mock_db():
    db = MagicMock()
    # _fetch_streak_union_rows calls await self.db.execute(...) twice.
    # Return a mock result whose .all() yields an empty list (all streaks = 0).
    _empty_result = MagicMock()
    _empty_result.all.return_value = []
    db.execute = AsyncMock(return_value=_empty_result)
    return db


@pytest.fixture
def mock_user_id():
    return uuid4()


def _make_full_repo_patches():
    """Return the full set of context manager patches for all repos used by ProgressService.

    SQLCON-06: compute_*_streak patches removed — get_dashboard_stats no longer
    delegates to those functions.  db.execute is now an AsyncMock on mock_db
    (see mock_db fixture) so _fetch_streak_union_rows can be awaited.
    """
    return (
        patch("src.services.progress_service.CardRecordStatisticsRepository"),
        patch("src.services.progress_service.CardRecordReviewRepository"),
        patch("src.services.progress_service.CultureQuestionStatsRepository"),
        patch("src.services.progress_service.CultureAnswerHistoryRepository"),
        patch("src.services.progress_service.MockExamRepository"),
        patch("src.services.progress_service.DeckRepository"),
        patch("src.services.progress_service.CardRecordRepository"),
        patch("src.services.progress_service.CultureDeckRepository"),
        patch("src.services.progress_service.ExerciseReviewRepository"),
    )


def _setup_dashboard_mocks(
    stats_cls,
    review_cls,
    culture_stats_cls,
    culture_answer_cls,
    mock_exam_cls,
    exercise_cls=None,
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
    culture_weekly_study_time=0,
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
    # PERF-10-02: dashboard reads vocab-review scalars via the consolidated
    # get_dashboard_review_aggregates; map the legacy kwargs onto its dict.
    review.get_dashboard_review_aggregates = AsyncMock(
        return_value={
            "total_30d": accuracy_stats["total"],
            "correct_30d": accuracy_stats["correct"],
            "last_reviewed_at": (
                datetime.combine(last_review_date, datetime.min.time())
                if last_review_date is not None
                else None
            ),
            "total_study_time": 0,
            "reviews_today": reviews_today,
            "study_time_today": 0,
        }
    )
    review.get_unique_dates = AsyncMock(return_value=[])
    review.get_all_unique_dates = AsyncMock(return_value=[])
    review.get_daily_stats = AsyncMock(return_value=daily_stats)

    cstats = culture_stats_cls.return_value
    cstats.count_all_by_status = AsyncMock(return_value=culture_status)
    cstats.count_mastered_questions = AsyncMock(return_value=culture_mastered)
    cstats.count_due_questions = AsyncMock(return_value=0)

    canswer = culture_answer_cls.return_value
    # PERF-10-02: dashboard reads culture-answer scalars via the consolidated
    # get_dashboard_answer_aggregates.
    canswer.get_dashboard_answer_aggregates = AsyncMock(
        return_value={
            "total_study_time": 0,
            "study_time_week": culture_weekly_study_time,
            "answers_today": culture_answers_today,
            "study_time_today": 0,
        }
    )
    canswer.get_unique_dates = AsyncMock(return_value=[])
    canswer.get_all_unique_dates = AsyncMock(return_value=[])

    mexam = mock_exam_cls.return_value
    # PERF-10-02: dashboard reads mock-exam scalars via the consolidated
    # get_dashboard_mock_aggregates.
    mexam.get_dashboard_mock_aggregates = AsyncMock(
        return_value={"total_study_time": 0, "study_time_today": 0}
    )
    mexam.get_unique_dates = AsyncMock(return_value=[])
    mexam.get_all_unique_dates = AsyncMock(return_value=[])

    if exercise_cls is not None:
        exercise = exercise_cls.return_value
        exercise.get_unique_dates = AsyncMock(return_value=[])
        exercise.get_all_unique_dates = AsyncMock(return_value=[])


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
            patches[8] as ex_cls,
        ):
            _setup_dashboard_mocks(s_cls, r_cls, cs_cls, ca_cls, me_cls, ex_cls)
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
            patches[8] as ex_cls,
        ):
            _setup_dashboard_mocks(
                s_cls,
                r_cls,
                cs_cls,
                ca_cls,
                me_cls,
                ex_cls,
                vocab_status={
                    "new": 5,
                    "learning": 3,
                    "review": 2,
                    "mastered": 10,
                    "due": 1,
                },
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
            patches[8] as ex_cls,
        ):
            _setup_dashboard_mocks(
                s_cls,
                r_cls,
                cs_cls,
                ca_cls,
                me_cls,
                ex_cls,
                vocab_status={
                    "new": 0,
                    "learning": 0,
                    "review": 0,
                    "mastered": 50,
                    "due": 0,
                },
                culture_mastered=0,
            )
            service = ProgressService(mock_db)
            result = await service.get_dashboard_stats(mock_user_id)

        # 50 mastered out of 50 studied = 100%
        assert result.overview.overall_mastery_percentage == 100.0

    async def test_culture_weekly_study_time_surfaced(self, mock_db, mock_user_id):
        """CULT2-3 / CHR-05: overview exposes the culture rolling-7-day study time."""
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
            patches[8] as ex_cls,
        ):
            _setup_dashboard_mocks(
                s_cls,
                r_cls,
                cs_cls,
                ca_cls,
                me_cls,
                ex_cls,
                culture_weekly_study_time=540,
            )
            service = ProgressService(mock_db)
            result = await service.get_dashboard_stats(mock_user_id)

        # PERF-10-02: sourced from the consolidated culture-answer aggregate
        # (study_time_week key), culture-only rolling 7-day window.
        assert result.overview.culture_weekly_study_time_seconds == 540
        ca_cls.return_value.get_dashboard_answer_aggregates.assert_awaited_once_with(mock_user_id)

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
            patches[8] as ex_cls,
        ):
            _setup_dashboard_mocks(
                s_cls, r_cls, cs_cls, ca_cls, me_cls, ex_cls, daily_stats=daily_rows
            )
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
            patches[8] as ex_cls,
        ):
            _setup_dashboard_mocks(
                s_cls,
                r_cls,
                cs_cls,
                ca_cls,
                me_cls,
                ex_cls,
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
        with patch(
            "src.services.gamification.streak.compute_aggregated_streak",
            new=AsyncMock(return_value=0),
        ) as mock_streak:
            result = await mock_streak(mock_db, mock_user_id)

        assert result == 0

    async def test_streak_one_when_studied_today(self, mock_db, mock_user_id):
        with patch(
            "src.services.gamification.streak.compute_aggregated_streak",
            new=AsyncMock(return_value=1),
        ) as mock_streak:
            result = await mock_streak(mock_db, mock_user_id)

        assert result == 1

    async def test_streak_merges_all_sources(self, mock_db, mock_user_id):
        """Dates from vocab, culture, and mock exam are unioned for streak calc."""
        with patch(
            "src.services.gamification.streak.compute_aggregated_streak",
            new=AsyncMock(return_value=2),
        ) as mock_streak:
            result = await mock_streak(mock_db, mock_user_id)

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


# ============================================================================
# TestGetDeckProgressDetail
# ============================================================================


def _make_deck_detail_mock():
    """Build a minimal deck mock sufficient for get_deck_progress_detail."""
    deck = MagicMock()
    deck.is_active = True
    deck.owner_id = None
    deck.name_en = "Test Deck"
    deck.description_en = "A test deck"
    deck.level = MagicMock()
    deck.level.value = "A1"
    return deck


def _make_review_stats(total_study_time_seconds: int = 0) -> dict:
    """Return a minimal get_deck_review_stats result dict."""
    return {
        "total_reviews": 0,
        "total_study_time_seconds": total_study_time_seconds,
        "average_quality": 0.0,
        "first_reviewed_at": None,
        "last_reviewed_at": None,
    }


def _setup_deck_detail_mocks(
    stats_cls,
    review_cls,
    deck_cls,
    card_rec_cls,
    *,
    study_days=None,
    weekly_activity=None,
    total_study_time_seconds: int = 0,
):
    """Wire AsyncMock return values on the mocked repos used by get_deck_progress_detail."""
    if study_days is None:
        study_days = []
    if weekly_activity is None:
        weekly_activity = {}

    deck_cls.return_value.get = AsyncMock(return_value=_make_deck_detail_mock())

    stats = stats_cls.return_value
    stats.count_by_status = AsyncMock(
        return_value={"new": 0, "learning": 0, "review": 0, "mastered": 0, "due": 0}
    )
    # SQLCON-07: merged into a single round-trip; returns (avg_ef, avg_interval)
    stats.get_average_ef_and_interval = AsyncMock(return_value=(2.5, 1.0))

    review = review_cls.return_value
    review.get_deck_review_stats = AsyncMock(
        return_value=_make_review_stats(total_study_time_seconds)
    )
    review.get_deck_study_days = AsyncMock(return_value=study_days)
    review.get_deck_weekly_activity = AsyncMock(return_value=weekly_activity)

    card_rec_cls.return_value.count_by_deck = AsyncMock(return_value=0)


@pytest.mark.unit
class TestGetDeckProgressDetail:
    async def test_get_deck_progress_detail_streak_grace_alive(self, mock_db, mock_user_id):
        """Current streak = 3 when studied today and previous two days."""
        today = datetime.now(timezone.utc).date()
        study_days = [today, today - timedelta(days=1), today - timedelta(days=2)]

        patches = _make_full_repo_patches()
        with (
            patches[0] as stats_cls,
            patches[1] as review_cls,
            patches[2],
            patches[3],
            patches[4],
            patches[5] as deck_cls,
            patches[6] as card_rec_cls,
            patches[7],
            patches[8],
        ):
            _setup_deck_detail_mocks(
                stats_cls,
                review_cls,
                deck_cls,
                card_rec_cls,
                study_days=study_days,
            )
            service = ProgressService(mock_db)
            result = await service.get_deck_progress_detail(mock_user_id, mock_user_id)

        assert result.statistics.deck_streak_current == 3

    async def test_get_deck_progress_detail_streak_grace_expired(self, mock_db, mock_user_id):
        """Current streak = 0 and longest streak = 3 when last study was 2+ days ago."""
        today = datetime.now(timezone.utc).date()
        # Last study was today-2, so streak is broken (grace window expired)
        study_days = [
            today - timedelta(days=2),
            today - timedelta(days=3),
            today - timedelta(days=4),
        ]

        patches = _make_full_repo_patches()
        with (
            patches[0] as stats_cls,
            patches[1] as review_cls,
            patches[2],
            patches[3],
            patches[4],
            patches[5] as deck_cls,
            patches[6] as card_rec_cls,
            patches[7],
            patches[8],
        ):
            _setup_deck_detail_mocks(
                stats_cls,
                review_cls,
                deck_cls,
                card_rec_cls,
                study_days=study_days,
            )
            service = ProgressService(mock_db)
            result = await service.get_deck_progress_detail(mock_user_id, mock_user_id)

        assert result.statistics.deck_streak_current == 0
        assert result.statistics.deck_streak_longest == 3

    async def test_get_deck_progress_detail_empty_deck_zeros(self, mock_db, mock_user_id):
        """No study days and no weekly activity yields all-zero streak and activity."""
        patches = _make_full_repo_patches()
        with (
            patches[0] as stats_cls,
            patches[1] as review_cls,
            patches[2],
            patches[3],
            patches[4],
            patches[5] as deck_cls,
            patches[6] as card_rec_cls,
            patches[7],
            patches[8],
        ):
            _setup_deck_detail_mocks(
                stats_cls,
                review_cls,
                deck_cls,
                card_rec_cls,
                study_days=[],
                weekly_activity={},
            )
            service = ProgressService(mock_db)
            result = await service.get_deck_progress_detail(mock_user_id, mock_user_id)

        assert result.statistics.deck_streak_current == 0
        assert result.statistics.deck_streak_longest == 0
        assert result.statistics.weekly_activity == [0, 0, 0, 0, 0, 0, 0]

    async def test_get_deck_progress_detail_weekly_assembly_slot(self, mock_db, mock_user_id):
        """weekly_activity is a 7-element rolling list of bucketed intensities.

        Oldest=index 0, today=index 6. Raw counts are bucketed GitHub-style:
        4 reviews -> level 2, 1 review -> level 1.
        """
        today = datetime.now(timezone.utc).date()
        week_start = today - timedelta(days=6)  # rolling 7-day window start

        weekly_mock = {
            week_start: 4,
            week_start + timedelta(days=2): 1,
        }

        patches = _make_full_repo_patches()
        with (
            patches[0] as stats_cls,
            patches[1] as review_cls,
            patches[2],
            patches[3],
            patches[4],
            patches[5] as deck_cls,
            patches[6] as card_rec_cls,
            patches[7],
            patches[8],
        ):
            _setup_deck_detail_mocks(
                stats_cls,
                review_cls,
                deck_cls,
                card_rec_cls,
                weekly_activity=weekly_mock,
            )
            service = ProgressService(mock_db)
            result = await service.get_deck_progress_detail(mock_user_id, mock_user_id)

        wa = result.statistics.weekly_activity
        assert len(wa) == 7
        assert wa[0] == 2  # window start (6 days ago): 4 reviews -> level 2
        assert wa[2] == 1  # start + 2 days: 1 review -> level 1
        assert wa[1] == 0
        assert wa[3] == 0
        assert wa[4] == 0
        assert wa[5] == 0
        assert wa[6] == 0  # today

    async def test_get_deck_progress_detail_total_study_time_unchanged(self, mock_db, mock_user_id):
        """total_study_time_seconds in statistics equals the value from get_deck_review_stats."""
        expected_time = 9876

        patches = _make_full_repo_patches()
        with (
            patches[0] as stats_cls,
            patches[1] as review_cls,
            patches[2],
            patches[3],
            patches[4],
            patches[5] as deck_cls,
            patches[6] as card_rec_cls,
            patches[7],
            patches[8],
        ):
            _setup_deck_detail_mocks(
                stats_cls,
                review_cls,
                deck_cls,
                card_rec_cls,
                total_study_time_seconds=expected_time,
            )
            service = ProgressService(mock_db)
            result = await service.get_deck_progress_detail(mock_user_id, mock_user_id)

        assert result.statistics.total_study_time_seconds == expected_time


# =============================================================================
# Helpers shared by the cache test classes
# =============================================================================


def _make_real_cache(mock_redis) -> CacheService:
    """Return a CacheService backed by a mock Redis with caching enabled."""
    cache = CacheService(redis_client=mock_redis)
    return cache


def _make_cache_settings_patch():
    """Patch src.core.cache.settings so CacheService sees cache_enabled=True."""
    mock_settings = MagicMock()
    mock_settings.cache_enabled = True
    mock_settings.cache_key_prefix = "cache"
    mock_settings.cache_default_ttl = 300
    mock_settings.cache_user_progress_ttl = 60
    mock_settings.cache_deck_list_ttl = 300
    return patch("src.core.cache.settings", mock_settings)


def _wire_empty_deck_progress_repos(
    stats_cls, review_cls, deck_cls, card_rec_cls, culture_deck_cls
):
    """Wire all repos needed by get_deck_progress_list to return empty results."""
    stats_cls.return_value.get_deck_progress_summaries = AsyncMock(return_value=[])
    review_cls.return_value.get_last_review_by_deck = AsyncMock(return_value={})
    deck_cls.return_value.get_by_ids = AsyncMock(return_value=[])
    card_rec_cls.return_value.count_by_deck = AsyncMock(return_value=0)
    culture_deck_cls.return_value.list_active = AsyncMock(return_value=[])


# =============================================================================
# PERF-05-02: Dashboard read-through cache tests (RED)
# =============================================================================


@pytest.mark.unit
class TestDashboardStatsCache:
    """RED tests for get_dashboard_stats caching (PERF-05-02).

    Pre-implementation: get_cache is not imported in progress_service.py.
    All patches use create=True so they succeed at test collection.
    RED condition: setex is never called (miss/key tests) or compute
    runs twice (hit tests), because caching is not yet wired.
    """

    async def test_get_dashboard_stats_miss_computes_and_stores(self, mock_db, mock_user_id):
        """Cache miss: result must be stored under cache:progress:user:{uid}:dashboard (TTL=60).

        RED: setex call_count == 0 (cache not wired → nothing stored).
        """
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None  # force miss

        real_cache = _make_real_cache(mock_redis)

        patches = _make_full_repo_patches()
        with (
            _make_cache_settings_patch(),
            patch(
                "src.services.progress_service.get_cache",
                return_value=real_cache,
                create=True,
            ),
            patches[0] as s_cls,
            patches[1] as r_cls,
            patches[2] as cs_cls,
            patches[3] as ca_cls,
            patches[4] as me_cls,
            patches[5],
            patches[6],
            patches[7],
            patches[8] as ex_cls,
        ):
            _setup_dashboard_mocks(s_cls, r_cls, cs_cls, ca_cls, me_cls, ex_cls)
            service = ProgressService(mock_db)
            result = await service.get_dashboard_stats(mock_user_id)

        # Must return valid response
        assert isinstance(result, DashboardStatsResponse)

        # RED: setex never called because cache isn't wired yet.
        # Post-impl this will be called once with the correct key and TTL=60.
        expected_key = f"cache:progress:user:{mock_user_id}:dashboard"
        assert mock_redis.setex.call_count == 1, (
            f"Expected setex called once with key {expected_key!r}, "
            f"but call_count={mock_redis.setex.call_count}"
        )
        actual_key, actual_ttl, _payload = mock_redis.setex.call_args[0]
        assert actual_key == expected_key, f"Wrong cache key: {actual_key!r}"
        assert actual_ttl == 60, f"Wrong TTL: {actual_ttl}"

    async def test_get_dashboard_stats_hit_skips_recompute(self, mock_db, mock_user_id):
        """Cache hit: underlying compute must not run a second time.

        RED: card_stats_repo.count_by_status call_count == 2 (called for
        both invocations because caching is not yet wired).
        """
        from src.schemas.progress import OverviewStats, StreakStats, TodayStats

        # Build a minimal cached dict that model_validate can consume
        cached_dashboard = DashboardStatsResponse(
            overview=OverviewStats(
                total_cards_studied=0,
                total_cards_mastered=0,
                total_decks_started=0,
                overall_mastery_percentage=0.0,
            ),
            today=TodayStats(
                reviews_completed=0,
                cards_due=0,
                daily_goal=20,
                goal_progress_percentage=0.0,
                study_time_seconds=0,
            ),
            streak=StreakStats(
                current_streak=0,
                longest_streak=0,
                last_study_date=None,
            ),
            cards_by_status={},
            recent_activity=[],
        )
        cached_dict = cached_dashboard.model_dump(mode="json")

        mock_get_or_set = AsyncMock(return_value=cached_dict)
        mock_cache = MagicMock()
        mock_cache.get_or_set = mock_get_or_set

        patches = _make_full_repo_patches()
        with (
            patch(
                "src.services.progress_service.get_cache",
                return_value=mock_cache,
                create=True,
            ),
            patches[0] as s_cls,
            patches[1] as r_cls,
            patches[2] as cs_cls,
            patches[3] as ca_cls,
            patches[4] as me_cls,
            patches[5],
            patches[6],
            patches[7],
            patches[8] as ex_cls,
        ):
            _setup_dashboard_mocks(s_cls, r_cls, cs_cls, ca_cls, me_cls, ex_cls)
            service = ProgressService(mock_db)
            # Call twice; second call should use cached result
            await service.get_dashboard_stats(mock_user_id)
            await service.get_dashboard_stats(mock_user_id)

        # RED: count_by_status is called for EACH invocation because caching not wired.
        # Post-impl: call_count must be 1 (first call only) → spy reports 0 extra calls.
        # We assert the repo was never called (== 0); pre-impl it will be called twice.
        assert s_cls.return_value.count_by_status.call_count == 0, (
            "Expected count_by_status to be skipped on cache hit, "
            f"but it was called {s_cls.return_value.count_by_status.call_count} time(s)"
        )

    async def test_get_dashboard_stats_recomputes_when_cache_returns_none(
        self, mock_db, mock_user_id
    ):
        """None-guard: when get_or_set returns None, direct compute must still work.

        RED: if none-guard is absent, model_validate(None) raises TypeError.
        Pre-impl: caching not wired so the function just computes normally;
        this test verifies the function itself doesn't break when cache returns None.
        The RED here is subtle: post-impl the None-guard must be present — we
        verify the result is a real DashboardStatsResponse (not None/exception).
        We assert repo IS called (direct compute path ran) even when get_or_set→None.
        """
        mock_get_or_set = AsyncMock(return_value=None)
        mock_cache = MagicMock()
        mock_cache.get_or_set = mock_get_or_set

        patches = _make_full_repo_patches()
        with (
            patch(
                "src.services.progress_service.get_cache",
                return_value=mock_cache,
                create=True,
            ),
            patches[0] as s_cls,
            patches[1] as r_cls,
            patches[2] as cs_cls,
            patches[3] as ca_cls,
            patches[4] as me_cls,
            patches[5],
            patches[6],
            patches[7],
            patches[8] as ex_cls,
        ):
            _setup_dashboard_mocks(s_cls, r_cls, cs_cls, ca_cls, me_cls, ex_cls)
            service = ProgressService(mock_db)
            result = await service.get_dashboard_stats(mock_user_id)

        # Must return a valid DashboardStatsResponse (NOT None, NOT raise)
        assert isinstance(result, DashboardStatsResponse)
        # Repo must have been called (direct compute path executed)
        assert s_cls.return_value.count_by_status.call_count >= 1

    async def test_dashboard_cache_key_is_per_user(self, mock_db):
        """Two users produce two distinct cache keys.

        RED: setex not called at all pre-impl (never called for either user).
        """
        uid_a = uuid4()
        uid_b = uuid4()

        mock_redis = AsyncMock()
        mock_redis.get.return_value = None  # force miss for both

        real_cache = _make_real_cache(mock_redis)

        patches_a = _make_full_repo_patches()

        with (
            _make_cache_settings_patch(),
            patch(
                "src.services.progress_service.get_cache",
                return_value=real_cache,
                create=True,
            ),
            patches_a[0] as s_cls_a,
            patches_a[1] as r_cls_a,
            patches_a[2] as cs_cls_a,
            patches_a[3] as ca_cls_a,
            patches_a[4] as me_cls_a,
            patches_a[5],
            patches_a[6],
            patches_a[7],
            patches_a[8] as ex_cls_a,
        ):
            _setup_dashboard_mocks(s_cls_a, r_cls_a, cs_cls_a, ca_cls_a, me_cls_a, ex_cls_a)
            service = ProgressService(mock_db)
            await service.get_dashboard_stats(uid_a)
            await service.get_dashboard_stats(uid_b)

        # Collect all keys passed to setex
        setex_calls = mock_redis.setex.call_args_list
        # RED: setex never called pre-impl → assertion below fails
        assert (
            len(setex_calls) == 2
        ), f"Expected 2 setex calls (one per user), got {len(setex_calls)}"
        keys = [call[0][0] for call in setex_calls]
        assert any(str(uid_a) in k for k in keys), f"uid_a not found in keys: {keys}"
        assert any(str(uid_b) in k for k in keys), f"uid_b not found in keys: {keys}"
        assert keys[0] != keys[1], "Expected distinct cache keys per user"


# =============================================================================
# PERF-05-03a: Deck-progress-list read-through cache tests (RED)
# =============================================================================


@pytest.mark.unit
class TestDeckProgressListCache:
    """RED tests for get_deck_progress_list caching (PERF-05-03).

    Same RED strategy as TestDashboardStatsCache.
    """

    async def test_get_deck_progress_list_miss_computes_and_stores(self, mock_db, mock_user_id):
        """Cache miss: result stored under cache:progress:user:{uid}:decks:2:10 (TTL=60).

        RED: setex call_count == 0 pre-impl.
        """
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None

        real_cache = _make_real_cache(mock_redis)

        patches = _make_full_repo_patches()
        with (
            _make_cache_settings_patch(),
            patch(
                "src.services.progress_service.get_cache",
                return_value=real_cache,
                create=True,
            ),
            patches[0] as stats_cls,
            patches[1] as review_cls,
            patches[2],
            patches[3],
            patches[4],
            patches[5] as deck_cls,
            patches[6] as card_rec_cls,
            patches[7] as culture_deck_cls,
            patches[8],
        ):
            _wire_empty_deck_progress_repos(
                stats_cls, review_cls, deck_cls, card_rec_cls, culture_deck_cls
            )
            service = ProgressService(mock_db)
            result = await service.get_deck_progress_list(mock_user_id, page=2, page_size=10)

        assert isinstance(result, DeckProgressListResponse)

        expected_key = f"cache:progress:user:{mock_user_id}:decks:2:10"
        # RED: setex never called pre-impl → call_count == 0, assertion fails
        assert mock_redis.setex.call_count == 1, (
            f"Expected setex called once with key {expected_key!r}, "
            f"but call_count={mock_redis.setex.call_count}"
        )
        actual_key, actual_ttl, _payload = mock_redis.setex.call_args[0]
        assert actual_key == expected_key, f"Wrong cache key: {actual_key!r}"
        assert actual_ttl == 60, f"Wrong TTL: {actual_ttl}"

    async def test_get_deck_progress_list_hit_skips_recompute(self, mock_db, mock_user_id):
        """Cache hit: compute must not run a second time.

        RED: get_deck_progress_summaries call_count == 2 pre-impl.
        """
        cached_list = DeckProgressListResponse(total=0, page=1, page_size=20, decks=[])
        cached_dict = cached_list.model_dump(mode="json")

        mock_get_or_set = AsyncMock(return_value=cached_dict)
        mock_cache = MagicMock()
        mock_cache.get_or_set = mock_get_or_set

        patches = _make_full_repo_patches()
        with (
            patch(
                "src.services.progress_service.get_cache",
                return_value=mock_cache,
                create=True,
            ),
            patches[0] as stats_cls,
            patches[1] as review_cls,
            patches[2],
            patches[3],
            patches[4],
            patches[5] as deck_cls,
            patches[6] as card_rec_cls,
            patches[7] as culture_deck_cls,
            patches[8],
        ):
            _wire_empty_deck_progress_repos(
                stats_cls, review_cls, deck_cls, card_rec_cls, culture_deck_cls
            )
            service = ProgressService(mock_db)
            await service.get_deck_progress_list(mock_user_id)
            await service.get_deck_progress_list(mock_user_id)

        # RED: called twice (once per invocation) because no caching wired
        assert stats_cls.return_value.get_deck_progress_summaries.call_count == 0, (
            "Expected get_deck_progress_summaries skipped on cache hit, "
            f"got {stats_cls.return_value.get_deck_progress_summaries.call_count} call(s)"
        )

    async def test_get_deck_progress_list_recomputes_when_cache_none(self, mock_db, mock_user_id):
        """None-guard: get_or_set→None must fall back to direct compute.

        RED mechanism: this test passes pre-impl (function computes normally),
        but verifies the post-impl None-guard doesn't break things either.
        We assert result is valid AND repo was called (compute path ran).
        """
        mock_get_or_set = AsyncMock(return_value=None)
        mock_cache = MagicMock()
        mock_cache.get_or_set = mock_get_or_set

        patches = _make_full_repo_patches()
        with (
            patch(
                "src.services.progress_service.get_cache",
                return_value=mock_cache,
                create=True,
            ),
            patches[0] as stats_cls,
            patches[1] as review_cls,
            patches[2],
            patches[3],
            patches[4],
            patches[5] as deck_cls,
            patches[6] as card_rec_cls,
            patches[7] as culture_deck_cls,
            patches[8],
        ):
            _wire_empty_deck_progress_repos(
                stats_cls, review_cls, deck_cls, card_rec_cls, culture_deck_cls
            )
            service = ProgressService(mock_db)
            result = await service.get_deck_progress_list(mock_user_id)

        assert isinstance(result, DeckProgressListResponse)
        # Repo must be called (direct compute executed)
        assert stats_cls.return_value.get_deck_progress_summaries.call_count >= 1

    async def test_deck_progress_key_includes_page_and_page_size(self, mock_db, mock_user_id):
        """Cache key must encode page and page_size: :decks:3:50 and :decks:1:20.

        RED: setex never called pre-impl; assertion on call_count fails.
        """
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None

        real_cache = _make_real_cache(mock_redis)

        patches = _make_full_repo_patches()
        with (
            _make_cache_settings_patch(),
            patch(
                "src.services.progress_service.get_cache",
                return_value=real_cache,
                create=True,
            ),
            patches[0] as stats_cls,
            patches[1] as review_cls,
            patches[2],
            patches[3],
            patches[4],
            patches[5] as deck_cls,
            patches[6] as card_rec_cls,
            patches[7] as culture_deck_cls,
            patches[8],
        ):
            _wire_empty_deck_progress_repos(
                stats_cls, review_cls, deck_cls, card_rec_cls, culture_deck_cls
            )
            service = ProgressService(mock_db)
            await service.get_deck_progress_list(mock_user_id, page=3, page_size=50)
            await service.get_deck_progress_list(mock_user_id, page=1, page_size=20)

        setex_calls = mock_redis.setex.call_args_list
        # RED: 0 calls pre-impl
        assert len(setex_calls) == 2, f"Expected 2 setex calls, got {len(setex_calls)}"
        keys = [call[0][0] for call in setex_calls]
        assert any(":decks:3:50" in k for k in keys), f":decks:3:50 not in keys: {keys}"
        assert any(":decks:1:20" in k for k in keys), f":decks:1:20 not in keys: {keys}"


# =============================================================================
# PERF-05-06 Gap 2 — Explicit factory-raises / None-guard surfaces real error (AC#4)
# =============================================================================


@pytest.mark.unit
class TestNoneGuardSurfacesRealError:
    """PERF-05-06 plan item 2 / AC#4 — when get_or_set swallows the factory
    exception (returning None), the None-guard recomputes by calling the
    underlying compute directly.  That second call also raises because the
    error is persistent (e.g. a DB failure), so the ORIGINAL error type
    must propagate — NOT a pydantic.ValidationError.

    Mechanism:
    1. mock_redis.get.return_value = None  →  cache miss  →  get_or_set calls factory
    2. _compute_* is patched to raise RuntimeError  →  factory raises  →
       get_or_set catches and returns None
    3. None-guard recomputes by calling _compute_* directly  →  raises again  →
       propagates to the caller as RuntimeError (not ValidationError)

    The compute runs twice total (factory + guard); we assert error type, not
    call count.
    """

    async def test_get_dashboard_stats_surfaces_db_error_not_validation_error(
        self, mock_db, mock_user_id
    ):
        """RuntimeError from _compute_dashboard_stats propagates through None-guard.

        Strategy: real CacheService(redis_client=mock_redis) with cache_enabled=True
        so the full get_or_set path runs.  _compute_dashboard_stats is patched with
        side_effect=RuntimeError so both the factory call AND the None-guard recompute
        raise, causing the error to surface.
        """
        import pydantic

        mock_redis = AsyncMock()
        mock_redis.get.return_value = None  # force miss → get_or_set calls factory

        real_cache = _make_real_cache(mock_redis)

        with (
            _make_cache_settings_patch(),
            patch(
                "src.services.progress_service.get_cache",
                return_value=real_cache,
                create=True,
            ),
            patch.object(
                ProgressService,
                "_compute_dashboard_stats",
                new=AsyncMock(side_effect=RuntimeError("simulated DB failure")),
            ),
        ):
            service = ProgressService(mock_db)
            with pytest.raises(RuntimeError, match="simulated DB failure") as exc_info:
                await service.get_dashboard_stats(mock_user_id)

        # The raised exception must NOT be a pydantic ValidationError
        assert not isinstance(
            exc_info.value, pydantic.ValidationError
        ), "None-guard must surface the original RuntimeError, not wrap it in ValidationError"

    async def test_get_deck_progress_list_surfaces_db_error_not_validation_error(
        self, mock_db, mock_user_id
    ):
        """RuntimeError from _compute_deck_progress_list propagates through None-guard.

        Same mechanism as the dashboard test: patch _compute_deck_progress_list to
        raise on both the factory invocation and the None-guard recompute.
        """
        import pydantic

        mock_redis = AsyncMock()
        mock_redis.get.return_value = None  # force miss

        real_cache = _make_real_cache(mock_redis)

        with (
            _make_cache_settings_patch(),
            patch(
                "src.services.progress_service.get_cache",
                return_value=real_cache,
                create=True,
            ),
            patch.object(
                ProgressService,
                "_compute_deck_progress_list",
                new=AsyncMock(side_effect=RuntimeError("simulated DB failure")),
            ),
        ):
            service = ProgressService(mock_db)
            with pytest.raises(RuntimeError, match="simulated DB failure") as exc_info:
                await service.get_deck_progress_list(mock_user_id)

        assert not isinstance(
            exc_info.value, pydantic.ValidationError
        ), "None-guard must surface the original RuntimeError, not wrap it in ValidationError"
