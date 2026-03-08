"""Unit tests for verification pipeline wiring in generate_word_entry endpoint.

Tests cover:
- _run_verification_stage() extracted function:
  - Both services called in parallel via asyncio.gather
  - Cross-AI exception fallback to local tier
  - Cross-AI internal error (error field set) fallback to local tier
  - Local verification exception raises HTTP 500
  - morphology_source detection ('lexicon' vs 'llm')
  - combined_tier escalation via compute_combined_tier matrix
  - combined_tier passthrough for high agreement
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from src.api.v1.admin import _run_verification_stage
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
        secondary_model="minimax/minimax-m2.5",
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestRunVerificationStage:
    """Tests for _run_verification_stage async helper."""

    @pytest.mark.asyncio
    async def test_both_services_called(self):
        """Both local and cross-AI verification services are invoked."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result()
        mock_cross_svc = AsyncMock()
        mock_cross_svc.verify.return_value = _make_cross_result()
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
            )

        mock_local_svc.verify.assert_called_once()
        mock_cross_svc.verify.assert_called_once()
        assert result.local is not None
        assert result.cross_ai is not None

    @pytest.mark.asyncio
    async def test_cross_ai_exception_fallback(self):
        """Cross-AI exception → combined_tier falls back to local tier, response is 200."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result(tier="auto_approve")
        mock_cross_svc = AsyncMock()
        mock_cross_svc.verify.side_effect = RuntimeError("OpenRouter down")
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
            )

        assert result.combined_tier == "auto_approve"
        assert result.cross_ai is not None
        assert result.cross_ai.error == "OpenRouter down"

    @pytest.mark.asyncio
    async def test_cross_ai_internal_error_fallback(self):
        """Cross-AI returns error field set → combined_tier falls back to local tier."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result(tier="quick_review")
        mock_cross_svc = AsyncMock()
        mock_cross_svc.verify.return_value = _make_cross_result(error="Parse failure")
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
            )

        assert result.combined_tier == "quick_review"
        assert result.cross_ai.error == "Parse failure"

    @pytest.mark.asyncio
    async def test_local_exception_raises_500(self):
        """Local verification exception → HTTPException 500."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.side_effect = RuntimeError("spaCy crashed")
        mock_cross_svc = AsyncMock()
        mock_cross_svc.verify.return_value = _make_cross_result()
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
            )

        assert exc_info.value.status_code == 500
        assert "Local verification pipeline failed" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_morphology_source_lexicon(self):
        """morphology_source='lexicon' when lexicon has declensions."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result()
        mock_cross_svc = AsyncMock()
        mock_cross_svc.verify.return_value = _make_cross_result()
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
            )

        assert result.morphology_source == "lexicon"

    @pytest.mark.asyncio
    async def test_morphology_source_llm(self):
        """morphology_source='llm' when lexicon has no declensions."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result()
        mock_cross_svc = AsyncMock()
        mock_cross_svc.verify.return_value = _make_cross_result()
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
            )

        assert result.morphology_source == "llm"

    @pytest.mark.asyncio
    async def test_combined_tier_escalation(self):
        """auto_approve local + 0.80 cross-AI → quick_review."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result(tier="auto_approve")
        mock_cross_svc = AsyncMock()
        mock_cross_svc.verify.return_value = _make_cross_result(agreement=0.80)
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
            )

        assert result.combined_tier == "quick_review"

    @pytest.mark.asyncio
    async def test_combined_tier_passthrough(self):
        """auto_approve local + 0.95 cross-AI → auto_approve."""
        mock_local_svc = MagicMock()
        mock_local_svc.verify.return_value = _make_local_result(tier="auto_approve")
        mock_cross_svc = AsyncMock()
        mock_cross_svc.verify.return_value = _make_cross_result(agreement=0.95)
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
            )

        assert result.combined_tier == "auto_approve"
