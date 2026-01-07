// src/stores/analyticsStore.ts

/**
 * Analytics Store
 *
 * Manages analytics data state and provides computed values for the analytics dashboard.
 *
 * Key Features:
 * - 5-minute cache to reduce API calls
 * - Date range filtering (last7, last30, alltime)
 * - Auto-refresh after review sessions
 * - Auto-cleanup on logout
 *
 * Usage Example:
 * ```tsx
 * function Dashboard() {
 *   const { loadAnalytics, setDateRange } = useAnalyticsStore();
 *   const dashboardData = useAnalyticsStore(selectDashboardData);
 *   const isLoading = useAnalyticsStore(selectIsLoading);
 *   const dateRange = useAnalyticsStore(selectDateRange);
 *
 *   useEffect(() => {
 *     loadAnalytics(userId);
 *   }, [userId]);
 *
 *   return (
 *     <>
 *       <DateRangeFilter
 *         selected={dateRange}
 *         onChange={setDateRange}
 *       />
 *       <ProgressLineChart />
 *       <ActivityFeed activities={dashboardData?.recentActivity} />
 *     </>
 *   );
 * }
 * ```
 *
 * Selectors:
 * - selectDashboardData: Get full dashboard data
 * - selectIsLoading: Get loading state
 * - selectError: Get error state
 * - selectDateRange: Get current date range
 *
 * Actions:
 * - loadAnalytics(userId, dateRange?): Fetch analytics data
 * - setDateRange(range): Change date range filter
 * - refreshAnalytics(): Force refresh (bypass cache)
 * - updateSnapshot(userId, sessionSummary): Update after review session
 * - clearAnalytics(): Clear all data (on logout)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { reportAPIError } from '@/lib/errorReporting';
import log from '@/lib/logger';
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
import type { SessionSummary } from '@/types/review';

/**
 * Date range type for analytics queries
 */
export type DateRangeType = 'last7' | 'last30' | 'alltime';

/**
 * Analytics state interface
 */
interface AnalyticsState {
  // Data
  dashboardData: AnalyticsDashboardData | null;
  dateRange: DateRangeType;

  // Loading states
  loading: boolean;
  refreshing: boolean;

  // Error state
  error: string | null;

  // Cache
  lastFetch: number | null;

  // Actions
  loadAnalytics: (userId: string, dateRange?: DateRangeType) => Promise<void>;
  setDateRange: (range: DateRangeType) => void;
  refreshAnalytics: () => Promise<void>;
  updateSnapshot: (userId: string, sessionSummary: SessionSummary) => Promise<void>;
  clearAnalytics: () => void;
}

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Check if cache is valid
 */
const isCacheValid = (lastFetch: number | null): boolean => {
  if (!lastFetch) return false;
  return Date.now() - lastFetch < CACHE_TTL;
};

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
 * Transform backend responses to frontend AnalyticsDashboardData
 */
const transformToAnalyticsDashboardData = (
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
    accuracy: day.average_quality * 20, // Convert 0-5 scale to 0-100
    timeStudied: day.study_time_seconds,
    streak: 0, // Not available per day
    cardsNew: 0,
    cardsLearning: day.cards_learning,
    cardsReview: 0,
  }));

  // Transform deck progress to deck performance stats
  const deckStats: DeckPerformanceStats[] = deckProgress.decks.map((deck, index) => ({
    deckId: deck.deck_id,
    deckName: deck.deck_name,
    deckColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'][index % 6],
    cardsInDeck: deck.total_cards,
    cardsNew: deck.total_cards - deck.cards_studied,
    cardsLearning: Math.round(deck.cards_studied * 0.3), // Estimate
    cardsReview: Math.round(deck.cards_studied * 0.4), // Estimate
    cardsMastered: deck.cards_mastered,
    accuracy: deck.mastery_percentage,
    successRate: deck.mastery_percentage,
    averageEaseFactor: deck.average_easiness_factor,
    timeSpent: deck.estimated_review_time_minutes * 60,
    sessionsCompleted: 0, // Not available
    averageTimePerCard: (deck.estimated_review_time_minutes * 60) / Math.max(deck.cards_studied, 1),
    mastery: deck.mastery_percentage,
    completionRate: deck.completion_percentage,
    recentAccuracy: deck.mastery_percentage,
    cardsGraduatedRecently: 0, // Not available
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
      totalTimeStudied: dashboard.today.study_time_seconds,
      averageAccuracy:
        dashboard.overview.accuracy_percentage ?? dashboard.overview.overall_mastery_percentage,
      cardsNewlyMastered: dashboard.overview.total_cards_mastered,
    },
    streak,
    progressData,
    deckStats,
    wordStatus,
    retention: [], // Not available from backend
    recentActivity,
  };
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
 * Fetch analytics data from backend and transform to frontend format
 */
const getAnalytics = async (
  userId: string,
  dateRange: DateRangeType
): Promise<AnalyticsDashboardData> => {
  const period = mapDateRangeToPeriod(dateRange);

  // Fetch all required data in parallel
  const [dashboard, trends, deckProgress] = await Promise.all([
    progressAPI.getDashboard(),
    progressAPI.getTrends({ period }),
    progressAPI.getDeckProgressList({ page: 1, page_size: 50 }),
  ]);

  // Transform to frontend format
  return transformToAnalyticsDashboardData(userId, dateRange, dashboard, trends, deckProgress);
};

/**
 * Update analytics snapshot after review session
 * Since backend calculates analytics from review data, we just invalidate cache
 * The actual data update happens on the backend when reviews are submitted
 */
const updateAnalyticsSnapshot = async (
  _userId: string,
  _sessionSummary: SessionSummary
): Promise<void> => {
  // No-op: Backend analytics are derived from review data
  // Cache invalidation happens in the store method
  log.debug('[analyticsStore] Snapshot invalidation requested - cache will refresh on next load');
};

/**
 * Analytics store with Zustand
 * Manages analytics dashboard data with 5-minute cache strategy
 */
export const useAnalyticsStore = create<AnalyticsState>()(
  devtools(
    (set, get) => ({
      // Initial state
      dashboardData: null,
      dateRange: 'last30',
      loading: false,
      refreshing: false,
      error: null,
      lastFetch: null,

      /**
       * Load analytics data for user
       * Implements 5-minute cache - skips fetch if data is fresh
       */
      loadAnalytics: async (userId: string, dateRange?: DateRangeType) => {
        const state = get();

        // Use provided dateRange or current state
        const targetRange = dateRange || state.dateRange;

        // Check cache validity (skip if same range and cache valid)
        if (
          state.dashboardData &&
          state.dateRange === targetRange &&
          isCacheValid(state.lastFetch)
        ) {
          log.debug('[analyticsStore] Using cached data');
          return;
        }

        // Set loading state
        set({ loading: true, error: null, dateRange: targetRange });

        try {
          // Fetch analytics data
          const data = await getAnalytics(userId, targetRange);

          set({
            dashboardData: data,
            loading: false,
            lastFetch: Date.now(),
          });
        } catch (error) {
          reportAPIError(error, { operation: 'loadAnalytics', endpoint: '/progress/dashboard' });
          set({
            error: error instanceof Error ? error.message : 'Failed to load analytics',
            loading: false,
          });
        }
      },

      /**
       * Set date range and refresh data
       * Forces refresh even if cache is valid
       */
      setDateRange: (range: DateRangeType) => {
        const state = get();

        // If range is different, clear cache and reload
        if (state.dateRange !== range) {
          set({ dateRange: range, lastFetch: null });

          // Get userId from dashboardData
          const userId = state.dashboardData?.userId;
          if (userId) {
            state.loadAnalytics(userId, range);
          }
        }
      },

      /**
       * Force refresh analytics data
       * Ignores cache and fetches fresh data
       */
      refreshAnalytics: async () => {
        const state = get();
        const userId = state.dashboardData?.userId;

        if (!userId) {
          log.warn('[analyticsStore] No userId available for refresh');
          return;
        }

        // Set refreshing state (different from loading)
        set({ refreshing: true, error: null, lastFetch: null });

        try {
          const data = await getAnalytics(userId, state.dateRange);

          set({
            dashboardData: data,
            refreshing: false,
            lastFetch: Date.now(),
          });
        } catch (error) {
          reportAPIError(error, { operation: 'refreshAnalytics', endpoint: '/progress/dashboard' });
          set({
            error: error instanceof Error ? error.message : 'Failed to refresh analytics',
            refreshing: false,
          });
        }
      },

      /**
       * Update analytics snapshot after review session
       * Called automatically after completing a review session
       */
      updateSnapshot: async (userId: string, sessionSummary: SessionSummary) => {
        try {
          await updateAnalyticsSnapshot(userId, sessionSummary);

          // Invalidate cache to force refresh on next load
          set({ lastFetch: null });

          log.debug('[analyticsStore] Analytics snapshot updated');
        } catch (error) {
          reportAPIError(error, { operation: 'updateSnapshot' });
          // Non-blocking error - don't set error state
        }
      },

      /**
       * Clear analytics state
       * Called on logout
       */
      clearAnalytics: () => {
        set({
          dashboardData: null,
          dateRange: 'last30',
          loading: false,
          refreshing: false,
          error: null,
          lastFetch: null,
        });
      },
    }),
    { name: 'analyticsStore' }
  )
);

// Empty arrays for default values to prevent re-render issues
const EMPTY_PROGRESS_DATA: any[] = [];
const EMPTY_DECK_STATS: any[] = [];
const EMPTY_RECENT_ACTIVITY: any[] = [];

// Selectors for optimized re-renders
export const selectDashboardData = (state: AnalyticsState) => state.dashboardData;
export const selectProgressData = (state: AnalyticsState) =>
  state.dashboardData?.progressData ?? EMPTY_PROGRESS_DATA;
export const selectDeckPerformance = (state: AnalyticsState) =>
  state.dashboardData?.deckStats ?? EMPTY_DECK_STATS;
export const selectStudyStreak = (state: AnalyticsState) => state.dashboardData?.streak;
export const selectRecentActivity = (state: AnalyticsState) =>
  state.dashboardData?.recentActivity ?? EMPTY_RECENT_ACTIVITY;
export const selectIsLoading = (state: AnalyticsState) => state.loading;
export const selectIsRefreshing = (state: AnalyticsState) => state.refreshing;
export const selectError = (state: AnalyticsState) => state.error;
export const selectDateRange = (state: AnalyticsState) => state.dateRange;
