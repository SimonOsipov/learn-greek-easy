import type { CardRecordType } from '@/services/wordEntryAPI';

/**
 * Display categories for card type badges.
 * Maps multiple CardRecordType values to user-facing badge labels.
 */
export type MediaType = 'vocabulary' | 'sentence' | 'plural' | 'article' | 'grammar';

/**
 * Maps a card record type to its display media type category.
 * Uses exhaustive switch for compile-time safety when new card types are added.
 *
 * @param cardType - The card_type value from CardRecordResponse
 * @returns The display category for badge rendering
 */
export function getMediaType(cardType: CardRecordType): MediaType {
  switch (cardType) {
    case 'meaning_el_to_en':
    case 'meaning_en_to_el':
      return 'vocabulary';
    case 'sentence_translation':
      return 'sentence';
    case 'plural_form':
      return 'plural';
    case 'article':
      return 'article';
    case 'conjugation':
    case 'declension':
    case 'cloze':
      return 'grammar';
  }
}
