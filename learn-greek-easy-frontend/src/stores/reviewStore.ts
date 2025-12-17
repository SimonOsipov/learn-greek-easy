// src/stores/reviewStore.ts

/**
 * Review Session State Management Store
 *
 * Uses Zustand for state management with real backend API integration.
 * Reviews are submitted individually via the SM-2 algorithm on the backend.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { reviewAPI } from '@/services/reviewAPI';
import { studyAPI } from '@/services/studyAPI';
import type { StudyQueueCard } from '@/services/studyAPI';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { useAuthStore } from '@/stores/authStore';
import type {
  ReviewSession,
  ReviewRating,
  CardReview,
  SessionStats,
  SessionSummary,
  QueueConfig,
} from '@/types/review';
import { generateSessionId } from '@/utils/analytics';

/**
 * Default queue configuration for review sessions
 */
const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxNewCards: 20,
  maxReviewCards: 100,
  learningFirst: true,
  randomize: false,
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
 * Map frontend rating to backend quality (SM-2 scale 0-5)
 */
const mapRatingToQuality = (rating: ReviewRating): number => {
  switch (rating) {
    case 'again':
      return 0; // Complete blackout
    case 'hard':
      return 2; // Incorrect but remembered
    case 'good':
      return 4; // Correct with hesitation
    case 'easy':
      return 5; // Perfect response
    default:
      return 3;
  }
};

/**
 * Transform backend study queue card to frontend CardReview type
 */
const transformStudyQueueCard = (card: StudyQueueCard, deckId: string): CardReview => ({
  id: card.card_id,
  deckId,
  front: card.greek_word,
  back: card.english_translation,
  pronunciation: card.pronunciation || '',
  example: card.example_sentence || '',
  exampleTranslation: card.example_translation || '',
  notes: '',
  status: card.status as 'new' | 'learning' | 'review' | 'mastered',
  difficulty: card.difficulty as 'easy' | 'medium' | 'hard',
  easeFactor: card.easiness_factor,
  interval: card.interval,
  repetitions: card.repetitions,
  nextReviewDate: card.next_review_date ? new Date(card.next_review_date) : new Date(),
  lastReviewDate: undefined,
  reviewCount: card.repetitions,
  correctCount: 0,
  averageTime: 0,
});

/**
 * Review Store State Interface
 */
interface ReviewState {
  /** Active review session (null when not in review mode) */
  activeSession: ReviewSession | null;

  /** Current position in card queue (0-based index) */
  currentCardIndex: number;

  /** Whether current card is flipped (showing back side) */
  isCardFlipped: boolean;

  /** Real-time session statistics */
  sessionStats: SessionStats;

  /** Loading state for async operations */
  isLoading: boolean;

  /** Error message for user display (null = no error) */
  error: string | null;

  /** Session summary after completion (null = no completed session) */
  sessionSummary: SessionSummary | null;

  /** Time when current card was shown (for timing) */
  cardStartTime: number | null;

  // Computed getters (as direct properties for Zustand)
  readonly currentCard: CardReview | null;
  readonly progress: { current: number; total: number };
  readonly hasNextCard: boolean;
  readonly canRate: boolean;

  // Actions
  startSession: (deckId: string, maxCards?: number) => Promise<void>;
  rateCard: (rating: ReviewRating) => Promise<void>;
  flipCard: () => void;
  pauseSession: () => void;
  resumeSession: () => Promise<void>;
  endSession: () => Promise<SessionSummary>;
  resetSession: () => void;
  clearError: () => void;
  clearSessionSummary: () => void;
}

/**
 * Review store hook for components
 */
export const useReviewStore = create<ReviewState>()(
  devtools(
    (set, get) => ({
      // Initial state
      activeSession: null,
      currentCardIndex: 0,
      isCardFlipped: false,
      sessionStats: { ...DEFAULT_SESSION_STATS },
      isLoading: false,
      error: null,
      sessionSummary: null,
      cardStartTime: null,

      // Computed properties
      currentCard: null,
      progress: { current: 0, total: 0 },
      hasNextCard: false,
      canRate: false,

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
            ? { ...DEFAULT_QUEUE_CONFIG, maxNewCards: maxCards, maxReviewCards: maxCards }
            : DEFAULT_QUEUE_CONFIG;

          // Fetch study queue from backend
          const queue = await studyAPI.getQueue({
            deck_id: deckId,
            limit: config.maxNewCards || 20,
          });

          // Check if there are cards to review
          if (queue.cards.length === 0) {
            throw new Error('No cards due for review. Come back later!');
          }

          // Transform cards to frontend format
          const cards = queue.cards.map((card) => transformStudyQueueCard(card, deckId));

          // Create session
          const session: ReviewSession = {
            sessionId: generateSessionId(),
            deckId,
            userId: user.id,
            cards,
            status: 'active',
            startTime: new Date(),
            currentIndex: 0,
            config: config as QueueConfig,
            stats: {
              ...DEFAULT_SESSION_STATS,
              cardsRemaining: cards.length,
            },
          };

          // Initialize state
          const currentCard = cards[0] || null;
          set({
            activeSession: session,
            currentCardIndex: 0,
            isCardFlipped: false,
            sessionStats: session.stats,
            isLoading: false,
            error: null,
            cardStartTime: Date.now(),
            currentCard,
            progress: { current: 0, total: cards.length },
            hasNextCard: cards.length > 1,
            canRate: false,
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
        const { activeSession, currentCardIndex, isCardFlipped, cardStartTime } = get();

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
          const timeSpent = cardStartTime
            ? Math.min(Math.floor((Date.now() - cardStartTime) / 1000), 300)
            : 10;

          // Submit review to backend
          await reviewAPI.submit({
            card_id: currentCard.id,
            quality: mapRatingToQuality(rating),
            time_taken: timeSpent,
          });

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
            cardStartTime: isLastCard ? null : Date.now(),
            currentCard: nextCard,
            progress: { current: nextIndex, total: activeSession.cards.length },
            hasNextCard: nextIndex < activeSession.cards.length - 1,
            canRate: false,
          });

          // Auto-end session if last card
          if (isLastCard) {
            setTimeout(() => {
              get().endSession();
            }, 500);
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
          if (error instanceof Error && error.message === 'No active review session found') {
            console.debug('rateCard: Session cleared during async operation, ignoring');
            set({ isLoading: false });
            return;
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

        const pausedSession: ReviewSession = {
          ...activeSession,
          status: 'paused',
          pausedAt: new Date(),
          currentIndex: currentCardIndex,
          stats: sessionStats,
        };

        set({ activeSession: pausedSession });

        sessionStorage.setItem('learn-greek-easy:active-session', JSON.stringify(pausedSession));
      },

      /**
       * Resume paused session
       */
      resumeSession: async () => {
        set({ isLoading: true, error: null });

        try {
          const savedData = sessionStorage.getItem('learn-greek-easy:active-session');
          if (!savedData) {
            throw new Error('No paused session found');
          }

          const session: ReviewSession = JSON.parse(savedData);

          if (session.status !== 'paused') {
            throw new Error('Session is not paused');
          }

          const currentIndex = session.currentIndex;
          const currentCard = session.cards[currentIndex] || null;

          set({
            activeSession: {
              ...session,
              status: 'active',
              pausedAt: undefined,
            },
            currentCardIndex: currentIndex,
            isCardFlipped: false,
            sessionStats: session.stats,
            isLoading: false,
            error: null,
            cardStartTime: Date.now(),
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
        const { activeSession, sessionStats } = get();

        if (!activeSession) {
          throw new Error('No active session to end');
        }

        set({ isLoading: true, error: null });

        try {
          // Calculate session summary from local stats
          const endTime = new Date();
          const startTime = new Date(activeSession.startTime);
          const durationMinutes = Math.max(
            1,
            Math.round((endTime.getTime() - startTime.getTime()) / 60000)
          );

          const summary: SessionSummary = {
            sessionId: activeSession.sessionId,
            deckId: activeSession.deckId,
            userId: activeSession.userId,
            startTime,
            endTime,
            duration: durationMinutes,
            stats: {
              cardsReviewed: sessionStats.cardsReviewed,
              cardsRemaining: sessionStats.cardsRemaining,
              accuracy: sessionStats.accuracy,
              cardsCorrect: sessionStats.cardsCorrect,
              cardsIncorrect: sessionStats.cardsIncorrect,
              totalTime: sessionStats.totalTime,
              averageTime: sessionStats.averageTime,
              againCount: sessionStats.againCount,
              hardCount: sessionStats.hardCount,
              goodCount: sessionStats.goodCount,
              easyCount: sessionStats.easyCount,
            },
            newCardsLearned: sessionStats.cardsCorrect,
            cardsGraduated: Math.floor(sessionStats.easyCount * 0.5),
            averageEaseFactor: 2.5,
            xpEarned: sessionStats.cardsReviewed * 10 + sessionStats.cardsCorrect * 5,
            streakMaintained: true,
          };

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
            cardStartTime: null,
            currentCard: null,
            progress: { current: 0, total: 0 },
            hasNextCard: false,
            canRate: false,
          });

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
          cardStartTime: null,
          currentCard: null,
          progress: { current: 0, total: 0 },
          hasNextCard: false,
          canRate: false,
        });

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
    }),
    { name: 'reviewStore' }
  )
);

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

  const ratingCounts = {
    againCount: currentStats.againCount + (rating === 'again' ? 1 : 0),
    hardCount: currentStats.hardCount + (rating === 'hard' ? 1 : 0),
    goodCount: currentStats.goodCount + (rating === 'good' ? 1 : 0),
    easyCount: currentStats.easyCount + (rating === 'easy' ? 1 : 0),
  };

  const cardsCorrect = currentStats.cardsCorrect + (rating === 'good' || rating === 'easy' ? 1 : 0);
  const cardsIncorrect = currentStats.cardsIncorrect + (rating === 'again' ? 1 : 0);
  const accuracy = cardsReviewed > 0 ? Math.round((cardsCorrect / cardsReviewed) * 100) : 0;
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
 */
export function recoverActiveSession(): boolean {
  try {
    const savedData = sessionStorage.getItem('learn-greek-easy:active-session');
    if (!savedData) return false;

    const session: ReviewSession = JSON.parse(savedData);

    if (session.status !== 'active') return false;

    const currentIndex = session.currentIndex;
    const currentCard = session.cards[currentIndex] || null;

    useReviewStore.setState({
      activeSession: session,
      currentCardIndex: currentIndex,
      isCardFlipped: false,
      sessionStats: session.stats,
      cardStartTime: Date.now(),
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
