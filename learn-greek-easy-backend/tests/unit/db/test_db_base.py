"""Unit tests for src/db/base.py — Base, TimestampMixin, SoftDeleteMixin.

Tests cover:
- Base.type_annotation_map maps datetime -> DateTime(timezone=True)
- TimestampMixin created_at/updated_at columns are tz-aware
- Base.__repr__ includes every column name and its value
- SoftDeleteMixin.is_deleted is False when deleted_at is None, True otherwise
- SoftDeleteMixin.deleted_at column is tz-aware and nullable

All tests are pure-unit (no database required) — concrete model classes are
defined locally to avoid spinning up the SQLAlchemy engine or touching the DB.
"""

from datetime import datetime, timezone

from sqlalchemy import inspect
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base, SoftDeleteMixin, TimestampMixin

# ---------------------------------------------------------------------------
# Local concrete models
# ---------------------------------------------------------------------------
# We define throwaway models here so that the tests exercise the REAL
# Base / TimestampMixin / SoftDeleteMixin classes from src.db.base without
# needing a live database session.


class _ConcreteTimestamp(Base, TimestampMixin):
    """Minimal model that mixes in TimestampMixin."""

    __tablename__ = "_test_concrete_timestamp"

    id: Mapped[int] = mapped_column(primary_key=True)


class _ConcreteAnnotated(Base):
    """Model that relies on Base.type_annotation_map for a bare Mapped[datetime]."""

    __tablename__ = "_test_concrete_annotated"

    id: Mapped[int] = mapped_column(primary_key=True)
    # No explicit DateTime(...) — the type_annotation_map on Base must supply it.
    ts: Mapped[datetime] = mapped_column()


class _ConcreteSoftDelete(Base, SoftDeleteMixin):
    """Minimal model that mixes in SoftDeleteMixin."""

    __tablename__ = "_test_concrete_soft_delete"

    id: Mapped[int] = mapped_column(primary_key=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_UTC_NOW = datetime(2024, 6, 1, 12, 0, 0, tzinfo=timezone.utc)


def _column(model_cls, name: str):
    """Return the SQLAlchemy Column object for a given model + column name."""
    mapper = inspect(model_cls)
    return {c.name: c for c in mapper.columns}[name]


# ===========================================================================
# TimestampMixin
# ===========================================================================


class TestTimestampMixinColumnTypes:
    """TimestampMixin created_at / updated_at are DateTime(timezone=True)."""

    def test_created_at_is_datetime_type(self):
        col = _column(_ConcreteTimestamp, "created_at")
        assert type(col.type).__name__ == "DateTime"

    def test_created_at_is_timezone_aware(self):
        col = _column(_ConcreteTimestamp, "created_at")
        assert col.type.timezone is True

    def test_updated_at_is_datetime_type(self):
        col = _column(_ConcreteTimestamp, "updated_at")
        assert type(col.type).__name__ == "DateTime"

    def test_updated_at_is_timezone_aware(self):
        col = _column(_ConcreteTimestamp, "updated_at")
        assert col.type.timezone is True

    def test_created_at_is_not_nullable(self):
        col = _column(_ConcreteTimestamp, "created_at")
        assert col.nullable is False

    def test_updated_at_is_not_nullable(self):
        col = _column(_ConcreteTimestamp, "updated_at")
        assert col.nullable is False

    def test_model_instance_stores_tz_aware_value(self):
        """Values assigned to created_at/updated_at retain tzinfo."""
        m = _ConcreteTimestamp(id=1, created_at=_UTC_NOW, updated_at=_UTC_NOW)
        assert m.created_at.tzinfo is not None
        assert m.updated_at.tzinfo is not None


# ===========================================================================
# Base.type_annotation_map
# ===========================================================================


class TestBaseTypeAnnotationMap:
    """Base.type_annotation_map maps bare Mapped[datetime] -> DateTime(tz=True)."""

    def test_annotated_datetime_column_is_timezone_aware(self):
        """A Mapped[datetime] column without explicit type gets timezone=True from the map."""
        col = _column(_ConcreteAnnotated, "ts")
        assert col.type.timezone is True

    def test_annotated_datetime_column_type_name(self):
        col = _column(_ConcreteAnnotated, "ts")
        assert type(col.type).__name__ == "DateTime"


# ===========================================================================
# Base.__repr__
# ===========================================================================


class TestBaseRepr:
    """Base.__repr__ emits ClassName(col=val, ...) for every table column."""

    def test_repr_starts_with_class_name(self):
        m = _ConcreteTimestamp(id=5, created_at=_UTC_NOW, updated_at=_UTC_NOW)
        assert repr(m).startswith("_ConcreteTimestamp(")

    def test_repr_contains_id_column(self):
        m = _ConcreteTimestamp(id=42, created_at=_UTC_NOW, updated_at=_UTC_NOW)
        assert "id=42" in repr(m)

    def test_repr_contains_created_at_column(self):
        m = _ConcreteTimestamp(id=1, created_at=_UTC_NOW, updated_at=_UTC_NOW)
        assert "created_at=" in repr(m)

    def test_repr_contains_updated_at_column(self):
        m = _ConcreteTimestamp(id=1, created_at=_UTC_NOW, updated_at=_UTC_NOW)
        assert "updated_at=" in repr(m)

    def test_repr_contains_all_columns(self):
        """Every column defined on the table appears in repr."""
        m = _ConcreteTimestamp(id=7, created_at=_UTC_NOW, updated_at=_UTC_NOW)
        r = repr(m)
        for col in _ConcreteTimestamp.__table__.columns:
            assert col.name in r, f"Column '{col.name}' missing from repr"

    def test_repr_reflects_none_value(self):
        """Columns set to None are shown as None in repr."""
        m = _ConcreteTimestamp(id=3, created_at=None, updated_at=None)
        assert "created_at=None" in repr(m)

    def test_repr_format_wraps_in_parens(self):
        """Overall repr ends with ')' and contains '='."""
        m = _ConcreteTimestamp(id=1, created_at=_UTC_NOW, updated_at=_UTC_NOW)
        r = repr(m)
        assert r.endswith(")")
        assert "=" in r

    def test_repr_differs_across_instances(self):
        m1 = _ConcreteTimestamp(id=1, created_at=_UTC_NOW, updated_at=_UTC_NOW)
        m2 = _ConcreteTimestamp(id=2, created_at=_UTC_NOW, updated_at=_UTC_NOW)
        assert repr(m1) != repr(m2)


# ===========================================================================
# SoftDeleteMixin
# ===========================================================================


class TestSoftDeleteMixinIsDeleted:
    """SoftDeleteMixin.is_deleted reflects deleted_at presence."""

    def test_is_deleted_false_when_deleted_at_is_none(self):
        m = _ConcreteSoftDelete(id=1, deleted_at=None)
        assert m.is_deleted is False

    def test_is_deleted_true_when_deleted_at_is_set(self):
        m = _ConcreteSoftDelete(id=2, deleted_at=_UTC_NOW)
        assert m.is_deleted is True

    def test_is_deleted_transitions_false_to_true(self):
        """Assigning deleted_at after construction updates is_deleted."""
        m = _ConcreteSoftDelete(id=3, deleted_at=None)
        assert m.is_deleted is False
        m.deleted_at = _UTC_NOW
        assert m.is_deleted is True

    def test_is_deleted_transitions_true_to_false(self):
        """Clearing deleted_at resets is_deleted to False."""
        m = _ConcreteSoftDelete(id=4, deleted_at=_UTC_NOW)
        assert m.is_deleted is True
        m.deleted_at = None
        assert m.is_deleted is False


class TestSoftDeleteMixinColumnType:
    """SoftDeleteMixin.deleted_at column metadata."""

    def test_deleted_at_is_datetime_type(self):
        col = _column(_ConcreteSoftDelete, "deleted_at")
        assert type(col.type).__name__ == "DateTime"

    def test_deleted_at_is_timezone_aware(self):
        col = _column(_ConcreteSoftDelete, "deleted_at")
        assert col.type.timezone is True

    def test_deleted_at_is_nullable(self):
        """deleted_at must be nullable — it is None for non-deleted records."""
        col = _column(_ConcreteSoftDelete, "deleted_at")
        assert col.nullable is True
