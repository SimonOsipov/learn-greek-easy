"""Conftest for tasks integration tests.

This module imports the factory binding fixture from the parent conftest
to ensure factories work correctly in task tests.
"""

from collections.abc import Generator

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.base import BaseFactory


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
    BaseFactory._session = db_session
    yield
    BaseFactory._session = None
