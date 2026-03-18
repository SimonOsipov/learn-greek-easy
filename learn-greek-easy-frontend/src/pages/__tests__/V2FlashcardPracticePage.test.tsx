/**
 * V2FlashcardPracticePage Tests
 *
 * Covers loading, empty, error, and summary states.
 * The active card state is exercised via store mocking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { render, screen } from '@/lib/test-utils';

import { V2FlashcardPracticePage } from '../V2FlashcardPracticePage';

// ============================================
// Mocks
// ============================================

const mockNavigate = vi.fn();
const mockStartSession = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ deckId: 'deck-123' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
}));

vi.mock('@/stores/xpStore', () => ({
  useXPStore: Object.assign(
    vi.fn(() => ({})),
    {
      getState: () => ({ loadXPStats: vi.fn().mockResolvedValue(undefined) }),
    }
  ),
}));

// Default store state
const defaultStoreState = {
  queue: [],
  currentIndex: 0,
  isFlipped: false,
  isLoading: false,
  error: null,
  sessionId: null,
  sessionStats: {
    cardsReviewed: 0,
    againCount: 0,
    hardCount: 0,
    goodCount: 0,
    easyCount: 0,
    newStarted: 0,
    cardsMastered: 0,
    cardsRelearning: 0,
  },
  sessionSummary: null,
  startSession: mockStartSession,
  rateCard: vi.fn(),
  flipCard: vi.fn(),
  endSession: vi.fn(),
  resetSession: vi.fn(),
  clearError: vi.fn(),
  clearSessionSummary: vi.fn(),
};

let mockStoreState = { ...defaultStoreState };

vi.mock('@/stores/v2PracticeStore', () => ({
  useV2PracticeStore: () => mockStoreState,
  v2QueueCardToCardRecord: vi.fn((card) => ({
    id: card.card_record_id,
    word_entry_id: card.word_entry_id,
    deck_id: card.deck_id,
    card_type: card.card_type,
    variant_key: card.variant_key ?? '',
    front_content: card.front_content,
    back_content: card.back_content,
    is_active: true,
    tier: null,
    created_at: '',
    updated_at: '',
  })),
  resolveV2CardAudioUrl: vi.fn(() => null),
}));

vi.mock('@/hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({
    isPlaying: false,
    isLoading: false,
    error: null,
    play: vi.fn(),
    pause: vi.fn(),
    toggle: vi.fn(),
    speed: 1,
    setSpeed: vi.fn(),
  }),
}));

// ============================================
// Tests
// ============================================

describe('V2FlashcardPracticePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSession.mockResolvedValue(undefined);
    mockStoreState = { ...defaultStoreState, startSession: mockStartSession };
  });

  it('renders loading skeleton during queue fetch', () => {
    mockStoreState = { ...mockStoreState, isLoading: true };
    render(<V2FlashcardPracticePage />);

    // Should render a skeleton element with animate-pulse class (no card content visible)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
    // No progress text should be shown
    expect(screen.queryByText(/of/i)).not.toBeInTheDocument();
  });

  it('renders empty state when queue has 0 cards', () => {
    mockStoreState = {
      ...mockStoreState,
      isLoading: false,
      queue: [],
      sessionSummary: null,
      error: null,
    };
    render(<V2FlashcardPracticePage />);

    // "All Caught Up!" heading should be visible
    expect(screen.getByText('All Caught Up!')).toBeInTheDocument();
    // Multiple "Back to Deck" buttons may render; at least one should exist
    expect(screen.getAllByRole('button', { name: /Back to Deck/i }).length).toBeGreaterThan(0);
  });

  it('renders error state with retry button on fetch failure', () => {
    mockStoreState = {
      ...mockStoreState,
      isLoading: false,
      error: 'Failed to load cards',
      queue: [],
    };
    render(<V2FlashcardPracticePage />);

    expect(screen.getByText('Failed to load cards')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Back to Deck/i }).length).toBeGreaterThan(0);
  });

  it('renders inline summary after last card', () => {
    mockStoreState = {
      ...mockStoreState,
      isLoading: false,
      error: null,
      sessionSummary: {
        sessionId: 'sess-123',
        deckId: 'deck-123',
        cardsReviewed: 10,
        totalTimeSeconds: 225,
        avgTimePerCard: 22,
        ratingBreakdown: { again: 1, hard: 2, good: 5, easy: 2 },
        newStarted: 3,
        cardsMastered: 2,
      },
      sessionStats: {
        cardsReviewed: 10,
        againCount: 1,
        hardCount: 2,
        goodCount: 5,
        easyCount: 2,
        newStarted: 3,
        cardsMastered: 2,
        cardsRelearning: 0,
      },
    };
    render(<V2FlashcardPracticePage />);

    expect(screen.getByText('Session Complete')).toBeInTheDocument();
    expect(screen.getByText('3:45')).toBeInTheDocument(); // duration formatted
    expect(screen.getByRole('button', { name: /Study More/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Back to Deck/i }).length).toBeGreaterThan(0);
  });
});
