"""Unit tests for fetch_all_sources_task scheduled task."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


class TestFetchSourcesTaskImports:
    """Test that fetch_all_sources_task can be imported correctly."""

    def test_import_from_scheduled_module(self):
        """Test importing fetch_all_sources_task from scheduled module."""
        from src.tasks.scheduled import fetch_all_sources_task

        assert callable(fetch_all_sources_task)

    def test_is_async_function(self):
        """Test that fetch_all_sources_task is an async function."""
        from src.tasks.scheduled import fetch_all_sources_task

        assert asyncio.iscoroutinefunction(fetch_all_sources_task)


class TestFetchSourcesTaskExecution:
    """Test fetch_all_sources_task execution scenarios."""

    @pytest.mark.asyncio
    async def test_fetches_all_active_sources(self):
        """Test that task fetches all active sources sequentially."""
        from src.tasks.scheduled import fetch_all_sources_task

        # Create mock sources
        source1 = MagicMock()
        source1.id = uuid4()
        source1.name = "Source 1"

        source2 = MagicMock()
        source2.id = uuid4()
        source2.name = "Source 2"

        # Create mock history entries
        history1 = MagicMock()
        history1.status = "success"

        history2 = MagicMock()
        history2.status = "success"

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

                with (
                    patch("src.repositories.news_source.NewsSourceRepository") as mock_repo_class,
                    patch(
                        "src.services.source_fetch_service.SourceFetchService"
                    ) as mock_service_class,
                ):
                    mock_repo = mock_repo_class.return_value
                    mock_repo.list_all = AsyncMock(return_value=[source1, source2])

                    mock_service = mock_service_class.return_value
                    mock_service.fetch_source = AsyncMock(side_effect=[history1, history2])

                    await fetch_all_sources_task()

                    # Verify list_all was called with is_active=True
                    mock_repo.list_all.assert_called_once_with(is_active=True)

                    # Verify fetch_source was called for each source
                    assert mock_service.fetch_source.call_count == 2
                    mock_service.fetch_source.assert_any_call(source1.id, trigger_type="scheduled")
                    mock_service.fetch_source.assert_any_call(source2.id, trigger_type="scheduled")

                    # Verify session.commit was called
                    mock_session.commit.assert_awaited_once()

                    # Verify engine was disposed
                    mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_handles_no_active_sources(self):
        """Test that task handles no active sources gracefully."""
        from src.tasks.scheduled import fetch_all_sources_task

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

                with patch("src.repositories.news_source.NewsSourceRepository") as mock_repo_class:
                    mock_repo = mock_repo_class.return_value
                    mock_repo.list_all = AsyncMock(return_value=[])

                    await fetch_all_sources_task()

                    # Verify list_all was called
                    mock_repo.list_all.assert_called_once_with(is_active=True)

                    # Verify engine was disposed even with no sources
                    mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_continues_on_individual_source_failure(self):
        """Test that one source failure doesn't stop others from being fetched."""
        from src.tasks.scheduled import fetch_all_sources_task

        source1 = MagicMock()
        source1.id = uuid4()
        source1.name = "Source 1"

        source2 = MagicMock()
        source2.id = uuid4()
        source2.name = "Source 2"

        source3 = MagicMock()
        source3.id = uuid4()
        source3.name = "Source 3"

        history1 = MagicMock()
        history1.status = "success"

        history3 = MagicMock()
        history3.status = "success"

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

                with (
                    patch("src.repositories.news_source.NewsSourceRepository") as mock_repo_class,
                    patch(
                        "src.services.source_fetch_service.SourceFetchService"
                    ) as mock_service_class,
                ):
                    mock_repo = mock_repo_class.return_value
                    mock_repo.list_all = AsyncMock(return_value=[source1, source2, source3])

                    mock_service = mock_service_class.return_value
                    # Second source throws an exception
                    mock_service.fetch_source = AsyncMock(
                        side_effect=[
                            history1,
                            Exception("Network error"),
                            history3,
                        ]
                    )

                    # Should not raise
                    await fetch_all_sources_task()

                    # Verify all three sources were attempted
                    assert mock_service.fetch_source.call_count == 3

                    # Verify session.commit was still called
                    mock_session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_counts_success_and_error_results(self):
        """Test that success and error counts are tracked correctly."""
        from src.tasks.scheduled import fetch_all_sources_task

        source1 = MagicMock()
        source1.id = uuid4()
        source1.name = "Source 1"

        source2 = MagicMock()
        source2.id = uuid4()
        source2.name = "Source 2"

        history_success = MagicMock()
        history_success.status = "success"

        history_error = MagicMock()
        history_error.status = "error"

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

                with (
                    patch("src.repositories.news_source.NewsSourceRepository") as mock_repo_class,
                    patch(
                        "src.services.source_fetch_service.SourceFetchService"
                    ) as mock_service_class,
                    patch("src.tasks.scheduled.logger") as mock_logger,
                ):
                    mock_repo = mock_repo_class.return_value
                    mock_repo.list_all = AsyncMock(return_value=[source1, source2])

                    mock_service = mock_service_class.return_value
                    mock_service.fetch_source = AsyncMock(
                        side_effect=[history_success, history_error]
                    )

                    await fetch_all_sources_task()

                    # Find completion log and verify counts
                    completion_call = None
                    for call in mock_logger.info.call_args_list:
                        if "Daily news source fetch complete" in call[0][0]:
                            completion_call = call
                            break

                    assert completion_call is not None
                    assert completion_call[1]["extra"]["success_count"] == 1
                    assert completion_call[1]["extra"]["error_count"] == 1

    @pytest.mark.asyncio
    async def test_handles_database_error(self):
        """Test that database errors are handled and re-raised."""
        from src.tasks.scheduled import fetch_all_sources_task

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

                with patch("src.repositories.news_source.NewsSourceRepository") as mock_repo_class:
                    mock_repo = mock_repo_class.return_value
                    mock_repo.list_all = AsyncMock(
                        side_effect=Exception("Database connection failed")
                    )

                    with patch("src.tasks.scheduled.logger") as mock_logger:
                        with pytest.raises(Exception, match="Database connection failed"):
                            await fetch_all_sources_task()

                        # Should log the error
                        mock_logger.error.assert_called_once()
                        error_call = mock_logger.error.call_args
                        assert "Daily news source fetch task failed" in error_call[0][0]

                    # Engine should still be disposed even after error
                    mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_disposes_engine_on_success(self):
        """Test that engine is properly disposed after successful execution."""
        from src.tasks.scheduled import fetch_all_sources_task

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

                with patch("src.repositories.news_source.NewsSourceRepository") as mock_repo_class:
                    mock_repo = mock_repo_class.return_value
                    mock_repo.list_all = AsyncMock(return_value=[])

                    await fetch_all_sources_task()

                    # Verify engine.dispose() was called
                    mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_creates_engine_with_pool_pre_ping(self):
        """Test that engine is created with pool_pre_ping=True."""
        from src.tasks.scheduled import fetch_all_sources_task

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

                with patch("src.repositories.news_source.NewsSourceRepository") as mock_repo_class:
                    mock_repo = mock_repo_class.return_value
                    mock_repo.list_all = AsyncMock(return_value=[])

                    await fetch_all_sources_task()

                    # Verify create_async_engine was called with pool_pre_ping=True
                    mock_engine_creator.assert_called_once()
                    call_kwargs = mock_engine_creator.call_args
                    assert call_kwargs[1]["pool_pre_ping"] is True


class TestFetchSourcesTaskLogging:
    """Test logging behavior of fetch_all_sources_task."""

    @pytest.mark.asyncio
    async def test_logs_start_message(self):
        """Test that task logs start message."""
        from src.tasks.scheduled import fetch_all_sources_task

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

                with (
                    patch("src.repositories.news_source.NewsSourceRepository") as mock_repo_class,
                    patch("src.tasks.scheduled.logger") as mock_logger,
                ):
                    mock_repo = mock_repo_class.return_value
                    mock_repo.list_all = AsyncMock(return_value=[])

                    await fetch_all_sources_task()

                    # Check start log was called
                    start_call = mock_logger.info.call_args_list[0]
                    assert "Starting daily news source fetch task" in start_call[0][0]

    @pytest.mark.asyncio
    async def test_logs_no_sources_message(self):
        """Test that task logs message when no active sources found."""
        from src.tasks.scheduled import fetch_all_sources_task

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

                with (
                    patch("src.repositories.news_source.NewsSourceRepository") as mock_repo_class,
                    patch("src.tasks.scheduled.logger") as mock_logger,
                ):
                    mock_repo = mock_repo_class.return_value
                    mock_repo.list_all = AsyncMock(return_value=[])

                    await fetch_all_sources_task()

                    # Find "no sources" log
                    no_sources_logged = any(
                        "No active news sources to fetch" in call[0][0]
                        for call in mock_logger.info.call_args_list
                    )
                    assert no_sources_logged

    @pytest.mark.asyncio
    async def test_logs_source_count(self):
        """Test that task logs the number of sources to fetch."""
        from src.tasks.scheduled import fetch_all_sources_task

        source1 = MagicMock()
        source1.id = uuid4()
        source1.name = "Source 1"

        source2 = MagicMock()
        source2.id = uuid4()
        source2.name = "Source 2"

        history = MagicMock()
        history.status = "success"

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

                with (
                    patch("src.repositories.news_source.NewsSourceRepository") as mock_repo_class,
                    patch(
                        "src.services.source_fetch_service.SourceFetchService"
                    ) as mock_service_class,
                    patch("src.tasks.scheduled.logger") as mock_logger,
                ):
                    mock_repo = mock_repo_class.return_value
                    mock_repo.list_all = AsyncMock(return_value=[source1, source2])

                    mock_service = mock_service_class.return_value
                    mock_service.fetch_source = AsyncMock(return_value=history)

                    await fetch_all_sources_task()

                    # Find source count log
                    source_count_call = None
                    for call in mock_logger.info.call_args_list:
                        if "Fetching active news sources" in call[0][0]:
                            source_count_call = call
                            break

                    assert source_count_call is not None
                    assert source_count_call[1]["extra"]["source_count"] == 2

    @pytest.mark.asyncio
    async def test_logs_completion_with_duration(self):
        """Test that task logs completion with duration_ms."""
        from src.tasks.scheduled import fetch_all_sources_task

        source = MagicMock()
        source.id = uuid4()
        source.name = "Source 1"

        history = MagicMock()
        history.status = "success"

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

                with (
                    patch("src.repositories.news_source.NewsSourceRepository") as mock_repo_class,
                    patch(
                        "src.services.source_fetch_service.SourceFetchService"
                    ) as mock_service_class,
                    patch("src.tasks.scheduled.logger") as mock_logger,
                ):
                    mock_repo = mock_repo_class.return_value
                    mock_repo.list_all = AsyncMock(return_value=[source])

                    mock_service = mock_service_class.return_value
                    mock_service.fetch_source = AsyncMock(return_value=history)

                    await fetch_all_sources_task()

                    # Find completion log
                    completion_call = None
                    for call in mock_logger.info.call_args_list:
                        if "Daily news source fetch complete" in call[0][0]:
                            completion_call = call
                            break

                    assert completion_call is not None
                    assert "duration_ms" in completion_call[1]["extra"]
                    assert "total_sources" in completion_call[1]["extra"]
                    assert "success_count" in completion_call[1]["extra"]
                    assert "error_count" in completion_call[1]["extra"]

    @pytest.mark.asyncio
    async def test_logs_individual_source_errors(self):
        """Test that individual source fetch errors are logged."""
        from src.tasks.scheduled import fetch_all_sources_task

        source = MagicMock()
        source.id = uuid4()
        source.name = "Test Source"

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

                with (
                    patch("src.repositories.news_source.NewsSourceRepository") as mock_repo_class,
                    patch(
                        "src.services.source_fetch_service.SourceFetchService"
                    ) as mock_service_class,
                    patch("src.tasks.scheduled.logger") as mock_logger,
                ):
                    mock_repo = mock_repo_class.return_value
                    mock_repo.list_all = AsyncMock(return_value=[source])

                    mock_service = mock_service_class.return_value
                    mock_service.fetch_source = AsyncMock(side_effect=Exception("Network timeout"))

                    await fetch_all_sources_task()

                    # Find error log for the source
                    error_logged = any(
                        f"Failed to fetch source {source.name}" in call[0][0]
                        for call in mock_logger.error.call_args_list
                    )
                    assert error_logged


class TestFetchSourcesTaskSchedulerRegistration:
    """Test that fetch_all_sources_task is properly registered in scheduler."""

    def test_task_registered_in_scheduler(self):
        """Test that fetch_all_sources_task is registered at 04:00 UTC."""
        import src.tasks.scheduler as scheduler_module

        # Reset global state
        scheduler_module._scheduler = None

        with (
            patch.object(scheduler_module, "settings") as mock_settings,
            patch("src.tasks.scheduler.AsyncIOScheduler") as mock_scheduler_class,
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.streak_reset_hour_utc = 0

            mock_scheduler_instance = MagicMock()
            mock_scheduler_instance.get_jobs.return_value = []
            mock_scheduler_class.return_value = mock_scheduler_instance

            from src.tasks.scheduler import setup_scheduler

            setup_scheduler()

            # Should have 4 add_job calls now (including our new job)
            assert mock_scheduler_instance.add_job.call_count == 4

            # Verify fetch_news_sources job ID exists
            job_ids = [call[1]["id"] for call in mock_scheduler_instance.add_job.call_args_list]
            assert "fetch_news_sources" in job_ids

            # Find the fetch_news_sources job and verify name
            for call in mock_scheduler_instance.add_job.call_args_list:
                if call[1]["id"] == "fetch_news_sources":
                    assert call[1]["name"] == "Daily News Source Fetch"
                    break
