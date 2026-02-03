"""Unit tests for localization utilities.

Tests for:
- normalize_locale: Locale code normalization with fallback
- get_localized_deck_content: Extracting localized content from deck models
"""

from unittest.mock import MagicMock

import pytest

from src.core.localization import (
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    get_localized_deck_content,
    normalize_locale,
)


class TestNormalizeLocale:
    """Test normalize_locale function."""

    def test_normalize_english(self):
        """Test English locale is returned as-is."""
        assert normalize_locale("en") == "en"

    def test_normalize_greek(self):
        """Test Greek locale is returned as-is."""
        assert normalize_locale("el") == "el"

    def test_normalize_russian(self):
        """Test Russian locale is returned as-is."""
        assert normalize_locale("ru") == "ru"

    def test_normalize_with_region_code(self):
        """Test locale with region code is normalized to base locale."""
        assert normalize_locale("en-US") == "en"
        assert normalize_locale("en-GB") == "en"
        assert normalize_locale("el-GR") == "el"
        assert normalize_locale("ru-RU") == "ru"

    def test_normalize_uppercase(self):
        """Test uppercase locale is normalized to lowercase."""
        assert normalize_locale("EN") == "en"
        assert normalize_locale("EL") == "el"
        assert normalize_locale("RU") == "ru"

    def test_normalize_mixed_case(self):
        """Test mixed case locale is normalized."""
        assert normalize_locale("En-Us") == "en"

    def test_normalize_unsupported_locale_fallback(self):
        """Test unsupported locale falls back to default."""
        assert normalize_locale("fr") == DEFAULT_LOCALE
        assert normalize_locale("de") == DEFAULT_LOCALE
        assert normalize_locale("es") == DEFAULT_LOCALE
        assert normalize_locale("ja") == DEFAULT_LOCALE

    def test_normalize_none_fallback(self):
        """Test None input falls back to default."""
        assert normalize_locale(None) == DEFAULT_LOCALE

    def test_normalize_empty_string_fallback(self):
        """Test empty string falls back to default."""
        assert normalize_locale("") == DEFAULT_LOCALE

    def test_supported_locales_constant(self):
        """Test SUPPORTED_LOCALES contains expected languages."""
        assert "en" in SUPPORTED_LOCALES
        assert "el" in SUPPORTED_LOCALES
        assert "ru" in SUPPORTED_LOCALES
        assert len(SUPPORTED_LOCALES) == 3

    def test_default_locale_is_english(self):
        """Test default locale is English."""
        assert DEFAULT_LOCALE == "en"


class TestGetLocalizedDeckContent:
    """Test get_localized_deck_content function."""

    @pytest.fixture
    def mock_deck_all_languages(self):
        """Create a mock deck with all language fields populated."""
        deck = MagicMock()
        deck.name_el = "Ελληνικό Λεξιλόγιο"
        deck.name_en = "Greek Vocabulary"
        deck.name_ru = "Греческий Словарь"
        deck.description_el = "Περιγραφή στα ελληνικά"
        deck.description_en = "Description in English"
        deck.description_ru = "Описание на русском"
        return deck

    @pytest.fixture
    def mock_deck_missing_greek(self):
        """Create a mock deck with missing Greek content."""
        deck = MagicMock()
        deck.name_el = None
        deck.name_en = "Greek Vocabulary"
        deck.name_ru = "Греческий Словарь"
        deck.description_el = None
        deck.description_en = "Description in English"
        deck.description_ru = "Описание на русском"
        return deck

    @pytest.fixture
    def mock_deck_missing_russian(self):
        """Create a mock deck with missing Russian content."""
        deck = MagicMock()
        deck.name_el = "Ελληνικό Λεξιλόγιο"
        deck.name_en = "Greek Vocabulary"
        deck.name_ru = None
        deck.description_el = "Περιγραφή στα ελληνικά"
        deck.description_en = "Description in English"
        deck.description_ru = None
        return deck

    def test_get_english_content(self, mock_deck_all_languages):
        """Test getting English content."""
        name, description = get_localized_deck_content(mock_deck_all_languages, "en")
        assert name == "Greek Vocabulary"
        assert description == "Description in English"

    def test_get_greek_content(self, mock_deck_all_languages):
        """Test getting Greek content."""
        name, description = get_localized_deck_content(mock_deck_all_languages, "el")
        assert name == "Ελληνικό Λεξιλόγιο"
        assert description == "Περιγραφή στα ελληνικά"

    def test_get_russian_content(self, mock_deck_all_languages):
        """Test getting Russian content."""
        name, description = get_localized_deck_content(mock_deck_all_languages, "ru")
        assert name == "Греческий Словарь"
        assert description == "Описание на русском"

    def test_greek_fallback_to_english(self, mock_deck_missing_greek):
        """Test Greek content falls back to English when Greek is None."""
        name, description = get_localized_deck_content(mock_deck_missing_greek, "el")
        assert name == "Greek Vocabulary"
        assert description == "Description in English"

    def test_russian_fallback_to_english(self, mock_deck_missing_russian):
        """Test Russian content falls back to English when Russian is None."""
        name, description = get_localized_deck_content(mock_deck_missing_russian, "ru")
        assert name == "Greek Vocabulary"
        assert description == "Description in English"

    def test_unsupported_locale_falls_back_to_english(self, mock_deck_all_languages):
        """Test unsupported locale falls back to English content."""
        name, description = get_localized_deck_content(mock_deck_all_languages, "fr")
        assert name == "Greek Vocabulary"
        assert description == "Description in English"

    def test_locale_with_region_code(self, mock_deck_all_languages):
        """Test locale with region code is normalized."""
        name, description = get_localized_deck_content(mock_deck_all_languages, "el-GR")
        assert name == "Ελληνικό Λεξιλόγιο"
        assert description == "Περιγραφή στα ελληνικά"

    def test_uppercase_locale(self, mock_deck_all_languages):
        """Test uppercase locale is handled correctly."""
        name, description = get_localized_deck_content(mock_deck_all_languages, "RU")
        assert name == "Греческий Словарь"
        assert description == "Описание на русском"

    def test_none_locale_defaults_to_english(self, mock_deck_all_languages):
        """Test None locale defaults to English."""
        name, description = get_localized_deck_content(mock_deck_all_languages, None)
        assert name == "Greek Vocabulary"
        assert description == "Description in English"

    def test_empty_locale_defaults_to_english(self, mock_deck_all_languages):
        """Test empty string locale defaults to English."""
        name, description = get_localized_deck_content(mock_deck_all_languages, "")
        assert name == "Greek Vocabulary"
        assert description == "Description in English"

    def test_description_can_be_none(self):
        """Test handling when all descriptions are None."""
        deck = MagicMock()
        deck.name_el = "Test"
        deck.name_en = "Test"
        deck.name_ru = "Test"
        deck.description_el = None
        deck.description_en = None
        deck.description_ru = None

        name, description = get_localized_deck_content(deck, "en")
        assert name == "Test"
        assert description is None

    def test_greek_description_fallback_when_none(self):
        """Test Greek description falls back to English when Greek is None."""
        deck = MagicMock()
        deck.name_el = "Ελληνικά"
        deck.name_en = "Greek"
        deck.name_ru = "Греческий"
        deck.description_el = None
        deck.description_en = "English description"
        deck.description_ru = "Русское описание"

        name, description = get_localized_deck_content(deck, "el")
        assert name == "Ελληνικά"
        assert description == "English description"
