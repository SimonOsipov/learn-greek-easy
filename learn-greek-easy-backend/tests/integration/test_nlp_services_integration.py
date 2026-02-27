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
