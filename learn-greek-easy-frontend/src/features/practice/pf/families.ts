// src/features/practice/pf/families.ts
//
// Single source of truth: collapses 8 live CardRecordType values into 5 visual
// practice families. Every downstream PRACT2-1 subtask (kicker tint, accent bar,
// progress tick, ambient glow) reads its color / label from this map.
//
// The `audio` family is reserved for future use. No live card_type maps to it
// today; it is unreachable via familyForCardType until an audio card_type ships.

import type { CardRecordType } from '@/services/wordEntryAPI';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type PracticeFamily = 'translation' | 'sentence' | 'grammar' | 'declension' | 'audio';

export interface FamilyDescriptor {
  /** The practice family identifier. */
  family: PracticeFamily;
  /**
   * Token name without hsl() wrapper, e.g. 'primary' | 'accent' | 'accent-2'.
   * Maps to an existing `--<tone>` custom property in src/index.css.
   * The shell composes `hsl(var(--${tone}))`.
   */
  tone: string;
  /** Full label — i18n key or English fallback for the kicker. */
  label: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Family → descriptor
// ────────────────────────────────────────────────────────────────────────────

/**
 * All five practice families with their design-system tone, labels.
 * Tone names map 1-to-1 to existing index.css tokens (--primary, --accent,
 * --accent-2, --accent-3, --success). Only --primary flips in dark mode;
 * the other four are intentionally theme-invariant — do NOT add dark
 * declarations for them (verified: index.css:176 marks them 'same').
 */
export const FAMILIES: Record<PracticeFamily, FamilyDescriptor> = {
  translation: { family: 'translation', tone: 'primary', label: 'Translation' },
  sentence: { family: 'sentence', tone: 'accent-2', label: 'Sentence' },
  grammar: { family: 'grammar', tone: 'accent', label: 'Grammar' },
  declension: { family: 'declension', tone: 'accent-3', label: 'Declension' },
  audio: { family: 'audio', tone: 'success', label: 'Audio' },
};

// ────────────────────────────────────────────────────────────────────────────
// Card type → family
// ────────────────────────────────────────────────────────────────────────────

/**
 * Maps every live CardRecordType to a PracticeFamily.
 * Typed as Record<CardRecordType, PracticeFamily> (no default/catch-all branch)
 * so that adding a new member to the CardRecordType union is a compile error
 * here — forces the map to stay exhaustive at the type level.
 *
 * Runtime fallback for unknown strings lives in familyForCardType() below.
 *
 * Mapping rationale (verified against wordEntryAPI.ts:124):
 *   meaning_el_to_en, meaning_en_to_el -> translation  (vocab recall in both directions)
 *   sentence_translation, cloze        -> sentence     (sentence-level exercises)
 *   conjugation, article               -> grammar      (inflection / grammatical form)
 *   declension, plural_form            -> declension   (paradigm / form table)
 */
const CARD_TYPE_FAMILY: Record<CardRecordType, PracticeFamily> = {
  meaning_el_to_en: 'translation',
  meaning_en_to_el: 'translation',
  sentence_translation: 'sentence',
  cloze: 'sentence',
  conjugation: 'grammar',
  article: 'grammar',
  declension: 'declension',
  plural_form: 'declension',
};

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns the PracticeFamily for a given card_type string.
 * Accepts the typed CardRecordType or any looser string/null/undefined so
 * callers don't need to pre-narrow (e.g. when reading from an API response
 * that may carry a future card_type not yet in the enum).
 * Falls back to 'translation' for unknown / null / undefined inputs (AC #2).
 */
export function familyForCardType(t: CardRecordType | string | null | undefined): PracticeFamily {
  if (t && t in CARD_TYPE_FAMILY) return CARD_TYPE_FAMILY[t as CardRecordType];
  return 'translation'; // safe fallback for unknown / future card types
}

/**
 * Returns the full FamilyDescriptor for a given card_type.
 * Convenience wrapper over familyForCardType + FAMILIES lookup.
 */
export function descriptorForCardType(
  t: CardRecordType | string | null | undefined
): FamilyDescriptor {
  return FAMILIES[familyForCardType(t)];
}
