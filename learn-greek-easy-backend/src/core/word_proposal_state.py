"""Word proposal state machine — transition guard.

LEXGEN-01-02 stub: ALLOWED_TRANSITIONS and transition() are intentionally
unimplemented. The executor fills them in the execution stage.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from src.db.models import WordProposalState

if TYPE_CHECKING:
    from src.db.models import WordProposal

# Executor fills in all 10 legal edges here.
ALLOWED_TRANSITIONS: dict[WordProposalState, frozenset[WordProposalState]] = {}


def transition(proposal: "WordProposal", new_state: WordProposalState) -> None:
    """Apply a lifecycle transition to *proposal*, mutating proposal.status.

    Raises:
        IllegalProposalTransition: if the transition is not in ALLOWED_TRANSITIONS,
            is a self-loop, or violates the shipped_word_entry_id guard.
        NotImplementedError: until the executor implements the guard logic.
    """
    raise NotImplementedError("LEXGEN-01-02: implement in execution stage")
