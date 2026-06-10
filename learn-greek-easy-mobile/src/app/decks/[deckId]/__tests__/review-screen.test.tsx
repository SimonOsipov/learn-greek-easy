/// <reference types="jest" />
/**
 * MOB-09 — RNTL tests for the review screen (src/app/decks/[deckId]/review.tsx).
 *
 * Tests:
 *   1. Loading state — skeleton shown while queue loads.
 *   2. Empty queue — "All caught up" state.
 *   3. Error state (generic + 403 premium).
 *   4. Active review — card front shown, flip reveals back + rating row.
 *   5. Rating submission posts correct quality + advances card.
 *   6. Session summary appears after all cards are rated; math is correct.
 *   7. Abandon (close) fires review_session_abandoned analytics.
 *   8. "Back to deck" on summary calls router.back().
 *   9. "Study more" on summary refetches queue.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — MUST precede any import that resolves the mocked module.
// ---------------------------------------------------------------------------

jest.mock('nativewind');

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({ deckId: 'deck-abc' }),
}));

// expo-audio — no-op implementation
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({
    play: jest.fn(),
    pause: jest.fn(),
    currentTime: 0,
    setPlaybackRate: jest.fn(),
  }),
}));

// react-native-reanimated — handled by jest.config.js transformIgnorePatterns;
// mock fallback for safety
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

const mockUseStudyQueue = jest.fn();
jest.mock('@/hooks/use-study-queue', () => ({
  useStudyQueue: () => mockUseStudyQueue(),
}));

const mockMutate = jest.fn();
const mockSubmitReview = jest.fn();
jest.mock('@/hooks/use-submit-review', () => ({
  useSubmitReview: () => mockSubmitReview(),
}));

const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

const mockInvalidateQueries = jest.fn().mockResolvedValue(undefined);
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = ({ testID }: { testID?: string }) => ce(View, { testID: testID ?? 'icon-stub' });
  return {
    X: stub,
    Sun: stub,
    Moon: stub,
    Volume2: stub,
    Check: stub,
    CheckCircle2: stub,
  };
});

// ---------------------------------------------------------------------------
// Import the screen AFTER mocks
// ---------------------------------------------------------------------------

import ReviewScreen from '@/app/decks/[deckId]/review';
import type { V2StudyQueueCard } from '@/types/review';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CARD_1: V2StudyQueueCard = {
  card_record_id: 'cr-001',
  word_entry_id: 'we-001',
  deck_id: 'deck-abc',
  deck_name: 'Test Deck',
  card_type: 'noun',
  variant_key: 'meaning',
  front_content: {
    prompt: 'What does this mean?',
    main: 'δωμάτιο',
    sub: '/do·má·ti·o/',
    badge: 'Meaning',
    hint: 'Tap to reveal',
  },
  back_content: {
    answer: 'room',
    answer_sub: null,
  },
  status: 'NEW',
  is_new: true,
  is_early_practice: false,
  due_date: null,
  easiness_factor: null,
  interval: null,
  audio_url: null,
  example_audio_url: null,
  translation_ru: 'комната',
  translation_ru_plural: null,
  sentence_ru: null,
  example_el: 'Το δωμάτιο είναι μεγάλο.',
  example_en: 'The room is big.',
  rating_previews: [
    { rating: 1, quality: 0, interval: 0, next_review_date: '2026-06-12', new_status: 'LEARNING' },
    { rating: 2, quality: 2, interval: 1, next_review_date: '2026-06-12', new_status: 'LEARNING' },
    { rating: 3, quality: 4, interval: 3, next_review_date: '2026-06-14', new_status: 'REVIEW' },
    { rating: 4, quality: 5, interval: 7, next_review_date: '2026-06-18', new_status: 'REVIEW' },
  ],
};

const CARD_2: V2StudyQueueCard = {
  ...CARD_1,
  card_record_id: 'cr-002',
  word_entry_id: 'we-002',
  front_content: { ...CARD_1.front_content, main: 'πόρτα' },
  back_content: { answer: 'door' },
};

function makeQueue(cards: V2StudyQueueCard[] = [CARD_1, CARD_2]) {
  return {
    total_due: cards.length,
    total_new: cards.length,
    total_early_practice: 0,
    total_in_queue: cards.length,
    cards,
  };
}

function setupMutationMock(onSettledImmediately = true) {
  mockSubmitReview.mockReturnValue({
    mutate: (req: unknown, opts?: { onSettled?: () => void }) => {
      mockMutate(req);
      if (onSettledImmediately && opts?.onSettled) {
        opts.onSettled();
      }
    },
    isPending: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setupMutationMock();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReviewScreen', () => {
  it('shows skeleton while queue is loading', () => {
    mockUseStudyQueue.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
      error: null,
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);
    expect(screen.getByTestId('review-loading')).toBeTruthy();
    expect(screen.getByTestId('review-skeleton-card')).toBeTruthy();
  });

  it('shows all caught up when queue is empty', () => {
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeQueue([]),
      error: null,
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);
    expect(screen.getByTestId('review-screen-empty')).toBeTruthy();
    expect(screen.getByTestId('review-all-caught-up')).toBeTruthy();
    expect(screen.getByTestId('review-caught-up-heading')).toHaveTextContent('All caught up');
  });

  it('shows error state on queue fetch failure', () => {
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      error: new Error('Network error'),
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);
    expect(screen.getByTestId('review-error')).toBeTruthy();
    expect(screen.getByTestId('review-error-message')).toHaveTextContent("Couldn't load cards");
  });

  it('shows premium error message on 403', () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 });
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      error: err,
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);
    expect(screen.getByTestId('review-error-message')).toHaveTextContent('Premium required');
    // No retry button for 403 (paywall)
    expect(screen.queryByTestId('review-error-retry')).toBeNull();
  });

  it('renders card front and fires session started analytics', () => {
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeQueue(),
      error: null,
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);
    expect(screen.getByTestId('review-screen')).toBeTruthy();
    expect(screen.getByTestId('review-card-front')).toBeTruthy();
    expect(screen.queryByTestId('review-card-back')).toBeNull();
    expect(screen.queryByTestId('review-rating-row')).toBeNull();
    expect(mockTrack).toHaveBeenCalledWith('review_session_started', {
      deck_id: 'deck-abc',
      queue_size: 2,
    });
  });

  it('tapping the card flips to back and shows rating row', () => {
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeQueue(),
      error: null,
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);
    fireEvent.press(screen.getByTestId('review-card-front'));
    expect(screen.queryByTestId('review-card-front')).toBeNull();
    expect(screen.getByTestId('review-card-back')).toBeTruthy();
    expect(screen.getByTestId('review-rating-row')).toBeTruthy();
  });

  it('rating "Good" posts quality=4 and advances to next card', () => {
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeQueue(),
      error: null,
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);

    // Flip
    fireEvent.press(screen.getByTestId('review-card-front'));
    // Rate Good
    fireEvent.press(screen.getByTestId('review-rating-good'));

    // Mutation called with correct quality
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ card_record_id: 'cr-001', quality: 4 }),
    );
    // Analytics
    expect(mockTrack).toHaveBeenCalledWith('review_card_rated', {
      rating: 3,
      card_type: 'noun',
    });
    // Advanced to card 2 (front)
    expect(screen.getByTestId('review-card-front')).toBeTruthy();
    expect(screen.queryByTestId('review-rating-row')).toBeNull();
  });

  it('rating "Again" posts quality=0', () => {
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeQueue([CARD_1]),
      error: null,
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);
    fireEvent.press(screen.getByTestId('review-card-front'));
    fireEvent.press(screen.getByTestId('review-rating-again'));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 0 }),
    );
  });

  it('rating "Hard" posts quality=2', () => {
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeQueue([CARD_1]),
      error: null,
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);
    fireEvent.press(screen.getByTestId('review-card-front'));
    fireEvent.press(screen.getByTestId('review-rating-hard'));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 2 }),
    );
  });

  it('rating "Easy" posts quality=5', () => {
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeQueue([CARD_1]),
      error: null,
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);
    fireEvent.press(screen.getByTestId('review-card-front'));
    fireEvent.press(screen.getByTestId('review-rating-easy'));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 5 }),
    );
  });

  it('shows session summary after all cards are rated', () => {
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeQueue([CARD_1]),
      error: null,
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);
    fireEvent.press(screen.getByTestId('review-card-front'));
    fireEvent.press(screen.getByTestId('review-rating-good'));
    expect(screen.getByTestId('review-screen-summary')).toBeTruthy();
    expect(screen.getByTestId('review-session-summary')).toBeTruthy();
    expect(screen.getByTestId('review-summary-heading')).toHaveTextContent('Session summary');
    // Reviewed count
    expect(screen.getByTestId('review-summary-stat-reviewed')).toHaveTextContent('1');
    // Rating breakdown: good=1, rest=0
    expect(screen.getByTestId('review-summary-good-count')).toHaveTextContent('1');
    expect(screen.getByTestId('review-summary-again-count')).toHaveTextContent('0');
  });

  it('session summary with two cards: correct breakdown', () => {
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeQueue([CARD_1, CARD_2]),
      error: null,
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);

    // Card 1: Again
    fireEvent.press(screen.getByTestId('review-card-front'));
    fireEvent.press(screen.getByTestId('review-rating-again'));
    // Card 2: Easy
    fireEvent.press(screen.getByTestId('review-card-front'));
    fireEvent.press(screen.getByTestId('review-rating-easy'));

    expect(screen.getByTestId('review-summary-stat-reviewed')).toHaveTextContent('2');
    expect(screen.getByTestId('review-summary-again-count')).toHaveTextContent('1');
    expect(screen.getByTestId('review-summary-easy-count')).toHaveTextContent('1');
    expect(screen.getByTestId('review-summary-good-count')).toHaveTextContent('0');
  });

  it('fires session_completed analytics', () => {
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeQueue([CARD_1]),
      error: null,
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);
    fireEvent.press(screen.getByTestId('review-card-front'));
    fireEvent.press(screen.getByTestId('review-rating-easy'));
    expect(mockTrack).toHaveBeenCalledWith(
      'review_session_completed',
      expect.objectContaining({ deck_id: 'deck-abc', cards_reviewed: 1 }),
    );
  });

  it('close/abandon fires session_abandoned analytics and pops router', () => {
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeQueue(),
      error: null,
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);
    fireEvent.press(screen.getByTestId('review-close-btn'));
    expect(mockTrack).toHaveBeenCalledWith('review_session_abandoned', { deck_id: 'deck-abc' });
    expect(mockBack).toHaveBeenCalled();
  });

  it('"Back to deck" button on summary calls router.back()', () => {
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeQueue([CARD_1]),
      error: null,
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);
    fireEvent.press(screen.getByTestId('review-card-front'));
    fireEvent.press(screen.getByTestId('review-rating-good'));
    fireEvent.press(screen.getByTestId('review-summary-back-btn'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('"Study more" on summary refetches queue', () => {
    const mockRefetch = jest.fn();
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeQueue([CARD_1]),
      error: null,
      refetch: mockRefetch,
    });
    render(<ReviewScreen />);
    fireEvent.press(screen.getByTestId('review-card-front'));
    fireEvent.press(screen.getByTestId('review-rating-good'));
    fireEvent.press(screen.getByTestId('review-summary-study-more-btn'));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('back-to-deck on all-caught-up calls router.back()', () => {
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeQueue([]),
      error: null,
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);
    fireEvent.press(screen.getByTestId('review-caught-up-back-btn'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('error retry calls refetch', () => {
    const mockRefetch = jest.fn();
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      error: new Error('oops'),
      refetch: mockRefetch,
    });
    render(<ReviewScreen />);
    fireEvent.press(screen.getByTestId('review-error-retry'));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('progress bar shows correct position', () => {
    mockUseStudyQueue.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeQueue([CARD_1, CARD_2]),
      error: null,
      refetch: jest.fn(),
    });
    render(<ReviewScreen />);
    // Card 1 of 2 shown
    expect(screen.getByTestId('review-card-counter')).toHaveTextContent('Card 1 of 2');
  });
});
