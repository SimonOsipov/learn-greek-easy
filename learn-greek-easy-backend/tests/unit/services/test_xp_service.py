"""Unit tests for XPService.

Tests cover:
- award_xp creates transactions and detects level-ups
- award_xp raises ValueError for amount <= 0
- correct_answer_xp normal vs perfect
- daily_goal_xp idempotency
- first_review_bonus idempotency + date update
- streak_bonus calculation
"""

from datetime import date
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from src.db.models import UserXP, XPTransaction
from src.services.xp_constants import (
    XP_CORRECT_ANSWER,
    XP_DAILY_GOAL,
    XP_FIRST_REVIEW,
    XP_PERFECT_ANSWER,
    XP_SESSION_COMPLETE,
    XP_STREAK_MULTIPLIER,
)
from src.services.xp_service import XPService


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = MagicMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def mock_user_xp():
    """Create a mock UserXP object."""
    user_xp = MagicMock(spec=UserXP)
    user_xp.user_id = uuid4()
    user_xp.total_xp = 0
    user_xp.current_level = 1
    user_xp.last_daily_bonus_date = None
    return user_xp


@pytest.mark.unit
class TestAwardXP:
    """Tests for XPService.award_xp method."""

    @pytest.mark.asyncio
    async def test_award_xp_creates_transaction(self, mock_db_session, mock_user_xp):
        """award_xp should create an XPTransaction record."""
        service = XPService(mock_db_session)

        # Mock get_or_create_user_xp
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        await service.award_xp(user_id, 10, "test_reason")

        # Verify add was called twice (once for transaction, possibly for user_xp)
        assert mock_db_session.add.called
        # Check that an XPTransaction was added
        add_calls = mock_db_session.add.call_args_list
        transaction_added = any(isinstance(call[0][0], XPTransaction) for call in add_calls)
        assert transaction_added

    @pytest.mark.asyncio
    async def test_award_xp_detects_level_up(self, mock_db_session, mock_user_xp):
        """award_xp should detect when user levels up."""
        service = XPService(mock_db_session)

        # User is at 95 XP (level 1), will level up with +10
        mock_user_xp.total_xp = 95
        mock_user_xp.current_level = 1

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        new_total, did_level_up = await service.award_xp(user_id, 10, "test")

        assert new_total == 105
        assert did_level_up is True
        assert mock_user_xp.current_level == 2

    @pytest.mark.asyncio
    async def test_award_xp_no_level_up_when_not_crossing_threshold(
        self, mock_db_session, mock_user_xp
    ):
        """award_xp should not level up when not crossing threshold."""
        service = XPService(mock_db_session)

        # User is at 50 XP (level 1), won't level up with +10
        mock_user_xp.total_xp = 50
        mock_user_xp.current_level = 1

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        new_total, did_level_up = await service.award_xp(user_id, 10, "test")

        assert new_total == 60
        assert did_level_up is False
        assert mock_user_xp.current_level == 1

    @pytest.mark.asyncio
    async def test_award_xp_raises_valueerror_for_zero_amount(self, mock_db_session):
        """award_xp should raise ValueError for amount <= 0."""
        service = XPService(mock_db_session)

        with pytest.raises(ValueError) as exc_info:
            await service.award_xp(uuid4(), 0, "test")

        assert "must be greater than 0" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_award_xp_raises_valueerror_for_negative_amount(self, mock_db_session):
        """award_xp should raise ValueError for negative amount."""
        service = XPService(mock_db_session)

        with pytest.raises(ValueError) as exc_info:
            await service.award_xp(uuid4(), -10, "test")

        assert "must be greater than 0" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_award_xp_with_source_id(self, mock_db_session, mock_user_xp):
        """award_xp should include source_id in transaction."""
        service = XPService(mock_db_session)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        source_id = uuid4()
        await service.award_xp(user_id, 10, "test", source_id=source_id)

        # Check the XPTransaction was created with source_id
        add_calls = mock_db_session.add.call_args_list
        for call in add_calls:
            obj = call[0][0]
            if isinstance(obj, XPTransaction):
                assert obj.source_id == source_id


@pytest.mark.unit
class TestAwardCorrectAnswerXP:
    """Tests for XPService.award_correct_answer_xp method."""

    @pytest.mark.asyncio
    async def test_normal_correct_answer_awards_10_xp(self, mock_db_session, mock_user_xp):
        """Normal correct answer (is_perfect=False) awards 10 XP."""
        service = XPService(mock_db_session)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        amount = await service.award_correct_answer_xp(user_id, is_perfect=False)

        assert amount == XP_CORRECT_ANSWER
        assert amount == 10

    @pytest.mark.asyncio
    async def test_perfect_answer_awards_15_xp(self, mock_db_session, mock_user_xp):
        """Perfect answer (is_perfect=True) awards 15 XP."""
        service = XPService(mock_db_session)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        amount = await service.award_correct_answer_xp(user_id, is_perfect=True)

        assert amount == XP_PERFECT_ANSWER
        assert amount == 15

    @pytest.mark.asyncio
    async def test_correct_answer_with_source_id(self, mock_db_session, mock_user_xp):
        """award_correct_answer_xp should pass source_id to award_xp."""
        service = XPService(mock_db_session)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        card_id = uuid4()
        await service.award_correct_answer_xp(user_id, is_perfect=False, source_id=card_id)

        # Verify transaction was created with source_id
        add_calls = mock_db_session.add.call_args_list
        for call in add_calls:
            obj = call[0][0]
            if isinstance(obj, XPTransaction):
                assert obj.source_id == card_id


@pytest.mark.unit
class TestAwardDailyGoalXP:
    """Tests for XPService.award_daily_goal_xp method."""

    @pytest.mark.asyncio
    async def test_awards_xp_first_time(self, mock_db_session, mock_user_xp):
        """First daily goal claim awards 50 XP."""
        service = XPService(mock_db_session)

        mock_user_xp.last_daily_bonus_date = None

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        amount = await service.award_daily_goal_xp(user_id)

        assert amount == XP_DAILY_GOAL
        assert amount == 50
        assert mock_user_xp.last_daily_bonus_date == date.today()

    @pytest.mark.asyncio
    async def test_returns_0_if_already_claimed_today(self, mock_db_session, mock_user_xp):
        """Returns 0 if already claimed today (idempotent)."""
        service = XPService(mock_db_session)

        mock_user_xp.last_daily_bonus_date = date.today()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        amount = await service.award_daily_goal_xp(user_id)

        assert amount == 0

    @pytest.mark.asyncio
    async def test_awards_xp_next_day(self, mock_db_session, mock_user_xp):
        """Awards XP if last claim was yesterday."""
        service = XPService(mock_db_session)

        from datetime import timedelta

        mock_user_xp.last_daily_bonus_date = date.today() - timedelta(days=1)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        amount = await service.award_daily_goal_xp(user_id)

        assert amount == XP_DAILY_GOAL


@pytest.mark.unit
class TestAwardFirstReviewBonus:
    """Tests for XPService.award_first_review_bonus method."""

    @pytest.mark.asyncio
    async def test_awards_xp_first_time(self, mock_db_session, mock_user_xp):
        """First review bonus awards 20 XP."""
        service = XPService(mock_db_session)

        mock_user_xp.last_daily_bonus_date = None

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        amount = await service.award_first_review_bonus(user_id)

        assert amount == XP_FIRST_REVIEW
        assert amount == 20

    @pytest.mark.asyncio
    async def test_updates_last_daily_bonus_date(self, mock_db_session, mock_user_xp):
        """First review bonus updates last_daily_bonus_date."""
        service = XPService(mock_db_session)

        mock_user_xp.last_daily_bonus_date = None

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        await service.award_first_review_bonus(user_id)

        assert mock_user_xp.last_daily_bonus_date == date.today()

    @pytest.mark.asyncio
    async def test_returns_0_if_already_claimed_today(self, mock_db_session, mock_user_xp):
        """Returns 0 if already claimed today (idempotent)."""
        service = XPService(mock_db_session)

        mock_user_xp.last_daily_bonus_date = date.today()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        amount = await service.award_first_review_bonus(user_id)

        assert amount == 0


@pytest.mark.unit
class TestAwardSessionCompleteXP:
    """Tests for XPService.award_session_complete_xp method."""

    @pytest.mark.asyncio
    async def test_awards_25_xp(self, mock_db_session, mock_user_xp):
        """Session complete awards 25 XP."""
        service = XPService(mock_db_session)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        amount = await service.award_session_complete_xp(user_id)

        assert amount == XP_SESSION_COMPLETE
        assert amount == 25


@pytest.mark.unit
class TestAwardStreakBonus:
    """Tests for XPService.award_streak_bonus method."""

    @pytest.mark.asyncio
    async def test_streak_1_day_awards_10_xp(self, mock_db_session, mock_user_xp):
        """1 day streak awards 10 XP."""
        service = XPService(mock_db_session)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        amount = await service.award_streak_bonus(user_id, streak_days=1)

        assert amount == XP_STREAK_MULTIPLIER * 1
        assert amount == 10

    @pytest.mark.asyncio
    async def test_streak_7_days_awards_70_xp(self, mock_db_session, mock_user_xp):
        """7 day streak awards 70 XP."""
        service = XPService(mock_db_session)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        amount = await service.award_streak_bonus(user_id, streak_days=7)

        assert amount == XP_STREAK_MULTIPLIER * 7
        assert amount == 70

    @pytest.mark.asyncio
    async def test_streak_30_days_awards_300_xp(self, mock_db_session, mock_user_xp):
        """30 day streak awards 300 XP."""
        service = XPService(mock_db_session)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        amount = await service.award_streak_bonus(user_id, streak_days=30)

        assert amount == XP_STREAK_MULTIPLIER * 30
        assert amount == 300

    @pytest.mark.asyncio
    async def test_raises_valueerror_for_zero_streak(self, mock_db_session):
        """Raises ValueError for streak_days <= 0."""
        service = XPService(mock_db_session)

        with pytest.raises(ValueError) as exc_info:
            await service.award_streak_bonus(uuid4(), streak_days=0)

        assert "greater than 0" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_raises_valueerror_for_negative_streak(self, mock_db_session):
        """Raises ValueError for negative streak_days."""
        service = XPService(mock_db_session)

        with pytest.raises(ValueError) as exc_info:
            await service.award_streak_bonus(uuid4(), streak_days=-5)

        assert "greater than 0" in str(exc_info.value)


@pytest.mark.unit
class TestGetUserXPStats:
    """Tests for XPService.get_user_xp_stats method."""

    @pytest.mark.asyncio
    async def test_returns_correct_stats_for_new_user(self, mock_db_session, mock_user_xp):
        """Returns correct stats for new user (0 XP, level 1)."""
        service = XPService(mock_db_session)

        mock_user_xp.total_xp = 0
        mock_user_xp.current_level = 1

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        stats = await service.get_user_xp_stats(user_id)

        assert stats["total_xp"] == 0
        assert stats["current_level"] == 1
        assert stats["level_name_english"] == "Beginner"
        assert stats["level_name_greek"] == "Αρχάριος"
        assert stats["xp_in_level"] == 0
        assert stats["xp_for_next_level"] == 100
        assert stats["progress_percentage"] == 0.0

    @pytest.mark.asyncio
    async def test_returns_correct_progress_percentage(self, mock_db_session, mock_user_xp):
        """Returns correct progress percentage."""
        service = XPService(mock_db_session)

        mock_user_xp.total_xp = 50
        mock_user_xp.current_level = 1

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        stats = await service.get_user_xp_stats(user_id)

        assert stats["xp_in_level"] == 50
        assert stats["xp_for_next_level"] == 100
        assert stats["progress_percentage"] == 50.0

    @pytest.mark.asyncio
    async def test_returns_zero_progress_at_max_level(self, mock_db_session, mock_user_xp):
        """Returns zero progress at max level."""
        service = XPService(mock_db_session)

        mock_user_xp.total_xp = 100000
        mock_user_xp.current_level = 15

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        stats = await service.get_user_xp_stats(user_id)

        assert stats["current_level"] == 15
        assert stats["level_name_english"] == "Polyglot"
        assert stats["xp_in_level"] == 0
        assert stats["xp_for_next_level"] == 0
        assert stats["progress_percentage"] == 0.0


@pytest.mark.unit
class TestGetOrCreateUserXP:
    """Tests for XPService.get_or_create_user_xp method."""

    @pytest.mark.asyncio
    async def test_returns_existing_user_xp(self, mock_db_session, mock_user_xp):
        """Returns existing UserXP if found."""
        service = XPService(mock_db_session)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user_xp
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        result = await service.get_or_create_user_xp(user_id)

        assert result == mock_user_xp
        # Should not add new record
        assert not any(
            isinstance(call[0][0], UserXP) for call in mock_db_session.add.call_args_list
        )

    @pytest.mark.asyncio
    async def test_creates_new_user_xp_if_not_found(self, mock_db_session):
        """Creates new UserXP if not found."""
        service = XPService(mock_db_session)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        user_id = uuid4()
        result = await service.get_or_create_user_xp(user_id)

        assert result.user_id == user_id
        assert result.total_xp == 0
        assert result.current_level == 1
        mock_db_session.add.assert_called()
