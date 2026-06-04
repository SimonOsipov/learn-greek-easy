/**
 * V2FlashcardPracticePage Tests
 *
 * Covers loading, empty, error, and summary states.
 * The active card state is exercised via store mocking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { render, screen, act } from '@/lib/test-utils';

import { V2FlashcardPracticePage } from '../V2FlashcardPracticePage';

// ============================================
// Mocks
// ============================================

const mockNavigate = vi.fn();
const mockStartSession = vi.fn();
const mockInvalidateQueries = vi.fn();
let mockParams: Record<string, string> = { deckId: 'deck-123' };

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
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

// Mock useDeck to avoid QueryClientProvider requirement (PRACT2-1-02)
vi.mock('@/hooks/useDeck', () => ({
  useDeck: () => ({
    deck: { name: 'Test Deck', name_en: 'Test Deck' },
    isLoading: false,
    isError: false,
  }),
}));

// Default store state (uses `cards` — renamed from `queue` in PRACT2-1-02)
const defaultStoreState = {
  cards: [],
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
  wordEntryId: null,
  totalNew: 0,
  totalReview: 0,
  streak: 0,
  ratings: [],
  leaveDirection: null,
  toast: null,
  inputMode: 'reveal' as const,
  startSession: mockStartSession,
  rateCard: vi.fn(),
  flipCard: vi.fn(),
  endSession: vi.fn(),
  resetSession: vi.fn(),
  clearError: vi.fn(),
  clearSessionSummary: vi.fn(),
  clearLeaveDirection: vi.fn(),
  clearToast: vi.fn(),
  setInputMode: vi.fn(),
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
    mockParams = { deckId: 'deck-123' };
    mockStartSession.mockResolvedValue(undefined);
    mockInvalidateQueries.mockResolvedValue(undefined);
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
      cards: [],
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
      cards: [],
    };
    render(<V2FlashcardPracticePage />);

    expect(screen.getByText('Failed to load cards')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Back to Deck/i }).length).toBeGreaterThan(0);
  });

  it('renders Done screen after last card', () => {
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

    // Done component heading (Inter Tight, lowercase 'c')
    expect(screen.getByText('Session complete')).toBeInTheDocument();
    // Cards reviewed count from cardsReviewed
    expect(screen.getByTestId('pf-done-cards-reviewed')).toHaveTextContent('10 cards reviewed');
    // 4-up tally cells
    expect(screen.getByTestId('pf-done-tally-forgot')).toHaveTextContent('1');
    expect(screen.getByTestId('pf-done-tally-tough')).toHaveTextContent('2');
    expect(screen.getByTestId('pf-done-tally-ok')).toHaveTextContent('5');
    expect(screen.getByTestId('pf-done-tally-easy')).toHaveTextContent('2');
    // Practice again button (replaces Study More)
    expect(screen.getByTestId('pf-done-practice-again')).toBeInTheDocument();
    // Back to deck button
    expect(screen.getByTestId('pf-done-back-to-deck')).toBeInTheDocument();
  });

  it('word-scoped mode calls startSession with wordId', () => {
    mockParams = { deckId: 'deck-123', wordId: 'word-456' };
    render(<V2FlashcardPracticePage />);

    expect(mockStartSession).toHaveBeenCalledWith('deck-123', undefined, 'word-456');
  });

  it('back navigation goes to word detail page when wordId present', () => {
    mockParams = { deckId: 'deck-123', wordId: 'word-456' };
    mockStoreState = {
      ...mockStoreState,
      isLoading: false,
      cards: [],
      sessionSummary: null,
      error: null,
    };
    render(<V2FlashcardPracticePage />);

    const backButtons = screen.getAllByRole('button', { name: /Back to Deck/i });
    backButtons[0].click();

    expect(mockNavigate).toHaveBeenCalledWith('/decks/deck-123/words/word-456');
  });

  // ── .pf-foot-hint coverage (PRACT2-3-03, AC#2) ──────────────────────────────

  it('renders .pf-foot-hint with keycaps in the shared foot (non-declension card)', () => {
    const card = {
      card_record_id: 'cr-1',
      word_entry_id: 'we-1',
      deck_id: 'deck-123',
      deck_name: 'Test Deck',
      card_type: 'meaning_el_to_en' as const,
      variant_key: null,
      front_content: { main: 'νερό', sub: null, prompt: null, badge: null },
      back_content: { main: 'water', gender: null, gender_ru: null },
      status: 'due' as const,
      is_new: false,
      is_early_practice: false,
      due_date: null,
      easiness_factor: null,
      interval: null,
      audio_url: null,
      example_audio_url: null,
      translation_ru: null,
      translation_ru_plural: null,
      sentence_ru: null,
    };
    mockStoreState = {
      ...mockStoreState,
      isLoading: false,
      error: null,
      sessionSummary: null,
      sessionId: 'sess-1',
      cards: [card],
      currentIndex: 0,
    };

    const { container } = render(<V2FlashcardPracticePage />);

    const hint = container.querySelector('.pf-foot-hint');
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toContain('Press');
    expect(hint?.textContent).toContain('to rate');
    const keycaps = hint?.querySelectorAll('.pf-kbd');
    expect(keycaps?.length).toBe(2);
    expect(keycaps?.[0]?.textContent).toBe('1');
    expect(keycaps?.[1]?.textContent).toBe('4');
  });

  it('renders .pf-foot-hint with keycaps in the declension foot', () => {
    const card = {
      card_record_id: 'cr-2',
      word_entry_id: 'we-2',
      deck_id: 'deck-123',
      deck_name: 'Test Deck',
      card_type: 'declension' as const,
      variant_key: null,
      front_content: { hint: 'man' },
      back_content: {
        declension_table: {
          gender: 'Masculine',
          rows: [
            {
              case: 'Nominative',
              singular: 'άντρας',
              plural: 'άντρες',
              highlight_singular: false,
              highlight_plural: false,
            },
            {
              case: 'Genitive',
              singular: 'άντρα',
              plural: 'αντρών',
              highlight_singular: true,
              highlight_plural: false,
            },
            {
              case: 'Accusative',
              singular: 'άντρα',
              plural: 'άντρες',
              highlight_singular: false,
              highlight_plural: false,
            },
            {
              case: 'Vocative',
              singular: 'άντρα',
              plural: 'άντρες',
              highlight_singular: false,
              highlight_plural: false,
            },
          ],
        },
      },
      status: 'due' as const,
      is_new: false,
      is_early_practice: false,
      due_date: null,
      easiness_factor: null,
      interval: null,
      audio_url: null,
      example_audio_url: null,
      translation_ru: null,
      translation_ru_plural: null,
      sentence_ru: null,
    };
    mockStoreState = {
      ...mockStoreState,
      isLoading: false,
      error: null,
      sessionSummary: null,
      sessionId: 'sess-1',
      cards: [card],
      currentIndex: 0,
    };

    const { container } = render(<V2FlashcardPracticePage />);

    const hint = container.querySelector('.pf-foot-hint');
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toContain('Press');
    expect(hint?.textContent).toContain('to rate');
    const keycaps = hint?.querySelectorAll('.pf-kbd');
    expect(keycaps?.length).toBe(2);
    expect(keycaps?.[0]?.textContent).toBe('1');
    expect(keycaps?.[1]?.textContent).toBe('4');
  });

  it('invalidates analytics cache exactly once when sessionSummary becomes populated', async () => {
    // Start with no sessionSummary
    mockStoreState = { ...defaultStoreState, startSession: mockStartSession, sessionSummary: null };
    const { rerender } = render(<V2FlashcardPracticePage />);

    expect(mockInvalidateQueries).not.toHaveBeenCalled();

    // Simulate session completion — sessionSummary transitions from null to populated
    await act(async () => {
      mockStoreState = {
        ...mockStoreState,
        sessionSummary: {
          sessionId: 'sess-123',
          deckId: 'deck-123',
          cardsReviewed: 5,
          totalTimeSeconds: 120,
          avgTimePerCard: 24,
          ratingBreakdown: { again: 0, hard: 1, good: 3, easy: 1 },
          newStarted: 2,
          cardsMastered: 1,
        },
      };
      rerender(<V2FlashcardPracticePage />);
    });

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['analytics'] });
  });
});
