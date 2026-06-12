import { stageDistribution } from '@/lib/progressGlossary';
import type {
  DashboardStatsResponse,
  LearningTrendsResponse,
  DeckProgressListResponse,
} from '@/services/progressAPI';
import type { DateRangeType } from '@/stores/dateRangeStore';
import type {
  AnalyticsDashboardData,
  ProgressDataPoint,
  DeckPerformanceStats,
  WordStatusBreakdown,
  StudyStreak,
  AnalyticsActivityItem,
} from '@/types/analytics';

/**
 * Format relative time
 */
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  // Compare local calendar days, not elapsed 24h windows, so an activity from
  // yesterday evening viewed this morning is "Yesterday" rather than "Today".
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Today';
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
    cardsNew: Math.max(0, deck.total_cards - deck.cards_studied),
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

  // Build word status breakdown from dashboard data.
  // Use stageDistribution() as the single selector — it excludes `due` from the
  // denominator and applies largest-remainder rounding so percents sum to 100.
  const stageDist = stageDistribution(dashboard.cards_by_status);
  const totalCards =
    stageDist.new.count +
    stageDist.learning.count +
    stageDist.review.count +
    stageDist.mastered.count;
  const wordStatus: WordStatusBreakdown = {
    new: stageDist.new.count,
    learning: stageDist.learning.count,
    review: stageDist.review.count,
    mastered: stageDist.mastered.count,
    newPercent: stageDist.new.percent,
    learningPercent: stageDist.learning.percent,
    reviewPercent: stageDist.review.percent,
    masteredPercent: stageDist.mastered.percent,
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
