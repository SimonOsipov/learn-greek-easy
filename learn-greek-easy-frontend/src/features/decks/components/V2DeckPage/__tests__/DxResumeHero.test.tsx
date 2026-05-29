/**
 * DxResumeHero Component Tests — DX-05
 *
 * Covers:
 * - 3 covers render when siblings.length >= 2
 * - Cover stack omitted when rawDecks empty (deep-link) / siblings < 2
 * - Left column still renders when stack is hidden
 * - Stat values come from ProgressMetrics (total_cards / cards_mastered / pct)
 * - Fallback to deck.cardCount when progress undefined
 * - Greek subtitle has lang="el" and is not italic
 * - Front cover foot width === `${pct}%`
 */

import React from 'react';

import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import i18n from '@/i18n';
import type { ProgressMetrics } from '@/services/progressAPI';
import type { Deck } from '@/types/deck';

import { DxResumeHero } from '../DxResumeHero';

// ============================================
// Mocks
// ============================================

vi.mock('@/stores/deckStore', () => ({
  useDeckStore: (selector: (s: { rawDecks: Deck[] }) => unknown) => selector({ rawDecks: [] }),
}));

// ============================================
// Fixtures
// ============================================

const makeDeck = (id: string, overrides: Partial<Deck> = {}): Deck => ({
  id,
  title: `Deck ${id}`,
  titleGreek: `Ελληνικά ${id}`,
  description: `Description for ${id}`,
  level: 'A1',
  category: 'vocabulary',
  tags: [],
  cardCount: 50,
  estimatedTime: 10,
  isPremium: false,
  createdBy: 'system',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
});

const mockDeck = makeDeck('main-deck');
const mockSibling1 = makeDeck('sibling-1');
const mockSibling2 = makeDeck('sibling-2');

const mockProgress: ProgressMetrics = {
  total_cards: 40,
  cards_studied: 20,
  cards_mastered: 10,
  cards_due: 5,
  cards_new: 20,
  cards_learning: 5,
  cards_review: 5,
  mastery_percentage: 25,
  completion_percentage: 50,
};

function renderHero(deck: Deck, progress: ProgressMetrics | undefined, siblings: Deck[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <DxResumeHero deck={deck} progress={progress} siblings={siblings} />
    </I18nextProvider>
  );
}

// ============================================
// Tests
// ============================================

describe('DxResumeHero', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 3 covers when siblings.length >= 2', () => {
    const { container } = renderHero(mockDeck, mockProgress, [mockSibling1, mockSibling2]);

    const covers = container.querySelectorAll('.dx-cover');
    expect(covers.length).toBe(3);
  });

  it('omits the cover stack when siblings < 2', () => {
    const { container } = renderHero(mockDeck, mockProgress, [mockSibling1]);

    const stack = container.querySelector('.dx-cover-stack');
    expect(stack).not.toBeInTheDocument();
  });

  it('omits the cover stack when rawDecks empty (deep-link / siblings = [])', () => {
    const { container } = renderHero(mockDeck, mockProgress, []);

    const stack = container.querySelector('.dx-cover-stack');
    expect(stack).not.toBeInTheDocument();
  });

  it('left column still renders when cover stack is hidden', () => {
    renderHero(mockDeck, mockProgress, []);

    // The kicker should always be present
    expect(screen.getByText(/Vocabulary/)).toBeInTheDocument();
    // Stats labels should be present
    expect(screen.getByText('Total cards')).toBeInTheDocument();
    expect(screen.getByText('Mastered')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('stat values come from ProgressMetrics', () => {
    const { container } = renderHero(mockDeck, mockProgress, [mockSibling1, mockSibling2]);

    // Query the stats section directly
    const statsEl = container.querySelector('.dx-hero-resume-stats');
    expect(statsEl).toBeTruthy();

    // total_cards = 40
    const bTags = statsEl!.querySelectorAll('b');
    expect(bTags[0].textContent).toBe('40');
    // cards_mastered = 10
    expect(bTags[1].textContent).toBe('10');
    // pct = round(10/40 * 100) = 25%
    expect(bTags[2].textContent).toContain('25');
  });

  it('falls back to deck.cardCount when progress is undefined', () => {
    const { container } = renderHero(mockDeck, undefined, [mockSibling1, mockSibling2]);

    const statsEl = container.querySelector('.dx-hero-resume-stats');
    expect(statsEl).toBeTruthy();

    const bTags = statsEl!.querySelectorAll('b');
    // deck.cardCount = 50
    expect(bTags[0].textContent).toBe('50');
    // mastered = 0
    expect(bTags[1].textContent).toBe('0');
    // pct = 0%
    expect(bTags[2].textContent).toContain('0');
  });

  it('Greek subtitle has lang="el" and is not italic', () => {
    renderHero(mockDeck, mockProgress, []);

    const el = screen.getByText('Ελληνικά main-deck');
    expect(el).toHaveAttribute('lang', 'el');
    // The CSS sets font-style: normal; test at the element level via class
    expect(el.className).toContain('dx-hero-resume-el');
    // Verify the element is not an italic tag
    expect(el.tagName).not.toBe('I');
    expect(el.tagName).not.toBe('EM');
  });

  it('front cover foot width equals pct%', () => {
    const { container } = renderHero(mockDeck, mockProgress, [mockSibling1, mockSibling2]);

    // The front cover is dx-cover-3; its .dx-cover-bar span should have width = pct%
    const frontCover = container.querySelector('.dx-cover-3');
    expect(frontCover).toBeTruthy();
    const barFill = frontCover!.querySelector('.dx-cover-bar span') as HTMLElement;
    expect(barFill).toBeTruthy();
    // pct = round(10/40 * 100) = 25
    expect(barFill.style.width).toBe('25%');
  });

  it('front cover foot shows 0% when progress is undefined', () => {
    const { container } = renderHero(mockDeck, undefined, [mockSibling1, mockSibling2]);

    const frontCover = container.querySelector('.dx-cover-3');
    expect(frontCover).toBeTruthy();
    const barFill = frontCover!.querySelector('.dx-cover-bar span') as HTMLElement;
    expect(barFill).toBeTruthy();
    expect(barFill.style.width).toBe('0%');
  });
});
