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


# ---------------------------------------------------------------------------
# Adversarial / edge-coverage tests (Mode B — QA LEXGEN-06-02)
# ---------------------------------------------------------------------------


def _make_full_mock_setup(
    normalized_lemma: str = "σπίτι",
    wikt_bundles=None,
    wikt_entry=None,
    freq_rank=None,
    freq_band=None,
    session=None,
):
    """Helper to build a typical full-mock patch set, returning (patches, session).

    Returns a tuple: (context_manager_list_for_ExitStack, mock_session, normalized_result).
    Caller uses contextlib.ExitStack to enter all patches.
    """
    from contextlib import ExitStack

    normalized_result = _make_normalized(input_word=normalized_lemma, lemma=normalized_lemma)

    mock_wikt_service = MagicMock()
    mock_wikt_service.get_form_bundles = AsyncMock(return_value=wikt_bundles)
    mock_wikt_service.get_entry = AsyncMock(return_value=wikt_entry)

    mock_freq_service = MagicMock()
    mock_freq_service.get_frequency_rank = AsyncMock(return_value=freq_rank)
    mock_freq_service.get_frequency_band = AsyncMock(return_value=freq_band)

    if session is None:
        session = _make_mock_session_no_lexicon()

    stack = ExitStack()
    mock_get_norm = stack.enter_context(
        patch("src.services.evidence_assembly_service.get_lemma_normalization_service")
    )
    mock_norm_svc = MagicMock()
    mock_norm_svc.normalize = MagicMock(return_value=normalized_result)
    mock_get_norm.return_value = mock_norm_svc

    stack.enter_context(
        patch(
            "src.services.evidence_assembly_service.FrequencyService",
            return_value=mock_freq_service,
        )
    )
    stack.enter_context(
        patch(
            "src.services.evidence_assembly_service.WiktionaryMorphologyService",
            return_value=mock_wikt_service,
        )
    )

    return stack, session, normalized_result, mock_wikt_service, mock_freq_service


@pytest.mark.unit
class TestLemmaExistsGateAdversarial:
    """Adversarial coverage for _lemma_exists gate (completes the truth table)."""

    def _build_packet(
        self,
        wikt_present: bool = False,
        lexicon_present: bool = False,
        freq_present: bool = False,
    ):
        """Build a minimal EvidencePacket for gate-logic testing."""
        from src.schemas.lexgen import (
            EvidencePacket,
            EvidencePacketSources,
            FrequencySource,
            GreekLexiconSource,
            RulesSource,
            WiktionarySource,
        )

        wikt_extra = (
            {"gender": None, "pronunciation": None, "glosses_en": None} if wikt_present else {}
        )
        lexicon_extra = (
            {
                "attested_lemma": True,
                "attested_surface_form": False,
                "resolved_lemma": "σπίτι",
            }
            if lexicon_present
            else {"attested_lemma": False, "attested_surface_form": False}
        )

        return EvidencePacket(
            lemma_input="σπίτι",
            normalized_lemma="σπίτι",
            pos="noun",
            sources=EvidencePacketSources(
                wiktionary=WiktionarySource(present=wikt_present, **wikt_extra),
                greek_lexicon=GreekLexiconSource(present=lexicon_present, **lexicon_extra),
                frequency=FrequencySource(
                    present=freq_present,
                    rank=42 if freq_present else None,
                    band="common" if freq_present else None,
                ),
                rules=RulesSource(present=False),
            ),
        )

    def test_lemma_exists_true_when_only_wiktionary_present(self) -> None:
        """Wiktionary present, lexicon absent, frequency absent → _lemma_exists True.

        This is the third single-source case not covered by the AC tests:
        AC tests covered frequency-only (AC-8a) and lexicon-only (AC-8c) but
        NOT Wiktionary-only. All three must be True for the OR to be correct.
        """
        EvidenceAssemblyService = _get_service_class()
        packet = self._build_packet(wikt_present=True, lexicon_present=False, freq_present=False)
        result = EvidenceAssemblyService._lemma_exists(packet)
        assert result is True, (
            "_lemma_exists must return True when only Wiktionary is present; "
            "if this fails the OR short-circuit is wrong."
        )

    def test_lemma_exists_false_even_if_rules_present(self) -> None:
        """rules.present=True must NOT affect _lemma_exists — rules is always the D-RULESSTUB.

        _lemma_exists checks only (wiktionary OR greek_lexicon OR frequency).
        A future executor that accidentally ORs in rules.present would break
        the never-invent gate.
        """
        from src.schemas.lexgen import (
            EvidencePacket,
            EvidencePacketSources,
            FrequencySource,
            GreekLexiconSource,
            RulesSource,
            WiktionarySource,
        )

        EvidenceAssemblyService = _get_service_class()

        # rules present=True (stub override), all real sources absent
        packet = EvidencePacket(
            lemma_input="σπίτι",
            normalized_lemma="σπίτι",
            pos="noun",
            sources=EvidencePacketSources(
                wiktionary=WiktionarySource(present=False),
                greek_lexicon=GreekLexiconSource(
                    present=False,
                    attested_lemma=False,
                    attested_surface_form=False,
                ),
                frequency=FrequencySource(present=False),
                rules=RulesSource(present=True),  # stub active — should NOT flip gate
            ),
        )
        result = EvidenceAssemblyService._lemma_exists(packet)
        assert result is False, (
            "_lemma_exists must be False when wiktionary/lexicon/frequency are all absent, "
            "even if rules.present=True. The gate must NOT include the rules stub."
        )

    def test_lemma_exists_true_wiktionary_present_empty_forms(self) -> None:
        """Wiktionary present=True with forms=[] still satisfies _lemma_exists.

        The gate checks the .present flag, NOT whether .forms is non-empty.
        A lemma can be attested (page found) yet carry no inflected forms —
        presence and form richness are separate facts.
        """
        from src.schemas.lexgen import (
            EvidencePacket,
            EvidencePacketSources,
            FrequencySource,
            GreekLexiconSource,
            RulesSource,
            WiktionarySource,
        )

        EvidenceAssemblyService = _get_service_class()

        packet = EvidencePacket(
            lemma_input="σπίτι",
            normalized_lemma="σπίτι",
            pos="noun",
            sources=EvidencePacketSources(
                wiktionary=WiktionarySource(present=True, forms=[]),  # present but no forms
                greek_lexicon=GreekLexiconSource(
                    present=False,
                    attested_lemma=False,
                    attested_surface_form=False,
                ),
                frequency=FrequencySource(present=False),
                rules=RulesSource(present=False),
            ),
        )
        result = EvidenceAssemblyService._lemma_exists(packet)
        assert result is True, (
            "_lemma_exists must be True when wiktionary.present=True even if forms=[]. "
            "The gate pins presence, not form richness."
        )


@pytest.mark.unit
@pytest.mark.asyncio
class TestNormalizationAdversarial:
    """Adversarial coverage: lemma_input needing final-sigma unfold + NFC normalization."""

    async def test_final_sigma_in_lemma_input_is_unfolded_before_lookup(self) -> None:
        """lemma_input ending in 'σ' (medial sigma) → service unfolds it to 'ς' before lookup.

        The wordfreq corpus folds final ς→σ. A consumer passing the raw wordfreq
        token to assemble_evidence must get the correctly unfolded lemma forwarded
        to all sub-services (not the folded 'σ' ending).

        This exercises the _final_sigma_unfold step in the D-NORM pipeline,
        which is a substantive fixup: without it, lookups would silently miss
        words whose dictionary forms end in 'ς'.

        We assert the FrequencyService gets the unfolded lemma (not the folded one),
        using a mock normalization service that returns the lemma as-is (no further
        transformation), so the only transformation that could produce 'ς' in the
        FrequencyService call is the unfold step itself.
        """
        EvidenceAssemblyService = _get_service_class()

        # The mock normalize() returns the pre-normalized string as-is
        # (simulates the normalizer being identity for already-clean input).
        # The D-NORM pipeline is: lower→NFC→unfold→normalize().
        # For "ανθρωπoσ" (ends in medial σ): after lower+NFC+unfold → "ανθρωπος"
        folded_input = "ΑΝΘΡΩΠΟσ"  # uppercase + final medial σ (as wordfreq may emit)
        expected_after_unfold = "ανθρωπος"  # lowercased + NFC + final σ → ς

        # Mock normalization returns the already-pre-normalized string as the lemma
        normalized_result = _make_normalized(
            input_word=expected_after_unfold, lemma=expected_after_unfold
        )

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
            packet = await service.assemble_evidence(folded_input, pos="noun")

        # The normalization service was called — what did it receive?
        # The pre-normalized string passed to normalize() should have 'ς', not 'σ'.
        normalize_call_arg = mock_norm_svc.normalize.call_args[0][0]
        assert normalize_call_arg.endswith("ς"), (
            f"normalize() must receive the unfolded form ending in 'ς' (final sigma), "
            f"but got {normalize_call_arg!r} (ends in {normalize_call_arg[-1]!r}). "
            "The _final_sigma_unfold step in D-NORM is not firing before normalize()."
        )

        # The packet should carry the correctly normalized lemma
        assert packet.normalized_lemma == expected_after_unfold, (
            f"packet.normalized_lemma must be {expected_after_unfold!r} after unfold+normalize, "
            f"got {packet.normalized_lemma!r}"
        )

    async def test_lemma_input_already_correct_sigma_passes_through(self) -> None:
        """lemma_input already ending in 'ς' (final sigma) is unchanged after unfold step.

        _final_sigma_unfold only touches trailing 'σ'. An already-correct 'ς'
        must survive the pipeline intact — the function must not double-unfold.
        """
        EvidenceAssemblyService = _get_service_class()

        # Use an input that already ends in final sigma ς (correct form).
        correct_input_with_final_sigma = "άνθρωπος"  # ends in ς

        normalized_result = _make_normalized(input_word="άνθρωπος", lemma="άνθρωπος")

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
            # Should not raise and should pass 'ς' through to normalize()
            await service.assemble_evidence(correct_input_with_final_sigma, pos="noun")

        # normalize() received the lowercased+NFC form — must still end in ς
        normalize_call_arg = mock_norm_svc.normalize.call_args[0][0]
        assert normalize_call_arg.endswith("ς"), (
            f"normalize() must receive form ending in 'ς' for input already ending in ς; "
            f"got {normalize_call_arg!r}"
        )


@pytest.mark.unit
@pytest.mark.asyncio
class TestPOSCasingAdversarial:
    """POS casing for non-noun POS (e.g. 'verb' → 'VERB' for lexicon, 'verb' for Wiktionary)."""

    async def test_verb_pos_forwarded_lowercase_to_wiktionary_and_uppercase_to_lexicon(
        self,
    ) -> None:
        """pos='verb' → Wiktionary gets 'verb' (lowercase), lexicon SQL gets 'VERB' (uppercase).

        The unit AC test only tested pos='noun'. This pins the same contract for
        a different POS to confirm the casing is a general transform, not a
        hardcoded 'noun'/'NOUN' string.
        """
        EvidenceAssemblyService = _get_service_class()

        normalized_result = _make_normalized(input_word="γράφω", lemma="γράφω")

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
            await service.assemble_evidence("γράφω", pos="verb")

        # Wiktionary received lowercase pos='verb'
        assert wikt_call_args, "WiktionaryMorphologyService.get_form_bundles was not called"
        assert (
            wikt_call_args[0]["pos"] == "verb"
        ), f"Wiktionary must get lowercase 'verb', not {wikt_call_args[0]['pos']!r}"

        # Lexicon SQL contained uppercase 'VERB'
        all_sql = " ".join(executed_statements)
        assert "VERB" in all_sql, (
            f"GreekLexicon query must contain 'VERB' (uppercase) for pos='verb'. "
            f"SQL captured: {all_sql!r}"
        )
        # Double-check: 'verb' (lowercase) must NOT appear as a separate SQL token
        # (it can appear as a substring of VERB, so we check for the uppercase form
        # appearing in the WHERE clause context)
        assert (
            "NOUN" not in all_sql
        ), "GreekLexicon query must NOT contain 'NOUN' when pos='verb' was requested"


@pytest.mark.unit
@pytest.mark.asyncio
class TestGreekLexiconFormsMappingUnit:
    """Unit-level coverage of the GreekLexicon DB→FormBundle feature-value mapping."""

    async def test_lexicon_row_maps_gen_plur_to_correct_feature_values(self) -> None:
        """A GreekLexicon ORM row with ptosi='Gen', number='Plur' maps to
        FormBundle features {'case': 'genitive', 'number': 'plural'}.

        This pins the _PTOSI_MAP / _NUMBER_MAP reverse-value mapping correctness
        without needing a real DB. We mock the LexiconService to return a
        synthetic LexiconEntry with known ptosi/number values.

        AC-4 (F2) and AC-5 (F3) are about higher-level behaviour; this test
        focuses on the MAPPING FUNCTION correctness at the per-row level.
        """
        from src.services.lexicon_service import LexiconEntry

        EvidenceAssemblyService = _get_service_class()

        normalized_result = _make_normalized(input_word="σπίτι", lemma="σπίτι")

        # Mock the existence query to return a row (lemma hit)
        mock_row = MagicMock()
        mock_row.lemma = "σπίτι"
        mock_row.form = "σπίτι"
        mock_row.pos = "NOUN"

        result_mock = MagicMock()
        result_mock.scalar.return_value = mock_row
        result_mock.scalars.return_value.all.return_value = []

        call_count = 0

        async def _fake_execute(stmt, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First call: existence query — return the mock row
                rm = MagicMock()
                rm.scalar.return_value = mock_row
                return rm
            # Subsequent calls: LexiconService.get_declensions query — return one row
            rm = MagicMock()
            rm.scalar.return_value = None
            rm.scalars.return_value.all.return_value = []
            return rm

        session = MagicMock()
        session.execute = AsyncMock(side_effect=_fake_execute)

        mock_wikt_service = MagicMock()
        mock_wikt_service.get_form_bundles = AsyncMock(return_value=None)
        mock_wikt_service.get_entry = AsyncMock(return_value=None)

        mock_freq_service = MagicMock()
        mock_freq_service.get_frequency_rank = AsyncMock(return_value=None)
        mock_freq_service.get_frequency_band = AsyncMock(return_value=None)

        # Override LexiconService.get_declensions to return a synthetic LexiconEntry
        # with ptosi='Gen', number='Plur', gender='Neut'
        synthetic_entry = LexiconEntry(
            form="σπιτιών",
            lemma="σπίτι",
            pos="NOUN",
            gender="Neut",
            ptosi="Gen",
            number="Plur",
        )

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
            patch(
                "src.services.evidence_assembly_service.LexiconService"
            ) as mock_lexicon_service_cls,
        ):
            mock_norm_svc = MagicMock()
            mock_norm_svc.normalize = MagicMock(return_value=normalized_result)
            mock_get_norm.return_value = mock_norm_svc

            mock_lexicon_instance = MagicMock()
            mock_lexicon_instance.get_declensions = AsyncMock(return_value=[synthetic_entry])
            mock_lexicon_service_cls.return_value = mock_lexicon_instance

            service = EvidenceAssemblyService(session)
            packet = await service.assemble_evidence("σπίτι", pos="noun")

        gl = packet.sources.greek_lexicon
        assert gl.present is True
        assert len(gl.forms) == 1, f"Expected 1 FormBundle, got {len(gl.forms)}"

        fb = gl.forms[0]
        assert fb.form == "σπιτιών", f"Expected form 'σπιτιών', got {fb.form!r}"

        # The mapping must convert ptosi='Gen' → 'genitive', number='Plur' → 'plural',
        # gender='Neut' → 'neuter'
        assert (
            fb.features.get("case") == "genitive"
        ), f"ptosi='Gen' must map to 'genitive', got {fb.features.get('case')!r}"
        assert (
            fb.features.get("number") == "plural"
        ), f"number='Plur' must map to 'plural', got {fb.features.get('number')!r}"
        assert (
            fb.features.get("gender") == "neuter"
        ), f"gender='Neut' must map to 'neuter', got {fb.features.get('gender')!r}"

    async def test_lexicon_row_with_unrecognized_ptosi_skips_case_key(self) -> None:
        """A LexiconEntry with ptosi='Dat' (not in _PTOSI_MAP) must have no 'case' key.

        The mapping is strict: unknown ptosi values are skipped, not forwarded as-is.
        If the FormBundle ends up with zero recognised keys AND no form, it should be
        dropped (None from _row_to_form_bundle). But if form is present and at least
        one key maps, it's retained. This test pins that an unmapped ptosi is SILENTLY
        DROPPED — the 'case' key does not appear in features.

        Edge case: 'Dat' (dative) exists in Modern Greek verb conjugation data
        but is NOT a current GreekLexicon value. An accidental INSERT of such a
        row must not corrupt FormBundle.features with an unknown key.
        """
        from src.schemas.lexgen import FEATURE_KEYS
        from src.services.lexicon_service import LexiconEntry

        EvidenceAssemblyService = _get_service_class()

        normalized_result = _make_normalized(input_word="σπίτι", lemma="σπίτι")

        mock_row = MagicMock()
        mock_row.lemma = "σπίτι"
        mock_row.form = "σπίτι"
        mock_row.pos = "NOUN"

        # Synthetic entry with unmapped ptosi
        bad_entry = LexiconEntry(
            form="σπίτι",
            lemma="σπίτι",
            pos="NOUN",
            gender="Neut",
            ptosi="Dat",  # NOT in _PTOSI_MAP
            number="Sing",  # this IS in _NUMBER_MAP
        )

        session = MagicMock()

        async def _fake_execute(stmt, *args, **kwargs):
            rm = MagicMock()
            rm.scalar.return_value = mock_row
            return rm

        session.execute = AsyncMock(side_effect=_fake_execute)

        mock_wikt_service = MagicMock()
        mock_wikt_service.get_form_bundles = AsyncMock(return_value=None)
        mock_wikt_service.get_entry = AsyncMock(return_value=None)

        mock_freq_service = MagicMock()
        mock_freq_service.get_frequency_rank = AsyncMock(return_value=None)
        mock_freq_service.get_frequency_band = AsyncMock(return_value=None)

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
            patch(
                "src.services.evidence_assembly_service.LexiconService"
            ) as mock_lexicon_service_cls,
        ):
            mock_norm_svc = MagicMock()
            mock_norm_svc.normalize = MagicMock(return_value=normalized_result)
            mock_get_norm.return_value = mock_norm_svc

            mock_lexicon_instance = MagicMock()
            mock_lexicon_instance.get_declensions = AsyncMock(return_value=[bad_entry])
            mock_lexicon_service_cls.return_value = mock_lexicon_instance

            service = EvidenceAssemblyService(session)
            packet = await service.assemble_evidence("σπίτι", pos="noun")

        gl = packet.sources.greek_lexicon
        # With ptosi='Dat' (unmapped) but number='Sing' (mapped), features has at
        # least 'number' — the bundle is retained (form is non-empty).
        for bundle in gl.forms:
            unknown_keys = set(bundle.features.keys()) - FEATURE_KEYS
            assert not unknown_keys, (
                f"FormBundle.features must only contain FEATURE_KEYS keys; "
                f"got unknown: {unknown_keys}"
            )
            # 'case' must NOT be present since ptosi='Dat' is not in _PTOSI_MAP
            assert "case" not in bundle.features, (
                f"'case' key must be absent for unmapped ptosi='Dat'; "
                f"got features: {bundle.features}"
            )


@pytest.mark.unit
@pytest.mark.asyncio
class TestWiktionaryCommonGenderUnit:
    """Unit-level coverage for the common-gender multi-row probe path (F3)."""

    async def test_single_gender_via_fallback_path_treated_as_single_gender(self) -> None:
        """When get_form_bundles returns None but per-gender probe finds exactly ONE hit,
        the service must return present=True with gender populated (NOT genders).

        This is the unusual single-gender case where get_form_bundles() returned None
        (because the entry was malformed or the gender filter was needed) but the
        per-gender probe succeeded for exactly one gender. This case is distinct from
        the common-gender (multi-row) case.

        Implementation path: service._assemble_wiktionary → bundles=None →
        per-gender probe → len(per_gender_hits)==1 → single-gender branch.
        """
        EvidenceAssemblyService = _get_service_class()

        normalized_result = _make_normalized(input_word="σπίτι", lemma="σπίτι")

        mock_entry = _make_wiktionary_entry(lemma="σπίτι", gender="neuter")
        single_form = _make_form_bundle("σπίτι", "nominative", "singular")

        # get_form_bundles(lemma, pos) (no gender) → None (triggers fallback probe)
        # get_form_bundles(lemma, pos, gender="neuter") → [single_form]
        # get_form_bundles(lemma, pos, gender="masculine/feminine") → None
        # get_entry(lemma, pos) → None (no gender arg — multi-row trigger)
        # get_entry(lemma, pos, gender="neuter") → mock_entry
        # get_entry(lemma, pos, gender="masculine/feminine") → None

        async def _get_bundles(lemma, pos="noun", gender=None):
            if gender == "neuter":
                return [single_form]
            return None

        async def _get_entry(lemma, pos="noun", gender=None):
            if gender == "neuter":
                return mock_entry
            return None

        mock_wikt_service = MagicMock()
        mock_wikt_service.get_form_bundles = _get_bundles
        mock_wikt_service.get_entry = _get_entry

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
        assert wikt.present is True, "present must be True when per-gender probe found one hit"
        assert (
            wikt.gender == "neuter"
        ), f"single-gender fallback must set gender='neuter', got {wikt.gender!r}"
        assert wikt.genders is None, (
            f"genders must be None for single-gender fallback path (not multi-row), "
            f"got {wikt.genders!r}"
        )
        assert len(wikt.forms) >= 1, "forms must be populated from the single-gender hit"
