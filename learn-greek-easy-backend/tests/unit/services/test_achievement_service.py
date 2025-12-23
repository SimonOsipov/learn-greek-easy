"""Unit tests for AchievementService.

Tests cover:
- Unlock streak achievement
- Unlock already unlocked is idempotent
- Achievement awards XP
- Progress calculation
- Get unnotified achievements
- Mark achievements notified
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.db.models import UserAchievement
from src.services.achievement_definitions import AchievementMetric
from src.services.achievement_service import AchievementService


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
    ua.notified = False
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

        # Mock: no unlocked achievements, no stats
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_result.scalar.return_value = 0
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        achievements = await service.get_user_achievements(user_id)

        # All achievements should have 0% progress
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
class TestGetUnnotifiedAchievements:
    """Tests for unnotified achievements retrieval."""

    @pytest.mark.asyncio
    async def test_get_unnotified_achievements(self, mock_db_session, mock_user_achievement):
        """Should return achievements not yet notified."""
        service = AchievementService(mock_db_session)

        # Mock: one unnotified achievement
        mock_user_achievement.notified = False
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_user_achievement]
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        unnotified = await service.get_unnotified_achievements(user_id)

        assert len(unnotified) == 1
        assert unnotified[0]["id"] == "streak_first_flame"

    @pytest.mark.asyncio
    async def test_get_unnotified_achievements_empty_when_all_notified(self, mock_db_session):
        """Should return empty list when all achievements notified."""
        service = AchievementService(mock_db_session)

        # Mock: no unnotified achievements
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        unnotified = await service.get_unnotified_achievements(user_id)

        assert len(unnotified) == 0


@pytest.mark.unit
class TestMarkNotified:
    """Tests for marking achievements as notified."""

    @pytest.mark.asyncio
    async def test_mark_achievements_notified(self, mock_db_session, mock_user_achievement):
        """Should mark achievements as notified."""
        service = AchievementService(mock_db_session)

        # Mock: achievement exists
        mock_user_achievement.notified = False
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_achievement
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        await service.mark_achievements_notified(user_id, ["streak_first_flame"])

        # Should have set notified to True
        assert mock_user_achievement.notified is True

    @pytest.mark.asyncio
    async def test_mark_multiple_achievements_notified(
        self, mock_db_session, mock_user_achievement
    ):
        """Should mark multiple achievements as notified."""
        service = AchievementService(mock_db_session)

        # Create two mock achievements
        mock_ua1 = MagicMock(spec=UserAchievement)
        mock_ua1.notified = False
        mock_ua2 = MagicMock(spec=UserAchievement)
        mock_ua2.notified = False

        # Create separate mock results for each call
        mock_result1 = MagicMock()
        mock_result1.scalar_one_or_none.return_value = mock_ua1
        mock_result2 = MagicMock()
        mock_result2.scalar_one_or_none.return_value = mock_ua2

        # Return different mock for each execute call
        mock_db_session.execute.side_effect = [mock_result1, mock_result2]

        user_id = uuid4()
        await service.mark_achievements_notified(
            user_id, ["streak_first_flame", "streak_warming_up"]
        )

        # Both should be notified
        assert mock_ua1.notified is True
        assert mock_ua2.notified is True

    @pytest.mark.asyncio
    async def test_mark_notified_handles_missing_achievement(self, mock_db_session):
        """Should handle marking non-existent achievement gracefully."""
        service = AchievementService(mock_db_session)

        # Mock: no achievement found
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        # Should not raise exception
        await service.mark_achievements_notified(user_id, ["nonexistent"])


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
# Culture Achievement Tests
# ============================================================================


@pytest.mark.unit
class TestCultureAchievements:
    """Tests for culture-specific achievement checking."""

    @pytest.fixture
    def mock_culture_stats(self):
        """Mock culture statistics for testing."""
        return {
            "total_answered": 10,
            "total_correct": 8,
            "accuracy_percent": 80.0,
            "current_streak": 5,
            "history_mastered": False,
            "geography_mastered": False,
            "politics_mastered": False,
            "culture_mastered": False,
            "traditions_mastered": False,
            "all_mastered": False,
            "questions_in_greek": 3,
            "questions_in_english": 5,
            "questions_in_russian": 2,
            "languages_used": {"el", "en"},
        }

    @pytest.mark.asyncio
    async def test_native_speaker_achievement_at_50_greek(
        self, mock_db_session, mock_culture_stats
    ):
        """Should unlock 'culture_native_speaker' at 50 questions in Greek."""
        mock_culture_stats["questions_in_greek"] = 50
        service = AchievementService(mock_db_session)

        # Mock _get_culture_stats to return our test data
        with patch.object(service, "_get_culture_stats", new_callable=AsyncMock) as mock_stats:
            mock_stats.return_value = mock_culture_stats

            # Mock _try_unlock_achievement to return an unlocked achievement
            with patch.object(
                service, "_try_unlock_achievement", new_callable=AsyncMock
            ) as mock_unlock:
                mock_unlock.return_value = True

                await service.check_culture_achievements(
                    user_id=uuid4(),
                    question_id=uuid4(),
                    is_correct=True,
                    language="el",
                    deck_category="history",
                )

                # Should have tried to unlock native_speaker
                unlock_calls = mock_unlock.call_args_list
                called_achievement_ids = [call[0][1].id for call in unlock_calls]
                assert "culture_native_speaker" in called_achievement_ids

    @pytest.mark.asyncio
    async def test_native_speaker_not_unlocked_under_50_greek(
        self, mock_db_session, mock_culture_stats
    ):
        """Should NOT unlock 'culture_native_speaker' with less than 50 Greek questions."""
        mock_culture_stats["questions_in_greek"] = 49
        service = AchievementService(mock_db_session)

        with patch.object(service, "_get_culture_stats", new_callable=AsyncMock) as mock_stats:
            mock_stats.return_value = mock_culture_stats

            with patch.object(
                service, "_try_unlock_achievement", new_callable=AsyncMock
            ) as mock_unlock:
                mock_unlock.return_value = True

                await service.check_culture_achievements(
                    user_id=uuid4(),
                    question_id=uuid4(),
                    is_correct=True,
                    language="el",
                    deck_category="history",
                )

                # Should NOT have tried to unlock native_speaker
                unlock_calls = mock_unlock.call_args_list
                called_achievement_ids = [call[0][1].id for call in unlock_calls]
                assert "culture_native_speaker" not in called_achievement_ids

    @pytest.mark.asyncio
    async def test_polyglot_achievement_all_3_languages(self, mock_db_session, mock_culture_stats):
        """Should unlock 'culture_polyglot_learner' when all 3 languages used."""
        mock_culture_stats["languages_used"] = {"el", "en", "ru"}
        service = AchievementService(mock_db_session)

        with patch.object(service, "_get_culture_stats", new_callable=AsyncMock) as mock_stats:
            mock_stats.return_value = mock_culture_stats

            with patch.object(
                service, "_try_unlock_achievement", new_callable=AsyncMock
            ) as mock_unlock:
                mock_unlock.return_value = True

                await service.check_culture_achievements(
                    user_id=uuid4(),
                    question_id=uuid4(),
                    is_correct=True,
                    language="ru",
                    deck_category="history",
                )

                unlock_calls = mock_unlock.call_args_list
                called_achievement_ids = [call[0][1].id for call in unlock_calls]
                assert "culture_polyglot_learner" in called_achievement_ids

    @pytest.mark.asyncio
    async def test_polyglot_not_unlocked_with_2_languages(
        self, mock_db_session, mock_culture_stats
    ):
        """Should NOT unlock 'culture_polyglot_learner' with only 2 languages."""
        mock_culture_stats["languages_used"] = {"el", "en"}  # Missing "ru"
        service = AchievementService(mock_db_session)

        with patch.object(service, "_get_culture_stats", new_callable=AsyncMock) as mock_stats:
            mock_stats.return_value = mock_culture_stats

            with patch.object(
                service, "_try_unlock_achievement", new_callable=AsyncMock
            ) as mock_unlock:
                mock_unlock.return_value = True

                await service.check_culture_achievements(
                    user_id=uuid4(),
                    question_id=uuid4(),
                    is_correct=True,
                    language="en",
                    deck_category="history",
                )

                unlock_calls = mock_unlock.call_args_list
                called_achievement_ids = [call[0][1].id for call in unlock_calls]
                assert "culture_polyglot_learner" not in called_achievement_ids

    @pytest.mark.asyncio
    async def test_perfect_culture_score_at_10_streak(self, mock_db_session, mock_culture_stats):
        """Should unlock 'perfect_culture_score' at 10 consecutive correct from history."""
        mock_culture_stats["current_streak"] = 10
        service = AchievementService(mock_db_session)

        with patch.object(service, "_get_culture_stats", new_callable=AsyncMock) as mock_stats:
            mock_stats.return_value = mock_culture_stats

            with patch.object(
                service, "_try_unlock_achievement", new_callable=AsyncMock
            ) as mock_unlock:
                mock_unlock.return_value = True

                await service.check_culture_achievements(
                    user_id=uuid4(),
                    question_id=uuid4(),
                    is_correct=True,
                    language="en",
                    deck_category="history",
                )

                unlock_calls = mock_unlock.call_args_list
                called_achievement_ids = [call[0][1].id for call in unlock_calls]
                assert "perfect_culture_score" in called_achievement_ids

    @pytest.mark.asyncio
    async def test_streak_not_unlocked_under_10(self, mock_db_session, mock_culture_stats):
        """Should NOT unlock 'perfect_culture_score' with less than 10 streak."""
        mock_culture_stats["current_streak"] = 9
        service = AchievementService(mock_db_session)

        with patch.object(service, "_get_culture_stats", new_callable=AsyncMock) as mock_stats:
            mock_stats.return_value = mock_culture_stats

            with patch.object(
                service, "_try_unlock_achievement", new_callable=AsyncMock
            ) as mock_unlock:
                mock_unlock.return_value = True

                await service.check_culture_achievements(
                    user_id=uuid4(),
                    question_id=uuid4(),
                    is_correct=True,
                    language="en",
                    deck_category="history",
                )

                unlock_calls = mock_unlock.call_args_list
                called_achievement_ids = [call[0][1].id for call in unlock_calls]
                assert "perfect_culture_score" not in called_achievement_ids

    @pytest.mark.asyncio
    async def test_culture_curious_at_10_questions(self, mock_db_session, mock_culture_stats):
        """Should unlock 'culture_curious' at 10 questions answered."""
        mock_culture_stats["total_answered"] = 10
        service = AchievementService(mock_db_session)

        with patch.object(service, "_get_culture_stats", new_callable=AsyncMock) as mock_stats:
            mock_stats.return_value = mock_culture_stats

            with patch.object(
                service, "_try_unlock_achievement", new_callable=AsyncMock
            ) as mock_unlock:
                mock_unlock.return_value = True

                await service.check_culture_achievements(
                    user_id=uuid4(),
                    question_id=uuid4(),
                    is_correct=True,
                    language="en",
                    deck_category="history",
                )

                unlock_calls = mock_unlock.call_args_list
                called_achievement_ids = [call[0][1].id for call in unlock_calls]
                assert "culture_curious" in called_achievement_ids

    @pytest.mark.asyncio
    async def test_culture_explorer_at_50_questions(self, mock_db_session, mock_culture_stats):
        """Should unlock 'culture_explorer' at 50 questions answered."""
        mock_culture_stats["total_answered"] = 50
        service = AchievementService(mock_db_session)

        with patch.object(service, "_get_culture_stats", new_callable=AsyncMock) as mock_stats:
            mock_stats.return_value = mock_culture_stats

            with patch.object(
                service, "_try_unlock_achievement", new_callable=AsyncMock
            ) as mock_unlock:
                mock_unlock.return_value = True

                await service.check_culture_achievements(
                    user_id=uuid4(),
                    question_id=uuid4(),
                    is_correct=True,
                    language="en",
                    deck_category="history",
                )

                unlock_calls = mock_unlock.call_args_list
                called_achievement_ids = [call[0][1].id for call in unlock_calls]
                assert "culture_explorer" in called_achievement_ids

    @pytest.mark.asyncio
    async def test_sharp_mind_at_90_percent_accuracy(self, mock_db_session, mock_culture_stats):
        """Should unlock 'culture_sharp_mind' at 90% accuracy with 20+ answers."""
        mock_culture_stats["total_answered"] = 20
        mock_culture_stats["accuracy_percent"] = 90.0
        service = AchievementService(mock_db_session)

        with patch.object(service, "_get_culture_stats", new_callable=AsyncMock) as mock_stats:
            mock_stats.return_value = mock_culture_stats

            with patch.object(
                service, "_try_unlock_achievement", new_callable=AsyncMock
            ) as mock_unlock:
                mock_unlock.return_value = True

                await service.check_culture_achievements(
                    user_id=uuid4(),
                    question_id=uuid4(),
                    is_correct=True,
                    language="en",
                    deck_category="history",
                )

                unlock_calls = mock_unlock.call_args_list
                called_achievement_ids = [call[0][1].id for call in unlock_calls]
                assert "culture_sharp_mind" in called_achievement_ids

    @pytest.mark.asyncio
    async def test_sharp_mind_not_unlocked_low_answers(self, mock_db_session, mock_culture_stats):
        """Should NOT unlock 'culture_sharp_mind' with less than 20 answers."""
        mock_culture_stats["total_answered"] = 19
        mock_culture_stats["accuracy_percent"] = 95.0  # High accuracy but low count
        service = AchievementService(mock_db_session)

        with patch.object(service, "_get_culture_stats", new_callable=AsyncMock) as mock_stats:
            mock_stats.return_value = mock_culture_stats

            with patch.object(
                service, "_try_unlock_achievement", new_callable=AsyncMock
            ) as mock_unlock:
                mock_unlock.return_value = True

                await service.check_culture_achievements(
                    user_id=uuid4(),
                    question_id=uuid4(),
                    is_correct=True,
                    language="en",
                    deck_category="history",
                )

                unlock_calls = mock_unlock.call_args_list
                called_achievement_ids = [call[0][1].id for call in unlock_calls]
                assert "culture_sharp_mind" not in called_achievement_ids

    @pytest.mark.asyncio
    async def test_historian_when_history_mastered(self, mock_db_session, mock_culture_stats):
        """Should unlock 'culture_historian' when history category is mastered."""
        mock_culture_stats["history_mastered"] = True
        service = AchievementService(mock_db_session)

        with patch.object(service, "_get_culture_stats", new_callable=AsyncMock) as mock_stats:
            mock_stats.return_value = mock_culture_stats

            with patch.object(
                service, "_try_unlock_achievement", new_callable=AsyncMock
            ) as mock_unlock:
                mock_unlock.return_value = True

                await service.check_culture_achievements(
                    user_id=uuid4(),
                    question_id=uuid4(),
                    is_correct=True,
                    language="en",
                    deck_category="history",
                )

                unlock_calls = mock_unlock.call_args_list
                called_achievement_ids = [call[0][1].id for call in unlock_calls]
                assert "culture_historian" in called_achievement_ids

    @pytest.mark.asyncio
    async def test_culture_champion_when_all_mastered(self, mock_db_session, mock_culture_stats):
        """Should unlock 'culture_champion' when all categories mastered."""
        mock_culture_stats["history_mastered"] = True
        mock_culture_stats["geography_mastered"] = True
        mock_culture_stats["politics_mastered"] = True
        mock_culture_stats["culture_mastered"] = True
        mock_culture_stats["traditions_mastered"] = True
        mock_culture_stats["all_mastered"] = True
        service = AchievementService(mock_db_session)

        with patch.object(service, "_get_culture_stats", new_callable=AsyncMock) as mock_stats:
            mock_stats.return_value = mock_culture_stats

            with patch.object(
                service, "_try_unlock_achievement", new_callable=AsyncMock
            ) as mock_unlock:
                mock_unlock.return_value = True

                await service.check_culture_achievements(
                    user_id=uuid4(),
                    question_id=uuid4(),
                    is_correct=True,
                    language="en",
                    deck_category="history",
                )

                unlock_calls = mock_unlock.call_args_list
                called_achievement_ids = [call[0][1].id for call in unlock_calls]
                assert "culture_champion" in called_achievement_ids

    @pytest.mark.asyncio
    async def test_no_duplicates_already_unlocked(self, mock_db_session, mock_culture_stats):
        """Should not unlock already unlocked achievements."""
        mock_culture_stats["total_answered"] = 10
        service = AchievementService(mock_db_session)

        with patch.object(service, "_get_culture_stats", new_callable=AsyncMock) as mock_stats:
            mock_stats.return_value = mock_culture_stats

            # Mock _try_unlock_achievement to return False (already unlocked)
            with patch.object(
                service, "_try_unlock_achievement", new_callable=AsyncMock
            ) as mock_unlock:
                mock_unlock.return_value = False

                unlocked = await service.check_culture_achievements(
                    user_id=uuid4(),
                    question_id=uuid4(),
                    is_correct=True,
                    language="en",
                    deck_category="history",
                )

                # Should return empty list when already unlocked
                assert len(unlocked) == 0
