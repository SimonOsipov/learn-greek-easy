"""Per-POS authority seam for the LEXGEN pipeline (LEXGEN-07-03).

This module provides the FieldEvidence adapter functions that bridge the
concrete 07-01/07-02 implementations to the POS-neutral reconciler seam
(Decision Record §1 seam #2/#3).

Public surface:
    RuleFn              — type alias: Callable[..., FieldEvidence]
    gender_evidence     — (lemma) -> FieldEvidence  (field="gender")
    declension_group_evidence — (lemma, gender) -> FieldEvidence  (field="declension_group")
    ipa_evidence        — (lemma, candidate_ipa) -> FieldEvidence  (field="ipa")
    RULE_AUTHORITY      — dict[tuple[str,str], tuple[RuleFn,...]]
    rules_for           — (pos, field) -> tuple[RuleFn,...], () for unregistered
"""

from __future__ import annotations

from typing import Callable

from src.core.lexgen_g2p import (  # noqa: F401 — used by adapters after Stage 3
    G2PResult,
    validate_ipa,
)
from src.core.lexgen_rules import (  # noqa: F401 — used by adapters after Stage 3
    AMBIGUOUS,
    derive_declension_group,
    derive_gender,
)
from src.schemas.lexgen import FieldEvidence

# ---------------------------------------------------------------------------
# Type alias
# ---------------------------------------------------------------------------

RuleFn = Callable[..., FieldEvidence]

# ---------------------------------------------------------------------------
# FieldEvidence adapters — bodies raise NotImplementedError (STUBS).
# The executor will implement the adapter logic in Stage 3.
# ---------------------------------------------------------------------------


def gender_evidence(lemma: str) -> FieldEvidence:
    """Derive gender evidence for *lemma* via the noun morphology heuristic.

    Returns a FieldEvidence with:
      field="gender", source="rules"
      value=<gender string> when derive_gender resolves unambiguously
      value=None, flags=["rule_ambiguous"] when derive_gender returns AMBIGUOUS
    """
    raise NotImplementedError


def declension_group_evidence(lemma: str, gender: str) -> FieldEvidence:
    """Derive declension-group evidence for *lemma*+*gender* via the noun heuristic.

    Returns a FieldEvidence with:
      field="declension_group", source="rules"
      value=<group string> when derive_declension_group resolves unambiguously
      value=None, flags=["rule_ambiguous"] when derive_declension_group returns AMBIGUOUS
    """
    raise NotImplementedError


def ipa_evidence(lemma: str, candidate_ipa: str) -> FieldEvidence:
    """Validate *candidate_ipa* via the G2P phonotactic check.

    Returns a FieldEvidence with:
      field="ipa", source="rules"
      value=<normalized ipa> when validate_ipa passes (ok=True)
      value=None, flags=["ipa_invalid:<reason>"] when validate_ipa fails (ok=False)
    """
    raise NotImplementedError


# ---------------------------------------------------------------------------
# Authority registry
#
# EXACTLY three noun rows: ("noun","gender"), ("noun","declension_group"),
# ("noun","ipa").  A commented verb slot is reserved for future expansion.
#
# ("verb","gender") — reserved; uncomment + implement when verb adapters land.
# ---------------------------------------------------------------------------

RULE_AUTHORITY: dict[tuple[str, str], tuple[RuleFn, ...]] = {
    ("noun", "gender"): (gender_evidence,),
    ("noun", "declension_group"): (declension_group_evidence,),
    ("noun", "ipa"): (ipa_evidence,),
    # ("verb", "aspect"): (verb_aspect_evidence,),  # placeholder
}


def rules_for(pos: str, field: str) -> tuple[RuleFn, ...]:
    """Look up the registered adapters for a (pos, field) pair.

    Returns an empty tuple for any unregistered key — callers must handle
    the empty case (no rules → skip this evidence source).
    """
    return RULE_AUTHORITY.get((pos, field), ())
