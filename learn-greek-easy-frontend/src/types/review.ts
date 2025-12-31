// src/types/review.ts

import type { Card as BaseCard } from './deck';

/**
 * Extended card type for vocabulary review with Greek language learning features
 * Extends base Card with detailed grammar and type-specific data
 */
export interface Card extends BaseCard {
  word?: string; // Greek word/phrase (optional for backward compatibility)
  translation?: string; // English translation (optional for backward compatibility)
  partOfSpeech?: 'noun' | 'verb' | 'adjective' | 'adverb';
  level?: 'A1' | 'A2' | 'B1' | 'B2';

  // Type-specific metadata
  nounData?: {
    gender: 'masculine' | 'feminine' | 'neuter';
    cases: {
      nominativeSingular: string;
      nominativePlural: string;
      genitiveSingular: string;
      genitivePlural: string;
    };
    exampleSentence: string;
    exampleTranslation: string;
  };

  verbData?: {
    voice: 'active' | 'passive' | 'middle';
    conjugations: {
      present: ConjugationSet;
      past: ConjugationSet;
      future: ConjugationSet;
    };
    exampleSentences: {
      present: { greek: string; english: string };
      past: { greek: string; english: string };
      future: { greek: string; english: string };
    };
  };
}

/**
 * Conjugation set for a verb tense (all 6 persons)
 */
export interface ConjugationSet {
  firstSingular: string;
  secondSingular: string;
  thirdSingular: string;
  firstPlural: string;
  secondPlural: string;
  thirdPlural: string;
}

/**
 * User's rating of card performance (Anki-style 4-button system)
 *
 * @remarks
 * - again: Card failed, review again (interval < 10 minutes)
 * - hard: Difficult card (interval × 1.2)
 * - good: Normal difficulty (standard interval)
 * - easy: Very easy card (interval × 2.5, graduate early)
 */
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

/**
 * Card review state in spaced repetition system
 *
 * @remarks
 * State transitions:
 * - new → learning (first review)
 * - learning → review (graduated after 1-2 reviews)
 * - review → mastered (21+ day interval, 80%+ success rate)
 * - any → relearning (failed review, reset to learning)
 */
export type CardReviewState = 'new' | 'learning' | 'review' | 'relearning' | 'mastered';

/**
 * Spaced repetition data for a single card (SM-2 algorithm)
 *
 * @remarks
 * Tracks all data needed for SM-2 spaced repetition algorithm:
 * - Interval: Days until next review (0 for new/learning cards)
 * - Ease Factor: Difficulty multiplier (1.3 - 2.5, default 2.5)
 * - Repetitions: Consecutive successful reviews
 * - Due Date: When card should be reviewed next
 */
export interface SpacedRepetitionData {
  cardId: string;
  deckId: string;

  // SM-2 algorithm parameters
  interval: number; // Days until next review (0 = learning, 1+ = review)
  easeFactor: number; // Difficulty multiplier (1.3 min, 2.5 default, no max)
  repetitions: number; // Consecutive successful reviews (resets on "again")

  // Current state
  state: CardReviewState; // Current learning state
  step: number; // Learning step (0 = 10m, 1 = 1d, 2+ = graduated)

  // Scheduling
  dueDate: Date | null; // When card is due (null = never reviewed)
  lastReviewed: Date | null; // Last review timestamp

  // Statistics
  reviewCount: number; // Total reviews (including failures)
  successCount: number; // Reviews rated "good" or "easy"
  failureCount: number; // Reviews rated "again"
  successRate: number; // Percentage (0-100)
}

/**
 * Extended card with spaced repetition data
 * Combines base Card interface with review state
 */
export interface CardReview extends Card {
  srData: SpacedRepetitionData;
  isEarlyPractice?: boolean; // Flag for early practice cards (not yet due)
}

/**
 * Review session for studying a deck
 *
 * @remarks
 * Tracks all data for a single review session:
 * - Cards in queue (due cards only)
 * - Current position in queue
 * - Performance ratings for each card
 * - Time spent and statistics
 */
export interface ReviewSession {
  sessionId: string;
  deckId: string;
  userId: string;

  // Session state
  status: 'active' | 'paused' | 'completed';
  startTime: Date;
  endTime: Date | null;
  pausedAt: Date | null;

  // Card queue
  cards: CardReview[]; // All cards in this session
  currentIndex: number; // Current position (0-based)

  // Ratings collected
  ratings: Array<{
    cardId: string;
    rating: ReviewRating;
    timeSpent: number; // Seconds spent on this card
    timestamp: Date;
  }>;

  // Session statistics
  stats: SessionStats;
}

/**
 * Real-time session statistics
 * Calculated as user reviews cards
 */
export interface SessionStats {
  cardsReviewed: number; // Cards completed so far
  cardsRemaining: number; // Cards left in queue

  // Performance
  accuracy: number; // Percentage (0-100)
  cardsCorrect: number; // Rated "good" or "easy"
  cardsIncorrect: number; // Rated "again"

  // Time tracking
  totalTime: number; // Total seconds elapsed
  averageTime: number; // Seconds per card

  // Rating breakdown
  againCount: number;
  hardCount: number;
  goodCount: number;
  easyCount: number;
}

/**
 * Session summary shown after completion
 * Includes performance metrics and state transitions
 */
export interface SessionSummary {
  sessionId: string;
  deckId: string;
  userId: string;
  completedAt: Date;

  // Performance summary
  cardsReviewed: number;
  accuracy: number; // Percentage (0-100)
  totalTime: number; // Seconds
  averageTimePerCard: number; // Seconds

  // Rating breakdown
  ratingBreakdown: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };

  // State transitions
  transitions: {
    newToLearning: number; // New cards started
    learningToReview: number; // Cards graduated
    reviewToMastered: number; // Cards mastered
    toRelearning: number; // Cards that failed
  };

  // Deck progress impact
  deckProgressBefore: {
    cardsNew: number;
    cardsLearning: number;
    cardsReview: number;
    cardsMastered: number;
  };
  deckProgressAfter: {
    cardsNew: number;
    cardsLearning: number;
    cardsReview: number;
    cardsMastered: number;
  };
}

/**
 * Queue configuration for review sessions
 * Controls which cards are included and in what order
 */
export interface QueueConfig {
  maxNewCards: number; // New cards per session (default: 20)
  maxReviewCards: number; // Review cards per session (default: 100)
  learningFirst: boolean; // Prioritize learning cards (default: true)
  randomize: boolean; // Randomize order (default: false)
}
