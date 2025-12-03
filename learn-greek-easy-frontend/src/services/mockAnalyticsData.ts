// src/services/mockAnalyticsData.ts

import type { AnalyticsSnapshot } from '@/types/analytics';

/**
 * Generate a single daily snapshot with realistic data
 *
 * @param userId - User ID
 * @param date - Date for this snapshot
 * @param priorSnapshot - Previous day's snapshot (for cumulative metrics)
 * @returns AnalyticsSnapshot for the specified date
 */
function generateDailySnapshot(
  userId: string,
  date: Date,
  priorSnapshot: AnalyticsSnapshot | null
): AnalyticsSnapshot {
  // 70% chance of review today (realistic user activity)
  const hasReviewToday = Math.random() < 0.7;

  const snapshotId = `snapshot-${date.toISOString().split('T')[0]}-001`;
  const createdAt = new Date(date);
  createdAt.setHours(22, 0, 0, 0); // Created at end of day

  if (!hasReviewToday) {
    // No review today - copy prior metrics but reset daily counts
    return {
      snapshotId,
      userId,
      date: new Date(date),
      createdAt,
      sessionsToday: 0,
      cardsReviewedToday: 0,
      timeStudiedToday: 0,
      newCardsToday: 0,
      cardsReviewedCorrectly: 0,
      accuracyToday: 0,
      totalCardsNew: priorSnapshot?.totalCardsNew ?? 100,
      totalCardsLearning: priorSnapshot?.totalCardsLearning ?? 40,
      totalCardsReview: priorSnapshot?.totalCardsReview ?? 20,
      cardsMasteredTotal: priorSnapshot?.cardsMasteredTotal ?? 10,
      cardsMasteredToday: 0,
      currentStreak: 0, // Broken
      longestStreak: priorSnapshot?.longestStreak ?? 0,
      overallAccuracy: priorSnapshot?.overallAccuracy ?? 80,
      averageTimePerCard: 0,
      streakBroken: true,
      newPersonalBest: false,
    };
  }

  // Has review today - generate realistic session data
  const sessionsToday = Math.floor(Math.random() * 2) + 1; // 1-2 sessions
  const cardsReviewed = Math.floor(Math.random() * 28) + 8; // 8-35 cards
  const accuracy = Math.floor(Math.random() * 20) + 75; // 75-95%
  const cardsCorrect = Math.floor((cardsReviewed * accuracy) / 100);
  const timePerCard = Math.floor(Math.random() * 20) + 40; // 40-60 seconds
  const timeStudied = cardsReviewed * timePerCard;

  // Calculate streak
  const hasStreakPrior = priorSnapshot?.currentStreak ?? 0;
  const currentStreak = hasStreakPrior + 1;
  const longestStreak = Math.max(currentStreak, priorSnapshot?.longestStreak ?? 0);

  // Calculate cards mastered (about 1-3 per review session)
  const cardsNewMastered = Math.floor(Math.random() * 3) + 1;

  // Calculate new cards introduced
  const newCardsToday = Math.floor(Math.random() * 5);

  // Update cumulative totals with realistic progression
  const totalCardsNew = Math.max(
    (priorSnapshot?.totalCardsNew ?? 100) - Math.floor(cardsReviewed * 0.15),
    50
  );
  const totalCardsLearning =
    (priorSnapshot?.totalCardsLearning ?? 40) +
    Math.floor(cardsReviewed * 0.15) -
    Math.floor(cardsReviewed * 0.1);
  const totalCardsReview =
    (priorSnapshot?.totalCardsReview ?? 20) + Math.floor(cardsReviewed * 0.1);
  const cardsMasteredTotal = (priorSnapshot?.cardsMasteredTotal ?? 10) + cardsNewMastered;

  // Calculate overall accuracy (weighted average)
  const overallAccuracy = Math.round((priorSnapshot?.overallAccuracy ?? 80) * 0.7 + accuracy * 0.3);

  return {
    snapshotId,
    userId,
    date: new Date(date),
    createdAt,
    sessionsToday,
    cardsReviewedToday: cardsReviewed,
    timeStudiedToday: timeStudied,
    newCardsToday,
    cardsReviewedCorrectly: cardsCorrect,
    accuracyToday: accuracy,
    totalCardsNew,
    totalCardsLearning,
    totalCardsReview,
    cardsMasteredTotal,
    cardsMasteredToday: cardsNewMastered,
    currentStreak,
    longestStreak,
    overallAccuracy,
    averageTimePerCard: timePerCard,
    streakBroken: false,
    newPersonalBest: cardsReviewed > (priorSnapshot?.cardsReviewedToday ?? 0),
  };
}

/**
 * Generate 30 days of realistic analytics snapshots
 *
 * @param userId - User ID
 * @returns Array of 30 AnalyticsSnapshot objects (one per day)
 */
export function generate30DaysAnalytics(userId: string): AnalyticsSnapshot[] {
  const snapshots: AnalyticsSnapshot[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const priorSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const snapshot = generateDailySnapshot(userId, date, priorSnapshot);
    snapshots.push(snapshot);
  }

  return snapshots;
}

/**
 * Get snapshots for a specific date range
 *
 * @param snapshots - All snapshots
 * @param startDate - Range start (inclusive)
 * @param endDate - Range end (inclusive)
 * @returns Filtered snapshots
 */
export function getSnapshotsByDateRange(
  snapshots: AnalyticsSnapshot[],
  startDate: Date,
  endDate: Date
): AnalyticsSnapshot[] {
  return snapshots.filter((s) => {
    const snapshotDate = new Date(s.date);
    return snapshotDate >= startDate && snapshotDate <= endDate;
  });
}

/**
 * Get the latest snapshot
 *
 * @param snapshots - All snapshots
 * @returns Most recent snapshot or null
 */
export function getLatestSnapshot(snapshots: AnalyticsSnapshot[]): AnalyticsSnapshot | null {
  if (snapshots.length === 0) return null;
  return snapshots[snapshots.length - 1];
}

/**
 * Calculate date range boundaries
 *
 * @param range - Date range preset
 * @returns Start and end dates
 */
export function calculateDateRange(range: 'last7' | 'last30' | 'alltime'): {
  startDate: Date;
  endDate: Date;
  label: string;
} {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  let startDate: Date;
  let label: string;

  if (range === 'last7') {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
    label = 'Last 7 days';
  } else if (range === 'last30') {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    label = 'Last 30 days';
  } else {
    // alltime - start from 30 days ago (our mock data limit)
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    label = 'All time';
  }

  return { startDate, endDate, label };
}

/**
 * Mock analytics snapshots for user-123
 * Pre-generated for consistent demo experience
 */
export const MOCK_ANALYTICS_SNAPSHOTS = generate30DaysAnalytics('user-123');
