// src/services/mockAnalyticsAPI.ts

import type {
  AnalyticsDashboardData,
  AnalyticsSnapshot,
  ProgressDataPoint,
  DeckPerformanceStats,
  WordStatusBreakdown,
  RetentionRate,
  StudyStreak,
  AnalyticsActivityItem,
} from '@/types/analytics';
import type { SessionSummary } from '@/types/review';

import {
  MOCK_ANALYTICS_SNAPSHOTS,
  getSnapshotsByDateRange,
  getLatestSnapshot,
  calculateDateRange,
} from './mockAnalyticsData';

/**
 * localStorage key for analytics data
 */
const ANALYTICS_DATA_KEY = 'learn-greek-easy:analytics-data';

/**
 * Simulate network delay
 *
 * @param ms - Delay in milliseconds
 */
const simulateDelay = (ms: number = 500): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Get snapshots from localStorage or use mock data
 *
 * @param userId - User ID
 * @returns Array of snapshots
 */
function getStoredSnapshots(userId: string): AnalyticsSnapshot[] {
  try {
    const stored = localStorage.getItem(`${ANALYTICS_DATA_KEY}-${userId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert date strings back to Date objects
      return parsed.map((s: any) => ({
        ...s,
        date: new Date(s.date),
        createdAt: new Date(s.createdAt),
      }));
    }
  } catch (error) {
    console.error('Failed to load analytics from localStorage:', error);
  }

  // Use mock data and save to localStorage
  localStorage.setItem(`${ANALYTICS_DATA_KEY}-${userId}`, JSON.stringify(MOCK_ANALYTICS_SNAPSHOTS));
  return MOCK_ANALYTICS_SNAPSHOTS;
}

/**
 * Save snapshots to localStorage
 *
 * @param userId - User ID
 * @param snapshots - Snapshots to save
 */
function saveSnapshots(userId: string, snapshots: AnalyticsSnapshot[]): void {
  try {
    localStorage.setItem(`${ANALYTICS_DATA_KEY}-${userId}`, JSON.stringify(snapshots));
  } catch (error) {
    console.error('Failed to save analytics to localStorage:', error);
  }
}

/**
 * Convert snapshots to progress data points
 *
 * @param snapshots - Analytics snapshots
 * @returns Progress data points for charting
 */
function convertSnapshotsToProgressData(snapshots: AnalyticsSnapshot[]): ProgressDataPoint[] {
  return snapshots.map((s) => ({
    date: new Date(s.date),
    dateString: s.date.toISOString().split('T')[0],
    cardsMastered: s.cardsMasteredTotal,
    cardsReviewed: s.cardsReviewedToday,
    accuracy: s.accuracyToday,
    timeStudied: s.timeStudiedToday,
    streak: s.currentStreak,
    cardsNew: s.totalCardsNew,
    cardsLearning: s.totalCardsLearning,
    cardsReview: s.totalCardsReview,
  }));
}

/**
 * Get complete analytics dashboard data for date range
 *
 * @param userId - User ID
 * @param dateRange - Date range preset
 * @returns Complete dashboard data
 */
export async function getAnalytics(
  userId: string,
  dateRange: 'last7' | 'last30' | 'alltime' = 'last7'
): Promise<AnalyticsDashboardData> {
  await simulateDelay(300 + Math.random() * 200);

  const { startDate, endDate, label } = calculateDateRange(dateRange);
  const allSnapshots = getStoredSnapshots(userId);
  const snapshots = getSnapshotsByDateRange(allSnapshots, startDate, endDate);

  const latestSnapshot = getLatestSnapshot(snapshots);

  if (!latestSnapshot) {
    throw new Error('No analytics data available');
  }

  // Calculate summary metrics
  const totalCardsReviewed = snapshots.reduce((sum, s) => sum + s.cardsReviewedToday, 0);
  const totalTimeStudied = snapshots.reduce((sum, s) => sum + s.timeStudiedToday, 0);
  const cardsNewlyMastered = snapshots.reduce((sum, s) => sum + s.cardsMasteredToday, 0);

  // Calculate average accuracy (weighted by cards reviewed)
  let totalAccuracyWeighted = 0;
  let totalCardsForAccuracy = 0;
  snapshots.forEach((s) => {
    if (s.cardsReviewedToday > 0) {
      totalAccuracyWeighted += s.accuracyToday * s.cardsReviewedToday;
      totalCardsForAccuracy += s.cardsReviewedToday;
    }
  });
  const averageAccuracy =
    totalCardsForAccuracy > 0 ? Math.round(totalAccuracyWeighted / totalCardsForAccuracy) : 0;

  return {
    userId,
    dateRange: {
      startDate,
      endDate,
      label,
    },
    fetchedAt: new Date(),
    summary: {
      totalCardsReviewed,
      totalTimeStudied,
      averageAccuracy,
      cardsNewlyMastered,
    },
    streak: await getStudyStreak(userId),
    progressData: convertSnapshotsToProgressData(snapshots),
    deckStats: await getDeckPerformance(userId),
    wordStatus: await getWordStatusBreakdown(userId),
    retention: await getRetentionRates(userId),
    recentActivity: await getRecentActivity(userId, 20),
  };
}

/**
 * Get progress data points for charts
 *
 * @param userId - User ID
 * @param startDate - Range start
 * @param endDate - Range end
 * @returns Progress data points
 */
export async function getProgressData(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<ProgressDataPoint[]> {
  await simulateDelay(250 + Math.random() * 150);

  const allSnapshots = getStoredSnapshots(userId);
  const snapshots = getSnapshotsByDateRange(allSnapshots, startDate, endDate);

  return convertSnapshotsToProgressData(snapshots);
}

/**
 * Get per-deck performance statistics
 *
 * @param _userId - User ID (unused in mock implementation)
 * @returns Deck performance stats
 */
export async function getDeckPerformance(_userId: string): Promise<DeckPerformanceStats[]> {
  await simulateDelay(300 + Math.random() * 200);

  // Mock deck performance data (8 decks from mockDeckData)
  const mockDecks: DeckPerformanceStats[] = [
    {
      deckId: 'deck-a1-basics',
      deckName: 'A1 Basic Vocabulary',
      deckColor: '#10b981',
      cardsInDeck: 20,
      cardsNew: 5,
      cardsLearning: 8,
      cardsReview: 4,
      cardsMastered: 3,
      accuracy: 85,
      successRate: 85,
      averageEaseFactor: 2.3,
      timeSpent: 4500,
      sessionsCompleted: 8,
      averageTimePerCard: 52,
      mastery: 15,
      completionRate: 75,
      recentAccuracy: 87,
      cardsGraduatedRecently: 2,
    },
    {
      deckId: 'deck-a1-greetings',
      deckName: 'A1 Greetings & Introductions',
      deckColor: '#3b82f6',
      cardsInDeck: 15,
      cardsNew: 2,
      cardsLearning: 5,
      cardsReview: 5,
      cardsMastered: 3,
      accuracy: 88,
      successRate: 88,
      averageEaseFactor: 2.4,
      timeSpent: 3200,
      sessionsCompleted: 6,
      averageTimePerCard: 48,
      mastery: 20,
      completionRate: 87,
      recentAccuracy: 90,
      cardsGraduatedRecently: 1,
    },
    {
      deckId: 'deck-a1-numbers',
      deckName: 'A1 Numbers & Time',
      deckColor: '#f97316',
      cardsInDeck: 25,
      cardsNew: 10,
      cardsLearning: 10,
      cardsReview: 3,
      cardsMastered: 2,
      accuracy: 80,
      successRate: 80,
      averageEaseFactor: 2.2,
      timeSpent: 5400,
      sessionsCompleted: 10,
      averageTimePerCard: 55,
      mastery: 8,
      completionRate: 60,
      recentAccuracy: 82,
      cardsGraduatedRecently: 1,
    },
    {
      deckId: 'deck-a2-family',
      deckName: 'A2 Family & Relationships',
      deckColor: '#764ba2',
      cardsInDeck: 30,
      cardsNew: 15,
      cardsLearning: 10,
      cardsReview: 3,
      cardsMastered: 2,
      accuracy: 78,
      successRate: 78,
      averageEaseFactor: 2.1,
      timeSpent: 6000,
      sessionsCompleted: 12,
      averageTimePerCard: 58,
      mastery: 7,
      completionRate: 50,
      recentAccuracy: 80,
      cardsGraduatedRecently: 1,
    },
    {
      deckId: 'deck-a2-food',
      deckName: 'A2 Food & Dining',
      deckColor: '#10b981',
      cardsInDeck: 35,
      cardsNew: 20,
      cardsLearning: 12,
      cardsReview: 2,
      cardsMastered: 1,
      accuracy: 75,
      successRate: 75,
      averageEaseFactor: 2.0,
      timeSpent: 7200,
      sessionsCompleted: 15,
      averageTimePerCard: 60,
      mastery: 3,
      completionRate: 43,
      recentAccuracy: 77,
      cardsGraduatedRecently: 0,
    },
    {
      deckId: 'deck-b1-travel',
      deckName: 'B1 Travel & Transportation',
      deckColor: '#3b82f6',
      cardsInDeck: 40,
      cardsNew: 30,
      cardsLearning: 8,
      cardsReview: 1,
      cardsMastered: 1,
      accuracy: 72,
      successRate: 72,
      averageEaseFactor: 1.9,
      timeSpent: 4800,
      sessionsCompleted: 8,
      averageTimePerCard: 62,
      mastery: 3,
      completionRate: 25,
      recentAccuracy: 74,
      cardsGraduatedRecently: 0,
    },
    {
      deckId: 'deck-b1-work',
      deckName: 'B1 Work & Business',
      deckColor: '#f97316',
      cardsInDeck: 45,
      cardsNew: 40,
      cardsLearning: 5,
      cardsReview: 0,
      cardsMastered: 0,
      accuracy: 70,
      successRate: 70,
      averageEaseFactor: 1.8,
      timeSpent: 3000,
      sessionsCompleted: 5,
      averageTimePerCard: 65,
      mastery: 0,
      completionRate: 11,
      recentAccuracy: 70,
      cardsGraduatedRecently: 0,
    },
    {
      deckId: 'deck-b2-politics',
      deckName: 'B2 Politics & Society',
      deckColor: '#764ba2',
      cardsInDeck: 50,
      cardsNew: 50,
      cardsLearning: 0,
      cardsReview: 0,
      cardsMastered: 0,
      accuracy: 0,
      successRate: 0,
      averageEaseFactor: 2.5,
      timeSpent: 0,
      sessionsCompleted: 0,
      averageTimePerCard: 0,
      mastery: 0,
      completionRate: 0,
      recentAccuracy: 0,
      cardsGraduatedRecently: 0,
    },
  ];

  return mockDecks;
}

/**
 * Get word status breakdown (pie chart data)
 *
 * @param userId - User ID
 * @param deckId - Optional deck filter
 * @returns Word status breakdown
 */
export async function getWordStatusBreakdown(
  userId: string,
  deckId?: string
): Promise<WordStatusBreakdown> {
  await simulateDelay(200 + Math.random() * 150);

  const snapshots = getStoredSnapshots(userId);
  const latestSnapshot = getLatestSnapshot(snapshots);

  if (!latestSnapshot) {
    throw new Error('No analytics data available');
  }

  const newCards = latestSnapshot.totalCardsNew;
  const learningCards = latestSnapshot.totalCardsLearning;
  const reviewCards = latestSnapshot.totalCardsReview;
  const masteredCards = latestSnapshot.cardsMasteredTotal;
  const relearningCards = Math.floor(learningCards * 0.15); // ~15% relearning

  const total = newCards + learningCards + reviewCards + masteredCards + relearningCards;

  return {
    new: newCards,
    learning: learningCards,
    review: reviewCards,
    mastered: masteredCards,
    relearning: relearningCards,
    newPercent: Math.round((newCards / total) * 100),
    learningPercent: Math.round((learningCards / total) * 100),
    reviewPercent: Math.round((reviewCards / total) * 100),
    masteredPercent: Math.round((masteredCards / total) * 100),
    relearningPercent: Math.round((relearningCards / total) * 100),
    total,
    deckId: deckId || 'all-decks',
    date: new Date(),
  };
}

/**
 * Get retention rates at different intervals
 *
 * @param _userId - User ID (unused in mock implementation)
 * @returns Retention rates for 1d, 7d, 14d, 30d
 */
export async function getRetentionRates(_userId: string): Promise<RetentionRate[]> {
  await simulateDelay(300 + Math.random() * 200);

  // Mock retention data with realistic decline curve
  return [
    {
      interval: 1,
      intervalLabel: '1 day',
      cardsReviewedAtInterval: 120,
      cardsRemembered: 110,
      retention: 92,
      calculatedAt: new Date(),
    },
    {
      interval: 7,
      intervalLabel: '7 days',
      cardsReviewedAtInterval: 95,
      cardsRemembered: 78,
      retention: 82,
      calculatedAt: new Date(),
    },
    {
      interval: 14,
      intervalLabel: '14 days',
      cardsReviewedAtInterval: 68,
      cardsRemembered: 52,
      retention: 76,
      calculatedAt: new Date(),
    },
    {
      interval: 30,
      intervalLabel: '30 days',
      cardsReviewedAtInterval: 42,
      cardsRemembered: 31,
      retention: 74,
      calculatedAt: new Date(),
    },
  ];
}

/**
 * Get study streak information
 *
 * @param userId - User ID
 * @returns Study streak data
 */
export async function getStudyStreak(userId: string): Promise<StudyStreak> {
  await simulateDelay(200 + Math.random() * 150);

  const snapshots = getStoredSnapshots(userId);
  const latestSnapshot = getLatestSnapshot(snapshots);

  if (!latestSnapshot) {
    throw new Error('No analytics data available');
  }

  const currentStreak = latestSnapshot.currentStreak;
  const longestStreak = latestSnapshot.longestStreak;

  // Calculate next milestone
  const milestones = [7, 30, 100, 365];
  const nextMilestone = milestones.find((m) => m > currentStreak) || 365;
  const milestoneReached = milestones.filter((m) => m <= currentStreak).pop() || 0;

  // Calculate streak start date
  const streakStartDate = new Date();
  streakStartDate.setDate(streakStartDate.getDate() - currentStreak);

  // Find longest streak dates (approximate)
  const longestStreakEnd = new Date();
  longestStreakEnd.setDate(longestStreakEnd.getDate() - 15); // ~15 days ago
  const longestStreakStart = new Date(longestStreakEnd);
  longestStreakStart.setDate(longestStreakStart.getDate() - longestStreak);

  return {
    currentStreak,
    startDate: streakStartDate,
    lastActivityDate: new Date(),
    longestStreak,
    longestStreakStart,
    longestStreakEnd,
    milestoneReached,
    nextMilestone,
    daysToNextMilestone: nextMilestone - currentStreak,
    streakBrokenToday: latestSnapshot.streakBroken,
    consecutiveBreaks: latestSnapshot.streakBroken ? 1 : 0,
  };
}

/**
 * Get recent activity feed
 *
 * @param userId - User ID
 * @param limit - Max items to return
 * @returns Recent activity items
 */
export async function getRecentActivity(
  userId: string,
  limit: number = 20
): Promise<AnalyticsActivityItem[]> {
  await simulateDelay(250 + Math.random() * 150);

  const snapshots = getStoredSnapshots(userId);

  // Generate activity items from snapshots
  const activities: AnalyticsActivityItem[] = [];

  // Get last N days with activity
  const activeDays = snapshots.filter((s) => s.cardsReviewedToday > 0).slice(-limit);

  activeDays.forEach((snapshot) => {
    // Create review session activity
    activities.push({
      activityId: `activity-${snapshot.snapshotId}`,
      type: 'review_session',
      timestamp: new Date(snapshot.date),
      relativeTime: getRelativeTime(new Date(snapshot.date)),
      title: `Reviewed ${snapshot.cardsReviewedToday} cards`,
      description: `${snapshot.accuracyToday}% accuracy · ${Math.floor(snapshot.timeStudiedToday / 60)} minutes`,
      cardsReviewed: snapshot.cardsReviewedToday,
      accuracy: snapshot.accuracyToday,
      timeSpent: snapshot.timeStudiedToday,
      newCardsMastered: snapshot.cardsMasteredToday,
      icon: 'book-open',
      color: 'blue',
    });

    // Add achievement for milestones
    if (snapshot.currentStreak === 7 || snapshot.currentStreak === 30) {
      activities.push({
        activityId: `milestone-${snapshot.snapshotId}`,
        type: 'streak_milestone',
        timestamp: new Date(snapshot.date),
        relativeTime: getRelativeTime(new Date(snapshot.date)),
        title: `Reached ${snapshot.currentStreak}-day streak!`,
        description: 'Keep up the daily practice',
        achievementType: 'streak_milestone',
        achievementValue: snapshot.currentStreak,
        icon: 'zap',
        color: 'yellow',
      });
    }

    // Add mastery achievement
    if (snapshot.cardsMasteredToday >= 5) {
      activities.push({
        activityId: `mastery-${snapshot.snapshotId}`,
        type: 'achievement',
        timestamp: new Date(snapshot.date),
        relativeTime: getRelativeTime(new Date(snapshot.date)),
        title: `Mastered ${snapshot.cardsMasteredToday} cards`,
        description: 'Great progress on your learning journey',
        achievementType: 'cards_mastered',
        achievementValue: snapshot.cardsMasteredToday,
        icon: 'trophy',
        color: 'green',
      });
    }
  });

  // Sort by timestamp descending
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return activities.slice(0, limit);
}

/**
 * Update analytics snapshot (called after review session)
 *
 * @param userId - User ID
 * @param sessionSummary - Completed session
 * @returns Updated snapshot
 */
export async function updateAnalyticsSnapshot(
  userId: string,
  sessionSummary: SessionSummary
): Promise<AnalyticsSnapshot> {
  await simulateDelay(200 + Math.random() * 150);

  const snapshots = getStoredSnapshots(userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find or create today's snapshot
  let todaySnapshot = snapshots.find(
    (s) => s.date.toISOString().split('T')[0] === today.toISOString().split('T')[0]
  );

  if (!todaySnapshot) {
    // Create new snapshot for today
    const latestSnapshot = getLatestSnapshot(snapshots);
    todaySnapshot = {
      snapshotId: `snapshot-${today.toISOString().split('T')[0]}-001`,
      userId,
      date: today,
      createdAt: new Date(),
      sessionsToday: 0,
      cardsReviewedToday: 0,
      timeStudiedToday: 0,
      newCardsToday: 0,
      cardsReviewedCorrectly: 0,
      accuracyToday: 0,
      totalCardsNew: latestSnapshot?.totalCardsNew ?? 100,
      totalCardsLearning: latestSnapshot?.totalCardsLearning ?? 40,
      totalCardsReview: latestSnapshot?.totalCardsReview ?? 20,
      cardsMasteredTotal: latestSnapshot?.cardsMasteredTotal ?? 10,
      cardsMasteredToday: 0,
      currentStreak: (latestSnapshot?.currentStreak ?? 0) + 1,
      longestStreak: latestSnapshot?.longestStreak ?? 0,
      overallAccuracy: latestSnapshot?.overallAccuracy ?? 80,
      averageTimePerCard: 0,
      streakBroken: false,
      newPersonalBest: false,
    };
    snapshots.push(todaySnapshot);
  }

  // Update snapshot with session data
  todaySnapshot.sessionsToday += 1;
  todaySnapshot.cardsReviewedToday += sessionSummary.cardsReviewed;
  todaySnapshot.timeStudiedToday += sessionSummary.totalTime;
  todaySnapshot.cardsReviewedCorrectly +=
    sessionSummary.ratingBreakdown.good + sessionSummary.ratingBreakdown.easy;
  todaySnapshot.accuracyToday = Math.round(
    (todaySnapshot.cardsReviewedCorrectly / todaySnapshot.cardsReviewedToday) * 100
  );
  todaySnapshot.averageTimePerCard = Math.round(
    todaySnapshot.timeStudiedToday / todaySnapshot.cardsReviewedToday
  );

  // Update cumulative metrics
  todaySnapshot.totalCardsNew = sessionSummary.deckProgressAfter.cardsNew;
  todaySnapshot.totalCardsLearning = sessionSummary.deckProgressAfter.cardsLearning;
  todaySnapshot.totalCardsReview = sessionSummary.deckProgressAfter.cardsReview;
  todaySnapshot.cardsMasteredTotal = sessionSummary.deckProgressAfter.cardsMastered;
  todaySnapshot.cardsMasteredToday += sessionSummary.transitions.reviewToMastered;

  // Save updated snapshots
  saveSnapshots(userId, snapshots);

  return todaySnapshot;
}

/**
 * Get current day snapshot
 *
 * @param userId - User ID
 * @returns Today's snapshot
 */
export async function getCurrentDaySnapshot(userId: string): Promise<AnalyticsSnapshot> {
  await simulateDelay(150 + Math.random() * 100);

  const snapshots = getStoredSnapshots(userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaySnapshot = snapshots.find(
    (s) => s.date.toISOString().split('T')[0] === today.toISOString().split('T')[0]
  );

  if (todaySnapshot) {
    return todaySnapshot;
  }

  // Return empty snapshot if no activity today
  const latestSnapshot = getLatestSnapshot(snapshots);
  return {
    snapshotId: `snapshot-${today.toISOString().split('T')[0]}-001`,
    userId,
    date: today,
    createdAt: new Date(),
    sessionsToday: 0,
    cardsReviewedToday: 0,
    timeStudiedToday: 0,
    newCardsToday: 0,
    cardsReviewedCorrectly: 0,
    accuracyToday: 0,
    totalCardsNew: latestSnapshot?.totalCardsNew ?? 100,
    totalCardsLearning: latestSnapshot?.totalCardsLearning ?? 40,
    totalCardsReview: latestSnapshot?.totalCardsReview ?? 20,
    cardsMasteredTotal: latestSnapshot?.cardsMasteredTotal ?? 10,
    cardsMasteredToday: 0,
    currentStreak: latestSnapshot?.currentStreak ?? 0,
    longestStreak: latestSnapshot?.longestStreak ?? 0,
    overallAccuracy: latestSnapshot?.overallAccuracy ?? 80,
    averageTimePerCard: 0,
    streakBroken: false,
    newPersonalBest: false,
  };
}

/**
 * Helper: Get relative time string
 *
 * @param date - Date to convert
 * @returns Relative time string
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }
}
