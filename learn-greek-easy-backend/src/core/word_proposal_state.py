"""Word proposal state machine — transition guard.

LEXGEN-01-02: pure domain logic for the WordProposal lifecycle. This module
encodes the only legal status transitions (``ALLOWED_TRANSITIONS``) and the
single sanctioned mutation of ``WordProposal.status`` (``transition``).

The module is pure: no DB session, no HTTP, no I/O. Routing is state-driven
only — ``trust_score`` is never read here (Decision Record §3).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from src.core.exceptions import IllegalProposalTransition
from src.db.models import WordProposalState

if TYPE_CHECKING:
    from src.db.models import WordProposal

# The 11 legal lifecycle edges (and NO others). Terminal states (rejected,
# shipped) are represented by omission and resolve via .get(..., frozenset()).
#
# Decision Record §3: the scored → {needs_review | rejected | auto_approved}
# fan-out is STATE-DRIVEN only. There is no numeric trust-score pre-calibration
# gating which target is legal — every target below is permitted at the state
# level, and trust_score is read nowhere in this module.
#
# LEXGEN-13-02 D-REGEN-EDGE-MANDATORY: needs_review → generating is added so
# the reviewer "regenerate" action can restart the pipeline without leaving the
# proposal in an intermediate state.
ALLOWED_TRANSITIONS: dict[WordProposalState, frozenset[WordProposalState]] = {
    WordProposalState.PENDING: frozenset({WordProposalState.GENERATING}),
    WordProposalState.GENERATING: frozenset({WordProposalState.SCORED, WordProposalState.REJECTED}),
    WordProposalState.SCORED: frozenset(
        {
            WordProposalState.AUTO_APPROVED,
            WordProposalState.NEEDS_REVIEW,
            WordProposalState.REJECTED,
        }
    ),
    WordProposalState.NEEDS_REVIEW: frozenset(
        {
            WordProposalState.GENERATING,  # D-REGEN-EDGE-MANDATORY (LEXGEN-13-02)
            WordProposalState.SCORED,
            WordProposalState.SHIPPED,
            WordProposalState.REJECTED,
        }
    ),
    WordProposalState.AUTO_APPROVED: frozenset({WordProposalState.SHIPPED}),
    # REJECTED and SHIPPED are terminal — no outgoing edges.
}


def transition(proposal: "WordProposal", new_state: WordProposalState) -> None:
    """Apply a lifecycle transition to *proposal*, mutating ``proposal.status``.

    This is the ONLY sanctioned way to change ``WordProposal.status``.

    Raises:
        IllegalProposalTransition: if the edge from the proposal's current
            status to *new_state* is not in ``ALLOWED_TRANSITIONS`` (this
            naturally rejects self-loops, illegal edges, and any transition out
            of a terminal state), or if *new_state* is ``shipped`` while
            ``proposal.shipped_word_entry_id`` is None.
    """
    # Terminal states resolve to an empty frozenset, so they raise cleanly
    # instead of KeyError.
    allowed = ALLOWED_TRANSITIONS.get(proposal.status, frozenset())
    if new_state not in allowed:
        raise IllegalProposalTransition(
            from_state=proposal.status.value,
            to_state=new_state.value,
            reason="edge not in ALLOWED_TRANSITIONS",
        )

    # Compound pre-condition (checked after edge legality): a proposal may only
    # ship once it has been materialized into a published word entry.
    if new_state is WordProposalState.SHIPPED and proposal.shipped_word_entry_id is None:
        raise IllegalProposalTransition(
            from_state=proposal.status.value,
            to_state=new_state.value,
            reason="shipped_word_entry_id must be set before shipping",
        )

    proposal.status = new_state
