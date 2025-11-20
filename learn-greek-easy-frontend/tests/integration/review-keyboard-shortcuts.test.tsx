/**
 * Keyboard Shortcuts Integration Tests
 * Tests Space, 1-4, and Esc key functionality
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

describe('Review Keyboard Shortcuts', () => {
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
  });

  it('should flip card with Space key', async () => {
    const user = userEvent.setup();

    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { currentCard } = useReviewStore.getState();
      expect(currentCard).toBeTruthy();
    }, { timeout: 5000 });

    expect(useReviewStore.getState().isCardFlipped).toBe(false);

    // Press Space
    await user.keyboard(' ');

    // Card should flip
    await waitFor(() => {
      expect(useReviewStore.getState().isCardFlipped).toBe(true);
    });

    // Answer should be visible
    const { currentCard } = useReviewStore.getState();
    if (currentCard?.translation) {
      expect(screen.getByText(currentCard.translation)).toBeVisible();
    }
  });

  it('should rate card with number keys (1-4)', async () => {
    const user = userEvent.setup();

    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { currentCard } = useReviewStore.getState();
      expect(currentCard).toBeTruthy();
    }, { timeout: 5000 });

    // Flip card first
    await user.keyboard(' ');

    await waitFor(() => {
      expect(useReviewStore.getState().isCardFlipped).toBe(true);
    });

    // Press "3" for "Good"
    await user.keyboard('3');

    // Should advance to next card
    await waitFor(() => {
      const { sessionStats } = useReviewStore.getState();
      expect(sessionStats.goodCount).toBe(1);
      expect(useReviewStore.getState().isCardFlipped).toBe(false);
    });
  });

  it('should test all rating shortcuts (1-4)', async () => {
    const user = userEvent.setup();

    const keyMappings = [
      { key: '1', expectedCount: 'againCount' },
      { key: '2', expectedCount: 'hardCount' },
      { key: '3', expectedCount: 'goodCount' },
      { key: '4', expectedCount: 'easyCount' },
    ] as const;

    for (const { key, expectedCount } of keyMappings) {
      // Re-render for each test to get a fresh session
      const { unmount } = render(<FlashcardReviewPage />);

      // Wait for card
      await waitFor(() => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      }, { timeout: 5000 });

      // Flip with Space
      await user.keyboard(' ');

      await waitFor(() => {
        expect(useReviewStore.getState().isCardFlipped).toBe(true);
      });

      // Rate with number key
      await user.keyboard(key);

      await waitFor(() => {
        const { sessionStats } = useReviewStore.getState();
        expect(sessionStats[expectedCount]).toBeGreaterThan(0);
      });

      // Clean up
      unmount();
      useReviewStore.getState().resetSession();
    }
  });

  it('should not rate card with number keys before flipping', async () => {
    const user = userEvent.setup();

    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { currentCard } = useReviewStore.getState();
      expect(currentCard).toBeTruthy();
    }, { timeout: 5000 });

    expect(useReviewStore.getState().isCardFlipped).toBe(false);

    // Try to rate without flipping (should be ignored)
    await user.keyboard('3');

    // Wait a bit to ensure nothing happened
    await new Promise(resolve => setTimeout(resolve, 500));

    // Card should still be unflipped and no rating recorded
    expect(useReviewStore.getState().isCardFlipped).toBe(false);
    expect(useReviewStore.getState().sessionStats.cardsReviewed).toBe(0);
  });

  it('should complete full review cycle using only keyboard', async () => {
    const user = userEvent.setup();

    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { currentCard } = useReviewStore.getState();
      expect(currentCard).toBeTruthy();
    }, { timeout: 5000 });

    // Review 3 cards using only keyboard
    for (let i = 0; i < 3; i++) {
      // Wait for card
      await waitFor(() => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      });

      // Flip with Space
      await user.keyboard(' ');

      await waitFor(() => {
        expect(useReviewStore.getState().isCardFlipped).toBe(true);
      });

      // Rate with "3" (Good)
      await user.keyboard('3');

      await waitFor(() => {
        const { sessionStats } = useReviewStore.getState();
        expect(sessionStats.cardsReviewed).toBe(i + 1);
      });
    }

    // Verify session stats
    const { sessionStats } = useReviewStore.getState();
    expect(sessionStats.cardsReviewed).toBe(3);
    expect(sessionStats.goodCount).toBe(3);
  });

  it('should ignore keyboard shortcuts when input is focused', async () => {
    const user = userEvent.setup();

    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { currentCard } = useReviewStore.getState();
      expect(currentCard).toBeTruthy();
    }, { timeout: 5000 });

    // Create and focus an input element
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Try to flip card while input is focused
    await user.keyboard(' ');

    // Card should NOT flip
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(useReviewStore.getState().isCardFlipped).toBe(false);

    // Clean up
    document.body.removeChild(input);
  });

  it('should handle keyboard shortcuts for all rating types', async () => {
    const user = userEvent.setup();

    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { activeSession } = useReviewStore.getState();
      expect(activeSession).toBeTruthy();
    }, { timeout: 5000 });

    const ratings = [
      { key: '1', expectedCount: 'againCount' },
      { key: '2', expectedCount: 'hardCount' },
      { key: '3', expectedCount: 'goodCount' },
      { key: '4', expectedCount: 'easyCount' },
    ] as const;

    for (const { key, expectedCount } of ratings) {
      // Wait for card
      await waitFor(() => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      });

      // Flip with Space
      await user.keyboard(' ');

      await waitFor(() => {
        expect(useReviewStore.getState().isCardFlipped).toBe(true);
      });

      // Rate with number key
      await user.keyboard(key);

      // Wait for rating to process
      await waitFor(() => {
        expect(useReviewStore.getState().isCardFlipped).toBe(false);
      });
    }

    // Verify all ratings were recorded
    const { sessionStats } = useReviewStore.getState();
    expect(sessionStats.againCount).toBe(1);
    expect(sessionStats.hardCount).toBe(1);
    expect(sessionStats.goodCount).toBe(1);
    expect(sessionStats.easyCount).toBe(1);
  });
});
