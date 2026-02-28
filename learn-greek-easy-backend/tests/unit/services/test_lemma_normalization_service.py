"""Unit tests for LemmaNormalizationService.

Tests cover:
- Happy path: full pipeline producing correct lemma, gender, article, POS, confidence
- Plural-to-singular and genitive-to-nominative lemmatization
- Masculine, feminine, and neuter full-flow tests
- Article stripping: "το σπίτι" -> "σπίτι", including accusative "τον άντρα"
- Gender extraction: masculine, feminine, neuter mappings
- Confidence scoring: all 7 tiers (0.0, 0.2, 0.5, 0.6, 0.8, 0.95, 1.0)
- Edge cases: empty, whitespace, non-Greek, hallucinated words
- Singleton pattern for get_lemma_normalization_service()
"""

from unittest.mock import MagicMock, patch

import pytest

# ============================================================================
# Helpers
# ============================================================================


def _make_morphology_result(
    input_word="σπίτι",
    lemma="σπίτι",
    pos="NOUN",
    morph_features=None,
    is_known=True,
    analysis_successful=True,
):
    """Build a MorphologyResult-like mock."""
    from src.schemas.nlp import MorphologyResult

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


def _make_spellcheck_result(input_word="σπίτι", is_valid=True, suggestions=None):
    """Build a SpellcheckResult-like mock."""
    from src.schemas.nlp import SpellcheckResult

    return SpellcheckResult(
        input_word=input_word,
        is_valid=is_valid,
        suggestions=suggestions if suggestions is not None else [],
    )


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def mock_morphology_service():
    """Mock MorphologyService."""
    return MagicMock()


@pytest.fixture
def mock_spellcheck_service():
    """Mock SpellcheckService."""
    return MagicMock()


@pytest.fixture
def normalization_service(mock_morphology_service, mock_spellcheck_service):
    """Create LemmaNormalizationService with injected mocks (not via singleton)."""
    from src.services.lemma_normalization_service import LemmaNormalizationService

    return LemmaNormalizationService(
        morphology_service=mock_morphology_service,
        spellcheck_service=mock_spellcheck_service,
    )


@pytest.fixture
def _reset_normalization_singleton():
    """Reset singleton before and after each test."""
    import src.services.lemma_normalization_service as mod

    mod._lemma_normalization_service = None
    yield
    mod._lemma_normalization_service = None


# ============================================================================
# TestNormalizePipeline
# ============================================================================


class TestNormalizePipeline:
    """Happy path tests: σπίτι -> NOUN, neuter, το, confidence 1.0."""

    def test_happy_path_lemma(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """σπίτι should return lemma=σπίτι."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("σπίτι")

        assert result.lemma == "σπίτι"

    def test_happy_path_pos(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """σπίτι should be tagged as NOUN."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("σπίτι")

        assert result.pos == "NOUN"

    def test_happy_path_gender(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """σπίτι should be neuter."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("σπίτι")

        assert result.gender == "neuter"

    def test_happy_path_article(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """σπίτι (neuter) should get article=το."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("σπίτι")

        assert result.article == "το"

    def test_happy_path_confidence(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """NOUN + gender + both spellchecks pass → confidence 1.0."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("σπίτι")

        assert result.confidence == 1.0

    def test_happy_path_input_word_preserved(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """input_word should reflect the original (uncleaned) input."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("σπίτι")

        assert result.input_word == "σπίτι"

    def test_result_is_normalized_lemma(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """Return type must be NormalizedLemma."""
        from src.schemas.nlp import NormalizedLemma

        mock_morphology_service.analyze.return_value = _make_morphology_result()
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("σπίτι")

        assert isinstance(result, NormalizedLemma)

    def test_plural_to_singular_lemma(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """σπίτια (plural) → lemma σπίτι, gender neuter, article το, confidence >= 0.95."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            input_word="σπίτια",
            lemma="σπίτι",
            pos="NOUN",
            morph_features={"Gender": "Neut", "Number": "Plur"},
        )
        mock_spellcheck_service.check.side_effect = lambda w: _make_spellcheck_result(
            input_word=w, is_valid=True
        )

        result = normalization_service.normalize("σπίτια")

        assert result.lemma == "σπίτι"
        assert result.gender == "neuter"
        assert result.article == "το"
        assert result.confidence >= 0.95

    def test_genitive_to_nominative_lemma(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """σπιτιού (genitive) → lemma σπίτι, confidence >= 0.5."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            input_word="σπιτιού",
            lemma="σπίτι",
            pos="NOUN",
            morph_features={"Gender": "Neut", "Case": "Gen"},
        )
        # Input may fail spellcheck; lemma passes
        mock_spellcheck_service.check.side_effect = lambda w: _make_spellcheck_result(
            input_word=w, is_valid=(w == "σπίτι")
        )

        result = normalization_service.normalize("σπιτιού")

        assert result.lemma == "σπίτι"
        assert result.confidence >= 0.5

    def test_masculine_noun_full_flow(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """άντρας → lemma άντρας, gender masculine, article ο, NOUN, confidence 1.0."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            input_word="άντρας",
            lemma="άντρας",
            pos="NOUN",
            morph_features={"Gender": "Masc"},
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("άντρας")

        assert result.lemma == "άντρας"
        assert result.gender == "masculine"
        assert result.article == "ο"
        assert result.pos == "NOUN"
        assert result.confidence == 1.0

    def test_feminine_noun_full_flow(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """γυναίκα → lemma γυναίκα, gender feminine, article η, NOUN, confidence 1.0."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            input_word="γυναίκα",
            lemma="γυναίκα",
            pos="NOUN",
            morph_features={"Gender": "Fem"},
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("γυναίκα")

        assert result.lemma == "γυναίκα"
        assert result.gender == "feminine"
        assert result.article == "η"
        assert result.pos == "NOUN"
        assert result.confidence == 1.0


# ============================================================================
# TestNormalizeArticleStripping
# ============================================================================


class TestNormalizeArticleStripping:
    """Article stripping: 'το σπίτι' should produce same result as 'σπίτι'."""

    def test_strip_neuter_article(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """'το σπίτι' → cleaned='σπίτι' → same lemma as bare input."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("το σπίτι")

        assert result.lemma == "σπίτι"

    def test_strip_masculine_article(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """'ο άντρας' → cleaned='άντρας'."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            input_word="άντρας", lemma="άντρας", pos="NOUN", morph_features={"Gender": "Masc"}
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("ο άντρας")

        assert result.lemma == "άντρας"

    def test_strip_feminine_article(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """'η γυναίκα' → cleaned='γυναίκα'."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            input_word="γυναίκα", lemma="γυναίκα", pos="NOUN", morph_features={"Gender": "Fem"}
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("η γυναίκα")

        assert result.lemma == "γυναίκα"

    def test_article_stripped_input_word_original(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """input_word should be the original with article, not the cleaned form."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("το σπίτι")

        assert result.input_word == "το σπίτι"

    def test_strip_accusative_article_ton(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """'τον άντρα' → article stripped, morph.analyze called with 'άντρα'."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            input_word="άντρα", lemma="άντρας", pos="NOUN", morph_features={"Gender": "Masc"}
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        normalization_service.normalize("τον άντρα")

        mock_morphology_service.analyze.assert_called_once_with("άντρα")


# ============================================================================
# TestNormalizeGenderExtraction
# ============================================================================


class TestNormalizeGenderExtraction:
    """Gender mapping: spaCy Masc/Fem/Neut → masculine/feminine/neuter."""

    def test_masculine_gender(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            morph_features={"Gender": "Masc"}, pos="NOUN"
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("άντρας")

        assert result.gender == "masculine"
        assert result.article == "ο"

    def test_feminine_gender(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            morph_features={"Gender": "Fem"}, pos="NOUN"
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("γυναίκα")

        assert result.gender == "feminine"
        assert result.article == "η"

    def test_neuter_gender(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            morph_features={"Gender": "Neut"}, pos="NOUN"
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("σπίτι")

        assert result.gender == "neuter"
        assert result.article == "το"

    def test_no_gender_feature(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """When Gender not in morph_features, gender and article should be None."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            morph_features={}, pos="VERB"
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("τρέχω")

        assert result.gender is None
        assert result.article is None


# ============================================================================
# TestNormalizeConfidenceScoring
# ============================================================================


class TestNormalizeConfidenceScoring:
    """Confidence tier tests covering all 7 levels."""

    def test_tier_1_0_all_signals_positive(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """NOUN + gender + input spellcheck pass + lemma spellcheck pass → 1.0."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            pos="NOUN", morph_features={"Gender": "Neut"}
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("σπίτι")

        assert result.confidence == 1.0

    def test_tier_0_95_noun_gender_input_misspelled(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """NOUN + gender + input misspelled + lemma valid → 0.95."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            input_word="σπιτι", lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )

        def spellcheck_side_effect(word):
            # input "σπιτι" fails, lemma "σπίτι" passes
            return _make_spellcheck_result(input_word=word, is_valid=(word == "σπίτι"))

        mock_spellcheck_service.check.side_effect = spellcheck_side_effect

        result = normalization_service.normalize("σπιτι")

        assert result.confidence == 0.95

    def test_tier_0_8_noun_no_gender_input_valid(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """NOUN + no gender + input valid + lemma valid → 0.8."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            pos="NOUN", morph_features={}  # no Gender key
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("σπίτι")

        assert result.confidence == 0.8

    def test_tier_0_6_non_noun_both_pass(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """Not NOUN + input valid + lemma valid → 0.6."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            pos="VERB", morph_features={}
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("τρέχω")

        assert result.confidence == 0.6

    def test_tier_0_5_non_noun_input_fails_lemma_passes(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """Not NOUN + input invalid + lemma valid → 0.5."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            input_word="τρεχω", lemma="τρέχω", pos="VERB", morph_features={}
        )

        def spellcheck_side_effect(word):
            return _make_spellcheck_result(input_word=word, is_valid=(word == "τρέχω"))

        mock_spellcheck_service.check.side_effect = spellcheck_side_effect

        result = normalization_service.normalize("τρεχω")

        assert result.confidence == 0.5

    def test_tier_0_2_lemma_fails_spellcheck(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """Lemma fails spellcheck → 0.2 (regardless of other signals)."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            input_word="αβγδε", lemma="αβγδε", pos="NOUN", morph_features={"Gender": "Neut"}
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=False)

        result = normalization_service.normalize("αβγδε")

        assert result.confidence == 0.2

    def test_tier_0_0_analysis_failed(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """Failed morphological analysis → 0.0."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            input_word="αβγδε", lemma="", pos="", morph_features={}, analysis_successful=False
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=False)

        result = normalization_service.normalize("αβγδε")

        assert result.confidence == 0.0


# ============================================================================
# TestNormalizeEdgeCases
# ============================================================================


class TestNormalizeEdgeCases:
    """Edge case inputs: empty, whitespace, non-Greek, hallucinated words."""

    def test_empty_string(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        result = normalization_service.normalize("")

        assert result.confidence == 0.0
        assert result.gender is None
        assert result.article is None
        assert result.pos == ""
        mock_morphology_service.analyze.assert_not_called()

    def test_whitespace_only(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        result = normalization_service.normalize("   ")

        assert result.confidence == 0.0
        mock_morphology_service.analyze.assert_not_called()

    def test_non_greek_latin(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        result = normalization_service.normalize("hello")

        assert result.confidence == 0.0
        assert result.input_word == "hello"
        mock_morphology_service.analyze.assert_not_called()

    def test_non_greek_numbers(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        result = normalization_service.normalize("123")

        assert result.confidence == 0.0
        mock_morphology_service.analyze.assert_not_called()

    def test_article_only_not_stripped_without_word(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """'ο ' stripped of whitespace is 'ο' (single Greek letter); article stripping
        requires article+space prefix so bare 'ο' passes as Greek and reaches morphology."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            input_word="ο", lemma="ο", pos="DET", morph_features={}, analysis_successful=True
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("ο ")

        # 'ο' reaches morphology (DET, no Gender) → 0.6 (not NOUN, input valid, lemma valid)
        assert result.input_word == "ο "
        assert result.lemma == "ο"
        mock_morphology_service.analyze.assert_called_once()

    def test_lemma_same_as_cleaned_avoids_double_spellcheck(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """When lemma == cleaned input, spellcheck.check() should only be called once."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            input_word="σπίτι", lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        normalization_service.normalize("σπίτι")

        assert mock_spellcheck_service.check.call_count == 1

    def test_whitespace_trimmed_calls_morph_with_stripped_word(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """'  σπίτι  ' (leading/trailing whitespace) → morph.analyze called with 'σπίτι'."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            input_word="σπίτι", lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        result = normalization_service.normalize("  σπίτι  ")

        mock_morphology_service.analyze.assert_called_once_with("σπίτι")
        assert result.lemma == "σπίτι"

    def test_hallucinated_word_low_confidence(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """'σπλίτρο' (non-word): input spellcheck fails, lemma spellcheck fails → confidence 0.2."""
        mock_morphology_service.analyze.return_value = _make_morphology_result(
            input_word="σπλίτρο",
            lemma="σπλίτρο",
            pos="NOUN",
            morph_features={"Gender": "Neut"},
            analysis_successful=True,
        )
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=False)

        result = normalization_service.normalize("σπλίτρο")

        assert result.confidence == 0.2


# ============================================================================
# TestGetLemmaNormalizationService
# ============================================================================


class TestGetLemmaNormalizationService:
    """Singleton factory tests for get_lemma_normalization_service()."""

    def test_returns_same_instance(self, _reset_normalization_singleton):
        with (
            patch("src.services.lemma_normalization_service.get_morphology_service") as mock_morph,
            patch("src.services.lemma_normalization_service.get_spellcheck_service") as mock_spell,
        ):
            mock_morph.return_value = MagicMock()
            mock_spell.return_value = MagicMock()
            from src.services.lemma_normalization_service import get_lemma_normalization_service

            s1 = get_lemma_normalization_service()
            s2 = get_lemma_normalization_service()
            assert s1 is s2

    def test_returns_lemma_normalization_service_instance(self, _reset_normalization_singleton):
        with (
            patch("src.services.lemma_normalization_service.get_morphology_service") as mock_morph,
            patch("src.services.lemma_normalization_service.get_spellcheck_service") as mock_spell,
        ):
            mock_morph.return_value = MagicMock()
            mock_spell.return_value = MagicMock()
            from src.services.lemma_normalization_service import (
                LemmaNormalizationService,
                get_lemma_normalization_service,
            )

            service = get_lemma_normalization_service()
            assert isinstance(service, LemmaNormalizationService)
