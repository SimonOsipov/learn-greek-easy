"""Adversarial / edge / negative coverage for LEXGEN-06-03: EvidenceAssemblyService.assemble().

These tests extend the AC-spec tests in test_evidence_assembly_lifecycle.py with
deeper invariant checks and edge cases that the spec tests deliberately left out
to stay minimal-red. All tests run against a real Postgres session (db_session).

Coverage added here:
  A1  Wiktionary-only present → GENERATING (present source not covered by lexicon/freq tests)
  A2  Present lemma calls transition() exactly once (→ GENERATING, never reaches REJECTED)
  A3  assemble() returns a flushed proposal with a non-null id
  A4  evidence_packet on a rejected row: deep-check all four sources (3 refs + rules)
  A5  Origin-agnostic rejection_reason byte identity (parametrized, all 3 origins)
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    FrequencyRank,
    WiktionaryMorphology,
    WordProposal,
    WordProposalOrigin,
    WordProposalState,
)
from src.schemas.lexgen import (
    EvidencePacket,
    EvidencePacketSources,
    FrequencySource,
    GreekLexiconSource,
    RulesSource,
    WiktionarySource,
)
from src.schemas.nlp import NormalizedLemma

# ---------------------------------------------------------------------------
# Helpers (mirrored from test_evidence_assembly_lifecycle.py)
# ---------------------------------------------------------------------------

_NEVER_INVENT_REASON = "never_invent: lemma absent from all references"


def _get_service_class():
    from src.services.evidence_assembly_service import EvidenceAssemblyService  # noqa: PLC0415

    return EvidenceAssemblyService


def _get_assemble(db_session: AsyncSession):
    svc = _get_service_class()(db_session)
    return svc.assemble


def _make_normalized(lemma: str) -> NormalizedLemma:
    return NormalizedLemma(
        input_word=lemma,
        lemma=lemma,
        gender=None,
        article=None,
        pos="NOUN",
        confidence=1.0,
    )


def _patch_normalize(lemma_out: str):
    normalized = _make_normalized(lemma_out)
    mock_norm_svc = MagicMock()
    mock_norm_svc.normalize = MagicMock(return_value=normalized)
    return patch(
        "src.services.evidence_assembly_service.get_lemma_normalization_service",
        return_value=mock_norm_svc,
    )


async def _seed_wiktionary_row(db_session: AsyncSession, *, lemma: str) -> WiktionaryMorphology:
    row = WiktionaryMorphology(
        lemma=lemma,
        pos="noun",
        gender="neuter",
        forms=[],
    )
    db_session.add(row)
    await db_session.flush()
    return row


async def _seed_frequency_row(
    db_session: AsyncSession, *, lemma: str, rank: int = 1
) -> FrequencyRank:
    row = FrequencyRank(lemma=lemma, rank=rank, source="wordfreq")
    db_session.add(row)
    await db_session.flush()
    return row


def _make_present_packet(lemma: str = "σπίτι") -> EvidencePacket:
    """Return an EvidencePacket where wiktionary reports present=True (others absent)."""
    return EvidencePacket(
        lemma_input=lemma,
        normalized_lemma=lemma,
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(present=True, forms=[]),
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
    db = MagicMock()
    db.add = MagicMock()
    db.flush = AsyncMock(return_value=None)
    db.commit = AsyncMock(return_value=None)
    return db


# ---------------------------------------------------------------------------
# A1: Wiktionary-only present → GENERATING
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestWiktionaryOnlyPresent:
    """A lemma attested only in Wiktionary (no lexicon, no freq) must end GENERATING.

    This tests the third attestation source path not explicitly covered by the
    lexicon-only and frequency-only tests in test_evidence_assembly_lifecycle.py.
    """

    async def test_wiktionary_only_lemma_ends_generating(self, db_session: AsyncSession) -> None:
        """Seed a WiktionaryMorphology row only → assemble → status==GENERATING.

        If _lemma_exists() ignores the wiktionary slot or if the assemble() code
        doesn't check it, this test will get status==REJECTED instead of GENERATING.
        """
        lemma = "αδελφή_wikt_only"
        await _seed_wiktionary_row(db_session, lemma=lemma)

        assemble = _get_assemble(db_session)

        with _patch_normalize(lemma):
            proposal = await assemble(lemma, "noun", WordProposalOrigin.ADMIN, None)

        assert proposal.status == WordProposalState.GENERATING, (
            "A wiktionary-only attested lemma must reach GENERATING, not REJECTED. "
            f"Got status={proposal.status!r}. "
            "Check that _lemma_exists() includes packet.sources.wiktionary.present."
        )
        assert (
            proposal.evidence_packet is not None
        ), "evidence_packet must be non-null even for wiktionary-only present case."
        sources = proposal.evidence_packet.get("sources", {})
        assert sources.get("wiktionary", {}).get("present") is True, (
            "evidence_packet.sources.wiktionary.present must be True when a "
            f"WiktionaryMorphology row is seeded; got sources={sources!r}"
        )


# ---------------------------------------------------------------------------
# A2: Present lemma calls transition() exactly ONCE (not twice)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.unit
class TestPresentLemmaTransitionOnce:
    """A present-lemma assemble() must call transition() exactly once (→ GENERATING).

    The absent-lemma path calls transition() twice (pending→generating→rejected).
    A present-lemma must call it once (pending→generating) and never reach REJECTED.
    Without this test, a buggy implementation that always double-calls transition()
    (including a spurious REJECTED) could pass the existing 11 tests.
    """

    async def test_present_lemma_calls_transition_exactly_once(self) -> None:
        """For a present-lemma call, transition() must be called exactly once.

        Spy captures: call 1 must be (proposal, GENERATING). No second call.
        """
        present_packet = _make_present_packet()
        db = _make_mock_db_session()

        def _transition_side_effect(proposal, new_state):
            proposal.status = new_state

        with (
            patch(
                "src.services.evidence_assembly_service.transition",
                side_effect=_transition_side_effect,
            ) as mock_transition,
            patch(
                "src.services.evidence_assembly_service.get_lemma_normalization_service",
                return_value=MagicMock(normalize=MagicMock(return_value=MagicMock(lemma="σπίτι"))),
            ),
        ):
            svc = _get_service_class()(db)
            svc.assemble_evidence = AsyncMock(return_value=present_packet)

            proposal = await svc.assemble("σπίτι", "noun", WordProposalOrigin.ADMIN, None)

        assert mock_transition.call_count == 1, (
            f"transition() must be called exactly ONCE for a present-lemma assemble(). "
            f"Got {mock_transition.call_count} call(s): {mock_transition.call_args_list}. "
            "If count==2, the never-invent reject path is being taken for a present lemma."
        )

        first_call_args = mock_transition.call_args_list[0]
        called_proposal, called_state = first_call_args.args
        assert called_state == WordProposalState.GENERATING, (
            f"The single transition() call must target GENERATING for a present lemma, "
            f"got {called_state!r}."
        )
        assert isinstance(
            called_proposal, WordProposal
        ), "transition() first arg must be a WordProposal instance."
        assert proposal.status == WordProposalState.GENERATING, (
            f"proposal.status after assemble() on a present lemma must be GENERATING, "
            f"got {proposal.status!r}."
        )


# ---------------------------------------------------------------------------
# A3: assemble() returns a flushed proposal with non-null id
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestAssembleReturnsFlushedProposal:
    """assemble() must return the same persisted proposal instance (id non-null).

    This verifies the flush contract: the returned object is the same ORM instance
    that was added to the session, not a detached/reconstructed copy.
    """

    async def test_assemble_returns_persisted_proposal_with_id(
        self, db_session: AsyncSession
    ) -> None:
        """assemble() must return a WordProposal instance with a non-null .id.

        A non-null id proves the row was flushed (DB assigned a PK).
        """
        lemma = "ξκφπβθδ"  # absent — reject path
        assemble = _get_assemble(db_session)

        with _patch_normalize(lemma):
            proposal = await assemble(lemma, "noun", WordProposalOrigin.ADMIN, None)

        assert isinstance(
            proposal, WordProposal
        ), "assemble() must return a WordProposal ORM instance."
        assert proposal.id is not None, (
            "proposal.id must be non-null — the row must be flushed so the DB assigns a PK. "
            "If id is None, the proposal was never added/flushed to the session."
        )
        # Confirm it is truly a UUID (not an integer or other type)
        assert isinstance(
            proposal.id, uuid.UUID
        ), f"proposal.id must be a uuid.UUID, got {type(proposal.id)!r}: {proposal.id!r}."

    async def test_assemble_present_lemma_returns_flushed_proposal(
        self, db_session: AsyncSession
    ) -> None:
        """Present-lemma path also returns a flushed proposal with non-null id."""
        lemma = "σπίτι_a3"
        await _seed_frequency_row(db_session, lemma=lemma)

        assemble = _get_assemble(db_session)

        with _patch_normalize(lemma):
            proposal = await assemble(lemma, "noun", WordProposalOrigin.USER_REQUEST, None)

        assert (
            proposal.id is not None
        ), "Present-lemma assemble() must also return a flushed proposal with non-null id."
        assert (
            proposal.status == WordProposalState.GENERATING
        ), f"Present-lemma proposal must be GENERATING, got {proposal.status!r}."


# ---------------------------------------------------------------------------
# A4: Deep-check evidence_packet on rejected row (all 4 sources)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestRejectedPacketDeepCheck:
    """evidence_packet on a rejected row must have all 4 sources with present=False.

    The spec test (test_rejected_proposal_still_persists_evidence_packet) checks
    the 3 reference sources (wiktionary, greek_lexicon, frequency) but not `rules`.
    This test ensures the full packet structure is intact and rules is also snapshotted.
    """

    async def test_rejected_evidence_packet_all_four_sources_absent(
        self, db_session: AsyncSession
    ) -> None:
        """Absent lemma → rejected row → all 4 sources in evidence_packet have present=False.

        Specifically checks:
          - sources.wiktionary.present is False
          - sources.greek_lexicon.present is False
          - sources.frequency.present is False
          - sources.rules.present is False  ← new check (not in spec test)
        """
        lemma = "ξκφπβθδα4"  # unique absent lemma

        assemble = _get_assemble(db_session)

        with _patch_normalize(lemma):
            proposal = await assemble(lemma, "noun", WordProposalOrigin.ADMIN, None)

        assert (
            proposal.status == WordProposalState.REJECTED
        ), f"Absent lemma must be REJECTED, got {proposal.status!r}."
        assert (
            proposal.evidence_packet is not None
        ), "evidence_packet must be non-null on a rejected proposal."

        sources = proposal.evidence_packet.get("sources", {})

        # Reference sources (already checked by spec test, re-assert for completeness)
        for source_key in ("wiktionary", "greek_lexicon", "frequency"):
            src = sources.get(source_key, {})
            assert src.get("present") is False, (
                f"evidence_packet.sources.{source_key}.present must be False "
                f"for absent lemma; got: {src!r}"
            )

        # Rules source — D-RULESSTUB always emits present=False in this story
        rules = sources.get("rules", {})
        assert (
            "rules" in sources
        ), f"evidence_packet.sources must contain a 'rules' key; got keys={list(sources.keys())!r}"
        assert rules.get("present") is False, (
            f"evidence_packet.sources.rules.present must be False (D-RULESSTUB); " f"got: {rules!r}"
        )

    async def test_rejected_packet_has_all_expected_top_level_keys(
        self, db_session: AsyncSession
    ) -> None:
        """evidence_packet on a rejected row must have required top-level fields.

        Checks: lemma_input, normalized_lemma, pos, sources all present in the snapshot.
        """
        lemma = "ξκφπβθδα4b"

        assemble = _get_assemble(db_session)

        with _patch_normalize(lemma):
            proposal = await assemble(lemma, "noun", WordProposalOrigin.ADMIN, None)

        packet = proposal.evidence_packet
        assert packet is not None
        for key in ("lemma_input", "normalized_lemma", "pos", "sources"):
            assert key in packet, (
                f"evidence_packet must contain '{key}' at top level; "
                f"got keys={list(packet.keys())!r}"
            )


# ---------------------------------------------------------------------------
# A5: Origin-agnostic rejection_reason byte-identity (parametrized)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "origin",
    [
        WordProposalOrigin.ADMIN,
        WordProposalOrigin.USER_REQUEST,
        WordProposalOrigin.BATCH,
    ],
    ids=["admin", "user_request", "batch"],
)
class TestOriginAgnosticReasonParity:
    """rejection_reason must be byte-identical across all three origin channels.

    The spec tests check each origin in separate test functions. This parametrized
    test explicitly compares the rejection_reason string from each origin against the
    canonical constant to catch any accidental origin-branching in the rejection path.
    """

    async def test_rejection_reason_matches_canonical_string(
        self, db_session: AsyncSession, origin: WordProposalOrigin
    ) -> None:
        """For any origin, rejection_reason must exactly equal the canonical never-invent string.

        Canonical: 'never_invent: lemma absent from all references'
        """
        # Use unique lemma per origin to avoid cross-test interference
        lemma = f"ξκφπβθδ_a5_{origin.value}"

        assemble = _get_assemble(db_session)

        with _patch_normalize(lemma):
            proposal = await assemble(lemma, "noun", origin, None)

        assert proposal.status == WordProposalState.REJECTED, (
            f"Absent lemma with origin={origin.value!r} must be REJECTED, "
            f"got {proposal.status!r}."
        )
        assert proposal.rejection_reason == _NEVER_INVENT_REASON, (
            f"rejection_reason must be byte-identical to {_NEVER_INVENT_REASON!r} "
            f"for origin={origin.value!r}; got {proposal.rejection_reason!r}. "
            "The never-invent reject path must not branch on origin."
        )
