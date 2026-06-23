"""Unit tests for WordProposalReviewLog model — LEXGEN-13-01, Mode A RED spec.

AC-1  WordProposalReviewLog has the required columns + two PG enum types
      (review_action, human_decision) with correct values + two FKs.
AC-3  Both new tables have tz-aware not-null created_at; neither has updated_at.
AC-4  Neither new table has a forbidden score-type column
      ({trust_score, confidence, aggregate, overall, score}).
      Note: `judge_scores` on proposal_attempt is a JSONB snapshot — it is
      ALLOWED and must NOT be forbidden.

All tests are pure-unit (no database).  The new model symbols are imported
INSIDE each test function so that this file is fully collectable even before
the executor adds WordProposalReviewLog / ProposalAttempt to src/db/models.py.
A collection-level ImportError would hide all tests; a per-test ImportError
produces a clean FAILED / ERROR naming the missing symbol.
"""

import importlib

from sqlalchemy import inspect as sa_inspect

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_model(name: str):
    """Import a model class by name from src.db.models.

    Raises ImportError (surfaced as a test ERROR) if the symbol does not exist.
    This is the correct RED failure mode for Mode A — the test runner reports
    the missing model by name, the test is collected, other tests still run.
    """
    mod = importlib.import_module("src.db.models")
    cls = getattr(mod, name, None)
    if cls is None:
        raise ImportError(
            f"src.db.models has no attribute '{name}' — "
            "the executor has not implemented this model yet (LEXGEN-13-01)"
        )
    return cls


def _columns(model_cls) -> dict:
    """Return {column_name: Column} for a SQLAlchemy mapped class."""
    mapper = sa_inspect(model_cls)
    return {c.name: c for c in mapper.columns}


def _fk_targets(model_cls) -> set[str]:
    """Return the set of FK target strings ('table.column') for a model."""
    mapper = sa_inspect(model_cls)
    targets = set()
    for col in mapper.columns:
        for fk in col.foreign_keys:
            targets.add(fk.target_fullname)
    return targets


# ===========================================================================
# AC-1: WordProposalReviewLog columns, enum values, and FKs
# ===========================================================================


class TestReviewLogColumnsAndEnums:
    """AC-1: WordProposalReviewLog has required columns, enum values, and FKs."""

    def test_review_log_columns_present(self):
        """All required columns exist on the model."""
        ReviewLog = _get_model("WordProposalReviewLog")
        cols = _columns(ReviewLog)
        required = {
            "id",
            "proposal_id",
            "action",
            "field",
            "pipeline_value",
            "human_decision",
            "edited_value",
            "reviewer_id",
            "created_at",
        }
        missing = required - cols.keys()
        assert not missing, f"WordProposalReviewLog is missing columns: {missing}"

    def test_review_action_enum_values(self):
        """ReviewAction enum (review_action) has values: approve, edit, regenerate, reject."""
        mod = importlib.import_module("src.db.models")
        ReviewAction = getattr(mod, "ReviewAction", None)
        if ReviewAction is None:
            raise ImportError(
                "src.db.models has no 'ReviewAction' enum — " "LEXGEN-13-01 not implemented yet"
            )
        values = {e.value for e in ReviewAction}
        expected = {"approve", "edit", "regenerate", "reject"}
        assert (
            values == expected
        ), f"ReviewAction values mismatch: got {values}, expected {expected}"

    def test_human_decision_enum_values(self):
        """HumanDecision enum (human_decision) has values: accept, edit, reject."""
        mod = importlib.import_module("src.db.models")
        HumanDecision = getattr(mod, "HumanDecision", None)
        if HumanDecision is None:
            raise ImportError(
                "src.db.models has no 'HumanDecision' enum — " "LEXGEN-13-01 not implemented yet"
            )
        values = {e.value for e in HumanDecision}
        expected = {"accept", "edit", "reject"}
        assert (
            values == expected
        ), f"HumanDecision values mismatch: got {values}, expected {expected}"

    def test_review_log_fk_to_word_proposal(self):
        """proposal_id is a FK targeting word_proposal.id."""
        ReviewLog = _get_model("WordProposalReviewLog")
        targets = _fk_targets(ReviewLog)
        assert "word_proposal.id" in targets, (
            f"WordProposalReviewLog has no FK to word_proposal.id; " f"found FK targets: {targets}"
        )

    def test_review_log_fk_to_users(self):
        """reviewer_id is a FK targeting users.id."""
        ReviewLog = _get_model("WordProposalReviewLog")
        targets = _fk_targets(ReviewLog)
        assert "users.id" in targets, (
            f"WordProposalReviewLog has no FK to users.id; " f"found FK targets: {targets}"
        )

    def test_review_log_nullable_columns(self):
        """field, pipeline_value, human_decision, edited_value are nullable."""
        ReviewLog = _get_model("WordProposalReviewLog")
        cols = _columns(ReviewLog)
        for col_name in ("field", "pipeline_value", "human_decision", "edited_value"):
            assert col_name in cols, f"Column '{col_name}' missing from WordProposalReviewLog"
            assert (
                cols[col_name].nullable is True
            ), f"WordProposalReviewLog.{col_name} must be nullable"

    def test_review_log_action_not_nullable(self):
        """action column is NOT nullable."""
        ReviewLog = _get_model("WordProposalReviewLog")
        cols = _columns(ReviewLog)
        assert "action" in cols, "Column 'action' missing from WordProposalReviewLog"
        assert cols["action"].nullable is False, "WordProposalReviewLog.action must NOT be nullable"

    def test_review_log_id_is_uuid_pk(self):
        """id is the primary key."""
        ReviewLog = _get_model("WordProposalReviewLog")
        cols = _columns(ReviewLog)
        assert "id" in cols, "Column 'id' missing from WordProposalReviewLog"
        assert cols["id"].primary_key is True, "WordProposalReviewLog.id must be the primary key"


# ===========================================================================
# AC-3: created_at present + tz-aware + not-null; updated_at ABSENT — BOTH tables
# ===========================================================================


class TestReviewTablesHaveCreatedAtNoUpdatedAt:
    """AC-3: Both new tables have tz-aware not-null created_at; NO updated_at."""

    def _assert_created_at(self, model_name: str) -> None:
        model_cls = _get_model(model_name)
        cols = _columns(model_cls)

        # created_at must exist
        assert "created_at" in cols, f"{model_name} is missing 'created_at' column"
        col = cols["created_at"]

        # must be tz-aware DateTime
        assert (
            type(col.type).__name__ == "DateTime"
        ), f"{model_name}.created_at must be DateTime, got {type(col.type).__name__}"
        assert col.type.timezone is True, f"{model_name}.created_at must be timezone=True"

        # must NOT be nullable
        assert col.nullable is False, f"{model_name}.created_at must be NOT NULL (nullable=False)"

    def _assert_no_updated_at(self, model_name: str) -> None:
        model_cls = _get_model(model_name)
        cols = _columns(model_cls)
        assert "updated_at" not in cols, (
            f"{model_name} must NOT have an 'updated_at' column "
            "(spec says standalone created_at only — NOT TimestampMixin)"
        )

    def test_review_log_created_at_tz_aware_not_null(self):
        """WordProposalReviewLog.created_at is tz-aware and NOT NULL."""
        self._assert_created_at("WordProposalReviewLog")

    def test_review_log_no_updated_at(self):
        """WordProposalReviewLog must NOT have updated_at."""
        self._assert_no_updated_at("WordProposalReviewLog")

    def test_proposal_attempt_created_at_tz_aware_not_null(self):
        """ProposalAttempt.created_at is tz-aware and NOT NULL."""
        self._assert_created_at("ProposalAttempt")

    def test_proposal_attempt_no_updated_at(self):
        """ProposalAttempt must NOT have updated_at."""
        self._assert_no_updated_at("ProposalAttempt")


# ===========================================================================
# AC-4: No forbidden score-column names on EITHER table
# ===========================================================================

# These names are banned by the LEXGEN-11 no-aggregate-key invariant (D8).
# `judge_scores` is a JSONB snapshot on proposal_attempt — allowed, not banned.
_FORBIDDEN_SCORE_NAMES = {"trust_score", "confidence", "aggregate", "overall", "score"}


class TestNoScoreColumnsOnReviewTables:
    """AC-4: Neither table has a forbidden numeric-score column."""

    def _assert_no_score_columns(self, model_name: str) -> None:
        model_cls = _get_model(model_name)
        cols = _columns(model_cls)
        banned_found = _FORBIDDEN_SCORE_NAMES & cols.keys()
        assert not banned_found, (
            f"{model_name} must NOT have score-type columns {banned_found}. "
            "The LEXGEN-11 D8 invariant forbids aggregate numeric scores pre-calibration. "
            "(`judge_scores` JSONB snapshot is allowed and is NOT banned.)"
        )

    def test_review_log_no_score_columns(self):
        """WordProposalReviewLog has no forbidden score column."""
        self._assert_no_score_columns("WordProposalReviewLog")

    def test_proposal_attempt_no_score_columns(self):
        """ProposalAttempt has no forbidden score column.

        Note: `judge_scores` (JSONB snapshot) is excluded from the banned set
        and is expected to exist on this table — this test must NOT flag it.
        """
        self._assert_no_score_columns("ProposalAttempt")
