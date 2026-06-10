/**
 * Word-detail presentation helpers (MOB-12).
 *
 * Gender badge colours: fixed semantic accents, same in both themes.
 * Mastery dot colours: same convention — fixed, not token-resolved.
 * Card-type → group mapping: drives the Cards panel grouping.
 * Noun declension extractor: reads grammar_data keys into case rows.
 *
 * All values follow the MOB-13 explicit rgba convention — no /NN modifier on
 * var-backed tokens. See learn-greek-easy-mobile/docs/design-tokens.md.
 */

import type { CardType, CardMasteryStatus } from '@/types/word';
import type { WordMasteryItem } from '@/types/deck';

// ---------------------------------------------------------------------------
// Gender badge accents (both themes — handoff "Design tokens" table)
// ---------------------------------------------------------------------------

/** Solid foreground colour per grammatical gender. */
export const GENDER_FG: Record<string, string> = {
  masculine: 'rgb(31,104,190)',  // hsl(212 85% 45%)
  feminine:  'rgb(181,38,101)',  // hsl(340 65% 50%)
  neuter:    'rgb(29,154,111)',  // hsl(160 60% 40%)
};

/** Short display label per grammatical gender. */
export const GENDER_LABEL: Record<string, string> = {
  masculine: 'masc',
  feminine:  'fem',
  neuter:    'neut',
};

// ---------------------------------------------------------------------------
// Mastery dot colours (fixed semantic, both themes)
// ---------------------------------------------------------------------------

/** Hex-free solid/rgba colours for the mastery dot. */
export const MASTERY_DOT_COLOR: Record<CardMasteryStatus, string> = {
  mastered: 'rgb(37,177,130)',       // hsl(160 65% 42%) — correct token value
  studied:  'rgb(36,99,235)',        // hsl(221 83% 53%) — primary
  new:      'rgba(127,136,159,0.4)', // --fg-3 at 40% alpha (MOB-13: explicit rgba)
};

// ---------------------------------------------------------------------------
// Card-type → display group mapping (drives Cards panel grouping)
// ---------------------------------------------------------------------------

/** Display group label for each card_type. Drives the Cards panel grouping. */
export const CARD_TYPE_GROUP: Record<CardType, string> = {
  meaning_el_to_en:     'Translation',
  meaning_en_to_el:     'Translation',
  cloze:                'Translation',
  sentence_translation: 'Translation',
  conjugation:          'Grammar',
  plural_form:          'Grammar',
  article:              'Grammar',
  declension:           'Declension',
};

/** Display order for card groups (matches design handoff). */
export const CARD_GROUP_ORDER = ['Translation', 'Grammar', 'Declension'] as const;
export type CardGroupName = (typeof CARD_GROUP_ORDER)[number];

// ---------------------------------------------------------------------------
// Card mastery derivation from WordMasteryItem.type_progress
// ---------------------------------------------------------------------------

/**
 * Derives the per-card mastery status from the word's type_progress list.
 * Mirrors web deriveCardTypeMasteryStatus (WordBrowser / V2DeckPage):
 *   - no row for this card_type OR studied_count === 0  → 'new'
 *   - mastered_count === total_count && total > 0        → 'mastered'
 *   - otherwise                                          → 'studied'
 */
export function deriveCardMasteryStatus(
  cardType: CardType,
  mastery: WordMasteryItem | undefined,
): CardMasteryStatus {
  if (!mastery) return 'new';
  const row = mastery.type_progress.find((tp) => tp.card_type === cardType);
  if (!row || row.studied_count === 0) return 'new';
  if (row.mastered_count === row.total_count && row.total_count > 0) return 'mastered';
  return 'studied';
}

// ---------------------------------------------------------------------------
// Noun declension table extraction from grammar_data
// ---------------------------------------------------------------------------

export interface DeclensionRow {
  caseName: string;
  singular: string;
  plural: string;
}

/** Ordered Greek case names for the declension table. */
const CASE_KEYS = [
  { caseName: 'Nominative', sg: 'nominative_singular', pl: 'nominative_plural' },
  { caseName: 'Genitive',   sg: 'genitive_singular',   pl: 'genitive_plural'   },
  { caseName: 'Accusative', sg: 'accusative_singular', pl: 'accusative_plural' },
  { caseName: 'Vocative',   sg: 'vocative_singular',   pl: 'vocative_plural'   },
] as const;

/**
 * Extracts declension rows from the grammar_data dict.
 * Returns null if grammar_data is missing or has no declension keys.
 */
export function extractDeclension(
  grammarData: Record<string, unknown> | null | undefined,
): DeclensionRow[] | null {
  if (!grammarData) return null;
  const rows: DeclensionRow[] = [];
  for (const { caseName, sg, pl } of CASE_KEYS) {
    const singular = grammarData[sg];
    const plural = grammarData[pl];
    if (typeof singular === 'string' || typeof plural === 'string') {
      rows.push({
        caseName,
        singular: typeof singular === 'string' ? singular : '—',
        plural: typeof plural === 'string' ? plural : '—',
      });
    }
  }
  return rows.length > 0 ? rows : null;
}
