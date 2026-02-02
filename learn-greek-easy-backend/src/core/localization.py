"""Localization utilities for multi-language content.

This module provides:
- Supported locales configuration
- Helper functions for extracting localized content from models
"""

from typing import Any

# Supported locales with English as fallback
SUPPORTED_LOCALES = frozenset(["en", "el", "ru"])
DEFAULT_LOCALE = "en"


def normalize_locale(locale: str | None) -> str:
    """Normalize locale code with fallback to default.

    Args:
        locale: Raw locale code (e.g., "el", "en-US")

    Returns:
        Normalized locale code from SUPPORTED_LOCALES
    """
    if not locale:
        return DEFAULT_LOCALE
    base_locale = locale.split("-")[0].lower()
    return base_locale if base_locale in SUPPORTED_LOCALES else DEFAULT_LOCALE


def get_localized_deck_content(
    deck: Any,
    locale: str,
) -> tuple[str, str | None]:
    """Get localized name and description for a deck.

    Args:
        deck: Deck object with localized fields
        locale: Target locale code (en, el, ru)

    Returns:
        Tuple of (name, description) in the requested locale.
        Falls back to English if the requested locale is not available.

    Example:
        name, description = get_localized_deck_content(deck, "el")
    """
    normalized = normalize_locale(locale)

    if normalized == "el":
        # Greek: use Greek if available, fallback to English
        name = deck.name_el or deck.name_en
        description = deck.description_el or deck.description_en
    elif normalized == "ru":
        # Russian: use Russian if available, fallback to English
        name = deck.name_ru or deck.name_en
        description = deck.description_ru or deck.description_en
    else:
        # English (default)
        name = deck.name_en
        description = deck.description_en

    return name, description


__all__ = [
    "DEFAULT_LOCALE",
    "SUPPORTED_LOCALES",
    "get_localized_deck_content",
    "normalize_locale",
]
