"""Integration smoke tests for NLP services.

Tests cover:
- Both services instantiate without conflict
- SpellcheckService and MorphologyService work in sequence on same word

"""

import pytest


@pytest.mark.integration
class TestNLPServicesIntegration:
    """Smoke tests verifying SpellcheckService and MorphologyService work together."""

    def test_both_services_instantiate(self):
        """Both NLP services should load without conflict."""
        from src.services.morphology_service import MorphologyService
        from src.services.spellcheck_service import SpellcheckService

        spell = SpellcheckService()
        morph = MorphologyService()
        assert spell is not None
        assert morph is not None

    def test_pipeline_valid_word(self):
        """Check then analyze a valid Greek word end-to-end."""
        from src.services.morphology_service import MorphologyService
        from src.services.spellcheck_service import SpellcheckService

        spell = SpellcheckService()
        morph = MorphologyService()

        spell_result = spell.check("σπίτι")
        morph_result = morph.analyze("σπίτι")

        assert spell_result.is_valid is True
        assert morph_result.analysis_successful is True
        assert morph_result.pos == "NOUN"

    def test_pipeline_invalid_word(self):
        """Check then analyze an invalid/hallucinated Greek word end-to-end."""
        from src.services.morphology_service import MorphologyService
        from src.services.spellcheck_service import SpellcheckService

        spell = SpellcheckService()
        morph = MorphologyService()

        spell_result = spell.check("σπλίτρο")
        morph_result = morph.analyze("σπλίτρο")

        assert spell_result.is_valid is False
        # MorphologyService still processes it (spaCy attempts analysis)
        assert morph_result.analysis_successful is True
        assert morph_result.is_known is False


@pytest.mark.integration
class TestLemmaNormalizationPipeline:
    """Integration tests for LemmaNormalizationService full pipeline."""

    def test_valid_noun_full_pipeline(self):
        """σπίτια (houses) -> lemma σπίτι, neuter, article το, high confidence."""
        from src.services.lemma_normalization_service import get_lemma_normalization_service

        service = get_lemma_normalization_service()
        result = service.normalize("σπίτια")

        assert result.lemma == "σπίτι"
        assert result.gender == "neuter"
        assert result.article == "το"
        assert result.confidence >= 0.95

    def test_hallucinated_word_low_confidence(self):
        """σπλίτρο (nonsense) -> low confidence, no gender/article."""
        from src.services.lemma_normalization_service import get_lemma_normalization_service

        service = get_lemma_normalization_service()
        result = service.normalize("σπλίτρο")

        assert result.confidence < 0.5
        assert result.gender is None
        assert result.article is None

    def test_cross_service_consistency_valid_word(self):
        """Normalized lemma of valid word should pass spellcheck."""
        from src.services.lemma_normalization_service import get_lemma_normalization_service
        from src.services.spellcheck_service import get_spellcheck_service

        norm_service = get_lemma_normalization_service()
        spell_service = get_spellcheck_service()

        norm_result = norm_service.normalize("σπίτια")
        spell_result = spell_service.check(norm_result.lemma)

        assert spell_result.is_valid is True

    def test_cross_service_consistency_hallucinated(self):
        """Normalized lemma of hallucinated word should fail spellcheck."""
        from src.services.lemma_normalization_service import get_lemma_normalization_service
        from src.services.spellcheck_service import get_spellcheck_service

        norm_service = get_lemma_normalization_service()
        spell_service = get_spellcheck_service()

        norm_result = norm_service.normalize("σπλίτρο")
        spell_result = spell_service.check(norm_result.lemma)

        assert spell_result.is_valid is False

    def test_feminine_noun_pipeline(self):
        """μητέρες (mothers) -> lemma μητέρα, feminine, article η, high confidence."""
        from src.services.lemma_normalization_service import get_lemma_normalization_service

        service = get_lemma_normalization_service()
        result = service.normalize("μητέρες")

        assert result.lemma == "μητέρα"
        assert result.gender == "feminine"
        assert result.article == "η"
        assert result.confidence >= 0.95
