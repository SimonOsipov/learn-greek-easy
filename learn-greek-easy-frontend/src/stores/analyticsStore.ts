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
import type { AnalyticsDashboardData } from '@/types/analytics';
import type { SessionSummary } from '@/types/review';
import {
  getAnalytics,
  updateAnalyticsSnapshot,
} from '@/services/mockAnalyticsAPI';

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
          console.log('[analyticsStore] Using cached data');
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
          console.error('[analyticsStore] Failed to load analytics:', error);
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
          console.warn('[analyticsStore] No userId available for refresh');
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
          console.error('[analyticsStore] Failed to refresh analytics:', error);
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

          console.log('[analyticsStore] Analytics snapshot updated');
        } catch (error) {
          console.error('[analyticsStore] Failed to update snapshot:', error);
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
export const selectStudyStreak = (state: AnalyticsState) =>
  state.dashboardData?.streak;
export const selectRecentActivity = (state: AnalyticsState) =>
  state.dashboardData?.recentActivity ?? EMPTY_RECENT_ACTIVITY;
export const selectIsLoading = (state: AnalyticsState) => state.loading;
export const selectIsRefreshing = (state: AnalyticsState) => state.refreshing;
export const selectError = (state: AnalyticsState) => state.error;
export const selectDateRange = (state: AnalyticsState) => state.dateRange;
