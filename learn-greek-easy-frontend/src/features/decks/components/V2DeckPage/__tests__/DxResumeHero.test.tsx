/**
 * DxResumeHero Component Tests — DX-05
 *
 * Covers:
 * - 3 covers render when siblings.length >= 2
 * - Front cover always renders; sibling covers omitted when rawDecks empty
 *   (deep-link) / siblings < 2
 * - Left column renders alongside the front cover
 * - Stats are word-based: Total words = deck.cardCount, Mastered = masteredWords,
 *   Complete % = round(masteredWords / totalWords * 100)
 * - Greek subtitle has lang="el" and is not italic
 * - Front cover foot width === `${pct}%`
 */

import { render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import i18n from '@/i18n';
import type { Deck } from '@/types/deck';

import { DxResumeHero, DxResumeHeroConnected } from '../DxResumeHero';

// ============================================
// Mocks
// ============================================

// useDeckStore mock — vi.fn() so tests can override via mockImplementation.
// Default behaviour: empty rawDecks, no selectedDeckProgressDetail (matches existing tests).
const mockUseDeckStore = vi.fn(
  (selector: (s: { rawDecks: Deck[]; selectedDeckProgressDetail: unknown }) => unknown) =>
    selector({ rawDecks: [], selectedDeckProgressDetail: null })
);

vi.mock('@/stores/deckStore', () => ({
  get useDeckStore() {
    return mockUseDeckStore;
  },
}));

// useQuery mock — vi.fn() so tests can control what wordMastery data is returned.
// Default: return { data: undefined } so existing tests (which render DxResumeHero
// directly and never hit useQuery) are unaffected.
const mockUseQuery = vi.fn((): { data: unknown } => ({ data: undefined }));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    get useQuery() {
      return mockUseQuery;
    },
  };
});

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

function renderHero(deck: Deck, masteredWords: number, siblings: Deck[], progressPct?: number) {
  // Default progressPct to the simple mastered/totalWords calculation to keep
  // existing test cases consistent with their expected values.
  const pct =
    progressPct ?? (deck.cardCount > 0 ? Math.round((masteredWords / deck.cardCount) * 100) : 0);
  return render(
    <I18nextProvider i18n={i18n}>
      <DxResumeHero
        deck={deck}
        masteredWords={masteredWords}
        progressPct={pct}
        siblings={siblings}
      />
    </I18nextProvider>
  );
}

// ============================================
// Tests
// ============================================

describe('DxResumeHero', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to safe defaults so existing presentational tests keep working.
    mockUseDeckStore.mockImplementation(
      (selector: (s: { rawDecks: Deck[]; selectedDeckProgressDetail: unknown }) => unknown) =>
        selector({ rawDecks: [], selectedDeckProgressDetail: null })
    );
    mockUseQuery.mockReturnValue({ data: undefined });
  });

  it('renders 3 covers when siblings.length >= 2', () => {
    const { container } = renderHero(mockDeck, 10, [mockSibling1, mockSibling2]);

    const covers = container.querySelectorAll('.dx-cover');
    expect(covers.length).toBe(3);
  });

  it('renders only the front cover (no siblings) when siblings < 2', () => {
    const { container } = renderHero(mockDeck, 10, [mockSibling1]);

    // The stack container and the front cover always render…
    expect(container.querySelector('.dx-cover-stack')).toBeInTheDocument();
    expect(container.querySelector('.dx-cover-3')).toBeInTheDocument();
    // …but the dimmed sibling covers are omitted.
    expect(container.querySelector('.dx-cover-1')).not.toBeInTheDocument();
    expect(container.querySelector('.dx-cover-2')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.dx-cover').length).toBe(1);
  });

  it('renders the front cover on deep-link (rawDecks empty / siblings = [])', () => {
    const { container } = renderHero(mockDeck, 10, []);

    // Front cover shows so the hero is never empty; siblings stay omitted.
    expect(container.querySelector('.dx-cover-stack')).toBeInTheDocument();
    expect(container.querySelector('.dx-cover-3')).toBeInTheDocument();
    expect(container.querySelectorAll('.dx-cover').length).toBe(1);
  });

  it('left column renders alongside the front cover', () => {
    const { container } = renderHero(mockDeck, 10, []);

    // The kicker should always be present in the left column (the front cover
    // also carries a "Vocabulary" tag now, so scope the query to avoid a match
    // on both).
    const leftCol = container.querySelector('.dx-hero-resume-l') as HTMLElement;
    expect(within(leftCol).getByText(/Vocabulary/)).toBeInTheDocument();
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
    const { container } = renderHero(mockDeck, 10, []);

    // Scope to the left-column heading: the front cover overlay also renders
    // the same Greek text in a .dx-cover-el now that it always shows.
    const el = container.querySelector('.dx-hero-resume-el') as HTMLElement;
    expect(el).toHaveTextContent('Ελληνικά main-deck');
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

// ============================================================================
// PRACT2-7-04 AC-2: DxResumeHeroConnected headline uses card-coverage, not
// the weighted word-mastery value
//
// Strategy: supply wordMastery where ALL words are mastered (→ deriveWordProgress
// returns progressPct=100) BUT card coverage is only 70% (7/10).
// After the executor's change, the headline must show 70 (coverage).
// Currently it shows 100 (weighted word-mastery) → these tests will be RED.
// ============================================================================

describe('DxResumeHeroConnected — AC-2 (PRACT2-7-04)', () => {
  // Deck fixture for connected tests: cardCount=10 (word count for the hero stats)
  const connectedDeck = makeDeck('connected-deck', { cardCount: 10 });

  // Helper: build a WordMasteryItem where the word is fully mastered
  // (total_count > 0, mastered_count === total_count, studied_count = total_count).
  const masteredItem = (id: string): import('@/services/progressAPI').WordMasteryItem => ({
    word_entry_id: id,
    total_count: 2,
    mastered_count: 2,
    studied_count: 2,
    type_progress: [],
  });

  // 10 items all mastered → deriveWordProgress returns progressPct=100.
  const allMasteredItems = Array.from({ length: 10 }, (_, i) => masteredItem(`w${i}`));

  function renderConnected(deck: Deck) {
    return render(
      <I18nextProvider i18n={i18n}>
        <DxResumeHeroConnected deck={deck} />
      </I18nextProvider>
    );
  }

  beforeEach(() => {
    // Supply a disagreeing wordMastery: all 10 words mastered → weighted pct = 100.
    // But selectedDeckProgressDetail says only 7/10 cards studied → coverage = 70.
    mockUseQuery.mockReturnValue({
      data: { deck_id: connectedDeck.id, items: allMasteredItems },
    });

    // selectedDeckProgressDetail with cards_studied=7, total_cards=10.
    mockUseDeckStore.mockImplementation(
      (selector: (s: { rawDecks: Deck[]; selectedDeckProgressDetail: unknown }) => unknown) =>
        selector({
          rawDecks: [],
          selectedDeckProgressDetail: {
            deck_id: connectedDeck.id,
            deck_name: connectedDeck.title,
            deck_level: connectedDeck.level,
            deck_description: null,
            progress: {
              total_cards: 10,
              cards_studied: 7,
              cards_mastered: 2,
              cards_due: 0,
              cards_new: 3,
              cards_learning: 5,
              cards_review: 0,
              mastery_percentage: 20,
              completion_percentage: 70,
            },
            statistics: {
              total_reviews: 0,
              total_study_time_seconds: 0,
              average_quality: 0,
              average_easiness_factor: 2.5,
              average_interval_days: 0,
              deck_streak_current: 0,
              deck_streak_longest: 0,
              weekly_activity: [],
            },
            timeline: {
              first_studied_at: null,
              last_studied_at: null,
              days_active: 0,
              estimated_completion_days: null,
            },
          },
        })
    );
  });

  // AC-2 — detail headline uses deckCompletionPct (coverage), NOT deriveWordProgress
  it('test_detail_headline_uses_deckCompletionPct_not_deriveWordProgress', () => {
    // wordMastery: all 10 words mastered → deriveWordProgress would return progressPct=100.
    // selectedDeckProgressDetail: cards_studied=7, total_cards=10 → coverage=70.
    // AFTER executor change: headline must show 70, not 100.
    // CURRENTLY (pre-implementation): headline shows 100 → test is RED.
    const { container } = renderConnected(connectedDeck);

    const statsEl = container.querySelector('.dx-hero-resume-stats');
    expect(statsEl).toBeTruthy();

    // Third stat is the completion % — must be coverage (70), not word-mastery (100).
    const bTags = statsEl!.querySelectorAll('b');
    const displayedPct = parseInt(bTags[2].textContent ?? '-1', 10);
    expect(displayedPct).toBe(70);
  });

  // ── PRACT2-7-04 adversarial: null selectedDeckProgressDetail ─────────────
  //
  // When selectedDeckProgressDetail is null (network error / not-yet-loaded),
  // the ??0 fallback in DxResumeHeroConnected means deckCompletionPct({0,0})=0.
  // Verify: no crash, no NaN, headline shows 0.
  it('null selectedDeckProgressDetail: headline shows 0, no crash, no NaN', () => {
    // Override: null progress detail, but wordMastery still has mastered items
    // (to confirm the null-progress path overrides any mastery-based value).
    mockUseDeckStore.mockImplementation(
      (selector: (s: { rawDecks: Deck[]; selectedDeckProgressDetail: unknown }) => unknown) =>
        selector({ rawDecks: [], selectedDeckProgressDetail: null })
    );
    mockUseQuery.mockReturnValue({
      data: { deck_id: connectedDeck.id, items: allMasteredItems },
    });

    const { container } = renderConnected(connectedDeck);

    const statsEl = container.querySelector('.dx-hero-resume-stats');
    expect(statsEl).toBeTruthy();

    const bTags = statsEl!.querySelectorAll('b');
    const displayedPct = parseInt(bTags[2].textContent ?? '-1', 10);
    // Must be 0, not NaN, not a crash
    expect(Number.isNaN(displayedPct)).toBe(false);
    expect(displayedPct).toBe(0);
  });
});
