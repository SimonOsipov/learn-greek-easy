"""Unit tests for stats_aggregate_task scheduled task."""

import asyncio
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.config import settings


class TestStatsAggregateTaskImports:
    """Test that stats_aggregate_task can be imported correctly."""

    def test_import_from_scheduled_module(self):
        """Test importing stats_aggregate_task from scheduled module."""
        from src.tasks.scheduled import stats_aggregate_task

        assert callable(stats_aggregate_task)

    def test_is_async_function(self):
        """Test that stats_aggregate_task is an async function."""
        from src.tasks.scheduled import stats_aggregate_task

        assert asyncio.iscoroutinefunction(stats_aggregate_task)


class TestStatsAggregateTaskExecution:
    """Test stats_aggregate_task execution scenarios."""

    @pytest.mark.asyncio
    async def test_stats_aggregate_with_data(self):
        """Test that stats_aggregate_task processes review data correctly."""
        from src.tasks.scheduled import stats_aggregate_task

        user_id = uuid4()

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Mock review stats query result
                # (user_id, review_count, avg_quality, total_time, unique_cards)
                review_result = MagicMock()
                review_result.fetchall.return_value = [
                    (user_id, 25, Decimal("3.80"), 450, 20),
                ]

                # Mock mastery stats query result
                # (user_id, cards_mastered)
                mastery_result = MagicMock()
                mastery_result.fetchall.return_value = [
                    (user_id, 3),
                ]

                mock_session.execute.side_effect = [review_result, mastery_result]

                await stats_aggregate_task()

                # Verify two queries were executed
                assert mock_session.execute.call_count == 2

                # Verify session.commit was called
                mock_session.commit.assert_awaited_once()

                # Verify engine was disposed
                mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_stats_aggregate_no_activity(self):
        """Test that stats_aggregate_task handles empty results gracefully."""
        from src.tasks.scheduled import stats_aggregate_task

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Empty results
                review_result = MagicMock()
                review_result.fetchall.return_value = []
                mastery_result = MagicMock()
                mastery_result.fetchall.return_value = []

                mock_session.execute.side_effect = [review_result, mastery_result]

                # Should not raise
                await stats_aggregate_task()

                mock_session.commit.assert_awaited_once()
                mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_stats_aggregate_multiple_users(self):
        """Test stats aggregation with multiple users."""
        from src.tasks.scheduled import stats_aggregate_task

        user_id_1 = uuid4()
        user_id_2 = uuid4()
        user_id_3 = uuid4()

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Mock review stats query result for multiple users
                review_result = MagicMock()
                review_result.fetchall.return_value = [
                    (user_id_1, 50, Decimal("4.20"), 900, 40),  # Most reviews
                    (user_id_2, 25, Decimal("3.50"), 450, 20),
                    (user_id_3, 10, Decimal("2.80"), 180, 10),  # Least reviews
                ]

                # Mock mastery stats - only user_1 and user_3 mastered cards
                mastery_result = MagicMock()
                mastery_result.fetchall.return_value = [
                    (user_id_1, 5),
                    (user_id_3, 1),
                ]

                mock_session.execute.side_effect = [review_result, mastery_result]

                await stats_aggregate_task()

                mock_session.commit.assert_awaited_once()
                mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_stats_aggregate_handles_database_error(self):
        """Test that database errors are handled and re-raised."""
        from src.tasks.scheduled import stats_aggregate_task

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Make execute raise an error
                mock_session.execute.side_effect = Exception("Database connection failed")

                with patch("src.tasks.scheduled.logger") as mock_logger:
                    with pytest.raises(Exception, match="Database connection failed"):
                        await stats_aggregate_task()

                    # Should log the error
                    mock_logger.error.assert_called_once()
                    error_call = mock_logger.error.call_args
                    assert "Stats aggregation failed" in error_call[0][0]

                # Engine should still be disposed even after error
                mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_stats_aggregate_disposes_engine_on_success(self):
        """Test that engine is properly disposed after successful execution."""
        from src.tasks.scheduled import stats_aggregate_task

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                review_result = MagicMock()
                review_result.fetchall.return_value = []
                mastery_result = MagicMock()
                mastery_result.fetchall.return_value = []

                mock_session.execute.side_effect = [review_result, mastery_result]

                await stats_aggregate_task()

                # Verify engine.dispose() was called
                mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_stats_aggregate_creates_engine_with_pool_pre_ping(self):
        """Test that engine is created with pool_pre_ping=True."""
        from src.tasks.scheduled import stats_aggregate_task

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                review_result = MagicMock()
                review_result.fetchall.return_value = []
                mastery_result = MagicMock()
                mastery_result.fetchall.return_value = []

                mock_session.execute.side_effect = [review_result, mastery_result]

                await stats_aggregate_task()

                # Verify create_async_engine was called with pool_pre_ping=True
                mock_engine_creator.assert_called_once()
                call_kwargs = mock_engine_creator.call_args
                assert call_kwargs[1]["pool_pre_ping"] is True


class TestStatsAggregateTaskLogging:
    """Test logging behavior of stats_aggregate_task."""

    @pytest.mark.asyncio
    async def test_logs_start_message(self):
        """Test that task logs start message."""
        from src.tasks.scheduled import stats_aggregate_task

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                review_result = MagicMock()
                review_result.fetchall.return_value = []
                mastery_result = MagicMock()
                mastery_result.fetchall.return_value = []

                mock_session.execute.side_effect = [review_result, mastery_result]

                with patch("src.tasks.scheduled.logger") as mock_logger:
                    await stats_aggregate_task()

                    # Check start log was called
                    start_call = mock_logger.info.call_args_list[0]
                    assert "Starting stats aggregation task" in start_call[0][0]

    @pytest.mark.asyncio
    async def test_logs_completion_with_no_activity(self):
        """Test that task logs completion message when no activity found."""
        from src.tasks.scheduled import stats_aggregate_task

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                review_result = MagicMock()
                review_result.fetchall.return_value = []
                mastery_result = MagicMock()
                mastery_result.fetchall.return_value = []

                mock_session.execute.side_effect = [review_result, mastery_result]

                with patch("src.tasks.scheduled.logger") as mock_logger:
                    await stats_aggregate_task()

                    # Find completion log
                    completion_call = None
                    for call in mock_logger.info.call_args_list:
                        if "Stats aggregation complete" in call[0][0]:
                            completion_call = call
                            break

                    assert completion_call is not None
                    extra = completion_call[1]["extra"]
                    assert extra["total_active_users"] == 0
                    assert extra["total_reviews"] == 0
                    assert extra["total_study_time_seconds"] == 0
                    assert extra["total_cards_mastered"] == 0
                    assert extra["avg_reviews_per_user"] == 0
                    assert extra["avg_time_per_user_seconds"] == 0
                    assert "duration_ms" in extra

    @pytest.mark.asyncio
    async def test_logs_per_user_stats(self):
        """Test that task logs stats for each active user."""
        from src.tasks.scheduled import stats_aggregate_task

        user_id_1 = uuid4()
        user_id_2 = uuid4()

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Mock review stats query result for two users
                review_result = MagicMock()
                review_result.fetchall.return_value = [
                    (user_id_1, 30, Decimal("4.00"), 600, 25),
                    (user_id_2, 15, Decimal("3.50"), 300, 12),
                ]

                # Mock mastery stats - user_1 mastered 2 cards
                mastery_result = MagicMock()
                mastery_result.fetchall.return_value = [
                    (user_id_1, 2),
                ]

                mock_session.execute.side_effect = [review_result, mastery_result]

                with patch("src.tasks.scheduled.logger") as mock_logger:
                    await stats_aggregate_task()

                    # Find user stats logs
                    user_logs = [
                        call
                        for call in mock_logger.info.call_args_list
                        if "Daily user stats" in call[0][0]
                    ]

                    assert len(user_logs) == 2

                    # Verify first user log
                    extra_1 = user_logs[0][1]["extra"]
                    assert extra_1["user_id"] == str(user_id_1)
                    assert extra_1["review_count"] == 30
                    assert extra_1["avg_quality"] == 4.00
                    assert extra_1["study_time_seconds"] == 600
                    assert extra_1["unique_cards"] == 25
                    assert extra_1["cards_mastered"] == 2

                    # Verify second user log (no mastery)
                    extra_2 = user_logs[1][1]["extra"]
                    assert extra_2["user_id"] == str(user_id_2)
                    assert extra_2["review_count"] == 15
                    assert extra_2["avg_quality"] == 3.50
                    assert extra_2["study_time_seconds"] == 300
                    assert extra_2["unique_cards"] == 12
                    assert extra_2["cards_mastered"] == 0

    @pytest.mark.asyncio
    async def test_logs_completion_with_totals(self):
        """Test that task logs completion with platform-wide totals."""
        from src.tasks.scheduled import stats_aggregate_task

        user_id_1 = uuid4()
        user_id_2 = uuid4()

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Two users with combined stats
                review_result = MagicMock()
                review_result.fetchall.return_value = [
                    (user_id_1, 30, Decimal("4.00"), 600, 25),
                    (user_id_2, 20, Decimal("3.50"), 400, 15),
                ]

                mastery_result = MagicMock()
                mastery_result.fetchall.return_value = [
                    (user_id_1, 3),
                    (user_id_2, 1),
                ]

                mock_session.execute.side_effect = [review_result, mastery_result]

                with patch("src.tasks.scheduled.logger") as mock_logger:
                    await stats_aggregate_task()

                    # Find completion log
                    completion_call = None
                    for call in mock_logger.info.call_args_list:
                        if "Stats aggregation complete" in call[0][0]:
                            completion_call = call
                            break

                    assert completion_call is not None
                    extra = completion_call[1]["extra"]
                    assert extra["total_active_users"] == 2
                    assert extra["total_reviews"] == 50  # 30 + 20
                    assert extra["total_study_time_seconds"] == 1000  # 600 + 400
                    assert extra["total_cards_mastered"] == 4  # 3 + 1
                    assert extra["avg_reviews_per_user"] == 25.0  # 50 / 2
                    assert extra["avg_time_per_user_seconds"] == 500.0  # 1000 / 2
                    assert "duration_ms" in extra


class TestStatsAggregateTaskQuery:
    """Test the SQL query behavior of stats_aggregate_task."""

    @pytest.mark.asyncio
    async def test_query_uses_correct_date_parameter(self):
        """Test that query uses yesterday's date as parameter."""
        from src.tasks.scheduled import stats_aggregate_task

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                review_result = MagicMock()
                review_result.fetchall.return_value = []
                mastery_result = MagicMock()
                mastery_result.fetchall.return_value = []

                mock_session.execute.side_effect = [review_result, mastery_result]

                await stats_aggregate_task()

                # Get the first execute call (review stats query)
                first_execute_call = mock_session.execute.call_args_list[0]

                # Verify yesterday parameter was passed
                params = first_execute_call[0][1]
                expected_yesterday = date.today() - timedelta(days=1)
                assert params["target_date"] == expected_yesterday

                # Get the second execute call (mastery stats query)
                second_execute_call = mock_session.execute.call_args_list[1]

                # Verify same date parameter
                params = second_execute_call[0][1]
                assert params["target_date"] == expected_yesterday


class TestStatsAggregateTaskEdgeCases:
    """Test edge cases for stats_aggregate_task."""

    @pytest.mark.asyncio
    async def test_handles_null_avg_quality(self):
        """Test handling of NULL average quality (shouldn't happen but defensive)."""
        from src.tasks.scheduled import stats_aggregate_task

        user_id = uuid4()

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Mock with None avg_quality
                review_result = MagicMock()
                review_result.fetchall.return_value = [
                    (user_id, 1, None, 10, 1),
                ]

                mastery_result = MagicMock()
                mastery_result.fetchall.return_value = []

                mock_session.execute.side_effect = [review_result, mastery_result]

                with patch("src.tasks.scheduled.logger") as mock_logger:
                    # Should not raise
                    await stats_aggregate_task()

                    # Find user stats log and verify avg_quality is 0
                    user_logs = [
                        call
                        for call in mock_logger.info.call_args_list
                        if "Daily user stats" in call[0][0]
                    ]

                    assert len(user_logs) == 1
                    assert user_logs[0][1]["extra"]["avg_quality"] == 0

    @pytest.mark.asyncio
    async def test_handles_null_time_taken(self):
        """Test handling of NULL time_taken (defensive coding)."""
        from src.tasks.scheduled import stats_aggregate_task

        user_id = uuid4()

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Mock with None time_taken (COALESCE should handle this)
                review_result = MagicMock()
                review_result.fetchall.return_value = [
                    (user_id, 5, Decimal("3.00"), None, 5),
                ]

                mastery_result = MagicMock()
                mastery_result.fetchall.return_value = []

                mock_session.execute.side_effect = [review_result, mastery_result]

                with patch("src.tasks.scheduled.logger") as mock_logger:
                    # Should not raise
                    await stats_aggregate_task()

                    # Find user stats log
                    user_logs = [
                        call
                        for call in mock_logger.info.call_args_list
                        if "Daily user stats" in call[0][0]
                    ]

                    assert len(user_logs) == 1
                    # Should log 0 for null time
                    assert user_logs[0][1]["extra"]["study_time_seconds"] == 0

    @pytest.mark.asyncio
    async def test_handles_reviews_without_mastery(self):
        """Test users who reviewed but didn't master any cards."""
        from src.tasks.scheduled import stats_aggregate_task

        user_id = uuid4()

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # User has reviews
                review_result = MagicMock()
                review_result.fetchall.return_value = [
                    (user_id, 10, Decimal("2.50"), 200, 8),
                ]

                # But no mastered cards
                mastery_result = MagicMock()
                mastery_result.fetchall.return_value = []

                mock_session.execute.side_effect = [review_result, mastery_result]

                with patch("src.tasks.scheduled.logger") as mock_logger:
                    await stats_aggregate_task()

                    # Find user stats log
                    user_logs = [
                        call
                        for call in mock_logger.info.call_args_list
                        if "Daily user stats" in call[0][0]
                    ]

                    assert len(user_logs) == 1
                    assert user_logs[0][1]["extra"]["cards_mastered"] == 0

    @pytest.mark.asyncio
    async def test_handles_mastery_without_reviews(self):
        """Test case where mastery query returns data but reviews don't (edge case)."""
        from src.tasks.scheduled import stats_aggregate_task

        user_id = uuid4()

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # No reviews (empty)
                review_result = MagicMock()
                review_result.fetchall.return_value = []

                # But mastery stats exist (shouldn't happen but be defensive)
                mastery_result = MagicMock()
                mastery_result.fetchall.return_value = [
                    (user_id, 1),
                ]

                mock_session.execute.side_effect = [review_result, mastery_result]

                with patch("src.tasks.scheduled.logger") as mock_logger:
                    await stats_aggregate_task()

                    # Should complete without error
                    # Mastery data is ignored since no users in review stats
                    completion_call = None
                    for call in mock_logger.info.call_args_list:
                        if "Stats aggregation complete" in call[0][0]:
                            completion_call = call
                            break

                    assert completion_call is not None
                    # Total mastered should be 0 since no active users
                    assert completion_call[1]["extra"]["total_cards_mastered"] == 0


class TestStatsAggregateTaskConfiguration:
    """Test configuration usage in stats_aggregate_task."""

    def test_uses_settings_database_url(self):
        """Test that task uses database_url from settings."""
        assert hasattr(settings, "database_url")
        assert settings.database_url is not None
