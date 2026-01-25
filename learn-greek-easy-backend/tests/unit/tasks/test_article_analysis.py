"""Unit tests for article analysis background task.

Tests cover:
- Successful analysis with mocked Claude service
- Error handling for missing history record
- Error handling for missing HTML content
- Error handling for missing source
- Error handling for Claude service errors
- Helper function trigger_article_analysis
"""

import asyncio
import inspect
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.schemas.admin import DiscoveredArticle
from src.services.html_extractor import ExtractedContent, HTMLContentExtractorError


class TestAnalyzeFetchForArticlesTask:
    """Tests for the analyze_fetch_for_articles_task function."""

    def test_is_async_function(self):
        """Test that analyze_fetch_for_articles_task is an async function."""
        from src.tasks.background import analyze_fetch_for_articles_task

        assert asyncio.iscoroutinefunction(analyze_fetch_for_articles_task)

    def test_signature(self):
        """Test that analyze_fetch_for_articles_task has correct signature."""
        from src.tasks.background import analyze_fetch_for_articles_task

        sig = inspect.signature(analyze_fetch_for_articles_task)
        params = list(sig.parameters.keys())
        assert params == ["history_id"]

    @pytest.mark.asyncio
    async def test_analyze_fetch_success(self):
        """Test successful analysis with mocked Claude service and HTML extraction."""
        from src.tasks.background import analyze_fetch_for_articles_task

        history_id = uuid4()
        source_id = uuid4()

        with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Mock history record
                mock_history = MagicMock()
                mock_history.id = history_id
                mock_history.source_id = source_id
                mock_history.html_content = "<html><body>Test content</body></html>"
                mock_history.analysis_status = "pending"

                # Mock source record
                mock_source = MagicMock()
                mock_source.id = source_id
                mock_source.name = "Test News"
                mock_source.url = "https://example.com"

                # Configure session.execute to return history then source
                mock_result_history = MagicMock()
                mock_result_history.scalar_one_or_none.return_value = mock_history
                mock_result_source = MagicMock()
                mock_result_source.scalar_one_or_none.return_value = mock_source

                mock_session.execute = AsyncMock(
                    side_effect=[mock_result_history, mock_result_source]
                )

                # Mock html_extractor
                with patch("src.tasks.background.html_extractor") as mock_extractor:
                    mock_extracted = ExtractedContent(
                        title="Test Article",
                        main_text="This is the extracted article content that is sufficiently long to pass the minimum length check of 100 characters for article analysis.",
                        publication_date=None,
                        author=None,
                        estimated_tokens=50,
                        extraction_method="fallback",
                    )
                    mock_extractor.extract.return_value = mock_extracted

                    # Mock Claude service
                    mock_articles = [
                        DiscoveredArticle(
                            url="https://example.com/article/1",
                            title="Test Article",
                            reasoning="Good for culture questions.",
                        )
                    ]
                    with patch("src.services.claude_service.claude_service") as mock_claude:
                        mock_claude.analyze_html_for_articles.return_value = (mock_articles, 1500)

                        await analyze_fetch_for_articles_task(history_id)

                        # Verify html_extractor was called with raw HTML
                        mock_extractor.extract.assert_called_once_with(
                            html_content=mock_history.html_content,
                            source_url=mock_source.url,
                        )

                        # Verify Claude received extracted text (not raw HTML)
                        mock_claude.analyze_html_for_articles.assert_called_once_with(
                            html_content=mock_extracted.main_text,
                            source_base_url=mock_source.url,
                        )

                        # Verify history was updated
                        assert mock_history.analysis_status == "completed"
                        assert mock_history.discovered_articles == [mock_articles[0].model_dump()]
                        assert mock_history.analysis_tokens_used == 1500
                        assert mock_history.analysis_error is None
                        assert mock_history.analyzed_at is not None

                        # Verify session.commit was called
                        mock_session.commit.assert_awaited_once()

                        # Verify engine was disposed
                        mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_analyze_fetch_no_history(self):
        """Test handling of missing history record."""
        from src.tasks.background import analyze_fetch_for_articles_task

        history_id = uuid4()

        with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Configure session.execute to return None (no history found)
                mock_result = MagicMock()
                mock_result.scalar_one_or_none.return_value = None
                mock_session.execute = AsyncMock(return_value=mock_result)

                with patch("src.tasks.background.logger") as mock_logger:
                    await analyze_fetch_for_articles_task(history_id)

                    # Verify error was logged
                    mock_logger.error.assert_called()
                    error_call = mock_logger.error.call_args
                    assert "History record not found" in error_call[0][0]

                    # Verify session.commit was NOT called (no update needed)
                    mock_session.commit.assert_not_awaited()

                    # Verify engine was disposed
                    mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_analyze_fetch_no_html(self):
        """Test handling of history record with no HTML content."""
        from src.tasks.background import analyze_fetch_for_articles_task

        history_id = uuid4()

        with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Mock history with no HTML content
                mock_history = MagicMock()
                mock_history.id = history_id
                mock_history.html_content = None  # No HTML content

                mock_result = MagicMock()
                mock_result.scalar_one_or_none.return_value = mock_history
                mock_session.execute = AsyncMock(return_value=mock_result)

                with patch("src.tasks.background.logger") as mock_logger:
                    await analyze_fetch_for_articles_task(history_id)

                    # Verify error was logged
                    mock_logger.error.assert_called()
                    error_call = mock_logger.error.call_args
                    assert "No HTML content" in error_call[0][0]

                    # Verify history was updated with failure
                    assert mock_history.analysis_status == "failed"
                    assert mock_history.analysis_error == "No HTML content available"

                    # Verify session.commit was called
                    mock_session.commit.assert_awaited_once()

                    # Verify engine was disposed
                    mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_analyze_fetch_no_source(self):
        """Test handling of missing source record."""
        from src.tasks.background import analyze_fetch_for_articles_task

        history_id = uuid4()
        source_id = uuid4()

        with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Mock history with HTML content
                mock_history = MagicMock()
                mock_history.id = history_id
                mock_history.source_id = source_id
                mock_history.html_content = "<html>Test</html>"

                # First query returns history, second returns None (source not found)
                mock_result_history = MagicMock()
                mock_result_history.scalar_one_or_none.return_value = mock_history
                mock_result_source = MagicMock()
                mock_result_source.scalar_one_or_none.return_value = None

                mock_session.execute = AsyncMock(
                    side_effect=[mock_result_history, mock_result_source]
                )

                with patch("src.tasks.background.logger") as mock_logger:
                    await analyze_fetch_for_articles_task(history_id)

                    # Verify error was logged
                    mock_logger.error.assert_called()
                    error_call = mock_logger.error.call_args
                    assert "Source not found" in error_call[0][0]

                    # Verify history was updated with failure
                    assert mock_history.analysis_status == "failed"
                    assert mock_history.analysis_error == "Source not found"

                    # Verify session.commit was called
                    mock_session.commit.assert_awaited_once()

                    # Verify engine was disposed
                    mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_analyze_fetch_claude_error(self):
        """Test handling of Claude service errors."""
        from src.services.claude_service import ClaudeServiceError
        from src.tasks.background import analyze_fetch_for_articles_task

        history_id = uuid4()
        source_id = uuid4()

        with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Mock history record
                mock_history = MagicMock()
                mock_history.id = history_id
                mock_history.source_id = source_id
                mock_history.html_content = "<html>Test</html>"

                # Mock source record
                mock_source = MagicMock()
                mock_source.id = source_id
                mock_source.name = "Test News"
                mock_source.url = "https://example.com"

                mock_result_history = MagicMock()
                mock_result_history.scalar_one_or_none.return_value = mock_history
                mock_result_source = MagicMock()
                mock_result_source.scalar_one_or_none.return_value = mock_source

                mock_session.execute = AsyncMock(
                    side_effect=[mock_result_history, mock_result_source]
                )

                # Mock html_extractor
                with patch("src.tasks.background.html_extractor") as mock_extractor:
                    mock_extracted = ExtractedContent(
                        title="Test Article",
                        main_text="This is the extracted article content that is sufficiently long to pass the minimum length check of 100 characters for article analysis.",
                        publication_date=None,
                        author=None,
                        estimated_tokens=50,
                        extraction_method="fallback",
                    )
                    mock_extractor.extract.return_value = mock_extracted

                    # Mock Claude service to raise error
                    with patch("src.services.claude_service.claude_service") as mock_claude:
                        mock_claude.analyze_html_for_articles.side_effect = ClaudeServiceError(
                            "API timeout after 120 seconds"
                        )

                        with patch("src.tasks.background.logger") as mock_logger:
                            await analyze_fetch_for_articles_task(history_id)

                            # Verify error was logged
                            mock_logger.error.assert_called()
                            error_call = mock_logger.error.call_args
                            assert "Claude service error" in error_call[0][0]

                            # Verify history was updated with failure
                            assert mock_history.analysis_status == "failed"
                            assert "API timeout" in mock_history.analysis_error

                            # Verify session.commit was called
                            mock_session.commit.assert_awaited_once()

                            # Verify engine was disposed
                            mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_analyze_fetch_disposes_engine_on_error(self):
        """Test that engine is disposed even when an unexpected error occurs."""
        from src.tasks.background import analyze_fetch_for_articles_task

        history_id = uuid4()

        with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                # Make session factory raise an unexpected error
                mock_sessionmaker.side_effect = Exception("Unexpected database error")

                with patch("src.tasks.background.logger") as mock_logger:
                    await analyze_fetch_for_articles_task(history_id)

                    # Verify error was logged
                    mock_logger.exception.assert_called()
                    error_call = mock_logger.exception.call_args
                    assert "Article analysis failed" in error_call[0][0]

                    # Verify engine was disposed even after error
                    mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_analyze_fetch_creates_engine_with_pool_pre_ping(self):
        """Test that engine is created with pool_pre_ping=True."""
        from src.tasks.background import analyze_fetch_for_articles_task

        history_id = uuid4()

        with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                # Make session factory raise to exit quickly
                mock_sessionmaker.side_effect = Exception("Test exit")

                await analyze_fetch_for_articles_task(history_id)

                # Verify create_async_engine was called with pool_pre_ping=True
                call_kwargs = mock_engine_creator.call_args[1]
                assert call_kwargs.get("pool_pre_ping") is True

    @pytest.mark.asyncio
    async def test_analyze_fetch_logs_large_html_warning(self):
        """Test that large HTML content triggers a warning."""
        from src.tasks.background import analyze_fetch_for_articles_task

        history_id = uuid4()
        source_id = uuid4()

        with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Mock history with LARGE HTML content (>600KB)
                mock_history = MagicMock()
                mock_history.id = history_id
                mock_history.source_id = source_id
                mock_history.html_content = "x" * 700000  # 700KB

                # Mock source
                mock_source = MagicMock()
                mock_source.id = source_id
                mock_source.name = "Test News"
                mock_source.url = "https://example.com"

                mock_result_history = MagicMock()
                mock_result_history.scalar_one_or_none.return_value = mock_history
                mock_result_source = MagicMock()
                mock_result_source.scalar_one_or_none.return_value = mock_source

                mock_session.execute = AsyncMock(
                    side_effect=[mock_result_history, mock_result_source]
                )

                # Mock html_extractor
                with patch("src.tasks.background.html_extractor") as mock_extractor:
                    mock_extracted = ExtractedContent(
                        title="Test Article",
                        main_text="This is the extracted article content that is sufficiently long to pass the minimum length check of 100 characters for article analysis.",
                        publication_date=None,
                        author=None,
                        estimated_tokens=50,
                        extraction_method="fallback",
                    )
                    mock_extractor.extract.return_value = mock_extracted

                    # Mock Claude service to avoid actual API call
                    with patch("src.services.claude_service.claude_service") as mock_claude:
                        mock_claude.analyze_html_for_articles.return_value = ([], 1000)

                        with patch("src.tasks.background.logger") as mock_logger:
                            await analyze_fetch_for_articles_task(history_id)

                            # Verify warning was logged for large content
                            warning_logged = False
                            for call in mock_logger.warning.call_args_list:
                                if "Large HTML content" in call[0][0]:
                                    warning_logged = True
                                    break
                            assert warning_logged, "Expected warning about large HTML content"

    @pytest.mark.asyncio
    async def test_analyze_fetch_extraction_error_fallback(self):
        """Test fallback to raw HTML when extraction fails with HTMLContentExtractorError."""
        from src.tasks.background import analyze_fetch_for_articles_task

        history_id = uuid4()
        source_id = uuid4()

        with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Mock history record with raw HTML
                raw_html = "<html><body>Raw HTML content for fallback</body></html>"
                mock_history = MagicMock()
                mock_history.id = history_id
                mock_history.source_id = source_id
                mock_history.html_content = raw_html
                mock_history.analysis_status = "pending"

                # Mock source record
                mock_source = MagicMock()
                mock_source.id = source_id
                mock_source.name = "Test News"
                mock_source.url = "https://example.com"

                mock_result_history = MagicMock()
                mock_result_history.scalar_one_or_none.return_value = mock_history
                mock_result_source = MagicMock()
                mock_result_source.scalar_one_or_none.return_value = mock_source

                mock_session.execute = AsyncMock(
                    side_effect=[mock_result_history, mock_result_source]
                )

                # Mock html_extractor to raise HTMLContentExtractorError
                with patch("src.tasks.background.html_extractor") as mock_extractor:
                    mock_extractor.extract.side_effect = HTMLContentExtractorError(
                        "Empty HTML content provided"
                    )

                    # Mock Claude service
                    mock_articles = [
                        DiscoveredArticle(
                            url="https://example.com/article/1",
                            title="Test Article",
                            reasoning="Good for culture questions.",
                        )
                    ]
                    with patch("src.services.claude_service.claude_service") as mock_claude:
                        mock_claude.analyze_html_for_articles.return_value = (mock_articles, 1500)

                        with patch("src.tasks.background.logger") as mock_logger:
                            await analyze_fetch_for_articles_task(history_id)

                            # Verify html_extractor was called
                            mock_extractor.extract.assert_called_once()

                            # Verify Claude received raw HTML (fallback)
                            mock_claude.analyze_html_for_articles.assert_called_once_with(
                                html_content=raw_html,
                                source_base_url=mock_source.url,
                            )

                            # Verify warning was logged about extraction failure
                            warning_logged = False
                            for call in mock_logger.warning.call_args_list:
                                if "HTML extraction failed" in call[0][0]:
                                    warning_logged = True
                                    break
                            assert warning_logged, "Expected warning about extraction failure"

                            # Verify analysis still completed successfully
                            assert mock_history.analysis_status == "completed"

    @pytest.mark.asyncio
    async def test_analyze_fetch_extraction_minimal_content_fallback(self):
        """Test fallback to raw HTML when extracted content is too short (<100 chars)."""
        from src.tasks.background import analyze_fetch_for_articles_task

        history_id = uuid4()
        source_id = uuid4()

        with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Mock history record with raw HTML
                raw_html = "<html><body>Full raw HTML content</body></html>"
                mock_history = MagicMock()
                mock_history.id = history_id
                mock_history.source_id = source_id
                mock_history.html_content = raw_html
                mock_history.analysis_status = "pending"

                # Mock source record
                mock_source = MagicMock()
                mock_source.id = source_id
                mock_source.name = "Test News"
                mock_source.url = "https://example.com"

                mock_result_history = MagicMock()
                mock_result_history.scalar_one_or_none.return_value = mock_history
                mock_result_source = MagicMock()
                mock_result_source.scalar_one_or_none.return_value = mock_source

                mock_session.execute = AsyncMock(
                    side_effect=[mock_result_history, mock_result_source]
                )

                # Mock html_extractor to return minimal content (<100 chars)
                with patch("src.tasks.background.html_extractor") as mock_extractor:
                    mock_extracted = ExtractedContent(
                        title="Test",
                        main_text="Short",  # Less than 100 characters
                        publication_date=None,
                        author=None,
                        estimated_tokens=5,
                        extraction_method="fallback",
                    )
                    mock_extractor.extract.return_value = mock_extracted

                    # Mock Claude service
                    mock_articles = [
                        DiscoveredArticle(
                            url="https://example.com/article/1",
                            title="Test Article",
                            reasoning="Good for culture questions.",
                        )
                    ]
                    with patch("src.services.claude_service.claude_service") as mock_claude:
                        mock_claude.analyze_html_for_articles.return_value = (mock_articles, 1500)

                        with patch("src.tasks.background.logger") as mock_logger:
                            await analyze_fetch_for_articles_task(history_id)

                            # Verify html_extractor was called
                            mock_extractor.extract.assert_called_once()

                            # Verify Claude received raw HTML (fallback due to minimal content)
                            mock_claude.analyze_html_for_articles.assert_called_once_with(
                                html_content=raw_html,
                                source_base_url=mock_source.url,
                            )

                            # Verify warning was logged about minimal content
                            warning_logged = False
                            for call in mock_logger.warning.call_args_list:
                                if "minimal content" in call[0][0]:
                                    warning_logged = True
                                    break
                            assert warning_logged, "Expected warning about minimal content"

                            # Verify analysis still completed successfully
                            assert mock_history.analysis_status == "completed"


class TestTriggerArticleAnalysis:
    """Tests for the trigger_article_analysis helper function."""

    def test_trigger_article_analysis_adds_task(self):
        """Test that trigger_article_analysis adds task to background tasks."""
        from src.tasks.background import analyze_fetch_for_articles_task, trigger_article_analysis

        history_id = uuid4()
        mock_background_tasks = MagicMock()

        with patch("src.tasks.background.logger"):
            trigger_article_analysis(history_id, mock_background_tasks)

            mock_background_tasks.add_task.assert_called_once_with(
                analyze_fetch_for_articles_task, history_id
            )

    def test_trigger_article_analysis_logs_info(self):
        """Test that trigger_article_analysis logs the queuing."""
        from src.tasks.background import trigger_article_analysis

        history_id = uuid4()
        mock_background_tasks = MagicMock()

        with patch("src.tasks.background.logger") as mock_logger:
            trigger_article_analysis(history_id, mock_background_tasks)

            mock_logger.info.assert_called_once()
            call_args = mock_logger.info.call_args
            assert "Queued article analysis task" in call_args[0][0]
            assert call_args[1]["extra"]["history_id"] == str(history_id)


class TestModuleImports:
    """Test that module imports work correctly."""

    def test_import_from_tasks_package(self):
        """Test importing functions from src.tasks package."""
        from src.tasks import analyze_fetch_for_articles_task, trigger_article_analysis

        assert callable(analyze_fetch_for_articles_task)
        assert callable(trigger_article_analysis)

    def test_import_from_background_module(self):
        """Test importing directly from background module."""
        from src.tasks.background import analyze_fetch_for_articles_task, trigger_article_analysis

        assert callable(analyze_fetch_for_articles_task)
        assert callable(trigger_article_analysis)

    def test_all_exports_includes_new_functions(self):
        """Test that __all__ includes the new functions."""
        from src.tasks import __all__

        assert "analyze_fetch_for_articles_task" in __all__
        assert "trigger_article_analysis" in __all__
