// src/stores/reviewStore.ts

/**
 * Review Session State Management Store
 *
 * ⚠️ TEMPORARY IMPLEMENTATION (MVP)
 *
 * This store manages active review sessions using:
 * - Zustand for state management
 * - sessionStorage for crash recovery
 * - mockReviewAPI for data persistence
 * - SM-2 algorithm for spaced repetition
 *
 * TODO: Backend Migration Required
 * When backend is ready, refactor as follows:
 * 1. Replace mockReviewAPI with real API client
 * 2. Move SR data persistence to PostgreSQL
 * 3. Store session progress on backend
 * 4. Keep only UI state (isCardFlipped, isLoading) in Zustand
 *
 * Estimated migration time: 4-6 hours
 */

import { create } from 'zustand';

import { mockReviewAPI } from '@/services/mockReviewAPI';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { useAuthStore } from '@/stores/authStore';
import { useDeckStore } from '@/stores/deckStore';
import type {
  ReviewSession,
  ReviewRating,
  CardReview,
  SessionStats,
  SessionSummary,
  QueueConfig,
} from '@/types/review';

/**
 * Default queue configuration for review sessions
 * Matches Anki-style defaults
 */
const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxNewCards: 20, // 20 new cards per session
  maxReviewCards: 100, // 100 review cards per session
  learningFirst: true, // Prioritize learning cards
  randomize: false, // Don't randomize (show by due date)
};

/**
 * Default initial session statistics
 */
const DEFAULT_SESSION_STATS: SessionStats = {
  cardsReviewed: 0,
  cardsRemaining: 0,
  accuracy: 0,
  cardsCorrect: 0,
  cardsIncorrect: 0,
  totalTime: 0,
  averageTime: 0,
  againCount: 0,
  hardCount: 0,
  goodCount: 0,
  easyCount: 0,
};

/**
 * Review Store State Interface
 */
interface ReviewState {
  // ========================================
  // SESSION STATE
  // ========================================

  /** Active review session (null when not in review mode) */
  activeSession: ReviewSession | null;

  /** Current position in card queue (0-based index) */
  currentCardIndex: number;

  /** Whether current card is flipped (showing back side) */
  isCardFlipped: boolean;

  /** Real-time session statistics */
  sessionStats: SessionStats;

  // ========================================
  // UI STATE
  // ========================================

  /** Loading state for async operations */
  isLoading: boolean;

  /** Error message for user display (null = no error) */
  error: string | null;

  /** Session summary after completion (null = no completed session) */
  sessionSummary: SessionSummary | null;

  // ========================================
  // COMPUTED GETTERS
  // ========================================

  /** Get current card being reviewed (null if no active session) */
  readonly currentCard: CardReview | null;

  /** Get session progress (cards reviewed / total cards) */
  readonly progress: { current: number; total: number };

  /** Check if there are more cards in queue */
  readonly hasNextCard: boolean;

  /** Check if current card can be rated (must be flipped first) */
  readonly canRate: boolean;

  // ========================================
  // ACTIONS - SESSION LIFECYCLE
  // ========================================

  /**
   * Start a new review session for a deck
   * Loads due cards, creates queue, initializes session
   *
   * @param deckId - Deck to review
   * @param maxCards - Optional max cards limit (overrides default)
   * @throws Error if user not authenticated
   * @throws Error if deck not found
   * @throws Error if no cards due
   */
  startSession: (deckId: string, maxCards?: number) => Promise<void>;

  /**
   * Rate current card and advance to next
   * Applies SM-2 algorithm, updates statistics
   *
   * @param rating - User's performance rating (again/hard/good/easy)
   * @throws Error if no active session
   * @throws Error if card not flipped
   */
  rateCard: (rating: ReviewRating) => Promise<void>;

  /**
   * Flip current card to show answer (back side)
   * Disabled if no active session or already flipped
   */
  flipCard: () => void;

  /**
   * Pause current session (save state for later)
   * Persists session to sessionStorage for crash recovery
   */
  pauseSession: () => void;

  /**
   * Resume paused session from sessionStorage
   * Restores session state and continues from last card
   */
  resumeSession: () => Promise<void>;

  /**
   * End session and return summary statistics
   * Calculates final accuracy, time spent, rating breakdown
   * Updates deck progress in deckStore
   *
   * @returns Session summary with performance metrics
   * @throws Error if no active session
   */
  endSession: () => Promise<SessionSummary>;

  /**
   * Clear current session without saving (discard progress)
   * Used when user exits session early
   */
  resetSession: () => void;

  /**
   * Clear current error message
   */
  clearError: () => void;

  /**
   * Clear session summary from state
   * Called when user navigates away from summary page
   */
  clearSessionSummary: () => void;
}

/**
 * Review store hook for components
 *
 * Usage:
 * ```tsx
 * const { activeSession, currentCard, flipCard, rateCard } = useReviewStore();
 *
 * // Start session
 * await startSession('deck-a1-basics', 20);
 *
 * // Flip card
 * flipCard();
 *
 * // Rate card
 * await rateCard('good');
 *
 * // End session
 * const summary = await endSession();
 * ```
 */
export const useReviewStore = create<ReviewState>((set, get) => ({
  // ========================================
  // INITIAL STATE
  // ========================================

  activeSession: null,
  currentCardIndex: 0,
  isCardFlipped: false,
  sessionStats: { ...DEFAULT_SESSION_STATS },
  isLoading: false,
  error: null,
  sessionSummary: null,

  // ========================================
  // COMPUTED GETTERS (implemented as computed properties)
  // Note: Using Object.defineProperty pattern for Zustand compatibility
  // ========================================

  // These are initialized as null/defaults and computed on access via defineProperty below
  currentCard: null,
  progress: { current: 0, total: 0 },
  hasNextCard: false,
  canRate: false,

  // ========================================
  // ACTIONS - SESSION LIFECYCLE
  // ========================================

  /**
   * Start a new review session
   */
  startSession: async (deckId: string, maxCards?: number) => {
    set({ isLoading: true, error: null });

    try {
      // Check authentication
      const { user } = useAuthStore.getState();
      if (!user) {
        throw new Error('You must be logged in to start a review session');
      }

      // Build queue config
      const config: Partial<QueueConfig> = maxCards
        ? { ...DEFAULT_QUEUE_CONFIG, maxNewCards: maxCards }
        : DEFAULT_QUEUE_CONFIG;

      // Call API to start session
      const session = await mockReviewAPI.startReviewSession(deckId, undefined, config);

      // Check if there are cards to review
      if (session.cards.length === 0) {
        throw new Error('No cards due for review. Come back later!');
      }

      // Initialize session state with computed values
      const currentCard = session.cards[0] || null;
      set({
        activeSession: session,
        currentCardIndex: 0,
        isCardFlipped: false,
        sessionStats: session.stats,
        isLoading: false,
        error: null,
        // Computed values
        currentCard,
        progress: { current: 0, total: session.cards.length },
        hasNextCard: session.cards.length > 1,
        canRate: false, // Not flipped yet
      });

      // Save to sessionStorage for crash recovery
      sessionStorage.setItem('learn-greek-easy:active-session', JSON.stringify(session));
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to start review session. Please try again.';

      set({
        isLoading: false,
        error: errorMessage,
        activeSession: null,
      });

      throw error;
    }
  },

  /**
   * Flip current card to show answer
   */
  flipCard: () => {
    const { activeSession, isCardFlipped } = get();

    if (!activeSession) {
      console.warn('No active session. Cannot flip card.');
      return;
    }

    if (isCardFlipped) {
      console.warn('Card already flipped.');
      return;
    }

    set({ isCardFlipped: true, canRate: true });
  },

  /**
   * Rate current card and advance to next
   */
  rateCard: async (rating: ReviewRating) => {
    const { activeSession, currentCardIndex, isCardFlipped } = get();

    // Validation
    if (!activeSession) {
      throw new Error('No active session');
    }

    if (!isCardFlipped) {
      throw new Error('You must flip the card before rating');
    }

    const currentCard = activeSession.cards[currentCardIndex];
    if (!currentCard) {
      throw new Error('No current card');
    }

    set({ isLoading: true, error: null });

    try {
      // Calculate time spent on this card
      const timeSpent = Math.floor(
        (Date.now() - new Date(activeSession.startTime).getTime()) / 1000
      );

      // Submit rating to API (applies SM-2 algorithm)
      await mockReviewAPI.submitCardRating(
        activeSession.sessionId,
        currentCard.id,
        rating,
        timeSpent
      );

      // Update session stats
      const updatedStats = calculateUpdatedStats(get().sessionStats, rating, timeSpent);

      // Advance to next card
      const nextIndex = currentCardIndex + 1;
      const isLastCard = nextIndex >= activeSession.cards.length;
      const nextCard = isLastCard ? null : activeSession.cards[nextIndex];

      set({
        currentCardIndex: nextIndex,
        isCardFlipped: false,
        sessionStats: updatedStats,
        isLoading: false,
        // Computed values
        currentCard: nextCard,
        progress: { current: nextIndex, total: activeSession.cards.length },
        hasNextCard: nextIndex < activeSession.cards.length - 1,
        canRate: false, // Card not flipped yet
      });

      // Auto-end session if last card
      if (isLastCard) {
        // Don't await - let endSession handle async
        setTimeout(() => {
          get().endSession();
        }, 500); // Small delay for UI transition
      }

      // Update sessionStorage recovery data
      sessionStorage.setItem(
        'learn-greek-easy:active-session',
        JSON.stringify({
          ...activeSession,
          currentIndex: nextIndex,
          stats: updatedStats,
        })
      );
    } catch (error) {
      // Check if this is an expected "session cleared" error
      // This can happen during test cleanup or when component unmounts during async operation
      if (error instanceof Error && error.message === 'No active review session found') {
        console.debug('rateCard: Session cleared during async operation, ignoring');
        set({ isLoading: false });
        return; // Don't re-throw - this is expected behavior during cleanup
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Failed to rate card. Please try again.';

      set({
        isLoading: false,
        error: errorMessage,
      });

      throw error;
    }
  },

  /**
   * Pause current session
   */
  pauseSession: () => {
    const { activeSession, currentCardIndex, sessionStats } = get();

    if (!activeSession) {
      console.warn('No active session to pause');
      return;
    }

    // Update session status
    const pausedSession: ReviewSession = {
      ...activeSession,
      status: 'paused',
      pausedAt: new Date(),
      currentIndex: currentCardIndex,
      stats: sessionStats,
    };

    set({
      activeSession: pausedSession,
    });

    // Persist to sessionStorage
    sessionStorage.setItem('learn-greek-easy:active-session', JSON.stringify(pausedSession));
  },

  /**
   * Resume paused session
   */
  resumeSession: async () => {
    set({ isLoading: true, error: null });

    try {
      // Load from sessionStorage
      const savedData = sessionStorage.getItem('learn-greek-easy:active-session');
      if (!savedData) {
        throw new Error('No paused session found');
      }

      const session: ReviewSession = JSON.parse(savedData);

      // Validate session
      if (session.status !== 'paused') {
        throw new Error('Session is not paused');
      }

      // Resume session via API (updates timestamps)
      await mockReviewAPI.resumeSession(session.sessionId);

      // Compute values
      const currentIndex = session.currentIndex;
      const currentCard = session.cards[currentIndex] || null;

      // Restore state with computed values
      set({
        activeSession: {
          ...session,
          status: 'active',
          pausedAt: null,
        },
        currentCardIndex: currentIndex,
        isCardFlipped: false,
        sessionStats: session.stats,
        isLoading: false,
        error: null,
        // Computed values
        currentCard,
        progress: { current: currentIndex, total: session.cards.length },
        hasNextCard: currentIndex < session.cards.length - 1,
        canRate: false,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to resume session. Please try again.';

      set({
        isLoading: false,
        error: errorMessage,
      });

      throw error;
    }
  },

  /**
   * End session and return summary
   */
  endSession: async (): Promise<SessionSummary> => {
    const { activeSession } = get();

    if (!activeSession) {
      throw new Error('No active session to end');
    }

    set({ isLoading: true, error: null });

    try {
      // Call API to end session (calculates summary)
      const summary = await mockReviewAPI.endReviewSession(activeSession.sessionId);

      // Update deck progress in deckStore
      const { updateProgress } = useDeckStore.getState();
      updateProgress(activeSession.deckId, {
        lastStudied: new Date(),
      });

      // Update analytics snapshot
      const { user } = useAuthStore.getState();
      if (user) {
        const { updateSnapshot } = useAnalyticsStore.getState();
        await updateSnapshot(user.id, summary);
      }

      // Clear session state and store summary
      set({
        sessionSummary: summary,
        activeSession: null,
        currentCardIndex: 0,
        isCardFlipped: false,
        sessionStats: { ...DEFAULT_SESSION_STATS },
        isLoading: false,
        error: null,
        // Reset computed values
        currentCard: null,
        progress: { current: 0, total: 0 },
        hasNextCard: false,
        canRate: false,
      });

      // Clear sessionStorage recovery data
      sessionStorage.removeItem('learn-greek-easy:active-session');

      return summary;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to end session. Please try again.';

      set({
        isLoading: false,
        error: errorMessage,
      });

      throw error;
    }
  },

  /**
   * Reset session without saving (discard progress)
   */
  resetSession: () => {
    set({
      activeSession: null,
      currentCardIndex: 0,
      isCardFlipped: false,
      sessionStats: { ...DEFAULT_SESSION_STATS },
      isLoading: false,
      error: null,
      // Reset computed values
      currentCard: null,
      progress: { current: 0, total: 0 },
      hasNextCard: false,
      canRate: false,
    });

    // Clear sessionStorage
    sessionStorage.removeItem('learn-greek-easy:active-session');
  },

  /**
   * Clear current error message
   */
  clearError: () => {
    set({ error: null });
  },

  /**
   * Clear session summary from state
   */
  clearSessionSummary: () => {
    set({ sessionSummary: null });
  },
}));

/**
 * Helper: Calculate updated stats after rating a card
 */
function calculateUpdatedStats(
  currentStats: SessionStats,
  rating: ReviewRating,
  timeSpent: number
): SessionStats {
  const cardsReviewed = currentStats.cardsReviewed + 1;
  const totalTime = currentStats.totalTime + timeSpent;

  // Update rating counts
  const ratingCounts = {
    againCount: currentStats.againCount + (rating === 'again' ? 1 : 0),
    hardCount: currentStats.hardCount + (rating === 'hard' ? 1 : 0),
    goodCount: currentStats.goodCount + (rating === 'good' ? 1 : 0),
    easyCount: currentStats.easyCount + (rating === 'easy' ? 1 : 0),
  };

  // Update correct/incorrect counts
  const cardsCorrect = currentStats.cardsCorrect + (rating === 'good' || rating === 'easy' ? 1 : 0);
  const cardsIncorrect = currentStats.cardsIncorrect + (rating === 'again' ? 1 : 0);

  // Calculate accuracy
  const accuracy = cardsReviewed > 0 ? Math.round((cardsCorrect / cardsReviewed) * 100) : 0;

  // Calculate average time
  const averageTime = cardsReviewed > 0 ? Math.round(totalTime / cardsReviewed) : 0;

  return {
    cardsReviewed,
    cardsRemaining: currentStats.cardsRemaining - 1,
    accuracy,
    cardsCorrect,
    cardsIncorrect,
    totalTime,
    averageTime,
    ...ratingCounts,
  };
}

/**
 * Attempt to recover active session from sessionStorage
 * Call this on app mount (in App.tsx or ReviewSessionPage)
 */
export function recoverActiveSession(): boolean {
  try {
    const savedData = sessionStorage.getItem('learn-greek-easy:active-session');
    if (!savedData) return false;

    const session: ReviewSession = JSON.parse(savedData);

    // Only recover if session was active (not paused or completed)
    if (session.status !== 'active') return false;

    // Compute values
    const currentIndex = session.currentIndex;
    const currentCard = session.cards[currentIndex] || null;

    // Restore state with computed values
    useReviewStore.setState({
      activeSession: session,
      currentCardIndex: currentIndex,
      isCardFlipped: false,
      sessionStats: session.stats,
      // Computed values
      currentCard,
      progress: { current: currentIndex, total: session.cards.length },
      hasNextCard: currentIndex < session.cards.length - 1,
      canRate: false,
    });

    console.log('Session recovered from crash:', session.sessionId);
    return true;
  } catch (error) {
    console.error('Failed to recover session:', error);
    sessionStorage.removeItem('learn-greek-easy:active-session');
    return false;
  }
}
