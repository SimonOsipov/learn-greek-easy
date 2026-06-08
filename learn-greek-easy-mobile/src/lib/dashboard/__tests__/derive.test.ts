/// <reference types="jest" />
import type { DeckProgressSummary } from '@/types/dashboard';
import {
  greetingForHour,
  pickResumeDeck,
  isNewUser,
  buildHeatmap,
} from '../derive';

// ---------------------------------------------------------------------------
// greetingForHour
// ---------------------------------------------------------------------------
describe('greetingForHour', () => {
  describe('morning bucket (0–11)', () => {
    it('returns "morning" for hour 0', () => {
      expect(greetingForHour(0)).toBe('morning');
    });

    it('returns "morning" for hour 11 (upper boundary)', () => {
      expect(greetingForHour(11)).toBe('morning');
    });

    it('returns "morning" for a mid-morning hour (6)', () => {
      expect(greetingForHour(6)).toBe('morning');
    });
  });

  describe('afternoon bucket (12–17)', () => {
    it('returns "afternoon" for hour 12 (lower boundary)', () => {
      expect(greetingForHour(12)).toBe('afternoon');
    });

    it('returns "afternoon" for hour 17 (upper boundary)', () => {
      expect(greetingForHour(17)).toBe('afternoon');
    });

    it('returns "afternoon" for a mid-afternoon hour (14)', () => {
      expect(greetingForHour(14)).toBe('afternoon');
    });
  });

  describe('evening bucket (18–23)', () => {
    it('returns "evening" for hour 18 (lower boundary)', () => {
      expect(greetingForHour(18)).toBe('evening');
    });

    it('returns "evening" for hour 23 (upper boundary)', () => {
      expect(greetingForHour(23)).toBe('evening');
    });

    it('returns "evening" for a mid-evening hour (21)', () => {
      expect(greetingForHour(21)).toBe('evening');
    });
  });

  describe('no "night" bucket', () => {
    // Only three valid return values — there is no 'night'.
    it('never returns "night" for any valid hour', () => {
      for (let h = 0; h < 24; h++) {
        expect(greetingForHour(h)).not.toBe('night');
      }
    });
  });
});

// ---------------------------------------------------------------------------
// pickResumeDeck
// ---------------------------------------------------------------------------

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

describe('pickResumeDeck', () => {
  describe('null cases', () => {
    it('returns null for an empty list', () => {
      expect(pickResumeDeck([])).toBeNull();
    });

    it('returns null when all decks are not yet started (cards_studied === 0)', () => {
      const decks = [
        makeDeck({ deck_id: 'd1', cards_studied: 0, completion_percentage: 0 }),
        makeDeck({ deck_id: 'd2', cards_studied: 0, completion_percentage: 0 }),
      ];
      expect(pickResumeDeck(decks)).toBeNull();
    });

    it('returns null when all decks are fully completed (completion_percentage === 100)', () => {
      const decks = [
        makeDeck({ deck_id: 'd1', cards_studied: 10, completion_percentage: 100 }),
        makeDeck({ deck_id: 'd2', cards_studied: 20, completion_percentage: 100 }),
      ];
      expect(pickResumeDeck(decks)).toBeNull();
    });

    it('returns null when the only deck has cards_studied > 0 but completion_percentage === 100', () => {
      const decks = [
        makeDeck({ deck_id: 'd1', cards_studied: 10, completion_percentage: 100 }),
      ];
      expect(pickResumeDeck(decks)).toBeNull();
    });

    it('returns null when the only deck has cards_studied === 0 (not started)', () => {
      const decks = [
        makeDeck({ deck_id: 'd1', cards_studied: 0, completion_percentage: 50 }),
      ];
      expect(pickResumeDeck(decks)).toBeNull();
    });
  });

  describe('single qualifying deck', () => {
    it('returns the in-progress deck (cards_studied > 0 && completion_percentage < 100)', () => {
      const deck = makeDeck({ deck_id: 'in-prog', cards_studied: 5, completion_percentage: 50 });
      expect(pickResumeDeck([deck])).toEqual(deck);
    });
  });

  describe('most-recent last_studied_at wins among qualifying decks', () => {
    it('returns the deck with the latest last_studied_at among in-progress decks', () => {
      const older = makeDeck({
        deck_id: 'older',
        cards_studied: 3,
        completion_percentage: 30,
        last_studied_at: '2024-01-01T08:00:00Z',
      });
      const newer = makeDeck({
        deck_id: 'newer',
        cards_studied: 7,
        completion_percentage: 70,
        last_studied_at: '2024-01-02T08:00:00Z',
      });
      expect(pickResumeDeck([older, newer])?.deck_id).toBe('newer');
    });

    it('handles reversed input order (most-recent still wins)', () => {
      const older = makeDeck({
        deck_id: 'older',
        cards_studied: 3,
        completion_percentage: 30,
        last_studied_at: '2024-01-01T08:00:00Z',
      });
      const newer = makeDeck({
        deck_id: 'newer',
        cards_studied: 7,
        completion_percentage: 70,
        last_studied_at: '2024-01-02T08:00:00Z',
      });
      expect(pickResumeDeck([newer, older])?.deck_id).toBe('newer');
    });
  });

  describe('due tie-break: cards_due > 0 beats a more-recently-studied non-due deck', () => {
    it('prefers a deck with cards_due > 0 over a more-recent deck with cards_due === 0', () => {
      // mostRecent has cards_due === 0; olderDue has cards_due > 0
      // Expected: olderDue wins because cards_due > 0 is the tiebreak priority
      const mostRecent = makeDeck({
        deck_id: 'most-recent-no-due',
        cards_studied: 5,
        completion_percentage: 50,
        cards_due: 0,
        last_studied_at: '2024-01-03T10:00:00Z', // most recent
      });
      const olderDue = makeDeck({
        deck_id: 'older-with-due',
        cards_studied: 5,
        completion_percentage: 50,
        cards_due: 3,
        last_studied_at: '2024-01-01T10:00:00Z', // older
      });
      expect(pickResumeDeck([mostRecent, olderDue])?.deck_id).toBe('older-with-due');
    });

    it('returns the most-recent deck when all qualifying decks have cards_due === 0', () => {
      const older = makeDeck({
        deck_id: 'older-no-due',
        cards_studied: 5,
        completion_percentage: 50,
        cards_due: 0,
        last_studied_at: '2024-01-01T10:00:00Z',
      });
      const newer = makeDeck({
        deck_id: 'newer-no-due',
        cards_studied: 5,
        completion_percentage: 50,
        cards_due: 0,
        last_studied_at: '2024-01-03T10:00:00Z',
      });
      expect(pickResumeDeck([older, newer])?.deck_id).toBe('newer-no-due');
    });

    it('prefers a due deck even if there are multiple non-due more-recent decks', () => {
      const recentNoDue1 = makeDeck({
        deck_id: 'recent-no-due-1',
        cards_studied: 5,
        completion_percentage: 50,
        cards_due: 0,
        last_studied_at: '2024-01-05T10:00:00Z',
      });
      const recentNoDue2 = makeDeck({
        deck_id: 'recent-no-due-2',
        cards_studied: 5,
        completion_percentage: 50,
        cards_due: 0,
        last_studied_at: '2024-01-04T10:00:00Z',
      });
      const oldWithDue = makeDeck({
        deck_id: 'old-with-due',
        cards_studied: 5,
        completion_percentage: 50,
        cards_due: 2,
        last_studied_at: '2024-01-01T10:00:00Z',
      });
      expect(pickResumeDeck([recentNoDue1, recentNoDue2, oldWithDue])?.deck_id).toBe('old-with-due');
    });

    it('among multiple due decks, returns the most-recently-studied one', () => {
      const dueDeck1 = makeDeck({
        deck_id: 'due-older',
        cards_studied: 5,
        completion_percentage: 50,
        cards_due: 2,
        last_studied_at: '2024-01-01T10:00:00Z',
      });
      const dueDeck2 = makeDeck({
        deck_id: 'due-newer',
        cards_studied: 5,
        completion_percentage: 50,
        cards_due: 1,
        last_studied_at: '2024-01-03T10:00:00Z',
      });
      expect(pickResumeDeck([dueDeck1, dueDeck2])?.deck_id).toBe('due-newer');
    });
  });

  describe('mixed qualifying and non-qualifying decks', () => {
    it('ignores completed decks when picking from a mixed list', () => {
      const completed = makeDeck({ deck_id: 'done', cards_studied: 20, completion_percentage: 100 });
      const inProgress = makeDeck({ deck_id: 'wip', cards_studied: 5, completion_percentage: 50 });
      expect(pickResumeDeck([completed, inProgress])?.deck_id).toBe('wip');
    });

    it('ignores not-started decks when picking from a mixed list', () => {
      const notStarted = makeDeck({ deck_id: 'new', cards_studied: 0, completion_percentage: 0 });
      const inProgress = makeDeck({ deck_id: 'wip', cards_studied: 5, completion_percentage: 50 });
      expect(pickResumeDeck([notStarted, inProgress])?.deck_id).toBe('wip');
    });
  });
});

// ---------------------------------------------------------------------------
// isNewUser
// ---------------------------------------------------------------------------
describe('isNewUser', () => {
  it('returns true when mastered === 0 and streak === 0', () => {
    expect(isNewUser(0, 0)).toBe(true);
  });

  it('returns false when mastered > 0 and streak === 0', () => {
    expect(isNewUser(1, 0)).toBe(false);
  });

  it('returns false when mastered === 0 and streak > 0', () => {
    expect(isNewUser(0, 1)).toBe(false);
  });

  it('returns false when both mastered and streak are > 0', () => {
    expect(isNewUser(5, 3)).toBe(false);
  });

  it('returns false for large values of mastered and streak', () => {
    expect(isNewUser(1000, 365)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildHeatmap
// ---------------------------------------------------------------------------
describe('buildHeatmap', () => {
  describe('length invariant: always returns a 7-element array', () => {
    it('returns 7 elements for an empty input', () => {
      expect(buildHeatmap([])).toHaveLength(7);
    });

    it('returns 7 elements when given exactly 7 items', () => {
      const input = Array.from({ length: 7 }, (_, i) => ({ date: `2024-01-0${i + 1}`, reviews_count: i }));
      expect(buildHeatmap(input)).toHaveLength(7);
    });

    it('returns 7 elements when given fewer than 7 items (pads)', () => {
      const input = [{ date: '2024-01-01', reviews_count: 5 }];
      expect(buildHeatmap(input)).toHaveLength(7);
    });

    it('returns 7 elements when given more than 7 items (truncates)', () => {
      const input = Array.from({ length: 14 }, (_, i) => ({ date: `2024-01-${String(i + 1).padStart(2, '0')}`, reviews_count: i }));
      expect(buildHeatmap(input)).toHaveLength(7);
    });
  });

  describe('value range invariant: all buckets are integers in 0..5', () => {
    const testCases = [
      { label: 'all zeros', counts: [0, 0, 0, 0, 0, 0, 0] },
      { label: 'mixed low counts', counts: [1, 2, 3, 4, 5, 6, 7] },
      { label: 'high counts', counts: [0, 10, 20, 50, 100, 200, 500] },
      { label: 'all equal non-zero', counts: [10, 10, 10, 10, 10, 10, 10] },
    ];

    testCases.forEach(({ label, counts }) => {
      it(`all values in 0..5 for: ${label}`, () => {
        const input = counts.map((c, i) => ({ date: `2024-01-0${i + 1}`, reviews_count: c }));
        const result = buildHeatmap(input);
        expect(result).toHaveLength(7);
        result.forEach((bucket) => {
          expect(bucket).toBeGreaterThanOrEqual(0);
          expect(bucket).toBeLessThanOrEqual(5);
          expect(Number.isInteger(bucket)).toBe(true);
        });
      });
    });
  });

  describe('zero-count invariant: reviews_count === 0 always maps to bucket 0', () => {
    it('a day with 0 reviews gets bucket 0', () => {
      const input = Array.from({ length: 7 }, (_, i) => ({
        date: `2024-01-0${i + 1}`,
        reviews_count: i === 3 ? 0 : 10, // slot 3 is zero, others are non-zero
      }));
      const result = buildHeatmap(input);
      expect(result[3]).toBe(0);
    });

    it('all-zero input produces all-zero output', () => {
      const input = Array.from({ length: 7 }, (_, i) => ({ date: `2024-01-0${i + 1}`, reviews_count: 0 }));
      const result = buildHeatmap(input);
      result.forEach((bucket) => expect(bucket).toBe(0));
    });
  });

  describe('monotonic invariant: more reviews never maps to a lower bucket than fewer reviews', () => {
    it('ascending counts produce non-decreasing buckets', () => {
      // Reviews strictly increase: 0, 5, 10, 20, 40, 80, 160
      const input = [0, 5, 10, 20, 40, 80, 160].map((c, i) => ({
        date: `2024-01-0${i + 1}`,
        reviews_count: c,
      }));
      const result = buildHeatmap(input);
      for (let i = 1; i < result.length; i++) {
        expect(result[i]).toBeGreaterThanOrEqual(result[i - 1]);
      }
    });

    it('a day with strictly more reviews never has a strictly lower bucket than a day with fewer', () => {
      // Spot-check: pick pairs where counts[a] > counts[b] and verify result[a] >= result[b]
      const counts = [2, 8, 1, 15, 4, 30, 0];
      const input = counts.map((c, i) => ({ date: `2024-01-0${i + 1}`, reviews_count: c }));
      const result = buildHeatmap(input);

      for (let a = 0; a < counts.length; a++) {
        for (let b = 0; b < counts.length; b++) {
          if (counts[a] > counts[b]) {
            expect(result[a]).toBeGreaterThanOrEqual(result[b]);
          }
        }
      }
    });
  });

  describe('max-bucket invariant: bucket 5 is reachable for non-trivially large counts', () => {
    it('a very high review count maps to bucket 5', () => {
      const input = Array.from({ length: 7 }, (_, i) => ({
        date: `2024-01-0${i + 1}`,
        reviews_count: i === 6 ? 1000 : 0, // last day has huge count
      }));
      const result = buildHeatmap(input);
      expect(result[6]).toBe(5);
    });
  });
});
