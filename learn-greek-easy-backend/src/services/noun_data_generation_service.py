"""Noun data generation service using OpenRouter LLM."""

import json

from pydantic import ValidationError

from src.core.exceptions import NounGenerationError
from src.core.logging import get_logger
from src.schemas.nlp import GeneratedNounData, NormalizedLemma
from src.services.openrouter_service import OpenRouterService, get_openrouter_service
from src.utils.greek_text import (  # noqa: WPS450 (private import by design)
    _strip_article,
    normalize_greek_accents,
)

logger = get_logger(__name__)

_SYSTEM_PROMPT = """You are a Greek linguistics expert. Generate complete noun data as structured JSON.

Rules:
1. Include all 4 cases (nominative, genitive, accusative, vocative) for both singular and plural.
2. Use standard Modern Greek declension forms.
3. Gender must be exactly one of: masculine, feminine, neuter.
4. Declension forms: include the definite article in nominative, genitive, and accusative. Vocative has NO article.
5. Include declension_group: masculine_os, masculine_as, masculine_is, feminine_a, feminine_i, feminine_os, neuter_o, neuter_i, neuter_ma, neuter_os.
6. Include exactly 2 example sentences with Greek, English, and Russian translations. Use id values 1 and 2. Examples should use the noun naturally in context.
7. Include English and Russian translations of the lemma. Include translation_en_plural for the English plural form.
8. Pronunciation must be in IPA format.
9. For indeclinable nouns (e.g., foreign loanwords like σουπερμάρκετ), all case forms are identical (the bare word), with no article change except the standard article for that gender/case.

Example 1 (masculine, masculine_os):
{
  "lemma": "άνθρωπος",
  "part_of_speech": "noun",
  "translation_en": "human, person",
  "translation_en_plural": "humans, people",
  "translation_ru": "человек",
  "pronunciation": "/ˈan.θro.pos/",
  "grammar_data": {
    "gender": "masculine",
    "declension_group": "masculine_os",
    "cases": {
      "singular": {
        "nominative": "ο άνθρωπος",
        "genitive": "του ανθρώπου",
        "accusative": "τον άνθρωπο",
        "vocative": "άνθρωπε"
      },
      "plural": {
        "nominative": "οι άνθρωποι",
        "genitive": "των ανθρώπων",
        "accusative": "τους ανθρώπους",
        "vocative": "άνθρωποι"
      }
    }
  },
  "examples": [
    {"id": 1, "greek": "Ο άνθρωπος διαβάζει ένα βιβλίο.", "english": "The person is reading a book.", "russian": "Человек читает книгу."},
    {"id": 2, "greek": "Οι άνθρωποι μιλούν ελληνικά.", "english": "The people speak Greek.", "russian": "Люди говорят по-гречески."}
  ]
}

Example 2 (feminine, feminine_a):
{
  "lemma": "θάλασσα",
  "part_of_speech": "noun",
  "translation_en": "sea",
  "translation_en_plural": "seas",
  "translation_ru": "море",
  "pronunciation": "/ˈθa.la.sa/",
  "grammar_data": {
    "gender": "feminine",
    "declension_group": "feminine_a",
    "cases": {
      "singular": {
        "nominative": "η θάλασσα",
        "genitive": "της θάλασσας",
        "accusative": "τη θάλασσα",
        "vocative": "θάλασσα"
      },
      "plural": {
        "nominative": "οι θάλασσες",
        "genitive": "των θαλασσών",
        "accusative": "τις θάλασσες",
        "vocative": "θάλασσες"
      }
    }
  },
  "examples": [
    {"id": 1, "greek": "Η θάλασσα είναι γαλάζια σήμερα.", "english": "The sea is blue today.", "russian": "Море сегодня голубое."},
    {"id": 2, "greek": "Μου αρέσει να κολυμπάω στη θάλασσα.", "english": "I like to swim in the sea.", "russian": "Мне нравится плавать в море."}
  ]
}

Example 3 (neuter, neuter_o):
{
  "lemma": "βιβλίο",
  "part_of_speech": "noun",
  "translation_en": "book",
  "translation_en_plural": "books",
  "translation_ru": "книга",
  "pronunciation": "/viˈvli.o/",
  "grammar_data": {
    "gender": "neuter",
    "declension_group": "neuter_o",
    "cases": {
      "singular": {
        "nominative": "το βιβλίο",
        "genitive": "του βιβλίου",
        "accusative": "το βιβλίο",
        "vocative": "βιβλίο"
      },
      "plural": {
        "nominative": "τα βιβλία",
        "genitive": "των βιβλίων",
        "accusative": "τα βιβλία",
        "vocative": "βιβλία"
      }
    }
  },
  "examples": [
    {"id": 1, "greek": "Αυτό το βιβλίο είναι ενδιαφέρον.", "english": "This book is interesting.", "russian": "Эта книга интересная."},
    {"id": 2, "greek": "Διαβάζω πολλά βιβλία.", "english": "I read many books.", "russian": "Я читаю много книг."}
  ]
}
"""

_USER_PROMPT_TEMPLATE = """Generate complete noun data for the Greek word:

Lemma: {lemma}
Gender: {gender}
Article: {article}
Part of Speech: {pos}

Respond with valid JSON matching the exact structure shown in the examples above."""

_DECLENSION_RULES: dict[str, list[tuple[str, str]]] = {
    "masculine": [
        ("-ος", "masculine_os"),
        ("-ας", "masculine_as"),
        ("-ής", "masculine_is"),
        ("-ης", "masculine_is"),
    ],
    "feminine": [
        ("-ος", "feminine_os"),
        ("-α", "feminine_a"),
        ("-η", "feminine_i"),
    ],
    "neuter": [
        ("-μα", "neuter_ma"),
        ("-ος", "neuter_os"),
        ("-ο", "neuter_o"),
        ("-ι", "neuter_i"),
    ],
}


def _derive_declension_group(gender: str, nominative_singular: str) -> str | None:
    """Derive declension group from gender and nominative singular form."""
    bare = _strip_article(nominative_singular)
    bare_normalized = normalize_greek_accents(bare)
    rules = _DECLENSION_RULES.get(gender)
    if rules is None:
        return None
    for suffix, group in rules:
        suffix_normalized = normalize_greek_accents(suffix.lstrip("-"))
        if bare_normalized.endswith(suffix_normalized):
            return group
    return None


class NounDataGenerationService:
    """Service for generating Greek noun data using OpenRouter LLM."""

    def __init__(self, openrouter_service: OpenRouterService) -> None:
        self._openrouter = openrouter_service

    async def generate(
        self,
        normalized_lemma: NormalizedLemma,
        pre_filled_en: str | None = None,
        pre_filled_ru: str | None = None,
    ) -> GeneratedNounData:
        """Generate complete noun data for a normalized lemma."""
        messages = self._build_messages(normalized_lemma, pre_filled_en, pre_filled_ru)
        response = await self._openrouter.complete(
            messages=messages,
            response_format={"type": "json_object"},
        )
        result = self._parse_response(response.content)
        result = self._verify_declension_group(result)
        return result

    def _build_messages(
        self,
        normalized_lemma: NormalizedLemma,
        pre_filled_en: str | None = None,
        pre_filled_ru: str | None = None,
    ) -> list[dict[str, str]]:
        user_content = _USER_PROMPT_TEMPLATE.format(
            lemma=normalized_lemma.lemma,
            gender=normalized_lemma.gender or "unknown",
            article=normalized_lemma.article or "unknown",
            pos=normalized_lemma.pos,
        )
        # Append pre-filled translations if available
        if pre_filled_en or pre_filled_ru:
            pre_fill_lines = [
                "\nUse these exact translations from our dictionary (do not rephrase):"
            ]
            if pre_filled_en:
                pre_fill_lines.append(f"English: {pre_filled_en}")
            if pre_filled_ru:
                pre_fill_lines.append(f"Russian: {pre_filled_ru}")
            user_content += "\n".join(pre_fill_lines)
        return [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]

    def _parse_response(self, content: str) -> GeneratedNounData:
        try:
            data = json.loads(content)
        except json.JSONDecodeError as err:
            raise NounGenerationError(
                detail=f"Failed to parse LLM response as JSON: {err}",
                raw_content=content,
            ) from err

        try:
            result = GeneratedNounData.model_validate(data)
        except ValidationError as err:
            raise NounGenerationError(
                detail=f"LLM response failed schema validation: {err}",
                raw_content=content,
            ) from err

        if result.part_of_speech != "noun":
            raise NounGenerationError(
                detail=f"Expected part_of_speech='noun', got '{result.part_of_speech}'",
                raw_content=content,
            )

        return result

    def _verify_declension_group(self, data: GeneratedNounData) -> GeneratedNounData:
        nom_sg = data.grammar_data.cases.singular.nominative
        derived = _derive_declension_group(data.grammar_data.gender, nom_sg)
        if derived is None:
            logger.warning(
                "Could not derive declension group",
                extra={
                    "lemma": data.lemma,
                    "llm_group": data.grammar_data.declension_group,
                },
            )
            return data
        if derived != data.grammar_data.declension_group:
            logger.warning(
                "Declension group mismatch — overriding",
                extra={
                    "lemma": data.lemma,
                    "llm_group": data.grammar_data.declension_group,
                    "derived_group": derived,
                },
            )
            data.grammar_data.declension_group = derived
        return data


_noun_data_generation_service: NounDataGenerationService | None = None


def get_noun_data_generation_service() -> NounDataGenerationService:
    """Return the singleton NounDataGenerationService instance."""
    global _noun_data_generation_service
    if _noun_data_generation_service is None:
        _noun_data_generation_service = NounDataGenerationService(
            openrouter_service=get_openrouter_service(),
        )
    return _noun_data_generation_service
