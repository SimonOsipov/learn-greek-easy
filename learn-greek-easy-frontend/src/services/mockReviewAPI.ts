// src/services/mockReviewAPI.ts

import { v4 as uuidv4 } from 'uuid';

import { processCardReview, isCardDue } from '@/lib/spacedRepetition';
import type {
  ReviewSession,
  ReviewRating,
  CardReview,
  SessionSummary,
  QueueConfig,
  SpacedRepetitionData,
} from '@/types/review';

import { getCardsForDeck } from './mockReviewData';

/**
 * localStorage key for review session data
 */
const REVIEW_DATA_KEY = 'learn-greek-easy:review-data';

/**
 * sessionStorage key for active session
 */
const ACTIVE_SESSION_KEY = 'learn-greek-easy:active-session';

/**
 * Simulate network delay
 */
const simulateDelay = (ms: number = 500): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Load review data from localStorage
 */
function loadReviewData(): Record<string, SpacedRepetitionData> {
  try {
    const data = localStorage.getItem(REVIEW_DATA_KEY);
    if (!data) return {};

    const parsed = JSON.parse(data);

    // Convert date strings back to Date objects
    Object.values(parsed).forEach((sr: any) => {
      if (sr.dueDate) sr.dueDate = new Date(sr.dueDate);
      if (sr.lastReviewed) sr.lastReviewed = new Date(sr.lastReviewed);
    });

    return parsed;
  } catch (error) {
    console.error('Failed to load review data from localStorage:', error);
    return {};
  }
}

/**
 * Save review data to localStorage
 */
function saveReviewData(data: Record<string, SpacedRepetitionData>): void {
  try {
    localStorage.setItem(REVIEW_DATA_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save review data to localStorage:', error);
  }
}

/**
 * Get due cards for a deck (cards that need review today)
 */
function getDueCards(deckId: string, maxCards?: number): CardReview[] {
  const allCards = getCardsForDeck(deckId);
  const reviewData = loadReviewData();
  const now = new Date();

  // Filter cards that are due
  const dueCards = allCards.filter((card) => {
    const srData = reviewData[card.id] || card.srData;

    // New cards are always due
    if (srData.state === 'new') return true;

    // Use SM-2 due date checker
    return isCardDue(srData.dueDate, now);
  });

  // Sort by priority: learning → new → review
  dueCards.sort((a, b) => {
    const aData = reviewData[a.id] || a.srData;
    const bData = reviewData[b.id] || b.srData;

    const priority = { learning: 0, relearning: 0, new: 1, review: 2, mastered: 3 };
    return priority[aData.state] - priority[bData.state];
  });

  // Apply limit
  return maxCards ? dueCards.slice(0, maxCards) : dueCards;
}

/**
 * Mock API for review sessions
 * Simulates backend with realistic delays and localStorage persistence
 */
export const mockReviewAPI = {
  /**
   * Get queue of due cards for a deck
   *
   * @param deckId - Deck to get cards from
   * @param maxCards - Maximum cards to return (default: 20)
   * @returns Array of cards due for review
   */
  getReviewQueue: async (deckId: string, maxCards: number = 20): Promise<CardReview[]> => {
    await simulateDelay(500);

    const dueCards = getDueCards(deckId, maxCards);

    // Merge with stored review data
    const reviewData = loadReviewData();
    return dueCards.map((card) => ({
      ...card,
      srData: reviewData[card.id] || card.srData,
    }));
  },

  /**
   * Start a new review session
   *
   * @param deckId - Deck to review
   * @param cardIds - Specific cards to review (optional)
   * @param config - Queue configuration (optional)
   * @returns New review session object
   */
  startReviewSession: async (
    deckId: string,
    cardIds?: string[],
    config?: Partial<QueueConfig>
  ): Promise<ReviewSession> => {
    await simulateDelay(700);

    // Get cards for session
    let cards: CardReview[];
    if (cardIds) {
      // Use specific cards
      const reviewData = loadReviewData();
      cards = cardIds
        .map((id) => {
          const allCards = getCardsForDeck(deckId);
          const card = allCards.find((c) => c.id === id);
          if (!card) return null;

          return {
            ...card,
            srData: reviewData[card.id] || card.srData,
          };
        })
        .filter((c): c is CardReview => c !== null);
    } else {
      // Get due cards
      const maxCards = config?.maxNewCards || 20;
      cards = await mockReviewAPI.getReviewQueue(deckId, maxCards);
    }

    if (cards.length === 0) {
      throw new Error('No cards available for review');
    }

    // Create session
    const session: ReviewSession = {
      sessionId: uuidv4(),
      deckId,
      userId: 'current-user',
      status: 'active',
      startTime: new Date(),
      endTime: null,
      pausedAt: null,
      cards,
      currentIndex: 0,
      ratings: [],
      stats: {
        cardsReviewed: 0,
        cardsRemaining: cards.length,
        accuracy: 0,
        cardsCorrect: 0,
        cardsIncorrect: 0,
        totalTime: 0,
        averageTime: 0,
        againCount: 0,
        hardCount: 0,
        goodCount: 0,
        easyCount: 0,
      },
    };

    // Store session in sessionStorage for recovery
    sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));

    return session;
  },

  /**
   * Submit a rating for a card
   *
   * @param sessionId - Active session ID
   * @param cardId - Card being rated
   * @param rating - User's rating (again/hard/good/easy)
   * @param timeSpent - Seconds spent on card
   * @returns Updated spaced repetition data
   */
  submitCardRating: async (
    _sessionId: string,
    cardId: string,
    rating: ReviewRating,
    _timeSpent: number
  ): Promise<SpacedRepetitionData> => {
    await simulateDelay(300);

    // Load current review data
    const reviewData = loadReviewData();
    let currentSRData = reviewData[cardId];

    // If no existing data, try to get from session
    if (!currentSRData) {
      const sessionData = sessionStorage.getItem(ACTIVE_SESSION_KEY);
      if (!sessionData) {
        // Session was cleared (likely during test cleanup or component unmount)
        // This is expected behavior during async cleanup - return default SR data
        // instead of throwing to prevent unhandled rejections
        console.debug('submitCardRating: No active session found, returning default SR data');
        return {
          state: 'new',
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          dueDate: new Date(),
          lastReviewed: null,
        };
      }

      const session: ReviewSession = JSON.parse(sessionData);
      const card = session.cards.find((c) => c.id === cardId);
      if (!card) {
        throw new Error(`Card ${cardId} not found in session`);
      }

      currentSRData = card.srData;
    }

    // Apply SM-2 algorithm (replaces all placeholder logic)
    const updatedSRData = processCardReview(currentSRData, rating);

    // Save to localStorage
    reviewData[cardId] = updatedSRData;
    saveReviewData(reviewData);

    return updatedSRData;
  },

  /**
   * End review session and calculate summary
   *
   * @param sessionId - Session to end
   * @returns Session summary with performance metrics
   */
  endReviewSession: async (sessionId: string): Promise<SessionSummary> => {
    await simulateDelay(500);

    // Load session from sessionStorage
    const sessionData = sessionStorage.getItem(ACTIVE_SESSION_KEY);
    if (!sessionData) {
      throw new Error('No active review session found');
    }

    const session: ReviewSession = JSON.parse(sessionData);

    // Verify session ID matches
    if (session.sessionId !== sessionId) {
      throw new Error('Session ID mismatch');
    }

    // Calculate session duration
    const totalTime = Math.floor(
      (new Date().getTime() - new Date(session.startTime).getTime()) / 1000
    );

    // Calculate rating breakdown
    const ratingBreakdown = {
      again: session.stats.againCount,
      hard: session.stats.hardCount,
      good: session.stats.goodCount,
      easy: session.stats.easyCount,
    };

    // Calculate state transitions (placeholder - will calculate properly in Task 05.02)
    const transitions = {
      newToLearning: session.stats.goodCount + session.stats.easyCount,
      learningToReview: Math.floor(session.stats.goodCount * 0.5),
      reviewToMastered: Math.floor(session.stats.easyCount * 0.3),
      toRelearning: session.stats.againCount,
    };

    // Get deck progress (placeholder - will update in Task 05.03)
    const deckProgressBefore = {
      cardsNew: 50,
      cardsLearning: 30,
      cardsReview: 15,
      cardsMastered: 5,
    };

    const deckProgressAfter = {
      cardsNew: deckProgressBefore.cardsNew - transitions.newToLearning,
      cardsLearning:
        deckProgressBefore.cardsLearning +
        transitions.newToLearning -
        transitions.learningToReview +
        transitions.toRelearning,
      cardsReview:
        deckProgressBefore.cardsReview +
        transitions.learningToReview -
        transitions.reviewToMastered,
      cardsMastered: deckProgressBefore.cardsMastered + transitions.reviewToMastered,
    };

    const summary: SessionSummary = {
      sessionId: session.sessionId,
      deckId: session.deckId,
      userId: session.userId,
      completedAt: new Date(),
      cardsReviewed: session.stats.cardsReviewed,
      accuracy: session.stats.accuracy,
      totalTime,
      averageTimePerCard:
        session.stats.cardsReviewed > 0 ? Math.round(totalTime / session.stats.cardsReviewed) : 0,
      ratingBreakdown,
      transitions,
      deckProgressBefore,
      deckProgressAfter,
    };

    // Clear session from sessionStorage
    sessionStorage.removeItem(ACTIVE_SESSION_KEY);

    return summary;
  },

  /**
   * Get review history for a specific card
   *
   * @param cardId - Card to get history for
   * @returns Spaced repetition data for the card
   */
  getCardHistory: async (cardId: string): Promise<SpacedRepetitionData | null> => {
    await simulateDelay(200);

    const reviewData = loadReviewData();
    return reviewData[cardId] || null;
  },

  /**
   * Pause current review session
   *
   * @param sessionId - Session to pause
   */
  pauseSession: async (sessionId: string): Promise<void> => {
    await simulateDelay(100);

    const sessionData = sessionStorage.getItem(ACTIVE_SESSION_KEY);
    if (!sessionData) {
      throw new Error('No active review session found');
    }

    const session: ReviewSession = JSON.parse(sessionData);

    // Verify session ID matches
    if (session.sessionId !== sessionId) {
      throw new Error('Session ID mismatch');
    }

    session.status = 'paused';
    session.pausedAt = new Date();

    sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  },

  /**
   * Resume paused review session
   *
   * @param sessionId - Session to resume
   */
  resumeSession: async (sessionId: string): Promise<void> => {
    await simulateDelay(100);

    const sessionData = sessionStorage.getItem(ACTIVE_SESSION_KEY);
    if (!sessionData) {
      throw new Error('No active review session found');
    }

    const session: ReviewSession = JSON.parse(sessionData);

    // Verify session ID matches
    if (session.sessionId !== sessionId) {
      throw new Error('Session ID mismatch');
    }

    session.status = 'active';
    session.pausedAt = null;

    sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  },
};
