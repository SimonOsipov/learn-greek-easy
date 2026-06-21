"""RED tests for LEXGEN-06-02: EvidenceAssemblyService — per-source assembly + GreekLexicon
attestation query.

These tests are authored BEFORE the implementation exists.
Expected failure mode when the service module does NOT exist: each test fails with an
ImportError raised inside it — clearly showing the test is red due to the service
not being implemented, not due to a typo or structural problem.

The import of EvidenceAssemblyService is deferred INSIDE a module-level helper
`_get_service_class()` so that this file COLLECTS successfully (pytest shows
"10 FAILED" not "collection error"), confirming the test structure is valid.

===========================================================================
SEAM CONTRACT — the executor MUST implement these exact interfaces:
===========================================================================

1. MODULE: src/services/evidence_assembly_service.py

2. PUBLIC API TARGETED BY THESE TESTS:
   - EvidenceAssemblyService(db: AsyncSession)
   - async EvidenceAssemblyService.assemble_evidence(lemma_input: str, pos: str) -> EvidencePacket
     (read-only assembly — no proposal creation/transitions; those land in 06-03)
   - EvidenceAssemblyService._lemma_exists(packet: EvidencePacket) -> bool
     (pure class method — signature: _lemma_exists(packet) -> bool)

   NOTE ON METHOD NAME: 06-02 is the read-only assembly step. To leave room for
   06-03's `assemble(lemma_input, pos, origin, requested_by) -> WordProposal` (which
   creates the proposal AND calls the assembly), these tests call the read-only
   assembly helper as `assemble_evidence(lemma_input, pos)`. The executor may
   alternatively name this `_assemble_evidence` (private) and expose it only through
   the public `assemble`, OR implement the full `assemble` in 06-02 and have 06-03
   extend it — either design satisfies these tests provided:
     a) The method is callable on the service with just `(lemma_input, pos)` and
        returns EvidencePacket.
     b) `_lemma_exists(packet)` is a pure callable on the class.
   If the executor chooses an alternative callable name, update the call sites here
   before marking these tests green.

3. WIKTIONARY SOURCE SHAPE (executor MUST add these fields to WiktionarySource in lexgen.py):
   Absent:  {"present": false}
   Present: {"present": true, "gender": str|None, "pronunciation": str|None,
             "glosses_en": str|None, "forms": [...], "genders": list|None}
   "genders" key is ONLY present (and non-null) for the common-gender (multi-row) case.

4. GREEK LEXICON SOURCE SHAPE (executor MUST add these fields to GreekLexiconSource):
   Absent:  {"present": false, "attested_lemma": false, "attested_surface_form": false}
   Present: {"present": true, "attested_lemma": bool, "attested_surface_form": bool,
             "resolved_lemma": str, "forms": [...]}

5. NORMALIZATION CONTRACT:
   The service MUST apply lower() → NFC → _final_sigma_unfold() BEFORE calling
   LemmaNormalizationService.normalize(). The normalize() call is mocked in these
   tests via a patch, and the tests assert the RESULT of normalization (.lemma on
   the returned NormalizedLemma) is forwarded to the sub-services — NOT the raw input.

6. POS CASING CONTRACT:
   - pos forwarded verbatim (lowercase) to WiktionaryMorphologyService calls.
   - pos.upper() forwarded to GreekLexicon existence query / LexiconService calls.

===========================================================================
"""

from __future__ import annotations

import re
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.schemas.lexgen import EvidencePacket, FormBundle
from src.schemas.nlp import NormalizedLemma

# ---------------------------------------------------------------------------
# Backend root for source-grep tests.
# ---------------------------------------------------------------------------
_BACKEND_ROOT = Path(__file__).parents[3]  # learn-greek-easy-backend/
_SERVICE_FILE = _BACKEND_ROOT / "src" / "services" / "evidence_assembly_service.py"


# ---------------------------------------------------------------------------
# Deferred import — keeps the file collectable even before the module exists.
# Each test that calls _get_service_class() will get an ImportError at
# runtime (not at collection time), which pytest reports as FAILED rather
# than an ERROR, giving a clean "N failed" summary.
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


def _make_form_bundle(
    form: str = "σπίτι", case: str = "nominative", number: str = "singular"
) -> FormBundle:
    """Build a FormBundle with noun-feature keys."""
    return FormBundle(form=form, features={"case": case, "number": number})


def _make_wiktionary_entry(
    lemma: str = "σπίτι",
    gender: str = "neuter",
    pronunciation: str | None = "/ˈspiti/",
    glosses_en: str | None = "house",
) -> MagicMock:
    """Mock a WiktionaryMorphology ORM row."""
    entry = MagicMock()
    entry.lemma = lemma
    entry.gender = gender
    entry.pronunciation = pronunciation
    entry.glosses_en = glosses_en
    entry.forms = [{"form": lemma, "features": {"case": "nominative", "number": "singular"}}]
    return entry


def _make_mock_session_no_lexicon() -> MagicMock:
    """Return an AsyncSession mock that returns no GreekLexicon rows (empty existence check)."""
    result_mock = MagicMock()
    result_mock.scalar.return_value = None
    result_mock.scalars.return_value.all.return_value = []
    session = MagicMock()
    session.execute = AsyncMock(return_value=result_mock)
    return session


# ---------------------------------------------------------------------------
# Unit test class 1: normalization reuse
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestAssemblyNormalization:
    """The service normalizes lemma_input before forwarding to sub-services."""

    async def test_assembly_normalizes_lemma_before_lookup(self) -> None:
        """lemma_input='ΣΠΊΤΙ ' → after lower/NFC/unfold the mock's .lemma ('σπίτι')
        is what reaches FrequencyService.get_frequency_rank and the lexicon query,
        NOT the raw input 'ΣΠΊΤΙ '.
        """
        EvidenceAssemblyService = _get_service_class()

        normalized_result = _make_normalized(input_word="σπίτι", lemma="σπίτι", confidence=1.0)

        mock_freq_service = MagicMock()
        mock_freq_service.get_frequency_rank = AsyncMock(return_value=None)
        mock_freq_service.get_frequency_band = AsyncMock(return_value=None)

        mock_wikt_service = MagicMock()
        mock_wikt_service.get_form_bundles = AsyncMock(return_value=None)
        mock_wikt_service.get_entry = AsyncMock(return_value=None)

        session = _make_mock_session_no_lexicon()

        with (
            patch(
                "src.services.evidence_assembly_service.get_lemma_normalization_service"
            ) as mock_get_norm,
            patch(
                "src.services.evidence_assembly_service.FrequencyService",
                return_value=mock_freq_service,
            ),
            patch(
                "src.services.evidence_assembly_service.WiktionaryMorphologyService",
                return_value=mock_wikt_service,
            ),
        ):
            mock_norm_svc = MagicMock()
            mock_norm_svc.normalize = MagicMock(return_value=normalized_result)
            mock_get_norm.return_value = mock_norm_svc

            service = EvidenceAssemblyService(session)
            await service.assemble_evidence("ΣΠΊΤΙ ", pos="noun")

        # The frequency lookup received the normalized lemma (.lemma), not the raw input
        mock_freq_service.get_frequency_rank.assert_called_once()
        call_lemma = mock_freq_service.get_frequency_rank.call_args[0][0]
        assert call_lemma == "σπίτι", (
            f"FrequencyService.get_frequency_rank was called with {call_lemma!r}, "
            "expected 'σπίτι' (the mock's .lemma, not the raw input 'ΣΠΊΤΙ ')"
        )


# ---------------------------------------------------------------------------
# Unit test class 2: Wiktionary source construction
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestWiktionarySourceBuilding:
    """Wiktionary source is built correctly from WiktionaryMorphologyService output."""

    async def test_wiktionary_source_built_from_form_bundles(self) -> None:
        """When Wiktionary returns an entry + form bundles, packet.sources.wiktionary
        has present:true, gender/IPA/glosses, and forms as FormBundle dumps.
        """
        EvidenceAssemblyService = _get_service_class()

        entry = _make_wiktionary_entry(
            gender="neuter", pronunciation="/ˈspiti/", glosses_en="house"
        )
        bundles = [_make_form_bundle("σπίτι", "nominative", "singular")]

        normalized_result = _make_normalized(input_word="σπίτι", lemma="σπίτι")

        mock_wikt_service = MagicMock()
        mock_wikt_service.get_form_bundles = AsyncMock(return_value=bundles)
        mock_wikt_service.get_entry = AsyncMock(return_value=entry)

        mock_freq_service = MagicMock()
        mock_freq_service.get_frequency_rank = AsyncMock(return_value=None)
        mock_freq_service.get_frequency_band = AsyncMock(return_value=None)

        session = _make_mock_session_no_lexicon()

        with (
            patch(
                "src.services.evidence_assembly_service.get_lemma_normalization_service"
            ) as mock_get_norm,
            patch(
                "src.services.evidence_assembly_service.FrequencyService",
                return_value=mock_freq_service,
            ),
            patch(
                "src.services.evidence_assembly_service.WiktionaryMorphologyService",
                return_value=mock_wikt_service,
            ),
        ):
            mock_norm_svc = MagicMock()
            mock_norm_svc.normalize = MagicMock(return_value=normalized_result)
            mock_get_norm.return_value = mock_norm_svc

            service = EvidenceAssemblyService(session)
            packet = await service.assemble_evidence("σπίτι", pos="noun")

        wikt = packet.sources.wiktionary
        assert wikt.present is True, "wiktionary.present should be True when entry returned"
        assert hasattr(wikt, "gender"), "WiktionarySource must have 'gender' field"
        assert wikt.gender == "neuter"
        assert hasattr(wikt, "pronunciation"), "WiktionarySource must have 'pronunciation' field"
        assert wikt.pronunciation == "/ˈspiti/"
        assert hasattr(wikt, "glosses_en"), "WiktionarySource must have 'glosses_en' field"
        assert wikt.glosses_en == "house"
        assert len(wikt.forms) == 1
        assert isinstance(wikt.forms[0], FormBundle)

    async def test_wiktionary_absent_marks_present_false(self) -> None:
        """When Wiktionary returns None for both get_form_bundles and get_entry,
        packet.sources.wiktionary == {"present": false}.
        """
        EvidenceAssemblyService = _get_service_class()

        normalized_result = _make_normalized(input_word="ξκφ", lemma="ξκφ")

        mock_wikt_service = MagicMock()
        mock_wikt_service.get_form_bundles = AsyncMock(return_value=None)
        mock_wikt_service.get_entry = AsyncMock(return_value=None)

        mock_freq_service = MagicMock()
        mock_freq_service.get_frequency_rank = AsyncMock(return_value=None)
        mock_freq_service.get_frequency_band = AsyncMock(return_value=None)

        session = _make_mock_session_no_lexicon()

        with (
            patch(
                "src.services.evidence_assembly_service.get_lemma_normalization_service"
            ) as mock_get_norm,
            patch(
                "src.services.evidence_assembly_service.FrequencyService",
                return_value=mock_freq_service,
            ),
            patch(
                "src.services.evidence_assembly_service.WiktionaryMorphologyService",
                return_value=mock_wikt_service,
            ),
        ):
            mock_norm_svc = MagicMock()
            mock_norm_svc.normalize = MagicMock(return_value=normalized_result)
            mock_get_norm.return_value = mock_norm_svc

            service = EvidenceAssemblyService(session)
            packet = await service.assemble_evidence("ξκφ", pos="noun")

        wikt = packet.sources.wiktionary
        assert wikt.present is False, "wiktionary.present must be False when no entry returned"
        assert len(wikt.forms) == 0, "absent wiktionary should have no forms"


# ---------------------------------------------------------------------------
# Unit test class 3: POS casing
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestPOSCasing:
    """POS is forwarded verbatim (lowercase) to Wiktionary; .upper() to GreekLexicon."""

    async def test_lexicon_query_uppercases_pos(self) -> None:
        """assemble_evidence pos="noun" → Wiktionary call received pos="noun",
        lexicon SQL statement contains "NOUN" (uppercase).
        """
        EvidenceAssemblyService = _get_service_class()

        normalized_result = _make_normalized(input_word="σπίτι", lemma="σπίτι")

        wikt_call_args: list[dict] = []

        async def _wikt_get_bundles(lemma: str, pos: str = "noun", gender: str | None = None):
            wikt_call_args.append({"pos": pos})
            return None

        async def _wikt_get_entry(lemma: str, pos: str = "noun", gender: str | None = None):
            return None

        mock_wikt_service = MagicMock()
        mock_wikt_service.get_form_bundles = _wikt_get_bundles
        mock_wikt_service.get_entry = _wikt_get_entry

        mock_freq_service = MagicMock()
        mock_freq_service.get_frequency_rank = AsyncMock(return_value=None)
        mock_freq_service.get_frequency_band = AsyncMock(return_value=None)

        # Capture SQL statements to verify pos is uppercased for lexicon query
        executed_statements: list[str] = []

        async def _fake_execute(stmt, *args, **kwargs):
            try:
                compiled = stmt.compile(compile_kwargs={"literal_binds": True})
                executed_statements.append(str(compiled))
            except Exception:
                executed_statements.append(str(stmt))
            result_mock = MagicMock()
            result_mock.scalar.return_value = None
            result_mock.scalars.return_value.all.return_value = []
            return result_mock

        session = MagicMock()
        session.execute = AsyncMock(side_effect=_fake_execute)

        with (
            patch(
                "src.services.evidence_assembly_service.get_lemma_normalization_service"
            ) as mock_get_norm,
            patch(
                "src.services.evidence_assembly_service.FrequencyService",
                return_value=mock_freq_service,
            ),
            patch(
                "src.services.evidence_assembly_service.WiktionaryMorphologyService",
                return_value=mock_wikt_service,
            ),
        ):
            mock_norm_svc = MagicMock()
            mock_norm_svc.normalize = MagicMock(return_value=normalized_result)
            mock_get_norm.return_value = mock_norm_svc

            service = EvidenceAssemblyService(session)
            await service.assemble_evidence("σπίτι", pos="noun")

        # Wiktionary received lowercase pos
        assert wikt_call_args, "WiktionaryMorphologyService.get_form_bundles was never called"
        assert (
            wikt_call_args[0]["pos"] == "noun"
        ), f"Wiktionary call received pos={wikt_call_args[0]['pos']!r}, expected 'noun' (lowercase)"
        # Lexicon SQL contained uppercase NOUN
        all_sql = " ".join(executed_statements)
        assert (
            "NOUN" in all_sql
        ), f"GreekLexicon query did not contain 'NOUN' (uppercase). SQL captured: {all_sql!r}"


# ---------------------------------------------------------------------------
# Unit test class 4: Frequency source construction
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestFrequencySourceBuilding:
    """Frequency source is built correctly from FrequencyService output."""

    async def test_frequency_source_built_from_rank(self) -> None:
        """FrequencyService stub rank 1234 → packet.sources.frequency is
        {present:true, rank:1234, band:"common"}.
        """
        EvidenceAssemblyService = _get_service_class()

        normalized_result = _make_normalized(input_word="σπίτι", lemma="σπίτι")

        mock_freq_service = MagicMock()
        mock_freq_service.get_frequency_rank = AsyncMock(return_value=1234)
        mock_freq_service.get_frequency_band = AsyncMock(return_value="common")

        mock_wikt_service = MagicMock()
        mock_wikt_service.get_form_bundles = AsyncMock(return_value=None)
        mock_wikt_service.get_entry = AsyncMock(return_value=None)

        session = _make_mock_session_no_lexicon()

        with (
            patch(
                "src.services.evidence_assembly_service.get_lemma_normalization_service"
            ) as mock_get_norm,
            patch(
                "src.services.evidence_assembly_service.FrequencyService",
                return_value=mock_freq_service,
            ),
            patch(
                "src.services.evidence_assembly_service.WiktionaryMorphologyService",
                return_value=mock_wikt_service,
            ),
        ):
            mock_norm_svc = MagicMock()
            mock_norm_svc.normalize = MagicMock(return_value=normalized_result)
            mock_get_norm.return_value = mock_norm_svc

            service = EvidenceAssemblyService(session)
            packet = await service.assemble_evidence("σπίτι", pos="noun")

        freq = packet.sources.frequency
        assert freq.present is True, "frequency.present must be True when rank returned"
        assert freq.rank == 1234
        assert freq.band == "common"


# ---------------------------------------------------------------------------
# Unit test class 5: Lexicon attestation SQL shape
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestLexiconAttestationSQL:
    """The GreekLexicon existence query covers BOTH lemma and form columns (OR)."""

    async def test_lexicon_existence_query_matches_lemma_or_form(self) -> None:
        """The compiled SQL WHERE clause references both greek_lexicon.lemma and
        greek_lexicon.form (OR existence check).
        """
        EvidenceAssemblyService = _get_service_class()

        normalized_result = _make_normalized(input_word="σπίτι", lemma="σπίτι")

        mock_wikt_service = MagicMock()
        mock_wikt_service.get_form_bundles = AsyncMock(return_value=None)
        mock_wikt_service.get_entry = AsyncMock(return_value=None)

        mock_freq_service = MagicMock()
        mock_freq_service.get_frequency_rank = AsyncMock(return_value=None)
        mock_freq_service.get_frequency_band = AsyncMock(return_value=None)

        executed_statements: list[str] = []

        async def _capture_execute(stmt, *args, **kwargs):
            try:
                compiled = stmt.compile(compile_kwargs={"literal_binds": True})
                executed_statements.append(str(compiled))
            except Exception:
                executed_statements.append(str(stmt))
            result_mock = MagicMock()
            result_mock.scalar.return_value = None
            result_mock.scalars.return_value.all.return_value = []
            return result_mock

        session = MagicMock()
        session.execute = AsyncMock(side_effect=_capture_execute)

        with (
            patch(
                "src.services.evidence_assembly_service.get_lemma_normalization_service"
            ) as mock_get_norm,
            patch(
                "src.services.evidence_assembly_service.FrequencyService",
                return_value=mock_freq_service,
            ),
            patch(
                "src.services.evidence_assembly_service.WiktionaryMorphologyService",
                return_value=mock_wikt_service,
            ),
        ):
            mock_norm_svc = MagicMock()
            mock_norm_svc.normalize = MagicMock(return_value=normalized_result)
            mock_get_norm.return_value = mock_norm_svc

            service = EvidenceAssemblyService(session)
            await service.assemble_evidence("σπίτι", pos="noun")

        assert (
            executed_statements
        ), "No SQL statements were captured — service did not query the session"
        all_sql = " ".join(executed_statements).lower()
        assert (
            "lemma" in all_sql
        ), f"GreekLexicon query has no 'lemma' column reference. SQL: {all_sql!r}"
        assert (
            "form" in all_sql
        ), f"GreekLexicon query has no 'form' column reference. SQL: {all_sql!r}"


# ---------------------------------------------------------------------------
# Unit test class 6: _lemma_exists gate logic
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestLemmaExistsGate:
    """_lemma_exists(packet) returns True iff any source is present (D-FREQONLY)."""

    def _build_packet(
        self,
        wikt_present: bool = False,
        lexicon_present: bool = False,
        freq_present: bool = False,
    ) -> EvidencePacket:
        """Build a minimal EvidencePacket for gate-logic tests.

        This helper is deliberately written to work against the CURRENT (06-01)
        schema, so that the gate-logic tests fail only due to the missing
        EvidenceAssemblyService._lemma_exists, not due to schema shape errors.
        If 06-02 extends WiktionarySource/GreekLexiconSource with more fields,
        those fields are passed as kwargs (forward-compatible).
        """
        from src.schemas.lexgen import (
            EvidencePacketSources,
            FrequencySource,
            GreekLexiconSource,
            RulesSource,
            WiktionarySource,
        )

        wikt_extra: dict = {}
        lexicon_extra: dict = {}

        # If the executor has already extended these schemas, pass the extra fields.
        # If not (still 06-01 minimal shape), the kwargs are ignored gracefully
        # because Pydantic model_validate with extra="ignore" is the project default.
        # Either way, present: True/False is the tested property.
        try:
            # Try the extended fields — will succeed once 06-02 implements them
            if wikt_present:
                wikt_extra = {"gender": None, "pronunciation": None, "glosses_en": None}
            if lexicon_present:
                lexicon_extra = {
                    "attested_lemma": True,
                    "attested_surface_form": False,
                    "resolved_lemma": "σπίτι",
                }
            else:
                lexicon_extra = {"attested_lemma": False, "attested_surface_form": False}
        except Exception:
            pass

        return EvidencePacket(
            lemma_input="σπίτι",
            normalized_lemma="σπίτι",
            pos="noun",
            sources=EvidencePacketSources(
                wiktionary=WiktionarySource(present=wikt_present, **wikt_extra),
                greek_lexicon=GreekLexiconSource(present=lexicon_present, **lexicon_extra),
                frequency=FrequencySource(
                    present=freq_present,
                    rank=1234 if freq_present else None,
                    band="common" if freq_present else None,
                ),
                rules=RulesSource(present=False),
            ),
        )

    def test_lemma_exists_true_when_only_frequency_present(self) -> None:
        """Frequency rank present alone → _lemma_exists True (D-FREQONLY)."""
        EvidenceAssemblyService = _get_service_class()
        packet = self._build_packet(wikt_present=False, lexicon_present=False, freq_present=True)
        result = EvidenceAssemblyService._lemma_exists(packet)
        assert result is True, "_lemma_exists must be True when only frequency source is present"

    def test_lemma_exists_false_when_all_absent(self) -> None:
        """All three sources absent → _lemma_exists False."""
        EvidenceAssemblyService = _get_service_class()
        packet = self._build_packet(wikt_present=False, lexicon_present=False, freq_present=False)
        result = EvidenceAssemblyService._lemma_exists(packet)
        assert result is False, "_lemma_exists must be False when no source is present"

    def test_lemma_exists_true_when_only_lexicon_attested(self) -> None:
        """GreekLexicon attested, Wiktionary absent, frequency absent → _lemma_exists True."""
        EvidenceAssemblyService = _get_service_class()
        packet = self._build_packet(wikt_present=False, lexicon_present=True, freq_present=False)
        result = EvidenceAssemblyService._lemma_exists(packet)
        assert result is True, "_lemma_exists must be True when only lexicon source is present"


# ---------------------------------------------------------------------------
# Unit test class 7: no-LLM source guard
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestNoLLMGuard:
    """The service module must not import any LLM/OpenRouter client."""

    def test_assembly_module_imports_no_llm_client(self) -> None:
        """Read evidence_assembly_service.py source text — assert it contains no
        LLM/OpenRouter client import. Mirrors test_supply_chain.py:28 static-source-grep
        approach (NOT a runtime sys.modules check, which can give false positives).
        """
        if not _SERVICE_FILE.exists():
            pytest.fail(
                f"evidence_assembly_service.py not found at {_SERVICE_FILE} — "
                "module not yet implemented (expected RED failure reason)."
            )

        source = _SERVICE_FILE.read_text(encoding="utf-8")

        _LLM_PATTERNS = re.compile(
            r"\bopenrouter\b"
            r"|\bopenai\b"
            r"|\bOpenRouterService\b"
            r"|\bOpenAIService\b"
            r"|\banthropic\b"
            r"|\bllm_client\b",
            re.IGNORECASE,
        )

        if _LLM_PATTERNS.search(source):
            pytest.fail(
                "evidence_assembly_service.py contains an LLM/OpenRouter client import — "
                "Stage 1 is retrieval-only (LEXGEN-09 is the generator)."
            )
