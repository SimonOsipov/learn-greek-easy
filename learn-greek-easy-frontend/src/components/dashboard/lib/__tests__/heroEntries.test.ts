// src/components/dashboard/lib/__tests__/heroEntries.test.ts

import { describe, it, expect } from 'vitest';

import type { Deck } from '@/types/deck';

import { pickResumeDeck, decksWithDue } from '../heroEntries';

// ─── Minimal deck factory ─────────────────────────────────────────────────────

function deck(
  id: string,
  opts: {
    dueToday?: number;
    lastStudied?: Date;
  } = {}
): Deck {
  return {
    id,
    title: `Deck ${id}`,
    titleGreek: 'Ελ',
    description: '',
    level: 'A1',
    category: 'vocabulary',
    tags: [],
    cardCount: 10,
    estimatedTime: 5,
    isPremium: false,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    progress: {
      deckId: id,
      status: 'in-progress',
      cardsTotal: 10,
      cardsNew: 0,
      cardsLearning: 3,
      cardsReview: 2,
      cardsMastered: 5,
      dueToday: opts.dueToday ?? 0,
      streak: 0,
      lastStudied: opts.lastStudied,
      totalTimeSpent: 0,
      accuracy: 80,
    },
  };
}

// ─── pickResumeDeck ───────────────────────────────────────────────────────────

describe('pickResumeDeck', () => {
  it('returns undefined for empty list', () => {
    expect(pickResumeDeck([])).toBeUndefined();
  });

  it('returns the deck with the most recent lastStudied', () => {
    const older = deck('a', { lastStudied: new Date('2026-06-27T10:00:00Z') });
    const newer = deck('b', { lastStudied: new Date('2026-06-28T10:00:00Z') });
    const result = pickResumeDeck([older, newer]);
    expect(result?.id).toBe('b');
  });

  it('returns first deck with dueToday when no lastStudied', () => {
    const noDue = deck('a', { dueToday: 0 });
    const hasDue = deck('b', { dueToday: 5 });
    expect(pickResumeDeck([noDue, hasDue])?.id).toBe('b');
  });

  it('returns first deck if none have lastStudied or dueToday', () => {
    const d1 = deck('a');
    const d2 = deck('b');
    expect(pickResumeDeck([d1, d2])?.id).toBe('a');
  });

  it('prefers lastStudied over dueToday', () => {
    const withStudied = deck('a', { lastStudied: new Date('2026-06-28T00:00:00Z') });
    const withDue = deck('b', { dueToday: 10 });
    expect(pickResumeDeck([withDue, withStudied])?.id).toBe('a');
  });
});

// ─── decksWithDue ────────────────────────────────────────────────────────────

describe('decksWithDue', () => {
  it('returns empty array for empty input', () => {
    expect(decksWithDue([])).toEqual([]);
  });

  it('filters out decks with dueToday === 0', () => {
    const d1 = deck('a', { dueToday: 0 });
    const d2 = deck('b', { dueToday: 3 });
    const d3 = deck('c', { dueToday: 0 });
    expect(decksWithDue([d1, d2, d3]).map((d) => d.id)).toEqual(['b']);
  });

  it('returns all decks if all have due cards', () => {
    const d1 = deck('a', { dueToday: 1 });
    const d2 = deck('b', { dueToday: 5 });
    expect(decksWithDue([d1, d2])).toHaveLength(2);
  });

  it('returns empty when no decks have dueToday > 0', () => {
    expect(decksWithDue([deck('a'), deck('b')])).toEqual([]);
  });
});
