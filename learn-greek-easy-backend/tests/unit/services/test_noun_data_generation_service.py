"""Unit tests for NounDataGenerationService."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from src.core.exceptions import NounGenerationError, OpenRouterAPIError
from src.schemas.nlp import (
    GeneratedExample,
    GeneratedNounCases,
    GeneratedNounCaseSet,
    GeneratedNounData,
    GeneratedNounGrammar,
    NormalizedLemma,
    OpenRouterResponse,
)
from src.services.noun_data_generation_service import (
    NounDataGenerationService,
    _derive_declension_group,
    get_noun_data_generation_service,
)
from src.services.openrouter_service import OpenRouterService

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_VALID_NOUN_JSON = json.dumps(
    {
        "lemma": "σπίτι",
        "part_of_speech": "noun",
        "translation_en": "house, home",
        "translation_en_plural": "houses",
        "translation_ru": "дом",
        "pronunciation": "/spí·ti/",
        "grammar_data": {
            "gender": "neuter",
            "declension_group": "neuter_i",
            "cases": {
                "singular": {
                    "nominative": "το σπίτι",
                    "genitive": "του σπιτιού",
                    "accusative": "το σπίτι",
                    "vocative": "σπίτι",
                },
                "plural": {
                    "nominative": "τα σπίτια",
                    "genitive": "των σπιτιών",
                    "accusative": "τα σπίτια",
                    "vocative": "σπίτια",
                },
            },
        },
        "examples": [
            {
                "id": 1,
                "greek": "Το σπίτι μου είναι μεγάλο.",
                "english": "My house is big.",
                "russian": "Мой дом большой.",
            },
            {
                "id": 2,
                "greek": "Πηγαίνω στο σπίτι.",
                "english": "I'm going home.",
                "russian": "Я иду домой.",
            },
        ],
    }
)


def _make_response(content: str) -> OpenRouterResponse:
    """Return a mock OpenRouterResponse with the given content."""
    return OpenRouterResponse(
        content=content,
        model="google/gemini-2.5-flash-lite",
        usage=None,
        latency_ms=100.0,
    )


def _make_lemma(**overrides: object) -> NormalizedLemma:
    """Return a NormalizedLemma with sensible defaults, updated by overrides."""
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


def _make_noun_data(
    gender: str = "masculine",
    declension_group: str = "masculine_os",
    nominative: str = "ο άνθρωπος",
) -> GeneratedNounData:
    """Build a GeneratedNounData with controllable grammar fields."""
    case_set = GeneratedNounCaseSet(
        nominative=nominative,
        genitive="του ανθρώπου",
        accusative="τον άνθρωπο",
        vocative="άνθρωπε",
    )
    return GeneratedNounData(
        lemma="άνθρωπος",
        part_of_speech="noun",
        translation_en="person",
        translation_ru="человек",
        pronunciation="/ˈan.θro.pos/",
        grammar_data=GeneratedNounGrammar(
            gender=gender,  # type: ignore[arg-type]
            declension_group=declension_group,
            cases=GeneratedNounCases(singular=case_set, plural=case_set),
        ),
        examples=[
            GeneratedExample(id=1, greek="α", english="a", russian="а"),
            GeneratedExample(id=2, greek="β", english="b", russian="б"),
        ],
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_openrouter() -> AsyncMock:
    """Return an AsyncMock standing in for OpenRouterService."""
    return AsyncMock(spec=OpenRouterService)


@pytest.fixture()
def service(mock_openrouter: AsyncMock) -> NounDataGenerationService:
    """Return a NounDataGenerationService wired to the mock OpenRouter."""
    return NounDataGenerationService(openrouter_service=mock_openrouter)


@pytest.fixture()
def _reset_singleton() -> object:
    """Reset the NounDataGenerationService singleton before and after each test."""
    import src.services.noun_data_generation_service as mod

    mod._noun_data_generation_service = None
    yield
    mod._noun_data_generation_service = None


# ---------------------------------------------------------------------------
# Tests: successful generation
# ---------------------------------------------------------------------------


class TestGenerate:
    """Tests for NounDataGenerationService.generate()."""

    @pytest.mark.asyncio
    async def test_success_returns_generated_noun_data(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """generate() returns a fully populated GeneratedNounData on success."""
        mock_openrouter.complete.return_value = _make_response(_VALID_NOUN_JSON)

        result = await service.generate(_make_lemma())

        assert result.lemma == "σπίτι"
        assert result.part_of_speech == "noun"
        assert result.translation_en == "house, home"
        assert result.pronunciation == "/spí·ti/"
        assert result.grammar_data.gender == "neuter"
        assert result.grammar_data.declension_group == "neuter_i"
        assert result.grammar_data.cases.singular.nominative == "το σπίτι"
        assert len(result.examples) == 2

    @pytest.mark.asyncio
    async def test_calls_complete_exactly_once(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """generate() calls OpenRouterService.complete() exactly once."""
        mock_openrouter.complete.return_value = _make_response(_VALID_NOUN_JSON)
        await service.generate(_make_lemma())
        mock_openrouter.complete.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_system_prompt_contains_masculine_example(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """System prompt includes the άνθρωπος masculine few-shot example."""
        mock_openrouter.complete.return_value = _make_response(_VALID_NOUN_JSON)
        await service.generate(_make_lemma())

        call_args = mock_openrouter.complete.call_args
        messages = call_args.kwargs["messages"]
        system_content = messages[0]["content"]
        assert "άνθρωπος" in system_content
        assert "masculine_os" in system_content

    @pytest.mark.asyncio
    async def test_system_prompt_contains_neuter_example(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """System prompt includes the βιβλίο neuter few-shot example."""
        mock_openrouter.complete.return_value = _make_response(_VALID_NOUN_JSON)
        await service.generate(_make_lemma())

        call_args = mock_openrouter.complete.call_args
        messages = call_args.kwargs["messages"]
        system_content = messages[0]["content"]
        assert "βιβλίο" in system_content
        assert "neuter_o" in system_content

    @pytest.mark.asyncio
    async def test_user_prompt_contains_lemma_and_gender(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """User prompt includes the lemma and gender from NormalizedLemma."""
        mock_openrouter.complete.return_value = _make_response(_VALID_NOUN_JSON)
        lemma = _make_lemma(lemma="γάτα", gender="feminine")
        await service.generate(lemma)

        call_args = mock_openrouter.complete.call_args
        messages = call_args.kwargs["messages"]
        user_content = messages[1]["content"]
        assert "γάτα" in user_content
        assert "feminine" in user_content

    @pytest.mark.asyncio
    async def test_user_prompt_contains_article(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """User prompt includes the article from NormalizedLemma."""
        mock_openrouter.complete.return_value = _make_response(_VALID_NOUN_JSON)
        await service.generate(_make_lemma(article="η"))

        call_args = mock_openrouter.complete.call_args
        user_content = call_args.kwargs["messages"][1]["content"]
        assert "η" in user_content

    @pytest.mark.asyncio
    async def test_user_prompt_unknown_gender_when_none(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """User prompt shows 'unknown' when NormalizedLemma.gender is None."""
        mock_openrouter.complete.return_value = _make_response(_VALID_NOUN_JSON)
        await service.generate(_make_lemma(gender=None))

        user_content = mock_openrouter.complete.call_args.kwargs["messages"][1]["content"]
        assert "unknown" in user_content

    @pytest.mark.asyncio
    async def test_user_prompt_unknown_article_when_none(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """User prompt shows 'unknown' when NormalizedLemma.article is None."""
        mock_openrouter.complete.return_value = _make_response(_VALID_NOUN_JSON)
        await service.generate(_make_lemma(article=None))

        user_content = mock_openrouter.complete.call_args.kwargs["messages"][1]["content"]
        assert "unknown" in user_content

    @pytest.mark.asyncio
    async def test_user_prompt_contains_json_schema(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """User prompt contains the GeneratedNounData JSON schema."""
        mock_openrouter.complete.return_value = _make_response(_VALID_NOUN_JSON)
        await service.generate(_make_lemma())

        user_content = mock_openrouter.complete.call_args.kwargs["messages"][1]["content"]
        schema_key = list(GeneratedNounData.model_json_schema().keys())[0]
        assert schema_key in user_content  # e.g. "$defs" or "properties" present

    @pytest.mark.asyncio
    async def test_user_prompt_contains_confidence(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """User prompt contains the confidence value from NormalizedLemma."""
        mock_openrouter.complete.return_value = _make_response(_VALID_NOUN_JSON)
        await service.generate(_make_lemma(confidence=0.95))

        user_content = mock_openrouter.complete.call_args.kwargs["messages"][1]["content"]
        assert "0.95" in user_content

    @pytest.mark.asyncio
    async def test_response_format_is_json_object(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """complete() is called with response_format={"type": "json_object"}."""
        mock_openrouter.complete.return_value = _make_response(_VALID_NOUN_JSON)
        await service.generate(_make_lemma())

        call_kwargs = mock_openrouter.complete.call_args.kwargs
        assert call_kwargs["response_format"] == {"type": "json_object"}


# ---------------------------------------------------------------------------
# Tests: declension group verification
# ---------------------------------------------------------------------------


class TestDeclensionGroupVerification:
    """Tests for the _verify_declension_group logic inside generate()."""

    @pytest.mark.asyncio
    async def test_match_kept(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """When LLM declension_group matches derived group, it is kept unchanged."""
        # άνθρωπος ends in -ος → masculine_os; LLM also says masculine_os
        data = _make_noun_data(
            gender="masculine",
            declension_group="masculine_os",
            nominative="ο άνθρωπος",
        )
        mock_openrouter.complete.return_value = _make_response(data.model_dump_json())
        result = await service.generate(_make_lemma(lemma="άνθρωπος", gender="masculine"))
        assert result.grammar_data.declension_group == "masculine_os"

    @pytest.mark.asyncio
    async def test_mismatch_overridden_with_warning(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
        caplog_loguru: pytest.LogCaptureFixture,
    ) -> None:
        """When LLM declension_group mismatches derived group, it is overridden with a WARNING."""
        import logging

        # LLM says masculine_as but nominative ends in -ος → derived is masculine_os
        data = _make_noun_data(
            gender="masculine",
            declension_group="masculine_as",
            nominative="ο άνθρωπος",
        )
        mock_openrouter.complete.return_value = _make_response(data.model_dump_json())

        with caplog_loguru.at_level(logging.WARNING):
            result = await service.generate(_make_lemma(lemma="άνθρωπος", gender="masculine"))

        assert result.grammar_data.declension_group == "masculine_os"
        assert any(
            "mismatch" in r.message.lower() or "overrid" in r.message.lower()
            for r in caplog_loguru.records
        )

    @pytest.mark.asyncio
    async def test_rule_failure_keeps_llm_value_with_warning(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
        caplog_loguru: pytest.LogCaptureFixture,
    ) -> None:
        """When suffix rule fails (unrecognized ending), LLM value is kept with a WARNING."""
        import logging

        # Unrecognized ending — no rule matches
        data = _make_noun_data(
            gender="masculine",
            declension_group="masculine_custom",
            nominative="ξξξ",
        )
        mock_openrouter.complete.return_value = _make_response(data.model_dump_json())

        with caplog_loguru.at_level(logging.WARNING):
            result = await service.generate(_make_lemma(lemma="ξξξ", gender="masculine"))

        assert result.grammar_data.declension_group == "masculine_custom"
        assert len(caplog_loguru.records) >= 1


# ---------------------------------------------------------------------------
# Tests: _derive_declension_group (module-level function)
# ---------------------------------------------------------------------------


class TestDeriveDeclensionGroup:
    """Tests for the module-level _derive_declension_group() function."""

    def test_masculine_os(self) -> None:
        """Words ending in -ος (masculine) → masculine_os."""
        assert _derive_declension_group("masculine", "άνθρωπος") == "masculine_os"

    def test_masculine_os_with_article(self) -> None:
        """Article is stripped before suffix matching."""
        assert _derive_declension_group("masculine", "ο άνθρωπος") == "masculine_os"

    def test_masculine_as(self) -> None:
        """Words ending in -ας (masculine) → masculine_as."""
        assert _derive_declension_group("masculine", "πατέρας") == "masculine_as"

    def test_masculine_is_accented(self) -> None:
        """Words ending in -ής (masculine, accented) → masculine_is."""
        assert _derive_declension_group("masculine", "μαθητής") == "masculine_is"

    def test_masculine_is_unaccented(self) -> None:
        """Words ending in -ης (masculine, unaccented) → masculine_is."""
        assert _derive_declension_group("masculine", "εργάτης") == "masculine_is"

    def test_feminine_a(self) -> None:
        """Words ending in -α (feminine) → feminine_a."""
        assert _derive_declension_group("feminine", "γάτα") == "feminine_a"

    def test_feminine_a_with_article(self) -> None:
        """Article η is stripped before suffix matching for feminine."""
        assert _derive_declension_group("feminine", "η γάτα") == "feminine_a"

    def test_feminine_i_accented(self) -> None:
        """Words ending in -ή (feminine, accented eta) → feminine_i."""
        assert _derive_declension_group("feminine", "ψυχή") == "feminine_i"

    def test_feminine_i_unaccented(self) -> None:
        """Words ending in -η (feminine, unaccented eta) → feminine_i."""
        assert _derive_declension_group("feminine", "αδελφή") == "feminine_i"

    def test_feminine_os(self) -> None:
        """Words ending in -ος (feminine) → feminine_os."""
        assert _derive_declension_group("feminine", "οδός") == "feminine_os"

    def test_feminine_os_with_article(self) -> None:
        """Article η is stripped before matching feminine -ος ending."""
        assert _derive_declension_group("feminine", "η οδός") == "feminine_os"

    def test_neuter_o(self) -> None:
        """Words ending in -ο (neuter) → neuter_o."""
        assert _derive_declension_group("neuter", "βιβλίο") == "neuter_o"

    def test_neuter_i(self) -> None:
        """Words ending in -ι (neuter) → neuter_i."""
        assert _derive_declension_group("neuter", "σπίτι") == "neuter_i"

    def test_neuter_ma(self) -> None:
        """Words ending in -μα (neuter) → neuter_ma (checked before -α)."""
        assert _derive_declension_group("neuter", "πράγμα") == "neuter_ma"

    def test_neuter_os(self) -> None:
        """Words ending in -ος (neuter) → neuter_os."""
        assert _derive_declension_group("neuter", "δάσος") == "neuter_os"

    def test_neuter_with_article(self) -> None:
        """Article το is stripped before suffix matching for neuter."""
        assert _derive_declension_group("neuter", "το σπίτι") == "neuter_i"

    def test_unrecognized_ending_returns_none(self) -> None:
        """Unrecognized word ending returns None."""
        assert _derive_declension_group("masculine", "ξξξ") is None

    def test_unknown_gender_returns_none(self) -> None:
        """Unknown gender returns None (no rules defined for it)."""
        assert _derive_declension_group("unknown", "τεστ") is None

    def test_empty_string_returns_none(self) -> None:
        """Empty string nominative returns None (no suffix matches)."""
        assert _derive_declension_group("masculine", "") is None


# ---------------------------------------------------------------------------
# Tests: error handling
# ---------------------------------------------------------------------------


class TestErrorHandling:
    """Tests for NounGenerationError raised by _parse_response."""

    @pytest.mark.asyncio
    async def test_invalid_json_raises_noun_generation_error(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """Invalid JSON response raises NounGenerationError with raw_content set."""
        bad_content = "not valid json {{"
        mock_openrouter.complete.return_value = _make_response(bad_content)

        with pytest.raises(NounGenerationError) as exc_info:
            await service.generate(_make_lemma())

        assert exc_info.value.raw_content == bad_content

    @pytest.mark.asyncio
    async def test_missing_required_field_raises_noun_generation_error(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """JSON missing required field raises NounGenerationError."""
        incomplete = json.dumps({"part_of_speech": "noun", "translation_en": "x"})
        mock_openrouter.complete.return_value = _make_response(incomplete)

        with pytest.raises(NounGenerationError) as exc_info:
            await service.generate(_make_lemma())

        assert exc_info.value.raw_content == incomplete

    @pytest.mark.asyncio
    async def test_wrong_part_of_speech_raises_noun_generation_error(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """JSON with part_of_speech != 'noun' raises NounGenerationError via Pydantic."""
        wrong_pos = json.loads(_VALID_NOUN_JSON)
        wrong_pos["part_of_speech"] = "verb"
        mock_openrouter.complete.return_value = _make_response(json.dumps(wrong_pos))

        with pytest.raises(NounGenerationError) as exc_info:
            await service.generate(_make_lemma())

        assert exc_info.value.raw_content is not None

    @pytest.mark.asyncio
    async def test_openrouter_api_error_propagates_unchanged(
        self,
        service: NounDataGenerationService,
        mock_openrouter: AsyncMock,
    ) -> None:
        """OpenRouterAPIError from complete() propagates without wrapping."""
        mock_openrouter.complete.side_effect = OpenRouterAPIError(
            status_code=429, detail="rate limit exceeded"
        )

        with pytest.raises(OpenRouterAPIError) as exc_info:
            await service.generate(_make_lemma())

        assert type(exc_info.value) is OpenRouterAPIError
        assert exc_info.value.status_code == 429


# ---------------------------------------------------------------------------
# Tests: singleton factory
# ---------------------------------------------------------------------------


class TestGetNounDataGenerationService:
    """Tests for the get_noun_data_generation_service() singleton factory."""

    def test_returns_same_instance_on_repeated_calls(
        self,
        _reset_singleton: object,
    ) -> None:
        """get_noun_data_generation_service() returns the same instance on repeated calls."""
        with patch("src.services.noun_data_generation_service.get_openrouter_service"):
            first = get_noun_data_generation_service()
            second = get_noun_data_generation_service()
        assert first is second

    def test_reset_creates_fresh_instance(
        self,
        _reset_singleton: object,
    ) -> None:
        """Resetting the module-level variable creates a fresh instance."""
        import src.services.noun_data_generation_service as mod

        with patch("src.services.noun_data_generation_service.get_openrouter_service"):
            first = get_noun_data_generation_service()
            mod._noun_data_generation_service = None
            second = get_noun_data_generation_service()

        assert first is not second
