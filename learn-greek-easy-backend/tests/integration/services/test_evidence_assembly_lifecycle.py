"""RED integration tests for LEXGEN-06-03: EvidenceAssemblyService.assemble()
— proposal lifecycle (create + persist + state transitions) + never-invent reject.

These tests require a real Postgres db_session (the function-scoped AsyncSession
fixture from tests/fixtures/database.py). They seed their own reference rows in
the `reference` schema and rely on the transaction-rollback isolation of db_session.

Expected failure mode when run before the implementation exists:
    AttributeError: 'EvidenceAssemblyService' object has no attribute 'assemble'

because the module (evidence_assembly_service.py) exists (from 06-02) but the
`assemble` method has not been added yet.

===========================================================================
SEAM CONTRACT — pinned by these RED tests (executor MUST honour):
1. EvidenceAssemblyService.assemble(
       lemma_input: str,
       pos: str,
       origin: WordProposalOrigin,
       requested_by,
   ) -> WordProposal
   Must create and flush/commit a WordProposal(status=PENDING) to the DB,
   call assemble_evidence(), snapshot the packet into evidence_packet, then
   drive the state machine:
     • present-anywhere  → pending→generating   (status=GENERATING)
     • absent-everywhere → pending→generating→rejected
         status=REJECTED, rejection_reason="never_invent: lemma absent from all references"
   Origin-agnostic: ADMIN / USER_REQUEST / BATCH all behave the same.

2. Seeding conventions (copied from test_evidence_assembly_lexicon.py):
   • GreekLexicon: GreekLexicon(form=, lemma=, pos="NOUN", gender="Neut",
                                ptosi="Nom", number="Sing")
   • FrequencyRank: FrequencyRank(lemma=, rank=1, source="wordfreq")
   • WiktionaryMorphology: WiktionaryMorphology(lemma=, pos="noun",
                                                gender="neuter", forms=[])
   • Present case = at least one reference row seeded for the lemma.
   • Absent case  = NO reference rows for a nonsense lemma.
   • Freq-only case = ONLY a FrequencyRank row (no lexicon/wiktionary).

3. DB enum values: origin and status are lowercase
   ("admin"/"user_request"/"batch", "pending"/"generating"/"rejected").

4. retry_attempts must be 0 on rejected proposals (no action taken).

5. evidence_packet must be non-null on ALL returned proposals
   (snapshot taken before the reject transition).

6. Normalization is patched via:
     patch("src.services.evidence_assembly_service.get_lemma_normalization_service",
           return_value=mock_norm_svc)
   so test lemmas don't need to survive the real normalization pipeline.

7. The method-under-test is imported at the TOP of each test via _get_assemble()
   to keep the file collectable even before `assemble` is added. Each test will
   FAIL with AttributeError at call time, not at collection time.
===========================================================================
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    FrequencyRank,
    GreekLexicon,
    WiktionaryMorphology,
    WordProposal,
    WordProposalOrigin,
    WordProposalState,
)
from src.schemas.nlp import NormalizedLemma

# ---------------------------------------------------------------------------
# Deferred import helpers — keep the file collectable before assemble() exists.
# Tests call _get_assemble() to obtain the bound coroutine, which raises
# AttributeError if the method does not exist yet.
# ---------------------------------------------------------------------------


def _get_service_class():
    """Import and return EvidenceAssemblyService."""
    from src.services.evidence_assembly_service import EvidenceAssemblyService  # noqa: PLC0415

    return EvidenceAssemblyService


def _get_assemble(db_session: AsyncSession):
    """Return the `assemble` coroutine of a fresh service instance.

    Raises AttributeError if assemble() has not been implemented yet — that
    is the expected RED failure mode for these tests.
    """
    svc = _get_service_class()(db_session)
    return svc.assemble  # AttributeError here == RED for the right reason


# ---------------------------------------------------------------------------
# Shared seeding helpers (mirrored from test_evidence_assembly_lexicon.py)
# ---------------------------------------------------------------------------


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
    """Patch get_lemma_normalization_service so normalize() returns lemma_out."""
    normalized = _make_normalized(lemma_out)
    mock_norm_svc = MagicMock()
    mock_norm_svc.normalize = MagicMock(return_value=normalized)
    return patch(
        "src.services.evidence_assembly_service.get_lemma_normalization_service",
        return_value=mock_norm_svc,
    )


async def _seed_lexicon_row(db_session: AsyncSession, *, lemma: str) -> GreekLexicon:
    """Seed a single GreekLexicon row for the given lemma."""
    row = GreekLexicon(
        form=lemma,
        lemma=lemma,
        pos="NOUN",
        gender="Neut",
        ptosi="Nom",
        number="Sing",
    )
    db_session.add(row)
    await db_session.flush()
    return row


async def _seed_frequency_row(
    db_session: AsyncSession, *, lemma: str, rank: int = 1
) -> FrequencyRank:
    """Seed a single FrequencyRank row for the given lemma."""
    row = FrequencyRank(lemma=lemma, rank=rank, source="wordfreq")
    db_session.add(row)
    await db_session.flush()
    return row


async def _seed_wiktionary_row(db_session: AsyncSession, *, lemma: str) -> WiktionaryMorphology:
    """Seed a single WiktionaryMorphology row for the given lemma."""
    row = WiktionaryMorphology(
        lemma=lemma,
        pos="noun",
        gender="neuter",
        forms=[],
    )
    db_session.add(row)
    await db_session.flush()
    return row


# ---------------------------------------------------------------------------
# Integration tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestAssembleCreatesProposal:
    """assemble() must create and persist a WordProposal with the correct fields."""

    async def test_assemble_creates_pending_proposal_with_fields(
        self, db_session: AsyncSession
    ) -> None:
        """assemble("σπίτι","noun",ADMIN,None) must return a persisted WordProposal
        with lemma_input="σπίτι", pos="noun", origin=ADMIN, requested_by=None.

        This is the baseline field-binding test. The exact end-status depends
        on reference seeding (absent here → will reject), but the fields set at
        CREATION time (before transitions) are always fixed.
        """
        lemma = "σπίτι"
        assemble = _get_assemble(db_session)

        with _patch_normalize(lemma):
            proposal = await assemble(lemma, "noun", WordProposalOrigin.ADMIN, None)

        assert isinstance(
            proposal, WordProposal
        ), "assemble() must return a WordProposal ORM instance"
        assert (
            proposal.lemma_input == lemma
        ), f"proposal.lemma_input must be {lemma!r}, got {proposal.lemma_input!r}"
        assert proposal.pos == "noun", f"proposal.pos must be 'noun', got {proposal.pos!r}"
        assert (
            proposal.origin == WordProposalOrigin.ADMIN
        ), f"proposal.origin must be ADMIN, got {proposal.origin!r}"
        assert (
            proposal.requested_by is None
        ), f"proposal.requested_by must be None, got {proposal.requested_by!r}"
        # id must be set (the proposal was persisted, not just constructed in memory)
        assert (
            proposal.id is not None
        ), "proposal.id must be non-null — the row must be flushed/committed to the DB"


@pytest.mark.asyncio
class TestPresentLemmaEndGenerating:
    """A lemma attested in at least one source must end with status=GENERATING."""

    async def test_present_lemma_ends_generating_with_packet(
        self, db_session: AsyncSession
    ) -> None:
        """Seed a matching greek_lexicon row for σπίτι → assemble → status==GENERATING.

        The evidence_packet must be non-null and greek_lexicon.present must be True.
        """
        lemma = "σπίτι"
        await _seed_lexicon_row(db_session, lemma=lemma)

        assemble = _get_assemble(db_session)

        with _patch_normalize(lemma):
            proposal = await assemble(lemma, "noun", WordProposalOrigin.ADMIN, None)

        assert (
            proposal.status == WordProposalState.GENERATING
        ), f"status must be GENERATING for a present lemma, got {proposal.status!r}"
        assert (
            proposal.evidence_packet is not None
        ), "evidence_packet must be non-null after assemble()"
        # The snapshotted packet must show greek_lexicon.present=True
        sources = proposal.evidence_packet.get("sources", {})
        gl = sources.get("greek_lexicon", {})
        assert gl.get("present") is True, (
            "evidence_packet.sources.greek_lexicon.present must be True "
            f"when a matching lexicon row is seeded; got: {gl!r}"
        )

    async def test_frequency_only_lemma_passes_gate(self, db_session: AsyncSession) -> None:
        """Seed ONLY a frequency_rank row (no wiktionary/lexicon) → status==GENERATING.

        D-FREQONLY: frequency-alone is sufficient to declare existence.
        The never-invent gate must NOT be triggered.
        """
        lemma = "σπίτι"
        await _seed_frequency_row(db_session, lemma=lemma)

        assemble = _get_assemble(db_session)

        with _patch_normalize(lemma):
            proposal = await assemble(lemma, "noun", WordProposalOrigin.ADMIN, None)

        assert proposal.status == WordProposalState.GENERATING, (
            "status must be GENERATING when frequency-only attestation present (D-FREQONLY); "
            f"got {proposal.status!r}"
        )


@pytest.mark.asyncio
class TestAbsentLemmaHardRejected:
    """A lemma absent from all sources must end with status=REJECTED."""

    async def test_absent_lemma_hard_rejected(self, db_session: AsyncSession) -> None:
        """No reference rows for a nonsense lemma → status==REJECTED with exact reason string."""
        lemma = "ξκφπβθδ"

        assemble = _get_assemble(db_session)

        with _patch_normalize(lemma):
            proposal = await assemble(lemma, "noun", WordProposalOrigin.ADMIN, None)

        assert (
            proposal.status == WordProposalState.REJECTED
        ), f"status must be REJECTED for an absent lemma, got {proposal.status!r}"
        assert proposal.rejection_reason == "never_invent: lemma absent from all references", (
            "rejection_reason must be exactly "
            "'never_invent: lemma absent from all references'; "
            f"got {proposal.rejection_reason!r}"
        )
        assert (
            proposal.retry_attempts == 0
        ), f"retry_attempts must be 0 on never-invent reject, got {proposal.retry_attempts!r}"

    async def test_rejected_proposal_still_persists_evidence_packet(
        self, db_session: AsyncSession
    ) -> None:
        """Absent lemma → rejected row's evidence_packet is non-null with all sources present:false."""
        lemma = "ξκφπβθδ"

        assemble = _get_assemble(db_session)

        with _patch_normalize(lemma):
            proposal = await assemble(lemma, "noun", WordProposalOrigin.ADMIN, None)

        assert proposal.evidence_packet is not None, (
            "evidence_packet must be non-null even on a rejected proposal "
            "(snapshot must happen BEFORE the reject transition)"
        )
        sources = proposal.evidence_packet.get("sources", {})
        # All three reference sources must be present:false
        for source_key in ("wiktionary", "greek_lexicon", "frequency"):
            src = sources.get(source_key, {})
            assert src.get("present") is False, (
                f"evidence_packet.sources.{source_key}.present must be False "
                f"for an absent lemma; got: {src!r}"
            )

    async def test_rejected_row_is_durable(self, db_session: AsyncSession) -> None:
        """Absent lemma → re-query the proposal id → row still present with status==REJECTED."""
        lemma = "ξκφπβθδ"

        assemble = _get_assemble(db_session)

        with _patch_normalize(lemma):
            proposal = await assemble(lemma, "noun", WordProposalOrigin.ADMIN, None)

        proposal_id = proposal.id
        assert proposal_id is not None, "proposal.id must be set for durability check"

        # Re-query by primary key
        result = await db_session.execute(
            select(WordProposal).where(WordProposal.id == proposal_id)
        )
        row = result.scalar_one_or_none()

        assert row is not None, (
            f"WordProposal with id={proposal_id} must still exist in the DB after assemble(); "
            "the reject must persist the row, not discard it"
        )
        assert (
            row.status == WordProposalState.REJECTED
        ), f"re-queried row.status must be REJECTED, got {row.status!r}"


@pytest.mark.asyncio
class TestNeverInventOriginAgnostic:
    """never-invent reject must fire regardless of origin channel."""

    async def test_never_invent_rejects_admin_origin(self, db_session: AsyncSession) -> None:
        """Absent lemma, origin=ADMIN → status==REJECTED."""
        lemma = "ξκφπβγ1"

        assemble = _get_assemble(db_session)

        with _patch_normalize(lemma):
            proposal = await assemble(lemma, "noun", WordProposalOrigin.ADMIN, None)

        assert (
            proposal.status == WordProposalState.REJECTED
        ), f"ADMIN origin must also be rejected for absent lemma, got {proposal.status!r}"

    async def test_never_invent_rejects_user_request_origin(self, db_session: AsyncSession) -> None:
        """Absent lemma, origin=USER_REQUEST → status==REJECTED with exact rejection_reason."""
        lemma = "ξκφπβγ2"

        assemble = _get_assemble(db_session)

        with _patch_normalize(lemma):
            proposal = await assemble(lemma, "noun", WordProposalOrigin.USER_REQUEST, None)

        assert (
            proposal.status == WordProposalState.REJECTED
        ), f"USER_REQUEST origin must also be rejected for absent lemma, got {proposal.status!r}"
        assert proposal.rejection_reason == "never_invent: lemma absent from all references", (
            "rejection_reason must match regardless of origin; "
            f"got {proposal.rejection_reason!r}"
        )

    async def test_never_invent_rejects_batch_origin(self, db_session: AsyncSession) -> None:
        """Absent lemma, origin=BATCH → status==REJECTED."""
        lemma = "ξκφπβγ3"

        assemble = _get_assemble(db_session)

        with _patch_normalize(lemma):
            proposal = await assemble(lemma, "noun", WordProposalOrigin.BATCH, None)

        assert (
            proposal.status == WordProposalState.REJECTED
        ), f"BATCH origin must also be rejected for absent lemma, got {proposal.status!r}"
