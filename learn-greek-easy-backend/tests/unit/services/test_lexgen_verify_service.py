"""Unit tests for LEXGEN-10-03: LexgenVerifyService gate orchestration (VS-06, VS-08).

These tests verify two critical no-side-effect contracts WITHOUT a real DB,
using mocked dependencies.

VS-06 no-requery:    proposal.evidence_packet is present → verify() reads ONLY from
                     the JSONB snapshot (EvidencePacket.model_validate); it NEVER
                     instantiates EvidenceAssemblyService / WiktionaryMorphologyService /
                     FrequencyService. Assert via mock that those assembly classes are
                     not called.

VS-08 no-state-mutation:  proposal in GENERATING → after verify() (any outcome)
                           proposal.status must still be GENERATING; transition()
                           must never be called.

Dependency mocking strategy:
    CefrVocabularyService and LexiconService are patched at the verify-service
    module level (src.services.lexgen_verify_service.*) so they work without a
    real DB session. The assembly services (EvidenceAssemblyService,
    WiktionaryMorphologyService, FrequencyService) are patched with
    side_effect=AssertionError to catch any accidental re-assembly.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.db.models import WordProposal, WordProposalOrigin, WordProposalState
from src.schemas.lexgen import (
    EvidencePacket,
    EvidencePacketSources,
    FormBundle,
    FrequencySource,
    GreekLexiconSource,
    RulesSource,
    WiktionarySource,
)

# ---------------------------------------------------------------------------
# Deferred import helper — keeps file collectable.
# The stub module exists so imports succeed.
# ---------------------------------------------------------------------------


def _get_service_class():
    """Import and return LexgenVerifyService."""
    from src.services.lexgen_verify_service import LexgenVerifyService  # noqa: PLC0415

    return LexgenVerifyService


def _get_verify_outcome_class():
    """Import and return VerifyOutcome."""
    from src.services.lexgen_verify_service import VerifyOutcome  # noqa: PLC0415

    return VerifyOutcome


# ---------------------------------------------------------------------------
# Shared builders
# ---------------------------------------------------------------------------


def _make_biblio_packet() -> EvidencePacket:
    """Build a minimal but valid EvidencePacket for βιβλίο (book — neuter noun)."""
    forms = [
        FormBundle(form="βιβλίο", features={"case": "nominative", "number": "singular"}),
        FormBundle(form="βιβλίου", features={"case": "genitive", "number": "singular"}),
    ]
    return EvidencePacket(
        lemma_input="βιβλίο",
        normalized_lemma="βιβλίο",
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(
                present=True,
                gender="neuter",
                forms=forms,
                pronunciation="vivˈli.o",
                glosses_en="book; volume",
            ),
            greek_lexicon=GreekLexiconSource(
                present=True,
                forms=forms,
                attested_lemma=True,
                resolved_lemma="βιβλίο",
            ),
            frequency=FrequencySource(present=True, rank=55, band="A1"),
            rules=RulesSource(present=True),
        ),
    )


def _make_proposal_with_content(
    *,
    gloss_en: str = "book",
    example_greek: str = "Η μητέρα διαβάζει ένα βιβλίο στο σπίτι.",
) -> WordProposal:
    """Build an in-memory WordProposal in GENERATING state with both JSONB columns.

    Note: in-memory only (no DB flush). No ``id``.
    """
    packet = _make_biblio_packet()
    proposal = WordProposal(
        lemma_input="βιβλίο",
        pos="noun",
        origin=WordProposalOrigin.ADMIN,
        requested_by=None,
        status=WordProposalState.GENERATING,
    )
    proposal.evidence_packet = packet.model_dump(mode="json")
    proposal.generated_content = {
        "gloss_en": gloss_en,
        "gloss_ru": "книга",
        "example_greek": example_greek,
        "example_translation": "The mother reads a book at home.",
    }
    proposal.generated_fields = None
    proposal.reconciliation_log = None
    proposal.flagged_fields = None
    proposal.judge_scores = None
    proposal.trust_score = None
    return proposal


def _make_service(*, mock_db: AsyncMock | None = None) -> object:
    """Return a LexgenVerifyService with mocked db and openrouter.

    NOTE: CefrVocabularyService and LexiconService are NOT mocked here because
    they must be patched at the verify-service module namespace level before
    calling svc.verify().  Each test that calls verify() must apply those patches
    itself (see _CEFR_PATCH / _LEXICON_PATCH helpers or inline context managers).
    """
    cls = _get_service_class()
    if mock_db is None:
        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()
    mock_openrouter = MagicMock()
    return cls(db=mock_db, openrouter=mock_openrouter)


def _cefr_mock(lemma_set: set[str] | None = None):
    """Return a configured CefrVocabularyService mock instance.

    lemma_set: the set returned by allowed_lemmas().  Defaults to a set that
    covers the §7 sentence content words (excluding the target βιβλίο, which
    verify() always adds itself).
    """
    if lemma_set is None:
        lemma_set = {"μητέρα", "διαβάζω", "σπίτι", "σε", "ο", "η", "ένα"}
    instance = AsyncMock()
    instance.allowed_lemmas = AsyncMock(return_value=lemma_set)
    return instance


def _lexicon_mock(return_value=None):
    """Return a configured LexiconService mock instance.

    return_value: what lookup() returns (None = lexicon miss, is_unknown=True).
    """
    instance = AsyncMock()
    instance.lookup = AsyncMock(return_value=return_value)
    return instance


# ---------------------------------------------------------------------------
# VS-06 — no-requery: verify() does NOT instantiate source-assembly services
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestNoRequery:
    """VS-06: verify() reads only from proposal.evidence_packet JSONB — no re-assembly.

    CefrVocabularyService and LexiconService are legitimate gate-internal services
    (not assembly services) and ARE allowed to be called; they are mocked with proper
    return values so verify() completes without a real DB.

    The assertion targets the three EVIDENCE-ASSEMBLY services that must never be
    instantiated by verify():
        - EvidenceAssemblyService   (assembles the evidence packet from sources)
        - WiktionaryMorphologyService (fetches Wiktionary data)
        - FrequencyService           (fetches frequency rank)

    These are patched with side_effect=AssertionError so any accidental call from
    within verify() would raise immediately and fail the test.
    """

    async def test_vs06_verify_does_not_call_evidence_assembly_services(
        self,
    ) -> None:
        """VS-06: packet present → verify() never touches evidence-assembly services.

        Assembly services are patched with side_effect=AssertionError; any
        instantiation from within verify() would fail the test immediately.
        The gate-internal services (CefrVocabularyService, LexiconService) are
        properly mocked so verify() can complete.

        GREEN: verify() returns VerifyOutcome AND the assembly services stay uncalled.
        """
        proposal = _make_proposal_with_content()
        svc = _make_service()

        with (
            # Gate-internal services — mocked so verify() works without a DB.
            patch(
                "src.services.lexgen_verify_service.CefrVocabularyService",
                return_value=_cefr_mock(),
            ),
            patch(
                "src.services.lexgen_verify_service.LexiconService",
                return_value=_lexicon_mock(),
            ),
            # Evidence-ASSEMBLY services — must never be called by verify().
            patch(
                "src.services.evidence_assembly_service.EvidenceAssemblyService",
                side_effect=AssertionError(
                    "VS-06: EvidenceAssemblyService must NOT be instantiated by verify()"
                ),
            ) as mock_assembly,
            patch(
                "src.services.wiktionary_morphology_service.WiktionaryMorphologyService",
                side_effect=AssertionError(
                    "VS-06: WiktionaryMorphologyService must NOT be instantiated by verify()"
                ),
            ) as mock_wikt,
            patch(
                "src.services.frequency_service.FrequencyService",
                side_effect=AssertionError(
                    "VS-06: FrequencyService must NOT be instantiated by verify()"
                ),
            ) as mock_freq,
        ):
            outcome = await svc.verify(proposal)

        # verify() must return a valid outcome (reads packet from JSONB, not re-assembled).
        VerifyOutcome = _get_verify_outcome_class()
        assert isinstance(
            outcome, VerifyOutcome
        ), f"VS-06: verify() must return a VerifyOutcome; got {type(outcome).__name__}"

        # Evidence-assembly services must be uncalled.
        # (If any were called, they would have raised AssertionError above.)
        mock_assembly.assert_not_called()
        mock_wikt.assert_not_called()
        mock_freq.assert_not_called()


# ---------------------------------------------------------------------------
# VS-08 — no-state-mutation: proposal.status stays GENERATING; no transition()
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestNoStateMutation:
    """VS-08: verify() never mutates proposal.status or calls transition().

    CefrVocabularyService and LexiconService are mocked at the verify-service
    module level so verify() can complete without a real DB.
    """

    async def test_vs08_status_stays_generating_after_verify(self) -> None:
        """VS-08: proposal in GENERATING; after verify() status must still be GENERATING.

        The verify service is explicitly prohibited from calling transition()
        (Architecture-Schematics §5; LEXGEN-10-03 contract).

        GREEN: verify() returns; proposal.status must be GENERATING; transition()
        must not have been called.
        """
        proposal = _make_proposal_with_content()
        assert (
            proposal.status == WordProposalState.GENERATING
        ), "Fixture sanity: proposal must start in GENERATING"

        svc = _make_service()

        with (
            patch(
                "src.services.lexgen_verify_service.CefrVocabularyService",
                return_value=_cefr_mock(),
            ),
            patch(
                "src.services.lexgen_verify_service.LexiconService",
                return_value=_lexicon_mock(),
            ),
            # Spy on transition at the module location the service will import it from.
            patch(
                "src.core.word_proposal_state.transition",
                wraps=__import__(
                    "src.core.word_proposal_state", fromlist=["transition"]
                ).transition,
            ) as mock_transition,
        ):
            outcome = await svc.verify(proposal)  # noqa: F841

        assert proposal.status == WordProposalState.GENERATING, (
            "VS-08: proposal.status must remain GENERATING after verify() (any outcome); "
            f"got {proposal.status!r}"
        )
        mock_transition.assert_not_called()

    async def test_vs08_morphological_columns_not_written(self) -> None:
        """VS-08 extension: verify() must not write generated_fields / reconciliation_log /
        judge_scores / trust_score.

        GREEN: verify() returns; the columns are still None.
        """
        proposal = _make_proposal_with_content()
        assert proposal.generated_fields is None
        assert proposal.reconciliation_log is None
        assert proposal.judge_scores is None
        assert proposal.trust_score is None

        svc = _make_service()

        with (
            patch(
                "src.services.lexgen_verify_service.CefrVocabularyService",
                return_value=_cefr_mock(),
            ),
            patch(
                "src.services.lexgen_verify_service.LexiconService",
                return_value=_lexicon_mock(),
            ),
        ):
            outcome = await svc.verify(proposal)  # noqa: F841

        assert proposal.generated_fields is None, (
            "VS-08: verify() must NOT write generated_fields; " f"got {proposal.generated_fields!r}"
        )
        assert proposal.reconciliation_log is None, (
            "VS-08: verify() must NOT write reconciliation_log; "
            f"got {proposal.reconciliation_log!r}"
        )
        assert proposal.judge_scores is None, (
            "VS-08: verify() must NOT write judge_scores; " f"got {proposal.judge_scores!r}"
        )
        assert proposal.trust_score is None, (
            "VS-08: verify() must NOT write trust_score; " f"got {proposal.trust_score!r}"
        )


# ---------------------------------------------------------------------------
# VerifyOutcome shape tests — GREEN from day one (stub defines concrete shape)
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestVerifyOutcomeShape:
    """VerifyOutcome must be a concrete, instantiable result type with the required fields.

    These tests are GREEN from day one: the stub defines VerifyOutcome concretely.
    They confirm the shape the executor MUST preserve throughout implementation.
    """

    def test_verify_outcome_default_fields(self) -> None:
        """VerifyOutcome(status="PASS") creates an instance with expected defaults."""
        VerifyOutcome = _get_verify_outcome_class()

        outcome = VerifyOutcome(status="PASS")
        assert outcome.status == "PASS"
        assert isinstance(outcome.gate_results, list)
        assert len(outcome.gate_results) == 0
        assert isinstance(outcome.check_e_regens, int)
        assert outcome.check_e_regens == 0
        assert isinstance(outcome.flagged, list)
        assert len(outcome.flagged) == 0

    def test_verify_outcome_flagged_shape(self) -> None:
        """VerifyOutcome with status=FLAGGED and populated fields."""
        from src.core.lexgen_verify import GateResult

        VerifyOutcome = _get_verify_outcome_class()
        gate_result = GateResult(
            passed=False,
            severity="fail",
            gate="check_e",
            offending=["κβάντο"],
            reason="out-of-vocab lemmas: ['κβάντο']",
        )
        outcome = VerifyOutcome(
            status="FLAGGED",
            gate_results=[gate_result],
            check_e_regens=2,
            flagged=["check_e"],
        )
        assert outcome.status == "FLAGGED"
        assert outcome.check_e_regens == 2
        assert "check_e" in outcome.flagged
        assert len(outcome.gate_results) == 1
        assert not outcome.gate_results[0].passed
        assert outcome.gate_results[0].severity == "fail"

    def test_verify_outcome_rejected_shape(self) -> None:
        """VerifyOutcome(status="REJECTED") is valid — the generator-driven terminal case."""
        VerifyOutcome = _get_verify_outcome_class()

        outcome = VerifyOutcome(status="REJECTED")
        assert outcome.status == "REJECTED"
        assert outcome.check_e_regens == 0

    def test_factory_returns_service_instance(self) -> None:
        """get_lexgen_verify_service(db) returns a LexgenVerifyService."""
        from src.services.lexgen_verify_service import get_lexgen_verify_service

        LexgenVerifyService = _get_service_class()
        mock_db = AsyncMock()
        with patch(
            "src.services.lexgen_verify_service.get_openrouter_service",
            return_value=MagicMock(),
        ):
            svc = get_lexgen_verify_service(mock_db)

        assert isinstance(
            svc, LexgenVerifyService
        ), f"get_lexgen_verify_service must return LexgenVerifyService; got {type(svc)}"
        assert svc.db is mock_db
