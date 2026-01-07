// src/lib/progressUtils.ts

import type { DeckProgress } from '@/types/deck';

/**
 * Progress Calculation Utilities
 *
 * Pure functions for deriving metrics from deck progress state.
 * Used across components for consistent calculations.
 */

/**
 * Calculate overall completion percentage
 * @param progress - Deck progress object
 * @returns Percentage (0-100)
 */
export function calculateCompletionPercentage(progress: DeckProgress): number {
  if (progress.cardsTotal === 0) return 0;
  const cardsInProgress = progress.cardsLearning + progress.cardsMastered;
  return Math.round((cardsInProgress / progress.cardsTotal) * 100);
}

/**
 * Calculate mastery rate (cards mastered / total)
 * @param progress - Deck progress object
 * @returns Percentage (0-100)
 */
export function calculateMasteryRate(progress: DeckProgress): number {
  if (progress.cardsTotal === 0) return 0;
  return Math.round((progress.cardsMastered / progress.cardsTotal) * 100);
}

/**
 * Estimate time remaining to complete deck
 * Assumes 2 minutes per card for cards not yet mastered
 * @param progress - Deck progress object
 * @returns Minutes remaining
 */
export function estimateTimeRemaining(progress: DeckProgress): number {
  const cardsRemaining = Math.max(0, progress.cardsTotal - progress.cardsMastered);
  const minutesPerCard = 2; // Average time per card
  return cardsRemaining * minutesPerCard;
}

/**
 * Format time in minutes to human-readable string
 * @param minutes - Time in minutes
 * @returns Formatted string (e.g., "1h 30m", "45m", "2h")
 */
export function formatTime(minutes: number): string {
  if (minutes === 0) return '0m';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  } else if (mins === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${mins}m`;
  }
}

/**
 * Format accuracy percentage with appropriate suffix
 * @param accuracy - Accuracy value (0-100)
 * @returns Formatted string (e.g., "85%", "100%")
 */
export function formatAccuracy(accuracy: number): string {
  return `${Math.round(accuracy)}%`;
}

/**
 * Calculate session statistics from progress difference
 * @param before - Progress before session
 * @param after - Progress after session
 * @returns Session stats
 */
export function calculateSessionStats(
  before: DeckProgress,
  after: DeckProgress
): {
  cardsReviewed: number;
  cardsLearned: number;
  cardsMastered: number;
  timeSpent: number;
  accuracyChange: number;
} {
  return {
    cardsReviewed: before.cardsNew - after.cardsNew + (before.cardsLearning - after.cardsLearning),
    cardsLearned: after.cardsLearning - before.cardsLearning,
    cardsMastered: after.cardsMastered - before.cardsMastered,
    timeSpent: after.totalTimeSpent - before.totalTimeSpent,
    accuracyChange: after.accuracy - before.accuracy,
  };
}

/**
 * Check if user should see a streak celebration
 * @param progress - Current deck progress
 * @returns True if streak milestone reached (5, 10, 25, 50, 100 days)
 */
export function isStreakMilestone(progress: DeckProgress): boolean {
  const milestones = [5, 10, 25, 50, 100];
  return milestones.includes(progress.streak);
}

/**
 * Get encouraging message based on progress
 * @param progress - Current deck progress
 * @returns Motivational message
 */
export function getProgressMessage(progress: DeckProgress): string {
  const completionPercent = calculateCompletionPercentage(progress);

  if (completionPercent === 0) {
    return "Let's get started!";
  } else if (completionPercent < 25) {
    return 'Great start! Keep going!';
  } else if (completionPercent < 50) {
    return "You're making great progress!";
  } else if (completionPercent < 75) {
    return 'More than halfway there!';
  } else if (completionPercent < 100) {
    return 'Almost there! Finish strong!';
  } else {
    return 'Deck completed! Amazing work!';
  }
}

/**
 * Calculate next review date based on spaced repetition
 * (Simplified for MVP - in real app would use SM-2 algorithm)
 * @param cardDifficulty - Current card difficulty level
 * @param wasCorrect - Whether last review was correct
 * @returns Days until next review
 */
export function calculateNextReviewDays(
  cardDifficulty: 'new' | 'learning' | 'review' | 'mastered',
  wasCorrect: boolean
): number {
  if (!wasCorrect) return 0; // Review today if incorrect

  switch (cardDifficulty) {
    case 'new':
      return 1; // Next day
    case 'learning':
      return 3; // 3 days later
    case 'review':
      return 7; // 1 week later
    case 'mastered':
      return 30; // 1 month later
    default:
      return 1;
  }
}

/**
 * Validate progress object (check for inconsistencies)
 * @param progress - Deck progress to validate
 * @returns Validation errors (empty array if valid)
 */
export function validateProgress(progress: DeckProgress): string[] {
  const errors: string[] = [];

  // Total cards should equal sum of states
  const sum =
    progress.cardsNew + progress.cardsLearning + progress.cardsReview + progress.cardsMastered;
  if (sum !== progress.cardsTotal) {
    errors.push(`Card count mismatch: ${sum} !== ${progress.cardsTotal}`);
  }

  // Accuracy should be 0-100
  if (progress.accuracy < 0 || progress.accuracy > 100) {
    errors.push(`Invalid accuracy: ${progress.accuracy}`);
  }

  // Streak should be non-negative
  if (progress.streak < 0) {
    errors.push(`Invalid streak: ${progress.streak}`);
  }

  // Time should be non-negative
  if (progress.totalTimeSpent < 0) {
    errors.push(`Invalid time: ${progress.totalTimeSpent}`);
  }

  return errors;
}
