"""Cross-AI verification service comparing two LLM generations of the same noun."""

import json
from collections.abc import Callable

from pydantic import ValidationError  # noqa: F401 (propagated naturally, imported for clarity)

from src.core.logging import get_logger
from src.schemas.nlp import (
    CrossAIVerificationResult,
    FieldComparisonResult,
    GeneratedNounData,
    NormalizedLemma,
)
from src.services.noun_data_generation_service import (  # noqa: WPS450 (private import by design)
    _SYSTEM_PROMPT,
    _USER_PROMPT_TEMPLATE,
)
from src.services.openrouter_service import OpenRouterService, get_openrouter_service
from src.utils.greek_text import _strip_article  # noqa: WPS450 (private import by design)

logger = get_logger(__name__)


class CrossAIVerificationService:
    """Verifies LLM-generated noun data by comparing with a secondary model generation."""

    _SECONDARY_MODEL = "openai/gpt-4.1-mini"
    _FIELD_WEIGHTS: dict[str, float] = {
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
        "translation_ru": 1.0,
        "pronunciation": 1.0,
    }

    def __init__(self, openrouter_service: OpenRouterService) -> None:
        self._openrouter = openrouter_service

    async def verify(
        self, primary: GeneratedNounData, normalized_lemma: NormalizedLemma
    ) -> CrossAIVerificationResult:
        """Compare primary generation against a secondary model generation."""
        try:
            messages = self._build_messages(normalized_lemma)
            response = await self._openrouter.complete(
                messages=messages,
                model=self._SECONDARY_MODEL,
                response_format={"type": "json_object"},
            )
            secondary_data = self._parse_response(response.content)
            comparisons = self._compare_fields(primary, secondary_data)
            total_weight = sum(self._FIELD_WEIGHTS.values())
            agreement = sum(c.weight for c in comparisons if c.agrees) / total_weight
            logger.info(
                "Cross-AI verification complete",
                extra={"lemma": normalized_lemma.lemma, "overall_agreement": agreement},
            )
            return CrossAIVerificationResult(
                comparisons=comparisons,
                overall_agreement=agreement,
                secondary_model=self._SECONDARY_MODEL,
                secondary_generation=secondary_data,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Cross-AI verification failed: %s",
                exc,
                extra={"lemma": normalized_lemma.lemma},
            )
            return CrossAIVerificationResult(error=str(exc))

    def _build_messages(self, normalized_lemma: NormalizedLemma) -> list[dict[str, str]]:
        user_content = _USER_PROMPT_TEMPLATE.format(
            lemma=normalized_lemma.lemma,
            gender=normalized_lemma.gender or "",
            article=normalized_lemma.article or "",
            pos=normalized_lemma.pos,
            confidence=normalized_lemma.confidence,
            schema=json.dumps(GeneratedNounData.model_json_schema(), indent=2),
        )
        return [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]

    def _parse_response(self, content: str) -> GeneratedNounData:
        raw = json.loads(content)
        return GeneratedNounData.model_validate(raw)

    def _compare_fields(
        self, primary: GeneratedNounData, secondary: GeneratedNounData
    ) -> list[FieldComparisonResult]:
        comparisons: list[FieldComparisonResult] = []
        for field_path, weight in self._FIELD_WEIGHTS.items():
            primary_val = self._get_field_value(primary, field_path)
            secondary_val = self._get_field_value(secondary, field_path)

            if field_path == "translation_en_plural":
                agrees = primary_val == secondary_val
            elif field_path.startswith("cases."):
                primary_bare = _strip_article(primary_val) if primary_val is not None else None
                secondary_bare = (
                    _strip_article(secondary_val) if secondary_val is not None else None
                )
                agrees = primary_bare == secondary_bare
            else:
                agrees = primary_val == secondary_val

            display_primary = str(primary_val) if primary_val is not None else "None"
            display_secondary = str(secondary_val) if secondary_val is not None else "None"

            logger.debug(
                "Field comparison %s: agrees=%s",
                field_path,
                agrees,
                extra={
                    "primary_value": display_primary,
                    "secondary_value": display_secondary,
                },
            )
            comparisons.append(
                FieldComparisonResult(
                    field_path=field_path,
                    primary_value=display_primary,
                    secondary_value=display_secondary,
                    agrees=agrees,
                    weight=weight,
                )
            )
        return comparisons

    @staticmethod
    def _get_field_value(data: GeneratedNounData, field_path: str) -> str | None:
        accessors: dict[str, Callable[[GeneratedNounData], str | None]] = {
            "lemma": lambda d: d.lemma,
            "grammar_data.gender": lambda d: d.grammar_data.gender,
            "grammar_data.declension_group": lambda d: d.grammar_data.declension_group,
            "cases.singular.nominative": lambda d: d.grammar_data.cases.singular.nominative,
            "cases.singular.genitive": lambda d: d.grammar_data.cases.singular.genitive,
            "cases.singular.accusative": lambda d: d.grammar_data.cases.singular.accusative,
            "cases.singular.vocative": lambda d: d.grammar_data.cases.singular.vocative,
            "cases.plural.nominative": lambda d: d.grammar_data.cases.plural.nominative,
            "cases.plural.genitive": lambda d: d.grammar_data.cases.plural.genitive,
            "cases.plural.accusative": lambda d: d.grammar_data.cases.plural.accusative,
            "cases.plural.vocative": lambda d: d.grammar_data.cases.plural.vocative,
            "translation_en": lambda d: d.translation_en,
            "translation_en_plural": lambda d: d.translation_en_plural,
            "translation_ru": lambda d: d.translation_ru,
            "pronunciation": lambda d: d.pronunciation,
        }
        accessor = accessors.get(field_path)
        if accessor is None:
            raise ValueError(f"Unknown field_path: {field_path}")
        return accessor(data)


_cross_ai_verification_service: CrossAIVerificationService | None = None


def get_cross_ai_verification_service() -> CrossAIVerificationService:
    """Return the singleton CrossAIVerificationService instance."""
    global _cross_ai_verification_service
    if _cross_ai_verification_service is None:
        _cross_ai_verification_service = CrossAIVerificationService(
            openrouter_service=get_openrouter_service(),
        )
    return _cross_ai_verification_service
