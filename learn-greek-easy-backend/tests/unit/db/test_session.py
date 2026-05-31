"""Unit tests for database session management.

Tests cover:
- create_engine() env-dependent paths: NullPool in testing, SSL required in prod,
  pooling config in non-testing environments
- create_session_factory() configuration
- init_db() singleton guard and idempotency
- close_db() module-state reset (and no-op when not initialized)
- get_session_factory() raises before init_db()
- get_session() yields from the global factory

All tests mock create_async_engine so no real DB connection is made.
"""

from unittest.mock import AsyncMock, MagicMock, PropertyMock, patch

import pytest
from sqlalchemy.pool import NullPool

import src.db.session as session_module
from src.config import settings

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture(autouse=True)
def reset_session_module_state():
    """Save and restore the module-level engine/factory globals around each test.

    The production singletons live as module globals; isolating them prevents
    cross-test leakage and leaves the module in its original state afterwards.
    """
    saved_engine = session_module._engine
    saved_factory = session_module._session_factory
    session_module._engine = None
    session_module._session_factory = None
    try:
        yield
    finally:
        session_module._engine = saved_engine
        session_module._session_factory = saved_factory


@pytest.fixture
def mock_engine():
    """A stand-in async engine that records dispose() and supports begin()."""
    engine = MagicMock()
    engine.dispose = AsyncMock()

    # _engine.begin() is used as an async context manager in init_db()
    conn = AsyncMock()
    begin_ctx = AsyncMock()
    begin_ctx.__aenter__ = AsyncMock(return_value=conn)
    begin_ctx.__aexit__ = AsyncMock(return_value=None)
    engine.begin = MagicMock(return_value=begin_ctx)
    return engine


def _patch_env(*, is_testing: bool, is_production: bool):
    """Patch the read-only is_testing / is_production properties on Settings.

    Returns a tuple of context managers the caller enters with `with`.
    """
    testing_patch = patch.object(
        type(settings), "is_testing", new_callable=PropertyMock, return_value=is_testing
    )
    production_patch = patch.object(
        type(settings), "is_production", new_callable=PropertyMock, return_value=is_production
    )
    return testing_patch, production_patch


# ============================================================================
# create_engine() Tests
# ============================================================================


class TestCreateEngine:
    """Tests for create_engine() env-dependent configuration."""

    @pytest.mark.asyncio
    async def test_uses_nullpool_in_testing(self):
        """In testing env, NullPool is used and no pool sizing kwargs are passed."""
        testing_patch, production_patch = _patch_env(is_testing=True, is_production=False)
        with testing_patch, production_patch:
            with patch("src.db.session.create_async_engine") as mock_create:
                session_module.create_engine()

        mock_create.assert_called_once()
        _args, kwargs = mock_create.call_args
        assert kwargs["poolclass"] is NullPool
        # NullPool path must not set queue-pool sizing kwargs
        assert "pool_size" not in kwargs
        assert "max_overflow" not in kwargs
        assert "pool_timeout" not in kwargs

    @pytest.mark.asyncio
    async def test_no_ssl_in_testing(self):
        """Testing env does not request SSL on the asyncpg connection."""
        testing_patch, production_patch = _patch_env(is_testing=True, is_production=False)
        with testing_patch, production_patch:
            with patch("src.db.session.create_async_engine") as mock_create:
                session_module.create_engine()

        _args, kwargs = mock_create.call_args
        assert "ssl" not in kwargs["connect_args"]

    @pytest.mark.asyncio
    async def test_ssl_required_in_production(self):
        """Production env requires SSL on the asyncpg connection."""
        testing_patch, production_patch = _patch_env(is_testing=False, is_production=True)
        with testing_patch, production_patch:
            with patch("src.db.session.create_async_engine") as mock_create:
                session_module.create_engine()

        _args, kwargs = mock_create.call_args
        assert kwargs["connect_args"]["ssl"] == "require"

    @pytest.mark.asyncio
    async def test_pooling_config_when_not_testing(self):
        """Non-testing env uses the queue pool with configured sizing, not NullPool."""
        testing_patch, production_patch = _patch_env(is_testing=False, is_production=True)
        with testing_patch, production_patch:
            with patch("src.db.session.create_async_engine") as mock_create:
                session_module.create_engine()

        _args, kwargs = mock_create.call_args
        assert "poolclass" not in kwargs
        assert kwargs["pool_size"] == settings.database_pool_size
        assert kwargs["max_overflow"] == settings.database_max_overflow
        assert kwargs["pool_timeout"] == settings.database_pool_timeout

    @pytest.mark.asyncio
    async def test_common_engine_kwargs(self):
        """Common kwargs (future, pre-ping, recycle, command_timeout, jit) are always set."""
        testing_patch, production_patch = _patch_env(is_testing=True, is_production=False)
        with testing_patch, production_patch:
            with patch("src.db.session.create_async_engine") as mock_create:
                session_module.create_engine()

        _args, kwargs = mock_create.call_args
        assert kwargs["future"] is True
        assert kwargs["pool_pre_ping"] is True
        assert kwargs["pool_recycle"] == 3600
        assert kwargs["connect_args"]["command_timeout"] == 60
        assert kwargs["connect_args"]["server_settings"] == {"jit": "off"}

    @pytest.mark.asyncio
    async def test_passes_database_url_positionally(self):
        """The configured database URL is passed as the first positional argument."""
        testing_patch, production_patch = _patch_env(is_testing=True, is_production=False)
        with testing_patch, production_patch:
            with patch("src.db.session.create_async_engine") as mock_create:
                session_module.create_engine()

        args, _kwargs = mock_create.call_args
        assert args[0] == settings.database_url

    @pytest.mark.asyncio
    async def test_returns_created_engine(self):
        """create_engine returns whatever create_async_engine produced."""
        sentinel = MagicMock()
        testing_patch, production_patch = _patch_env(is_testing=True, is_production=False)
        with testing_patch, production_patch:
            with patch("src.db.session.create_async_engine", return_value=sentinel):
                result = session_module.create_engine()

        assert result is sentinel


# ============================================================================
# create_session_factory() Tests
# ============================================================================


class TestCreateSessionFactory:
    """Tests for create_session_factory()."""

    def test_returns_async_sessionmaker_bound_to_engine(self):
        """Factory is an async_sessionmaker configured with the expected options."""
        with patch("src.db.session.async_sessionmaker") as mock_maker:
            engine = MagicMock()
            session_module.create_session_factory(engine)

        mock_maker.assert_called_once()
        args, kwargs = mock_maker.call_args
        assert args[0] is engine
        assert kwargs["expire_on_commit"] is False
        assert kwargs["autoflush"] is False
        assert kwargs["autocommit"] is False


# ============================================================================
# init_db() Tests
# ============================================================================


class TestInitDb:
    """Tests for init_db() singleton guard and idempotency."""

    @pytest.mark.asyncio
    async def test_init_db_sets_globals_and_tests_connection(self, mock_engine):
        """init_db creates the engine + factory and runs the SELECT 1 health check."""
        factory = MagicMock()
        with patch("src.db.session.create_engine", return_value=mock_engine) as mock_create:
            with patch(
                "src.db.session.create_session_factory", return_value=factory
            ) as mock_create_factory:
                await session_module.init_db()

        mock_create.assert_called_once()
        mock_create_factory.assert_called_once_with(mock_engine)
        assert session_module._engine is mock_engine
        assert session_module._session_factory is factory
        # Health-check query executed within engine.begin() context
        mock_engine.begin.assert_called_once()

    @pytest.mark.asyncio
    async def test_init_db_idempotent_when_already_initialized(self, mock_engine):
        """A second init_db call is a no-op: it does not recreate the engine."""
        session_module._engine = mock_engine
        session_module._session_factory = MagicMock()

        with patch("src.db.session.create_engine") as mock_create:
            await session_module.init_db()

        mock_create.assert_not_called()
        # Existing engine untouched
        assert session_module._engine is mock_engine

    @pytest.mark.asyncio
    async def test_init_db_reraises_on_connection_failure(self):
        """If the SELECT 1 health check fails, init_db re-raises the error."""
        failing_engine = MagicMock()
        begin_ctx = AsyncMock()
        begin_ctx.__aenter__ = AsyncMock(side_effect=Exception("connection refused"))
        begin_ctx.__aexit__ = AsyncMock(return_value=None)
        failing_engine.begin = MagicMock(return_value=begin_ctx)

        with patch("src.db.session.create_engine", return_value=failing_engine):
            with patch("src.db.session.create_session_factory", return_value=MagicMock()):
                with pytest.raises(Exception, match="connection refused"):
                    await session_module.init_db()


# ============================================================================
# close_db() Tests
# ============================================================================


class TestCloseDb:
    """Tests for close_db() module-state reset."""

    @pytest.mark.asyncio
    async def test_close_db_disposes_and_resets_state(self, mock_engine):
        """close_db disposes the engine and fully clears the module globals."""
        session_module._engine = mock_engine
        session_module._session_factory = MagicMock()

        await session_module.close_db()

        mock_engine.dispose.assert_awaited_once()
        assert session_module._engine is None
        assert session_module._session_factory is None

    @pytest.mark.asyncio
    async def test_close_db_noop_when_not_initialized(self):
        """close_db is a safe no-op when no engine has been created."""
        # autouse fixture already set globals to None
        await session_module.close_db()

        assert session_module._engine is None
        assert session_module._session_factory is None

    @pytest.mark.asyncio
    async def test_init_after_close_recreates_engine(self, mock_engine):
        """After close_db, init_db will create a fresh engine again (state truly reset)."""
        session_module._engine = mock_engine
        session_module._session_factory = MagicMock()
        await session_module.close_db()

        new_engine = MagicMock()
        new_begin_ctx = AsyncMock()
        new_begin_ctx.__aenter__ = AsyncMock(return_value=AsyncMock())
        new_begin_ctx.__aexit__ = AsyncMock(return_value=None)
        new_engine.begin = MagicMock(return_value=new_begin_ctx)

        with patch("src.db.session.create_engine", return_value=new_engine) as mock_create:
            with patch("src.db.session.create_session_factory", return_value=MagicMock()):
                await session_module.init_db()

        mock_create.assert_called_once()
        assert session_module._engine is new_engine


# ============================================================================
# get_session_factory() Tests
# ============================================================================


class TestGetSessionFactory:
    """Tests for get_session_factory() initialization guard."""

    def test_raises_before_init_db(self):
        """get_session_factory raises RuntimeError when factory not initialized."""
        # autouse fixture guarantees _session_factory is None
        with pytest.raises(RuntimeError, match="Database not initialized"):
            session_module.get_session_factory()

    def test_returns_factory_after_init(self):
        """get_session_factory returns the global factory once set."""
        factory = MagicMock()
        session_module._session_factory = factory

        assert session_module.get_session_factory() is factory


# ============================================================================
# get_session() Tests
# ============================================================================


class TestGetSession:
    """Tests for the get_session() convenience generator."""

    @pytest.mark.asyncio
    async def test_get_session_yields_from_global_factory(self):
        """get_session opens a session from the global factory and yields it."""
        mock_session = AsyncMock()
        async_context = AsyncMock()
        async_context.__aenter__ = AsyncMock(return_value=mock_session)
        async_context.__aexit__ = AsyncMock(return_value=None)
        factory = MagicMock(return_value=async_context)

        with patch("src.db.session.get_session_factory", return_value=factory):
            gen = session_module.get_session()
            yielded = await gen.__anext__()

            assert yielded is mock_session
            factory.assert_called_once()

            # Exhaust the generator to trigger context-manager exit
            with pytest.raises(StopAsyncIteration):
                await gen.__anext__()

            async_context.__aexit__.assert_awaited()

    @pytest.mark.asyncio
    async def test_get_session_raises_when_not_initialized(self):
        """get_session propagates the RuntimeError from get_session_factory."""
        gen = session_module.get_session()
        with pytest.raises(RuntimeError, match="Database not initialized"):
            await gen.__anext__()
