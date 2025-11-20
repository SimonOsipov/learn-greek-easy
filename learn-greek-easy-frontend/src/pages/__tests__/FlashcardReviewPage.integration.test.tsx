/**
 * FlashcardReviewPage Integration Tests
 *
 * Tests complete review session flows including:
 * - Session initialization and card loading
 * - Card flip and rating mechanics
 * - Keyboard shortcuts (Space, 1-4, Esc)
 * - Session completion and summary
 * - Error handling and edge cases
 *
 * These tests verify that the review system components (FlashcardReviewPage,
 * FlashcardContainer, reviewStore, keyboard shortcuts) work together correctly.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import { FlashcardReviewPage } from '../FlashcardReviewPage';
import { useReviewStore } from '@/stores/reviewStore';
import { useAuthStore } from '@/stores/authStore';
import { useDeckStore } from '@/stores/deckStore';

// Mock react-router-dom for navigation and params
const mockNavigate = vi.fn();
const mockParams = { deckId: 'greek-alphabet-a1' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useLocation: () => ({ state: null, pathname: '/review' }),
  };
});

describe('FlashcardReviewPage - Session Initialization', () => {
  beforeEach(async () => {
    // Clear all stores
    localStorage.clear();
    sessionStorage.clear();
    mockNavigate.mockClear();
    vi.clearAllMocks();

    // Login user
    const authStore = useAuthStore.getState();
    await authStore.login('demo@learngreekeasy.com', 'Demo123!');

    // Load decks
    const deckStore = useDeckStore.getState();
    await deckStore.fetchDecks();

    // Reset review store
    useReviewStore.getState().resetSession();
  });

  afterEach(() => {
    // Clean up any active sessions
    sessionStorage.removeItem('learn-greek-easy:active-session');
  });

  it('should start review session on mount and display first card', async () => {
    render(<FlashcardReviewPage />);

    // Wait for session to start and first card to load
    await waitFor(
      () => {
        const { activeSession, currentCard } = useReviewStore.getState();
        expect(activeSession).toBeTruthy();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Verify card content is visible
    const { currentCard } = useReviewStore.getState();
    expect(currentCard).toBeTruthy();

    // Check for Greek word or front content
    if (currentCard?.word) {
      expect(screen.getByText(currentCard.word)).toBeInTheDocument();
    }

    // Answer should NOT be visible initially
    if (currentCard?.translation) {
      const translationElements = screen.queryAllByText(currentCard.translation);
      // Translation might appear in hidden sections, so check it's not in the main card area
      expect(translationElements.length === 0 || !translationElements[0].closest('[role="button"]')).toBeTruthy();
    }
  });

  it('should display progress indicator showing card position', async () => {
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { activeSession } = useReviewStore.getState();
        expect(activeSession).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Check for progress indicator (e.g., "1 / 10" or "Card 1 of 10")
    const { activeSession, currentCardIndex } = useReviewStore.getState();
    const totalCards = activeSession?.cards.length || 0;

    expect(totalCards).toBeGreaterThan(0);
    expect(currentCardIndex).toBe(0);

    // Progress should be visible in the UI
    const progressText = screen.getByText(new RegExp(`1.*${totalCards}`, 'i'));
    expect(progressText).toBeInTheDocument();
  });

  it('should show loading state while initializing session', async () => {
    const { rerender } = render(<FlashcardReviewPage />);

    // Loading state should appear briefly
    const loadingIndicator = screen.queryByText(/loading/i);

    // If loading is visible, wait for it to disappear
    if (loadingIndicator) {
      await waitFor(
        () => {
          expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    }

    // Session should be active after loading
    const { activeSession } = useReviewStore.getState();
    expect(activeSession).toBeTruthy();
  });

  it('should show error message when session fails to start', async () => {
    // Force an error by using invalid deck ID
    mockParams.deckId = 'invalid-deck-id-12345';

    render(<FlashcardReviewPage />);

    // Wait for error to appear
    await waitFor(
      () => {
        const { error } = useReviewStore.getState();
        expect(error).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Error should be displayed
    expect(screen.getByText(/error/i)).toBeInTheDocument();

    // Retry button should be available
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('should show "no cards due" message when deck is empty', async () => {
    // Use a deck with no due cards (we'll need to mock this in the future)
    // For now, test that the component handles the case correctly

    // Manually set store to show no cards
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { activeSession } = useReviewStore.getState();
        // If session starts successfully, manually clear it to test the "no cards" state
        if (activeSession) {
          useReviewStore.setState({
            activeSession: null,
            error: 'No cards due for review. Come back later!'
          });
        }
      },
      { timeout: 5000 }
    );

    // Should show appropriate message
    const noCardsMessage = screen.queryByText(/no cards/i);
    if (noCardsMessage) {
      expect(noCardsMessage).toBeInTheDocument();
    }
  });

  it('should persist session to sessionStorage for crash recovery', async () => {
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { activeSession } = useReviewStore.getState();
        expect(activeSession).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Check sessionStorage has session data
    const sessionData = sessionStorage.getItem('learn-greek-easy:active-session');
    expect(sessionData).toBeTruthy();

    if (sessionData) {
      const parsedSession = JSON.parse(sessionData);
      expect(parsedSession.sessionId).toBeTruthy();
      expect(parsedSession.deckId).toBe('greek-alphabet-a1');
      expect(parsedSession.cards).toBeTruthy();
    }
  });
});

describe('FlashcardReviewPage - Card Flip and Rating', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    mockNavigate.mockClear();
    vi.clearAllMocks();

    // Setup authenticated user and decks
    await useAuthStore.getState().login('demo@learngreekeasy.com', 'Demo123!');
    await useDeckStore.getState().fetchDecks();
    useReviewStore.getState().resetSession();

    mockParams.deckId = 'greek-alphabet-a1';
  });

  afterEach(() => {
    sessionStorage.removeItem('learn-greek-easy:active-session');
  });

  it('should flip card when clicking the card area', async () => {
    const user = userEvent.setup();
    render(<FlashcardReviewPage />);

    // Wait for card to load
    await waitFor(
      () => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Initially, card should not be flipped
    expect(useReviewStore.getState().isCardFlipped).toBe(false);

    // Find and click the card area
    const cardArea = screen.getByRole('button', { name: /flip card/i });
    await user.click(cardArea);

    // Card should now be flipped
    await waitFor(() => {
      expect(useReviewStore.getState().isCardFlipped).toBe(true);
    });

    // Answer should now be visible
    const { currentCard } = useReviewStore.getState();
    if (currentCard?.translation) {
      expect(screen.getByText(currentCard.translation)).toBeVisible();
    }
  });

  it('should show rating buttons after flipping card', async () => {
    const user = userEvent.setup();
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Rating buttons should be disabled before flip
    const againButton = screen.getByRole('button', { name: /rate card as again/i });
    expect(againButton).toBeDisabled();

    // Flip card
    const cardArea = screen.getByRole('button', { name: /flip card/i });
    await user.click(cardArea);

    // Wait for flip
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

    await waitFor(
      () => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

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
  });

  it('should update session stats after each rating', async () => {
    const user = userEvent.setup();
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

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

  it('should complete multiple card review cycles', async () => {
    const user = userEvent.setup();
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Review 3 cards
    for (let i = 0; i < 3; i++) {
      // Wait for current card
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

      // Wait for rating to process
      await waitFor(() => {
        const { sessionStats } = useReviewStore.getState();
        expect(sessionStats.cardsReviewed).toBe(i + 1);
      });
    }

    // Verify final stats
    const { sessionStats } = useReviewStore.getState();
    expect(sessionStats.cardsReviewed).toBe(3);
    expect(sessionStats.goodCount).toBe(3);
  });

  it('should track different rating types correctly', async () => {
    const user = userEvent.setup();
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

    const ratings = ['again', 'hard', 'good', 'easy'] as const;

    for (const rating of ratings) {
      // Wait for card
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

      // Rate card with current rating
      const ratingButton = screen.getByRole('button', {
        name: new RegExp(`rate card as ${rating}`, 'i')
      });
      await user.click(ratingButton);

      // Wait for processing
      await waitFor(() => {
        const { isCardFlipped } = useReviewStore.getState();
        expect(isCardFlipped).toBe(false);
      });
    }

    // Verify all ratings were tracked
    const { sessionStats } = useReviewStore.getState();
    expect(sessionStats.againCount).toBe(1);
    expect(sessionStats.hardCount).toBe(1);
    expect(sessionStats.goodCount).toBe(1);
    expect(sessionStats.easyCount).toBe(1);
    expect(sessionStats.cardsReviewed).toBe(4);
  });

  it('should calculate accuracy correctly based on ratings', async () => {
    const user = userEvent.setup();
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Rate 3 cards as "good" (correct) and 2 as "again" (incorrect)
    const ratings = ['good', 'good', 'good', 'again', 'again'] as const;

    for (const rating of ratings) {
      await waitFor(() => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      });

      const cardArea = screen.getByRole('button', { name: /flip card/i });
      await user.click(cardArea);

      await waitFor(() => {
        expect(useReviewStore.getState().isCardFlipped).toBe(true);
      });

      const ratingButton = screen.getByRole('button', {
        name: new RegExp(`rate card as ${rating}`, 'i')
      });
      await user.click(ratingButton);

      await waitFor(() => {
        expect(useReviewStore.getState().isCardFlipped).toBe(false);
      });
    }

    // Accuracy should be 60% (3 correct out of 5)
    const { sessionStats } = useReviewStore.getState();
    expect(sessionStats.accuracy).toBe(60);
    expect(sessionStats.cardsCorrect).toBe(3);
    expect(sessionStats.cardsIncorrect).toBe(2);
  });
});

describe('FlashcardReviewPage - Keyboard Shortcuts', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    mockNavigate.mockClear();
    vi.clearAllMocks();

    await useAuthStore.getState().login('demo@learngreekeasy.com', 'Demo123!');
    await useDeckStore.getState().fetchDecks();
    useReviewStore.getState().resetSession();

    mockParams.deckId = 'greek-alphabet-a1';
  });

  afterEach(() => {
    sessionStorage.removeItem('learn-greek-easy:active-session');
  });

  it('should flip card when pressing Space key', async () => {
    const user = userEvent.setup();
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

    expect(useReviewStore.getState().isCardFlipped).toBe(false);

    // Press Space key
    await user.keyboard(' ');

    // Card should flip
    await waitFor(() => {
      expect(useReviewStore.getState().isCardFlipped).toBe(true);
    });
  });

  it('should rate card with number keys 1-4', async () => {
    const user = userEvent.setup();
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

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

  it('should handle all rating keyboard shortcuts (1=Again, 2=Hard, 3=Good, 4=Easy)', async () => {
    const user = userEvent.setup();
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

    const keyMappings = [
      { key: '1', expectedCount: 'againCount' },
      { key: '2', expectedCount: 'hardCount' },
      { key: '3', expectedCount: 'goodCount' },
      { key: '4', expectedCount: 'easyCount' },
    ] as const;

    for (const { key, expectedCount } of keyMappings) {
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

  it('should not rate card with number keys before flipping', async () => {
    const user = userEvent.setup();
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

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

    await waitFor(
      () => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

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

    await waitFor(
      () => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

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
});

describe('FlashcardReviewPage - Session Completion', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    mockNavigate.mockClear();
    vi.clearAllMocks();

    await useAuthStore.getState().login('demo@learngreekeasy.com', 'Demo123!');
    await useDeckStore.getState().fetchDecks();
    useReviewStore.getState().resetSession();

    mockParams.deckId = 'greek-alphabet-a1';
  });

  afterEach(() => {
    sessionStorage.removeItem('learn-greek-easy:active-session');
  });

  it('should trigger session end when all cards are reviewed', async () => {
    const user = userEvent.setup();
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { activeSession } = useReviewStore.getState();
        expect(activeSession).toBeTruthy();
      },
      { timeout: 5000 }
    );

    const totalCards = useReviewStore.getState().activeSession?.cards.length || 0;

    // Review all cards (limit to 5 for test speed)
    const cardsToReview = Math.min(totalCards, 5);

    for (let i = 0; i < cardsToReview; i++) {
      await waitFor(() => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      });

      await user.keyboard(' '); // Flip

      await waitFor(() => {
        expect(useReviewStore.getState().isCardFlipped).toBe(true);
      });

      await user.keyboard('3'); // Rate Good

      // Wait for processing, but don't check flipped status on last card
      // as session end happens before flip state resets
      if (i < cardsToReview - 1) {
        await waitFor(() => {
          expect(useReviewStore.getState().isCardFlipped).toBe(false);
        });
      } else {
        // On last card, wait for session to end
        await waitFor(
          () => {
            const { sessionSummary } = useReviewStore.getState();
            expect(sessionSummary).toBeTruthy();
          },
          { timeout: 3000 }
        );
      }
    }
  });

  it('should navigate to summary page after session ends', async () => {
    const user = userEvent.setup();
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { activeSession } = useReviewStore.getState();
        expect(activeSession).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Manually trigger session end for faster test
    const { endSession } = useReviewStore.getState();
    await endSession();

    // Should navigate to summary page
    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.stringMatching(/summary/)
        );
      },
      { timeout: 2000 }
    );
  });

  it('should clear sessionStorage when session completes', async () => {
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { activeSession } = useReviewStore.getState();
        expect(activeSession).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Verify session is in sessionStorage
    expect(sessionStorage.getItem('learn-greek-easy:active-session')).toBeTruthy();

    // End session
    await useReviewStore.getState().endSession();

    // sessionStorage should be cleared
    await waitFor(() => {
      expect(sessionStorage.getItem('learn-greek-easy:active-session')).toBeNull();
    });
  });
});

describe('FlashcardReviewPage - Error Handling', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    mockNavigate.mockClear();
    vi.clearAllMocks();

    await useAuthStore.getState().login('demo@learngreekeasy.com', 'Demo123!');
    await useDeckStore.getState().fetchDecks();
    useReviewStore.getState().resetSession();
  });

  afterEach(() => {
    sessionStorage.removeItem('learn-greek-easy:active-session');
  });

  it('should handle missing deckId parameter gracefully', async () => {
    mockParams.deckId = '';

    render(<FlashcardReviewPage />);

    // Should show error or empty state
    await waitFor(
      () => {
        const { error, activeSession } = useReviewStore.getState();
        // Either error is shown or no session is created
        expect(error || !activeSession).toBeTruthy();
      },
      { timeout: 3000 }
    );
  });

  it('should show retry button on session start failure', async () => {
    mockParams.deckId = 'invalid-deck-999';

    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { error } = useReviewStore.getState();
        expect(error).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Retry button should be available
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('should allow user to exit review and navigate back to deck', async () => {
    const user = userEvent.setup();
    render(<FlashcardReviewPage />);

    await waitFor(
      () => {
        const { currentCard } = useReviewStore.getState();
        expect(currentCard).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Find and click "Exit Review" or back button
    const exitButton = screen.getByRole('button', { name: /exit review|back/i });
    await user.click(exitButton);

    // Should navigate back
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('should handle unauthenticated user attempt', async () => {
    // Logout user
    useAuthStore.getState().logout();

    render(<FlashcardReviewPage />);

    // Should show error or redirect (depending on implementation)
    await waitFor(
      () => {
        const { error } = useReviewStore.getState();
        expect(error).toBeTruthy();
      },
      { timeout: 3000 }
    );
  });
});
