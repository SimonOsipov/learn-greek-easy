/// <reference types="jest" />
/**
 * MOB-12 — RNTL screen tests for the word-detail route
 * (src/app/decks/[deckId]/[wordId].tsx).
 *
 * Tests:
 *   1. Loading → spinner.
 *   2. Error → retry + back affordances.
 *   3. Loaded → hero content (lemma, IPA, translation, badges).
 *   4. Word info tab (default) → declension table rows.
 *   5. Tab switch → Cards panel with mastery bar.
 *   6. Back button pops the stack.
 *   7. Report button fires coming-soon toast.
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
  useLocalSearchParams: () => ({ deckId: 'house', wordId: 'w-domatio' }),
}));

const mockUseWordEntry = jest.fn();
const mockUseWordCards = jest.fn();
const mockUseWordMasteryItem = jest.fn();
jest.mock('@/hooks/use-word-detail', () => ({
  useWordEntry: () => mockUseWordEntry(),
  useWordCards: () => mockUseWordCards(),
  useWordMasteryItem: () => mockUseWordMasteryItem(),
}));

const mockShowComingSoonToast = jest.fn();
jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showComingSoonToast: mockShowComingSoonToast }),
}));

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// expo-audio stub — useAudioPlayer returns a minimal player
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: jest.fn(), pause: jest.fn(), currentTime: 0 }),
}));

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = () => ce(View, { testID: 'icon-stub' });
  return { ChevronLeft: stub, Volume2: stub, Flag: stub };
});

import WordDetailScreen from '@/app/decks/[deckId]/[wordId]';
import type { CardRecordResponse } from '@/types/word';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORD = {
  id: 'w-domatio',
  deck_id: 'house',
  lemma: 'δωμάτιο',
  part_of_speech: 'noun',
  translation_en: 'room',
  translation_en_plural: 'rooms',
  translation_ru: null,
  pronunciation: '/do·má·ti·o/',
  grammar_data: {
    gender: 'neuter',
    nominative_singular: 'το δωμάτιο',
    genitive_singular: 'του δωματίου',
    nominative_plural: 'τα δωμάτια',
    genitive_plural: 'των δωματίων',
    accusative_singular: 'το δωμάτιο',
    accusative_plural: 'τα δωμάτια',
    vocative_singular: 'δωμάτιο',
    vocative_plural: 'δωμάτια',
  },
  examples: [
    {
      id: 'ex-1',
      greek: 'Το δωμάτιο είναι καθαρό.',
      english: 'The room is clean.',
      russian: '',
      audio_key: null,
      audio_url: null,
      audio_status: null,
    },
  ],
  audio_url: null,
  audio_status: 'missing',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const CARDS: CardRecordResponse[] = [
  {
    id: 'card-1',
    word_entry_id: 'w-domatio',
    deck_id: 'house',
    card_type: 'meaning_el_to_en',
    tier: 1,
    variant_key: 'v1',
    front_content: { text: 'δωμάτιο' },
    back_content: { text: 'room' },
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'card-2',
    word_entry_id: 'w-domatio',
    deck_id: 'house',
    card_type: 'declension',
    tier: 1,
    variant_key: 'v1',
    front_content: { text: 'δωμάτιο (genitive singular)' },
    back_content: { text: 'του δωματίου' },
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const MASTERY_ITEM = {
  word_entry_id: 'w-domatio',
  mastered_count: 1,
  studied_count: 1,
  total_count: 2,
  type_progress: [
    { card_type: 'meaning_el_to_en', mastered_count: 1, studied_count: 1, total_count: 1 },
  ],
};

function setQueries({
  wordLoading = false,
  wordError = false,
  cardsLoading = false,
}: { wordLoading?: boolean; wordError?: boolean; cardsLoading?: boolean } = {}) {
  mockUseWordEntry.mockReturnValue({
    data: wordLoading || wordError ? undefined : WORD,
    isLoading: wordLoading,
    isError: wordError,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
  mockUseWordCards.mockReturnValue({
    data: cardsLoading ? undefined : CARDS,
    isLoading: cardsLoading,
    isError: false,
    refetch: jest.fn(),
  });
  mockUseWordMasteryItem.mockReturnValue(MASTERY_ITEM);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WordDetailScreen', () => {
  it('shows a spinner while the word loads', () => {
    setQueries({ wordLoading: true });
    render(<WordDetailScreen />);
    expect(screen.getByTestId('word-detail-loading')).toBeTruthy();
  });

  it('shows error + retry when the word fetch fails', () => {
    setQueries({ wordError: true });
    render(<WordDetailScreen />);
    expect(screen.getByTestId('word-detail-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('word-detail-retry'));
    expect(mockUseWordEntry.mock.results.at(-1)?.value.refetch).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('word-detail-error-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('renders hero content — lemma, IPA, translation, and neuter gender badge', () => {
    setQueries();
    render(<WordDetailScreen />);
    expect(screen.getByTestId('word-detail-lemma')).toHaveTextContent('δωμάτιο');
    expect(screen.getByTestId('word-detail-ipa')).toHaveTextContent('/do·má·ti·o/');
    expect(screen.getByTestId('word-detail-translation')).toHaveTextContent('room');
    // Article for neuter
    expect(screen.getByTestId('word-detail-article')).toHaveTextContent('το');
  });

  it('shows declension table on the Word info tab (default)', () => {
    setQueries();
    render(<WordDetailScreen />);
    // Nominative row
    expect(screen.getByTestId('declension-case-nominative')).toHaveTextContent('Nominative');
    // Genitive row
    expect(screen.getByTestId('declension-case-genitive')).toHaveTextContent('Genitive');
  });

  it('shows example sentence on the Word info tab', () => {
    setQueries();
    render(<WordDetailScreen />);
    expect(screen.getByTestId('example-0')).toBeTruthy();
  });

  it('switches to Cards tab and shows mastery bar', () => {
    setQueries();
    render(<WordDetailScreen />);
    fireEvent.press(screen.getByTestId('word-tab-cards'));
    expect(screen.getByTestId('word-cards-mastery-bar')).toBeTruthy();
  });

  it('back button pops the stack', () => {
    setQueries();
    render(<WordDetailScreen />);
    fireEvent.press(screen.getByTestId('word-detail-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('report button fires coming-soon toast', () => {
    setQueries();
    render(<WordDetailScreen />);
    fireEvent.press(screen.getByTestId('word-detail-report'));
    expect(mockShowComingSoonToast).toHaveBeenCalledTimes(1);
  });
});
