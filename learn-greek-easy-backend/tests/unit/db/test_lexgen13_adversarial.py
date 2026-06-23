"""Adversarial / edge unit tests — LEXGEN-13-01, Mode B QA.

These tests go BEYOND the Mode A RED specs. They verify:

1. PG enum *type names* are exactly ``review_action`` / ``human_decision``
   (not e.g. "reviewaction", "human_decision_type", or unnamed).
2. FK ``ondelete`` behaviours are exactly as designed:
   - proposal_id → word_proposal.id  CASCADE  (on BOTH tables)
   - reviewer_id → users.id          SET NULL  (review_log only)
3. ProposalAttempt also has NO ``updated_at`` column (AC-3, belt-and-suspenders).
4. WordProposalReviewLog has NO ``judge_scores`` / ``score`` column
   (``judge_scores`` is ONLY allowed on ProposalAttempt as a snapshot).
5. Enum classes inherit from ``str`` (enabling JSON serialisation without
   ``.value`` calls — matches the codebase-wide convention).
6. The two enum Python classes are named exactly ``ReviewAction`` /
   ``HumanDecision`` in ``src.db.models``.
7. ``attempt_no`` is positive-capable (type + nullable check already in Mode A;
   here we verify the column carries NO server-default, meaning the caller
   MUST supply a value — the monotonic invariant lives in application code).
8. ``review_action`` PG enum has NO extra values beyond the AC-1 set.
9. ``human_decision`` PG enum has NO extra values beyond the AC-1 set.

All tests are pure-unit (no database connection required).
"""

from __future__ import annotations

import importlib

from sqlalchemy import inspect as sa_inspect

# ---------------------------------------------------------------------------
# Shared helpers (same pattern as existing test files)
# ---------------------------------------------------------------------------


def _get_model(name: str):
    mod = importlib.import_module("src.db.models")
    cls = getattr(mod, name, None)
    if cls is None:
        raise ImportError(
            f"src.db.models has no attribute '{name}' — " "LEXGEN-13-01 model not yet implemented"
        )
    return cls


def _get_enum(name: str):
    mod = importlib.import_module("src.db.models")
    cls = getattr(mod, name, None)
    if cls is None:
        raise ImportError(
            f"src.db.models has no attribute '{name}' — " "LEXGEN-13-01 enum not yet implemented"
        )
    return cls


def _columns(model_cls) -> dict:
    mapper = sa_inspect(model_cls)
    return {c.name: c for c in mapper.columns}


def _fk_map(model_cls) -> dict[str, str]:
    """Return {column_name: ondelete_rule} for all FK columns on a model."""
    mapper = sa_inspect(model_cls)
    result: dict[str, str] = {}
    for col in mapper.columns:
        for fk in col.foreign_keys:
            result[col.name] = (fk.target_fullname, fk.ondelete)
    return result


# ===========================================================================
# 1. PG enum type names (AC-1 extension)
# ===========================================================================


class TestPgEnumTypeNames:
    """The SAEnum columns must reference PG enum names 'review_action' and 'human_decision'."""

    def _sa_enum_name_for_col(self, model_cls, col_name: str) -> str | None:
        cols = _columns(model_cls)
        assert col_name in cols, f"{model_cls.__name__} has no column '{col_name}'"
        col_type = cols[col_name].type
        # SQLAlchemy Enum has a `name` attribute for the PG enum type name
        return getattr(col_type, "name", None)

    def test_action_column_pg_enum_name_is_review_action(self):
        """WordProposalReviewLog.action must use PG enum named 'review_action'."""
        ReviewLog = _get_model("WordProposalReviewLog")
        name = self._sa_enum_name_for_col(ReviewLog, "action")
        assert name == "review_action", (
            f"Expected SAEnum name='review_action' on action column, got name={name!r}. "
            "The PG enum type must be named exactly 'review_action' for the migration to match."
        )

    def test_human_decision_column_pg_enum_name_is_human_decision(self):
        """WordProposalReviewLog.human_decision must use PG enum named 'human_decision'."""
        ReviewLog = _get_model("WordProposalReviewLog")
        name = self._sa_enum_name_for_col(ReviewLog, "human_decision")
        assert (
            name == "human_decision"
        ), f"Expected SAEnum name='human_decision' on human_decision column, got name={name!r}."


# ===========================================================================
# 2. FK ondelete behaviour (AC-1 / AC-2 extension)
# ===========================================================================


class TestFkOndeleteRules:
    """FK ondelete rules must match the design exactly."""

    def test_review_log_proposal_id_fk_is_cascade(self):
        """WordProposalReviewLog.proposal_id FK must CASCADE on delete."""
        ReviewLog = _get_model("WordProposalReviewLog")
        fk_map = _fk_map(ReviewLog)
        assert "proposal_id" in fk_map, "proposal_id FK not found on WordProposalReviewLog"
        target, ondelete = fk_map["proposal_id"]
        assert target == "word_proposal.id", f"Unexpected FK target: {target}"
        assert ondelete == "CASCADE", (
            f"WordProposalReviewLog.proposal_id ondelete must be 'CASCADE', got {ondelete!r}. "
            "Deleting a proposal must cascade-delete its review log rows."
        )

    def test_review_log_reviewer_id_fk_is_set_null(self):
        """WordProposalReviewLog.reviewer_id FK must SET NULL on delete."""
        ReviewLog = _get_model("WordProposalReviewLog")
        fk_map = _fk_map(ReviewLog)
        assert "reviewer_id" in fk_map, "reviewer_id FK not found on WordProposalReviewLog"
        target, ondelete = fk_map["reviewer_id"]
        assert target == "users.id", f"Unexpected FK target for reviewer_id: {target}"
        assert ondelete == "SET NULL", (
            f"WordProposalReviewLog.reviewer_id ondelete must be 'SET NULL', got {ondelete!r}. "
            "Review history must survive account deletion (mirror of WordProposal.requested_by)."
        )

    def test_proposal_attempt_proposal_id_fk_is_cascade(self):
        """ProposalAttempt.proposal_id FK must CASCADE on delete."""
        Attempt = _get_model("ProposalAttempt")
        fk_map = _fk_map(Attempt)
        assert "proposal_id" in fk_map, "proposal_id FK not found on ProposalAttempt"
        target, ondelete = fk_map["proposal_id"]
        assert target == "word_proposal.id", f"Unexpected FK target: {target}"
        assert (
            ondelete == "CASCADE"
        ), f"ProposalAttempt.proposal_id ondelete must be 'CASCADE', got {ondelete!r}."

    def test_proposal_attempt_has_no_users_fk(self):
        """ProposalAttempt has no FK to users.id (no reviewer_id column at all)."""
        Attempt = _get_model("ProposalAttempt")
        cols = _columns(Attempt)
        assert "reviewer_id" not in cols, (
            "ProposalAttempt must NOT have a reviewer_id column — "
            "it is a pipeline snapshot, not a human-action log."
        )


# ===========================================================================
# 3. ProposalAttempt has no updated_at (AC-3 belt-and-suspenders)
# ===========================================================================


class TestProposalAttemptNoUpdatedAt:
    """AC-3 — belt-and-suspenders: ProposalAttempt has no updated_at column."""

    def test_no_updated_at(self):
        Attempt = _get_model("ProposalAttempt")
        cols = _columns(Attempt)
        assert "updated_at" not in cols, (
            "ProposalAttempt must NOT have 'updated_at'. "
            "The spec says standalone created_at only — NOT TimestampMixin."
        )


# ===========================================================================
# 4. WordProposalReviewLog has NO judge_scores column (AC-4 extension)
# ===========================================================================


class TestReviewLogHasNoJudgeScores:
    """judge_scores (JSONB snapshot) belongs ONLY on ProposalAttempt, not on WordProposalReviewLog."""

    def test_review_log_has_no_judge_scores(self):
        ReviewLog = _get_model("WordProposalReviewLog")
        cols = _columns(ReviewLog)
        assert "judge_scores" not in cols, (
            "WordProposalReviewLog must NOT have a 'judge_scores' column. "
            "The judge_scores JSONB snapshot lives on ProposalAttempt only."
        )

    def test_proposal_attempt_does_have_judge_scores(self):
        """Positive assertion: ProposalAttempt.judge_scores MUST exist (JSONB snapshot)."""
        Attempt = _get_model("ProposalAttempt")
        cols = _columns(Attempt)
        assert "judge_scores" in cols, (
            "ProposalAttempt must have 'judge_scores' (JSONB snapshot — LEXGEN-11 D8). "
            "This column should have been created by the executor."
        )


# ===========================================================================
# 5. Enum classes inherit from str
# ===========================================================================


class TestEnumInheritFromStr:
    """Both enum classes must inherit from str to support JSON serialisation."""

    def test_review_action_inherits_str(self):
        ReviewAction = _get_enum("ReviewAction")
        assert issubclass(ReviewAction, str), (
            "ReviewAction must inherit from str (e.g. class ReviewAction(str, enum.Enum)) "
            "so enum values serialise as plain strings in JSON responses."
        )

    def test_human_decision_inherits_str(self):
        HumanDecision = _get_enum("HumanDecision")
        assert issubclass(HumanDecision, str), (
            "HumanDecision must inherit from str (e.g. class HumanDecision(str, enum.Enum)) "
            "so enum values serialise as plain strings in JSON responses."
        )


# ===========================================================================
# 6. Enum Python class names are exactly correct
# ===========================================================================


class TestEnumClassNames:
    """Python class names must be ReviewAction and HumanDecision (case-exact)."""

    def test_review_action_class_name(self):
        ReviewAction = _get_enum("ReviewAction")
        assert (
            ReviewAction.__name__ == "ReviewAction"
        ), f"Expected class name 'ReviewAction', got '{ReviewAction.__name__}'"

    def test_human_decision_class_name(self):
        HumanDecision = _get_enum("HumanDecision")
        assert (
            HumanDecision.__name__ == "HumanDecision"
        ), f"Expected class name 'HumanDecision', got '{HumanDecision.__name__}'"


# ===========================================================================
# 7. attempt_no has NO server_default (caller must supply it)
# ===========================================================================


class TestAttemptNoHasNoServerDefault:
    """attempt_no must have NO server_default — the application controls monotonic ordering."""

    def test_attempt_no_has_no_server_default(self):
        Attempt = _get_model("ProposalAttempt")
        cols = _columns(Attempt)
        assert "attempt_no" in cols, "attempt_no column missing from ProposalAttempt"
        col = cols["attempt_no"]
        assert col.server_default is None, (
            "ProposalAttempt.attempt_no must NOT have a server_default. "
            "The application layer (not the DB) controls monotonic ordering. "
            f"Got server_default={col.server_default!r}"
        )


# ===========================================================================
# 8 & 9. Enum value sets are exact — no extra values
# ===========================================================================


class TestEnumValueSetsAreExact:
    """Enum value sets must be EXACTLY as specified (no added/removed values)."""

    def test_review_action_has_exactly_four_values(self):
        ReviewAction = _get_enum("ReviewAction")
        values = {e.value for e in ReviewAction}
        expected = {"approve", "edit", "regenerate", "reject"}
        extra = values - expected
        missing = expected - values
        assert not extra and not missing, (
            f"ReviewAction value set mismatch. "
            f"Extra: {extra or 'none'}. Missing: {missing or 'none'}. "
            f"Got: {values}"
        )

    def test_human_decision_has_exactly_three_values(self):
        HumanDecision = _get_enum("HumanDecision")
        values = {e.value for e in HumanDecision}
        expected = {"accept", "edit", "reject"}
        extra = values - expected
        missing = expected - values
        assert not extra and not missing, (
            f"HumanDecision value set mismatch. "
            f"Extra: {extra or 'none'}. Missing: {missing or 'none'}. "
            f"Got: {values}"
        )

    def test_review_action_values_are_lowercase(self):
        """All ReviewAction values must be lowercase (PG enum convention in this codebase)."""
        ReviewAction = _get_enum("ReviewAction")
        non_lower = [e.value for e in ReviewAction if e.value != e.value.lower()]
        assert not non_lower, (
            f"ReviewAction has non-lowercase values: {non_lower}. "
            "PG enum convention in this codebase is lowercase."
        )

    def test_human_decision_values_are_lowercase(self):
        """All HumanDecision values must be lowercase (PG enum convention in this codebase)."""
        HumanDecision = _get_enum("HumanDecision")
        non_lower = [e.value for e in HumanDecision if e.value != e.value.lower()]
        assert not non_lower, (
            f"HumanDecision has non-lowercase values: {non_lower}. "
            "PG enum convention in this codebase is lowercase."
        )
