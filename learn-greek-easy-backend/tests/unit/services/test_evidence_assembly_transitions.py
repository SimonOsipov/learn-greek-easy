"""RED unit tests for LEXGEN-06-03: EvidenceAssemblyService.assemble()
— transition spy + supply-chain guard.

These are UNIT tests (no real DB required). They verify:
  10. assemble() uses the transition() guard (not raw .status=) for lifecycle mutations.
  11. evidence_assembly_service.py does NOT import src.api.v1.admin (scope guard).

Expected failure mode for test 10 before assemble() is implemented:
    AttributeError when patching 'src.services.evidence_assembly_service.transition'
    — the import of `transition` at module level does not exist yet.

Test 11 may PASS immediately (the service currently doesn't import admin router)
— this is a true-by-construction guard, acceptable in RED state.

===========================================================================
SEAM CONTRACT — test 10 pins:
  • 'transition' must be imported AT MODULE LEVEL in evidence_assembly_service.py:
        from src.core.word_proposal_state import transition
    so that `patch("src.services.evidence_assembly_service.transition", ...)` works.

  • For an absent-lemma call, the spy must record exactly two calls:
        call 1: transition(proposal, WordProposalState.GENERATING)   — pending→generating
        call 2: transition(proposal, WordProposalState.REJECTED)     — generating→rejected

  • The mock replaces the real guard, so the status mutation via the spy is:
        spy.side_effect = lambda p, s: setattr(p, 'status', s)
    This lets the lifecycle run to completion with the spy substituted in.

  • assemble_evidence() is also patched (AsyncMock) so this test runs without a DB.
===========================================================================
"""

from __future__ import annotations

import re
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.db.models import WordProposalOrigin, WordProposalState
from src.schemas.lexgen import (
    EvidencePacket,
    EvidencePacketSources,
    FrequencySource,
    GreekLexiconSource,
    RulesSource,
    WiktionarySource,
)

# ---------------------------------------------------------------------------
# Deferred import — keeps file collectable before assemble() exists.
# ---------------------------------------------------------------------------


def _get_service_class():
    """Import and return EvidenceAssemblyService."""
    from src.services.evidence_assembly_service import EvidenceAssemblyService  # noqa: PLC0415

    return EvidenceAssemblyService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_BACKEND_ROOT = Path(__file__).parents[3]  # learn-greek-easy-backend/
_SERVICE_PATH = _BACKEND_ROOT / "src" / "services" / "evidence_assembly_service.py"


def _make_absent_packet(lemma: str = "ξκφπβ") -> EvidencePacket:
    """Return an EvidencePacket where all sources report present=False."""
    return EvidencePacket(
        lemma_input=lemma,
        normalized_lemma=lemma,
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(present=False, forms=[]),
            greek_lexicon=GreekLexiconSource(
                present=False,
                attested_lemma=False,
                attested_surface_form=False,
            ),
            frequency=FrequencySource(present=False, rank=None, band=None),
            rules=RulesSource(present=False),
        ),
    )


def _make_mock_db_session() -> MagicMock:
    """Return a minimal AsyncSession mock that accepts add() and flush()."""
    db = MagicMock()
    db.add = MagicMock()
    db.flush = AsyncMock(return_value=None)
    db.commit = AsyncMock(return_value=None)
    return db


# ---------------------------------------------------------------------------
# Unit tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.unit
class TestTransitionGuardUsed:
    """assemble() must call the transition() guard — never mutate .status directly."""

    async def test_assemble_uses_transition_guard_not_raw_status(self) -> None:
        """For an absent-lemma call, the transition() guard must be called twice:
          1. transition(proposal, WordProposalState.GENERATING)   — pending→generating
          2. transition(proposal, WordProposalState.REJECTED)     — generating→rejected

        The test patches:
          • src.services.evidence_assembly_service.transition  — the target under test
          • assemble_evidence on the service instance          — returns absent packet
          • get_lemma_normalization_service                    — no-op normalize

        RED failure mode before implementation:
            AttributeError — 'src.services.evidence_assembly_service' has no attribute
            'transition' (the module-level import has not been added yet).
        """
        from src.db.models import WordProposal  # noqa: PLC0415

        absent_packet = _make_absent_packet()
        db = _make_mock_db_session()

        # Side-effect: spy substitutes real guard → mutates proposal.status in place
        # so the lifecycle logic can check status after the first transition.
        def _transition_side_effect(proposal, new_state):
            proposal.status = new_state

        with (
            patch(
                "src.services.evidence_assembly_service.transition",
                side_effect=_transition_side_effect,
            ) as mock_transition,
            patch(
                "src.services.evidence_assembly_service.get_lemma_normalization_service",
                return_value=MagicMock(normalize=MagicMock(return_value=MagicMock(lemma="ξκφπβ"))),
            ),
        ):
            svc = _get_service_class()(db)
            # Patch assemble_evidence on the instance so we don't need a real DB
            svc.assemble_evidence = AsyncMock(return_value=absent_packet)

            proposal = await svc.assemble("ξκφπβ", "noun", WordProposalOrigin.ADMIN, None)

        # --- Verify the spy was called exactly twice ---
        assert mock_transition.call_count == 2, (
            f"transition() must be called exactly 2 times for an absent-lemma assemble(), "
            f"got {mock_transition.call_count} call(s): {mock_transition.call_args_list}"
        )

        # First call: pending→generating
        first_call_args = mock_transition.call_args_list[0]
        called_proposal_1, called_state_1 = first_call_args.args
        assert isinstance(
            called_proposal_1, WordProposal
        ), "First transition() call arg 0 must be a WordProposal instance"
        assert (
            called_state_1 == WordProposalState.GENERATING
        ), f"First transition() call must target GENERATING, got {called_state_1!r}"

        # Second call: generating→rejected
        second_call_args = mock_transition.call_args_list[1]
        called_proposal_2, called_state_2 = second_call_args.args
        assert isinstance(
            called_proposal_2, WordProposal
        ), "Second transition() call arg 0 must be a WordProposal instance"
        assert (
            called_state_2 == WordProposalState.REJECTED
        ), f"Second transition() call must target REJECTED, got {called_state_2!r}"

        # Both calls must reference the SAME proposal object
        assert (
            called_proposal_1 is called_proposal_2
        ), "Both transition() calls must reference the same WordProposal instance"

        # The returned proposal must be in REJECTED state
        assert (
            proposal.status == WordProposalState.REJECTED
        ), f"proposal.status after assemble() must be REJECTED, got {proposal.status!r}"


@pytest.mark.unit
class TestNeverImportsAdminRouter:
    """evidence_assembly_service.py must NOT import src.api.v1.admin (scope guard)."""

    def test_evidence_assembly_does_not_import_admin_router(self) -> None:
        """Scan evidence_assembly_service.py source for any import of src.api.v1.admin.

        This is a supply-chain guard (mirror of tests/unit/test_supply_chain.py:28)
        ensuring the service layer does not pull in the admin API router, which
        would couple the pipeline core to the HTTP layer (blocked for LEXGEN-14).

        This test may PASS immediately (the service currently doesn't import admin)
        — that is acceptable in RED state; it is a true-by-construction guard.
        """
        if not _SERVICE_PATH.exists():
            pytest.skip(
                f"evidence_assembly_service.py not found at {_SERVICE_PATH}; "
                "skipping supply-chain scan until module is created."
            )

        source = _SERVICE_PATH.read_text(encoding="utf-8")

        # Match any import form: 'from src.api.v1.admin', 'import src.api.v1.admin'
        admin_import_pattern = re.compile(
            r"\bfrom\s+src\.api\.v1\.admin\b|\bimport\s+src\.api\.v1\.admin\b"
        )

        match = admin_import_pattern.search(source)
        assert match is None, (
            "evidence_assembly_service.py must NOT import src.api.v1.admin "
            "(scope guard for LEXGEN-14 — the service layer must not pull in HTTP routing). "
            f"Found: {match.group()!r}"
        )
