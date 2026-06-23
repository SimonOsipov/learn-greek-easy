"""Unit tests for ProposalAttempt model — LEXGEN-13-01, Mode A RED spec.

AC-2  ProposalAttempt has the required columns: the five JSONB snapshot fields,
      attempt_no (Integer not-null), retry_attempts (Integer nullable),
      superseded_at (tz-aware nullable), and proposal_id FK.

All tests are pure-unit (no database).  ProposalAttempt is imported INSIDE
each test function to avoid collection-level ImportError before the executor
adds the model.  See test_review_log_model.py for the detailed explanation.
"""

import importlib

from sqlalchemy import inspect as sa_inspect

# ---------------------------------------------------------------------------
# Helpers (same pattern as test_review_log_model.py)
# ---------------------------------------------------------------------------


def _get_model(name: str):
    mod = importlib.import_module("src.db.models")
    cls = getattr(mod, name, None)
    if cls is None:
        raise ImportError(
            f"src.db.models has no attribute '{name}' — "
            "the executor has not implemented this model yet (LEXGEN-13-01)"
        )
    return cls


def _columns(model_cls) -> dict:
    mapper = sa_inspect(model_cls)
    return {c.name: c for c in mapper.columns}


def _fk_targets(model_cls) -> set[str]:
    mapper = sa_inspect(model_cls)
    targets = set()
    for col in mapper.columns:
        for fk in col.foreign_keys:
            targets.add(fk.target_fullname)
    return targets


# ===========================================================================
# AC-2: ProposalAttempt columns
# ===========================================================================


class TestProposalAttemptColumns:
    """AC-2: ProposalAttempt has all required columns with correct types."""

    def test_required_columns_present(self):
        """All required columns exist on ProposalAttempt."""
        Attempt = _get_model("ProposalAttempt")
        cols = _columns(Attempt)
        required = {
            "id",
            "proposal_id",
            "attempt_no",
            "generated_content",
            "generated_fields",
            "reconciliation_log",
            "judge_scores",
            "flagged_fields",
            "retry_attempts",
            "superseded_at",
            "created_at",
        }
        missing = required - cols.keys()
        assert not missing, f"ProposalAttempt is missing columns: {missing}"

    def test_id_is_uuid_pk(self):
        """id is the primary key."""
        Attempt = _get_model("ProposalAttempt")
        cols = _columns(Attempt)
        assert "id" in cols, "Column 'id' missing from ProposalAttempt"
        assert cols["id"].primary_key is True, "ProposalAttempt.id must be the primary key"

    def test_fk_to_word_proposal(self):
        """proposal_id is a FK targeting word_proposal.id."""
        Attempt = _get_model("ProposalAttempt")
        targets = _fk_targets(Attempt)
        assert "word_proposal.id" in targets, (
            f"ProposalAttempt has no FK to word_proposal.id; " f"found FK targets: {targets}"
        )

    def test_attempt_no_not_nullable(self):
        """attempt_no is Integer and NOT NULL."""
        Attempt = _get_model("ProposalAttempt")
        cols = _columns(Attempt)
        assert "attempt_no" in cols, "Column 'attempt_no' missing from ProposalAttempt"
        col = cols["attempt_no"]
        assert (
            type(col.type).__name__ == "Integer"
        ), f"ProposalAttempt.attempt_no must be Integer, got {type(col.type).__name__}"
        assert col.nullable is False, "ProposalAttempt.attempt_no must NOT be nullable"

    def test_retry_attempts_nullable(self):
        """retry_attempts is Integer and nullable."""
        Attempt = _get_model("ProposalAttempt")
        cols = _columns(Attempt)
        assert "retry_attempts" in cols, "Column 'retry_attempts' missing from ProposalAttempt"
        col = cols["retry_attempts"]
        assert (
            type(col.type).__name__ == "Integer"
        ), f"ProposalAttempt.retry_attempts must be Integer, got {type(col.type).__name__}"
        assert col.nullable is True, "ProposalAttempt.retry_attempts must be nullable"

    def test_superseded_at_tz_aware_nullable(self):
        """superseded_at is a tz-aware DateTime and nullable."""
        Attempt = _get_model("ProposalAttempt")
        cols = _columns(Attempt)
        assert "superseded_at" in cols, "Column 'superseded_at' missing from ProposalAttempt"
        col = cols["superseded_at"]
        assert (
            type(col.type).__name__ == "DateTime"
        ), f"ProposalAttempt.superseded_at must be DateTime, got {type(col.type).__name__}"
        assert col.type.timezone is True, "ProposalAttempt.superseded_at must be timezone=True"
        assert col.nullable is True, "ProposalAttempt.superseded_at must be nullable"

    def test_jsonb_snapshot_columns_are_jsonb_and_nullable(self):
        """The five JSONB snapshot columns are nullable JSONB."""
        Attempt = _get_model("ProposalAttempt")
        cols = _columns(Attempt)
        jsonb_cols = (
            "generated_content",
            "generated_fields",
            "reconciliation_log",
            "judge_scores",
            "flagged_fields",
        )
        for col_name in jsonb_cols:
            assert col_name in cols, f"Column '{col_name}' missing from ProposalAttempt"
            col = cols[col_name]
            # SQLAlchemy dialect type is JSONB; the __class__.__name__ is "JSONB"
            type_name = type(col.type).__name__
            assert (
                type_name == "JSONB"
            ), f"ProposalAttempt.{col_name} must be JSONB, got {type_name}"
            assert col.nullable is True, f"ProposalAttempt.{col_name} must be nullable"

    def test_judge_scores_is_jsonb_not_float(self):
        """judge_scores must be JSONB (snapshot), not Float — no numeric aggregate (LEXGEN-11 D8)."""
        Attempt = _get_model("ProposalAttempt")
        cols = _columns(Attempt)
        assert "judge_scores" in cols, "Column 'judge_scores' missing from ProposalAttempt"
        type_name = type(cols["judge_scores"].type).__name__
        assert type_name == "JSONB", (
            f"ProposalAttempt.judge_scores must be JSONB (snapshot), not {type_name}. "
            "A Float/Numeric score here would violate LEXGEN-11 D8 (no aggregate trust score)."
        )

    def test_tablename_is_proposal_attempt(self):
        """The ORM table name is 'proposal_attempt'."""
        Attempt = _get_model("ProposalAttempt")
        assert (
            Attempt.__tablename__ == "proposal_attempt"
        ), f"Expected __tablename__='proposal_attempt', got '{Attempt.__tablename__}'"


class TestReviewLogTablename:
    """Sanity-check the review_log table name."""

    def test_tablename_is_word_proposal_review_log(self):
        """WordProposalReviewLog.__tablename__ == 'word_proposal_review_log'."""
        ReviewLog = _get_model("WordProposalReviewLog")
        assert ReviewLog.__tablename__ == "word_proposal_review_log", (
            f"Expected __tablename__='word_proposal_review_log', "
            f"got '{ReviewLog.__tablename__}'"
        )
