/**
 * Unit tests for cultureDeckTransform.ts
 *
 * Single transform for every culture-deck API response. Covers the
 * three-way status branch, the totalCards two-source fallback, and the
 * integer-division accuracy calc (no div-by-zero, 1/3 -> 33).
 */
import { describe, it, expect } from 'vitest';
import { transformCultureDeckResponse } from '@/lib/cultureDeckTransform';
import type { CultureDeckResponse, CultureDeckProgress } from '@/services/cultureDeckAPI';

const makeProgress = (overrides: Partial<CultureDeckProgress> = {}): CultureDeckProgress => ({
  questions_total: 10,
  questions_mastered: 0,
  questions_learning: 0,
  questions_new: 10,
  last_practiced_at: null,
  ...overrides,
});

const makeDeck = (overrides: Partial<CultureDeckResponse> = {}): CultureDeckResponse => ({
  id: 'deck-1',
  name: 'Ιστορία',
  description: 'Greek history',
  category: 'history',
  question_count: 10,
  ...overrides,
});

describe('transformCultureDeckResponse — status', () => {
  it('not-started when no progress data', () => {
    const deck = transformCultureDeckResponse(makeDeck({ progress: undefined }));
    expect(deck.progress).toBeUndefined();
  });

  it('not-started when progress present but nothing mastered or learning', () => {
    const deck = transformCultureDeckResponse(
      makeDeck({ progress: makeProgress({ questions_mastered: 0, questions_learning: 0 }) })
    );
    expect(deck.progress?.status).toBe('not-started');
  });

  it('completed when mastered === total', () => {
    const deck = transformCultureDeckResponse(
      makeDeck({
        progress: makeProgress({ questions_total: 10, questions_mastered: 10, questions_new: 0 }),
      })
    );
    expect(deck.progress?.status).toBe('completed');
  });

  it('completed when mastered exceeds total (defensive >=)', () => {
    const deck = transformCultureDeckResponse(
      makeDeck({
        progress: makeProgress({ questions_total: 10, questions_mastered: 11, questions_new: 0 }),
      })
    );
    expect(deck.progress?.status).toBe('completed');
  });

  it('in-progress when some mastered but not all', () => {
    const deck = transformCultureDeckResponse(
      makeDeck({
        progress: makeProgress({ questions_total: 10, questions_mastered: 3, questions_new: 4 }),
      })
    );
    expect(deck.progress?.status).toBe('in-progress');
  });

  it('in-progress when only learning > 0', () => {
    const deck = transformCultureDeckResponse(
      makeDeck({
        progress: makeProgress({
          questions_total: 10,
          questions_mastered: 0,
          questions_learning: 2,
          questions_new: 8,
        }),
      })
    );
    expect(deck.progress?.status).toBe('in-progress');
  });

  it('not completed when total is 0 (empty deck is not-started, not completed)', () => {
    const deck = transformCultureDeckResponse(
      makeDeck({
        question_count: 0,
        progress: makeProgress({
          questions_total: 0,
          questions_mastered: 0,
          questions_learning: 0,
          questions_new: 0,
        }),
      })
    );
    expect(deck.progress?.status).toBe('not-started');
  });
});

describe('transformCultureDeckResponse — totalCards fallback', () => {
  it('uses progress.questions_total when present', () => {
    const deck = transformCultureDeckResponse(
      makeDeck({ question_count: 99, progress: makeProgress({ questions_total: 25 }) })
    );
    expect(deck.cardCount).toBe(25);
  });

  it('falls back to question_count when no progress', () => {
    const deck = transformCultureDeckResponse(
      makeDeck({ question_count: 42, progress: undefined })
    );
    expect(deck.cardCount).toBe(42);
  });

  it('falls back to 0 when neither source available', () => {
    // question_count present but 0, no progress
    const deck = transformCultureDeckResponse(makeDeck({ question_count: 0, progress: undefined }));
    expect(deck.cardCount).toBe(0);
  });

  it('estimatedTime derives from totalCards (0.5 min/question, ceil)', () => {
    const deck = transformCultureDeckResponse(makeDeck({ question_count: 3, progress: undefined }));
    expect(deck.estimatedTime).toBe(2); // ceil(3 * 0.5) = ceil(1.5) = 2
  });
});

describe('transformCultureDeckResponse — accuracy', () => {
  it('accuracy is 0 (no div-by-zero) when questions_total is 0', () => {
    const deck = transformCultureDeckResponse(
      makeDeck({
        progress: makeProgress({
          questions_total: 0,
          questions_mastered: 0,
          questions_learning: 0,
          questions_new: 0,
        }),
      })
    );
    expect(deck.progress?.accuracy).toBe(0);
    expect(Number.isNaN(deck.progress?.accuracy)).toBe(false);
  });

  it('1/3 mastered rounds to 33', () => {
    const deck = transformCultureDeckResponse(
      makeDeck({
        progress: makeProgress({ questions_total: 3, questions_mastered: 1, questions_new: 2 }),
      })
    );
    expect(deck.progress?.accuracy).toBe(33);
  });

  it('full mastery is 100', () => {
    const deck = transformCultureDeckResponse(
      makeDeck({
        progress: makeProgress({ questions_total: 4, questions_mastered: 4, questions_new: 0 }),
      })
    );
    expect(deck.progress?.accuracy).toBe(100);
  });
});

describe('transformCultureDeckResponse — invariants & field mapping', () => {
  it('always sets category to culture and level to A1', () => {
    const deck = transformCultureDeckResponse(makeDeck({ category: 'geography' }));
    expect(deck.category).toBe('culture');
    expect(deck.level).toBe('A1');
  });

  it('uses backend category as the tag', () => {
    const deck = transformCultureDeckResponse(makeDeck({ category: 'politics' }));
    expect(deck.tags).toEqual(['politics']);
  });

  it('maps last_practiced_at into a Date when present', () => {
    const deck = transformCultureDeckResponse(
      makeDeck({ progress: makeProgress({ last_practiced_at: '2026-01-15T10:00:00Z' }) })
    );
    expect(deck.progress?.lastStudied).toBeInstanceOf(Date);
  });

  it('leaves lastStudied undefined when last_practiced_at is null', () => {
    const deck = transformCultureDeckResponse(
      makeDeck({ progress: makeProgress({ last_practiced_at: null }) })
    );
    expect(deck.progress?.lastStudied).toBeUndefined();
  });

  it('defaults isPremium to false when omitted', () => {
    const deck = transformCultureDeckResponse(makeDeck({ is_premium: undefined }));
    expect(deck.isPremium).toBe(false);
  });

  it('defaults description to empty string when null', () => {
    const deck = transformCultureDeckResponse(makeDeck({ description: null }));
    expect(deck.description).toBe('');
  });
});
