/**
 * Shared utility for resolving deck name/description based on current locale.
 *
 * Supports both camelCase (Deck type from store) and snake_case
 * (UnifiedDeckItem from admin API) field names for reuse across
 * public and admin pages.
 */

/**
 * Resolves deck name based on current locale.
 * Falls back to English if the target locale is not available.
 */
export function getLocalizedDeckName(
  deck: {
    name?: string;
    title?: string;
    nameEn?: string;
    nameRu?: string;
    name_en?: string;
    name_ru?: string;
  },
  locale: string
): string {
  if (locale === 'ru') {
    return (
      deck.nameRu || deck.name_ru || deck.nameEn || deck.name_en || deck.name || deck.title || ''
    );
  }
  return deck.nameEn || deck.name_en || deck.name || deck.title || '';
}

/**
 * Resolves deck description based on current locale.
 */
export function getLocalizedDeckDescription(
  deck: {
    description?: string | null;
    descriptionEn?: string | null;
    descriptionRu?: string | null;
    description_en?: string | null;
    description_ru?: string | null;
  },
  locale: string
): string | null {
  if (locale === 'ru') {
    return (
      deck.descriptionRu ||
      deck.description_ru ||
      deck.descriptionEn ||
      deck.description_en ||
      deck.description ||
      null
    );
  }
  return deck.descriptionEn || deck.description_en || deck.description || null;
}
