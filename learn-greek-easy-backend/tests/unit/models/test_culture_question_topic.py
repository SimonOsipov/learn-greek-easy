"""Unit tests for the CultureQuestion.topic column (WEDGE-01-02).

Regression guard.  These tests lock the schema contract for
`culture_questions.topic`:

  AC-1  `topic` is nullable (no NOT NULL constraint) — existing rows and
        future inserts are never forced to classify a topic.
  AC-2  `topic` is indexed via a single-column, non-unique index named
        `ix_culture_questions_topic` (topic filtering/reporting queries).
  AC-3  `topic` is a plain `String(50)` column — NOT a PostgreSQL native
        enum (Architect decision D1: the closed vocabulary lives in the
        Python-side `CultureTopic` constant from WEDGE-01-01, not a DB enum,
        so new topics don't require a migration to add an enum label).
  AC-4  `topic` has no server_default AND no client-side (Python) default —
        the additive migration must NOT backfill existing rows; a default
        would silently assign a topic to every pre-existing question.

These tests need NO database — they introspect the SQLAlchemy model
in-process via `CultureQuestion.__table__`.

Each test first asserts `"topic" in CultureQuestion.__table__.c` so a
regression that removes the column reads as "column missing" (a clear
AssertionError) rather than an opaque KeyError from indexing `.c.topic`
directly.

The column is declared on `CultureQuestion` in `src/db/models.py` as:
    topic: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
(no server_default, no default).
"""

from sqlalchemy import Enum as SAEnum
from sqlalchemy import String

from src.db.models import CultureQuestion


class TestCultureQuestionTopicColumnContract:
    """AC-1, AC-3, AC-4 — column presence, nullability, type, and no-backfill shape."""

    def test_topic_column_is_nullable(self):
        """AC-1: `topic` must be nullable — no NOT NULL constraint.

        `CultureQuestion` declares the column with `nullable=True`.
        """
        assert "topic" in CultureQuestion.__table__.c, (
            "CultureQuestion.__table__ has no 'topic' column yet — "
            "WEDGE-01-02 has not added it to src/db/models.py"
        )
        assert CultureQuestion.__table__.c.topic.nullable is True, (
            "culture_questions.topic must be nullable — existing rows and "
            "new inserts must never be forced to classify a topic"
        )

    def test_topic_column_type_is_plain_string(self):
        """AC-3: `topic` must be a plain `String(50)` — NOT a PG native enum.

        Guards Architect decision D1: the closed CultureTopic vocabulary is
        enforced in Python (WEDGE-01-01's CultureTopic constant), not via a
        PostgreSQL ENUM type, so adding a new topic value never requires an
        `ALTER TYPE ... ADD VALUE` migration.
        """
        assert "topic" in CultureQuestion.__table__.c, (
            "CultureQuestion.__table__ has no 'topic' column yet — "
            "WEDGE-01-02 has not added it to src/db/models.py"
        )
        topic_type = CultureQuestion.__table__.c.topic.type
        assert not isinstance(topic_type, SAEnum), (
            "culture_questions.topic must NOT be a SQLAlchemy/PG native Enum — "
            "the closed vocabulary is enforced in Python (CultureTopic), not the DB "
            "(Architect D1)"
        )
        assert isinstance(
            topic_type, String
        ), f"culture_questions.topic must be a plain String, got {type(topic_type).__name__}"
        assert topic_type.length == 50, (
            f"culture_questions.topic must be String(50), " f"got String({topic_type.length!r})"
        )

    def test_topic_column_has_no_server_default(self):
        """AC-4: `topic` must have no server_default AND no client-side default.

        This is the shape-level no-backfill guard: the migration must be a
        bare `ADD COLUMN topic ... NULL` with no `DEFAULT` clause and no
        `UPDATE` statement. A server_default (or a Python-side `default=`)
        would mean every pre-existing question silently gets a topic value
        it was never actually classified with.
        """
        assert "topic" in CultureQuestion.__table__.c, (
            "CultureQuestion.__table__ has no 'topic' column yet — "
            "WEDGE-01-02 has not added it to src/db/models.py"
        )
        topic_col = CultureQuestion.__table__.c.topic
        assert (
            topic_col.server_default is None
        ), f"culture_questions.topic must have no server_default (no backfill), got {topic_col.server_default!r}"
        assert (
            topic_col.default is None
        ), f"culture_questions.topic must have no client-side default (no backfill), got {topic_col.default!r}"


class TestCultureQuestionTopicIndex:
    """AC-2 — index contract for culture_questions.topic."""

    def test_topic_column_is_indexed(self):
        """AC-2: A non-unique index named `ix_culture_questions_topic` must
        exist and cover exactly `(topic)`.

        The column declares `index=True` on the mapped_column (SQLAlchemy
        auto-names single-column indexes `ix_<table>_<column>`).
        """
        assert "topic" in CultureQuestion.__table__.c, (
            "CultureQuestion.__table__ has no 'topic' column yet — "
            "WEDGE-01-02 has not added it to src/db/models.py"
        )
        indexes = CultureQuestion.__table__.indexes
        matching = [idx for idx in indexes if idx.name == "ix_culture_questions_topic"]
        assert len(matching) == 1, (
            f"Expected exactly one index named 'ix_culture_questions_topic' on "
            f"CultureQuestion, found {len(matching)}: "
            f"{[idx.name for idx in indexes]}"
        )

        topic_index = matching[0]
        index_cols = [col.name for col in topic_index.columns]
        assert index_cols == [
            "topic"
        ], f"'ix_culture_questions_topic' must cover exactly (topic), got columns {index_cols!r}"
        assert (
            topic_index.unique is False
        ), "'ix_culture_questions_topic' must be non-unique — many questions share a topic"
