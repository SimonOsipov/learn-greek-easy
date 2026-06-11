/// <reference types="jest" />
/**
 * Unit tests for src/lib/words/presentation.ts (MOB-12).
 *
 * Tests:
 *   1. extractDeclension — verbatim web-format grammar_data fixture produces
 *      expected rows (nominative/genitive/accusative/vocative × singular/plural).
 *   2. extractDeclension — partial data (only nominative) still returns rows.
 *   3. extractDeclension — null/empty grammar_data returns null.
 *   4. extractDeclension — grammar_data with only unsupported keys returns null.
 *   5. extractDeclension — missing plural falls back to '—'.
 *   6. deriveCardMasteryStatus — no mastery item → 'new'.
 *   7. deriveCardMasteryStatus — studied but not mastered → 'studied'.
 *   8. deriveCardMasteryStatus — mastered_count === total_count → 'mastered'.
 */

import {
  extractDeclension,
  deriveCardMasteryStatus,
} from '../presentation';
import type { WordMasteryItem } from '@/types/deck';

// ---------------------------------------------------------------------------
// extractDeclension
// ---------------------------------------------------------------------------

describe('extractDeclension', () => {
  /**
   * Verbatim web-format grammar_data for a Greek noun (δωμάτιο — neuter).
   * Key format matches backend src/db/models.py WordEntry.grammar_data convention
   * used by the web frontend (learn-greek-easy-frontend features/words).
   */
  const FULL_DECLENSION_FIXTURE: Record<string, unknown> = {
    gender: 'neuter',
    nominative_singular: 'δωμάτιο',
    nominative_plural:   'δωμάτια',
    genitive_singular:   'δωματίου',
    genitive_plural:     'δωματίων',
    accusative_singular: 'δωμάτιο',
    accusative_plural:   'δωμάτια',
    vocative_singular:   'δωμάτιο',
    vocative_plural:     'δωμάτια',
  };

  it('extracts all four cases from a verbatim web-format grammar_data fixture', () => {
    const rows = extractDeclension(FULL_DECLENSION_FIXTURE);
    expect(rows).not.toBeNull();
    expect(rows).toHaveLength(4);

    expect(rows![0]).toEqual({
      caseName: 'Nominative',
      singular: 'δωμάτιο',
      plural:   'δωμάτια',
    });
    expect(rows![1]).toEqual({
      caseName: 'Genitive',
      singular: 'δωματίου',
      plural:   'δωματίων',
    });
    expect(rows![2]).toEqual({
      caseName: 'Accusative',
      singular: 'δωμάτιο',
      plural:   'δωμάτια',
    });
    expect(rows![3]).toEqual({
      caseName: 'Vocative',
      singular: 'δωμάτιο',
      plural:   'δωμάτια',
    });
  });

  it('returns rows even when only the nominative case is present', () => {
    const partial = {
      nominative_singular: 'λόγος',
      nominative_plural:   'λόγοι',
    };
    const rows = extractDeclension(partial);
    expect(rows).not.toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows![0].caseName).toBe('Nominative');
  });

  it('returns null for null grammar_data', () => {
    expect(extractDeclension(null)).toBeNull();
  });

  it('returns null for undefined grammar_data', () => {
    expect(extractDeclension(undefined)).toBeNull();
  });

  it('returns null when grammar_data has no declension keys', () => {
    expect(extractDeclension({ gender: 'masculine', note: 'irregular' })).toBeNull();
  });

  it('falls back to em-dash when a plural form is missing', () => {
    const partial = { nominative_singular: 'ο ήλιος' }; // no plural
    const rows = extractDeclension(partial);
    expect(rows).not.toBeNull();
    expect(rows![0].plural).toBe('—');
  });
});

// ---------------------------------------------------------------------------
// deriveCardMasteryStatus
// ---------------------------------------------------------------------------

// Minimal WordMasteryItem factory.
function makeMastery(
  overrides: Partial<{
    word_entry_id: string;
    mastered_count: number;
    studied_count: number;
    total_count: number;
    type_progress: {
      card_type: string;
      mastered_count: number;
      studied_count: number;
      total_count: number;
    }[];
  }>,
): WordMasteryItem {
  return {
    word_entry_id: 'word-1',
    mastered_count: 0,
    studied_count: 0,
    total_count: 2,
    type_progress: [],
    ...overrides,
  } as WordMasteryItem;
}

describe('deriveCardMasteryStatus', () => {
  it('returns "new" when mastery is undefined', () => {
    expect(deriveCardMasteryStatus('meaning_el_to_en', undefined)).toBe('new');
  });

  it('returns "new" when type_progress has no row for card_type', () => {
    const mastery = makeMastery({ type_progress: [] });
    expect(deriveCardMasteryStatus('meaning_el_to_en', mastery)).toBe('new');
  });

  it('returns "new" when studied_count is 0', () => {
    const mastery = makeMastery({
      type_progress: [{ card_type: 'meaning_el_to_en', mastered_count: 0, studied_count: 0, total_count: 1 }],
    });
    expect(deriveCardMasteryStatus('meaning_el_to_en', mastery)).toBe('new');
  });

  it('returns "mastered" when mastered_count equals total_count', () => {
    const mastery = makeMastery({
      type_progress: [{ card_type: 'meaning_el_to_en', mastered_count: 2, studied_count: 2, total_count: 2 }],
    });
    expect(deriveCardMasteryStatus('meaning_el_to_en', mastery)).toBe('mastered');
  });

  it('returns "studied" when studied but not all mastered', () => {
    const mastery = makeMastery({
      type_progress: [{ card_type: 'meaning_el_to_en', mastered_count: 0, studied_count: 1, total_count: 2 }],
    });
    expect(deriveCardMasteryStatus('meaning_el_to_en', mastery)).toBe('studied');
  });
});
