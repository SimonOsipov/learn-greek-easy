/**
 * pf/families.ts — unit tests (PRACT2-1-01)
 *
 * Covers:
 * - familyForCardType(): all 8 live card types map to expected families
 * - familyForCardType(): unknown string / null / undefined → translation fallback
 * - descriptorForCardType(): returns matching FAMILIES entry
 * - All tone values are one of the 5 known index.css tokens
 */

import { describe, it, expect } from 'vitest';

import type { CardRecordType } from '@/services/wordEntryAPI';

import {
  FAMILIES,
  familyForCardType,
  descriptorForCardType,
  type PracticeFamily,
} from '../families';

// ─── Known token names ───────────────────────────────────────────────────────

const VALID_TONES = new Set(['primary', 'accent', 'accent-2', 'accent-3', 'success']);

// ─── Live card type → family mapping ────────────────────────────────────────

describe('familyForCardType()', () => {
  const EXPECTED: Array<[CardRecordType, PracticeFamily]> = [
    ['meaning_el_to_en', 'translation'],
    ['meaning_en_to_el', 'translation'],
    ['sentence_translation', 'sentence'],
    ['cloze', 'sentence'],
    ['conjugation', 'grammar'],
    ['article', 'grammar'],
    ['declension', 'declension'],
    ['plural_form', 'declension'],
  ];

  it.each(EXPECTED)('card_type "%s" maps to family "%s"', (cardType, expectedFamily) => {
    expect(familyForCardType(cardType)).toBe(expectedFamily);
  });

  it('returns "translation" for unknown string (fallback, AC #2)', () => {
    expect(familyForCardType('future_audio_type')).toBe('translation');
    expect(familyForCardType('completely_unknown')).toBe('translation');
  });

  it('returns "translation" for null (AC #2)', () => {
    expect(familyForCardType(null)).toBe('translation');
  });

  it('returns "translation" for undefined (AC #2)', () => {
    expect(familyForCardType(undefined)).toBe('translation');
  });

  it('returns "translation" for empty string (AC #2)', () => {
    expect(familyForCardType('')).toBe('translation');
  });
});

// ─── descriptorForCardType() ─────────────────────────────────────────────────

describe('descriptorForCardType()', () => {
  it('returns the matching FAMILIES entry for each live card type', () => {
    const cases: Array<[CardRecordType, PracticeFamily]> = [
      ['meaning_el_to_en', 'translation'],
      ['meaning_en_to_el', 'translation'],
      ['sentence_translation', 'sentence'],
      ['cloze', 'sentence'],
      ['conjugation', 'grammar'],
      ['article', 'grammar'],
      ['declension', 'declension'],
      ['plural_form', 'declension'],
    ];
    cases.forEach(([cardType, expectedFamily]) => {
      const d = descriptorForCardType(cardType);
      expect(d).toBe(FAMILIES[expectedFamily]);
      expect(d.family).toBe(expectedFamily);
    });
  });

  it('falls back to translation descriptor for null/undefined/unknown', () => {
    expect(descriptorForCardType(null)).toBe(FAMILIES.translation);
    expect(descriptorForCardType(undefined)).toBe(FAMILIES.translation);
    expect(descriptorForCardType('bogus_type')).toBe(FAMILIES.translation);
  });
});

// ─── FAMILIES — tone integrity ───────────────────────────────────────────────

describe('FAMILIES', () => {
  const families = Object.values(FAMILIES);

  it('every family entry has a tone that is one of the 5 known index.css tokens', () => {
    families.forEach((d) => {
      expect(VALID_TONES.has(d.tone)).toBe(true);
    });
  });

  it('every family entry has the correct family field matching its key', () => {
    (Object.keys(FAMILIES) as PracticeFamily[]).forEach((key) => {
      expect(FAMILIES[key].family).toBe(key);
    });
  });

  it('every family entry has non-empty label and short', () => {
    families.forEach((d) => {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.short.length).toBeGreaterThan(0);
    });
  });

  it('five families are defined', () => {
    expect(families).toHaveLength(5);
  });
});
