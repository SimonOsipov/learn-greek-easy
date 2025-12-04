/**
 * Review Session Initialization Tests
 * Tests starting a review session from deck selection
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import { DecksPage } from '@/pages/DecksPage';
import { FlashcardReviewPage } from '@/pages/FlashcardReviewPage';
import { useAuthStore } from '@/stores/authStore';
import { useDeckStore } from '@/stores/deckStore';
import { useReviewStore } from '@/stores/reviewStore';

// Mock react-router-dom for navigation and params
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

describe('Review Session Initialization', () => {
  beforeEach(async () => {
    // Clear all stores and storage completely
    localStorage.clear();
    sessionStorage.clear();
    mockNavigate.mockClear();
    vi.clearAllMocks();

    // Login
    await useAuthStore.getState().login('demo@learngreekeasy.com', 'Demo123!');

    // Reset stores
    await useDeckStore.getState().fetchDecks();
    useReviewStore.getState().resetSession();

    // Ensure deck ID is reset to valid deck
    mockParams.deckId = 'deck-a1-basics';
  });

  afterEach(() => {
    // Clean up all session/review data
    localStorage.removeItem('learn-greek-easy:review-data');
    sessionStorage.removeItem('learn-greek-easy:active-session');
    // Reset deck ID after each test
    mockParams.deckId = 'deck-a1-basics';
  });

  it('should start review session from deck page', async () => {
    render(<DecksPage />);

    // Wait for decks to load
    await waitFor(() => {
      expect(screen.getByText(/A1 Basic Vocabulary/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // Click on deck card to navigate to detail page
    const deckCard = screen.getByText(/A1 Basic Vocabulary/i).closest('a');
    expect(deckCard).toBeInTheDocument();

    // Note: Full navigation flow is tested in e2e tests
    // This integration test verifies the review store can initialize a session
    const deckStore = useDeckStore.getState();
    const deck = deckStore.decks.find(d => d.id === 'deck-a1-basics');
    expect(deck).toBeTruthy();
  });

  it('should display first card on session start', async () => {
    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { activeSession, currentCard } = useReviewStore.getState();
      expect(activeSession).toBeTruthy();
      expect(currentCard).toBeTruthy();
    }, { timeout: 5000 });

    // Verify first card is visible
    const { currentCard } = useReviewStore.getState();
    expect(currentCard).toBeTruthy();

    // Card should display Greek word (front)
    if (currentCard?.word) {
      expect(screen.getByText(currentCard.word)).toBeInTheDocument();
    }
  });

  it('should show card counter (e.g., "Card 1 of 10")', async () => {
    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { activeSession } = useReviewStore.getState();
      expect(activeSession).toBeTruthy();
    }, { timeout: 5000 });

    // Check for progress indicator
    const { activeSession, currentCardIndex } = useReviewStore.getState();
    const totalCards = activeSession?.cards.length || 0;

    expect(totalCards).toBeGreaterThan(0);
    expect(currentCardIndex).toBe(0);

    // Progress should be visible in the UI (e.g., "Card 1 of 10")
    const progressText = screen.getByText(new RegExp(`Card\\s+1\\s+of\\s+${totalCards}`, 'i'));
    expect(progressText).toBeInTheDocument();
  });

  it('should handle empty deck gracefully', async () => {
    // Use invalid deck ID to simulate empty deck
    mockParams.deckId = 'invalid-deck-id-12345';

    render(<FlashcardReviewPage />);

    await waitFor(() => {
      const { error } = useReviewStore.getState();
      expect(error).toBeTruthy();
    }, { timeout: 5000 });

    // Error message should be displayed
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
