/// <reference types="jest" />
/**
 * MOB-07 — RNTL screen tests for the Decks library (src/app/(app)/decks.tsx).
 *
 * Tests:
 *   1. Loading → skeleton, no grid.
 *   2. Error → retry affordance, refetch on press.
 *   3. Loaded → title, "N decks · M active" count line, all cards rendered.
 *   4. Level filter → only matching decks; empty level shows the empty copy.
 *   5. Active filter → only in-progress decks.
 *   6. Card press → router.push to /decks/{id}.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — MUST precede any import that resolves the mocked module.
// ---------------------------------------------------------------------------

jest.mock('nativewind');

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUseDecks = jest.fn();
jest.mock('@/hooks/use-decks', () => ({
  useDecks: () => mockUseDecks(),
}));

const mockUseDeckProgress = jest.fn();
jest.mock('@/hooks/use-deck-progress', () => ({
  useDeckProgress: () => mockUseDeckProgress(),
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
  return { Check: stub };
});

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  return {
    SafeAreaView: ({
      children,
      testID,
      ...rest
    }: {
      children?: React.ReactNode;
      testID?: string;
      [k: string]: unknown;
    }) => ce(View, { testID, ...rest }, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

import DecksScreen from '@/app/(app)/decks';
import type { DeckResponse } from '@/types/deck';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDeck(overrides: Partial<DeckResponse> = {}): DeckResponse {
  return {
    id: 'deck-1',
    name: 'Greek House',
    name_el: 'Το ελληνικό σπίτι',
    description: null,
    level: 'A1',
    is_active: true,
    card_count: 7,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const DECKS = [
  makeDeck({ id: 'house', name: 'Greek House', level: 'A1' }),
  makeDeck({ id: 'family', name: 'Greek Family', level: 'A1', card_count: 48 }),
  makeDeck({ id: 'pharmacy', name: 'At the Pharmacy', level: 'A2', card_count: 28 }),
  makeDeck({ id: 'past', name: 'Past Tense', level: 'B1', card_count: 45 }),
];

const PROGRESS = [
  // family: in progress (12/48 mastered, 8 due)
  {
    deck_id: 'family',
    deck_name: 'Greek Family',
    cards_studied: 20,
    cards_mastered: 12,
    cards_due: 8,
    mastery_percentage: 25,
    completion_percentage: 40,
    last_studied_at: '2026-06-01T00:00:00Z',
  },
  // past: complete (45/45)
  {
    deck_id: 'past',
    deck_name: 'Past Tense',
    cards_studied: 45,
    cards_mastered: 45,
    cards_due: 0,
    mastery_percentage: 100,
    completion_percentage: 100,
    last_studied_at: '2026-05-01T00:00:00Z',
  },
];

function setQueries({
  decksLoading = false,
  decksError = false,
}: { decksLoading?: boolean; decksError?: boolean } = {}) {
  mockUseDecks.mockReturnValue({
    data: decksLoading || decksError ? undefined : { total: DECKS.length, decks: DECKS },
    isLoading: decksLoading,
    isError: decksError,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
  mockUseDeckProgress.mockReturnValue({
    data: { total: PROGRESS.length, decks: PROGRESS },
    isLoading: false,
    isError: false,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DecksScreen', () => {
  it('shows the skeleton while loading', () => {
    setQueries({ decksLoading: true });
    render(<DecksScreen />);
    expect(screen.getByTestId('decks-loading')).toBeTruthy();
    expect(screen.queryByTestId('decks-grid')).toBeNull();
  });

  it('shows error + retry when the deck list fails', () => {
    setQueries({ decksError: true });
    render(<DecksScreen />);
    expect(screen.getByTestId('decks-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('decks-error-retry'));
    expect(mockUseDecks.mock.results.at(-1)?.value.refetch).toHaveBeenCalled();
  });

  it('renders the header count line and all deck cards', () => {
    setQueries();
    render(<DecksScreen />);
    expect(screen.getByTestId('decks-title')).toHaveTextContent('Decks');
    // 4 decks, 1 active (family is in progress; past is complete)
    expect(screen.getByTestId('decks-count')).toHaveTextContent('4 decks · 1 active');
    for (const id of ['house', 'family', 'pharmacy', 'past']) {
      expect(screen.getByTestId(`deck-grid-card-${id}`)).toBeTruthy();
    }
    // family is in progress → due pill shows
    expect(screen.getByTestId('deck-grid-due')).toHaveTextContent('8 due');
  });

  it('level filter narrows the grid; empty level shows empty copy', () => {
    setQueries();
    render(<DecksScreen />);

    fireEvent.press(screen.getByTestId('deck-filter-A2'));
    expect(screen.getByTestId('deck-grid-card-pharmacy')).toBeTruthy();
    expect(screen.queryByTestId('deck-grid-card-house')).toBeNull();

    fireEvent.press(screen.getByTestId('deck-filter-B2'));
    expect(screen.getByTestId('decks-empty')).toHaveTextContent('No decks at this level yet');
  });

  it('Active filter shows only in-progress decks', () => {
    setQueries();
    render(<DecksScreen />);
    fireEvent.press(screen.getByTestId('deck-filter-Active'));
    expect(screen.getByTestId('deck-grid-card-family')).toBeTruthy();
    expect(screen.queryByTestId('deck-grid-card-house')).toBeNull();
    expect(screen.queryByTestId('deck-grid-card-past')).toBeNull();
  });

  it('card press routes to the deck detail', () => {
    setQueries();
    render(<DecksScreen />);
    fireEvent.press(screen.getByTestId('deck-grid-card-house'));
    expect(mockPush).toHaveBeenCalledWith('/decks/house');
  });
});
