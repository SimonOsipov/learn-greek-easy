"""Unit tests for WordProposal state machine + transition guard (LEXGEN-01-02).

22 spec-derived tests covering:
- All 10 legal transition edges (specs 1-10)
- Exact edge-set assertion (spec 11)
- Illegal transition examples (specs 12-14)
- Terminal-state guards: rejected, shipped (specs 15-16)
- auto_approved only-to-shipped guard (spec 17)
- Self-transition prohibition (spec 18)
- shipped_word_entry_id pre-condition (specs 19-20)
- trust_score irrelevance (spec 21)
- IllegalProposalTransition is a typed Exception (spec 22)

RED until the executor implements ALLOWED_TRANSITIONS + transition() in
src/core/word_proposal_state.py.
"""

from uuid import uuid4

import pytest

from src.core.exceptions import IllegalProposalTransition
from src.core.word_proposal_state import ALLOWED_TRANSITIONS, transition
from src.db.models import WordProposal, WordProposalState

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _p(status: WordProposalState, **kw) -> WordProposal:
    """Build an in-memory WordProposal at the given status.

    The status server_default does NOT apply in-memory, so we always
    pass status= explicitly. Other columns are filled with minimal valid
    values via **kw overrides.
    """
    return WordProposal(status=status, **kw)


# ---------------------------------------------------------------------------
# Spec 1-10: LEGAL transitions — transition() must succeed and mutate status
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestLegalTransitions:
    """All 10 legal edges from the decision record must succeed."""

    def test_pending_to_generating_succeeds(self):
        p = _p(WordProposalState.PENDING)
        transition(p, WordProposalState.GENERATING)
        assert p.status == WordProposalState.GENERATING

    def test_generating_to_scored_succeeds(self):
        p = _p(WordProposalState.GENERATING)
        transition(p, WordProposalState.SCORED)
        assert p.status == WordProposalState.SCORED

    def test_generating_to_rejected_succeeds(self):
        p = _p(WordProposalState.GENERATING)
        transition(p, WordProposalState.REJECTED)
        assert p.status == WordProposalState.REJECTED

    def test_scored_to_needs_review_succeeds(self):
        p = _p(WordProposalState.SCORED)
        transition(p, WordProposalState.NEEDS_REVIEW)
        assert p.status == WordProposalState.NEEDS_REVIEW

    def test_scored_to_rejected_succeeds(self):
        p = _p(WordProposalState.SCORED)
        transition(p, WordProposalState.REJECTED)
        assert p.status == WordProposalState.REJECTED

    def test_scored_to_auto_approved_succeeds(self):
        # Edge exists though unreachable in v1 (auto-approval path reserved)
        p = _p(WordProposalState.SCORED)
        transition(p, WordProposalState.AUTO_APPROVED)
        assert p.status == WordProposalState.AUTO_APPROVED

    def test_needs_review_to_scored_succeeds(self):
        p = _p(WordProposalState.NEEDS_REVIEW)
        transition(p, WordProposalState.SCORED)
        assert p.status == WordProposalState.SCORED

    def test_needs_review_to_shipped_succeeds(self):
        # shipped_word_entry_id MUST be set (pre-condition)
        p = _p(WordProposalState.NEEDS_REVIEW, shipped_word_entry_id=uuid4())
        transition(p, WordProposalState.SHIPPED)
        assert p.status == WordProposalState.SHIPPED

    def test_needs_review_to_rejected_succeeds(self):
        # Human reviewer rejects — Decision Record §D2
        p = _p(WordProposalState.NEEDS_REVIEW)
        transition(p, WordProposalState.REJECTED)
        assert p.status == WordProposalState.REJECTED

    def test_auto_approved_to_shipped_succeeds(self):
        # shipped_word_entry_id MUST be set (pre-condition)
        p = _p(WordProposalState.AUTO_APPROVED, shipped_word_entry_id=uuid4())
        transition(p, WordProposalState.SHIPPED)
        assert p.status == WordProposalState.SHIPPED


# ---------------------------------------------------------------------------
# Spec 11: Exact edge-set assertion — no missing edges, no extra edges
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestAllowedTransitionsEdgeSet:
    """ALLOWED_TRANSITIONS must contain exactly the 10 story edges."""

    def test_all_ten_legal_edges_present(self):
        expected_edges = {
            (WordProposalState.PENDING, WordProposalState.GENERATING),
            (WordProposalState.GENERATING, WordProposalState.SCORED),
            (WordProposalState.GENERATING, WordProposalState.REJECTED),
            (WordProposalState.SCORED, WordProposalState.AUTO_APPROVED),
            (WordProposalState.SCORED, WordProposalState.NEEDS_REVIEW),
            (WordProposalState.SCORED, WordProposalState.REJECTED),
            (WordProposalState.NEEDS_REVIEW, WordProposalState.SCORED),
            (WordProposalState.NEEDS_REVIEW, WordProposalState.SHIPPED),
            (WordProposalState.NEEDS_REVIEW, WordProposalState.REJECTED),
            (WordProposalState.AUTO_APPROVED, WordProposalState.SHIPPED),
        }
        actual_edges = {
            (from_state, to_state)
            for from_state, targets in ALLOWED_TRANSITIONS.items()
            for to_state in targets
        }
        assert actual_edges == expected_edges, (
            f"Edge set mismatch.\n"
            f"  Missing: {expected_edges - actual_edges}\n"
            f"  Extra:   {actual_edges - expected_edges}"
        )


# ---------------------------------------------------------------------------
# Specs 12-14: Specific illegal transitions must raise
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestIllegalTransitionExamples:
    """Representative illegal edges must raise IllegalProposalTransition."""

    def test_pending_to_shipped_raises(self):
        p = _p(WordProposalState.PENDING)
        with pytest.raises(IllegalProposalTransition):
            transition(p, WordProposalState.SHIPPED)

    def test_pending_to_scored_raises(self):
        p = _p(WordProposalState.PENDING)
        with pytest.raises(IllegalProposalTransition):
            transition(p, WordProposalState.SCORED)

    def test_generating_to_needs_review_raises(self):
        p = _p(WordProposalState.GENERATING)
        with pytest.raises(IllegalProposalTransition):
            transition(p, WordProposalState.NEEDS_REVIEW)


# ---------------------------------------------------------------------------
# Specs 15-17: Terminal states and constrained states
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestTerminalAndConstrainedStates:
    """Terminal states accept no outgoing edges; auto_approved goes only to shipped."""

    def test_rejected_is_terminal(self):
        for target in list(WordProposalState):
            p = _p(WordProposalState.REJECTED)
            with pytest.raises(IllegalProposalTransition):
                transition(p, target)

    def test_shipped_is_terminal(self):
        for target in list(WordProposalState):
            p = _p(WordProposalState.SHIPPED)
            with pytest.raises(IllegalProposalTransition):
                transition(p, target)

    def test_auto_approved_only_to_shipped(self):
        non_shipped = [s for s in WordProposalState if s != WordProposalState.SHIPPED]
        for target in non_shipped:
            p = _p(WordProposalState.AUTO_APPROVED)
            with pytest.raises(IllegalProposalTransition):
                transition(p, target)


# ---------------------------------------------------------------------------
# Spec 18: Self-transitions are prohibited for every state
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestSelfTransitionProhibition:
    """No state may transition to itself — self-loops are not in the map."""

    def test_self_transition_raises(self):
        for state in list(WordProposalState):
            p = _p(state)
            with pytest.raises(IllegalProposalTransition):
                transition(p, state)


# ---------------------------------------------------------------------------
# Specs 19-20: shipped_word_entry_id pre-condition guard
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestShippedWordEntryPreCondition:
    """Transitioning to SHIPPED without shipped_word_entry_id must raise."""

    def test_shipped_without_word_entry_id_raises(self):
        # needs_review → shipped with shipped_word_entry_id=None must fail
        p = _p(WordProposalState.NEEDS_REVIEW, shipped_word_entry_id=None)
        with pytest.raises(IllegalProposalTransition):
            transition(p, WordProposalState.SHIPPED)

    def test_shipped_from_auto_approved_without_word_entry_id_raises(self):
        # auto_approved → shipped with shipped_word_entry_id=None must fail
        p = _p(WordProposalState.AUTO_APPROVED, shipped_word_entry_id=None)
        with pytest.raises(IllegalProposalTransition):
            transition(p, WordProposalState.SHIPPED)


# ---------------------------------------------------------------------------
# Spec 21: trust_score is irrelevant to routing (Decision Record §3)
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestTrustScoreIrrelevance:
    """Routing is state-driven; trust_score=None must not break legal transitions."""

    def test_guard_does_not_read_trust_score(self):
        # A proposal with trust_score=None should succeed on a legal edge
        p = _p(WordProposalState.PENDING, trust_score=None)
        assert p.trust_score is None
        transition(p, WordProposalState.GENERATING)
        # trust_score is untouched — the guard never writes or requires it
        assert p.trust_score is None
        assert p.status == WordProposalState.GENERATING


# ---------------------------------------------------------------------------
# Spec 22: IllegalProposalTransition is a typed Exception subclass
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestIllegalProposalTransitionType:
    """IllegalProposalTransition must be an Exception subclass (typed domain error)."""

    def test_illegal_transition_is_typed_exception(self):
        assert issubclass(IllegalProposalTransition, Exception)
        p = _p(WordProposalState.PENDING)
        with pytest.raises(IllegalProposalTransition) as exc_info:
            transition(p, WordProposalState.SHIPPED)
        assert isinstance(exc_info.value, IllegalProposalTransition)
        assert isinstance(exc_info.value, Exception)


# ---------------------------------------------------------------------------
# Adversarial coverage (QA-added, LEXGEN-01-02 Mode B)
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestTransitionReturnValueAndNoPartialMutation:
    """transition() returns None and leaves status UNCHANGED on a failed transition."""

    def test_transition_returns_none_on_success(self):
        # transition() is a mutation-only function; callers must not rely on a
        # return value.
        p = _p(WordProposalState.PENDING)
        result = transition(p, WordProposalState.GENERATING)
        assert result is None

    def test_status_unchanged_after_illegal_transition(self):
        # If the guard raises, proposal.status must be exactly what it was before
        # the call — no partial mutation must have occurred.
        p = _p(WordProposalState.PENDING)
        original_status = p.status
        with pytest.raises(IllegalProposalTransition):
            transition(p, WordProposalState.SHIPPED)
        assert (
            p.status is original_status
        ), "proposal.status must not be modified when transition() raises"

    def test_status_unchanged_after_illegal_precondition_raise(self):
        # shipped_word_entry_id missing on needs_review→shipped: status stays
        # at needs_review even though the edge is legal.
        p = _p(WordProposalState.NEEDS_REVIEW, shipped_word_entry_id=None)
        with pytest.raises(IllegalProposalTransition):
            transition(p, WordProposalState.SHIPPED)
        assert p.status is WordProposalState.NEEDS_REVIEW


@pytest.mark.unit
class TestMultiHopTransitions:
    """A chain of legal transitions all applied in sequence must work correctly."""

    def test_two_hop_pending_generating_scored(self):
        # Verifies that after a successful transition the proposal is in the
        # right state and a subsequent legal hop from there also succeeds.
        p = _p(WordProposalState.PENDING)
        transition(p, WordProposalState.GENERATING)
        assert p.status == WordProposalState.GENERATING
        transition(p, WordProposalState.SCORED)
        assert p.status == WordProposalState.SCORED

    def test_full_happy_path_to_shipped_via_auto_approved(self):
        # pending → generating → scored → auto_approved → shipped
        p = _p(WordProposalState.PENDING)
        transition(p, WordProposalState.GENERATING)
        transition(p, WordProposalState.SCORED)
        transition(p, WordProposalState.AUTO_APPROVED)
        # Set the pre-condition before shipping
        p.shipped_word_entry_id = uuid4()
        transition(p, WordProposalState.SHIPPED)
        assert p.status == WordProposalState.SHIPPED

    def test_full_happy_path_to_shipped_via_needs_review(self):
        # pending → generating → scored → needs_review → shipped
        p = _p(WordProposalState.PENDING)
        transition(p, WordProposalState.GENERATING)
        transition(p, WordProposalState.SCORED)
        transition(p, WordProposalState.NEEDS_REVIEW)
        p.shipped_word_entry_id = uuid4()
        transition(p, WordProposalState.SHIPPED)
        assert p.status == WordProposalState.SHIPPED

    def test_regenerate_loop_needs_review_to_scored_then_auto_approved(self):
        # §D2 "regenerate" maps to needs_review → scored; then can auto-approve.
        p = _p(WordProposalState.NEEDS_REVIEW)
        transition(p, WordProposalState.SCORED)
        transition(p, WordProposalState.AUTO_APPROVED)
        assert p.status == WordProposalState.AUTO_APPROVED


@pytest.mark.unit
class TestErrorMessageDebugability:
    """IllegalProposalTransition message must be non-empty and reference state names."""

    def test_error_message_references_from_state(self):
        p = _p(WordProposalState.PENDING)
        with pytest.raises(IllegalProposalTransition) as exc_info:
            transition(p, WordProposalState.SHIPPED)
        msg = str(exc_info.value)
        assert msg, "Exception message must not be empty"
        assert "pending" in msg.lower(), f"Expected from-state 'pending' in message, got: {msg!r}"

    def test_error_message_references_to_state(self):
        p = _p(WordProposalState.PENDING)
        with pytest.raises(IllegalProposalTransition) as exc_info:
            transition(p, WordProposalState.SHIPPED)
        msg = str(exc_info.value)
        assert "shipped" in msg.lower(), f"Expected to-state 'shipped' in message, got: {msg!r}"

    def test_shipped_precondition_error_references_both_states(self):
        p = _p(WordProposalState.NEEDS_REVIEW, shipped_word_entry_id=None)
        with pytest.raises(IllegalProposalTransition) as exc_info:
            transition(p, WordProposalState.SHIPPED)
        msg = str(exc_info.value)
        assert (
            "needs_review" in msg.lower() or "needs-review" in msg.lower()
        ), f"Expected from-state in precondition error message, got: {msg!r}"
        assert (
            "shipped" in msg.lower()
        ), f"Expected to-state in precondition error message, got: {msg!r}"

    def test_exception_exposes_from_and_to_state_attrs(self):
        # IllegalProposalTransition stores from_state / to_state as attributes
        # so callers can programmatically inspect the failed transition.
        p = _p(WordProposalState.GENERATING)
        with pytest.raises(IllegalProposalTransition) as exc_info:
            transition(p, WordProposalState.PENDING)
        exc = exc_info.value
        assert hasattr(exc, "from_state"), "Expected from_state attribute on exception"
        assert hasattr(exc, "to_state"), "Expected to_state attribute on exception"
        assert exc.from_state == WordProposalState.GENERATING.value
        assert exc.to_state == WordProposalState.PENDING.value


@pytest.mark.unit
class TestAllowedTransitionsImmutability:
    """ALLOWED_TRANSITIONS values are frozensets — callers cannot accidentally mutate them."""

    def test_all_values_are_frozensets(self):
        for from_state, targets in ALLOWED_TRANSITIONS.items():
            assert isinstance(targets, frozenset), (
                f"ALLOWED_TRANSITIONS[{from_state}] should be a frozenset, "
                f"got {type(targets).__name__}"
            )

    def test_frozenset_values_are_not_accidentally_mutable(self):
        # Attempting to add to a frozenset raises TypeError — confirm the values
        # are truly frozensets and not ordinary sets.
        for targets in ALLOWED_TRANSITIONS.values():
            try:
                targets.add(WordProposalState.PENDING)  # type: ignore[attr-defined]
                raise AssertionError("frozenset should not have .add()")
            except AttributeError:
                pass  # Expected: frozensets have no .add()
