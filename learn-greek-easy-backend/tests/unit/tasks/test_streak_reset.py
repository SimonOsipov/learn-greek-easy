"""Unit tests for streak_reset_task scheduled task."""

import asyncio
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.config import settings


class TestStreakResetTaskImports:
    """Test that streak_reset_task can be imported correctly."""

    def test_import_from_scheduled_module(self):
        """Test importing streak_reset_task from scheduled module."""
        from src.tasks.scheduled import streak_reset_task

        assert callable(streak_reset_task)

    def test_is_async_function(self):
        """Test that streak_reset_task is an async function."""
        from src.tasks.scheduled import streak_reset_task

        assert asyncio.iscoroutinefunction(streak_reset_task)


class TestStreakResetTaskExecution:
    """Test streak_reset_task execution scenarios."""

    @pytest.mark.asyncio
    async def test_streak_reset_identifies_broken_streaks(self):
        """Test that streak_reset_task identifies users who missed yesterday."""
        from src.tasks.scheduled import streak_reset_task

        user_id = uuid4()
        last_review_date = date.today() - timedelta(days=2)

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_session_factory = MagicMock(return_value=mock_session)
                mock_sessionmaker.return_value = mock_session_factory

                # Mock query result with user who missed yesterday
                mock_result = MagicMock()
                mock_result.fetchall.return_value = [(user_id, last_review_date)]
                mock_session.execute.return_value = mock_result

                await streak_reset_task()

                # Verify session.execute was called
                mock_session.execute.assert_called_once()

                # Verify session.commit was called
                mock_session.commit.assert_awaited_once()

                # Verify engine was disposed
                mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_streak_reset_handles_no_broken_streaks(self):
        """Test that streak_reset_task handles empty results gracefully."""
        from src.tasks.scheduled import streak_reset_task

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_session_factory = MagicMock(return_value=mock_session)
                mock_sessionmaker.return_value = mock_session_factory

                # Mock empty query result
                mock_result = MagicMock()
                mock_result.fetchall.return_value = []
                mock_session.execute.return_value = mock_result

                await streak_reset_task()

                # Verify session.commit was called
                mock_session.commit.assert_awaited_once()

                # Verify engine was disposed
                mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_streak_reset_handles_database_error(self):
        """Test that database errors are handled and re-raised."""
        from src.tasks.scheduled import streak_reset_task

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_session_factory = MagicMock(return_value=mock_session)
                mock_sessionmaker.return_value = mock_session_factory

                # Make execute raise an error
                mock_session.execute.side_effect = Exception("Database connection failed")

                with patch("src.tasks.scheduled.logger") as mock_logger:
                    with pytest.raises(Exception, match="Database connection failed"):
                        await streak_reset_task()

                    # Should log the error
                    mock_logger.error.assert_called_once()
                    error_call = mock_logger.error.call_args
                    assert "Streak reset task failed" in error_call[0][0]

                # Engine should still be disposed even after error
                mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_streak_reset_disposes_engine_on_success(self):
        """Test that engine is properly disposed after successful execution."""
        from src.tasks.scheduled import streak_reset_task

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_session_factory = MagicMock(return_value=mock_session)
                mock_sessionmaker.return_value = mock_session_factory

                mock_result = MagicMock()
                mock_result.fetchall.return_value = []
                mock_session.execute.return_value = mock_result

                await streak_reset_task()

                # Verify engine.dispose() was called
                mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_streak_reset_creates_engine_with_pool_pre_ping(self):
        """Test that engine is created with pool_pre_ping=True."""
        from src.tasks.scheduled import streak_reset_task

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_session_factory = MagicMock(return_value=mock_session)
                mock_sessionmaker.return_value = mock_session_factory

                mock_result = MagicMock()
                mock_result.fetchall.return_value = []
                mock_session.execute.return_value = mock_result

                await streak_reset_task()

                # Verify create_async_engine was called with pool_pre_ping=True
                mock_engine_creator.assert_called_once()
                call_kwargs = mock_engine_creator.call_args
                assert call_kwargs[1]["pool_pre_ping"] is True


class TestStreakResetTaskLogging:
    """Test logging behavior of streak_reset_task."""

    @pytest.mark.asyncio
    async def test_logs_start_message(self):
        """Test that task logs start message with streak_reset_hour_utc."""
        from src.tasks.scheduled import streak_reset_task

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_session_factory = MagicMock(return_value=mock_session)
                mock_sessionmaker.return_value = mock_session_factory

                mock_result = MagicMock()
                mock_result.fetchall.return_value = []
                mock_session.execute.return_value = mock_result

                with patch("src.tasks.scheduled.logger") as mock_logger:
                    await streak_reset_task()

                    # Check start log was called
                    start_call = mock_logger.info.call_args_list[0]
                    assert "Starting streak reset task" in start_call[0][0]
                    assert "streak_reset_hour_utc" in start_call[1]["extra"]

    @pytest.mark.asyncio
    async def test_logs_completion_with_no_broken_streaks(self):
        """Test that task logs completion message when no broken streaks found."""
        from src.tasks.scheduled import streak_reset_task

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_session_factory = MagicMock(return_value=mock_session)
                mock_sessionmaker.return_value = mock_session_factory

                mock_result = MagicMock()
                mock_result.fetchall.return_value = []
                mock_session.execute.return_value = mock_result

                with patch("src.tasks.scheduled.logger") as mock_logger:
                    await streak_reset_task()

                    # Find completion log
                    completion_call = None
                    for call in mock_logger.info.call_args_list:
                        if "no broken streaks found" in call[0][0]:
                            completion_call = call
                            break

                    assert completion_call is not None
                    assert completion_call[1]["extra"]["users_with_broken_streak"] == 0

    @pytest.mark.asyncio
    async def test_logs_each_user_with_broken_streak(self):
        """Test that task logs each user with a broken streak."""
        from src.tasks.scheduled import streak_reset_task

        user_id_1 = uuid4()
        user_id_2 = uuid4()
        last_review_1 = date.today() - timedelta(days=2)
        last_review_2 = date.today() - timedelta(days=5)

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_session_factory = MagicMock(return_value=mock_session)
                mock_sessionmaker.return_value = mock_session_factory

                # Mock query result with multiple users
                mock_result = MagicMock()
                mock_result.fetchall.return_value = [
                    (user_id_1, last_review_1),
                    (user_id_2, last_review_2),
                ]
                mock_session.execute.return_value = mock_result

                with patch("src.tasks.scheduled.logger") as mock_logger:
                    await streak_reset_task()

                    # Find user streak broken logs
                    user_logs = [
                        call
                        for call in mock_logger.info.call_args_list
                        if "User streak broken" in call[0][0]
                    ]

                    assert len(user_logs) == 2

                    # Verify first user log
                    assert user_logs[0][1]["extra"]["user_id"] == str(user_id_1)
                    assert user_logs[0][1]["extra"]["last_review_date"] == str(last_review_1)
                    assert user_logs[0][1]["extra"]["days_since_review"] == 2

                    # Verify second user log
                    assert user_logs[1][1]["extra"]["user_id"] == str(user_id_2)
                    assert user_logs[1][1]["extra"]["last_review_date"] == str(last_review_2)
                    assert user_logs[1][1]["extra"]["days_since_review"] == 5

    @pytest.mark.asyncio
    async def test_logs_completion_with_duration(self):
        """Test that task logs completion with duration_ms when broken streaks found."""
        from src.tasks.scheduled import streak_reset_task

        user_id = uuid4()
        last_review = date.today() - timedelta(days=3)

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_session_factory = MagicMock(return_value=mock_session)
                mock_sessionmaker.return_value = mock_session_factory

                mock_result = MagicMock()
                mock_result.fetchall.return_value = [(user_id, last_review)]
                mock_session.execute.return_value = mock_result

                with patch("src.tasks.scheduled.logger") as mock_logger:
                    await streak_reset_task()

                    # Find completion log
                    completion_call = None
                    for call in mock_logger.info.call_args_list:
                        if "Streak reset task complete" in call[0][0] and "duration_ms" in call[
                            1
                        ].get("extra", {}):
                            completion_call = call
                            break

                    assert completion_call is not None
                    assert completion_call[1]["extra"]["users_with_broken_streak"] == 1
                    assert "duration_ms" in completion_call[1]["extra"]


class TestStreakResetTaskQuery:
    """Test the SQL query behavior of streak_reset_task."""

    @pytest.mark.asyncio
    async def test_query_uses_correct_date_parameter(self):
        """Test that query uses yesterday's date as parameter."""
        from src.tasks.scheduled import streak_reset_task

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_session_factory = MagicMock(return_value=mock_session)
                mock_sessionmaker.return_value = mock_session_factory

                mock_result = MagicMock()
                mock_result.fetchall.return_value = []
                mock_session.execute.return_value = mock_result

                await streak_reset_task()

                # Get the execute call
                execute_call = mock_session.execute.call_args

                # Verify yesterday parameter was passed
                params = execute_call[0][1]
                expected_yesterday = date.today() - timedelta(days=1)
                assert params["yesterday"] == expected_yesterday


class TestStreakResetTaskConfiguration:
    """Test configuration usage in streak_reset_task."""

    def test_uses_settings_database_url(self):
        """Test that task uses database_url from settings."""
        assert hasattr(settings, "database_url")
        assert settings.database_url is not None

    def test_uses_settings_streak_reset_hour_utc(self):
        """Test that streak_reset_hour_utc setting exists."""
        assert hasattr(settings, "streak_reset_hour_utc")
        assert isinstance(settings.streak_reset_hour_utc, int)
        assert 0 <= settings.streak_reset_hour_utc <= 23


class TestStreakResetSessionCleanupOrder:
    """Test that session is closed before engine is disposed.

    This is critical to avoid InvalidRequestError: "Method 'close()' can't
    be called here; method '_connection_for_bind()' is already in progress".
    """

    @pytest.mark.asyncio
    async def test_streak_reset_closes_session_before_engine_dispose(self):
        """Test that streak_reset_task closes session before engine dispose."""
        from src.tasks.scheduled import streak_reset_task

        call_order = []

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()

            async def mock_dispose():
                call_order.append("engine.dispose")

            mock_engine.dispose = mock_dispose
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()

                async def mock_close():
                    call_order.append("session.close")

                mock_session.close = mock_close

                # Mock execute and commit
                mock_result = MagicMock()
                mock_result.fetchall.return_value = []
                mock_session.execute.return_value = mock_result

                mock_session_factory = MagicMock(return_value=mock_session)
                mock_sessionmaker.return_value = mock_session_factory

                await streak_reset_task()

                assert call_order == ["session.close", "engine.dispose"]

    @pytest.mark.asyncio
    async def test_streak_reset_closes_session_before_engine_on_error(self):
        """Test that session is closed before engine dispose even on error."""
        from src.tasks.scheduled import streak_reset_task

        call_order = []

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()

            async def mock_dispose():
                call_order.append("engine.dispose")

            mock_engine.dispose = mock_dispose
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()

                async def mock_close():
                    call_order.append("session.close")

                mock_session.close = mock_close
                mock_session.execute.side_effect = Exception("DB error")

                mock_session_factory = MagicMock(return_value=mock_session)
                mock_sessionmaker.return_value = mock_session_factory

                with pytest.raises(Exception, match="DB error"):
                    await streak_reset_task()

                # Session close should still happen before engine dispose
                assert call_order == ["session.close", "engine.dispose"]
