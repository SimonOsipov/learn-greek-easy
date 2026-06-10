/// <reference types="jest" />
/**
 * MOB-07 — Unit tests for the decks presentation helpers.
 */
import {
  ARTICLE_COLOR,
  DECK_COVER_PALETTE,
  articleForGender,
  coverForDeckId,
  deckProgressRatio,
  filterDecks,
  wordStatus,
} from '@/lib/decks/presentation';
import type { DeckResponse, WordMasteryItem } from '@/types/deck';
import type { DeckProgressSummary } from '@/types/dashboard';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDeck(overrides: Partial<DeckResponse> = {}): DeckResponse {
  return {
    id: 'deck-1',
    name: 'Greek House',
    description: null,
    level: 'A1',
    is_active: true,
    card_count: 10,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeProgress(overrides: Partial<DeckProgressSummary> = {}): DeckProgressSummary {
  return {
    deck_id: 'deck-1',
    deck_name: 'Greek House',
    cards_studied: 0,
    cards_mastered: 0,
    cards_due: 0,
    mastery_percentage: 0,
    completion_percentage: 0,
    last_studied_at: null,
    ...overrides,
  };
}

function makeMastery(overrides: Partial<WordMasteryItem> = {}): WordMasteryItem {
  return {
    word_entry_id: 'w-1',
    mastered_count: 0,
    studied_count: 0,
    total_count: 4,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// coverForDeckId
// ---------------------------------------------------------------------------

describe('coverForDeckId', () => {
  it('is deterministic — same id always maps to the same gradient', () => {
    expect(coverForDeckId('greek-house')).toBe(coverForDeckId('greek-house'));
  });

  it('always returns a pair from the palette', () => {
    for (const id of ['a', 'greek-house', 'b2-verbs', 'x'.repeat(64)]) {
      expect(DECK_COVER_PALETTE).toContain(coverForDeckId(id));
    }
  });
});

// ---------------------------------------------------------------------------
// articleForGender
// ---------------------------------------------------------------------------

describe('articleForGender', () => {
  it.each([
    ['masculine', 'ο'],
    ['feminine', 'η'],
    ['neuter', 'το'],
  ] as const)('%s → %s', (gender, article) => {
    expect(articleForGender(gender)).toEqual({ article, gender });
    expect(ARTICLE_COLOR[gender]).toMatch(/^rgb\(/);
  });

  it('returns null for missing/unknown gender (verbs, adverbs, bad data)', () => {
    expect(articleForGender(undefined)).toBeNull();
    expect(articleForGender(null)).toBeNull();
    expect(articleForGender('plural-only')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// wordStatus — semantics mirror web WordBrowser.tsx:219-235
// ---------------------------------------------------------------------------

describe('wordStatus', () => {
  it('no mastery row → new', () => {
    expect(wordStatus(undefined)).toBe('new');
  });

  it('studied_count 0 → new (even with a mastery row)', () => {
    expect(wordStatus(makeMastery({ studied_count: 0 }))).toBe('new');
  });

  it('all card types mastered → mastered', () => {
    expect(
      wordStatus(makeMastery({ studied_count: 4, mastered_count: 4, total_count: 4 })),
    ).toBe('mastered');
  });

  it('partially mastered → learning', () => {
    expect(
      wordStatus(makeMastery({ studied_count: 3, mastered_count: 2, total_count: 4 })),
    ).toBe('learning');
  });

  it('total_count 0 is never mastered', () => {
    expect(
      wordStatus(makeMastery({ studied_count: 1, mastered_count: 0, total_count: 0 })),
    ).toBe('learning');
  });
});

// ---------------------------------------------------------------------------
// deckProgressRatio
// ---------------------------------------------------------------------------

describe('deckProgressRatio', () => {
  it('mastered / card_count, clamped to [0, 1]', () => {
    expect(deckProgressRatio(makeDeck(), makeProgress({ cards_mastered: 5 }))).toBe(0.5);
    expect(deckProgressRatio(makeDeck(), makeProgress({ cards_mastered: 99 }))).toBe(1);
  });

  it('0 when there is no progress row or no cards', () => {
    expect(deckProgressRatio(makeDeck(), undefined)).toBe(0);
    expect(
      deckProgressRatio(makeDeck({ card_count: 0 }), makeProgress({ cards_mastered: 3 })),
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// filterDecks
// ---------------------------------------------------------------------------

describe('filterDecks', () => {
  const items = [
    { deck: makeDeck({ id: 'a', level: 'A1' }), progressRatio: 0 },
    { deck: makeDeck({ id: 'b', level: 'A1' }), progressRatio: 0.4 },
    { deck: makeDeck({ id: 'c', level: 'B1' }), progressRatio: 1 },
    { deck: makeDeck({ id: 'd', level: 'B2' }), progressRatio: 0.9 },
  ];

  it('All returns everything', () => {
    expect(filterDecks(items, 'All')).toHaveLength(4);
  });

  it('Active returns only in-progress decks (0 < p < 1)', () => {
    expect(filterDecks(items, 'Active').map((i) => i.deck.id)).toEqual(['b', 'd']);
  });

  it('level pills filter by CEFR level', () => {
    expect(filterDecks(items, 'A1').map((i) => i.deck.id)).toEqual(['a', 'b']);
    expect(filterDecks(items, 'B1').map((i) => i.deck.id)).toEqual(['c']);
    expect(filterDecks(items, 'A2')).toHaveLength(0);
  });
});
