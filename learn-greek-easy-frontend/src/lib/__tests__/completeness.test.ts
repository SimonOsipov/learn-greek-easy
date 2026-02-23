/**
 * Tests for completeness.ts utilities (ADMINUX-08-01)
 */
import { describe, it, expect } from 'vitest';
import { computeChipsFromCard, computeCompletionPercentage } from '../completeness';
import type { AdminVocabularyCard } from '@/services/adminAPI';

// ============================================
// Factory Function
// ============================================

const createCard = (overrides?: Partial<AdminVocabularyCard>): AdminVocabularyCard => ({
  id: 'card-1',
  deck_id: 'deck-v2',
  front_text: 'μητέρα',
  back_text_en: 'mother',
  back_text_ru: 'мать',
  example_sentence: null,
  pronunciation: '/mi*te*ra/',
  part_of_speech: 'noun',
  level: 'A1',
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  gender: 'feminine',
  has_examples: true,
  has_audio: true,
  has_grammar: true,
  translation_en_plural: 'mothers',
  translation_ru_plural: 'матери',
  audio_status: 'ready',
  grammar_filled: 9,
  grammar_total: 9,
  example_count: 2,
  examples_with_en: 2,
  examples_with_ru: 2,
  examples_with_audio: 2,
  ...overrides,
});

// ============================================
// computeChipsFromCard tests
// ============================================

describe('computeChipsFromCard', () => {
  describe('fully-complete card', () => {
    it('returns 6 chips', () => {
      const chips = computeChipsFromCard(createCard());
      expect(chips).toHaveLength(6);
    });

    it('all visible chips for a noun', () => {
      const chips = computeChipsFromCard(createCard());
      expect(chips.every((c) => c.visible)).toBe(true);
    });

    it('all chips are green for a fully-enriched card', () => {
      const chips = computeChipsFromCard(createCard());
      expect(chips.every((c) => c.color === 'green')).toBe(true);
    });
  });

  describe('empty card', () => {
    it('EN chip is yellow (never gray) when only back_text_en is set', () => {
      const chips = computeChipsFromCard(
        createCard({
          back_text_en: 'mother',
          translation_en_plural: null,
        })
      );
      const enChip = chips.find((c) => c.name === 'en')!;
      expect(enChip.color).toBe('yellow');
    });

    it('RU chip is gray when both RU fields are missing', () => {
      const chips = computeChipsFromCard(
        createCard({ back_text_ru: null, translation_ru_plural: null })
      );
      const ruChip = chips.find((c) => c.name === 'ru')!;
      expect(ruChip.color).toBe('gray');
    });

    it('Pron chip is gray when pronunciation is null', () => {
      const chips = computeChipsFromCard(createCard({ pronunciation: null }));
      const pronChip = chips.find((c) => c.name === 'pron')!;
      expect(pronChip.color).toBe('gray');
    });

    it('Audio chip is gray when audio_status is missing', () => {
      const chips = computeChipsFromCard(createCard({ audio_status: 'missing' }));
      const audioChip = chips.find((c) => c.name === 'audio')!;
      expect(audioChip.color).toBe('gray');
    });

    it('Ex chip is gray when no examples', () => {
      const chips = computeChipsFromCard(
        createCard({
          example_count: 0,
          examples_with_en: 0,
          examples_with_ru: 0,
          examples_with_audio: 0,
        })
      );
      const exChip = chips.find((c) => c.name === 'ex')!;
      expect(exChip.color).toBe('gray');
    });
  });

  describe('chip label formats', () => {
    it('EN chip label: "EN 2/2"', () => {
      const chips = computeChipsFromCard(createCard());
      expect(chips.find((c) => c.name === 'en')!.label).toBe('EN 2/2');
    });

    it('EN chip label: "EN 1/2" when plural missing', () => {
      const chips = computeChipsFromCard(createCard({ translation_en_plural: null }));
      expect(chips.find((c) => c.name === 'en')!.label).toBe('EN 1/2');
    });

    it('RU chip label: "RU 2/2"', () => {
      const chips = computeChipsFromCard(createCard());
      expect(chips.find((c) => c.name === 'ru')!.label).toBe('RU 2/2');
    });

    it('Pron chip label: "Pron ✓" when present', () => {
      const chips = computeChipsFromCard(createCard());
      expect(chips.find((c) => c.name === 'pron')!.label).toBe('Pron ✓');
    });

    it('Pron chip label: "Pron ✗" when missing', () => {
      const chips = computeChipsFromCard(createCard({ pronunciation: null }));
      expect(chips.find((c) => c.name === 'pron')!.label).toBe('Pron ✗');
    });

    it('Audio chip label: "Audio ✓" when ready', () => {
      const chips = computeChipsFromCard(createCard({ audio_status: 'ready' }));
      expect(chips.find((c) => c.name === 'audio')!.label).toBe('Audio ✓');
    });

    it('Audio chip label: "Audio …" when generating', () => {
      const chips = computeChipsFromCard(createCard({ audio_status: 'generating' }));
      expect(chips.find((c) => c.name === 'audio')!.label).toBe('Audio …');
    });

    it('Audio chip label: "Audio ✗" when missing', () => {
      const chips = computeChipsFromCard(createCard({ audio_status: 'missing' }));
      expect(chips.find((c) => c.name === 'audio')!.label).toBe('Audio ✗');
    });

    it('Gram chip label: "Gram 5/9"', () => {
      const chips = computeChipsFromCard(createCard({ grammar_filled: 5, grammar_total: 9 }));
      expect(chips.find((c) => c.name === 'gram')!.label).toBe('Gram 5/9');
    });

    it('Ex chip label: "Ex 3"', () => {
      const chips = computeChipsFromCard(createCard({ example_count: 3 }));
      expect(chips.find((c) => c.name === 'ex')!.label).toBe('Ex 3');
    });
  });

  describe('visibility', () => {
    it('gram chip is not visible when grammar_total is 0', () => {
      const chips = computeChipsFromCard(createCard({ grammar_total: 0, grammar_filled: 0 }));
      const gramChip = chips.find((c) => c.name === 'gram')!;
      expect(gramChip.visible).toBe(false);
    });

    it('gram chip is visible when grammar_total > 0', () => {
      const chips = computeChipsFromCard(createCard({ grammar_total: 9, grammar_filled: 5 }));
      const gramChip = chips.find((c) => c.name === 'gram')!;
      expect(gramChip.visible).toBe(true);
    });

    it('all other chips always visible', () => {
      const chips = computeChipsFromCard(createCard());
      const nonGram = chips.filter((c) => c.name !== 'gram');
      expect(nonGram.every((c) => c.visible)).toBe(true);
    });
  });

  describe('ratios for completion', () => {
    it('EN ratio is 1.0 when 2/2', () => {
      const chips = computeChipsFromCard(createCard());
      expect(chips.find((c) => c.name === 'en')!.ratio).toBe(1);
    });

    it('EN ratio is 0.5 when 1/2', () => {
      const chips = computeChipsFromCard(createCard({ translation_en_plural: null }));
      expect(chips.find((c) => c.name === 'en')!.ratio).toBe(0.5);
    });

    it('Audio ratio is 0.5 when generating', () => {
      const chips = computeChipsFromCard(createCard({ audio_status: 'generating' }));
      expect(chips.find((c) => c.name === 'audio')!.ratio).toBe(0.5);
    });

    it('gram ratio is 1.0 when grammar_total is 0 (not penalized)', () => {
      const chips = computeChipsFromCard(createCard({ grammar_total: 0, grammar_filled: 0 }));
      expect(chips.find((c) => c.name === 'gram')!.ratio).toBe(1);
    });
  });
});

// ============================================
// computeCompletionPercentage tests
// ============================================

describe('computeCompletionPercentage', () => {
  it('returns 100 for a fully-complete card', () => {
    const pct = computeCompletionPercentage(createCard());
    expect(pct).toBe(100);
  });

  it('returns a low percentage for an empty card', () => {
    const pct = computeCompletionPercentage(
      createCard({
        back_text_ru: null,
        translation_ru_plural: null,
        pronunciation: null,
        audio_status: 'missing',
        grammar_filled: 0,
        grammar_total: 9,
        example_count: 0,
        examples_with_en: 0,
        examples_with_ru: 0,
        examples_with_audio: 0,
        translation_en_plural: null,
      })
    );
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThan(50);
  });

  it('phrase card (grammar_total=0) is not penalized for grammar', () => {
    // Phrase with all fields except grammar (grammar_total=0 means no grammar expected)
    const pct = computeCompletionPercentage(
      createCard({
        grammar_total: 0,
        grammar_filled: 0,
      })
    );
    // Full card otherwise — still 100% since grammar_total=0 gives ratio=1
    expect(pct).toBe(100);
  });

  it('returns a number between 0 and 100', () => {
    const pct = computeCompletionPercentage(createCard({ audio_status: 'missing' }));
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
  });
});
