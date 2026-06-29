// src/components/dashboard/lib/__tests__/isNewUser.test.ts
// RED spec — isNewUser.ts does not exist yet. This test MUST fail with
// "Cannot find module '../isNewUser'" until the executor creates it.

import { describe, it, expect } from 'vitest';

import type { Deck } from '@/types/deck';

import { isNewUser } from '../isNewUser';

// ─── Minimal Deck factory ─────────────────────────────────────────────────────
// Mirrors the pattern in heroEntries.test.ts — only the fields the predicate
// cares about are meaningful; the rest are valid placeholders.

function makeDeck(opts: { lastStudied?: Date | null } = {}): Deck {
  return {
    id: 'deck-test',
    title: 'Test Deck',
    titleGreek: 'Δοκιμή',
    description: '',
    level: 'A1',
    category: 'vocabulary',
    tags: [],
    cardCount: 10,
    estimatedTime: 5,
    isPremium: false,
    createdBy: 'admin',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    progress: {
      deckId: 'deck-test',
      status: 'not-started',
      cardsTotal: 10,
      cardsNew: 10,
      cardsLearning: 0,
      cardsReview: 0,
      cardsMastered: 0,
      dueToday: 0,
      streak: 0,
      lastStudied: opts.lastStudied ?? undefined,
      totalTimeSpent: 0,
      accuracy: 0,
    },
  };
}

// ─── isNewUser ────────────────────────────────────────────────────────────────

describe('isNewUser', () => {
  it('returns true when all signals are zero and decks list is empty (truly new user)', () => {
    expect(
      isNewUser({ cardsDue: 0, currentStreak: 0, mastered: 0, decks: [] })
    ).toBe(true);
  });

  it('returns true when deck exists but has never been studied (lastStudied undefined)', () => {
    const deckNeverStudied = makeDeck(); // lastStudied is undefined
    expect(
      isNewUser({
        cardsDue: 0,
        currentStreak: 0,
        mastered: 0,
        decks: [deckNeverStudied],
      })
    ).toBe(true);
  });

  it('returns false when cardsDue > 0 (user has cards to review)', () => {
    expect(
      isNewUser({ cardsDue: 5, currentStreak: 0, mastered: 0, decks: [] })
    ).toBe(false);
  });

  it('returns false when currentStreak > 0 (user has an active streak)', () => {
    expect(
      isNewUser({ cardsDue: 0, currentStreak: 3, mastered: 0, decks: [] })
    ).toBe(false);
  });

  it('returns false when mastered > 0 (user has mastered cards)', () => {
    expect(
      isNewUser({ cardsDue: 0, currentStreak: 0, mastered: 7, decks: [] })
    ).toBe(false);
  });

  it('returns false when any deck has a lastStudied date (user has a prior session)', () => {
    const studiedDeck = makeDeck({ lastStudied: new Date('2026-06-28T10:00:00Z') });
    expect(
      isNewUser({
        cardsDue: 0,
        currentStreak: 0,
        mastered: 0,
        decks: [studiedDeck],
      })
    ).toBe(false);
  });

  it('returns false when at least one deck has lastStudied even if another has none', () => {
    const unstudied = makeDeck(); // lastStudied undefined
    const studied = makeDeck({ lastStudied: new Date('2026-06-29T08:00:00Z') });
    expect(
      isNewUser({
        cardsDue: 0,
        currentStreak: 0,
        mastered: 0,
        decks: [unstudied, studied],
      })
    ).toBe(false);
  });
});
