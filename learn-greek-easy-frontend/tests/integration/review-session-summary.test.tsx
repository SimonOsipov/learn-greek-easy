/**
 * Session Summary and Analytics Integration Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import { FlashcardReviewPage } from '@/pages/FlashcardReviewPage';
import { useReviewStore } from '@/stores/reviewStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
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

// Helper function to get rating label
function getRatingLabel(rating: number): string {
  const labels = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
  return labels[rating as keyof typeof labels];
}

describe('Session Summary and Analytics', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    mockNavigate.mockClear();
    vi.clearAllMocks();

    await useAuthStore.getState().login('demo@learngreekeasy.com', 'Demo123!');
    await useDeckStore.getState().fetchDecks();
    useReviewStore.getState().resetSession();

    mockParams.deckId = 'deck-a1-basics';
  });

  afterEach(() => {
    // Clean up all session/review data
    localStorage.removeItem('learn-greek-easy:review-data');
    sessionStorage.removeItem('learn-greek-easy:active-session');
    // Reset deck ID after each test
    mockParams.deckId = 'deck-a1-basics';
  });

  it('should display session statistics in summary', async () => {
    const user = userEvent.setup();

    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { activeSession } = useReviewStore.getState();
      expect(activeSession).toBeTruthy();
    }, { timeout: 5000 });

    // Complete 5 cards
    for (let i = 0; i < 5; i++) {
      await waitFor(() => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      });

      // Flip card
      await user.keyboard(' ');

      await waitFor(() => {
        expect(useReviewStore.getState().isCardFlipped).toBe(true);
      });

      // Rate card as "Good"
      await user.keyboard('3');

      // Wait for processing (but not on last card as session ends)
      if (i < 4) {
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

    // Verify summary stats
    const { sessionSummary } = useReviewStore.getState();
    expect(sessionSummary?.cardsReviewed).toBe(5);
  });

  it('should calculate accuracy correctly', async () => {
    const user = userEvent.setup();

    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { activeSession } = useReviewStore.getState();
      expect(activeSession).toBeTruthy();
    }, { timeout: 5000 });

    // Rate 4 as "Good" (pass), 1 as "Again" (fail) = 80% accuracy
    const ratings = ['3', '3', '3', '3', '1']; // 4 good, 1 again

    for (let i = 0; i < 5; i++) {
      await waitFor(() => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      });

      // Flip card
      await user.keyboard(' ');

      await waitFor(() => {
        expect(useReviewStore.getState().isCardFlipped).toBe(true);
      });

      // Rate with keyboard
      await user.keyboard(ratings[i]);

      // Wait for processing (but not on last card)
      if (i < 4) {
        await waitFor(() => {
          expect(useReviewStore.getState().isCardFlipped).toBe(false);
        });
      }
    }

    // Check summary accuracy
    await waitFor(() => {
      const { sessionSummary } = useReviewStore.getState();
      expect(sessionSummary).toBeTruthy();
    }, { timeout: 3000 });

    const { sessionSummary } = useReviewStore.getState();

    // Accuracy should be 80% (4 correct out of 5)
    expect(sessionSummary?.accuracy).toBe(80);
  });

  it('should update analytics store after session', async () => {
    const user = userEvent.setup();

    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { activeSession } = useReviewStore.getState();
      expect(activeSession).toBeTruthy();
    }, { timeout: 5000 });

    // Get initial analytics state
    const initialStats = useAnalyticsStore.getState().stats;

    // Complete 3 cards
    for (let i = 0; i < 3; i++) {
      await waitFor(() => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      });

      await user.keyboard(' '); // Flip

      await waitFor(() => {
        expect(useReviewStore.getState().isCardFlipped).toBe(true);
      });

      await user.keyboard('3'); // Rate Good

      if (i < 2) {
        await waitFor(() => {
          expect(useReviewStore.getState().isCardFlipped).toBe(false);
        });
      }
    }

    // Wait for session to end
    await waitFor(() => {
      const { sessionSummary } = useReviewStore.getState();
      expect(sessionSummary).toBeTruthy();
    }, { timeout: 3000 });

    // Analytics should be updated
    await waitFor(() => {
      const stats = useAnalyticsStore.getState().stats;
      // Stats should reflect the completed session
      expect(stats).toBeTruthy();
    });
  });

  it('should allow user to return to dashboard from summary', async () => {
    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { activeSession } = useReviewStore.getState();
      expect(activeSession).toBeTruthy();
    }, { timeout: 5000 });

    // Manually end session for faster test
    await useReviewStore.getState().endSession();

    // Should navigate to summary page
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/summary/));
    }, { timeout: 2000 });

    // Verify sessionSummary is set
    const { sessionSummary } = useReviewStore.getState();
    expect(sessionSummary).toBeTruthy();
  });

  it('should show time spent on session', async () => {
    const user = userEvent.setup();

    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { activeSession } = useReviewStore.getState();
      expect(activeSession).toBeTruthy();
    }, { timeout: 5000 });

    // Complete 3 cards
    for (let i = 0; i < 3; i++) {
      await waitFor(() => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      });

      await user.keyboard(' '); // Flip

      await waitFor(() => {
        expect(useReviewStore.getState().isCardFlipped).toBe(true);
      });

      await user.keyboard('3'); // Rate

      if (i < 2) {
        await waitFor(() => {
          expect(useReviewStore.getState().isCardFlipped).toBe(false);
        });
      }
    }

    // Wait for session to end and summary to be generated
    await waitFor(() => {
      const { sessionSummary } = useReviewStore.getState();
      expect(sessionSummary).toBeTruthy();
    }, { timeout: 3000 });

    // Summary should have duration data
    const { sessionSummary } = useReviewStore.getState();
    expect(sessionSummary?.totalTime).toBeGreaterThanOrEqual(0);
  });
});
