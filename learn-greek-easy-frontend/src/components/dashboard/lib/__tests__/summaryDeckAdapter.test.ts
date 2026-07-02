// src/components/dashboard/lib/__tests__/summaryDeckAdapter.test.ts
//
// PERF-15-05 QA — summaryDeckAdapter had zero direct test coverage even
// though it's the sole bridge carrying the server-computed
// `completion_pct` (the value that replaced the 3 deleted client
// recomputations in HeroEntries/FeedCards) onto the legacy Deck shape
// those components render from. These tests pin the field-by-field mapping
// so a future edit can't silently drop/rename `completion_pct` (or any
// other field) without a red test.

import { describe, it, expect } from 'vitest';

import type { DashboardDeckSlice } from '@/types/dashboard';

import { toDashboardDeck, toDashboardDecks } from '../summaryDeckAdapter';

function makeSlice(overrides: Partial<DashboardDeckSlice> = {}): DashboardDeckSlice {
  return {
    deck_id: 'deck-1',
    name_el: 'Ελληνικά',
    name_en: 'Greek Basics',
    name_ru: 'Греческий',
    level: 'A2',
    is_premium: false,
    category: 'vocabulary',
    card_count: 20,
    cover_image_url: null,
    cover_image_variants: null,
    status: 'in-progress',
    cards_total: 20,
    cards_new: 5,
    cards_learning: 8,
    cards_review: 5,
    cards_mastered: 7,
    due_today: 5,
    completion_pct: 75,
    mastery_pct: 35,
    last_studied_at: '2026-06-28T10:00:00Z',
    ...overrides,
  };
}

describe('summaryDeckAdapter', () => {
  it('maps completion_pct onto progress.completionPct verbatim (no recomputation)', () => {
    const deck = toDashboardDeck(makeSlice({ completion_pct: 42 }));
    expect(deck.progress?.completionPct).toBe(42);
  });

  it('does NOT derive completionPct from cardsLearning/cardsMastered/cardsTotal', () => {
    // If a regression reintroduced client-side recomputation, this slice's
    // cards_learning(8)+cards_mastered(7))/cards_total(20) = 75%, but
    // completion_pct is deliberately set to a DIFFERENT value (10%) to
    // prove the adapter passes completion_pct through untouched rather
    // than recomputing it from the SRS counts.
    const deck = toDashboardDeck(
      makeSlice({
        cards_learning: 8,
        cards_mastered: 7,
        cards_total: 20,
        completion_pct: 10,
      })
    );
    expect(deck.progress?.completionPct).toBe(10);
  });

  it('maps id/name fields with the name_en > name_el fallback', () => {
    const deck = toDashboardDeck(makeSlice({ name_en: 'Greek Basics', name_el: 'Ελληνικά' }));
    expect(deck.id).toBe('deck-1');
    expect(deck.title).toBe('Greek Basics');
    expect(deck.titleGreek).toBe('Ελληνικά');
    expect(deck.nameEn).toBe('Greek Basics');
    expect(deck.nameRu).toBe('Греческий');
  });

  it('falls back to name_el for title when name_en is null', () => {
    const deck = toDashboardDeck(makeSlice({ name_en: null, name_el: 'Ελληνικά' }));
    expect(deck.title).toBe('Ελληνικά');
  });

  it('maps SRS counts and due_today onto DeckProgress verbatim', () => {
    const deck = toDashboardDeck(
      makeSlice({
        cards_total: 30,
        cards_new: 10,
        cards_learning: 12,
        cards_review: 6,
        cards_mastered: 2,
        due_today: 6,
      })
    );
    expect(deck.progress).toMatchObject({
      cardsTotal: 30,
      cardsNew: 10,
      cardsLearning: 12,
      cardsReview: 6,
      cardsMastered: 2,
      dueToday: 6,
    });
  });

  it('converts last_studied_at ISO string to a Date, and leaves it undefined when null', () => {
    const studied = toDashboardDeck(makeSlice({ last_studied_at: '2026-06-28T10:00:00Z' }));
    expect(studied.progress?.lastStudied).toBeInstanceOf(Date);
    expect(studied.progress?.lastStudied?.toISOString()).toBe('2026-06-28T10:00:00.000Z');

    const notStudied = toDashboardDeck(makeSlice({ last_studied_at: null }));
    expect(notStudied.progress?.lastStudied).toBeUndefined();
  });

  it('toDashboardDecks maps a list in order and preserves length', () => {
    const decks = toDashboardDecks([
      makeSlice({ deck_id: 'a', completion_pct: 10 }),
      makeSlice({ deck_id: 'b', completion_pct: 90 }),
    ]);
    expect(decks).toHaveLength(2);
    expect(decks[0].id).toBe('a');
    expect(decks[0].progress?.completionPct).toBe(10);
    expect(decks[1].id).toBe('b');
    expect(decks[1].progress?.completionPct).toBe(90);
  });
});
