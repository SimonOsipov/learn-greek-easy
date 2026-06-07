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


@pytest.fixture
def mock_engine_with_connect():
    """A stand-in async engine that supports both begin() AND connect().

    Used by warm-up and keepalive tests, which call engine.connect() as an
    async context manager.  begin() is kept identical to mock_engine so both
    the connectivity-gate path (uses begin()) and the warm-up path (uses
    connect()) work simultaneously.
    """
    engine = MagicMock()
    engine.dispose = AsyncMock()

    # --- begin() support (connectivity gate in init_db) ---
    begin_conn = AsyncMock()
    begin_ctx = AsyncMock()
    begin_ctx.__aenter__ = AsyncMock(return_value=begin_conn)
    begin_ctx.__aexit__ = AsyncMock(return_value=None)
    engine.begin = MagicMock(return_value=begin_ctx)

    # --- connect() support (warm-up and keepalive pings) ---
    connect_conn = AsyncMock()
    connect_conn.execute = AsyncMock()
    connect_ctx = AsyncMock()
    connect_ctx.__aenter__ = AsyncMock(return_value=connect_conn)
    connect_ctx.__aexit__ = AsyncMock(return_value=None)
    # connect() is called N times; each call returns a fresh context manager.
    # We reuse the same object — the call count on engine.connect tracks usage.
    engine.connect = MagicMock(return_value=connect_ctx)

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


# ============================================================================
# PERF-07-02: init_db() Pool Warm-up Tests
# ============================================================================


class TestInitDbWarmup:
    """Tests for the pool warm-up path added by PERF-07-02.

    init_db gains an optional warm_min parameter.  When non-testing and
    warm_min > 0 the implementation opens warm_min connections (engine.connect())
    and issues SELECT 1 on each one.  In testing mode, or when warm_min=0,
    no connect() calls are made.
    """

    @pytest.mark.asyncio
    async def test_init_db_opens_warm_min_connections(self, mock_engine_with_connect):
        """Non-testing + warm_min=5 → engine.connect() called exactly 5 times."""
        testing_patch, production_patch = _patch_env(is_testing=False, is_production=True)
        factory = MagicMock()

        with testing_patch, production_patch:
            with patch("src.db.session.create_engine", return_value=mock_engine_with_connect):
                with patch("src.db.session.create_session_factory", return_value=factory):
                    # Patch create_task to a no-op so no background task leaks.
                    with patch("asyncio.create_task"):
                        # warm_min=5 is passed explicitly; this will fail with TypeError
                        # until the implementation adds the parameter — correct RED.
                        await session_module.init_db(warm_min=5)

        assert mock_engine_with_connect.connect.call_count == 5

    @pytest.mark.asyncio
    async def test_init_db_runs_select1_on_each_warm_conn(self, mock_engine_with_connect):
        """Each warmed connection's execute() is awaited with a SELECT 1 text clause."""
        testing_patch, production_patch = _patch_env(is_testing=False, is_production=True)
        factory = MagicMock()

        with testing_patch, production_patch:
            with patch("src.db.session.create_engine", return_value=mock_engine_with_connect):
                with patch("src.db.session.create_session_factory", return_value=factory):
                    with patch("asyncio.create_task"):
                        await session_module.init_db(warm_min=3)

        # execute() must have been awaited once per warm connection
        connect_conn = mock_engine_with_connect.connect.return_value.__aenter__.return_value
        assert connect_conn.execute.await_count == 3

        # Each call must have been a text("SELECT 1") — inspect the first arg's text
        for call_args in connect_conn.execute.await_args_list:
            arg = call_args[0][0]
            assert str(arg) == "SELECT 1", f"Expected SELECT 1 text clause, got: {arg!r}"

    @pytest.mark.asyncio
    async def test_init_db_warmup_noop_in_testing(self, mock_engine_with_connect):
        """is_testing=True → engine.connect() is NEVER called (only begin() is used)."""
        testing_patch, production_patch = _patch_env(is_testing=True, is_production=False)
        factory = MagicMock()

        with testing_patch, production_patch:
            with patch("src.db.session.create_engine", return_value=mock_engine_with_connect):
                with patch("src.db.session.create_session_factory", return_value=factory):
                    # In testing mode init_db() currently has no warm_min param — this
                    # call uses the default (no warm_min arg) so it works pre- and
                    # post-implementation for the testing branch.
                    await session_module.init_db()

        assert mock_engine_with_connect.connect.call_count == 0

    @pytest.mark.asyncio
    async def test_init_db_warmup_failure_nonfatal(self, mock_engine_with_connect):
        """A warm-up connect()/execute() failure is non-fatal: init_db() must not raise.

        The connectivity gate (engine.begin()) succeeds.  Only the warm-up
        engine.connect() calls raise — this tests that the soft try/except
        around warm-up prevents startup failure.
        """
        testing_patch, production_patch = _patch_env(is_testing=False, is_production=True)
        factory = MagicMock()

        # Make the warm-up connection's execute raise to simulate a transient error.
        connect_conn = mock_engine_with_connect.connect.return_value.__aenter__.return_value
        connect_conn.execute = AsyncMock(side_effect=Exception("transient warm-up error"))

        with testing_patch, production_patch:
            with patch("src.db.session.create_engine", return_value=mock_engine_with_connect):
                with patch("src.db.session.create_session_factory", return_value=factory):
                    with patch("asyncio.create_task"):
                        # Must NOT raise even though warm-up connections fail.
                        await session_module.init_db(warm_min=2)

        # Engine and factory globals must be set — startup completed despite the failure.
        assert session_module._engine is mock_engine_with_connect
        assert session_module._session_factory is factory


# ============================================================================
# PERF-07-03: Keepalive Task Tests
# ============================================================================


class TestKeepalive:
    """Tests for the background keepalive task added by PERF-07-03.

    init_db() starts an asyncio.Task that periodically pings the pool.
    close_db() must cancel and await it.  The loop must survive transient
    ping errors without dying.
    """

    @pytest.mark.asyncio
    async def test_init_db_starts_keepalive_task(self, mock_engine_with_connect):
        """Non-testing + warm_min>0 → _keepalive_task is a live asyncio.Task."""
        import asyncio

        testing_patch, production_patch = _patch_env(is_testing=False, is_production=True)
        factory = MagicMock()

        # Access the attribute name at runtime so collection succeeds pre-implementation.
        try:
            with testing_patch, production_patch:
                with patch("src.db.session.create_engine", return_value=mock_engine_with_connect):
                    with patch("src.db.session.create_session_factory", return_value=factory):
                        with patch("src.db.session.settings") as mock_settings:
                            mock_settings.database_pool_warm_min = 1
                            mock_settings.is_testing = False
                            mock_settings.is_production = True
                            mock_settings.database_url = "postgresql+asyncpg://test/test"
                            mock_settings.debug = False
                            mock_settings.database_pool_size = 5
                            mock_settings.database_max_overflow = 10
                            mock_settings.database_pool_timeout = 30
                            # Let the real create_task run (don't patch it) so we get a real Task.
                            await session_module.init_db(warm_min=1)

            task = session_module._keepalive_task  # AttributeError if not implemented → RED
            assert isinstance(task, asyncio.Task), f"Expected asyncio.Task, got {type(task)}"
            assert not task.done(), "Keepalive task should still be running"
        finally:
            # Cancel to avoid 300s-sleeping task leaking across tests.
            task = getattr(session_module, "_keepalive_task", None)
            if task is not None and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
            session_module._keepalive_task = None  # type: ignore[attr-defined]

    @pytest.mark.asyncio
    async def test_keepalive_noop_in_testing(self, mock_engine_with_connect):
        """is_testing=True → _keepalive_task remains None after init_db()."""
        testing_patch, production_patch = _patch_env(is_testing=True, is_production=False)
        factory = MagicMock()

        with testing_patch, production_patch:
            with patch("src.db.session.create_engine", return_value=mock_engine_with_connect):
                with patch("src.db.session.create_session_factory", return_value=factory):
                    await session_module.init_db()

        task = getattr(session_module, "_keepalive_task", None)
        assert task is None, f"Expected _keepalive_task to be None in testing mode, got {task!r}"

    @pytest.mark.asyncio
    async def test_keepalive_pings_pool_each_tick(self, mock_engine_with_connect):
        """_keepalive_ping(warm_min) issues SELECT 1 exactly warm_min times."""
        # Access _keepalive_ping at runtime — AttributeError if not implemented → RED.
        ping_fn = getattr(session_module, "_keepalive_ping", None)
        assert (
            ping_fn is not None
        ), "_keepalive_ping not found on session_module — implementation not yet added"

        # Point the module's _engine at our mock so the ping uses it.
        session_module._engine = mock_engine_with_connect

        await ping_fn(3)

        connect_conn = mock_engine_with_connect.connect.return_value.__aenter__.return_value
        assert (
            connect_conn.execute.await_count == 3
        ), f"Expected 3 execute calls, got {connect_conn.execute.await_count}"

    @pytest.mark.asyncio
    async def test_close_db_cancels_keepalive(self, mock_engine_with_connect):
        """close_db() cancels the keepalive task, does not propagate CancelledError,
        sets _keepalive_task=None, and calls engine.dispose() after cancellation.
        """
        import asyncio

        # Set up a real long-running task to stand in for the keepalive loop.
        dummy_task = asyncio.create_task(asyncio.sleep(3600))
        session_module._keepalive_task = dummy_task  # type: ignore[attr-defined]
        session_module._engine = mock_engine_with_connect
        session_module._session_factory = MagicMock()

        # close_db must not raise.
        await session_module.close_db()

        # Task must be cancelled.
        assert dummy_task.cancelled(), "Keepalive task was not cancelled by close_db()"

        # _keepalive_task global must be cleared.
        remaining = getattr(session_module, "_keepalive_task", "MISSING")
        assert (
            remaining is None
        ), f"Expected _keepalive_task=None after close_db(), got {remaining!r}"

        # dispose() must have been called (after cancellation).
        mock_engine_with_connect.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_keepalive_survives_transient_ping_error(self):
        """The keepalive loop logs a warning on a failed ping tick and keeps running.

        Strategy:
        - Patch _keepalive_ping to raise on the first call.
        - Patch asyncio.sleep to be a no-op on first call, then raise CancelledError
          on the second call to terminate the loop cleanly.
        - Assert the ping-raised exception did NOT kill the loop (loop ran at least
          once after the failure attempt before the CancelledError stopped it).
        """
        import asyncio

        loop_fn = getattr(session_module, "_keepalive_loop", None)
        assert (
            loop_fn is not None
        ), "_keepalive_loop not found on session_module — implementation not yet added"

        ping_call_count = 0

        async def fake_ping(warm_min: int) -> None:
            nonlocal ping_call_count
            ping_call_count += 1
            raise Exception("transient network error")

        sleep_call_count = 0

        async def fake_sleep(_seconds: float) -> None:
            nonlocal sleep_call_count
            sleep_call_count += 1
            if sleep_call_count >= 2:
                # Second sleep call terminates the loop via CancelledError.
                raise asyncio.CancelledError("test teardown")

        with patch.object(session_module, "_keepalive_ping", new=fake_ping):
            with patch("asyncio.sleep", new=fake_sleep):
                try:
                    await loop_fn(2)
                except asyncio.CancelledError:
                    pass  # Expected — this is how we exit the loop.

        # The loop must have attempted the ping at least once (proven the loop body ran).
        assert ping_call_count >= 1, f"Expected at least 1 ping attempt, got {ping_call_count}"
        # The loop must have attempted a second sleep, proving it didn't exit after
        # the first ping failure (i.e. the transient error was caught, not re-raised).
        assert (
            sleep_call_count >= 2
        ), f"Expected >=2 sleep calls (loop continued after error), got {sleep_call_count}"


# ============================================================================
# PERF-07-04: warm_min Override / Settings-Default Tests
# ============================================================================


class TestWarmMinOverride:
    """Tests for the warm_min parameter contract added by PERF-07-04.

    init_db(warm_min=N) overrides settings.database_pool_warm_min.
    init_db(warm_min=0) disables both warm-up and keepalive entirely.
    init_db() with no arg falls back to settings.database_pool_warm_min.
    """

    @pytest.mark.asyncio
    async def test_init_db_respects_warm_min_override(self, mock_engine_with_connect):
        """init_db(warm_min=1) in non-testing mode → exactly 1 warm connect() opened."""
        testing_patch, production_patch = _patch_env(is_testing=False, is_production=True)
        factory = MagicMock()

        with testing_patch, production_patch:
            with patch("src.db.session.create_engine", return_value=mock_engine_with_connect):
                with patch("src.db.session.create_session_factory", return_value=factory):
                    with patch("asyncio.create_task"):
                        await session_module.init_db(warm_min=1)

        assert mock_engine_with_connect.connect.call_count == 1, (
            f"Expected 1 warm connect() for warm_min=1, "
            f"got {mock_engine_with_connect.connect.call_count}"
        )

    @pytest.mark.asyncio
    async def test_init_db_warm_min_zero_opts_out(self, mock_engine_with_connect):
        """init_db(warm_min=0) → no connect() calls, no create_task(), _keepalive_task=None."""
        testing_patch, production_patch = _patch_env(is_testing=False, is_production=True)
        factory = MagicMock()

        with testing_patch, production_patch:
            with patch("src.db.session.create_engine", return_value=mock_engine_with_connect):
                with patch("src.db.session.create_session_factory", return_value=factory):
                    with patch("asyncio.create_task") as mock_create_task:
                        await session_module.init_db(warm_min=0)

        assert (
            mock_engine_with_connect.connect.call_count == 0
        ), "connect() must not be called when warm_min=0"
        mock_create_task.assert_not_called()

        task = getattr(session_module, "_keepalive_task", None)
        assert task is None, f"_keepalive_task must be None when warm_min=0, got {task!r}"

    @pytest.mark.asyncio
    async def test_api_init_db_uses_settings_default(self, mock_engine_with_connect):
        """init_db() with no arg uses settings.database_pool_warm_min as warm_min.

        database_pool_warm_min is a new settings attribute added by the implementation;
        we stub the entire settings object so the test runs even before the attribute exists.
        """
        testing_patch, production_patch = _patch_env(is_testing=False, is_production=True)
        factory = MagicMock()

        with testing_patch, production_patch:
            with patch("src.db.session.create_engine", return_value=mock_engine_with_connect):
                with patch("src.db.session.create_session_factory", return_value=factory):
                    # Stub settings to inject database_pool_warm_min=3.
                    # We patch the module-level `settings` reference used by init_db()
                    # so the new attribute is visible before the real Settings class has it.
                    with patch("src.db.session.settings") as mock_settings:
                        mock_settings.database_pool_warm_min = 3
                        mock_settings.is_testing = False
                        mock_settings.is_production = True
                        mock_settings.database_url = "postgresql+asyncpg://test/test"
                        mock_settings.debug = False
                        mock_settings.database_pool_size = 5
                        mock_settings.database_max_overflow = 10
                        mock_settings.database_pool_timeout = 30
                        with patch("asyncio.create_task"):
                            # No warm_min arg → implementation must read from settings.
                            await session_module.init_db()

        assert mock_engine_with_connect.connect.call_count == 3, (
            f"Expected 3 warm connects (settings.database_pool_warm_min=3), "
            f"got {mock_engine_with_connect.connect.call_count}"
        )
