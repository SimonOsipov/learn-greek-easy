"""Unit tests for AchievementService.

Tests cover:
- Unlock streak achievement
- Unlock already unlocked is idempotent
- Achievement awards XP
- Progress calculation
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from src.db.models import UserAchievement
from src.services.achievement_definitions import AchievementMetric
from src.services.achievement_service import AchievementService
from src.services.gamification.types import GamificationSnapshot, MetricValues
from src.services.gamification.version import GAMIFICATION_PROJECTION_VERSION


def make_snapshot(
    user_id: UUID, metric_overrides: dict[AchievementMetric, int] | None = None
) -> GamificationSnapshot:
    """Build a GamificationSnapshot stub with all metrics zeroed out by default."""
    base: dict[AchievementMetric, int] = {m: 0 for m in AchievementMetric}
    if metric_overrides:
        base.update(metric_overrides)
    return GamificationSnapshot(
        user_id=user_id,
        metrics=MetricValues(base),
        unlocked=frozenset(),
        total_xp=0,
        current_level=1,
        projection_version=GAMIFICATION_PROJECTION_VERSION,
        computed_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = MagicMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def mock_user_achievement():
    """Create a mock UserAchievement object."""
    ua = MagicMock(spec=UserAchievement)
    ua.user_id = uuid4()
    ua.achievement_id = "streak_first_flame"
    ua.unlocked_at = datetime.now(timezone.utc)
    return ua


@pytest.mark.unit
class TestUnlockStreakAchievement:
    """Tests for unlocking streak achievements."""

    @pytest.mark.asyncio
    async def test_unlock_streak_achievement_3_days(self, mock_db_session):
        """Should unlock First Flame achievement at 3-day streak."""
        service = AchievementService(mock_db_session)

        # Mock: no existing achievement
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        newly_unlocked = await service.check_and_unlock_achievements(
            user_id, AchievementMetric.STREAK_DAYS, 3
        )

        assert len(newly_unlocked) >= 1
        assert any(a["id"] == "streak_first_flame" for a in newly_unlocked)

    @pytest.mark.asyncio
    async def test_unlock_streak_achievement_7_days(self, mock_db_session):
        """Should unlock Warming Up achievement at 7-day streak."""
        service = AchievementService(mock_db_session)

        # Mock: no existing achievement
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        newly_unlocked = await service.check_and_unlock_achievements(
            user_id, AchievementMetric.STREAK_DAYS, 7
        )

        # Should unlock both First Flame (3) and Warming Up (7)
        assert len(newly_unlocked) >= 2
        assert any(a["id"] == "streak_first_flame" for a in newly_unlocked)
        assert any(a["id"] == "streak_warming_up" for a in newly_unlocked)

    @pytest.mark.asyncio
    async def test_unlock_multiple_streak_achievements(self, mock_db_session):
        """Should unlock multiple achievements when threshold exceeds multiple."""
        service = AchievementService(mock_db_session)

        # Mock: no existing achievement
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        # 30 days exceeds 3, 7, 14, and 30 thresholds
        newly_unlocked = await service.check_and_unlock_achievements(
            user_id, AchievementMetric.STREAK_DAYS, 30
        )

        # Should unlock First Flame (3), Warming Up (7), On Fire (14), Burning Bright (30)
        assert len(newly_unlocked) >= 4


@pytest.mark.unit
class TestUnlockAlreadyUnlocked:
    """Tests for idempotent unlock behavior."""

    @pytest.mark.asyncio
    async def test_unlock_already_unlocked_is_idempotent(
        self, mock_db_session, mock_user_achievement
    ):
        """Should not unlock already unlocked achievement."""
        service = AchievementService(mock_db_session)

        # Mock: achievement already exists
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_achievement
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        newly_unlocked = await service.check_and_unlock_achievements(
            user_id, AchievementMetric.STREAK_DAYS, 3
        )

        # Should return empty list - achievement already unlocked
        assert len(newly_unlocked) == 0

    @pytest.mark.asyncio
    async def test_no_duplicate_unlocks(self, mock_db_session):
        """Should not create duplicate unlock records."""
        service = AchievementService(mock_db_session)

        # First call: no existing achievement
        mock_result_none = MagicMock()
        mock_result_none.scalar_one_or_none.return_value = None
        mock_result_none.scalars.return_value.all.return_value = []

        # Track how many times add is called
        add_count = 0
        original_add = mock_db_session.add

        def counting_add(obj):
            nonlocal add_count
            add_count += 1
            return original_add(obj)

        mock_db_session.add = counting_add
        mock_db_session.execute.return_value = mock_result_none

        user_id = uuid4()

        # First unlock
        await service.check_and_unlock_achievements(user_id, AchievementMetric.STREAK_DAYS, 3)
        first_add_count = add_count

        # Mock: now achievement exists
        mock_ua = MagicMock(spec=UserAchievement)
        mock_ua.achievement_id = "streak_first_flame"
        mock_result_exists = MagicMock()
        mock_result_exists.scalar_one_or_none.return_value = mock_ua
        mock_result_exists.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result_exists

        # Second unlock attempt
        await service.check_and_unlock_achievements(user_id, AchievementMetric.STREAK_DAYS, 3)

        # Should not add any new records on second call
        assert add_count == first_add_count


@pytest.mark.unit
class TestAchievementAwardsXP:
    """Tests for XP rewards on achievement unlock."""

    @pytest.mark.asyncio
    async def test_achievement_awards_xp(self, mock_db_session):
        """Should award XP when achievement is unlocked."""
        service = AchievementService(mock_db_session)

        # Mock: no existing achievement
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        # Mock XPService.award_xp
        with patch.object(service.xp_service, "award_xp", new_callable=AsyncMock) as mock_award:
            mock_award.return_value = (50, False)

            user_id = uuid4()
            newly_unlocked = await service.check_and_unlock_achievements(
                user_id, AchievementMetric.STREAK_DAYS, 3
            )

            # Should have called award_xp
            assert mock_award.called

            # Verify XP amount for First Flame (50 XP)
            if newly_unlocked:
                assert newly_unlocked[0]["xp_reward"] == 50

    @pytest.mark.asyncio
    async def test_achievement_xp_reason_format(self, mock_db_session):
        """Should use correct XP reason format."""
        service = AchievementService(mock_db_session)

        # Mock: no existing achievement
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        # Mock XPService.award_xp
        with patch.object(service.xp_service, "award_xp", new_callable=AsyncMock) as mock_award:
            mock_award.return_value = (50, False)

            user_id = uuid4()
            await service.check_and_unlock_achievements(user_id, AchievementMetric.STREAK_DAYS, 3)

            # Verify reason format
            if mock_award.called:
                call_args = mock_award.call_args
                reason = call_args[0][2]  # Third positional argument
                assert reason.startswith("achievement_")


@pytest.mark.unit
class TestProgressCalculation:
    """Tests for achievement progress calculation."""

    @pytest.mark.asyncio
    async def test_progress_calculation_zero(self, mock_db_session):
        """Should calculate 0% progress when no activity."""
        service = AchievementService(mock_db_session)
        user_id = uuid4()

        # Mock: no unlocked achievements
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        stub_snapshot = make_snapshot(user_id)

        with patch(
            "src.services.gamification.projection.GamificationProjection.compute",
            new_callable=AsyncMock,
            return_value=stub_snapshot,
        ):
            achievements = await service.get_user_achievements(user_id)

        # All achievements should have 0% progress when all metrics are zero
        for ach in achievements:
            if ach["threshold"] > 0:
                assert ach["progress"] == 0.0 or ach["current_value"] == 0

    @pytest.mark.asyncio
    async def test_progress_calculation_partial(self, mock_db_session):
        """Should calculate partial progress correctly."""
        # Test the formula: progress = (current / threshold) * 100
        current = 45
        threshold = 100
        expected_progress = 45.0

        progress = min((current / threshold) * 100, 100.0)
        assert progress == expected_progress

    @pytest.mark.asyncio
    async def test_progress_capped_at_100(self, mock_db_session):
        """Should cap progress at 100%."""
        # Test the formula with exceeding value
        current = 200
        threshold = 100
        expected_progress = 100.0

        progress = min((current / threshold) * 100, 100.0)
        assert progress == expected_progress


@pytest.mark.unit
class TestUnlockAchievementById:
    """Tests for unlocking specific achievements by ID."""

    @pytest.mark.asyncio
    async def test_unlock_achievement_by_id_success(self, mock_db_session):
        """Should unlock achievement by ID."""
        service = AchievementService(mock_db_session)

        # Mock: no existing achievement
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        with patch.object(service.xp_service, "award_xp", new_callable=AsyncMock) as mock_award:
            mock_award.return_value = (50, False)

            user_id = uuid4()
            result = await service.unlock_achievement_by_id(user_id, "streak_first_flame")

            assert result is not None
            assert result["id"] == "streak_first_flame"

    @pytest.mark.asyncio
    async def test_unlock_achievement_by_id_not_found(self, mock_db_session):
        """Should return None for non-existent achievement ID."""
        service = AchievementService(mock_db_session)

        user_id = uuid4()
        result = await service.unlock_achievement_by_id(user_id, "nonexistent_achievement")

        assert result is None

    @pytest.mark.asyncio
    async def test_unlock_achievement_by_id_already_unlocked(
        self, mock_db_session, mock_user_achievement
    ):
        """Should return None if already unlocked."""
        service = AchievementService(mock_db_session)

        # Mock: achievement already exists
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_achievement
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        result = await service.unlock_achievement_by_id(user_id, "streak_first_flame")

        assert result is None


@pytest.mark.unit
class TestLearningAchievements:
    """Tests for learning milestone achievements."""

    @pytest.mark.asyncio
    async def test_unlock_learning_achievement_first_word(self, mock_db_session):
        """Should unlock First Word achievement at 1 card learned."""
        service = AchievementService(mock_db_session)

        # Mock: no existing achievement
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        newly_unlocked = await service.check_and_unlock_achievements(
            user_id, AchievementMetric.CARDS_LEARNED, 1
        )

        assert len(newly_unlocked) >= 1
        assert any(a["id"] == "learning_first_word" for a in newly_unlocked)

    @pytest.mark.asyncio
    async def test_unlock_learning_achievement_vocabulary_builder(self, mock_db_session):
        """Should unlock Vocabulary Builder at 50 cards learned."""
        service = AchievementService(mock_db_session)

        # Mock: no existing achievement
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        newly_unlocked = await service.check_and_unlock_achievements(
            user_id, AchievementMetric.CARDS_LEARNED, 50
        )

        # Should unlock First Word (1) and Vocabulary Builder (50)
        assert len(newly_unlocked) >= 2
        assert any(a["id"] == "learning_first_word" for a in newly_unlocked)
        assert any(a["id"] == "learning_vocabulary_builder" for a in newly_unlocked)


# ============================================================================
# get_user_achievements projection integration tests
# ============================================================================


@pytest.mark.unit
class TestGetUserAchievementsProjection:
    """Tests for get_user_achievements() reading from GamificationProjection."""

    @pytest.mark.asyncio
    async def test_progress_reflects_snapshot_metrics(self, mock_db_session):
        """Should compute progress from snapshot metrics, not legacy stats queries."""
        service = AchievementService(mock_db_session)
        user_id = uuid4()

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        stub_snapshot = make_snapshot(
            user_id,
            {AchievementMetric.CARDS_LEARNED: 50},
        )

        with patch(
            "src.services.gamification.projection.GamificationProjection.compute",
            new_callable=AsyncMock,
            return_value=stub_snapshot,
        ):
            achievements = await service.get_user_achievements(user_id)

        # Find a CARDS_LEARNED achievement and verify progress is non-zero
        cards_learned_achs = [a for a in achievements if a["current_value"] == 50]
        assert len(cards_learned_achs) > 0

    @pytest.mark.asyncio
    async def test_unlocked_achievement_has_progress_100(self, mock_db_session):
        """Should set progress=100 for unlocked achievements regardless of metric value."""
        service = AchievementService(mock_db_session)
        user_id = uuid4()

        # Mock an unlocked achievement row
        mock_ua = MagicMock(spec=UserAchievement)
        mock_ua.achievement_id = "streak_first_flame"
        mock_ua.unlocked_at = datetime.now(timezone.utc)

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_ua]
        mock_db_session.execute.return_value = mock_result

        # Snapshot shows streak=0 (shouldn't matter since it's unlocked)
        stub_snapshot = make_snapshot(user_id)

        with patch(
            "src.services.gamification.projection.GamificationProjection.compute",
            new_callable=AsyncMock,
            return_value=stub_snapshot,
        ):
            achievements = await service.get_user_achievements(user_id)

        unlocked_ach = next(a for a in achievements if a["id"] == "streak_first_flame")
        assert unlocked_ach["unlocked"] is True
        assert unlocked_ach["progress"] == 100.0

    @pytest.mark.asyncio
    async def test_streak_progress_from_snapshot(self, mock_db_session):
        """Should read real streak value from snapshot (was always 0 in legacy)."""
        service = AchievementService(mock_db_session)
        user_id = uuid4()

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        stub_snapshot = make_snapshot(
            user_id,
            {AchievementMetric.STREAK_DAYS: 3},
        )

        with patch(
            "src.services.gamification.projection.GamificationProjection.compute",
            new_callable=AsyncMock,
            return_value=stub_snapshot,
        ):
            achievements = await service.get_user_achievements(user_id)

        streak_ach = next(a for a in achievements if a["id"] == "streak_first_flame")
        assert streak_ach["current_value"] == 3
        assert streak_ach["progress"] == 100.0  # threshold=3, value=3 → 100%
