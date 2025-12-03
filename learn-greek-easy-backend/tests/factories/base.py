"""Base factory class with async SQLAlchemy support.

This module provides the foundation for all test factories:
- BaseFactory with async session management
- Faker configuration with Greek provider
- Common Meta options for all factories

Usage:
    class MyFactory(BaseFactory):
        class Meta:
            model = MyModel

        field = "value"

    # In tests (with db_session fixture)
    obj = await MyFactory.create()
"""

from datetime import datetime
from typing import Any, TypeVar
from uuid import uuid4

import factory
from faker import Faker
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.providers.greek import GreekProvider

# Configure Faker with Greek provider (module-level)
fake = Faker()
fake.add_provider(GreekProvider)

T = TypeVar("T")

# Module-level session storage
_factory_session: AsyncSession | None = None


class BaseFactory(factory.Factory):
    """Base factory class for all model factories.

    Provides:
    - Async SQLAlchemy session binding
    - Faker instance with Greek provider
    - Common Meta options
    - Async create/build methods

    All factories should inherit from this class.

    Example:
        class UserFactory(BaseFactory):
            class Meta:
                model = User

            email = factory.LazyAttribute(lambda _: f"user_{uuid4().hex[:8]}@example.com")

        # Usage
        user = await UserFactory.create()
    """

    class Meta:
        """Factory meta options."""
        abstract = True

    @classmethod
    def _create(cls, model_class: type[T], *args: Any, **kwargs: Any) -> T:
        """Create a model instance.

        This method is called by factory.create(). For async support,
        we create the instance and add it to the session, but commit
        must be handled separately.

        Args:
            model_class: The model class to instantiate
            *args: Positional arguments (unused)
            **kwargs: Model field values

        Returns:
            Model instance (uncommitted)
        """
        instance = model_class(**kwargs)
        return instance

    @classmethod
    async def create(cls, session: AsyncSession | None = None, **kwargs: Any) -> T:
        """Create and persist a model instance asynchronously.

        Args:
            session: Optional AsyncSession (uses bound session if not provided)
            **kwargs: Field overrides

        Returns:
            Persisted model instance

        Raises:
            ValueError: If no session is available
        """
        global _factory_session
        db_session = session or _factory_session
        if db_session is None:
            raise ValueError(
                "No database session available. Either pass session parameter "
                "or ensure the factory session fixture is active."
            )

        # Build the instance using factory-boy
        instance = cls.build(**kwargs)

        # Add to session and commit
        db_session.add(instance)
        await db_session.flush()  # Get ID assigned
        await db_session.refresh(instance)

        return instance

    @classmethod
    async def create_batch(
        cls,
        size: int,
        session: AsyncSession | None = None,
        **kwargs: Any,
    ) -> list[T]:
        """Create multiple model instances asynchronously.

        Args:
            size: Number of instances to create
            session: Optional AsyncSession
            **kwargs: Field overrides (applied to all instances)

        Returns:
            List of persisted model instances
        """
        instances = []
        for _ in range(size):
            instance = await cls.create(session=session, **kwargs)
            instances.append(instance)
        return instances

    @classmethod
    def build(cls, **kwargs: Any) -> T:
        """Build a model instance without persisting.

        Args:
            **kwargs: Field overrides

        Returns:
            Model instance (not added to session)
        """
        return super().build(**kwargs)

    @classmethod
    def build_batch(cls, size: int, **kwargs: Any) -> list[T]:
        """Build multiple model instances without persisting.

        Args:
            size: Number of instances to build
            **kwargs: Field overrides

        Returns:
            List of model instances
        """
        return super().build_batch(size, **kwargs)


# =============================================================================
# Session Management Functions
# =============================================================================


def set_factory_session(session: AsyncSession | None) -> None:
    """Set the global factory session.

    Args:
        session: The async database session to use for factories
    """
    global _factory_session
    _factory_session = session


def get_factory_session() -> AsyncSession | None:
    """Get the global factory session.

    Returns:
        The current async database session or None
    """
    return _factory_session


# Backward compatibility - expose _session as a property on BaseFactory
# This allows `BaseFactory._session = db_session` to work
class _SessionDescriptor:
    """Descriptor for backward-compatible _session attribute."""

    def __get__(self, obj, objtype=None) -> AsyncSession | None:
        return get_factory_session()

    def __set__(self, obj, value: AsyncSession | None) -> None:
        set_factory_session(value)


# Add the descriptor to BaseFactory
BaseFactory._session = _SessionDescriptor()


# =============================================================================
# Utility Functions
# =============================================================================


def unique_email() -> str:
    """Generate a unique email address.

    Returns:
        str: Unique email like "user_a1b2c3d4@example.com"
    """
    return f"user_{uuid4().hex[:8]}@example.com"


def unique_token() -> str:
    """Generate a unique token string.

    Returns:
        str: UUID-based token string
    """
    return str(uuid4())


def utc_now() -> datetime:
    """Get current UTC datetime.

    Returns:
        datetime: Current UTC time
    """
    return datetime.utcnow()
