"""Unit tests for LocalVerificationService."""

from __future__ import annotations

import logging
from unittest.mock import MagicMock, patch

import pytest

from src.schemas.nlp import (
    CheckResult,
    FieldVerificationResult,
    GeneratedExample,
    GeneratedNounCases,
    GeneratedNounCaseSet,
    GeneratedNounData,
    GeneratedNounGrammar,
    LocalVerificationResult,
    MorphologyResult,
    SpellcheckResult,
)
from src.services.local_verification_service import (
    LocalVerificationService,
    get_local_verification_service,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_spellcheck_result(
    input_word: str = "σπίτι",
    is_valid: bool = True,
    suggestions: list[str] | None = None,
) -> SpellcheckResult:
    """Build a SpellcheckResult with sensible defaults."""
    return SpellcheckResult(
        input_word=input_word,
        is_valid=is_valid,
        suggestions=suggestions if suggestions is not None else [],
    )


def _make_morphology_result(
    input_word: str = "σπίτι",
    lemma: str = "σπίτι",
    pos: str = "NOUN",
    morph_features: dict[str, str] | None = None,
    is_known: bool = True,
    analysis_successful: bool = True,
) -> MorphologyResult:
    """Build a MorphologyResult with sensible defaults (neuter nominative singular)."""
    return MorphologyResult(
        input_word=input_word,
        lemma=lemma,
        pos=pos,
        morph_features=(
            morph_features
            if morph_features is not None
            else {"Gender": "Neut", "Number": "Sing", "Case": "Nom"}
        ),
        is_known=is_known,
        analysis_successful=analysis_successful,
    )


def _make_noun_data(
    lemma: str = "σπίτι",
    gender: str = "neuter",
    declension_group: str = "neuter_i",
    pronunciation: str = "/spí·ti/",
    nom_sg: str = "το σπίτι",
    gen_sg: str = "του σπιτιού",
    acc_sg: str = "το σπίτι",
    voc_sg: str = "σπίτι",
    nom_pl: str = "τα σπίτια",
    gen_pl: str = "των σπιτιών",
    acc_pl: str = "τα σπίτια",
    voc_pl: str = "σπίτια",
) -> GeneratedNounData:
    """Build a GeneratedNounData with all case forms individually controllable."""
    singular = GeneratedNounCaseSet(
        nominative=nom_sg,
        genitive=gen_sg,
        accusative=acc_sg,
        vocative=voc_sg,
    )
    plural = GeneratedNounCaseSet(
        nominative=nom_pl,
        genitive=gen_pl,
        accusative=acc_pl,
        vocative=voc_pl,
    )
    return GeneratedNounData(
        lemma=lemma,
        part_of_speech="noun",
        translation_en="house, home",
        translation_en_plural="houses",
        translation_ru="дом",
        pronunciation=pronunciation,
        grammar_data=GeneratedNounGrammar(
            gender=gender,  # type: ignore[arg-type]
            declension_group=declension_group,
            cases=GeneratedNounCases(singular=singular, plural=plural),
        ),
        examples=[
            GeneratedExample(id=1, greek="Το σπίτι μου.", english="My house.", russian="Мой дом."),
            GeneratedExample(
                id=2, greek="Πάμε σπίτι.", english="Let's go home.", russian="Пойдём домой."
            ),
        ],
    )


def _find_field(result: LocalVerificationResult, field_path: str) -> FieldVerificationResult | None:
    """Find a FieldVerificationResult by field_path."""
    return next((f for f in result.fields if f.field_path == field_path), None)


def _find_check(field: FieldVerificationResult, check_name: str) -> CheckResult | None:
    """Find a CheckResult by check_name within a FieldVerificationResult."""
    return next((c for c in field.checks if c.check_name == check_name), None)


# Correct morphology features for each case form of a neuter noun (order matches service iteration)
_NEUTER_CASE_FEATURES: list[dict[str, str]] = [
    {"Gender": "Neut", "Number": "Sing", "Case": "Nom"},  # singular nominative
    {"Gender": "Neut", "Number": "Sing", "Case": "Gen"},  # singular genitive
    {"Gender": "Neut", "Number": "Sing", "Case": "Acc"},  # singular accusative
    {"Gender": "Neut", "Number": "Sing", "Case": "Voc"},  # singular vocative
    {"Gender": "Neut", "Number": "Plur", "Case": "Nom"},  # plural nominative
    {"Gender": "Neut", "Number": "Plur", "Case": "Gen"},  # plural genitive
    {"Gender": "Neut", "Number": "Plur", "Case": "Acc"},  # plural accusative
    {"Gender": "Neut", "Number": "Plur", "Case": "Voc"},  # plural vocative
]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_spellcheck_service() -> MagicMock:
    """Mock SpellcheckService where every check() returns is_valid=True."""
    mock = MagicMock()
    mock.check.return_value = _make_spellcheck_result(is_valid=True)
    return mock


@pytest.fixture()
def mock_morphology_service() -> MagicMock:
    """Mock MorphologyService returning NOUN/Neut/Sing/Nom for every analyze()."""
    mock = MagicMock()
    mock.analyze.return_value = _make_morphology_result()
    return mock


@pytest.fixture()
def service(
    mock_spellcheck_service: MagicMock, mock_morphology_service: MagicMock
) -> LocalVerificationService:
    """LocalVerificationService with both mocked NLP services."""
    return LocalVerificationService(
        spellcheck_service=mock_spellcheck_service,
        morphology_service=mock_morphology_service,
    )


@pytest.fixture()
def service_no_spellcheck(mock_morphology_service: MagicMock) -> LocalVerificationService:
    """LocalVerificationService with spellcheck_service=None."""
    return LocalVerificationService(
        spellcheck_service=None,
        morphology_service=mock_morphology_service,
    )


@pytest.fixture()
def service_no_morphology(mock_spellcheck_service: MagicMock) -> LocalVerificationService:
    """LocalVerificationService with morphology_service=None."""
    return LocalVerificationService(
        spellcheck_service=mock_spellcheck_service,
        morphology_service=None,
    )


@pytest.fixture()
def service_no_nlp() -> LocalVerificationService:
    """LocalVerificationService with both NLP services unavailable."""
    return LocalVerificationService(spellcheck_service=None, morphology_service=None)


@pytest.fixture()
def _reset_singleton() -> object:
    """Reset the LocalVerificationService singleton before and after each test."""
    import src.services.local_verification_service as mod

    mod._local_verification_service = None
    yield
    mod._local_verification_service = None


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestSpellcheckStage:
    """Tests for Stage 1: spellcheck verification."""

    def test_all_forms_valid(
        self,
        service: LocalVerificationService,
        mock_spellcheck_service: MagicMock,
    ) -> None:
        """All 8 case forms + lemma have spellcheck=pass when all are valid."""
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)
        result = service.verify(_make_noun_data())

        for path in (
            "cases.singular.nominative",
            "cases.singular.genitive",
            "cases.singular.accusative",
            "cases.singular.vocative",
            "cases.plural.nominative",
            "cases.plural.genitive",
            "cases.plural.accusative",
            "cases.plural.vocative",
            "lemma",
        ):
            field = _find_field(result, path)
            assert field is not None, f"Missing field {path}"
            check = _find_check(field, "spellcheck")
            assert check is not None, f"Missing spellcheck check for {path}"
            assert check.status == "pass", f"Expected pass for {path}, got {check.status}"

    def test_nominative_invalid_is_fail(
        self,
        service: LocalVerificationService,
        mock_spellcheck_service: MagicMock,
    ) -> None:
        """Non-vocative invalid form → spellcheck check status=fail."""
        # σπίτι is the stripped form (article "το " stripped from "το σπίτι")
        mock_spellcheck_service.check.side_effect = lambda word: (
            _make_spellcheck_result(input_word=word, is_valid=False)
            if word == "σπίτι"
            else _make_spellcheck_result(input_word=word, is_valid=True)
        )
        result = service.verify(_make_noun_data())

        field = _find_field(result, "cases.singular.nominative")
        assert field is not None
        check = _find_check(field, "spellcheck")
        assert check is not None
        assert check.status == "fail"

    def test_vocative_invalid_is_warn(
        self,
        service: LocalVerificationService,
        mock_spellcheck_service: MagicMock,
    ) -> None:
        """Vocative invalid form → spellcheck check status=warn (vocative may be rare)."""
        # Use a distinct vocative form to distinguish from other forms
        noun = _make_noun_data(voc_sg="σπίτιε")  # made-up vocative to distinguish
        mock_spellcheck_service.check.side_effect = lambda word: (
            _make_spellcheck_result(input_word=word, is_valid=False)
            if word == "σπίτιε"
            else _make_spellcheck_result(input_word=word, is_valid=True)
        )
        result = service.verify(noun)

        field = _find_field(result, "cases.singular.vocative")
        assert field is not None
        check = _find_check(field, "spellcheck")
        assert check is not None
        assert check.status == "warn"

    def test_lemma_invalid_is_fail(
        self,
        service: LocalVerificationService,
        mock_spellcheck_service: MagicMock,
    ) -> None:
        """Invalid lemma → spellcheck check status=fail."""
        noun = _make_noun_data(lemma="ξξξξ")
        mock_spellcheck_service.check.side_effect = lambda word: (
            _make_spellcheck_result(input_word=word, is_valid=False)
            if word == "ξξξξ"
            else _make_spellcheck_result(input_word=word, is_valid=True)
        )
        result = service.verify(noun)

        field = _find_field(result, "lemma")
        assert field is not None
        check = _find_check(field, "spellcheck")
        assert check is not None
        assert check.status == "fail"

    def test_service_unavailable_skips_spellcheck(
        self,
        service_no_spellcheck: LocalVerificationService,
    ) -> None:
        """When spellcheck_service=None, all spellcheck fields are skipped."""
        result = service_no_spellcheck.verify(_make_noun_data())

        assert "spellcheck" in result.stages_skipped
        for path in (
            "cases.singular.nominative",
            "cases.singular.genitive",
            "cases.singular.accusative",
            "cases.singular.vocative",
            "cases.plural.nominative",
            "cases.plural.genitive",
            "cases.plural.accusative",
            "cases.plural.vocative",
            "lemma",
        ):
            field = _find_field(result, path)
            assert field is not None, f"Missing field {path}"
            # spellcheck check itself should not exist on these fields
            spellcheck_check = _find_check(field, "spellcheck")
            assert spellcheck_check is None, f"Unexpected spellcheck check for {path}"


class TestMorphologyStage:
    """Tests for Stage 2: morphology verification."""

    def test_pos_mismatch_is_warn(
        self,
        service: LocalVerificationService,
        mock_morphology_service: MagicMock,
    ) -> None:
        """POS != NOUN → morphology_pos check status=warn."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(pos="VERB")
        result = service.verify(_make_noun_data())

        field = _find_field(result, "cases.singular.nominative")
        assert field is not None
        check = _find_check(field, "morphology_pos")
        assert check is not None
        assert check.status == "warn"
        assert check.message is not None
        assert "VERB" in check.message

    def test_gender_mismatch_is_warn(
        self,
        service: LocalVerificationService,
        mock_morphology_service: MagicMock,
    ) -> None:
        """Gender mismatch → morphology_gender check status=warn."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            morph_features={"Gender": "Masc", "Number": "Sing", "Case": "Nom"}
        )
        result = service.verify(_make_noun_data(gender="neuter"))

        field = _find_field(result, "cases.singular.nominative")
        assert field is not None
        check = _find_check(field, "morphology_gender")
        assert check is not None
        assert check.status == "warn"

    def test_lemma_mismatch_is_warn(
        self,
        service: LocalVerificationService,
        mock_morphology_service: MagicMock,
    ) -> None:
        """Lemma mismatch → morphology_lemma check status=warn."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(lemma="σπιτάκι")
        result = service.verify(_make_noun_data(lemma="σπίτι"))

        field = _find_field(result, "cases.singular.nominative")
        assert field is not None
        check = _find_check(field, "morphology_lemma")
        assert check is not None
        assert check.status == "warn"

    def test_case_number_mismatch_is_warn(
        self,
        service: LocalVerificationService,
        mock_morphology_service: MagicMock,
    ) -> None:
        """Case/Number mismatch → morphology_case_number check status=warn."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            morph_features={"Gender": "Neut", "Number": "Plur", "Case": "Gen"}
        )
        result = service.verify(_make_noun_data())

        # nominative singular form analyzed as genitive plural → mismatch
        field = _find_field(result, "cases.singular.nominative")
        assert field is not None
        check = _find_check(field, "morphology_case_number")
        assert check is not None
        assert check.status == "warn"

    def test_analysis_unsuccessful_all_checks_warn(
        self,
        service: LocalVerificationService,
        mock_morphology_service: MagicMock,
    ) -> None:
        """analysis_successful=False → all 4 morphology checks are warn."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            analysis_successful=False
        )
        result = service.verify(_make_noun_data())

        field = _find_field(result, "cases.singular.nominative")
        assert field is not None
        for check_name in (
            "morphology_pos",
            "morphology_gender",
            "morphology_lemma",
            "morphology_case_number",
        ):
            check = _find_check(field, check_name)
            assert check is not None, f"Missing {check_name}"
            assert check.status == "warn", f"Expected warn for {check_name}, got {check.status}"

    def test_service_unavailable_skips_morphology(
        self,
        service_no_morphology: LocalVerificationService,
    ) -> None:
        """When morphology_service=None, no morphology checks added, stage is skipped."""
        result = service_no_morphology.verify(_make_noun_data())

        assert "morphology" in result.stages_skipped
        # No morphology checks should exist on any field
        for field in result.fields:
            for check in field.checks:
                assert not check.check_name.startswith(
                    "morphology_"
                ), f"Unexpected morphology check on {field.field_path}"


class TestSchemaValidation:
    """Tests for Stage 3: schema validation (always runs)."""

    def test_article_gender_pass_masculine(self, service_no_nlp: LocalVerificationService) -> None:
        """Masculine noun with correct article 'ο ' → article_gender pass."""
        noun = _make_noun_data(
            gender="masculine",
            declension_group="masculine_os",
            nom_sg="ο άνθρωπος",
            gen_sg="του ανθρώπου",
            acc_sg="τον άνθρωπο",
            voc_sg="άνθρωπε",
            nom_pl="οι άνθρωποι",
            gen_pl="των ανθρώπων",
            acc_pl="τους ανθρώπους",
            voc_pl="άνθρωποι",
        )
        result = service_no_nlp.verify(noun)

        field = _find_field(result, "grammar_data.gender")
        assert field is not None
        assert field.status == "pass"

    def test_article_gender_fail_wrong_article(
        self, service_no_nlp: LocalVerificationService
    ) -> None:
        """Feminine noun with masculine article 'ο ' → article_gender fail."""
        noun = _make_noun_data(
            gender="feminine",
            declension_group="feminine_a",
            nom_sg="ο γάτα",  # wrong article — should be "η γάτα"
            gen_sg="της γάτας",
            acc_sg="την γάτα",
            voc_sg="γάτα",
            nom_pl="οι γάτες",
            gen_pl="των γατών",
            acc_pl="τις γάτες",
            voc_pl="γάτες",
        )
        result = service_no_nlp.verify(noun)

        field = _find_field(result, "grammar_data.gender")
        assert field is not None
        assert field.status == "fail"

    def test_declension_group_pass(self, service_no_nlp: LocalVerificationService) -> None:
        """Neuter noun ending in -ι with declension_group='neuter_i' → pass."""
        result = service_no_nlp.verify(_make_noun_data())  # defaults: neuter_i, nom_sg="το σπίτι"

        field = _find_field(result, "grammar_data.declension_group")
        assert field is not None
        assert field.status == "pass"

    def test_declension_group_fail(self, service_no_nlp: LocalVerificationService) -> None:
        """Declared declension_group mismatches derived value → fail."""
        noun = _make_noun_data(
            declension_group="neuter_o",  # wrong — should be neuter_i for -ι ending
        )
        result = service_no_nlp.verify(noun)

        field = _find_field(result, "grammar_data.declension_group")
        assert field is not None
        assert field.status == "fail"

    def test_pronunciation_pass(self, service_no_nlp: LocalVerificationService) -> None:
        """Pronunciation '/spí·ti/' matches /.+/ regex → pass."""
        result = service_no_nlp.verify(_make_noun_data(pronunciation="/spí·ti/"))

        field = _find_field(result, "pronunciation")
        assert field is not None
        assert field.status == "pass"

    def test_pronunciation_fail_no_slashes(self, service_no_nlp: LocalVerificationService) -> None:
        """Pronunciation without slashes → fail."""
        result = service_no_nlp.verify(_make_noun_data(pronunciation="spíti"))

        field = _find_field(result, "pronunciation")
        assert field is not None
        assert field.status == "fail"

    def test_pronunciation_fail_empty_between_slashes(
        self, service_no_nlp: LocalVerificationService
    ) -> None:
        """Pronunciation '//' (empty between slashes) → fail."""
        result = service_no_nlp.verify(_make_noun_data(pronunciation="//"))

        field = _find_field(result, "pronunciation")
        assert field is not None
        assert field.status == "fail"


class TestTierComputation:
    """Tests for tier derivation from field fail/warn counts."""

    def test_auto_approve_zero_warns(
        self,
        service_no_morphology: LocalVerificationService,
    ) -> None:
        """0 fails, 0 warns → auto_approve.

        Uses service_no_morphology to avoid case_number mismatches from default mock
        (which always returns Nom/Sing, causing warns on non-nominative forms).
        All spellcheck pass + schema pass → 0 warns, 0 fails.
        """
        result = service_no_morphology.verify(_make_noun_data())

        warn_fields = [f for f in result.fields if f.status == "warn"]
        fail_fields = [f for f in result.fields if f.status == "fail"]
        assert len(fail_fields) == 0
        assert len(warn_fields) == 0
        assert result.tier == "auto_approve"

    def test_auto_approve_two_warns(
        self,
        service_no_morphology: LocalVerificationService,
        mock_spellcheck_service: MagicMock,
    ) -> None:
        """0 fails, 2 field-level warns → auto_approve (boundary: > 2 needed for quick_review).

        Two vocative forms fail spellcheck → 2 fields get status=warn (vocative → warn, not fail).
        """
        noun = _make_noun_data(voc_sg="σπίτιε", voc_pl="σπίτιεκα")
        invalid = {"σπίτιε", "σπίτιεκα"}
        mock_spellcheck_service.check.side_effect = lambda word: _make_spellcheck_result(
            input_word=word, is_valid=word not in invalid
        )
        result = service_no_morphology.verify(noun)

        warn_fields = [f for f in result.fields if f.status == "warn"]
        fail_fields = [f for f in result.fields if f.status == "fail"]
        assert len(fail_fields) == 0
        assert len(warn_fields) == 2
        assert result.tier == "auto_approve"

    def test_quick_review_three_warns(
        self,
        service: LocalVerificationService,
        mock_morphology_service: MagicMock,
    ) -> None:
        """0 fails, 3 field-level warns → quick_review.

        Uses per-call side_effect list: first 3 forms get POS mismatch (→ warn);
        remaining 5 forms get correct case/number features (→ pass).
        """
        correct = [
            _make_morphology_result(lemma="σπίτι", pos="NOUN", morph_features=f)
            for f in _NEUTER_CASE_FEATURES
        ]
        # Override first 3 calls with POS mismatch
        side_effects: list[MorphologyResult] = [
            _make_morphology_result(pos="VERB"),
            _make_morphology_result(pos="VERB"),
            _make_morphology_result(pos="VERB"),
            correct[3],
            correct[4],
            correct[5],
            correct[6],
            correct[7],
        ]
        mock_morphology_service.analyze.side_effect = side_effects
        result = service.verify(_make_noun_data())

        warn_fields = [f for f in result.fields if f.status == "warn"]
        fail_fields = [f for f in result.fields if f.status == "fail"]
        assert len(fail_fields) == 0
        assert len(warn_fields) == 3
        assert result.tier == "quick_review"

    def test_quick_review_one_fail(
        self,
        service_no_morphology: LocalVerificationService,
        mock_spellcheck_service: MagicMock,
    ) -> None:
        """1 field fail → quick_review.

        Keeps nom_sg valid (so declension_group schema check passes).
        Makes gen_sg invalid (non-vocative → fail).
        """
        noun = _make_noun_data(gen_sg="του ξξξξξ")
        mock_spellcheck_service.check.side_effect = lambda word: _make_spellcheck_result(
            input_word=word, is_valid=word != "ξξξξξ"
        )
        result = service_no_morphology.verify(noun)

        fail_fields = [f for f in result.fields if f.status == "fail"]
        assert len(fail_fields) == 1
        assert result.tier == "quick_review"

    def test_quick_review_two_fails(
        self,
        service_no_morphology: LocalVerificationService,
        mock_spellcheck_service: MagicMock,
    ) -> None:
        """2 field fails → quick_review.

        Keeps nom_sg valid (so declension_group passes). Makes gen_sg and acc_sg invalid.
        """
        noun = _make_noun_data(gen_sg="του ξξξξξ", acc_sg="το ζζζζζ")
        invalid = {"ξξξξξ", "ζζζζζ"}
        mock_spellcheck_service.check.side_effect = lambda word: _make_spellcheck_result(
            input_word=word, is_valid=word not in invalid
        )
        result = service_no_morphology.verify(noun)

        fail_fields = [f for f in result.fields if f.status == "fail"]
        assert len(fail_fields) == 2
        assert result.tier == "quick_review"

    def test_manual_review_three_fails(
        self,
        service_no_morphology: LocalVerificationService,
        mock_spellcheck_service: MagicMock,
    ) -> None:
        """3 field fails → manual_review.

        Keeps nom_sg valid. Makes gen_sg, nom_pl, and gen_pl invalid (all non-vocative → fail).
        """
        noun = _make_noun_data(gen_sg="του ξξξξξ", nom_pl="τα ζζζζζ", gen_pl="των ψψψψψ")
        invalid = {"ξξξξξ", "ζζζζζ", "ψψψψψ"}
        mock_spellcheck_service.check.side_effect = lambda word: _make_spellcheck_result(
            input_word=word, is_valid=word not in invalid
        )
        result = service_no_morphology.verify(noun)

        fail_fields = [f for f in result.fields if f.status == "fail"]
        assert len(fail_fields) == 3
        assert result.tier == "manual_review"


class TestGracefulDegradation:
    """Tests for graceful degradation when NLP services are unavailable."""

    def test_spellcheck_unavailable(self, service_no_spellcheck: LocalVerificationService) -> None:
        """Spellcheck=None → stages_skipped contains 'spellcheck', morphology+schema still run."""
        result = service_no_spellcheck.verify(_make_noun_data())

        assert "spellcheck" in result.stages_skipped
        assert "morphology" not in result.stages_skipped
        # morphology checks should still be present on case form fields
        nom_field = _find_field(result, "cases.singular.nominative")
        assert nom_field is not None
        morph_check = _find_check(nom_field, "morphology_pos")
        assert morph_check is not None
        # schema fields should still exist
        assert _find_field(result, "grammar_data.gender") is not None
        assert _find_field(result, "pronunciation") is not None
        # tier is still computed
        assert result.tier in ("auto_approve", "quick_review", "manual_review")

    def test_morphology_unavailable(self, service_no_morphology: LocalVerificationService) -> None:
        """Morphology=None → stages_skipped contains 'morphology', spellcheck+schema still run."""
        result = service_no_morphology.verify(_make_noun_data())

        assert "morphology" in result.stages_skipped
        assert "spellcheck" not in result.stages_skipped
        # No morphology checks on any field
        for field in result.fields:
            for check in field.checks:
                assert not check.check_name.startswith("morphology_")
        # spellcheck checks should exist on case form fields
        nom_field = _find_field(result, "cases.singular.nominative")
        assert nom_field is not None
        spell_check = _find_check(nom_field, "spellcheck")
        assert spell_check is not None

    def test_both_unavailable_warning_logged(
        self,
        service_no_nlp: LocalVerificationService,
        caplog_loguru: pytest.LogCaptureFixture,
    ) -> None:
        """Both services None → WARNING logged for each; only schema checks remain."""
        with caplog_loguru.at_level(logging.WARNING):
            result = service_no_nlp.verify(_make_noun_data())

        assert "spellcheck" in result.stages_skipped
        assert "morphology" in result.stages_skipped
        for field in result.fields:
            for check in field.checks:
                assert check.check_name not in (
                    "spellcheck",
                    "morphology_pos",
                    "morphology_gender",
                    "morphology_lemma",
                    "morphology_case_number",
                )
        assert _find_field(result, "grammar_data.gender") is not None
        assert _find_field(result, "pronunciation") is not None
        assert isinstance(result, LocalVerificationResult)
        assert result.tier in ("auto_approve", "quick_review", "manual_review")
        messages = [r.message.lower() for r in caplog_loguru.records]
        assert any("spellcheck" in m for m in messages)
        assert any("morphology" in m for m in messages)


class TestSkippedFields:
    """Tests for fields that cannot be locally verified."""

    def test_skipped_fields(self, service_no_nlp: LocalVerificationService) -> None:
        """translation_en, translation_ru, translation_en_plural, examples → all skipped."""
        result = service_no_nlp.verify(_make_noun_data())

        for path in ("translation_en", "translation_ru", "translation_en_plural", "examples"):
            field = _find_field(result, path)
            assert field is not None, f"Missing skipped field: {path}"
            assert field.status == "skipped", f"Expected skipped for {path}, got {field.status}"
            assert field.checks == [], f"Expected empty checks for {path}"


class TestSingleton:
    """Tests for the get_local_verification_service() singleton factory."""

    def test_singleton_returns_same_instance(self, _reset_singleton: object) -> None:
        """get_local_verification_service() returns the same instance on repeated calls."""
        with (
            patch("src.services.local_verification_service.get_spellcheck_service"),
            patch("src.services.local_verification_service.get_morphology_service"),
        ):
            first = get_local_verification_service()
            second = get_local_verification_service()

        assert first is second
