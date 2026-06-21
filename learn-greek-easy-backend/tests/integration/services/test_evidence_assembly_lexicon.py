"""RED integration tests for LEXGEN-06-02: EvidenceAssemblyService — GreekLexicon
attestation queries + Wiktionary multi-gender presence.

These tests require a real Postgres db_session (the function-scoped AsyncSession
fixture from tests/fixtures/database.py:333). They seed their own reference rows
in the `reference` schema and rely on the transaction-rollback isolation of db_session.

Expected failure mode when run locally without the service implemented:
- ImportError: "No module named 'src.services.evidence_assembly_service'"

If the DB is not reachable, the db_session fixture raises an error at setup — that
is acceptable: the tests are structurally correct and run in CI's Backend Tests job
against the :5433 Postgres.

All tests use @pytest.mark.asyncio (not @pytest.mark.integration) to match the
existing integration test convention (tests/integration/services/ has no integration
marker; see test_duplicate_detection_service.py).

===========================================================================
SEAM CONTRACT — integration tests pin:
1. GreekLexicon row seeding: GreekLexicon(form=..., lemma=..., pos="NOUN",
   gender="Neut", ptosi="Nom", number="Sing") — no extra required fields.
2. WiktionaryMorphology row seeding: WiktionaryMorphology(lemma=..., pos="noun",
   gender="masculine"|"feminine"|"neuter", forms=[...]).
3. The service is called as: await service.assemble_evidence(lemma_input, pos=pos)
4. Returned packet.sources.greek_lexicon must carry: present, attested_lemma,
   attested_surface_form, resolved_lemma (when present), forms.
5. forms[*].features keys must be a subset of FEATURE_KEYS.
===========================================================================
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import GreekLexicon, WiktionaryMorphology
from src.schemas.lexgen import FEATURE_KEYS
from src.schemas.nlp import NormalizedLemma


# ---------------------------------------------------------------------------
# Deferred import — keeps the file collectable even before the module exists.
# Each test that calls _get_service_class() will get an ImportError at
# runtime (FAILED), not at collection time, giving a clean "N failed" summary.
# ---------------------------------------------------------------------------
def _get_service_class():
    """Import and return EvidenceAssemblyService, raising ImportError if not yet implemented."""
    from src.services.evidence_assembly_service import EvidenceAssemblyService  # noqa: PLC0415

    return EvidenceAssemblyService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_normalized(
    input_word: str,
    lemma: str,
    confidence: float = 1.0,
    pos: str = "NOUN",
    gender: str | None = None,
    article: str | None = None,
) -> NormalizedLemma:
    """Mirror of tests/unit/scripts/test_load_frequency_rank.py:57."""
    return NormalizedLemma(
        input_word=input_word,
        lemma=lemma,
        gender=gender,
        article=article,
        pos=pos,
        confidence=confidence,
    )


def _patch_normalize(lemma_out: str):
    """Return a context manager that patches get_lemma_normalization_service so that
    normalize() returns a NormalizedLemma with the given lemma.
    """
    normalized = _make_normalized(input_word=lemma_out, lemma=lemma_out)
    mock_norm_svc = MagicMock()
    mock_norm_svc.normalize = MagicMock(return_value=normalized)

    return patch(
        "src.services.evidence_assembly_service.get_lemma_normalization_service",
        return_value=mock_norm_svc,
    )


def _patch_freq_absent():
    """Return a context manager that patches FrequencyService to return rank=None."""
    mock_freq = MagicMock()
    mock_freq.get_frequency_rank = AsyncMock(return_value=None)
    mock_freq.get_frequency_band = AsyncMock(return_value=None)
    return patch(
        "src.services.evidence_assembly_service.FrequencyService",
        return_value=mock_freq,
    )


async def _seed_lexicon_row(
    db_session: AsyncSession,
    *,
    form: str,
    lemma: str,
    pos: str = "NOUN",
    gender: str = "Neut",
    ptosi: str = "Nom",
    number: str = "Sing",
) -> GreekLexicon:
    """Seed a single GreekLexicon row into the reference schema."""
    row = GreekLexicon(
        form=form,
        lemma=lemma,
        pos=pos,
        gender=gender,
        ptosi=ptosi,
        number=number,
    )
    db_session.add(row)
    await db_session.flush()
    return row


async def _seed_wiktionary_row(
    db_session: AsyncSession,
    *,
    lemma: str,
    pos: str = "noun",
    gender: str = "neuter",
    forms: list | None = None,
    pronunciation: str | None = None,
    glosses_en: str | None = None,
) -> WiktionaryMorphology:
    """Seed a single WiktionaryMorphology row into the reference schema."""
    row = WiktionaryMorphology(
        lemma=lemma,
        pos=pos,
        gender=gender,
        forms=forms or [],
        pronunciation=pronunciation,
        glosses_en=glosses_en,
    )
    db_session.add(row)
    await db_session.flush()
    return row


# ---------------------------------------------------------------------------
# Integration tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestWiktionaryCommonGenderPresence:
    """Common-gender lemma with two wiktionary_morphology rows (masc + fem) must be present:true."""

    async def test_wiktionary_common_gender_lemma_is_present(
        self, db_session: AsyncSession
    ) -> None:
        """Seed two wiktionary_morphology rows for the same lemma+pos with gender masc and fem.

        The service's common-gender probe must detect presence:true, and the forms
        from BOTH gender entries must be recorded.

        This verifies that `get_entry(lemma, pos)` returning None (because >1 row matches)
        does NOT cause the service to falsely mark present:false. The probe must fall
        through to a per-gender scan.
        """
        lemma = "σύζυγος"
        pos = "noun"

        # Masculine row
        await _seed_wiktionary_row(
            db_session,
            lemma=lemma,
            pos=pos,
            gender="masculine",
            forms=[{"form": "σύζυγος", "features": {"case": "nominative", "number": "singular"}}],
            pronunciation="/ˈsiziɣos/",
            glosses_en="spouse (masculine)",
        )
        # Feminine row
        await _seed_wiktionary_row(
            db_session,
            lemma=lemma,
            pos=pos,
            gender="feminine",
            forms=[{"form": "σύζυγος", "features": {"case": "nominative", "number": "singular"}}],
            pronunciation="/ˈsiziɣos/",
            glosses_en="spouse (feminine)",
        )

        with _patch_normalize(lemma), _patch_freq_absent():
            service = _get_service_class()(db_session)
            packet = await service.assemble_evidence(lemma, pos=pos)

        wikt = packet.sources.wiktionary
        assert wikt.present is True, (
            "wiktionary.present must be True for a common-gender lemma with two gender rows; "
            "the service must probe per-gender when get_entry returns None (multi-row case)."
        )
        # The genders field should carry per-gender info for common-gender lemmas
        assert hasattr(wikt, "genders"), "WiktionarySource must have 'genders' field"
        assert (
            wikt.genders is not None
        ), "wiktionary.genders must be non-null for a common-gender (multi-row) lemma"
        assert (
            len(wikt.genders) >= 2
        ), f"Expected at least 2 gender entries in wiktionary.genders, got {len(wikt.genders)}"


@pytest.mark.asyncio
class TestGreekLexiconAttestation:
    """GreekLexicon attestation via lemma column, surface-form column, and absence."""

    async def test_greek_lexicon_attested_via_lemma_column(self, db_session: AsyncSession) -> None:
        """Seed a greek_lexicon row where lemma=='σπίτι'.

        assemble_evidence with input 'σπίτι' → greek_lexicon.present:true,
        attested_lemma:true, forms populated.
        """
        await _seed_lexicon_row(
            db_session,
            form="σπίτι",
            lemma="σπίτι",
            pos="NOUN",
            gender="Neut",
            ptosi="Nom",
            number="Sing",
        )

        with _patch_normalize("σπίτι"), _patch_freq_absent():
            service = _get_service_class()(db_session)
            packet = await service.assemble_evidence("σπίτι", pos="noun")

        gl = packet.sources.greek_lexicon
        assert gl.present is True, "greek_lexicon.present must be True when lemma row found"
        assert hasattr(gl, "attested_lemma"), "GreekLexiconSource must have 'attested_lemma' field"
        assert gl.attested_lemma is True, "attested_lemma must be True when hit on the lemma column"
        assert len(gl.forms) >= 1, "forms must be populated when lexicon row found via lemma"

    async def test_greek_lexicon_attested_via_surface_form(self, db_session: AsyncSession) -> None:
        """Seed a greek_lexicon row where form='σπιτιού' (genitive) but lemma='σπίτι'.

        assemble_evidence with input 'σπιτιού' → attested_surface_form:true,
        present:true, and greek_lexicon.forms non-empty with features keys ∈ FEATURE_KEYS,
        resolved from the row's true lemma 'σπίτι' (not from the raw inflected input).
        """
        surface_form = "σπιτιού"
        true_lemma = "σπίτι"

        # Seed the inflected row (form='σπιτιού', lemma='σπίτι')
        await _seed_lexicon_row(
            db_session,
            form=surface_form,
            lemma=true_lemma,
            pos="NOUN",
            gender="Neut",
            ptosi="Gen",
            number="Sing",
        )
        # Also seed a nominative row so get_declensions returns something
        await _seed_lexicon_row(
            db_session,
            form="σπίτι",
            lemma=true_lemma,
            pos="NOUN",
            gender="Neut",
            ptosi="Nom",
            number="Sing",
        )

        with _patch_normalize(surface_form), _patch_freq_absent():
            service = _get_service_class()(db_session)
            packet = await service.assemble_evidence(surface_form, pos="noun")

        gl = packet.sources.greek_lexicon
        assert (
            gl.present is True
        ), "greek_lexicon.present must be True when surface form matched in 'form' column"
        assert hasattr(
            gl, "attested_surface_form"
        ), "GreekLexiconSource must have 'attested_surface_form' field"
        assert (
            gl.attested_surface_form is True
        ), "attested_surface_form must be True when hit on the form column (not lemma column)"
        assert len(gl.forms) >= 1, "forms must be populated when lexicon row found via surface form"

        # All feature keys in forms must be within FEATURE_KEYS
        for bundle in gl.forms:
            unknown_keys = set(bundle.features.keys()) - FEATURE_KEYS
            assert not unknown_keys, (
                f"FormBundle.features contains unknown keys: {unknown_keys}. "
                f"All feature keys must be in FEATURE_KEYS = {sorted(FEATURE_KEYS)}"
            )

        # resolved_lemma must be the true lemma (not the raw surface form)
        assert hasattr(gl, "resolved_lemma"), "GreekLexiconSource must have 'resolved_lemma' field"
        assert gl.resolved_lemma == true_lemma, (
            f"resolved_lemma must be {true_lemma!r} (the row's .lemma), "
            f"not {surface_form!r} (the raw inflected input)"
        )

    async def test_greek_lexicon_absent_when_no_row(self, db_session: AsyncSession) -> None:
        """No greek_lexicon row seeded for the lemma → greek_lexicon absent shape.

        The absent shape must be:
          {"present": false, "attested_lemma": false, "attested_surface_form": false}
        """
        with _patch_normalize("ξκφπβ"), _patch_freq_absent():
            service = _get_service_class()(db_session)
            packet = await service.assemble_evidence("ξκφπβ", pos="noun")

        gl = packet.sources.greek_lexicon
        assert gl.present is False, "greek_lexicon.present must be False when no row found"
        assert hasattr(
            gl, "attested_lemma"
        ), "GreekLexiconSource absent shape must carry 'attested_lemma'"
        assert gl.attested_lemma is False, "attested_lemma must be False in absent shape"
        assert hasattr(
            gl, "attested_surface_form"
        ), "GreekLexiconSource absent shape must carry 'attested_surface_form'"
        assert (
            gl.attested_surface_form is False
        ), "attested_surface_form must be False in absent shape"


@pytest.mark.asyncio
class TestWiktionaryPOSMismatch:
    """Wiktionary rows with a different POS than requested → present:false."""

    async def test_wiktionary_absent_when_pos_mismatches_seeded_row(
        self, db_session: AsyncSession
    ) -> None:
        """Seed a wiktionary_morphology row for lemma X with pos='noun'.

        assemble_evidence X with pos='verb' → wiktionary.present:false,
        because the POS filter on the query returns None (mismatch).

        This is distinct from "not in the reference at all": the lemma EXISTS
        in the table but under a different POS — the service must NOT report
        presence for the wrong POS.
        """
        lemma = "γράφω"

        await _seed_wiktionary_row(
            db_session,
            lemma=lemma,
            pos="noun",  # seeded as noun
            gender="masculine",
            forms=[{"form": lemma, "features": {"case": "nominative", "number": "singular"}}],
        )

        # Assemble with pos='verb' — should NOT match the 'noun' row
        with _patch_normalize(lemma), _patch_freq_absent():
            service = _get_service_class()(db_session)
            packet = await service.assemble_evidence(lemma, pos="verb")  # POS mismatch

        wikt = packet.sources.wiktionary
        assert wikt.present is False, (
            "wiktionary.present must be False when the seeded row has a different POS. "
            "The service must filter by the requested pos, not just by lemma."
        )
