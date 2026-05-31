/**
 * DxResumeHero Component Tests — DX-05
 *
 * Covers:
 * - 3 covers render when siblings.length >= 2
 * - Cover stack omitted when rawDecks empty (deep-link) / siblings < 2
 * - Left column still renders when stack is hidden
 * - Stats are word-based: Total words = deck.cardCount, Mastered = masteredWords,
 *   Complete % = round(masteredWords / totalWords * 100)
 * - Greek subtitle has lang="el" and is not italic
 * - Front cover foot width === `${pct}%`
 */

import React from 'react';

import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import i18n from '@/i18n';
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

function renderHero(deck: Deck, masteredWords: number, siblings: Deck[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <DxResumeHero deck={deck} masteredWords={masteredWords} siblings={siblings} />
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
    const { container } = renderHero(mockDeck, 10, [mockSibling1, mockSibling2]);

    const covers = container.querySelectorAll('.dx-cover');
    expect(covers.length).toBe(3);
  });

  it('omits the cover stack when siblings < 2', () => {
    const { container } = renderHero(mockDeck, 10, [mockSibling1]);

    const stack = container.querySelector('.dx-cover-stack');
    expect(stack).not.toBeInTheDocument();
  });

  it('omits the cover stack when rawDecks empty (deep-link / siblings = [])', () => {
    const { container } = renderHero(mockDeck, 10, []);

    const stack = container.querySelector('.dx-cover-stack');
    expect(stack).not.toBeInTheDocument();
  });

  it('left column still renders when cover stack is hidden', () => {
    renderHero(mockDeck, 10, []);

    // The kicker should always be present
    expect(screen.getByText(/Vocabulary/)).toBeInTheDocument();
    // Stats labels should be present
    expect(screen.getByText('Total words')).toBeInTheDocument();
    expect(screen.getByText('Mastered')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('stat values are word-based (Total words / Mastered words / %)', () => {
    const { container } = renderHero(mockDeck, 10, [mockSibling1, mockSibling2]);

    // Query the stats section directly
    const statsEl = container.querySelector('.dx-hero-resume-stats');
    expect(statsEl).toBeTruthy();

    // totalWords = deck.cardCount = 50
    const bTags = statsEl!.querySelectorAll('b');
    expect(bTags[0].textContent).toBe('50');
    // masteredWords = 10
    expect(bTags[1].textContent).toBe('10');
    // pct = round(10/50 * 100) = 20%
    expect(bTags[2].textContent).toContain('20');
  });

  it('shows 0 mastered / 0% when no words are mastered', () => {
    const { container } = renderHero(mockDeck, 0, [mockSibling1, mockSibling2]);

    const statsEl = container.querySelector('.dx-hero-resume-stats');
    expect(statsEl).toBeTruthy();

    const bTags = statsEl!.querySelectorAll('b');
    // totalWords = deck.cardCount = 50
    expect(bTags[0].textContent).toBe('50');
    // masteredWords = 0
    expect(bTags[1].textContent).toBe('0');
    // pct = 0%
    expect(bTags[2].textContent).toContain('0');
  });

  it('Greek subtitle has lang="el" and is not italic', () => {
    renderHero(mockDeck, 10, []);

    const el = screen.getByText('Ελληνικά main-deck');
    expect(el).toHaveAttribute('lang', 'el');
    // The CSS sets font-style: normal; test at the element level via class
    expect(el.className).toContain('dx-hero-resume-el');
    // Verify the element is not an italic tag
    expect(el.tagName).not.toBe('I');
    expect(el.tagName).not.toBe('EM');
  });

  it('front cover foot width equals pct%', () => {
    const { container } = renderHero(mockDeck, 10, [mockSibling1, mockSibling2]);

    // The front cover is dx-cover-3; its .dx-cover-bar span should have width = pct%
    const frontCover = container.querySelector('.dx-cover-3');
    expect(frontCover).toBeTruthy();
    const barFill = frontCover!.querySelector('.dx-cover-bar span') as HTMLElement;
    expect(barFill).toBeTruthy();
    // pct = round(10/50 * 100) = 20
    expect(barFill.style.width).toBe('20%');
  });

  it('front cover foot shows 0% when no words are mastered', () => {
    const { container } = renderHero(mockDeck, 0, [mockSibling1, mockSibling2]);

    const frontCover = container.querySelector('.dx-cover-3');
    expect(frontCover).toBeTruthy();
    const barFill = frontCover!.querySelector('.dx-cover-bar span') as HTMLElement;
    expect(barFill).toBeTruthy();
    expect(barFill.style.width).toBe('0%');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DGREEK-08: Greek subtitle guard — show/hide at both render sites
  //
  // LOCKED Display Spec:
  //   • shown  when greekSubtitle !== '' && greekSubtitle !== localizedName
  //   • hidden when greekSubtitle === ''  OR  greekSubtitle === localizedName
  //
  // Two render sites:
  //   1. Left column heading area  — class "dx-hero-resume-el"
  //   2. Front cover overlay       — class "dx-cover-el"  (only when siblings >= 2)
  // ──────────────────────────────────────────────────────────────────────────

  describe('Greek subtitle guard (DGREEK-08)', () => {
    // i18n defaults to "en" in the test environment (I18nextProvider with shared i18n).
    // getLocalizedDeckName returns nameEn || name_en || name || title for locale "en".
    // Therefore localizedName === deck.nameEn when nameEn is set.

    it('SITE 1 (heading): Greek subtitle shown when titleGreek !== localizedName (en locale)', () => {
      // titleGreek = 'Ελληνικό Λεξιλόγιο' — different from nameEn 'Greek A1 Vocabulary'
      const deck = makeDeck('show-case', {
        title: 'Greek A1 Vocabulary', // deck.name / title fallback
        nameEn: 'Greek A1 Vocabulary', // localizedName in en locale
        titleGreek: 'Ελληνικό Λεξιλόγιο', // must be shown (differs from nameEn)
      });

      renderHero(deck, 0, []);

      const el = document.querySelector('.dx-hero-resume-el');
      expect(el).toBeInTheDocument();
      expect(el).toHaveTextContent('Ελληνικό Λεξιλόγιο');
      expect(el).toHaveAttribute('lang', 'el');
    });

    it('SITE 1 (heading): Greek subtitle hidden when titleGreek === localizedName (equal-case)', () => {
      // When titleGreek === nameEn, the component guard hides the element.
      const deck = makeDeck('hide-case', {
        title: 'Greek A1 Vocabulary',
        nameEn: 'Greek A1 Vocabulary',
        titleGreek: 'Greek A1 Vocabulary', // equal → hidden
      });

      renderHero(deck, 0, []);

      const el = document.querySelector('.dx-hero-resume-el');
      expect(el).not.toBeInTheDocument();
    });

    it('SITE 1 (heading): Greek subtitle hidden when titleGreek is empty string', () => {
      const deck = makeDeck('empty-greek', {
        nameEn: 'Greek A1 Vocabulary',
        titleGreek: '',
      });

      renderHero(deck, 0, []);

      const el = document.querySelector('.dx-hero-resume-el');
      expect(el).not.toBeInTheDocument();
    });

    it('SITE 2 (cover overlay): Greek subtitle shown when titleGreek !== localizedName', () => {
      // The cover overlay (.dx-cover-el) renders inside .dx-cover-3 when siblings >= 2.
      const deck = makeDeck('cover-show', {
        title: 'Greek A1 Vocabulary',
        nameEn: 'Greek A1 Vocabulary',
        titleGreek: 'Ελληνικό Λεξιλόγιο',
      });

      const { container } = renderHero(deck, 10, [mockSibling1, mockSibling2]);

      const coverEl = container.querySelector('.dx-cover-3 .dx-cover-el');
      expect(coverEl).toBeInTheDocument();
      expect(coverEl).toHaveTextContent('Ελληνικό Λεξιλόγιο');
      expect(coverEl).toHaveAttribute('lang', 'el');
    });

    it('SITE 2 (cover overlay): Greek subtitle hidden when titleGreek === localizedName', () => {
      const deck = makeDeck('cover-hide', {
        title: 'Greek A1 Vocabulary',
        nameEn: 'Greek A1 Vocabulary',
        titleGreek: 'Greek A1 Vocabulary', // equal → hidden
      });

      const { container } = renderHero(deck, 10, [mockSibling1, mockSibling2]);

      const coverEl = container.querySelector('.dx-cover-3 .dx-cover-el');
      expect(coverEl).not.toBeInTheDocument();
    });

    it('Both sites simultaneously: shown in heading, shown in cover', () => {
      // Verify both guards are independent and both show when conditions are met.
      const deck = makeDeck('both-show', {
        title: 'Greek A1 Vocabulary',
        nameEn: 'Greek A1 Vocabulary',
        titleGreek: 'Ελληνικό Λεξιλόγιο',
      });

      const { container } = renderHero(deck, 10, [mockSibling1, mockSibling2]);

      // Heading site
      expect(container.querySelector('.dx-hero-resume-el')).toBeInTheDocument();
      // Cover overlay site
      expect(container.querySelector('.dx-cover-3 .dx-cover-el')).toBeInTheDocument();
    });

    it('Both sites simultaneously: hidden in heading, hidden in cover', () => {
      const deck = makeDeck('both-hide', {
        title: 'Greek A1 Vocabulary',
        nameEn: 'Greek A1 Vocabulary',
        titleGreek: 'Greek A1 Vocabulary',
      });

      const { container } = renderHero(deck, 10, [mockSibling1, mockSibling2]);

      expect(container.querySelector('.dx-hero-resume-el')).not.toBeInTheDocument();
      expect(container.querySelector('.dx-cover-3 .dx-cover-el')).not.toBeInTheDocument();
    });
  });
});
