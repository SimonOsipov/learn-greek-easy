// src/services/mockDeckAPI.ts

import type { Deck, DeckProgress, DeckFilters } from '@/types/deck';
import { MOCK_DECKS, MOCK_PROGRESS } from './mockDeckData';

/**
 * Simulate network delay
 */
const simulateDelay = (ms: number = 200): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
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
      decks = decks.filter(deck =>
        deck.title.toLowerCase().includes(search) ||
        deck.titleGreek.includes(search) ||
        deck.description.toLowerCase().includes(search)
      );
    }

    // Apply level filter
    if (filters?.levels && filters.levels.length > 0) {
      decks = decks.filter(deck => filters.levels!.includes(deck.level));
    }

    // Apply premium filter
    if (filters?.showPremiumOnly) {
      decks = decks.filter(deck => deck.isPremium);
    }

    // Inject progress data
    decks = decks.map(deck => ({
      ...deck,
      progress: MOCK_PROGRESS[deck.id],
    }));

    // Apply status filter (after progress injection)
    if (filters?.status && filters.status.length > 0) {
      decks = decks.filter(deck =>
        deck.progress && filters.status!.includes(deck.progress.status)
      );
    }

    return decks;
  },

  /**
   * Get single deck by ID
   */
  getDeckById: async (deckId: string): Promise<Deck> => {
    await simulateDelay(200);

    const deck = MOCK_DECKS.find(d => d.id === deckId);
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
    const deck = MOCK_DECKS.find(d => d.id === deckId);
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

    const deck = MOCK_DECKS.find(d => d.id === deckId);
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

    // Update status based on mastery
    if (updatedProgress.cardsMastered === updatedProgress.cardsTotal) {
      updatedProgress.status = 'completed';
    } else if (updatedProgress.cardsMastered > 0) {
      updatedProgress.status = 'in-progress';
    }

    MOCK_PROGRESS[deckId] = updatedProgress;

    return updatedProgress;
  },
};
