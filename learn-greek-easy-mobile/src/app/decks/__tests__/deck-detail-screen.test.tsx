/// <reference types="jest" />
/**
 * MOB-07 — RNTL screen tests for the deck-detail route (src/app/decks/[deckId]/index.tsx).
 *
 * Tests:
 *   1. Loading → spinner.
 *   2. Error → retry + back affordances.
 *   3. Loaded → hero copy, stats strip values, word rows with derived status.
 *   4. Word-row press → router.push to word detail (MOB-12 wiring).
 *   5. Practice CTA → coming-soon marker visible, press fires the toast.
 *   6. Back button pops the stack.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — MUST precede any import that resolves the mocked module.
// ---------------------------------------------------------------------------

jest.mock('nativewind');

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({ deckId: 'house' }),
}));

const mockUseDeck = jest.fn();
const mockUseDeckWords = jest.fn();
const mockUseDeckWordMastery = jest.fn();
jest.mock('@/hooks/use-deck-detail', () => ({
  useDeck: () => mockUseDeck(),
  useDeckWords: () => mockUseDeckWords(),
  useDeckWordMastery: () => mockUseDeckWordMastery(),
}));

const mockUseDeckProgress = jest.fn();
jest.mock('@/hooks/use-deck-progress', () => ({
  useDeckProgress: () => mockUseDeckProgress(),
}));

const mockShowComingSoonToast = jest.fn();
jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showComingSoonToast: mockShowComingSoonToast }),
}));

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  return {
    LinearGradient: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => ce(View, { testID }, children),
  };
});

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = () => ce(View, { testID: 'icon-stub' });
  return { ChevronLeft: stub, ChevronRight: stub, Play: stub };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import DeckDetailScreen from '@/app/decks/[deckId]/index';
import type { WordEntryResponse } from '@/types/deck';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DECK = {
  id: 'house',
  name: 'Greek House',
  name_el: 'Το ελληνικό σπίτι',
  description: 'Things we have in the house in Greek.',
  level: 'A1' as const,
  is_active: true,
  card_count: 7,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const WORDS: WordEntryResponse[] = [
  {
    id: 'w-domatio',
    deck_id: 'house',
    lemma: 'δωμάτιο',
    part_of_speech: 'noun',
    translation_en: 'room',
    translation_ru: null,
    pronunciation: '/do·má·ti·o/',
    grammar_data: { gender: 'neuter' },
    is_active: true,
  },
  {
    id: 'w-porta',
    deck_id: 'house',
    lemma: 'πόρτα',
    part_of_speech: 'noun',
    translation_en: 'door',
    translation_ru: null,
    pronunciation: '/pór·ta/',
    grammar_data: { gender: 'feminine' },
    is_active: true,
  },
];

const MASTERY = {
  deck_id: 'house',
  items: [
    // porta: fully mastered; domatio: no row → new
    { word_entry_id: 'w-porta', mastered_count: 4, studied_count: 4, total_count: 4 },
  ],
};

const PROGRESS = {
  total: 1,
  decks: [
    {
      deck_id: 'house',
      deck_name: 'Greek House',
      cards_studied: 10,
      cards_mastered: 3,
      cards_due: 5,
      mastery_percentage: 43,
      completion_percentage: 60,
      last_studied_at: '2026-06-01T00:00:00Z',
    },
  ],
};

function setQueries({
  deckLoading = false,
  deckError = false,
}: { deckLoading?: boolean; deckError?: boolean } = {}) {
  mockUseDeck.mockReturnValue({
    data: deckLoading || deckError ? undefined : DECK,
    isLoading: deckLoading,
    isError: deckError,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
  mockUseDeckWords.mockReturnValue({
    data: WORDS,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
  mockUseDeckWordMastery.mockReturnValue({ data: MASTERY, isLoading: false, isError: false });
  mockUseDeckProgress.mockReturnValue({ data: PROGRESS, isLoading: false, isError: false });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeckDetailScreen', () => {
  it('shows a spinner while the deck loads', () => {
    setQueries({ deckLoading: true });
    render(<DeckDetailScreen />);
    expect(screen.getByTestId('deck-detail-loading')).toBeTruthy();
  });

  it('shows error + retry when the deck fetch fails', () => {
    setQueries({ deckError: true });
    render(<DeckDetailScreen />);
    expect(screen.getByTestId('deck-detail-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('deck-detail-retry'));
    expect(mockUseDeck.mock.results.at(-1)?.value.refetch).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('deck-detail-error-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('renders hero copy, stats and the word list with derived statuses', () => {
    setQueries();
    render(<DeckDetailScreen />);

    expect(screen.getByTestId('deck-detail-kicker')).toHaveTextContent('A1 · 7 cards');
    expect(screen.getByTestId('deck-detail-title')).toHaveTextContent('Greek House');
    expect(screen.getByTestId('deck-detail-title-el')).toHaveTextContent('Το ελληνικό σπίτι');
    expect(screen.getByTestId('deck-detail-desc')).toHaveTextContent(
      'Things we have in the house in Greek.',
    );

    // Stats strip — due from deck progress, mastered = mastered WORDS from
    // word-mastery (porta only), cards from the deck
    expect(screen.getByTestId('deck-stat-due')).toHaveTextContent('5');
    expect(screen.getByTestId('deck-stat-mastered')).toHaveTextContent('1');
    expect(screen.getByTestId('deck-stat-cards')).toHaveTextContent('7');

    // Word list — count, gendered articles, derived statuses
    expect(screen.getByTestId('deck-detail-word-count')).toHaveTextContent('2 words');
    expect(screen.getByTestId('word-article-w-domatio')).toHaveTextContent('το');
    expect(screen.getByTestId('word-article-w-porta')).toHaveTextContent('η');
    expect(screen.getByTestId('word-status-w-domatio')).toHaveTextContent('new');
    expect(screen.getByTestId('word-status-w-porta')).toHaveTextContent('mastered');
  });

  it('word-row press navigates to the word detail screen', () => {
    setQueries();
    render(<DeckDetailScreen />);
    fireEvent.press(screen.getByTestId('word-row-w-domatio'));
    expect(mockPush).toHaveBeenCalledWith('/decks/house/w-domatio');
    expect(mockShowComingSoonToast).not.toHaveBeenCalled();
  });

  it('practice CTA is marked coming-soon and fires the toast', () => {
    setQueries();
    render(<DeckDetailScreen />);
    expect(screen.getByTestId('deck-cta-coming-soon')).toHaveTextContent(/coming soon/i);
    // The dot is accessibility-hidden (decorative) — include hidden elements.
    expect(screen.getByTestId('coming-soon-dot', { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(screen.getByTestId('deck-practice-cta'));
    expect(mockShowComingSoonToast).toHaveBeenCalledTimes(1);
  });

  it('back button pops the stack', () => {
    setQueries();
    render(<DeckDetailScreen />);
    fireEvent.press(screen.getByTestId('deck-detail-back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
