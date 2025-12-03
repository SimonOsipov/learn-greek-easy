"""Base model classes and mixins for SQLAlchemy models."""

from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy models.

    All models should inherit from this class to use the same
    metadata and type annotation mapping.
    """

    # Type annotation map for Python types -> SQL types
    type_annotation_map = {
        datetime: DateTime(timezone=True),
    }

    def __repr__(self) -> str:
        """String representation of model."""
        columns = ", ".join(
            f"{col.name}={getattr(self, col.name)!r}" for col in self.__table__.columns
        )
        return f"{self.__class__.__name__}({columns})"


class TimestampMixin:
    """
    Mixin for created_at and updated_at timestamp columns.

    Automatically tracks creation and update times for all models.

    Usage:
        class User(Base, TimestampMixin):
            __tablename__ = "users"
            id: Mapped[int] = mapped_column(primary_key=True)
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when record was created",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Timestamp when record was last updated",
    )


class SoftDeleteMixin:
    """
    Mixin for soft delete functionality (optional - for future use).

    Adds deleted_at column for soft deletes instead of hard deletes.
    """

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when record was soft deleted",
    )

    @property
    def is_deleted(self) -> bool:
        """Check if record is soft deleted."""
        return self.deleted_at is not None


# Export base classes for model imports
__all__ = [
    "Base",
    "TimestampMixin",
    "SoftDeleteMixin",
]
