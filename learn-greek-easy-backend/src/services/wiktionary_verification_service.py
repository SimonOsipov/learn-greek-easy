"""Wiktionary-based local verification service (L2 verification source)."""

from __future__ import annotations

import unicodedata

from src.schemas.nlp import (
    CheckResult,
    FieldVerificationResult,
    GeneratedNounData,
    LocalVerificationResult,
)
from src.utils.greek_text import _strip_article  # noqa: WPS450
from src.utils.greek_text import normalize_ipa

# Maps flat JSONB keys to GeneratedNounData field_paths
_FORM_KEY_TO_PATH: dict[str, str] = {
    "nominative_singular": "cases.singular.nominative",
    "genitive_singular": "cases.singular.genitive",
    "accusative_singular": "cases.singular.accusative",
    "vocative_singular": "cases.singular.vocative",
    "nominative_plural": "cases.plural.nominative",
    "genitive_plural": "cases.plural.genitive",
    "accusative_plural": "cases.plural.accusative",
    "vocative_plural": "cases.plural.vocative",
}

# Maps field_paths to generated noun data accessors (number, case)
_PATH_TO_GENERATED: dict[str, tuple[str, str]] = {
    "cases.singular.nominative": ("singular", "nominative"),
    "cases.singular.genitive": ("singular", "genitive"),
    "cases.singular.accusative": ("singular", "accusative"),
    "cases.singular.vocative": ("singular", "vocative"),
    "cases.plural.nominative": ("plural", "nominative"),
    "cases.plural.genitive": ("plural", "genitive"),
    "cases.plural.accusative": ("plural", "accusative"),
    "cases.plural.vocative": ("plural", "vocative"),
}


def _get_generated_form(data: GeneratedNounData, number: str, case: str) -> str | None:
    """Extract a case form from GeneratedNounData.

    Cases live at data.grammar_data.cases.{number}.{case}.
    """
    grammar = data.grammar_data
    if grammar is None:
        return None
    cases = grammar.cases
    if cases is None:
        return None
    number_set = getattr(cases, number, None)
    if number_set is None:
        return None
    return getattr(number_set, case, None)


def _compute_tier(fields: list[FieldVerificationResult]) -> str:
    fail_count = sum(1 for f in fields if f.status == "fail")
    warn_count = sum(1 for f in fields if f.status == "warn")
    if fail_count >= 3:
        return "manual_review"
    if fail_count >= 1 or warn_count > 2:
        return "quick_review"
    return "auto_approve"


class WiktionaryVerificationService:
    """Independent L2 verification using Wiktionary morphology data.

    Does NOT extend LocalVerificationService. Produces LocalVerificationResult
    with the same schema, but all checks use reference_source='wiktionary'.
    """

    def verify(
        self,
        data: GeneratedNounData,
        wiktionary_forms: dict[str, str] | None,
        wiktionary_gender: str | None,
        wiktionary_pronunciation: str | None,
        wiktionary_glosses: str | None,
    ) -> LocalVerificationResult:
        """Run Wiktionary-based verification against generated noun data.

        Returns LocalVerificationResult. Callers should only call this when
        at least one wiktionary parameter is non-None/non-empty.
        """
        fields: list[FieldVerificationResult] = []

        # Declension checks (8 case forms)
        if wiktionary_forms:
            fields.extend(self._check_declensions(data, wiktionary_forms))

        # Gender check
        if wiktionary_gender is not None:
            fields.append(self._check_gender(data, wiktionary_gender))

        # Pronunciation check (warn only)
        if wiktionary_pronunciation is not None:
            fields.append(self._check_pronunciation(data, wiktionary_pronunciation))

        # Translation EN check (warn only)
        if wiktionary_glosses is not None:
            fields.append(self._check_translation_en(data, wiktionary_glosses))

        tier = _compute_tier(fields)
        fail_count = sum(1 for f in fields if f.status == "fail")
        warn_count = sum(1 for f in fields if f.status == "warn")
        summary = f"Wiktionary: {len(fields)} checks — {fail_count} fail, {warn_count} warn"

        return LocalVerificationResult(
            fields=fields,
            tier=tier,
            summary=summary,
        )

    def _check_declensions(
        self, data: GeneratedNounData, wiktionary_forms: dict[str, str]
    ) -> list[FieldVerificationResult]:
        results = []
        for form_key, field_path in _FORM_KEY_TO_PATH.items():
            if form_key not in wiktionary_forms:
                continue
            wikt_form = unicodedata.normalize("NFC", _strip_article(wiktionary_forms[form_key]))
            number, case = _PATH_TO_GENERATED[field_path]
            generated_raw = _get_generated_form(data, number, case)
            if generated_raw is None:
                continue
            generated_bare = unicodedata.normalize("NFC", _strip_article(generated_raw))
            if generated_bare == wikt_form:
                status = "pass"
                message = None
            else:
                status = "fail"
                message = f"Generated '{generated_bare}' != Wiktionary '{wikt_form}'"
            results.append(
                FieldVerificationResult(
                    field_path=field_path,
                    status=status,
                    checks=[
                        CheckResult(
                            check_name="wiktionary_declension",
                            status=status,
                            message=message,
                            reference_value=wikt_form,
                            reference_source="wiktionary",
                        )
                    ],
                )
            )
        return results

    def _check_gender(
        self, data: GeneratedNounData, wiktionary_gender: str
    ) -> FieldVerificationResult:
        generated_gender = data.grammar_data.gender if data.grammar_data else None
        if generated_gender is not None and generated_gender.lower() == wiktionary_gender.lower():
            status = "pass"
            message = None
        else:
            status = "fail"
            message = f"Generated '{generated_gender}' != Wiktionary '{wiktionary_gender}'"
        return FieldVerificationResult(
            field_path="grammar_data.gender",
            status=status,
            checks=[
                CheckResult(
                    check_name="wiktionary_gender",
                    status=status,
                    message=message,
                    reference_value=wiktionary_gender,
                    reference_source="wiktionary",
                )
            ],
        )

    def _check_pronunciation(
        self, data: GeneratedNounData, wiktionary_pronunciation: str
    ) -> FieldVerificationResult:
        generated_pron = data.pronunciation
        wikt_norm = normalize_ipa(wiktionary_pronunciation)
        if generated_pron is not None:
            gen_norm = normalize_ipa(generated_pron)
            if gen_norm == wikt_norm:
                status = "pass"
                message = None
            else:
                status = "warn"
                message = f"IPA differs: generated '{gen_norm}' vs Wiktionary '{wikt_norm}'"
        else:
            status = "pass"
            message = None
        return FieldVerificationResult(
            field_path="pronunciation",
            status=status,
            checks=[
                CheckResult(
                    check_name="wiktionary_pronunciation",
                    status=status,
                    message=message,
                    reference_value=wikt_norm,
                    reference_source="wiktionary",
                )
            ],
        )

    def _check_translation_en(
        self, data: GeneratedNounData, wiktionary_glosses: str
    ) -> FieldVerificationResult:
        generated_en = data.translation_en
        glosses = [g.strip().lower() for g in wiktionary_glosses.split(";") if g.strip()]
        if generated_en is not None:
            gen_lower = generated_en.lower()
            matched = any(g in gen_lower or gen_lower in g for g in glosses)
            if matched:
                status = "pass"
                message = None
            else:
                status = "warn"
                message = f"Translation '{generated_en}' not found in Wiktionary glosses"
        else:
            status = "pass"
            message = None
        return FieldVerificationResult(
            field_path="translation_en",
            status=status,
            checks=[
                CheckResult(
                    check_name="wiktionary_translation",
                    status=status,
                    message=message,
                    reference_value=wiktionary_glosses,
                    reference_source="wiktionary",
                )
            ],
        )
