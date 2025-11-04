// src/lib/spacedRepetition.ts

/**
 * SM-2 (SuperMemo 2) Spaced Repetition Algorithm
 *
 * Pure TypeScript implementation for calculating optimal flashcard review intervals.
 * Based on: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 *
 * @module spacedRepetition
 */

import type { ReviewRating, SpacedRepetitionData, CardReviewState } from '@/types/review';

/**
 * SM-2 algorithm configuration constants
 */
const SM2_CONFIG = {
  INITIAL_EASE_FACTOR: 2.5,
  MIN_EASE_FACTOR: 1.3,
  MAX_EASE_FACTOR: 2.5,

  LEARNING_STEP_MINUTES: 10,    // First learning step (10 minutes)
  LEARNING_STEP_DAYS: 1,        // Second learning step (1 day)

  GRADUATING_GOOD: 1,           // Graduate with "good" (1 day)
  GRADUATING_EASY: 4,           // Graduate with "easy" (4 days)

  EASE_BONUS_EASY: 0.15,
  EASE_PENALTY_HARD: -0.15,
  EASE_PENALTY_AGAIN: -0.2,

  HARD_MULTIPLIER: 1.2,
  EASY_MULTIPLIER: 1.3,

  MASTERY_MIN_REVIEWS: 5,
  MASTERY_MIN_INTERVAL: 21,
  MASTERY_MIN_SUCCESS_RATE: 80,
} as const;

/**
 * Calculate next review interval based on SM-2 algorithm
 *
 * @param currentInterval - Current interval in days
 * @param easeFactor - Current ease factor (1.3 - 2.5)
 * @param repetitions - Consecutive successful reviews
 * @param rating - User's performance rating
 * @param state - Current card state
 * @returns New interval in days
 *
 * @example
 * const interval = calculateNextInterval(4, 2.5, 2, 'good', 'review');
 * // Returns: 10 (4 × 2.5 = 10 days)
 */
export function calculateNextInterval(
  currentInterval: number,
  easeFactor: number,
  _repetitions: number,
  rating: ReviewRating,
  state: CardReviewState
): number {
  // Reset to learning on failure
  if (rating === 'again') {
    return 0;
  }

  // Learning phase - use fixed graduating intervals
  if (state === 'new' || state === 'learning' || state === 'relearning') {
    if (rating === 'hard') return SM2_CONFIG.GRADUATING_GOOD; // 1 day
    if (rating === 'good') return SM2_CONFIG.GRADUATING_GOOD; // 1 day
    if (rating === 'easy') return SM2_CONFIG.GRADUATING_EASY; // 4 days
  }

  // Review phase - exponential growth
  if (state === 'review' || state === 'mastered') {
    if (rating === 'hard') {
      return Math.max(1, Math.round(currentInterval * SM2_CONFIG.HARD_MULTIPLIER));
    }
    if (rating === 'good') {
      return Math.round(currentInterval * easeFactor);
    }
    if (rating === 'easy') {
      return Math.round(currentInterval * easeFactor * SM2_CONFIG.EASY_MULTIPLIER);
    }
  }

  return 1; // Fallback
}

/**
 * Calculate adjusted ease factor based on performance rating
 *
 * @param currentEase - Current ease factor
 * @param rating - User's performance rating
 * @returns New ease factor (clamped to 1.3 - 2.5)
 *
 * @example
 * const newEase = calculateEaseFactor(2.5, 'hard');
 * // Returns: 2.35 (2.5 - 0.15 = 2.35)
 */
export function calculateEaseFactor(
  currentEase: number,
  rating: ReviewRating
): number {
  let adjustment = 0;

  switch (rating) {
    case 'again':
      adjustment = SM2_CONFIG.EASE_PENALTY_AGAIN;
      break;
    case 'hard':
      adjustment = SM2_CONFIG.EASE_PENALTY_HARD;
      break;
    case 'good':
      adjustment = 0;
      break;
    case 'easy':
      adjustment = SM2_CONFIG.EASE_BONUS_EASY;
      break;
  }

  const newEase = currentEase + adjustment;

  // Enforce bounds
  return Math.max(
    SM2_CONFIG.MIN_EASE_FACTOR,
    Math.min(SM2_CONFIG.MAX_EASE_FACTOR, newEase)
  );
}

/**
 * Get learning step intervals (10 minutes, 1 day)
 *
 * @returns Array of learning steps with intervals
 */
export function getLearningSteps(): Array<{ step: number; interval: number; unit: 'minutes' | 'days' }> {
  return [
    { step: 0, interval: SM2_CONFIG.LEARNING_STEP_MINUTES, unit: 'minutes' },
    { step: 1, interval: SM2_CONFIG.LEARNING_STEP_DAYS, unit: 'days' },
  ];
}

/**
 * Get graduating interval when transitioning from learning to review
 *
 * @param rating - User's rating (good = 1 day, easy = 4 days)
 * @returns Interval in days
 */
export function getGraduatingInterval(rating: ReviewRating): number {
  if (rating === 'easy') return SM2_CONFIG.GRADUATING_EASY;
  return SM2_CONFIG.GRADUATING_GOOD;
}

/**
 * Calculate next review date from current date and interval
 *
 * @param currentDate - Starting date (usually now)
 * @param intervalDays - Interval in days (0 = 10 minutes)
 * @returns Next review date
 *
 * @example
 * const dueDate = calculateNextReviewDate(new Date(), 7);
 * // Returns: Date 7 days from now
 */
export function calculateNextReviewDate(
  currentDate: Date,
  intervalDays: number
): Date {
  if (intervalDays === 0) {
    // Learning step: 10 minutes from now
    return new Date(currentDate.getTime() + SM2_CONFIG.LEARNING_STEP_MINUTES * 60 * 1000);
  }

  // Regular interval: N days from now
  const milliseconds = intervalDays * 24 * 60 * 60 * 1000;
  return new Date(currentDate.getTime() + milliseconds);
}

/**
 * Check if card is due for review
 *
 * @param dueDate - Scheduled review date (null = never reviewed)
 * @param currentDate - Current date (defaults to now)
 * @returns True if card should be shown in review queue
 *
 * @example
 * const isDue = isCardDue(new Date('2025-11-01'), new Date('2025-11-02'));
 * // Returns: true (due date has passed)
 */
export function isCardDue(
  dueDate: Date | null,
  currentDate: Date = new Date()
): boolean {
  if (dueDate === null) return true; // Never reviewed = always due

  // Normalize both dates to midnight for consistent day-based comparison
  // This ensures cards due "today" are correctly identified regardless of timestamp
  const dueDateNormalized = new Date(dueDate);
  dueDateNormalized.setHours(0, 0, 0, 0);

  const currentDateNormalized = new Date(currentDate);
  currentDateNormalized.setHours(0, 0, 0, 0);

  return dueDateNormalized <= currentDateNormalized;
}

/**
 * Process card review and update spaced repetition data
 *
 * Main entry point for SM-2 algorithm. Takes current card state and rating,
 * applies state transitions and interval calculations, returns updated state.
 *
 * @param currentSRData - Current spaced repetition data
 * @param rating - User's performance rating
 * @returns Updated spaced repetition data
 *
 * @example
 * const updated = processCardReview(currentSRData, 'good');
 * // Returns: Updated SR data with new interval, ease factor, state, etc.
 */
export function processCardReview(
  currentSRData: SpacedRepetitionData,
  rating: ReviewRating
): SpacedRepetitionData {
  const now = new Date();

  // Update review counts
  const reviewCount = currentSRData.reviewCount + 1;
  const successCount = (rating === 'good' || rating === 'easy')
    ? currentSRData.successCount + 1
    : currentSRData.successCount;
  const failureCount = (rating === 'again')
    ? currentSRData.failureCount + 1
    : currentSRData.failureCount;

  // Calculate new ease factor
  const newEaseFactor = calculateEaseFactor(currentSRData.easeFactor, rating);

  // Initialize next state variables
  let nextState: CardReviewState;
  let nextInterval: number;
  let nextStep: number;
  let nextRepetitions: number;

  // State machine: Determine next state based on current state and rating
  if (currentSRData.state === 'new') {
    if (rating === 'again' || rating === 'hard') {
      // Move to learning
      nextState = 'learning';
      nextInterval = 0; // 10 minutes
      nextStep = 0;
      nextRepetitions = 0;
    } else if (rating === 'good') {
      // Graduate to review (1 day)
      nextState = 'review';
      nextInterval = SM2_CONFIG.GRADUATING_GOOD;
      nextStep = 2; // Graduated
      nextRepetitions = 1;
    } else { // easy
      // Graduate to review (4 days)
      nextState = 'review';
      nextInterval = SM2_CONFIG.GRADUATING_EASY;
      nextStep = 2; // Graduated
      nextRepetitions = 1;
    }
  }
  else if (currentSRData.state === 'learning' || currentSRData.state === 'relearning') {
    if (rating === 'again') {
      // Reset to start of learning
      nextState = currentSRData.state; // Stay in learning/relearning
      nextInterval = 0; // 10 minutes
      nextStep = 0;
      nextRepetitions = 0;
    } else if (rating === 'hard') {
      // Stay in learning, 1 day interval
      nextState = currentSRData.state;
      nextInterval = SM2_CONFIG.LEARNING_STEP_DAYS;
      nextStep = 1;
      nextRepetitions = 0;
    } else if (rating === 'good') {
      // Graduate to review (1 day)
      nextState = 'review';
      nextInterval = SM2_CONFIG.GRADUATING_GOOD;
      nextStep = 2;
      nextRepetitions = 1;
    } else { // easy
      // Graduate to review (4 days)
      nextState = 'review';
      nextInterval = SM2_CONFIG.GRADUATING_EASY;
      nextStep = 2;
      nextRepetitions = 1;
    }
  }
  else if (currentSRData.state === 'review' || currentSRData.state === 'mastered') {
    if (rating === 'again') {
      // Reset to relearning
      nextState = 'relearning';
      nextInterval = 0; // 10 minutes
      nextStep = 0;
      nextRepetitions = 0;
    } else {
      // Calculate new interval using SM-2
      nextInterval = calculateNextInterval(
        currentSRData.interval,
        newEaseFactor,
        currentSRData.repetitions,
        rating,
        currentSRData.state
      );
      nextStep = 2; // Graduated
      nextRepetitions = currentSRData.repetitions + 1;

      // Check if qualifies for mastered status
      const candidateSRData: SpacedRepetitionData = {
        ...currentSRData,
        interval: nextInterval,
        repetitions: nextRepetitions,
        reviewCount,
        successCount,
        easeFactor: newEaseFactor,
      };
      nextState = checkMasteryStatus(candidateSRData);
    }
  }
  else {
    // Fallback (should never happen)
    nextState = currentSRData.state;
    nextInterval = 1;
    nextStep = currentSRData.step;
    nextRepetitions = currentSRData.repetitions;
  }

  // Calculate next due date
  const nextDueDate = calculateNextReviewDate(now, nextInterval);

  // Calculate success rate
  const successRate = Math.round((successCount / reviewCount) * 100);

  return {
    ...currentSRData,
    state: nextState,
    interval: nextInterval,
    easeFactor: newEaseFactor,
    repetitions: nextRepetitions,
    step: nextStep,
    dueDate: nextDueDate,
    lastReviewed: now,
    reviewCount,
    successCount,
    failureCount,
    successRate,
  };
}

/**
 * Check if card qualifies for "mastered" status
 *
 * Criteria (all must be true):
 * - 5+ total reviews
 * - 21+ day interval
 * - 80%+ success rate
 *
 * @param srData - Spaced repetition data to check
 * @returns 'mastered' if qualified, otherwise current state
 */
function checkMasteryStatus(srData: SpacedRepetitionData): CardReviewState {
  const hasEnoughReviews = srData.reviewCount >= SM2_CONFIG.MASTERY_MIN_REVIEWS;
  const hasLongInterval = srData.interval >= SM2_CONFIG.MASTERY_MIN_INTERVAL;
  const hasHighSuccessRate = srData.successRate >= SM2_CONFIG.MASTERY_MIN_SUCCESS_RATE;

  if (hasEnoughReviews && hasLongInterval && hasHighSuccessRate) {
    return 'mastered';
  }

  // If currently mastered but no longer qualifies, demote to review
  if (srData.state === 'mastered') {
    return 'review';
  }

  return srData.state;
}
