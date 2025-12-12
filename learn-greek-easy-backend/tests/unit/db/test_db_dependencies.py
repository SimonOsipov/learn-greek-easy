"""Unit tests for database dependencies.

Tests cover:
- get_db() lifecycle management
- get_db_transactional() lifecycle management
- Session commit, rollback, and close behavior
- Error handling during database operations
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def mock_session():
    """Create a mock async session."""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    return session


@pytest.fixture
def mock_session_factory(mock_session):
    """Create a mock session factory that returns the mock session."""
    factory = MagicMock()

    # Make the factory callable and return an async context manager
    async_context = AsyncMock()
    async_context.__aenter__ = AsyncMock(return_value=mock_session)
    async_context.__aexit__ = AsyncMock(return_value=None)

    factory.return_value = async_context
    return factory


# ============================================================================
# get_db() Tests
# ============================================================================


class TestGetDb:
    """Tests for get_db() dependency."""

    @pytest.mark.asyncio
    async def test_get_db_yields_session_successfully(self, mock_session, mock_session_factory):
        """Test that get_db yields a session successfully."""
        from src.db.dependencies import get_db

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            gen = get_db()
            session = await gen.__anext__()

            assert session == mock_session
            mock_session_factory.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_db_commits_on_success(self, mock_session, mock_session_factory):
        """Test that get_db commits the session on successful completion."""
        from src.db.dependencies import get_db

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            gen = get_db()
            await gen.__anext__()

            # Simulate successful completion
            try:
                await gen.__anext__()
            except StopAsyncIteration:
                pass

            mock_session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_db_rollback_on_exception(self, mock_session, mock_session_factory):
        """Test that get_db rolls back on exception."""
        from src.db.dependencies import get_db

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            gen = get_db()
            await gen.__anext__()

            # Simulate an exception
            with pytest.raises(ValueError):
                await gen.athrow(ValueError("Test error"))

            mock_session.rollback.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_db_closes_session_in_finally(self, mock_session, mock_session_factory):
        """Test that get_db always closes the session."""
        from src.db.dependencies import get_db

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            gen = get_db()
            await gen.__anext__()

            # Simulate successful completion
            try:
                await gen.__anext__()
            except StopAsyncIteration:
                pass

            mock_session.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_db_closes_session_on_exception(self, mock_session, mock_session_factory):
        """Test that get_db closes session even on exception."""
        from src.db.dependencies import get_db

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            gen = get_db()
            await gen.__anext__()

            # Simulate an exception
            with pytest.raises(ValueError):
                await gen.athrow(ValueError("Test error"))

            mock_session.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_db_logs_debug_messages(self, mock_session, mock_session_factory):
        """Test that get_db logs debug messages."""
        from src.db.dependencies import get_db

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            with patch("src.db.dependencies.logger") as mock_logger:
                gen = get_db()
                await gen.__anext__()

                # Should log session created
                mock_logger.debug.assert_called()
                calls = [str(call) for call in mock_logger.debug.call_args_list]
                assert any("created" in call.lower() for call in calls)

    @pytest.mark.asyncio
    async def test_get_db_logs_on_commit(self, mock_session, mock_session_factory):
        """Test that get_db logs when committing."""
        from src.db.dependencies import get_db

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            with patch("src.db.dependencies.logger") as mock_logger:
                gen = get_db()
                await gen.__anext__()

                try:
                    await gen.__anext__()
                except StopAsyncIteration:
                    pass

                # Check that commit was logged
                debug_calls = [str(call) for call in mock_logger.debug.call_args_list]
                assert any("commit" in call.lower() for call in debug_calls)

    @pytest.mark.asyncio
    async def test_get_db_logs_on_rollback(self, mock_session, mock_session_factory):
        """Test that get_db logs error on rollback."""
        from src.db.dependencies import get_db

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            with patch("src.db.dependencies.logger") as mock_logger:
                gen = get_db()
                await gen.__anext__()

                with pytest.raises(ValueError):
                    await gen.athrow(ValueError("Test error"))

                # Check that rollback was logged
                mock_logger.error.assert_called()

    @pytest.mark.asyncio
    async def test_get_db_logs_on_close(self, mock_session, mock_session_factory):
        """Test that get_db logs when closing session."""
        from src.db.dependencies import get_db

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            with patch("src.db.dependencies.logger") as mock_logger:
                gen = get_db()
                await gen.__anext__()

                try:
                    await gen.__anext__()
                except StopAsyncIteration:
                    pass

                # Check that close was logged
                debug_calls = [str(call) for call in mock_logger.debug.call_args_list]
                assert any("closed" in call.lower() for call in debug_calls)

    @pytest.mark.asyncio
    async def test_get_db_raises_original_exception(self, mock_session, mock_session_factory):
        """Test that get_db re-raises the original exception after rollback."""
        from src.db.dependencies import get_db

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            gen = get_db()
            await gen.__anext__()

            # The original exception should be re-raised
            with pytest.raises(ValueError, match="Test error"):
                await gen.athrow(ValueError("Test error"))


# ============================================================================
# get_db_transactional() Tests
# ============================================================================


class TestGetDbTransactional:
    """Tests for get_db_transactional() dependency."""

    @pytest.mark.asyncio
    async def test_get_db_transactional_yields_session(self, mock_session, mock_session_factory):
        """Test that get_db_transactional yields a session."""
        from src.db.dependencies import get_db_transactional

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            gen = get_db_transactional()
            session = await gen.__anext__()

            assert session == mock_session

    @pytest.mark.asyncio
    async def test_get_db_transactional_no_auto_commit(self, mock_session, mock_session_factory):
        """Test that get_db_transactional does NOT auto-commit."""
        from src.db.dependencies import get_db_transactional

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            gen = get_db_transactional()
            await gen.__anext__()

            # Complete the generator
            try:
                await gen.__anext__()
            except StopAsyncIteration:
                pass

            # Unlike get_db, this should NOT call commit
            mock_session.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_get_db_transactional_rollback_on_exception(
        self, mock_session, mock_session_factory
    ):
        """Test that get_db_transactional rolls back on exception."""
        from src.db.dependencies import get_db_transactional

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            gen = get_db_transactional()
            await gen.__anext__()

            with pytest.raises(ValueError):
                await gen.athrow(ValueError("Test error"))

            mock_session.rollback.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_db_transactional_closes_session_in_finally(
        self, mock_session, mock_session_factory
    ):
        """Test that get_db_transactional always closes session."""
        from src.db.dependencies import get_db_transactional

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            gen = get_db_transactional()
            await gen.__anext__()

            try:
                await gen.__anext__()
            except StopAsyncIteration:
                pass

            mock_session.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_db_transactional_closes_on_exception(
        self, mock_session, mock_session_factory
    ):
        """Test that get_db_transactional closes session on exception."""
        from src.db.dependencies import get_db_transactional

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            gen = get_db_transactional()
            await gen.__anext__()

            with pytest.raises(RuntimeError):
                await gen.athrow(RuntimeError("Transaction failed"))

            mock_session.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_db_transactional_raises_original_exception(
        self, mock_session, mock_session_factory
    ):
        """Test that get_db_transactional re-raises original exception."""
        from src.db.dependencies import get_db_transactional

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            gen = get_db_transactional()
            await gen.__anext__()

            with pytest.raises(RuntimeError, match="Transaction failed"):
                await gen.athrow(RuntimeError("Transaction failed"))


# ============================================================================
# Edge Cases Tests
# ============================================================================


class TestDependencyEdgeCases:
    """Tests for edge cases in database dependencies."""

    @pytest.mark.asyncio
    async def test_get_db_factory_not_initialized_raises(self):
        """Test that get_db raises when factory is not initialized."""
        from src.db.dependencies import get_db

        with patch(
            "src.db.dependencies.get_session_factory",
            side_effect=RuntimeError("Database not initialized"),
        ):
            gen = get_db()
            with pytest.raises(RuntimeError, match="Database not initialized"):
                await gen.__anext__()

    @pytest.mark.asyncio
    async def test_get_db_transactional_factory_not_initialized_raises(self):
        """Test that get_db_transactional raises when factory is not initialized."""
        from src.db.dependencies import get_db_transactional

        with patch(
            "src.db.dependencies.get_session_factory",
            side_effect=RuntimeError("Database not initialized"),
        ):
            gen = get_db_transactional()
            with pytest.raises(RuntimeError, match="Database not initialized"):
                await gen.__anext__()

    @pytest.mark.asyncio
    async def test_get_db_commit_error_handled(self, mock_session, mock_session_factory):
        """Test that commit errors are handled properly."""
        from src.db.dependencies import get_db

        mock_session.commit = AsyncMock(side_effect=Exception("Commit failed"))

        with patch("src.db.dependencies.get_session_factory", return_value=mock_session_factory):
            gen = get_db()
            await gen.__anext__()

            # Commit failure should raise exception
            with pytest.raises(Exception, match="Commit failed"):
                await gen.__anext__()

    @pytest.mark.asyncio
    async def test_multiple_sessions_are_independent(self, mock_session_factory):
        """Test that multiple get_db calls create independent sessions."""
        from src.db.dependencies import get_db

        session1 = AsyncMock()
        session2 = AsyncMock()

        call_count = 0

        def create_context():
            nonlocal call_count
            call_count += 1
            ctx = AsyncMock()
            ctx.__aenter__ = AsyncMock(return_value=session1 if call_count == 1 else session2)
            ctx.__aexit__ = AsyncMock(return_value=None)
            return ctx

        mock_factory = MagicMock(side_effect=create_context)

        with patch("src.db.dependencies.get_session_factory", return_value=mock_factory):
            gen1 = get_db()
            gen2 = get_db()

            s1 = await gen1.__anext__()
            s2 = await gen2.__anext__()

            assert s1 == session1
            assert s2 == session2
            assert s1 != s2
