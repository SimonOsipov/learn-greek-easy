/**
 * Tests for getCardTypeEligibility (CGEN-04)
 */
import { describe, it, expect } from 'vitest';

import { getCardTypeEligibility } from '@/lib/cardTypeEligibility';
import type { WordEntryResponse } from '@/services/wordEntryAPI';

// ============================================
// Factory
// ============================================

const createEntry = (overrides: Partial<WordEntryResponse> = {}): WordEntryResponse => ({
  id: 'entry-1',
  deck_id: 'deck-1',
  lemma: 'σπίτι',
  part_of_speech: 'noun',
  translation_en: 'house',
  translation_en_plural: null,
  translation_ru: 'dom',
  translation_ru_plural: null,
  pronunciation: null,
  grammar_data: {
    gender: 'neuter',
    cases: {
      singular: { nominative: 'spiti' },
      plural: { nominative: 'spitia' },
    },
  },
  examples: [
    {
      id: 'ex1',
      greek: 'Sentence.',
      english: 'Translation.',
    },
  ],
  audio_key: null,
  audio_url: null,
  audio_status: 'ready',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

// ============================================
// Tests
// ============================================

describe('getCardTypeEligibility', () => {
  // ============================================
  // meaning eligibility
  // ============================================

  describe('meaning eligibility', () => {
    it('is true when translation_en and translation_ru are both present', () => {
      const result = getCardTypeEligibility(createEntry());
      expect(result.meaning).toBe(true);
    });

    it('is false when translation_en is empty string', () => {
      const result = getCardTypeEligibility(createEntry({ translation_en: '' }));
      expect(result.meaning).toBe(false);
    });

    it('is false when translation_ru is null', () => {
      const result = getCardTypeEligibility(createEntry({ translation_ru: null }));
      expect(result.meaning).toBe(false);
    });

    it('is false when translation_ru is empty string', () => {
      const result = getCardTypeEligibility(createEntry({ translation_ru: '' }));
      expect(result.meaning).toBe(false);
    });

    it('is false when both translation_en and translation_ru are missing', () => {
      const result = getCardTypeEligibility(
        createEntry({ translation_en: '', translation_ru: null })
      );
      expect(result.meaning).toBe(false);
    });
  });

  // ============================================
  // plural_form eligibility — noun path
  // ============================================

  describe('plural_form eligibility — noun path', () => {
    it('is true for a noun with singular and plural nominative in grammar_data', () => {
      const result = getCardTypeEligibility(createEntry());
      expect(result.plural_form).toBe(true);
    });

    it('is false when grammar_data is null', () => {
      const result = getCardTypeEligibility(createEntry({ grammar_data: null }));
      expect(result.plural_form).toBe(false);
    });

    it('is false when singular nominative is missing', () => {
      const result = getCardTypeEligibility(
        createEntry({
          grammar_data: {
            gender: 'neuter',
            cases: {
              singular: {},
              plural: { nominative: 'spitia' },
            },
          },
        })
      );
      expect(result.plural_form).toBe(false);
    });

    it('is false when plural nominative is missing', () => {
      const result = getCardTypeEligibility(
        createEntry({
          grammar_data: {
            gender: 'neuter',
            cases: {
              singular: { nominative: 'spiti' },
              plural: {},
            },
          },
        })
      );
      expect(result.plural_form).toBe(false);
    });

    it('is false when singular nominative is an empty string', () => {
      const result = getCardTypeEligibility(
        createEntry({
          grammar_data: {
            gender: 'neuter',
            cases: {
              singular: { nominative: '' },
              plural: { nominative: 'spitia' },
            },
          },
        })
      );
      expect(result.plural_form).toBe(false);
    });
  });

  // ============================================
  // plural_form eligibility — adjective path
  // ============================================

  describe('plural_form eligibility — adjective path', () => {
    it('is true for an adjective with at least one gender having singular and plural nominative', () => {
      const result = getCardTypeEligibility(
        createEntry({
          part_of_speech: 'adjective',
          grammar_data: {
            forms: {
              masculine: {
                singular: { nominative: 'kalos' },
                plural: { nominative: 'kaloi' },
              },
            },
          },
        })
      );
      expect(result.plural_form).toBe(true);
    });

    it('is false for an adjective when no gender has both singular and plural nominative', () => {
      const result = getCardTypeEligibility(
        createEntry({
          part_of_speech: 'adjective',
          grammar_data: {
            forms: {
              masculine: {
                singular: { nominative: 'kalos' },
              },
            },
          },
        })
      );
      expect(result.plural_form).toBe(false);
    });

    it('is false for an adjective when forms is missing', () => {
      const result = getCardTypeEligibility(
        createEntry({
          part_of_speech: 'adjective',
          grammar_data: {},
        })
      );
      expect(result.plural_form).toBe(false);
    });
  });

  // ============================================
  // plural_form eligibility — wrong POS
  // ============================================

  describe('plural_form eligibility — wrong part of speech', () => {
    it('is false for a verb even with full grammar_data', () => {
      const result = getCardTypeEligibility(
        createEntry({
          part_of_speech: 'verb',
          grammar_data: {
            cases: {
              singular: { nominative: 'x' },
              plural: { nominative: 'y' },
            },
          },
        })
      );
      expect(result.plural_form).toBe(false);
    });

    it('is false for an adverb', () => {
      const result = getCardTypeEligibility(createEntry({ part_of_speech: 'adverb' }));
      expect(result.plural_form).toBe(false);
    });
  });

  // ============================================
  // article eligibility
  // ============================================

  describe('article eligibility', () => {
    it('is true for a noun with gender and singular nominative', () => {
      const result = getCardTypeEligibility(createEntry());
      expect(result.article).toBe(true);
    });

    it('is false when part_of_speech is not noun', () => {
      const result = getCardTypeEligibility(createEntry({ part_of_speech: 'verb' }));
      expect(result.article).toBe(false);
    });

    it('is false when grammar_data is null', () => {
      const result = getCardTypeEligibility(createEntry({ grammar_data: null }));
      expect(result.article).toBe(false);
    });

    it('is false when gender is missing', () => {
      const result = getCardTypeEligibility(
        createEntry({
          grammar_data: {
            cases: {
              singular: { nominative: 'spiti' },
              plural: { nominative: 'spitia' },
            },
          },
        })
      );
      expect(result.article).toBe(false);
    });

    it('is false when gender is an empty string', () => {
      const result = getCardTypeEligibility(
        createEntry({
          grammar_data: {
            gender: '',
            cases: {
              singular: { nominative: 'spiti' },
              plural: { nominative: 'spitia' },
            },
          },
        })
      );
      expect(result.article).toBe(false);
    });

    it('is false when singular nominative is missing', () => {
      const result = getCardTypeEligibility(
        createEntry({
          grammar_data: {
            gender: 'neuter',
            cases: {
              singular: {},
              plural: { nominative: 'spitia' },
            },
          },
        })
      );
      expect(result.article).toBe(false);
    });
  });

  // ============================================
  // sentence_translation eligibility
  // ============================================

  describe('sentence_translation eligibility', () => {
    it('is true when at least one example has id, greek, and english', () => {
      const result = getCardTypeEligibility(createEntry());
      expect(result.sentence_translation).toBe(true);
    });

    it('is false when examples is null', () => {
      const result = getCardTypeEligibility(createEntry({ examples: null }));
      expect(result.sentence_translation).toBe(false);
    });

    it('is false when examples is an empty array', () => {
      const result = getCardTypeEligibility(createEntry({ examples: [] }));
      expect(result.sentence_translation).toBe(false);
    });

    it('is false when example has no english', () => {
      const result = getCardTypeEligibility(
        createEntry({
          examples: [{ id: 'ex1', greek: 'Sentence.', english: undefined }],
        })
      );
      expect(result.sentence_translation).toBe(false);
    });

    it('is false when example has empty greek', () => {
      const result = getCardTypeEligibility(
        createEntry({
          examples: [{ id: 'ex1', greek: '', english: 'Translation.' }],
        })
      );
      expect(result.sentence_translation).toBe(false);
    });

    it('is true when at least one of multiple examples is valid', () => {
      const result = getCardTypeEligibility(
        createEntry({
          examples: [
            { id: 'ex1', greek: '', english: 'Translation.' },
            { id: 'ex2', greek: 'Sentence.', english: 'Translation.' },
          ],
        })
      );
      expect(result.sentence_translation).toBe(true);
    });
  });

  // ============================================
  // Edge cases
  // ============================================

  describe('edge cases', () => {
    it('does not throw when grammar_data contains unexpected types', () => {
      const entry = createEntry({
        grammar_data: { cases: 'not-an-object' },
      });
      expect(() => getCardTypeEligibility(entry)).not.toThrow();
    });

    it('does not throw when grammar_data.forms is a non-object', () => {
      const entry = createEntry({
        part_of_speech: 'adjective',
        grammar_data: { forms: 42 },
      });
      expect(() => getCardTypeEligibility(entry)).not.toThrow();
    });

    it('handles entry with all null optional fields without throwing', () => {
      const entry = createEntry({
        grammar_data: null,
        examples: null,
        translation_ru: null,
      });
      expect(() => getCardTypeEligibility(entry)).not.toThrow();
    });
  });

  // ============================================
  // Return shape
  // ============================================

  describe('return shape', () => {
    it('returns an object with exactly the four GenerateCardType keys', () => {
      const result = getCardTypeEligibility(createEntry());
      const keys = Object.keys(result).sort();
      expect(keys).toEqual(['article', 'meaning', 'plural_form', 'sentence_translation']);
    });

    it('all values are plain booleans', () => {
      const result = getCardTypeEligibility(createEntry());
      for (const value of Object.values(result)) {
        expect(typeof value).toBe('boolean');
      }
    });

    it('returns all false for a minimal entry with no grammar data or examples', () => {
      const result = getCardTypeEligibility(
        createEntry({
          translation_en: '',
          translation_ru: null,
          grammar_data: null,
          examples: null,
        })
      );
      expect(result).toEqual({
        meaning: false,
        plural_form: false,
        article: false,
        sentence_translation: false,
      });
    });

    it('returns all true for a fully-populated noun entry', () => {
      const result = getCardTypeEligibility(createEntry());
      expect(result).toEqual({
        meaning: true,
        plural_form: true,
        article: true,
        sentence_translation: true,
      });
    });
  });
});
