"""Unit tests for MorphologyService.

Tests cover:
- Lemmatization of inflected Greek forms
- POS tagging (NOUN, VERB, ADJ)
- Morphological feature extraction (gender, number, case)
- Unknown word detection via is_known heuristic
- Edge cases: empty, non-Greek, single character
- MorphologyResult contract (fields, types)
- Singleton pattern for get_morphology_service()

"""

import pytest

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture(scope="module")
def morphology_service():
    """Create a single MorphologyService instance for the entire test module.

    Module scope avoids reloading the spaCy model (~200-500ms) for every test.
    """
    from src.services.morphology_service import MorphologyService

    return MorphologyService()


@pytest.fixture
def reset_morphology_singleton():
    """Reset the singleton MorphologyService instance before and after each test."""
    import src.services.morphology_service as morphology_module

    morphology_module._morphology_service = None
    yield
    morphology_module._morphology_service = None


# ============================================================================
# MorphologyService Tests - Lemmatization
# ============================================================================


class TestMorphologyLemmatization:
    """Tests for Greek word lemmatization."""

    def test_plural_noun_lemmatized(self, morphology_service):
        """σπίτια (plural of σπίτι) should return lemma σπίτι."""
        result = morphology_service.analyze("σπίτια")
        assert result.analysis_successful is True
        assert result.lemma == "σπίτι"

    def test_nominative_noun_unchanged(self, morphology_service):
        """σπίτι in nominative is already the lemma form."""
        result = morphology_service.analyze("σπίτι")
        assert result.analysis_successful is True
        assert result.lemma == "σπίτι"


# ============================================================================
# MorphologyService Tests - POS Tagging
# ============================================================================


class TestMorphologyPOSTagging:
    """Tests for part-of-speech tagging."""

    def test_noun_pos(self, morphology_service):
        """σπίτι (house) should be tagged as NOUN."""
        result = morphology_service.analyze("σπίτι")
        assert result.analysis_successful is True
        assert result.pos == "NOUN"

    def test_pos_is_string(self, morphology_service):
        result = morphology_service.analyze("σπίτι")
        assert isinstance(result.pos, str)
        assert len(result.pos) > 0


# ============================================================================
# MorphologyService Tests - Morphological Features
# ============================================================================


class TestMorphologyFeatureExtraction:
    """Tests for morphological feature extraction."""

    def test_morph_features_is_dict(self, morphology_service):
        result = morphology_service.analyze("σπίτι")
        assert isinstance(result.morph_features, dict)

    def test_noun_has_gender_feature(self, morphology_service):
        """Greek nouns should have a Gender morphological feature."""
        result = morphology_service.analyze("σπίτι")
        assert result.analysis_successful is True
        assert "Gender" in result.morph_features

    def test_noun_has_number_feature(self, morphology_service):
        """Greek nouns should have a Number morphological feature."""
        result = morphology_service.analyze("σπίτι")
        assert result.analysis_successful is True
        assert "Number" in result.morph_features

    def test_noun_has_case_feature(self, morphology_service):
        """Greek nouns should have a Case morphological feature."""
        result = morphology_service.analyze("σπίτι")
        assert result.analysis_successful is True
        assert "Case" in result.morph_features

    def test_morph_feature_values_are_strings(self, morphology_service):
        result = morphology_service.analyze("σπίτι")
        for key, value in result.morph_features.items():
            assert isinstance(key, str)
            assert isinstance(value, str)


# ============================================================================
# MorphologyService Tests - Unknown Word Detection
# ============================================================================


class TestMorphologyUnknownWords:
    """Tests for unknown word detection via is_known heuristic."""

    def test_nonsense_greek_is_unknown(self, morphology_service):
        """αβγδεζ (nonsense Greek letters) should have is_known=False."""
        result = morphology_service.analyze("αβγδεζ")
        assert result.analysis_successful is True
        assert result.is_known is False

    def test_inflected_form_is_known(self, morphology_service):
        """σπίτια (plural) has a different lemma than its text → is_known=True."""
        result = morphology_service.analyze("σπίτια")
        assert result.analysis_successful is True
        assert result.is_known is True

    def test_is_known_is_bool(self, morphology_service):
        result = morphology_service.analyze("σπίτι")
        assert isinstance(result.is_known, bool)


# ============================================================================
# MorphologyService Tests - Edge Cases
# ============================================================================


class TestMorphologyEdgeCases:
    """Tests for edge case inputs."""

    def test_empty_string(self, morphology_service):
        result = morphology_service.analyze("")
        assert result.analysis_successful is False
        assert result.lemma == ""
        assert result.pos == ""
        assert result.morph_features == {}

    def test_whitespace_only(self, morphology_service):
        result = morphology_service.analyze("   ")
        assert result.analysis_successful is False

    def test_latin_input(self, morphology_service):
        result = morphology_service.analyze("hello")
        assert result.analysis_successful is False

    def test_numbers(self, morphology_service):
        result = morphology_service.analyze("123")
        assert result.analysis_successful is False

    def test_single_greek_char(self, morphology_service):
        """Single Greek character should be processed (not fail)."""
        result = morphology_service.analyze("α")
        assert isinstance(result.analysis_successful, bool)


# ============================================================================
# MorphologyService Tests - Result Contract
# ============================================================================


class TestMorphologyResultContract:
    """Tests verifying MorphologyResult field contract."""

    def test_result_has_input_word(self, morphology_service):
        result = morphology_service.analyze("σπίτι")
        assert result.input_word == "σπίτι"

    def test_result_has_all_fields(self, morphology_service):
        from src.schemas.nlp import MorphologyResult

        result = morphology_service.analyze("σπίτι")
        assert isinstance(result, MorphologyResult)
        assert hasattr(result, "input_word")
        assert hasattr(result, "lemma")
        assert hasattr(result, "pos")
        assert hasattr(result, "morph_features")
        assert hasattr(result, "is_known")
        assert hasattr(result, "analysis_successful")

    def test_failed_result_has_empty_fields(self, morphology_service):
        result = morphology_service.analyze("")
        assert result.lemma == ""
        assert result.pos == ""
        assert result.morph_features == {}
        assert result.is_known is False
        assert result.analysis_successful is False


# ============================================================================
# get_morphology_service() Singleton Tests
# ============================================================================


class TestGetMorphologyService:
    """Tests for the get_morphology_service() singleton factory."""

    def test_returns_same_instance(self, _reset_morphology_singleton):
        from src.services.morphology_service import get_morphology_service

        s1 = get_morphology_service()
        s2 = get_morphology_service()
        assert s1 is s2

    def test_returns_morphology_service_instance(self, _reset_morphology_singleton):
        from src.services.morphology_service import MorphologyService, get_morphology_service

        service = get_morphology_service()
        assert isinstance(service, MorphologyService)
