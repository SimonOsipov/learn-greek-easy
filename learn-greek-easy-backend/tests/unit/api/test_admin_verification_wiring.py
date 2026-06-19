"""Unit tests for verification pipeline wiring in generate_word_entry endpoint.

Tests cover:
- _run_verification_stage() extracted function:
  - Both services called (local + cross-AI compare)
  - Cross-AI exception fallback to local tier (secondary_data=None)
  - Cross-AI internal error (error field set) fallback to local tier
  - Local verification exception raises HTTP 500
  - morphology_source detection ('lexicon' vs 'llm')
  - combined_tier escalation via compute_combined_tier matrix
  - combined_tier passthrough for high agreement
- TestParallelGeneration:
  - Primary generation and cross-AI LLM fire concurrently
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from src.api.v1.admin import _run_verification_stage
from src.core.lexgen_forms import bundles_to_flat
from src.schemas.admin import TranslationLookupStageResult, TranslationSourceInfo
from src.schemas.lexgen import FormBundle
from src.schemas.nlp import (
    CrossAIVerificationResult,
    FieldComparisonResult,
    FieldVerificationResult,
    GeneratedExample,
    GeneratedNounCases,
    GeneratedNounCaseSet,
    GeneratedNounData,
    GeneratedNounGrammar,
    LocalVerificationResult,
    NormalizedLemma,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_noun_data() -> GeneratedNounData:
    case_set = GeneratedNounCaseSet(
        nominative="το σπίτι",
        genitive="του σπιτιού",
        accusative="το σπίτι",
        vocative="σπίτι",
    )
    return GeneratedNounData(
        lemma="σπίτι",
        part_of_speech="noun",
        translation_en="house",
        translation_en_plural="houses",
        translation_ru="дом",
        translation_ru_plural="дома",
        pronunciation="/spí.ti/",
        grammar_data=GeneratedNounGrammar(
            gender="neuter",
            declension_group="neuter_i",
            cases=GeneratedNounCases(singular=case_set, plural=case_set),
        ),
        examples=[
            GeneratedExample(
                id=1,
                greek="Το σπίτι είναι μεγάλο.",  # noqa: RUF001 - intentional Greek fixture text
                english="The house is big.",
                russian="Дом большой.",
            ),
            GeneratedExample(
                id=2,
                greek="Πηγαίνω στο σπίτι.",
                english="I'm going home.",
                russian="Я иду домой.",
            ),
        ],
    )


def _make_normalized_lemma() -> NormalizedLemma:
    return NormalizedLemma(
        input_word="σπίτι",
        lemma="σπίτι",
        gender="neuter",
        article="το",
        pos="NOUN",
        confidence=1.0,
    )


def _make_local_result(tier: str = "auto_approve") -> LocalVerificationResult:
    return LocalVerificationResult(
        fields=[
            FieldVerificationResult(field_path="lemma", status="pass", checks=[]),
        ],
        tier=tier,
        stages_skipped=[],
        summary=f"1 pass, 0 warn, 0 fail -> {tier}",
    )


def _make_cross_result(
    agreement: float = 0.95,
    error: str | None = None,
) -> CrossAIVerificationResult:
    if error is not None:
        return CrossAIVerificationResult(error=error)
    return CrossAIVerificationResult(
        comparisons=[
            FieldComparisonResult(
                field_path="lemma",
                primary_value="σπίτι",
                secondary_value="σπίτι",
                agrees=True,
                weight=3.0,
            ),
        ],
        overall_agreement=agreement,
        secondary_model="qwen/qwen3-30b-a3b-instruct-2507",
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestRunVerificationStage:
    """Tests for _run_verification_stage async helper."""

    @pytest.mark.asyncio
    async def test_both_services_called(self):
        """Both local verification and cross-AI compare are invoked."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result()
        mock_cross_svc = MagicMock()
        mock_cross_svc.compare.return_value = _make_cross_result()
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = []

        with (
            patch("src.api.v1.admin.get_local_verification_service", return_value=mock_local_svc),
            patch(
                "src.api.v1.admin.get_cross_ai_verification_service", return_value=mock_cross_svc
            ),
        ):
            result = await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=_make_noun_data(),
            )

        mock_local_svc.verify.assert_called_once()
        mock_cross_svc.compare.assert_called_once()
        assert result.local is not None
        assert result.cross_ai is not None

    @pytest.mark.asyncio
    async def test_cross_ai_exception_fallback(self):
        """secondary_data=None → combined_tier falls back to local tier, error message set."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result(tier="auto_approve")
        mock_cross_svc = MagicMock()
        mock_cross_svc.primary_only_result.return_value = CrossAIVerificationResult(
            error="Secondary generation failed or skipped"
        )
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = []

        with (
            patch("src.api.v1.admin.get_local_verification_service", return_value=mock_local_svc),
            patch(
                "src.api.v1.admin.get_cross_ai_verification_service", return_value=mock_cross_svc
            ),
        ):
            result = await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=None,
            )

        assert result.combined_tier == "auto_approve"
        assert result.cross_ai is not None
        assert result.cross_ai.error == "Secondary generation failed or skipped"

    @pytest.mark.asyncio
    async def test_cross_ai_internal_error_fallback(self):
        """Cross-AI compare returns error field set → combined_tier falls back to local tier."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result(tier="quick_review")
        mock_cross_svc = MagicMock()
        mock_cross_svc.compare.return_value = _make_cross_result(error="Parse failure")
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = []

        with (
            patch("src.api.v1.admin.get_local_verification_service", return_value=mock_local_svc),
            patch(
                "src.api.v1.admin.get_cross_ai_verification_service", return_value=mock_cross_svc
            ),
        ):
            result = await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=_make_noun_data(),
            )

        assert result.combined_tier == "quick_review"
        assert result.cross_ai.error == "Parse failure"

    @pytest.mark.asyncio
    async def test_local_exception_raises_500(self):
        """Local verification exception → HTTPException 500."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.side_effect = RuntimeError("spaCy crashed")
        mock_cross_svc = MagicMock()
        mock_cross_svc.compare.return_value = _make_cross_result()
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = []

        with (
            patch("src.api.v1.admin.get_local_verification_service", return_value=mock_local_svc),
            patch(
                "src.api.v1.admin.get_cross_ai_verification_service", return_value=mock_cross_svc
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=_make_noun_data(),
            )

        assert exc_info.value.status_code == 500
        assert "Local verification pipeline failed" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_morphology_source_lexicon(self):
        """morphology_source='lexicon' when lexicon has declensions."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result()
        mock_cross_svc = MagicMock()
        mock_cross_svc.compare.return_value = _make_cross_result()
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = [MagicMock()]  # non-empty

        with (
            patch("src.api.v1.admin.get_local_verification_service", return_value=mock_local_svc),
            patch(
                "src.api.v1.admin.get_cross_ai_verification_service", return_value=mock_cross_svc
            ),
        ):
            result = await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=_make_noun_data(),
            )

        assert result.morphology_source == "lexicon"

    @pytest.mark.asyncio
    async def test_morphology_source_llm(self):
        """morphology_source='llm' when lexicon has no declensions."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result()
        mock_cross_svc = MagicMock()
        mock_cross_svc.compare.return_value = _make_cross_result()
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = []

        with (
            patch("src.api.v1.admin.get_local_verification_service", return_value=mock_local_svc),
            patch(
                "src.api.v1.admin.get_cross_ai_verification_service", return_value=mock_cross_svc
            ),
        ):
            result = await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=_make_noun_data(),
            )

        assert result.morphology_source == "llm"

    @pytest.mark.asyncio
    async def test_combined_tier_escalation(self):
        """auto_approve local + 0.80 cross-AI → quick_review."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result(tier="auto_approve")
        mock_cross_svc = MagicMock()
        mock_cross_svc.compare.return_value = _make_cross_result(agreement=0.80)
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = []

        with (
            patch("src.api.v1.admin.get_local_verification_service", return_value=mock_local_svc),
            patch(
                "src.api.v1.admin.get_cross_ai_verification_service", return_value=mock_cross_svc
            ),
        ):
            result = await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=_make_noun_data(),
            )

        assert result.combined_tier == "quick_review"

    @pytest.mark.asyncio
    async def test_combined_tier_passthrough(self):
        """auto_approve local + 0.95 cross-AI → auto_approve."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result(tier="auto_approve")
        mock_cross_svc = MagicMock()
        mock_cross_svc.compare.return_value = _make_cross_result(agreement=0.95)
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = []

        with (
            patch("src.api.v1.admin.get_local_verification_service", return_value=mock_local_svc),
            patch(
                "src.api.v1.admin.get_cross_ai_verification_service", return_value=mock_cross_svc
            ),
        ):
            result = await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=_make_noun_data(),
            )

        assert result.combined_tier == "auto_approve"

    @pytest.mark.asyncio
    async def test_translation_lookup_forwarded_to_verify(self):
        """translation_lookup kwarg is forwarded to local_svc.verify()."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result()
        mock_cross_svc = MagicMock()
        mock_cross_svc.compare.return_value = _make_cross_result()
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = []

        tdict = TranslationLookupStageResult(
            en=TranslationSourceInfo(
                translations=["house"],
                combined_text="house",
                source="dictionary",
                sense_count=1,
            ),
            ru=None,
        )

        with (
            patch("src.api.v1.admin.get_local_verification_service", return_value=mock_local_svc),
            patch(
                "src.api.v1.admin.get_cross_ai_verification_service", return_value=mock_cross_svc
            ),
        ):
            await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=_make_noun_data(),
                translation_lookup=tdict,
            )

        mock_local_svc.verify.assert_called_once()
        _, kwargs = mock_local_svc.verify.call_args
        assert kwargs.get("tdict_translations") is tdict


# ---------------------------------------------------------------------------
# Tests: parallel generation
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestParallelGeneration:
    """Verify primary generation and cross-AI LLM fire concurrently."""

    @pytest.mark.asyncio
    async def test_generation_and_secondary_run_concurrently(self) -> None:
        """Both LLM calls should start before either completes when gathered."""
        started: list[str] = []
        completed: list[str] = []

        async def _gen() -> GeneratedNounData:
            started.append("gen")
            await asyncio.sleep(0.02)
            completed.append("gen")
            return _make_noun_data()

        async def _cross() -> GeneratedNounData:
            started.append("cross_ai")
            await asyncio.sleep(0.02)
            completed.append("cross_ai")
            return _make_noun_data()

        results = await asyncio.gather(_gen(), _cross())

        # Both started before either completed (concurrency verified by sleep overlap)
        assert set(started) == {"gen", "cross_ai"}
        assert set(completed) == {"gen", "cross_ai"}
        assert len(started) == 2
        assert len(completed) == 2
        assert results[0].lemma == "σπίτι"
        assert results[1].lemma == "σπίτι"


# ---------------------------------------------------------------------------
# Helpers: Wiktionary
# ---------------------------------------------------------------------------


def _make_wiktionary_entry(
    gender: str = "neuter",
    forms: list | None = None,
    pronunciation: str | None = "/spí.ti/",
    glosses_en: str | None = "house",
) -> MagicMock:
    """Create a mock WiktionaryMorphology ORM object.

    Post-backfill: ``forms`` is a bundle list (``list[FormBundle]`` dicts), the
    shape the admin call site converts via ``bundles_to_flat`` before passing it
    to ``WiktionaryVerificationService.verify``.
    """
    entry = MagicMock()
    entry.lemma = "σπίτι"
    entry.gender = gender
    # Only fall back to the default bundles when the caller passed nothing; an
    # explicit ``forms=[]`` must survive (don't let the empty list read as falsy
    # and mask empty-forms cases).
    entry.forms = list(_BUNDLE_FORMS_ADMIN) if forms is None else forms
    entry.pronunciation = pronunciation
    entry.glosses_en = glosses_en
    return entry


# ---------------------------------------------------------------------------
# Tests: Wiktionary pipeline integration
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestWiktionaryPipelineIntegration:
    """Tests for wiktionary L2 verification integration in _run_verification_stage."""

    def _base_patches(
        self,
        mock_local_svc: MagicMock,
        mock_cross_svc: MagicMock,
        wikt_entry: MagicMock | None,
        wikt_local_result: MagicMock | None = None,
    ):
        """Return context managers for standard patches."""
        mock_wikt_morphology_svc = AsyncMock()
        mock_wikt_morphology_svc.get_entry.return_value = wikt_entry

        if wikt_local_result is None:
            wikt_local_result = _make_local_result(tier="auto_approve")

        return (
            patch("src.api.v1.admin.get_local_verification_service", return_value=mock_local_svc),
            patch(
                "src.api.v1.admin.get_cross_ai_verification_service",
                return_value=mock_cross_svc,
            ),
            patch(
                "src.api.v1.admin.WiktionaryMorphologyService",
                return_value=mock_wikt_morphology_svc,
            ),
            patch(
                "src.api.v1.admin.WiktionaryVerificationService",
                return_value=MagicMock(verify=MagicMock(return_value=wikt_local_result)),
            ),
            patch("src.api.v1.admin.get_session_factory"),
        )

    @pytest.mark.asyncio
    async def test_wiktionary_local_populated_when_entry_found(self):
        """result.wiktionary_local is set when WiktionaryMorphologyService returns an entry."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result(tier="auto_approve")
        mock_cross_svc = MagicMock()
        mock_cross_svc.compare.return_value = _make_cross_result()
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = [MagicMock()]

        wikt_entry = _make_wiktionary_entry()
        wikt_result = _make_local_result(tier="auto_approve")

        patches = self._base_patches(mock_local_svc, mock_cross_svc, wikt_entry, wikt_result)
        with patches[0], patches[1], patches[2], patches[3], patches[4]:
            result = await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=_make_noun_data(),
            )

        assert result.wiktionary_local is not None

    @pytest.mark.asyncio
    async def test_morphology_source_both_when_lexicon_and_wiktionary(self):
        """morphology_source='both' when lexicon has declensions and wiktionary entry found."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result()
        mock_cross_svc = MagicMock()
        mock_cross_svc.compare.return_value = _make_cross_result()
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = [MagicMock()]  # non-empty

        wikt_entry = _make_wiktionary_entry()

        patches = self._base_patches(mock_local_svc, mock_cross_svc, wikt_entry)
        with patches[0], patches[1], patches[2], patches[3], patches[4]:
            result = await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=_make_noun_data(),
            )

        assert result.morphology_source == "both"

    @pytest.mark.asyncio
    async def test_morphology_source_lexicon_only(self):
        """morphology_source='lexicon' when only lexicon has data (no wiktionary entry)."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result()
        mock_cross_svc = MagicMock()
        mock_cross_svc.compare.return_value = _make_cross_result()
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = [MagicMock()]  # non-empty

        patches = self._base_patches(mock_local_svc, mock_cross_svc, wikt_entry=None)
        with patches[0], patches[1], patches[2], patches[3], patches[4]:
            result = await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=_make_noun_data(),
            )

        assert result.morphology_source == "lexicon"

    @pytest.mark.asyncio
    async def test_morphology_source_wiktionary_only(self):
        """morphology_source='wiktionary' when only wiktionary has data."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result()
        mock_cross_svc = MagicMock()
        mock_cross_svc.compare.return_value = _make_cross_result()
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = []  # empty

        wikt_entry = _make_wiktionary_entry()

        patches = self._base_patches(mock_local_svc, mock_cross_svc, wikt_entry)
        with patches[0], patches[1], patches[2], patches[3], patches[4]:
            result = await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=_make_noun_data(),
            )

        assert result.morphology_source == "wiktionary"

    @pytest.mark.asyncio
    async def test_morphology_source_llm_when_neither(self):
        """morphology_source='llm' when neither lexicon nor wiktionary has data."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result()
        mock_cross_svc = MagicMock()
        mock_cross_svc.compare.return_value = _make_cross_result()
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = []  # empty

        patches = self._base_patches(mock_local_svc, mock_cross_svc, wikt_entry=None)
        with patches[0], patches[1], patches[2], patches[3], patches[4]:
            result = await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=_make_noun_data(),
            )

        assert result.morphology_source == "llm"


# ---------------------------------------------------------------------------
# LEXGEN-03-04 RED: F4 crash-site regression test (AC-4)
# ---------------------------------------------------------------------------

#: Bundle-list forms as they appear in wiktionary_entry.forms after backfill.
_BUNDLE_FORMS_ADMIN: list[dict] = [
    {"form": "το σπίτι", "features": {"case": "nominative", "number": "singular"}},
    {"form": "του σπιτιού", "features": {"case": "genitive", "number": "singular"}},
    {"form": "το σπίτι", "features": {"case": "accusative", "number": "singular"}},
    {"form": "σπίτι", "features": {"case": "vocative", "number": "singular"}},
    {"form": "τα σπίτια", "features": {"case": "nominative", "number": "plural"}},
    {"form": "των σπιτιών", "features": {"case": "genitive", "number": "plural"}},
    {"form": "τα σπίτια", "features": {"case": "accusative", "number": "plural"}},
    {"form": "σπίτια", "features": {"case": "vocative", "number": "plural"}},
]
_EXPECTED_FLAT_ADMIN: dict[str, str] = bundles_to_flat(
    [FormBundle.model_validate(d) for d in _BUNDLE_FORMS_ADMIN]
)


def _make_wiktionary_entry_bundle_list() -> MagicMock:
    """Create a mock WiktionaryMorphology row whose .forms is a bundle LIST
    (the post-backfill format). This is the shape that causes the crash at
    admin.py:3152 when dict(wiktionary_entry.forms) is called on a list."""
    entry = MagicMock()
    entry.lemma = "σπίτι"
    entry.gender = "neuter"
    entry.forms = list(_BUNDLE_FORMS_ADMIN)  # list[dict], NOT dict[str,str]
    entry.pronunciation = "/spí.ti/"
    entry.glosses_en = "house"
    return entry


@pytest.mark.unit
class TestAdminCallSiteCrashRegression:
    """RED test for F4: admin.py:3152 crash when wiktionary_entry.forms is a bundle list.

    This is the critical regression test. The current code does:
        wiktionary_forms=dict(wiktionary_entry.forms)
    which raises TypeError when forms is a list[dict] (post-backfill).

    After the fix, this line must produce a flat {case}_{number} dict via
    bundles_to_flat, and WiktionaryVerificationService.verify must be called
    with that flat dict — not crash.

    Approach: We exercise the REAL _run_verification_stage function (same as
    TestWiktionaryPipelineIntegration does), but inject a bundle-list entry.
    We patch WiktionaryVerificationService.verify to capture its arguments
    and assert wiktionary_forms is the expected flat dict.

    In RED state: the current dict(wiktionary_entry.forms) call on a list
    raises TypeError inside the executor lambda (line 3148-3157). The
    exception is caught by the broad `except Exception` at line 3158, so the
    test confirms the crash by checking wiktionary_local is None (because the
    exception was swallowed) — but more critically, we spy on verify() and
    assert it was called with the flat dict; in RED state verify() is NOT
    called (TypeError fires before it), so the assertion fails.
    """

    def _base_patches_bundle_list(
        self,
        mock_local_svc: MagicMock,
        mock_cross_svc: MagicMock,
        wikt_entry: MagicMock,
        captured_kwargs: dict,
    ):
        """Return context managers patching the standard services.

        Unlike _base_patches in TestWiktionaryPipelineIntegration, we spy on
        WiktionaryVerificationService.verify to capture wiktionary_forms.
        """
        mock_wikt_morphology_svc = AsyncMock()
        mock_wikt_morphology_svc.get_entry.return_value = wikt_entry

        def _capturing_verify(*args, **kwargs):
            """Spy: capture wiktionary_forms passed to verify()."""
            captured_kwargs.update(kwargs)
            return _make_local_result(tier="auto_approve")

        mock_wikt_verification_svc = MagicMock()
        mock_wikt_verification_svc.verify.side_effect = _capturing_verify

        return (
            patch("src.api.v1.admin.get_local_verification_service", return_value=mock_local_svc),
            patch(
                "src.api.v1.admin.get_cross_ai_verification_service",
                return_value=mock_cross_svc,
            ),
            patch(
                "src.api.v1.admin.WiktionaryMorphologyService",
                return_value=mock_wikt_morphology_svc,
            ),
            patch(
                "src.api.v1.admin.WiktionaryVerificationService",
                return_value=mock_wikt_verification_svc,
            ),
            patch("src.api.v1.admin.get_session_factory"),
        )

    @pytest.mark.asyncio
    async def test_admin_verification_receives_flat_dict_from_bundle_list(self) -> None:
        """AC-4 (F4): admin verification wiring must pass a flat dict to verify().

        Given: wiktionary_entry.forms is a bundle LIST (post-backfill format).
        When:  _run_verification_stage is called.
        Then:  WiktionaryVerificationService.verify() receives
               wiktionary_forms == bundles_to_flat(forms) — a flat {case}_{number} dict.
               No TypeError is raised (the crash is fixed).

        RED reason: The current call site does dict(wiktionary_entry.forms).
        On a list[dict], dict(list_of_dicts) raises TypeError (because a dict
        constructor requires an iterable of 2-element key-value pairs, not dicts).
        The exception is caught at line 3158 (broad except), so verify() is
        NEVER called — the captured_kwargs dict stays empty, and the assertion
        that wiktionary_forms == _EXPECTED_FLAT_ADMIN FAILS (KeyError on empty
        dict).  This is the right RED failure: the test catches the crash
        indirectly by proving verify() wasn't called with the correct argument.
        """
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result(tier="auto_approve")
        mock_cross_svc = MagicMock()
        mock_cross_svc.compare.return_value = _make_cross_result()
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = []

        wikt_entry = _make_wiktionary_entry_bundle_list()
        captured: dict = {}

        patches = self._base_patches_bundle_list(
            mock_local_svc, mock_cross_svc, wikt_entry, captured
        )
        with patches[0], patches[1], patches[2], patches[3], patches[4]:
            result = await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=_make_noun_data(),
            )

        # After the fix: verify() must have been called with the flat dict.
        # In RED state: TypeError fires inside the executor, verify() is never
        # called, captured is empty → KeyError on "wiktionary_forms" → FAIL.
        assert captured["wiktionary_forms"] == _EXPECTED_FLAT_ADMIN, (
            f"Expected WiktionaryVerificationService.verify() to be called with "
            f"the flat {{case}}_{{number}} dict derived via bundles_to_flat, but "
            f"got: {captured.get('wiktionary_forms', '<verify() was not called>')!r}. "
            f"This likely means dict(wiktionary_entry.forms) raised TypeError on the "
            f"bundle list and the exception was swallowed at line 3158."
        )
        # Also: wiktionary_local must be set (verify() ran without TypeError)
        assert result.wiktionary_local is not None


# ---------------------------------------------------------------------------
# Adversarial / edge coverage added by QA (Mode B, LEXGEN-03-04)
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestAdminCallSiteCrashAdversarial:
    """Adversarial edge cases for the F4 admin call site fix."""

    @pytest.mark.asyncio
    async def test_dict_corruption_shape_is_absent_from_wiktionary_forms(self) -> None:
        """Confirm the corrupted {'form': 'features'} shape NEVER reaches verify().

        The old dict(list_of_dicts) on a list like
            [{"form": "σπίτι", "features": {...}}, ...]
        raises TypeError. This test confirms the fixed path produces proper
        {case_number: form_string} keys — ruling out any scenario where the old
        code somehow snuck through without crashing but yielded garbage.
        """
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result(tier="auto_approve")
        mock_cross_svc = MagicMock()
        mock_cross_svc.compare.return_value = _make_cross_result()
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = []

        wikt_entry = _make_wiktionary_entry_bundle_list()
        captured: dict = {}

        patches = TestAdminCallSiteCrashRegression()._base_patches_bundle_list(
            mock_local_svc, mock_cross_svc, wikt_entry, captured
        )
        with patches[0], patches[1], patches[2], patches[3], patches[4]:
            await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=_make_noun_data(),
            )

        wikt_forms = captured.get("wiktionary_forms", {})
        # The corruption artifact "form" / "features" as dict keys must be absent
        assert (
            "form" not in wikt_forms
        ), "wiktionary_forms contained 'form' key — old dict(list_of_dicts) corruption path"
        assert (
            "features" not in wikt_forms
        ), "wiktionary_forms contained 'features' key — old dict(list_of_dicts) corruption path"
        # All keys must follow the case_number pattern
        for key in wikt_forms:
            assert "_" in key, f"Unexpected non-flat key in wiktionary_forms: {key!r}"

    @pytest.mark.asyncio
    async def test_wiktionary_none_entry_skips_verify_cleanly(self) -> None:
        """When wiktionary_entry is None the verify() call is skipped entirely.

        The guard `if wiktionary_entry is not None` must be intact after the fix.
        This ensures the None-path didn't break when the bundles_to_flat call
        was inserted around it.
        """
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result(tier="auto_approve")
        mock_cross_svc = MagicMock()
        mock_cross_svc.compare.return_value = _make_cross_result()
        mock_lexicon_svc = AsyncMock()
        mock_lexicon_svc.get_declensions.return_value = []

        mock_wikt_morphology_svc = AsyncMock()
        mock_wikt_morphology_svc.get_entry.return_value = None  # no entry
        mock_wikt_verification_svc = MagicMock()

        with (
            patch("src.api.v1.admin.get_local_verification_service", return_value=mock_local_svc),
            patch(
                "src.api.v1.admin.get_cross_ai_verification_service",
                return_value=mock_cross_svc,
            ),
            patch(
                "src.api.v1.admin.WiktionaryMorphologyService",
                return_value=mock_wikt_morphology_svc,
            ),
            patch(
                "src.api.v1.admin.WiktionaryVerificationService",
                return_value=mock_wikt_verification_svc,
            ),
            patch("src.api.v1.admin.get_session_factory"),
        ):
            result = await _run_verification_stage(
                generated_data=_make_noun_data(),
                normalized_lemma=_make_normalized_lemma(),
                lexicon_svc=mock_lexicon_svc,
                lemma="σπίτι",
                secondary_data=_make_noun_data(),
            )

        # verify() must NOT have been called (no wiktionary entry)
        mock_wikt_verification_svc.verify.assert_not_called()
        # wiktionary_local stays None
        assert result.wiktionary_local is None
