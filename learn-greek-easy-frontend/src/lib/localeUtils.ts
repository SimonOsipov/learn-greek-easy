/**
 * Shared utility for resolving word/example translations based on current locale.
 * Follows the same pattern as deckLocale.ts for deck names/descriptions.
 */

/**
 * Returns the locale-appropriate translation string with fallback.
 */
export function getLocalizedTranslation(
  translationEn: string | null | undefined,
  translationRu: string | null | undefined,
  locale: string
): string {
  const baseLang = locale?.split('-')[0];

  if (baseLang === 'ru') {
    return translationRu || translationEn || '';
  }
  return translationEn || translationRu || '';
}
