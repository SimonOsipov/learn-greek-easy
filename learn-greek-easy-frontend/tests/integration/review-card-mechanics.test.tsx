/**
 * Card Review Mechanics Tests
 * Tests card flipping, rating, and transitions
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import { FlashcardReviewPage } from '@/pages/FlashcardReviewPage';
import { useReviewStore } from '@/stores/reviewStore';
import { useAuthStore } from '@/stores/authStore';
import { useDeckStore } from '@/stores/deckStore';

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockParams = { deckId: 'deck-a1-basics' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useLocation: () => ({ state: null, pathname: '/review', key: 'test-key' }),
  };
});

describe('Card Review Mechanics', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    mockNavigate.mockClear();
    vi.clearAllMocks();

    // Reset to valid deck ID FIRST
    mockParams.deckId = 'deck-a1-basics';

    // Setup authenticated user and decks
    await useAuthStore.getState().login('demo@learngreekeasy.com', 'Demo123!');
    await useDeckStore.getState().fetchDecks();
    useReviewStore.getState().resetSession();
  });

  afterEach(() => {
    // Clean up all session/review data
    localStorage.removeItem('learn-greek-easy:review-data');
    sessionStorage.removeItem('learn-greek-easy:active-session');
    // Reset deck ID after each test
    mockParams.deckId = 'deck-a1-basics';
  });

  it('should flip card when "Show Answer" button clicked', async () => {
    const user = userEvent.setup();

    render(<FlashcardReviewPage />);

    // Wait for card to load
    await waitFor(() => {
      const { currentCard } = useReviewStore.getState();
      expect(currentCard).toBeTruthy();
    }, { timeout: 5000 });

    // Initially, card should not be flipped
    expect(useReviewStore.getState().isCardFlipped).toBe(false);

    // Click card to flip
    const cardArea = screen.getByRole('button', { name: /flip card/i });
    await user.click(cardArea);

    // Card should be flipped
    await waitFor(() => {
      expect(useReviewStore.getState().isCardFlipped).toBe(true);
    });

    // Answer should be visible
    const { currentCard } = useReviewStore.getState();
    if (currentCard?.translation) {
      expect(screen.getByText(currentCard.translation)).toBeVisible();
    }
  });

  it('should show rating buttons after flipping card', async () => {
    const user = userEvent.setup();

    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { currentCard } = useReviewStore.getState();
      expect(currentCard).toBeTruthy();
    }, { timeout: 5000 });

    // Rating buttons should be disabled before flip
    const againButton = screen.getByRole('button', { name: /rate card as again/i });
    expect(againButton).toBeDisabled();

    // Flip card
    const cardArea = screen.getByRole('button', { name: /flip card/i });
    await user.click(cardArea);

    await waitFor(() => {
      expect(useReviewStore.getState().isCardFlipped).toBe(true);
    });

    // Rating buttons should now be enabled
    await waitFor(() => {
      expect(againButton).not.toBeDisabled();
    });

    expect(screen.getByRole('button', { name: /rate card as hard/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /rate card as good/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /rate card as easy/i })).not.toBeDisabled();
  });

  it('should advance to next card after rating', async () => {
    const user = userEvent.setup();

    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { currentCard } = useReviewStore.getState();
      expect(currentCard).toBeTruthy();
    }, { timeout: 5000 });

    const firstCardId = useReviewStore.getState().currentCard?.id;
    const initialIndex = useReviewStore.getState().currentCardIndex;

    // Flip card
    const cardArea = screen.getByRole('button', { name: /flip card/i });
    await user.click(cardArea);

    await waitFor(() => {
      expect(useReviewStore.getState().isCardFlipped).toBe(true);
    });

    // Rate card as "Good"
    const goodButton = screen.getByRole('button', { name: /rate card as good/i });
    await user.click(goodButton);

    // Wait for next card to load
    await waitFor(() => {
      const { currentCardIndex, currentCard } = useReviewStore.getState();
      expect(currentCardIndex).toBe(initialIndex + 1);
      expect(currentCard?.id).not.toBe(firstCardId);
    });

    // Card should be unflipped for next card
    expect(useReviewStore.getState().isCardFlipped).toBe(false);

    // Card counter should increment (Card 2 of 10)
    const { activeSession, currentCardIndex } = useReviewStore.getState();
    const totalCards = activeSession?.cards.length || 0;
    const progressText = screen.getByText(new RegExp(`Card\\s+${currentCardIndex + 1}\\s+of\\s+${totalCards}`, 'i'));
    expect(progressText).toBeInTheDocument();
  });

  it('should record review quality in session', async () => {
    const user = userEvent.setup();

    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { currentCard } = useReviewStore.getState();
      expect(currentCard).toBeTruthy();
    }, { timeout: 5000 });

    // Flip and rate card
    const cardArea = screen.getByRole('button', { name: /flip card/i });
    await user.click(cardArea);

    await waitFor(() => {
      expect(useReviewStore.getState().isCardFlipped).toBe(true);
    });

    const goodButton = screen.getByRole('button', { name: /rate card as good/i });
    await user.click(goodButton);

    // Check review store stats
    await waitFor(() => {
      const { sessionStats } = useReviewStore.getState();
      expect(sessionStats.goodCount).toBe(1);
      expect(sessionStats.cardsReviewed).toBe(1);
    });
  });

  it('should show session summary after last card', async () => {
    const user = userEvent.setup();

    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { activeSession } = useReviewStore.getState();
      expect(activeSession).toBeTruthy();
    }, { timeout: 5000 });

    const totalCards = useReviewStore.getState().activeSession?.cards.length || 0;

    // Review all cards (limit to 3 for test speed)
    const cardsToReview = Math.min(totalCards, 3);

    for (let i = 0; i < cardsToReview; i++) {
      await waitFor(() => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      });

      // Flip card
      const cardArea = screen.getByRole('button', { name: /flip card/i });
      await user.click(cardArea);

      await waitFor(() => {
        expect(useReviewStore.getState().isCardFlipped).toBe(true);
      });

      // Rate card
      const goodButton = screen.getByRole('button', { name: /rate card as good/i });
      await user.click(goodButton);

      // Wait for rating to process (but not on last card)
      if (i < cardsToReview - 1) {
        await waitFor(() => {
          expect(useReviewStore.getState().isCardFlipped).toBe(false);
        });
      }
    }

    // Summary should be generated
    await waitFor(() => {
      const { sessionSummary } = useReviewStore.getState();
      expect(sessionSummary).toBeTruthy();
    }, { timeout: 3000 });

    // Should navigate to summary page
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/summary/));
    }, { timeout: 2000 });
  });

  it('should update session stats after each rating', async () => {
    const user = userEvent.setup();

    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { currentCard } = useReviewStore.getState();
      expect(currentCard).toBeTruthy();
    }, { timeout: 5000 });

    const initialStats = useReviewStore.getState().sessionStats;
    expect(initialStats.cardsReviewed).toBe(0);

    // Flip and rate card
    const cardArea = screen.getByRole('button', { name: /flip card/i });
    await user.click(cardArea);

    await waitFor(() => {
      expect(useReviewStore.getState().isCardFlipped).toBe(true);
    });

    const goodButton = screen.getByRole('button', { name: /rate card as good/i });
    await user.click(goodButton);

    // Stats should update
    await waitFor(() => {
      const { sessionStats } = useReviewStore.getState();
      expect(sessionStats.cardsReviewed).toBe(1);
      expect(sessionStats.goodCount).toBe(1);
      expect(sessionStats.cardsCorrect).toBe(1);
    });
  });
});
