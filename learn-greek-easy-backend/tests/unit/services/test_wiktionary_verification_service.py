"""Unit tests for WiktionaryVerificationService."""

from __future__ import annotations

from src.schemas.nlp import (
    GeneratedExample,
    GeneratedNounCases,
    GeneratedNounCaseSet,
    GeneratedNounData,
    GeneratedNounGrammar,
)
from src.services.wiktionary_verification_service import WiktionaryVerificationService


def _make_noun_data(
    lemma: str = "το σπίτι",
    gender: str = "neuter",
    nominative_singular: str = "το σπίτι",
    genitive_singular: str = "του σπιτιού",
    accusative_singular: str = "το σπίτι",
    vocative_singular: str = "σπίτι",
    nominative_plural: str = "τα σπίτια",
    genitive_plural: str = "των σπιτιών",
    accusative_plural: str = "τα σπίτια",
    vocative_plural: str = "σπίτια",
    pronunciation: str = "/ˈspiti/",
    translation_en: str = "house",
    translation_ru: str = "дом",
) -> GeneratedNounData:
    return GeneratedNounData(
        lemma=lemma,
        part_of_speech="noun",
        translation_en=translation_en,
        translation_en_plural=None,
        translation_ru=translation_ru,
        translation_ru_plural=None,
        pronunciation=pronunciation,
        grammar_data=GeneratedNounGrammar(
            gender=gender,  # type: ignore[arg-type]
            declension_group="neuter_o",
            cases=GeneratedNounCases(
                singular=GeneratedNounCaseSet(
                    nominative=nominative_singular,
                    genitive=genitive_singular,
                    accusative=accusative_singular,
                    vocative=vocative_singular,
                ),
                plural=GeneratedNounCaseSet(
                    nominative=nominative_plural,
                    genitive=genitive_plural,
                    accusative=accusative_plural,
                    vocative=vocative_plural,
                ),
            ),
        ),
        examples=[
            GeneratedExample(
                id=1,
                greek="Το σπίτι είναι μεγάλο.",
                english="The house is big.",
                russian="Дом большой.",
            ),
            GeneratedExample(
                id=2, greek="Μένω στο σπίτι.", english="I stay at home.", russian="Я остаюсь дома."
            ),
        ],
    )


def _wiktionary_forms() -> dict[str, str]:
    return {
        "nominative_singular": "σπίτι",
        "genitive_singular": "σπιτιού",
        "accusative_singular": "σπίτι",
        "vocative_singular": "σπίτι",
        "nominative_plural": "σπίτια",
        "genitive_plural": "σπιτιών",
        "accusative_plural": "σπίτια",
        "vocative_plural": "σπίτια",
    }


class TestVerify:
    """Tests for WiktionaryVerificationService.verify()."""

    def test_all_forms_pass(self) -> None:
        service = WiktionaryVerificationService()
        data = _make_noun_data()
        forms = _wiktionary_forms()

        result = service.verify(
            data=data,
            wiktionary_forms=forms,
            wiktionary_gender="neuter",
            wiktionary_pronunciation=None,
            wiktionary_glosses=None,
        )

        assert result.tier == "auto_approve"
        fail_fields = [f for f in result.fields if f.status == "fail"]
        assert fail_fields == []

    def test_declension_mismatch_produces_fail(self) -> None:
        service = WiktionaryVerificationService()
        data = _make_noun_data()
        forms = dict(_wiktionary_forms())
        forms["nominative_singular"] = "σπίτιο"  # wrong form

        result = service.verify(
            data=data,
            wiktionary_forms=forms,
            wiktionary_gender=None,
            wiktionary_pronunciation=None,
            wiktionary_glosses=None,
        )

        nom_sg_field = next(f for f in result.fields if f.field_path == "cases.singular.nominative")
        assert nom_sg_field.status == "fail"
        assert "σπίτιο" in nom_sg_field.checks[0].message

    def test_gender_mismatch_produces_fail(self) -> None:
        service = WiktionaryVerificationService()
        data = _make_noun_data(gender="neuter")

        result = service.verify(
            data=data,
            wiktionary_forms=None,
            wiktionary_gender="masculine",  # mismatch
            wiktionary_pronunciation=None,
            wiktionary_glosses=None,
        )

        gender_field = next(f for f in result.fields if f.field_path == "grammar_data.gender")
        assert gender_field.status == "fail"

    def test_gender_match_produces_pass(self) -> None:
        service = WiktionaryVerificationService()
        data = _make_noun_data(gender="neuter")

        result = service.verify(
            data=data,
            wiktionary_forms=None,
            wiktionary_gender="neuter",
            wiktionary_pronunciation=None,
            wiktionary_glosses=None,
        )

        gender_field = next(f for f in result.fields if f.field_path == "grammar_data.gender")
        assert gender_field.status == "pass"

    def test_pronunciation_mismatch_produces_warn(self) -> None:
        service = WiktionaryVerificationService()
        data = _make_noun_data(pronunciation="/ˈspiti/")

        result = service.verify(
            data=data,
            wiktionary_forms=None,
            wiktionary_gender=None,
            wiktionary_pronunciation="/ˈnero/",  # different word
            wiktionary_glosses=None,
        )

        pron_field = next(f for f in result.fields if f.field_path == "pronunciation")
        assert pron_field.status == "warn"

    def test_pronunciation_match_produces_pass(self) -> None:
        service = WiktionaryVerificationService()
        # Generated uses delimiters/stress; wiktionary uses different formatting
        data = _make_noun_data(pronunciation="/ˈspiti/")

        result = service.verify(
            data=data,
            wiktionary_forms=None,
            wiktionary_gender=None,
            wiktionary_pronunciation="[ˈspiti]",  # same phonemes, different delimiters
            wiktionary_glosses=None,
        )

        pron_field = next(f for f in result.fields if f.field_path == "pronunciation")
        assert pron_field.status == "pass"

    def test_translation_mismatch_produces_warn(self) -> None:
        service = WiktionaryVerificationService()
        data = _make_noun_data(translation_en="house")

        result = service.verify(
            data=data,
            wiktionary_forms=None,
            wiktionary_gender=None,
            wiktionary_pronunciation=None,
            wiktionary_glosses="dwelling; abode; residence",  # no overlap with "house"
        )

        trans_field = next(f for f in result.fields if f.field_path == "translation_en")
        assert trans_field.status == "warn"

    def test_translation_match_produces_pass(self) -> None:
        service = WiktionaryVerificationService()
        data = _make_noun_data(translation_en="house")

        result = service.verify(
            data=data,
            wiktionary_forms=None,
            wiktionary_gender=None,
            wiktionary_pronunciation=None,
            wiktionary_glosses="house; home; building",
        )

        trans_field = next(f for f in result.fields if f.field_path == "translation_en")
        assert trans_field.status == "pass"

    def test_no_data_returns_empty_fields_auto_approve(self) -> None:
        service = WiktionaryVerificationService()
        data = _make_noun_data()

        result = service.verify(
            data=data,
            wiktionary_forms=None,
            wiktionary_gender=None,
            wiktionary_pronunciation=None,
            wiktionary_glosses=None,
        )

        assert result.fields == []
        assert result.tier == "auto_approve"

    def test_three_fails_produces_manual_review(self) -> None:
        service = WiktionaryVerificationService()
        data = _make_noun_data(gender="neuter")
        # Provide 3 mismatching forms to trigger manual_review
        forms = {
            "nominative_singular": "wrong1",
            "genitive_singular": "wrong2",
            "accusative_singular": "wrong3",
        }

        result = service.verify(
            data=data,
            wiktionary_forms=forms,
            wiktionary_gender=None,
            wiktionary_pronunciation=None,
            wiktionary_glosses=None,
        )

        assert result.tier == "manual_review"

    def test_one_fail_produces_quick_review(self) -> None:
        service = WiktionaryVerificationService()
        data = _make_noun_data(gender="neuter")
        forms = {"nominative_singular": "wrong1"}

        result = service.verify(
            data=data,
            wiktionary_forms=forms,
            wiktionary_gender=None,
            wiktionary_pronunciation=None,
            wiktionary_glosses=None,
        )

        assert result.tier == "quick_review"

    def test_summary_contains_check_counts(self) -> None:
        service = WiktionaryVerificationService()
        data = _make_noun_data()

        result = service.verify(
            data=data,
            wiktionary_forms={"nominative_singular": "σπίτι"},
            wiktionary_gender="neuter",
            wiktionary_pronunciation=None,
            wiktionary_glosses=None,
        )

        assert "Wiktionary:" in result.summary
        assert "fail" in result.summary
        assert "warn" in result.summary

    def test_reference_source_is_wiktionary(self) -> None:
        service = WiktionaryVerificationService()
        data = _make_noun_data()
        forms = {"nominative_singular": "σπίτι"}

        result = service.verify(
            data=data,
            wiktionary_forms=forms,
            wiktionary_gender=None,
            wiktionary_pronunciation=None,
            wiktionary_glosses=None,
        )

        for field in result.fields:
            for check in field.checks:
                assert check.reference_source == "wiktionary"


class TestCheckDeclensions:
    """Tests for WiktionaryVerificationService._check_declensions()."""

    def test_missing_wiktionary_key_skipped_gracefully(self) -> None:
        service = WiktionaryVerificationService()
        data = _make_noun_data()
        # Only nominative_singular present — others are absent
        forms = {"nominative_singular": "σπίτι"}

        fields = service._check_declensions(data, forms)

        # Only 1 field (nominative_singular), not 8
        assert len(fields) == 1
        assert fields[0].field_path == "cases.singular.nominative"

    def test_nfc_normalization_applied(self) -> None:
        """NFC normalization should be applied on both sides before comparison."""
        import unicodedata

        service = WiktionaryVerificationService()
        # Create data where the generated form is already NFC
        data = _make_noun_data(nominative_singular="το σπίτι")
        # Pass a Wiktionary form in NFD; service should still match
        nfd_form = unicodedata.normalize("NFD", "σπίτι")
        forms = {"nominative_singular": nfd_form}

        fields = service._check_declensions(data, forms)

        assert len(fields) == 1
        assert fields[0].status == "pass"

    def test_article_stripped_before_comparison(self) -> None:
        """Generated form 'το σπίτι' should match Wiktionary bare 'σπίτι'."""
        service = WiktionaryVerificationService()
        data = _make_noun_data(nominative_singular="το σπίτι")
        forms = {"nominative_singular": "σπίτι"}

        fields = service._check_declensions(data, forms)

        assert len(fields) == 1
        assert fields[0].status == "pass"
