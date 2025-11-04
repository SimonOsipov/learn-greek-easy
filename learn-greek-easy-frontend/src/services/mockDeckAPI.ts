// src/services/mockDeckAPI.ts

import type { Deck, DeckProgress, DeckFilters } from '@/types/deck';

import { MOCK_DECKS, MOCK_PROGRESS } from './mockDeckData';

/**
 * Simulate network delay
 */
const simulateDelay = (ms: number = 200): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Mock API for deck operations
 * Simulates backend with realistic delays and localStorage persistence
 */
export const mockDeckAPI = {
  /**
   * Get all decks with optional filtering
   */
  getAllDecks: async (filters?: Partial<DeckFilters>): Promise<Deck[]> => {
    await simulateDelay(300);

    let decks = [...MOCK_DECKS];

    // Apply search filter
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      decks = decks.filter(
        (deck) =>
          deck.title.toLowerCase().includes(search) ||
          deck.titleGreek.toLowerCase().includes(search) ||
          deck.description.toLowerCase().includes(search)
      );
    }

    // Apply level filter
    if (filters?.levels && filters.levels.length > 0) {
      decks = decks.filter((deck) => filters.levels!.includes(deck.level));
    }

    // Apply premium filter
    if (filters?.showPremiumOnly) {
      decks = decks.filter((deck) => deck.isPremium);
    }

    // Inject progress data
    decks = decks.map((deck) => ({
      ...deck,
      progress: MOCK_PROGRESS[deck.id],
    }));

    // Apply status filter (after progress injection)
    if (filters?.status && filters.status.length > 0) {
      decks = decks.filter(
        (deck) => deck.progress && filters.status!.includes(deck.progress.status)
      );
    }

    return decks;
  },

  /**
   * Get single deck by ID
   */
  getDeckById: async (deckId: string): Promise<Deck> => {
    await simulateDelay(200);

    const deck = MOCK_DECKS.find((d) => d.id === deckId);
    if (!deck) {
      throw new Error(`Deck with ID "${deckId}" not found`);
    }

    // Inject progress data
    return {
      ...deck,
      progress: MOCK_PROGRESS[deck.id],
    };
  },

  /**
   * Get user's progress for a specific deck
   */
  getDeckProgress: async (deckId: string): Promise<DeckProgress | null> => {
    await simulateDelay(150);

    // Check if deck exists
    const deck = MOCK_DECKS.find((d) => d.id === deckId);
    if (!deck) {
      throw new Error(`Deck with ID "${deckId}" not found`);
    }

    return MOCK_PROGRESS[deckId] || null;
  },

  /**
   * Start learning a deck (initialize progress)
   */
  startDeck: async (deckId: string): Promise<DeckProgress> => {
    await simulateDelay(200);

    const deck = MOCK_DECKS.find((d) => d.id === deckId);
    if (!deck) {
      throw new Error(`Deck with ID "${deckId}" not found`);
    }

    // Initialize new progress
    const newProgress: DeckProgress = {
      deckId,
      status: 'in-progress',
      cardsTotal: deck.cardCount,
      cardsNew: deck.cardCount,
      cardsLearning: 0,
      cardsReview: 0,
      cardsMastered: 0,
      dueToday: Math.min(20, deck.cardCount), // Start with 20 cards
      streak: 0,
      lastStudied: new Date(),
      totalTimeSpent: 0,
      accuracy: 0,
    };

    // Store in mock progress (in real app, would persist to backend)
    MOCK_PROGRESS[deckId] = newProgress;

    return newProgress;
  },

  /**
   * Update deck progress after study session
   */
  updateDeckProgress: async (
    deckId: string,
    updates: Partial<DeckProgress>
  ): Promise<DeckProgress> => {
    await simulateDelay(250);

    const currentProgress = MOCK_PROGRESS[deckId];
    if (!currentProgress) {
      throw new Error(`No progress found for deck "${deckId}"`);
    }

    // Merge updates
    const updatedProgress = {
      ...currentProgress,
      ...updates,
      lastStudied: new Date(),
    };

    // Auto-calculate status if not explicitly provided
    if (!updates.status) {
      updatedProgress.status = calculateDeckStatus(updatedProgress);
    }

    MOCK_PROGRESS[deckId] = updatedProgress;

    return updatedProgress;
  },

  /**
   * Simulate reviewing a single card
   * Updates card difficulty based on user performance
   * @param deckId - Deck containing the card
   * @param cardId - Card being reviewed
   * @param wasCorrect - Whether user answered correctly
   * @returns Updated progress
   */
  reviewCard: async (
    deckId: string,
    _cardId: string, // Prefix with underscore to indicate intentionally unused
    wasCorrect: boolean
  ): Promise<DeckProgress> => {
    await simulateDelay(150);

    const currentProgress = MOCK_PROGRESS[deckId];
    if (!currentProgress) {
      throw new Error(`No progress found for deck "${deckId}"`);
    }

    // Calculate new card counts based on performance
    let { cardsNew, cardsLearning, cardsReview, cardsMastered } = currentProgress;

    // Simple state machine for card difficulty progression
    // In real app, this would track individual card states
    if (wasCorrect) {
      // Move card forward in difficulty
      if (cardsNew > 0) {
        cardsNew--;
        cardsLearning++;
      } else if (cardsLearning > 0) {
        cardsLearning--;
        cardsMastered++;
      }
    } else {
      // Card stays in learning or moves back
      if (cardsLearning > 0) {
        // Card stays in learning (simplified)
      }
    }

    // Recalculate accuracy
    const totalReviews =
      currentProgress.totalTimeSpent > 0
        ? Math.floor(currentProgress.totalTimeSpent / 2) // Assume 2min per review
        : 1;
    const correctReviews = Math.floor(totalReviews * (currentProgress.accuracy / 100));
    const newCorrectReviews = wasCorrect ? correctReviews + 1 : correctReviews;
    const newTotalReviews = totalReviews + 1;
    const newAccuracy = Math.round((newCorrectReviews / newTotalReviews) * 100);

    // Update progress
    const updatedProgress: DeckProgress = {
      ...currentProgress,
      cardsNew,
      cardsLearning,
      cardsReview, // Could be calculated based on spaced repetition
      cardsMastered,
      accuracy: newAccuracy,
      lastStudied: new Date(),
      totalTimeSpent: currentProgress.totalTimeSpent + 2, // +2 minutes per card
    };

    // Auto-update status
    updatedProgress.status = calculateDeckStatus(updatedProgress);

    MOCK_PROGRESS[deckId] = updatedProgress;

    return updatedProgress;
  },

  /**
   * Simulate a study session (review multiple cards)
   * @param deckId - Deck being studied
   * @param cardsReviewed - Number of cards reviewed
   * @param correctCount - Number answered correctly
   * @param sessionTimeMinutes - Time spent in session
   * @returns Updated progress
   */
  reviewSession: async (
    deckId: string,
    cardsReviewed: number,
    correctCount: number,
    sessionTimeMinutes: number
  ): Promise<DeckProgress> => {
    await simulateDelay(200);

    const currentProgress = MOCK_PROGRESS[deckId];
    if (!currentProgress) {
      throw new Error(`No progress found for deck "${deckId}"`);
    }

    // Calculate cards moved between states
    const cardsToMaster = Math.floor(correctCount * 0.3); // 30% of correct → mastered
    const cardsToLearn = Math.floor(cardsReviewed * 0.5); // 50% → learning

    let { cardsNew, cardsLearning, cardsMastered } = currentProgress;

    // Move cards from new → learning
    const newToLearning = Math.min(cardsToLearn, cardsNew);
    cardsNew -= newToLearning;
    cardsLearning += newToLearning;

    // Move cards from learning → mastered
    const learningToMastered = Math.min(cardsToMaster, cardsLearning);
    cardsLearning -= learningToMastered;
    cardsMastered += learningToMastered;

    // Recalculate accuracy with weighted average
    const currentAccuracyWeight = currentProgress.totalTimeSpent || 1;
    const sessionAccuracy = (correctCount / cardsReviewed) * 100;
    const newAccuracy = Math.round(
      (currentProgress.accuracy * currentAccuracyWeight + sessionAccuracy * sessionTimeMinutes) /
        (currentAccuracyWeight + sessionTimeMinutes)
    );

    // Calculate new streak
    const lastStudiedDate = currentProgress.lastStudied
      ? new Date(currentProgress.lastStudied)
      : null;
    const today = new Date();
    const wasYesterday = lastStudiedDate
      ? today.getTime() - lastStudiedDate.getTime() < 48 * 60 * 60 * 1000 // Within 48 hours
      : false;
    const newStreak = wasYesterday ? currentProgress.streak + 1 : 1;

    // Update progress
    const updatedProgress: DeckProgress = {
      ...currentProgress,
      cardsNew,
      cardsLearning,
      cardsReview: Math.max(0, currentProgress.cardsReview - cardsReviewed), // Reduce due cards
      cardsMastered,
      dueToday: Math.max(0, currentProgress.dueToday - cardsReviewed),
      streak: newStreak,
      lastStudied: today,
      totalTimeSpent: currentProgress.totalTimeSpent + sessionTimeMinutes,
      accuracy: newAccuracy,
    };

    // Auto-update status
    updatedProgress.status = calculateDeckStatus(updatedProgress);

    MOCK_PROGRESS[deckId] = updatedProgress;

    return updatedProgress;
  },

  /**
   * Mark deck as completed (all cards mastered)
   * @param deckId - Deck to complete
   * @returns Updated progress
   */
  completeDeck: async (deckId: string): Promise<DeckProgress> => {
    await simulateDelay(150);

    const currentProgress = MOCK_PROGRESS[deckId];
    if (!currentProgress) {
      throw new Error(`No progress found for deck "${deckId}"`);
    }

    const updatedProgress: DeckProgress = {
      ...currentProgress,
      cardsNew: 0,
      cardsLearning: 0,
      cardsReview: 0,
      cardsMastered: currentProgress.cardsTotal,
      dueToday: 0,
      status: 'completed',
      lastStudied: new Date(),
    };

    MOCK_PROGRESS[deckId] = updatedProgress;

    return updatedProgress;
  },

  /**
   * Reset deck progress (start over)
   * @param deckId - Deck to reset
   * @returns Reset progress
   */
  resetDeckProgress: async (deckId: string): Promise<DeckProgress> => {
    await simulateDelay(150);

    const deck = MOCK_DECKS.find((d) => d.id === deckId);
    if (!deck) {
      throw new Error(`Deck with ID "${deckId}" not found`);
    }

    const resetProgress: DeckProgress = {
      deckId,
      status: 'not-started',
      cardsTotal: deck.cardCount,
      cardsNew: deck.cardCount,
      cardsLearning: 0,
      cardsReview: 0,
      cardsMastered: 0,
      dueToday: 0,
      streak: 0,
      lastStudied: undefined,
      totalTimeSpent: 0,
      accuracy: 0,
    };

    MOCK_PROGRESS[deckId] = resetProgress;

    return resetProgress;
  },
};

/**
 * Calculate deck status based on progress metrics
 * @param progress - Current deck progress
 * @returns Calculated status
 */
function calculateDeckStatus(progress: DeckProgress): import('@/types/deck').DeckStatus {
  // Completed: 100% mastered
  if (progress.cardsMastered === progress.cardsTotal) {
    return 'completed';
  }

  // In progress: at least one card reviewed
  if (progress.cardsMastered > 0 || progress.cardsLearning > 0 || progress.totalTimeSpent > 0) {
    return 'in-progress';
  }

  // Not started: no progress yet
  return 'not-started';
}
