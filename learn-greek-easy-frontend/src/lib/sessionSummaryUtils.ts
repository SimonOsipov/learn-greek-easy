/**
 * Utility functions for session summary calculations and formatting
 *
 * This module provides pure functions for:
 * - Time formatting (seconds → "5m 32s")
 * - Percentage calculations with safe division
 * - Accuracy-based messaging
 * - Color class selection
 * - Transition detection
 * - Percentage adjustment for rounding errors
 */

import type { SessionSummary } from '@/types/review';

/**
 * Format seconds into human-readable time string
 *
 * Examples:
 * - 45 → "45s"
 * - 125 → "2m 5s"
 * - 300 → "5m"
 * - 0 → "0s"
 *
 * @param seconds - Total seconds (integer)
 * @returns Formatted time string
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) return `${remainingSeconds}s`;
  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Calculate accuracy percentage from SessionSummary
 *
 * Accuracy = (cardsCorrect / cardsReviewed) * 100
 * cardsCorrect = cards rated as "good" or "easy"
 *
 * @param summary - Session summary object
 * @returns Accuracy percentage (0-100)
 */
export function calculateAccuracy(summary: SessionSummary): number {
  if (summary.cardsReviewed === 0) return 0;

  const cardsCorrect = summary.ratingBreakdown.good + summary.ratingBreakdown.easy;
  return Math.round((cardsCorrect / summary.cardsReviewed) * 100);
}

/**
 * Get encouraging message based on accuracy and cards reviewed
 *
 * Message tiers:
 * - 100%: Perfect celebration
 * - 90%+: Excellent work
 * - 70%+: Great job
 * - 50%+: Good effort
 * - 0%: Supportive encouragement
 * - Default: Progress acknowledgment
 *
 * @param accuracy - Accuracy percentage (0-100)
 * @param cardsReviewed - Number of cards reviewed
 * @returns Encouraging message string
 */
export function getEncouragingMessage(accuracy: number, cardsReviewed: number): string {
  // Edge case: no cards reviewed
  if (cardsReviewed === 0) {
    return 'Session ended without reviewing cards.';
  }

  // Perfect score
  if (accuracy === 100) {
    return "Perfect session! You're crushing it!";
  }

  // Excellent (90%+)
  if (accuracy >= 90) {
    return "Excellent work! You're mastering this deck!";
  }

  // Great (70-89%)
  if (accuracy >= 70) {
    return 'Great job! Keep up the consistent practice!';
  }

  // Good (50-69%)
  if (accuracy >= 50) {
    return "Good effort! Keep practicing and you'll improve!";
  }

  // All "again" (0%)
  if (accuracy === 0) {
    return 'Keep going! Every review builds your foundation.';
  }

  // Default (1-49%)
  return "Every review counts! You're making progress!";
}

/**
 * Get Tailwind color class based on accuracy percentage
 *
 * Color tiers:
 * - ≥70%: green (good performance)
 * - 50-69%: orange (moderate performance)
 * - <50%: red (needs improvement)
 *
 * @param accuracy - Accuracy percentage (0-100)
 * @returns Tailwind text color class
 */
export function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 70) return 'text-green-600';
  if (accuracy >= 50) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Format rating breakdown into array with percentages
 *
 * Calculates percentage for each rating and adjusts for rounding errors
 * to ensure sum equals 100%.
 *
 * @param summary - Session summary object
 * @returns Array of rating breakdown items with percentages
 */
export interface RatingBreakdownItem {
  label: string;
  count: number;
  percentage: number;
  color: string;
  bgColor: string;
}

export function formatRatingBreakdown(summary: SessionSummary): RatingBreakdownItem[] {
  const { again, hard, good, easy } = summary.ratingBreakdown;
  const total = summary.cardsReviewed;

  // Calculate raw percentages
  const counts = [again, hard, good, easy];
  const percentages = adjustPercentages(counts, total);

  return [
    {
      label: 'Again',
      count: again,
      percentage: percentages[0],
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      label: 'Hard',
      count: hard,
      percentage: percentages[1],
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      label: 'Good',
      count: good,
      percentage: percentages[2],
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Easy',
      count: easy,
      percentage: percentages[3],
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
  ];
}

/**
 * Check if session has any meaningful state transitions
 *
 * Returns true if any cards changed state (new→learning, etc.)
 *
 * @param summary - Session summary object
 * @returns True if transitions occurred
 */
export function hasProgressTransitions(summary: SessionSummary): boolean {
  const { transitions } = summary;
  return (
    transitions.newToLearning > 0 ||
    transitions.learningToReview > 0 ||
    transitions.reviewToMastered > 0 ||
    transitions.toRelearning > 0
  );
}

/**
 * Adjust percentages to sum to exactly 100%
 *
 * Handles rounding errors by adjusting the largest value.
 * Example: [33.33, 33.33, 33.33] → [33, 33, 34] (sum = 100)
 *
 * @param counts - Array of counts
 * @param total - Total count
 * @returns Array of rounded percentages that sum to 100
 */
export function adjustPercentages(counts: number[], total: number): number[] {
  // Handle zero total
  if (total === 0) {
    return counts.map(() => 0);
  }

  // Calculate percentages
  const percentages = counts.map((c) => (c / total) * 100);
  const rounded = percentages.map(Math.round);
  const sum = rounded.reduce((a, b) => a + b, 0);

  // Adjust largest value to correct rounding error
  if (sum !== 100 && sum > 0) {
    const maxIndex = rounded.indexOf(Math.max(...rounded));
    rounded[maxIndex] += 100 - sum;
  }

  return rounded;
}
