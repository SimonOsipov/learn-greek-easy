/**
 * WordPracticePage Component Tests
 *
 * Tests for PRAC-08: WordPracticePage + Route Registration
 * Covers:
 * - Loading, Error, Empty, and Ready rendering states
 * - Back navigation link URL in all states
 * - "Next card" button visibility based on cards count
 * - "Next card" changes displayed card and resets isFlipped
 * - Retry button triggers refetch in error state
 * - PracticeCard receives correct props (card, isFlipped, onFlip)
 * - Bounds guard on currentIndex when cards array shrinks
 * - data-testid attributes present as expected
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { CardRecordResponse } from '@/services/wordEntryAPI';

// ============================================
// Mocks
// ============================================

// Mock react-router-dom
const mockUseParams = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    useParams: () => mockUseParams(),
    Link: ({
      children,
      to,
      ...props
    }: {
      children: React.ReactNode;
      to: string;
      [key: string]: unknown;
    }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

// Mock hooks
const mockUseWordEntryCards = vi.fn();
const mockUseWordEntry = vi.fn();
vi.mock('../../hooks', () => ({
  useWordEntryCards: (opts: unknown) => mockUseWordEntryCards(opts),
  useWordEntry: (opts: unknown) => mockUseWordEntry(opts),
}));

// Mock PracticeCard component to inspect props
const mockPracticeCard = vi.fn();
vi.mock('../../components', () => ({
  PracticeCard: (props: Record<string, unknown>) => {
    mockPracticeCard(props);
    return (
      <div data-testid="mock-practice-card" data-card-id={(props.card as CardRecordResponse)?.id}>
        {props.isFlipped ? 'FLIPPED' : 'NOT_FLIPPED'}
        <button data-testid="mock-flip-trigger" onClick={props.onFlip as () => void}>
          Flip
        </button>
      </div>
    );
  },
}));

// Import component after mocks are set up
import { WordPracticePage } from '../WordPracticePage';

// ============================================
// Test Data Factory
// ============================================

function makeCard(overrides: Partial<CardRecordResponse> = {}): CardRecordResponse {
  return {
    id: 'card-1',
    word_entry_id: 'word-1',
    deck_id: 'deck-1',
    card_type: 'meaning_el_to_en' as CardRecordResponse['card_type'],
    tier: null,
    front_content: {
      card_type: 'meaning_el_to_en',
      prompt: 'What does this word mean?',
      main: 'test-front',
      sub: null,
      badge: null,
      hint: null,
    },
    back_content: {
      card_type: 'meaning_el_to_en',
      answer: 'test-back',
      answer_sub: null,
      context: null,
    },
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeCards(count: number): CardRecordResponse[] {
  return Array.from({ length: count }, (_, i) =>
    makeCard({
      id: `card-${i + 1}`,
      front_content: {
        card_type: 'meaning_el_to_en',
        prompt: 'What does this word mean?',
        main: `front-${i + 1}`,
        sub: null,
        badge: null,
        hint: null,
      },
      back_content: {
        card_type: 'meaning_el_to_en',
        answer: `back-${i + 1}`,
        answer_sub: null,
        context: null,
      },
    })
  );
}

// ============================================
// Setup
// ============================================

beforeEach(() => {
  mockUseParams.mockReturnValue({ deckId: 'test-deck-id', wordId: 'test-word-id' });
  mockPracticeCard.mockClear();
  mockUseWordEntry.mockClear();
  mockUseWordEntry.mockReturnValue({
    wordEntry: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================
// Tests
// ============================================

describe('WordPracticePage', () => {
  describe('Rendering States', () => {
    it('renders skeleton loading state when isLoading is true', () => {
      mockUseWordEntryCards.mockReturnValue({
        cards: [],
        isLoading: true,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      // Should not have main practice page testid
      expect(screen.queryByTestId('practice-page')).not.toBeInTheDocument();
      // PracticeCard should not be rendered
      expect(mockPracticeCard).not.toHaveBeenCalled();
    });

    it('renders error state when isError is true', () => {
      mockUseWordEntryCards.mockReturnValue({
        cards: [],
        isLoading: false,
        isError: true,
        error: new Error('Network error'),
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      // Error alert should be visible
      expect(screen.getByText('Practice')).toBeInTheDocument();
      expect(
        screen.getByText('Failed to load practice cards. Please try again.')
      ).toBeInTheDocument();
      // Retry button should be visible
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('renders empty state when cards array is empty', () => {
      mockUseWordEntryCards.mockReturnValue({
        cards: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      expect(
        screen.getByText('No practice cards available for this word yet.')
      ).toBeInTheDocument();
      // PracticeCard should not be rendered
      expect(mockPracticeCard).not.toHaveBeenCalled();
    });

    it('renders ready state with PracticeCard when cards exist', () => {
      const cards = makeCards(3);
      mockUseWordEntryCards.mockReturnValue({
        cards,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      // Practice page testid should be present
      expect(screen.getByTestId('practice-page')).toBeInTheDocument();
      // PracticeCard should be rendered with correct props
      expect(mockPracticeCard).toHaveBeenCalledWith(
        expect.objectContaining({
          card: cards[0],
          isFlipped: false,
        })
      );
      // onFlip should be a function
      expect(typeof mockPracticeCard.mock.calls[0][0].onFlip).toBe('function');
    });
  });

  describe('Back Navigation', () => {
    it('renders back link pointing to word reference page in ready state', () => {
      mockUseWordEntryCards.mockReturnValue({
        cards: makeCards(1),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      const backButton = screen.getByTestId('practice-close-button');
      // The Button renders as a Link (via asChild), which we mock as an anchor
      const link = backButton.closest('a') ?? backButton.querySelector('a');
      expect(link).not.toBeNull();
      expect(link!.getAttribute('href')).toBe('/decks/test-deck-id/words/test-word-id');
    });

    it('renders back link in error state', () => {
      mockUseWordEntryCards.mockReturnValue({
        cards: [],
        isLoading: false,
        isError: true,
        error: new Error('fail'),
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      const backButton = screen.getByTestId('practice-close-button');
      const link = backButton.closest('a') ?? backButton.querySelector('a');
      expect(link).not.toBeNull();
      expect(link!.getAttribute('href')).toBe('/decks/test-deck-id/words/test-word-id');
    });

    it('renders back link in empty state', () => {
      mockUseWordEntryCards.mockReturnValue({
        cards: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      const backButton = screen.getByTestId('practice-close-button');
      const link = backButton.closest('a') ?? backButton.querySelector('a');
      expect(link).not.toBeNull();
      expect(link!.getAttribute('href')).toBe('/decks/test-deck-id/words/test-word-id');
    });

    it('back link displays "Go Back" text', () => {
      mockUseWordEntryCards.mockReturnValue({
        cards: makeCards(1),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      const backButton = screen.getByTestId('practice-close-button');
      expect(backButton).toHaveTextContent('Go Back');
    });
  });

  describe('Next Card Button', () => {
    it('shows "Next card" button when cards.length > 1', () => {
      mockUseWordEntryCards.mockReturnValue({
        cards: makeCards(3),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      expect(screen.getByTestId('practice-next-button')).toBeInTheDocument();
      expect(screen.getByText('Next card')).toBeInTheDocument();
    });

    it('hides "Next card" button when cards.length === 1', () => {
      mockUseWordEntryCards.mockReturnValue({
        cards: makeCards(1),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      expect(screen.queryByTestId('practice-next-button')).not.toBeInTheDocument();
    });

    it('clicking "Next card" changes displayed card to a different one', () => {
      const cards = makeCards(2);
      mockUseWordEntryCards.mockReturnValue({
        cards,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      // Initially shows first card
      const initialCard = screen.getByTestId('mock-practice-card');
      expect(initialCard.getAttribute('data-card-id')).toBe('card-1');

      // Click "Next card"
      fireEvent.click(screen.getByTestId('practice-next-button'));

      // With exactly 2 cards, it must switch to the other card
      const updatedCard = screen.getByTestId('mock-practice-card');
      expect(updatedCard.getAttribute('data-card-id')).toBe('card-2');
    });

    it('clicking "Next card" resets isFlipped to false', () => {
      const cards = makeCards(2);
      mockUseWordEntryCards.mockReturnValue({
        cards,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      // Flip the card first
      fireEvent.click(screen.getByTestId('mock-flip-trigger'));

      // The mock PracticeCard should have been called with isFlipped: true
      const callsAfterFlip = mockPracticeCard.mock.calls;
      const lastCallBeforeNext = callsAfterFlip[callsAfterFlip.length - 1][0];
      expect(lastCallBeforeNext.isFlipped).toBe(true);

      // Click "Next card"
      fireEvent.click(screen.getByTestId('practice-next-button'));

      // After next card, isFlipped should be false
      const callsAfterNext = mockPracticeCard.mock.calls;
      const lastCallAfterNext = callsAfterNext[callsAfterNext.length - 1][0];
      expect(lastCallAfterNext.isFlipped).toBe(false);
    });
  });

  describe('Retry Button', () => {
    it('clicking retry calls refetch', () => {
      const mockRefetch = vi.fn();
      mockUseWordEntryCards.mockReturnValue({
        cards: [],
        isLoading: false,
        isError: true,
        error: new Error('fail'),
        refetch: mockRefetch,
      });

      render(<WordPracticePage />);

      fireEvent.click(screen.getByText('Retry'));
      expect(mockRefetch).toHaveBeenCalledOnce();
    });
  });

  describe('Hook Parameters', () => {
    it('passes wordEntryId (not wordId) to useWordEntryCards', () => {
      mockUseWordEntryCards.mockReturnValue({
        cards: [],
        isLoading: true,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      expect(mockUseWordEntryCards).toHaveBeenCalledWith({
        wordEntryId: 'test-word-id',
        enabled: true,
      });
    });

    it('passes enabled: false when wordId is missing', () => {
      mockUseParams.mockReturnValue({ deckId: 'test-deck-id', wordId: undefined });

      mockUseWordEntryCards.mockReturnValue({
        cards: [],
        isLoading: true,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      expect(mockUseWordEntryCards).toHaveBeenCalledWith({
        wordEntryId: '',
        enabled: false,
      });
    });
  });

  describe('Bounds Guard', () => {
    it('clamps currentIndex when cards array shrinks below current index', () => {
      // Start with 5 cards
      const cards5 = makeCards(5);
      const mockReturn = {
        cards: cards5,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      };
      mockUseWordEntryCards.mockReturnValue(mockReturn);

      const { rerender } = render(<WordPracticePage />);

      // Navigate through cards to increase currentIndex
      // With 5 cards, click next several times to move away from index 0
      for (let i = 0; i < 10; i++) {
        fireEvent.click(screen.getByTestId('practice-next-button'));
      }

      // Now shrink cards to 2 — the component should guard with Math.min
      const cards2 = makeCards(2);
      mockUseWordEntryCards.mockReturnValue({
        ...mockReturn,
        cards: cards2,
      });

      rerender(<WordPracticePage />);

      // Should not crash and should display a valid card
      const practiceCard = screen.getByTestId('mock-practice-card');
      const displayedId = practiceCard.getAttribute('data-card-id');
      // The displayed card should be either card-1 or card-2 (valid indices for 2-card array)
      expect(['card-1', 'card-2']).toContain(displayedId);
    });
  });

  describe('Keyboard Navigation', () => {
    it('pressing Space reveals card when not flipped', () => {
      const cards = makeCards(2);
      mockUseWordEntryCards.mockReturnValue({
        cards,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      // Card should start not flipped
      expect(screen.getByText('NOT_FLIPPED')).toBeInTheDocument();

      // Press Space
      fireEvent.keyDown(window, { key: ' ', code: 'Space' });

      // Card should now be flipped
      const calls = mockPracticeCard.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.isFlipped).toBe(true);
    });

    it('pressing Space advances to next card when already flipped', () => {
      const cards = makeCards(2);
      mockUseWordEntryCards.mockReturnValue({
        cards,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      // Flip the card first
      fireEvent.click(screen.getByTestId('mock-flip-trigger'));
      expect(screen.getByText('FLIPPED')).toBeInTheDocument();

      // Press Space to advance
      fireEvent.keyDown(window, { key: ' ', code: 'Space' });

      // Should have moved to next card (unflipped)
      const calls = mockPracticeCard.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.isFlipped).toBe(false);
    });

    it('keys 1-4 trigger rating when card is flipped', () => {
      const cards = makeCards(2);
      mockUseWordEntryCards.mockReturnValue({
        cards,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      // Flip card first
      fireEvent.click(screen.getByTestId('mock-flip-trigger'));

      // Press '1' -- should rate and advance
      fireEvent.keyDown(window, { key: '1' });

      const calls = mockPracticeCard.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      // After rating, card should advance (isFlipped resets)
      expect(lastCall.isFlipped).toBe(false);
    });

    it('keys 1-4 do nothing when card is not flipped', () => {
      mockUseWordEntryCards.mockReturnValue({
        cards: makeCards(2),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      const callCountBefore = mockPracticeCard.mock.calls.length;

      // Press '1' while not flipped -- should do nothing
      fireEvent.keyDown(window, { key: '1' });

      // No additional render should happen (or same state)
      const calls = mockPracticeCard.mock.calls;
      if (calls.length > callCountBefore) {
        const lastCall = calls[calls.length - 1][0];
        expect(lastCall.isFlipped).toBe(false);
        expect(lastCall.card.id).toBe('card-1'); // same card
      }
    });

    it('passes onRate prop to PracticeCard', () => {
      mockUseWordEntryCards.mockReturnValue({
        cards: makeCards(1),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      const calls = mockPracticeCard.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(typeof lastCall.onRate).toBe('function');
    });
  });

  describe('data-testid Attributes', () => {
    it('has practice-page testid on ready state container', () => {
      mockUseWordEntryCards.mockReturnValue({
        cards: makeCards(1),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      expect(screen.getByTestId('practice-page')).toBeInTheDocument();
    });

    it('has practice-close-button testid on back button in ready state', () => {
      mockUseWordEntryCards.mockReturnValue({
        cards: makeCards(1),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      expect(screen.getByTestId('practice-close-button')).toBeInTheDocument();
    });

    it('has practice-next-button testid on next card button', () => {
      mockUseWordEntryCards.mockReturnValue({
        cards: makeCards(2),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<WordPracticePage />);

      expect(screen.getByTestId('practice-next-button')).toBeInTheDocument();
    });
  });
});
