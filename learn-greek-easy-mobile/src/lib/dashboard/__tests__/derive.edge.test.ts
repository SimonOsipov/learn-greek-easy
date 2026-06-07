/// <reference types="jest" />
/**
 * Adversarial / edge / boundary coverage for derive helpers.
 * These tests are separate from the AC tests (derive.test.ts) and cover
 * scenarios that the acceptance-criteria tests did not exercise.
 */
import type { DeckProgressSummary } from '@/types/dashboard';
import {
  greetingForHour,
  pickResumeDeck,
  isNewUser,
  buildHeatmap,
} from '../derive';

/** Minimal fixture builder for DeckProgressSummary */
function makeDeck(overrides: Partial<DeckProgressSummary>): DeckProgressSummary {
  return {
    deck_id: 'deck-default',
    deck_name: 'Default Deck',
    cards_studied: 5,
    cards_mastered: 2,
    cards_due: 0,
    mastery_percentage: 40,
    completion_percentage: 50,
    last_studied_at: '2024-01-01T10:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// pickResumeDeck — edge cases
// ---------------------------------------------------------------------------
describe('pickResumeDeck — edge cases', () => {
  describe('null last_studied_at handling', () => {
    it('does not crash when last_studied_at is null on a qualifying deck', () => {
      const deck = makeDeck({ deck_id: 'null-ts', last_studied_at: null });
      expect(() => pickResumeDeck([deck])).not.toThrow();
    });

    it('returns the deck (does not filter it out) when last_studied_at is null and it is the only qualifier', () => {
      // A deck with null last_studied_at is still in-progress and should be
      // returned if it is the only qualifying deck.
      const deck = makeDeck({ deck_id: 'null-only', last_studied_at: null });
      expect(pickResumeDeck([deck])?.deck_id).toBe('null-only');
    });

    it('null last_studied_at sorts lower than any real timestamp (real timestamp wins)', () => {
      // Per spec: "null last_studied_at is treated as the lowest possible value (never wins)."
      const withTimestamp = makeDeck({
        deck_id: 'has-ts',
        last_studied_at: '2020-01-01T00:00:00Z', // very old — but non-null
        cards_due: 0,
      });
      const withNull = makeDeck({
        deck_id: 'null-ts',
        last_studied_at: null,
        cards_due: 0,
      });
      expect(pickResumeDeck([withNull, withTimestamp])?.deck_id).toBe('has-ts');
      // Also verify order-independence
      expect(pickResumeDeck([withTimestamp, withNull])?.deck_id).toBe('has-ts');
    });

    it('when two due decks both have null last_studied_at, the first in the array is returned (stable)', () => {
      // Both null → '' > '' is false, so `best` (first element) is always kept.
      const first = makeDeck({ deck_id: 'first-null', last_studied_at: null, cards_due: 3 });
      const second = makeDeck({ deck_id: 'second-null', last_studied_at: null, cards_due: 1 });
      // Tie-break: reduce keeps `best` on equal, so first element wins.
      expect(pickResumeDeck([first, second])?.deck_id).toBe('first-null');
    });

    it('null-ts due deck beats a non-due deck with a real timestamp (due priority still applies)', () => {
      // cards_due > 0 partition is applied before last_studied_at comparison,
      // so a due deck with null ts beats a non-due deck with any ts.
      const nonDueRecent = makeDeck({
        deck_id: 'non-due-recent',
        cards_due: 0,
        last_studied_at: '2024-12-31T23:59:59Z',
      });
      const dueNullTs = makeDeck({
        deck_id: 'due-null-ts',
        cards_due: 5,
        last_studied_at: null,
      });
      expect(pickResumeDeck([nonDueRecent, dueNullTs])?.deck_id).toBe('due-null-ts');
    });
  });

  describe('stable tie-break: two due decks with identical last_studied_at', () => {
    it('returns the first element in input order when timestamps are identical', () => {
      const sharedTs = '2024-06-01T12:00:00Z';
      const first = makeDeck({ deck_id: 'first', cards_due: 2, last_studied_at: sharedTs });
      const second = makeDeck({ deck_id: 'second', cards_due: 3, last_studied_at: sharedTs });
      // The reduce comparison uses `>` (strictly greater), so equal timestamps keep `best`.
      expect(pickResumeDeck([first, second])?.deck_id).toBe('first');
    });

    it('tie-break result does not change if both decks have the same due count', () => {
      const sharedTs = '2024-06-01T12:00:00Z';
      const alpha = makeDeck({ deck_id: 'alpha', cards_due: 4, last_studied_at: sharedTs });
      const beta = makeDeck({ deck_id: 'beta', cards_due: 4, last_studied_at: sharedTs });
      expect(pickResumeDeck([alpha, beta])?.deck_id).toBe('alpha');
    });
  });

  describe('boundary: completion_percentage exactly 99 vs 100', () => {
    it('completion_percentage === 99 qualifies (< 100)', () => {
      const deck = makeDeck({ deck_id: 'almost-done', completion_percentage: 99, cards_studied: 5 });
      expect(pickResumeDeck([deck])?.deck_id).toBe('almost-done');
    });

    it('completion_percentage === 100 does not qualify', () => {
      const deck = makeDeck({ deck_id: 'done', completion_percentage: 100, cards_studied: 5 });
      expect(pickResumeDeck([deck])).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// buildHeatmap — edge cases
// ---------------------------------------------------------------------------
describe('buildHeatmap — edge cases', () => {
  describe('exact threshold boundary verification', () => {
    // The AC tests only check monotonicity and range. These pin the exact thresholds
    // so a future threshold change is caught.
    const thresholdCases: Array<{ count: number; expectedBucket: number; label: string }> = [
      { count: 0, expectedBucket: 0, label: 'exactly 0 → bucket 0' },
      { count: 1, expectedBucket: 1, label: 'exactly 1 → bucket 1 (lower bound of bucket 1)' },
      { count: 4, expectedBucket: 1, label: 'exactly 4 → bucket 1 (upper bound of bucket 1)' },
      { count: 5, expectedBucket: 2, label: 'exactly 5 → bucket 2 (lower bound of bucket 2)' },
      { count: 9, expectedBucket: 2, label: 'exactly 9 → bucket 2 (upper bound of bucket 2)' },
      { count: 10, expectedBucket: 3, label: 'exactly 10 → bucket 3 (lower bound of bucket 3)' },
      { count: 19, expectedBucket: 3, label: 'exactly 19 → bucket 3 (upper bound of bucket 3)' },
      { count: 20, expectedBucket: 4, label: 'exactly 20 → bucket 4 (lower bound of bucket 4)' },
      { count: 49, expectedBucket: 4, label: 'exactly 49 → bucket 4 (upper bound of bucket 4)' },
      { count: 50, expectedBucket: 5, label: 'exactly 50 → bucket 5 (lower bound of bucket 5)' },
      { count: 9999, expectedBucket: 5, label: 'very large count → bucket 5 (clamped)' },
    ];

    thresholdCases.forEach(({ count, expectedBucket, label }) => {
      it(label, () => {
        // Use a single-entry array (padded to 7); the last slot is our test value.
        const result = buildHeatmap([{ date: '2024-01-01', reviews_count: count }]);
        expect(result[6]).toBe(expectedBucket);
      });
    });
  });

  describe('exactly 0 entries: returns length 7 with all zeros', () => {
    it('empty input returns [0,0,0,0,0,0,0] — all zeros, not just length 7', () => {
      const result = buildHeatmap([]);
      expect(result).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });
  });

  describe('negative reviews_count — out-of-contract but must not crash', () => {
    // Negative reviews_count is semantically invalid. The implementation now clamps
    // negative counts to 0 before bucketing, so they correctly map to bucket 0
    // (same as "no activity") rather than bucket 1 (which would show activity).
    it('negative reviews_count does not throw', () => {
      expect(() =>
        buildHeatmap([{ date: '2024-01-01', reviews_count: -1 }]),
      ).not.toThrow();
    });

    it('negative reviews_count maps to bucket 0 (clamped to 0 before bucketing)', () => {
      const result = buildHeatmap([{ date: '2024-01-01', reviews_count: -1 }]);
      expect(result[6]).toBe(0);
    });

    it('very negative reviews_count also maps to bucket 0 (same clamp path)', () => {
      const result = buildHeatmap([{ date: '2024-01-01', reviews_count: -1000 }]);
      expect(result[6]).toBe(0);
    });
  });

  describe('oversized (> Number.MAX_SAFE_INTEGER-range) counts', () => {
    it('a safely large count (1_000_000) maps to bucket 5', () => {
      const result = buildHeatmap([{ date: '2024-01-01', reviews_count: 1_000_000 }]);
      expect(result[6]).toBe(5);
    });
  });

  describe('truncation: last 7 entries are used, not first 7', () => {
    it('with 8 entries the first entry (oldest) is dropped', () => {
      // Entry at index 0 has count=100 (bucket 5).
      // If the implementation used the first 7, slot 0 of result would be 5.
      // If it uses the last 7 (slice(-7)), slot 0 of result would be 0 (the padded zero).
      const entries = [
        { date: '2024-01-01', reviews_count: 100 }, // index 0 — oldest, should be dropped
        ...Array.from({ length: 7 }, (_, i) => ({ date: `2024-01-0${i + 2}`, reviews_count: 0 })),
      ];
      const result = buildHeatmap(entries);
      // If slice(-7) is used correctly, the 100-count day is dropped. All 7 should be 0.
      expect(result).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });

    it('with 14 entries, the last entry\'s value appears at position 6 of the result', () => {
      const entries = Array.from({ length: 14 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        reviews_count: i === 13 ? 50 : 0, // only last entry is non-zero
      }));
      const result = buildHeatmap(entries);
      expect(result[6]).toBe(5); // 50 reviews → bucket 5
      // All earlier slots should be 0 (the last 7 entries are indices 7-13; only index 13 is non-zero)
      expect(result.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 0]);
    });
  });
});

// ---------------------------------------------------------------------------
// greetingForHour — out-of-contract values
// ---------------------------------------------------------------------------
describe('greetingForHour — out-of-contract values (hour not in 0–23)', () => {
  // The function accepts `number`, not a branded 0-23 type. These tests document
  // what happens at out-of-contract values so regressions are visible.
  // They do NOT assert that the behavior is "correct" (it is not specified),
  // only that the function does not throw and returns one of the three valid strings.

  it('does not throw for hour = 24 (one beyond contract max)', () => {
    expect(() => greetingForHour(24)).not.toThrow();
  });

  it('hour = 24 returns a valid greeting string (not undefined or throws)', () => {
    const result = greetingForHour(24);
    expect(['morning', 'afternoon', 'evening']).toContain(result);
  });

  it('hour = 24 returns "evening" (falls through all if-guards since 24 >= 18)', () => {
    // Documents current behavior: 24 is not < 12, not < 18 → evening.
    expect(greetingForHour(24)).toBe('evening');
  });

  it('does not throw for hour = -1 (below contract min)', () => {
    expect(() => greetingForHour(-1)).not.toThrow();
  });

  it('hour = -1 returns a valid greeting string', () => {
    const result = greetingForHour(-1);
    expect(['morning', 'afternoon', 'evening']).toContain(result);
  });

  it('hour = -1 returns "morning" (−1 < 12 is true)', () => {
    // Documents current behavior: -1 < 12 → morning.
    expect(greetingForHour(-1)).toBe('morning');
  });
});

// ---------------------------------------------------------------------------
// isNewUser — boundary / adversarial
// ---------------------------------------------------------------------------
describe('isNewUser — adversarial', () => {
  it('returns false when mastered is 0 but streak is very large', () => {
    expect(isNewUser(0, 365)).toBe(false);
  });

  it('returns false when streak is 0 but mastered is very large', () => {
    expect(isNewUser(10_000, 0)).toBe(false);
  });

  it('returns true only for exact (0, 0) — not (0.0, 0.0) floating point', () => {
    // 0.0 === 0 in JS, so this is still true — but documents the assumption.
    expect(isNewUser(0.0, 0.0)).toBe(true);
  });
});
