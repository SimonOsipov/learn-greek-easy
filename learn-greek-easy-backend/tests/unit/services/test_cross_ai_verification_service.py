"""Unit tests for CrossAIVerificationService."""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, patch

import pytest

from src.core.exceptions import OpenRouterAPIError, OpenRouterRateLimitError, OpenRouterTimeoutError
from src.schemas.nlp import (
    GeneratedExample,
    GeneratedNounCases,
    GeneratedNounCaseSet,
    GeneratedNounData,
    GeneratedNounGrammar,
    NormalizedLemma,
    OpenRouterResponse,
)
from src.services.cross_ai_verification_service import (
    CrossAIVerificationService,
    get_cross_ai_verification_service,
)
from src.services.noun_data_generation_service import _SYSTEM_PROMPT  # noqa: WPS450
from src.services.openrouter_service import OpenRouterService

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_response(content: str) -> OpenRouterResponse:
    """Return a mock OpenRouterResponse."""
    return OpenRouterResponse(
        content=content,
        model="openai/gpt-4.1-mini",
        usage=None,
        latency_ms=100.0,
    )


def _make_lemma(**overrides: object) -> NormalizedLemma:
    """Return a NormalizedLemma with sensible defaults."""
    defaults: dict[str, object] = {
        "input_word": "σπίτι",
        "lemma": "σπίτι",
        "gender": "neuter",
        "article": "το",
        "pos": "NOUN",
        "confidence": 1.0,
    }
    defaults.update(overrides)
    return NormalizedLemma(**defaults)  # type: ignore[arg-type]


def _make_noun_data(**overrides: object) -> GeneratedNounData:
    """Build a GeneratedNounData with controllable fields via overrides."""
    case_set = GeneratedNounCaseSet(
        nominative="το σπίτι",
        genitive="του σπιτιού",
        accusative="το σπίτι",
        vocative="σπίτι",
    )
    defaults: dict[str, object] = {
        "lemma": "σπίτι",
        "part_of_speech": "noun",
        "translation_en": "house",
        "translation_en_plural": "houses",
        "translation_ru": "дом",
        "translation_ru_plural": "дома",
        "pronunciation": "/spí.ti/",
        "grammar_data": GeneratedNounGrammar(
            gender="neuter",
            declension_group="neuter_i",
            cases=GeneratedNounCases(singular=case_set, plural=case_set),
        ),
        "examples": [
            GeneratedExample(
                id=1,
                greek="Το σπίτι είναι μεγάλο.",
                english="The house is big.",
                russian="Дом большой.",
            ),
            GeneratedExample(
                id=2, greek="Πηγαίνω στο σπίτι.", english="I'm going home.", russian="Я иду домой."
            ),
        ],
    }
    defaults.update(overrides)
    return GeneratedNounData(**defaults)  # type: ignore[arg-type]


def _noun_data_to_json(data: GeneratedNounData) -> str:
    """Serialize GeneratedNounData to JSON string."""
    return data.model_dump_json()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_openrouter() -> AsyncMock:
    """Return an AsyncMock standing in for OpenRouterService."""
    return AsyncMock(spec=OpenRouterService)


@pytest.fixture()
def service(mock_openrouter: AsyncMock) -> CrossAIVerificationService:
    """Return a CrossAIVerificationService wired to the mock OpenRouter."""
    return CrossAIVerificationService(openrouter_service=mock_openrouter)


@pytest.fixture()
def _reset_singleton() -> object:
    """Reset the CrossAIVerificationService singleton before and after each test."""
    import src.services.cross_ai_verification_service as mod

    mod._cross_ai_verification_service = None
    yield
    mod._cross_ai_verification_service = None


# ---------------------------------------------------------------------------
# Tests: full agreement
# ---------------------------------------------------------------------------


class TestFullAgreement:
    """Tests for CrossAIVerificationService.verify() when all fields agree."""

    @pytest.mark.asyncio
    async def test_all_fields_agree(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """All 15 fields match -> overall_agreement == 1.0."""
        primary = _make_noun_data()
        secondary = _make_noun_data()  # identical
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(secondary))

        result = await service.verify(primary, _make_lemma())

        assert result.overall_agreement == 1.0
        assert len(result.comparisons) == 16
        assert all(c.agrees for c in result.comparisons)
        assert result.secondary_model == "qwen/qwen3-30b-a3b-instruct-2507"
        assert result.secondary_generation is not None
        assert result.error is None


# ---------------------------------------------------------------------------
# Tests: partial disagreement
# ---------------------------------------------------------------------------


class TestPartialDisagreement:
    """Tests for verify() when specific fields disagree."""

    @pytest.mark.asyncio
    async def test_low_weight_field_disagrees(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """translation_en_plural (weight 0.5) differs → agreement = 21.5/22.0."""
        primary = _make_noun_data()
        secondary = _make_noun_data(translation_en_plural="homes")
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(secondary))

        result = await service.verify(primary, _make_lemma())

        assert result.overall_agreement == pytest.approx(21.5 / 22.0)

    @pytest.mark.asyncio
    async def test_high_weight_field_disagrees(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """lemma (weight 3.0) differs → agreement = 19.0/22.0."""
        primary = _make_noun_data()
        secondary = _make_noun_data(lemma="different")
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(secondary))

        result = await service.verify(primary, _make_lemma())

        assert result.overall_agreement == pytest.approx(19.0 / 22.0)

    @pytest.mark.asyncio
    async def test_three_critical_fields_disagree_below_threshold(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """lemma (3.0) + gender (3.0) + declension_group (2.0) differ → agreement ≈ 14.0/22.0."""
        primary = _make_noun_data()
        case_set = GeneratedNounCaseSet(
            nominative="το σπίτι",
            genitive="του σπιτιού",
            accusative="το σπίτι",
            vocative="σπίτι",
        )
        grammar = GeneratedNounGrammar(
            gender="masculine",
            declension_group="masculine_os",
            cases=GeneratedNounCases(singular=case_set, plural=case_set),
        )
        secondary = _make_noun_data(lemma="different", grammar_data=grammar)
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(secondary))

        result = await service.verify(primary, _make_lemma())

        assert result.overall_agreement == pytest.approx(14.0 / 22.0)
        assert result.overall_agreement is not None
        assert result.overall_agreement < 0.70

    @pytest.mark.asyncio
    async def test_translation_en_differs(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """translation_en (weight 1.0) differs → agreement = 21.0/22.0."""
        primary = _make_noun_data()
        secondary = _make_noun_data(translation_en="home")
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(secondary))

        result = await service.verify(primary, _make_lemma())

        assert result.overall_agreement == pytest.approx(21.0 / 22.0)


# ---------------------------------------------------------------------------
# Tests: translation_en_plural None handling
# ---------------------------------------------------------------------------


class TestTranslationEnPluralHandling:
    """Tests for translation_en_plural None-vs-value comparison logic."""

    @pytest.mark.asyncio
    async def test_both_none_agrees(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """Both primary and secondary have None → agrees=True."""
        primary = _make_noun_data(translation_en_plural=None)
        secondary = _make_noun_data(translation_en_plural=None)
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(secondary))

        result = await service.verify(primary, _make_lemma())

        plural_comp = next(c for c in result.comparisons if c.field_path == "translation_en_plural")
        assert plural_comp.agrees is True

    @pytest.mark.asyncio
    async def test_none_vs_value_disagrees(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """Primary None + secondary 'houses' → agrees=False."""
        primary = _make_noun_data(translation_en_plural=None)
        secondary = _make_noun_data(translation_en_plural="houses")
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(secondary))

        result = await service.verify(primary, _make_lemma())

        plural_comp = next(c for c in result.comparisons if c.field_path == "translation_en_plural")
        assert plural_comp.agrees is False

    @pytest.mark.asyncio
    async def test_value_vs_none_disagrees(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """Primary 'houses' + secondary None → agrees=False."""
        primary = _make_noun_data(translation_en_plural="houses")
        secondary = _make_noun_data(translation_en_plural=None)
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(secondary))

        result = await service.verify(primary, _make_lemma())

        plural_comp = next(c for c in result.comparisons if c.field_path == "translation_en_plural")
        assert plural_comp.agrees is False

    @pytest.mark.asyncio
    async def test_same_value_agrees(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """Both 'houses' → agrees=True."""
        primary = _make_noun_data(translation_en_plural="houses")
        secondary = _make_noun_data(translation_en_plural="houses")
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(secondary))

        result = await service.verify(primary, _make_lemma())

        plural_comp = next(c for c in result.comparisons if c.field_path == "translation_en_plural")
        assert plural_comp.agrees is True

    @pytest.mark.asyncio
    async def test_different_values_disagrees(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """'houses' vs 'homes' → agrees=False."""
        primary = _make_noun_data(translation_en_plural="houses")
        secondary = _make_noun_data(translation_en_plural="homes")
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(secondary))

        result = await service.verify(primary, _make_lemma())

        plural_comp = next(c for c in result.comparisons if c.field_path == "translation_en_plural")
        assert plural_comp.agrees is False


# ---------------------------------------------------------------------------
# Tests: case form comparison (article stripping)
# ---------------------------------------------------------------------------


class TestCaseFormComparison:
    """Tests for case form comparison with article stripping."""

    @pytest.mark.asyncio
    async def test_bare_forms_match(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """Both nominative forms identical → agrees=True."""
        primary = _make_noun_data()
        secondary = _make_noun_data()
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(secondary))

        result = await service.verify(primary, _make_lemma())

        nom_comp = next(
            c for c in result.comparisons if c.field_path == "cases.singular.nominative"
        )
        assert nom_comp.agrees is True

    @pytest.mark.asyncio
    async def test_bare_forms_differ(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """Different actual forms after stripping → agrees=False."""
        primary_case_set = GeneratedNounCaseSet(
            nominative="το σπίτι",
            genitive="του σπιτιού",
            accusative="το σπίτι",
            vocative="σπίτι",
        )
        secondary_case_set = GeneratedNounCaseSet(
            nominative="το κτίριο",
            genitive="του σπιτιού",
            accusative="το σπίτι",
            vocative="σπίτι",
        )
        primary_grammar = GeneratedNounGrammar(
            gender="neuter",
            declension_group="neuter_i",
            cases=GeneratedNounCases(singular=primary_case_set, plural=primary_case_set),
        )
        secondary_grammar = GeneratedNounGrammar(
            gender="neuter",
            declension_group="neuter_i",
            cases=GeneratedNounCases(singular=secondary_case_set, plural=secondary_case_set),
        )
        primary = _make_noun_data(grammar_data=primary_grammar)
        secondary = _make_noun_data(grammar_data=secondary_grammar)
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(secondary))

        result = await service.verify(primary, _make_lemma())

        nom_comp = next(
            c for c in result.comparisons if c.field_path == "cases.singular.nominative"
        )
        assert nom_comp.agrees is False

    @pytest.mark.asyncio
    async def test_article_stripped_before_compare(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """Different articles on same form: 'ο σπίτι' vs 'το σπίτι' → after strip both 'σπίτι' → agrees=True."""
        primary_case_set = GeneratedNounCaseSet(
            nominative="ο σπίτι",
            genitive="του σπιτιού",
            accusative="το σπίτι",
            vocative="σπίτι",
        )
        secondary_case_set = GeneratedNounCaseSet(
            nominative="το σπίτι",
            genitive="του σπιτιού",
            accusative="το σπίτι",
            vocative="σπίτι",
        )
        primary_grammar = GeneratedNounGrammar(
            gender="neuter",
            declension_group="neuter_i",
            cases=GeneratedNounCases(singular=primary_case_set, plural=primary_case_set),
        )
        secondary_grammar = GeneratedNounGrammar(
            gender="neuter",
            declension_group="neuter_i",
            cases=GeneratedNounCases(singular=secondary_case_set, plural=secondary_case_set),
        )
        primary = _make_noun_data(grammar_data=primary_grammar)
        secondary = _make_noun_data(grammar_data=secondary_grammar)
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(secondary))

        result = await service.verify(primary, _make_lemma())

        nom_comp = next(
            c for c in result.comparisons if c.field_path == "cases.singular.nominative"
        )
        assert nom_comp.agrees is True

    @pytest.mark.asyncio
    async def test_vocative_without_article(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """Both vocative forms bare 'σπίτι' → agrees=True."""
        primary = _make_noun_data()
        secondary = _make_noun_data()
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(secondary))

        result = await service.verify(primary, _make_lemma())

        voc_comp = next(c for c in result.comparisons if c.field_path == "cases.singular.vocative")
        assert voc_comp.agrees is True


# ---------------------------------------------------------------------------
# Tests: weight correctness
# ---------------------------------------------------------------------------


class TestWeightCorrectness:
    """Tests verifying field weights match the specification."""

    def test_each_field_has_correct_weight(self) -> None:
        """Verify each field's weight matches the spec."""
        expected = {
            "lemma": 3.0,
            "grammar_data.gender": 3.0,
            "grammar_data.declension_group": 2.0,
            "cases.singular.nominative": 2.0,
            "cases.singular.genitive": 1.5,
            "cases.singular.accusative": 1.5,
            "cases.singular.vocative": 1.0,
            "cases.plural.nominative": 1.5,
            "cases.plural.genitive": 1.0,
            "cases.plural.accusative": 1.0,
            "cases.plural.vocative": 0.5,
            "translation_en": 1.0,
            "translation_en_plural": 0.5,
            "translation_ru_plural": 0.5,
            "translation_ru": 1.0,
            "pronunciation": 1.0,
        }
        assert CrossAIVerificationService._FIELD_WEIGHTS == expected

    def test_total_weight_sum(self) -> None:
        """Total weight = 22.0."""
        assert sum(CrossAIVerificationService._FIELD_WEIGHTS.values()) == pytest.approx(22.0)

    def test_field_count_is_sixteen(self) -> None:
        """There are exactly 16 tracked fields."""
        assert len(CrossAIVerificationService._FIELD_WEIGHTS) == 16

    @pytest.mark.asyncio
    async def test_comparisons_carry_correct_weights(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """Each comparison in the result has the correct weight from _FIELD_WEIGHTS."""
        primary = _make_noun_data()
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(primary))
        result = await service.verify(primary, _make_lemma())
        for comp in result.comparisons:
            assert comp.weight == CrossAIVerificationService._FIELD_WEIGHTS[comp.field_path]


# ---------------------------------------------------------------------------
# Tests: prompt construction
# ---------------------------------------------------------------------------


class TestPromptConstruction:
    """Tests verifying the messages built by _build_messages()."""

    @pytest.mark.asyncio
    async def test_model_override(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """verify() passes the correct secondary model to complete()."""
        primary = _make_noun_data()
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(primary))
        await service.verify(primary, _make_lemma())
        call_kwargs = mock_openrouter.complete.call_args
        assert call_kwargs.kwargs["model"] == "qwen/qwen3-30b-a3b-instruct-2507"

    @pytest.mark.asyncio
    async def test_response_format(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """verify() passes response_format={'type': 'json_object'}."""
        primary = _make_noun_data()
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(primary))
        await service.verify(primary, _make_lemma())
        call_kwargs = mock_openrouter.complete.call_args
        assert call_kwargs.kwargs["response_format"] == {"type": "json_object"}

    @pytest.mark.asyncio
    async def test_system_prompt_matches(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """System message content equals _SYSTEM_PROMPT."""
        primary = _make_noun_data()
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(primary))
        await service.verify(primary, _make_lemma())
        messages = mock_openrouter.complete.call_args.kwargs["messages"]
        assert messages[0]["role"] == "system"
        assert messages[0]["content"] == _SYSTEM_PROMPT

    @pytest.mark.asyncio
    async def test_user_prompt_has_lemma_metadata(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """User message includes lemma, gender, article, pos."""
        primary = _make_noun_data()
        lemma = _make_lemma(
            lemma="σπίτι", gender="neuter", article="το", pos="NOUN", confidence=1.0
        )
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(primary))
        await service.verify(primary, lemma)
        messages = mock_openrouter.complete.call_args.kwargs["messages"]
        user_content = messages[1]["content"]
        assert "σπίτι" in user_content
        assert "neuter" in user_content
        assert "το" in user_content

    @pytest.mark.asyncio
    async def test_user_prompt_has_response_instruction(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """User message includes instruction to respond with JSON matching examples."""
        primary = _make_noun_data()
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(primary))
        await service.verify(primary, _make_lemma())
        messages = mock_openrouter.complete.call_args.kwargs["messages"]
        user_content = messages[1]["content"]
        assert "valid JSON" in user_content

    @pytest.mark.asyncio
    async def test_none_gender_uses_empty_string(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """When gender is None, user prompt uses empty string (not 'unknown')."""
        primary = _make_noun_data()
        lemma = _make_lemma(gender=None, article=None)
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(primary))
        await service.verify(primary, lemma)
        messages = mock_openrouter.complete.call_args.kwargs["messages"]
        user_content = messages[1]["content"]
        assert "unknown" not in user_content.lower()

    @pytest.mark.asyncio
    async def test_reasoning_disabled(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """verify() passes reasoning={'type': 'disabled'} to OpenRouter to suppress thinking tokens."""
        primary = _make_noun_data()
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(primary))
        await service.verify(primary, _make_lemma())
        call_kwargs = mock_openrouter.complete.call_args
        assert call_kwargs.kwargs["reasoning"] == {"type": "disabled"}


# ---------------------------------------------------------------------------
# Tests: error handling
# ---------------------------------------------------------------------------


class TestErrorHandling:
    """Tests for verify() error handling — all errors return a result, never raise."""

    @pytest.mark.asyncio
    async def test_rate_limit_error(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """OpenRouterRateLimitError → result with error set, primary comparisons populated."""
        mock_openrouter.complete.side_effect = OpenRouterRateLimitError(detail="rate limited")
        result = await service.verify(_make_noun_data(), _make_lemma())
        assert result.error is not None
        assert len(result.comparisons) == 16
        assert result.overall_agreement is None
        assert result.secondary_generation is None

    @pytest.mark.asyncio
    async def test_timeout_error(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """OpenRouterTimeoutError → result with error set, primary comparisons populated."""
        mock_openrouter.complete.side_effect = OpenRouterTimeoutError(detail="timed out")
        result = await service.verify(_make_noun_data(), _make_lemma())
        assert result.error is not None
        assert len(result.comparisons) == 16
        assert result.overall_agreement is None

    @pytest.mark.asyncio
    async def test_api_error(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """OpenRouterAPIError → result with error set, primary comparisons populated."""
        mock_openrouter.complete.side_effect = OpenRouterAPIError(
            status_code=500, detail="server error"
        )
        result = await service.verify(_make_noun_data(), _make_lemma())
        assert result.error is not None
        assert len(result.comparisons) == 16

    @pytest.mark.asyncio
    async def test_invalid_json(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """Non-JSON response → result with error set, primary comparisons populated."""
        mock_openrouter.complete.return_value = _make_response("not json at all")
        result = await service.verify(_make_noun_data(), _make_lemma())
        assert result.error is not None
        assert len(result.comparisons) == 16
        assert result.overall_agreement is None

    @pytest.mark.asyncio
    async def test_wrong_schema(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """Valid JSON but wrong schema → result with error set, primary comparisons populated."""
        mock_openrouter.complete.return_value = _make_response('{"wrong": "schema"}')
        result = await service.verify(_make_noun_data(), _make_lemma())
        assert result.error is not None
        assert len(result.comparisons) == 16
        assert result.overall_agreement is None


# ---------------------------------------------------------------------------
# Tests: logging
# ---------------------------------------------------------------------------


class TestLogging:
    """Tests verifying log output from verify()."""

    @pytest.mark.asyncio
    async def test_info_on_success(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
        caplog_loguru: pytest.LogCaptureFixture,
    ) -> None:
        """Successful verify() logs an INFO message containing 'Cross-AI verification complete'."""
        primary = _make_noun_data()
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(primary))
        with caplog_loguru.at_level(logging.INFO):
            await service.verify(primary, _make_lemma())
        assert any("Cross-AI verification complete" in r.message for r in caplog_loguru.records)

    @pytest.mark.asyncio
    async def test_warning_on_failure(
        self,
        service: CrossAIVerificationService,
        mock_openrouter: AsyncMock,
        caplog_loguru: pytest.LogCaptureFixture,
    ) -> None:
        """Failed verify() logs a WARNING message containing 'Cross-AI verification failed'."""
        mock_openrouter.complete.side_effect = RuntimeError("test error")
        with caplog_loguru.at_level(logging.WARNING):
            await service.verify(_make_noun_data(), _make_lemma())
        assert any("Cross-AI verification failed" in r.message for r in caplog_loguru.records)


# ---------------------------------------------------------------------------
# Tests: generate_secondary()
# ---------------------------------------------------------------------------


class TestGenerateSecondary:
    """Tests for generate_secondary() method."""

    @pytest.mark.asyncio
    async def test_returns_parsed_noun_data(
        self, service: CrossAIVerificationService, mock_openrouter: AsyncMock
    ) -> None:
        """generate_secondary() calls LLM and returns parsed GeneratedNounData."""
        expected = _make_noun_data()
        mock_openrouter.complete.return_value = _make_response(_noun_data_to_json(expected))
        result = await service.generate_secondary(_make_lemma())
        assert result.lemma == expected.lemma

    @pytest.mark.asyncio
    async def test_raises_on_llm_failure(
        self, service: CrossAIVerificationService, mock_openrouter: AsyncMock
    ) -> None:
        """generate_secondary() raises when LLM call fails (no exception swallowing)."""
        mock_openrouter.complete.side_effect = OpenRouterAPIError(status_code=500, detail="fail")
        with pytest.raises(OpenRouterAPIError):
            await service.generate_secondary(_make_lemma())

    @pytest.mark.asyncio
    async def test_raises_on_invalid_json(
        self, service: CrossAIVerificationService, mock_openrouter: AsyncMock
    ) -> None:
        """generate_secondary() raises when LLM returns invalid JSON."""
        mock_openrouter.complete.return_value = _make_response("not valid json {")
        with pytest.raises(Exception):
            await service.generate_secondary(_make_lemma())


# ---------------------------------------------------------------------------
# Tests: compare()
# ---------------------------------------------------------------------------


class TestCompare:
    """Tests for compare() method."""

    def test_full_agreement(self, service: CrossAIVerificationService) -> None:
        """Identical primary and secondary → overall_agreement == 1.0."""
        primary = _make_noun_data()
        secondary = _make_noun_data()
        result = service.compare(primary, secondary)
        assert result.overall_agreement == 1.0
        assert result.error is None

    def test_partial_disagreement(self, service: CrossAIVerificationService) -> None:
        """translation_en differs (weight 1.0) → agreement = 21.0/22.0."""
        primary = _make_noun_data()
        secondary = _make_noun_data(translation_en="home")
        result = service.compare(primary, secondary)
        assert result.overall_agreement == pytest.approx(21.0 / 22.0)

    def test_returns_secondary_generation(self, service: CrossAIVerificationService) -> None:
        """compare() sets secondary_generation on result."""
        primary = _make_noun_data()
        secondary = _make_noun_data(translation_en="bus")
        result = service.compare(primary, secondary)
        assert result.secondary_generation == secondary


# ---------------------------------------------------------------------------
# Tests: singleton factory
# ---------------------------------------------------------------------------


class TestSingleton:
    """Tests for the get_cross_ai_verification_service() singleton factory."""

    def test_same_instance(
        self,
        _reset_singleton: object,
    ) -> None:
        """get_cross_ai_verification_service() returns the same instance on repeated calls."""
        with patch("src.services.cross_ai_verification_service.get_openrouter_service"):
            svc1 = get_cross_ai_verification_service()
            svc2 = get_cross_ai_verification_service()
        assert svc1 is svc2

    def test_fresh_after_reset(
        self,
        _reset_singleton: object,
    ) -> None:
        """Resetting the singleton creates a new instance on next call."""
        import src.services.cross_ai_verification_service as mod

        with patch("src.services.cross_ai_verification_service.get_openrouter_service"):
            svc1 = get_cross_ai_verification_service()
            mod._cross_ai_verification_service = None
            svc2 = get_cross_ai_verification_service()
        assert svc1 is not svc2


# ---------------------------------------------------------------------------
# Tests: _parse_response think tag stripping
# ---------------------------------------------------------------------------


class TestParseResponseThinkTags:
    """Tests for _parse_response() stripping <think>...</think> tags."""

    def test_strips_think_tags(self, service: CrossAIVerificationService) -> None:
        """<think>...</think> prefix before JSON is stripped before parsing."""
        noun = _make_noun_data()
        content = f"<think>Some thinking process here</think>{_noun_data_to_json(noun)}"
        result = service._parse_response(content)
        assert result.lemma == noun.lemma

    def test_strips_multiline_think_tags(self, service: CrossAIVerificationService) -> None:
        """Multiline think content is fully stripped."""
        noun = _make_noun_data()
        think_block = "<think>\nLine one\nLine two\nLine three\n</think>"
        content = f"{think_block}{_noun_data_to_json(noun)}"
        result = service._parse_response(content)
        assert result.lemma == noun.lemma

    def test_no_think_tags_unchanged(self, service: CrossAIVerificationService) -> None:
        """Clean JSON without think tags parses as before."""
        noun = _make_noun_data()
        content = _noun_data_to_json(noun)
        result = service._parse_response(content)
        assert result.lemma == noun.lemma
        assert result.translation_en == noun.translation_en


# ---------------------------------------------------------------------------
# Tests: primary_only_result
# ---------------------------------------------------------------------------


class TestPrimaryOnlyResult:
    """Tests for primary_only_result() method."""

    def test_populates_all_fields(self, service: CrossAIVerificationService) -> None:
        """primary_only_result() returns 16 comparisons, all agrees=True, all secondary_value='—'."""
        primary = _make_noun_data()
        result = service.primary_only_result(primary, error="test error")
        assert len(result.comparisons) == 16
        assert all(c.agrees for c in result.comparisons)
        assert all(c.secondary_value == "—" for c in result.comparisons)

    def test_sets_error(self, service: CrossAIVerificationService) -> None:
        """primary_only_result() sets error, overall_agreement=None, secondary_generation=None."""
        primary = _make_noun_data()
        result = service.primary_only_result(primary, error="something went wrong")
        assert result.error == "something went wrong"
        assert result.overall_agreement is None
        assert result.secondary_generation is None

    def test_primary_values_correct(self, service: CrossAIVerificationService) -> None:
        """primary_only_result() uses correct primary values from input data."""
        primary = _make_noun_data()
        result = service.primary_only_result(primary, error="test error")
        lemma_comp = next(c for c in result.comparisons if c.field_path == "lemma")
        assert lemma_comp.primary_value == primary.lemma
        gender_comp = next(c for c in result.comparisons if c.field_path == "grammar_data.gender")
        assert gender_comp.primary_value == primary.grammar_data.gender
        en_comp = next(c for c in result.comparisons if c.field_path == "translation_en")
        assert en_comp.primary_value == primary.translation_en
