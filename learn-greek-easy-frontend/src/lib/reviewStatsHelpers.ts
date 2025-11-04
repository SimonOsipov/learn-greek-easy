// src/lib/reviewStatsHelpers.ts

import { getCardsForDeck } from '@/services/mockReviewData';
import type { SpacedRepetitionData } from '@/types/review';
import { isCardDueToday } from './dateUtils';

/**
 * localStorage key for review data
 */
const REVIEW_DATA_KEY = 'learn-greek-easy:review-data';

/**
 * Review statistics for a deck
 */
export interface DeckReviewStats {
  dueToday: number; // Cards due for review today
  cardsNew: number; // Cards not yet started
  cardsLearning: number; // Cards in learning state
  cardsMastered: number; // Cards mastered (21+ day interval)
  lastReviewed: Date | null; // Most recent review timestamp
}

/**
 * Load review data from localStorage
 * @returns Record of cardId to SpacedRepetitionData
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
 * Get all review data from localStorage
 * @returns Record of cardId to SpacedRepetitionData
 */
export function getAllReviewData(): Record<string, SpacedRepetitionData> {
  return loadReviewData();
}

/**
 * Get review data for specific deck
 * @param deckId - Deck ID to filter by
 * @returns Array of SpacedRepetitionData for the deck
 */
export function getDeckReviewData(deckId: string): SpacedRepetitionData[] {
  const allData = loadReviewData();
  return Object.values(allData).filter((sr) => sr.deckId === deckId);
}

/**
 * Calculate cards due today for a deck
 * @param deckId - Deck ID to calculate for
 * @returns Number of cards due today
 */
export function getCardsDueToday(deckId: string): number {
  const reviewData = loadReviewData();
  const allCards = getCardsForDeck(deckId);

  let dueCount = 0;

  allCards.forEach((card) => {
    // Get SR data from localStorage, fall back to card default
    const srData = reviewData[card.id] || card.srData;

    // New cards are always due
    if (srData.state === 'new') {
      dueCount++;
    } else if (srData.dueDate) {
      // Use shared date utility for consistent comparison
      const dueDateString = srData.dueDate instanceof Date
        ? srData.dueDate.toISOString()
        : srData.dueDate;
      if (isCardDueToday(dueDateString)) {
        dueCount++;
      }
    }
  });

  return dueCount;
}

/**
 * Calculate new cards (never reviewed) for a deck
 * @param deckId - Deck ID to calculate for
 * @returns Number of new cards
 */
export function getNewCardsCount(deckId: string): number {
  const reviewData = loadReviewData();
  const allCards = getCardsForDeck(deckId);

  let newCount = 0;

  allCards.forEach((card) => {
    const srData = reviewData[card.id] || card.srData;
    if (srData.state === 'new') {
      newCount++;
    }
  });

  return newCount;
}

/**
 * Calculate learning cards (in learning or relearning state) for a deck
 * @param deckId - Deck ID to calculate for
 * @returns Number of learning cards
 */
export function getLearningCardsCount(deckId: string): number {
  const reviewData = loadReviewData();
  const allCards = getCardsForDeck(deckId);

  let learningCount = 0;

  allCards.forEach((card) => {
    const srData = reviewData[card.id] || card.srData;
    if (srData.state === 'learning' || srData.state === 'relearning') {
      learningCount++;
    }
  });

  return learningCount;
}

/**
 * Calculate mastered cards for a deck
 * @param deckId - Deck ID to calculate for
 * @returns Number of mastered cards
 */
export function getMasteredCardsCount(deckId: string): number {
  const reviewData = loadReviewData();
  const allCards = getCardsForDeck(deckId);

  let masteredCount = 0;

  allCards.forEach((card) => {
    const srData = reviewData[card.id] || card.srData;
    if (srData.state === 'mastered') {
      masteredCount++;
    }
  });

  return masteredCount;
}

/**
 * Get last review date for a deck
 * @param deckId - Deck ID to check
 * @returns Most recent review date or null if never reviewed
 */
export function getLastReviewDate(deckId: string): Date | null {
  const reviewData = loadReviewData();
  const allCards = getCardsForDeck(deckId);

  let lastReviewed: Date | null = null;

  allCards.forEach((card) => {
    const srData = reviewData[card.id] || card.srData;
    if (srData.lastReviewed) {
      const reviewDate = new Date(srData.lastReviewed);
      if (!lastReviewed || reviewDate > lastReviewed) {
        lastReviewed = reviewDate;
      }
    }
  });

  return lastReviewed;
}

/**
 * Format date as relative time (e.g., "2 hours ago", "3 days ago")
 * @param date - Date to format
 * @returns Human-readable relative time string
 */
export function formatRelativeDate(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    // Fall back to formatted date
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  }
}

/**
 * Calculate comprehensive review statistics for a deck
 * @param deckId - Deck ID to calculate stats for
 * @returns Complete review statistics object
 */
export function calculateDeckReviewStats(deckId: string): DeckReviewStats {
  const reviewData = loadReviewData();
  const allCards = getCardsForDeck(deckId);

  let dueCount = 0;
  let newCount = 0;
  let learningCount = 0;
  let masteredCount = 0;
  let lastReviewed: Date | null = null;

  allCards.forEach((card) => {
    // Get SR data from localStorage, fall back to card default
    const srData = reviewData[card.id] || card.srData;

    // Count cards by state
    if (srData.state === 'new') {
      newCount++;
    } else if (srData.state === 'learning' || srData.state === 'relearning') {
      learningCount++;
    } else if (srData.state === 'mastered') {
      masteredCount++;
    }

    // Count due cards (new cards are always due)
    if (srData.state === 'new') {
      dueCount++;
    } else if (srData.dueDate) {
      // Use shared date utility for consistent comparison
      const dueDateString = srData.dueDate instanceof Date
        ? srData.dueDate.toISOString()
        : srData.dueDate;
      if (isCardDueToday(dueDateString)) {
        dueCount++;
      }
    }

    // Track latest review date
    if (srData.lastReviewed) {
      const reviewDate = new Date(srData.lastReviewed);
      if (!lastReviewed || reviewDate > lastReviewed) {
        lastReviewed = reviewDate;
      }
    }
  });

  return {
    dueToday: dueCount,
    cardsNew: newCount,
    cardsLearning: learningCount,
    cardsMastered: masteredCount,
    lastReviewed,
  };
}
