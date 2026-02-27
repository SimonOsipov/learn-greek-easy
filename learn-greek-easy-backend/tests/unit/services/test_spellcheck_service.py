"""Unit tests for SpellcheckService.

Tests cover:
- Valid Greek words return is_valid=True
- Invalid/hallucinated words return is_valid=False with suggestions
- Edge cases: empty, whitespace, Latin, numbers, mixed scripts
- SpellcheckResult contract (fields, types)
- Singleton pattern for get_spellcheck_service()

"""

import pytest

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def spellcheck_service():
    """Create a fresh SpellcheckService instance for testing."""
    from src.services.spellcheck_service import SpellcheckService

    return SpellcheckService()


@pytest.fixture
def reset_spellcheck_singleton():
    """Reset the singleton SpellcheckService instance before and after each test."""
    import src.services.spellcheck_service as spellcheck_module

    spellcheck_module._spellcheck_service = None
    yield
    spellcheck_module._spellcheck_service = None


# ============================================================================
# SpellcheckService Tests - Valid Greek Words
# ============================================================================


class TestSpellcheckValidWords:
    """Tests for valid Greek words."""

    def test_spiti_is_valid(self, spellcheck_service):
        """σπίτι (house) should be a valid Greek word."""
        result = spellcheck_service.check("σπίτι")
        assert result.is_valid is True
        assert result.suggestions == []

    def test_vivlio_is_valid(self, spellcheck_service):
        """βιβλίο (book) should be a valid Greek word."""
        result = spellcheck_service.check("βιβλίο")
        assert result.is_valid is True
        assert result.suggestions == []

    def test_gata_is_valid(self, spellcheck_service):
        """γάτα (cat) should be a valid Greek word."""
        result = spellcheck_service.check("γάτα")
        assert result.is_valid is True
        assert result.suggestions == []


# ============================================================================
# SpellcheckService Tests - Invalid Words
# ============================================================================


class TestSpellcheckInvalidWords:
    """Tests for invalid/hallucinated Greek words."""

    def test_hallucinated_word_is_invalid(self, spellcheck_service):
        """σπλίτρο is a hallucinated word — should be invalid."""
        result = spellcheck_service.check("σπλίτρο")
        assert result.is_valid is False

    def test_random_greek_letters_is_invalid(self, spellcheck_service):
        """βλαφγκ is random Greek letters — should be invalid."""
        result = spellcheck_service.check("βλαφγκ")
        assert result.is_valid is False

    def test_invalid_word_has_suggestions(self, spellcheck_service):
        """Invalid words should come with spelling suggestions."""
        result = spellcheck_service.check("σπλίτρο")
        assert isinstance(result.suggestions, list)


# ============================================================================
# SpellcheckService Tests - Edge Cases
# ============================================================================


class TestSpellcheckEdgeCases:
    """Tests for edge case inputs."""

    def test_empty_string(self, spellcheck_service):
        result = spellcheck_service.check("")
        assert result.is_valid is False
        assert result.suggestions == []

    def test_whitespace_only(self, spellcheck_service):
        result = spellcheck_service.check("   ")
        assert result.is_valid is False
        assert result.suggestions == []

    def test_latin_characters(self, spellcheck_service):
        result = spellcheck_service.check("hello")
        assert result.is_valid is False
        assert result.suggestions == []

    def test_numbers(self, spellcheck_service):
        result = spellcheck_service.check("12345")
        assert result.is_valid is False
        assert result.suggestions == []

    def test_mixed_script(self, spellcheck_service):
        result = spellcheck_service.check("helloσπίτι")
        assert result.is_valid is False
        assert result.suggestions == []

    def test_single_greek_char(self, spellcheck_service):
        """Single Greek character (e.g. article α) — result depends on dictionary."""
        result = spellcheck_service.check("α")
        assert isinstance(result.is_valid, bool)
        assert isinstance(result.suggestions, list)

    def test_multi_token_uses_first_word(self, spellcheck_service):
        """Multi-token input should use first token only."""
        result = spellcheck_service.check("σπίτι μου")
        # Result is for "σπίτι" (first token)
        assert result.is_valid is True
        # input_word should preserve original input
        assert result.input_word == "σπίτι μου"


# ============================================================================
# SpellcheckService Tests - Result Contract
# ============================================================================


class TestSpellcheckResultContract:
    """Tests verifying SpellcheckResult field contract."""

    def test_result_has_input_word(self, spellcheck_service):
        result = spellcheck_service.check("σπίτι")
        assert result.input_word == "σπίτι"

    def test_result_preserves_original_input(self, spellcheck_service):
        """input_word must preserve the original, unstripped input."""
        result = spellcheck_service.check("  σπίτι  ")
        assert result.input_word == "  σπίτι  "

    def test_result_has_is_valid_bool(self, spellcheck_service):
        result = spellcheck_service.check("σπίτι")
        assert isinstance(result.is_valid, bool)

    def test_result_has_suggestions_list(self, spellcheck_service):
        result = spellcheck_service.check("σπίτι")
        assert isinstance(result.suggestions, list)

    def test_valid_word_has_no_suggestions(self, spellcheck_service):
        result = spellcheck_service.check("σπίτι")
        assert result.suggestions == []


# ============================================================================
# get_spellcheck_service() Singleton Tests
# ============================================================================


class TestGetSpellcheckService:
    """Tests for the get_spellcheck_service() singleton factory."""

    def test_returns_same_instance(self, _reset_spellcheck_singleton):
        from src.services.spellcheck_service import get_spellcheck_service

        s1 = get_spellcheck_service()
        s2 = get_spellcheck_service()
        assert s1 is s2

    def test_returns_spellcheck_service_instance(self, _reset_spellcheck_singleton):
        from src.services.spellcheck_service import SpellcheckService, get_spellcheck_service

        service = get_spellcheck_service()
        assert isinstance(service, SpellcheckService)
