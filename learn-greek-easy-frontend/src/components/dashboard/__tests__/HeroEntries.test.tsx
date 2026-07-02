/**
 * HeroEntries — unit tests
 *
 * Covers:
 *  - 3 .db-entry cards render (3 kickers visible)
 *  - Exactly 3 unwired-dot testids (card-index, estimate, minute-goal)
 *  - Resume CTA fires onResumeDeck with correct deckId
 *  - Start review CTA fires onStartReview
 *  - Nothing-due state → card 2 CTA fires onBrowseDecks
 *  - Empty decks list → no crash, card 1 CTA fires onBrowseDecks
 */

import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { renderWithProviders } from '@/lib/test-utils';

import { HeroEntries } from '../HeroEntries';
import type { HeroEntriesProps } from '../HeroEntries';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDeck(
  id: string,
  overrides: Partial<{
    dueToday: number;
    cardsLearning: number;
    cardsMastered: number;
    cardsTotal: number;
    lastStudied: Date;
    completionPct: number;
  }> = {}
) {
  return {
    id,
    title: `Deck ${id}`,
    titleGreek: 'Ελληνική',
    description: 'Test deck',
    level: 'A2' as const,
    category: 'vocabulary' as const,
    tags: [],
    cardCount: overrides.cardsTotal ?? 20,
    estimatedTime: 15,
    isPremium: false,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    progress: {
      deckId: id,
      status: 'in-progress' as const,
      cardsTotal: overrides.cardsTotal ?? 20,
      cardsNew: 5,
      cardsLearning: overrides.cardsLearning ?? 5,
      cardsReview: 5,
      cardsMastered: overrides.cardsMastered ?? 5,
      dueToday: overrides.dueToday ?? 5,
      streak: 0,
      lastStudied: overrides.lastStudied,
      totalTimeSpent: 0,
      accuracy: 75,
      completionPct: overrides.completionPct,
    },
  };
}

function renderHero(props: Partial<HeroEntriesProps> = {}) {
  const deck1 = makeDeck('d1', { lastStudied: new Date('2026-06-28T10:00:00Z') });
  const deck2 = makeDeck('d2', { dueToday: 3 });

  const defaults: HeroEntriesProps = {
    decks: [deck1, deck2],
    cardsDue: 8,
    deckCount: 2,
    minutesToday: 12,
    streak: 5,
    onResumeDeck: vi.fn(),
    onStartReview: vi.fn(),
    onBrowseDecks: vi.fn(),
    ...props,
  };

  return {
    ...renderWithProviders(<HeroEntries {...defaults} />),
    props: defaults,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('HeroEntries', () => {
  it('renders 3 .db-entry cards (3 kickers)', () => {
    renderHero();
    // Each card has a kicker element inside .db-entry-kicker
    const entries = document.querySelectorAll('.db-entry');
    expect(entries).toHaveLength(3);
  });

  it('renders exactly 3 unwired-dot elements with distinct aria-labels', () => {
    renderHero();
    const dots = screen.getAllByTestId('unwired-dot');
    expect(dots).toHaveLength(3);

    // All 3 aria-labels must be distinct
    const labels = dots.map((d) => d.getAttribute('aria-label'));
    const unique = new Set(labels);
    expect(unique.size).toBe(3);
  });

  it('clicking Resume calls onResumeDeck with the resume deck id', () => {
    const { props } = renderHero();
    const resumeBtn = screen.getByRole('button', { name: /resume/i });
    fireEvent.click(resumeBtn);
    // pickResumeDeck picks d1 (has lastStudied)
    expect(props.onResumeDeck).toHaveBeenCalledWith('d1');
  });

  it('clicking Start review calls onStartReview', () => {
    const { props } = renderHero();
    const reviewBtn = screen.getByRole('button', { name: /start review/i });
    fireEvent.click(reviewBtn);
    expect(props.onStartReview).toHaveBeenCalledTimes(1);
  });

  it('nothing-due state: card 2 shows Browse decks and calls onBrowseDecks', () => {
    const onBrowseDecks = vi.fn();
    renderHero({ cardsDue: 0, onBrowseDecks });

    // Start review button should not be present
    expect(screen.queryByRole('button', { name: /start review/i })).toBeNull();

    // There should be a Browse decks button (may be multiple — card 1 empty + card 2 nothing-due)
    const browseButtons = screen.getAllByRole('button', { name: /browse decks/i });
    // Click the first one
    fireEvent.click(browseButtons[0]);
    expect(onBrowseDecks).toHaveBeenCalledTimes(1);
  });

  it('empty decks list does not crash and card 1 CTA calls onBrowseDecks', () => {
    const onBrowseDecks = vi.fn();
    renderHero({ decks: [], cardsDue: 0, onBrowseDecks });

    // Should not throw — card 1 empty state renders
    expect(screen.getAllByTestId('unwired-dot').length).toBeGreaterThan(0);

    // Card 1 empty state has a Browse decks / start-learning CTA
    const browseButtons = screen.getAllByRole('button', { name: /browse decks/i });
    fireEvent.click(browseButtons[0]);
    expect(onBrowseDecks).toHaveBeenCalledTimes(1);
  });

  // PERF-15-05 regression guard: the resume card's progress-bar width must
  // render `resumeDeck.progress.completionPct` verbatim (server-computed,
  // DashboardDeckSlice.completion_pct) — NOT the deleted
  // `Math.round((cardsLearning + cardsMastered) / cardsTotal * 100)`
  // client recomputation. cardsLearning/cardsMastered/cardsTotal below are
  // deliberately set so the OLD formula would yield a DIFFERENT number
  // (60%) than completionPct (33%), so a regression back to client-side
  // recomputation fails this assertion.
  it('renders the resume progress bar width from completionPct, not a client recomputation', () => {
    const deck1 = makeDeck('d1', {
      lastStudied: new Date('2026-06-28T10:00:00Z'),
      cardsLearning: 6,
      cardsMastered: 6,
      cardsTotal: 20,
      completionPct: 33,
    });

    renderHero({ decks: [deck1], cardsDue: 5 });

    const bar = document.querySelector('.db-entry-progress span');
    expect(bar).not.toBeNull();
    expect((bar as HTMLElement).style.width).toBe('33%');
  });

  it('resume progress bar falls back to 0% when completionPct is undefined', () => {
    const deck1 = makeDeck('d1', { lastStudied: new Date('2026-06-28T10:00:00Z') });
    renderHero({ decks: [deck1], cardsDue: 5 });

    const bar = document.querySelector('.db-entry-progress span');
    expect((bar as HTMLElement).style.width).toBe('0%');
  });
});
