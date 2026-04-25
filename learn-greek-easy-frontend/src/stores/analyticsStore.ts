// src/stores/analyticsStore.ts
/**
 * Analytics fetch and transform helpers.
 * PERF-01-09 will relocate these out of /stores into a dedicated module.
 */

import { progressAPI } from '@/services/progressAPI';
import type {
  DashboardStatsResponse,
  LearningTrendsResponse,
  DeckProgressListResponse,
} from '@/services/progressAPI';
import type {
  AnalyticsDashboardData,
  ProgressDataPoint,
  DeckPerformanceStats,
  WordStatusBreakdown,
  StudyStreak,
  AnalyticsActivityItem,
} from '@/types/analytics';

/**
 * Date range type for analytics queries
 */
export type DateRangeType = 'last7' | 'last30' | 'alltime';

/**
 * Map date range type to API period parameter
 */
const mapDateRangeToPeriod = (dateRange: DateRangeType): 'week' | 'month' | 'year' => {
  switch (dateRange) {
    case 'last7':
      return 'week';
    case 'last30':
      return 'month';
    case 'alltime':
      return 'year';
    default:
      return 'month';
  }
};

/**
 * Format relative time
 */
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

/**
 * Transform backend responses to frontend AnalyticsDashboardData
 */
export const transformToAnalyticsDashboardData = (
  userId: string,
  dateRange: DateRangeType,
  dashboard: DashboardStatsResponse,
  trends: LearningTrendsResponse,
  deckProgress: DeckProgressListResponse
): AnalyticsDashboardData => {
  const now = new Date();
  const startDate = new Date(trends.start_date);
  const endDate = new Date(trends.end_date);

  // Transform daily stats to progress data points
  const progressData: ProgressDataPoint[] = trends.daily_stats.map((day) => ({
    date: new Date(day.date),
    dateString: day.date,
    cardsMastered: day.cards_mastered,
    cardsReviewed: day.reviews_count,
    accuracy: day.combined_accuracy ?? day.average_quality * 20,
    vocabAccuracy: day.vocab_accuracy ?? 0,
    cultureAccuracy: day.culture_accuracy ?? 0,
    timeStudied: day.study_time_seconds,
    streak: 0,
    cardsNew: 0,
    cardsLearning: day.cards_learning,
    cardsReview: 0,
  }));

  // Transform deck progress to deck performance stats
  const deckStats: DeckPerformanceStats[] = deckProgress.decks.map((deck, index) => ({
    deckId: deck.deck_id,
    deckName: deck.deck_name,
    deckColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'][index % 6],
    deckType: deck.deck_type || 'vocabulary',
    cardsInDeck: deck.total_cards,
    cardsNew: deck.total_cards - deck.cards_studied,
    cardsLearning: Math.round(deck.cards_studied * 0.3),
    cardsReview: Math.round(deck.cards_studied * 0.4),
    cardsMastered: deck.cards_mastered,
    accuracy: deck.mastery_percentage,
    successRate: deck.mastery_percentage,
    averageEaseFactor: deck.average_easiness_factor,
    timeSpent: deck.estimated_review_time_minutes * 60,
    sessionsCompleted: 0,
    averageTimePerCard: (deck.estimated_review_time_minutes * 60) / Math.max(deck.cards_studied, 1),
    mastery: deck.mastery_percentage,
    completionRate: deck.completion_percentage,
    recentAccuracy: deck.mastery_percentage,
    cardsGraduatedRecently: 0,
  }));

  // Build word status breakdown from dashboard data
  const totalCards = Object.values(dashboard.cards_by_status).reduce((a, b) => a + b, 0);
  const wordStatus: WordStatusBreakdown = {
    new: dashboard.cards_by_status.new,
    learning: dashboard.cards_by_status.learning,
    review: dashboard.cards_by_status.review,
    mastered: dashboard.cards_by_status.mastered,
    relearning: 0,
    newPercent: totalCards > 0 ? (dashboard.cards_by_status.new / totalCards) * 100 : 0,
    learningPercent: totalCards > 0 ? (dashboard.cards_by_status.learning / totalCards) * 100 : 0,
    reviewPercent: totalCards > 0 ? (dashboard.cards_by_status.review / totalCards) * 100 : 0,
    masteredPercent: totalCards > 0 ? (dashboard.cards_by_status.mastered / totalCards) * 100 : 0,
    relearningPercent: 0,
    total: totalCards,
    deckId: 'all',
    date: now,
  };

  // Build streak from dashboard data
  const streak: StudyStreak = {
    currentStreak: dashboard.streak.current_streak,
    startDate: dashboard.streak.last_study_date ? new Date(dashboard.streak.last_study_date) : now,
    lastActivityDate: dashboard.streak.last_study_date
      ? new Date(dashboard.streak.last_study_date)
      : now,
    longestStreak: dashboard.streak.longest_streak,
    longestStreakStart: now,
    longestStreakEnd: now,
    milestoneReached: Math.floor(dashboard.streak.current_streak / 7) * 7,
    nextMilestone: (Math.floor(dashboard.streak.current_streak / 7) + 1) * 7,
    daysToNextMilestone:
      (Math.floor(dashboard.streak.current_streak / 7) + 1) * 7 - dashboard.streak.current_streak,
    streakBrokenToday: false,
    consecutiveBreaks: 0,
  };

  // Transform recent activity
  const recentActivity: AnalyticsActivityItem[] = dashboard.recent_activity.map(
    (activity, index) => ({
      activityId: `activity-${index}`,
      type: 'review_session' as const,
      timestamp: new Date(activity.date),
      relativeTime: formatRelativeTime(new Date(activity.date)),
      title: `Reviewed ${activity.reviews_count} cards`,
      description: `${Math.round(activity.average_quality * 20)}% accuracy`,
      cardsReviewed: activity.reviews_count,
      accuracy: activity.average_quality * 20,
      icon: 'book-open',
      color: 'blue',
    })
  );

  return {
    userId,
    dateRange: {
      startDate,
      endDate,
      label:
        dateRange === 'last7'
          ? 'Last 7 days'
          : dateRange === 'last30'
            ? 'Last 30 days'
            : 'All time',
    },
    fetchedAt: now,
    summary: {
      totalCardsReviewed: dashboard.overview.total_cards_studied,
      totalTimeStudied: dashboard.overview.total_study_time_seconds,
      averageAccuracy:
        dashboard.overview.accuracy_percentage ?? dashboard.overview.overall_mastery_percentage,
      cardsNewlyMastered: dashboard.overview.total_cards_mastered,
      cultureQuestionsMastered: dashboard.overview.culture_questions_mastered ?? 0,
    },
    streak,
    progressData,
    deckStats,
    wordStatus,
    retention: [],
    recentActivity,
  };
};

/**
 * Fetch analytics data from backend and transform to frontend format
 */
export const getAnalytics = async (
  userId: string,
  dateRange: DateRangeType
): Promise<AnalyticsDashboardData> => {
  const period = mapDateRangeToPeriod(dateRange);

  const [dashboard, trends, deckProgress] = await Promise.all([
    progressAPI.getDashboard(),
    progressAPI.getTrends({ period }),
    progressAPI.getDeckProgressList({ page: 1, page_size: 50 }),
  ]);

  return transformToAnalyticsDashboardData(userId, dateRange, dashboard, trends, deckProgress);
};
