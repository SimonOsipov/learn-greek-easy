"""Conftest for tasks integration tests.

This module imports the factory binding fixture from the parent conftest
to ensure factories work correctly in task tests.

TODO: The spaCy mock is duplicated across tests/integration/services/conftest.py,
tests/unit/services/conftest.py, and tests/unit/tasks/conftest.py (and anywhere
else that transitively imports src.services.morphology_service). Centralizing it
into tests/conftest.py (or a shared helper) was suggested by CodeRabbit but deferred
to a follow-up PR because refactoring across multiple conftest files risks breaking
other suites. Track as tech-debt alongside the token-migration track.
"""

from collections.abc import AsyncGenerator, Generator

import pytest
import pytest_asyncio
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Achievement
from src.services.achievement_definitions import ACHIEVEMENTS as ACHIEVEMENT_DEFS
from tests.factories.base import set_factory_session


@pytest.fixture(autouse=True)
def bind_factory_session(db_session: AsyncSession) -> Generator[None, None, None]:
    """Bind the database session to all factories for integration tests.

    This fixture automatically binds the db_session to BaseFactory,
    making it available to all factory classes in integration tests.

    The binding is done before each test and cleared after.

    Args:
        db_session: The test database session fixture.

    Yields:
        None: Allows the test to run.
    """
    set_factory_session(db_session)
    yield
    set_factory_session(None)


@pytest_asyncio.fixture(autouse=True)
async def seed_achievement_catalog(db_session: AsyncSession) -> AsyncGenerator[None, None]:
    """Seed the full Achievement catalog before each integration test.

    The reconciler evaluates ALL 45 achievement definitions and may insert
    UserAchievement rows for any achievement whose metric threshold is met.
    Each UserAchievement FK-references the achievements table, so the full
    catalog must exist before any reconcile call — even when a test only
    expects a single achievement to be unlocked.

    Uses pg_insert ON CONFLICT DO NOTHING so this fixture is idempotent
    and safe to run even if the catalog was partially seeded by another fixture.

    Args:
        db_session: The test database session fixture.

    Yields:
        None: Allows the test to run.
    """
    rows = [
        {
            "id": d.id,
            "name": d.name,
            "description": d.description,
            "category": d.category,
            "icon": d.icon,
            "threshold": d.threshold,
            "xp_reward": d.xp_reward,
            "sort_order": i,
        }
        for i, d in enumerate(ACHIEVEMENT_DEFS)
    ]
    await db_session.execute(pg_insert(Achievement).values(rows).on_conflict_do_nothing())
    await db_session.flush()
    yield
